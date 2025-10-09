<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useQuasar } from "quasar";
import { useAuthStore } from "@/stores/auth";
import { useWurstStore, type Wurst } from "@/stores/wurst";
import AdminReservations from "@/components/AdminReservations.vue";

type Props = {
  wurst: Wurst;
};
const props = defineProps<Props>();

const $q = useQuasar();
const auth = useAuthStore();
const store = useWurstStore();

const myQty = ref<number | undefined>(undefined);
const reservedSum = ref(0);
let unsub: null | (() => void) = null;

onMounted(async () => {
  unsub = store.watchReservedSum(props.wurst.id, (sum) => (reservedSum.value = sum));
  // eigene Reservierung vorbefüllen
  myQty.value = await store.getMyReservation(props.wurst.id);
});
onUnmounted(() => { if (unsub) unsub(); });

function remaining() {
  return Math.max(0, (props.wurst.totalPacks || 0) - (reservedSum.value || 0));
}

function priceFor(qty: number) {
  return (qty || 0) * (props.wurst.pricePerPack || 0);
}

async function saveReservation() {
  const qty = Math.max(0, Math.floor(myQty.value || 0));
  const maxAvail = remaining();
  if (qty > maxAvail) {
    myQty.value = maxAvail;
    $q.notify({ type: "warning", message: `Maximal verfügbar: ${maxAvail}` });
  }
  await store.setReservation(props.wurst.id, myQty.value || 0);
  $q.notify({ type: "positive", message: "Reservierung gespeichert" });
}

// Admin: Edit/Delete via Emits an Parent
const emit = defineEmits<{
  (e: "edit", w: Wurst): void;
  (e: "delete", w: Wurst): void;
}>();
</script>

<template>
  <q-card flat bordered>
    <q-img :src="wurst.imageUrl" :ratio="16/9" loading="lazy">
      <div class="absolute-top-left q-ma-sm q-pa-xs bg-primary text-white rounded-borders">
        {{ wurst.name }}
      </div>
    </q-img>

    <q-card-section>
      <div class="row justify-between items-center">
        <div class="text-subtitle1">{{ wurst.sausagesPerPack }} Stk / Packung</div>
        <div class="text-subtitle1">{{ wurst.pricePerPack.toFixed(2) }} €</div>
      </div>
      <div class="text-caption text-grey-7">
        Restbestand: <b>{{ remaining() }}</b> von {{ wurst.totalPacks }}
      </div>
    </q-card-section>

    <!-- USER -->
    <q-card-section v-if="auth.meta?.role !== 'admin'">
      <div class="row items-center q-col-gutter-sm">
        <div class="col">
          <q-input
            dense outlined type="number" min="0"
            v-model.number="myQty"
            label="Packungen reservieren"
          />
        </div>
        <div class="col-auto">
          <q-btn color="primary" dense icon="save" label="Speichern" @click="saveReservation" />
        </div>
      </div>
      <div class="text-caption q-mt-xs">
        Preis: <b>{{ priceFor(myQty || 0).toFixed(2) }} €</b>
      </div>
    </q-card-section>

    <!-- ADMIN -->
    <template v-else>
      <q-card-actions align="between">
        <div class="text-caption">
          Reserviert gesamt: <b>{{ reservedSum }}</b>
        </div>
        <div>
          <q-btn dense flat icon="edit" label="Bearbeiten" @click="emit('edit', wurst)" />
          <q-btn dense flat color="negative" icon="delete" label="Löschen" @click="emit('delete', wurst)" />
        </div>
      </q-card-actions>
      <q-separator />
      <AdminReservations :wurst-id="wurst.id" :price-per-pack="wurst.pricePerPack" />
    </template>
  </q-card>
</template>
