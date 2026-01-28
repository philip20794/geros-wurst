<template>
  <q-dialog v-model="open" persistent>
    <q-card dark class="card-wood" style="width: 640px; max-width: 92vw; border-radius: 16px;">
      <!-- Header -->
      <q-card-section class="row items-center justify-between bg-primary text-white">
        <div>
          <div class="text-h6">{{ headerTitle }}</div>
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
              outlined dense
              label="Name"
              autocomplete="off"
              :rules="[required]"
              :disable="busy"
            >
              <template #prepend><q-icon name="label" /></template>
            </q-input>
          </div>

          <!-- Mengen & Preis -->
          <div>
            <div class="text-subtitle2 q-mb-xs">Mengen & Preis</div>

            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="form.sausagesPerPack"
                  outlined dense type="number" min="1"
                  label="Würste pro Packung"
                  :rules="[min1]"
                  :disable="busy"
                >
                  <template #prepend><q-icon name="restaurant" /></template>
                </q-input>
              </div>

              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="form.totalPacks"
                  outlined dense type="number" min="0"
                  label="Packungen"
                  :rules="[reqNumber0]"
                  :disable="busy"
                >
                  <template #prepend><q-icon name="storage" /></template>
                </q-input>
              </div>

              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="form.pricePerPack"
                  outlined dense type="number" min="0" step="0.01"
                  label="Preis €/Kg"
                  :rules="[reqNumber0]"
                  :disable="busy"
                >
                  <template #prepend><q-icon name="payments" /></template>
                </q-input>
              </div>
            </div>
          </div>

          <!-- Bild -->
          <div>
            <div class="text-subtitle2 q-mb-xs">
              {{ isEdit ? 'Bild ersetzen' : 'Bild (optional)' }}
            </div>

            <q-file
              v-model="form.file"
              outlined dense
              :label="isEdit ? 'Neues Bild auswählen' : 'Bild auswählen'"
              accept="image/*"
              clearable
              :disable="busy"
              @update:model-value="onFileChange"
            >
              <template #prepend><q-icon name="image" /></template>
            </q-file>

            <div class="text-caption q-mt-xs opacity-75">
              Empfohlen: JPG/PNG, nicht zu groß (z.B. &lt; 2–4 MB).
            </div>
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

export type WurstEntity = {
  id: string
  name: string
  sausagesPerPack: number
  totalPacks: number
  pricePerPack: number
  imageUrl?: string
  imagePath?: string
}

export type WurstSubmitPayload = {
  name: string
  sausagesPerPack: number
  totalPacks: number
  pricePerPack: number
  file: File | null
}

type Mode = 'create' | 'edit'

type Props = {
  modelValue: boolean
  entity?: WurstEntity | null
  mode?: Mode
  busy?: boolean
  progress?: number
  subtitle?: string
  resetOnClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  entity: null,
  mode: 'create',
  busy: false,
  progress: 0,
  subtitle: 'Lege eine neue Wurst an – Bild ist optional.',
  resetOnClose: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'submit', args: { mode: 'create' | 'edit'; id?: string; payload: WurstSubmitPayload }): void
  (e: 'cancel'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const formRef = ref<QForm | null>(null)

const form = reactive<WurstSubmitPayload>({
  name: '',
  sausagesPerPack: 6,
  totalPacks: 0,
  pricePerPack: 0,
  file: null,
})

const isEdit = computed(() => props.mode === 'edit')

const headerTitle = computed(() => (isEdit.value ? 'Wurst bearbeiten' : 'Neue Wurst'))
const headerSubtitle = computed(() => (isEdit.value ? (props.entity?.name ?? '') : props.subtitle))

function fillFromEntity() {
  const e = props.entity
  form.name = e?.name ?? ''
  form.sausagesPerPack = Number(e?.sausagesPerPack ?? 6)
  form.totalPacks = Number(e?.totalPacks ?? 0)
  form.pricePerPack = Number(e?.pricePerPack ?? 0)
  form.file = null
  formRef.value?.resetValidation?.()
}

watch(
  () => [props.modelValue, props.entity?.id, props.mode] as const,
  ([isOpen]) => {
    if (!isOpen) return
    fillFromEntity()
  },
  { immediate: true },
)

function onFileChange(file: File | null) {
  form.file = file
}

// rules
const required = (v: any) => !!v || 'Pflichtfeld'
const min1 = (v: any) => (Number(v) >= 1 ? true : 'Mindestens 1')
const reqNumber0 = (v: any) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? true : 'Pflicht (>= 0)')

function close() {
  emit('cancel')
  open.value = false
  if (props.resetOnClose) fillFromEntity()
}

async function submit() {
  if (props.busy) return
  const ok = await formRef.value?.validate?.()
  if (!ok) return

  const payload: WurstSubmitPayload = {
    name: String(form.name || '').trim(),
    sausagesPerPack: Math.max(1, Math.floor(Number(form.sausagesPerPack || 1))),
    totalPacks: Math.max(0, Math.floor(Number(form.totalPacks || 0))),
    pricePerPack: Number(Number(form.pricePerPack || 0).toFixed(2)),
    file: form.file ?? null,
  }

  if (isEdit.value) {
    const id = props.entity?.id
    if (!id) return
    emit('submit', { mode: 'edit', id, payload })
  } else {
    emit('submit', { mode: 'create', payload })
  }
}
</script>
