// src/services/appPrompts.ts
import { openInstallDialog, canPromptInstall, isInstalled } from '@/services/pwaInstall'

type QuasarLike = {
  dialog: any
  notify: (opts: any) => void
}

function shouldAsk(key: string) {
  const until = Number(localStorage.getItem(key) || '0')
  return Date.now() > until
}

function snooze(key: string, days = 7) {
  localStorage.setItem(key, String(Date.now() + days * 24 * 60 * 60 * 1000))
}

// optional: verhindert, dass es mehrfach aufpoppt
let alreadyAsked = false

export function runInstallPrompt($q: QuasarLike) {
  if (alreadyAsked) return

  if (isInstalled()) return
  if (!shouldAsk('pwa_install_ask_until')) return

  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '')
  const canPrompt = canPromptInstall()

  // Wenn weder iOS-Hinweis noch echtes Prompt möglich: nicht fragen
  if (!canPrompt && !isiOS) return

  alreadyAsked = true

  $q.dialog({
    class: 'dialog-wood',
    title: 'App installieren?',
    message: 'Willst du die App auf deinem Homescreen installieren?',
    ok: { label: 'Ja', color: 'primary' },
    cancel: { label: 'Später', flat: true },
    persistent: true,
  })
    .onOk(() => openInstallDialog($q))
    .onCancel(() => snooze('pwa_install_ask_until', 7))
}
