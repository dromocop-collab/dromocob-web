"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase.client";

// ✅ region = europe-west1 (konsoldakiyle aynı)
const functions = getFunctions(getFirebaseApp(), "europe-west1");

export async function sendVerifyCodeClient() {
  const fn = httpsCallable(functions, "sendVerifyCode");
  const res = await fn({});
  return res.data as any;
}

export async function verifyCodeClient(code: string) {
  const fn = httpsCallable(functions, "verifyCode");
  const res = await fn({ code });
  return res.data as any;
}