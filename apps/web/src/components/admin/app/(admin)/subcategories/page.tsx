"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./adminCategories.module.css";

type Pricing = {
  enabled: boolean;
  model: "gram" | "qty" | "fixed";
  rateKey?: string;
  weightSource?: "product" | "category";
};

type LocaleText = {

  tr?: string;

  en?: string;

};

type CategoryDoc = {

  name: LocaleText;
  slug: string;
  parentId: string;
  level: number;
  path?: string;
  order: number;
  isActive: boolean;
  isFeatured?: boolean;
  showOnHome?: boolean;
  image?: string | null;
  pricing?: Pricing;
  createdAt?: any;
  updatedAt?: any;
};

type CatRow = CategoryDoc & { id: string };

function slugifyTR(input: string) {
  const map: Record<string, string> = {
    ı: "i",
    İ: "i",
    ğ: "g",
    Ğ: "g",
    ü: "u",
    Ü: "u",
    ş: "s",
    Ş: "s",
    ö: "o",
    Ö: "o",
    ç: "c",
    Ç: "c",
  };

  const normalized = (input || "")
    .trim()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "kategori";
}

function buildTree(all: CatRow[]) {
  const byId = new Map<string, CatRow>();
  const children = new Map<string, CatRow[]>();

  for (const c of all) {
    byId.set(c.id, c);
    const p = c.parentId || "";
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(c);
  }

  for (const [k, arr] of children.entries()) {
    arr.sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name), "tr")
    );
    children.set(k, arr);
  }

  const roots = children.get("") || [];
  return { byId, children, roots };
}
function categoryLabel(v: any) {

  if (!v) return "";

  if (typeof v === "string") return String(v);

  return String(v?.tr || v?.en || "");

}
function computePath(cat: { slug: string; parentId: string }, byId: Map<string, CatRow>) {
  const parts: string[] = [cat.slug];
  let p = cat.parentId || "";
  let guard = 0;

  while (p && guard < 20) {
    const parent = byId.get(p);
    if (!parent) break;
    parts.unshift(parent.slug);
    p = parent.parentId || "";
    guard++;
  }

  return parts.join("/");
}

function computeLevel(parentId: string, byId: Map<string, CatRow>) {
  if (!parentId) return 0;
  const p = byId.get(parentId);
  return (p?.level ?? 0) + 1;
}

function hasMatchingChild(catId: string, children: Map<string, CatRow[]>, matcher: (cat: CatRow) => boolean): boolean {
  const kids = children.get(catId) || [];
  for (const kid of kids) {
    if (matcher(kid)) return true;
    if (hasMatchingChild(kid.id, children, matcher)) return true;
  }
  return false;
}

function AdminCategoriesPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [all, setAll] = useState<CatRow[]>([]);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const tree = useMemo(() => buildTree(all), [all]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string>("");
const [nameTr, setNameTr] = useState("");

const [nameEn, setNameEn] = useState("");
  const [slug, setSlug] = useState("");
  const [order, setOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [showOnHome, setShowOnHome] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  const [pricingEnabled, setPricingEnabled] = useState(false);
  const [pricingModel, setPricingModel] = useState<Pricing["model"]>("gram");
  const [pricingRateKey, setPricingRateKey] = useState("GRAM_ALTIN");
  const [pricingWeightSource, setPricingWeightSource] =
    useState<Pricing["weightSource"]>("product");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"ok" | "error" | "info">("info");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snap) => {
      const rows: CatRow[] = snap.docs.map((d) => {
  const data = d.data() as any;

  return {
    id: d.id,
    ...data,
    name:
      typeof data?.name === "string"
        ? { tr: String(data.name), en: "" }
        : {
            tr: String(data?.name?.tr || ""),
            en: String(data?.name?.en || ""),
          },
    slug: String(data?.slug || ""),
    parentId: String(data?.parentId || ""),
    level: Number(data?.level || 0),
    order: Number(data?.order || 0),
    isActive: data?.isActive !== false,
  };
});
      setAll(rows);
    });
    return () => unsub();
  }, [db]);

useEffect(() => {
  if (!nameTr) return;
  setSlug((prev) => (prev ? prev : slugifyTR(nameTr)));
}, [nameTr]);

  function showMessage(text: string, type: "ok" | "error" | "info" = "info") {
    setMsg(text);
    setMsgType(type);
  }

  function resetForm() {
    setEditingId(null);
    setParentId("");
    setNameTr("");
    setNameEn("");
    setSlug("");
    setOrder(0);
    setIsActive(true);
    setShowOnHome(false);
    setIsFeatured(false);
    setPricingEnabled(false);
    setPricingModel("gram");
    setPricingRateKey("GRAM_ALTIN");
    setPricingWeightSource("product");
    setMsg(null);
  }

  function openCreateSub(parent: CatRow) {
    resetForm();
    setParentId(parent.id);
    setOrder(0);
  }

  function openEdit(cat: CatRow) {
    setEditingId(cat.id);
    setParentId(cat.parentId || "");
  setNameTr(String(cat.name?.tr || ""));

setNameEn(String(cat.name?.en || ""));
    setSlug(cat.slug || "");
    setOrder(Number(cat.order ?? 0));
    setIsActive(Boolean(cat.isActive));
    setShowOnHome(Boolean(cat.showOnHome));
    setIsFeatured(Boolean(cat.isFeatured));

    const p = (cat.pricing || {}) as Pricing;
    setPricingEnabled(Boolean(p.enabled));
    setPricingModel((p.model as any) || "gram");
    setPricingRateKey(p.rateKey || "GRAM_ALTIN");
    setPricingWeightSource((p.weightSource as any) || "product");
    setMsg(null);
  }

  async function toggleField(cat: CatRow, field: "isActive" | "showOnHome" | "isFeatured") {
    try {
      await updateDoc(doc(db, "categories", cat.id), {
        [field]: !Boolean((cat as any)[field]),
        updatedAt: serverTimestamp(),
      } as any);
    } catch (e: any) {
      showMessage(e?.message || "Güncelleme başarısız.", "error");
    }
  }

  async function saveCategory() {
    const nTr = nameTr.trim();

const nEn = nameEn.trim();

const sSlug = slugifyTR(slug || nTr);

if (!nTr) return showMessage("Kategori adı (TR) boş olamaz.", "error");
    if (!sSlug) return showMessage("Slug boş olamaz.", "error");
    if (editingId && parentId === editingId) {
      return showMessage("Kategori kendi altına taşınamaz.", "error");
    }

    setBusy(true);
    setMsg(null);

    try {
      const level = computeLevel(parentId, tree.byId);
      const path = computePath({ slug: sSlug, parentId }, tree.byId);

      const payload: CategoryDoc = {
        name: {
          tr: nTr,
          en: nEn,
        },
        slug: sSlug,
        parentId: parentId || "",
        level,
        path,
        order: Number.isFinite(order) ? order : 0,
        isActive: Boolean(isActive),
        showOnHome: Boolean(showOnHome),
        isFeatured: Boolean(isFeatured),
        pricing: {
          enabled: Boolean(pricingEnabled),
          model: pricingModel,
          rateKey: pricingRateKey || "GRAM_ALTIN",
          weightSource: pricingWeightSource || "product",
        },
        updatedAt: serverTimestamp(),
      };

      if (!editingId) {
        const newRef = doc(collection(db, "categories"));
        await setDoc(newRef, { ...payload, createdAt: serverTimestamp() }, { merge: true });
      } else {
        await setDoc(doc(db, "categories", editingId), payload, { merge: true });
      }

      showMessage("Kaydedildi ✅", "ok");
      setTimeout(() => setMsg(null), 1400);

      if (!editingId) resetForm();
    } catch (e: any) {
      showMessage(e?.message || "Kaydetme başarısız.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(cat: CatRow) {
    const kids = tree.children.get(cat.id) || [];
    if (kids.length) return showMessage("Bu kategorinin alt kategorileri var. Önce onları sil ya da taşı.", "error");
 if (!confirm(`Silinsin mi?\n\n${categoryLabel(cat.name)}`)) return;

    setBusy(true);
    setMsg(null);

    try {
      await deleteDoc(doc(db, "categories", cat.id));
      showMessage("Silindi.", "ok");
      setTimeout(() => setMsg(null), 1200);
      if (editingId === cat.id) resetForm();
    } catch (e: any) {
      showMessage(e?.message || "Silme başarısız.", "error");
    } finally {
      setBusy(false);
    }
  }

  function matches(cat: CatRow) {
    const text = (q || "").trim().toLowerCase();
    if (onlyActive && !cat.isActive) return false;
    if (!text) return true;

    return (
      categoryLabel(cat.name).toLowerCase().includes(text) ||
      cat.slug?.toLowerCase().includes(text) ||
      cat.path?.toLowerCase().includes(text) ||
      cat.id.toLowerCase().includes(text)
    );
  }

  function shouldRender(cat: CatRow) {
    return matches(cat) || hasMatchingChild(cat.id, tree.children, matches);
  }

  function Row({ cat, depth }: { cat: CatRow; depth: number }) {
    if (!shouldRender(cat)) return null;

    const kids = tree.children.get(cat.id) || [];

    return (
      <div className={s.treeBranch}>
        <div
          className={s.treeNode}
          style={{ ["--depth" as any]: depth }}
        >
          <div className={s.treeIndent} />

          <div className={s.nodeMain}>
            <div className={s.nodeTop}>
              <div className={s.nodeTitleWrap}>
               <div className={s.nodeTitle}>{categoryLabel(cat.name)}</div>
                <div className={s.nodeSlug}>/{cat.slug}</div>
              </div>

              <div className={s.badges}>
                <span className={s.levelBadge}>lvl {cat.level}</span>
                {cat.isActive ? (
                  <span className={`${s.badge} ${s.badgeOk}`}>Aktif</span>
                ) : (
                  <span className={`${s.badge} ${s.badgeDanger}`}>Pasif</span>
                )}
                {cat.showOnHome ? <span className={`${s.badge} ${s.badgeInfo}`}>Home</span> : null}
                {cat.isFeatured ? <span className={`${s.badge} ${s.badgePurple}`}>Featured</span> : null}
              </div>
            </div>

            <div className={s.nodeMeta}>
              <span>ID: <b>{cat.id}</b></span>
              <span>Path: <b>{cat.path || "-"}</b></span>
              <span>Order: <b>{cat.order ?? 0}</b></span>
              <span>Parent: <b>{cat.parentId || "root"}</b></span>
            </div>
          </div>

          <div className={s.nodeActions}>
            <button disabled={busy} onClick={() => openCreateSub(cat)} className={s.btnSoft}>
              Alt ekle
            </button>
            <button disabled={busy} onClick={() => openEdit(cat)} className={s.btnSoft}>
              Düzenle
            </button>
            <button disabled={busy} onClick={() => toggleField(cat, "isActive")} className={s.btnSoft}>
              {cat.isActive ? "Pasifleştir" : "Aktifleştir"}
            </button>
            <button disabled={busy} onClick={() => toggleField(cat, "showOnHome")} className={s.btnSoft}>
              Home
            </button>
            <button disabled={busy} onClick={() => toggleField(cat, "isFeatured")} className={s.btnSoft}>
              Featured
            </button>
            <button disabled={busy} onClick={() => removeCategory(cat)} className={s.btnDanger}>
              Sil
            </button>
          </div>
        </div>

        {kids.length ? (
          <div className={s.childrenWrap}>
            {kids.map((k) => (
              <Row key={k.id} cat={k} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <div className={s.topbarLeft}>
          <div className={s.kicker}>Admin • Kategori Mimarisi</div>
          <h1 className={s.title}>Kategori Yönetimi</h1>
          <p className={s.sub}>
            Ana kategori, alt kategori, sıralama, home görünümü ve pricing ayarlarını tek panelden yönet.
          </p>
        </div>

        <div className={s.topbarRight}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara: isim / slug / path / id"
            className={s.search}
          />

          <label className={s.checkRow}>
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            <span>Sadece aktif</span>
          </label>

          <button onClick={resetForm} disabled={busy} className={s.btnPrimary}>
            Yeni kategori
          </button>
        </div>
      </div>

      {msg ? (
        <div
          className={`${s.alert} ${
            msgType === "ok" ? s.alertOk : msgType === "error" ? s.alertError : s.alertInfo
          }`}
        >
          {msg}
        </div>
      ) : null}

      <div className={s.layout}>
        <section className={s.treeCard}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>Kategori Ağacı</div>
              <div className={s.cardSub}>
                Root ve alt kırılımları buradan gör. Sol taraf yapı, sağ taraf edit.
              </div>
            </div>

            <div className={s.cardStat}>
              Toplam <b>{all.length}</b>
            </div>
          </div>

          <div className={s.treeArea}>
            {tree.roots.length ? (
              tree.roots.map((r) => <Row key={r.id} cat={r} depth={0} />)
            ) : (
              <div className={s.emptyState}>Henüz kategori yok.</div>
            )}
          </div>
        </section>

        <aside className={s.formCard}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}>
                {editingId ? "Kategori Düzenle" : parentId ? "Alt Kategori Ekle" : "Yeni Ana Kategori"}
              </div>
              <div className={s.cardSub}>
                Kaydedince level ve path otomatik hesaplanır.
              </div>
            </div>
          </div>

          <div className={s.formGrid}>
            <label className={s.field}>
              <span className={s.label}>Üst kategori</span>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={s.input}>
                <option value="">(root) Ana kategori</option>
                {all
                  .sort((a, b) => categoryLabel(a.name).localeCompare(categoryLabel(b.name), "tr"))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {categoryLabel(r.name)} ({r.slug})
                    </option>
                  ))}
              </select>
              <small className={s.help}>Parent seçersen alt kategori olur.</small>
            </label>

           <label className={s.field}>
  <span className={s.label}>Ad (TR)</span>
  <input
    value={nameTr}
    onChange={(e) => setNameTr(e.target.value)}
    className={s.input}
    placeholder="Yüzük / Kolye / Bilezik..."
  />
</label>

<label className={s.field}>
  <span className={s.label}>Ad (EN)</span>
  <input
    value={nameEn}
    onChange={(e) => setNameEn(e.target.value)}
    className={s.input}
    placeholder="Ring / Necklace / Bracelet..."
  />
</label>

            <label className={s.field}>
              <span className={s.label}>Slug</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className={s.input}
                placeholder="yuzuk"
              />
            </label>

            <div className={s.grid2}>
              <label className={s.field}>
                <span className={s.label}>Sıra</span>
                <input
                  value={String(order)}
                  onChange={(e) => setOrder(Number(e.target.value || 0))}
                  className={s.input}
                  inputMode="numeric"
                />
              </label>

              <label className={s.field}>
                <span className={s.label}>Durum</span>
                <select
                  value={isActive ? "1" : "0"}
                  onChange={(e) => setIsActive(e.target.value === "1")}
                  className={s.input}
                >
                  <option value="1">Aktif</option>
                  <option value="0">Pasif</option>
                </select>
              </label>
            </div>

            <div className={s.grid2}>
              <label className={s.field}>
                <span className={s.label}>Home</span>
                <select
                  value={showOnHome ? "1" : "0"}
                  onChange={(e) => setShowOnHome(e.target.value === "1")}
                  className={s.input}
                >
                  <option value="0">Gösterme</option>
                  <option value="1">Göster</option>
                </select>
              </label>

              <label className={s.field}>
                <span className={s.label}>Featured</span>
                <select
                  value={isFeatured ? "1" : "0"}
                  onChange={(e) => setIsFeatured(e.target.value === "1")}
                  className={s.input}
                >
                  <option value="0">Değil</option>
                  <option value="1">Featured</option>
                </select>
              </label>
            </div>

            <div className={s.pricingBox}>
              <div className={s.pricingHead}>
                <div className={s.pricingTitle}>Pricing Ayarı</div>
                <label className={s.checkRow}>
                  <input
                    type="checkbox"
                    checked={pricingEnabled}
                    onChange={(e) => setPricingEnabled(e.target.checked)}
                  />
                  <span>Aktif</span>
                </label>
              </div>

              <div className={s.grid2}>
                <label className={s.field}>
                  <span className={s.label}>Model</span>
                  <select
                    value={pricingModel}
                    onChange={(e) => setPricingModel(e.target.value as any)}
                    className={s.input}
                    disabled={!pricingEnabled}
                  >
                    <option value="gram">gram</option>
                    <option value="qty">qty</option>
                    <option value="fixed">fixed</option>
                  </select>
                </label>

                <label className={s.field}>
                  <span className={s.label}>Rate Key</span>
                  <input
                    value={pricingRateKey}
                    onChange={(e) => setPricingRateKey(e.target.value)}
                    className={s.input}
                    disabled={!pricingEnabled}
                    placeholder="GRAM_ALTIN"
                  />
                </label>
              </div>

              <label className={s.field}>
                <span className={s.label}>Weight Source</span>
                <select
                  value={pricingWeightSource}
                  onChange={(e) => setPricingWeightSource(e.target.value as any)}
                  className={s.input}
                  disabled={!pricingEnabled}
                >
                  <option value="product">product</option>
                  <option value="category">category</option>
                </select>
              </label>

              <div className={s.pathPreview}>
                <span>Oluşacak path</span>
                <code>{computePath({ slug: slugifyTR(slug || nameTr), parentId }, tree.byId)}</code>
              </div>
            </div>

            <div className={s.actionRow}>
              <button onClick={saveCategory} disabled={busy} className={s.btnPrimaryWide}>
                {busy ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button onClick={resetForm} disabled={busy} className={s.btnSoft}>
                Temizle
              </button>
            </div>

            <div className={s.note}>
              Not: Altı dolu kategori direkt silinmez. Önce alt kategorileri taşıman ya da silmen gerekir.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  return (
    <AdminGate>
      <PermissionGate permission="categories">
        <AdminCategoriesPageInner />
      </PermissionGate>
    </AdminGate>
  );
}