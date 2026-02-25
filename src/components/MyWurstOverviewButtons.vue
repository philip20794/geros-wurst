<template>
  <div class="row items-center q-gutter-sm">
    <!-- Reserviert -->
    <q-btn
      no-caps
      outline
      class="ov-btn"
      icon="shopping_cart"
      label="Reserviert"
      :disable="loading || reservations.length === 0"
      @click="openDialog('reserved')"
    >
      <q-badge v-if="reservations.length" floating rounded>
        {{ reservations.length }}
      </q-badge>
    </q-btn>

    <!-- Abgeholt -->
    <q-btn
      no-caps
      outline
      class="ov-btn"
      icon="inventory_2"
      label="Abgeholt"
      :disable="loading || pickups.length === 0"
      @click="openDialog('picked')"
    >
    </q-btn>
  </div>

  <!-- Dialog -->
  <q-dialog v-model="dlg.open">
    <q-card dark class="ov-card">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-subtitle1 text-weight-bold">Meine Übersicht</div>
        <q-space />
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-card-section class="q-pt-sm">
        <q-tabs v-model="dlg.tab" dense inline-label class="ov-tabs">
          <q-tab name="reserved" icon="add_shopping_cart" label="Reserviert" />
          <q-tab name="picked" icon="inventory_2" label="Abgeholt" />
        </q-tabs>

        <div class="row items-center q-gutter-xs q-mt-sm">
          <q-chip dense>
            Menge: <b class="q-ml-xs">{{ activeQtySum }}</b>
          </q-chip>
        </div>
      </q-card-section>

      <q-separator dark />

      <q-card-section class="q-pt-sm">
        <q-list bordered separator class="rounded-borders">
          <q-item v-if="activeItems.length === 0">
            <q-item-section class="text-caption opacity-75">
              Keine Einträge.
            </q-item-section>
          </q-item>

          <q-item
            v-for="it in activeItems"
            :key="rowKey(it)"
            class="q-py-sm"
            @click="emit('open-wurst', it.wurstId)"
          >
            <q-item-section avatar>
              <q-avatar square size="46px" class="thumb">
                <q-img
                  v-if="it.imageUrl"
                  :src="it.imageUrl"
                  ratio="1"
                  fit="cover"
                />
                <div v-else class="thumb-fallback">
                  <q-icon name="image" />
                </div>
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <div class="name-wrap">
                {{ it.name || ('Wurst ' + it.wurstId) }}
              </div>
              <div class="text-caption opacity-70">
                Menge: <b>{{ it.quantity }}</b>
                <span v-if="(it.pricePerPack || 0) > 0" class="q-ml-sm">
                  · {{ fmt((it.pricePerPack || 0)) }}/Kg
                </span>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat no-caps label="Schließen" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useQuasar } from 'quasar'
import { useWurstStore, type MyReservationOverviewItem, type MyPickupOverviewItem } from '@/stores/wurst'
import { useAuthStore } from '@/stores/auth';

const emit = defineEmits<{
  (e: 'open-wurst', wurstId: string): void
}>()

const $q = useQuasar()
const store = useWurstStore()
const auth = useAuthStore()

const loading = ref(true)

const reservations = ref<MyReservationOverviewItem[]>([])
const pickups = ref<MyPickupOverviewItem[]>([])

let unsubRes: null | (() => void) = null
let unsubPick: null | (() => void) = null

const dlg = ref<{ open: boolean; tab: 'reserved' | 'picked' }>({
  open: false,
  tab: 'reserved',
})

function openDialog(which: 'reserved' | 'picked') {
  dlg.value.tab = which
  dlg.value.open = true
}

function rowKey(it: any) {
  return it.pickupId ? `p:${it.pickupId}` : `r:${it.wurstId}`
}

const activeItems = computed(() => {
  return dlg.value.tab === 'reserved' ? reservations.value : pickups.value
})

const activeQtySum = computed(() =>
  activeItems.value.reduce((a: number, x: any) => a + Number(x.quantity || 0), 0)
)

const activePriceSum = computed(() =>
  activeItems.value.reduce((a: number, x: any) => {
    const pp = Number(x.pricePerPack || 0)
    if (!pp) return a
    return a + pp * Number(x.quantity || 0)
  }, 0)
)

function fmt(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(v || 0))
}

watchEffect((onCleanup) => {
  // ✅ erst starten wenn user + meta wirklich da sind
  const ready = !!auth.user && auth.meta?.status === 'approved'
  if (!ready) {
    reservations.value = []
    pickups.value = []
    loading.value = true
    return
  }

  loading.value = true

  unsubRes = store.watchMyReservationsOverview((items) => {
    reservations.value = items
    loading.value = false
  })

  unsubPick = store.watchMyPickupsOverview((items) => {
    pickups.value = items
    loading.value = false
  })

  onCleanup(() => {
    if (unsubRes) unsubRes()
    if (unsubPick) unsubPick()
    unsubRes = null
    unsubPick = null
  })
})

</script>

<style scoped>
.ov-btn {
  border-radius: 14px;
  font-weight: 850;
}

.ov-card {
  width: 92vw;
  max-width: 520px;
  border-radius: 18px;
  box-shadow: 0 18px 44px rgba(0,0,0,0.55);
}

.ov-tabs :deep(.q-tab__label) {
  text-transform: none;
  font-weight: 850;
}

.thumb {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 22px rgba(0,0,0,0.30);
}

.thumb-fallback {
  height: 100%;
  width: 100%;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,0.08);
}
.opacity-70 { opacity: 0.7; }
</style>
