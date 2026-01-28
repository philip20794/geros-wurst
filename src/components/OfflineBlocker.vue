<script setup lang="ts">
import { watch } from 'vue'
import { useOnline } from '@/composables/useOnline'
import { useQuasar } from 'quasar'

const { online } = useOnline()
const $q = useQuasar()

function reload() {
  // erzwingt frischen Netz-Request (um SW-Cache-Ausreißer zu vermeiden)
  window.location.reload()
}

// optional: kleines Toast, wenn Verbindung wieder da ist
watch(online, (isOnline) => {
  if (isOnline) {
    $q.notify({ type: 'positive', message: 'Wieder online – du kannst neu laden.' })
  }
})
</script>

<template>
  <!-- Maximierter, persistenter Dialog, wenn offline -->
  <q-dialog :model-value="!online" persistent maximized>
    <q-card class="column items-center justify-center q-pa-lg" style="min-height:100vh">
      <q-icon name="cloud_off" size="64px" class="q-mb-md" color="warning" />
      <div class="text-h5 q-mb-sm">Offline</div>
      <div class="text-subtitle2 q-mb-lg" style="max-width:520px; text-align:center">
        Diese Seite/App benötigt eine aktive Internetverbindung.
        Bitte stelle die Verbindung wieder her und lade die Seite/App neu.
      </div>

      <q-btn color="primary" size="lg" icon="refresh" label="Neu laden" no-caps @click="reload" />
      <div class="text-caption q-mt-md opacity-70">
        Tipp: Wenn es trotz Verbindung nicht klappt, im Browser „Seitedaten löschen“ und neu laden.
      </div>
    </q-card>
  </q-dialog>
</template>

<style scoped>
/* Holz-/Wald-Look optional beibehalten */
.q-card {
  background: linear-gradient(180deg, #2f3b2f 0%, #1f271f 100%);
  color: var(--text-on-card, #f5e8c7);
}
</style>
