<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { db } from "@/firebase";
import { collection, doc, getDoc, onSnapshot, query } from "firebase/firestore";
import { useQuasar } from "quasar";

type Props = {
  wurstId: string;
  pricePerPack: number;
};
const props = defineProps<Props>();

const $q = useQuasar();

type Row = {
  uid: string;
  quantity: number;
  email?: string | null;
  displayName?: string | null;
  price: number; // quantity * pricePerPack
};

const rows = ref<Row[]>([]);
const totalQty = ref(0);
const totalPrice = ref(0);
let unsub: (() => void) | null = null;

// Cache für Userdaten, damit wir pro UID nur einmal lesen
const userCache = new Map<string, { email: string | null; displayName: string | null }>();

async function loadUser(uid: string) {
  if (userCache.has(uid)) return userCache.get(uid)!;
  try {
    const s = await getDoc(doc(db, "users", uid));
    const info = {
      email: s.exists() ? (s.data() as any).email ?? null : null,
      displayName: s.exists() ? (s.data() as any).displayName ?? null : null,
    };
    userCache.set(uid, info);
    return info;
  } catch {
    const info = { email: null, displayName: null };
    userCache.set(uid, info);
    return info;
  }
}

function recomputeTotals(list: Row[]) {
  totalQty.value = list.reduce((a, r) => a + (r.quantity || 0), 0);
  totalPrice.value = list.reduce((a, r) => a + (r.price || 0), 0);
}

onMounted(() => {
  const qy = query(collection(db, "wuerste", props.wurstId, "reservations"));
  unsub = onSnapshot(
    qy,
    async (snap) => {
      // Grundliste (ohne Userdaten)
      const base: Row[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          const uid = data?.uid || d.id;
          const q = Math.max(0, Number(data?.quantity || 0));
          return { uid, quantity: q, price: q * (props.pricePerPack || 0) };
        })
        .filter((r) => r.quantity > 0);

      // Sofort anzeigen mit UID als Fallback (snappy UI)
      rows.value = base.sort((a, b) => b.quantity - a.quantity);
      recomputeTotals(rows.value);

      // Userdaten optional nachladen
      const tasks = base.map(async (r) => {
        const info = await loadUser(r.uid);
        r.email = info.email;
        r.displayName = info.displayName;
      });
      await Promise.all(tasks);
      rows.value = [...base]; // trigger reactivity
      recomputeTotals(rows.value);
    },
    (err) => {
      $q.notify({ type: "negative", message: err.message || "Reservierungen konnten nicht geladen werden." });
    }
  );
});

onUnmounted(() => {
  if (unsub) unsub();
});
</script>

<template>
  <q-expansion-item icon="list" label="Reservierungen anzeigen" dense>
    <q-table
      :rows="rows"
      :columns="[
        { name: 'user', label: 'Benutzer', field: 'displayName', align: 'left' },
        { name: 'email', label: 'E-Mail', field: 'email', align: 'left' },
        { name: 'quantity', label: 'Menge', field: 'quantity', align: 'right' },
        { name: 'price', label: 'Preis (€)', field: 'price', align: 'right',
          format: (v) => (v ?? 0).toFixed(2) }
      ]"
      row-key="uid"
      dense
      flat
      hide-pagination
      :rows-per-page-options="[0]"
      no-data-label="Keine Reservierungen"
    >
      <template #body-cell-user="p">
        <q-td :props="p">
          <div class="row items-center q-gutter-sm">
            <q-avatar size="20px" color="primary" text-color="white">
              {{ (p.row.displayName || p.row.email || p.row.uid || 'U').charAt(0).toUpperCase() }}
            </q-avatar>
            <div>{{ p.row.displayName || p.row.uid }}</div>
          </div>
        </q-td>
      </template>

      <template #bottom>
        <div class="row justify-end q-pa-sm q-gutter-xl full-width">
          <div class="text-caption">
            Summe Menge: <b>{{ totalQty }}</b>
          </div>
          <div class="text-caption">
            Summe Preis: <b>{{ totalPrice.toFixed(2) }} €</b>
          </div>
        </div>
      </template>
    </q-table>
  </q-expansion-item>
</template>
