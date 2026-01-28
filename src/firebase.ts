// src/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, setPersistence, indexedDBLocalPersistence } from 'firebase/auth'
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from 'firebase/functions'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
setPersistence(auth, indexedDBLocalPersistence)

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1')

export async function getFirebaseMessaging() {
  if (!(await isSupported())) return null
  return getMessaging(app)
}
