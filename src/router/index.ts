// src/router/index.ts
import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

import { auth } from '@/firebase'

const routes: RouteRecordRaw[] = [
  { path: '/auth', name: 'auth', component: () => import('@/views/AuthView.vue') },
  {
    path: '/',
    name: 'home',
    meta: { requiresAuth: true },
    component: () => import('@/views/HomeView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth && !auth.currentUser) {
    // Warte kurz auf initiale Auth-State-Auflösung
    await new Promise((r) => setTimeout(r, 0))
    if (!auth.currentUser) return { name: 'auth' }
  }
})

export default router
