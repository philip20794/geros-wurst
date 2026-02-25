<template>
  <transition name="fade">
    <div v-if="showing" class="boot-overlay">
      <q-card flat class="card-wood q-pa-lg" style="width: min(520px, 92vw);">
        <div class="text-h6">Geros Wild wird vorbereitet…</div>
        <div class="text-caption q-mt-xs">{{ currentText }}</div>

        <q-linear-progress indeterminate class="q-mt-md" />

        <q-list dense class="q-mt-md">
          <q-item>
            <q-item-section avatar>
              <q-icon :name="icon(sessionDone, checkingSession)" />
            </q-item-section>
            <q-item-section>Session prüfen</q-item-section>
          </q-item>

          <q-item v-if="auth.user">
            <q-item-section avatar>
              <q-icon :name="icon(permsDone, checkingPerms)" />
            </q-item-section>
            <q-item-section>Berechtigungen prüfen</q-item-section>
          </q-item>

          <q-item v-if="needsData">
            <q-item-section avatar>
              <q-icon :name="icon(dataDone, loadingData)" />
            </q-item-section>
            <q-item-section>Produkte laden</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWurstStore } from '@/stores/wurst'

const route = useRoute()
const auth = useAuthStore()
const wurst = useWurstStore()

const canRead = computed(
  () => !!auth.user && (auth.meta?.role === 'admin' || auth.meta?.status === 'approved'),
)

const needsData = computed(
  () => route.matched.some(r => r.meta.requiresApproved)
)

// Phasen (nur aus echten States abgeleitet)
const checkingSession = computed(() => auth.ready === false)
const checkingPerms = computed(() => auth.ready && !!auth.user && auth.metaLoading)
const loadingData = computed(() =>
  auth.ready &&
  needsData.value &&
  canRead.value &&
  (
    !wurst.started ||         // Listener noch nicht gestartet
    !wurst.hydrated ||        // noch kein Snapshot angekommen
    wurst.loading             // lädt gerade
  )
)

const showing = computed(() =>
  checkingSession.value || checkingPerms.value || loadingData.value
)

const sessionDone = computed(() => auth.ready)
const permsDone = computed(() => !!auth.user ? !auth.metaLoading : true)
const dataDone = computed(() => !wurst.loading)

const currentText = computed(() => {
  if (checkingSession.value) return 'Anmeldung wird geprüft…'
  if (checkingPerms.value) return 'Berechtigungen werden geladen…'
  if (loadingData.value && !wurst.started) return 'Daten werden vorbereitet…'
  if (loadingData.value && !wurst.hydrated) return 'Produkte werden geladen…'
  if (loadingData.value) return 'Produkte werden aktualisiert…'
  return ''
})

function icon(done: boolean, active: boolean) {
  if (done) return 'check_circle'
  if (active) return 'hourglass_top'
  return 'radio_button_unchecked'
}
</script>


