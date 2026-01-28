<template>
  <q-card flat class="card-wood poll-card" dark>
    <!-- Hero Image -->
    <div class="hero">
      <q-img :src="umfrage.imageUrl" :ratio="16/9" loading="lazy" class="hero-img">
        <!-- Top overlay -->
        <div class="hero-overlay">
          <div class="row items-center justify-between">
            <div class="row items-center no-wrap">
              <q-avatar size="34px" color="secondary" text-color="white" class="q-mr-sm">
                {{ avatarInitial }}
              </q-avatar>
              <div class="column">
                <div class="text-subtitle2">{{ headerTitle }}</div>
                <div class="text-caption opacity-80">
                  Umfrage · {{ wantSum }}x nehme was
                  <span v-if="umfrage.totalPacks != null"> · Ziel {{ umfrage.totalPacks }}</span>
                </div>
              </div>
            </div>

            <!-- Admin menu -->
            <q-btn v-if="isAdmin" flat round dense icon="more_horiz" class="text-white">
              <q-menu anchor="bottom right" self="top right" dark>
                <q-list style="min-width: 210px">
                  <q-item clickable v-close-popup @click="emit('push', umfrage)">
                    <q-item-section avatar><q-icon name="notifications_active" /></q-item-section>
                    <q-item-section>Benachrichtigung an alle senden</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="emit('edit', umfrage)">
                    <q-item-section avatar><q-icon name="edit" /></q-item-section>
                    <q-item-section>Bearbeiten</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="emit('delete', umfrage)">
                    <q-item-section avatar><q-icon name="delete" /></q-item-section>
                    <q-item-section>Löschen</q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item
                    v-if="umfrage.status !== 'converted'"
                    clickable
                    v-close-popup
                    @click="emit('convert', umfrage)"
                  >
                    <q-item-section avatar><q-icon name="transform" /></q-item-section>
                    <q-item-section>In Wurst umwandeln</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </div>

        <!-- Converted badge -->
        <div v-if="umfrage.status === 'converted'" class="converted-badge">
          Umgewandelt ✅
        </div>
      </q-img>
    </div>

    <!-- Body -->
    <q-card-section class="body">
      <div class="title">
        {{ umfrage.name }}
      </div>

      <div class="meta row items-center justify-between q-mt-xs">
        <div class="text-caption opacity-75">
          {{ umfrage.sausagesPerPack }} Würstchen pro Packung
        </div>

        <div class="text-caption opacity-75">
          <span v-if="umfrage.pricePerPack != null">
            {{ Number(umfrage.pricePerPack).toFixed(2) }} €/Kg
          </span>
          <span v-else>Preis offen</span>
        </div>
      </div>

      <!-- Poll progress (wenn Ziel vorhanden) -->
      <div v-if="umfrage.totalPacks != null" class="poll q-mt-md">
        <div class="row items-center justify-between">
          <div class="text-caption opacity-75">Ziel</div>
          <div class="text-caption">
            <b>{{ wantSum }}</b> / <b>{{ umfrage.totalPacks }}</b>
          </div>
        </div>

        <q-linear-progress
          class="q-mt-xs"
          rounded
          :value="goalRatio"
        />

        <div class="text-caption opacity-75 q-mt-xs">
          {{ goalHint }}
        </div>
      </div>

      <q-separator class="q-mt-md" />

      <!-- Reaction footer -->
      <div class="footer q-pt-sm">
        <!-- USER -->
        <template v-if="!isAdmin && umfrage.status !== 'converted'">
          <div class="row items-center justify-between">
            <q-btn
              flat
              no-caps
              class="react"
              :class="{ active: currentQty > 0 }"
              @click="toggleReact"
              :disable="saving"
            >
              <q-icon name="favorite" class="q-mr-xs" />
              <span>Nehme was</span>
              <q-badge v-if="currentQty > 0" rounded class="q-ml-sm">
                {{ currentQty }}
              </q-badge>
            </q-btn>
          </div>

          <q-slide-transition>
            <div v-show="reactOpen" class="react-editor q-mt-sm">
              <div class="row items-center q-col-gutter-sm">
                <div class="col">
                  <q-input
                    dense
                    outlined
                    type="number"
                    min="0"
                    v-model.number="myQty"
                    label="Menge (Packungen)"
                    @keyup.enter="saveWillHaben"
                  />
                </div>

                <div class="col-auto">
                  <q-btn
                    color="primary"
                    unelevated
                    no-caps
                    :loading="saving"
                    label="Speichern"
                    @click="saveWillHaben"
                  />
                </div>

                <div class="col-auto">
                  <q-btn flat round icon="close" @click="reactOpen = false" :disable="saving" />
                </div>
              </div>

              <div class="text-caption opacity-70 q-mt-xs">
                Tipp: <b>0</b> = entfernen
              </div>
            </div>
          </q-slide-transition>
        </template>

        <!-- ADMIN / Converted -->
        <template v-else>
          <div class="row items-center justify-between">
            <q-btn
              flat
              no-caps
              class="react admin-react"
              @click="adminOpen = !adminOpen"
            >
              <q-icon name="group" class="q-mr-xs" />
              <span>Nehme was</span>
              <q-icon :name="adminOpen ? 'expand_less' : 'expand_more'" class="q-ml-sm opacity-80" />
            </q-btn>
          </div>


          <q-slide-transition>
            <div v-show="adminOpen" class="admin-list q-mt-sm">
              <q-inner-loading :showing="loadingList" />

              <q-list dense bordered class="rounded-borders">
                <q-item v-if="!loadingList && willList.length === 0">
                  <q-item-section class="text-caption opacity-75">
                    Noch keine Einträge.
                  </q-item-section>
                </q-item>

                <q-item v-for="row in willList" :key="row.uid">
                  <q-item-section>
                    <div class="text-subtitle2">{{ row.name }}</div>
                  </q-item-section>

                  <q-item-section side>
                    <q-badge rounded>{{ row.quantity }}</q-badge>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </q-slide-transition>
        </template>

      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useUmfragenStore, type Umfrage, type WillHabenEntry } from '@/stores/umfragen'

const props = defineProps<{ umfrage: Umfrage }>()
const emit = defineEmits<{
  (e: 'edit', w: Umfrage): void
  (e: 'push', w: Umfrage): void
  (e: 'delete', w: Umfrage): void
  (e: 'convert', w: Umfrage): void
}>()

const $q = useQuasar()
const auth = useAuthStore()
const store = useUmfragenStore()

const isAdmin = computed(() => auth.meta?.role === 'admin')

// Header identity (minimal, clean)
const headerTitle = computed(() => 'Geros Wild')
const avatarInitial = computed(() => 'G')

const myQty = ref<number>(0)
const currentQty = ref(0)
const wantSum = ref(0)

const reactOpen = ref(false)
const saving = ref(false)

const adminOpen = ref(false)
const willList = ref<WillHabenEntry[]>([])
const loadingList = ref(false)

let unsubList: null | (() => void) = null
let unsubSum: null | (() => void) = null
let unsubMine: null | (() => void) = null

onMounted(async () => {
  unsubSum = store.watchWillHabenSum(props.umfrage.id, (sum) => (wantSum.value = sum))

  unsubMine = store.watchMyWillHaben(props.umfrage.id, (qty) => {
    currentQty.value = qty
    if (!reactOpen.value) myQty.value = qty
  })

  try {
    const initial = await store.getMyWillHaben(props.umfrage.id)
    currentQty.value = initial
    if (!reactOpen.value) myQty.value = initial
  } catch (e) {
    console.error('getMyWillHaben failed', e)
  }
})

onUnmounted(() => {
  if (unsubSum) unsubSum()
  if (unsubMine) unsubMine()
  if (unsubList) unsubList()
})

// Zielanzeige
const goalRatio = computed(() => {
  const target = props.umfrage.totalPacks
  if (target == null || target <= 0) return 0
  return Math.min(1, wantSum.value / target)
})

const goalHint = computed(() => {
  const target = props.umfrage.totalPacks
  if (target == null || target <= 0) return ''
  const rest = Math.max(0, target - wantSum.value)
  return rest === 0 ? 'Ziel erreicht ✅' : `Noch ${rest} bis zum Ziel`
})

// Reaction: One tap => direkt 1 speichern + editor öffnen
async function toggleReact() {
  if (saving.value) return

  if (currentQty.value <= 0) {
    saving.value = true
    try {
      await store.setWillHaben(props.umfrage.id, 1)
      currentQty.value = 1
      myQty.value = 1
      reactOpen.value = true
    } catch (e: any) {
      console.error(e)
      $q.notify({ type: 'negative', message: e?.message || 'Speichern fehlgeschlagen' })
    } finally {
      saving.value = false
    }
    return
  }

  reactOpen.value = !reactOpen.value
  if (reactOpen.value) myQty.value = currentQty.value
}

async function saveWillHaben() {
  saving.value = true
  try {
    const desired = Math.max(0, Math.floor(Number(myQty.value ?? 0)))
    await store.setWillHaben(props.umfrage.id, desired)
    currentQty.value = desired
    reactOpen.value = false
    $q.notify({ type: 'positive', message: desired > 0 ? 'Gespeichert ✅' : 'Entfernt ✅' })
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Speichern fehlgeschlagen' })
  } finally {
    saving.value = false
  }
}

watch(
  () => [isAdmin.value, adminOpen.value, props.umfrage.id] as const,
  async ([admin, open]) => {
    // cleanup
    if (unsubList) {
      unsubList()
      unsubList = null
    }
    willList.value = []

    if (!admin || !open) return

    loadingList.value = true
    unsubList = store.watchWillHabenList(props.umfrage.id, (rows) => {
      willList.value = rows
      loadingList.value = false
    })
  },
  { immediate: true },
)
</script>

<style scoped>
.poll-card {
  max-width: 720px;
  margin: 0 auto;
  border-radius: 18px;
  overflow: hidden;
}

.hero {
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
  overflow: hidden;
}

.hero-img :deep(img) {
  filter: saturate(1.05) contrast(1.05);
}

.hero-overlay {
  position: absolute;
  inset: 0;
  padding: 10px 12px;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0.55),
    rgba(0,0,0,0.15) 55%,
    rgba(0,0,0,0.0)
  );
}

.converted-badge {
  position: absolute;
  bottom: 10px;
  left: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(30, 180, 90, 0.9);
  color: #0b1b0f;
  font-weight: 700;
}

.body {
  padding-top: 14px;
}

.title {
  font-size: 1.05rem;
  line-height: 1.45;
  font-weight: 650;
  white-space: pre-wrap;
  word-break: break-word;
}

.meta {
  gap: 12px;
}

.poll :deep(.q-linear-progress) {
  border-radius: 999px;
}

.footer .react {
  border-radius: 999px;
  padding: 6px 12px;
  opacity: 0.95;
}

.footer .react.active {
  font-weight: 700;
}

.react-editor :deep(.q-field__control) {
  border-radius: 12px;
}

.opacity-70 { opacity: 0.7; }
.opacity-75 { opacity: 0.75; }
.opacity-80 { opacity: 0.8; }
</style>
