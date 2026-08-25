import { redirect, notFound } from "next/navigation";
import { adminDb } from "@/lib/firebase.admin";
import type { Metadata } from "next";

/**
 * /products/id/[id] → /products/[slug] yönlendirmesi.
 *
 * Bu route eski paylaşılan linkler ve admin panelden gelen
 * ID bazlı URL'ler için 308 permanent redirect yapar.
 * Ürün bulunamazsa 404 döner.
 *
 * Google'ın duplicate content sorununu çözer:
 * - /products/slug (canonical)
 * - /products/id/firebase-id (redirect)
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function getProductSlug(id: string): Promise<string | null> {
  try {
    const db = adminDb();
    const snap = await db.collection("products").doc(id).get();
    if (!snap.exists) return null;

    const data = snap.data() as any;
    const slug = String(data?.slug || "").trim();

    // slug varsa slug'a, yoksa id'ye yönlendir (products/[slug] ikisini de kabul ediyor)
    return slug || id;
  } catch {
    return null;
  }
}

export default async function ProductIdPage({
  params,
}: {
  params: { id: string };
}) {
  const id = decodeURIComponent(params.id);

  if (!id) notFound();

  const slug = await getProductSlug(id);

  if (!slug) notFound();

  // 308 Permanent Redirect → canonical URL
  redirect(`/products/${encodeURIComponent(slug)}`);
}