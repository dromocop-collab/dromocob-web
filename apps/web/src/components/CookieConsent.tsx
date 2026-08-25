"use client";

import Link from "next/link";
import { BarChart3, Check, Cookie, Megaphone, Settings2, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import s from "./CookieConsent.module.css";

const COOKIE_KEY = "nci_cookie_consent";
type Consent = { necessary: true; analytics: boolean; marketing: boolean; updatedAt: string };

function persist(analytics: boolean, marketing: boolean) {
  const consent: Consent = { necessary: true, analytics, marketing, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent("dromocob:consent", { detail: consent }));
  } catch { /* storage kapalıysa arayüz yine kapanır */ }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_KEY)) {
        const timer = window.setTimeout(() => setVisible(true), 900);
        return () => window.clearTimeout(timer);
      }
    } catch { return; }
  }, []);

  const save = (nextAnalytics: boolean, nextMarketing: boolean) => {
    persist(nextAnalytics, nextMarketing);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={s.shell} role="region" aria-label="Çerez tercihleri">
      <div className={`${s.card} ${settings ? s.expanded : ""}`}>
        <div className={s.glow} />
        <div className={s.topline}><span>PRIVACY CENTER / DROMOCOB</span><button type="button" onClick={() => save(false, false)} aria-label="Çerez penceresini kapat"><X /></button></div>

        {!settings ? (
          <div className={s.summary}>
            <div className={s.icon}><Cookie /></div>
            <div className={s.copy}><span>Kontrol sizde</span><h2>Daha iyi bir deneyim için izinlerinizi seçin.</h2><p>Zorunlu çerezler sistemi çalıştırır. Analiz ve pazarlama çerezlerini yalnızca onayınızla kullanırız. Tercihinizi dilediğiniz zaman değiştirebilirsiniz.</p><div><ShieldCheck /> Gizlilik odaklı · Şeffaf · Değiştirilebilir</div></div>
            <div className={s.actions}><button type="button" className={s.accept} onClick={() => save(true, true)}><Check /> Tümünü kabul et</button><button type="button" className={s.manage} onClick={() => setSettings(true)}><Settings2 /> Tercihleri yönet</button><button type="button" className={s.reject} onClick={() => save(false, false)}>Yalnızca zorunlu</button></div>
          </div>
        ) : (
          <div className={s.preferences}>
            <header><div><span>TERCİH MERKEZİ</span><h2>Veri kullanımını siz yönetin.</h2></div><p>Seçiminiz bu cihazda saklanır. Zorunlu çerezler kapatılamaz.</p></header>
            <div className={s.options}>
              <article><div className={s.optionIcon}><ShieldCheck /></div><div><b>Zorunlu</b><p>Oturum, güvenlik ve temel site işlevleri.</p></div><span className={s.always}>HER ZAMAN AÇIK</span></article>
              <article><div className={s.optionIcon}><BarChart3 /></div><div><b>Analiz</b><p>Hangi deneyimlerin daha iyi çalıştığını anlamamıza yardım eder.</p></div><label className={s.toggle}><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /><i /></label></article>
              <article><div className={s.optionIcon}><Megaphone /></div><div><b>Pazarlama</b><p>İlgili kampanya ölçümü ve yeniden hedefleme sinyalleri.</p></div><label className={s.toggle}><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /><i /></label></article>
            </div>
            <div className={s.preferenceActions}><button type="button" onClick={() => setSettings(false)}>Geri</button><button type="button" onClick={() => save(analytics, marketing)}><Check /> Tercihleri kaydet</button></div>
          </div>
        )}

        <footer><span>Detaylı bilgi:</span><Link href="/cerez-politikasi">Çerez Politikası</Link><i /> <Link href="/gizlilik-politikasi">Gizlilik Politikası</Link></footer>
      </div>
    </div>
  );
}
