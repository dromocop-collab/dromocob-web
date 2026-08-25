"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { CalendarDays, Clock3, Mail, MapPin, Phone, RefreshCw, Search, Video } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase.client";
import styles from "./appointments.module.css";

type Status = "new" | "contacted" | "confirmed" | "completed" | "cancelled";
type Row = { id: string; fullName: string; email: string; phone: string; appointmentDate: string; timeSlot: string; meetingType: "store" | "online"; interest?: string; budget?: string; note?: string; adminNote?: string; customerMessage?: string; status: Status; createdAt?: string; statusHistory?: Array<{ status: Status; at: string; actor: string }> };
const labels: Record<Status, string> = { new: "Yeni", contacted: "İletişime Geçildi", confirmed: "Onaylandı", completed: "Tamamlandı", cancelled: "İptal" };

export default function AdminAppointmentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const token = useCallback(async () => {
    const user = getFirebaseAuth().currentUser;
    if (!user) throw new Error("Admin oturumu bulunamadı.");
    return user.getIdToken();
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const idToken = await token();
      const response = await fetch("/api/appointments", { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Randevular yüklenemedi.");
      setRows(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) { setError(e?.message || "Randevular yüklenemedi."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), (user) => { if (user) load(); }), [load]);

  const visible = useMemo(() => rows.filter((row) => {
    if (filter !== "all" && row.status !== filter) return false;
    const haystack = `${row.fullName} ${row.email} ${row.phone} ${row.interest} ${row.appointmentDate}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [rows, query, filter]);

  const counts = useMemo(() => ({ all: rows.length, new: rows.filter(x => x.status === "new").length, confirmed: rows.filter(x => x.status === "confirmed").length, completed: rows.filter(x => x.status === "completed").length }), [rows]);

  async function save(row: Row) {
    setSaving(true); setError("");
    try {
      const idToken = await token();
      const response = await fetch("/api/appointments", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ id: row.id, status: row.status, adminNote: row.adminNote || "", customerMessage: row.customerMessage || "" }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Güncellenemedi.");
      setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, status: row.status, adminNote: row.adminNote, customerMessage: row.customerMessage } : item));
      setSelected(null);
    } catch (e: any) { setError(e?.message || "Güncellenemedi."); }
    finally { setSaving(false); }
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}><div><span>Operasyon • Concierge</span><h1>Özel Randevular</h1><p>Müşteri taleplerini planlayın, iletişim durumunu yönetin ve görüşme geçmişini tek merkezde tutun.</p></div><button onClick={load} disabled={loading}><RefreshCw size={17} />Yenile</button></header>
      <section className={styles.stats}><article><span>Toplam</span><strong>{counts.all}</strong></article><article><span>Yeni Talep</span><strong>{counts.new}</strong></article><article><span>Onaylanan</span><strong>{counts.confirmed}</strong></article><article><span>Tamamlanan</span><strong>{counts.completed}</strong></article></section>
      <section className={styles.toolbar}><label><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Müşteri, telefon, e-posta veya ürün ara" /></label><select value={filter} onChange={(e) => setFilter(e.target.value as any)}><option value="all">Tüm durumlar</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></section>
      {error ? <div className={styles.error}>{error}</div> : null}
      {loading ? <div className={styles.empty}>Randevular yükleniyor…</div> : !visible.length ? <div className={styles.empty}>Filtreye uygun randevu talebi bulunamadı.</div> : (
        <section className={styles.list}>{visible.map((row) => <article key={row.id} className={styles.card}>
          <div className={styles.cardTop}><div><strong>{row.fullName}</strong><span>{row.interest || "Ürün tercihi belirtilmedi"}</span></div><span className={`${styles.badge} ${styles[row.status]}`}>{labels[row.status]}</span></div>
          <div className={styles.details}><span><CalendarDays />{row.appointmentDate}</span><span><Clock3 />{row.timeSlot}</span><span>{row.meetingType === "online" ? <Video /> : <MapPin />}{row.meetingType === "online" ? "Online" : "Mağaza"}</span><span><Phone />{row.phone}</span></div>
          <div className={styles.cardFoot}><small>{row.budget || "Bütçe belirtilmedi"}</small><div><a href={`tel:${row.phone.replace(/\s/g, "")}`}><Phone size={15} />Ara</a><a href={`mailto:${row.email}`}><Mail size={15} />E-posta</a><button onClick={() => setSelected({ ...row })}>Yönet</button></div></div>
        </article>)}</section>
      )}

      {selected ? (
        <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <section className={styles.drawer} role="dialog" aria-modal="true">
            <button className={styles.close} onClick={() => setSelected(null)}>×</button>
            <span className={styles.drawerKicker}>Randevu #{selected.id.slice(0, 8).toUpperCase()}</span>
            <h2>{selected.fullName}</h2>
            <div className={styles.contact}><a href={`tel:${selected.phone}`}><Phone />{selected.phone}</a><a href={`mailto:${selected.email}`}><Mail />{selected.email}</a></div>
            <dl><div><dt>Tarih / Saat</dt><dd>{selected.appointmentDate} • {selected.timeSlot}</dd></div><div><dt>Görüşme</dt><dd>{selected.meetingType === "online" ? "Görüntülü danışmanlık" : "İstanbul mağaza"}</dd></div><div><dt>İlgilendiği ürün</dt><dd>{selected.interest || "—"}</dd></div><div><dt>Bütçe</dt><dd>{selected.budget || "—"}</dd></div><div><dt>Müşteri notu</dt><dd>{selected.note || "—"}</dd></div></dl>
            <label>Durum<select value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value as Status })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Admin iç notu<textarea value={selected.adminNote || ""} onChange={(e) => setSelected({ ...selected, adminNote: e.target.value })} placeholder="Sadece ekip görür: görüşme özeti, hazırlanan ürünler…" /></label>
            <label>Müşteriye gösterilecek sonuç<textarea value={selected.customerMessage || ""} onChange={(e) => setSelected({ ...selected, customerMessage: e.target.value })} placeholder="Örn. Randevunuz onaylandı. Danışmanınız sizi 15 dakika önce arayacaktır." /></label>
            <button className={styles.save} onClick={() => save(selected)} disabled={saving}>{saving ? "Kaydediliyor…" : "Randevuyu güncelle"}</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
