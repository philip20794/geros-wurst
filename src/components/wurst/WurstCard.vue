<template>
  <q-card flat class="card-wood product-card" dark>
    <!-- Hero Image -->
    <div class="hero">
      <q-img :src="wurst.imageUrl" :ratio="16/9" loading="lazy" class="hero-img">
        <!-- Header overlay -->
        <div class="hero-overlay">
          <div class="row items-center justify-between">
            <div class="row items-center no-wrap" />
            <div class="row items-center q-gutter-xs">
              <!-- Fullscreen -->
              <q-btn flat round dense icon="fullscreen" class="text-white" @click.stop="showFull = true" />

              <!-- Admin menu -->
              <q-btn v-if="isAdmin" flat round dense icon="more_horiz" class="text-white">
                <q-menu anchor="bottom right" self="top right" dark>
                  <q-list style="min-width: 210px">
                    <q-item clickable v-close-popup @click="emit('push', wurst)">
                      <q-item-section avatar><q-icon name="notifications_active" /></q-item-section>
                      <q-item-section>Benachrichtigung an alle senden</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="emit('edit', wurst)">
                      <q-item-section avatar><q-icon name="edit" /></q-item-section>
                      <q-item-section>Bearbeiten</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="emit('delete', wurst)">
                      <q-item-section avatar><q-icon name="delete" /></q-item-section>
                      <q-item-section>Löschen</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </div>
        </div>

        <!-- Type badge: PRODUCT -->
        <div class="type-badge product">
          <q-icon name="shopping_cart" size="16px" class="q-mr-xs" />
          {{ wurst.name }}
        </div>


        <!-- Bottom badge: Availability -->
        <div class="availability-badge">
          <span class="label">Verfügbar</span>
          <span class="value">{{ remaining }}</span>
          <span class="muted">/ {{ wurst.totalPacks }}</span>
        </div>
      </q-img>
    </div>

    <!-- Body -->
    <q-card-section class="body">


      <div class="meta row items-center justify-between q-mt-xs">
        <div class="text-body2 ">
          {{ wurst.sausagesPerPack }} Würstchen pro Packung
        </div>


        <div class="fact">
          <div class="k">Preis</div>
          <div class="v">{{ Number(wurst.pricePerPack).toFixed(2) }} €/Kg</div>
        </div>
      </div>

      <q-separator class="q-mt-md" />

      <!-- USER Reservation -->
      <div v-if="!isAdmin" class="footer q-pt-sm">
        <div class="row items-center justify-between">
          <q-btn
            flat
            no-caps
            class="reserve-btn"
            :class="{ active: currentQty > 0 }"
            @click="toggleReserve"
            :disable="saving"
            icon="add_shopping_cart"
            :label="currentQty > 0 ? 'Reservierung ändern' : 'Reservieren'"
          >
            <q-badge v-if="currentQty > 0" rounded class="q-ml-sm">
              {{ currentQty }}
            </q-badge>
          </q-btn>
        </div>

        <q-slide-transition>
          <div v-show="editorOpen" class="editor q-mt-sm">
            <div class="row items-center q-col-gutter-sm">
              <div class="col">
                <q-input
                  dense
                  outlined
                  type="number"
                  min="0"
                  v-model.number="myQty"
                  label="Menge (Packungen)"
                  @keyup.enter="saveReservation"
                />
              </div>

              <div class="col-auto">
                <q-btn
                  color="primary"
                  unelevated
                  no-caps
                  :loading="saving"
                  label="Speichern"
                  @click="saveReservation"
                />
              </div>

              <div class="col-auto">
                <q-btn flat round icon="close" @click="editorOpen = false" :disable="saving" />
              </div>
            </div>

            <div class="text-caption opacity-70 q-mt-xs">
              Tipp: <b>0</b> = Reservierung entfernen
            </div>
          </div>
        </q-slide-transition>
      </div>

      <!-- ADMIN -->
      <div v-else class="q-pt-sm">
        <div class="text-caption opacity-75">
          Restbestand: <b>{{ remaining }}</b>
        </div>
        <q-separator class="q-mt-sm q-mb-sm" />
        <AdminReservations :wurst-id="wurst.id" :price-per-pack="wurst.pricePerPack" />
      </div>
    </q-card-section>

    <!-- Vollbild-Dialog -->
    <q-dialog v-model="showFull" maximized>
      <q-card class="bg-black">
        <q-bar class="bg-black text-white">
          <div class="text-subtitle2 ellipsis">{{ wurst.name }}</div>
          <q-space />
          <q-btn no-caps dense flat round icon="close" v-close-popup />
        </q-bar>
        <q-card-section class="q-pa-none">
          <q-img
            :src="wurst.imageUrl"
            fit="contain"
            style="height: calc(100vh - 42px);"
            img-class="bg-black"
          />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useWurstStore, type Wurst } from '@/stores/wurst'
import AdminReservations from '@/components/AdminReservations.vue'

type Props = { wurst: Wurst }
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'push', w: Wurst): void
  (e: 'edit', w: Wurst): void
  (e: 'delete', w: Wurst): void
}>()

const $q = useQuasar()
const auth = useAuthStore()
const store = useWurstStore()

const isAdmin = computed(() => auth.meta?.role === 'admin')

// Header identity
const headerTitle = computed(() => 'Geros Wild')
const avatarInitial = computed(() => 'G')

// State
const reservedSum = ref(0)
const myQty = ref<number>(0)
const currentQty = ref(0)

const editorOpen = ref(false)
const saving = ref(false)
const showFull = ref(false)

let unsubSum: null | (() => void) = null
let unsubMine: null | (() => void) = null

const remaining = computed(() => {
  return Math.max(0, (props.wurst.totalPacks || 0) - (reservedSum.value || 0))
})

onMounted(async () => {
  unsubSum = store.watchReservedSum(props.wurst.id, (sum) => (reservedSum.value = sum))

  unsubMine = store.watchMyReservation(props.wurst.id, (qty) => {
    currentQty.value = qty
    if (!editorOpen.value) myQty.value = qty
  })

  // fallback
  try {
    const initial = await store.getMyReservation(props.wurst.id)
    currentQty.value = initial
    if (!editorOpen.value) myQty.value = initial
  } catch (e) {
    console.error('getMyReservation failed', e)
  }
})

onUnmounted(() => {
  if (unsubSum) unsubSum()
  if (unsubMine) unsubMine()
})

// One-tap reserve: wenn 0 -> direkt 1 speichern + editor öffnen
async function toggleReserve() {
  if (saving.value) return

  if (currentQty.value <= 0) {
    saving.value = true
    try {
      // wenn gar nix mehr übrig ist, nicht setzen
      if (remaining.value <= 0) {
        $q.notify({ type: 'warning', message: 'Leider ausverkauft.' })
        return
      }

      await store.setReservation(props.wurst.id, 1)
      $q.notify({ type: 'positive', message: `Du hast 1 ${props.wurst.name} reserviert` })
      currentQty.value = 1
      myQty.value = 1
      editorOpen.value = true
    } catch (e: any) {
      console.error(e)
      $q.notify({ type: 'negative', message: e?.message || 'Speichern fehlgeschlagen' })
    } finally {
      saving.value = false
    }
    return
  }

  editorOpen.value = !editorOpen.value
  if (editorOpen.value) myQty.value = currentQty.value
}

async function saveReservation() {
  saving.value = true
  try {
    const desired = Math.max(0, Math.floor(Number(myQty.value ?? 0)))
    const current = currentQty.value || 0

    // Erhöhung limitieren (Restbestand)
    if (desired > current) {
      const addDelta = desired - current
      const maxDelta = remaining.value
      const allowed = current + maxDelta

      if (addDelta > maxDelta) {
        myQty.value = allowed
        $q.notify({
          type: 'warning',
          message: `Du kannst um höchstens ${maxDelta} erhöhen (insgesamt ${allowed}).`,
        })
        return
      }
    }

    await store.setReservation(props.wurst.id, desired)
    currentQty.value = desired
    editorOpen.value = false
    $q.notify({ type: 'positive', message: desired > 0 ? `Du hast ${desired} ${props.wurst.name} reserviert` : 'Entfernt' })
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Speichern fehlgeschlagen (Rules/Netzwerk?)' })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.product-card {
  max-width: 720px;
  margin: 0 auto;
  border-radius: 18px;
  overflow: hidden;

  /* (2) Akzent-Top-Border: Produkt */
  border-top: 4px solid var(--q-positive);
}

.hero {
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
  overflow: hidden;
  position: relative;
}

.hero-img :deep(img) {
  filter: saturate(1.05) contrast(1.05);
}

.hero-overlay {
  position: absolute;
  inset: 0;
  padding: 10px 12px;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0.62),
    rgba(0,0,0,0.20) 55%,
    rgba(0,0,0,0.00)
  );
}

/* (1) Type Badge: Produkt */
.type-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 18px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  backdrop-filter: blur(6px);
}

.type-badge.product {
  background: rgba(0, 200, 83, 0.92); /* grün */
  color: #07160d;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
}

/* Availability badge bleibt, aber etwas “product-y” */
.availability-badge {
  position: absolute;
  bottom: 10px;
  left: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0,0,0,0.55);
  color: rgba(255,255,255,0.92);
  backdrop-filter: blur(6px);
  font-size: 12px;
  display: inline-flex;
  gap: 6px;
  align-items: baseline;
}

.availability-badge .label { opacity: 0.85; }
.availability-badge .muted { opacity: 0.8; }

.body { padding-top: 14px; }

.title {
  font-size: 1.05rem;
  line-height: 1.45;
  font-weight: 800; /* Produkt etwas kräftiger */
  white-space: pre-wrap;
  word-break: break-word;
}

.meta { gap: 12px; }

/* (3) Action-Zone: Facts + Reserve Button (nicht “Reaction”) */
.facts {
  display: flex;
  gap: 14px;
  align-items: center;
}

.fact .k {
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.1;
}

.fact .v {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.2;
}

.reserve-btn {
  border-radius: 12px;  /* NICHT pill → unterscheidet sich von Umfrage */
  padding: 8px 12px;
  font-weight: 800;
}

.reserve-btn.active {
  outline: 2px solid rgba(0, 200, 83, 0.35);
}

.editor :deep(.q-field__control) {
  border-radius: 12px;
}

.opacity-70 { opacity: 0.7; }
.opacity-75 { opacity: 0.75; }
.opacity-80 { opacity: 0.8; }

.footer .react {
  border-radius: 999px;
  padding: 6px 12px;
  opacity: 0.95;
}

.footer .react.active {
  font-weight: 700;
}
</style>
