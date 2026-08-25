"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Layers3,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import s from "./ProjectBriefModal.module.css";
import { studioTemplates } from "@/data/studioCatalog";

type Props = { open: boolean; onClose: () => void };
type FormState = {
  siteType: string;
  design: string;
  features: string[];
  budget: string;
  timeline: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  website: string;
  consent: boolean;
};

const siteTypes = [
  ["E-Ticaret", "Satış, ödeme ve yönetim paneli", "EC"],
  ["Araç Kiralama", "Filo, rezervasyon ve müsaitlik", "RC"],
  ["Kurumsal", "Marka, hizmetler ve güçlü dönüşüm", "CO"],
  ["Gayrimenkul", "İlan, harita ve danışman akışı", "RE"],
  ["Otel & Turizm", "Oda, tarih ve rezervasyon", "HT"],
  ["Restoran", "Menü, masa ve sipariş deneyimi", "RS"],
  ["Sağlık", "Uzman, hizmet ve randevu sistemi", "CL"],
  ["Özel Proje", "İhtiyacınıza göre sıfırdan", "SP"],
];

const designs = ["Kararı Dromocob versin", ...studioTemplates.map((item) => item.name)];

const featureOptions = [
  "Yönetim paneli", "Online ödeme", "Rezervasyon", "Çoklu dil",
  "Üyelik sistemi", "Mobil uygulama", "SEO altyapısı", "CRM entegrasyonu",
];

const initialForm: FormState = {
  siteType: "", design: designs[0], features: [], budget: "", timeline: "",
  name: "", company: "", email: "", phone: "", message: "", website: "", consent: false,
};

export default function ProjectBriefModal({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const progress = useMemo(() => `${Math.min(step, 3) * 33.333}%`, [step]);
  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleFeature = (feature: string) =>
    update("features", form.features.includes(feature)
      ? form.features.filter((item) => item !== feature)
      : [...form.features, feature]);

  const next = () => {
    if (step === 1 && !form.siteType) return setError("Devam etmek için bir site türü seçin.");
    setError("");
    setStep((current) => Math.min(3, current + 1));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.consent) {
      setError("Ad, e-posta, telefon ve onay alanlarını tamamlayın.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/project-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Talep gönderilemedi.");
      setReference(data.reference || "DROMOCOB");
      setStep(4);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Talep gönderilemedi.");
    } finally {
      setSending(false);
    }
  };

  const closeAndReset = () => {
    onClose();
    window.setTimeout(() => { setStep(1); setForm(initialForm); setReference(""); setError(""); }, 250);
  };

  return (
    <div className={s.backdrop} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && closeAndReset()}>
      <section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="brief-title">
        <aside className={s.aside}>
          <div className={s.asideGlow} />
          <div className={s.asideBrand}><span>D</span><b>DROMOCOB</b></div>
          <div className={s.asideCopy}>
            <span><Sparkles /> PROJECT BUILDER / 01</span>
            <h2>Fikrinizi,<br /><em>etkileyici bir</em><br />deneyime çevirelim.</h2>
            <p>İhtiyacınızı birkaç adımda anlatın. Ekibimiz seçiminizi inceleyip size özel yol haritasıyla ulaşsın.</p>
          </div>
          <div className={s.asideMetrics}>
            <div><b>48h</b><span>İlk dönüş</span></div>
            <div><b>100%</b><span>Size özel</span></div>
            <div><b>360°</b><span>Dijital çözüm</span></div>
          </div>
        </aside>

        <div className={s.content}>
          <button className={s.close} type="button" onClick={closeAndReset} aria-label="Pencereyi kapat"><X /></button>
          {step < 4 && (
            <>
              <div className={s.progressMeta}><span>PROJE OLUŞTURUCU</span><b>0{step} / 03</b></div>
              <div className={s.progress}><i style={{ width: progress }} /></div>
            </>
          )}

          {step === 1 && (
            <div className={s.step}>
              <div className={s.stepTitle}><Layers3 /><div><span>ADIM 01</span><h1 id="brief-title">Nasıl bir site istiyorsunuz?</h1><p>Size en yakın proje türünü ve beğendiğiniz tasarımı seçin.</p></div></div>
              <div className={s.typeGrid}>
                {siteTypes.map(([name, description, code]) => (
                  <button key={name} type="button" className={form.siteType === name ? s.selected : ""} onClick={() => update("siteType", name)}>
                    <i>{code}</i><span><b>{name}</b><small>{description}</small></span><CheckCircle2 />
                  </button>
                ))}
              </div>
              <label className={s.field}><span>Beğendiğiniz demo tasarımı</span><select value={form.design} onChange={(e) => update("design", e.target.value)}>{designs.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
          )}

          {step === 2 && (
            <div className={s.step}>
              <div className={s.stepTitle}><Sparkles /><div><span>ADIM 02</span><h1>Projenizi şekillendirelim.</h1><p>İhtiyaçlarınızı seçin; daha sonra birlikte detaylandırabiliriz.</p></div></div>
              <div className={s.sectionLabel}>İSTEDİĞİNİZ ÖZELLİKLER</div>
              <div className={s.chips}>{featureOptions.map((feature) => <button type="button" key={feature} className={form.features.includes(feature) ? s.chipSelected : ""} onClick={() => toggleFeature(feature)}><Check />{feature}</button>)}</div>
              <div className={s.twoCols}>
                <label className={s.field}><span><CircleDollarSign /> Yaklaşık bütçe</span><select value={form.budget} onChange={(e) => update("budget", e.target.value)}><option value="">Henüz karar vermedim</option><option>50.000 — 100.000 TL</option><option>100.000 — 250.000 TL</option><option>250.000 — 500.000 TL</option><option>500.000 TL ve üzeri</option></select></label>
                <label className={s.field}><span><Clock3 /> Hedef zaman</span><select value={form.timeline} onChange={(e) => update("timeline", e.target.value)}><option value="">Esnek</option><option>2 — 4 hafta</option><option>1 — 2 ay</option><option>2 — 4 ay</option><option>Uzun dönem</option></select></label>
              </div>
              <label className={s.field}><span>Projenizden kısaca bahsedin</span><textarea value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Hedefiniz, beğendiğiniz örnekler ve ihtiyaç duyduğunuz özellikler..." /></label>
            </div>
          )}

          {step === 3 && (
            <form className={s.step} onSubmit={submit}>
              <div className={s.stepTitle}><Send /><div><span>SON ADIM</span><h1>Size nasıl ulaşalım?</h1><p>Proje danışmanımız talebinizi inceleyip sizinle iletişim kuracak.</p></div></div>
              <div className={s.twoCols}>
                <label className={s.field}><span>Adınız soyadınız *</span><input value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" /></label>
                <label className={s.field}><span>Şirket / marka</span><input value={form.company} onChange={(e) => update("company", e.target.value)} autoComplete="organization" /></label>
                <label className={s.field}><span>E-posta adresiniz *</span><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" /></label>
                <label className={s.field}><span>Telefon numaranız *</span><input value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" /></label>
              </div>
              <input className={s.honeypot} tabIndex={-1} value={form.website} onChange={(e) => update("website", e.target.value)} aria-hidden="true" />
              <label className={s.consent}><input type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} /><i><Check /></i><span>İletişim bilgilerimin proje talebim için kullanılmasını kabul ediyorum.</span></label>
              <div className={s.summary}><span>SEÇİMİNİZ</span><b>{form.siteType}</b><small>{form.design} · {form.features.length || 0} özellik</small></div>
              <button className={s.submit} type="submit" disabled={sending}>{sending ? <Loader2 className={s.spin} /> : <Send />} Talebi Dromocob’a gönder <ArrowRight /></button>
            </form>
          )}

          {step === 4 && (
            <div className={s.success}>
              <div><Check /></div><span>TALEBİNİZ ALINDI</span><h1>Harika bir başlangıç yaptık.</h1><p>Proje özetiniz Dromocob ekibine ulaştı. En geç 48 saat içinde sizinle iletişime geçeceğiz.</p><small>TALEP KODU <b>{reference}</b></small><button type="button" onClick={closeAndReset}>Ana sayfaya dön <ArrowRight /></button>
            </div>
          )}

          {error && <div className={s.error}>{error}</div>}
          {step < 3 && <div className={s.navigation}><button type="button" onClick={() => step === 1 ? closeAndReset() : setStep(step - 1)}><ArrowLeft /> {step === 1 ? "Vazgeç" : "Geri"}</button><button type="button" onClick={next}>Devam et <ChevronRight /></button></div>}
        </div>
      </section>
    </div>
  );
}
