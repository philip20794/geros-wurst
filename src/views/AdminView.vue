<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAuthStore, type UserMeta } from '@/stores/auth'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const auth = useAuthStore()

const pending = ref<UserMeta[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref('')

async function load () {
  loading.value = true; error.value = null
  try {
    pending.value = await auth.listPendingUsers()
  } catch (e: any) {
    error.value = e?.message ?? 'Fehler beim Laden'
  } finally {
    loading.value = false
  }
}

async function approve (uid: string) {
  $q.dialog({
    title: 'Bestätigen',
    message: 'Diesen Benutzer freigeben?',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    await auth.approveUser(uid, auth.user!.uid)
    $q.notify({ type: 'positive', message: 'Benutzer freigegeben' })
    await load()
  })
}

async function block (uid: string) {
  $q.dialog({
    title: 'Sperren',
    message: 'Diese Anmeldung ablehnen und Benutzer sperren?',
    cancel: true,
    ok: { color: 'negative', label: 'Sperren' },
    persistent: true
  }).onOk(async () => {
    await auth.blockUser(uid, auth.user!.uid)
    $q.notify({ type: 'negative', message: 'Benutzer gesperrt' })
    await load()
  })
}

const rows = computed(() =>
  pending.value.map(u => ({
    ...u,
    name: u.displayName || 'Unbekannt',
    email: u.email || '—'
  }))
)

const columns = [
  { name: 'name',  label: 'Name',  field: 'name',  align: 'left', sortable: true },
  { name: 'email', label: 'E-Mail', field: 'email', align: 'left', sortable: true },
  { name: 'actions', label: 'Aktionen', field: 'actions', align: 'right' }
]

onMounted(load)
</script>

<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5">Admin – Ausstehende Anmeldungen</div>
      <div class="row items-center q-gutter-sm">
        <q-input
          dense outlined clearable
          v-model="filter"
          placeholder="Suchen…"
          debounce="200"
          style="min-width: 220px"
          prefix-icon="search"
        >
          <template #append><q-icon name="search" /></template>
        </q-input>
        <q-btn dense outline icon="refresh" @click="load" label="Aktualisieren" />
      </div>
    </div>

    <q-card flat bordered>
      <q-card-section class="q-pa-none">
        <q-table
          :rows="rows"
          :columns="columns"
          row-key="uid"
          :filter="filter"
          :loading="loading"
          flat
          separator="horizontal"
          no-data-label="Keine offenen Anfragen"
        >
          <template #body-cell-name="props">
            <q-td :props="props">
              <div class="row items-center q-gutter-sm">
                <q-avatar size="28px" color="primary" text-color="white">
                  {{ (props.row.name || props.row.email || 'U').charAt(0).toUpperCase() }}
                </q-avatar>
                <div>
                  <div class="text-weight-medium">{{ props.row.name }}</div>
                  <div class="text-grey-7 text-caption">{{ props.row.email }}</div>
                </div>
              </div>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props" class="text-right">
              <q-btn
                dense color="positive" icon="check" label="Akzeptieren"
                class="q-mr-sm" @click="approve(props.row.uid)"
              />
              <q-btn
                dense color="negative" icon="block" label="Ablehnen"
                @click="block(props.row.uid)"
              />
            </q-td>
          </template>

          <template #loading>
            <q-inner-loading showing>
              <q-spinner size="40px" />
            </q-inner-loading>
          </template>
        </q-table>
      </q-card-section>

      <q-banner v-if="error" class="bg-negative text-white">
        <q-icon name="error" class="q-mr-sm" /> {{ error }}
      </q-banner>

      <q-banner v-else-if="!loading && rows.length === 0" class="bg-grey-2">
        <q-icon name="celebration" class="q-mr-sm" />
        Keine offenen Anfragen 🎉
      </q-banner>
    </q-card>
  </q-page>
</template>
