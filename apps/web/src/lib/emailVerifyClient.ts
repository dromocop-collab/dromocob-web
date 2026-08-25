"use client";

import { getFirebaseAuth } from "@/lib/firebase.client";

async function post<T>(url: string, body: Record<string, unknown>) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Devam etmek için giriş yapın.");
  const token = await user.getIdToken();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.error || "İşlem tamamlanamadı."));
  return data as T;
}

export async function sendVerifyCodeClient() {
  return post<{ ok: true; cooldown?: number; alreadyVerified?: boolean }>("/api/auth/verify-email/request", {});
}

export async function verifyCodeClient(code: string) {
  return post<{ ok: true }>("/api/auth/verify-email/confirm", { code });
}
