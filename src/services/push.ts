// src/services/push.ts
import { functions, getFirebaseMessaging, auth as fbAuth } from '@/firebase'
import { httpsCallable } from 'firebase/functions'
import { getToken, onMessage } from 'firebase/messaging'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export async function requestPushPermissionAndGetToken() {
  if (!('Notification' in window)) throw new Error('Browser unterstützt Notifications nicht.')

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') throw new Error('Notification permission not granted')

  const messaging = await getFirebaseMessaging()
  if (!messaging) throw new Error('Firebase Messaging wird in diesem Browser nicht unterstützt.')

  const reg = await navigator.serviceWorker.ready
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })

  if (!token) throw new Error('Kein FCM Token erhalten (getToken returned null).')
  return token
}

export async function ensurePushTokenRegistered(): Promise<string | null> {
  if (!('Notification' in window)) return null
  if (Notification.permission !== 'granted') return null

  const messaging = await getFirebaseMessaging()
  if (!messaging) return null

  const reg = await navigator.serviceWorker.ready
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg,
  })

  if (!token) return null

  // ✅ immer (re-)speichern/lastSeen updaten
  await saveTokenToServer(token)
  return token
}

async function saveTokenToServer(token: string) {
  const user = fbAuth.currentUser
  if (!user) return
  await user.getIdToken(true)

  const fn = httpsCallable(functions, 'saveFcmToken')
  await fn({ token })
}


// Foreground messages (wenn App offen ist)
export async function setupForegroundMessageHandler(onPayload: (p: any) => void) {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return

  onMessage(messaging, (payload) => {
    onPayload(payload)
  })
}

export async function getPushTokenIfGranted() {
  if (!('Notification' in window)) return null
  if (Notification.permission !== 'granted') return null

  const messaging = await getFirebaseMessaging()
  if (!messaging) return null

  const reg = await navigator.serviceWorker.ready
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg,
  })

  return token || null
}