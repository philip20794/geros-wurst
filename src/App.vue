<script setup lang="ts">
import HeaderBar from "@/components/HeaderBar.vue";
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <HeaderBar />
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
