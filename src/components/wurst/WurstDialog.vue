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
              outlined dense
              label="Name"
              autocomplete="off"
              :rules="[required]"
              :disable="busy"
            >
              <template #prepend><q-icon name="label" /></template>
            </q-input>

            <!-- Kategorie -->
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
                  outlined dense type="number" min="1"
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
                  label="Packungen"
                  :rules="[reqNumber0]"
                  :disable="busy"
                >
                  <template #prepend><q-icon name="storage" /></template>
                </q-input>
              </div>

                <div class="col-12">
                  <q-input
                    v-model.number="form.pricePerPack"
                    outlined
                    dense
                    type="number"
                    min="0"
                    step="0.01"
                    label="Preis"
                    suffix="€"
                    :rules="[reqNumber0]"
                    :disable="busy"
                    hide-bottom-space
                  >
                    <template #prepend>
                      <q-icon name="payments" />
                    </template>

                    <template #append>
                      <q-separator vertical inset class="q-mx-sm" />

                      <q-btn
                        flat
                        dense
                        no-caps
                        padding="xs sm"
                        class="unit-btn"
                        :disable="busy"
                      >
                        <span>
                          / {{ form.unit || 'Unit' }}
                        </span>

                        <q-popup-edit
                          v-model="form.unit"
                          v-slot="scope"
                          :disable="busy"
                          auto-save
                          class="card-wood"
                          style="border-radius: 12px;"
                        >
                          <q-input
                            v-model.trim="scope.value"
                            outlined
                            dense
                            autofocus
                            label="Unit"
                            placeholder="z.B. Kg, Stk"
                            :rules="[required]"
                            hide-bottom-space
                            @keyup.enter.prevent.stop="scope.set()"
                            @keydown.esc.prevent.stop="scope.cancel()"
                          >
                            <template #prepend>
                              <q-icon name="euro" />
                            </template>
                          </q-input>

                          <div class="text-caption opacity-80 q-mt-xs">
                            Tipp: Einheit kurz halten (kg, l, Stk).
                          </div>
                        </q-popup-edit>
                      </q-btn>
                    </template>
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


        <q-card-actions align="right" class="q-pa-md bg-primary">
          <q-btn flat no-caps label="Abbrechen" :disable="busy" @click="close" />
          <q-btn
            color="dark"
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
  category?: string
  sausagesPerPack: number
  totalPacks: number
  pricePerPack: number
  imageUrl?: string
  imagePath?: string
  unit?: string
}

export type WurstSubmitPayload = {
  name: string
  category: string
  sausagesPerPack: number
  totalPacks: number
  pricePerPack: number
  unit: string
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

const DEFAULT_CATEGORY = 'Würstchen'

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
  category: DEFAULT_CATEGORY,
  sausagesPerPack: 6,
  totalPacks: 0,
  pricePerPack: 0,
  unit: 'Kg',
  file: null,
})

const isEdit = computed(() => props.mode === 'edit')

const headerTitle = computed(() => (isEdit.value ? 'Artikel bearbeiten' : 'Neuer Artikel'))
const headerSubtitle = computed(() => (isEdit.value ? (props.entity?.name ?? '') : props.subtitle))

const categorySafe = computed(() => {
  const c = String(form.category || '').trim()
  return c.length ? c : DEFAULT_CATEGORY
})

const sausagesPerPackLabel = computed(() => `${categorySafe.value} pro Packung`)

function fillFromEntity() {
  const e = props.entity
  form.name = e?.name ?? ''
  form.category = String(e?.category ?? DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY
  form.sausagesPerPack = Number(e?.sausagesPerPack ?? 6)
  form.totalPacks = Number(e?.totalPacks ?? 0)
  form.pricePerPack = Number(e?.pricePerPack ?? 0)
  form.unit = e?.unit ?? 'Kg'
  form.file = null
  formRef.value?.resetValidation?.()
}

/**
 * Wichtig: wenn du den Dialog öffnest, ist `entity` manchmal noch nicht gesetzt.
 * Daher: bei Open + bei entity/mode-Wechsel (während offen) erneut füllen.
 */
watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return
    fillFromEntity()
  },
  { immediate: true },
)

watch(
  () => [props.entity?.id, props.mode] as const,
  () => {
    if (!props.modelValue) return
    fillFromEntity()
  },
)

function onFileChange(file: File | null) {
  form.file = file
}

// rules
const required = (v: any) => !!String(v ?? '').trim() || 'Pflichtfeld'
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
    category: String(form.category || '').trim() || DEFAULT_CATEGORY,
    sausagesPerPack: Math.max(1, Math.floor(Number(form.sausagesPerPack || 1))),
    totalPacks: Math.max(0, Math.floor(Number(form.totalPacks || 0))),
    pricePerPack: Number(Number(form.pricePerPack || 0).toFixed(2)),
    unit: String(form.unit || '').trim(),
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
