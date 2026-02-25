// src/stores/umfrage.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, storage } from '@/firebase'
import {
  addDoc, collection, serverTimestamp, onSnapshot, doc,
  updateDoc, deleteDoc, query, orderBy, setDoc, getDoc, getDocFromServer
} from 'firebase/firestore'
import { getDownloadURL, ref as sRef, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { useAuthStore } from './auth'

export type Umfrage = {
  id: string
  name: string
  sausagesPerPack: number
  category: string
  totalPacks?: number | null
  pricePerPack?: number | null
  imageUrl: string
  imagePath: string
  status?: 'open' | 'converted'
  convertedWurstId?: string
}

export type WillHabenEntry = {
  uid: string
  name: string
  quantity: number
}


async function getUserName(uid: string): Promise<string> {
  try {
    const uSnap = await getDoc(doc(db, 'users', uid))
    const d: any = uSnap.exists() ? uSnap.data() : null
    return d?.displayName || d?.email || uid
  } catch {
    return uid
  }
}

const DEFAULT_IMAGE_PATH = 'defaults/wurst.png'

export const useUmfragenStore = defineStore('umfragen', () => {
  const list = ref<Umfrage[]>([])
  const unsubRef = ref<null | (() => void)>(null)

  function watchAll() {
    if (unsubRef.value) return
    const q = query(collection(db, 'umfragen'), orderBy('createdAt', 'desc'))
    unsubRef.value = onSnapshot(q, (snap) => {
      list.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Umfrage[]
    })
  }

  function stop() {
    if (unsubRef.value) { unsubRef.value(); unsubRef.value = null }
  }

  async function createUmfrage(payload: {
    name: string
    sausagesPerPack: number
    category: string
    totalPacks?: number | null
    pricePerPack?: number | null
    file?: File | null
    onProgress?: (pct: number) => void
  }) {
    const auth = useAuthStore()
    if (payload.file && !payload.file.type?.startsWith('image/')) throw new Error('Nur Bilddateien erlaubt')

    const docRef = await addDoc(collection(db, 'umfragen'), {
      name: payload.name.trim(),
      sausagesPerPack: Math.floor(Number(payload.sausagesPerPack)),
      category: payload.category,
      totalPacks: payload.totalPacks ?? null,
      pricePerPack: payload.pricePerPack ?? null,
      imageUrl: '',
      imagePath: '',
      status: 'open',
      createdAt: serverTimestamp(),
      createdBy: auth.user?.uid ?? null,
    })

    // Default / Upload
    let finalPath = DEFAULT_IMAGE_PATH
    let finalUrl = ''

    if (!payload.file) {
      finalUrl = await getDownloadURL(sRef(storage, DEFAULT_IMAGE_PATH))
      await updateDoc(doc(db, 'umfragen', docRef.id), { imageUrl: finalUrl, imagePath: finalPath })
      return
    }

    const fileName = payload.file.name.replace(/\s+/g, '_')
    finalPath = `umfragen/${docRef.id}/${fileName}`
    const fileRef = sRef(storage, finalPath)

    const task = uploadBytesResumable(fileRef, payload.file, { contentType: payload.file.type || 'image/png' })

    try {
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          (snap) => payload.onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve()
        )
      })
      finalUrl = await getDownloadURL(fileRef)
      await updateDoc(doc(db, 'umfragen', docRef.id), { imageUrl: finalUrl, imagePath: finalPath })
    } catch (err) {
      try { await deleteObject(fileRef) } catch {}
      await deleteDoc(doc(db, 'umfragen', docRef.id))
      throw err
    }
  }

  async function updateUmfrage(id: string, data: Partial<Pick<Umfrage, 'name'|'sausagesPerPack'|'totalPacks'|'pricePerPack'|'category'>>) {
    await updateDoc(doc(db, 'umfragen', id), data as any)
  }

  async function deleteUmfrage(id: string, imagePath?: string) {
    if (imagePath && imagePath !== DEFAULT_IMAGE_PATH) {
      try { await deleteObject(sRef(storage, imagePath)) } catch {}
    }
    await deleteDoc(doc(db, 'umfragen', id))
  }

  function watchWillHabenSum(wishId: string, cb: (sum: number) => void) {
    const qy = collection(db, 'umfragen', wishId, 'willhaben')
    return onSnapshot(qy, (snap) => {
      let sum = 0
      snap.forEach((d) => (sum += Number((d.data() as any)?.quantity || 0)))
      cb(sum)
    }, (err) => { console.error('watchWillHabenSum', err); cb(0) })
  }

  function watchMyWillHaben(wishId: string, cb: (qty: number) => void) {
    const auth = useAuthStore()
    const uid = auth.user?.uid
    if (!uid) { cb(0); return () => {} }
    const rRef = doc(db, 'umfragen', wishId, 'willhaben', uid)
    return onSnapshot(rRef, (snap) => cb(snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0))
  }

  async function setWillHaben(wishId: string, quantity: number) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Nicht eingeloggt')
    const uid = auth.user.uid

    const rRef = doc(db, 'umfragen', wishId, 'willhaben', uid)
    const nextQty = Math.max(0, Math.floor(quantity))

    await setDoc(rRef, { uid, quantity: nextQty, updatedAt: serverTimestamp() }, { merge: true })
    const snap = await getDocFromServer(rRef)
    if (!snap.exists()) throw new Error('Will-haben wurde nicht am Server gespeichert.')
  }

  async function getMyWillHaben(wishId: string): Promise<number> {
    const auth = useAuthStore()
    if (!auth.user) return 0
    const rRef = doc(db, 'umfragen', wishId, 'willhaben', auth.user.uid)
    try {
      const snap = await getDocFromServer(rRef)
      return snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0
    } catch {
      const snap = await getDoc(rRef)
      return snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0
    }
  }

  const items = computed(() => list.value)

  async function updateUmfrageImage(payload: {
  id: string
  file: File
  currentImagePath?: string
  onProgress?: (pct: number) => void
}) {
  if (!payload.file.type?.startsWith('image/')) throw new Error('Nur Bilddateien erlaubt')

  const fileName = payload.file.name.replace(/\s+/g, '_')
  const newPath = `umfragen/${payload.id}/${Date.now()}_${fileName}`
  const fileRef = sRef(storage, newPath)

  const task = uploadBytesResumable(fileRef, payload.file, {
    contentType: payload.file.type || 'image/png',
  })

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

  await updateDoc(doc(db, 'umfragen', payload.id), {
    imageUrl: newUrl,
    imagePath: newPath,
  })

  // altes Bild löschen (außer Default)
  const old = payload.currentImagePath
  if (old && old !== DEFAULT_IMAGE_PATH && old !== newPath) {
    try { await deleteObject(sRef(storage, old)) } catch {}
  }
}

/**
 * Admin: Live-Liste aller Willhaben-Einträge (uid -> displayName, quantity)
 * Achtung: macht pro uid einen users/{uid} read (bei vielen Nutzern evtl. optimieren).
 */
function watchWillHabenList(umfrageId: string, cb: (rows: WillHabenEntry[]) => void) {
  const qy = collection(db, 'umfragen', umfrageId, 'willhaben')

  return onSnapshot(
    qy,
    async (snap) => {
      const raw = snap.docs
        .map((d) => d.data() as any)
        .map((x) => ({
          uid: String(x.uid || ''),
          quantity: Math.max(0, Math.floor(Number(x.quantity || 0))),
        }))
        .filter((x) => x.uid && x.quantity > 0)

      // stabile Sortierung (höchste Menge zuerst)
      raw.sort((a, b) => b.quantity - a.quantity)

      // Namen auflösen
      const rows = await Promise.all(
        raw.map(async (r) => ({
          uid: r.uid,
          quantity: r.quantity,
          name: await getUserName(r.uid),
        })),
      )

      cb(rows)
    },
    (err) => {
      console.error('watchWillHabenList', err)
      cb([])
    },
  )
}


  return {
    items,
    watchAll,
    stop,
    createUmfrage,
    updateUmfrage,
    deleteUmfrage,
    watchWillHabenSum,
    watchMyWillHaben,
    updateUmfrageImage,
    setWillHaben,
    getMyWillHaben,
    watchWillHabenList,
  }
})
