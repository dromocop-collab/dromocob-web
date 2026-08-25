"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { Clock3, ExternalLink, Mail, MessageSquareText, Phone, Search, Sparkles } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase.client";
import s from "./projectBriefs.module.css";

type Brief = {
  id: string;
  reference?: string;
  siteType?: string;
  design?: string;
  features?: string[];
  budget?: string;
  timeline?: string;
  message?: string;
  status?: string;
  source?: string;
  contact?: { name?: string; company?: string; email?: string; phone?: string };
  createdAt?: any;
};

const statusLabels: Record<string, string> = { new: "Yeni", contacted: "İletişime geçildi", won: "Projeye dönüştü", archived: "Arşiv" };

export default function ProjectBriefsPage() {
  const [items, setItems] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const db = getFirebaseDb();
    return onSnapshot(
      query(collection(db, "project_briefs"), orderBy("createdAt", "desc"), limit(150)),
      (snapshot) => { setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Brief))); setLoading(false); },
      (reason) => { setError(reason.message || "Talepler okunamadı."); setLoading(false); }
    );
  }, []);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && (item.status || "new") !== filter) return false;
      if (!needle) return true;
      return [item.reference, item.siteType, item.design, item.contact?.name, item.contact?.company, item.contact?.email, item.contact?.phone].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [items, search, filter]);

  const counts = useMemo(() => ({
    all: items.length,
    new: items.filter((item) => (item.status || "new") === "new").length,
    contacted: items.filter((item) => item.status === "contacted").length,
    won: items.filter((item) => item.status === "won").length,
  }), [items]);

  async function setStatus(id: string, status: string) {
    await updateDoc(doc(getFirebaseDb(), "project_briefs", id), { status, updatedAt: serverTimestamp() });
  }

  const formatDate = (value: any) => {
    try { return value?.toDate?.().toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) || "Yeni kayıt"; } catch { return "—"; }
  };

  return (
    <section className={s.page}>
      <div className={s.hero}>
        <div><span><Sparkles /> DROMOCOB LEAD CENTER</span><h2>Proje Talepleri</h2><p>Site üzerinden gelen proje ve seçili demo tekliflerini tek ekrandan yönetin.</p></div>
        <div className={s.metrics}><article><b>{counts.new}</b><span>Yeni talep</span></article><article><b>{counts.contacted}</b><span>Görüşülüyor</span></article><article><b>{counts.won}</b><span>Projeye dönüştü</span></article></div>
      </div>

      <div className={s.toolbar}>
        <label><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, e-posta, tasarım veya talep kodu ara…" /></label>
        <div>{[["all", "Tümü"], ["new", "Yeni"], ["contacted", "Görüşülen"], ["won", "Kazanılan"]].map(([key, label]) => <button key={key} className={filter === key ? s.active : ""} onClick={() => setFilter(key)}>{label} <span>{counts[key as keyof typeof counts] ?? items.filter((item) => item.status === key).length}</span></button>)}</div>
      </div>

      {loading ? <div className={s.state}>Talepler yükleniyor…</div> : error ? <div className={s.error}>{error}</div> : visible.length === 0 ? <div className={s.state}>Bu filtrede proje talebi bulunmuyor.</div> : (
        <div className={s.grid}>{visible.map((item) => {
          const status = item.status || "new";
          return <article className={s.card} key={item.id}>
            <div className={s.cardTop}><div><span className={`${s.status} ${s[`status_${status}`]}`}>{statusLabels[status] || status}</span><small>{formatDate(item.createdAt)}</small></div><b>{item.reference || item.id.slice(0, 8)}</b></div>
            <div className={s.design}><span>{item.siteType || "Özel Proje"}</span><h3>{item.design || "Dromocob özel tasarım"}</h3><small>{item.source === "demo-quick-quote" ? "Demo hızlı teklif" : "Proje oluşturucu"}</small></div>
            <div className={s.contact}><h4>{item.contact?.name || "İsimsiz talep"}</h4>{item.contact?.company && <span>{item.contact.company}</span>}<a href={`mailto:${item.contact?.email || ""}`}><Mail />{item.contact?.email || "—"}</a><a href={`tel:${item.contact?.phone || ""}`}><Phone />{item.contact?.phone || "—"}</a></div>
            {item.message && <div className={s.note}><MessageSquareText /><p>{item.message}</p></div>}
            {Array.isArray(item.features) && item.features.length > 0 && <div className={s.features}>{item.features.map((feature) => <span key={feature}>{feature}</span>)}</div>}
            <div className={s.meta}><span><Clock3 /> {item.timeline || "Zaman görüşülecek"}</span><span>{item.budget || "Bütçe görüşülecek"}</span></div>
            <div className={s.actions}><select value={status} onChange={(e) => setStatus(item.id, e.target.value)}><option value="new">Yeni</option><option value="contacted">İletişime geçildi</option><option value="won">Projeye dönüştü</option><option value="archived">Arşiv</option></select><a href={`mailto:${item.contact?.email || ""}?subject=${encodeURIComponent(`Dromocob · ${item.reference || "Proje talebi"}`)}`}><ExternalLink /> Yanıtla</a></div>
          </article>;
        })}</div>
      )}
    </section>
  );
}
