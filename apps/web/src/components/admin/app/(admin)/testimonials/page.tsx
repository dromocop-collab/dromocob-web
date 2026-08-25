"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/admin/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "../adminDashboard.module.css";

/* ───── Types ───── */
type TestimonialItem = {
  name: string;
  city: string;
  text: string;
  rating: number;
  product: string;
  avatar?: string;
  verified?: boolean;
};

type ApprovedReview = {
  id: string;
  name: string;
  text: string;
  rating: number;
  productId: string;
  productTitle?: string;
};

/* ───── Helpers ───── */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function emptyItem(): TestimonialItem {
  return { name: "", city: "", text: "", rating: 5, product: "", avatar: "", verified: false };
}

const READY_TEMPLATES: TestimonialItem[] = [
  { name: "", city: "", product: "Hediye Alışverişi", rating: 5, verified: false, text: "[Ürün adı] hediye olarak aldım. Paketleme çok özenliydi ve ürün beklediğimden daha şık ulaştı. Teslimat sürecinden de çok memnun kaldım." },
  { name: "", city: "", product: "Online Alışveriş", rating: 5, verified: false, text: "İlk kez online özel ürün siparişi verdim. Süreç boyunca bilgilendirildim; ürün sertifikası ve güvenli paketiyle eksiksiz ulaştı." },
  { name: "", city: "", product: "Kişisel Danışmanlık", rating: 5, verified: false, text: "Karar vermeden önce danışmanlık aldım. Bütçeme ve aradığım stile uygun seçenekler sunuldu, iletişim gerçekten çok ilgiliydi." },
  { name: "", city: "", product: "Altın Takı", rating: 5, verified: false, text: "Ürünün işçiliği, parlaklığı ve zarif duruşu çok güzel. Fotoğraflarda beğenmiştim ama yakından çok daha etkileyici görünüyor." },
  { name: "", city: "", product: "Mağaza Deneyimi", rating: 5, verified: false, text: "Mağazada sakin ve güven veren bir alışveriş deneyimi yaşadım. Tüm sorularım açıkça yanıtlandı, gönül rahatlığıyla seçim yaptım." },
];

function stars(n: number) {
  return "★".repeat(Math.max(0, Math.min(5, n))) + "☆".repeat(Math.max(0, 5 - n));
}

/* ───── Shared styles ───── */
const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "0 14px",
  border: "1px solid rgba(15,23,42,.10)",
  borderRadius: 14,
  background: "#f8fbff",
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  padding: "10px 14px",
  resize: "vertical" as const,
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  marginBottom: 6,
};

const miniBtn: React.CSSProperties = {
  minHeight: 34,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,.08)",
  background: "#fff",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  transition: "background .18s ease",
};

const dangerBtn: React.CSSProperties = {
  ...miniBtn,
  background: "rgba(239,68,68,.06)",
  color: "#b91c1c",
  border: "1px solid rgba(239,68,68,.14)",
};

const saveBtn: React.CSSProperties = {
  minHeight: 48,
  padding: "0 28px",
  borderRadius: 16,
  border: 0,
  background: "linear-gradient(135deg,#1d4ed8 0%,#1e40af 100%)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 16px 30px rgba(29,78,216,.24)",
  transition: "transform .18s ease,box-shadow .18s ease",
};

const primaryBtn: React.CSSProperties = {
  ...miniBtn,
  background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%)",
  color: "#fff",
  border: "1px solid #0f172a",
  boxShadow: "0 10px 22px rgba(15,23,42,.14)",
  minHeight: 40,
  padding: "0 18px",
  fontSize: 13,
};

/* ───── Component ───── */
function AdminTestimonialsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [items, setItems] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [approvedReviews, setApprovedReviews] = useState<ApprovedReview[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());

  // Title/subtitle
  const [titleTr, setTitleTr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [subtitleTr, setSubtitleTr] = useState("");
  const [subtitleEn, setSubtitleEn] = useState("");

  // Load from Firestore
  useEffect(() => {
    const ref = doc(db, "site_options", "home_settings");

    return onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as any) || {};
        const testimonials = data.testimonials || {};

        setTitleTr(safeStr(testimonials.title?.tr));
        setTitleEn(safeStr(testimonials.title?.en));
        setSubtitleTr(safeStr(testimonials.subtitle?.tr));
        setSubtitleEn(safeStr(testimonials.subtitle?.en));

        if (Array.isArray(testimonials.items) && testimonials.items.length > 0) {
          setItems(
            testimonials.items.map((x: any) => ({
              name: safeStr(x?.name),
              city: safeStr(x?.city),
              text: safeStr(x?.text),
              rating: Math.max(1, Math.min(5, Number(x?.rating) || 5)),
              product: safeStr(x?.product),
              avatar: safeStr(x?.avatar),
              verified: x?.verified === true,
            }))
          );
        } else {
          setItems([]);
        }

        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [db]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  // Save
  async function handleSave() {
    setSaving(true);
    try {
      const ref = doc(db, "site_options", "home_settings");

      const cleanItems = items
        .filter((x) => safeStr(x.text))
        .map((x) => ({
          name: safeStr(x.name),
          city: safeStr(x.city),
          text: safeStr(x.text),
          rating: Math.max(1, Math.min(5, x.rating || 5)),
          product: safeStr(x.product),
          ...(safeStr(x.avatar) ? { avatar: safeStr(x.avatar) } : {}),
          verified: x.verified === true,
        }));

      await setDoc(
        ref,
        {
          testimonials: {
            title: { tr: titleTr, en: titleEn },
            subtitle: { tr: subtitleTr, en: subtitleEn },
            items: cleanItems,
            enabled: true,
          },
        },
        { merge: true }
      );

      showToast("✅ Vitrin yorumları kaydedildi!");
    } catch (e: any) {
      showToast("❌ Hata: " + (e?.message || "Kaydedilemedi"));
    } finally {
      setSaving(false);
    }
  }

  // Item helpers
  function updateItem(i: number, field: keyof TestimonialItem, value: any) {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveItem(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addNewItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function addReadyTemplates() {
    setItems((prev) => [...prev, ...READY_TEMPLATES.map((item) => ({ ...item }))]);
    showToast("✅ 5 profesyonel şablon eklendi. Köşeli alanları ve müşteri bilgilerini gerçek yoruma göre düzenle.");
  }

  // Import from approved product reviews
  async function loadApprovedReviews() {
    setImportLoading(true);
    try {
      const q = query(
        collection(db, "product_reviews"),
        where("approved", "==", true),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const list: ApprovedReview[] = snap.docs.map((d) => {
        const x: any = d.data();
        return {
          id: d.id,
          name: safeStr(x?.name) || "Misafir",
          text: safeStr(x?.text),
          rating: Math.max(1, Math.min(5, Number(x?.rating) || 5)),
          productId: safeStr(x?.productId),
          productTitle: safeStr(x?.productTitle),
        };
      });

      setApprovedReviews(list);
    } catch (e: any) {
      console.error("load reviews error:", e);
      showToast("❌ Yorumlar yüklenemedi: " + (e?.message || ""));
    } finally {
      setImportLoading(false);
    }
  }

  function openImportModal() {
    setShowImport(true);
    setSelectedImports(new Set());
    loadApprovedReviews();
  }

  function toggleImportSelect(id: string) {
    setSelectedImports((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmImport() {
    const toImport = approvedReviews.filter((r) => selectedImports.has(r.id));

    const newItems: TestimonialItem[] = toImport.map((r) => ({
      name: r.name,
      city: "",
      text: r.text,
      rating: r.rating,
      product: r.productTitle || r.productId || "",
      avatar: "",
      verified: true,
    }));

    setItems((prev) => [...prev, ...newItems]);
    setShowImport(false);
    showToast(`✅ ${newItems.length} yorum eklendi. Kaydet'e basmayı unutma!`);
  }

  if (loading) {
    return (
      <main className={s.page}>
        <div className={s.loader}>Yükleniyor…</div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            right: 28,
            zIndex: 9999,
            padding: "14px 28px",
            borderRadius: 16,
            background: toast.startsWith("✅")
              ? "linear-gradient(135deg,#15803d,#166534)"
              : "linear-gradient(135deg,#b91c1c,#991b1b)",
            color: "#fff",
            fontWeight: 900,
            fontSize: 14,
            boxShadow: "0 18px 36px rgba(15,23,42,.18)",
          }}
        >
          {toast}
        </div>
      )}

      {/* Hero */}
      <section className={s.hero}>
        <div className={s.heroCopy}>
          <div className={s.kicker}>Pazarlama • Vitrin Yorumları</div>
          <h1 className={s.h1}>Müşteri Yorumları</h1>
          <p className={s.sub}>
            Anasayfadaki &quot;Müşterilerimiz Ne Diyor?&quot; bölümünde gösterilen yorumları yönetin.
            Yeni yorum ekleyin veya onaylanmış ürün yorumlarından içe aktarın.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor…" : "💾 Kaydet"}
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className={s.statsGrid}>
        <div className={s.statCard}>
          <span className={s.statLabel}>Toplam Yorum</span>
          <strong className={s.statValue}>{items.length}</strong>
        </div>
        <div className={s.statCard}>
          <span className={s.statLabel}>Ort. Puan</span>
          <strong className={s.statValue}>
            {items.length > 0
              ? (items.reduce((sum, x) => sum + x.rating, 0) / items.length).toFixed(1)
              : "—"}
          </strong>
        </div>
        <div className={s.statCard}>
          <span className={s.statLabel}>5 Yıldız</span>
          <strong className={s.statValue}>
            {items.filter((x) => x.rating === 5).length}
          </strong>
        </div>
      </section>

      {/* Title/subtitle settings */}
      <section className={s.card}>
        <div className={s.cardHead}>
          <div>
            <div className={s.cardTitle}>Başlık & Alt Yazı</div>
            <div className={s.cardSub}>Yorum bölümünün üst kısmındaki metinler.</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Başlık (TR)</label>
            <input
              style={inputStyle}
              value={titleTr}
              onChange={(e) => setTitleTr(e.target.value)}
              placeholder="Müşterilerimiz Ne Diyor?"
            />
          </div>
          <div>
            <label style={labelStyle}>Başlık (EN)</label>
            <input
              style={inputStyle}
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="What Our Customers Say"
            />
          </div>
          <div>
            <label style={labelStyle}>Alt Yazı (TR)</label>
            <input
              style={inputStyle}
              value={subtitleTr}
              onChange={(e) => setSubtitleTr(e.target.value)}
              placeholder="Değerli müşterilerimizin gerçek yorumları"
            />
          </div>
          <div>
            <label style={labelStyle}>Alt Yazı (EN)</label>
            <input
              style={inputStyle}
              value={subtitleEn}
              onChange={(e) => setSubtitleEn(e.target.value)}
              placeholder="Real reviews from our valued customers"
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className={s.card}>
        <div className={s.cardHead}>
          <div>
            <div className={s.cardTitle}>Yorumlar ({items.length})</div>
            <div className={s.cardSub}>Sürükle veya ok butonlarıyla sıralama değiştir. Boş metin içeren yorumlar kaydedilmez.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={primaryBtn} onClick={addNewItem}>
              + Yeni Yorum Ekle
            </button>
            <button type="button" style={miniBtn} onClick={addReadyTemplates}>
              ✨ Hazır Yorum Şablonları
            </button>
            <button type="button" style={miniBtn} onClick={openImportModal}>
              📥 Ürün Yorumlarından Aktar
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              minHeight: 140,
              display: "grid",
              placeItems: "center",
              border: "1px dashed rgba(15,23,42,.14)",
              borderRadius: 18,
              background: "#f8fafc",
              color: "#64748b",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Henüz vitrin yorumu yok. &quot;Yeni Yorum Ekle&quot; veya &quot;Ürün Yorumlarından Aktar&quot; butonlarını kullan.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {items.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: 18,
                  border: "1px solid rgba(15,23,42,.08)",
                  borderRadius: 20,
                  background: "rgba(255,255,255,.96)",
                  boxShadow: "0 8px 20px rgba(15,23,42,.04)",
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        display: "inline-grid",
                        placeItems: "center",
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: "linear-gradient(135deg,#1d4ed8,#1e40af)",
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 900,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>
                      {item.name || "İsimsiz"}
                    </span>
                    {item.city && (
                      <span style={{ fontSize: 13, color: "#64748b" }}>— {item.city}</span>
                    )}
                    <span style={{ fontSize: 16, color: "#f59e0b", letterSpacing: 2 }}>
                      {stars(item.rating)}
                    </span>
                    {item.verified ? (
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#15803d", background: "#ecfdf3", padding: "5px 8px", borderRadius: 999 }}>
                        ✓ Onaylı ürün yorumu
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      style={miniBtn}
                      onClick={() => moveItem(i, -1)}
                      disabled={i === 0}
                      title="Yukarı taşı"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      style={miniBtn}
                      onClick={() => moveItem(i, 1)}
                      disabled={i === items.length - 1}
                      title="Aşağı taşı"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      style={dangerBtn}
                      onClick={() => removeItem(i)}
                      title="Sil"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Form fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>İsim</label>
                    <input
                      style={inputStyle}
                      value={item.name}
                      onChange={(e) => updateItem(i, "name", e.target.value)}
                      placeholder="Ayşe K."
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Şehir</label>
                    <input
                      style={inputStyle}
                      value={item.city}
                      onChange={(e) => updateItem(i, "city", e.target.value)}
                      placeholder="İstanbul"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Ürün</label>
                    <input
                      style={inputStyle}
                      value={item.product}
                      onChange={(e) => updateItem(i, "product", e.target.value)}
                      placeholder="yaşam ürünü"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Puan</label>
                    <select
                      style={{ ...inputStyle, minWidth: 70 }}
                      value={item.rating}
                      onChange={(e) => updateItem(i, "rating", Number(e.target.value))}
                    >
                      <option value={5}>5 ★</option>
                      <option value={4}>4 ★</option>
                      <option value={3}>3 ★</option>
                      <option value={2}>2 ★</option>
                      <option value={1}>1 ★</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Yorum Metni</label>
                  <textarea
                    style={textareaStyle}
                    value={item.text}
                    onChange={(e) => updateItem(i, "text", e.target.value)}
                    placeholder="Müşterinin yorum metni..."
                    rows={3}
                  />
                  {!item.verified ? (
                    <div style={{ marginTop: 6, color: "#9a6b16", fontSize: 11, fontWeight: 750 }}>
                      Şablon veya manuel yorum: yayınlamadan önce gerçek müşteri adı, ürün ve metinle doğrula.
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Save bottom */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 0 40px" }}>
        <button type="button" style={saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor…" : "💾 Kaydet"}
        </button>
      </div>

      {/* ═══ Import Modal ═══ */}
      {showImport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(10,16,40,.42)",
            backdropFilter: "blur(10px)",
          }}
          onClick={() => setShowImport(false)}
        >
          <div
            style={{
              width: "min(860px, 100%)",
              maxHeight: "80vh",
              overflow: "auto",
              padding: 28,
              borderRadius: 28,
              background: "#fff",
              boxShadow: "0 30px 60px rgba(15,23,42,.22)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
                  Onaylı Ürün Yorumlarından Aktar
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b", fontWeight: 700 }}>
                  Seçtiğin yorumlar vitrine eklenecek. Kaydet&apos;e basmayı unutma.
                </p>
              </div>
              <button
                type="button"
                style={{ ...miniBtn, fontSize: 18 }}
                onClick={() => setShowImport(false)}
              >
                ✕
              </button>
            </div>

            {importLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                Yorumlar yükleniyor…
              </div>
            ) : approvedReviews.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "#64748b",
                  border: "1px dashed rgba(15,23,42,.14)",
                  borderRadius: 18,
                }}
              >
                Onaylanmış ürün yorumu bulunamadı.
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  {approvedReviews.map((r) => {
                    const isSelected = selectedImports.has(r.id);
                    return (
                      <div
                        key={r.id}
                        onClick={() => toggleImportSelect(r.id)}
                        style={{
                          padding: 16,
                          border: isSelected
                            ? "2px solid #1d4ed8"
                            : "1px solid rgba(15,23,42,.08)",
                          borderRadius: 16,
                          background: isSelected ? "rgba(29,78,216,.04)" : "#f8fafc",
                          cursor: "pointer",
                          transition: "all .18s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleImportSelect(r.id)}
                            style={{ width: 18, height: 18, accentColor: "#1d4ed8" }}
                          />
                          <span style={{ fontWeight: 900, fontSize: 14, color: "#0f172a" }}>
                            {r.name}
                          </span>
                          <span style={{ fontSize: 14, color: "#f59e0b", letterSpacing: 2 }}>
                            {stars(r.rating)}
                          </span>
                          {r.productId && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#64748b",
                                background: "rgba(15,23,42,.05)",
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              {r.productTitle || r.productId}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.5, fontWeight: 600 }}>
                          {r.text}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                  <button type="button" style={miniBtn} onClick={() => setShowImport(false)}>
                    İptal
                  </button>
                  <button
                    type="button"
                    style={{
                      ...primaryBtn,
                      opacity: selectedImports.size === 0 ? 0.5 : 1,
                    }}
                    disabled={selectedImports.size === 0}
                    onClick={confirmImport}
                  >
                    {selectedImports.size > 0
                      ? `${selectedImports.size} Yorum Ekle`
                      : "Seçim Yap"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function AdminTestimonialsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="home_settings">
        <AdminTestimonialsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}
