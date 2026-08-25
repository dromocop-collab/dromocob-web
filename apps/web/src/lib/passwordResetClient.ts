"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase.client";

const functions = getFunctions(getFirebaseApp(), "europe-west1");

export async function sendPasswordResetCodeClient(email: string) {
  const fn = httpsCallable(functions, "requestPasswordResetCode");
  const res = await fn({ email });
  return res.data as { ok: true };
}

export async function confirmPasswordResetCodeClient(
  email: string,
  code: string,
  newPassword: string
) {
  const fn = httpsCallable(functions, "confirmPasswordResetCode");
  const res = await fn({ email, code, newPassword });
  return res.data as { ok: true };
}