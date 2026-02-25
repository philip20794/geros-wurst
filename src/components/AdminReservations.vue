<template>
  <q-expansion-item v-model="opened" icon="list" label="Reservierungen anzeigen" dense class="wood-surface">
    <template v-if="opened">
      <!-- Header: responsive -->
      <div class="ar-head" :class="{ 'is-mobile': isMobile }">
        <q-tabs v-model="tab" dense inline-label class="ar-tabs">
          <q-tab name="open" icon="schedule" label="Reserviert" no-caps />
          <q-tab name="picked" icon="done_all" label="Abgeholt" no-caps />
        </q-tabs>
      </div>

      <q-separator />

      <!-- ✅ Mobile: LIST view -->
      <div v-if="isMobile" class="q-px-md q-pt-sm">
        <q-list bordered separator class="rounded-borders">
          <q-item v-if="tableRows.length === 0">
            <q-item-section class="text-caption opacity-75"> Keine Einträge </q-item-section>
          </q-item>

          <q-item v-for="row in tableRows" :key="row.id" class="q-py-sm">
            <q-item-section>
              <div class="row items-center no-wrap">
                <q-avatar size="26px" color="primary" text-color="white" class="q-mr-sm">
                  {{ (row.displayName || row.email || row.uid || 'U').charAt(0).toUpperCase() }}
                </q-avatar>

                <div class="col">
                  <div class="text-subtitle2 ellipsis" :class="{ 'picked-row': row.picked }">
                    {{ row.displayName || row.email || row.uid }}
                  </div>

                  <div class="text-caption opacity-70">
                    Menge: <b>{{ row.quantity }}</b>
                    <span v-if="showPrices" class="q-ml-sm">· {{ fmt(row.price) }}</span>
                  </div>
                </div>
              </div>
            </q-item-section>

            <q-item-section side>
              <q-checkbox
                dense
                :model-value="!!row.picked"
                :disable="isBusy(row.id)"
                @update:model-value="(v: boolean) => onTogglePicked(row, v)"
              />
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Totals (mobile) -->
        <div class="ar-bottom q-mt-sm">
          <div class="text-caption">
            Offen: <b>{{ totalQtyOpen }}</b>
          </div>
          <div class="text-caption opacity-75">
            Abgeholt: <b>{{ totalQtyPicked }}</b>
          </div>
          <div class="text-caption opacity-75">
            Gesamt: <b>{{ totalQtyAll }}</b>
          </div>

          <div v-if="showPrices" class="text-caption opacity-75">
            · Offen: <b>{{ fmt(totalPriceOpen) }}</b>
          </div>
          <div v-if="showPrices" class="text-caption opacity-75">
            Abgeholt: <b>{{ fmt(totalPricePicked) }}</b>
          </div>
          <div v-if="showPrices" class="text-caption opacity-75">
            Gesamt: <b>{{ fmt(totalPriceAll) }}</b>
          </div>
        </div>
      </div>

      <!-- ✅ Desktop: TABLE view -->
      <div v-else class="ar-table-wrap">
        <q-table
          class="wood-surface q-ma-md"
          :rows="tableRows"
          :columns="columns"
          row-key="id"
          flat
          hide-pagination
          :rows-per-page-options="[0]"
          no-data-label="Keine Einträge"
          dense
        >
          <!-- Abgeholt checkbox -->
          <template #body-cell-picked="p">
            <q-td :props="p">
              <q-checkbox
                dense
                :model-value="!!p.row.picked"
                :disable="isBusy(p.row.id)"
                @update:model-value="(v: boolean) => onTogglePicked(p.row, v)"
              />
            </q-td>
          </template>

          <!-- User cell -->
          <template #body-cell-user="p">
            <q-td :props="p">
              <div class="row items-center q-gutter-sm" :class="{ 'picked-row': p.row.picked }">
                <q-avatar size="20px" color="primary" text-color="white">
                  {{ (p.row.displayName || p.row.email || p.row.uid || 'U').charAt(0).toUpperCase() }}
                </q-avatar>
                <div class="ellipsis">
                  {{ p.row.displayName || p.row.email || p.row.uid }}
                </div>
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
            <div class="ar-bottom">
              <div class="text-caption">
                Offen: <b>{{ totalQtyOpen }}</b>
              </div>
              <div class="text-caption opacity-75">
                Abgeholt: <b>{{ totalQtyPicked }}</b>
              </div>
              <div class="text-caption opacity-75">
                Gesamt: <b>{{ totalQtyAll }}</b>
              </div>

              <div v-if="showPrices" class="text-caption opacity-75">
                · Offen: <b>{{ fmt(totalPriceOpen) }}</b>
              </div>
              <div v-if="showPrices" class="text-caption opacity-75">
                Abgeholt: <b>{{ fmt(totalPricePicked) }}</b>
              </div>
              <div v-if="showPrices" class="text-caption opacity-75">
                Gesamt: <b>{{ fmt(totalPriceAll) }}</b>
              </div>
            </div>
          </template>
        </q-table>
      </div>

      <q-btn
        v-if="tab === 'open'"
        no-caps
        color="primary"
        icon="notifications_active"
        label="Erinnerung an Nicht-Abgeholte"
        :disable="notPickedUids.length === 0 || sending"
        :loading="sending"
        class="q-mx-md q-mb-sm full-width"
        @click="sendReminderToNotPicked"
      />

      <div style="height: 8px" />

      <q-dialog v-model="confirm.open" @hide="onConfirmHide">
        <q-card dark class="confirm-card">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-subtitle1 text-weight-bold">
              {{ confirm.title }}
            </div>
            <q-space />
            <q-btn flat round dense icon="close" @click="confirmCancel" />
          </q-card-section>

          <q-card-section class="text-body2">
            {{ confirm.message }}
          </q-card-section>

          <q-separator dark />

          <q-card-actions align="right" class="q-px-md q-pb-md">
            <q-btn flat no-caps label="Abbrechen" @click="confirmCancel" />
            <q-btn
              unelevated
              no-caps
              :color="confirm.okColor"
              :label="confirm.okLabel"
              @click="confirmOk"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </template>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
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
import { useQuasar } from 'quasar'
import { sendPushToUsers } from '@/services/pushSend'
import { useAuthStore } from '@/stores/auth'
import { useWurstStore } from '@/stores/wurst'

type Props = {
  wurstId: string
  pricePerPack: number
}
const props = defineProps<Props>()

const $q = useQuasar()
const auth = useAuthStore()
const wurstStore = useWurstStore()
const opened = ref(false)

const isMobile = computed(() => $q.screen.lt.md) // ✅ ab md = table

type RowKind = 'reservation' | 'pickup'

type Row = {
  id: string
  kind: RowKind
  uid: string
  quantity: number
  email?: string | null
  displayName?: string | null
  price: number
  picked: boolean
  pickupId?: string
}

type ConfirmState = {
  open: boolean
  title: string
  message: string
  okLabel: string
  okColor: string
  _resolve: null | ((v: boolean) => void)
}

const confirm = ref<ConfirmState>({
  open: false,
  title: '',
  message: '',
  okLabel: 'OK',
  okColor: 'primary',
  _resolve: null,
})

const tab = ref<'open' | 'picked'>('open')
const openRows = ref<Row[]>([])
const pickedRows = ref<Row[]>([])

// Busy state pro row
const busyMap = ref<Record<string, boolean>>({})
function isBusy(id: string) {
  return !!busyMap.value[id]
}
function setBusy(id: string, v: boolean) {
  busyMap.value = { ...busyMap.value, [id]: v }
}

// Cache für Userdaten
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

async function enrichUsers(rows: Row[]) {
  const tasks = rows.map(async (r) => {
    const info = await loadUser(r.uid)
    r.email = info.email
    r.displayName = info.displayName
  })
  await Promise.all(tasks)
}

// Totals
const totalQtyAll = computed(
  () =>
    openRows.value.reduce((a, r) => a + (r.quantity || 0), 0) +
    pickedRows.value.reduce((a, r) => a + (r.quantity || 0), 0),
)
const totalQtyPicked = computed(() => pickedRows.value.reduce((a, r) => a + (r.quantity || 0), 0))
const totalQtyOpen = computed(() => openRows.value.reduce((a, r) => a + (r.quantity || 0), 0))

const totalPriceAll = computed(
  () =>
    openRows.value.reduce((a, r) => a + (r.price || 0), 0) +
    pickedRows.value.reduce((a, r) => a + (r.price || 0), 0),
)
const totalPricePicked = computed(() => pickedRows.value.reduce((a, r) => a + (r.price || 0), 0))
const totalPriceOpen = computed(() => openRows.value.reduce((a, r) => a + (r.price || 0), 0))

const showPrices = false
function fmt(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
    Number(v || 0),
  )
}

// Table rows je Tab
const tableRows = computed(() => {
  const src = tab.value === 'open' ? openRows.value : pickedRows.value
  return [...src].sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
})

const columns = [
  { name: 'picked', label: 'Abgeholt', field: 'picked', align: 'left' },
  { name: 'user', label: 'Name', field: 'displayName', align: 'left' },
  { name: 'quantity', label: 'Menge', field: 'quantity', align: 'right' },
]

// Reminder an Nicht-Abgeholte (nur aktive Reservierungen)
const notPickedUids = computed(() => openRows.value.filter((r) => r.quantity > 0).map((r) => r.uid))

function confirmDialogCard(opts: {
  title: string
  message: string
  okLabel?: string
  okColor?: string
}) {
  // falls ein alter Dialog offen ist: sauber schließen
  if (confirm.value.open && confirm.value._resolve) {
    confirm.value._resolve(false)
  }

  confirm.value.title = opts.title
  confirm.value.message = opts.message
  confirm.value.okLabel = opts.okLabel ?? 'OK'
  confirm.value.okColor = opts.okColor ?? 'primary'
  confirm.value.open = true

  return new Promise<boolean>((resolve) => {
    confirm.value._resolve = resolve
  })
}

function confirmOk() {
  confirm.value.open = false
  confirm.value._resolve?.(true)
  confirm.value._resolve = null
}

function confirmCancel() {
  confirm.value.open = false
  confirm.value._resolve?.(false)
  confirm.value._resolve = null
}

// Falls Dialog irgendwie geschlossen wird (ESC/backdrop o.ä.)
function onConfirmHide() {
  if (confirm.value._resolve) {
    confirm.value._resolve(false)
    confirm.value._resolve = null
  }
}

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

// Reserviert -> Abgeholt
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
      pickedUpBy: auth.user!.uid,
      state: 'pickedUp',
    })

    tx.delete(rRef)
  })
}

async function onTogglePicked(row: Row, next: boolean) {
  if (!!row.picked === !!next) return

  if (row.kind === 'reservation' && next === true) {
    const ok = await confirmDialogCard({
      title: 'Als abgeholt markieren?',
      message: `${row.displayName || row.email || row.uid} hat ${row.quantity} Packung(en) abgeholt.`,
      okLabel: 'Abgeholt',
      okColor: 'positive',
    })
    if (!ok) return

    setBusy(row.id, true)
    try {
      await moveReservationToPickup(props.wurstId, row.uid)
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
    const ok = await confirmDialogCard({
      title: 'Zurück zu reserviert?',
      message: `Abholung zurücksetzen: ${row.displayName || row.email || row.uid} (${row.quantity})`,
      okLabel: 'Zurücksetzen',
      okColor: 'warning',
    })
    if (!ok) return

    setBusy(row.id, true)
    try {
      await wurstStore.undoPickupToReservation(props.wurstId, row.pickupId!)
      $q.notify({ type: 'positive', message: 'Wieder als Reservierung gesetzt.' })
    } catch (e: any) {
      console.error(e)
      $q.notify({ type: 'negative', message: e?.message || 'Undo fehlgeschlagen' })
    } finally {
      setBusy(row.id, false)
    }
    return
  }
}

// Snapshots
let unsubReservations: (() => void) | null = null
let unsubPickups: (() => void) | null = null

function resubscribe() {
  if (unsubReservations) unsubReservations()
  if (unsubPickups) unsubPickups()

  openRows.value = []
  pickedRows.value = []

  // active reservations
  const qRes = query(collection(db, 'wuerste', props.wurstId, 'reservations'))
  unsubReservations = onSnapshot(
    qRes,
    async (snap) => {
      const base: Row[] = snap.docs
        .map((d) => {
          const data = d.data() as any
          const uid = data?.uid || d.id
          const q = Math.max(0, Number(data?.quantity || 0))
          return {
            id: `res:${uid}`,
            kind: 'reservation',
            uid,
            quantity: q,
            price: q * (props.pricePerPack || 0),
            picked: false,
          } as Row
        })
        .filter((r) => r.quantity > 0)

      openRows.value = base
      await enrichUsers(base)
      openRows.value = [...base]
    },
    (err) => {
      $q.notify({
        type: 'negative',
        message: err.message || 'Reservierungen konnten nicht geladen werden.',
      })
    },
  )

  // pickups (clientseitig nur pickedUp anzeigen)
  const qPick = query(
    collection(db, 'wuerste', props.wurstId, 'pickups'),
    orderBy('pickedUpAt', 'desc'),
  )

  unsubPickups = onSnapshot(
    qPick,
    async (snap) => {
      const base: Row[] = snap.docs
        .map((d) => {
          const data = d.data() as any
          const uid = String(data?.uid || '')
          const q = Math.max(0, Number(data?.quantity || 0))
          const state = String(data?.state || 'pickedUp')

          return {
            id: `pick:${d.id}`,
            kind: 'pickup',
            pickupId: d.id,
            uid,
            quantity: q,
            price: q * (props.pricePerPack || 0),
            picked: state === 'pickedUp',
          } as Row
        })
        .filter((r) => r.quantity > 0 && !!r.uid && r.picked)

      pickedRows.value = base
      await enrichUsers(base)
      pickedRows.value = [...base]
    },
    (err) => {
      $q.notify({
        type: 'negative',
        message: err.message || 'Abholungen konnten nicht geladen werden.',
      })
    },
  )
}

onUnmounted(() => {
  if (unsubReservations) unsubReservations()
  if (unsubPickups) unsubPickups()
})

watch(opened, (v) => {
  if (v) resubscribe()
  else {
    unsubReservations?.(); unsubReservations = null
    unsubPickups?.(); unsubPickups = null
  }
})
</script>

<style scoped>
.ar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
  gap: 10px;
}

.ar-head.is-mobile {
  flex-direction: column;
  align-items: stretch;
}

.ar-tabs {
  width: auto;
}

.ar-head.is-mobile .ar-tabs {
  width: 100%;
}

.ar-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ar-head.is-mobile .ar-chips {
  justify-content: flex-start;
  width: 100%;
}

.ar-table-wrap {
  overflow-x: auto; /* fallback falls table mal breiter ist */
}

.ar-bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  justify-content: flex-end;
  padding: 10px 4px 0;
}

.picked-row {
  opacity: 0.45;
}
</style>
