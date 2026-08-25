"use client";

import { getFirebaseAuth } from "@/lib/firebase.client";

/**
 * Admin panelden API çağrıları için auth header'lı fetch.
 * Otomatik olarak Firebase Auth token'ı ekler.
 *
 * Kullanım:
 * ```ts
 * const res = await adminFetch("/api/shipping/create-order", {
 *   method: "POST",
 *   body: JSON.stringify({ orderId }),
 * });
 * ```
 */
export async function adminFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Oturum açık değil. Lütfen tekrar giriş yapın.");
  }

  const token = await user.getIdToken(true);

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
