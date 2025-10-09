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

<style>
/* Fixe Holztextur unter allen Inhalten der Card */
.card-wood {
  position: relative;
  color: var(--text-on-card);
}
.card-wood::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(145deg, #4b2e05, #5c3a0b, #3d2403);
  color: var(--text-on-card);
  opacity: 1; /* ggf. 0.9–1.0 feinjustieren */
}
.card-wood > * { position: relative; z-index: 1; }

/* ── ExpansionItem & Table vollständig transparent ───────────── */
.card-wood .q-expansion-item__container,
.card-wood .q-expansion-item__content,
.card-wood .q-list,
.card-wood .q-item,
.card-wood .q-item__section,
.card-wood .q-table__container,
.card-wood .q-table,
.card-wood .q-table__top,
.card-wood .q-table__middle,
.card-wood .q-table__bottom,
.card-wood .q-table__grid-content,
.card-wood thead,
.card-wood tbody,
.card-wood tr,
.card-wood th,
.card-wood td {
  background: transparent !important;
  background-color: transparent !important;
  color: inherit;
}

/* Ränder/Schatten dezenter, damit es nicht „weiß“ wirkt */
.card-wood .q-table__container {
  box-shadow: none !important;
  border: 1px solid rgba(255,255,255,0.15) !important; /* auf hellem Holz ggf. rgba(0,0,0,.15) */
  border-radius: 6px;
}
.card-wood th, 
.card-wood td, 
.card-wood .q-separator {
  border-color: rgba(255,255,255,0.2) !important; /* oder rgba(0,0,0,.2) */
}

/* Quasar-Text-Graus überschreiben (damit’s hell bleibt) */
.card-wood .text-grey-7,
.card-wood .text-grey-6,
.card-wood .text-dark {
  color: var(--text-on-card) !important;
  opacity: .85;
}


</style>

