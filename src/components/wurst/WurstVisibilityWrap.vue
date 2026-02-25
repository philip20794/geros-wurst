<template>
  <!-- ✅ Für normale User: deaktiviert => gar nicht anzeigen -->
  <template v-if="shouldRenderDirect">
    <slot />
  </template>

  <!-- ✅ Admin: deaktiviert => collapsed Expansion -->
  <q-expansion-item
    v-else-if="isAdmin"
    v-model="open"
    dense
    expand-separator
    class="card-wood wrap-exp"
    header-class="wrap-header"
  >
    <!-- Custom header -->
    <template #header>
      <q-item-section avatar>
        <q-avatar square size="42px" class="wrap-thumb">
          <q-img v-if="wurst.imageUrl" :src="wurst.imageUrl" ratio="1" fit="cover" />
          <div v-else class="wrap-thumb-fallback">
            <q-icon name="image" />
          </div>
        </q-avatar>
      </q-item-section>

      <q-item-section>
        <div class="wrap-title">
          {{ wurst.name || 'Wurst' }}
          <q-chip dense class="q-ml-sm wrap-chip" icon="visibility_off">
            deaktiviert
          </q-chip>
        </div>

        <div class="wrap-sub">
          Für Nutzer versteckt · nur Admin sieht das
        </div>
      </q-item-section>

      <q-item-section side class="row items-center q-gutter-sm">
        <q-toggle
          dense
          :model-value="isActive"
          @update:model-value="onToggleActive"
          @click.stop
        />
      </q-item-section>
    </template>

    <!-- ✅ Inhalt erst mounten, wenn geöffnet -->
    <div class="q-pa-sm">
      <slot v-if="open" />
    </div>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useWurstStore } from '@/stores/wurst'

type Props = {
  wurst: {
    id: string
    name?: string
    imageUrl?: string
    active?: boolean
  }
}
const props = defineProps<Props>()

const $q = useQuasar()
const auth = useAuthStore()
const store = useWurstStore()

const isAdmin = computed(() => auth.meta?.role === 'admin')
const isActive = computed(() => (props.wurst as any).active !== false)

const open = ref(false)

/**
 * Render-Regel:
 * - wenn aktiv => immer Slot rendern
 * - wenn nicht aktiv:
 *   - user: nix rendern
 *   - admin: expansion anzeigen
 */
const shouldRenderDirect = computed(() => isActive.value || isAdmin.value === true && isActive.value)

async function onToggleActive(v: boolean) {
  try {
    // falls du die Methode im Store anders genannt hast: hier anpassen
    await store.setWurstActive(props.wurst.id, v)
    $q.notify({
      type: 'positive',
      message: v ? 'Wurst aktiviert (sichtbar)' : 'Wurst deaktiviert (versteckt)',
    })

    // Wenn aktiviert -> Expansion nicht mehr nötig
    if (v) open.value = false
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Ändern fehlgeschlagen' })
  }
}
</script>

<style scoped>
.wrap-exp {
  max-width: 720px;
  margin: 0 auto;
  border-radius: 18px;
  overflow: hidden;

  /* Deaktiviert-Optik */
  border-top: 4px solid rgba(244, 67, 54, 0.9);
}

.wrap-header {
  padding: 10px 12px;
}

/* wichtig: kein All-Caps */
.wrap-header :deep(.q-item__label),
.wrap-title,
.wrap-sub {
  text-transform: none !important;
}

.wrap-title {
  font-weight: 900;
  font-size: 0.98rem;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 8px;
}

.wrap-sub {
  opacity: 0.72;
  font-size: 0.78rem;
  margin-top: 2px;
}

.wrap-chip {
  background: rgba(244, 67, 54, 0.15);
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(244, 67, 54, 0.35);
  font-weight: 800;
}

.wrap-thumb {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.35);
}

.wrap-thumb-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.08);
}

.opacity-70 {
  opacity: 0.7;
}
</style>
