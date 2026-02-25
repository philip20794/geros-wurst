<template>
  <q-header elevated class="bg-primary text-white">
    <q-toolbar>
      <q-item clickable v-close-popup @click="router.push({ name: 'home' })">
          <q-img
            src="@/assets/wurst.png"
            alt="Geros Wild Logo"
            style="width: 36px; height: 36px;"
            fit="contain"
          />
      </q-item>

      <q-toolbar-title>Geros Wild</q-toolbar-title>

      <!-- 🔔 Notification -->
      <q-btn
        v-if="auth.meta?.role === 'admin'"
        flat
        round
        icon="notifications"
        @click="goAdmin"
        :color="pendingCount > 0 ? 'accent' : 'secondary'"
      >
        <q-badge v-if="pendingCount > 0" color="negative" floating transparent>
          {{ pendingCount }}
        </q-badge>
      </q-btn>

      <!-- 👤 User Menü -->
      <div v-if="auth.user" class="row items-center q-gutter-sm">
        <q-btn flat round>
          <q-avatar size="32px" color="secondary" text-color="white">
            {{
              auth.user.displayName
                ? auth.user.displayName.charAt(0).toUpperCase()
                : auth.user.email?.charAt(0).toUpperCase()
            }}
          </q-avatar>

          <!-- 📋 Menü mit Userdaten -->
          <q-menu anchor="bottom right" self="top right">
            <q-card style="min-width: 220px" class="card-wood">
              <q-card-section class="q-pa-sm">
                <div class="text-h6">{{ auth.user.displayName || 'Kein Name' }}</div>
                <div class="text-subtitle2 text-grey">
                  {{ auth.user.email }}
                </div>
              </q-card-section>

              <q-separator />

              <q-list dense>
                <q-item clickable v-close-popup @click="router.push({ name: 'home' })">
                  <q-item-section avatar>
                    <q-icon name="home" />
                  </q-item-section>
                  <q-item-section>Startseite</q-item-section>
                </q-item>

                <q-item
                  clickable
                  v-close-popup
                  @click="router.push({ name: 'admin' })"
                  v-if="auth.meta?.role === 'admin'"
                >
                  <q-item-section avatar>
                    <q-icon name="admin_panel_settings" />
                  </q-item-section>
                  <q-item-section>Admin Bereich</q-item-section>
                </q-item>

                <q-item clickable v-close-popup @click="openEnablePushDialog($q)">
                  <q-item-section avatar>
                    <q-icon name="notifications_active" />
                  </q-item-section>
                  <q-item-section>Push aktivieren</q-item-section>
                </q-item>

                <q-item clickable v-close-popup @click="openInstallAppDialog($q)">
                  <q-item-section avatar>
                    <q-icon name="download" />
                  </q-item-section>
                  <q-item-section>App installieren</q-item-section>
                </q-item>


                <q-separator />


                <q-item clickable v-close-popup @click="logout">
                  <q-item-section avatar>
                    <q-icon name="logout" />
                  </q-item-section>
                  <q-item-section>Abmelden</q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </q-menu>
        </q-btn>
      </div>
    </q-toolbar>
  </q-header>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useAuthStore, watchPendingUsers } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { openEnablePushDialog } from '@/services/pushEnable'
import { openInstallAppDialog } from '@/services/pwaInstall'



const $q = useQuasar()
const auth = useAuthStore()
const router = useRouter()

const pendingCount = ref(0)
let unsub: (() => void) | null = null

// 🔁 Echtzeitbeobachtung der pending Users für Admins
watchEffect((onCleanup) => {
  // ✅ nur wenn wirklich eingeloggt + meta geladen + admin
  const canWatch = !!auth.user && auth.meta?.role === 'admin' && auth.meta?.status === 'approved'

  if (unsub) {
    unsub()
    unsub = null
  }

  if (canWatch) {
    unsub = watchPendingUsers((count) => (pendingCount.value = count))
  } else {
    pendingCount.value = 0
  }

  onCleanup(() => {
    if (unsub) unsub()
    unsub = null
  })
})


async function logout() {
  await auth.logout()
  $q.notify({ message: 'Abgemeldet', color: 'info', position: 'top' })
  router.push({ name: 'auth' })
}

function goAdmin() {
  router.push({ name: 'admin' })
}
</script>

<style scoped>
.q-card-section {
  line-height: 1.2;
}
.text-grey {
  color: #999;
}
</style>
