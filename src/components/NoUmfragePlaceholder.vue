<script setup lang="ts">
defineProps<{
  isAdmin?: boolean
}>()

defineEmits<{
  (e: 'reload'): void
  (e: 'create'): void
}>()
</script>

<template>
  <div class="no-umfrage column items-center q-pa-xl text-center">
    <!-- Lustige, simple SVG: “leeres Klemmbrett” -->
    <svg class="clipboard" width="190" height="140" viewBox="0 0 190 140" fill="none" aria-label="Keine Umfrage">
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="0" y2="140">
          <stop offset="0%" stop-color="#F5E8C7"/>
          <stop offset="100%" stop-color="#E6D7B0"/>
        </linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="140">
          <stop offset="0%" stop-color="#5c3a0b"/>
          <stop offset="100%" stop-color="#3d2403"/>
        </linearGradient>
      </defs>

      <!-- Brett -->
      <rect x="30" y="18" rx="14" ry="14" width="130" height="110" fill="url(#wood)" />
      <!-- Papier -->
      <rect x="42" y="34" rx="10" ry="10" width="106" height="86" fill="url(#paper)" />
      <!-- Klammer -->
      <rect x="75" y="8" rx="8" ry="8" width="40" height="26" fill="#2b2b2b" opacity="0.9" />
      <rect x="82" y="12" rx="6" ry="6" width="26" height="18" fill="#424242" opacity="0.95" />

      <!-- “Leere Zeilen” -->
      <path d="M56 58 H134" stroke="#8a7a54" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
      <path d="M56 76 H126" stroke="#8a7a54" stroke-width="4" stroke-linecap="round" opacity="0.55"/>
      <path d="M56 94 H118" stroke="#8a7a54" stroke-width="4" stroke-linecap="round" opacity="0.5"/>

      <!-- Kleiner “Fragezeichen”-Smiley -->
      <circle cx="95" cy="106" r="10" fill="#1b1b1b" opacity="0.12"/>
      <path d="M92 103 q3-4 6 0 q0 2-2 3 q-2 1-2 3" stroke="#1b1b1b" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <circle cx="95" cy="114" r="1.6" fill="#1b1b1b"/>
    </svg>

    <div class="text-h5 q-mt-md text-on-card">Gerade läuft keine Umfrage</div>
    <div class="text-subtitle2 q-mt-xs text-on-card" style="opacity:.85">
      Sobald Gero wissen will, ob Interesse an bestimmten Würsten besteht,
      startet er hier eine Umfrage.
    </div>

    <div class="text-caption q-mt-sm text-on-card" style="opacity:.75; max-width: 520px;">
      Wenn genug Leute mit <b>„Nehme was“</b> reagieren, macht Gero die Würste und sie landen sie später bei <b>Wild</b>.
    </div>
    <div class="row q-gutter-sm q-mt-lg">
      <q-btn
        color="primary"
        icon="refresh"
        no-caps
        label="Erneut prüfen"
        @click="$emit('reload')"
      />
      <q-btn
        v-if="isAdmin"
        color="accent"
        icon="add"
        no-caps
        label="Umfrage starten"
        @click="$emit('create')"
      />
    </div>

    <div class="text-caption q-mt-md text-on-card" style="opacity:.7">
      Tipp: Deine Traumwurst fehlt? Stell sie unter <b>Wünsche</b> rein - dann sieht Gero sofort, was gefragt ist
    </div>
  </div>
</template>

<style scoped>
.no-umfrage {
  min-height: 55vh;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(53,94,59,.20) 0%, rgba(32,45,34,.10) 55%, transparent 100%);
  color: var(--text-on-card, #F5E8C7);
}

.clipboard {
  animation: floaty 3.2s ease-in-out infinite;
  filter: drop-shadow(0 6px 12px rgba(0,0,0,.25));
}

@keyframes floaty {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-6px); }
  100% { transform: translateY(0px); }
}
</style>
