"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { CalendarDays, CheckCircle2, Clock3, Gem, MapPin, Video, X } from "lucide-react";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import styles from "./appointmentModal.module.css";
import { trackAppointmentRequest } from "@/components/AnalyticsTracker";

type Props = { open: boolean; onClose: () => void; loc: "tr" | "en" };
type FormState = { fullName: string; email: string; phone: string; appointmentDate: string; timeSlot: string; meetingType: "store" | "online"; interest: string; budget: string; note: string; consent: boolean; website: string };

const initial: FormState = { fullName: "", email: "", phone: "", appointmentDate: "", timeSlot: "", meetingType: "store", interest: "", budget: "", note: "", consent: false, website: "" };
const slots = ["10:00", "11:30", "13:00", "14:30", "16:00", "17:30"];

export default function AppointmentModal({ open, onClose, loc }: Props) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>(initial);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const en = loc === "en";
  const minDate = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), []);
  const maxDate = useMemo(() => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), []);

  useEffect(() => setMounted(true), []);

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), (current) => {
    const real = current && !current.isAnonymous ? current : null;
    setUser(real);
    if (!real) return;

    setForm((prev) => ({ ...prev, fullName: prev.fullName || real.displayName || "", email: prev.email || real.email || "" }));
    void getDoc(doc(getFirebaseDb(), "users", real.uid)).then((snapshot) => {
      if (!snapshot.exists()) return;
      const profile = snapshot.data() as Record<string, unknown>;
      const profileName = `${String(profile.firstName || "").trim()} ${String(profile.lastName || "").trim()}`.trim() || String(profile.fullName || profile.name || "").trim();
      const profilePhone = String(profile.phone || profile.phoneNumber || "").trim();
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || profileName,
        phone: prev.phone || profilePhone,
        email: prev.email || real.email || "",
      }));
    }).catch((error) => console.warn("[AppointmentModal] profile load error:", error));
  }), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving"); setMessage("");
    try {
      const token = user ? await user.getIdToken() : "";
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...form, locale: loc }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || (en ? "Your request could not be saved." : "Talebiniz kaydedilemedi."));
      setStatus("success"); setMessage(data?.appointmentId || ""); trackAppointmentRequest();
    } catch (error: any) {
      setStatus("error"); setMessage(error?.message || (en ? "Please try again." : "Lütfen tekrar deneyin."));
    }
  }

  return createPortal((
    <div className={styles.backdrop} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="appointment-modal-title">
        <button type="button" className={styles.close} onClick={onClose} aria-label={en ? "Close" : "Kapat"}><X /></button>

        {status === "success" ? (
          <div className={styles.success}>
            <span><CheckCircle2 /></span>
            <div className={styles.kicker}>{en ? "Request received" : "Talebiniz alındı"}</div>
            <h2>{en ? "Your private appointment is being planned." : "Özel randevunuz planlanıyor."}</h2>
            <p>{en ? "Our lifestyle consultant will contact you to confirm the time." : "özel ürün danışmanımız saat teyidi için sizinle iletişime geçecek."}</p>
            <small>{en ? "Request number" : "Talep numarası"}: {message.slice(0, 8).toUpperCase()}</small>
            <button type="button" onClick={onClose}>{en ? "Done" : "Tamam"}</button>
          </div>
        ) : (
          <div className={styles.layout}>
            <aside className={styles.intro}>
              <span className={styles.icon}><Gem /></span>
              <div className={styles.kicker}>{en ? "Private lifestyle consultation" : "Özel özel ürün danışmanlığı"}</div>
              <h2 id="appointment-modal-title">{en ? "A calm experience, reserved for you." : "Sadece size ayrılmış, sakin bir deneyim."}</h2>
              <p>{en ? "Tell us what you are looking for. We will prepare the right pieces before your appointment." : "Aradığınız parçayı bize anlatın; randevunuzdan önce size uygun seçenekleri hazırlayalım."}</p>
              <ul><li><CalendarDays />{en ? "Date and time confirmation" : "Tarih ve saat teyidi"}</li><li><Gem />{en ? "Personal product selection" : "Kişiye özel ürün seçkisi"}</li><li><Clock3 />{en ? "Approximately 30–45 minutes" : "Yaklaşık 30–45 dakika"}</li></ul>
            </aside>

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.formHead}><strong>{en ? "Appointment details" : "Randevu bilgileri"}</strong><span>{en ? "All fields marked * are required." : "* işaretli alanlar zorunludur."}</span></div>
              <div className={styles.twoCols}>
                <label>{en ? "Full name *" : "Ad soyad *"}<input required minLength={3} value={form.fullName} onChange={(e) => update("fullName", e.target.value)} autoComplete="name" /></label>
                <label>{en ? "Phone *" : "Telefon *"}<input required value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" inputMode="tel" /></label>
              </div>
              <label>{en ? "Email *" : "E-posta *"}<input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} readOnly={!!user?.email} autoComplete="email" /></label>

              <fieldset><legend>{en ? "Meeting preference" : "Görüşme tercihi"}</legend><div className={styles.typeGrid}>
                <button type="button" className={form.meetingType === "store" ? styles.selected : ""} onClick={() => update("meetingType", "store")}><MapPin /><span><strong>{en ? "In store" : "Mağazada"}</strong><small>İstanbul</small></span></button>
                <button type="button" className={form.meetingType === "online" ? styles.selected : ""} onClick={() => update("meetingType", "online")}><Video /><span><strong>{en ? "Video consultation" : "Görüntülü danışmanlık"}</strong><small>{en ? "Online" : "Çevrimiçi"}</small></span></button>
              </div></fieldset>

              <div className={styles.twoCols}><label>{en ? "Preferred date *" : "Tercih edilen tarih *"}<input required type="date" min={minDate} max={maxDate} value={form.appointmentDate} onChange={(e) => update("appointmentDate", e.target.value)} /></label><label>{en ? "Time *" : "Saat *"}<select required value={form.timeSlot} onChange={(e) => update("timeSlot", e.target.value)}><option value="">{en ? "Select" : "Seçiniz"}</option>{slots.map((slot) => <option key={slot}>{slot}</option>)}</select></label></div>
              <div className={styles.twoCols}><label>{en ? "Interested in" : "İlgilendiğiniz ürün"}<select value={form.interest} onChange={(e) => update("interest", e.target.value)}><option value="">{en ? "Not sure yet" : "Henüz karar vermedim"}</option>{["Kolye", "Bileklik", "Yüzük", "Küpe", "Alyans", "Düğün Seti", "Kurumsal Hediye"].map((x) => <option key={x}>{x}</option>)}</select></label><label>{en ? "Approximate budget" : "Yaklaşık bütçe"}<select value={form.budget} onChange={(e) => update("budget", e.target.value)}><option value="">{en ? "Not specified" : "Belirtmek istemiyorum"}</option><option>5.000 TL altı</option><option>5.000 – 15.000 TL</option><option>15.000 – 50.000 TL</option><option>50.000 TL üzeri</option></select></label></div>
              <label>{en ? "Your note" : "Notunuz"}<textarea maxLength={900} value={form.note} onChange={(e) => update("note", e.target.value)} placeholder={en ? "Occasion, style, product code or anything we should prepare…" : "Özel gün, tarz, ürün kodu veya hazırlamamızı istediğiniz detay…"} /></label>
              <input className={styles.honeypot} tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => update("website", e.target.value)} />
              <label className={styles.consent}><input required type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} /><span>{en ? "I agree to be contacted regarding my appointment and have read the" : "Randevu talebim için benimle iletişime geçilmesini kabul ediyor ve"} <Link href="/kvkk-aydinlatma-metni" target="_blank">{en ? "privacy notice" : "KVKK aydınlatma metnini"}</Link>{en ? "." : " okudum."}</span></label>
              {status === "error" ? <div className={styles.error} role="alert">{message}</div> : null}
              <button className={styles.submit} type="submit" disabled={status === "saving"}>{status === "saving" ? (en ? "Sending…" : "Gönderiliyor…") : (en ? "Send appointment request" : "Randevu talebini gönder")}</button>
            </form>
          </div>
        )}
      </section>
    </div>
  ), document.body);
}
