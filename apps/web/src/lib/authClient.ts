"use client";

import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  type UserCredential,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase.client";
import { syncCartAfterAuth } from "@/lib/cart";

async function applyPersistence(remember: boolean) {
  const auth = getFirebaseAuth();
  await setPersistence(
    auth,
    remember ? browserLocalPersistence : browserSessionPersistence
  );
  return auth;
}

function runPostAuthSync(cred: UserCredential | null) {
  const user = cred?.user;
  if (!user || user.isAnonymous) return;

  try {
    syncCartAfterAuth(user.uid);
  } catch (err) {
    console.error("post-auth cart sync error:", err);
  }

  // Misafirken kazanılmış, kullanılmamış ve süresi geçmemiş kuponları hesaba bağla.
  if (user.email) {
    syncGuestCoupons(user.uid).catch((err) => {
      console.error("post-auth coupon sync error:", err);
    });
  }
}

async function syncGuestCoupons(uid: string) {
  try {
    const user = getFirebaseAuth().currentUser;
    if (!user || user.uid !== uid) return;
    const idToken = await user.getIdToken();
    await fetch("/api/wheel/sync-coupons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({}),
      keepalive: true,
    });
  } catch {
    // Sessiz hata — kullanıcıyı etkilemez
  }
}

export async function login(email: string, password: string, remember: boolean) {
  const auth = await applyPersistence(remember);
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

  runPostAuthSync(cred);
  return cred;
}

export async function loginWithGoogle(remember: boolean) {
  const auth = await applyPersistence(remember);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const cred = await signInWithPopup(auth, provider);

  runPostAuthSync(cred);
  return cred;
}

export async function loginWithApple(remember: boolean) {
  const auth = await applyPersistence(remember);
  const provider = new OAuthProvider("apple.com");

  // Apple'dan email ve isim bilgisi al (ilk girişte gelir)
  provider.addScope("email");
  provider.addScope("name");
  provider.setCustomParameters({ locale: "tr" });

  const cred = await signInWithPopup(auth, provider);
  runPostAuthSync(cred);
  return cred;
}

/**
 * Email/password kayıt:
 * - kullanıcı oluştur
 * - (opsiyonel) displayName set
 * - ❌ sendEmailVerification yok
 * - ✅ verify code akışı UI tarafında
 */
export async function register(
  email: string,
  password: string,
  displayName?: string
) {
  const auth = await applyPersistence(true);
  const cred = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );

  if (displayName?.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }

  runPostAuthSync(cred);
  return cred;
}

export async function resetPassword(email: string) {
  const auth = getFirebaseAuth();
  const cleanEmail = email.trim();

  if (!cleanEmail) {
    throw new Error("missing_email");
  }

  await sendPasswordResetEmail(auth, cleanEmail);
}
