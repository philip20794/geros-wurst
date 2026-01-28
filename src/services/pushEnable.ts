// src/services/pushEnable.ts
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { requestPushPermissionAndGetToken } from '@/services/push'
import { auth as fbAuth } from '@/firebase'

type QuasarLike = {
  dialog: any
  notify: (opts: any) => void
}

function snoozePushAsk(days = 7) {
  localStorage.setItem('push_ask_until', String(Date.now() + days * 24 * 60 * 60 * 1000))
}

export async function openEnablePushDialog($q: QuasarLike) {
  if (!('Notification' in window)) {
    $q.notify({ type: 'negative', message: 'Browser unterstützt Push nicht.' })
    return
  }
  //$q.loading.show({ message: 'Aktiviere Push…' })

  const perm = Notification.permission

  if (perm === 'granted') {
    try {
      const token = await requestPushPermissionAndGetToken()
      if (!token) throw new Error('Kein Token erhalten')

      const save = httpsCallable(functions, 'saveFcmToken')
      const last = localStorage.getItem('fcmToken')
      if (last !== token) {
        await save({ token })
        localStorage.setItem('fcmToken', token)
      }

      $q.notify({ type: 'positive', message: 'Push ist aktiviert' })
    } catch (e: any) {
      console.error('save token while granted failed', e, { code: e?.code, details: e?.details })
      $q.notify({ type: 'negative', message: e?.message || 'Konnte Token nicht speichern.' })
    } finally {
      $q.loading.hide()
    }
    return
  }


  if (perm === 'denied') {
    $q.notify({
      type: 'warning',
      message:
        'Push ist blockiert. Bitte in den Website-/Browser-Einstellungen für diese Seite wieder erlauben.',
    })
    $q.loading.hide()
    return
  }

  // perm === 'default' → erst Dialog (User-Geste), dann requestPermission
  $q.dialog({
    class: 'dialog-wood',
    title: 'Push aktivieren?',
    message: 'Möchtest du Benachrichtigungen erhalten?',
    ok: { label: 'Ja, aktivieren', color: 'primary' },
    cancel: { label: 'Abbrechen', flat: true },
    persistent: true,
    }).onOk(async () => {
      try {
        console.log('onOk fired')

        const token = await requestPushPermissionAndGetToken()
        console.log('got token', token)

        if (!token) throw new Error('Kein FCM Token erhalten')

        const user = fbAuth.currentUser
        if (!user) throw new Error('Nicht eingeloggt')
        await user.getIdToken(true)

        const save = httpsCallable(functions, 'saveFcmToken')
        const res = await save({ token })
        console.log('saveFcmToken result', res)

        $q.notify({ type: 'positive', message: 'Push-Benachrichtigung aktiviert ✅' })
      } catch (e: any) {
        console.error('enable push failed', e, { code: e?.code, details: e?.details })
        $q.notify({ type: 'negative', message: e?.message || 'Push-Benachrichtigung konnte nicht aktiviert werden.' })
      } finally {
        $q.loading.hide()
      }
    })
    .onCancel(() => snoozePushAsk(7))
}
