<template>
  <div>
    <div class="row items-center justify-between q-mb-md">
      <q-btn
        v-if="auth.meta?.role === 'admin'"
        color="primary"
        no-caps
        icon="add"
        label="Neue Umfrage"
        @click="openCreate = true"
      />
    </div>

    <div class="row q-col-gutter-lg">
      <div v-for="w in store.items" :key="w.id" class="col-12 col-md-6 col-lg-4">
        <UmfrageCard
          :umfrage="w"
          @push="sendPushReminder"
          @edit="onEdit"
          @delete="onDelete"
          @convert="onConvert"
        />
      </div>
    </div>

    <NoUmfragePlaceholder v-if="store.items.length === 0" />

    <!-- Create Dialog -->
    <UmfrageDialog
      v-model="openCreate"
      :busy="creating"
      mode="create"
      :progress="createProgress"
      @submit="handleUpsert"
    />

    <!-- Convert Dialog -->
    <UmfrageDialog
      v-model="openConvert"
      mode="convert"
      :entity="converting"
      :busy="convertingBusy"
      :progress="convertProgress"
      @convert="doConvert"
    />

    <!-- Edit Dialog -->
    <UmfrageDialog
      v-model="openEdit"
      :entity="editing"
      mode="edit"
      :busy="saving"
      :progress="editProgress"
      @submit="handleUpsert"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useUmfragenStore, type Umfrage } from '@/stores/umfragen'
import UmfrageCard from '@/components/umfragen/UmfrageCard.vue'
import { convertUmfrageToWurst, uploadWurstImage, copyUmfrageImageToWurst } from '@/services/umfrageConvert'
import { sendPushToAllUsers } from '@/services/pushSend'
import UmfrageDialog from '../umfragen/UmfrageDialog.vue'
import { useRouter } from 'vue-router'
import NoUmfragePlaceholder from '../NoUmfragePlaceholder.vue'

defineOptions({ name: 'HomeTabUmfragen' })
const $q = useQuasar()
const auth = useAuthStore()
const store = useUmfragenStore()
const router = useRouter()

// Create
const openCreate = ref(false)
const creating = ref(false)
const createProgress = ref(0)

// Edit
const openEdit = ref(false)
const editing = ref<Umfrage | null>(null)
const saving = ref(false)
const editProgress = ref(0)

// Convert
const openConvert = ref(false)
const converting = ref<Umfrage | null>(null)
const convertingBusy = ref(false)
const convertProgress = ref(0)

const create = reactive({
  name: '',
  category: 'Würstchen', // ✅ neu (optional – nutzt du unten eh kaum)
  sausagesPerPack: 6,
  totalPacks: null as number | null,
  pricePerPack: null as number | null,
  file: null as File | null,
})

function onEdit(w: Umfrage) {
  editing.value = w
  openEdit.value = true
}

function onConvert(w: Umfrage) {
  converting.value = w
  openConvert.value = true
}

// Upsert handler (kommt vom UmfrageDialog)
async function handleUpsert(e: { mode: 'create' | 'edit'; id?: string; payload: any }) {
  if (e.mode === 'create') {
    creating.value = true
    createProgress.value = 0
    try {
      await store.createUmfrage({
        name: e.payload.name,
        category: e.payload.category, // ✅ neu
        sausagesPerPack: e.payload.sausagesPerPack,
        totalPacks: e.payload.totalPacks,
        pricePerPack: e.payload.pricePerPack,
        file: e.payload.file,
        onProgress: (pct: number) => (createProgress.value = pct),
      })

      // optional Push nach erfolgreichem Create
      try {
        await sendPushToAllUsers({
          body: 'Neue Umfrage: ' + e.payload.name,
          url: '/umfragen',
        })
      } catch (err) {
        console.error(err)
      }

      $q.notify({ type: 'positive', message: 'Umfrage angelegt ✅' })
      openCreate.value = false
    } catch (e: any) {
      console.error(e)
      $q.notify({ type: 'negative', message: e?.message || 'Fehlgeschlagen' })
    } finally {
      creating.value = false
      createProgress.value = 0
    }
    return
  }

  // EDIT
  if (!editing.value) return

  saving.value = true
  editProgress.value = 0
  try {
    await store.updateUmfrage(editing.value.id, {
      name: e.payload.name,
      category: e.payload.category, // ✅ neu
      sausagesPerPack: e.payload.sausagesPerPack,
      totalPacks: e.payload.totalPacks,
      pricePerPack: e.payload.pricePerPack,
    })

    if (e.payload.file) {
      await store.updateUmfrageImage({
        id: editing.value.id,
        file: e.payload.file,
        currentImagePath: editing.value.imagePath,
        onProgress: (pct: number) => (editProgress.value = pct),
      })
    }

    await sendPushToAll()

    $q.notify({ type: 'positive', message: 'Umfrage gespeichert' })
    openEdit.value = false
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Speichern fehlgeschlagen' })
  } finally {
    saving.value = false
    editProgress.value = 0
  }
}

async function sendPushReminder(w: Umfrage) {
  try {
    await sendPushToAllUsers({
      body: 'Erinnerung: ' + w.name,
      url: '/umfragen',
    })
    $q.notify({ type: 'positive', message: 'Benachrichtigung gesendet ✅' })
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Senden fehlgeschlagen' })
  }
}

async function sendPushToAll() {
  try {
    await sendPushToAllUsers({
      body: 'Neue Umfrage: ' + create.name,
      url: '/umfragen',
    })
    $q.notify({ type: 'positive', message: 'Benachrichtigung gesendet' })
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Senden fehlgeschlagen' })
  }
}

function onDelete(w: Umfrage) {
  $q.dialog({
    class: 'dialog-wood',
    title: 'Löschen?',
    message: `${w.name} wirklich löschen?`,
    ok: { color: 'negative', label: 'Löschen' },
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    await store.deleteUmfrage(w.id, w.imagePath)
    $q.notify({ type: 'negative', message: 'Gelöscht' })
  })
}

async function doConvert(e: {
  id: string
  payload: {
    name?: string
    category: string // ✅ neu
    sausagesPerPack: number
    totalPacks: number
    pricePerPack: number
    file: File | null
  }
}) {
  if (!converting.value) return

  convertingBusy.value = true
  convertProgress.value = 0

  try {
    // 1) Convert (Function/Service)
    const res = await convertUmfrageToWurst({
      umfrageId: converting.value.id,
      name: e.payload.name ?? '',
      category: e.payload.category, // ✅ neu
      sausagesPerPack: e.payload.sausagesPerPack,
      totalPacks: e.payload.totalPacks,
      pricePerPack: e.payload.pricePerPack,
    })

    // 2) optional: neues Bild auf die neue Wurst setzen
    if (e.payload.file) {
      await uploadWurstImage({
        wurstId: res.wurstId,
        file: e.payload.file,
        onProgress: (pct) => (convertProgress.value = pct),
      })
    } else if (converting.value.imagePath) {
      await copyUmfrageImageToWurst({
        wurstId: res.wurstId,
        sourcePath: converting.value.imagePath,
      })
    }

    await sendPushToAllUsers({
      body: `Neue Wurst verfügbar! ${e.payload.name}`,
      url: '/',
    })

    // 3) Umfrage löschen
    await store.deleteUmfrage(converting.value.id, converting.value.imagePath)

    router.push('/')

    $q.notify({ type: 'positive', message: 'Benachrichtigung gesendet' })

    openConvert.value = false
    converting.value = null
  } catch (err: any) {
    console.error(err)
    $q.notify({ type: 'negative', message: err?.message || 'Umwandeln fehlgeschlagen' })
  } finally {
    convertingBusy.value = false
    convertProgress.value = 0
  }
}
</script>
