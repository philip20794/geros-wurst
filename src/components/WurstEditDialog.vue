<script setup lang="ts">
import { reactive, watch, computed } from "vue";
import { QForm } from "quasar";
import type { Wurst } from "@/stores/wurst";

type Props = {
  modelValue: boolean;       // Dialog sichtbar?
  wurst?: Wurst | null;      // zu bearbeitendes Objekt
};
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void
  (e: "save", data: { name: string; sausagesPerPack: number; totalPacks: number; pricePerPack: number }): void
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

// lokaler Formular-State
const form = reactive({
  name: "",
  sausagesPerPack: 0,
  totalPacks: 0,
  pricePerPack: 0,
});

watch(
  () => props.wurst,
  (w) => {
    form.name = w?.name ?? "";
    form.sausagesPerPack = w?.sausagesPerPack ?? 0;
    form.totalPacks = w?.totalPacks ?? 0;
    form.pricePerPack = w?.pricePerPack ?? 0;
  },
  { immediate: true }
);

const rules = {
  required: (v: any) => (v !== null && v !== undefined && String(v).length > 0) || "Pflichtfeld",
  intGte0: (v: any) => Number.isFinite(+v) && +v >= 0 || "≥ 0",
  intGt0: (v: any) => Number.isFinite(+v) && +v > 0 || "> 0",
  moneyGte0: (v: any) => Number.isFinite(+v) && +v >= 0 || "≥ 0",
};

let formRef: InstanceType<typeof QForm> | null = null;

async function onSubmit() {
  // Validierung
  const ok = await (formRef as any)?.validate?.();
  if (!ok) return;
  emit("save", {
    name: form.name.trim(),
    sausagesPerPack: Math.floor(+form.sausagesPerPack),
    totalPacks: Math.floor(+form.totalPacks),
    pricePerPack: +Number(form.pricePerPack).toFixed(2),
  });
  open.value = false;
}
</script>

<template>
  <q-dialog v-model="open">
    <q-card style="max-width: 560px; width: 100%" class="card-wood">
      <q-card-section class="bg-primary text-white">
        <div class="text-h6">Wurst bearbeiten</div>
        <div class="text-subtitle2">{{ wurst?.name }}</div>
      </q-card-section>

      <q-card-section>
        <q-form ref="formRef" @submit.prevent="onSubmit">
          <q-input
            v-model="form.name"
            label="Name"
            outlined
            :rules="[rules.required]"
            autocomplete="off"
          />
          <div class="row q-col-gutter-md">
            <div class="col-6">
              <q-input
                v-model.number="form.sausagesPerPack"
                type="number"
                label="Würste pro Packung"
                outlined
                :rules="[rules.intGt0]"
                min="1"
              />
            </div>
            <div class="col-6">
              <q-input
                v-model.number="form.totalPacks"
                type="number"
                label="Packungen"
                outlined
                :rules="[rules.intGte0]"
                min="0"
              />
            </div>
          </div>
          <q-input
            v-model.number="form.pricePerPack"
            type="number"
            step="0.01"
            label="Preis pro Packung (€)"
            outlined
            :rules="[rules.moneyGte0]"
            min="0"
          />
        </q-form>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn no-caps flat label="Abbrechen" color="grey-7" @click="open=false" />
        <q-btn no-caps unelevated color="primary" label="Speichern" @click="onSubmit" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
