<template>
  <q-card flat class="card-wood product-card" dark>
    <!-- Hero Image -->
    <div class="hero">
      <q-img :src="wurst.imageUrl" :ratio="16/9" loading="eager" class="hero-img">
        <!-- Header overlay -->
        <div class="hero-overlay">
          <div class="row items-center justify-between">
            <div class="row items-center no-wrap" />
            <div class="row items-center q-gutter-xs">

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
                    <q-item>
                      <q-item-section avatar>
                        <q-icon :name="(wurst.active !== false) ? 'toggle_on' : 'toggle_off'" />
                      </q-item-section>

                      <q-item-section>
                        <div class="text-body2">Aktiv</div>
                        <div class="text-caption opacity-70">
                          {{ (wurst.active !== false) ? 'sichtbar für Nutzer' : 'versteckt für Nutzer' }}
                        </div>
                      </q-item-section>

                      <q-item-section side>
                        <q-toggle
                          dense
                          :model-value="wurst.active !== false"
                          @update:model-value="toggleActive"
                        />
                      </q-item-section>
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


        <!-- Bottom badge: Availability (neu) -->
        <div
          class="availability-pill"
          :class="availClass"
          role="button"
          @click.stop="isAdmin && fixReservations()"
        >
          <q-btn
            flat
            round
            dense
            class="pill-refresh text-white"
            :disable="updating"
            @click.stop="fixReservations"
          >
            <q-icon v-if="!updating" name="refresh" />
            <q-spinner v-else size="14px" />
            <q-tooltip>{{ updating ? 'Aktualisiere…' : 'Bestände neu berechnen' }}</q-tooltip>
          </q-btn>

          <div class="pill-main">
            <div class="pill-top">
              <span class="label">Verfügbar:</span>
              <span class="value">{{ remaining }}</span>
              <span class="muted">/ {{ wurst.totalPacks }}</span>
            </div>

            <q-linear-progress
              rounded
              size="4px"
              :value="availRatio"
              :indeterminate="updating"
              :color="availColor"
              track-color="rgba(255,255,255,0.18)"
              class="pill-bar"
            />
          </div>
        </div>


        <!-- Fullscreen Button unten rechts -->
        <div class="fs-btn">
          <q-btn
            flat
            round
            dense
            size="xs"
            icon="fullscreen"
            class="text-white fs-btn-q"
            @click.stop="emit('open-full', wurst.imageUrl, wurst.name)"
          />
        </div>

      </q-img>
    </div>

    <!-- Body -->
    <q-card-section class="body">


      <div class="meta row items-center justify-between q-mt-xs">
        <div class="text-body2 ">
          {{ wurst.sausagesPerPack }} {{ categorySafe }} pro Packung
        </div>


        <div class="fact">
          <div class="k">Preis</div>
          <div class="v" v-if="price">{{ price }}</div>
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

  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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
  (e: 'open-full', src: string, title: string): void
}>()

const $q = useQuasar()
const auth = useAuthStore()
const store = useWurstStore()

const isAdmin = computed(() => auth.meta?.role === 'admin')

// Header identity
const headerTitle = computed(() => 'Geros Wild')
const avatarInitial = computed(() => 'G')

// State
const myQty = ref<number>(0)
const wurstId = computed(() => props.wurst.id)

const currentQty = computed(() => {
  const map = store.myResMap as any
  return Number(map?.value?.[wurstId.value] ?? map?.[wurstId.value] ?? 0)
})

const editorOpen = ref(false)
const saving = ref(false)
const showFull = ref(false)
const updating = ref(false)

const remaining = computed(() => {
  const total = Number(props.wurst.totalPacks || 0)
  const reserved = Number((props.wurst as any).reservedPacks || 0)
  const picked = Number((props.wurst as any).pickedUpPacks || 0)
  return Math.max(0, total - reserved - picked)
})

const price = computed(() => {
  if (props.wurst != null && props.wurst.pricePerPack != null) {
    const result = Number(props.wurst.pricePerPack).toFixed(2)
    if (props.wurst.pricePerPack === 0) {
      return 'VB'
    }
    return `${result} €/${props.wurst.unit ?? 'Kg'}`
  }
  return null
})

const categorySafe = computed(() => {
  const c = (props.wurst as any)?.category
  const s = String(c ?? '').trim()
  return s.length ? s : 'Würstchen'
})

const availRatio = computed(() => {
  const total = Number(props.wurst.totalPacks || 0)
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, remaining.value / total))
})

const availColor = computed(() => {
  if (remaining.value <= 0) return 'negative'
  if (availRatio.value < 0.25) return 'warning'
  return 'positive'
})

const availClass = computed(() => {
  if (remaining.value <= 0) return 'is-empty'
  if (availRatio.value < 0.25) return 'is-low'
  return 'is-ok'
})

async function fixReservations() {
  if (updating.value) return
  updating.value = true
  try {
    await store.recomputeAllWurstAggregates()
  } finally {
    updating.value = false
  }
}


async function toggleActive(v: boolean) {
  try {
    await store.setWurstActive(props.wurst.id, v)
    $q.notify({
      type: 'positive',
      message: v ? 'Wurst aktiviert (sichtbar)' : 'Wurst deaktiviert (versteckt)',
    })
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Ändern fehlgeschlagen' })
  }
}

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
  font-size: 16px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  backdrop-filter: blur(6px);
  max-width: 80%;
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

.fs-btn{
  position:absolute;
  right:8px;
  bottom:8px;
  z-index:5;

  background: rgba(0,0,0,0.38);
  border-radius: 999px;
  backdrop-filter: blur(4px);

  padding:8px;              /* war größer */
}

.fs-btn :deep(.q-btn){
  min-width: 32px;          /* kleiner Tap-Button */
  min-height: 32px;
  padding: 0;
}

.fs-btn :deep(.q-icon){
  font-size: 22px;          /* Icon kleiner */
}


.availability-pill{
  position:absolute;
  bottom:8px;
  left:8px;
  z-index:5;

  display:flex;
  align-items:center;
  gap:6px;

  padding:5px 7px;
  border-radius:999px;

  background: rgba(0,0,0,0.46);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 8px 18px rgba(0,0,0,0.25);

  color: rgba(255,255,255,0.92);
  max-width: 72%;
}

.pill-ic{
  opacity:0.95;
  font-size:14px;
}

.pill-main{
  min-width: 110px;
}

.pill-top{
  display:flex;
  align-items:baseline;
  gap:4px;
  line-height:1.0;
  margin-bottom:3px;
}

.availability-pill .label{
  font-size:10px;
  opacity:0.78;
}

.availability-pill .value{
  font-size:12px;
  font-weight:900;
}

.availability-pill .muted{
  font-size:10px;
  opacity:0.75;
}

.pill-bar{
  border-radius:999px;
}

.pill-refresh :deep(.q-btn){
  min-width: 24px;
  min-height: 24px;
  padding: 0;
}

.pill-refresh :deep(.q-icon){
  font-size: 22px;
}

.q-btn--dense.q-btn--round {
  min-height: 22px;
  min-width: 22px;
}


</style>
