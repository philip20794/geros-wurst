<template>
  <div>
    <div v-if="auth.meta?.role != 'admin'" class="row items-center justify-between q-mb-md">
      <q-btn
        color="primary"
        no-caps
        icon="add"
        label="Neuer Wunsch"
        @click="openCreate = true"
      />
    </div>

    <div class="row q-col-gutter-lg">
      <div v-for="w in store.items" :key="w.id" class="col-12 col-md-6 col-lg-4">
        <WunschCard
          :wunsch="w"
          @edit="onEdit"
          @delete="onDelete"
        />
      </div>
    </div>

    <NoWuenschePlaceholder v-if="store.items.length === 0" />

    <!-- Create Dialog (simpel) -->
     <WunschDialog 
      v-model="openCreate"
      :busy="creating"
      :progress="createProgress"
      @submit="handleUpsert"
     />

    <WunschDialog
      v-model="openEdit"
      :entity="editing "
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
import { useWuenscheStore, type Wunsch } from '@/stores/wuensche'
import WunschCard from '@/components/wuensche/WunschCard.vue'
import { sendPushToAllUsers } from '@/services/pushSend'
import WunschDialog, { type CreatePayload } from '../wuensche/WunschDialog.vue'
import NoWuenschePlaceholder from '../NoWuenschePlaceholder.vue'

defineOptions({ name: 'HomeTabWuensche' })
const $q = useQuasar()
const auth = useAuthStore()
const store = useWuenscheStore()

// Create
const openCreate = ref(false)
const creating = ref(false)
const createProgress = ref(0)

// Edit
const openEdit = ref(false)
const editing = ref<Wunsch | null>(null)
const saving = ref(false)
const editProgress = ref(0)

function onEdit(w: Wunsch) {
  editing.value = w
  openEdit.value = true
}

// Upsert handler (kommt vom WunschDialog)
async function handleUpsert(e: { mode: 'create' | 'edit'; id?: string; payload: any }) {
  console.log(e)
  if (e.mode === 'create') {
    creating.value = true
    createProgress.value = 0
    try {
      await store.createWunsch(e.payload.name);
      await sendPushToAll(e.payload.name);

      $q.notify({ type: 'positive', message: 'Wunsch angelegt ✅' })
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
    await store.updateWunsch(editing.value.id, {
      name: e.payload.name,
    })

    $q.notify({ type: 'positive', message: 'Wunsch gespeichert ✅' })
    openEdit.value = false
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Speichern fehlgeschlagen' })
  } finally {
    saving.value = false
    editProgress.value = 0
  }
}


function getUserLabel() {
  return ` von ${auth.displayName}`
}


// Edit/Delete optional (wenn du willst, kann ich dir dafür noch einen WunschEditDialog bauen)

async function sendPushToAll(text: string) {
  try {
    const result = await sendPushToAllUsers({
      body: `Neuer Wunsch${getUserLabel()}: ${text}`,
      url: '/wuensche',
    })
    $q.notify({ type: 'positive', message: 'Benachrichtigung gesendet' })
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Benachrichtigung konte nicht gesendet werden' })
  }
}

function onDelete(w: Wunsch) {
  $q.dialog({
    class: 'dialog-wood',
    title: 'Löschen?',
    message: `${w.name} wirklich löschen?`,
    ok: { color: 'negative', label: 'Löschen' },
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    await store.deleteWunsch(w.id)
    $q.notify({ type: 'negative', message: 'Gelöscht' })
  })
}
</script>
