// src/stores/wurst.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, db } from '@/firebase'
import {
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDoc,
  setDoc,
  getDocFromServer,
} from 'firebase/firestore'
import {
  getDownloadURL,
  ref as sRef,
  deleteObject,
  uploadBytesResumable,
} from 'firebase/storage'
import { useAuthStore } from './auth'

export type Wurst = {
  id: string
  name: string
  sausagesPerPack: number
  totalPacks: number
  reservedPacks: number
  pricePerPack: number
  imageUrl: string
  imagePath: string
}

const DEFAULT_IMAGE_PATH = 'defaults/wurst.png' // <- muss in Storage existieren

export const useWurstStore = defineStore('wurst', () => {
  const list = ref<Wurst[]>([])
  const loading = ref(false)
  const unsubRef = ref<null | (() => void)>(null)


  // ✅ ADMIN: neue Wurst anlegen (Bild optional)
  async function createWurst(payload: {
    name: string
    sausagesPerPack: number
    totalPacks: number
    pricePerPack: number
    file?: File | null
    onProgress?: (pct: number) => void
  }) {
    const auth = useAuthStore()

    // 0) falls File vorhanden: validieren
    if (payload.file && !payload.file.type?.startsWith('image/')) {
      throw new Error('Nur Bilddateien erlaubt')
    }

    // 1) Firestore-Dokument anlegen (ID bekommen)
    const docRef = await addDoc(collection(db, 'wuerste'), {
      name: payload.name.trim(),
      sausagesPerPack: Number(payload.sausagesPerPack),
      totalPacks: Number(payload.totalPacks),
      pricePerPack: Number(payload.pricePerPack),
      reservedPacks: 0,
      imageUrl: '',
      imagePath: '',
      createdAt: serverTimestamp(),
      createdBy: auth.user?.uid ?? null,
    })

    // 2) Bild bestimmen: Upload oder Default
    let finalPath = DEFAULT_IMAGE_PATH
    let finalUrl = ''

    // --- FALL A: kein File -> Default aus Storage nehmen
    if (!payload.file) {
      const defRef = sRef(storage, DEFAULT_IMAGE_PATH)
      finalUrl = await getDownloadURL(defRef)

      await updateDoc(doc(db, 'wuerste', docRef.id), {
        imageUrl: finalUrl,
        imagePath: finalPath,
      })
      return
    }

    // --- FALL B: File hochladen
    const fileName = payload.file.name.replace(/\s+/g, '_')
    finalPath = `wuerste/${docRef.id}/${fileName}`
    const fileRef = sRef(storage, finalPath)

    const task = uploadBytesResumable(fileRef, payload.file, {
      contentType: payload.file.type || 'image/png',
    })

    try {
      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            const pct = (snap.bytesTransferred / snap.totalBytes) * 100
            payload.onProgress?.(Math.round(pct))
          },
          (err) => reject(err),
          () => resolve(),
        )
      })

      finalUrl = await getDownloadURL(fileRef)

      await updateDoc(doc(db, 'wuerste', docRef.id), {
        imageUrl: finalUrl,
        imagePath: finalPath,
      })
    } catch (err) {
      // Rollback bei Fehler
      try {
        await deleteObject(fileRef)
      } catch {}
      await deleteDoc(doc(db, 'wuerste', docRef.id))
      throw err
    }
  }

  async function deleteWurst(id: string, imagePath?: string) {
    // ✅ Default-Bild nicht löschen
    if (imagePath && imagePath !== DEFAULT_IMAGE_PATH) {
      try {
        await deleteObject(sRef(storage, imagePath))
      } catch {
        /* ignore */
      }
    }
    await deleteDoc(doc(db, 'wuerste', id))
  }

  async function updateWurst(
    id: string,
    data: Partial<Pick<Wurst, 'pricePerPack' | 'totalPacks' | 'name' | 'sausagesPerPack'>>,
  ) {
    await updateDoc(doc(db, 'wuerste', id), data as any)
  }

  function watchAll() {
    if (unsubRef.value) return
    const q = query(collection(db, 'wuerste'), orderBy('createdAt', 'desc'))
    unsubRef.value = onSnapshot(q, (snap) => {
      list.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Wurst[]
    })
  }

  function stop() {
    if (unsubRef.value) {
      unsubRef.value()
      unsubRef.value = null
    }
  }

  // ✅ SUMME aller Reservierungen live beobachten (für Restbestand)
  function watchReservedSum(wurstId: string, cb: (sum: number) => void) {
    const qy = collection(db, 'wuerste', wurstId, 'reservations')
    return onSnapshot(
      qy,
      (snap) => {
        let sum = 0
        snap.forEach((d) => (sum += Number((d.data() as any)?.quantity || 0)))
        cb(sum)
      },
      (err) => {
        console.error('watchReservedSum error:', err)
        cb(0)
      },
    )
  }

  // ✅ Eigene Reservierung live beobachten (für Prefill nach Reload / andere Geräte)
  function watchMyReservation(wurstId: string, cb: (qty: number) => void) {
    const auth = useAuthStore()
    const uid = auth.user?.uid
    if (!uid) {
      cb(0)
      return () => {}
    }
    const rRef = doc(db, 'wuerste', wurstId, 'reservations', uid)
    return onSnapshot(
      rRef,
      (snap) => cb(snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0),
      (err) => {
        console.error('watchMyReservation error:', err)
        cb(0)
      },
    )
  }

  // ✅ (dein createWurst bleibt wie er ist)

  async function setReservation(wurstId: string, quantity: number) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Nicht eingeloggt')
    const uid = auth.user.uid

    const rRef = doc(db, 'wuerste', wurstId, 'reservations', uid)
    const nextQty = Math.max(0, Math.floor(quantity))

    await setDoc(rRef, { uid, quantity: nextQty, updatedAt: serverTimestamp() }, { merge: true })

    // Server-Check (optional, aber gut)
    const snap = await getDocFromServer(rRef)
    if (!snap.exists()) throw new Error('Reservierung wurde nicht am Server gespeichert.')
  }

  // ✅ Prefill verlässlicher: erst Server versuchen, dann Cache fallback
  async function getMyReservation(wurstId: string): Promise<number> {
    const auth = useAuthStore()
    if (!auth.user) return 0

    const rRef = doc(db, 'wuerste', wurstId, 'reservations', auth.user.uid)
    try {
      const snap = await getDocFromServer(rRef)
      return snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0
    } catch {
      const snap = await getDoc(rRef)
      return snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0
    }
  }

  const items = computed(() =>
    list.value.map((w) => ({
      ...w,
      remainingPacks: Math.max(0, (w.totalPacks || 0) - (w.reservedPacks || 0)),
    })),
  )

  async function updateWurstImage(payload: {
  id: string
  file: File
  currentImagePath?: string
  onProgress?: (pct: number) => void
}) {
  if (!payload.file.type?.startsWith('image/')) throw new Error('Nur Bilddateien erlaubt')

  const fileName = payload.file.name.replace(/\s+/g, '_')
  const newPath = `wuerste/${payload.id}/${Date.now()}_${fileName}`
  const fileRef = sRef(storage, newPath)

  const task = uploadBytesResumable(fileRef, payload.file, {
    contentType: payload.file.type || 'image/png',
  })

  try {
    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          const pct = (snap.bytesTransferred / snap.totalBytes) * 100
          payload.onProgress?.(Math.round(pct))
        },
        reject,
        () => resolve(),
      )
    })

    const newUrl = await getDownloadURL(fileRef)

    await updateDoc(doc(db, 'wuerste', payload.id), {
      imageUrl: newUrl,
      imagePath: newPath,
    })

    // altes Bild löschen (außer Default, und nicht das neue)
    const old = payload.currentImagePath
    if (old && old !== DEFAULT_IMAGE_PATH && old !== newPath) {
      try {
        await deleteObject(sRef(storage, old))
      } catch {
        /* ignore */
      }
    }

    return { imageUrl: newUrl, imagePath: newPath }
  } catch (err) {
    // Upload fehlgeschlagen -> neues Objekt wieder löschen
    try {
      await deleteObject(fileRef)
    } catch {
      /* ignore */
    }
    throw err
  }
}


  return {
    items,
    loading,
    watchAll,
    stop,
    createWurst,
    updateWurstImage,
    updateWurst,
    deleteWurst,
    setReservation,
    getMyReservation,
    watchReservedSum,
    watchMyReservation,
  }
})
