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

async function load() {
  loading.value = true
  error.value = null
  try {
    pending.value = await auth.listPendingUsers()
  } catch (e: any) {
    error.value = e?.message ?? 'Fehler beim Laden'
  } finally {
    loading.value = false
  }
}

async function approve(uid: string) {
    await auth.approveUser(uid, auth.user!.uid)
    $q.notify({ type: 'positive', message: 'Benutzer freigegeben' })
    await load()
}

async function block(uid: string) {
  $q.dialog({
    class: "dialog-wood",
    title: 'Sperren',
    message: 'Diese Anmeldung ablehnen und Benutzer sperren?',
    cancel: true,
    ok: { color: 'negative', label: 'Sperren' },
    persistent: true,
  }).onOk(async () => {
    await auth.blockUser(uid, auth.user!.uid)
    $q.notify({ type: 'negative', message: 'Benutzer gesperrt' })
    await load()
  })
}

const rows = computed(() =>
  pending.value.map((u) => ({
    ...u,
    name: u.displayName || 'Unbekannt',
    email: u.email || '—',
  })),
)

const columns = [
  { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
  { name: 'email', label: 'E-Mail', field: 'email', align: 'left', sortable: true },
  { name: 'actions', label: 'Aktionen', field: 'actions', align: 'right' },
]

onMounted(load)
</script>

<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5">Admin – Ausstehende Anmeldungen</div>
      <div class="row items-center q-gutter-sm">
        <q-btn no-caps dense outline icon="refresh" @click="load" label="Aktualisieren" />
      </div>
    </div>

    <q-card flat class="card-wood">
      <q-card-section class="q-pa-none">
        <q-table
          class="wood-surface"
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
                no-caps
                dense
                color="positive"
                icon="check"
                label="Akzeptieren"
                class="q-mr-sm"
                @click="approve(props.row.uid)"
              />
              <q-btn
                no-caps
                dense
                color="negative"
                icon="block"
                label="Ablehnen"
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
    </q-card>
    <q-btn color="primary" no-caps class="absolute-bottom" to="/">Zurück</q-btn>
  </q-page>
</template>
