<template>

      <q-page class="column no-wrap">
        <q-tab-panels v-model="tab" animated swipeable class="col bg-transparent">
          <q-tab-panel name="wild" class="q-pa-md">
            <HomeTabWild />
          </q-tab-panel>

          <q-tab-panel name="polls" class="q-pa-md">
            <HomeTabUmfragen />
          </q-tab-panel>

          <q-tab-panel name="wishes" class="q-pa-md">
            <HomeTabWuensche />
          </q-tab-panel>
        </q-tab-panels>
      </q-page>
    <q-footer elevated class="bottom-tabs">
      <q-tabs
        v-model="tab"
        dense
        align="justify"
        class="text-white full-width"
        active-color="accent"
        indicator-color="accent"
        narrow-indicator
      >
        <q-tab name="wild" icon="outdoor_grill" label="Wild" />
        <q-tab name="polls" icon="poll" label="Umfragen" />
        <q-tab name="wishes" icon="favorite" label="Wünsche" />
      </q-tabs>
    </q-footer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HomeTabWild from '@/components/home/HomeTabWild.vue'
import HomeTabUmfragen from '@/components/home/HomeTabUmfragen.vue'
import HomeTabWuensche from '@/components/home/HomeTabWuensche.vue'

const route = useRoute()
const router = useRouter()

const tab = ref<'wild' | 'polls' | 'wishes'>('wild')

// verhindert Loop (Route->Tab triggert Tab->Route)
let syncingFromRoute = false

function routeNameToTab(name: any) {
  if (name === 'home-umfragen') return 'polls'
  if (name === 'home-wuensche') return 'wishes'
  return 'wild'
}
function tabToRouteName(t: any) {
  if (t === 'polls') return 'home-umfragen'
  if (t === 'wishes') return 'home-wuensche'
  return 'home'
}

// Route -> Tab
watch(
  () => route.name,
  (name) => {
    syncingFromRoute = true
    tab.value = routeNameToTab(name)
    // nach dem Tick wieder freigeben
    queueMicrotask(() => (syncingFromRoute = false))
  },
  { immediate: true },
)

// Tab -> Route (nur bei User-Aktion / Swipe)
watch(tab, (t) => {
  if (syncingFromRoute) return
  const target = tabToRouteName(t)
  if (route.name !== target) router.replace({ name: target })
})
</script>


<style scoped>
.bottom-tabs {
  background: #355E3B;
  width: 100vw;
  left: 0;
  right: 0;
  z-index: 1000;
}
</style>
