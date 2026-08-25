"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { Check, Eye, Image as ImageIcon, MonitorSmartphone, Save, Sparkles } from "lucide-react";
import PermissionGate from "@/components/admin/PermissionGate";
import { getFirebaseDb } from "@/lib/firebase.client";
import { DEFAULT_OPENING_POPUP, type OpeningPopupConfig } from "@/components/OpeningPopup";
import s from "./openingPopup.module.css";

const pagePresets = [
  ["Ana sayfa", "/"], ["Mobil uygulamalar", "/mobil-uygulama-gelistirme"],
  ["Mobil uygulama detayları", "/mobil-uygulama/*"], ["Sektörler", "/sektorler*"],
  ["Demo siteler", "/demo/*"], ["İletişim", "/iletisim"],
];

export default function OpeningPopupAdminPage() {
  return <PermissionGate permission="home_settings"><OpeningPopupEditor /></PermissionGate>;
}

function OpeningPopupEditor() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [form, setForm] = useState<OpeningPopupConfig>(DEFAULT_OPENING_POPUP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => onSnapshot(doc(db, "site_options", "opening_popup"), (snap) => {
    setForm({ ...DEFAULT_OPENING_POPUP, ...(snap.exists() ? snap.data() : {}) } as OpeningPopupConfig);
    setLoading(false);
  }, () => setLoading(false)), [db]);

  const update = <K extends keyof OpeningPopupConfig>(key: K, value: OpeningPopupConfig[K]) => setForm((current) => ({ ...current, [key]: value }));
  const togglePath = (path: string) => update("paths", form.paths.includes(path) ? form.paths.filter((item) => item !== path) : [...form.paths, path]);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      await setDoc(doc(db, "site_options", "opening_popup"), { ...form, delayMs: Number(form.delayMs), version: Date.now(), updatedAt: serverTimestamp() }, { merge: true });
      setSaved(true); window.setTimeout(() => setSaved(false), 2400);
    } catch (error) {
      console.error("opening popup save", error); window.alert("Popup ayarları kaydedilemedi.");
    } finally { setSaving(false); }
  }

  if (loading) return <div className={s.loading}>Popup stüdyosu hazırlanıyor…</div>;
  return <main className={s.page}>
    <header className={s.header}><div><span><Sparkles /> PAZARLAMA / AÇILIŞ DENEYİMİ</span><h1>Akıllı Popup Stüdyosu</h1><p>Reklamınızı tasarlayın, gösterilecek sayfaları seçin ve yayın sıklığını tek ekrandan yönetin.</p></div><button type="button" onClick={save} disabled={saving}>{saved ? <Check /> : <Save />}{saving ? "Yayınlanıyor…" : saved ? "Yayınlandı" : "Değişiklikleri yayınla"}</button></header>
    <section className={s.status}><label><input type="checkbox" checked={form.enabled} onChange={(e) => update("enabled", e.target.checked)} /><i /><span><b>Popup yayını</b><small>{form.enabled ? "Ziyaretçilere gösteriliyor" : "Şu anda kapalı"}</small></span></label><div className={form.enabled ? s.live : s.off}>{form.enabled ? "CANLI" : "KAPALI"}</div></section>
    <div className={s.layout}>
      <div className={s.controls}>
        <section><h2><Sparkles /> İçerik ve çağrı</h2><div className={s.grid}>
          <label><span>Üst etiket</span><input value={form.eyebrow} onChange={(e) => update("eyebrow", e.target.value)} /></label>
          <label><span>Buton yazısı</span><input value={form.ctaLabel} onChange={(e) => update("ctaLabel", e.target.value)} /></label>
          <label className={s.full}><span>Başlık <small>(satır için Enter)</small></span><textarea rows={2} value={form.title} onChange={(e) => update("title", e.target.value)} /></label>
          <label className={s.full}><span>Açıklama</span><textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
          <label className={s.full}><span><ImageIcon /> Görsel adresi</span><input value={form.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} /></label>
          <label><span>Buton hedefi</span><input value={form.ctaUrl} onChange={(e) => update("ctaUrl", e.target.value)} /></label>
          <label><span>Tema</span><select value={form.theme} onChange={(e) => update("theme", e.target.value as OpeningPopupConfig["theme"])}><option value="aurora">Aurora</option><option value="midnight">Midnight</option><option value="light">Açık</option></select></label>
        </div></section>
        <section><h2><MonitorSmartphone /> Sayfa hedefleme</h2><div className={s.segment}>{(["all","include","exclude"] as const).map((mode) => <button key={mode} type="button" className={form.targetMode === mode ? s.active : ""} onClick={() => update("targetMode", mode)}>{mode === "all" ? "Tüm sayfalar" : mode === "include" ? "Sadece seçilenler" : "Seçilenler hariç"}</button>)}</div><div className={s.presets}>{pagePresets.map(([label,path]) => <button key={path} type="button" className={form.paths.includes(path) ? s.selected : ""} onClick={() => togglePath(path)}><i>{form.paths.includes(path) && <Check />}</i><span><b>{label}</b><small>{path}</small></span></button>)}</div><label className={s.pathInput}><span>Özel yollar <small>(her satıra bir yol, alt sayfalar için *)</small></span><textarea rows={5} value={form.paths.join("\n")} onChange={(e) => update("paths", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} /></label></section>
        <section><h2><Eye /> Gösterim kuralı</h2><div className={s.grid}><label><span>Açılış gecikmesi</span><select value={form.delayMs} onChange={(e) => update("delayMs", Number(e.target.value))}><option value={0}>Hemen</option><option value={1200}>1,2 saniye</option><option value={1800}>1,8 saniye</option><option value={3000}>3 saniye</option><option value={5000}>5 saniye</option></select></label><label><span>Gösterim sıklığı</span><select value={form.frequency} onChange={(e) => update("frequency", e.target.value as OpeningPopupConfig["frequency"])}><option value="always">Her ziyarette</option><option value="session">Her oturumda bir kez</option><option value="daily">Günde bir kez</option></select></label></div></section>
      </div>
      <aside className={s.preview}><span>CANLI ÖNİZLEME</span><div className={s.previewCard}><div className={s.previewImage}><img src={form.imageUrl} alt="Popup önizleme" /></div><div><small>{form.eyebrow}</small><h3>{form.title}</h3><p>{form.description}</p><b>{form.ctaLabel} ↗</b></div></div><p>Kaydettikten sonra değişiklikler seçtiğiniz sayfalarda anında yayınlanır.</p></aside>
    </div>
  </main>;
}
