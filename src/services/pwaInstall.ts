// src/services/pwaInstall.ts
type QuasarLike = {
  dialog: any
  notify: (opts: any) => void
}

let deferredPrompt: any = null
let onReady: (() => void) | null = null

export function initPwaInstallListener(cb?: () => void) {
  onReady = cb ?? null

  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault()
    deferredPrompt = e
    onReady?.()
  })
}

export function canPromptInstall(): boolean {
  return !!deferredPrompt
}

export function isInstalled(): boolean {
  // Android/Chromium
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS
  // @ts-ignore
  if (window.navigator?.standalone) return true
  return false
}

function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua)
}

export async function openInstallDialog($q: QuasarLike) {
  if (isInstalled()) {
    $q.notify({ type: 'info', message: 'App ist bereits installiert ✅' })
    return
  }

  // Android/Chromium: echtes Prompt
  if (deferredPrompt) {
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    deferredPrompt = null

    if (choice?.outcome === 'accepted') {
      $q.notify({ type: 'positive', message: 'Installation gestartet ✅' })
    } else {
      $q.notify({ type: 'info', message: 'Installation abgebrochen.' })
    }
    return
  }

  // iOS: Anleitung
  if (isIOS()) {
    $q.dialog({
      class: 'dialog-wood',
      title: 'App installieren',
      message:
        'In Safari: Tippe auf „Teilen“ (Quadrat mit Pfeil) und wähle „Zum Home-Bildschirm“.',
      ok: { label: 'OK', color: 'primary' },
    })
    return
  }

  // Fallback
  $q.dialog({
    class: 'dialog-wood',
    title: 'App installieren',
    message:
      'Falls dein Browser Installation unterstützt: Menü (⋮) öffnen und „App installieren“ wählen.',
    ok: { label: 'OK', color: 'primary' },
  })
}

function isInStandaloneMode() {
  // iOS + some browsers
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    // @ts-ignore
    window.navigator.standalone === true
  )
}

export async function openInstallAppDialog($q: QuasarLike) {
  if (isInStandaloneMode()) {
    $q.notify({ type: 'info', message: 'App ist bereits installiert ✅' })
    return
  }

  // ✅ Android/Chromium: echtes Install-Prompt verfügbar
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      deferredPrompt = null

      if (choice?.outcome === 'accepted') {
        $q.notify({ type: 'positive', message: 'Installation gestartet ✅' })
      } else {
        $q.notify({ type: 'info', message: 'Installation abgebrochen.' })
      }
    } catch (e) {
      $q.notify({ type: 'negative', message: 'Installation konnte nicht gestartet werden.' })
    }
    return
  }

  // 🍎 iOS/Safari: nur Anleitung möglich
  if (isIOS()) {
    $q.dialog({
      class: 'dialog-wood',
      title: 'App installieren (iPhone/iPad)',
      message:
        'Öffne diese Seite in Safari. Tippe auf „Teilen“ (Quadrat mit Pfeil) und wähle „Zum Home-Bildschirm“ oder „Zum Startbildschrim hinzufügen“.',
      ok: { label: 'OK', color: 'primary' },
    })
    return
  }

  // Fallback (z.B. Desktop ohne Prompt): Hinweis
  $q.dialog({
    class: 'dialog-wood',
    title: 'App installieren',
    message:
      'Falls dein Browser Installation unterstützt, findest du „App installieren“ oder „Zum Startbildschrim hinzufügen“ im Browser-Menü (⋮) oder in der Adressleiste.',
    ok: { label: 'OK', color: 'primary' },
  })
}
