// src/stores/wuensche.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/firebase'
import {
  collection,
  serverTimestamp,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  setDoc,
  getDoc,
  getDocFromServer,
  writeBatch,
} from 'firebase/firestore'
import { useAuthStore } from './auth'

export type Wunsch = {
  id: string
  name: string
  createdBy?: string | null
}

export type WillHabenEntry = {
  uid: string
  name: string
  quantity: number
}

export const useWuenscheStore = defineStore('wuensche', () => {
  const list = ref<Wunsch[]>([])
  const unsubRef = ref<null | (() => void)>(null)

  // ✅ cache: uid -> name
  const userNameCache = ref<Record<string, string>>({})

  function watchAll() {
    if (unsubRef.value) return
    const q = query(collection(db, 'wuensche'), orderBy('createdAt', 'desc'))
    unsubRef.value = onSnapshot(q, (snap) => {
      list.value = snap.docs.map((d) => {
        const data = d.data() as any
        return {
          id: d.id,
          name: String(data?.name ?? ''),
          createdBy: data?.createdBy ?? null,
        } as Wunsch
      })
    })
  }

  async function getUserDisplayName(uid: string): Promise<string> {
    if (!uid) return 'Unbekannt'
    const cached = userNameCache.value[uid]
    if (cached) return cached

    try {
      const uSnap = await getDoc(doc(db, 'users', uid))
      const d: any = uSnap.exists() ? uSnap.data() : null
      const name = String(d?.displayName || d?.email || uid)
      userNameCache.value = { ...userNameCache.value, [uid]: name }
      return name
    } catch {
      const fallback = uid
      userNameCache.value = { ...userNameCache.value, [uid]: fallback }
      return fallback
    }
  }

  function stop() {
    if (unsubRef.value) {
      unsubRef.value()
      unsubRef.value = null
    }
  }

  async function createWunsch(name: string) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Nicht eingeloggt')

    const clean = name.trim()
    if (!clean) throw new Error('Name fehlt')

    const uid = auth.user.uid

    // neue Doc-ID erzeugen (ohne addDoc)
    const wishRef = doc(collection(db, 'wuensche'))

    const batch = writeBatch(db)

    // 1) Wunsch-Dokument
    batch.set(wishRef, {
      name: clean,
      createdAt: serverTimestamp(),
      createdBy: uid,
      status: 'open',
    })

    // 2) Subcollection: willhaben/uid = 1
    const willRef = doc(db, 'wuensche', wishRef.id, 'willhaben', uid)
    batch.set(
      willRef,
      {
        uid,
        quantity: 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    await batch.commit()
    return wishRef.id
  }

  async function updateWunsch(id: string, data: Partial<Pick<Wunsch, 'name'>>) {
    const patch: any = {}
    if (data.name !== undefined) patch.name = String(data.name || '').trim()
    await updateDoc(doc(db, 'wuensche', id), patch)
  }

  async function deleteWunsch(id: string) {
    await deleteDoc(doc(db, 'wuensche', id))
  }

  // --- Will haben ---
  function watchWillHabenSum(wishId: string, cb: (sum: number) => void) {
    const qy = collection(db, 'wuensche', wishId, 'willhaben')
    return onSnapshot(
      qy,
      (snap) => {
        let sum = 0
        snap.forEach((d) => (sum += Number((d.data() as any)?.quantity || 0)))
        cb(sum)
      },
      (err) => {
        console.error('watchWillHabenSum', err)
        cb(0)
      },
    )
  }

  function watchMyWillHaben(wishId: string, cb: (qty: number) => void) {
    const auth = useAuthStore()
    const uid = auth.user?.uid
    if (!uid) {
      cb(0)
      return () => {}
    }
    const rRef = doc(db, 'wuensche', wishId, 'willhaben', uid)
    return onSnapshot(rRef, (snap) =>
      cb(snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0),
    )
  }

  async function setWillHaben(wishId: string, quantity: number) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Nicht eingeloggt')
    const uid = auth.user.uid

    const rRef = doc(db, 'wuensche', wishId, 'willhaben', uid)
    const nextQty = Math.max(0, Math.floor(quantity))

    await setDoc(rRef, { uid, quantity: nextQty, updatedAt: serverTimestamp() }, { merge: true })

    const snap = await getDocFromServer(rRef)
    if (!snap.exists()) throw new Error('Will-haben wurde nicht am Server gespeichert.')
  }

  async function getMyWillHaben(wishId: string): Promise<number> {
    const auth = useAuthStore()
    if (!auth.user) return 0
    const rRef = doc(db, 'wuensche', wishId, 'willhaben', auth.user.uid)
    try {
      const snap = await getDocFromServer(rRef)
      return snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0
    } catch {
      const snap = await getDoc(rRef)
      return snap.exists() ? Number((snap.data() as any)?.quantity || 0) : 0
    }
  }

  /**
   * ✅ Admin: Live-Liste aller Willhaben-Einträge (uid -> displayName, quantity)
   * Nutzt getUserDisplayName() + Cache.
   */
  function watchWillHabenList(wishId: string, cb: (rows: WillHabenEntry[]) => void) {
    const qy = collection(db, 'wuensche', wishId, 'willhaben')

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

        // höchste Menge zuerst
        raw.sort((a, b) => b.quantity - a.quantity)

        const rows = await Promise.all(
          raw.map(async (r) => ({
            uid: r.uid,
            quantity: r.quantity,
            name: await getUserDisplayName(r.uid),
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

  const items = computed(() => list.value)

  return {
    items,
    watchAll,
    stop,
    getUserDisplayName,
    createWunsch,
    updateWunsch,
    deleteWunsch,
    watchWillHabenSum,
    watchWillHabenList, // ✅ neu
    watchMyWillHaben,
    setWillHaben,
    getMyWillHaben,
  }
})
