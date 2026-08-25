"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, MapPin, RefreshCw, Video } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase.client";
import styles from "./accountAppointmentsPanel.module.css";

type Status = "new" | "contacted" | "confirmed" | "completed" | "cancelled";
type Appointment = { id: string; appointmentDate: string; timeSlot: string; meetingType: "store" | "online"; interest?: string; budget?: string; note?: string; status: Status; customerMessage?: string; createdAt?: string; updatedAt?: string; statusHistory?: Array<{ status: Status; at?: string }> };

const trLabels: Record<Status, string> = { new: "Talebiniz alındı", contacted: "İletişime geçiliyor", confirmed: "Randevunuz onaylandı", completed: "Görüşme tamamlandı", cancelled: "Randevu iptal edildi" };
const enLabels: Record<Status, string> = { new: "Request received", contacted: "Contact in progress", confirmed: "Appointment confirmed", completed: "Meeting completed", cancelled: "Appointment cancelled" };
const steps: Status[] = ["new", "contacted", "confirmed", "completed"];

export default function AccountAppointmentsPanel({ loc }: { loc: "tr" | "en" }) {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const labels = loc === "en" ? enLabels : trLabels;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error(loc === "en" ? "Please sign in again." : "Lütfen tekrar giriş yapın.");
      const token = await user.getIdToken();
      const response = await fetch("/api/appointments?scope=mine", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || (loc === "en" ? "Appointments could not be loaded." : "Randevular yüklenemedi."));
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) { setError(e?.message || "Randevular yüklenemedi."); }
    finally { setLoading(false); }
  }, [loc]);

  useEffect(() => { load(); }, [load]);
  const active = useMemo(() => items.filter((x) => !["completed", "cancelled"].includes(x.status)).length, [items]);

  return <section className={styles.panel}>
    <header className={styles.head}><div><span>{loc === "en" ? "Private concierge" : "Özel danışmanlık"}</span><h2>{loc === "en" ? "My Appointments" : "Randevularım"}</h2><p>{loc === "en" ? "Track your appointment requests and the result shared by your consultant." : "Gönderdiğiniz randevu taleplerini ve danışmanınızın paylaştığı sonucu buradan takip edin."}</p></div><button type="button" onClick={load} disabled={loading}><RefreshCw />{loc === "en" ? "Refresh" : "Yenile"}</button></header>
    <div className={styles.stats}><article><span>{loc === "en" ? "Total requests" : "Toplam talep"}</span><strong>{items.length}</strong></article><article><span>{loc === "en" ? "Active process" : "Aktif süreç"}</span><strong>{active}</strong></article><article><span>{loc === "en" ? "Completed" : "Tamamlanan"}</span><strong>{items.filter(x => x.status === "completed").length}</strong></article></div>
    {error ? <div className={styles.error}>{error}</div> : loading ? <div className={styles.empty}>{loc === "en" ? "Loading appointments…" : "Randevular yükleniyor…"}</div> : !items.length ? <div className={styles.empty}><CalendarDays /><strong>{loc === "en" ? "No appointment requests yet" : "Henüz randevu talebiniz yok"}</strong><span>{loc === "en" ? "You can create a private appointment from the homepage." : "Anasayfadaki özel randevu butonundan yeni talep oluşturabilirsiniz."}</span></div> : <div className={styles.list}>{items.map((item) => {
      const stepIndex = item.status === "cancelled" ? -1 : steps.indexOf(item.status);
      return <article className={styles.card} key={item.id}>
        <div className={styles.cardTop}><div><small>#{item.id.slice(0,8).toUpperCase()}</small><h3>{item.interest || (loc === "en" ? "Private lifestyle consultation" : "Özel özel ürün danışmanlığı")}</h3></div><span className={`${styles.badge} ${styles[item.status]}`}>{labels[item.status]}</span></div>
        <div className={styles.details}><span><CalendarDays />{item.appointmentDate}</span><span><Clock3 />{item.timeSlot}</span><span>{item.meetingType === "online" ? <Video /> : <MapPin />}{item.meetingType === "online" ? (loc === "en" ? "Video call" : "Görüntülü görüşme") : (loc === "en" ? "İstanbul store" : "İstanbul mağaza")}</span></div>
        {item.status !== "cancelled" ? <div className={styles.timeline}>{steps.map((step, index) => <div className={index <= stepIndex ? styles.stepDone : ""} key={step}><i>{index < stepIndex ? <CheckCircle2 /> : index + 1}</i><span>{labels[step]}</span></div>)}</div> : null}
        {item.customerMessage ? <div className={styles.result}><span>{loc === "en" ? "Message from your consultant" : "Danışmanınızdan sonuç"}</span><p>{item.customerMessage}</p></div> : <div className={styles.pending}>{loc === "en" ? "Your consultant has not shared an additional note yet." : "Danışmanınız henüz ek bir sonuç notu paylaşmadı."}</div>}
        {item.note ? <details><summary>{loc === "en" ? "My request note" : "Gönderdiğim not"}</summary><p>{item.note}</p></details> : null}
      </article>;
    })}</div>}
  </section>;
}
