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

// Echtzeitbeobachtung: wie viele Pending User existieren
export function watchPendingUsers(callback: (count: number) => void) {
  const q = query(collection(db, "users"), where("status", "==", "pending"));
  const unsub = onSnapshot(q, (snap) => {
    callback(snap.size);
  });
  return unsub;
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

let authListenerStarted  = false

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const meta = ref<any | null>(null)
  const loading = ref(true)

  if (!authListenerStarted) {
    onAuthStateChanged(auth, async (u) => {
      user.value = u
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid)).catch(() => null)
        meta.value = snap?.exists() ? snap.data() : null
        if (u.uid && snap?.exists())
          await updateDoc(doc(db, 'users', u.uid), { lastLoginAt: serverTimestamp() }).catch(
            () => {},
          )
      } else {
        meta.value = null
      }
      loading.value = false
    })
    authListenerStarted = true
  }

  const isAdmin = computed(() => meta.value?.role === 'admin')
  const isApproved = computed(() => meta.value?.status === 'approved')
  const isPending = computed(() => meta.value?.status === 'pending')
  const isBlocked = computed(() => meta.value?.status === 'blocked')

  async function register(email: string, password: string, displayName?: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) await updateProfile(cred.user, { displayName })
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
    const snap = await getDoc(doc(db, 'users', cred.user.uid))
    meta.value = snap.exists() ? (snap.data() as UserMeta) : null
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

  async function approveUser(targetUid: string, adminUid: string) {
    await updateDoc(doc(db, 'users', targetUid), {
      status: 'approved',
      approvedAt: serverTimestamp(),
      approvedBy: adminUid,
      role: 'user',
    })
  }

  async function blockUser(targetUid: string, adminUid: string) {
    await updateDoc(doc(db, 'users', targetUid), {
      status: 'blocked',
      blockedAt: serverTimestamp(),
      blockedBy: adminUid,
    })
  }

  return {
    user,
    meta,
    loading,
    isAdmin,
    isApproved,
    isPending,
    isBlocked,
    register,
    login,
    logout,
    listPendingUsers,
    approveUser,
    blockUser,
  }
})
