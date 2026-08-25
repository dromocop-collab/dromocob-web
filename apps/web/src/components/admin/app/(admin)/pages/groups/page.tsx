"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";

type LocaleText = { tr?: string; en?: string };
type GroupRow = { id: string; label?: LocaleText; order?: number; isActive?: boolean };

function slugifyTR(input: string) {
  const map: Record<string, string> = { ç:"c",Ç:"c",ğ:"g",Ğ:"g",ı:"i",I:"i",İ:"i",ö:"o",Ö:"o",ş:"s",Ş:"s",ü:"u",Ü:"u" };
  const s1 = String(input || "").trim().split("").map((ch) => map[ch] ?? ch).join("");
  return s1.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function AdminPageGroupsInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tr, setTr] = useState("");
  const [en, setEn] = useState("");
  const [id, setId] = useState("");

  useEffect(() => {
    const ref = doc(db, "site_options", "home_settings");
    return onSnapshot(
      ref,
      (snap) => {
        const d: any = snap.data() || {};
        const list: GroupRow[] = Array.isArray(d?.blockLibrary?.groups) ? d.blockLibrary.groups : [];
        const normalized = list
          .map((g: any) => ({
            id: String(g?.id || "").trim(),
            label: g?.label || {},
            order: Number(g?.order ?? 9999),
            isActive: g?.isActive !== false,
          }))
          .filter((g) => g.id)
          .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
        setGroups(normalized);
        setLoading(false);
      },
      () => {
        setGroups([]);
        setLoading(false);
      }
    );
  }, [db]);

  async function saveAll(next: GroupRow[]) {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "site_options", "home_settings"),
        { blockLibrary: { enabled: true, groups: next }, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } finally {
      setSaving(false);
    }
  }

  async function addGroup() {
    const labelTr = tr.trim();
    const labelEn = en.trim();
    const gid = (id.trim() || slugifyTR(labelTr || labelEn)).trim();
    if (!gid) return alert("Grup ID boş olamaz.");
    if (groups.some((g) => g.id === gid)) return alert("Bu ID zaten var.");

    const maxOrder = groups.reduce((m, g) => Math.max(m, Number(g.order) || 0), 0);
    const next: GroupRow[] = [
      ...groups,
      { id: gid, label: { tr: labelTr || gid, en: labelEn || labelTr || gid }, order: maxOrder + 10, isActive: true },
    ];
    await saveAll(next);
    setTr(""); setEn(""); setId("");
  }

  async function removeGroup(gid: string) {
    if (!confirm(`"${gid}" grubunu silmek istiyor musun?`)) return;
    const next = groups.filter((g) => g.id !== gid);
    await saveAll(next);
  }

  async function toggleActive(gid: string) {
    const next = groups.map((g) => (g.id === gid ? { ...g, isActive: !(g.isActive !== false) } : g));
    await saveAll(next);
  }

  async function move(gid: string, dir: -1 | 1) {
    const idx = groups.findIndex((g) => g.id === gid);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= groups.length) return;

    const next = [...groups];
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;

    // order’u yeniden numaralandır (10,20,30…)
    const re = next.map((g, i) => ({ ...g, order: (i + 1) * 10 }));
    await saveAll(re);
  }

  return (
    <main style={{ padding: 18, maxWidth: 980 }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 950 }}>Sayfa Grupları</h1>
      <div style={{ opacity: 0.7, marginTop: 6, fontWeight: 700 }}>
        Kaynak: <code>site_options/home_settings.blockLibrary.groups</code>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr auto" }}>
          <input value={tr} onChange={(e) => setTr(e.target.value)} placeholder="TR Etiket (Kurumsal)" style={inp} />
          <input value={en} onChange={(e) => setEn(e.target.value)} placeholder="EN Etiket (Corporate)" style={inp} />
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="ID (opsiyonel) kurumsal" style={inp} />
          <button onClick={addGroup} disabled={saving} style={btn}>
            + Ekle
          </button>
        </div>
        <div style={{ marginTop: 8, opacity: 0.7, fontWeight: 700 }}>
          ID boşsa TR/EN’den otomatik slug üretilir.
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {loading ? (
          <div style={{ opacity: 0.7 }}>Yükleniyor…</div>
        ) : groups.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Grup yok.</div>
        ) : (
          groups.map((g) => (
            <div key={g.id} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 950 }}>
                  {g.label?.tr || g.id}{" "}
                  <span style={{ opacity: 0.6, fontWeight: 800, marginLeft: 8 }}>
                    ({g.id})
                  </span>
                </div>
                <div style={{ opacity: 0.65, fontWeight: 700, marginTop: 4 }}>
                  EN: {g.label?.en || "-"} • Sıra: <b>{g.order ?? 0}</b> • Durum:{" "}
                  <b>{g.isActive !== false ? "Aktif" : "Pasif"}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={btnSoft} onClick={() => move(g.id, -1)} disabled={saving}>↑</button>
                <button style={btnSoft} onClick={() => move(g.id, 1)} disabled={saving}>↓</button>
                <button style={btnSoft} onClick={() => toggleActive(g.id)} disabled={saving}>
                  {g.isActive !== false ? "Pasifleştir" : "Aktifleştir"}
                </button>
                <button style={btnDanger} onClick={() => removeGroup(g.id)} disabled={saving}>Sil</button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

const inp: React.CSSProperties = {
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  padding: "0 12px",
  fontWeight: 800,
};

const btn: React.CSSProperties = {
  height: 44,
  borderRadius: 12,
  border: 0,
  background: "#0f172a",
  color: "#fff",
  fontWeight: 950,
  padding: "0 14px",
  cursor: "pointer",
};

const btnSoft: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 900,
  padding: "0 12px",
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: 0,
  background: "#b91c1c",
  color: "#fff",
  fontWeight: 950,
  padding: "0 12px",
  cursor: "pointer",
};

const row: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
  background: "#fff",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};
export default function AdminPageGroups() {
  return (
    <AdminGate>
      <PermissionGate permission="pages_admin">
        <AdminPageGroupsInner />
      </PermissionGate>
    </AdminGate>
  );
}