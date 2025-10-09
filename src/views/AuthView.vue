<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useQuasar } from 'quasar'

type Mode = 'login' | 'register'
const mode = ref<Mode>('login')

const auth = useAuthStore()
const router = useRouter()
const $q = useQuasar()

const form = reactive({
  email: '',
  password: '',
  displayName: '',
})
const showPwd = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

// einfache Validierungsregeln (Quasar-Style)
const rules = {
  required: (v: string) => !!v || 'Pflichtfeld',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Ungültige E-Mail',
  min6: (v: string) => (v?.length ?? 0) >= 6 || 'Mindestens 6 Zeichen',
}

// beim Tab-Wechsel Fehler & Felder sinnvoll bereinigen
watch(mode, (m) => {
  error.value = null
  if (m === 'login') form.displayName = ''
})

async function submit() {
  loading.value = true
  error.value = null

  try {
    if (mode.value === 'login') {
      await auth.login(form.email.trim(), form.password)
      $q.notify({ type: 'positive', message: 'Willkommen zurück!' })
    } else {
      await auth.register(form.email.trim(), form.password, form.displayName.trim() || undefined)
      $q.notify({ type: 'info', message: 'Konto erstellt. Warte auf Freigabe.' })
    }
    router.push({ name: 'home' }) // Guard leitet ggf. zu /pending
  } catch (e: any) {
    // hübschere Fehlermeldungen
    const code = e?.code as string | undefined
    if (code === 'auth/email-already-in-use') {
      error.value = 'Diese E-Mail ist bereits registriert. Bitte anmelden.'
      mode.value = 'login'
    } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      error.value = 'E-Mail oder Passwort falsch.'
    } else if (code === 'auth/user-not-found') {
      error.value = 'Kein Konto mit dieser E-Mail. Bitte registrieren.'
      mode.value = 'register'
    } else {
      error.value = e?.message ?? 'Unbekannter Fehler'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <q-page class="flex flex-center">
    <q-card flat style="width: 100%; max-width: 480px" class="card-wood">
      <q-card-section class="bg-primary text-white">
        <div class="text-h5">Geros Wurst</div>
        <div class="text-subtitle2">Anmelden oder Konto erstellen</div>
      </q-card-section>

      <q-separator />

      <!-- Tabs -->
      <q-tabs
        v-model="mode"
         class="tabs-wood"
        align="justify"
        dense
        active-color="accent"
        indicator-color="accent"
      >
        <q-tab name="login" label="Anmelden" icon="login" />
        <q-tab name="register" label="Registrieren" icon="person_add" />
      </q-tabs>
      <q-separator />

      <q-card-section>
        <q-form @submit.prevent="submit" class="q-gutter-md">
          <!-- E-Mail -->
          <q-input
            v-model="form.email"
            type="email"
            label="E-Mail"
            outlined
            :rules="[rules.required, rules.email]"
            autocomplete="email"
          >
            <template #prepend><q-icon name="mail" /></template>
          </q-input>

          <!-- Passwort -->
          <q-input
            v-model="form.password"
            :type="showPwd ? 'text' : 'password'"
            label="Passwort"
            outlined
            :rules="[rules.required, rules.min6]"
            autocomplete="current-password"
          >
            <template #prepend><q-icon name="lock" /></template>
            <template #append>
              <q-icon
                :name="showPwd ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showPwd = !showPwd"
              />
            </template>
          </q-input>

          <!-- Anzeigename nur beim Registrieren -->
          <q-input
            v-if="mode === 'register'"
            v-model="form.displayName"
            label="Anzeigename"
            outlined
            autocomplete="name"
            :rules="[rules.required]"
          >
            <template #prepend><q-icon name="badge" /></template>
          </q-input>

          <!-- Fehlerbanner -->
          <q-banner v-if="error" class="bg-negative text-white q-pa-sm" rounded>
            <q-icon name="error" class="q-mr-sm" />
            {{ error }}
          </q-banner>

          <div class="row justify-end q-gutter-sm">
            <q-btn no-caps
              color="primary"
              :label="mode === 'login' ? 'Login' : 'Registrieren'"
              type="submit"
              :loading="loading"
              unelevated
            />
          </div>
        </q-form>
      </q-card-section>

      <q-separator />

      <!-- Umschalter unter dem Formular -->
      <q-card-section class="text-center">
        <q-btn no-caps
          outline
          class="btn-wood"
          color="secondary"
          :label="
            mode === 'login'
              ? 'Noch kein Konto? Jetzt registrieren'
              : 'Schon ein Konto? Jetzt anmelden'
          "
          @click="mode = mode === 'login' ? 'register' : 'login'"
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>
