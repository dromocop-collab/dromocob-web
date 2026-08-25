"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, Send, Sparkles, X } from "lucide-react";
import s from "./DesignQuoteButton.module.css";

type Props = {
  brand: string;
  design: string;
  siteType: string;
  label: string;
  variant?: "notice" | "cta";
};

export default function DesignQuoteButton({ brand, design, siteType, label, variant = "cta" }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", message: "", consent: false, website: "" });

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.includes("@") || !form.phone.trim() || !form.consent) {
      setError("Ad, e-posta, telefon ve onay alanlarını tamamlayın.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/project-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          siteType,
          design,
          features: [],
          budget: "Görüşülecek",
          timeline: "Görüşülecek",
          message: form.message || `${brand} demo tasarımı için teklif talebi.`,
          source: "demo-quick-quote",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Talep gönderilemedi.");
      setReference(data.reference || "DROMOCOB");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Talep gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  const close = () => {
    setOpen(false);
    window.setTimeout(() => { setReference(""); setError(""); }, 250);
  };

  return (
    <>
      <button className={variant === "notice" ? s.noticeButton : s.ctaButton} type="button" onClick={() => setOpen(true)}>
        {label} <ArrowRight />
      </button>
      {open && (
        <div className={s.backdrop} onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="quote-title">
            <div className={s.visual}>
              <span><Sparkles /> SEÇİLİ TASARIM</span>
              <strong>{brand}</strong>
              <small>{siteType} · {design}</small>
              <p>Bu tasarım seçiminizle birlikte ekibimize ulaşacak. Yalnızca iletişim bilgilerinizi bırakmanız yeterli.</p>
            </div>
            <button className={s.close} type="button" onClick={close} aria-label="Pencereyi kapat"><X /></button>
            {reference ? (
              <div className={s.success}><i><Check /></i><span>TALEBİNİZ ALINDI</span><h2>Bu tasarımı sizin için hazırlayalım.</h2><p>Seçtiğiniz <b>{brand}</b> tasarımı ve iletişim bilgileriniz ekibimize ulaştı.</p><small>TALEP KODU <b>{reference}</b></small><button type="button" onClick={close}>Tamam <ArrowRight /></button></div>
            ) : (
              <form className={s.form} onSubmit={submit}>
                <span>HIZLI TEKLİF / {brand}</span>
                <h2 id="quote-title">İletişim bilgilerinizi bırakın.</h2>
                <p>Proje danışmanımız seçtiğiniz siteyi inceleyip en geç 48 saat içinde size ulaşsın.</p>
                <div className={s.grid}>
                  <label><span>Adınız soyadınız *</span><input value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" /></label>
                  <label><span>Şirket / marka</span><input value={form.company} onChange={(e) => update("company", e.target.value)} autoComplete="organization" /></label>
                  <label><span>E-posta adresiniz *</span><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" /></label>
                  <label><span>Telefon numaranız *</span><input value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" /></label>
                </div>
                <label className={s.message}><span>Eklemek istediğiniz not</span><textarea value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="İsterseniz projenizle ilgili kısa bir not bırakın." /></label>
                <input className={s.honeypot} tabIndex={-1} value={form.website} onChange={(e) => update("website", e.target.value)} aria-hidden="true" />
                <label className={s.consent}><input type="checkbox" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} /><i><Check /></i><span>Bilgilerimin bu teklif talebi için kullanılmasını kabul ediyorum.</span></label>
                {error && <div className={s.error}>{error}</div>}
                <button className={s.submit} disabled={sending} type="submit">{sending ? <Loader2 className={s.spin} /> : <Send />} Bu site için teklif iste <ArrowRight /></button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
