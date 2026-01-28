<template>
  <q-expansion-item icon="list" label="Reservierungen anzeigen" dense class="wood-surface">
    <q-table
      class="wood-surface q-ma-md"
      :rows="tableRows"
      :columns="columns"
      row-key="uid"
      flat
      hide-pagination
      :rows-per-page-options="[0]"
      no-data-label="Keine Reservierungen"
    >
      <!-- Abgeholt checkbox -->
      <template #body-cell-picked="p">
        <q-td :props="p">
          <q-checkbox
            dense
            :model-value="!!pickedMap[p.row.uid]"
            @update:model-value="(v:boolean) => setPicked(p.row.uid, v)"
          />
        </q-td>
      </template>

      <!-- User cell -->
      <template #body-cell-user="p">
        <q-td :props="p">
          <div class="row items-center q-gutter-sm" :class="{ 'picked-row': p.row.picked }">
            <q-avatar size="20px" color="primary" text-color="white">
              {{
                (p.row.displayName || p.row.email || p.row.uid || 'U')
                  .charAt(0)
                  .toUpperCase()
              }}
            </q-avatar>
            <div>{{ p.row.displayName || p.row.email || p.row.uid }}</div>
          </div>
        </q-td>
      </template>

      <!-- Quantity cell -->
      <template #body-cell-quantity="p">
        <q-td :props="p" class="text-right">
          <div :class="{ 'picked-row': p.row.picked }">
            {{ p.row.quantity }}
          </div>
        </q-td>
      </template>

      <!-- Totals -->
      <template #bottom>
        <div class="row justify-end q-pa-sm q-gutter-md full-width">
          <div class="text-caption">
            Offen: <b>{{ totalQtyOpen }}</b>
          </div>
          <div class="text-caption opacity-75">
            Abgeholt: <b>{{ totalQtyPicked }}</b>
          </div>
          <div class="text-caption opacity-75">
            Gesamt: <b>{{ totalQtyAll }}</b>
          </div>
        </div>

        
      </template>
    </q-table>

    <q-btn
      no-caps
      color="primary"
      icon="notifications_active"
      label="Erinnerung an Nicht-Abgeholte"
      :disable="notPickedUids.length === 0 || sending"
      :loading="sending"
      class="q-mb-sm"
      @click="sendReminderToNotPicked"
    />


    <div style="height: 8px;" />
  </q-expansion-item>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { db } from '@/firebase'
import { collection, doc, getDoc, onSnapshot, query } from 'firebase/firestore'
import { useQuasar } from 'quasar'
import { sendPushToUsers } from '@/services/pushSend'

type Props = {
  wurstId: string
  pricePerPack: number
}
const props = defineProps<Props>()

const $q = useQuasar()

type Row = {
  uid: string
  quantity: number
  email?: string | null
  displayName?: string | null
  price: number // quantity * pricePerPack
}

const rows = ref<Row[]>([])
let unsub: (() => void) | null = null

// ─────────────────────────────────────────────────────────────
// LocalStorage: "Abgeholt" Status (pro wurstId pro uid)
// ─────────────────────────────────────────────────────────────
const LS_KEY = 'wurst_pickups_v1'
type PickupsStore = Record<string, Record<string, boolean>> // wurstId -> uid -> true

function readPickups(): PickupsStore {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}') as PickupsStore
  } catch {
    return {}
  }
}

function writePickups(all: PickupsStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

const pickedMap = ref<Record<string, boolean>>({})

function loadPickedMap() {
  const all = readPickups()
  pickedMap.value = all[props.wurstId] || {}
}

function setPicked(uid: string, picked: boolean) {
  const all = readPickups()
  const map = all[props.wurstId] || {}
  if (picked) map[uid] = true
  else delete map[uid]
  all[props.wurstId] = map
  writePickups(all)
  pickedMap.value = { ...map }
}

// Cross-tab sync (falls Admin in anderem Tab markiert)
function onStorage(e: StorageEvent) {
  if (e.key === LS_KEY) loadPickedMap()
}

// ─────────────────────────────────────────────────────────────
// Cache für Userdaten, damit wir pro UID nur einmal lesen
// ─────────────────────────────────────────────────────────────
const userCache = new Map<string, { email: string | null; displayName: string | null }>()

async function loadUser(uid: string) {
  if (userCache.has(uid)) return userCache.get(uid)!
  try {
    const s = await getDoc(doc(db, 'users', uid))
    const info = {
      email: s.exists() ? ((s.data() as any).email ?? null) : null,
      displayName: s.exists() ? ((s.data() as any).displayName ?? null) : null,
    }
    userCache.set(uid, info)
    return info
  } catch {
    const info = { email: null, displayName: null }
    userCache.set(uid, info)
    return info
  }
}

// ─────────────────────────────────────────────────────────────
// Totals (gesamt / abgeholt / offen)
// ─────────────────────────────────────────────────────────────
const totalQtyAll = computed(() =>
  rows.value.reduce((a, r) => a + (r.quantity || 0), 0),
)

const totalQtyPicked = computed(() =>
  rows.value.reduce((a, r) => a + (pickedMap.value[r.uid] ? (r.quantity || 0) : 0), 0),
)

const totalQtyOpen = computed(() => Math.max(0, totalQtyAll.value - totalQtyPicked.value))

// (optional) Preis-Summen
const totalPriceAll = computed(() =>
  rows.value.reduce((a, r) => a + (r.price || 0), 0),
)
const totalPricePicked = computed(() =>
  rows.value.reduce((a, r) => a + (pickedMap.value[r.uid] ? (r.price || 0) : 0), 0),
)
const totalPriceOpen = computed(() => Math.max(0, totalPriceAll.value - totalPricePicked.value))

// Table rows "decorated"
const tableRows = computed(() =>
  rows.value
    .map((r) => ({ ...r, picked: !!pickedMap.value[r.uid] }))
    .sort((a, b) => b.quantity - a.quantity),
)

const columns = [
  { name: 'picked', label: 'Abgeholt', field: 'picked', align: 'left' },
  { name: 'user', label: 'Name', field: 'displayName', align: 'left' },
  { name: 'quantity', label: 'Menge', field: 'quantity', align: 'right' },
]

const notPickedUids = computed(() =>
  rows.value
    .filter(r => r.quantity > 0 && !pickedMap.value[r.uid])
    .map(r => r.uid)
)
const sending = ref(false)

async function sendReminderToNotPicked() {
  if (sending.value) return

  const uids = notPickedUids.value
  if (uids.length === 0) {
    $q.notify({ type: 'info', message: 'Alle haben bereits abgeholt.' })
    return
  }

  sending.value = true
  try {
    await sendPushToUsers({
      uids,
      body: 'Deine Bestellung ist bereit - bitte abholen.',
      url: '/', 
    })
    $q.notify({ type: 'positive', message: `Erinnerung gesendet (${uids.length} Nutzer)` })
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Senden fehlgeschlagen' })
  } finally {
    sending.value = false
  }
}


// ─────────────────────────────────────────────────────────────
// Snapshot
// ─────────────────────────────────────────────────────────────
onMounted(() => {
  loadPickedMap()
  window.addEventListener('storage', onStorage)

  const qy = query(collection(db, 'wuerste', props.wurstId, 'reservations'))
  unsub = onSnapshot(
    qy,
    async (snap) => {
      const base: Row[] = snap.docs
        .map((d) => {
          const data = d.data() as any
          const uid = data?.uid || d.id
          const q = Math.max(0, Number(data?.quantity || 0))
          return { uid, quantity: q, price: q * (props.pricePerPack || 0) }
        })
        .filter((r) => r.quantity > 0)

      // sofort anzeigen (snappy)
      rows.value = base

      // Userdaten nachladen (best-effort)
      const tasks = base.map(async (r) => {
        const info = await loadUser(r.uid)
        r.email = info.email
        r.displayName = info.displayName
      })
      await Promise.all(tasks)

      // reactivity trigger
      rows.value = [...base]
    },
    (err) => {
      $q.notify({
        type: 'negative',
        message: err.message || 'Reservierungen konnten nicht geladen werden.',
      })
    },
  )
})

onUnmounted(() => {
  if (unsub) unsub()
  window.removeEventListener('storage', onStorage)
})

// wenn wurstId wechselt (selten), Map neu laden
watch(
  () => props.wurstId,
  () => loadPickedMap(),
)
</script>


<style scoped>
.picked-row {
  opacity: 0.45;
  text-decoration: line-through;
}
</style>
