"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

/* ──────── Types ──────── */

type MobileDraft = {
  id: string;
  title?: string;
  sku?: string;
  barcode?: string;
  gram?: number;
  hasGram?: number;
  weightGram?: number;
  karat?: number;
  stock?: number;
  categoryId?: string;
  categoryName?: string;
  status?: string;
  imageUrl?: string;
  imageUrls?: string[];
  images?: string[];
  notes?: string;
  source?: string;
  mobileDraftId?: string;
  publishedProductId?: string;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
};

/* ──────── Helpers ──────── */

function safeStr(v: any): string {
  const x = String(v ?? "").trim();
  return x && x !== "undefined" && x !== "null" ? x : "";
}

function safeNum(x: any, fb = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
}

function getMainImage(d: MobileDraft): string {
  return (
    safeStr(d.imageUrl) ||
    (Array.isArray(d.imageUrls) && d.imageUrls.length ? safeStr(d.imageUrls[0]) : "") ||
    (Array.isArray(d.images) && d.images.length ? safeStr(d.images[0]) : "")
  );
}

function getAllImages(d: MobileDraft): string[] {
  const all = new Set<string>();
  if (safeStr(d.imageUrl)) all.add(safeStr(d.imageUrl));
  if (Array.isArray(d.imageUrls)) d.imageUrls.forEach((u) => { if (safeStr(u)) all.add(safeStr(u)); });
  if (Array.isArray(d.images)) d.images.forEach((u) => { if (safeStr(u)) all.add(safeStr(u)); });
  return Array.from(all);
}

function toDate(x: any): Date | null {
  if (!x) return null;
  if (x instanceof Date) return x;
  if (typeof x?.toDate === "function") return x.toDate();
  if (typeof x?.seconds === "number") return new Date(x.seconds * 1000);
  if (typeof x === "string") { const d = new Date(x); return isNaN(d.getTime()) ? null : d; }
  if (typeof x === "number") return new Date(x);
  return null;
}

function fmtDate(x: any): string {
  const d = toDate(x);
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function timeAgo(x: any): string {
  const d = toDate(x);
  if (!d) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} saat önce`;
  const days = Math.floor(hrs / 24);
  return `${days} gün önce`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  pending: "Bekliyor",
  published: "Aktarıldı",
  rejected: "Reddedildi",
};

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  draft: { bg: "rgba(245,158,11,0.1)", color: "#92400e", border: "rgba(245,158,11,0.25)" },
  pending: { bg: "rgba(59,130,246,0.1)", color: "#1e40af", border: "rgba(59,130,246,0.25)" },
  published: { bg: "rgba(16,185,129,0.1)", color: "#065f46", border: "rgba(16,185,129,0.25)" },
  rejected: { bg: "rgba(239,68,68,0.1)", color: "#991b1b", border: "rgba(239,68,68,0.25)" },
};

/* ──────── Page ──────── */

export default function MobileProductDraftsPage() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [drafts, setDrafts] = useState<MobileDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterImage, setFilterImage] = useState<"all" | "has" | "none">("all");

  const [editDraft, setEditDraft] = useState<MobileDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MobileDraft | null>(null);
  const [publishTarget, setPublishTarget] = useState<MobileDraft | null>(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Load Drafts ──
  useEffect(() => {
    const qy = query(
      collection(db, "mobile_product_drafts"),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(qy, (snap) => {
      const list: MobileDraft[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setDrafts(list);
      setLoading(false);
    }, () => {
      setDrafts([]);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  // ── Categories from drafts ──
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    drafts.forEach((d) => {
      const id = safeStr(d.categoryId);
      if (id) map.set(id, safeStr(d.categoryName) || id);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "tr"));
  }, [drafts]);

  // ── Filtered + searched ──
  const filtered = useMemo(() => {
    let list = drafts;

    if (filterStatus !== "all") {
      list = list.filter((d) => (safeStr(d.status) || "draft") === filterStatus);
    }

    if (filterCategory !== "all") {
      list = list.filter((d) => safeStr(d.categoryId) === filterCategory);
    }

    if (filterImage === "has") {
      list = list.filter((d) => !!getMainImage(d));
    } else if (filterImage === "none") {
      list = list.filter((d) => !getMainImage(d));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => {
        const hay = [
          safeStr(d.title),
          safeStr(d.sku),
          safeStr(d.barcode),
          safeStr(d.categoryName),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }

    return list;
  }, [drafts, filterStatus, filterCategory, filterImage, search]);

  // ── Toast ──
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Save edit ──
  async function handleSaveEdit() {
    if (!editDraft) return;
    setSaving(true);
    try {
      const ref = doc(db, "mobile_product_drafts", editDraft.id);
      const { id, ...rest } = editDraft;
      await updateDoc(ref, {
        ...rest,
        updatedAt: serverTimestamp(),
      });
      showToast("Taslak güncellendi ✓");
      setEditDraft(null);
    } catch (e) {
      console.error("Save failed:", e);
      showToast("Kaydetme hatası!");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──
  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "mobile_product_drafts", deleteTarget.id));
      showToast("Taslak silindi ✓");
      setDeleteTarget(null);
    } catch (e) {
      console.error("Delete failed:", e);
      showToast("Silme hatası!");
    } finally {
      setSaving(false);
    }
  }

  // ── Publish to products ──
  async function handlePublish() {
    if (!publishTarget) return;
    setSaving(true);
    try {
      const d = publishTarget;
      const imgs = getAllImages(d);
      const title = safeStr(d.title) || "Yeni Ürün";
      const slugBase = safeStr(d.title) || "yeni-urun";

      const productData: Record<string, any> = {
        title: title,
        slug: slugBase
          .toLowerCase()
          .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ]+/gi, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 120),

        sku: safeStr(d.sku),
        barcode: safeStr(d.barcode),
        categoryId: safeStr(d.categoryId),
        categoryIds: safeStr(d.categoryId) ? [safeStr(d.categoryId)] : [],

        gram: safeNum(d.gram || d.weightGram),
        weightGram: safeNum(d.gram || d.weightGram),
        hasGram: safeNum(d.hasGram || d.gram || d.weightGram),
        karat: safeNum(d.karat),
        stock: safeNum(d.stock),

        isActive: false,
        status: "draft",
        source: "mobile_product_drafts",
        mobileDraftId: d.id,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Images
      if (imgs.length > 0) {
        productData.imageUrl = imgs[0];
        productData.mainImage = imgs[0];
        productData.image = imgs[0];
        productData.imageUrls = imgs;
        productData.images = imgs;
      }

      // Notes
      if (safeStr(d.notes)) {
        productData.description = { tr: safeStr(d.notes), en: "" };
      }

      // Specs (ölçüler)
      const specLengthCm = safeNum(d.lengthCm);
      const specWidthMm = safeNum(d.widthMm);
      if (specLengthCm > 0 || specWidthMm > 0) {
        productData.advanced = {
          ...(productData.advanced || {}),
          specs: {
            weightGr: safeNum(d.gram || d.weightGram) || undefined,
            lengthMm: specLengthCm > 0 ? specLengthCm * 10 : undefined,
            widthMm: specWidthMm > 0 ? specWidthMm : undefined,
          },
        };
      }

      // Create product
      const prodRef = doc(collection(db, "products"));
      await setDoc(prodRef, productData);

      // Update draft status
      await updateDoc(doc(db, "mobile_product_drafts", d.id), {
        status: "published",
        publishedProductId: prodRef.id,
        updatedAt: serverTimestamp(),
      });

      showToast(`Ürün oluşturuldu: ${title} ✓`);
      setPublishTarget(null);
    } catch (e) {
      console.error("Publish failed:", e);
      showToast("Aktarma hatası!");
    } finally {
      setSaving(false);
    }
  }

  const totalDrafts = drafts.length;
  const pendingCount = drafts.filter((d) => (safeStr(d.status) || "draft") === "draft" || safeStr(d.status) === "pending").length;
  const publishedCount = drafts.filter((d) => safeStr(d.status) === "published").length;
  const withImageCount = drafts.filter((d) => !!getMainImage(d)).length;

  return (
    <main style={S.page}>
      {/* Toast */}
      {toast && <div style={S.toast}>{toast}</div>}

      {/* ── Header ── */}
      <div style={S.headerRow}>
        <div>
          <Link href="/admin" style={S.backLink}>← Dashboard</Link>
          <h1 style={S.h1}>📱 Mobil Ürün Taslakları</h1>
          <p style={S.subtitle}>
            Mobil uygulamadan gelen taslak ürünleri yönet, düzenle ve ana kataloga aktar.
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <section style={S.statsStrip}>
        <div style={S.statCard}>
          <div style={S.statLabel}>Toplam</div>
          <div style={S.statValue}>{totalDrafts}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>Bekleyen</div>
          <div style={{ ...S.statValue, color: "#b45309" }}>{pendingCount}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>Aktarılan</div>
          <div style={{ ...S.statValue, color: "#059669" }}>{publishedCount}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>Fotoğraflı</div>
          <div style={{ ...S.statValue, color: "#2563eb" }}>{withImageCount}</div>
        </div>
      </section>

      {/* ── Filters ── */}
      <section style={S.filterBar}>
        <input
          type="search"
          style={S.searchInput}
          placeholder="Ürün adı, SKU veya barkod ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={S.selectFilter}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Tüm Durumlar</option>
          <option value="draft">Taslak</option>
          <option value="pending">Bekliyor</option>
          <option value="published">Aktarıldı</option>
          <option value="rejected">Reddedildi</option>
        </select>
        <select
          style={S.selectFilter}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="all">Tüm Kategoriler</option>
          {categories.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select
          style={S.selectFilter}
          value={filterImage}
          onChange={(e) => setFilterImage(e.target.value as any)}
        >
          <option value="all">Fotoğraf Durumu</option>
          <option value="has">Fotoğraflı</option>
          <option value="none">Fotoğrafsız</option>
        </select>
      </section>

      {/* ── List ── */}
      {loading ? (
        <div style={S.empty}>Yükleniyor…</div>
      ) : !filtered.length ? (
        <div style={S.empty}>
          {drafts.length === 0
            ? "Henüz mobil taslak yok. Mobil uygulamadan ürün eklendiğinde burada görünecek."
            : "Filtrelere uygun taslak bulunamadı."}
        </div>
      ) : (
        <section style={S.grid}>
          {filtered.map((d) => {
            const img = getMainImage(d);
            const status = safeStr(d.status) || "draft";
            const sc = STATUS_COLORS[status] || STATUS_COLORS.draft;
            const isPublished = status === "published";

            return (
              <article key={d.id} style={S.card}>
                {/* Image */}
                <div style={S.cardImageWrap}>
                  {img ? (
                    <img src={img} alt={safeStr(d.title) || "Ürün"} style={S.cardImage} />
                  ) : (
                    <div style={S.cardImagePh}>📷</div>
                  )}
                  <div style={{
                    ...S.statusBadge,
                    background: sc.bg,
                    color: sc.color,
                    borderColor: sc.border,
                  }}>
                    {STATUS_LABELS[status] || status}
                  </div>
                </div>

                {/* Info */}
                <div style={S.cardBody}>
                  <div style={S.cardTitle}>{safeStr(d.title) || "İsimsiz Taslak"}</div>

                  <div style={S.metaGrid}>
                    {safeStr(d.sku) && (
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>SKU</span>
                        <span style={S.metaValue}>{d.sku}</span>
                      </div>
                    )}
                    {safeStr(d.barcode) && (
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>Barkod</span>
                        <span style={S.metaValue}>{d.barcode}</span>
                      </div>
                    )}
                    {safeNum(d.gram || d.weightGram) > 0 && (
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>Gram</span>
                        <span style={S.metaValue}>{safeNum(d.gram || d.weightGram)} gr</span>
                      </div>
                    )}
                    {safeNum(d.hasGram) > 0 && (
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>Has Gram</span>
                        <span style={S.metaValue}>{safeNum(d.hasGram)}</span>
                      </div>
                    )}
                    {safeNum(d.karat) > 0 && (
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>Ayar</span>
                        <span style={S.metaValue}>{d.karat} Ayar</span>
                      </div>
                    )}
                    {safeNum(d.stock) > 0 && (
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>Stok</span>
                        <span style={S.metaValue}>{d.stock}</span>
                      </div>
                    )}
                    {safeNum(d.lengthCm) > 0 && (
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>Uzunluk</span>
                        <span style={S.metaValue}>{d.lengthCm} cm</span>
                      </div>
                    )}
                    {safeNum(d.widthMm) > 0 && (
                      <div style={S.metaItem}>
                        <span style={S.metaLabel}>Genişlik</span>
                        <span style={S.metaValue}>{d.widthMm} mm</span>
                      </div>
                    )}
                    {safeStr(d.categoryName || d.categoryId) && (
                      <div style={{ ...S.metaItem, gridColumn: "1 / -1" }}>
                        <span style={S.metaLabel}>Kategori</span>
                        <span style={S.metaValue}>{safeStr(d.categoryName) || safeStr(d.categoryId)}</span>
                      </div>
                    )}
                  </div>

                  <div style={S.cardTime}>
                    {fmtDate(d.updatedAt)} · {timeAgo(d.updatedAt)}
                  </div>

                  {isPublished && safeStr(d.publishedProductId) && (
                    <Link
                      href={`/admin/products/${d.publishedProductId}`}
                      style={S.publishedLink}
                    >
                      Ürünü görüntüle →
                    </Link>
                  )}
                </div>

                {/* Actions */}
                <div style={S.cardActions}>
                  <button style={S.btnEdit} onClick={() => setEditDraft({ ...d })}>
                    ✏️ Düzenle
                  </button>
                  {!isPublished && (
                    <button style={S.btnPublish} onClick={() => setPublishTarget(d)}>
                      🚀 Ürüne Aktar
                    </button>
                  )}
                  <button style={S.btnDelete} onClick={() => setDeleteTarget(d)}>
                    🗑️
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ══ Edit Modal ══ */}
      {editDraft && (
        <div style={S.modalOverlay} onClick={() => !saving && setEditDraft(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>Taslak Düzenle</h2>
              <button style={S.modalClose} onClick={() => !saving && setEditDraft(null)}>✕</button>
            </div>
            <div style={S.modalBody}>
              {([
                { key: "title", label: "Ürün Adı", type: "text" },
                { key: "sku", label: "SKU", type: "text" },
                { key: "barcode", label: "Barkod", type: "text" },
                { key: "gram", label: "Gram", type: "number" },
                { key: "hasGram", label: "Has Gram", type: "number" },
                { key: "karat", label: "Ayar (Karat)", type: "number" },
                { key: "stock", label: "Stok", type: "number" },
                { key: "lengthCm", label: "Uzunluk (cm)", type: "number" },
                { key: "widthMm", label: "Genişlik (mm)", type: "number" },
                { key: "categoryId", label: "Kategori ID", type: "text" },
                { key: "categoryName", label: "Kategori Adı", type: "text" },
                { key: "notes", label: "Notlar", type: "text" },
              ] as const).map(({ key, label, type }) => (
                <div key={key} style={S.formField}>
                  <label style={S.formLabel}>{label}</label>
                  <input
                    style={S.formInput}
                    type={type}
                    value={editDraft[key] ?? ""}
                    onChange={(e) => setEditDraft((prev) => prev ? ({
                      ...prev,
                      [key]: type === "number"
                        ? (e.target.value === "" ? undefined : Number(e.target.value))
                        : e.target.value,
                    }) : prev)}
                  />
                </div>
              ))}
              <div style={S.formField}>
                <label style={S.formLabel}>Durum</label>
                <select
                  style={S.formInput}
                  value={safeStr(editDraft.status) || "draft"}
                  onChange={(e) => setEditDraft((prev) => prev ? ({ ...prev, status: e.target.value }) : prev)}
                >
                  <option value="draft">Taslak</option>
                  <option value="pending">Bekliyor</option>
                  <option value="published">Aktarıldı</option>
                  <option value="rejected">Reddedildi</option>
                </select>
              </div>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnCancel} onClick={() => setEditDraft(null)} disabled={saving}>İptal</button>
              <button style={S.btnSave} onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete Confirm ══ */}
      {deleteTarget && (
        <div style={S.modalOverlay} onClick={() => !saving && setDeleteTarget(null)}>
          <div style={{ ...S.modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>Taslağı Sil</h2>
              <button style={S.modalClose} onClick={() => !saving && setDeleteTarget(null)}>✕</button>
            </div>
            <div style={S.modalBody}>
              <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: 0 }}>
                <strong>{safeStr(deleteTarget.title) || safeStr(deleteTarget.sku) || "Bu taslak"}</strong>{" "}
                kalıcı olarak silinecek. Bu işlem geri alınamaz.
              </p>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnCancel} onClick={() => setDeleteTarget(null)} disabled={saving}>İptal</button>
              <button style={{ ...S.btnDelete, padding: "10px 20px", fontSize: 13 }} onClick={handleDelete} disabled={saving}>
                {saving ? "Siliniyor…" : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Publish Confirm ══ */}
      {publishTarget && (
        <div style={S.modalOverlay} onClick={() => !saving && setPublishTarget(null)}>
          <div style={{ ...S.modal, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>🚀 Ürüne Aktar</h2>
              <button style={S.modalClose} onClick={() => !saving && setPublishTarget(null)}>✕</button>
            </div>
            <div style={S.modalBody}>
              <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: "0 0 12px" }}>
                <strong>{safeStr(publishTarget.title) || safeStr(publishTarget.sku) || "Bu taslak"}</strong>{" "}
                ürün olarak kataloga aktarılacak.
              </p>
              <div style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(59,130,246,0.06)",
                border: "1px solid rgba(59,130,246,0.12)",
                fontSize: 12,
                color: "#1e40af",
                lineHeight: 1.5,
              }}>
                ℹ️ Ürün <strong>pasif</strong> olarak oluşturulacak. Aktifleştirmek için ürün detay sayfasından düzenleyin.
              </div>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnCancel} onClick={() => setPublishTarget(null)} disabled={saving}>İptal</button>
              <button style={S.btnPublish} onClick={handlePublish} disabled={saving}>
                {saving ? "Aktarılıyor…" : "Ürüne Aktar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ═══ Inline Styles ═══ */
const S: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
    padding: "28px 24px 40px",
    maxWidth: 1280,
    margin: "0 auto",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  toast: {
    position: "fixed",
    right: 28,
    bottom: 28,
    zIndex: 9999,
    padding: "14px 20px",
    borderRadius: 18,
    color: "#065f46",
    background: "rgba(236,253,245,0.96)",
    border: "1px solid rgba(16,185,129,0.22)",
    boxShadow: "0 22px 60px rgba(15,23,42,0.20)",
    fontSize: 13,
    fontWeight: 900,
  },

  /* Header */
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  backLink: { fontSize: 13, fontWeight: 700, color: "#64748b", textDecoration: "none" },
  h1: { fontSize: 32, fontWeight: 950, color: "#0f172a", margin: "8px 0 0", letterSpacing: "-0.03em" },
  subtitle: { fontSize: 14, fontWeight: 600, color: "#64748b", marginTop: 6, lineHeight: 1.5 },

  /* Stats */
  statsStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },
  statCard: {
    padding: "18px 16px",
    borderRadius: 20,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  },
  statLabel: { fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" },
  statValue: { fontSize: 28, fontWeight: 950, color: "#0f172a", marginTop: 4 },

  /* Filters */
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    padding: "16px 20px",
    borderRadius: 20,
    background: "#fff",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 6px 20px rgba(15,23,42,0.03)",
  },
  searchInput: {
    flex: "1 1 240px",
    minWidth: 200,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#f8fafc",
    fontSize: 13,
    fontWeight: 600,
    outline: "none",
  },
  selectFilter: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
    cursor: "pointer",
  },

  /* Grid */
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: 16,
  },

  /* Card */
  card: {
    display: "flex",
    flexDirection: "column",
    borderRadius: 22,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#fff",
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
    overflow: "hidden",
    transition: "box-shadow 0.2s ease, transform 0.15s ease",
  },
  cardImageWrap: {
    position: "relative",
    height: 200,
    background: "#f1f5f9",
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  cardImagePh: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    fontSize: 40,
    color: "#cbd5e1",
    background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: "5px 12px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid",
  },
  cardBody: {
    flex: 1,
    padding: "16px 18px 12px",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 10,
    lineHeight: 1.3,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px 12px",
    marginBottom: 10,
  },
  metaItem: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    wordBreak: "break-all",
  },
  cardTime: {
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
    marginTop: 4,
  },
  publishedLink: {
    display: "inline-block",
    marginTop: 6,
    fontSize: 12,
    fontWeight: 800,
    color: "#2563eb",
    textDecoration: "none",
  },
  cardActions: {
    display: "flex",
    gap: 8,
    padding: "12px 18px 16px",
    borderTop: "1px solid rgba(15,23,42,0.06)",
  },
  btnEdit: {
    flex: 1,
    padding: "9px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 800,
    color: "#334155",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  btnPublish: {
    flex: 1,
    padding: "9px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    fontSize: 12,
    fontWeight: 900,
    color: "#fff",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  btnDelete: {
    padding: "9px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.2)",
    background: "rgba(239,68,68,0.06)",
    fontSize: 12,
    fontWeight: 800,
    color: "#dc2626",
    cursor: "pointer",
    transition: "background 0.15s",
  },

  /* Modal */
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15,23,42,0.5)",
    backdropFilter: "blur(6px)",
  },
  modal: {
    width: "90%",
    maxWidth: 560,
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    borderRadius: 24,
    background: "#fff",
    boxShadow: "0 40px 100px rgba(15,23,42,0.25)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 22px",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },
  modalTitle: { fontSize: 18, fontWeight: 950, color: "#0f172a", margin: 0 },
  modalClose: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
    fontSize: 14,
    fontWeight: 900,
    color: "#64748b",
    cursor: "pointer",
  },
  modalBody: {
    flex: 1,
    padding: "18px 22px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "14px 22px",
    borderTop: "1px solid rgba(15,23,42,0.06)",
  },

  /* Form */
  formField: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: 900,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  formInput: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#f8fafc",
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
    outline: "none",
  },

  btnCancel: {
    padding: "10px 20px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#f8fafc",
    fontSize: 13,
    fontWeight: 800,
    color: "#64748b",
    cursor: "pointer",
  },
  btnSave: {
    padding: "10px 20px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    fontSize: 13,
    fontWeight: 900,
    color: "#fff",
    cursor: "pointer",
  },

  /* Empty */
  empty: {
    padding: 40,
    borderRadius: 24,
    border: "1px dashed rgba(148,163,184,0.4)",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 15,
    fontWeight: 700,
    textAlign: "center",
    lineHeight: 1.6,
  },
};
