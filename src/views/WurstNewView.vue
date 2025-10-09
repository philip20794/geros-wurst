<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useWurstStore } from "@/stores/wurst";
import { useQuasar } from "quasar";

const router = useRouter();
const $q = useQuasar();
const store = useWurstStore();
const progress = ref(0);

const form = reactive({
  name: "",
  sausagesPerPack: 6,
  totalPacks: 0,
  pricePerPack: 0,
  file: null as File | null
});
const loading = ref(false);

async function submit() {
  if (!form.file) { $q.notify({ type: "negative", message: "Bild fehlt" }); return; }
  loading.value = true;
  try {
    await store.createWurst({
      name: form.name,
      sausagesPerPack: form.sausagesPerPack,
      totalPacks: form.totalPacks,
      pricePerPack: form.pricePerPack,
      file: form.file!,
      onProgress: (pct) => progress.value = pct
    });
    $q.notify({ type: "positive", message: "Wurst angelegt" });
    router.push({ name: "home" });
  } catch (e: any) {
    $q.notify({ type: "negative", message: e?.message || "Fehlgeschlagen" });
  } finally { loading.value = false; }
}
</script>

<template>
  <q-page padding>
    <q-card flat bordered class="q-pa-md" style="max-width:700px; margin:auto;">
      <div class="text-h5 q-mb-md">Neue Wurst</div>
      <q-form @submit.prevent="submit" class="q-gutter-md">
        <q-input outlined v-model="form.name" label="Name" :rules="[v=>!!v || 'Pflichtfeld']"/>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input outlined type="number" v-model.number="form.sausagesPerPack" label="Würste pro Packung" :rules="[v=>v>0 || '>' ]"/>
          </div>
          <div class="col-6">
            <q-input outlined type="number" v-model.number="form.totalPacks" label="Gesamtanzahl Packungen" :rules="[v=>v>=0 || '>=0']"/>
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-input outlined type="number" step="0.01" v-model.number="form.pricePerPack" label="Preis/Packung (€)" :rules="[v=>v>=0 || '>=0']"/>
          </div>
          <div class="col-6">
            <q-file outlined v-model="form.file" label="Bild hochladen" accept="image/*" :rules="[v=>!!v || 'Pflichtfeld']">
              <template #prepend><q-icon name="image" /></template>
            </q-file>
          </div>
        </div>
        <div class="row justify-end">
          <q-btn color="primary" type="submit" :loading="loading" label="Bestätigen" unelevated />
        </div>
      </q-form>
    <q-linear-progress v-if="progress>0 && progress<100" :value="progress/100" />
    </q-card>
  </q-page>
</template>
