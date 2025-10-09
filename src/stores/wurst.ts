// src/stores/wurst.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, db } from '@/firebase'
import {
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDoc,
  setDoc,
  runTransaction,
} from 'firebase/firestore'
import {
  getDownloadURL,
  getStorage,
  ref as sRef,
  uploadBytes,
  deleteObject,
  uploadBytesResumable,
} from 'firebase/storage'
import { useAuthStore } from './auth'

export type Wurst = {
  id: string
  name: string
  sausagesPerPack: number
  totalPacks: number
  reservedPacks: number // per Function gepflegt
  pricePerPack: number
  imageUrl: string
  imagePath: string
}

export const useWurstStore = defineStore('wurst', () => {
  const list = ref<Wurst[]>([])
  const loading = ref(false)
  const unsubRef = ref<null | (() => void)>(null)

  function watchAll() {
    if (unsubRef.value) return
    const q = query(collection(db, 'wuerste'), orderBy('createdAt', 'desc'))
    unsubRef.value = onSnapshot(q, (snap) => {
      list.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Wurst[]
    })
  }

  function stop() {
    if (unsubRef.value) {
      unsubRef.value()
      unsubRef.value = null
    }
  }

  // ADMIN: neue Wurst anlegen (mit Bild)
  async function createWurst(payload: {
  name: string;
  sausagesPerPack: number;
  totalPacks: number;
  pricePerPack: number;
  file: File;
  onProgress?: (pct: number) => void; // optional
  }) {
    const auth = useAuthStore();

    if (!payload.file) throw new Error("Bild fehlt");
    if (!payload.file.type?.startsWith("image/")) throw new Error("Nur Bilddateien erlaubt");

    // 1) Firestore-Dokument anlegen (ID bekommen)
    const docRef = await addDoc(collection(db, "wuerste"), {
      name: payload.name.trim(),
      sausagesPerPack: Number(payload.sausagesPerPack),
      totalPacks: Number(payload.totalPacks),
      pricePerPack: Number(payload.pricePerPack),
      reservedPacks: 0,
      imageUrl: "",
      imagePath: "",
      createdAt: serverTimestamp(),
      createdBy: auth.user?.uid ?? null,
    });

    const fileName = payload.file.name.replace(/\s+/g, "_");
    const path = `wuerste/${docRef.id}/${fileName}`;
    const fileRef = sRef(storage, path);

    // 2) Upload mit korrektem contentType + Progress
    const task = uploadBytesResumable(fileRef, payload.file, {
      contentType: payload.file.type || "image/png",
    });

    try {
      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
            payload.onProgress?.(Math.round(pct));
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      // 3) URL holen & Firestore aktualisieren
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, "wuerste", docRef.id), {
        imageUrl: url,
        imagePath: path,
      });
    } catch (err) {
      // Rollback bei Fehler
      try { await deleteObject(fileRef); } catch {}
      await deleteDoc(doc(db, "wuerste", docRef.id));
      throw err;
    }
  }

  // Optional: beim Löschen Bild mit löschen
  async function deleteWurst(id: string, imagePath?: string) {
    if (imagePath) {
      try {
        await deleteObject(sRef(storage, imagePath))
      } catch {
        /* ignore */
      }
    }
    await deleteDoc(doc(db, 'wuerste', id))
  }

  // ADMIN: bearbeiten
  async function updateWurst(
    id: string,
    data: Partial<Pick<Wurst, 'pricePerPack' | 'totalPacks' | 'name' | 'sausagesPerPack'>>,
  ) {
    await updateDoc(doc(db, 'wuerste', id), data as any)
  }

  // USER: Reservierung setzen (überschreiben)
 async function setReservation(wurstId: string, quantity: number) {
  const auth = useAuthStore();
  if (!auth.user) throw new Error("Nicht eingeloggt");
  const uid = auth.user.uid;

  const rRef = doc(db, "wuerste", wurstId, "reservations", uid);
  const nextQty = Math.max(0, Math.floor(quantity));
  await setDoc(
    rRef,
    { uid, quantity: nextQty, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Live: Summe aller Reservierungen für eine Wurst beobachten
function watchReservedSum(wurstId: string, cb: (sum: number) => void) {
  const qy = collection(db, "wuerste", wurstId, "reservations");
  return onSnapshot(query(qy), (snap) => {
    let sum = 0;
    snap.forEach((d) => { sum += (d.data().quantity || 0); });
    cb(sum);
  });
}

  // User-spezifische Reservierung laden (für Vorbelegung)
  async function getMyReservation(wurstId: string): Promise<number> {
    const auth = useAuthStore()
    if (!auth.user) return 0
    const snap = await getDoc(doc(db, 'wuerste', wurstId, 'reservations', auth.user.uid))
    return snap.exists() ? (snap.data().quantity as number) : 0
  }

  const items = computed(() =>
    list.value.map((w) => ({
      ...w,
      remainingPacks: Math.max(0, (w.totalPacks || 0) - (w.reservedPacks || 0)),
    })),
  )

  return {
    items,
    loading,
    watchAll,
    stop,
    createWurst,
    updateWurst,
    deleteWurst,
    setReservation,
    getMyReservation,
    watchReservedSum,
  }
})
