"use client";

import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { uploadSettingsImage } from "@/lib/uploadProductImage";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./footerAdmin.module.css";

type Locale = "tr" | "en";
type LocaleText = { tr: string; en: string };
type FooterLink = { label: LocaleText; url: string };
type FooterColumn = { title: LocaleText; links: FooterLink[] };
type SocialType =
  | "instagram"
  | "whatsapp"
  | "youtube"
  | "tiktok"
  | "x"
  | "facebook"
  | "telegram";
type SocialItem = { type: SocialType; url: string };

type FooterSettings = {
  theme?: { variant?: "auto" | "light" | "dark" };
  brand?: {
    title?: LocaleText;
    tagline?: LocaleText;
    logoUrl?: string;
    logoLink?: string;
  };
  columns?: FooterColumn[];
  etbis?: {
    enabled?: boolean;
    title?: LocaleText;
    qrImageUrl?: string;
    qrLink?: string;
    note?: LocaleText;
  };
  social?: SocialItem[];
  bottom?: { left?: LocaleText; right?: LocaleText };
};

type SiteSettingsDoc = { footer?: FooterSettings };

type TabKey = "theme" | "brand" | "columns" | "etbis" | "social" | "bottom";

const emptyLT = (): LocaleText => ({ tr: "", en: "" });

function normalizeFooter(x: any): FooterSettings {
  const out: FooterSettings = typeof x === "object" && x ? x : {};

  const colsRaw = (out as any).columns;
  let cols: any[] = [];
  if (Array.isArray(colsRaw)) cols = colsRaw;
  else if (colsRaw && typeof colsRaw === "object") cols = Object.values(colsRaw);

  cols = cols.map((c: any) => {
    const title = c?.title && typeof c.title === "object" ? c.title : emptyLT();
    const linksRaw = c?.links;

    let links: any[] = [];
    if (Array.isArray(linksRaw)) links = linksRaw;
    else if (linksRaw && typeof linksRaw === "object") links = Object.values(linksRaw);

    links = links.map((l: any) => ({
      label: l?.label && typeof l.label === "object" ? l.label : emptyLT(),
      url: String(l?.url ?? "").trim(),
    }));

    return {
      title: { tr: String(title.tr ?? ""), en: String(title.en ?? "") },
      links,
    };
  });

  out.columns = cols as FooterColumn[];

  const socRaw = (out as any).social;
  let soc: any[] = [];
  if (Array.isArray(socRaw)) soc = socRaw;
  else if (socRaw && typeof socRaw === "object") soc = Object.values(socRaw);

  out.social = soc
    .map((a: any) => ({
      type: String(a?.type || "instagram") as SocialType,
      url: String(a?.url || "").trim(),
    }))
    .filter((a: SocialItem) => a.url || a.type);

  return out;
}

function FooterAdminPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "settings", "site"), [db]);

  const [tab, setTab] = useState<TabKey>("brand");

  const [cfg, setCfg] = useState<FooterSettings>(() =>
    normalizeFooter({
      theme: { variant: "auto" },
      brand: {
        title: { tr: "Dromocob", en: "Dromocob" },
        tagline: emptyLT(),
        logoUrl: "",
        logoLink: "/",
      },
      columns: [],
      etbis: {
        enabled: false,
        title: { tr: "ETBİS", en: "ETBIS" },
        qrImageUrl: "",
        qrLink: "",
        note: emptyLT(),
      },
      social: [],
      bottom: { left: emptyLT(), right: emptyLT() },
    })
  );

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(""), 1600);
  }

  useEffect(() => {
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as SiteSettingsDoc) || {};
        setCfg(normalizeFooter(data.footer || {}));
      },
      () => showToast("Firestore okunamadı")
    );
    return () => unsub();
  }, [ref]);

  async function save(next: FooterSettings) {
    setCfg(next);
    setSaving(true);
    try {
      await setDoc(ref, { footer: next }, { merge: true });
      showToast("Kaydedildi ✅");
    } catch (e: any) {
      showToast(e?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  function setLT(
    path:
      | "brand.title"
      | "brand.tagline"
      | "etbis.title"
      | "etbis.note"
      | "bottom.left"
      | "bottom.right",
    loc: Locale,
    value: string
  ) {
    const next = structuredClone(cfg) as FooterSettings;
    const [a, b] = path.split(".") as [keyof FooterSettings, any];

    (next as any)[a] = (next as any)[a] || {};
    (next as any)[a][b] = (next as any)[a][b] || emptyLT();
    (next as any)[a][b][loc] = value;

    void save(next);
  }

  function setField(path: string, value: any) {
    const next = structuredClone(cfg) as any;
    const parts = path.split(".");
    let cur = next;

    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }

    cur[parts[parts.length - 1]] = value;
    void save(next);
  }

  async function uploadAndSet(path: "brand.logoUrl" | "etbis.qrImageUrl", file: File, key: string) {
    showToast("Yükleniyor…");
    try {
      const url = await uploadSettingsImage(file, key);
      setField(path, url);
    } catch (e: any) {
      showToast(e?.message || "Upload fail");
    }
  }

  function addColumn() {
    const next = structuredClone(cfg) as FooterSettings;
    next.columns = Array.isArray(next.columns) ? next.columns : [];
    next.columns.unshift({ title: emptyLT(), links: [] });
    void save(next);
  }

  function removeColumn(i: number) {
    const next = structuredClone(cfg) as FooterSettings;
    next.columns = (next.columns || []).filter((_, idx) => idx !== i);
    void save(next);
  }

  function addLink(colIdx: number) {
    const next = structuredClone(cfg) as FooterSettings;
    next.columns = next.columns || [];
    next.columns[colIdx].links = next.columns[colIdx].links || [];
    next.columns[colIdx].links.push({ label: emptyLT(), url: "/" });
    void save(next);
  }

  function removeLink(colIdx: number, linkIdx: number) {
    const next = structuredClone(cfg) as FooterSettings;
    next.columns = next.columns || [];
    next.columns[colIdx].links = (next.columns[colIdx].links || []).filter((_, i) => i !== linkIdx);
    void save(next);
  }

  function setColTitle(colIdx: number, loc: Locale, val: string) {
    const next = structuredClone(cfg) as FooterSettings;
    next.columns = next.columns || [];
    next.columns[colIdx].title = next.columns[colIdx].title || emptyLT();
    next.columns[colIdx].title[loc] = val;
    void save(next);
  }

  function setLink(colIdx: number, linkIdx: number, field: "url" | "label.tr" | "label.en", val: string) {
    const next = structuredClone(cfg) as FooterSettings;
    next.columns = next.columns || [];
    const l = next.columns[colIdx].links[linkIdx];
    if (field === "url") l.url = val;
    if (field === "label.tr") (l.label = l.label || emptyLT()).tr = val;
    if (field === "label.en") (l.label = l.label || emptyLT()).en = val;
    void save(next);
  }

  function addSocial() {
    const next = structuredClone(cfg) as FooterSettings;
    next.social = Array.isArray(next.social) ? next.social : [];
    next.social.push({ type: "instagram", url: "" });
    void save(next);
  }

  function removeSocial(i: number) {
    const next = structuredClone(cfg) as FooterSettings;
    next.social = (next.social || []).filter((_, idx) => idx !== i);
    void save(next);
  }

  function setSocial(i: number, field: "type" | "url", val: string) {
    const next = structuredClone(cfg) as FooterSettings;
    next.social = next.social || [];
    (next.social[i] as any)[field] = val;
    void save(next);
  }

  const themeVariant = cfg?.theme?.variant || "auto";
  const columnsCount = (cfg.columns || []).length;
  const socialCount = (cfg.social || []).length;
  const etbisEnabled = Boolean(cfg?.etbis?.enabled);

  const tabs: { key: TabKey; label: string; count?: string }[] = [
    { key: "theme", label: "Tema" },
    { key: "brand", label: "Marka" },
    { key: "columns", label: "Kolonlar", count: String(columnsCount) },
    { key: "etbis", label: "ETBİS", count: etbisEnabled ? "Açık" : "Kapalı" },
    { key: "social", label: "Sosyal", count: String(socialCount) },
    { key: "bottom", label: "Alt Satır" },
  ];

  return (
    <main className={s.page}>
      {toast ? <div className={s.toast}>{toast}</div> : null}

      <section className={s.hero}>
        <div>
          <div className={s.kicker}>Admin • Footer</div>
          <h1 className={s.title}>Footer Ayarları</h1>
          <p className={s.sub}>
            Footer içeriğini tek merkezden düzenle. Marka, kolonlar, ETBİS, sosyal alanlar ve alt satır canlı kaydedilir.
          </p>
        </div>

        <div className={s.heroRight}>
          <div className={s.statusCard}>
            <div className={s.statusLabel}>Durum</div>
            <div className={s.statusValue}>{saving ? "Kaydediliyor…" : "Hazır"}</div>
          </div>
        </div>
      </section>

      <section className={s.quickGrid}>
        <div className={s.quickCard}>
          <span className={s.quickLabel}>Tema</span>
          <strong className={s.quickValue}>{themeVariant}</strong>
        </div>
        <div className={s.quickCard}>
          <span className={s.quickLabel}>Kolon</span>
          <strong className={s.quickValue}>{columnsCount}</strong>
        </div>
        <div className={s.quickCard}>
          <span className={s.quickLabel}>Sosyal</span>
          <strong className={s.quickValue}>{socialCount}</strong>
        </div>
        <div className={s.quickCard}>
          <span className={s.quickLabel}>ETBİS</span>
          <strong className={s.quickValue}>{etbisEnabled ? "Açık" : "Kapalı"}</strong>
        </div>
      </section>

      <section className={s.mainCard}>
        <div className={s.tabBar}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`${s.tabBtn} ${tab === t.key ? s.tabBtnActive : ""}`}
            >
              <span>{t.label}</span>
              {t.count ? <b>{t.count}</b> : null}
            </button>
          ))}
        </div>

        {tab === "theme" ? (
          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <div className={s.cardTitle}>Tema Ayarı</div>
                <div className={s.cardSub}>Footer koyuluğunu ve davranışını seç.</div>
              </div>
            </div>

            <div className={s.row}>
              <label className={s.label}>Variant</label>
              <select className={s.input} value={themeVariant} onChange={(e) => setField("theme.variant", e.target.value)}>
                <option value="auto">auto</option>
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
            </div>
          </section>
        ) : null}

        {tab === "brand" ? (
          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <div className={s.cardTitle}>Marka Alanı</div>
                <div className={s.cardSub}>Logo, başlık, slogan ve logo yönlendirmesini buradan yönet.</div>
              </div>
            </div>

            <div className={s.block}>
              <div className={s.miniTitle}>Başlık</div>
              <div className={s.grid2}>
                <input className={s.input} value={cfg?.brand?.title?.tr || ""} onChange={(e) => setLT("brand.title", "tr", e.target.value)} placeholder="TR başlık" />
                <input className={s.input} value={cfg?.brand?.title?.en || ""} onChange={(e) => setLT("brand.title", "en", e.target.value)} placeholder="EN title" />
              </div>
            </div>

            <div className={s.block}>
              <div className={s.miniTitle}>Slogan</div>
              <div className={s.grid2}>
                <input className={s.input} value={cfg?.brand?.tagline?.tr || ""} onChange={(e) => setLT("brand.tagline", "tr", e.target.value)} placeholder="TR slogan" />
                <input className={s.input} value={cfg?.brand?.tagline?.en || ""} onChange={(e) => setLT("brand.tagline", "en", e.target.value)} placeholder="EN tagline" />
              </div>
            </div>

            <div className={s.grid2}>
              <div className={s.row}>
                <label className={s.label}>Logo Link</label>
                <input className={s.input} value={cfg?.brand?.logoLink || ""} onChange={(e) => setField("brand.logoLink", e.target.value)} placeholder="/" />
              </div>

              <div className={s.row}>
                <label className={s.label}>Logo URL</label>
                <input className={s.input} value={cfg?.brand?.logoUrl || ""} onChange={(e) => setField("brand.logoUrl", e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <div className={s.uploadRow}>
              <div className={s.uploadLeft}>
                <div className={s.miniTitle}>Logo Yükle</div>
                <div className={s.miniHint}>Storage: settings-images / footer-logo</div>
              </div>

              <label className={s.btn}>
                Logo seç
                <input
                  className={s.file}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAndSet("brand.logoUrl", f, "footer-logo");
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {cfg?.brand?.logoUrl ? (
              <div className={s.preview}>
                <img src={cfg.brand.logoUrl} alt="logo" />
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "columns" ? (
          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <div className={s.cardTitle}>Link Kolonları</div>
                <div className={s.cardSub}>Footer link yapılarını kolon bazlı düzenle.</div>
              </div>
              <button className={s.btnDark} type="button" onClick={addColumn}>
                Kolon ekle
              </button>
            </div>

            {(cfg.columns || []).length === 0 ? (
              <div className={s.empty}>Henüz kolon yok. “Kolon ekle” ile başla.</div>
            ) : (
              <div className={s.colGrid}>
                {(cfg.columns || []).map((col, i) => (
                  <div key={i} className={s.colCard}>
                    <div className={s.colTop}>
                      <div className={s.miniTitle}>Kolon #{i + 1}</div>
                      <button className={s.iconBtn} type="button" onClick={() => removeColumn(i)}>
                        Sil
                      </button>
                    </div>

                    <div className={s.grid2}>
                      <input className={s.input} value={col.title?.tr || ""} onChange={(e) => setColTitle(i, "tr", e.target.value)} placeholder="Başlık TR" />
                      <input className={s.input} value={col.title?.en || ""} onChange={(e) => setColTitle(i, "en", e.target.value)} placeholder="Title EN" />
                    </div>

                    <div className={s.linksHead}>
                      <div className={s.miniTitle}>Linkler</div>
                      <button className={s.btn} type="button" onClick={() => addLink(i)}>
                        Link ekle
                      </button>
                    </div>

                    {(col.links || []).length === 0 ? (
                      <div className={s.emptyMini}>Bu kolonda link yok.</div>
                    ) : (
                      (col.links || []).map((lnk, j) => (
                        <div key={j} className={s.linkRow}>
                          <div className={s.grid2}>
                            <input className={s.input} value={lnk.label?.tr || ""} onChange={(e) => setLink(i, j, "label.tr", e.target.value)} placeholder="Label TR" />
                            <input className={s.input} value={lnk.label?.en || ""} onChange={(e) => setLink(i, j, "label.en", e.target.value)} placeholder="Label EN" />
                          </div>

                          <div className={s.grid2Compact}>
                            <input className={s.input} value={lnk.url || ""} onChange={(e) => setLink(i, j, "url", e.target.value)} placeholder="/hakkimizda" />
                            <button className={s.iconBtn} type="button" onClick={() => removeLink(i, j)}>
                              Sil
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {tab === "etbis" ? (
          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <div className={s.cardTitle}>ETBİS Alanı</div>
                <div className={s.cardSub}>QR, başlık, link ve not metinlerini yönet.</div>
              </div>

              <label className={s.switch}>
                <input type="checkbox" checked={Boolean(cfg?.etbis?.enabled)} onChange={(e) => setField("etbis.enabled", e.target.checked)} />
                <span />
              </label>
            </div>

            <div className={s.grid2}>
              <div>
                <div className={s.miniTitle}>Başlık</div>
                <div className={s.grid2}>
                  <input className={s.input} value={cfg?.etbis?.title?.tr || ""} onChange={(e) => setLT("etbis.title", "tr", e.target.value)} placeholder="TR" />
                  <input className={s.input} value={cfg?.etbis?.title?.en || ""} onChange={(e) => setLT("etbis.title", "en", e.target.value)} placeholder="EN" />
                </div>
              </div>

              <div>
                <div className={s.miniTitle}>Not</div>
                <div className={s.grid2}>
                  <input className={s.input} value={cfg?.etbis?.note?.tr || ""} onChange={(e) => setLT("etbis.note", "tr", e.target.value)} placeholder="TR not" />
                  <input className={s.input} value={cfg?.etbis?.note?.en || ""} onChange={(e) => setLT("etbis.note", "en", e.target.value)} placeholder="EN note" />
                </div>
              </div>
            </div>

            <div className={s.grid2}>
              <div className={s.row}>
                <label className={s.label}>QR Link</label>
                <input className={s.input} value={cfg?.etbis?.qrLink || ""} onChange={(e) => setField("etbis.qrLink", e.target.value)} placeholder="https://..." />
              </div>

              <div className={s.row}>
                <label className={s.label}>QR Image URL</label>
                <input className={s.input} value={cfg?.etbis?.qrImageUrl || ""} onChange={(e) => setField("etbis.qrImageUrl", e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <div className={s.uploadRow}>
              <div className={s.uploadLeft}>
                <div className={s.miniTitle}>QR Yükle</div>
                <div className={s.miniHint}>Storage: settings-images / footer-etbis-qr</div>
              </div>

              <label className={s.btn}>
                QR seç
                <input
                  className={s.file}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAndSet("etbis.qrImageUrl", f, "footer-etbis-qr");
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {cfg?.etbis?.qrImageUrl ? (
              <div className={s.preview}>
                <img src={cfg.etbis.qrImageUrl} alt="etbis qr" />
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "social" ? (
          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <div className={s.cardTitle}>Sosyal Linkler</div>
                <div className={s.cardSub}>Sosyal medya alanlarını sırayla düzenle.</div>
              </div>

              <button className={s.btnDark} type="button" onClick={addSocial}>
                Sosyal ekle
              </button>
            </div>

            {(cfg.social || []).length === 0 ? (
              <div className={s.empty}>Henüz sosyal link yok.</div>
            ) : (
              <div className={s.socialGrid}>
                {(cfg.social || []).map((x, i) => (
                  <div key={i} className={s.socialRow}>
                    <select className={s.input} value={x.type} onChange={(e) => setSocial(i, "type", e.target.value)}>
                      {["instagram", "whatsapp", "youtube", "tiktok", "x", "facebook", "telegram"].map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>

                    <input className={s.input} value={x.url} onChange={(e) => setSocial(i, "url", e.target.value)} placeholder="https://..." />

                    <button className={s.iconBtn} type="button" onClick={() => removeSocial(i)}>
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {tab === "bottom" ? (
          <section className={s.card}>
            <div className={s.cardHead}>
              <div>
                <div className={s.cardTitle}>Alt Satır</div>
                <div className={s.cardSub}>Footer alt bölümündeki sol ve sağ metinleri düzenle.</div>
              </div>
            </div>

            <div className={s.grid2}>
              <div>
                <div className={s.miniTitle}>Sol ({`{{year}}`} destekli)</div>
                <div className={s.grid2}>
                  <input className={s.input} value={cfg?.bottom?.left?.tr || ""} onChange={(e) => setLT("bottom.left", "tr", e.target.value)} placeholder="TR sol metin" />
                  <input className={s.input} value={cfg?.bottom?.left?.en || ""} onChange={(e) => setLT("bottom.left", "en", e.target.value)} placeholder="EN left text" />
                </div>
              </div>

              <div>
                <div className={s.miniTitle}>Sağ</div>
                <div className={s.grid2}>
                  <input className={s.input} value={cfg?.bottom?.right?.tr || ""} onChange={(e) => setLT("bottom.right", "tr", e.target.value)} placeholder="TR sağ metin" />
                  <input className={s.input} value={cfg?.bottom?.right?.en || ""} onChange={(e) => setLT("bottom.right", "en", e.target.value)} placeholder="EN right text" />
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default function FooterAdminPage() {
  return (
    <AdminGate>
      <PermissionGate permission="footer_settings">
        <FooterAdminPageInner />
      </PermissionGate>
    </AdminGate>
  );
}