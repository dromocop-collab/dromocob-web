import { getFunctions, httpsCallable } from "firebase/functions";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseApp, getFirebaseAuth } from "@/lib/firebase.client";

function clearLocalUserState(uid?: string | null) {
  try {
    const keys = [
      "nci_checkout_draft_v1",
      "nci_locale",
      "nci_chat_thread_guest",
      "nci_favorites_guest",
      "nci_cart_guest",
    ];

    if (uid) {
      keys.push(`nci_favorites_${uid}`);
      keys.push(`nci_cart_${uid}`);
    }

    keys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
      try {
        sessionStorage.removeItem(k);
      } catch {}
    });

    window.dispatchEvent(new Event("cart:changed"));
  } catch {}
}

export async function reauthForAccountDelete(user: User, password?: string) {
  const providerIds = user.providerData.map((p) => p.providerId);

  if (providerIds.includes("password")) {
    const email = user.email || "";
    if (!email) throw new Error("E-posta bulunamadı.");
    if (!password) throw new Error("Şifre gerekli.");

    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(user, credential);
    return;
  }

  if (providerIds.includes("google.com")) {
    const provider = new GoogleAuthProvider();
    await reauthenticateWithPopup(user, provider);
    return;
  }

  throw new Error("Bu hesap tipi için tekrar doğrulama desteklenmiyor.");
}

export async function deleteMyAccountClient() {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Oturum bulunamadı.");
  }

  const uid = user.uid;
  const functions = getFunctions(getFirebaseApp(), "europe-west1");
  const fn = httpsCallable(functions, "deleteMyAccountV1");

  await fn({});

  clearLocalUserState(uid);
  await signOut(auth);
}