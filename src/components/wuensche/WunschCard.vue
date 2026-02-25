<template>
  <q-card flat class="card-wood post-card" dark :class="{ 'is-wanted': isWanted }">
    <!-- Header -->
    <q-card-section class="q-pb-sm">
      <div class="row items-start justify-between no-wrap">
        <div class="row items-center no-wrap">
          <q-avatar size="38px" color="secondary" text-color="white" class="q-mr-sm">
            {{ avatarInitial }}
          </q-avatar>

          <div class="column header-stack">
            <div class="name-line">{{ displayName }}</div>

            <div class="type-line">
              <span class="type-pill">wünscht sich</span>
              <span class="count" v-if="wantSum > 0">{{ wantSum }} {{ wantSum === 1 ? 'will das auch' : 'wollen das auch' }}</span>
            </div>
          </div>
        </div>

        <!-- Admin actions -->
        <q-btn v-if="isAdmin" flat round dense icon="more_horiz" class="opacity-80">
          <q-menu anchor="bottom right" self="top right" dark>
            <q-list style="min-width: 160px">
              <q-item clickable v-close-popup @click="emit('delete', wunsch)">
                <q-item-section avatar><q-icon name="delete" /></q-item-section>
                <q-item-section>Löschen</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
    </q-card-section>

    <!-- Body -->
    <q-card-section class="q-pt-sm">
      <div class="post-text wish-text">
        „{{ wunsch.name }}“
      </div>
    </q-card-section>

    <q-separator />

    <!-- Footer -->
    <q-card-section class="q-py-sm">
      <!-- USER: Toggle only -->
      <template v-if="!isAdmin">
        <div class="row items-center justify-between">
          <q-btn
            flat
            no-caps
            class="reaction-btn toggle-btn"
            :class="{ active: isWanted }"
            @click="toggleWant"
            :disable="saving"
          >
            <q-icon :name="isWanted ? 'favorite' : 'favorite_border'" class="q-mr-xs" />
            <span class="q-mr-xs">{{ isWanted ? 'Will ich haben' : 'Will ich haben' }}</span>
          </q-btn>
        </div>
      </template>

      <!-- ADMIN: Liste -->
      <template v-else>
        <div class="row items-center justify-between">
          <q-btn
            flat
            no-caps
            class="reaction-btn admin-react"
            @click="adminOpen = !adminOpen"
          >
            <q-icon name="group" class="q-mr-xs" />
            <span>Will ich haben</span>
            <q-icon :name="adminOpen ? 'expand_less' : 'expand_more'" class="q-ml-sm opacity-80" />
          </q-btn>
        </div>

        <q-slide-transition>
          <div v-show="adminOpen" class="q-mt-sm">
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
              </q-item>
            </q-list>
          </div>
        </q-slide-transition>
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useWuenscheStore, type Wunsch, type WillHabenEntry } from '@/stores/wuensche'

const props = defineProps<{ wunsch: Wunsch }>()
const emit = defineEmits<{
  (e: 'edit', w: Wunsch): void
  (e: 'delete', w: Wunsch): void
}>()

const $q = useQuasar()
const auth = useAuthStore()
const store = useWuenscheStore()

const isAdmin = computed(() => auth.meta?.role === 'admin')

// Header: wer hat’s erstellt
const creatorName = ref('')
const displayName = computed(() => creatorName.value || 'Unbekannt')
const avatarInitial = computed(() => {
  const n = (creatorName.value || '').trim()
  return n ? n[0].toUpperCase() : '?'
})

async function loadCreatorName() {
  const uid = props.wunsch.createdBy || ''
  if (!uid) {
    creatorName.value = 'Unbekannt'
    return
  }
  creatorName.value = await store.getUserDisplayName(uid)
}

// Sum + my state
const wantSum = ref(0)
const currentQty = ref(0)
const saving = ref(false)

const isWanted = computed(() => (currentQty.value || 0) > 0)

let unsubSum: null | (() => void) = null
let unsubMine: null | (() => void) = null

// ✅ Admin-Liste
const adminOpen = ref(false)
const willList = ref<WillHabenEntry[]>([])
const loadingList = ref(false)
let unsubList: null | (() => void) = null

onMounted(async () => {
  void loadCreatorName()

  unsubSum = store.watchWillHabenSum(props.wunsch.id, (sum) => (wantSum.value = Math.max(sum - 1, 0)))

  unsubMine = store.watchMyWillHaben(props.wunsch.id, (qty) => {
    currentQty.value = qty
  })

  // fallback fetch
  try {
    const initial = await store.getMyWillHaben(props.wunsch.id)
    currentQty.value = initial
  } catch (e) {
    console.error('getMyWillHaben failed', e)
  }
})

onUnmounted(() => {
  if (unsubSum) unsubSum()
  if (unsubMine) unsubMine()
  if (unsubList) unsubList()
})

async function toggleWant() {
  if (saving.value) return
  saving.value = true
  try {
    const next = isWanted.value ? 0 : 1
    await store.setWillHaben(props.wunsch.id, next)
    currentQty.value = next

    // optional Feedback, eher dezent:
    // $q.notify({ type: 'positive', message: next ? 'Gemerk ✅' : 'Entfernt ✅' })
  } catch (e: any) {
    console.error(e)
    $q.notify({ type: 'negative', message: e?.message || 'Speichern fehlgeschlagen' })
  } finally {
    saving.value = false
  }
}

watch(
  () => props.wunsch.createdBy,
  () => { void loadCreatorName() },
)

// ✅ Admin: nur wenn aufgeklappt => Liste live laden
watch(
  () => [isAdmin.value, adminOpen.value, props.wunsch.id] as const,
  ([admin, open]) => {
    if (unsubList) {
      unsubList()
      unsubList = null
    }
    willList.value = []

    if (!admin || !open) return

    loadingList.value = true
    unsubList = store.watchWillHabenList(props.wunsch.id, (rows) => {
      willList.value = rows
      loadingList.value = false
    })
  },
  { immediate: true },
)
</script>

<style scoped>
.header-stack { gap: 6px; padding-top: 2px; }
.name-line { font-weight: 850; font-size: 1.05rem; line-height: 1.25; }

.type-line { display: flex; align-items: center; gap: 10px; line-height: 1.2; }
.type-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 850;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.92);
}
.count { font-size: 0.82rem; opacity: 0.78; }

.wish-text {
  margin-top: 6px;
  font-size: 1.08rem;
  font-weight: 750;
  line-height: 1.55;
}

.opacity-70 { opacity: 0.7; }

/* ✅ Highlight für "Will ich haben" (grün) */
.post-card.is-wanted {
  outline: 2px solid rgba(0, 200, 83, 0.60);
  box-shadow:
    0 0 0 4px rgba(0, 200, 83, 0.10),
    0 0 18px rgba(0, 200, 83, 0.18);
}

/* Button-Feeling */
.toggle-btn {
  border-radius: 12px;
  padding: 8px 12px;
  font-weight: 850;
  transition: transform 0.08s ease, outline-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.toggle-btn.active {
  outline: 2px solid rgba(0, 200, 83, 0.45);
  background: rgba(0, 200, 83, 0.12);
  box-shadow: 0 0 12px rgba(0, 200, 83, 0.18);
}

.toggle-btn:active {
  transform: translateY(1px);
}
</style>
