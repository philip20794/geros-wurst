<template>

      <q-page class="column no-wrap">
        <q-tab-panels v-model="tab" animated swipeable keep-alive :keep-alive-include="['HomeTabWild','HomeTabUmfragen','HomeTabWuensche']" class="col bg-transparent tab-panels-fix">
          <q-tab-panel name="HomeTabWild" class="q-pa-md">
            <HomeTabWild />
          </q-tab-panel>

          <q-tab-panel name="HomeTabUmfragen" class="q-pa-md">
            <HomeTabUmfragen />
          </q-tab-panel>

          <q-tab-panel name="HomeTabWuensche" class="q-pa-md">
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
        <q-route-tab to="/" name="HomeTabWild" icon="outdoor_grill" label="Wild" />
        <q-route-tab to="/umfragen" name="HomeTabUmfragen" icon="poll" label="Umfragen" />
        <q-route-tab to="/wuensche" name="HomeTabWuensche" icon="favorite" label="Wünsche" />
      </q-tabs>
    </q-footer>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HomeTabWild from '@/components/home/HomeTabWild.vue'
import HomeTabUmfragen from '@/components/home/HomeTabUmfragen.vue'
import HomeTabWuensche from '@/components/home/HomeTabWuensche.vue'
import { useAuthStore } from '@/stores/auth'
import { useUmfragenStore } from '@/stores/umfragen'
import { useWuenscheStore } from '@/stores/wuensche'
import { useWurstStore } from '@/stores/wurst'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const wurst = useWurstStore()
const umfragen = useUmfragenStore()
const wuensche = useWuenscheStore()

const tab = ref<'HomeTabWild' | 'HomeTabUmfragen' | 'HomeTabWuensche'>('HomeTabWild')

// verhindert Loop (Route->Tab triggert Tab->Route)
let syncingFromRoute = false

function routeNameToTab(name: any) {
  if (name === 'home-umfragen') return 'HomeTabUmfragen'
  if (name === 'home-wuensche') return 'HomeTabWuensche'
  return 'HomeTabWild'
}
function tabToRouteName(t: any) {
  if (t === 'HomeTabUmfragen') return 'home-umfragen'
  if (t === 'HomeTabWuensche') return 'home-wuensche'
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
//watch(tab, (t) => {
//  if (syncingFromRoute) return
//  const target = tabToRouteName(t)
//  if (route.name !== target) router.replace({ name: target })
//})

const canRead = computed(
  () => !!auth.user && (auth.meta?.role === 'admin' || auth.meta?.status === 'approved')
)
let stopMyRes: null | (() => void) = null

watch(canRead, async (ok) => {
  // immer zuerst den alten weg
  stopMyRes?.()
  stopMyRes = null

  if (ok) {
    // Token kurz “warm machen” (hilft gegen ersten permission-denied)
    try { await auth.user?.getIdToken(true) } catch {}

    wurst.watchAll()
    umfragen.watchAll()
    wuensche.watchAll()

    stopMyRes = wurst.watchMyReservationsAll()
  } else {
    wurst.stop()
    umfragen.stop()
    wuensche.stop()
  }
}, { immediate: true })

onUnmounted(() => {
  stopMyRes?.()
  wurst.stop()
  umfragen.stop()
  wuensche.stop()
})

</script>


<style>
.bottom-tabs {
  background: #355E3B;
  width: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
}

/* in HomeView.vue (nicht scoped, oder mit :deep) */
.tab-panels-fix {
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: transform;
}

</style>
