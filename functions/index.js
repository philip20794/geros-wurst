// functions/index.js (Gen2 / v2)
const admin = require('firebase-admin')
const functions = require('firebase-functions')
admin.initializeApp()
const db = admin.firestore()

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { logger } = require('firebase-functions')

function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function isInvalidTokenError(err) {
  const code = err?.code || ''
  return (
    code.includes('registration-token-not-registered') ||
    code.includes('invalid-registration-token')
  )
}

exports.sendPushToAllUsers = onCall({ region: 'us-central1' }, async (request) => {
  // ✅ Auth kommt hier zuverlässig an
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login erforderlich')
  }

  const uid = request.auth.uid

  // optional: nur approved dürfen broadcasten
  const callerSnap = await db.doc(`users/${uid}`).get().catch(() => null)
  const caller = callerSnap?.exists ? callerSnap.data() : null

  if (caller?.status === 'blocked') {
    throw new HttpsError('permission-denied', 'User ist blockiert')
  }
  if (caller?.status !== 'approved') {
    throw new HttpsError('permission-denied', 'Nur approved User dürfen Push senden')
  }

  const { title = '', body = '', url = '/' } = request.data || {}
  if (typeof title !== 'string' || typeof body !== 'string') {
    throw new HttpsError('invalid-argument', 'title/body ungültig')
  }

  const tokenSnap = await db.collectionGroup('fcmTokens').get()

  const tokenToRef = new Map()
  const tokens = []
  tokenSnap.forEach((doc) => {
    const t = doc.data()?.token
    if (typeof t === 'string' && t.length > 0 && !tokenToRef.has(t)) {
      tokenToRef.set(t, doc.ref)
      tokens.push(t)
    }
  })

  if (tokens.length === 0) {
    return { tokenCount: 0, successCount: 0, failureCount: 0, deletedInvalidCount: 0 }
  }

  let successCount = 0
  let failureCount = 0
  const invalidTokens = []

  for (const batchTokens of chunkArray(tokens, 500)) {
    const message = {
      tokens: batchTokens,
      data: {
        title: title || 'Geros Wild',
        body: body || '',
        url: url || '/',
      },
      notification: { title: 'Geros Wild', body: body || '' },
      webpush: {
        fcmOptions: { link: url || '/' }
      }
    }

    const resp = await admin.messaging().sendEachForMulticast(message)
    successCount += resp.successCount
    failureCount += resp.failureCount

    resp.responses.forEach((r, idx) => {
      if (!r.success && isInvalidTokenError(r.error)) {
        invalidTokens.push(batchTokens[idx])
      }
    })
  }

  await Promise.all(
    invalidTokens
      .map((t) => tokenToRef.get(t))
      .filter(Boolean)
      .map((ref) => ref.delete().catch(() => null))
  )

  return {
    tokenCount: tokens.length,
    successCount,
    failureCount,
    deletedInvalidCount: invalidTokens.length,
  }
})

exports.sendPushToUsers = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login erforderlich')

  const uid = request.auth.uid

  // gleiche Caller-Checks wie bei dir
  const callerSnap = await db.doc(`users/${uid}`).get().catch(() => null)
  const caller = callerSnap?.exists ? callerSnap.data() : null
  if (caller?.status === 'blocked') throw new HttpsError('permission-denied', 'User ist blockiert')
  if (caller?.status !== 'approved') throw new HttpsError('permission-denied', 'Nur approved User dürfen Push senden')

  const { uids, title = '', body = '', url = '/' } = request.data || {}

  if (!Array.isArray(uids) || uids.length === 0) {
    throw new HttpsError('invalid-argument', 'uids fehlt/leer')
  }
  if (uids.length > 2000) {
    throw new HttpsError('invalid-argument', 'uids zu groß (max 2000)')
  }
  if (typeof title !== 'string' || typeof body !== 'string' || typeof url !== 'string') {
    throw new HttpsError('invalid-argument', 'title/body/url ungültig')
  }

  // Tokens NUR der gewünschten UIDs sammeln
  const tokens = []
  const tokenToRef = new Map()

  await Promise.all(
    uids.map(async (targetUid) => {
      const snap = await db.collection(`users/${targetUid}/fcmTokens`).get().catch(() => null)
      if (!snap) return
      snap.forEach((d) => {
        const t = d.data()?.token
        if (typeof t === 'string' && t.length > 0 && !tokenToRef.has(t)) {
          tokenToRef.set(t, d.ref)
          tokens.push(t)
        }
      })
    }),
  )

  if (tokens.length === 0) {
    return { uidCount: uids.length, tokenCount: 0, successCount: 0, failureCount: 0, deletedInvalidCount: 0 }
  }

  let successCount = 0
  let failureCount = 0
  const invalidTokens = []

  for (const batchTokens of chunkArray(tokens, 500)) {
    const message = {
      tokens: batchTokens,
      data: { title: title || 'Geros Wild', body: body || '', url: url || '/' },
      notification: { title: 'Geros Wild', body: body || '' },
      webpush: {
        fcmOptions: { link: url || '/' }
      }
    }

    const resp = await admin.messaging().sendEachForMulticast(message)
    successCount += resp.successCount
    failureCount += resp.failureCount

    resp.responses.forEach((r, idx) => {
      if (!r.success && isInvalidTokenError(r.error)) invalidTokens.push(batchTokens[idx])
    })
  }

  await Promise.all(
    invalidTokens
      .map((t) => tokenToRef.get(t))
      .filter(Boolean)
      .map((ref) => ref.delete().catch(() => null)),
  )

  return {
    uidCount: uids.length,
    tokenCount: tokens.length,
    successCount,
    failureCount,
    deletedInvalidCount: invalidTokens.length,
  }
})



exports.saveFcmToken = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login erforderlich')
  const token = request.data?.token
  if (typeof token !== 'string' || token.length < 20) {
    throw new HttpsError('invalid-argument', 'token ungültig')
  }
  const uid = request.auth.uid
  const tokenId = encodeURIComponent(token)
  await db.doc(`users/${uid}/fcmTokens/${tokenId}`).set({
    token,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  return { ok: true }
})

async function assertAdmin(uid) {
  const snap = await admin.firestore().doc(`users/${uid}`).get()
  const role = snap.exists ? snap.data().role : null
  if (role !== 'admin') throw new functions.https.HttpsError('permission-denied', 'Nur Admin')
}

exports.convertUmfrageToWurst = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login erforderlich')
  const uid = request.auth.uid
  await assertAdmin(uid)

  const { umfrageId, name, category, sausagesPerPack, totalPacks, pricePerPack } = request.data || {}
  const id = umfrageId
  if (!id) throw new HttpsError('invalid-argument', 'umfrageId fehlt')

  const DEFAULT_CATEGORY = 'Würstchen'

  // 1) Umfrage laden
  const umfrageRef = db.doc(`umfragen/${id}`)
  const umfrageSnap = await umfrageRef.get()
  if (!umfrageSnap.exists) throw new HttpsError('not-found', 'Umfrage nicht gefunden')

  const umfrage = umfrageSnap.data() || {}

  // schon umgewandelt?
  if (umfrage.status === 'converted' && umfrage.convertedWurstId) {
    return { wurstId: umfrage.convertedWurstId, alreadyConverted: true }
  }

  // 2) Werte bestimmen (Dialog überschreibt, sonst Umfrage)
  const finalName = String(name ?? umfrage.name ?? '').trim()
  const finalCategory = String(category ?? umfrage.category ?? DEFAULT_CATEGORY).trim() || DEFAULT_CATEGORY
  const finalSausages = Math.max(1, Math.floor(Number(sausagesPerPack ?? umfrage.sausagesPerPack ?? 1)))
  const finalTotal = Math.max(0, Math.floor(Number(totalPacks ?? umfrage.totalPacks ?? 0)))
  const finalPrice = Math.max(0, Number(Number(pricePerPack ?? umfrage.pricePerPack ?? 0).toFixed(2)))

  if (!finalName) throw new HttpsError('invalid-argument', 'Name fehlt')

  // 3) Wurst anlegen
  const wurstRef = await db.collection('wuerste').add({
    name: finalName,
    category: finalCategory, // ✅ neu
    sausagesPerPack: finalSausages,
    totalPacks: finalTotal,
    pricePerPack: finalPrice,
    reservedPacks: 0,

    // WICHTIG: nicht übernehmen
    imageUrl: '',
    imagePath: '',

    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
    createdFromUmfrageId: id,
  })

  const wurstId = wurstRef.id

  // 4) willhaben -> reservations kopieren
  const willSnap = await umfrageRef.collection('willhaben').get()

  let totalCopied = 0
  const docs = [...willSnap.docs]

  while (docs.length) {
    const chunk = docs.splice(0, 400)
    const batch = db.batch()

    for (const d of chunk) {
      const { uid: rUid, quantity } = d.data() || {}
      const q = Math.max(0, Math.floor(Number(quantity || 0)))
      if (!rUid || q <= 0) continue

      const resRef = db.doc(`wuerste/${wurstId}/reservations/${rUid}`)
      batch.set(
        resRef,
        { uid: rUid, quantity: q, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      )
      totalCopied++
    }

    await batch.commit()
  }

  // 5) Umfrage markieren
  await umfrageRef.set(
    {
      status: 'converted',
      convertedWurstId: wurstId,
      convertedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  return { wurstId, copiedReservations: totalCopied }
})

exports.copyUmfrageImageToWurst = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login erforderlich')

  const { wurstId, sourcePath } = request.data || {}
  if (!wurstId || !sourcePath) throw new HttpsError('invalid-argument', 'wurstId/sourcePath fehlt')

  const bucket = admin.storage().bucket()
  const srcFile = bucket.file(sourcePath)

  const ext = sourcePath.split('.').pop() || 'png'
  const destPath = `wuerste/${wurstId}/cover.${ext}`
  const destFile = bucket.file(destPath)

  await srcFile.copy(destFile)

  // optional: Download-URL wie Firebase es macht ist "token-basiert".
  // Am einfachsten: speichere imagePath und nutze im Frontend getDownloadURL via Firebase SDK.
  await admin.firestore().doc(`wuerste/${wurstId}`).set({
    imagePath: destPath,
  }, { merge: true })

  return { ok: true, imagePath: destPath }
})

exports.cleanupPickedUpPickupsDaily = onSchedule(
  {
    schedule: 'every day 08:50',
    timeZone: 'Europe/Berlin',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '1GiB',
    maxInstances: 1,
  },
  async (event) => {
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000
    const cutoff = admin.firestore.Timestamp.fromMillis(cutoffMs)

    // 1) UIDs sammeln, die mindestens ein "aktives" Pickup haben (state != pickedUp)
    //    Diese UIDs blockieren das Löschen.
    const activeUids = new Set()

    // Pagination (falls viele Docs)
    const PAGE = 5000
    let lastDoc = null

    while (true) {
      let q = db
        .collectionGroup('pickups')
        .where('state', '!=', 'pickedUp')
        .orderBy('state')          // nötig bei "!="
        .orderBy(admin.firestore.FieldPath.documentId())
        .select('uid')
        .limit(PAGE)

      if (lastDoc) q = q.startAfter(lastDoc)

      const snap = await q.get()
      if (snap.empty) break

      for (const d of snap.docs) {
        const uid = d.get('uid')
        if (typeof uid === 'string' && uid) activeUids.add(uid)
      }

      lastDoc = snap.docs[snap.docs.length - 1]
      if (snap.size < PAGE) break
    }

    // 2) Kandidaten: pickedUp + älter als 24h
    let deleted = 0
    let scannedCandidates = 0
    lastDoc = null

    while (true) {
      let q = db
        .collectionGroup('pickups')
        .where('state', '==', 'pickedUp')
        .where('pickedUpAt', '<=', cutoff)
        .orderBy('pickedUpAt')     // nötig wegen "<="
        .orderBy(admin.firestore.FieldPath.documentId())
        .select('uid', 'pickedUpAt')
        .limit(PAGE)

      if (lastDoc) q = q.startAfter(lastDoc)

      const snap = await q.get()
      if (snap.empty) break

      scannedCandidates += snap.size

      // refs sammeln, die gelöscht werden dürfen
      const refsToDelete = []
      for (const doc of snap.docs) {
        const uid = doc.get('uid')
        if (typeof uid !== 'string' || !uid) continue

        // Nur löschen, wenn der User KEINEN aktiven Pickup hat
        if (!activeUids.has(uid)) refsToDelete.push(doc.ref)
      }

      // In Batches löschen (max. 500 Ops; ich nehme 450 als Puffer)
      for (const chunk of chunkArray(refsToDelete, 450)) {
        const batch = db.batch()
        chunk.forEach((ref) => batch.delete(ref))
        await batch.commit()
        deleted += chunk.length
      }

      lastDoc = snap.docs[snap.docs.length - 1]
      if (snap.size < PAGE) break
    }

    logger.info('cleanupPickedUpPickupsDaily done', {
      cutoff: new Date(cutoffMs).toISOString(),
      activeUidCount: activeUids.size,
      scannedCandidates,
      deleted,
    })
  }
)