"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, ShieldCheck, Sparkles, X } from "lucide-react";
import styles from "./mobileAppCampaign.module.css";
import { trackAppDownload } from "@/components/AnalyticsTracker";

export const APP_STORE_URL = "#";
const DISMISS_KEY = "dromocob_app_launch_ad_until_v1";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function AppIcon({ size = 54 }: { size?: number }) {
  return <span className={styles.appIcon} style={{ width: size, height: size, borderRadius: "24%", border: "2px solid rgba(23,23,19,.20)", boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}><img src="/dromocob-mark.svg" alt="Dromocob uygulaması" /></span>;
}

function StoreButton({ compact = false, source = "unknown" }: { compact?: boolean; source?: string }) {
  return (
    <a className={compact ? styles.storeCompact : styles.storeButton} href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackAppDownload(source)} aria-label="Bizim Dromocob uygulamasını App Store'dan indir">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      <span><small>Şimdi indirin</small><strong>App Store</strong></span>
      {!compact ? <ArrowRight /> : null}
    </a>
  );
}

export function MobileAppInline() {
  return (
    <section className={styles.inlineSection} aria-labelledby="mobile-app-title">
      <div className={styles.inlineGlow} />
      <div className={styles.inlineCopy}>
        <span className={styles.eyebrow}><Sparkles /> Cebinizdeki mağaza</span>
        <h2 id="mobile-app-title">Seçtiklerin artık her an yanında.</h2>
        <p>Yeni koleksiyonları keşfet, favorilerini kaydet ve güvenli alışveriş deneyimini Dromocob uygulamasında yaşa.</p>
        <div className={styles.benefits}><span><Check /> Hızlı erişim</span><span><Check /> Özel fırsatlar</span><span><ShieldCheck /> Güvenli alışveriş</span></div>
        <StoreButton source="homepage_showcase" />
      </div>
      <div className={styles.phoneStage} aria-hidden="true">
        <div className={styles.orbit}><span /><span /><span /></div>
        <div className={styles.phone}><div className={styles.phoneTop} /><AppIcon /><b>Dromocob</b><small>özel ürün dünyası cebinde</small><div className={styles.phoneCard}>Yeni koleksiyon<br/><strong>Şimdi keşfet</strong></div></div>
      </div>
    </section>
  );
}

export default function MobileAppCampaign() {
  const [mounted, setMounted] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    let allowed = true;
    try { allowed = Number(localStorage.getItem(DISMISS_KEY) || 0) < Date.now(); } catch { /* noop */ }
    const timer = window.setTimeout(() => setShowLaunch(allowed), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  function dismissLaunch() {
    setShowLaunch(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + SEVEN_DAYS)); } catch { /* noop */ }
  }

  if (!mounted) return null;

  return createPortal(<>
    <aside className={styles.floating} style={{ width: 76, height: 76, borderRadius: "50%", padding: 6, overflow: "visible", background: "rgba(255,255,255,.96)" }} aria-label="Mobil uygulama tanıtımı">
      <button type="button" onClick={() => setBubbleOpen((value) => !value)} aria-expanded={bubbleOpen} aria-label="Mobil uygulama indirme kutusunu aç" style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", padding: 0, border: 0, borderRadius: "50%", background: "transparent", cursor: "pointer" }}><AppIcon size={62} /></button>
    </aside>

    {bubbleOpen ? <section aria-label="Mobil uygulama indirme kutusu" style={{ position: "fixed", zIndex: 9986, left: 18, bottom: 246, width: 292, maxWidth: "calc(100vw - 36px)", padding: 18, border: "1px solid rgba(183,138,43,.22)", borderRadius: 22, background: "linear-gradient(145deg,#fff,#fff9ed)", boxShadow: "0 24px 65px rgba(5,15,30,.24)" }}>
      <button type="button" onClick={() => setBubbleOpen(false)} aria-label="İndirme kutusunu kapat" style={{ position: "absolute", top: 9, right: 9, width: 30, height: 30, display: "grid", placeItems: "center", padding: 0, border: "1px solid #e5e8ed", borderRadius: "50%", background: "#fff", color: "#152238", cursor: "pointer" }}><X size={15} /></button>
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 25 }}><AppIcon size={52} /><div><small style={{ color: "#a77719", fontSize: 9, fontWeight: 900, letterSpacing: ".09em", textTransform: "uppercase" }}>Mobil uygulamamız</small><strong style={{ display: "block", marginTop: 3, color: "#0c1829", fontSize: 16 }}>özel ürün dünyası cebinde</strong></div></div>
      <p style={{ margin: "14px 0", color: "#697587", fontSize: 11, lineHeight: 1.55 }}>Yeni koleksiyonlara hızla ulaş, favorilerini takip et ve uygulamaya özel fırsatları kaçırma.</p>
      <StoreButton compact source="floating_card" />
    </section> : null}

    {showLaunch ? <div className={styles.launchBackdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) dismissLaunch(); }}>
      <section className={styles.launch} role="dialog" aria-modal="true" aria-labelledby="app-launch-title">
        <button className={styles.launchClose} type="button" onClick={dismissLaunch} aria-label="Kapat"><X /></button>
        <div className={styles.launchVisual}><span className={styles.launchHalo} /><div className={styles.launchPhone}><AppIcon /><b>Dromocob</b><small>e-ticaret deneyimi cebinde</small></div></div>
        <div className={styles.launchCopy}><span className={styles.eyebrow}><Sparkles /> Uygulamamız yayında</span><h2 id="app-launch-title">özel ürün dünyamızı cebinde taşı.</h2><p>Seçkin koleksiyonlara daha hızlı ulaş, favorilerini yanında tut ve uygulamaya özel fırsatları kaçırma.</p><ul><li><Check /> Koleksiyonlara hızlı erişim</li><li><Check /> Favori ürünlerini kolayca takip</li><li><Check /> Güvenli ve akıcı alışveriş</li></ul><StoreButton source="launch_popup" /><button type="button" className={styles.later} onClick={dismissLaunch}>Şimdilik web sitesinde devam et</button></div>
      </section>
    </div> : null}
  </>, document.body);
}
