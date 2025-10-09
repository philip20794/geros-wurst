<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useQuasar } from "quasar";
import { useAuthStore } from "@/stores/auth";
import { useWurstStore, type Wurst } from "@/stores/wurst";
import AdminReservations from "@/components/AdminReservations.vue";

type Props = { wurst: Wurst };
const props = defineProps<Props>();

const $q = useQuasar();
const auth = useAuthStore();
const store = useWurstStore();

const myQty = ref<number | undefined>(undefined); // Eingabewert
const currentQty = ref(0);   
const reservedSum = ref(0);
let unsub: null | (() => void) = null;

// NEW: Fullscreen Dialog toggle
const showFull = ref(false);

onMounted(async () => {
  unsub = store.watchReservedSum(props.wurst.id, (sum) => (reservedSum.value = sum));
  const initial = await store.getMyReservation(props.wurst.id);
  currentQty.value = initial;
  myQty.value = initial;
});
onUnmounted(() => { if (unsub) unsub(); });

function remaining() {
  // wie viel man NOCH zusätzlich erhöhen darf (alle Reservierungen bereits eingerechnet)
  return Math.max(0, (props.wurst.totalPacks || 0) - (reservedSum.value || 0));
}

function priceFor(qty: number) {
  return (qty || 0) * (props.wurst.pricePerPack || 0);
}

async function saveReservation() {
  const desired = Math.max(0, Math.floor(myQty.value ?? 0));
  const current = currentQty.value || 0;

  if (desired > current) {
    const addDelta = desired - current;    // gewünschte Erhöhung
    const maxDelta = remaining();          // maximal zusätzlich erlaubt
    const allowed = current + maxDelta;    // maximaler Zielwert

    if (addDelta > maxDelta) {
      myQty.value = allowed; // auf erlaubten Zielwert kappen
      $q.notify({
        type: "warning",
        message: `Du kannst um höchstens ${maxDelta} erhöhen (insgesamt ${allowed}).`
      });
      return;
    }
  }
  // Verringerungen sind immer erlaubt
  await store.setReservation(props.wurst.id, desired);
  currentQty.value = desired; // nach erfolgreichem Speichern aktualisieren
  $q.notify({ type: "positive", message: "Reservierung gespeichert" });
}

const emit = defineEmits<{
  (e: "edit", w: Wurst): void;
  (e: "delete", w: Wurst): void;
}>();
</script>

<template>
  <q-card flat  class="card-wood" style="max-width: 700px; margin: auto;">
    <q-img :src="wurst.imageUrl" :ratio="16/9" loading="lazy">
      <!-- Titel oben links -->
      <div class="absolute-top-left q-ma-sm q-pa-xs bg-primary text-white rounded-borders">
        {{ wurst.name }}
      </div>

      <!-- 🔍 Dezenter Zoom-Button unten rechts -->
      <div class="absolute-bottom-right" style="background: transparent;">
        <q-btn
          dense
          round
          flat
          icon="fullscreen"
          color="black"
          @click.stop="showFull = true"
        />
      </div>
    </q-img>

    <q-card-section>
      <div class="row justify-between items-center">
        <div class="text-subtitle1">{{ wurst.sausagesPerPack }} Würstchen pro Packung</div>
        <div class="text-subtitle1">{{ wurst.pricePerPack.toFixed(2) }} €</div>
      </div>
      <div class="text-caption">
        Restbestand: <b>{{ remaining() }}</b> von {{ wurst.totalPacks }}
      </div>
    </q-card-section>

    <!-- USER -->
    <q-card-section v-if="auth.meta?.role !== 'admin'">
      <div class="row items-center q-col-gutter-sm">
        <div class="col">
          <q-input dense outlined type="number" min="0" v-model.number="myQty" label="Packungen reservieren" />
        </div>
        <div class="col-auto">
          <q-btn color="primary" dense icon="save" label="Speichern" @click="saveReservation" no-caps />
        </div>
      </div>
      <div class="text-caption q-mt-xs">
        Preis: <b>{{ priceFor(myQty || 0).toFixed(2) }} €</b>
      </div>
    </q-card-section>

    <!-- ADMIN -->
    <template v-else>
      <q-card-actions class="row q-ml-md" >
        <div class="text-caption col">Reserviert gesamt: <b>{{ reservedSum }}</b></div>
        <div class="col">
          <q-btn class="q-ma-xs" no-caps dense color="primary" icon="edit" label="Bearbeiten" @click="emit('edit', wurst)" />
          <q-btn class="q-ma-xs" no-caps dense color="negative" icon="delete" label="Löschen" @click="emit('delete', wurst)" />
        </div>
      </q-card-actions>
      <q-separator />
      <AdminReservations :wurst-id="wurst.id" :price-per-pack="wurst.pricePerPack" />
    </template>

    <!-- Vollbild-Dialog -->
    <q-dialog v-model="showFull" maximized>
      <q-card class="bg-black">
        <q-bar class="bg-black text-white">
          <div class="text-subtitle2 ellipsis">{{ wurst.name }}</div>
          <q-space />
          <q-btn no-caps dense flat round icon="close" v-close-popup />
        </q-bar>
        <q-card-section class="q-pa-none">
          <q-img :src="wurst.imageUrl" fit="contain" style="height: calc(100vh - 42px);" img-class="bg-black" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-card>
</template>

