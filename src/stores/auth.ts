// src/stores/auth.ts
import { defineStore } from "pinia";
import { ref, onMounted } from "vue";
import { auth, db } from "@/firebase";
// RICHTIG
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import type { User } from "firebase/auth"; // type-only import

import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const isReady = ref(false);

  onMounted(() => {
    onAuthStateChanged(auth, async (u) => {
      user.value = u;
      isReady.value = true;

      if (u) {
        // lastLogin aktualisieren
        await updateDoc(doc(db, "users", u.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
      }
    });
  });

  async function register(email: string, password: string, displayName?: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });

    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: cred.user.displayName ?? null,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });

    user.value = cred.user;
  }

  async function login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    user.value = cred.user;
  }

  async function logout() {
    await signOut(auth);
    user.value = null;
  }

  return { user, isReady, register, login, logout };
});
