/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// Workbox precache (injectManifest)
precacheAndRoute(self.__WB_MANIFEST)

// 1) Bilder generell cachen (png/jpg/webp/svg, auch von Firebase Storage/Google)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Tage
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

// Background handling (wichtig für data-only oder custom click behavior)
onBackgroundMessage(messaging, (payload) => {
  const title =
    payload.notification?.title ??
    payload.data?.title ??
    'Geros Wild'

  const body =
    payload.notification?.body ??
    payload.data?.body ??
    'Neues Wild!'

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
          // Wenn bereits offen: dahin navigieren + fokussieren
          return wc.navigate(targetUrl).then(() => wc.focus())
        }
      }
      // Wenn nicht offen: öffnet PWA (wenn installiert & URL im scope ist), sonst Browser
      return self.clients.openWindow(targetUrl)
    })
  )
})
