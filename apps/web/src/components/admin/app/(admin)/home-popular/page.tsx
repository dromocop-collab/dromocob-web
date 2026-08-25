"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, deleteField } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./home-popular.module.css";

type TabRow = {
  id: string;
  key: string;
  tr: string;
  en: string;
  enabled: boolean;
  open: boolean;
  isActive?: boolean;
};

function s(v: any) {
  return String(v ?? "").trim();
}

function slugKey(v: string) {
  return s(v)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function uid() {
  return `tab_${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_ROWS: TabRow[] = [
  {
    id: uid(),
    key: "all",
    tr: "Tümü",
    en: "All",
    enabled: true,
    open: true,
  },
  {
    id: uid(),
    key: "bestsellers",
    tr: "Çok Satanlar",
    en: "Bestsellers",
    enabled: true,
    open: false,
  },
  {
    id: uid(),
    key: "featured",
    tr: "Gözde",
    en: "Featured",
    enabled: true,
    open: false,
  },
];

export default function AdminHomePopularTabsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="home_settings">
        <AdminHomePopularTabsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}

function AdminHomePopularTabsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<TabRow[]>(DEFAULT_ROWS);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setBusy(true);
      setMsg(null);

      try {
        const ref = doc(db, "site_options", "home_settings");
        const snap = await getDoc(ref);
        if (!alive) return;

        const data: any = snap.exists() ? snap.data() : {};
        const tabs = Array.isArray(data?.popularTabs) ? data.popularTabs : null;

        if (tabs?.length) {
          const mapped: TabRow[] = tabs
            .map((t: any, idx: number) => ({
              id: uid(),
              key: s(t?.key),
              tr: s(t?.label?.tr ?? t?.tr ?? t?.title?.tr ?? ""),
              en: s(t?.label?.en ?? t?.en ?? t?.title?.en ?? ""),
              enabled: t?.enabled !== false,
              open: idx === 0,
            }))
            .filter((x: TabRow) => !!x.key);

          const hasAll = mapped.some((x) => x.key === "all");

          const finalRows = hasAll
            ? mapped
            : [
                {
                  id: uid(),
                  key: "all",
                  tr: "Tümü",
                  en: "All",
                  enabled: true,
                  open: true,
                },
                ...mapped,
              ];

          setRows(finalRows.length ? finalRows : DEFAULT_ROWS);
        } else {
          setRows(DEFAULT_ROWS);
        }
      } catch (e: any) {
        setMsg({ type: "err", text: e?.message || "Okuma hatası" });
        setRows(DEFAULT_ROWS);
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db]);

  function updateRow(id: string, patch: Partial<TabRow>) {
    setRows((old) => old.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((old) => old.filter((r) => r.id !== id));
  }

  function moveRow(id: string, dir: "up" | "down") {
    setRows((old) => {
      const idx = old.findIndex((r) => r.id === id);
      if (idx < 0) return old;

      const isAll = slugKey(old[idx].key) === "all" || idx === 0;
      if (isAll) return old;

      const target = dir === "up" ? idx - 1 : idx + 1;
      if (target < 1 || target >= old.length) return old;

      const copy = [...old];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
  }

  function toggleOpen(id: string) {
    setRows((old) =>
      old.map((r) => (r.id === id ? { ...r, open: !r.open } : r))
    );
  }

  function addRow() {
    setRows((old) => [
      ...old,
      {
        id: uid(),
        key: "new_tab",
        tr: "Yeni Sekme",
        en: "New Tab",
        enabled: true,
        open: true,
      },
    ]);
  }

 async function save() {
  setSaving(true);
  setMsg(null);

  try {
    const cleaned = rows
      .map((r: any, idx: number) => ({
        key: slugKey(r.key || ""),
        label: {
          tr: s(r.tr),
          en: s(r.en),
        },
        section: s((r as any).section || r.key || ""),
        enabled:
          typeof r.enabled === "boolean"
            ? r.enabled
            : typeof r.isActive === "boolean"
            ? r.isActive
            : true,
        isActive:
          typeof r.isActive === "boolean"
            ? r.isActive
            : typeof r.enabled === "boolean"
            ? r.enabled
            : true,
        order: Number.isFinite(Number((r as any).order))
          ? Number((r as any).order)
          : idx * 10,
        limit:
          Number.isFinite(Number((r as any).limit)) && Number((r as any).limit) > 0
            ? Number((r as any).limit)
            : 12,
      }))
      .filter((r) => r.key);

    const withoutAll = cleaned.filter((r) => r.key !== "all");

    const finalTabs = [
      {
        key: "all",
        label: { tr: "Tümü", en: "All" },
        section: "all",
        enabled: true,
        isActive: true,
        order: 0,
        limit: 12,
      },
      ...withoutAll,
    ];

    await setDoc(
      doc(db, "site_options", "home_settings"),
      {
        popularTabs: finalTabs,
        popular_tabs: deleteField(), // eski alanı temizle
      },
      { merge: true }
    );

    setMsg({ type: "ok", text: "Kaydedildi ✅" });
  } catch (e: any) {
    setMsg({ type: "err", text: e?.message || "Kaydetme hatası" });
  } finally {
    setSaving(false);
  }
}

  const enabledCount = rows.filter((r, idx) => idx === 0 || r.enabled).length;

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <div className={styles.topLeft}>
          <div className={styles.kicker}>Admin • Home Settings</div>
          <h1 className={styles.h1}>Popüler Ürünler Sekmeleri</h1>
          <p className={styles.p}>
            Buradaki sekmeler ürünlerdeki <code>homeSections</code> alanına göre çalışır.
            Örnek: <code>homeSections: ["bestsellers","featured"]</code>
          </p>
        </div>

        <div className={styles.topRight}>
          <div className={styles.statBox}>
            <span>Toplam</span>
            <b>{rows.length}</b>
          </div>
          <div className={styles.statBox}>
            <span>Aktif</span>
            <b>{enabledCount}</b>
          </div>

          <button className={styles.saveBtn} onClick={save} disabled={saving || busy}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>

      {msg ? (
        <div className={`${styles.msg} ${msg.type === "err" ? styles.msgErr : styles.msgOk}`}>
          {msg.text}
        </div>
      ) : null}

      <div className={styles.layout}>
        <section className={styles.leftCol}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>Sekme Listesi</div>
              <div className={styles.cardSub}>Aç / kapa, sırala, aktif-pasif yap.</div>
            </div>

            <button className={styles.addBtn} type="button" onClick={addRow}>
              + Sekme Ekle
            </button>
          </div>

          <div className={styles.list}>
            {rows.map((r, idx) => {
              const isAll = slugKey(r.key) === "all" || idx === 0;

              return (
                <div key={r.id} className={`${styles.item} ${r.open ? styles.itemOpen : ""}`}>
                  <div className={styles.itemTop}>
                    <button
                      className={styles.expandBtn}
                      type="button"
                      onClick={() => toggleOpen(r.id)}
                      aria-label="Aç / kapa"
                    >
                      {r.open ? "−" : "+"}
                    </button>

                    <div className={styles.itemMain}>
                      <div className={styles.itemTitleRow}>
                        <div className={styles.itemTitle}>{r.tr || "Başlıksız sekme"}</div>
                        <span className={styles.itemKey}>{isAll ? "all" : slugKey(r.key || "")}</span>
                        {isAll ? (
                          <span className={styles.lockBadge}>Sabit</span>
                        ) : r.enabled ? (
                          <span className={styles.onBadge}>Aktif</span>
                        ) : (
                          <span className={styles.offBadge}>Pasif</span>
                        )}
                      </div>

                      <div className={styles.itemSub}>
                        EN: <b>{r.en || "-"}</b>
                      </div>
                    </div>

                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => moveRow(r.id, "up")}
                        disabled={isAll || idx <= 1}
                        title="Yukarı taşı"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => moveRow(r.id, "down")}
                        disabled={isAll || idx === rows.length - 1}
                        title="Aşağı taşı"
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => updateRow(r.id, { enabled: !r.enabled })}
                        disabled={isAll}
                        title="Aktif / pasif"
                      >
                        {r.enabled ? "◉" : "○"}
                      </button>

                      <button
                        className={styles.delBtn}
                        type="button"
                        disabled={isAll}
                        onClick={() => removeRow(r.id)}
                        title={isAll ? "all sekmesi silinemez" : "Sil"}
                      >
                        Sil
                      </button>
                    </div>
                  </div>

                  {r.open ? (
                    <div className={styles.itemBody}>
                      <div className={styles.formGrid}>
                        <label className={styles.field}>
                          <span>Key</span>
                          <input
                            className={styles.inp}
                            value={r.key}
                            disabled={isAll}
                            onChange={(e) => updateRow(r.id, { key: e.target.value })}
                            onBlur={(e) => updateRow(r.id, { key: slugKey(e.target.value) })}
                            placeholder="key (örn: bestsellers)"
                          />
                        </label>

                        <label className={styles.field}>
                          <span>TR Başlık</span>
                          <input
                            className={styles.inp}
                            value={r.tr}
                            onChange={(e) => updateRow(r.id, { tr: e.target.value })}
                            placeholder="TR Başlık"
                          />
                        </label>

                        <label className={styles.field}>
                          <span>EN Başlık</span>
                          <input
                            className={styles.inp}
                            value={r.en}
                            onChange={(e) => updateRow(r.id, { en: e.target.value })}
                            placeholder="EN Title"
                          />
                        </label>

                        <label className={styles.switchRow}>
                          <input
                            type="checkbox"
                            checked={isAll ? true : r.enabled}
                            disabled={isAll}
                            onChange={(e) => updateRow(r.id, { enabled: e.target.checked })}
                          />
                          <span>Bu sekme aktif olsun</span>
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {busy ? <div className={styles.dim}>Yükleniyor…</div> : null}
        </section>

        <aside className={styles.rightCol}>
          <div className={styles.previewCard}>
            <div className={styles.cardTitle}>Canlı Önizleme</div>
            <div className={styles.cardSub}>Anasayfada sekmeler yaklaşık böyle görünür.</div>

            <div className={styles.previewTabs}>
              {rows
                .filter((r, idx) => idx === 0 || r.enabled)
                .map((r, idx) => (
                  <div
                    key={r.id}
                    className={`${styles.previewTab} ${idx === 0 ? styles.previewTabActive : ""}`}
                  >
                    {idx === 0 ? "Tümü" : r.tr || "Sekme"}
                  </div>
                ))}
            </div>

            <div className={styles.previewNote}>
              <b>Not:</b> İlk sekme her zaman <code>all</code> olarak kalır.
            </div>

            <div className={styles.codeBox}>
              <div className={styles.codeTitle}>Kaydedilecek yapı</div>
              <pre className={styles.codePre}>
{JSON.stringify(
  rows
    .map((r, idx) => ({
      key: idx === 0 ? "all" : slugKey(r.key || ""),
      label: {
        tr: idx === 0 ? "Tümü" : s(r.tr),
        en: idx === 0 ? "All" : s(r.en),
      },
      enabled: idx === 0 ? true : r.enabled !== false,
    }))
    .filter((r) => r.key),
  null,
  2
)}
              </pre>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}