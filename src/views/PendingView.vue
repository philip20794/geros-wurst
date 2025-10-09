<script setup lang="ts">
import { ref, watchEffect, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { db } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useQuasar } from "quasar";

const auth = useAuthStore();
const router = useRouter();
const $q = useQuasar();

const firstSnapPending = ref(false);   // warten auf ersten Snapshot
let unsub: (() => void) | null = null;

// zentrale Reaktion auf Statusänderungen
function handleStatus(status?: string) {
  if (status === "approved") router.push({ name: "home" });
  if (status === "blocked") router.push({ name: "blocked" });
}

// Reaktiver Watch: startet/stoppt den Firestore-Listener genau dann, wenn es Sinn ergibt
watchEffect((onCleanup) => {
  // Wenn noch geladen wird oder kein User vorhanden → nix tun
  if (auth.loading || !auth.user) return;

  // Falls der Store schon einen Status hat, direkt reagieren
  handleStatus(auth.meta?.status);

  // Nur für pending-User den Listener auf das eigene User-Dokument starten
  if (auth.meta?.status === "pending") {
    firstSnapPending.value = true;

    // bestehenden Listener abbauen
    if (unsub) unsub();

    const ref = doc(db, "users", auth.user.uid);
    unsub = onSnapshot(ref, (snap) => {
      firstSnapPending.value = false; // erster Snapshot ist da
      const data = snap.data() as any | undefined;
      handleStatus(data?.status);
    }, (err) => {
      firstSnapPending.value = false;
      $q.notify({ type: "negative", message: err.message || "Live-Status fehlgeschlagen" });
    });

    onCleanup(() => {
      if (unsub) unsub();
      unsub = null;
    });
  } else {
    // kein pending → sicherheitshalber abbauen
    if (unsub) unsub();
    unsub = null;
    firstSnapPending.value = false;
  }
});

onUnmounted(() => { if (unsub) unsub(); });

async function logout() {
  await auth.logout();
  router.push({ name: "auth" });
}
</script>

<template>
  <q-page class="flex flex-center">
    <q-card flat style="max-width:560px; width:100%;" class="card-wood">
      <q-card-section class="bg-primary text-white">
        <div class="row items-center">
          <q-icon name="hourglass_top" size="md" class="q-mr-sm" />
          <div>
            <div class="text-h6">Warte auf Bestätigung</div>
            <div class="text-subtitle2">Gero prüft deine Anmeldung</div>
          </div>
        </div>
      </q-card-section>

      <q-linear-progress indeterminate color="primary" />

      <q-card-section class="q-gutter-sm">
        <q-banner class="bg-grey-2">
          <q-icon name="info" class="q-mr-sm" />
          Dein Account wurde erstellt und wartet auf Freigabe durch Gero.
          Du wirst automatisch weitergeleitet, sobald deine Anmeldung
          <strong>genehmigt</strong> oder <strong>abgelehnt</strong> wurde.
        </q-banner>

        <div class="q-mt-sm">
          <div class="text-caption text-grey">Angemeldet als</div>
          <div class="row items-center q-gutter-sm">
            <q-avatar size="28px" color="primary" text-color="white">
              {{ (auth.user?.displayName || auth.user?.email || 'U').charAt(0).toUpperCase() }}
            </q-avatar>
            <div class="column">
              <div class="text-weight-medium">
                {{ auth.user?.displayName || 'Kein Anzeigename' }}
              </div>
              <div class="text-grey-7">
                {{ auth.user?.email }}
              </div>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions>
        <q-btn color="primary" unelevated icon="logout" no-caps label="Abmelden" @click="logout" />
      </q-card-actions>

      <!-- Loader anzeigen, solange Auth noch lädt ODER der erste Snapshot noch nicht da ist -->
      <q-inner-loading :showing="auth.loading || firstSnapPending">
        <q-spinner size="40px" />
      </q-inner-loading>
    </q-card>
  </q-page>
</template>
