<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useWurstStore, type Wurst } from "@/stores/wurst";
import { useQuasar } from "quasar";
import { useRouter } from "vue-router";
import AdminReservations from "@/components/AdminReservations.vue";
import WurstEditDialog from "@/components/WurstEditDialog.vue";

const auth = useAuthStore();
const store = useWurstStore();
const $q = useQuasar();
const router = useRouter();

const editOpen = ref(false);
const editing = ref(null);

const reservedSum = ref<Record<string, number>>({});
const myQty = ref<Record<string, number>>({});
const unsubs: Array<() => void> = [];

onMounted(() => {
  store.watchAll();
  watch(
    () => store.items,
    (items) => {
      while (unsubs.length) { const u = unsubs.pop(); u && u(); }
      items.forEach((w) => {
        const unsub = store.watchReservedSum(w.id, (sum) => {
          reservedSum.value[w.id] = sum;
        });
        unsubs.push(unsub);
      });
    },
    { immediate: true, deep: true }
  );
});

onUnmounted(() => {
  store.stop();
  while (unsubs.length) { const u = unsubs.pop(); u && u(); }
});

function remaining(w: Wurst) {
  const sum = reservedSum.value[w.id] || 0;
  return Math.max(0, (w.totalPacks || 0) - sum);
}

async function preloadMyQty(w: Wurst) {
  if (myQty.value[w.id] === undefined) {
    myQty.value[w.id] = await store.getMyReservation(w.id);
  }
}

function price(w: Wurst, qty: number) {
  return (qty || 0) * (w.pricePerPack || 0);
}

async function saveReservation(w: Wurst) {
  const qty = Math.max(0, Math.floor(myQty.value[w.id] || 0));
  const maxAvail = remaining(w);
  if (qty > maxAvail) {
    myQty.value[w.id] = maxAvail;
    $q.notify({ type: "warning", message: `Maximal verfügbar: ${maxAvail}` });
  }
  await store.setReservation(w.id, myQty.value[w.id]);
  $q.notify({ type: "positive", message: "Reservierung gespeichert" });
}

function toNewWurst() { router.push({ name: "wurst-new" }); }

function adminEdit(w: Wurst) {
  editing.value = w;
  editOpen.value = true;
}

async function onSaveEdit(data: { name: string; sausagesPerPack: number; totalPacks: number; pricePerPack: number }) {
  if (!editing.value) return;
  // Optional: Plausibilitätscheck – totalPacks >= aktuell reserviert?
  const reserved = reservedSum.value[editing.value.id] || 0;
  if (data.totalPacks < reserved) {
    $q.notify({ type: "warning", message: `Gesamt-Packungen darf reservierte Menge (${reserved}) nicht unterschreiten.` });
    return;
  }
  await store.updateWurst(editing.value.id, data);
  $q.notify({ type: "info", message: "Wurst aktualisiert" });
}

async function adminDelete(w: Wurst) {
  $q.dialog({
    title: "Löschen?",
    message: `Wurst „${w.name}“ wirklich löschen?`,
    ok: { color: "negative", label: "Löschen" },
    cancel: true,
    persistent: true
  }).onOk(async () => {
    await store.deleteWurst(w.id, w.imagePath);
    $q.notify({ type: "negative", message: "Gelöscht" });
  });
}
</script>

<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5">Willkommen, {{ auth.user?.displayName || auth.user?.email }}</div>
      <q-btn
        v-if="auth.meta?.role === 'admin'"
        color="primary" icon="add" label="Neue Wurst"
        @click="toNewWurst" unelevated
      />
    </div>

    <div class="row q-col-gutter-lg">
      <div v-for="w in store.items" :key="w.id" class="col-12 col-md-6 col-lg-4">
        <q-card flat bordered @mouseenter="preloadMyQty(w)">
          <q-img :src="w.imageUrl" :ratio="16/9" loading="lazy">
            <div class="absolute-top-left q-ma-sm q-pa-xs bg-primary text-white rounded-borders">
              {{ w.name }}
            </div>
          </q-img>

          <q-card-section>
            <div class="row justify-between items-center">
              <div class="text-subtitle1">{{ w.sausagesPerPack }} Stk / Packung</div>
              <div class="text-subtitle1">{{ w.pricePerPack.toFixed(2) }} €</div>
            </div>
            <div class="text-caption text-grey-7">
              Restbestand: <b>{{ remaining(w) }}</b> von {{ w.totalPacks }}
            </div>
          </q-card-section>

          <!-- USER: Reservieren -->
          <q-card-section v-if="auth.meta?.role !== 'admin'">
            <div class="row items-center q-col-gutter-sm">
              <div class="col">
                <q-input
                  dense outlined type="number" min="0"
                  v-model.number="myQty[w.id]"
                  label="Packungen reservieren"
                />
              </div>
              <div class="col-auto">
                <q-btn color="primary" dense icon="save" label="Speichern" @click="saveReservation(w)" />
              </div>
            </div>
            <div class="text-caption q-mt-xs">
              Preis: <b>{{ price(w, myQty[w.id] || 0).toFixed(2) }} €</b>
            </div>
          </q-card-section>

          <!-- ADMIN: Aktionen + Reservierungen (ausgelagert) -->
          <template v-else>
            <q-card-actions align="between">
              <div class="text-caption">
                Reserviert gesamt: <b>{{ reservedSum[w.id] || 0 }}</b>
              </div>
              <div>
                <q-btn dense flat icon="edit" label="Bearbeiten" @click="adminEdit(w)" />
                <q-btn dense flat color="negative" icon="delete" label="Löschen" @click="adminDelete(w)" />
              </div>
            </q-card-actions>

            <q-separator />
            <AdminReservations :wurst-id="w.id" :price-per-pack="w.pricePerPack" />
          </template>
        </q-card>
      </div>
    </div>
    <WurstEditDialog
      v-model="editOpen"
      :wurst="editing"
      @save="onSaveEdit"
    />
  </q-page>
</template>
