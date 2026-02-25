// src/stores/wurst.ts
import { defineStore } from 'pinia'
import { db, storage } from '@/firebase'
import { useAuthStore } from './auth'
import { computed, ref, watch } from 'vue'
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  ref as sRef,
  uploadBytesResumable,
} from 'firebase/storage'

export type Wurst = {
  id: string
  name: string
  sausagesPerPack: number
  totalPacks: number
  reservedPacks: number
  pickedUpPacks: number
  pricePerPack: number
  category: string
  imageUrl: string
  imagePath: string
  active?: boolean
  unit?: string
}

export type ReservationRow = {
  wurstId: string
  uid: string
  quantity: number
  updatedAt?: any
}


export type PickupDoc = {
  id: string
  uid: string
  quantity: number
  pickedUpAt?: any
  pickedUpBy?: string | null
  state: 'pickedUp' | 'reverted'
  revertedAt?: any
  revertedBy?: string | null
}

export type MyReservationOverviewItem = {
  wurstId: string
  quantity: number
  updatedAt?: any
  name?: string
  imageUrl?: string
  pricePerPack?: number
}

export type MyPickupOverviewItem = {
  pickupId: string
  wurstId: string
  quantity: number
  pickedUpAt?: any
  name?: string
  imageUrl?: string
  pricePerPack?: number
}

const DEFAULT_IMAGE_PATH = 'defaults/wurst.png'

function tsToMillis(t: any): number {
  if (!t) return 0
  if (typeof t?.toMillis === 'function') return t.toMillis()
  if (t instanceof Date) return t.getTime()
  if (typeof t === 'number') return t
  return 0
}

export const useWurstStore = defineStore('wurst', () => {
  const auth = useAuthStore()

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  const list = ref<Wurst[]>([])
  const loading = ref(false)
  const started = ref(false)      // Listener wurde gestartet
  const hydrated = ref(false)     // erster Snapshot kam an (egal ob leer)

  // Haupt-Listener für /wuerste
  const unsubWuerste = ref<null | (() => void)>(null)

  // Map: wurstId -> meine Menge
  const myResMap = ref<Record<string, number>>({})

  // Listener pro Wurst auf /wuerste/{id}/reservations/{uid}
  const myResUnsubs = new Map<string, () => void>()
  let stopMyResWatchList: null | (() => void) = null

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  function stopMyReservationsAllInternal() {
    stopMyResWatchList?.()
    stopMyResWatchList = null

    for (const unsub of myResUnsubs.values()) unsub()
    myResUnsubs.clear()

    myResMap.value = {}
  }

  // ─────────────────────────────────────────────
  // Watch: alle Würste
  // ─────────────────────────────────────────────
  function watchAll() {
    if (unsubWuerste.value) return

    started.value = true
    hydrated.value = false
    loading.value = true

    const qy = query(collection(db, 'wuerste'), orderBy('createdAt', 'desc'))

    unsubWuerste.value = onSnapshot(
      qy,
      (snap) => {
        list.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Wurst[]
        hydrated.value = true
        loading.value = false
      },
      (err) => {
        console.error('[wurst.watchAll] error:', err)
        list.value = []
        hydrated.value = true
        loading.value = false
      },
    )
  }

  function stop() {
    // stoppe ALLES sauber
    unsubWuerste.value?.()
    unsubWuerste.value = null

    stopMyReservationsAllInternal()
    list.value = []

    started.value = false
    hydrated.value = false
    loading.value = false
  }

  // ─────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────
  const items = computed(() =>
    list.value.map((w) => {
      const total = Number(w.totalPacks || 0)
      const reserved = Number((w as any).reservedPacks || 0)
      const picked = Number((w as any).pickedUpPacks || 0)
      return {
        ...w,
        remainingPacks: Math.max(0, total - reserved - picked),
      }
    }),
  )

  // ─────────────────────────────────────────────
  // Admin CRUD
  // ─────────────────────────────────────────────
  async function createWurst(payload: {
    name: string
    sausagesPerPack: number
    category: string
    totalPacks: number
    pricePerPack: number
    file?: File | null
    unit?: string
    onProgress?: (pct: number) => void
  }) {
    if (payload.file && !payload.file.type?.startsWith('image/')) {
      throw new Error('Nur Bilddateien erlaubt')
    }

    const docRef = await addDoc(collection(db, 'wuerste'), {
      name: payload.name.trim(),
      sausagesPerPack: Number(payload.sausagesPerPack),
      totalPacks: Number(payload.totalPacks),
      pricePerPack: Number(payload.pricePerPack),
      category: payload.category,
      reservedPacks: 0,
      pickedUpPacks: 0,
      imageUrl: '',
      imagePath: '',
      active: true,
      unit: payload.unit != undefined ? payload.unit : 'Kg',
      createdAt: serverTimestamp(),
      createdBy: auth.user?.uid ?? null,
    })

    // kein File => Default
    if (!payload.file) {
      const defRef = sRef(storage, DEFAULT_IMAGE_PATH)
      const finalUrl = await getDownloadURL(defRef)

      await updateDoc(doc(db, 'wuerste', docRef.id), {
        imageUrl: finalUrl,
        imagePath: DEFAULT_IMAGE_PATH,
      })
      return
    }

    // Upload
    const fileName = payload.file.name.replace(/\s+/g, '_')
    const finalPath = `wuerste/${docRef.id}/${fileName}`
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
          reject,
          () => resolve(),
        )
      })

      const finalUrl = await getDownloadURL(fileRef)

      await updateDoc(doc(db, 'wuerste', docRef.id), {
        imageUrl: finalUrl,
        imagePath: finalPath,
      })
    } catch (err) {
      try { await deleteObject(fileRef) } catch {}
      await deleteDoc(doc(db, 'wuerste', docRef.id))
      throw err
    }
  }

  async function updateWurst(
    id: string,
    data: Partial<Pick<Wurst, 'pricePerPack' | 'totalPacks' | 'name' | 'sausagesPerPack' | 'category' | 'unit'>>,
  ) {
    await updateDoc(doc(db, 'wuerste', id), data as any)
  }

  async function setWurstActive(id: string, active: boolean) {
    await updateDoc(doc(db, 'wuerste', id), { active: !!active })
  }

  async function deleteWurst(id: string, imagePath?: string) {
    if (imagePath && imagePath !== DEFAULT_IMAGE_PATH) {
      try { await deleteObject(sRef(storage, imagePath)) } catch {}
    }
    await deleteDoc(doc(db, 'wuerste', id))
  }

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

      const old = payload.currentImagePath
      if (old && old !== DEFAULT_IMAGE_PATH && old !== newPath) {
        try { await deleteObject(sRef(storage, old)) } catch {}
      }

      return { imageUrl: newUrl, imagePath: newPath }
    } catch (err) {
      try { await deleteObject(fileRef) } catch {}
      throw err
    }
  }

  // ─────────────────────────────────────────────
  // Reservierungen (User)
  // ─────────────────────────────────────────────
  function watchMyReservation(wurstId: string, cb: (qty: number) => void) {
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
        console.error('[wurst.watchMyReservation] error:', err)
        cb(0)
      },
    )
  }

  async function setReservation(wurstId: string, quantity: number) {
    if (!auth.user) throw new Error('Nicht eingeloggt')
    const uid = auth.user.uid
    const nextQty = Math.max(0, Math.floor(Number(quantity || 0)))

    const wRef = doc(db, 'wuerste', wurstId)
    const rRef = doc(db, 'wuerste', wurstId, 'reservations', uid)

    await runTransaction(db, async (tx) => {
      const wSnap = await tx.get(wRef)
      if (!wSnap.exists()) throw new Error('Wurst nicht gefunden.')

      const wData = wSnap.data() as any
      const currentReserved = Number(wData?.reservedPacks || 0)

      const rSnap = await tx.get(rRef)
      const prevQty = rSnap.exists() ? Number((rSnap.data() as any)?.quantity || 0) : 0

      const delta = nextQty - prevQty
      const newReserved = Math.max(0, currentReserved + delta)

      if (nextQty <= 0) {
        if (rSnap.exists()) tx.delete(rRef)
      } else {
        tx.set(
          rRef,
          { uid, quantity: nextQty, updatedAt: serverTimestamp() },
          { merge: true },
        )
      }

      if (delta !== 0) {
        tx.update(wRef, { reservedPacks: newReserved })
      }
    })
  }

  // ─────────────────────────────────────────────
  // ✅ Meine Reservierungen als Map (STABIL, ohne collectionGroup)
  // ─────────────────────────────────────────────
  function watchMyReservationsAll() {
    const uid = auth.user?.uid
    stopMyReservationsAllInternal()

    if (!uid) return () => {}

    // sicherstellen, dass Würste geladen sind
    watchAll()

    function attachOne(wurstId: string) {
      const rRef = doc(db, 'wuerste', wurstId, 'reservations', uid)

      const unsub = onSnapshot(
        rRef,
        (snap) => {
          const qty = snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0
          const next = { ...myResMap.value }
          if (qty > 0) next[wurstId] = qty
          else delete next[wurstId]
          myResMap.value = next
        },
        (err) => {
          console.error('[wurst.myRes] snapshot error:', err)
          // bei permission-denied lieber nicht flackern: wir setzen nur diesen einen Eintrag auf 0
          const next = { ...myResMap.value }
          delete next[wurstId]
          myResMap.value = next
        },
      )

      myResUnsubs.set(wurstId, unsub)
    }

    function sync() {
      const ids = new Set(list.value.map((w) => w.id))

      // remove
      for (const [id, unsub] of myResUnsubs.entries()) {
        if (!ids.has(id)) {
          unsub()
          myResUnsubs.delete(id)
          const next = { ...myResMap.value }
          delete next[id]
          myResMap.value = next
        }
      }

      // add
      for (const id of ids) {
        if (!myResUnsubs.has(id)) attachOne(id)
      }
    }

    stopMyResWatchList = watch(
      () => list.value.map((w) => w.id).join('|'),
      () => sync(),
      { immediate: true },
    )

    return () => stopMyReservationsAllInternal()
  }

  // ─────────────────────────────────────────────
  // Admin: Listen + Pickups + Recompute
  // ─────────────────────────────────────────────
  function watchReservationsList(
    wurstId: string,
    cb: (rows: { uid: string; quantity: number }[]) => void,
  ) {
    const qy = collection(db, 'wuerste', wurstId, 'reservations')
    return onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as any
        return { uid: d.id, quantity: Number(data.quantity || 0) }
      })
      cb(rows)
    })
  }

  function watchPickupsList(wurstId: string, cb: (rows: PickupDoc[]) => void) {
    const qy = query(
      collection(db, 'wuerste', wurstId, 'pickups'),
      where('state', '==', 'pickedUp'),
      orderBy('pickedUpAt', 'desc'),
    )

    return onSnapshot(qy, (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as PickupDoc[],
      )
    })
  }

  async function markReservationPickedUp(wurstId: string, uid: string) {
    if (!auth.user) throw new Error('Nicht eingeloggt')

    const wRef = doc(db, 'wuerste', wurstId)
    const rRef = doc(db, 'wuerste', wurstId, 'reservations', uid)
    const pickupsCol = collection(db, 'wuerste', wurstId, 'pickups')
    const pickupRef = doc(pickupsCol)

    await runTransaction(db, async (tx) => {
      const wSnap = await tx.get(wRef)
      if (!wSnap.exists()) throw new Error('Wurst nicht gefunden.')
      const wData = wSnap.data() as any

      const rSnap = await tx.get(rRef)
      if (!rSnap.exists()) throw new Error('Keine aktive Reservierung gefunden.')

      const rData = rSnap.data() as any
      const qty = Number(rData.quantity || 0)
      if (qty <= 0) throw new Error('Reservierung ist 0 – nichts abzuholen.')

      const curReserved = Number(wData?.reservedPacks || 0)
      const curPicked = Number(wData?.pickedUpPacks || 0)

      tx.set(pickupRef, {
        uid,
        quantity: qty,
        pickedUpAt: serverTimestamp(),
        pickedUpBy: auth.user?.uid,
        state: 'pickedUp',
        reservationUpdatedAt: rData.updatedAt ?? null,
      })

      tx.delete(rRef)

      tx.update(wRef, {
        reservedPacks: Math.max(0, curReserved - qty),
        pickedUpPacks: Math.max(0, curPicked + qty),
      })
    })

    return pickupRef.id
  }

  async function undoPickupToReservation(wurstId: string, pickupId: string) {
    if (!auth.user) throw new Error('Nicht eingeloggt')

    const wRef = doc(db, 'wuerste', wurstId)
    const pRef = doc(db, 'wuerste', wurstId, 'pickups', pickupId)

    await runTransaction(db, async (tx) => {
      const wSnap = await tx.get(wRef)
      if (!wSnap.exists()) throw new Error('Wurst nicht gefunden.')
      const wData = wSnap.data() as any

      const pSnap = await tx.get(pRef)
      if (!pSnap.exists()) throw new Error('Abholung nicht gefunden.')

      const p = pSnap.data() as any
      if (p.state !== 'pickedUp') throw new Error('Diese Abholung wurde bereits zurückgenommen.')

      const uid = String(p.uid || '')
      const qty = Number(p.quantity || 0)
      if (!uid) throw new Error('Abholung ohne uid?')
      if (qty <= 0) throw new Error('Abholung hat Menge 0?')

      const rRef = doc(db, 'wuerste', wurstId, 'reservations', uid)

      const curPicked = Number(wData?.pickedUpPacks || 0)

      tx.set(
        rRef,
        {
          uid,
          quantity: increment(qty),
          updatedAt: serverTimestamp(),
          mergedFromPickupIds: arrayUnion(pickupId),
        },
        { merge: true },
      )

      tx.update(pRef, {
        state: 'reverted',
        revertedAt: serverTimestamp(),
        revertedBy: auth.user?.uid,
      })

      tx.update(wRef, {
        pickedUpPacks: Math.max(0, curPicked - qty),
      })
    })
  }

  async function recomputeWurstAggregates(wurstId: string) {
    const resSnap = await getDocs(collection(db, 'wuerste', wurstId, 'reservations'))
    let reserved = 0
    resSnap.forEach((d) => (reserved += Number((d.data() as any)?.quantity || 0)))

    const pickQ = query(
      collection(db, 'wuerste', wurstId, 'pickups'),
      where('state', '==', 'pickedUp'),
    )
    const pickSnap = await getDocs(pickQ)
    let pickedUp = 0
    pickSnap.forEach((d) => (pickedUp += Number((d.data() as any)?.quantity || 0)))

    await updateDoc(doc(db, 'wuerste', wurstId), {
      reservedPacks: reserved,
      pickedUpPacks: pickedUp,
      aggregatesUpdatedAt: serverTimestamp(),
    })

    return { reserved, pickedUp }
  }

  async function recomputeAllWurstAggregates(opts?: { onProgress?: (done: number, total: number) => void }) {
    const snap = await getDocs(collection(db, 'wuerste'))
    const total = snap.size
    let done = 0

    for (const d of snap.docs) {
      await recomputeWurstAggregates(d.id)
      done++
      opts?.onProgress?.(done, total)
    }

    return { done, total }
  }

  // ─────────────────────────────────────────────
  // Overviews (optional)
  // ─────────────────────────────────────────────
  function watchMyReservationsOverview(cb: (items: MyReservationOverviewItem[]) => void) {
    const uid = auth.user?.uid
    if (!uid) {
      cb([])
      return () => {}
    }

    watchAll()

    const byWurst = new Map<string, MyReservationOverviewItem>()
    const unsubs = new Map<string, () => void>()

    function emitNow() {
      const items = Array.from(byWurst.values())
        .map((x) => {
          const meta = list.value.find((w) => w.id === x.wurstId)
          return {
            ...x,
            name: meta?.name,
            imageUrl: meta?.imageUrl,
            pricePerPack: Number(meta?.pricePerPack || 0),
          }
        })
        .sort((a, b) => tsToMillis(b.updatedAt) - tsToMillis(a.updatedAt))

      cb(items)
    }

    function attach(wurstId: string) {
      const rRef = doc(db, 'wuerste', wurstId, 'reservations', uid)
      const unsub = onSnapshot(
        rRef,
        (snap) => {
          const data = snap.exists() ? (snap.data() as any) : null
          const qty = Math.max(0, Number(data?.quantity || 0))

          if (qty > 0) byWurst.set(wurstId, { wurstId, quantity: qty, updatedAt: data?.updatedAt ?? null })
          else byWurst.delete(wurstId)

          emitNow()
        },
        (err) => console.error('[wurst.watchMyReservationsOverview] error:', err),
      )

      unsubs.set(wurstId, unsub)
    }

    function sync() {
      const ids = new Set(list.value.map((w) => w.id))

      for (const [id, unsub] of unsubs.entries()) {
        if (!ids.has(id)) {
          unsub()
          unsubs.delete(id)
          byWurst.delete(id)
        }
      }
      for (const id of ids) {
        if (!unsubs.has(id)) attach(id)
      }

      emitNow()
    }

    const stopWatch = watch(
      () => list.value.map((w) => w.id).join('|'),
      () => sync(),
      { immediate: true },
    )

    return () => {
      stopWatch()
      for (const unsub of unsubs.values()) unsub()
      unsubs.clear()
      byWurst.clear()
      cb([])
    }
  }

  function watchMyPickupsOverview(cb: (items: MyPickupOverviewItem[]) => void) {
    const uid = auth.user?.uid
    if (!uid) {
      cb([])
      return () => {}
    }

    watchAll()

    const byWurst = new Map<string, MyPickupOverviewItem>()
    const unsubs = new Map<string, () => void>()

    function emitNow() {
      const items = Array.from(byWurst.values())
        .map((x) => {
          const meta = list.value.find((w) => w.id === x.wurstId)
          return {
            ...x,
            name: meta?.name,
            imageUrl: meta?.imageUrl,
            pricePerPack: Number(meta?.pricePerPack || 0),
          }
        })
        .sort((a, b) => tsToMillis(b.pickedUpAt) - tsToMillis(a.pickedUpAt))

      cb(items)
    }

    function attach(wurstId: string) {
      const qy = query(
        collection(db, 'wuerste', wurstId, 'pickups'),
        where('uid', '==', uid),
      )

      const unsub = onSnapshot(
        qy,
        (snap) => {
          let sum = 0
          let latest: any = null

          snap.forEach((d) => {
            const data = d.data() as any
            if (String(data?.state || 'pickedUp') !== 'pickedUp') return
            const qty = Math.max(0, Number(data?.quantity || 0))
            sum += qty
            const t = data?.pickedUpAt ?? null
            if (tsToMillis(t) > tsToMillis(latest)) latest = t
          })

          if (sum > 0) {
            byWurst.set(wurstId, {
              pickupId: `agg:${wurstId}`,
              wurstId,
              quantity: sum,
              pickedUpAt: latest,
            })
          } else {
            byWurst.delete(wurstId)
          }

          emitNow()
        },
        (err) => console.error('[wurst.watchMyPickupsOverview] error:', err),
      )

      unsubs.set(wurstId, unsub)
    }

    function sync() {
      const ids = new Set(list.value.map((w) => w.id))

      for (const [id, unsub] of unsubs.entries()) {
        if (!ids.has(id)) {
          unsub()
          unsubs.delete(id)
          byWurst.delete(id)
        }
      }
      for (const id of ids) {
        if (!unsubs.has(id)) attach(id)
      }

      emitNow()
    }

    const stopWatch = watch(
      () => list.value.map((w) => w.id).join('|'),
      () => sync(),
      { immediate: true },
    )

    return () => {
      stopWatch()
      for (const unsub of unsubs.values()) unsub()
      unsubs.clear()
      byWurst.clear()
      cb([])
    }
  }


  function watchAllReservationsFlat(cb: (rows: ReservationRow[]) => void) {
  // stellt sicher, dass Würste geladen sind
  watchAll()

  const perWurst = new Map<string, ReservationRow[]>()
  const unsubs = new Map<string, () => void>()

  function emitNow() {
    const all: ReservationRow[] = []
    for (const arr of perWurst.values()) all.push(...arr)
    cb(all)
  }

  function attach(wurstId: string) {
    const qy = collection(db, 'wuerste', wurstId, 'reservations')

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: ReservationRow[] = snap.docs
          .map((d) => {
            const data = d.data() as any
            const uid = String(data?.uid || d.id)
            const q = Math.max(0, Number(data?.quantity || 0))
            if (!uid || q <= 0) return null

            return {
              wurstId,
              uid,
              quantity: q,
              updatedAt: data?.updatedAt ?? null,
            } as ReservationRow
          })
          .filter(Boolean) as ReservationRow[]

        perWurst.set(wurstId, rows)
        emitNow()
      },
      (err) => {
        console.error('[wurst.watchAllReservationsFlat] error:', err)
        perWurst.set(wurstId, [])
        emitNow()
      },
    )

    unsubs.set(wurstId, unsub)
  }

  function sync() {
    const ids = new Set(list.value.map((w) => w.id))

    // remove old
    for (const [id, unsub] of unsubs.entries()) {
      if (!ids.has(id)) {
        unsub()
        unsubs.delete(id)
        perWurst.delete(id)
      }
    }

    // add new
    for (const id of ids) {
      if (!unsubs.has(id)) attach(id)
    }

    emitNow()
  }

  const stopWatch = watch(
    () => list.value.map((w) => w.id).join('|'),
    () => sync(),
    { immediate: true },
  )

  return () => {
    stopWatch()
    for (const unsub of unsubs.values()) unsub()
    unsubs.clear()
    perWurst.clear()
    cb([])
  }
}


  return {
    // state
    list,
    items,
    loading,
    myResMap,

    // watchers
    watchAll,
    stop,
    watchMyReservationsAll,

    // CRUD
    createWurst,
    updateWurst,
    updateWurstImage,
    deleteWurst,
    setWurstActive,

    // reservations / pickups
    setReservation,
    watchMyReservation,
    watchReservationsList,
    watchPickupsList,
    markReservationPickedUp,
    undoPickupToReservation,

    // aggregates
    recomputeAllWurstAggregates,

    // optional overviews
    watchMyReservationsOverview,
    watchMyPickupsOverview,

    watchAllReservationsFlat,
    started,
    hydrated,
  }
})
