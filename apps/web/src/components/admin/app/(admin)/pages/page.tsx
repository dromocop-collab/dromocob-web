"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./pagesAdmin.module.css";

type LocaleText = { tr?: string; en?: string };
type GroupId = string;

type GroupRow = {
  id: string;
  label?: LocaleText;
  order?: number;
  isActive?: boolean;
};

type NavPlacement = {
  header?: boolean;
  footer?: boolean;
  quickLinks?: boolean;
};

type NavLink = {
  enabled?: boolean;
  mode?: "page" | "custom";
  label?: LocaleText;
  href?: string;
  target?: "_self" | "_blank";
  nofollow?: boolean;
  order?: number;
};

type PageSeo = {
  title?: LocaleText;
  description?: LocaleText;
};

type PageDoc = {
  title: LocaleText;
  contentHtml?: LocaleText;
  group: GroupId;
  slug: string;
  order: number;
  isPublished: boolean;
  isVisible?: boolean;
  nav?: {
    placements?: NavPlacement;
    link?: NavLink;
  };
  seo?: PageSeo;
  blocks?: any[];
  updatedAt?: any;
};

type PageRow = PageDoc & { id: string };

const emptyLT = (): LocaleText => ({ tr: "", en: "" });

function slugifyTR(input: string) {
  const map: Record<string, string> = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    I: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };

  const s1 = String(input || "")
    .trim()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");

  return s1
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function pickLT(v: any): LocaleText {
  return {
    tr: typeof v?.tr === "string" ? v.tr : "",
    en: typeof v?.en === "string" ? v.en : "",
  };
}

function safeNum(v: any, fallback = 9999) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function deepClean<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(deepClean) as any;
  if (typeof obj === "number") return (Number.isFinite(obj) ? obj : 0) as any;

  const isPlainObject = typeof obj === "object" && obj.constructor === Object;
  if (!isPlainObject) return obj;

  const out: any = {};
  for (const [k, v] of Object.entries(obj as any)) {
    if (v === undefined) continue;
    out[k] = deepClean(v);
  }
  return out;
}

function makeEmptyDraft(group: GroupId, nextOrder: number): PageDoc {
  return {
    group,
    slug: "",
    order: nextOrder,
    isPublished: true,
    isVisible: true,
    title: emptyLT(),
    contentHtml: { tr: "<p></p>", en: "<p></p>" },
    blocks: [],
    nav: {
      placements: {
        header: false,
        footer: false,
        quickLinks: false,
      },
      link: {
        enabled: true,
        mode: "page",
        label: emptyLT(),
        href: "",
        target: "_self",
        nofollow: false,
        order: nextOrder,
      },
    },
    seo: {
      title: emptyLT(),
      description: emptyLT(),
    },
  };
}

function normalizePage(id: string, data: any): PageRow | null {
  const raw = data?.pageDoc && typeof data.pageDoc === "object" ? data.pageDoc : data;

  const group = String(raw?.group || "").trim();
  const slug = String(raw?.slug || "").trim();
  if (!group || !slug) return null;

  return {
    id,
    group,
    slug,
    order: safeNum(raw?.order, 9999),
    isPublished: Boolean(raw?.isPublished),
    isVisible: raw?.isVisible !== false,
    title: pickLT(raw?.title),
    contentHtml: {
      tr: String(raw?.contentHtml?.tr || "<p></p>"),
      en: String(raw?.contentHtml?.en || "<p></p>"),
    },
    blocks: Array.isArray(raw?.blocks) ? raw.blocks : [],
    nav: {
      placements: {
        header: Boolean(raw?.nav?.placements?.header),
        footer: Boolean(raw?.nav?.placements?.footer),
        quickLinks: Boolean(raw?.nav?.placements?.quickLinks),
      },
      link: {
        enabled: raw?.nav?.link?.enabled !== false,
        mode: raw?.nav?.link?.mode === "custom" ? "custom" : "page",
        label: pickLT(raw?.nav?.link?.label),
        href: String(raw?.nav?.link?.href || ""),
        target: raw?.nav?.link?.target === "_blank" ? "_blank" : "_self",
        nofollow: Boolean(raw?.nav?.link?.nofollow),
        order: safeNum(raw?.nav?.link?.order, safeNum(raw?.order, 9999)),
      },
    },
    seo: {
      title: pickLT(raw?.seo?.title),
      description: pickLT(raw?.seo?.description),
    },
    updatedAt: raw?.updatedAt,
  };
}

function pageUrl(p: Partial<PageDoc>) {
  return `/${String(p.group || "").trim()}/${slugifyTR(String(p.slug || "").trim())}`;
}

function resolvedLink(p: Partial<PageDoc>) {
  const mode = p?.nav?.link?.mode || "page";
  if (mode === "custom" && p?.nav?.link?.href) return String(p.nav.link.href).trim();
  return pageUrl(p);
}

function AdminPagesInner() {
  const router = useRouter();
  const db = useMemo(() => getFirebaseDb(), []);

  const [rows, setRows] = useState<PageRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupId>("kurumsal");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PageDoc>(() => makeEmptyDraft("kurumsal", 1));

  const [htmlOpen, setHtmlOpen] = useState(false);
  const [htmlId, setHtmlId] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(""), 1800);
  }

  useEffect(() => {
    const ref = doc(db, "site_options", "home_settings");
    return onSnapshot(
      ref,
      (snap) => {
        const d: any = snap.data() || {};
        const list = Array.isArray(d?.blockLibrary?.groups) ? d.blockLibrary.groups : [];

        const normalized: GroupRow[] = list
  .map((g: any) => ({
    id: String(g?.id || "").trim(),
    label: (g?.label || {}) as LocaleText,
    order: Number(g?.order ?? 9999),
    isActive: g?.isActive !== false,
  }))
  .filter((g: GroupRow) => g.id && g.isActive)
  .sort((a: GroupRow, b: GroupRow) => (a.order ?? 9999) - (b.order ?? 9999));

        setGroups(normalized);

        if (normalized.length && !normalized.some((x) => x.id === selectedGroup)) {
          setSelectedGroup(normalized[0].id);
        }
      },
      () => setGroups([])
    );
  }, [db, selectedGroup]);

  useEffect(() => {
    const ref = collection(db, "pages");
    const qq = query(ref, orderBy("order", "asc"));
    return onSnapshot(
      qq,
      (snap) => {
        const list: PageRow[] = [];
        snap.forEach((d) => {
          const n = normalizePage(d.id, d.data());
          if (n) list.push(n);
        });
        list.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
        setRows(list);
      },
      () => setRows([])
    );
  }, [db]);

  const filtered = rows
    .filter((r) => r.group === selectedGroup)
    .filter((r) => {
      const hay = `
        ${r.slug}
        ${r.title?.tr || ""}
        ${r.title?.en || ""}
        ${r.nav?.link?.label?.tr || ""}
        ${r.nav?.link?.label?.en || ""}
        ${resolvedLink(r)}
      `.toLowerCase();

      return !q.trim() || hay.includes(q.trim().toLowerCase());
    });

  const nextOrder = useMemo(() => {
    const max = rows
      .filter((r) => r.group === selectedGroup)
      .reduce((m, r) => Math.max(m, Number(r.order) || 0), 0);
    return (max || 0) + 1;
  }, [rows, selectedGroup]);

  function openCreate() {
    setEditingId(null);
    setDraft(makeEmptyDraft(selectedGroup, nextOrder));
    setModalOpen(true);
  }

  function openEditMeta(id: string) {
    const r = rows.find((x) => x.id === id);
    if (!r) return;

    setEditingId(id);
    setDraft({
      group: r.group,
      slug: r.slug,
      order: Number(r.order) || 1,
      isPublished: Boolean(r.isPublished),
      isVisible: r.isVisible !== false,
      title: { tr: r.title.tr || "", en: r.title.en || "" },
      contentHtml: { tr: r.contentHtml?.tr || "<p></p>", en: r.contentHtml?.en || "<p></p>" },
      blocks: Array.isArray(r.blocks) ? r.blocks : [],
      nav: {
        placements: {
          header: Boolean(r.nav?.placements?.header),
          footer: Boolean(r.nav?.placements?.footer),
          quickLinks: Boolean(r.nav?.placements?.quickLinks),
        },
        link: {
          enabled: r.nav?.link?.enabled !== false,
          mode: r.nav?.link?.mode || "page",
          label: {
            tr: r.nav?.link?.label?.tr || "",
            en: r.nav?.link?.label?.en || "",
          },
          href: r.nav?.link?.href || "",
          target: r.nav?.link?.target || "_self",
          nofollow: Boolean(r.nav?.link?.nofollow),
          order: Number(r.nav?.link?.order ?? r.order ?? 1),
        },
      },
      seo: {
        title: {
          tr: r.seo?.title?.tr || "",
          en: r.seo?.title?.en || "",
        },
        description: {
          tr: r.seo?.description?.tr || "",
          en: r.seo?.description?.en || "",
        },
      },
    });

    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function gotoBuilder(id: string) {
    router.push(`/admin/pages/${encodeURIComponent(id)}`);
  }

  function openQuickHtml(id: string) {
    setHtmlId(id);
    setHtmlOpen(true);
  }

  function closeQuickHtml() {
    setHtmlOpen(false);
    setHtmlId(null);
  }

  async function saveDraftMeta() {
    const slug = slugifyTR(draft.slug || draft.title.tr || draft.title.en || "");
    if (!slug) return showToast("Slug boş olamaz");

    const id = editingId ?? `${draft.group}-${slug}`;

    setSaving(true);
    try {
      const payload: PageDoc = {
        ...draft,
        slug,
        updatedAt: serverTimestamp(),
        nav: {
          placements: {
            header: Boolean(draft?.nav?.placements?.header),
            footer: Boolean(draft?.nav?.placements?.footer),
            quickLinks: Boolean(draft?.nav?.placements?.quickLinks),
          },
          link: {
            enabled: draft?.nav?.link?.enabled !== false,
            mode: draft?.nav?.link?.mode === "custom" ? "custom" : "page",
            label: {
              tr: draft?.nav?.link?.label?.tr || draft.title.tr || "",
              en: draft?.nav?.link?.label?.en || draft.title.en || "",
            },
            href: draft?.nav?.link?.href || "",
            target: draft?.nav?.link?.target === "_blank" ? "_blank" : "_self",
            nofollow: Boolean(draft?.nav?.link?.nofollow),
            order: safeNum(draft?.nav?.link?.order, safeNum(draft.order, 9999)),
          },
        },
      };

      await setDoc(doc(db, "pages", id), deepClean(payload), { merge: true });

      showToast(editingId ? "Güncellendi ✅" : "Eklendi ✅");
      setModalOpen(false);
      setEditingId(null);
      router.push(`/admin/pages/${encodeURIComponent(id)}`);
    } catch (e: any) {
      showToast(e?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(id: string, on: boolean) {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "pages", id),
        { isPublished: on, updatedAt: serverTimestamp() },
        { merge: true }
      );
      showToast(on ? "Yayına alındı ✅" : "Taslağa alındı ✅");
    } catch (e: any) {
      showToast(e?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisible(id: string, on: boolean) {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "pages", id),
        { isVisible: on, updatedAt: serverTimestamp() },
        { merge: true }
      );
      showToast(on ? "Görünür yapıldı ✅" : "Gizlendi ✅");
    } catch (e: any) {
      showToast(e?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function removePage(id: string) {
    if (!confirm("Silinsin mi?")) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "pages", id));
      showToast("Silindi 🗑️");
    } catch (e: any) {
      showToast(e?.message || "Silinemedi");
    } finally {
      setSaving(false);
    }
  }

  function setDraftField(path: string, val: any) {
    setDraft((p) => {
      const next = structuredClone(p) as any;
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = cur[parts[i]] || {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = val;
      return next;
    });
  }

  useEffect(() => {
    if (editingId) return;
    const base = draft.title.tr || draft.title.en || "";
    const auto = slugifyTR(base);
    if (auto && (!draft.slug || slugifyTR(draft.slug) !== auto)) {
      setDraft((p) => ({ ...p, slug: auto }));
    }
  }, [draft.title.tr, draft.title.en, draft.slug, editingId]);

  const groupLabel =
    groups.find((g) => g.id === selectedGroup)?.label?.tr || selectedGroup;

  const groupList = groups.length
    ? groups
    : [
        { id: "kurumsal", label: { tr: "Kurumsal" } },
        { id: "yardim", label: { tr: "Yardım" } },
      ];

  return (
    <main className={s.page}>
      {toast ? <div className={s.toast}>{toast}</div> : null}

      <div className={s.top}>
        <div>
          <div className={s.kicker}>Admin • İçerik Yönetimi</div>
          <h1 className={s.title}>Sayfalar</h1>
          <div className={s.sub}>
            Grup: <b>{groupLabel}</b> • Firestore: <b className={s.mono}>pages</b>
          </div>
        </div>

        <div className={s.right}>
          <div className={s.segment}>
            {groupList.map((g) => (
              <button
                key={g.id}
                className={`${s.segBtn} ${selectedGroup === g.id ? s.segOn : ""}`}
                onClick={() => setSelectedGroup(g.id)}
                type="button"
              >
                {g.label?.tr || g.label?.en || g.id}
              </button>
            ))}
          </div>

          <Link className={s.softBtn} href="/admin/pages/groups">
            Gruplar
          </Link>

          <input
            className={s.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara… (slug / başlık / link)"
          />

          <button className={s.btnDark} type="button" onClick={openCreate}>
            + Sayfa Ekle
          </button>

          <span className={s.pill}>{saving ? "İşlem…" : `${filtered.length} sayfa`}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={s.emptyBox}>Bu grupta sayfa yok.</div>
      ) : (
        <div className={s.list}>
          {filtered.map((r) => {
            const title = r.title.tr || r.title.en || r.slug;
            const hasBlocks = Array.isArray(r.blocks) && r.blocks.length > 0;
            const link = resolvedLink(r);

            return (
              <div key={r.id} className={s.row}>
                <div className={s.left}>
                  <div className={s.rowTitle}>
                    {title}
                    {!r.isPublished ? (
                      <span className={s.badge}>Taslak</span>
                    ) : (
                      <span className={s.badgeOn}>Yayında</span>
                    )}

                    {r.isVisible === false ? (
                      <span className={s.badgeMuted}>Gizli</span>
                    ) : (
                      <span className={s.badgeSoft}>Görünür</span>
                    )}

                    {hasBlocks ? (
                      <span className={s.badgeSoft}>Blocks</span>
                    ) : (
                      <span className={s.badgeSoft}>HTML</span>
                    )}

                    {r.nav?.placements?.header ? <span className={s.badgeMini}>Header</span> : null}
                    {r.nav?.placements?.footer ? <span className={s.badgeMini}>Footer</span> : null}
                    {r.nav?.placements?.quickLinks ? <span className={s.badgeMini}>Quick</span> : null}
                    {r.nav?.link?.mode === "custom" ? <span className={s.badgeMini}>Custom Link</span> : null}
                  </div>

                  <div className={s.meta}>
                    <span className={s.mono}>{link}</span>
                    <span>•</span>
                    <span>Sıra: <b>{r.order}</b></span>
                    <span>•</span>
                    <span>Nav sıra: <b>{r.nav?.link?.order ?? r.order}</b></span>
                    <span>•</span>
                    <span className={s.mono}>id: {r.id}</span>
                  </div>
                </div>

                <div className={s.actions}>
                  <a className={s.softBtn} href={link} target="_blank" rel="noreferrer">
                    Gör
                  </a>

                  <button className={s.softBtn} type="button" onClick={() => gotoBuilder(r.id)}>
                    Builder
                  </button>

                  <button className={s.softBtn} type="button" onClick={() => openEditMeta(r.id)}>
                    Meta
                  </button>

                  <button className={s.softBtn} type="button" onClick={() => openQuickHtml(r.id)}>
                    HTML
                  </button>

                  <button
                    className={r.isVisible === false ? s.okBtn : s.warnBtn}
                    type="button"
                    onClick={() => toggleVisible(r.id, r.isVisible === false)}
                  >
                    {r.isVisible === false ? "Görünür Yap" : "Gizle"}
                  </button>

                  <button
                    className={r.isPublished ? s.warnBtn : s.okBtn}
                    type="button"
                    onClick={() => togglePublish(r.id, !r.isPublished)}
                  >
                    {r.isPublished ? "Taslağa Al" : "Yayınla"}
                  </button>

                  <button className={s.dangerBtn} onClick={() => removePage(r.id)} type="button">
                    Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen ? (
        <div className={s.modalWrap} onClick={closeModal}>
          <div className={s.modalXl} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHead}>
              <b>{editingId ? "Sayfa Gelişmiş Ayarlar" : "Yeni Sayfa Oluştur"}</b>
              <button className={s.iconBtn} onClick={closeModal} type="button" aria-label="Close">
                ✕
              </button>
            </div>

            <div className={s.form}>
              <div className={s.panelGrid}>
                <section className={s.formCard}>
                  <div className={s.cardTitle}>Temel Bilgiler</div>

                  <div className={s.grid2}>
                    <div className={s.row2}>
                      <label className={s.label}>Grup</label>
                      <select
                        className={s.input}
                        value={draft.group}
                        onChange={(e) => setDraftField("group", e.target.value)}
                      >
                        {groupList.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label?.tr || g.label?.en || g.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={s.row2}>
                      <label className={s.label}>Sıra</label>
                      <input
                        className={s.input}
                        inputMode="numeric"
                        value={draft.order}
                        onChange={(e) => setDraftField("order", Number(e.target.value || 0))}
                      />
                    </div>
                  </div>

                  <div>
                    <div className={s.miniTitle}>Başlık</div>
                    <div className={s.grid2}>
                      <input
                        className={s.input}
                        value={draft.title.tr}
                        onChange={(e) => setDraftField("title.tr", e.target.value)}
                        placeholder="TR Başlık"
                      />
                      <input
                        className={s.input}
                        value={draft.title.en}
                        onChange={(e) => setDraftField("title.en", e.target.value)}
                        placeholder="EN Title"
                      />
                    </div>
                  </div>

                  <div className={s.grid2}>
                    <div className={s.row2}>
                      <label className={s.label}>Slug</label>
                      <input
                        className={s.input}
                        value={draft.slug}
                        onChange={(e) => setDraftField("slug", e.target.value)}
                        placeholder="hakkimizda"
                      />
                    </div>

                    <div className={s.row2}>
                      <label className={s.label}>Görünürlük</label>
                      <div className={s.switchCol}>
                        <label className={s.switchLine}>
                          <input
                            type="checkbox"
                            checked={Boolean(draft.isPublished)}
                            onChange={(e) => setDraftField("isPublished", e.target.checked)}
                          />
                          <span>Yayında olsun</span>
                        </label>

                        <label className={s.switchLine}>
                          <input
                            type="checkbox"
                            checked={draft.isVisible !== false}
                            onChange={(e) => setDraftField("isVisible", e.target.checked)}
                          />
                          <span>Listelerde görünsün</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className={s.previewBox}>
                    <div className={s.previewLabel}>Sayfa URL</div>
                    <div className={s.previewValue}>{pageUrl(draft)}</div>
                  </div>
                </section>

                <section className={s.formCard}>
                  <div className={s.cardTitle}>Menü / Footer Link Ayarları</div>

                  <div className={s.grid2}>
                    <div className={s.row2}>
                      <label className={s.label}>Link Modu</label>
                      <select
                        className={s.input}
                        value={draft.nav?.link?.mode || "page"}
                        onChange={(e) => setDraftField("nav.link.mode", e.target.value)}
                      >
                        <option value="page">Dahili Sayfa Linki</option>
                        <option value="custom">Özel Link</option>
                      </select>
                    </div>

                    <div className={s.row2}>
                      <label className={s.label}>Link Sırası</label>
                      <input
                        className={s.input}
                        inputMode="numeric"
                        value={draft.nav?.link?.order ?? draft.order}
                        onChange={(e) => setDraftField("nav.link.order", Number(e.target.value || 0))}
                      />
                    </div>
                  </div>

                  <div>
                    <div className={s.miniTitle}>Menü Başlığı</div>
                    <div className={s.grid2}>
                      <input
                        className={s.input}
                        value={draft.nav?.link?.label?.tr || ""}
                        onChange={(e) => setDraftField("nav.link.label.tr", e.target.value)}
                        placeholder="TR Menü Başlığı"
                      />
                      <input
                        className={s.input}
                        value={draft.nav?.link?.label?.en || ""}
                        onChange={(e) => setDraftField("nav.link.label.en", e.target.value)}
                        placeholder="EN Menu Label"
                      />
                    </div>
                  </div>

                  {(draft.nav?.link?.mode || "page") === "custom" ? (
                    <div className={s.row2}>
                      <label className={s.label}>Özel Link</label>
                      <input
                        className={s.input}
                        value={draft.nav?.link?.href || ""}
                        onChange={(e) => setDraftField("nav.link.href", e.target.value)}
                        placeholder="https://... veya /kampanyalar"
                      />
                    </div>
                  ) : null}

                  <div className={s.grid3}>
                    <label className={s.switchTile}>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.nav?.placements?.header)}
                        onChange={(e) => setDraftField("nav.placements.header", e.target.checked)}
                      />
                      <span>Header’da göster</span>
                    </label>

                    <label className={s.switchTile}>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.nav?.placements?.footer)}
                        onChange={(e) => setDraftField("nav.placements.footer", e.target.checked)}
                      />
                      <span>Footer’da göster</span>
                    </label>

                    <label className={s.switchTile}>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.nav?.placements?.quickLinks)}
                        onChange={(e) => setDraftField("nav.placements.quickLinks", e.target.checked)}
                      />
                      <span>Quick linklerde göster</span>
                    </label>
                  </div>

                  <div className={s.grid3}>
                    <label className={s.switchTile}>
                      <input
                        type="checkbox"
                        checked={draft.nav?.link?.enabled !== false}
                        onChange={(e) => setDraftField("nav.link.enabled", e.target.checked)}
                      />
                      <span>Link aktif olsun</span>
                    </label>

                    <label className={s.switchTile}>
                      <input
                        type="checkbox"
                        checked={draft.nav?.link?.target === "_blank"}
                        onChange={(e) =>
                          setDraftField("nav.link.target", e.target.checked ? "_blank" : "_self")
                        }
                      />
                      <span>Yeni sekmede açılsın</span>
                    </label>

                    <label className={s.switchTile}>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.nav?.link?.nofollow)}
                        onChange={(e) => setDraftField("nav.link.nofollow", e.target.checked)}
                      />
                      <span>Nofollow</span>
                    </label>
                  </div>

                  <div className={s.previewBox}>
                    <div className={s.previewLabel}>Çözümlenen Link</div>
                    <div className={s.previewValue}>{resolvedLink(draft)}</div>
                  </div>
                </section>

                <section className={s.formCard}>
                  <div className={s.cardTitle}>SEO Ayarları</div>

                  <div>
                    <div className={s.miniTitle}>SEO Title</div>
                    <div className={s.grid2}>
                      <input
                        className={s.input}
                        value={draft.seo?.title?.tr || ""}
                        onChange={(e) => setDraftField("seo.title.tr", e.target.value)}
                        placeholder="TR SEO Title"
                      />
                      <input
                        className={s.input}
                        value={draft.seo?.title?.en || ""}
                        onChange={(e) => setDraftField("seo.title.en", e.target.value)}
                        placeholder="EN SEO Title"
                      />
                    </div>
                  </div>

                  <div>
                    <div className={s.miniTitle}>SEO Description</div>
                    <div className={s.grid2}>
                      <textarea
                        className={s.textareaSmall}
                        value={draft.seo?.description?.tr || ""}
                        onChange={(e) => setDraftField("seo.description.tr", e.target.value)}
                        placeholder="TR açıklama"
                      />
                      <textarea
                        className={s.textareaSmall}
                        value={draft.seo?.description?.en || ""}
                        onChange={(e) => setDraftField("seo.description.en", e.target.value)}
                        placeholder="EN description"
                      />
                    </div>
                  </div>
                </section>

                <section className={s.formCard}>
                  <div className={s.cardTitle}>Builder Notu</div>
                  <div className={s.noteText}>
                    Bu ekranda meta, link ve görünürlük yönetiliyor. İçerik tasarımı için
                    <b> Builder</b> ekranına geç. Footer’a düşmesi için burada ayrıca
                    <b> “Footer’da göster”</b> aktif olmalı.
                  </div>
                </section>
              </div>
            </div>

            <div className={s.modalFoot}>
              <button className={s.softBtn} onClick={closeModal} type="button">
                Vazgeç
              </button>
              <button className={s.primaryBtn} onClick={saveDraftMeta} type="button" disabled={saving}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {htmlOpen && htmlId ? (
        <QuickHtmlModal
          id={htmlId}
          rows={rows}
          onClose={closeQuickHtml}
          onToast={showToast}
        />
      ) : null}
    </main>
  );
}

function QuickHtmlModal({
  id,
  rows,
  onClose,
  onToast,
}: {
  id: string;
  rows: PageRow[];
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const db = useMemo(() => getFirebaseDb(), []);
  const r = rows.find((x) => x.id === id);

  const [tr, setTr] = useState(r?.contentHtml?.tr || "<p></p>");
  const [en, setEn] = useState(r?.contentHtml?.en || "<p></p>");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTr(r?.contentHtml?.tr || "<p></p>");
    setEn(r?.contentHtml?.en || "<p></p>");
  }, [id, r?.contentHtml?.tr, r?.contentHtml?.en]);

  async function save() {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "pages", id),
        { contentHtml: { tr, en }, updatedAt: serverTimestamp() },
        { merge: true }
      );
      onToast("HTML kaydedildi ✅");
      onClose();
    } catch (e: any) {
      onToast(e?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.modalWrap} onClick={onClose}>
      <div className={s.modalWide} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <b>HTML Düzenle (Legacy)</b>
          <button className={s.iconBtn} onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>

        <div className={s.form}>
          <div className={s.grid2}>
            <div>
              <div className={s.miniTitle}>TR (HTML)</div>
              <textarea className={s.textarea} value={tr} onChange={(e) => setTr(e.target.value)} />
            </div>
            <div>
              <div className={s.miniTitle}>EN (HTML)</div>
              <textarea className={s.textarea} value={en} onChange={(e) => setEn(e.target.value)} />
            </div>
          </div>
          <div className={s.hint}>Builder kullanıyorsan HTML boş kalabilir.</div>
        </div>

        <div className={s.modalFoot}>
          <button className={s.softBtn} onClick={onClose} type="button">
            Vazgeç
          </button>
          <button className={s.primaryBtn} onClick={save} type="button" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPages() {
  return (
    <AdminGate>
      <PermissionGate permission="pages_admin">
        <AdminPagesInner />
      </PermissionGate>
    </AdminGate>
  );
}