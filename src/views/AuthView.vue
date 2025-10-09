<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

type Mode = "login" | "register";
const mode = ref<Mode>("login");
const auth = useAuthStore();
const router = useRouter();

const form = reactive({
  email: "",
  password: "",
  displayName: "",
});
const loading = ref(false);
const error = ref<string | null>(null);

async function submit() {
  loading.value = true; error.value = null;
  try {
    if (mode.value === "login") {
      await auth.login(form.email, form.password);
    } else {
      await auth.register(form.email, form.password, form.displayName || undefined);
    }
    router.push({ name: "home" });
  } catch (e: any) {
    error.value = e?.message ?? "Unbekannter Fehler";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="container">
    <div class="card">
      <h1>{{ mode === 'login' ? 'Anmelden' : 'Konto erstellen' }}</h1>

      <form @submit.prevent="submit">
        <label>Email</label>
        <input v-model="form.email" type="email" required />

        <label>Passwort</label>
        <input v-model="form.password" type="password" required minlength="6" />

        <template v-if="mode === 'register'">
          <label>Anzeigename (optional)</label>
          <input v-model="form.displayName" type="text" />
        </template>

        <button :disabled="loading">{{ loading ? '...' : (mode === 'login' ? 'Login' : 'Registrieren') }}</button>
        <p v-if="error" class="error">{{ error }}</p>
      </form>

      <p class="switch">
        <button class="link" @click="mode = mode === 'login' ? 'register' : 'login'">
          {{ mode === 'login' ? 'Noch kein Konto? Jetzt registrieren' : 'Schon ein Konto? Jetzt anmelden' }}
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.container{min-height:100vh;display:grid;place-items:center;padding:2rem;background:#0b0c10;}
.card{width:100%;max-width:420px;background:#15171c;border:1px solid #2a2e35;border-radius:16px;padding:24px;color:#e9e9ea;box-shadow:0 10px 30px rgba(0,0,0,.25)}
h1{margin:0 0 16px;font-size:24px}
label{display:block;margin-top:12px;font-size:12px;opacity:.8}
input{width:100%;margin-top:6px;padding:10px 12px;background:#0f1115;border:1px solid #2a2e35;border-radius:10px;color:#fff;outline:none}
button{margin-top:16px;width:100%;padding:10px 12px;border-radius:10px;border:0;background:#7c5cff;color:white;font-weight:600;cursor:pointer}
button[disabled]{opacity:.6;cursor:default}
.error{color:#ff8686;margin-top:10px}
.link{background:transparent;border:0;color:#a6a8ff;text-decoration:underline;cursor:pointer;padding:0;margin:0}
.switch{margin-top:12px;text-align:center}
</style>
