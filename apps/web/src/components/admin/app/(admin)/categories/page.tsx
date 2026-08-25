"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import cs from "./categories.module.css";
import { uploadCategoryImage } from "@/lib/uploadProductImage";
import PermissionGate from "@/components/admin/PermissionGate";
import { adminFetch } from "@/lib/adminFetch";

type CategoryPricing = {
  enabled: boolean;
  pricePercent?: number;
  priceFixedAdd?: number;
  compareAtPercent?: number;
  refreshMode?: "auto" | "manual";
  refreshIntervalValue?: number;
  refreshIntervalUnit?: "hour" | "day";
  cartCountdownEnabled?: boolean;
  lastAppliedAt?: any;
};

type LocaleText = {
  tr?: string;
  en?: string;
};

type Category = {
  id: string;
  name: LocaleText;
  slug: string;
  order: number;
  isActive: boolean;
  image?: string;
  pricing?: CategoryPricing | null;
  parentId?: string | null;
  createdAt?: any;
  updatedAt?: any;
  showOnHome?: boolean;
  variantPreset?: CategoryVariantPreset | null;
};
type VariantOption = {
  value: string;
  label: LocaleText;
  hasGram?: number;
  weightGram?: number;
  priceDelta?: number;
  stockDelta?: number;
  isActive?: boolean;
  order?: number;
};

type VariantGroup = {
  id: string;
  label: LocaleText;
  type: "select" | "button" | "radio";
  required: boolean;
  options: VariantOption[];
};

type CategoryVariantPreset = {
  enabled: boolean;
  groups: VariantGroup[];
};
function slugifyTR(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toNum(v: any, fallback = 0) {
  const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
  return Number.isFinite(n) ? n : fallback;
}
function categoryLabel(v: any) {

  if (!v) return "";

  if (typeof v === "string") return v;

  return String(v?.tr || v?.en || "");

}
function clampOrder(v: any) {
  const n = Math.floor(toNum(v, 0));
  return Math.max(0, Math.min(9999, n));
}

function clampMoney(v: any) {
  const n = toNum(v, 0);
  return Math.max(0, Math.round(n * 100) / 100);
}

function clampPercent(v: any) {
  const n = toNum(v, 0);
  return Math.max(0, Math.min(999, Math.round(n * 100) / 100));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeRateKey(k: string) {
  return String(k || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function sanitizePricing(p: any): CategoryPricing | null {
  if (!p || typeof p !== "object") return null;

  const enabled = !!p.enabled;
  const refreshMode: "auto" | "manual" = p.refreshMode === "auto" ? "auto" : "manual";
  const refreshIntervalValue = Math.max(1, Math.floor(toNum(p.refreshIntervalValue, 1)));
  const refreshIntervalUnit: "hour" | "day" = p.refreshIntervalUnit === "day" ? "day" : "hour";
  const cartCountdownEnabled = p.cartCountdownEnabled === true;

  return {
    enabled,
    pricePercent: clampPercent(p.pricePercent ?? 0),
    priceFixedAdd: clampMoney(p.priceFixedAdd ?? 0),
    compareAtPercent: clampPercent(p.compareAtPercent ?? 0),
    refreshMode,
    cartCountdownEnabled,
    ...(refreshMode === "auto" ? { refreshIntervalValue, refreshIntervalUnit } : {}),
    ...(p.lastAppliedAt ? { lastAppliedAt: p.lastAppliedAt } : {}),
  };
}
function sanitizeVariantPreset(v: any): CategoryVariantPreset | null {
  if (!v || typeof v !== "object") return null;

  const groupsRaw = Array.isArray(v.groups) ? v.groups : [];

  const groups: VariantGroup[] = groupsRaw
    .map((g: any) => {
      const groupId = slugifyTR(g?.id || g?.label?.tr || "variant");

      const optionsRaw = Array.isArray(g?.options) ? g.options : [];

      const options: VariantOption[] = optionsRaw
        .map((o: any, index: number) => {
          const value = String(o?.value ?? o?.label?.tr ?? "").trim();
          if (!value) return null;

          const hasGram = Math.max(
            0,
            Math.round(
              toNum(
                o?.hasGram ??
                o?.weightGram ??
                o?.gram ??
                o?.priceWeightGram ??
                0,
                0
              ) * 10000
            ) / 10000
          );

          return {
            value,
            label: {
              tr: String(o?.label?.tr ?? value).trim(),
              en: String(o?.label?.en ?? "").trim(),
            },

            ...(hasGram > 0 ? { hasGram, weightGram: hasGram } : {}),

            priceDelta: clampMoney(o?.priceDelta ?? 0),
            stockDelta: Math.floor(toNum(o?.stockDelta ?? 0, 0)),
            isActive: o?.isActive !== false,
            order: clampOrder(o?.order ?? index),
          };
        })
        .filter(Boolean) as VariantOption[];

      options.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));

      return {
        id: groupId,
        label: {
          tr: String(g?.label?.tr ?? groupId).trim(),
          en: String(g?.label?.en ?? "").trim(),
        },
        type: g?.type === "button" || g?.type === "radio" ? g.type : "select",
        required: g?.required !== false,
        options,
      };
    })
    .filter((g: VariantGroup) => g.id && g.options.length > 0);

  return {
    enabled: v.enabled === true,
    groups,
  };
}
async function slugExists(db: any, slug: string, exceptId?: string) {
  const s = slugifyTR(slug);
  if (!s) return false;

  const qs = query(collection(db, "categories"), where("slug", "==", s), limit(5));
  const snap = await getDocs(qs);
  if (snap.empty) return false;

  if (exceptId) return snap.docs.some((d) => d.id !== exceptId);
  return true;
}

async function applyPricingServer(payload: {
  categoryId: string;
  categorySlug: string;
  pricing: CategoryPricing;
}) {
  const res = await adminFetch("/api/admin/categories/apply-pricing", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Toplu uygulama başarısız");
  }
  return json;
}
async function refreshRatesNow() {
  const res = await adminFetch("/api/rates/refresh", {
    method: "POST",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Kur yenileme başarısız");
  }

  return json;
}
function fmtDate(v: any) {
  try {
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
        : typeof v === "string"
          ? new Date(v)
          : null;

    if (!d || Number.isNaN(d.getTime())) return "—";

    return d.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function CategoriesAdminPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [rows, setRows] = useState<Category[]>([]);
  const [qText, setQText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false);
  const [bsMode, setBsMode] = useState<"auto" | "manual">("auto");
  const [bsValue, setBsValue] = useState(1);
  const [bsUnit, setBsUnit] = useState<"hour" | "day">("hour");
  const [bsApplyTo, setBsApplyTo] = useState<"enabled" | "all">("enabled");
  const [bsSaving, setBsSaving] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  function renderCategoryNode(
    category: Category,
    depth = 0
  ): React.ReactNode {
    const children =
      categoryTree.childrenMap.get(category.id) || [];

    const hasChildren = children.length > 0;
    const isOpen = !!openGroups[category.id];

    return (
      <div
        key={category.id}
        className={cs.catGroup}
        style={{
          marginLeft: depth > 0
            ? Math.min(depth * 24, 96)
            : 0,
        }}
      >
        <article
          className={`${cs.catCard} ${depth === 0
            ? cs.catCardRoot
            : cs.catCardChild
            }`}
        >
          <div className={cs.catCardTop}>
            <div className={cs.catVisual}>
              {category.image ? (
                <img
                  className={cs.catImg}
                  src={category.image}
                  alt={categoryLabel(category.name)}
                  loading="lazy"
                />
              ) : (
                <div className={cs.catImgFallback}>
                  {(categoryLabel(category.name) || "?")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
            </div>

            <div className={cs.catMain}>
              <div className={cs.catTitleRow}>
                <h3 className={cs.catTitle}>
                  {depth > 0 ? "↳ " : ""}
                  {categoryLabel(category.name)}
                </h3>

                <span className={cs.orderPill}>
                  #{category.order ?? 0}
                </span>
              </div>

              <div className={cs.slugPill}>
                {category.slug}
              </div>

              <div className={cs.metaRow}>
                <span
                  className={
                    category.isActive
                      ? cs.badgeOn
                      : cs.badgeOff
                  }
                >
                  {category.isActive
                    ? "Aktif"
                    : "Pasif"}
                </span>

                <span
                  className={
                    category.showOnHome
                      ? cs.badgeInfo
                      : cs.badgeMuted
                  }
                >
                  {category.showOnHome
                    ? "Anasayfada"
                    : "Home kapalı"}
                </span>

                <span
                  className={
                    category.pricing?.enabled
                      ? cs.badgeWarn
                      : cs.badgeMuted
                  }
                >
                  {category.pricing?.enabled
                    ? "Dinamik fiyat"
                    : "Sabit"}
                </span>

                {depth > 0 && (
                  <span className={cs.badgeMuted}>
                    Seviye {depth + 1}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={cs.cardInfo}>
            <div className={cs.infoItem}>
              <span>ID</span>
              <b className={cs.mono}>
                {category.id.slice(0, 10)}...
              </b>
            </div>

            <div className={cs.infoItem}>
              <span>Refresh</span>
              <b>
                {category.pricing?.refreshMode === "auto"
                  ? "Auto"
                  : "Manual"}
              </b>
            </div>

            <div className={cs.infoItem}>
              <span>Alt kategori</span>
              <b>{children.length}</b>
            </div>

            <div className={cs.infoItem}>
              <span>Güncelleme</span>
              <b>{fmtDate(category.updatedAt)}</b>
            </div>
          </div>

          <div className={cs.cardActions}>
            <button
              className={cs.btnGhost}
              onClick={() => openEdit(category)}
              disabled={busy}
            >
              Düzenle
            </button>

            <button
              className={cs.btnGhost}
              onClick={() => onToggleActive(category)}
              disabled={busy}
            >
              {category.isActive
                ? "Pasifleştir"
                : "Aktifleştir"}
            </button>

            <button
              className={cs.btnDanger}
              onClick={() => onDelete(category)}
              disabled={busy}
            >
              Sil
            </button>
          </div>

          {hasChildren && (
            <div className={cs.childToggleWrap}>
              <button
                type="button"
                className={cs.childToggleBtn}
                onClick={() =>
                  toggleGroup(category.id)
                }
              >
                <span>
                  {isOpen
                    ? "Alt kategorileri gizle"
                    : `Alt kategorileri göster (${children.length})`}
                </span>

                <span
                  className={`${cs.chev} ${isOpen ? cs.chevOpen : ""
                    }`}
                >
                  ⌄
                </span>
              </button>
            </div>
          )}
        </article>

        {hasChildren && isOpen && (
          <div className={cs.subGrid}>
            {children.map((child) =>
              renderCategoryNode(
                child,
                depth + 1
              )
            )}
          </div>
        )}
      </div>
    );
  }
  function toggleGroup(categoryId: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  }
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [tab, setTab] = useState<"general" | "pricing" | "variants">("general");
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [pricePercent, setPricePercent] = useState<number>(0);
  const [priceFixedAdd, setPriceFixedAdd] = useState<number>(0);
  const [compareAtPercent, setCompareAtPercent] = useState<number>(0);
  const [nameTr, setNameTr] = useState("");

  const [nameEn, setNameEn] = useState("");
  const [slug, setSlug] = useState("");
  const [order, setOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState("");
  const [showOnHome, setShowOnHome] = useState(false);
  const [parentId, setParentId] = useState("");
  const [pricingEnabled, setPricingEnabled] = useState(false);
  const [rateKey, setRateKey] = useState("GRAM_ALTIN"); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [refreshIntervalValue, setRefreshIntervalValue] = useState<number>(1);
  const [refreshIntervalUnit, setRefreshIntervalUnit] = useState<"hour" | "day">("hour");
  const [refreshMode, setRefreshMode] = useState<"auto" | "manual">("manual");
  const [variantEnabled, setVariantEnabled] = useState(false);
  const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([]);
  const [cartCountdownEnabled, setCartCountdownEnabled] = useState(false);
  useEffect(() => {
    const qy = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: Category[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name:

              typeof data?.name === "string"

                ? { tr: String(data.name), en: "" }

                : {

                  tr: String(data?.name?.tr || ""),

                  en: String(data?.name?.en || ""),

                },
            slug: String(data?.slug || ""),
            order: toNum(data?.order, 0),
            isActive: !!data?.isActive,
            showOnHome: !!data?.showOnHome,
            image: data?.image ? String(data.image) : undefined,
            pricing: data?.pricing ? sanitizePricing(data.pricing) : null,
            variantPreset:

              data?.variantPreset && typeof data.variantPreset === "object"

                ? sanitizeVariantPreset(data.variantPreset)

                : null,
            parentId: data?.parentId ? String(data.parentId) : null,
            createdAt: data?.createdAt,
            updatedAt: data?.updatedAt,

          };
        });

        list.sort((a, b) => {

          const ao = a.order ?? 0;

          const bo = b.order ?? 0;

          if (ao !== bo) return ao - bo;

          return categoryLabel(a.name).localeCompare(categoryLabel(b.name), "tr");

        });

        setRows(list);
      },
      (err) => {
        console.error("categories onSnapshot error:", err);
        setRows([]);
        setStatus("Kategoriler okunamadı.");
      }
    );
    return () => unsub();
  }, [db]);
  const categoryTree = useMemo(() => {
    const childrenMap = new Map<string, Category[]>();

    const sortCategories = (items: Category[]) =>
      [...items].sort((a, b) => {
        const ao = a.order ?? 0;
        const bo = b.order ?? 0;

        if (ao !== bo) return ao - bo;

        return categoryLabel(a.name).localeCompare(
          categoryLabel(b.name),
          "tr"
        );
      });

    rows.forEach((category) => {
      if (!category.parentId) return;

      const children = childrenMap.get(category.parentId) || [];
      children.push(category);
      childrenMap.set(category.parentId, children);
    });

    childrenMap.forEach((children, parentId) => {
      childrenMap.set(parentId, sortCategories(children));
    });

    const roots = sortCategories(
      rows.filter((category) => !category.parentId)
    );

    return {
      roots,
      childrenMap,
    };
  }, [rows]);
  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((x) => {
      const a = categoryLabel(x.name).toLowerCase();
      const b = (x.slug || "").toLowerCase();
      return a.includes(t) || b.includes(t);
    });
  }, [rows, qText]);
  const groupedRows = useMemo(() => { // eslint-disable-line @typescript-eslint/no-unused-vars
    const roots = filtered.filter((x) => !x.parentId);
    const childrenMap = new Map<string, Category[]>();

    filtered.forEach((cat) => {
      if (!cat.parentId) return;
      const arr = childrenMap.get(cat.parentId) || [];
      arr.push(cat);
      childrenMap.set(cat.parentId, arr);
    });

    roots.forEach((root) => {
      const kids = childrenMap.get(root.id) || [];
      kids.sort((a, b) => {
        if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
        return categoryLabel(a.name).localeCompare(categoryLabel(b.name), "tr");
      });
    });

    return { roots, childrenMap };
  }, [filtered]);
  const stats = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((x) => x.isActive).length,
      passive: rows.filter((x) => !x.isActive).length,
      home: rows.filter((x) => x.showOnHome).length,
      dynamic: rows.filter((x) => x.pricing?.enabled).length,
    };
  }, [rows]);

  function resetForm() {
    setNameTr("");
    setNameEn("");
    setSlug("");
    setOrder(0);
    setIsActive(true);
    setImage("");
    setImagePreview("");
    setShowOnHome(false);

    setPricingEnabled(false);
    setParentId("");
    setPricePercent(0);
    setPriceFixedAdd(0);
    setRefreshMode("manual");
    setRefreshIntervalValue(1);
    setRefreshIntervalUnit("hour");
    setCompareAtPercent(0);
    setCartCountdownEnabled(false);
    setVariantEnabled(false);
    setVariantGroups([]);
    setTab("general");
    setStatus("");
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setNameTr(String(c.name?.tr || ""));
    setNameEn(String(c.name?.en || ""));
    setSlug(c.slug || "");
    setOrder(toNum(c.order, 0));
    setIsActive(!!c.isActive);
    setImage(c.image || "");
    setImagePreview(c.image || "");
    setShowOnHome(!!c.showOnHome);
    setParentId(c.parentId || "");

    const p = sanitizePricing(c.pricing) || null;

    setPricingEnabled(!!p?.enabled);
    setPricePercent(Number(p?.pricePercent ?? 0));
    setPriceFixedAdd(Number(p?.priceFixedAdd ?? 0));
    setRefreshMode(p?.refreshMode === "auto" ? "auto" : "manual");
    setRefreshIntervalValue(Math.max(1, Math.floor(toNum(p?.refreshIntervalValue ?? 1, 1))));
    setRefreshIntervalUnit(p?.refreshIntervalUnit === "day" ? "day" : "hour");
    setCompareAtPercent(Number(p?.compareAtPercent ?? 0));
    setCartCountdownEnabled(!!p?.cartCountdownEnabled);
    const vp = sanitizeVariantPreset(c.variantPreset);
    setVariantEnabled(!!vp?.enabled);
    setVariantGroups(vp?.groups || []);
    setTab("general");
    setOpen(true);
    setStatus("");
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
    setStatus("");
  }

  useEffect(() => {
    if (!open) return;
    if (editing) return;
    if (!nameTr) return;
    setSlug((prev) => (prev?.trim() ? prev : slugifyTR(nameTr)));
  }, [nameTr, open, editing]);

  function buildPricing(): CategoryPricing | null {
    const p: CategoryPricing = {
      enabled: !!pricingEnabled,
      pricePercent: clampPercent(pricePercent),
      priceFixedAdd: clampMoney(priceFixedAdd),
      compareAtPercent: clampPercent(compareAtPercent),
      refreshMode,
      refreshIntervalValue: Math.max(1, Math.floor(refreshIntervalValue || 1)),
      refreshIntervalUnit,
      cartCountdownEnabled: !!cartCountdownEnabled,
    };

    if (p.refreshMode !== "auto") {
      delete (p as any).refreshIntervalValue;
      delete (p as any).refreshIntervalUnit;
    }

    return sanitizePricing(p);
  }

  async function onSave() {
    const nmTr = String(nameTr || "").trim();

    const nmEn = String(nameEn || "").trim();

    const sg = slugifyTR(slug || nmTr);
    const ord = clampOrder(order);

    if (!nmTr) return setStatus("Kategori adı (TR) boş olamaz.");
    if (!sg) return setStatus("Slug boş olamaz.");

    const pricing = buildPricing();

    setBusy(true);
    setStatus("");

    try {
      const exists = await slugExists(db, sg, editing?.id);
      if (exists) {
        setStatus("Bu slug zaten kullanılıyor.");
        return;
      }

      const payload: any = {
        name: {
          tr: nmTr,
          en: nmEn,
        },
        slug: sg,
        order: ord,
        isActive: !!isActive,
        showOnHome: !!showOnHome,
        image: image?.trim() ? String(image).trim() : null,
        pricing: pricing ? pricing : null,
        variantPreset: sanitizeVariantPreset({
          enabled: !!variantEnabled,
          groups: variantGroups,
        }) || {
          enabled: false,
          groups: [],
        },
        parentId: parentId || null,
        updatedAt: serverTimestamp(),
      };

      let savedCategoryId = editing?.id || "";
      const savedCategorySlug = sg; // eslint-disable-line prefer-const

      if (editing) {
        await updateDoc(doc(db, "categories", editing.id), payload);
        savedCategoryId = editing.id;
      } else {
        const createdRef = await addDoc(collection(db, "categories"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        savedCategoryId = createdRef.id;
      }

      // kategori ayarı bağlı ürünlere de işlensin
      if (savedCategoryId) {
        await applyPricingServer({
          categoryId: savedCategoryId,
          categorySlug: savedCategorySlug,
          pricing: pricing || {
            enabled: false,
            refreshMode: "manual",
          },
        });
      }

      closeModal();
    } catch (e: any) {
      console.error("save category error:", e);
      setStatus(e?.message || "Kayıt hatası");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(c: Category) {
    setBusy(true);
    setStatus("");
    try {
      await updateDoc(doc(db, "categories", c.id), {
        isActive: !c.isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.error("toggle active error:", e);
      setStatus(e?.message || "Güncelleme hatası");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(c: Category) {
    const ok = confirm(`Silinsin mi?\n\n${categoryLabel(c.name)} (${c.slug})`);
    if (!ok) return;

    setBusy(true);
    setStatus("");
    try {
      await deleteDoc(doc(db, "categories", c.id));
    } catch (e: any) {
      console.error("delete category error:", e);
      setStatus(e?.message || "Silme hatası");
    } finally {
      setBusy(false);
    }
  }
  async function onApplyPricingAllCategories() {
    if (bulkUpdating || busy) return;

    const dynamicCategories = rows.filter((x) => x.pricing?.enabled);

    if (dynamicCategories.length === 0) {
      setStatus("Dinamik fiyat açık kategori bulunamadı.");
      return;
    }

    const ok = confirm(
      `Tüm dinamik fiyatlı kategoriler güncellensin mi?\n\nKategori sayısı: ${dynamicCategories.length}\n\nBu işlem önce güncel kuru çeker, sonra dinamik fiyat açık olan tüm kategorilere bağlı ürünlerin final fiyatını yeniden hesaplar.`
    );

    if (!ok) return;

    setBulkUpdating(true);
    setBusy(true);
    setStatus("");

    try {
      // refreshRatesNow → Firebase Function → updateRatesHttp →
      // 1) Kuru çeker  2) applyPricingToAllDynamicProducts() ile TÜM ürünleri günceller
      // Ayrıca per-category loop'a GEREK YOK (çift güncelleme + şişirilmiş sayaç olur)
      const refreshRes = await refreshRatesNow();

      const provider = refreshRes?.provider || "kur";
      const productsUpdated = Number(refreshRes?.productsUpdated || 0);

      setStatus(
        `Tamam ✅ ${provider} yenilendi • ${dynamicCategories.length} kategori • ${productsUpdated} ürün güncellendi`
      );
    } catch (e: any) {
      console.error("bulk apply pricing error:", e);
      setStatus(e?.message || "Toplu kur/fiyat güncelleme hatası");
    } finally {
      setBulkUpdating(false);
      setBusy(false);
    }
  }
  async function onApplyPricing() {
    if (!editing) return setStatus("Önce kategoriyi kaydet.");

    const p = buildPricing();
    if (!p || !p.enabled) {
      return setStatus("Toplu uygulamak için dinamik fiyat açık olmalı.");
    }

    const ok = confirm(
      `Kur çekilip ürünler güncellensin mi?\n\nKategori: ${categoryLabel(editing.name)}\nSlug: ${editing.slug}\n\nBu işlem önce güncel kuru çeker, sonra bu kategoriye bağlı ürünlerin final fiyatını yeniden hesaplar.`
    );
    if (!ok) return;

    setBusy(true);
    setStatus("");

    try {
      // 1) Önce güncel kuru çek
      const refreshRes = await refreshRatesNow();

      // 2) Sonra o kurla ürünleri yeniden hesapla
      const applyRes = await applyPricingServer({
        categoryId: editing.id,
        categorySlug: editing.slug,
        pricing: p,
      });

      setStatus(
        `Tamam ✅ Kur yenilendi (${refreshRes?.provider || "provider?"}) • Güncellenen ürün: ${applyRes.updated || 0}`
      );
    } catch (e: any) {
      console.error("apply pricing error:", e);
      setStatus(e?.message || "Kur çekme / toplu uygulama hatası");
    } finally {
      setBusy(false);
    }
  }

  async function onBulkScheduleSave() {
    const targets = bsApplyTo === "all"
      ? rows
      : rows.filter((x) => x.pricing?.enabled);

    if (!targets.length) {
      setStatus("Uygulanacak kategori bulunamadı.");
      return;
    }

    const ok = confirm(
      `${targets.length} kategorinin zamanlama ayarı güncellensin mi?\n\nMod: ${bsMode === "auto" ? "Otomatik" : "Manuel"}${bsMode === "auto" ? `\nAralık: Her ${bsValue} ${bsUnit === "hour" ? "saat" : "gün"}` : ""}`
    );
    if (!ok) return;

    setBsSaving(true);
    setStatus("");

    try {
      let updated = 0;
      for (const cat of targets) {
        const oldPricing = cat.pricing || {}; // eslint-disable-line @typescript-eslint/no-unused-vars
        await updateDoc(doc(db, "categories", cat.id), {
          "pricing.refreshMode": bsMode,
          ...(bsMode === "auto" ? {
            "pricing.refreshIntervalValue": bsValue,
            "pricing.refreshIntervalUnit": bsUnit,
          } : {}),
          updatedAt: serverTimestamp(),
        });
        updated++;
      }
      setStatus(`✅ ${updated} kategorinin zamanlama ayarı güncellendi (${bsMode === "auto" ? `Oto / ${bsValue} ${bsUnit === "hour" ? "saat" : "gün"}` : "Manuel"})`);
      setBulkScheduleOpen(false);
    } catch (e: any) {
      console.error("bulk schedule error:", e);
      setStatus(e?.message || "Toplu zamanlama hatası");
    } finally {
      setBsSaving(false);
    }
  }


  async function onPickCategoryImage(file: File) {
    if (!file.type.startsWith("image/")) return setStatus("Lütfen bir görsel seç.");
    if (file.size > 6 * 1024 * 1024) return setStatus("Max 6MB.");

    const sg = slugifyTR(slug || nameTr || "kategori");

    setImageUploading(true);
    setStatus("");
    try {
      const url = await uploadCategoryImage(file, sg);
      setImage(url);
      setImagePreview(url);
    } catch (e: any) {
      console.error(e);
      setStatus(e?.message || "Görsel yükleme hatası");
    } finally {
      setImageUploading(false);
    }
  }

  return (
    <div className={cs.page}>
      <div className={cs.hero}>
        <div className={cs.heroLeft}>
          <div className={cs.kicker}>KATEGORİ YÖNETİMİ</div>
          <h1 className={cs.h1}>Kategoriler</h1>
          <p className={cs.sub}>
            Menü yapısı, mağaza filtreleri ve kategori bazlı dinamik fiyat presetleri burada yönetilir.
          </p>
        </div>

        <div className={cs.heroRight}>
          <div className={cs.statCard}>
            <span>Toplam</span>
            <b>{stats.total}</b>
          </div>
          <div className={cs.statCard}>
            <span>Aktif</span>
            <b>{stats.active}</b>
          </div>
          <div className={cs.statCard}>
            <span>Home</span>
            <b>{stats.home}</b>
          </div>
          <div className={cs.statCard}>
            <span>Dinamik</span>
            <b>{stats.dynamic}</b>
          </div>
        </div>
      </div>

      <div className={cs.toolbar}>
        <div className={cs.searchWrap}>
          <input
            className={cs.search}
            placeholder="Ara: isim / slug"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />
        </div>

        <div className={cs.toolbarActions}>
          {status ? <div className={cs.status}>{status}</div> : null}

          <button
            className={cs.btnGhost}
            onClick={onApplyPricingAllCategories}
            disabled={busy || bulkUpdating}
            type="button"
            title="Tüm dinamik fiyatlı kategorilerde kuru yenile ve bağlı ürünleri güncelle"
          >
            {bulkUpdating ? "Güncelleniyor..." : "↻ Kur / Fiyatları Güncelle"}
          </button>

          <button
            className={cs.btnGhost}
            onClick={() => setBulkScheduleOpen(true)}
            disabled={busy || bulkUpdating}
            type="button"
            title="Tüm kategorilere toplu zamanlama ayarı uygula"
          >
            ⏱ Toplu Zamanlama
          </button>

          <button className={cs.btnPrimary} onClick={openCreate} disabled={busy}>
            + Yeni Kategori
          </button>
        </div>
      </div>

      <div className={cs.listGrid}>
        {categoryTree.roots.length === 0 ? (
          <div className={cs.emptyBox}>
            Kategori yok. “Yeni Kategori” ile başlayalım.
          </div>
        ) : (
          categoryTree.roots.map((root) =>
            renderCategoryNode(root, 0)
          )
        )}
      </div>

      {open ? (
        <div
          className={cs.backdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className={cs.modal}>
            <div className={cs.modalHead}>
              <div>
                <div className={cs.modalTitle}>{editing ? "Kategori Düzenle" : "Yeni Kategori"}</div>
                <div className={cs.modalDesc}>
                  Genel alanları doldur, sonra istersen fiyat presetini tanımla.
                </div>
              </div>

              <button className={cs.close} onClick={closeModal} disabled={busy} aria-label="Kapat">
                ✕
              </button>
            </div>

            <div className={cs.tabs}>
              <button
                type="button"
                className={`${cs.tab} ${tab === "general" ? cs.tabActive : ""}`}
                onClick={() => setTab("general")}
              >
                Genel
              </button>
              <button
                type="button"
                className={`${cs.tab} ${tab === "pricing" ? cs.tabActive : ""}`}
                onClick={() => setTab("pricing")}
              >
                Fiyat
              </button>
              <button
                type="button"
                className={`${cs.tab} ${tab === "variants" ? cs.tabActive : ""}`}
                onClick={() => setTab("variants")}
              >
                Varyantlar
              </button>
            </div>

            {status ? <div className={cs.modalStatus}>{status}</div> : null}

            <div className={cs.modalBody}>
              <div className={cs.tabPanel} hidden={tab !== "general"}>
                <div className={cs.grid2}>
                  <div className={cs.field}>

                    <div className={cs.label}>Kategori adı (TR)</div>

                    <input

                      className={cs.input}

                      value={nameTr}

                      onChange={(e) => setNameTr(e.target.value)}

                      placeholder="Örn: Bileklik"

                    />

                  </div>

                  <div className={cs.field}>

                    <div className={cs.label}>Kategori adı (EN)</div>

                    <input

                      className={cs.input}

                      value={nameEn}

                      onChange={(e) => setNameEn(e.target.value)}

                      placeholder="Örn: Bracelet"

                    />

                  </div>

                  <div className={cs.field}>
                    <div className={cs.label}>Slug</div>
                    <input
                      className={cs.input}
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="ornek: bilezikler"
                    />
                    <div className={cs.help}>
                      Öneri: <b>{slugifyTR(slug || nameTr)}</b>
                    </div>
                  </div>

                  <div className={cs.field}>
                    <div className={cs.label}>Sıra (order)</div>
                    <input
                      className={cs.input}
                      inputMode="numeric"
                      value={order}
                      onChange={(e) => setOrder(clampOrder(e.target.value))}
                    />
                  </div>
                  <div className={cs.field}>
                    <div className={cs.label}>Üst kategori</div>
                    <select
                      className={cs.input}
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                    >
                      <option value="">Ana kategori</option>
                      {rows
                        .filter((x) => x.id !== editing?.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {categoryLabel(x.name)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className={cs.field}>
                    <div className={cs.label}>Durum</div>
                    <select
                      className={cs.input}
                      value={isActive ? "1" : "0"}
                      onChange={(e) => setIsActive(e.target.value === "1")}
                    >
                      <option value="1">Aktif</option>
                      <option value="0">Pasif</option>
                    </select>
                  </div>

                  <div className={cs.fieldFull}>
                    <label className={cs.switchRow}>
                      <input
                        type="checkbox"
                        checked={showOnHome}
                        onChange={(e) => setShowOnHome(e.target.checked)}
                      />
                      <span>
                        <b>Anasayfada göster</b>
                        <div className={cs.help}>
                          İşaretliyse öne çıkan kategoriler bölümünde görünür.
                        </div>
                      </span>
                    </label>
                  </div>

                  <div className={cs.fieldFull}>
                    <div className={cs.label}>Kategori görseli</div>

                    <div className={cs.uploadRow}>
                      <label className={cs.btnGhost} style={{ cursor: imageUploading ? "not-allowed" : "pointer" }}>
                        {imageUploading ? "Yükleniyor..." : "+ Görsel Yükle"}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          disabled={imageUploading || busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            onPickCategoryImage(f);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>

                      {image ? (
                        <button
                          type="button"
                          className={cs.btnDangerGhost}
                          disabled={imageUploading || busy}
                          onClick={() => {
                            setImage("");
                            setImagePreview("");
                          }}
                        >
                          Kaldır
                        </button>
                      ) : null}

                      <span className={cs.help}>(jpg/png/webp, max 6MB)</span>
                    </div>

                    {(imagePreview || image) ? (
                      <div className={cs.imagePreviewWrap}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview || image} alt="Kategori görsel" className={cs.imagePreview} />
                      </div>
                    ) : null}

                    <div className={cs.manualUrl}>
                      <div className={cs.help}>İstersen URL de girebilirsin:</div>
                      <input
                        className={cs.input}
                        value={image}
                        onChange={(e) => {
                          setImage(e.target.value);
                          setImagePreview(e.target.value);
                        }}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={cs.tabPanel} hidden={tab !== "pricing"}>
                <div className={cs.grid2}>
                  <div className={cs.fieldFull}>
                    <label className={cs.switchRow}>
                      <input
                        type="checkbox"
                        checked={pricingEnabled}
                        onChange={(e) => setPricingEnabled(e.target.checked)}
                      />
                      <span>
                        <b>Dinamik fiyat</b>
                        <div className={cs.help}>
                          Bu kategoriye bağlı ürünlerde kur bazlı yeniden fiyatlandırma aktif olur.
                        </div>

                      </span>
                    </label>
                  </div>
                  <div className={cs.fieldFull}>
                    <label className={cs.switchRow}>
                      <input
                        type="checkbox"
                        checked={cartCountdownEnabled}
                        onChange={(e) => setCartCountdownEnabled(e.target.checked)}
                        disabled={!pricingEnabled}
                      />
                      <span>
                        <b>Sepette geri sayım aktif</b>
                        <div className={cs.help}>
                          Açılırsa bu kategoriye bağlı kur bazlı ürünler sepette geri sayım mekanizmasına dahil olur.
                        </div>
                      </span>
                    </label>
                  </div>
                  <div className={cs.field}>
                    <div className={cs.label}>Yüzde Ek (%)</div>
                    <input
                      className={cs.input}
                      type="number"
                      step="0.01"
                      value={pricePercent}
                      onChange={(e) => setPricePercent(clampPercent(e.target.value))}
                      disabled={!pricingEnabled}
                    />
                  </div>

                  <div className={cs.field}>
                    <div className={cs.label}>Sabit Ek</div>
                    <input
                      className={cs.input}
                      type="number"
                      step="0.01"
                      value={priceFixedAdd}
                      onChange={(e) => setPriceFixedAdd(clampMoney(e.target.value))}
                      disabled={!pricingEnabled}
                    />
                  </div>
                  <div className={cs.field}>
                    <div className={cs.label}>İndirim Yüzdesi (%)</div>
                    <input
                      className={cs.input}
                      type="number"
                      step="0.01"
                      value={compareAtPercent}
                      onChange={(e) => setCompareAtPercent(clampPercent(e.target.value))}
                      disabled={!pricingEnabled}
                    />
                    <div className={cs.help}>
                      Örn: 5 girilirse ürünlere %5 gerçek indirim uygulanır. Orijinal fiyat üstü çizili gösterilir.
                    </div>
                  </div>

                  <div className={cs.field}>
                    <div className={cs.label}>Güncelleme Modu</div>
                    <select
                      className={cs.input}
                      value={refreshMode}
                      onChange={(e) => setRefreshMode(e.target.value === "auto" ? "auto" : "manual")}
                      disabled={!pricingEnabled}
                    >
                      <option value="manual">Manual</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>

                  {pricingEnabled && refreshMode === "auto" ? (
                    <>
                      <div className={cs.field}>
                        <div className={cs.label}>Otomatik Periyot</div>
                        <input
                          className={cs.input}
                          type="number"
                          min={1}
                          step="1"
                          value={refreshIntervalValue}
                          onChange={(e) =>
                            setRefreshIntervalValue(Math.max(1, Math.floor(toNum(e.target.value, 1))))
                          }
                        />
                      </div>

                      <div className={cs.field}>
                        <div className={cs.label}>Periyot Türü</div>
                        <select
                          className={cs.input}
                          value={refreshIntervalUnit}
                          onChange={(e) => setRefreshIntervalUnit(e.target.value === "day" ? "day" : "hour")}
                        >
                          <option value="hour">Saatte bir</option>
                          <option value="day">Günde bir</option>
                        </select>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className={cs.noteBox}>
                  ✅ Bu alan sadece kategoriye bağlı ürünlerin kurla yeniden hesaplanmasını yönetir.
                </div>

                {pricingEnabled && refreshMode === "auto" ? (
                  <div className={cs.note}>
                    Auto mod açık. Sistem bu kategoriye bağlı ürünleri seçilen periyotta yeniden fiyatlandırır.
                  </div>
                ) : null}

                <div className={cs.bulkRow}>
                  <button
                    className={cs.btnDangerGhost}
                    type="button"
                    disabled={busy || !editing || !pricingEnabled}
                    onClick={onApplyPricing}
                  >
                    Kur güncelle / toplu uygula
                  </button>

                  <div className={cs.note}>
                    Bu işlem bağlı ürünlerin mevcut kurdan final fiyatını yeniden hesaplar.
                  </div>
                </div>

                {!editing ? (
                  <div className={cs.note} style={{ marginTop: 10 }}>
                    Toplu uygulama için önce kategoriyi kaydet.
                  </div>
                ) : null}
              </div>
              <div className={cs.tabPanel} hidden={tab !== "variants"}>
                <div className={cs.fieldFull}>
                  <label className={cs.switchRow}>
                    <input
                      type="checkbox"
                      checked={variantEnabled}
                      onChange={(e) => setVariantEnabled(e.target.checked)}
                    />
                    <span>
                      <b>Kategori varyantları aktif</b>
                      <div className={cs.help}>
                        Açılırsa bu kategoriye bağlı ürünlerde otomatik varyant seçimi görünür.
                      </div>
                    </span>
                  </label>
                </div>

                <div className={cs.bulkRow}>
                  <button
                    type="button"
                    className={cs.btnGhost}
                    onClick={() => {
                      setVariantEnabled(true);
                      setVariantGroups([
                        {
                          id: "ring_size",
                          label: { tr: "Yüzük Ölçüsü", en: "Ring Size" },
                          type: "select",
                          required: true,
                          options: Array.from({ length: 23 }).map((_, i) => {
                            const n = i + 8;
                            return {
                              value: String(n),
                              label: { tr: String(n), en: String(n) },
                              hasGram: 0,
                              weightGram: 0,
                              priceDelta: 0,
                              stockDelta: 0,
                              isActive: true,
                              order: n,
                            };
                          }),
                        },
                      ]);
                    }}
                  >
                    + Yüzük ölçüsü preset’i ekle
                  </button>

                  <button
                    type="button"
                    className={cs.btnDangerGhost}
                    disabled={!variantGroups.length}
                    onClick={() => {
                      if (!confirm("Tüm varyant grupları silinsin mi?")) return;
                      setVariantGroups([]);
                      setVariantEnabled(false);
                    }}
                  >
                    Varyantları temizle
                  </button>
                </div>

                {variantGroups.length === 0 ? (
                  <div className={cs.noteBox}>
                    Henüz varyant grubu yok. Yüzük kategorisi için ölçü preset’i ekleyebilirsin.
                  </div>
                ) : (
                  <div className={cs.variantList}>
                    {variantGroups.map((group, groupIndex) => (
                      <div key={`${group.id}-${groupIndex}`} className={cs.variantCard}>
                        <div className={cs.grid2}>
                          <div className={cs.field}>
                            <div className={cs.label}>Grup ID</div>
                            <input
                              className={cs.input}
                              value={group.id}
                              disabled={!variantEnabled}
                              onChange={(e) => {
                                const value = slugifyTR(e.target.value);
                                setVariantGroups((prev) =>
                                  prev.map((g, i) =>
                                    i === groupIndex ? { ...g, id: value } : g
                                  )
                                );
                              }}
                            />
                          </div>

                          <div className={cs.field}>
                            <div className={cs.label}>Başlık TR</div>
                            <input
                              className={cs.input}
                              value={group.label.tr || ""}
                              disabled={!variantEnabled}
                              onChange={(e) => {
                                const value = e.target.value;
                                setVariantGroups((prev) =>
                                  prev.map((g, i) =>
                                    i === groupIndex
                                      ? { ...g, label: { ...g.label, tr: value } }
                                      : g
                                  )
                                );
                              }}
                            />
                          </div>

                          <div className={cs.field}>
                            <div className={cs.label}>Başlık EN</div>
                            <input
                              className={cs.input}
                              value={group.label.en || ""}
                              disabled={!variantEnabled}
                              onChange={(e) => {
                                const value = e.target.value;
                                setVariantGroups((prev) =>
                                  prev.map((g, i) =>
                                    i === groupIndex
                                      ? { ...g, label: { ...g.label, en: value } }
                                      : g
                                  )
                                );
                              }}
                            />
                          </div>

                          <div className={cs.field}>
                            <div className={cs.label}>Görünüm tipi</div>
                            <select
                              className={cs.input}
                              value={group.type}
                              disabled={!variantEnabled}
                              onChange={(e) => {
                                const value = e.target.value as VariantGroup["type"];
                                setVariantGroups((prev) =>
                                  prev.map((g, i) =>
                                    i === groupIndex ? { ...g, type: value } : g
                                  )
                                );
                              }}
                            >
                              <option value="select">Select</option>
                              <option value="button">Buton</option>
                              <option value="radio">Radio</option>
                            </select>
                          </div>

                          <div className={cs.field}>
                            <div className={cs.label}>Zorunlu mu?</div>
                            <select
                              className={cs.input}
                              value={group.required ? "1" : "0"}
                              disabled={!variantEnabled}
                              onChange={(e) => {
                                const value = e.target.value === "1";
                                setVariantGroups((prev) =>
                                  prev.map((g, i) =>
                                    i === groupIndex ? { ...g, required: value } : g
                                  )
                                );
                              }}
                            >
                              <option value="1">Zorunlu</option>
                              <option value="0">Opsiyonel</option>
                            </select>
                          </div>
                        </div>

                        <div className={cs.variantOptionsHead}>
                          <b>Seçenekler</b>
                          <button
                            type="button"
                            className={cs.btnGhost}
                            disabled={!variantEnabled}
                            onClick={() => {
                              setVariantGroups((prev) =>
                                prev.map((g, i) => {
                                  if (i !== groupIndex) return g;

                                  const nextOrder = g.options.length + 1;

                                  return {
                                    ...g,
                                    options: [
                                      ...g.options,
                                      {
                                        value: "",
                                        label: { tr: "", en: "" },
                                        priceDelta: 0,
                                        stockDelta: 0,
                                        isActive: true,
                                        order: nextOrder,
                                      },
                                    ],
                                  };
                                })
                              );
                            }}
                          >
                            + Seçenek ekle
                          </button>
                        </div>

                        <div className={cs.variantOptionsList}>
                          {group.options.map((option, optionIndex) => (
                            <div
                              key={`${group.id}-${optionIndex}`}
                              className={cs.variantOptionRow}
                            >
                              <label className={cs.variantMiniField}>
                                <span>Değer</span>
                                <input
                                  className={cs.input}
                                  value={option.value}
                                  disabled={!variantEnabled}
                                  placeholder="Örn: 14"
                                  onChange={(e) => {
                                    const value = e.target.value.trim();

                                    setVariantGroups((prev) =>
                                      prev.map((g, gi) => {
                                        if (gi !== groupIndex) return g;

                                        return {
                                          ...g,
                                          options: g.options.map((o, oi) =>
                                            oi === optionIndex
                                              ? {
                                                ...o,
                                                value,
                                                label: {
                                                  ...o.label,
                                                  tr: o.label.tr || value,
                                                },
                                              }
                                              : o
                                          ),
                                        };
                                      })
                                    );
                                  }}
                                />
                              </label>

                              <label className={cs.variantMiniField}>
                                <span>TR Etiket</span>
                                <input
                                  className={cs.input}
                                  value={option.label.tr || ""}
                                  disabled={!variantEnabled}
                                  placeholder="Örn: 14 Numara"
                                  onChange={(e) => {
                                    const value = e.target.value;

                                    setVariantGroups((prev) =>
                                      prev.map((g, gi) => {
                                        if (gi !== groupIndex) return g;

                                        return {
                                          ...g,
                                          options: g.options.map((o, oi) =>
                                            oi === optionIndex
                                              ? { ...o, label: { ...o.label, tr: value } }
                                              : o
                                          ),
                                        };
                                      })
                                    );
                                  }}
                                />
                              </label>

                              <label className={cs.variantMiniField}>
                                <span>EN Etiket</span>
                                <input
                                  className={cs.input}
                                  value={option.label.en || ""}
                                  disabled={!variantEnabled}
                                  placeholder="Example: Size 14"
                                  onChange={(e) => {
                                    const value = e.target.value;

                                    setVariantGroups((prev) =>
                                      prev.map((g, gi) => {
                                        if (gi !== groupIndex) return g;

                                        return {
                                          ...g,
                                          options: g.options.map((o, oi) =>
                                            oi === optionIndex
                                              ? { ...o, label: { ...o.label, en: value } }
                                              : o
                                          ),
                                        };
                                      })
                                    );
                                  }}
                                />
                              </label>

                              <label className={cs.variantMiniField}>
                                <span>Has Gram</span>
                                <input
                                  className={cs.input}
                                  type="number"
                                  step="0.0001"
                                  min={0}
                                  value={option.hasGram ?? option.weightGram ?? 0}
                                  disabled={!variantEnabled}
                                  placeholder="Örn: 2.3500"
                                  onChange={(e) => {
                                    const value = Math.max(
                                      0,
                                      Math.round(toNum(e.target.value, 0) * 10000) / 10000
                                    );

                                    setVariantGroups((prev) =>
                                      prev.map((g, gi) => {
                                        if (gi !== groupIndex) return g;

                                        return {
                                          ...g,
                                          options: g.options.map((o, oi) =>
                                            oi === optionIndex
                                              ? {
                                                ...o,
                                                hasGram: value,
                                                weightGram: value,
                                              }
                                              : o
                                          ),
                                        };
                                      })
                                    );
                                  }}
                                />
                              </label>

                              <label className={cs.variantMiniField}>
                                <span>TL Fark</span>
                                <input
                                  className={cs.input}
                                  type="number"
                                  step="0.01"
                                  value={option.priceDelta ?? 0}
                                  disabled={!variantEnabled}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const value = clampMoney(e.target.value);

                                    setVariantGroups((prev) =>
                                      prev.map((g, gi) => {
                                        if (gi !== groupIndex) return g;

                                        return {
                                          ...g,
                                          options: g.options.map((o, oi) =>
                                            oi === optionIndex ? { ...o, priceDelta: value } : o
                                          ),
                                        };
                                      })
                                    );
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                className={cs.btnDangerGhost}
                                disabled={!variantEnabled}
                                onClick={() => {
                                  setVariantGroups((prev) =>
                                    prev.map((g, gi) => {
                                      if (gi !== groupIndex) return g;

                                      return {
                                        ...g,
                                        options: g.options.filter((_, oi) => oi !== optionIndex),
                                      };
                                    })
                                  );
                                }}
                              >
                                Sil
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className={cs.bulkRow}>
                          <button
                            type="button"
                            className={cs.btnDangerGhost}
                            disabled={!variantEnabled}
                            onClick={() => {
                              setVariantGroups((prev) =>
                                prev.filter((_, i) => i !== groupIndex)
                              );
                            }}
                          >
                            Grubu kaldır
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={cs.modalFoot}>
              <button className={cs.btnLight} onClick={closeModal} disabled={busy}>
                İptal
              </button>
              <button className={cs.btnDark} onClick={onSave} disabled={busy}>
                {busy ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Bulk Schedule Modal ── */}
      {bulkScheduleOpen && (
        <div className={cs.overlay} onClick={() => !bsSaving && setBulkScheduleOpen(false)}>
          <div className={cs.modal} style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className={cs.modalHead}>
              <h2 className={cs.modalTitle}>⏱ Toplu Zamanlama Ayarı</h2>
              <button className={cs.closeBtn} onClick={() => setBulkScheduleOpen(false)} disabled={bsSaving}>✕</button>
            </div>

            <div className={cs.modalBody}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#64748b", margin: "0 0 16px" }}>
                Seçili kategorilerin otomatik kur güncelleme zamanlama ayarını toplu olarak değiştir.
              </p>

              {/* Kapsam */}
              <div className={cs.formGroup}>
                <label className={cs.formLabel}>Uygulama Kapsamı</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={`${cs.filterBtn} ${bsApplyTo === "enabled" ? cs.filterActive : ""}`}
                    onClick={() => setBsApplyTo("enabled")}
                  >
                    Sadece Pricing Açık ({rows.filter((x) => x.pricing?.enabled).length})
                  </button>
                  <button
                    type="button"
                    className={`${cs.filterBtn} ${bsApplyTo === "all" ? cs.filterActive : ""}`}
                    onClick={() => setBsApplyTo("all")}
                  >
                    Tüm Kategoriler ({rows.length})
                  </button>
                </div>
              </div>

              {/* Mod */}
              <div className={cs.formGroup}>
                <label className={cs.formLabel}>Güncelleme Modu</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={`${cs.filterBtn} ${bsMode === "auto" ? cs.filterActive : ""}`}
                    onClick={() => setBsMode("auto")}
                    style={bsMode === "auto" ? { background: "#16a34a", borderColor: "#16a34a" } : {}}
                  >
                    ⚡ Otomatik
                  </button>
                  <button
                    type="button"
                    className={`${cs.filterBtn} ${bsMode === "manual" ? cs.filterActive : ""}`}
                    onClick={() => setBsMode("manual")}
                  >
                    ✋ Manuel
                  </button>
                </div>
              </div>

              {/* Interval (sadece auto ise) */}
              {bsMode === "auto" && (
                <div className={cs.formGroup}>
                  <label className={cs.formLabel}>Güncelleme Aralığı</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Her</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={bsValue}
                      onChange={(e) => setBsValue(Math.max(1, parseInt(e.target.value) || 1))}
                      className={cs.input}
                      style={{ width: 70, textAlign: "center" }}
                    />
                    <select
                      value={bsUnit}
                      onChange={(e) => setBsUnit(e.target.value as "hour" | "day")}
                      className={cs.input}
                      style={{ width: 90 }}
                    >
                      <option value="hour">Saat</option>
                      <option value="day">Gün</option>
                    </select>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>bir</span>
                  </div>
                </div>
              )}

              {/* Önizleme */}
              <div style={{
                marginTop: 12,
                padding: "12px 16px",
                borderRadius: 12,
                background: bsMode === "auto"
                  ? "linear-gradient(135deg, rgba(34, 197, 94, 0.06), rgba(34, 197, 94, 0.02))"
                  : "linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.02))",
                border: `1px solid ${bsMode === "auto" ? "rgba(34,197,94,0.18)" : "rgba(245,158,11,0.18)"}`,
                fontSize: 13,
                fontWeight: 700,
                color: "#0f172a",
              }}>
                {bsMode === "auto"
                  ? `✅ ${bsApplyTo === "all" ? rows.length : rows.filter((x) => x.pricing?.enabled).length} kategori her ${bsValue} ${bsUnit === "hour" ? "saatte" : "günde"} bir otomatik güncellenecek`
                  : `✋ ${bsApplyTo === "all" ? rows.length : rows.filter((x) => x.pricing?.enabled).length} kategori sadece elle güncelleme ile değişecek`
                }
              </div>
            </div>

            <div className={cs.modalFoot}>
              <button className={cs.btnLight} onClick={() => setBulkScheduleOpen(false)} disabled={bsSaving}>
                İptal
              </button>
              <button
                className={cs.btnDark}
                onClick={onBulkScheduleSave}
                disabled={bsSaving}
                style={bsMode === "auto" ? { background: "linear-gradient(135deg, #16a34a, #15803d)" } : {}}
              >
                {bsSaving ? "Kaydediliyor…" : `Uygula (${bsApplyTo === "all" ? rows.length : rows.filter((x) => x.pricing?.enabled).length} kategori)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CategoriesAdminPage() {
  return (
    <PermissionGate permission="categories">
      <CategoriesAdminPageInner />
    </PermissionGate>
  );
}