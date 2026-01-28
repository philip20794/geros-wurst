<template>
  <q-card flat class="card-wood post-card" dark>
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
              <span class="type-pill">wünscht sicht</span>
              <span class="count" v-if="wantSum > 1">{{ wantSum }} wollen das auch</span>
            </div>

          </div>
        </div>

        <!-- Admin actions -->
        <q-btn
          v-if="isAdmin"
          flat
          round
          dense
          icon="more_horiz"
          class="opacity-80"
        >
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

    <!-- Body (Fließtext) -->
    <q-card-section class="q-pt-sm">
      <div class="post-text wish-text">
        „{{ wunsch.name }}“
      </div>
    </q-card-section>

    <q-separator />

    <!-- Reaction Bar -->
    <q-card-section class="q-py-sm">
      <div class="row items-center justify-between">
        <q-btn
          flat
          no-caps
          class="reaction-btn"
          :class="{ active: currentQty > 0 }"
          @click="toggleReact"
          :disable="isAdmin || saving"
        >
          <q-icon name="favorite" class="q-mr-xs" />
          <span class="q-mr-xs">Will ich haben</span>
          <q-badge
            v-if="currentQty > 0"
            rounded
            class="q-ml-xs"
          >
            {{ currentQty }}
          </q-badge>
        </q-btn>
      </div>

      <!-- Inline “Composer” für Menge -->
      <q-slide-transition>
        <div v-show="reactOpen && !isAdmin" class="q-mt-sm">
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
              >
                <template #prepend>
                  <q-icon name="shopping_bag" />
                </template>
              </q-input>
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
              <q-btn
                flat
                round
                icon="close"
                @click="reactOpen = false"
                :disable="saving"
              />
            </div>
          </div>

          <div class="text-caption q-mt-xs opacity-70">
            Tipp: <b>0</b> = Will ich doch nicht haben
          </div>
        </div>
      </q-slide-transition>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores/auth'
import { useWuenscheStore, type Wunsch } from '@/stores/wuensche'

const props = defineProps<{ wunsch: Wunsch }>()
const emit = defineEmits<{
  (e: 'edit', w: Wunsch): void
  (e: 'delete', w: Wunsch): void
}>()

const $q = useQuasar()
const auth = useAuthStore()
const store = useWuenscheStore()

const isAdmin = computed(() => auth.meta?.role === 'admin')

// für “Post”-Header
const creatorName = ref('')  // Anzeige im Header

const displayName = computed(() => creatorName.value || 'Unbekannt')

const avatarInitial = computed(() => {
  const n = (creatorName.value || '').trim()
  if (!n) return '?'
  // erstes "Wort"-Initial
  return n[0].toUpperCase()
})

// lädt den Namen (mit Cache im Store)
async function loadCreatorName() {
  const uid = props.wunsch.createdBy || ''
  if (!uid) {
    creatorName.value = 'Unbekannt'
    return
  }
  creatorName.value = await store.getUserDisplayName(uid)
}

const myQty = ref<number>(0)
const currentQty = ref(0)
const wantSum = ref(0)

const reactOpen = ref(false)
const saving = ref(false)

let unsubSum: null | (() => void) = null
let unsubMine: null | (() => void) = null

onMounted(async () => {
  loadCreatorName()
  unsubSum = store.watchWillHabenSum(props.wunsch.id, (sum) => (wantSum.value = sum))

  unsubMine = store.watchMyWillHaben(props.wunsch.id, (qty) => {
    currentQty.value = qty
    // wenn User noch nix tippt, Sync übernehmen
    if (!reactOpen.value) myQty.value = qty
  })

  // fallback fetch
  try {
    const initial = await store.getMyWillHaben(props.wunsch.id)
    currentQty.value = initial
    if (!reactOpen.value) myQty.value = initial
  } catch (e) {
    console.error('getMyWillHaben failed', e)
  }
})

onUnmounted(() => {
  if (unsubSum) unsubSum()
  if (unsubMine) unsubMine()
})

async function toggleReact() {
  if (isAdmin.value || saving.value) return

  // wenn noch keine Reaktion: sofort 1 setzen + Editor öffnen
  if (currentQty.value <= 0) {
    saving.value = true
    try {
      await store.setWillHaben(props.wunsch.id, 1)
      currentQty.value = 1
      myQty.value = 1
      reactOpen.value = true
      // optional: kein Notify, fühlt sich mehr wie "Reaction" an
      // $q.notify({ type: 'positive', message: 'Will haben ✅' })
    } catch (e: any) {
      console.error(e)
      $q.notify({ type: 'negative', message: e?.message || 'Speichern fehlgeschlagen' })
    } finally {
      saving.value = false
    }
    return
  }

  // bereits reagiert -> nur Editor auf/zu
  reactOpen.value = !reactOpen.value
  if (reactOpen.value) myQty.value = currentQty.value
}


async function saveWillHaben() {
  saving.value = true
  try {
    const desired = Math.max(0, Math.floor(Number(myQty.value ?? 0)))
    await store.setWillHaben(props.wunsch.id, desired)
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
  () => props.wunsch.createdBy,
  () => { void loadCreatorName() },
)
</script>

<style scoped>
.header-stack {
  gap: 6px;              /* mehr Luft zwischen Zeilen */
  padding-top: 2px;
}

.name-line {
  font-weight: 850;
  font-size: 1.05rem;
  line-height: 1.25;
}

.type-line {
  display: flex;
  align-items: center;
  gap: 10px;
  line-height: 1.2;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;     /* etwas höher */
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 850;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.92);
}

.count {
  font-size: 0.82rem;
  opacity: 0.78;
}

.wish-line {
  font-size: 0.92rem;
  font-weight: 650;
  opacity: 0.9;
  line-height: 1.25;
  margin-top: -2px;      /* optisch näher an die Meta-Line, aber nicht gequetscht */
}

.wish-text {
  margin-top: 6px;       /* Body bekommt Luft nach oben */
  font-size: 1.08rem;
  font-weight: 750;
  line-height: 1.55;     /* wichtig: macht den Text weniger „gequetscht“ */
}

</style>
