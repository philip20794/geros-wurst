<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { useAuthStore, watchPendingUsers } from "@/stores/auth";
import { useRouter } from "vue-router";
import { useQuasar } from "quasar";

const $q = useQuasar();
const auth = useAuthStore();
const router = useRouter();

const pendingCount = ref(0);
let unsub: (() => void) | null = null;

// 🔁 Echtzeitbeobachtung der pending Users für Admins
watchEffect((onCleanup) => {
  if (auth.meta?.role === "admin") {
    unsub = watchPendingUsers((count) => (pendingCount.value = count));
    onCleanup(() => {
      if (unsub) unsub();
      unsub = null;
      pendingCount.value = 0;
    });
  } else {
    if (unsub) unsub();
    unsub = null;
    pendingCount.value = 0;
  }
});

async function logout() {
  await auth.logout();
  $q.notify({ message: "Abgemeldet", color: "info", position: "top" });
  router.push({ name: "auth" });
}

function goAdmin() {
  router.push({ name: "admin" });
}
</script>

<template>
  <q-header elevated class="bg-primary text-white">
    <q-toolbar>
      <q-toolbar-title>Geros Wurst</q-toolbar-title>

      <!-- 🔔 Notification -->
      <q-btn
        v-if="auth.meta?.role === 'admin'"
        flat
        round
        icon="notifications"
        @click="goAdmin"
      >
        <q-badge
          v-if="pendingCount > 0"
          color="negative"
          floating
          transparent
        >
          {{ pendingCount }}
        </q-badge>
      </q-btn>

      <!-- 👤 User Menü -->
      <div v-if="auth.user" class="row items-center q-gutter-sm">
        <q-btn flat round>
          <q-avatar size="32px" color="white" text-color="primary">
            {{ auth.user.displayName
              ? auth.user.displayName.charAt(0).toUpperCase()
              : auth.user.email?.charAt(0).toUpperCase() }}
          </q-avatar>

          <!-- 📋 Menü mit Userdaten -->
          <q-menu anchor="bottom right" self="top right">
            <q-card style="min-width: 220px;">
              <q-card-section class="q-pa-sm">
                <div class="text-h6">{{ auth.user.displayName || "Kein Name" }}</div>
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

<style scoped>
.q-card-section {
  line-height: 1.2;
}
.text-grey {
  color: #999;
}
</style>
