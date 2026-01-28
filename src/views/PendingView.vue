<template>
  <q-page class="flex flex-center q-pa-md">

    <q-card
      v-if="authStuck"
      flat
      style="max-width: 560px; width: 100%"
      class="card-wood"
      dark
    >
      <q-card-section class="bg-orange-2 text-black">
        <div class="row items-start q-gutter-sm">
          <q-icon name="warning" class="q-mt-xs" />
          <div class="col">
            <div class="text-weight-medium">Anmeldung lädt nicht</div>
            <div class="text-body2 q-mt-xs">
              Dein Browser/Adblocker blockiert vermutlich Firebase (Auth/Firestore).
              Bitte deaktiviere den Schutz für diese Seite oder öffne die App in Chrome/Safari.
            </div>

            <div class="q-mt-sm">
              <q-btn color="primary" no-caps label="Seite neu laden" @click="reloadPage" />
                <q-btn
                  class="q-ml-sm"
                  color="secondary"
                  no-caps
                  label="Versuchen zur Startseite zu gehen"
                  @click="goHomeAnyway"
                />
              <q-btn flat no-caps label="Hilfe" class="q-ml-sm" @click="showHelp = true" />
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- 1) Live-Updates blockiert (Firestore Listen hängt) -->
    <q-card
      v-else-if="liveBlocked"
      flat
      style="max-width: 560px; width: 100%"
      class="card-wood"
    >
      <q-card-section class="bg-orange-2 text-black">
        <div class="row items-start q-gutter-sm">
          <q-icon name="warning" class="q-mt-xs" />
          <div class="col">
            <div class="text-weight-medium">Live-Updates sind blockiert</div>
            <div class="text-body2 q-mt-xs">
              Dein Browser/Adblocker blockiert die Live-Verbindung (Firestore).
              Du kannst den Status manuell aktualisieren.
            </div>

            <div class="q-mt-sm">
              <q-btn color="primary" no-caps label="Status neu laden" @click="manualRefresh" />
              <q-btn flat no-caps label="Hilfe" class="q-ml-sm" @click="showHelp = true" />
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- 2) Normaler Loading-Spinner -->
    <q-spinner
      v-else-if="auth.loading || firstSnapPending"
      size="100px"
      color="primary"
    />

    <!-- 3) Pending Card -->
    <q-card v-else flat style="max-width: 560px; width: 100%" class="card-wood">
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
        <q-banner class="bg-transparent">
          <q-icon name="info" class="q-mr-sm" />
          Dein Account wurde erstellt und wartet auf Freigabe durch Gero. Du wirst automatisch
          weitergeleitet, sobald deine Anmeldung <strong>genehmigt</strong> oder
          <strong>abgelehnt</strong> wurde.
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
        <q-space />
        <q-btn flat no-caps label="Status neu laden" @click="manualRefresh" />
      </q-card-actions>
    </q-card>

    <!-- Hilfe -->
    <q-dialog v-model="showHelp">
      <q-card style="max-width: 520px; width: 100%" class="card-wood">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">Hilfe</div>
        </q-card-section>
          <q-card-section class="q-gutter-sm">
            <div>
              Manche Browser/Adblocker blockieren die Live-Verbindung zu Firebase (Firestore). Dann klappt das automatische
              Weiterleiten nicht.
            </div>

            <div class="text-weight-medium q-mt-sm">So gibst du Firebase frei</div>
            <ul class="q-pl-lg">
              <li>
                <b>Brave (Desktop/Android):</b> Löwen-Icon (<b>Shields</b>) → <b>Shields für diese Seite AUS</b> → Seite neu laden.
              </li>
              <li>
                <b>uBlock Origin / Adblock:</b> Blocker-Icon → Seite <b>deaktivieren/whitelisten</b> → neu laden.
              </li>
              <li>
                <b>Safari (iPhone/iPad):</b> falls du Content-Blocker nutzt: iOS <b>Einstellungen → Safari → Content Blocker</b>
                (oder “Inhaltsblocker”) → für diese Seite deaktivieren → neu laden.
              </li>
              <li>
                <b>Alternative:</b> in <b>Chrome</b> öffnen (meist am zuverlässigsten).
              </li>
            </ul>

            <div class="text-caption text-grey-7">
              Wenn du nicht sicher bist: kurz den Button <b>„Status neu laden“</b> nutzen.
            </div>
          </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps label="Schließen" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { db } from '@/firebase'
import { doc, onSnapshot, getDoc } from 'firebase/firestore'
import { useQuasar } from 'quasar'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const $q = useQuasar()

const firstSnapPending = ref(false)
const liveBlocked = ref(false)
const authStuck = ref(false)
const showHelp = ref(false)

const debugVisible = computed(() => auth.loading || firstSnapPending || liveBlocked.value || authStuck.value)

let unsub: (() => void) | null = null
let firstSnapTimer: any = null
let authTimer: any = null

function handleStatus(status?: string) {
  if (status === 'approved') {
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } else if (status === 'blocked') {
    router.replace({ name: 'blocked' })
  }
}

function reloadPage() {
  location.reload()
}

function goHomeAnyway() {
  const redirect = (router.currentRoute.value.query.redirect as string) || '/'
  router.replace(redirect)
}



async function manualRefresh() {
  if (!auth.user?.uid) {
    $q.notify({ type: 'warning', message: 'Nicht eingeloggt / Auth noch nicht fertig.' })
    return
  }
  try {
    const snap = await getDoc(doc(db, 'users', auth.user.uid))
    const data = snap.data() as any | undefined
    handleStatus(data?.status)
    if (!data?.status || data?.status === 'pending') {
      $q.notify({ type: 'info', message: 'Noch nicht freigegeben.' })
    }
  } catch (e: any) {
    $q.notify({ type: 'negative', message: e?.message || 'Status konnte nicht geladen werden.' })
  }
}

// 1) Auth hängt? -> nach 4s Hinweis zeigen
onMounted(() => {
  if (authTimer) clearTimeout(authTimer)
  authTimer = setTimeout(() => {
    if (auth.loading) authStuck.value = true
  }, 4000)
})

// sobald auth.loading false wird, authStuck wieder aus + timer stoppen
watch(
  () => auth.loading,
  (loading) => {
    if (!loading) {
      authStuck.value = false
      if (authTimer) {
        clearTimeout(authTimer)
        authTimer = null
      }
    }
  },
  { immediate: true }
)

// 2) Wenn Auth da ist, starte Firestore Live Listener + Fallback Timer
watch(
  () => [auth.loading, auth.user?.uid],
  ([loading, uid]) => {
    // cleanup
    if (unsub) { unsub(); unsub = null }
    if (firstSnapTimer) { clearTimeout(firstSnapTimer); firstSnapTimer = null }

    // solange Auth lädt oder kein uid: nix
    if (loading || !uid) return

    firstSnapPending.value = true
    liveBlocked.value = false

    // falls kein Snapshot binnen 4s -> liveBlocked
    firstSnapTimer = setTimeout(() => {
      if (firstSnapPending.value) {
        liveBlocked.value = true
        firstSnapPending.value = false
      }
    }, 4000)

    const userRef = doc(db, 'users', uid)
    unsub = onSnapshot(
      userRef,
      (snap) => {
        if (firstSnapTimer) { clearTimeout(firstSnapTimer); firstSnapTimer = null }
        firstSnapPending.value = false
        const data = snap.data() as any | undefined

        // Router-Guards: Meta updaten
        ;(auth as any).meta = { ...((auth as any).meta || {}), ...(data || {}) }

        handleStatus(data?.status)
      },
      (err) => {
        if (firstSnapTimer) { clearTimeout(firstSnapTimer); firstSnapTimer = null }
        liveBlocked.value = true
        firstSnapPending.value = false
        $q.notify({ type: 'negative', message: err.message || 'Live-Status fehlgeschlagen' })
      },
    )
  },
  { immediate: true },
)

onUnmounted(() => {
  if (unsub) unsub()
  if (firstSnapTimer) clearTimeout(firstSnapTimer)
  if (authTimer) clearTimeout(authTimer)
})

async function logout() {
  await auth.logout()
  router.replace({ name: 'auth' })
}
</script>
