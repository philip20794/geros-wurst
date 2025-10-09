<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { useAuthStore } from "@/stores/auth";
import { useWurstStore, type Wurst } from "@/stores/wurst";
import WurstCard from "@/components/WurstCard.vue";
import WurstEditDialog from "@/components/WurstEditDialog.vue";

const auth = useAuthStore();
const store = useWurstStore();
const router = useRouter();
const $q = useQuasar();

const editOpen = ref(false);
const editing = ref<Wurst | null>(null);

onMounted(() => { store.watchAll(); });
onUnmounted(() => { store.stop(); });

function toNewWurst() { router.push({ name: "wurst-new" }); }

function adminEdit(w: Wurst) {
  editing.value = w;
  editOpen.value = true;
}
async function onSaveEdit(data: { name: string; sausagesPerPack: number; totalPacks: number; pricePerPack: number }) {
  if (!editing.value) return;
  await store.updateWurst(editing.value.id, data);
  $q.notify({ type: "info", message: "Wurst aktualisiert" });
}
async function adminDelete(w: Wurst) {
  $q.dialog({
    class: "dialog-wood",
    title: "Löschen?",
    message: `${w.name} wirklich löschen?`,
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
      <q-btn no-caps
        v-if="auth.meta?.role === 'admin'"
        color="primary" icon="add" label="Neue Wurst"
        @click="toNewWurst" unelevated
      />
    </div>

    <div class="row q-col-gutter-lg">
      <div v-for="w in store.items" :key="w.id" class="col-12 col-md-6 col-lg-4">
        <WurstCard
          :wurst="w"
          @edit="adminEdit"
          @delete="adminDelete"
        />
      </div>
    </div>

    <WurstEditDialog
      v-model="editOpen"
      :wurst="editing"
      @save="onSaveEdit"
    />
  </q-page>
</template>
