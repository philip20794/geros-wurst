// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import HomeView from '@/views/HomeView.vue'

const routes: RouteRecordRaw[] = [
  { path: '/auth', name: 'auth', component: () => import('@/views/AuthView.vue') },
  { path: '/pending', name: 'pending', component: () => import('@/views/PendingView.vue') },
  { path: '/blocked', name: 'blocked', component: () => import('@/views/BlockedView.vue') },
  { path: '/admin', name: 'admin', meta: { requiresAdmin: true }, component: () => import('@/views/AdminView.vue') },

  // ✅ Tabs als eigene URLs
  { path: '/', name: 'home', meta: { requiresApproved: true }, component: HomeView },
  { path: '/umfragen', name: 'home-umfragen', meta: { requiresApproved: true }, component: () => import('@/views/HomeView.vue') },
  { path: '/wuensche', name: 'home-wuensche', meta: { requiresApproved: true }, component: () => import('@/views/HomeView.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// kleine Helferfunktion: auf Flag warten
function waitUntil(predicate: () => boolean) {
  return new Promise<void>((resolve) => {
    if (predicate()) return resolve()
    const stop = watch(
      predicate,
      (ok) => {
        if (ok) {
          stop()
          resolve()
        }
      },
      { immediate: true },
    )
  })
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  await waitUntil(() => auth.ready === true)

  const user = auth.user
  const role = auth.meta?.role
  const status = auth.meta?.status

  const requiresAdmin = to.matched.some((r) => r.meta.requiresAdmin)
  const requiresApproved = to.matched.some((r) => r.meta.requiresApproved)

  // nicht eingeloggt
  if (!user) {
    if (to.name !== 'auth') return { name: 'auth', query: { redirect: to.fullPath } }
    return true
  }

  // eingeloggt -> status routing
  const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'

  if (status === 'blocked' && to.name !== 'blocked') {
    return { name: 'blocked', query: { redirect: to.fullPath } }
  }

  // Pending/Unbekannt => pending (aber nicht, wenn du gerade schon dort bist)
  if ((status === 'pending' || !status) && requiresApproved) {
    if (to.name !== 'pending') return { name: 'pending', query: { redirect: to.fullPath } }
    return true
  }

  // Auth-Route: wenn eingeloggt, nie anzeigen
  if (to.name === 'auth') {
    if (status === 'blocked') return { name: 'blocked', query: { redirect } }
    if (status === 'pending' || !status) return { name: 'pending', query: { redirect } }
    // approved/admin
    return redirect
  }

  if (requiresAdmin && role !== 'admin') return { name: 'home' }

  return true
})



export default router
