"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { toast } from "@/components/admin/ui/toast"; // ToastHost admin layout’ta olmalı
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./socialAdmin.module.css";

type LocaleText = { tr?: string; en?: string };
type SocialItem = {
  type: "video" | "image";
  href?: string;
  mediaUrl?: string;
  thumbUrl?: string;
  alt?: LocaleText;
};
type SocialCfg = {
  enabled?: boolean;
  title?: LocaleText;
  subtitle?: LocaleText;
  profileUrl?: string;
  profileText?: LocaleText;
  items?: SocialItem[];
};

const emptyItem = (): SocialItem => ({
  type: "image",
  href: "",
  mediaUrl: "",
  thumbUrl: "",
  alt: { tr: "", en: "" },
});

function AdminSocialPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "site_options", "home_settings"), [db]);

  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<SocialCfg>({
    enabled: true,
    title: { tr: "Sosyal", en: "Social" },
    subtitle: { tr: "Instagram’dan seçtiklerimiz", en: "Selected from Instagram" },
    profileUrl: "",
    profileText: { tr: "Instagram’a Git", en: "Open Instagram" },
    items: [emptyItem(), emptyItem(), emptyItem(), emptyItem()],
  });

  useEffect(() => {
    return onSnapshot(
      ref,
      (snap) => {
        const d: any = snap.exists() ? snap.data() : {};
        const social = (d?.social ?? null) as SocialCfg | null;
        if (!social) return;
  
        setCfg((prev) => ({
          ...prev,
          ...social,
          // items gelmezse prev kalsın
          items: Array.isArray(social.items) ? social.items : prev.items,
        }));
      },
      () => {}
    );
  }, [ref]);

  async function save() {
    setSaving(true);
    try {
      const cleaned: SocialCfg = {
        ...cfg,
        items: (cfg.items || [])
        .map((x) => {
          const type = x.type === "video" ? ("video" as const) : ("image" as const);
      
          return {
            type,
            href: String(x.href || "").trim(),
            mediaUrl: String(x.mediaUrl || "").trim(),
            thumbUrl: String(x.thumbUrl || "").trim(),
            alt: {
              tr: String(x.alt?.tr || "").trim(),
              en: String(x.alt?.en || "").trim(),
            },
          } satisfies SocialItem;
        })
        .filter((x) => x.mediaUrl || x.thumbUrl)
        .slice(0, 12),
      };

      await setDoc(ref, { social: cleaned }, { merge: true });
      toast.success("Sosyal bölüm kaydedildi.");
    } catch (e) {
      console.error(e);
      toast.error("Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  function setItem(i: number, patch: Partial<SocialItem>) {
    setCfg((p) => {
      const next = [...(p.items || [])];
      next[i] = { ...(next[i] || emptyItem()), ...patch };
      return { ...p, items: next };
    });
  }

  function addItem() {
    setCfg((p) => ({ ...p, items: [...(p.items || []), emptyItem()].slice(0, 12) }));
  }

  function removeItem(i: number) {
    setCfg((p) => ({ ...p, items: (p.items || []).filter((_, idx) => idx !== i) }));
  }

  return (
    <main className={s.page}>
      <div className={s.head}>
        <div>
          <div className={s.kicker}>Admin • Anasayfa</div>
          <h1 className={s.h1}>Sosyal Medya Bölümü</h1>
          <p className={s.sub}>Instagram içeriklerini modern grid olarak anasayfada göster.</p>
        </div>

        <button className={s.saveBtn} type="button" onClick={save} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      <div className={s.card}>
        <label className={s.row}>
          <span>Aktif</span>
          <input
            type="checkbox"
            checked={cfg.enabled !== false}
            onChange={(e) => setCfg((p) => ({ ...p, enabled: e.target.checked }))}
          />
        </label>

        <div className={s.grid2}>
          <label className={s.field}>
            <span>Başlık (TR)</span>
            <input
              value={cfg.title?.tr || ""}
              onChange={(e) => setCfg((p) => ({ ...p, title: { ...(p.title || {}), tr: e.target.value } }))}
            />
          </label>
          <label className={s.field}>
            <span>Title (EN)</span>
            <input
              value={cfg.title?.en || ""}
              onChange={(e) => setCfg((p) => ({ ...p, title: { ...(p.title || {}), en: e.target.value } }))}
            />
          </label>
        </div>

        <div className={s.grid2}>
          <label className={s.field}>
            <span>Açıklama (TR)</span>
            <input
              value={cfg.subtitle?.tr || ""}
              onChange={(e) => setCfg((p) => ({ ...p, subtitle: { ...(p.subtitle || {}), tr: e.target.value } }))}
            />
          </label>
          <label className={s.field}>
            <span>Subtitle (EN)</span>
            <input
              value={cfg.subtitle?.en || ""}
              onChange={(e) => setCfg((p) => ({ ...p, subtitle: { ...(p.subtitle || {}), en: e.target.value } }))}
            />
          </label>
        </div>

        <div className={s.grid2}>
          <label className={s.field}>
            <span>Profil Linki</span>
            <input
              value={cfg.profileUrl || ""}
              onChange={(e) => setCfg((p) => ({ ...p, profileUrl: e.target.value }))}
              placeholder="https://www.instagram.com/..."
            />
          </label>
          <label className={s.field}>
            <span>Profil Buton Yazısı (TR)</span>
            <input
                value={cfg.profileText?.en || ""}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, profileText: { ...(p.profileText || {}), en: e.target.value } }))
                }
              />
          </label>
        </div>

        <div className={s.itemsHead}>
          <div>
            <b>Medya Listesi</b>
            <div className={s.muted}>Video için mp4 URL gir. Foto için image URL gir. İstersen thumb ekle.</div>
          </div>
          <button className={s.addBtn} type="button" onClick={addItem}>
            + Ekle
          </button>
        </div>

        <div className={s.items}>
          {(cfg.items || []).map((it, i) => (
            <div key={i} className={s.itemCard}>
              <div className={s.itemTop}>
                <b>#{i + 1}</b>
                <button className={s.delBtn} type="button" onClick={() => removeItem(i)}>
                  Sil
                </button>
              </div>

              <div className={s.grid2}>
                <label className={s.field}>
                  <span>Tip</span>
                  <select value={it.type} onChange={(e) => setItem(i, { type: e.target.value as any })}>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </label>

                <label className={s.field}>
                  <span>Instagram Link (href)</span>
                  <input value={it.href || ""} onChange={(e) => setItem(i, { href: e.target.value })} />
                </label>
              </div>

              <div className={s.grid2}>
                <label className={s.field}>
                  <span>Media URL</span>
                  <input value={it.mediaUrl || ""} onChange={(e) => setItem(i, { mediaUrl: e.target.value })} />
                </label>
                <label className={s.field}>
                  <span>Thumb URL (opsiyonel)</span>
                  <input value={it.thumbUrl || ""} onChange={(e) => setItem(i, { thumbUrl: e.target.value })} />
                </label>
              </div>

              <div className={s.grid2}>
                <label className={s.field}>
                  <span>Alt (TR)</span>
                  <input
                    value={it.alt?.tr || ""}
                    onChange={(e) => setItem(i, { alt: { ...(it.alt || {}), tr: e.target.value } })}
                  />
                </label>
                <label className={s.field}>
                  <span>Alt (EN)</span>
                  <input
                    value={it.alt?.en || ""}
                    onChange={(e) => setItem(i, { alt: { ...(it.alt || {}), en: e.target.value } })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
export default function AdminSocialPage() {
  return (
    <AdminGate>
      <PermissionGate permission="home_settings">
        <AdminSocialPageInner />
      </PermissionGate>
    </AdminGate>
  );
}