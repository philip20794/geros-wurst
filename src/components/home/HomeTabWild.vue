<template>
  <div>
    <div class="row items-center q-mb-md">
      <div class="row items-center full-width">
        <template v-if="auth.meta?.role === 'admin'">
          <div class="row items-center full-width justify-between">
            <q-btn
              no-caps
              color="primary"
              icon="add"
              rounded
              @click="openCreate = true"
            />
            <q-btn
              color="primary"
              no-caps
              rounded
              icon="receipt_long"
              @click="openOrders = true"
            />
            <q-btn
              color="primary"
              no-caps
              rounded
              icon="share"
              @click="onShareAppClick"
            />
          </div>
        </template>

        <MyWurstOverviewButtons v-else-if="auth.meta?.role === 'user'" />
      </div>
    </div>


    <div class="row q-col-gutter-lg">
      <q-virtual-scroll :items="store.items" v-slot="{item: w}" :virtual-scroll-item-size="444" class="col-12 col-md-6 col-lg-4">
        <WurstVisibilityWrap :wurst="w">
          <WurstCard :wurst="w" @edit="onEdit" @delete="adminDelete" @push="sendPushReminder" @open-full="openFull(w.imageUrl, w.name)" />
        </WurstVisibilityWrap>
        <div style="height: 24px;"/>
      </q-virtual-scroll>
      <div v-for="w in store.items" :key="w.id" >
        
      </div>
    </div>

    <NoWurstPlaceholder v-if="store.hydrated && !store.loading && store.items.length === 0" />


    <!-- Full Screen-->
    <q-dialog v-model="showFull" maximized>
      <q-card class="bg-black">
        <q-bar class="bg-black text-white">
          <div class="text-subtitle2 ellipsis">{{ fullTitle }}</div>
          <q-space />
          <q-btn no-caps dense flat round icon="close" v-close-popup />
        </q-bar>
        <q-card-section class="q-pa-none">
          <q-img
            v-if="fullSrc"
            :src="fullSrc"
            fit="contain"
            style="height: calc(100vh - 42px);"
            img-class="bg-black"
          />
        </q-card-section>
      </q-card>
    </q-dialog>

    <template v-if="auth.meta?.role === 'admin'">
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

      <AdminOrdersDialog v-model="openOrders" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useWurstStore, type Wurst } from '@/stores/wurst'
import WurstCard from '@/components/wurst/WurstCard.vue'
import NoWurstPlaceholder from '@/components/NoWurstPlaceholder.vue'
import { openEnablePushDialog } from '@/services/pushEnable'
import { sendPushToAllUsers } from '@/services/pushSend'
import WurstDialog from '../wurst/WurstDialog.vue'
import MyWurstOverviewButtons from '../MyWurstOverviewButtons.vue'
import WurstVisibilityWrap from '../wurst/WurstVisibilityWrap.vue'
import AdminOrdersDialog from '../admin/AdminOrdersDialog.vue'

defineOptions({ name: 'HomeTabWild' })
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

const showFull = ref(false)
const fullSrc = ref<string | null>(null)
const fullTitle = ref('')

const openOrders = ref(false)

function onEdit(w: Wurst) {
  editing.value = w
  openEdit.value = true
}

const canRead = computed(
  () => !!auth.user && (auth.meta?.role === 'admin' || auth.meta?.status === 'approved'),
)

function openFull(src: string, title: string) {
  fullSrc.value = src
  fullTitle.value = title
  showFull.value = true
}

async function handleUpsert(e: { mode: 'create' | 'edit'; id?: string; payload: any }) {
  if (e.mode === 'create') {
    creating.value = true
    createProgress.value = 0
    try {
      await store.createWurst({
        name: e.payload.name,
        category: e.payload.category, // ✅ neu
        sausagesPerPack: e.payload.sausagesPerPack,
        totalPacks: e.payload.totalPacks,
        pricePerPack: e.payload.pricePerPack,
        file: e.payload.file ?? null,
        unit: e.payload.unit ?? 'Kg',
        onProgress: (pct: number) => (createProgress.value = pct),
      })

      await sendPushToAllUsers({
        body: `Neues Produkt verfügbar! ${e.payload.name}`, // optional
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
      category: e.payload.category, // ✅ neu
      sausagesPerPack: e.payload.sausagesPerPack,
      totalPacks: e.payload.totalPacks,
      unit: e.payload.unit ?? 'Kg',
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

    $q.notify({ type: 'positive', message: 'Gespeichert' })
    openEdit.value = false
  } catch (err: any) {
    console.error(err)
    $q.notify({ type: 'negative', message: err?.message || 'Speichern fehlgeschlagen' })
  } finally {
    saving.value = false
    editProgress.value = 0
  }
}


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
  const verfuegbar = w.totalPacks + w.reservedPacks
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
  console.log('mount')
  if (!canRead.value) return

  refreshPermission()
  if (!('Notification' in window)) return
  if (Notification.permission !== 'default') return
  if (!shouldAskForPush()) return

  openEnablePushDialog($q)
})
</script>
