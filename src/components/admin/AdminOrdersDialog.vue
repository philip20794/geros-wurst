<template>
  <q-dialog v-model="open">
    <q-card class="card-wood orders-card" dark>
      <!-- Header -->
      <div class="orders-head">
        <div class="row items-center q-gutter-sm">
          <q-icon name="receipt_long" size="20px" />
          <div class="text-subtitle1 text-weight-bold">Bestellungen</div>
        </div>
        <q-space />
        <q-btn flat round dense icon="close" class="text-white" @click="open = false" />
      </div>

      <q-separator dark />

      <!-- Toolbar -->
      <q-card-section class="q-pa-sm">
        <div class="row items-center q-col-gutter-sm">
          <div class="col">
            <q-input
              dense
              outlined
              v-model="search"
              debounce="200"
              clearable
              placeholder="Nutzer suchen (Name, E-Mail)"
              class="orders-search"
            >
              <template #append><q-icon name="search" /></template>
            </q-input>
          </div>
        </div>
      </q-card-section>

      <q-separator dark />

      <!-- Desktop: Split -->
      <q-card-section v-if="!isMobile" class="q-pa-none">
        <q-splitter v-model="split" class="orders-split">
          <!-- LEFT: users -->
          <template #before>
            <div class="pane">
              <q-list bordered separator class="rounded-borders orders-list">
                <q-item v-if="filteredUsers.length === 0">
                  <q-item-section class="text-caption opacity-75">
                    Keine Reservierungen gefunden.
                  </q-item-section>
                </q-item>

                <q-item
                  v-for="u in filteredUsers"
                  :key="u.uid"
                  clickable
                  :active="u.uid === selectedUid"
                  active-class="orders-active"
                  @click="selectedUid = u.uid"
                >
                  <q-item-section avatar>
                    <q-avatar color="primary" text-color="white">
                      {{ (userInfo(u.uid).label || 'U').charAt(0).toUpperCase() }}
                    </q-avatar>
                  </q-item-section>

                  <q-item-section>
                    <div class="text-subtitle2 ellipsis">
                      {{ userInfo(u.uid).label }}
                    </div>
                    <div class="text-caption opacity-70 ellipsis">
                      UID: {{ u.uid }}
                    </div>
                  </q-item-section>

                  <q-item-section side>
                    <div class="text-caption">
                      <b>{{ u.productCount }}</b> Produkte
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </template>

          <!-- RIGHT: details -->
          <template #after>
            <div class="pane">
              <div v-if="!selectedUid" class="q-pa-md text-caption opacity-75">
                Links einen Nutzer auswählen.
              </div>

              <div v-else class="q-pa-md">
                <div class="row items-center q-gutter-sm q-mb-sm">
                  <q-avatar color="primary" text-color="white">
                    {{ (userInfo(selectedUid).label || 'U').charAt(0).toUpperCase() }}
                  </q-avatar>

                  <div class="col">
                    <div class="text-subtitle1 text-weight-bold ellipsis">
                      {{ userInfo(selectedUid).label }}
                    </div>
                    <div class="text-caption opacity-70 ellipsis">
                      UID: {{ selectedUid }}
                    </div>
                  </div>

                  <q-chip dense>
                    Produkte: <b class="q-ml-xs">{{ selectedTotals.products }}</b>
                  </q-chip>

                  <q-checkbox
                    dense
                    :model-value="selectedAllPicked"
                    :indeterminate="selectedSomePicked && !selectedAllPicked"
                    :disable="bulkBusy || selectedRows.length === 0"
                    label="Alle abgeholt"
                    @update:model-value="(v: boolean) => toggleAllPicked(v)"
                  />
                </div>

                <q-table
                  flat
                  bordered
                  dense
                  hide-pagination
                  :rows="selectedRows"
                  :columns="columns"
                  row-key="id"
                  no-data-label="Keine Reservierungen"
                  :rows-per-page-options="[0]"
                  class="orders-table"
                >
                  <template #body-cell-picked="p">
                    <q-td :props="p" class="text-center">
                      <q-checkbox
                        dense
                        :model-value="!!p.row.picked"
                        :disable="bulkBusy || isBusy(p.row.id)"
                        @update:model-value="(v: boolean) => onTogglePicked(p.row, v)"
                      />
                    </q-td>
                  </template>

                  <!-- Thumbnail + Name -->
                  <template #body-cell-name="p">
                    <q-td :props="p">
                      <div class="row items-center no-wrap q-gutter-sm">
                        <q-avatar square size="34px" class="prod-thumb">
                          <q-img v-if="p.row.imageUrl" :src="p.row.imageUrl" ratio="1" fit="cover" />
                          <div v-else class="thumb-fallback">
                            <q-icon name="image" />
                          </div>
                        </q-avatar>

                        <div class="ellipsis" :class="{ 'picked-row': p.row.picked }">
                          {{ p.row.name }}
                        </div>
                      </div>
                    </q-td>
                  </template>

                  <template #body-cell-qty="p">
                    <q-td :props="p" class="text-right">
                      <b>{{ p.row.qty }}</b>
                    </q-td>
                  </template>

                  <template #body-cell-price="p">
                    <q-td :props="p" class="text-right">
                      {{ fmtUnitPrice(p.row.price, p.row.unit) }}
                    </q-td>
                  </template>

                  <template #bottom>
                    <div class="row justify-end q-pa-sm">
                      <q-chip dense>
                        Produkte: <b class="q-ml-xs">{{ selectedTotals.products }}</b>
                      </q-chip>
                    </div>
                  </template>
                </q-table>
              </div>
            </div>
          </template>
        </q-splitter>
      </q-card-section>

      <!-- Mobile: Liste -> Detail -->
      <q-card-section v-else class="q-pa-none orders-mobile">
        <div v-if="!selectedUid" class="q-pa-sm">
          <q-list bordered separator class="rounded-borders orders-list">
            <q-item v-if="filteredUsers.length === 0">
              <q-item-section class="text-caption opacity-75">
                Keine Reservierungen gefunden.
              </q-item-section>
            </q-item>

            <q-item v-for="u in filteredUsers" :key="u.uid" clickable @click="selectedUid = u.uid">
              <q-item-section avatar>
                <q-avatar color="primary" text-color="white">
                  {{ (userInfo(u.uid).label || 'U').charAt(0).toUpperCase() }}
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <div class="text-subtitle2 ellipsis">
                  {{ userInfo(u.uid).label }}
                </div>
                <div class="text-caption opacity-70 ellipsis">
                  Produkte: <b>{{ u.productCount }}</b>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <div v-else class="q-pa-sm">
          <div class="row items-center q-gutter-sm q-mb-sm">
            <q-btn flat round icon="arrow_back" @click="selectedUid = null" />
            <div class="col">
              <div class="text-subtitle1 text-weight-bold ellipsis">
                {{ userInfo(selectedUid).label }}
              </div>
              <div class="text-caption opacity-70 ellipsis">
                Produkte: <b>{{ selectedTotals.products }}</b>
              </div>
            </div>
          </div>

          <div class="row items-center justify-between q-mb-sm">
            <q-checkbox
              dense
              :model-value="selectedAllPicked"
              :indeterminate="selectedSomePicked && !selectedAllPicked"
              :disable="bulkBusy || selectedRows.length === 0"
              label="Alle abgeholt"
              @update:model-value="(v: boolean) => toggleAllPicked(v)"
            />
          </div>

          <q-list bordered separator class="rounded-borders">
            <q-item v-if="selectedRows.length === 0">
              <q-item-section class="text-caption opacity-75">Keine Reservierungen</q-item-section>
            </q-item>

            <q-item v-for="r in selectedRows" :key="r.id" class="q-py-sm">
              <q-item-section avatar>
                <q-avatar square size="46px" class="prod-thumb">
                  <q-img v-if="r.imageUrl" :src="r.imageUrl" ratio="1" fit="cover" />
                  <div v-else class="thumb-fallback">
                    <q-icon name="image" />
                  </div>
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <div class="text-subtitle2" :class="{ 'picked-row': r.picked }">{{ r.name }}</div>
                <div class="text-caption opacity-70">
                  Menge: <b>{{ r.qty }}</b>
                  · Preis: <b>{{ fmtUnitPrice(r.price, r.unit) }}</b>
                </div>
              </q-item-section>

              <q-item-section side>
                <q-checkbox
                  dense
                  :model-value="!!r.picked"
                  :disable="bulkBusy || isBusy(r.id)"
                  @update:model-value="(v: boolean) => onTogglePicked(r, v)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-section>

      <q-separator dark />

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat no-caps label="Schließen" @click="open = false" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { db } from '@/firebase'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { useWurstStore, type Wurst } from '@/stores/wurst'
import { useAuthStore } from '@/stores/auth'

type Props = { modelValue: boolean }
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const $q = useQuasar()
const store = useWurstStore()
const auth = useAuthStore()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const isMobile = computed(() => $q.screen.lt.md)
const split = ref(38)

const search = ref('')
const selectedUid = ref<string | null>(null)

type OrderKind = 'reservation' | 'pickup'

type FlatRow = {
  id: string
  kind: OrderKind
  uid: string
  wurstId: string
  quantity: number
  pickupId?: string
  updatedAtMs?: number
}

const allRows = ref<FlatRow[]>([])
let unsubAll: null | (() => void) = null

// Keep picked-up rows visible for the last 30 days
const KEEP_DAYS_PICKED = 30
const KEEP_MS = KEEP_DAYS_PICKED * 24 * 60 * 60 * 1000

function tsToMillis(ts: any): number {
  if (!ts) return 0
  if (typeof ts === 'number') return ts
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

// Wurst-Meta schnell per id
const wurstById = computed<Record<string, Wurst>>(() => {
  const out: Record<string, Wurst> = {}
  for (const w of store.items) out[w.id] = w as any
  return out
})

type UserAgg = { uid: string; productCount: number }

const usersAgg = computed<UserAgg[]>(() => {
  const byUser = new Map<string, Set<string>>()

  for (const r of allRows.value) {
    if (!r.uid || !r.wurstId) continue
    if (Number(r.quantity || 0) <= 0) continue

    if (!byUser.has(r.uid)) byUser.set(r.uid, new Set())
    byUser.get(r.uid)!.add(r.wurstId)
  }

  const out: UserAgg[] = []
  for (const [uid, set] of byUser.entries()) out.push({ uid, productCount: set.size })
  return out
})

type UserInfo = { email: string | null; displayName: string | null }
const userInfoByUid = ref<Record<string, UserInfo>>({})
const userCache = new Set<string>()

function userInfo(uid: string) {
  const info = userInfoByUid.value[uid]
  const displayName = info?.displayName ?? null
  const email = info?.email ?? null
  const label = displayName || email || uid
  return { displayName, email, label }
}

async function loadUser(uid: string) {
  if (!uid || userCache.has(uid)) return
  userCache.add(uid)
  try {
    const s = await getDoc(doc(db, 'users', uid))
    const info: UserInfo = {
      email: s.exists() ? ((s.data() as any).email ?? null) : null,
      displayName: s.exists() ? ((s.data() as any).displayName ?? null) : null,
    }
    userInfoByUid.value = { ...userInfoByUid.value, [uid]: info }
  } catch {
    userInfoByUid.value = { ...userInfoByUid.value, [uid]: { email: null, displayName: null } }
  }
}

const collator = new Intl.Collator('de-DE', { sensitivity: 'base', numeric: true })

const filteredUsers = computed(() => {
  const q = String(search.value || '').trim().toLowerCase()

  const base = !q
    ? usersAgg.value
    : usersAgg.value.filter((u) => {
        const info = userInfo(u.uid)
        return (
          u.uid.toLowerCase().includes(q) ||
          (info.email || '').toLowerCase().includes(q) ||
          (info.displayName || '').toLowerCase().includes(q) ||
          info.label.toLowerCase().includes(q)
        )
      })

  return [...base].sort((a, b) => collator.compare(userInfo(a.uid).label, userInfo(b.uid).label))
})

// userInfos für sichtbare uids laden
watch(
  () => filteredUsers.value.map((x) => x.uid).join('|'),
  async () => {
    await Promise.all(filteredUsers.value.map((x) => loadUser(x.uid)))
  },
  { immediate: true },
)

type SelectedRow = {
  id: string
  kind: OrderKind
  pickupId?: string
  uid: string
  wurstId: string
  name: string
  qty: number
  price: number
  unit: string
  imageUrl?: string | null
  picked: boolean
}

const selectedRows = computed<SelectedRow[]>(() => {
  if (!selectedUid.value) return []
  const uid = selectedUid.value

  const rows = allRows.value.filter((r) => r.uid === uid && Number(r.quantity || 0) > 0)

  const out: SelectedRow[] = rows.map((r) => {
    const w = wurstById.value[r.wurstId]
    const qty = Number(r.quantity || 0)
    const price = Number(w?.pricePerPack || 0)
    const unit = String((w as any)?.unit || 'Kg')
    const imageUrl = (w as any)?.imageUrl ?? null

    return {
      id: r.id,
      kind: r.kind,
      pickupId: r.pickupId,
      uid: r.uid,
      wurstId: r.wurstId,
      name: String(w?.name || ('Wurst ' + r.wurstId)),
      qty,
      price,
      unit,
      imageUrl,
      picked: r.kind === 'pickup',
    }
  })

  return out.sort((a, b) => collator.compare(a.name, b.name))
})

const selectedAllPicked = computed(() => selectedRows.value.length > 0 && selectedRows.value.every((r) => !!r.picked))
const selectedSomePicked = computed(() => selectedRows.value.some((r) => !!r.picked))

// Busy state pro row + bulk
const busyMap = ref<Record<string, boolean>>({})
const bulkBusy = ref(false)

function isBusy(id: string) {
  return !!busyMap.value[id]
}
function setBusy(id: string, v: boolean) {
  busyMap.value = { ...busyMap.value, [id]: v }
}

async function toggleAllPicked(next: boolean) {
  if (bulkBusy.value) return
  const rowsToChange = selectedRows.value.filter((r) => !!r.picked !== !!next)
  if (rowsToChange.length === 0) return

  bulkBusy.value = true
  try {
    for (const r of rowsToChange) {
      await onTogglePicked(r, next)
    }
  } finally {
    bulkBusy.value = false
  }
}

const selectedTotals = computed(() => ({ products: selectedRows.value.length }))

const columns = [
  { name: 'picked', label: 'Abgeholt', field: 'picked', align: 'center' },
  { name: 'name', label: 'Produkt', field: 'name', align: 'left' },
  { name: 'qty', label: 'Menge', field: 'qty', align: 'right' },
  { name: 'price', label: 'Preis', field: 'price', align: 'right' },
]

function fmtMoney(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(v || 0))
}

function fmtUnitPrice(price: number, unit: string) {
  const n = Number(price || 0)
  if (!n) return 'VB'
  return `${fmtMoney(n)} / ${unit || 'Kg'}`
}

// --- Firestore: Reserviert -> Abgeholt
async function moveReservationToPickup(wurstId: string, uid: string) {
  if (!auth.user) throw new Error('Nicht eingeloggt')

  const rRef = doc(db, 'wuerste', wurstId, 'reservations', uid)
  const pickupsCol = collection(db, 'wuerste', wurstId, 'pickups')
  const pickupRef = doc(pickupsCol)

  await runTransaction(db, async (tx) => {
    const rSnap = await tx.get(rRef)
    if (!rSnap.exists()) throw new Error('Keine aktive Reservierung gefunden.')

    const data = rSnap.data() as any
    const qty = Math.max(0, Number(data.quantity || 0))
    if (qty <= 0) throw new Error('Reservierung ist 0 – nichts abzuholen.')

    tx.set(pickupRef, {
      uid,
      quantity: qty,
      pickedUpAt: serverTimestamp(),
      updatedAt: serverTimestamp(), // ✅ so können wir "letzte 30 Tage" sauber filtern
      pickedUpBy: auth.user!.uid,
      state: 'pickedUp',
    })

    tx.delete(rRef)
  })
}

// --- Firestore: Abgeholt -> Reserviert (Pickup zurücksetzen)
async function movePickupToReservation(wurstId: string, pickupId: string) {
  const pickupRef = doc(db, 'wuerste', wurstId, 'pickups', pickupId)

  await runTransaction(db, async (tx) => {
    const pSnap = await tx.get(pickupRef)
    if (!pSnap.exists()) throw new Error('Pickup nicht gefunden.')

    const data = pSnap.data() as any
    const uid = String(data.uid || '')
    const qty = Math.max(0, Number(data.quantity || 0))
    if (!uid) throw new Error('Pickup hat keine UID.')
    if (qty <= 0) throw new Error('Pickup ist 0 – kann nicht zurücksetzen.')

    const rRef = doc(db, 'wuerste', wurstId, 'reservations', uid)

    tx.set(
      rRef,
      {
        uid,
        quantity: qty,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    tx.delete(pickupRef)
  })
}

async function onTogglePicked(row: SelectedRow, next: boolean) {
  if (!!row.picked === !!next) return

  if (row.kind === 'reservation' && next === true) {
    setBusy(row.id, true)
    try {
      await moveReservationToPickup(row.wurstId, row.uid)
      $q.notify({ type: 'positive', message: 'Als abgeholt gespeichert.' })
    } catch (e: any) {
      console.error(e)
      $q.notify({ type: 'negative', message: e?.message || 'Aktion fehlgeschlagen' })
    } finally {
      setBusy(row.id, false)
    }
    return
  }

  if (row.kind === 'pickup' && next === false) {
    if (!row.pickupId) return
    setBusy(row.id, true)
    try {
      await movePickupToReservation(row.wurstId, row.pickupId)
      $q.notify({ type: 'warning', message: 'Wieder als reserviert gesetzt.' })
    } catch (e: any) {
      console.error(e)
      $q.notify({ type: 'negative', message: e?.message || 'Undo fehlgeschlagen' })
    } finally {
      setBusy(row.id, false)
    }
    return
  }
}

// Start/Stop watcher nur wenn Dialog offen
function start() {
  if (unsubAll) return

  const unsubs: Array<() => void> = []

  const resMap = new Map<string, FlatRow>()
  const pickMap = new Map<string, FlatRow>()

  function emitMerged() {
    const merged = new Map<string, FlatRow>()
    for (const [k, v] of resMap.entries()) merged.set(k, v)
    for (const [k, v] of pickMap.entries()) merged.set(k, v) // pickup überschreibt reservation
    allRows.value = [...merged.values()]

    if (selectedUid.value && !allRows.value.some((r) => r.uid === selectedUid.value)) {
      selectedUid.value = null
    }
  }

  for (const w of store.items) {
    const wurstId = (w as any).id
    if (!wurstId) continue

    // reservations
    const u1 = onSnapshot(collection(db, 'wuerste', wurstId, 'reservations'), (snap) => {
      for (const key of [...resMap.keys()]) {
        if (key.startsWith(wurstId + ':')) resMap.delete(key)
      }

      for (const d of snap.docs) {
        const data = d.data() as any
        const uid = String(data?.uid || d.id)
        const qty = Math.max(0, Number(data?.quantity || 0))
        if (!uid || qty <= 0) continue

        const key = `${wurstId}:${uid}`
        resMap.set(key, {
          id: `res:${wurstId}:${uid}`,
          kind: 'reservation',
          uid,
          wurstId,
          quantity: qty,
        })
      }

      emitMerged()
    })
    unsubs.push(u1)

    // pickups: ohne where (keine Index-Probleme), Filter clientseitig + letzte 30 Tage
    const qPick = query(collection(db, 'wuerste', wurstId, 'pickups'), orderBy('pickedUpAt', 'desc'))

    const u2 = onSnapshot(qPick, (snap) => {
      for (const key of [...pickMap.keys()]) {
        if (key.startsWith(wurstId + ':')) pickMap.delete(key)
      }

      const seen = new Set<string>()
      const cutoff = Date.now() - KEEP_MS

      for (const d of snap.docs) {
        const data = d.data() as any
        const uid = String(data?.uid || '')
        const qty = Math.max(0, Number(data?.quantity || 0))
        const state = String(data?.state || 'pickedUp')
        if (!uid || qty <= 0) continue
        if (state !== 'pickedUp') continue

        const ms = tsToMillis(data?.updatedAt ?? data?.pickedUpAt)
        if (!ms || ms < cutoff) continue

        const key = `${wurstId}:${uid}`
        if (seen.has(key)) continue
        seen.add(key)

        pickMap.set(key, {
          id: `pick:${wurstId}:${d.id}`,
          kind: 'pickup',
          pickupId: d.id,
          uid,
          wurstId,
          quantity: qty,
          updatedAtMs: ms,
        })
      }

      emitMerged()
    })
    unsubs.push(u2)
  }

  unsubAll = () => {
    for (const u of unsubs) u()
  }
}

function stop() {
  unsubAll?.()
  unsubAll = null
  allRows.value = []
  selectedUid.value = null
  search.value = ''
  busyMap.value = {}
  bulkBusy.value = false
}

watch(open, (v) => {
  if (v) start()
  else stop()
})

onUnmounted(() => stop())
</script>

<style scoped>
.orders-card {
  width: 94vw;
  max-width: 980px;
  border-radius: 18px;
  overflow: hidden;

  max-height: 88vh;
  display: flex;
  flex-direction: column;

  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.orders-head {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(6px);
}

.orders-search :deep(.q-field__control) {
  border-radius: 14px;
}

.orders-split {
  height: 68vh;
}

.pane {
  padding: 10px;
}

.orders-list {
  border-radius: 14px;
  overflow: hidden;
}

.orders-active {
  background: rgba(255, 255, 255, 0.92) !important;
  color: #141414 !important;
}

.orders-table {
  border-radius: 14px;
  overflow: hidden;
}

.orders-mobile {
  height: 72vh;
  overflow: auto;
}

.prod-thumb {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.3);
}

.thumb-fallback {
  height: 100%;
  width: 100%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.08);
}

.opacity-75 {
  opacity: 0.75;
}
.opacity-70 {
  opacity: 0.7;
}

.picked-row {
  opacity: 0.55;
}
</style>
