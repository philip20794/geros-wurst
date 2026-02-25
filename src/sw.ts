/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>
}

// ✅ Updates schneller übernehmen
self.skipWaiting()
clientsClaim()

// ✅ Alte, nicht mehr benötigte precaches aufräumen
cleanupOutdatedCaches()

// Workbox precache (injectManifest)
precacheAndRoute(self.__WB_MANIFEST)

// ✅ Optional: Client kann aktiv "skip waiting" anfordern (für Update-Button)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// 1) Bilder generell cachen
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-v2', // <-- bumpen, wenn du Cache resetten willst
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
)

// Firebase init im SW (nur messaging im SW verwenden)
const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

const messaging = getMessaging(firebaseApp)

onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title ?? payload.data?.title ?? 'Geros Wild'
  const body = payload.notification?.body ?? payload.data?.body ?? 'Neues Wild!'
  const url = payload.data?.url ?? '/'

  self.registration.showNotification(title, {
    body,
    icon: '/icons/pwa-192.png',
    tag: 'geros-wild',
    data: { url },
  })
})

// Click: Fokus/öffnen + navigieren
self.addEventListener('notificationclick', (event: any) => {
  const url = event.notification?.data?.url || '/'
  event.notification.close()

  const targetUrl = new URL(url, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        const wc = client as WindowClient
        if ('focus' in wc) {
          return wc.navigate(targetUrl).then(() => wc.focus())
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})
