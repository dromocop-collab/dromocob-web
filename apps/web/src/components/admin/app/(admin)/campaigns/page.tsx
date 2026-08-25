"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "./campaigns.module.css";

type LocaleText = {
  tr?: string;
  en?: string;
};

type CampaignKind = "discount" | "service";
type CampaignType = "percent" | "fixed";
type CampaignTarget = "cart" | "product" | "category";
type CampaignTone = "red" | "gold" | "dark" | "blue" | "green" | "rose";
type CampaignPlacement = "cart" | "checkout" | "product";

type Campaign = {
  id: string;
  kind: CampaignKind;

  requiresCustomerNote?: boolean;
  customerNoteLabel?: LocaleText;
  customerNotePlaceholder?: LocaleText;

  requiresProductText?: boolean;
  productTextLabel?: LocaleText;
  productTextPlaceholder?: LocaleText;
  productTextMaxLength?: number;

  title: LocaleText;
  subtitle?: LocaleText;
  code: string;

  type: CampaignType;
  value: number;
  minCartTry: number;

  servicePriceTry: number;
  freeOverTry: number;
  serviceRequired: boolean;

  target: CampaignTarget;
  productIds: string[];
  categoryIds: string[];
  placement: CampaignPlacement[];
  tone: CampaignTone;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  order: number;
};

type CampaignSettings = {
  enabled: boolean;
  campaigns: Campaign[];
};
type ProductSearchRow = {
  id: string;
  slug: string;
  sku: string;
  title: LocaleText;
  image: string;
  isActive: boolean;
};
const EMPTY_CAMPAIGN: Campaign = {
  id: "",
  kind: "discount",
  requiresProductText: false,
  productTextLabel: { tr: "", en: "" },
  productTextPlaceholder: { tr: "", en: "" },
  productTextMaxLength: 30,
  requiresCustomerNote: false,
  customerNoteLabel: { tr: "", en: "" },
  customerNotePlaceholder: { tr: "", en: "" },

  title: { tr: "", en: "" },
  subtitle: { tr: "", en: "" },
  code: "",

  type: "percent",
  value: 10,
  minCartTry: 0,

  servicePriceTry: 0,
  freeOverTry: 0,
  serviceRequired: false,

  target: "cart",
  productIds: [],
  categoryIds: [],
  placement: ["cart", "checkout"],
  tone: "red",
  isActive: true,
  startsAt: "",
  endsAt: "",
  order: 1,
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function makeId() {
  return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function toNum(v: any, fb = 0) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fb;
}

function splitIds(v: string) {
  return String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function joinIds(v: string[]) {
  return Array.isArray(v) ? v.join(", ") : "";
}
function pickLocaleText(v: any) {
  if (!v) return "";

  if (typeof v === "string") return safeStr(v);

  if (typeof v === "object") {
    return (
      safeStr(v.tr) ||
      safeStr(v.en) ||
      safeStr(v.title) ||
      safeStr(v.name) ||
      ""
    );
  }

  return "";
}

function normalizeSearchText(v: any) {
  return safeStr(v).toLocaleLowerCase("tr-TR");
}

function productLabel(p: ProductSearchRow) {
  return pickLocaleText(p.title) || p.sku || p.slug || p.id;
}

function productKeyForCampaign(p: ProductSearchRow) {
  return p.slug || p.id;
}
function normalizeCampaign(raw: any, index: number): Campaign {
  const kind: CampaignKind = raw?.kind === "service" ? "service" : "discount";

  return {
    id: safeStr(raw?.id) || makeId(),
    kind,

    title: {
      tr: safeStr(raw?.title?.tr || raw?.titleTr),
      en: safeStr(raw?.title?.en || raw?.titleEn),
    },

    subtitle: {
      tr: safeStr(raw?.subtitle?.tr || raw?.subtitleTr),
      en: safeStr(raw?.subtitle?.en || raw?.subtitleEn),
    },

    code: safeStr(raw?.code).toUpperCase(),

    type: raw?.type === "fixed" ? "fixed" : "percent",
    value: Math.max(0, toNum(raw?.value, 0)),
    minCartTry: Math.max(0, toNum(raw?.minCartTry, 0)),

    servicePriceTry: Math.max(0, toNum(raw?.servicePriceTry, 0)),
    freeOverTry: Math.max(0, toNum(raw?.freeOverTry, 0)),
    serviceRequired: raw?.serviceRequired === true,
    requiresCustomerNote: raw?.requiresCustomerNote === true,

    customerNoteLabel: {
      tr: safeStr(raw?.customerNoteLabel?.tr || raw?.customerNoteLabelTr),
      en: safeStr(raw?.customerNoteLabel?.en || raw?.customerNoteLabelEn),
    },

    customerNotePlaceholder: {
      tr: safeStr(raw?.customerNotePlaceholder?.tr || raw?.customerNotePlaceholderTr),
      en: safeStr(raw?.customerNotePlaceholder?.en || raw?.customerNotePlaceholderEn),
    },
        requiresProductText: raw?.requiresProductText === true,

    productTextLabel: {
      tr: safeStr(raw?.productTextLabel?.tr || raw?.productTextLabelTr),
      en: safeStr(raw?.productTextLabel?.en || raw?.productTextLabelEn),
    },

    productTextPlaceholder: {
      tr: safeStr(raw?.productTextPlaceholder?.tr || raw?.productTextPlaceholderTr),
      en: safeStr(raw?.productTextPlaceholder?.en || raw?.productTextPlaceholderEn),
    },

    productTextMaxLength: Math.max(
      1,
      Math.min(80, toNum(raw?.productTextMaxLength, 30))
    ),
    target:
      raw?.target === "product" || raw?.target === "category"
        ? raw.target
        : "cart",

    productIds: Array.isArray(raw?.productIds)
      ? raw.productIds.map(safeStr).filter(Boolean)
      : [],

    categoryIds: Array.isArray(raw?.categoryIds)
      ? raw.categoryIds.map(safeStr).filter(Boolean)
      : [],

    placement: Array.isArray(raw?.placement)
      ? raw.placement.filter((x: any) =>
          ["cart", "checkout", "product"].includes(String(x))
        )
      : ["cart", "checkout"],

    tone: ["red", "gold", "dark", "blue", "green", "rose"].includes(String(raw?.tone))
      ? raw.tone
      : "red",

    isActive: raw?.isActive !== false,
    startsAt: safeStr(raw?.startsAt),
    endsAt: safeStr(raw?.endsAt),
    order: toNum(raw?.order, index + 1),
  };
}

function discountText(c: Campaign) {
  if (c.kind === "service") {
    if (c.freeOverTry > 0) {
      return `${c.freeOverTry.toLocaleString("tr-TR")} TL üzeri ücretsiz`;
    }

    if (c.servicePriceTry > 0) {
      return `₺${c.servicePriceTry.toLocaleString("tr-TR")} hizmet bedeli`;
    }

    return "Ücretsiz hizmet";
  }

  if (c.type === "fixed") return `₺${c.value.toLocaleString("tr-TR")} indirim`;
  return `%${c.value} indirim`;
}

function getKindLabel(kind: CampaignKind) {
  return kind === "service" ? "Ek Hizmet" : "İndirim";
}

export default function AdminCampaignsPage() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [enabled, setEnabled] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<Campaign>({ ...EMPTY_CAMPAIGN, id: makeId() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
const [productSearch, setProductSearch] = useState("");
const [productResults, setProductResults] = useState<ProductSearchRow[]>([]);
const [productSearchBusy, setProductSearchBusy] = useState(false);
const [productSearchMsg, setProductSearchMsg] = useState("");
  const selectedCampaign = useMemo(() => {
    return campaigns.find((x) => x.id === selectedId) || null;
  }, [campaigns, selectedId]);

  const stats = useMemo(() => {
    return {
      total: campaigns.length,
      active: campaigns.filter((x) => x.isActive).length,
      discounts: campaigns.filter((x) => x.kind === "discount").length,
      services: campaigns.filter((x) => x.kind === "service").length,
      cart: campaigns.filter((x) => x.placement.includes("cart")).length,
      checkout: campaigns.filter((x) => x.placement.includes("checkout")).length,
      product: campaigns.filter((x) => x.placement.includes("product")).length,
    };
  }, [campaigns]);
const selectedProductKeys = useMemo(() => {
  return Array.isArray(form.productIds)
    ? form.productIds.map(safeStr).filter(Boolean)
    : [];
}, [form.productIds]);

const selectedProductsFromResults = useMemo(() => { // eslint-disable-line @typescript-eslint/no-unused-vars
  const keys = new Set(selectedProductKeys);

  return productResults.filter((p) => {
    return keys.has(p.id) || keys.has(p.slug);
  });
}, [productResults, selectedProductKeys]);
  useEffect(() => {
    const ref = doc(db, "site_options", "campaign_settings");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? (snap.data() as CampaignSettings) : null;
        const list = Array.isArray(data?.campaigns)
          ? data!.campaigns.map(normalizeCampaign)
          : [];

        list.sort((a, b) => a.order - b.order);

        setEnabled(data?.enabled !== false);
        setCampaigns(list);

        if (!selectedId && list[0]) {
          setSelectedId(list[0].id);
          setForm(list[0]);
        }

        setLoading(false);
      },
      (err) => {
        console.error("campaign settings listen error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, selectedId]);

  useEffect(() => {
    if (selectedCampaign) {
      setForm(selectedCampaign);
    }
  }, [selectedCampaign]);

  async function saveAll(nextCampaigns = campaigns, nextEnabled = enabled) {
    setSaving(true);

    try {
      const clean = nextCampaigns.map((c, index) =>
        normalizeCampaign(
          {
            ...c,
            id: c.id || makeId(),
            code: safeStr(c.code).toUpperCase(),
            order: Number(c.order || index + 1),
          },
          index
        )
      );

      clean.sort((a, b) => a.order - b.order);

      await setDoc(
        doc(db, "site_options", "campaign_settings"),
        {
          enabled: nextEnabled,
          campaigns: clean,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setCampaigns(clean);
    } catch (err) {
      console.error("campaign save error:", err);
      window.alert("Kampanya ayarları kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCurrent() {
    const current = normalizeCampaign(
      {
        ...form,
        id: form.id || makeId(),
        code: form.code.toUpperCase(),
      },
      campaigns.length
    );

    if (!current.title.tr && !current.title.en) {
      window.alert("Kampanya / hizmet başlığı boş olamaz.");
      return;
    }

    if (current.kind === "discount" && current.value <= 0) {
      window.alert("İndirim değeri 0 olamaz.");
      return;
    }

if (
  current.kind === "service" &&
  current.servicePriceTry < 0
) {
  window.alert("Ek hizmet bedeli negatif olamaz.");
  return;
}

if (
  current.kind === "service" &&
  current.freeOverTry < 0
) {
  window.alert("Ücretsiz eşik tutarı negatif olamaz.");
  return;
}

    const exists = campaigns.some((x) => x.id === current.id);
    const next = exists
      ? campaigns.map((x) => (x.id === current.id ? current : x))
      : [...campaigns, current];

    setSelectedId(current.id);
    await saveAll(next, enabled);
  }

 function createNew(kind: CampaignKind = "discount") {
  const isService = kind === "service";

  const next: Campaign = {
    ...EMPTY_CAMPAIGN,
    id: makeId(),
    kind,
    order: campaigns.length + 1,

    title: isService
      ? { tr: "Yeni ek hizmet", en: "New extra service" }
      : { tr: "Yeni kampanya", en: "New campaign" },

    subtitle: isService
      ? {
          tr: "Sepet, ürün veya checkout adımında sunulacak ek hizmet.",
          en: "An extra service to offer on product, cart or checkout.",
        }
      : { tr: "", en: "" },

    code: isService ? `SERVICE_${campaigns.length + 1}` : `KOD${campaigns.length + 1}`,

    type: isService ? "fixed" : "percent",
    value: isService ? 0 : 10,

    servicePriceTry: 0,
freeOverTry: 0,
    serviceRequired: false,

    requiresCustomerNote: false,
    customerNoteLabel: { tr: "", en: "" },
    customerNotePlaceholder: { tr: "", en: "" },

    requiresProductText: false,
    productTextLabel: { tr: "", en: "" },
    productTextPlaceholder: { tr: "", en: "" },
    productTextMaxLength: 30,

    minCartTry: 0,
    target: "cart",
    productIds: [],
    categoryIds: [],

    tone: isService ? "gold" : "red",
    placement: isService ? ["cart", "checkout"] : ["cart", "checkout"],

    isActive: true,
    startsAt: "",
    endsAt: "",
  };

  setSelectedId(next.id);
  setForm(next);
}
function createGiftPackageService() {
  const next: Campaign = {
    ...EMPTY_CAMPAIGN,
    id: makeId(),
    kind: "service",
    order: campaigns.length + 1,

    title: { tr: "Hediye paketi istiyorum", en: "I want gift packaging" },
    subtitle: {
      tr: "Siparişin özel hediye paketiyle hazırlansın.",
      en: "Your order will be prepared with special gift packaging.",
    },

    code: "GIFT_PACKAGE",

    type: "fixed",
    value: 0,

    servicePriceTry: 250,
    freeOverTry: 10000,
    serviceRequired: false,

    requiresCustomerNote: true,
    customerNoteLabel: { tr: "Hediye notu", en: "Gift note" },
    customerNotePlaceholder: {
      tr: "Paketin içine eklenmesini istediğiniz kısa notu yazabilirsiniz.",
      en: "You can write a short note to include in the package.",
    },

    requiresProductText: false,
    productTextLabel: { tr: "", en: "" },
    productTextPlaceholder: { tr: "", en: "" },
    productTextMaxLength: 30,

    minCartTry: 0,
    target: "cart",
    productIds: [],
    categoryIds: [],

    tone: "gold",
    placement: ["cart", "checkout"],

    isActive: true,
    startsAt: "",
    endsAt: "",
  };

  setSelectedId(next.id);
  setForm(next);
}
  async function deleteCurrent() {
    if (!selectedId) return;

    const ok = window.confirm("Bu kayıt silinsin mi?");
    if (!ok) return;

    const next = campaigns.filter((x) => x.id !== selectedId);
    setSelectedId(next[0]?.id || "");
    setForm(next[0] || { ...EMPTY_CAMPAIGN, id: makeId() });
    await saveAll(next, enabled);
  }
async function searchProducts() {
  const term = safeStr(productSearch);

  if (term.length < 2) {
    setProductSearchMsg("Arama için en az 2 karakter yaz.");
    setProductResults([]);
    return;
  }

  setProductSearchBusy(true);
  setProductSearchMsg("");

  try {
    const productsRef = collection(db, "products");

    // Firestore prefix/index triplerine girmeden admin için geniş liste çekiyoruz.
    // 500 ürün çoğu admin araması için fazlasıyla yeterli.
    const snap = await getDocs(query(productsRef, limit(500)));

    const needle = normalizeSearchText(term);

    const list: ProductSearchRow[] = snap.docs
      .map((d) => {
        const data: any = d.data();

        const title =
          data.title && typeof data.title === "object"
            ? {
                tr: safeStr(data.title.tr),
                en: safeStr(data.title.en),
              }
            : {
                tr: safeStr(data.title || data.name),
                en: "",
              };

        const row: ProductSearchRow = {
          id: d.id,
          slug: safeStr(data.slug),
          sku: safeStr(data.sku),
          title,
          image:
            safeStr(data.image) ||
            safeStr(data.mainImage) ||
            safeStr(Array.isArray(data.images) ? data.images[0] : ""),
          isActive: data.isActive !== false,
        };

        const categoryText = [
          data.categoryId,
          data.categorySlug,
          data.categoryName,
          ...(Array.isArray(data.categoryIds) ? data.categoryIds : []),
          ...(Array.isArray(data.categorySlugs) ? data.categorySlugs : []),
        ]
          .map(safeStr)
          .join(" ");

        const hay = normalizeSearchText(
          [
            row.id,
            row.slug,
            row.sku,
            row.title.tr,
            row.title.en,
            categoryText,
          ].join(" ")
        );

        return {
          row,
          hay,
        };
      })
      .filter((x) => x.hay.includes(needle))
      .map((x) => x.row)
      .slice(0, 30);

    setProductResults(list);

    if (!list.length) {
      setProductSearchMsg(
        "Ürün bulunamadı. Ürün adı, SKU, slug veya kategori bilgisini kontrol et."
      );
    }
  } catch (err) {
    console.error("product search error:", err);
    setProductSearchMsg("Ürün araması yapılamadı. Firestore okuma iznini kontrol et.");
    setProductResults([]);
  } finally {
    setProductSearchBusy(false);
  }
}

function addProductToCampaign(product: ProductSearchRow) {
  const key = productKeyForCampaign(product);

  if (!key) return;

  setForm((p) => {
    const current = Array.isArray(p.productIds) ? p.productIds : [];

    if (current.includes(key)) return p;

    return {
      ...p,
      target: "product",
      productIds: [...current, key],
    };
  });
}

function removeProductFromCampaign(key: string) {
  const cleanKey = safeStr(key);

  if (!cleanKey) return;

  setForm((p) => ({
    ...p,
    productIds: Array.isArray(p.productIds)
      ? p.productIds.filter((x) => safeStr(x) !== cleanKey)
      : [],
  }));
}

function clearProductSelection() {
  setForm((p) => ({
    ...p,
    productIds: [],
  }));
}
  function togglePlacement(value: CampaignPlacement) {
    setForm((p) => {
      const current = Array.isArray(p.placement) ? p.placement : [];
      const next = current.includes(value)
        ? current.filter((x) => x !== value)
        : [...current, value];

      return {
        ...p,
        placement: next.length ? next : ["cart"],
      };
    });
  }

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div className={s.heroMain}>
          <div className={s.kicker}>ADMIN • CAMPAIGN CENTER</div>
          <h1>Kampanya Merkezi</h1>
          <p>
            Sepet, checkout ve ürün detayında görünecek indirimleri ve ek hizmetleri
            tek merkezden yönet. Hediye paketi, özel not, premium paketleme gibi
            opsiyonları fiyatlı veya belirli sepet tutarı üzerinde ücretsiz sun.
          </p>

          <div className={s.heroActions}>
            <button
              type="button"
              className={enabled ? s.switchOn : s.switchOff}
              onClick={async () => {
                const next = !enabled;
                setEnabled(next);
                await saveAll(campaigns, next);
              }}
            >
              {enabled ? "Merkez Aktif" : "Merkez Pasif"}
            </button>

            <button type="button" className={s.softBtn} onClick={() => createNew("discount")}>
              Yeni Kampanya
            </button>

          <button type="button" className={s.goldBtn} onClick={() => createNew("service")}>

  Yeni Ek Hizmet

</button>

<button

  type="button"

  className={s.giftBtn}

  onClick={() => createGiftPackageService()}

>

  Hediye Paketi Oluştur

</button>
          </div>
        </div>

        <div className={s.stats}>
          <div className={s.statCard}>
            <span>Toplam</span>
            <b>{stats.total}</b>
          </div>
          <div className={s.statCard}>
            <span>Aktif</span>
            <b>{stats.active}</b>
          </div>
          <div className={s.statCard}>
            <span>İndirim</span>
            <b>{stats.discounts}</b>
          </div>
          <div className={s.statCard}>
            <span>Ek Hizmet</span>
            <b>{stats.services}</b>
          </div>
        </div>
      </section>

      {loading ? (
        <section className={s.empty}>Kampanyalar yükleniyor…</section>
      ) : (
        <section className={s.grid}>
          <aside className={s.left}>
            <div className={s.panelHead}>
              <div>
                <h2>Kayıtlar</h2>
                <p>İndirim ve ek hizmet listesi.</p>
              </div>
            </div>

            {campaigns.length === 0 ? (
              <div className={s.emptyMini}>Henüz kayıt yok.</div>
            ) : (
              <div className={s.campaignList}>
                {campaigns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${s.campaignItem} ${
                      selectedId === c.id ? s.campaignItemOn : ""
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className={`${s.toneDot} ${s[`tone_${c.tone}`]}`} />

                    <div className={s.campaignInfo}>
                      <strong>{c.title.tr || c.code || "Kayıt"}</strong>
                      <span>
                        {getKindLabel(c.kind)} • {c.code || "Kodsuz"} • {discountText(c)}
                      </span>
                    </div>

                    <span
                      className={`${s.statusPill} ${
                        c.isActive ? s.statusOn : s.statusOff
                      }`}
                    >
                      {c.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className={s.editor}>
            <div className={s.editorHead}>
              <div>
                <h2>Kayıt Detayı</h2>
                <p>İndirim veya ek hizmet davranışını düzenle.</p>
              </div>

              <div className={s.editorActions}>
                <button
                  type="button"
                  className={s.dangerBtn}
                  onClick={deleteCurrent}
                  disabled={!selectedId || saving}
                >
                  Sil
                </button>

                <button
                  type="button"
                  className={s.primaryBtn}
                  onClick={saveCurrent}
                  disabled={saving}
                >
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            </div>

            <div className={s.modeTabs}>
              <button
                type="button"
                className={form.kind === "discount" ? s.modeOn : s.modeOff}
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    kind: "discount",
                    value: p.value || 10,
                    servicePriceTry: 0,
                    freeOverTry: 0,
                    serviceRequired: false,
                  }))
                }
              >
                İndirim Kampanyası
              </button>

              <button
  type="button"
  className={form.kind === "service" ? s.modeOn : s.modeOff}
  onClick={() =>
    setForm((p) => ({
      ...p,
      kind: "service",
      type: "fixed",
      value: 0,
      servicePriceTry: p.servicePriceTry || 0,
      freeOverTry: p.freeOverTry || 0,
      serviceRequired: false,
      tone: p.tone === "red" ? "gold" : p.tone,
      placement: p.placement?.length ? p.placement : ["cart", "checkout"],
    }))
  }
>
  Ek Hizmet / Opsiyon
</button>
            </div>

            <div className={s.formGrid}>
              <label className={s.field}>
                <span>Kayıt ID</span>
                <input
                  value={form.id}
                  onChange={(e) => setForm((p) => ({ ...p, id: safeStr(e.target.value) }))}
                  placeholder="first_order_10 / gift_package"
                />
              </label>

              <label className={s.field}>
                <span>Kod / Anahtar</span>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="T10 / GIFT_PACKAGE"
                />
              </label>

              <label className={s.field}>
                <span>TR Başlık</span>
                <input
                  value={form.title.tr || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      title: { ...p.title, tr: e.target.value },
                    }))
                  }
                 placeholder={
  form.kind === "service"
    ? "Premium paketleme / Ürüne isim yazdırma / Sigortalı teslimat"
    : "İlk alışverişe özel"
}
                />
              </label>

              <label className={s.field}>
                <span>EN Başlık</span>
                <input
                  value={form.title.en || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      title: { ...p.title, en: e.target.value },
                    }))
                  }
                placeholder={
  form.kind === "service"
    ? "Premium packaging / Engraving / Insured delivery"
    : "First order special"
}
                />
              </label>

              <label className={s.fieldWide}>
                <span>TR Açıklama</span>
                <input
                  value={form.subtitle?.tr || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      subtitle: { ...p.subtitle, tr: e.target.value },
                    }))
                  }
                  placeholder={
  form.kind === "service"
    ? "Müşteriye sunulacak ek hizmet açıklaması."
    : "Sepette ve ödeme adımında kullanılabilir."
}
                />
              </label>

              <label className={s.fieldWide}>
                <span>EN Açıklama</span>
                <input
                  value={form.subtitle?.en || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      subtitle: { ...p.subtitle, en: e.target.value },
                    }))
                  }
                 placeholder={
  form.kind === "service"
    ? "Description of the extra service offered to the customer."
    : "Available in cart and checkout."
}
                />
              </label>

              {form.kind === "discount" ? (
                <>
                  <label className={s.field}>
                    <span>İndirim Tipi</span>
                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          type: e.target.value === "fixed" ? "fixed" : "percent",
                        }))
                      }
                    >
                      <option value="percent">Yüzde indirim</option>
                      <option value="fixed">Sabit TL indirim</option>
                    </select>
                  </label>

                  <label className={s.field}>
                    <span>İndirim Değeri</span>
                    <input
                      type="number"
                      value={form.value}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, value: toNum(e.target.value, 0) }))
                      }
                    />
                  </label>
                </>
              ) : (
                
                <>
                  <label className={s.field}>
                    <span>Hizmet Bedeli</span>
                    <input
                      type="number"
                      value={form.servicePriceTry}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          servicePriceTry: toNum(e.target.value, 0),
                        }))
                      }
                      placeholder="250"
                    />
                  </label>

                  <label className={s.field}>
                    <span>Ücretsiz Eşik Tutarı</span>
                    <input
                      type="number"
                      value={form.freeOverTry}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          freeOverTry: toNum(e.target.value, 0),
                        }))
                      }
                      placeholder="10000"
                    />
                  </label>
                </>
              )}
{form.kind === "service" && form.requiresProductText ? (
  <>
    <label className={s.fieldWide}>
      <span>Ürün Yazısı TR Başlık</span>
      <input
        value={form.productTextLabel?.tr || ""}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            productTextLabel: {
              ...(p.productTextLabel || {}),
              tr: e.target.value,
            },
          }))
        }
        placeholder="Ürüne yazılacak metin"
      />
    </label>

    <label className={s.fieldWide}>
      <span>Ürün Yazısı EN Başlık</span>
      <input
        value={form.productTextLabel?.en || ""}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            productTextLabel: {
              ...(p.productTextLabel || {}),
              en: e.target.value,
            },
          }))
        }
        placeholder="Text to be written on product"
      />
    </label>

    <label className={s.fieldWide}>
      <span>Ürün Yazısı Placeholder TR</span>
      <input
        value={form.productTextPlaceholder?.tr || ""}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            productTextPlaceholder: {
              ...(p.productTextPlaceholder || {}),
              tr: e.target.value,
            },
          }))
        }
        placeholder="Örn: Ayşe & Mehmet"
      />
    </label>

    <label className={s.fieldWide}>
      <span>Ürün Yazısı Placeholder EN</span>
      <input
        value={form.productTextPlaceholder?.en || ""}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            productTextPlaceholder: {
              ...(p.productTextPlaceholder || {}),
              en: e.target.value,
            },
          }))
        }
        placeholder="Example: Ayşe & Mehmet"
      />
    </label>

    <label className={s.field}>
      <span>Ürün Yazısı Karakter Limiti</span>
      <input
        type="number"
        value={form.productTextMaxLength || 30}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            productTextMaxLength: Math.max(
              1,
              Math.min(80, toNum(e.target.value, 30))
            ),
          }))
        }
        placeholder="30"
      />
    </label>
  </>
) : null}

{form.kind === "service" && form.requiresCustomerNote ? (
  <>
    <label className={s.fieldWide}>
      <span>Not Alanı TR Başlık</span>
      <input
        value={form.customerNoteLabel?.tr || ""}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            customerNoteLabel: {
              ...(p.customerNoteLabel || {}),
              tr: e.target.value,
            },
          }))
        }
        placeholder="Müşteri notu"
      />
    </label>

    <label className={s.fieldWide}>
      <span>Not Alanı EN Başlık</span>
      <input
        value={form.customerNoteLabel?.en || ""}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            customerNoteLabel: {
              ...(p.customerNoteLabel || {}),
              en: e.target.value,
            },
          }))
        }
        placeholder="Customer note"
      />
    </label>

    <label className={s.fieldWide}>
      <span>Not Placeholder TR</span>
      <input
        value={form.customerNotePlaceholder?.tr || ""}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            customerNotePlaceholder: {
              ...(p.customerNotePlaceholder || {}),
              tr: e.target.value,
            },
          }))
        }
        placeholder="Müşterinin eklemek istediği kısa not."
      />
    </label>

    <label className={s.fieldWide}>
      <span>Not Placeholder EN</span>
      <input
        value={form.customerNotePlaceholder?.en || ""}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            customerNotePlaceholder: {
              ...(p.customerNotePlaceholder || {}),
              en: e.target.value,
            },
          }))
        }
        placeholder="A short note the customer wants to add."
      />
    </label>
  </>
) : null}
              <label className={s.field}>
                <span>Minimum Sepet Tutarı</span>
                <input
                  type="number"
                  value={form.minCartTry}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, minCartTry: toNum(e.target.value, 0) }))
                  }
                />
              </label>

              <label className={s.field}>
                <span>Sıralama</span>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, order: toNum(e.target.value, 1) }))
                  }
                />
              </label>

              <label className={s.field}>
                <span>Hedef</span>
                <select
                  value={form.target}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      target: e.target.value as CampaignTarget,
                    }))
                  }
                >
                  <option value="cart">Genel Sepet</option>
                  <option value="product">Belirli Ürün</option>
                  <option value="category">Belirli Kategori</option>
                </select>
              </label>

              <label className={s.field}>
                <span>Renk Teması</span>
                <select
                  value={form.tone}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      tone: e.target.value as CampaignTone,
                    }))
                  }
                >
                  <option value="red">Kırmızı</option>
                  <option value="gold">Gold</option>
                  <option value="dark">Siyah</option>
                  <option value="blue">Mavi</option>
                  <option value="green">Yeşil</option>
                  <option value="rose">Rose</option>
                </select>
              </label>

              <div className={s.productPickerWide}>
  <div className={s.productPickerHead}>
    <div>
      <span>Ürün Seçimi</span>
      <p>
        Bu kampanya / hizmetin hangi ürünlerde çıkacağını arama ile seç.
      </p>
    </div>

    {selectedProductKeys.length ? (
      <button
        type="button"
        className={s.miniDangerBtn}
        onClick={clearProductSelection}
      >
        Seçimleri Temizle
      </button>
    ) : null}
  </div>

  <div className={s.productSearchRow}>
    <input
      value={productSearch}
      onChange={(e) => setProductSearch(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          searchProducts();
        }
      }}
      placeholder="Ürün adı, SKU veya slug ara..."
    />

    <button
      type="button"
      className={s.searchBtn}
      onClick={searchProducts}
      disabled={productSearchBusy}
    >
      {productSearchBusy ? "Aranıyor..." : "Ürün Ara"}
    </button>
  </div>

  {productSearchMsg ? (
    <div className={s.productSearchMsg}>{productSearchMsg}</div>
  ) : null}

  {productResults.length ? (
    <div className={s.productResults}>
      {productResults.map((p) => {
        const key = productKeyForCampaign(p); // eslint-disable-line @typescript-eslint/no-unused-vars
        const selected =
          selectedProductKeys.includes(p.id) ||
          selectedProductKeys.includes(p.slug);

        return (
          <button
            key={p.id}
            type="button"
            className={`${s.productResultItem} ${
              selected ? s.productResultSelected : ""
            }`}
            onClick={() => addProductToCampaign(p)}
            disabled={selected}
          >
            <div className={s.productThumb}>
              {p.image ? (
                <img src={p.image} alt={productLabel(p)} />
              ) : (
                <span>✦</span>
              )}
            </div>

            <div className={s.productResultInfo}>
              <strong>{productLabel(p)}</strong>
              <span>
                {p.sku ? `SKU: ${p.sku}` : "SKU yok"} •{" "}
                {p.slug || p.id}
              </span>
            </div>

            <em>{selected ? "Eklendi" : "Ekle"}</em>
          </button>
        );
      })}
    </div>
  ) : null}

  <div className={s.selectedProductsBox}>
    <div className={s.selectedProductsTitle}>
      Seçili Ürünler
      <b>{selectedProductKeys.length}</b>
    </div>

    {selectedProductKeys.length ? (
      <div className={s.selectedProductChips}>
        {selectedProductKeys.map((key) => {
          const product = productResults.find(
            (p) => p.id === key || p.slug === key
          );

          return (
            <span key={key} className={s.selectedProductChip}>
              {product ? productLabel(product) : key}

              <button
                type="button"
                onClick={() => removeProductFromCampaign(key)}
                aria-label="Ürünü kaldır"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    ) : (
      <div className={s.selectedProductsEmpty}>
        Henüz ürün seçilmedi. Seçim yaparsan hedef otomatik “Belirli Ürün” olur.
      </div>
    )}
  </div>

  <details className={s.manualProductIds}>
    <summary>Manuel ID / slug düzenle</summary>

    <input
      value={joinIds(form.productIds)}
      onChange={(e) =>
        setForm((p) => ({
          ...p,
          productIds: splitIds(e.target.value),
          target: splitIds(e.target.value).length ? "product" : p.target,
        }))
      }
      placeholder="urun-id-1, urun-slug-2"
    />
  </details>
</div>

              <label className={s.fieldWide}>
                <span>Kategori ID / Slug Listesi</span>
                <input
                  value={joinIds(form.categoryIds)}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      categoryIds: splitIds(e.target.value),
                    }))
                  }
                  placeholder="yuzuk, kolye, bileklik"
                />
              </label>

              <label className={s.field}>
                <span>Başlangıç</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                />
              </label>

              <label className={s.field}>
                <span>Bitiş</span>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                />
              </label>
            </div>

            <div className={s.optionsRow}>
              <button
                type="button"
                className={form.isActive ? s.optionOn : s.optionOff}
                onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              >
                {form.isActive ? "Kayıt Aktif" : "Kayıt Pasif"}
              </button>

              {form.kind === "service" ? (
                <button
                  type="button"
                  className={form.serviceRequired ? s.optionOn : s.optionOff}
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      serviceRequired: !p.serviceRequired,
                    }))
                  }
                >
                  {form.serviceRequired ? "Zorunlu Hizmet" : "Müşteri Seçimli"}
                </button>
              ) : null}
{form.kind === "service" ? (
  <button
    type="button"
    className={form.requiresCustomerNote ? s.optionOn : s.optionOff}
    onClick={() =>
      setForm((p) => ({
        ...p,
        requiresCustomerNote: !p.requiresCustomerNote,
      }))
    }
  >
    {form.requiresCustomerNote ? "Müşteri Notu Açık" : "Müşteri Notu Kapalı"}
  </button>
) : null}
{form.kind === "service" ? (
  <button
    type="button"
    className={form.requiresProductText ? s.optionOn : s.optionOff}
    onClick={() =>
      setForm((p) => ({
        ...p,
        requiresProductText: !p.requiresProductText,
      }))
    }
  >
    {form.requiresProductText ? "Ürün Yazısı Açık" : "Ürün Yazısı Kapalı"}
  </button>
) : null}
              <button
                type="button"
                className={form.placement.includes("cart") ? s.optionOn : s.optionOff}
                onClick={() => togglePlacement("cart")}
              >
                Sepette Göster
              </button>

              <button
                type="button"
                className={form.placement.includes("checkout") ? s.optionOn : s.optionOff}
                onClick={() => togglePlacement("checkout")}
              >
                Checkout’ta Göster
              </button>

              <button
                type="button"
                className={form.placement.includes("product") ? s.optionOn : s.optionOff}
                onClick={() => togglePlacement("product")}
              >
                Üründe Göster
              </button>
            </div>

     <div className={`${s.preview} ${s[`preview_${form.tone}`]}`}>

  <div>

    <span>

      {form.kind === "service" ? "EK HİZMET ÖNİZLEME" : "KAMPANYA ÖNİZLEME"}

    </span>

    <strong>{form.title.tr || "Başlık"}</strong>

    {form.subtitle?.tr ? <p>{form.subtitle.tr}</p> : null}

  </div>

{form.kind === "service" ? (
  <div className={s.servicePreviewStack}>
    <div className={s.serviceChoicePreview}>
      <div className={`${s.serviceChoicePill} ${s.serviceChoiceYes}`}>
        <span
          className={s.serviceChoiceIcon}
          aria-hidden="true"
          data-icon="check"
        />
        <b>Evet</b>
      </div>

      <div className={`${s.serviceChoicePill} ${s.serviceChoiceNo}`}>
        <span
          className={s.serviceChoiceIcon}
          aria-hidden="true"
          data-icon="x"
        />
        <b>Hayır</b>
      </div>
    </div>

    {form.requiresCustomerNote ? (
      <div className={s.serviceNotePreview}>
        <span>{form.customerNoteLabel?.tr || "Hediye notu"}</span>
        <p>
          {form.customerNotePlaceholder?.tr ||
            "Paketin içine eklenmesini istediğiniz kısa notu yazabilirsiniz."}
        </p>
      </div>
    ) : null}
        {form.requiresProductText ? (
      <div className={s.serviceNotePreview}>
        <span>{form.productTextLabel?.tr || "Ürüne yazılacak metin"}</span>
        <p>
          {form.productTextPlaceholder?.tr ||
            "Ürün üzerine yazılacak kısa metni giriniz."}
        </p>
      </div>
    ) : null}
  </div>
) : (
  <em>{discountText(form)}</em>
)}

</div>
          </section>
        </section>
      )}
    </main>
  );
}