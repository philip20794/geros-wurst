// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const routes: RouteRecordRaw[] = [
  { path: "/auth", name: "auth", component: () => import("@/views/AuthView.vue") },
  { path: "/pending", name: "pending", component: () => import("@/views/PendingView.vue") },
  { path: "/blocked", name: "blocked", component: () => import("@/views/BlockedView.vue") },
  { path: "/admin", name: "admin", meta: { requiresAdmin: true }, component: () => import("@/views/AdminView.vue") },
  { path: "/", name: "home", meta: { requiresApproved: true }, component: () => import("@/views/HomeView.vue") },
  { path: "/wurst/new", name: "wurst-new", meta: { requiresAdmin: true }, component: () => import("@/views/WurstNewView.vue") }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// src/router/index.ts
router.beforeEach((to) => {
  const auth = useAuthStore()

  // noch kein State geladen → Seite laden lassen (meist nur beim Refresh)
  if (auth.loading) return true

  // Nicht eingeloggt → nur /auth erlaubt
  if (!auth.user && to.name !== 'auth') return { name: 'auth' }

  const status = auth.meta?.status
  const role = auth.meta?.role

  // Geblockt
  if (status === 'blocked' && to.name !== 'blocked') return { name: 'blocked' }

  // Pending
  if (status === 'pending' && to.name !== 'pending' && to.name !== 'auth') return { name: 'pending' }

  // Admin-Pfad
  if (to.meta.requiresAdmin && role !== 'admin') return { name: 'pending' }

  // Approved-Pfad
  if (to.meta.requiresApproved && status !== 'approved' && role !== 'admin') return { name: 'pending' }

  return true
})


export default router;
