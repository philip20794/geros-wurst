import { httpsCallable } from 'firebase/functions'
import { functions, auth } from '@/firebase'
import { db, storage } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref as sRef, uploadBytesResumable } from 'firebase/storage'

export async function convertUmfrageToWurst(args: {
  umfrageId: string
  name: string
  sausagesPerPack: number
  totalPacks: number
  pricePerPack: number
}) {
  const user = auth.currentUser
  if (!user) throw new Error('Nicht eingeloggt')

  // wichtig: token refresh, damit callable auth sicher ankommt
  await user.getIdToken(true)

  const fn = httpsCallable(functions, 'convertUmfrageToWurst')
  const res = await fn(args)
  return res.data
}

export async function uploadWurstImage(args: {
  wurstId: string
  file: File
  onProgress?: (pct: number) => void
}) {
  if (!args.file.type?.startsWith('image/')) throw new Error('Nur Bilddateien erlaubt')

  const fileName = args.file.name.replace(/\s+/g, '_')
  const path = `wuerste/${args.wurstId}/${Date.now()}_${fileName}`
  const fileRef = sRef(storage, path)

  const task = uploadBytesResumable(fileRef, args.file, {
    contentType: args.file.type || 'image/png',
  })

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100
        args.onProgress?.(Math.round(pct))
      },
      reject,
      () => resolve(),
    )
  })

  const url = await getDownloadURL(fileRef)

  await updateDoc(doc(db, 'wuerste', args.wurstId), {
    imageUrl: url,
    imagePath: path,
  })

  return { imageUrl: url, imagePath: path }
}

export async function copyUmfrageImageToWurst(args: {
  wurstId: string
  sourcePath: string
}) {
  const user = auth.currentUser
  if (!user) throw new Error('Nicht eingeloggt')
  await user.getIdToken(true)

  const fn = httpsCallable(functions, 'copyUmfrageImageToWurst')
  const res = await fn(args)

  const { imagePath } = res.data as any
  if (!imagePath) throw new Error('Kein imagePath von Function erhalten')

  const url = await getDownloadURL(sRef(storage, imagePath))
  await updateDoc(doc(db, 'wuerste', args.wurstId), { imageUrl: url, imagePath })

  return { imageUrl: url, imagePath }
}