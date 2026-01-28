<template>
  <div>
    <div class="row items-center justify-between q-mb-md">
      <div class="row items-center">
        <q-btn
          v-if="auth.meta?.role === 'admin'"
          no-caps
          color="primary"
          icon="add"
          label="Neue Wurst"
          @click="openCreate = true"
        />
        <q-btn
          v-if="auth.meta?.role === 'admin'"
          class="q-ml-sm"
          color="primary"
          no-caps
          icon="share"
          label="App teilen"
          @click="onShareAppClick"
        />
      </div>
    </div>

    <div class="row q-col-gutter-lg">
      <div v-for="w in store.items" :key="w.id" class="col-12 col-md-6 col-lg-4">
        <WurstCard :wurst="w" @edit="onEdit" @delete="adminDelete" @push="sendPushReminder" />
      </div>
    </div>

    <NoWurstPlaceholder v-if="store.items.length === 0" />

    <!-- Create -->
    <WurstDialog
      v-model="openCreate"
      mode="create"
      :busy="creating"
      :progress="createProgress"
      @submit="handleUpsert"
    />

    <!-- Edit -->
    <WurstDialog
      v-model="openEdit"
      mode="edit"
      :entity="editing"
      :busy="saving"
      :progress="editProgress"
      @submit="handleUpsert"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useWurstStore, type Wurst } from '@/stores/wurst'
import WurstCard from '@/components/wurst/WurstCard.vue'
import NoWurstPlaceholder from '@/components/NoWurstPlaceholder.vue'
import { openEnablePushDialog } from '@/services/pushEnable'
import { sendPushToAllUsers } from '@/services/pushSend'
import WurstDialog from '../wurst/WurstDialog.vue'

const auth = useAuthStore()
const store = useWurstStore()
const router = useRouter()
const $q = useQuasar()

const openCreate = ref(false)
const creating = ref(false)
const createProgress = ref(0)

const openEdit = ref(false)
const editing = ref<Wurst | null>(null)
const saving = ref(false)
const editProgress = ref(0)

function onEdit(w: Wurst) {
  editing.value = w
  openEdit.value = true
}

const canRead = computed(
  () => !!auth.user && (auth.meta?.role === 'admin' || auth.meta?.status === 'approved'),
)

async function handleUpsert(e: { mode: 'create' | 'edit'; id?: string; payload: any }) {
  if (e.mode === 'create') {
    creating.value = true
    createProgress.value = 0
    try {
      await store.createWurst({
        name: e.payload.name,
        sausagesPerPack: e.payload.sausagesPerPack,
        totalPacks: e.payload.totalPacks,
        pricePerPack: e.payload.pricePerPack,
        file: e.payload.file ?? null,
        onProgress: (pct: number) => (createProgress.value = pct),
      })
      await sendPushToAllUsers({
        body: `Neue Wurst verfügbar! ${e.payload.name}`,
        url: '/',
      })
      $q.notify({ type: 'positive', message: 'Benachrichtigung gesendet' })
      openCreate.value = false
    } catch (err: any) {
      console.error(err)
      $q.notify({ type: 'negative', message: err?.message || 'Fehlgeschlagen' })
    } finally {
      creating.value = false
      createProgress.value = 0
    }
    return
  }

  // edit
  if (!e.id) return
  saving.value = true
  editProgress.value = 0
  try {
    await store.updateWurst(e.id, {
      name: e.payload.name,
      sausagesPerPack: e.payload.sausagesPerPack,
      totalPacks: e.payload.totalPacks,
      pricePerPack: e.payload.pricePerPack,
    })

    if (e.payload.file) {
      await store.updateWurstImage({
        id: e.id,
        file: e.payload.file,
        currentImagePath: editing.value?.imagePath,
        onProgress: (pct: number) => (editProgress.value = pct),
      })
    }

    $q.notify({ type: 'positive', message: 'Wurst gespeichert ✅' })
    openEdit.value = false
  } catch (err: any) {
    console.error(err)
    $q.notify({ type: 'negative', message: err?.message || 'Speichern fehlgeschlagen' })
  } finally {
    saving.value = false
    editProgress.value = 0
  }
}

watch(
  canRead,
  (ok) => {
    if (ok) store.watchAll()
    else store.stop()
  },
  { immediate: true },
)

onUnmounted(() => store.stop())

async function adminDelete(w: Wurst) {
  $q.dialog({
    class: 'dialog-wood',
    title: 'Löschen?',
    message: `${w.name} wirklich löschen?`,
    ok: { color: 'negative', label: 'Löschen' },
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    await store.deleteWurst(w.id, w.imagePath)
    $q.notify({ type: 'negative', message: 'Gelöscht' })
  })
}

async function onShareAppClick() {
  const url = 'https://geros-wild.web.app/'
  const shareData = {
    title: 'Geros Wild',
    text: 'Hier kannst du Würste von Gero reservieren:',
    url,
  }

  try {
    if (navigator.share) {
      await navigator.share(shareData)
      return
    }
    await navigator.clipboard.writeText(url)
    $q.notify({ type: 'positive', message: 'Link kopiert ✅' })
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    console.error(e)
    $q.notify({ type: 'negative', message: 'Teilen fehlgeschlagen' })
  }
}

async function sendPushReminder(w: Wurst) {
  const verfuegbar = w.totalPacks + w.reservedPacks;
  try {
    await sendPushToAllUsers({
      body: `${w.name} noch ${verfuegbar} Packungen verfügbar.`,
      url: '/',
    })
    $q.notify({ type: 'positive', message: 'Benachrichtigung gesendet' })
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Senden fehlgeschlagen' })
  }
}

/* --- Push/Install Auto-Ask (wie bei dir) --- */
const permission = ref<NotificationPermission>('default')

function refreshPermission() {
  if (!('Notification' in window)) return
  permission.value = Notification.permission
}

function shouldAskForPush() {
  const until = Number(localStorage.getItem('push_ask_until') || '0')
  return Date.now() > until
}

onMounted(() => {
  // optional: nur fragen, wenn man wirklich Inhalte sehen darf
  if (!canRead.value) return

  // Push Ask (nur wenn default)
  refreshPermission()
  if (!('Notification' in window)) return
  if (Notification.permission !== 'default') return
  if (!shouldAskForPush()) return

  openEnablePushDialog($q)
})
</script>
