"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./homeSectionsOrder.module.css";

type SectionMeta = {
  key: string;
  label: string;
  desc: string;
  icon: string;
  tag?: string;
};

const ALL_SECTIONS: SectionMeta[] = [
  { key: "announcement", label: "Duyuru Barı", desc: "Üst kısımdaki duyuru bandı", icon: "📢", tag: "header" },
  { key: "premiumMarquee", label: "Premium Marquee", desc: "Kayan premium bilgi alanı", icon: "✨", tag: "header" },
  { key: "heroSlider", label: "Hero Slider", desc: "Ana büyük slider alanı", icon: "🖼️", tag: "hero" },
  { key: "heroMosaic", label: "Hero Mosaic", desc: "Görsel grid vitrin alanı", icon: "🧩", tag: "hero" },
  { key: "marketHighlights", label: "Mağaza Avantajları", desc: "Teslimat, iade, destek ve güven mesajları", icon: "✦", tag: "yeni" },
  { key: "selectedProducts", label: "Seçili Ürünler", desc: "Admin seçtiği ürün vitrini", icon: "⭐" },
  { key: "campaignCountdown", label: "Kampanya Sayacı", desc: "Geri sayımlı kampanya banner'ı", icon: "🎯", tag: "yeni" },
  { key: "customerPromiseBand", label: "Müşteri Güvence Bandı", desc: "Kargo, iade, güvenlik bilgileri", icon: "🛡️" },
  { key: "luxuryServices", label: "Hizmetler Şeridi", desc: "Premium hizmet kartları", icon: "💎" },
  { key: "promoDealSlider", label: "Kampanya Slider", desc: "Promosyon / indirim slider'ı", icon: "🏷️" },
  { key: "giftGuide", label: "Hediye Rehberi", desc: "Hediye danışmanlığı vitrini", icon: "🎁" },
  { key: "popularProducts", label: "Popüler Ürünler", desc: "Tab'lı ürün listesi (Tümü, Çok Satanlar...)", icon: "🔥" },
  { key: "trustBadgesTop", label: "Güven Rozetleri (Üst)", desc: "Sertifika ve güvenlik rozetleri", icon: "🏅" },
  { key: "ctaBox", label: "CTA Kutusu", desc: "WhatsApp, Randevu, İletişim yönlendirmesi", icon: "📞" },
  { key: "testimonials", label: "Müşteri Yorumları", desc: "Carousel: yıldız rating + yorum", icon: "💬", tag: "yeni" },
  { key: "socialSection", label: "Instagram Galerisi", desc: "Sosyal medya post/reel grid", icon: "📱", tag: "yeni" },
  { key: "educationHub", label: "Bilgi Merkezi", desc: "Rehber ve eğitim içerikleri", icon: "📚" },
  { key: "recentlyViewed", label: "Son Görüntülenenler", desc: "Kullanıcının son baktığı ürünler", icon: "🕐", tag: "yeni" },
  { key: "trustBadgesBottom", label: "Güven Rozetleri (Alt)", desc: "Alt güven rozetleri tekrarı", icon: "🏅" },
  { key: "conciergeCta", label: "Danışmanlık CTA", desc: "Kişisel danışmanlık çağrısı", icon: "🤝" },
  { key: "featuredCategories", label: "Öne Çıkan Kategoriler", desc: "Kategori slider'ı", icon: "📂" },
  { key: "premiumTrustStrip", label: "Premium Güven Şeridi", desc: "En alttaki güven bandı", icon: "🔒" },
];

const VALID_KEYS = new Set(ALL_SECTIONS.map((x) => x.key));
const DEFAULT_ORDER = ALL_SECTIONS.map((x) => x.key);

// Eski key → yeni key alias haritası
const ALIAS: Record<string, string> = {
  announcementBar: "announcement",
  selectedProductsShowcase: "selectedProducts",
  luxuryServicesStrip: "luxuryServices",
  featuredCategoriesV2: "featuredCategories",
  giftGuideShowcase: "giftGuide",
};

function normalize(k: string): string {
  const trimmed = String(k || "").trim();
  return ALIAS[trimmed] || trimmed;
}

type VisMap = Record<string, boolean>;

function HomeSectionsOrderPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  // items = sıralı key listesi (her zaman 22 eleman, duplikatsız)
  const [items, setItems] = useState<string[]>([]);
  const [vis, setVis] = useState<VisMap>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<"ok" | "err">("ok");

  // ── Load ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "site_options", "home_settings"));
        if (!alive) return;
        const data = snap.exists() ? snap.data() : {};

        // Sıralama
        const raw: string[] = Array.isArray(data?.section_order)
          ? data.section_order.map((x: any) => normalize(x)).filter(Boolean)
          : [];

        const seen = new Set<string>();
        const clean: string[] = [];
        for (const k of raw) {
          if (VALID_KEYS.has(k) && !seen.has(k)) {
            seen.add(k);
            clean.push(k);
          }
        }
        // Eksik olanları sona ekle
        for (const k of DEFAULT_ORDER) {
          if (!seen.has(k)) clean.push(k);
        }

        // Görünürlük
        const rawVis = (data?.section_visibility && typeof data.section_visibility === "object")
          ? data.section_visibility
          : {};
        const v: VisMap = {};
        for (const k of DEFAULT_ORDER) {
          // Hem yeni hem eski key'den oku
          const oldKey = Object.entries(ALIAS).find(([, val]) => val === k)?.[0];
          const stored = rawVis[k] ?? (oldKey ? rawVis[oldKey] : undefined);
          v[k] = typeof stored === "boolean" ? stored : true;
        }

        setItems(clean);
        setVis(v);
      } catch (err) {
        console.error("load error:", err);
      }
    })();
    return () => { alive = false; };
  }, [db]);

  // ── Toggle ──
  const toggle = useCallback((key: string) => {
    setVis((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Move ──
  const moveUp = useCallback((key: string) => {
    setItems((prev) => {
      const idx = prev.indexOf(key);
      if (idx <= 0) return prev;
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }, []);

  const moveDown = useCallback((key: string) => {
    setItems((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      return arr;
    });
  }, []);

  // ── Bulk ──
  const showAll = useCallback(() => {
    setVis((prev) => {
      const next = { ...prev };
      for (const k of DEFAULT_ORDER) next[k] = true;
      return next;
    });
  }, []);

  const hideAll = useCallback(() => {
    setVis((prev) => {
      const next = { ...prev };
      for (const k of DEFAULT_ORDER) next[k] = false;
      return next;
    });
  }, []);

  // ── Save ──
  const save = useCallback(async () => {
    setSaving(true);
    setNote("");
    try {
      await setDoc(
        doc(db, "site_options", "home_settings"),
        { section_order: items, section_visibility: vis },
        { merge: true }
      );
      setNote("✅ Kaydedildi!");
      setNoteType("ok");
    } catch (err) {
      console.error(err);
      setNote("❌ Kayıt hatası");
      setNoteType("err");
    } finally {
      setSaving(false);
    }
  }, [db, items, vis]);

  // ── Stats ──
  const visibleCount = useMemo(() => items.filter((k) => vis[k] !== false).length, [items, vis]);
  const hiddenCount = items.length - visibleCount;

  // ── Filter ──
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");

  const displayItems = useMemo(() => {
    if (filter === "visible") return items.filter((k) => vis[k] !== false);
    if (filter === "hidden") return items.filter((k) => vis[k] === false);
    return items;
  }, [items, filter, vis]);

  if (!items.length) {
    return (
      <div className={styles.page}>
        <div className={styles.note}>Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>🏠 Anasayfa Yönetimi</div>
          <h1 className={styles.title}>Bölüm Sıralaması & Görünürlük</h1>
          <p className={styles.desc}>
            Bölümleri sırala ve aç/kapat ile anasayfayı yönet.
          </p>
        </div>
        <button className={styles.saveBtn} type="button" onClick={save} disabled={saving}>
          {saving ? "⏳ Kaydediliyor..." : "💾 Kaydet"}
        </button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{items.length}</span>
            <span className={styles.statLabel}>Toplam</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statNum} ${styles.statGreen}`}>{visibleCount}</span>
            <span className={styles.statLabel}>Açık</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statNum} ${styles.statRed}`}>{hiddenCount}</span>
            <span className={styles.statLabel}>Gizli</span>
          </div>
        </div>

        <div className={styles.filterRow}>
          {(["all", "visible", "hidden"] as const).map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {f === "all" ? "Tümü" : f === "visible" ? "Açık" : "Gizli"}
            </button>
          ))}
          <div className={styles.filterSep} />
          <button className={styles.bulkBtn} type="button" onClick={showAll}>Tümünü Aç</button>
          <button className={styles.bulkBtn} type="button" onClick={hideAll}>Tümünü Kapat</button>
        </div>
      </div>

      {note && (
        <div className={`${styles.note} ${noteType === "err" ? styles.noteErr : ""}`}>
          {note}
        </div>
      )}

      {/* List */}
      <div className={styles.list}>
        {displayItems.map((key) => {
          const realIdx = items.indexOf(key);
          const meta = ALL_SECTIONS.find((x) => x.key === key);
          const isOn = vis[key] !== false;

          return (
            <div key={key} className={`${styles.card} ${!isOn ? styles.cardHidden : ""}`}>
              <div className={styles.cardIcon}>{meta?.icon || "📦"}</div>

              <div className={styles.cardInfo}>
                <div className={styles.cardTop}>
                  <div className={styles.label}>{meta?.label || key}</div>
                  {meta?.tag === "yeni" && <span className={styles.newBadge}>YENİ</span>}
                </div>
                <div className={styles.sub}>{meta?.desc || key}</div>
                <div className={styles.keyTag}>{key}</div>
              </div>

              <div className={styles.cardOrder}>#{realIdx + 1}</div>

              <div className={styles.actions}>
                <button
                  className={`${styles.toggleBtn} ${isOn ? styles.toggleOn : styles.toggleOff}`}
                  type="button"
                  onClick={() => toggle(key)}
                >
                  {isOn ? "✅ Açık" : "⛔ Gizli"}
                </button>

                <button
                  className={styles.actionBtn}
                  type="button"
                  onClick={() => moveUp(key)}
                  disabled={realIdx === 0}
                >
                  ▲
                </button>

                <button
                  className={styles.actionBtn}
                  type="button"
                  onClick={() => moveDown(key)}
                  disabled={realIdx === items.length - 1}
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HomeSectionsOrderPage() {
  return (
    <AdminGate>
      <PermissionGate permission="home_settings">
        <HomeSectionsOrderPageInner />
      </PermissionGate>
    </AdminGate>
  );
}
