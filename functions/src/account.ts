import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

async function deleteCollectionDocs(
  db: FirebaseFirestore.Firestore,
  path: string,
  batchSize = 200
) {
  while (true) {
    const snap = await db.collection(path).limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    if (snap.size < batchSize) break;
  }
}

async function anonymizeOrdersForUser(
  db: FirebaseFirestore.Firestore,
  uid: string,
  email: string
) {
  const ordersSnap = await db
    .collection("orders")
    .where("uid", "==", uid)
    .get();

  if (ordersSnap.empty) return;

  const chunks: FirebaseFirestore.QueryDocumentSnapshot[] = ordersSnap.docs;

  for (let i = 0; i < chunks.length; i += 200) {
    const batch = db.batch();
    const part = chunks.slice(i, i + 200);

    for (const doc of part) {
      batch.set(
        doc.ref,
        {
          email: "",
          updatedAt: FieldValue.serverTimestamp(),
          updatedAtIso: new Date().toISOString(),

          customer: {
            firstName: "Silinmiş",
            lastName: "Kullanıcı",
            phone: "",
            email: "",
            nationalId: "",
            birthDate: "",
          },

          shippingAddress: {
            fullName: "Silinmiş Kullanıcı",
            phone: "",
            city: "",
            district: "",
            addressLine: "",
            postalCode: "",
            note: "",
            invoiceType: "individual",
            firstName: "",
            lastName: "",
            nationalId: "",
            companyName: "",
            taxNumber: "",
            taxOffice: "",
          },

          billing: {
            invoiceType: "individual",
            firstName: "",
            lastName: "",
            phone: "",
            nationalId: "",
            companyName: "",
            taxNumber: "",
            taxOffice: "",
          },

          meta: {
            deletedAccount: true,
            deletedAccountAt: FieldValue.serverTimestamp(),
            deletedEmailMasked: email
              ? `deleted-${uid.slice(0, 8)}`
              : "",
          },
        },
        { merge: true }
      );
    }

    await batch.commit();
  }
}

export const deleteMyAccountV1 = onCall(
  { region: "europe-west1" },
  async (req) => {
    const uid = req.auth?.uid;
    const email = safeStr(req.auth?.token?.email);

    if (!uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);

    try {
      await deleteCollectionDocs(db, `users/${uid}/addresses`);
      await deleteCollectionDocs(db, `users/${uid}/favorites`);
      await deleteCollectionDocs(db, `users/${uid}/notifications`);

      await anonymizeOrdersForUser(db, uid, email);

      await userRef.delete();

      await admin.auth().deleteUser(uid);

      return {
        ok: true,
      };
    } catch (error: any) {
      console.error("deleteMyAccountV1 failed:", error);
      throw new HttpsError(
        "internal",
        safeStr(error?.message) || "Account delete failed."
      );
    }
  }
);