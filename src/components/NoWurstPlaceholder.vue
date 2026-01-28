<script setup lang="ts">
const props = defineProps<{
  isAdmin?: boolean
}>()
const emit = defineEmits<{
  (e: 'reload'): void
  (e: 'create'): void
}>()
</script>

<template>
  <div class="no-wurst column items-center q-pa-xl text-center">
    <!-- Lustige, simple SVG-Wurst -->
    <svg class="wurst" width="180" height="120" viewBox="0 0 180 120" fill="none" aria-label="Traurige Wurst">
      <!-- Wurstkörper -->
      <defs>
        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="120">
          <stop offset="0%" stop-color="#B3543C"/>
          <stop offset="100%" stop-color="#8E3825"/>
        </linearGradient>
      </defs>
      <g transform="translate(10,10)">
        <rect x="10" y="30" rx="28" ry="28" width="140" height="50" fill="url(#skin)" />
        <!-- Bändchen an den Enden -->
        <path d="M10,55 l-8,-8 m8,8 l-8,8" stroke="#5c2a1b" stroke-width="3" stroke-linecap="round" />
        <path d="M150,55 l8,-8 m-8,8 l8,8" stroke="#5c2a1b" stroke-width="3" stroke-linecap="round" />
        <!-- Gesicht -->
        <circle cx="70" cy="55" r="4" fill="#1b1b1b"/>
        <circle cx="100" cy="55" r="4" fill="#1b1b1b"/>
        <!-- Trauermund -->
        <path d="M78,70 q12,-8 24,0" stroke="#1b1b1b" stroke-width="3" fill="none" stroke-linecap="round"/>
      </g>
    </svg>

    <div class="text-h5 q-mt-md text-on-card">Gero hat derzeit nichts auf Lager</div>
    <div class="text-subtitle2 q-mt-xs text-on-card" style="opacity:.85">
      Das Wild war wohl zu schnell.
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
        label="Neue Wurst anlegen"
        @click="$emit('create')"
      />
    </div>

    <div class="text-caption q-mt-md text-on-card" style="opacity:.7">
      Tipp: Poste bei <b>Wünsche</b>, dass du Wurst willst.
    </div>
  </div>
</template>

<style scoped>
.no-wurst {
  min-height: 55vh;
  justify-content: center;
  /* sanfter „Wald“-Glow */
  background: radial-gradient(circle at center, rgba(53,94,59,.20) 0%, rgba(32,45,34,.10) 55%, transparent 100%);
  color: var(--text-on-card, #F5E8C7);
}

/* kleine, dezente Schwebe-Animation */
.wurst {
  animation: floaty 3.2s ease-in-out infinite;
  filter: drop-shadow(0 6px 12px rgba(0,0,0,.25));
}

@keyframes floaty {
  0%   { transform: translateY(0px);   }
  50%  { transform: translateY(-6px);  }
  100% { transform: translateY(0px);   }
}
</style>
