"use client";

async function post<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.error || "İşlem tamamlanamadı."));
  return data as T;
}

export async function sendPasswordResetCodeClient(email: string) {
  return post<{ ok: true; cooldown: number }>("/api/auth/password-reset/request", { email });
}

export async function confirmPasswordResetCodeClient(
  email: string,
  code: string,
  newPassword: string
) {
  return post<{ ok: true }>("/api/auth/password-reset/confirm", { email, code, newPassword });
}
