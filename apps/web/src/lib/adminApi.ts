import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

export async function listDocs(colName: string, n = 50) {
  const db = getFirebaseDb();
  const qy = query(collection(db, colName), orderBy("updatedAt", "desc"), limit(n));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getDocById(colName: string, id: string) {
  const db = getFirebaseDb();
  const ref = doc(db, colName, id);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as any) : null;
}

export async function upsertDoc(
  colName: string,
  id: string,
  data: any
) {
  const db = getFirebaseDb();
  const ref = doc(db, colName, id);

  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Mevcut kayıt:
    // createdAt ASLA değişmez.
    await setDoc(
      ref,
      {
        ...data,
        // data yanlışlıkla createdAt içeriyorsa bile ezmesini engelle
        createdAt: snap.data()?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return;
  }

  // Yeni kayıt
  await setDoc(
    ref,
    {
      ...data,
      createdAt: data?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function patchDoc(colName: string, id: string, data: any) {
  const db = getFirebaseDb();
  const ref = doc(db, colName, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function removeDoc(colName: string, id: string) {
  const db = getFirebaseDb();
  const ref = doc(db, colName, id);
  await deleteDoc(ref);
}