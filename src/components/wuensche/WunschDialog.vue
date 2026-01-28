<template>
  <q-dialog v-model="open" persistent>
    <q-card dark class="card-wood" style="width: 640px; max-width: 92vw; border-radius: 16px;">
      <!-- Header -->
      <q-card-section class="row items-center justify-between bg-primary text-white">
        <div>
          <div class="text-h6">{{ isEdit ? 'Wunsch bearbeiten' : 'Neuer Wunsch' }}</div>
          <div class="text-caption opacity-80">
            {{ isEdit ? (entity?.name ?? '') : subtitle }}
          </div>
        </div>

        <q-btn flat round dense icon="close" class="text-white" :disable="busy" @click="close" />
      </q-card-section>

      <q-separator />

      <q-form ref="formRef" @submit.prevent="submit">
        <q-card-section class="q-gutter-sm">
          <!-- Details -->
          <div>
            <div class="text-subtitle2 q-mb-xs">Details</div>
            <q-input
              v-model.trim="form.name"
              outlined
              dense
              autocomplete="off"
              :rules="[required]"
              :disable="busy"
            >
              <template #prepend><q-icon name="label" /></template>
            </q-input>
          </div>


          <!-- Progress -->
          <q-linear-progress
            v-if="progress > 0 && progress < 100"
            :value="progress / 100"
            rounded
            stripe
          />
        </q-card-section>

        <q-separator />

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat no-caps label="Abbrechen" :disable="busy" @click="close" />
          <q-btn
            color="primary"
            no-caps
            unelevated
            :label="isEdit ? 'Speichern' : 'Anlegen'"
            type="submit"
            :loading="busy"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { QForm } from 'quasar'

export type WunschEntity = {
  id: string
  name: string
  sausagesPerPack: number
  totalPacks?: number | null
  pricePerPack?: number | null
  imageUrl?: string
  imagePath?: string
}


export type WunschSubmitPayload = {
  name: string
}

type Props = {
  modelValue: boolean
  entity?: WunschEntity | null   // wenn gesetzt => edit
  busy?: boolean                 // creating/saving von außen
  progress?: number              // upload progress 0-100
  subtitle?: string              // nur für create
  resetOnClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  entity: null,
  busy: false,
  progress: 0,
  subtitle: 'Was soll Gero mal wieder machen?',
  resetOnClose: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'submit', args: { mode: 'create' | 'edit'; id?: string; payload: WunschSubmitPayload }): void
  (e: 'cancel'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const isEdit = computed(() => !!props.entity?.id)

const formRef = ref<QForm | null>(null)

const form = reactive<WunschSubmitPayload>({
  name: '',
})

function fillFromEntity() {
  const e = props.entity
  form.name = e?.name ?? ''
  formRef.value?.resetValidation?.()
}

// Wenn Dialog geöffnet oder entity gewechselt → prefill
watch(
  () => [props.modelValue, props.entity?.id] as const,
  ([isOpen]) => {
    if (!isOpen) return
    fillFromEntity()
  },
  { immediate: true },
)


// Validation rules
const required = (v: any) => !!v || 'Pflichtfeld'

function close() {
  emit('cancel')
  open.value = false
  if (props.resetOnClose) fillFromEntity()
}

async function submit() {
  if (props.busy) return

  const ok = await formRef.value?.validate?.()
  if (!ok) return

  const payload: WunschSubmitPayload = {
    name: String(form.name || '').trim(),
  }

  if (isEdit.value) {
    emit('submit', { mode: 'edit', id: props.entity!.id, payload })
  } else {
    emit('submit', { mode: 'create', payload })
  }
}
</script>
