<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useQuasar } from "quasar";

const auth = useAuthStore();
const router = useRouter();
const $q = useQuasar();

async function logout() {
  await auth.logout();
  $q.notify({ type: "info", message: "Abgemeldet" });
  router.push({ name: "auth" });
}

</script>

<template>
  <q-page class="flex flex-center">
    <q-card flat  style="max-width:520px; width:100%;" class="card-wood">
      <q-card-section class="bg-negative text-white">
        <div class="row items-center">
          <q-icon name="block" size="md" class="q-mr-sm" />
          <div>
            <div class="text-h6">Zugang gesperrt</div>
            <div class="text-subtitle2">Dein Konto wurde deaktiviert oder abgelehnt</div>
          </div>
        </div>
      </q-card-section>

      <q-card-section class="q-pt-md q-pb-lg text-center">
        <q-icon name="error_outline" color="negative" size="48px" />
        <div class="text-h6 q-mt-md">Kein Zugriff möglich</div>
        <div class="text-body2 q-mt-xs text-grey-7">
          Dein Zugang wurde abgelehnt oder gesperrt.
          <br />
          Wende dich bitte an den Gero, um weitere Informationen zu erhalten.
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions class="q-pa-md">
        <q-btn color="negative" unelevated icon="logout" label="Abmelden" @click="logout" no-caps />
      </q-card-actions>
    </q-card>
  </q-page>
</template>
