// src/main.ts
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";
import "./style.css";
import { registerSW } from 'virtual:pwa-register'

// ✅ Quasar importieren
import { Quasar, Notify, Dialog, Loading } from "quasar";
import "quasar/src/css/index.sass";
import "@quasar/extras/material-icons/material-icons.css";

import { useAuthStore } from '@/stores/auth'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    Dialog.create({
      class: 'dialog-wood',
      title: 'Update verfügbar',
      message: 'Eine neue Version ist bereit. Jetzt aktualisieren?',
      ok: { label: 'Aktualisieren' },
      cancel: { label: 'Später', flat: true }
    }).onOk(() => updateSW(true))
  },
  onOfflineReady() {
    Notify.create({ type: 'positive', message: 'App ist offline bereit.' })
  }
})

registerSW({ immediate: true })

const app = createApp(App)
const pinia = createPinia()
app.use(pinia).use(router).use(Quasar, {
  plugins: { Notify, Dialog, Loading },
});

// Starte den Listener *vor* mount:
useAuthStore() // initialisiert onAuthStateChanged
app.mount('#app')

