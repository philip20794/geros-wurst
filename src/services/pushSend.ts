// src/services/pushSend.ts
import { httpsCallable } from 'firebase/functions'
import { auth as fbAuth, functions } from '@/firebase'

type SendPushArgs = {
  body: string
  url?: string
}

type SendPushResult = {
  tokenCount: number
  successCount: number
  failureCount: number
  deletedInvalidCount: number
}

/**
 * Sendet eine Push-Nachricht an alle Nutzer (via Cloud Function).
 * Wirft Error wenn nicht eingeloggt oder Function fehlschlägt.
 */
export async function sendPushToAllUsers(args: SendPushArgs): Promise<SendPushResult> {
  const user = fbAuth.currentUser
  if (!user) throw new Error('Nicht eingeloggt')

  // Token refresh (hilft besonders in PWA)
  await user.getIdToken(true)

  const fn = httpsCallable(functions, 'sendPushToAllUsers')
  const res = await fn({
    title: 'Geros Wild',
    body: args.body,
    url: args.url ?? '/',
  })

  return res.data as SendPushResult
}

export async function sendPushToUsers(args: {
  uids: string[]
  body: string
  url?: string
}) {
  const user = fbAuth.currentUser
  if (!user) throw new Error('Nicht eingeloggt')
  await user.getIdToken(true)

  const fn = httpsCallable(functions, 'sendPushToUsers')
  const res = await fn({
    uids: args.uids,
    title: 'Geros Wild',
    body: args.body,
    url: args.url ?? '/',
  })
  return res.data
}
