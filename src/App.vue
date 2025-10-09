<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();
async function doLogout() {
  await auth.logout();
  router.push({ name: "auth" });
}
</script>

<template>
  <header class="topbar">
    <strong>Geros Wurst</strong>
    <div v-if="auth.user">
      <span>{{ auth.user.email }}</span>
      <button @click="doLogout">Logout</button>
    </div>
  </header>
  <router-view />
</template>

<style scoped>
.topbar{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #eee}
.topbar button{margin-left:12px}
</style>
