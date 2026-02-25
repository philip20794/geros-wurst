// src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth, db } from '@/firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore'
import { deleteDoc } from 'firebase/firestore'
import { getPushTokenIfGranted } from '@/services/push'

// Echtzeitbeobachtung: wie viele Pending User existieren
export function watchPendingUsers(callback: (count: number) => void) {
  // ✅ wenn noch nicht eingeloggt, KEIN Listener starten
  if (!auth.currentUser) {
    callback(0)
    return () => {}
  }

  const q = query(collection(db, 'users'), where('status', '==', 'pending'))
  return onSnapshot(
    q,
    (snap) => callback(snap.size),
    (err) => {
      console.error('watchPendingUsers error:', err)
      callback(0)
    },
  )
}

export type UserMeta = {
  uid: string
  email: string | null
  displayName: string | null
  role: 'admin' | 'user' | null
  status: 'pending' | 'approved' | 'blocked'
  createdAt?: any
  lastLoginAt?: any
  approvedAt?: any
  approvedBy?: string
  blockedAt?: any
  blockedBy?: string
}

let authListenerStarted = false

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const meta = ref<UserMeta | null>(null)
  const loading = ref(true)
  const ready = ref(false)
  const metaLoading = ref(false)

  // ✅ Einheitliche Anzeige (UI + Push)
  const displayName = computed(() => {
    return (
      meta.value?.displayName ||
      user.value?.displayName ||
      user.value?.email ||
      'Unbekannt'
    )
  })

  const initials = computed(() => {
    const s = (displayName.value || '').trim()
    return s ? s.charAt(0).toUpperCase() : '?'
  })

  const isAdmin = computed(() => meta.value?.role === 'admin')
  const isApproved = computed(() => meta.value?.status === 'approved')
  const isPending = computed(() => meta.value?.status === 'pending')
  const isBlocked = computed(() => meta.value?.status === 'blocked')

  const pushToken = ref<string | null>(null)

  async function safeGetUserDoc(u: User) {
  try {
    // ✅ stellt sicher, dass Firestore den Request mit Auth-Token sendet
    await u.getIdToken()
    return await getDoc(doc(db, 'users', u.uid))
  } catch (e: any) {
    // ✅ manchmal ist der erste Token-Stand nicht ready -> einmal refresh + retry
    if (e?.code === 'permission-denied') {
      try {
        await u.getIdToken(true)
        return await getDoc(doc(db, 'users', u.uid))
      } catch {}
    }
    console.error('safeGetUserDoc error:', e)
    return null
  }
}


  // optional: hält Firestore displayName konsistent, ohne ständig zu schreiben
  async function syncDisplayNameToMetaIfMissing(u: User) {
    try {
      const current = meta.value?.displayName
      const authName = u.displayName
      if (!current && authName) {
        await updateDoc(doc(db, 'users', u.uid), { displayName: authName }).catch(() => {})
        if (meta.value) meta.value.displayName = authName
      }
    } catch {
      // ignore
    }
  }

  if (!authListenerStarted) {
    onAuthStateChanged(auth, async (u) => {
      loading.value = true
      metaLoading.value = false

      user.value = u
      meta.value = null

      if (u) {
        metaLoading.value = true
        const snap = await safeGetUserDoc(u)
        meta.value = snap?.exists() ? (snap.data() as UserMeta) : null
        metaLoading.value = false

        // lastLoginAt / syncDisplayName / push token wie bei dir ...
        if (snap?.exists()) {
          await updateDoc(doc(db, 'users', u.uid), { lastLoginAt: serverTimestamp() }).catch(() => {})
        }
        await syncDisplayNameToMetaIfMissing(u)
        await syncPushTokenIfGranted()
      } else {
        meta.value = null
        metaLoading.value = false
      }

      loading.value = false
      ready.value = true
    })

    authListenerStarted = true
  }

  async function register(email: string, password: string, name?: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (name) await updateProfile(cred.user, { displayName: name })

    const data: UserMeta = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName ?? null,
      role: null,
      status: 'pending',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    }

    await setDoc(doc(db, 'users', cred.user.uid), data)
    meta.value = data
    user.value = cred.user
  }

  async function login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    user.value = cred.user

    const snap = await safeGetUserDoc(cred.user)
    meta.value = snap?.exists() ? (snap.data() as UserMeta) : null

    // ✅ optional: displayName auffüllen wenn Firestore leer
    await syncDisplayNameToMetaIfMissing(cred.user)
  }

  async function logout() {
    loading.value = true
    await signOut(auth)
    user.value = null
    meta.value = null
    loading.value = false
  }

  // ---- Admin-APIs ----
  async function listPendingUsers(): Promise<UserMeta[]> {
    const qs = await getDocs(query(collection(db, 'users'), where('status', '==', 'pending')))
    return qs.docs.map((d) => d.data() as UserMeta)
  }

  async function resetPassword(email: string) {
    if (!email) throw new Error('Bitte E-Mail eingeben.')
    await sendPasswordResetEmail(auth, email)
  }

  async function approveUser(targetUid: string, adminUid: string) {
    await updateDoc(doc(db, 'users', targetUid), {
      status: 'approved',
      approvedAt: serverTimestamp(),
      approvedBy: adminUid,
      role: 'user',
    })
  }

  async function listAllUsers(): Promise<UserMeta[]> {
    const qy = query(collection(db, 'users'))
    const snap = await getDocs(qy)
    return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })) as UserMeta[]
  }

  async function setUserStatus(
    uid: string,
    status: 'approved' | 'blocked' | 'pending',
    byUid: string,
  ) {
    await updateDoc(doc(db, 'users', uid), {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: byUid,
    })
  }

  async function blockUser(targetUid: string, adminUid: string) {
    await updateDoc(doc(db, 'users', targetUid), {
      status: 'blocked',
      blockedAt: serverTimestamp(),
      blockedBy: adminUid,
    })
  }

  async function saveTokenForUser(uid: string, token: string) {
    const tokenId = encodeURIComponent(token)
    await setDoc(
      doc(db, 'users', uid, 'fcmTokens', tokenId),
      {
        token,
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        userAgent: navigator.userAgent,
      },
      { merge: true },
    )
  }

  async function syncPushTokenIfGranted() {
    const u = user.value
    if (!u) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    try {
      const token = await getPushTokenIfGranted()
      pushToken.value = token
      await saveTokenForUser(u.uid, token)
    } catch {
      // bewusst schlucken
    }
  }

  async function enablePush() {
    const u = user.value
    if (!u) throw new Error('Nicht eingeloggt.')

    const token = await getPushTokenIfGranted()
    pushToken.value = token
    await saveTokenForUser(u.uid, token)
    return token
  }

  async function disablePushForThisDevice() {
    const u = user.value
    const token = pushToken.value
    if (!u || !token) return

    const tokenId = encodeURIComponent(token)
    await deleteDoc(doc(db, 'users', u.uid, 'fcmTokens', tokenId)).catch(() => {})
    pushToken.value = null
  }

  return {
    // state
    user,
    meta,
    loading,

    // ✅ unified identity helpers
    displayName,
    initials,

    // flags
    isAdmin,
    isApproved,
    isPending,
    isBlocked,

    // auth api
    register,
    login,
    logout,

    // admin api
    listPendingUsers,
    approveUser,
    blockUser,
    resetPassword,
    listAllUsers,
    setUserStatus,

    // push api
    pushToken,
    enablePush,
    disablePushForThisDevice,
    
    ready,
    metaLoading,
  }
})
