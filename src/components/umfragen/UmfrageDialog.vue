<template>
  <q-dialog v-model="open" persistent>
    <q-card dark class="card-wood" style="width: 640px; max-width: 92vw; border-radius: 16px;">
      <!-- Header -->
      <q-card-section class="row items-center justify-between bg-primary text-white">
        <div>
          <div class="text-h6">{{ headerTitle }}</div>
          <div class="text-caption opacity-80">{{ headerSubtitle }}</div>
        </div>

        <q-btn flat round dense icon="close" class="text-white" :disable="busy" @click="close" />
      </q-card-section>

      <q-separator />

      <q-form ref="formRef" @submit.prevent="submit">
        <q-card-section class="q-gutter-sm card-wood">
          <!-- Details -->
          <div>
            <div class="text-subtitle2 q-mb-xs">Details</div>

            <q-input
              v-model.trim="form.name"
              outlined
              dense
              label="Name"
              autocomplete="off"
              :rules="[required]"
              :disable="busy"
            >
              <template #prepend><q-icon name="label" /></template>
            </q-input>

            <!-- ✅ Kategorie (neu) -->
            <q-input
              v-model.trim="form.category"
              outlined
              dense
              label="Kategorie"
              :rules="[required]"
              :disable="busy"
              bottom-slots
            >
              <template #prepend><q-icon name="category" /></template>
              <template #hint>
                <span class="text-white">z.B. Würstchen, Steaks, Rücken, ...</span>
              </template>
            </q-input>
          </div>

          <!-- Mengen & Preis -->
          <div>
            <div class="text-subtitle2 q-mb-xs">Mengen & Preis</div>

            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="form.sausagesPerPack"
                  outlined
                  dense
                  type="number"
                  min="1"
                  :label="sausagesPerPackLabel"
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
                  :label="'Packungen '"
                  :rules="isConvert ? [reqNumber0] : []"
                  :disable="busy"
                >
                  <template #prepend><q-icon name="storage" /></template>
                </q-input>
                <div v-if="!isConvert" class="text-caption opacity-70 q-mt-xs">Leer lassen = offen</div>
              </div>

              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="form.pricePerPack"
                  outlined dense type="number" min="0" step="0.01"
                  :label="'Preis €/Kg'"
                  :rules="isConvert ? [reqNumber0] : []"
                  :disable="busy"
                >
                  <template #prepend><q-icon name="payments" /></template>
                </q-input>
                <div v-if="!isConvert" class="text-caption opacity-70 q-mt-xs">Leer lassen = offen</div>
              </div>
            </div>
          </div>

          <!-- Bild -->
          <div>
            <div class="text-subtitle2 q-mb-xs">
              {{ isEdit ? 'Bild ersetzen' : 'Bild' }}
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



        <q-card-actions align="right" class="q-pa-md bg-primary">
          <q-btn flat no-caps label="Abbrechen" :disable="busy" @click="close" />
          <q-btn
            color="dark"
            no-caps
            unelevated
            :label="isConvert ? 'Umwandeln' : (isEdit ? 'Speichern' : 'Anlegen')"
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

export type UmfrageEntity = {
  id: string
  name: string
  category?: string // ✅ neu
  sausagesPerPack: number
  totalPacks?: number | null
  pricePerPack?: number | null
  imageUrl?: string
  imagePath?: string
}

export type UmfrageSubmitPayload = {
  name: string
  category: string // ✅ neu
  sausagesPerPack: number
  totalPacks: number | null
  pricePerPack: number | null
  file: File | null
}

export type ConvertPayload = {
  name?: string
  category: string // ✅ neu
  sausagesPerPack: number
  totalPacks: number
  pricePerPack: number
  file: File | null
}

type Mode = 'create' | 'edit' | 'convert'

type Props = {
  modelValue: boolean
  entity?: UmfrageEntity | null
  mode?: Mode
  busy?: boolean
  progress?: number
  subtitle?: string
  resetOnClose?: boolean
}

const DEFAULT_CATEGORY = 'Würstchen' // ✅ neu

const props = withDefaults(defineProps<Props>(), {
  entity: null,
  mode: 'create',
  busy: false,
  progress: 0,
  subtitle: '',
  resetOnClose: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  // create/edit
  (e: 'submit', args: { mode: 'create' | 'edit'; id?: string; payload: UmfrageSubmitPayload }): void
  // convert
  (e: 'convert', args: { id: string; payload: ConvertPayload }): void
  (e: 'cancel'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const formRef = ref<QForm | null>(null)

const form = reactive<UmfrageSubmitPayload>({
  name: '',
  category: DEFAULT_CATEGORY, // ✅ neu
  sausagesPerPack: 1,
  totalPacks: null,
  pricePerPack: null,
  file: null,
})

const isConvert = computed(() => props.mode === 'convert')
const isEdit = computed(() => props.mode === 'edit')
const isCreate = computed(() => props.mode === 'create')

const headerTitle = computed(() => {
  if (isConvert.value) return 'In Wurst umwandeln'
  if (isEdit.value) return 'Umfrage bearbeiten'
  return 'Neue Umfrage'
})

const headerSubtitle = computed(() => {
  if (isConvert.value) return props.entity?.name ?? ''
  if (isEdit.value) return props.entity?.name ?? ''
  return props.subtitle
})

const categorySafe = computed(() => {
  const c = String(form.category || '').trim()
  return c.length ? c : DEFAULT_CATEGORY
})

const sausagesPerPackLabel = computed(() => `${categorySafe.value} pro Packung`)

function normalizeOptionalNumber(v: any) {
  if (v === '' || v === undefined) return null
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeRequiredNumber(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function fillFromEntity() {
  const e = props.entity
  form.name = e?.name ?? ''
  form.category = String(e?.category ?? DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY
  form.sausagesPerPack = Number(e?.sausagesPerPack ?? 1)
  form.totalPacks = e?.totalPacks ?? null
  form.pricePerPack = e?.pricePerPack ?? null
  form.file = null
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

function onFileChange(file: File | null) {
  form.file = file
}

// Validation rules
const required = (v: any) => !!String(v ?? '').trim() || 'Pflichtfeld'
const min1 = (v: any) => (Number(v) >= 1 ? true : 'Mindestens 1')

// Convert rules (Pflicht)
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

  // convert: emit convert statt submit
  if (isConvert.value) {
    const id = props.entity?.id
    if (!id) return

    const total = normalizeRequiredNumber(form.totalPacks)
    const price = normalizeRequiredNumber(form.pricePerPack)

    if (!Number.isFinite(total) || total < 0) return
    if (!Number.isFinite(price) || price < 0) return

    emit('convert', {
      id,
      payload: {
        name: String(form.name || '').trim() || undefined,
        category: String(form.category || '').trim() || DEFAULT_CATEGORY,
        sausagesPerPack: Math.max(1, Math.floor(Number(form.sausagesPerPack || 1))),
        totalPacks: Math.floor(total),
        pricePerPack: Number(Number(price).toFixed(2)),
        file: form.file ?? null,
      },
    })
    return
  }

  // create/edit
  const payload: UmfrageSubmitPayload = {
    name: String(form.name || '').trim(),
    category: String(form.category || '').trim() || DEFAULT_CATEGORY,
    sausagesPerPack: Math.max(1, Math.floor(Number(form.sausagesPerPack || 1))),
    totalPacks: normalizeOptionalNumber(form.totalPacks),
    pricePerPack: normalizeOptionalNumber(form.pricePerPack),
    file: form.file ?? null,
  }

  if (isEdit.value) {
    emit('submit', { mode: 'edit', id: props.entity!.id, payload })
  } else {
    emit('submit', { mode: 'create', payload })
  }
}
</script>
