<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
const auth = useAuthStore();
</script>

<template>
  <div class="wrap">
    <h2>Hi, {{ auth.user?.displayName || auth.user?.email }}</h2>
    <p>Du bist eingeloggt 🎉</p>
  </div>
</template>

<style scoped>
.wrap{padding:2rem}
</style>
