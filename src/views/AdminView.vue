<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5">Benutzerverwaltung</div>
      <div class="row q-gutter-sm">
        <q-btn
          no-caps
          dense
          outline
          icon="refresh"
          label="Aktualisieren"
          @click="loadPending(), loadUsers()"
        />
      </div>
    </div>

    <q-card flat class="card-wood q-mb-xl">
      <q-tabs v-model="tab" class="tabs-wood" active-color="accent" indicator-color="accent" dense>
        <q-tab name="pending" icon="hourglass_top" label="Ausstehend" />
        <q-tab name="all" icon="group" label="Alle Benutzer" />
      </q-tabs>
      <q-separator />

      <!-- Pending Table -->
      <q-card-section v-show="tab === 'pending'" class="q-pa-none">
        <q-table
          class="wood-surface table-fixed"
          :rows="rowsPending"
          :columns="colsPending"
          row-key="uid"
          :filter="filterPending"
          :loading="loadingPending"
          flat
          dense
          wrap-cells
          separator="horizontal"
          no-data-label="Keine offenen Anfragen"
          hide-bottom
        >
          <template #top-right>
            <q-input dense outlined v-model="filterPending" placeholder="Suchen…" clearable>
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </template>

          <template #body-cell-name="p">
            <q-td :props="p">
              <div class="row items-center q-gutter-sm no-wrap-on-wide">
                <q-avatar size="28px" color="primary" text-color="white">
                  {{ (p.row.name || p.row.email || 'U').charAt(0).toUpperCase() }}
                </q-avatar>

                <div class="col">
                  <div class="row items-center justify-between q-gutter-xs wrap-on-narrow">
                    <div class="text-weight-medium ellipsis">{{ p.row.name }}</div>
                    <!-- Status-Chip in der Name-Zelle -->
                    <q-chip
                      square dense
                      :color="statusColor(p.row.status)"
                      text-color="white"
                      class="shrink-0"
                    >
                      {{ p.row.status }}
                    </q-chip>
                  </div>
                  <div class="text-grey-7 text-caption break-anywhere">{{ p.row.email }}</div>
                </div>
              </div>
            </q-td>
          </template>

          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <div class="row items-center justify-end q-gutter-xs buttons-responsive">
                <q-btn
                  no-caps
                  dense
                  color="positive"
                  icon="check"
                  label="Akzeptieren"
                  @click="approve(p.row.uid)"
                />
                <q-btn
                  no-caps
                  dense
                  color="negative"
                  icon="block"
                  label="Ablehnen"
                  @click="block(p.row.uid)"
                />
              </div>
            </q-td>
          </template>

          <template #loading>
            <q-inner-loading showing><q-spinner size="40px" /></q-inner-loading>
          </template>
        </q-table>

        <q-banner v-if="errorPending" class="bg-negative text-white">
          <q-icon name="error" class="q-mr-sm" /> {{ errorPending }}
        </q-banner>
      </q-card-section>

      <!-- All Users Table (immer Tabellenansicht) -->
      <q-card-section v-show="tab === 'all'" class="q-pa-none">
        <q-table
          class="wood-surface table-fixed"
          :rows="rowsUsers"
          :columns="colsAll"
          row-key="uid"
          :filter="filterUsers"
          :loading="loadingUsers"
          flat
          dense
          wrap-cells
          separator="horizontal"
          no-data-label="Keine Benutzer gefunden"
          dark
        >
          <!-- 🔎 Filter oben rechts -->
          <template #top-right>
            <q-input dense outlined v-model="filterUsers" placeholder="Suchen…" clearable>
              <template #prepend><q-icon name="search" /></template>
            </q-input>
          </template>

          <!-- 🧍 Name + Avatar + Status (Chip in derselben Zelle) -->
          <template #body-cell-name="p">
            <q-td :props="p">
              <div class="row items-center q-gutter-sm no-wrap-on-wide">
                <q-avatar size="28px" color="primary" text-color="white">
                  {{ (p.row.name || p.row.email || 'U').charAt(0).toUpperCase() }}
                </q-avatar>

                <div class="col">
                  <div class="row items-center justify-between q-gutter-xs wrap-on-narrow">
                    <div class="text-weight-medium ellipsis">{{ p.row.name }}</div>
                    <q-chip
                      square dense
                      :color="statusColor(p.row.status)"
                      text-color="white"
                      class="shrink-0"
                    >
                      {{ p.row.status }}
                    </q-chip>
                  </div>
                  <div class="text-grey-7 text-caption break-anywhere">{{ p.row.email }}</div>
                </div>
              </div>
            </q-td>
          </template>

          <!-- ⚙️ Aktionen -->
          <template #body-cell-actions="p">
            <q-td :props="p" class="text-right">
              <div class="row justify-end q-gutter-xs flex-wrap">
                <q-btn
                  no-caps
                  dense
                  :color="p.row.status === 'approved' ? 'negative' : 'positive'"
                  :icon="p.row.status === 'approved' ? 'block' : 'check'"
                  :label="p.row.status === 'approved' ? 'Sperren' : 'Freigeben'"
                  @click="toggleUser(p.row)"
                />
              </div>
            </q-td>
          </template>

          <!-- 🌀 Loading Spinner -->
          <template #loading>
            <q-inner-loading showing><q-spinner size="40px" /></q-inner-loading>
          </template>
        </q-table>

        <q-banner v-if="errorUsers" class="bg-negative text-white">
          <q-icon name="error" class="q-mr-sm" /> {{ errorUsers }}
        </q-banner>
      </q-card-section>
    </q-card>

    <q-btn color="primary" no-caps class="absolute-bottom" to="/">Zurück</q-btn>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAuthStore, type UserMeta } from '@/stores/auth'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const auth = useAuthStore()

const tab = ref<'pending' | 'all'>('pending')

const pending = ref<UserMeta[]>([])
const users = ref<UserMeta[]>([])
const loadingPending = ref(true)
const loadingUsers = ref(false)
const errorPending = ref<string | null>(null)
const errorUsers = ref<string | null>(null)
const filterPending = ref('')
const filterUsers = ref('')

async function loadPending() {
  loadingPending.value = true
  errorPending.value = null
  try {
    pending.value = await auth.listPendingUsers()
  } catch (e: any) {
    errorPending.value = e?.message ?? 'Fehler beim Laden (Pending)'
  } finally {
    loadingPending.value = false
  }
}
async function loadUsers() {
  loadingUsers.value = true
  errorUsers.value = null
  try {
    users.value = await auth.listAllUsers()
  } catch (e: any) {
    errorUsers.value = e?.message ?? 'Fehler beim Laden (Alle Benutzer)'
  } finally {
    loadingUsers.value = false
  }
}

onMounted(async () => {
  await loadPending()
  await loadUsers()
})

async function approve(uid: string) {
  await auth.approveUser(uid, auth.user!.uid)
  $q.notify({ type: 'positive', message: 'Benutzer freigegeben' })
  await Promise.all([loadPending(), loadUsers()])
}
async function block(uid: string) {
  $q.dialog({
    class: 'dialog-wood',
    title: 'Sperren',
    message: 'Diese Anmeldung ablehnen und Benutzer sperren?',
    cancel: true,
    ok: { color: 'negative', label: 'Sperren' },
    persistent: true,
  }).onOk(async () => {
    await auth.blockUser(uid, auth.user!.uid)
    $q.notify({ type: 'negative', message: 'Benutzer gesperrt' })
    await Promise.all([loadPending(), loadUsers()])
  })
}

// 🔁 Status-Farbe
function statusColor(s: UserMeta['status']) {
  return s === 'approved' ? 'positive' : s === 'blocked' ? 'negative' : 'warning'
}
async function toggleUser(u: UserMeta) {
  const next = u.status === 'approved' ? 'blocked' : 'approved'
  const label = next === 'blocked' ? 'Sperren' : 'Freigeben'
  $q.dialog({
    class: 'dialog-wood',
    title: label,
    message: `Benutzer „${u.displayName || u.email || u.uid}“ ${label.toLowerCase()}?`,
    cancel: true,
    ok: { color: next === 'blocked' ? 'negative' : 'positive', label },
    persistent: true,
  }).onOk(async () => {
    await auth.setUserStatus(u.uid, next, auth.user!.uid)
    $q.notify({ type: next === 'blocked' ? 'negative' : 'positive', message: `Status: ${next}` })
    await loadUsers()
  })
}

const rowsPending = computed(() =>
  pending.value.map((u) => ({
    ...u,
    name: u.displayName || 'Unbekannt',
    email: u.email || '—',
  })),
)
const rowsUsers = computed(() =>
  users.value.map((u) => ({
    ...u,
    name: u.displayName || 'Unbekannt',
    email: u.email || '—',
  })),
)

// 📋 Spalten: Status-Spalte entfällt bei "Alle Benutzer"; Status-Chip kommt in die Name-Zelle
const colsCommon = [
  { name: 'name',  label: 'Name',   field: 'name',  align: 'left',  sortable: true },
]
const colsPending = [
  ...colsCommon,
  { name: 'actions', label: 'Aktionen', field: 'actions', align: 'right' },
]
const colsAll = [
  ...colsCommon,
  { name: 'actions', label: 'Aktionen', field: 'actions', align: 'right' },
]
</script>



<style scoped>
/* Buttons in Actions-Zelle: bei wenig Platz umbrechen */
.buttons-responsive {
  flex-wrap: wrap;
}
.buttons-responsive .q-btn {
  flex: 1 1 auto;
  min-width: 120px;
}

/* Immer Tabellenlayout ohne horizontales Scrollen */
.table-fixed {
  overflow-x: hidden;
}
/* Fixed-Layout verteilt Spalten und verhindert Overflow.
   In Kombination mit wrap-cells können Inhalte umbrechen. */
.table-fixed .q-table__middle table {
  table-layout: fixed;
}

/* Langes Zeug darf umbrechen */
.break-anywhere {
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Auf schmalen Screens dürfen Name + Chip umbrechen */
.wrap-on-narrow {
  flex-wrap: wrap;
}

/* Auf breiten Screens Name/Chip eher in einer Zeile halten */
@media (min-width: 768px) {
  .no-wrap-on-wide { flex-wrap: nowrap; }
  .ellipsis { max-width: 100%; }
}

/* Optik */
.rounded-borders { border-radius: 8px; }
</style>
