// src/main.ts
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";
import "./style.css";

// ✅ Quasar importieren
import { Quasar, Notify, Dialog, Loading } from "quasar";
import "quasar/src/css/index.sass";
import "@quasar/extras/material-icons/material-icons.css";

import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia).use(router).use(Quasar, {
  plugins: { Notify, Dialog, Loading },
});

// Starte den Listener *vor* mount:
useAuthStore() // initialisiert onAuthStateChanged
app.mount('#app')

