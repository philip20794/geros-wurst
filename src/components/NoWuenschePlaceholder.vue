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
  <div class="no-wish column items-center q-pa-xl text-center">
    <!-- Lustige SVG: “leeres Wunsch-Glas” -->
    <svg class="jar" width="190" height="150" viewBox="0 0 190 150" fill="none" aria-label="Keine Wünsche">
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="150">
          <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.10)"/>
        </linearGradient>
        <linearGradient id="lid" x1="0" y1="0" x2="0" y2="150">
          <stop offset="0%" stop-color="#355E3B"/>
          <stop offset="100%" stop-color="#203022"/>
        </linearGradient>
        <linearGradient id="paper" x1="0" y1="0" x2="0" y2="150">
          <stop offset="0%" stop-color="#F5E8C7"/>
          <stop offset="100%" stop-color="#E6D7B0"/>
        </linearGradient>
      </defs>

      <!-- Deckel -->
      <rect x="58" y="14" width="74" height="22" rx="10" fill="url(#lid)" opacity="0.95"/>
      <rect x="64" y="10" width="62" height="16" rx="8" fill="url(#lid)" opacity="0.75"/>

      <!-- Glas-Körper -->
      <rect x="44" y="28" width="102" height="108" rx="22" fill="url(#glass)" stroke="rgba(255,255,255,0.25)" />

      <!-- “Leere” Note im Glas -->
      <g opacity="0.85">
        <rect x="64" y="58" width="62" height="40" rx="8" fill="url(#paper)" />
        <path d="M72 70 H118" stroke="#8a7a54" stroke-width="3.5" stroke-linecap="round" opacity="0.55"/>
        <path d="M72 82 H110" stroke="#8a7a54" stroke-width="3.5" stroke-linecap="round" opacity="0.5"/>
        <path d="M72 94 H104" stroke="#8a7a54" stroke-width="3.5" stroke-linecap="round" opacity="0.45"/>
      </g>

      <!-- kleines Herz/Seufzer -->
      <path
        d="M95 116
           c-7 -6 -16 -2 -16 6
           c0 9 16 16 16 16
           s16 -7 16 -16
           c0 -8 -9 -12 -16 -6z"
        fill="rgba(255,255,255,0.20)"
      />
    </svg>

    <div class="text-h5 q-mt-md text-on-card">Noch keine Wünsche da</div>
    <div class="text-subtitle2 q-mt-xs text-on-card" style="opacity:.85">
      Hier kannst du Wurst-Wünsche posten und andere können mit <b>„Will ich haben“</b> reagieren.
    </div>

    <div class="text-caption q-mt-sm text-on-card" style="opacity:.75; max-width: 560px;">
      Wenn genug Leute denselben Wunsch haben, macht Gero daraus eine Wurst und sie landet später bei <b>Wild</b>.
    </div>

    <div class="row q-gutter-sm q-mt-lg">
      <q-btn
        color="primary"
        icon="refresh"
        no-caps
        label="Erneut prüfen"
        @click="$emit('reload')"
      />
    </div>

    <div class="text-caption q-mt-md text-on-card" style="opacity:.7">
      Tipp: Schreib z.B. „Mufflon-Bratwurst mit Kräutern“ oder „Wildschwein, grob, pfeffrig“
    </div>
  </div>
</template>

<style scoped>
.no-wish {
  min-height: 55vh;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(53,94,59,.20) 0%, rgba(32,45,34,.10) 55%, transparent 100%);
  color: var(--text-on-card, #F5E8C7);
}

.jar {
  animation: floaty 3.2s ease-in-out infinite;
  filter: drop-shadow(0 6px 12px rgba(0,0,0,.25));
}

@keyframes floaty {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-6px); }
  100% { transform: translateY(0px); }
}
</style>
