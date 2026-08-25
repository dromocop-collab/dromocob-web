"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./HomeSectionsAdmin.module.css";

type LocaleText = {
  tr: string;
  en: string;
};

type ServiceItem = {
  title: LocaleText;
  text: LocaleText;
  href: string;
};

type GiftCardItem = {
  title: LocaleText;
  text: LocaleText;
  href: string;
};

type EducationItem = {
  title: LocaleText;
  text: LocaleText;
  href: string;
};

type LuxuryServicesData = {
  enabled: boolean;
  items: ServiceItem[];
};

type GiftGuideData = {
  enabled: boolean;
  title: LocaleText;
  text: LocaleText;
  primaryBtn: LocaleText;
  primaryHref: string;
  secondaryBtn: LocaleText;
  secondaryHref: string;
  cards: GiftCardItem[];
};

type EducationHubData = {
  enabled: boolean;
  items: EducationItem[];
};

type CustomerPromiseBandData = {
  enabled: boolean;
  items: string[];
};

type ConciergeData = {
  enabled: boolean;
  title: LocaleText;
  text: LocaleText;
  primaryBtn: LocaleText;
  primaryHref: string;
  secondaryBtn: LocaleText;
  secondaryHref: string;
};

type NewsletterData = {
  enabled: boolean;
  title: LocaleText;
  text: LocaleText;
  btnLabel: LocaleText;
  incentive: LocaleText;
};

type BudgetShoppingData = {
  enabled: boolean;
  title: LocaleText;
  text: LocaleText;
};

type HomeSectionsDoc = {
  luxuryServices: LuxuryServicesData;
  giftGuide: GiftGuideData;
  educationHub: EducationHubData;
  customerPromiseBand: CustomerPromiseBandData;
  conciergeCta: ConciergeData;
  newsletter: NewsletterData;
  budgetShopping: BudgetShoppingData;
};

function emptyLocale(): LocaleText {
  return { tr: "", en: "" };
}

const defaultData: HomeSectionsDoc = {
  luxuryServices: {
    enabled: true,
    items: [
      { title: emptyLocale(), text: emptyLocale(), href: "" },
      { title: emptyLocale(), text: emptyLocale(), href: "" },
      { title: emptyLocale(), text: emptyLocale(), href: "" },
      { title: emptyLocale(), text: emptyLocale(), href: "" },
    ],
  },

  giftGuide: {
    enabled: true,
    title: emptyLocale(),
    text: emptyLocale(),
    primaryBtn: emptyLocale(),
    primaryHref: "",
    secondaryBtn: emptyLocale(),
    secondaryHref: "",
    cards: [
      { title: emptyLocale(), text: emptyLocale(), href: "" },
      { title: emptyLocale(), text: emptyLocale(), href: "" },
      { title: emptyLocale(), text: emptyLocale(), href: "" },
    ],
  },

  educationHub: {
    enabled: true,
    items: [
      { title: emptyLocale(), text: emptyLocale(), href: "" },
      { title: emptyLocale(), text: emptyLocale(), href: "" },
      { title: emptyLocale(), text: emptyLocale(), href: "" },
    ],
  },

  customerPromiseBand: {
    enabled: true,
    items: ["", "", "", "", ""],
  },

  conciergeCta: {
    enabled: true,
    title: emptyLocale(),
    text: emptyLocale(),
    primaryBtn: emptyLocale(),
    primaryHref: "",
    secondaryBtn: emptyLocale(),
    secondaryHref: "",
  },

  newsletter: {
    enabled: true,
    title: emptyLocale(),
    text: emptyLocale(),
    btnLabel: emptyLocale(),
    incentive: emptyLocale(),
  },

  budgetShopping: {
    enabled: true,
    title: emptyLocale(),
    text: emptyLocale(),
  },
};
function fillServices(arr: any[], count = 4): ServiceItem[] {
    const base = Array.from({ length: count }, () => ({
      title: { tr: "", en: "" },
      text: { tr: "", en: "" },
      href: "",
    }));
  
    const incoming = Array.isArray(arr)
      ? arr.map((x: any) => ({
          title: safeLocale(x?.title),
          text: safeLocale(x?.text),
          href: String(x?.href || ""),
        }))
      : [];
  
    return base.map((item, i) => incoming[i] || item);
  }
  
  function fillGiftCards(arr: any[], count = 3): GiftCardItem[] {
    const base = Array.from({ length: count }, () => ({
      title: { tr: "", en: "" },
      text: { tr: "", en: "" },
      href: "",
    }));
  
    const incoming = Array.isArray(arr)
      ? arr.map((x: any) => ({
          title: safeLocale(x?.title),
          text: safeLocale(x?.text),
          href: String(x?.href || ""),
        }))
      : [];
  
    return base.map((item, i) => incoming[i] || item);
  }
  
  function fillEducation(arr: any[], count = 3): EducationItem[] {
    const base = Array.from({ length: count }, () => ({
      title: { tr: "", en: "" },
      text: { tr: "", en: "" },
      href: "",
    }));
  
    const incoming = Array.isArray(arr)
      ? arr.map((x: any) => ({
          title: safeLocale(x?.title),
          text: safeLocale(x?.text),
          href: String(x?.href || ""),
        }))
      : [];
  
    return base.map((item, i) => incoming[i] || item);
  }
  
  function fillPromiseItems(arr: any[], count = 5): string[] {
    const base = Array.from({ length: count }, () => "");
    const incoming = Array.isArray(arr) ? arr.map((x: any) => String(x || "")) : [];
    return base.map((item, i) => incoming[i] || item);
  }
function safeLocale(v: any): LocaleText {
  return {
    tr: String(v?.tr || ""),
    en: String(v?.en || ""),
  };
}

function normalizeDoc(d: any): HomeSectionsDoc {
    const luxuryRaw = d?.luxuryServices?.items ?? d?.luxuryServices ?? [];
    const giftCardsRaw = d?.giftGuide?.cards ?? [];
    const educationRaw = d?.educationHub?.items ?? d?.educationHub ?? [];
    const promiseRaw = d?.customerPromiseBand?.items ?? d?.customerPromiseBand ?? [];
  
    return {
      luxuryServices: {
        enabled: d?.luxuryServices?.enabled !== false,
        items: fillServices(luxuryRaw, 4),
      },
  
      giftGuide: {
        enabled: d?.giftGuide?.enabled !== false,
        title: safeLocale(d?.giftGuide?.title),
        text: safeLocale(d?.giftGuide?.text),
        primaryBtn: safeLocale(d?.giftGuide?.primaryBtn),
        primaryHref: String(d?.giftGuide?.primaryHref || ""),
        secondaryBtn: safeLocale(d?.giftGuide?.secondaryBtn),
        secondaryHref: String(d?.giftGuide?.secondaryHref || ""),
        cards: fillGiftCards(giftCardsRaw, 3),
      },
  
      educationHub: {
        enabled: d?.educationHub?.enabled !== false,
        items: fillEducation(educationRaw, 3),
      },
  
      customerPromiseBand: {
        enabled: d?.customerPromiseBand?.enabled !== false,
        items: fillPromiseItems(promiseRaw, 5),
      },
  
      conciergeCta: {
        enabled: d?.conciergeCta?.enabled !== false,
        title: safeLocale(d?.conciergeCta?.title),
        text: safeLocale(d?.conciergeCta?.text),
        primaryBtn: safeLocale(d?.conciergeCta?.primaryBtn),
        primaryHref: String(d?.conciergeCta?.primaryHref || ""),
        secondaryBtn: safeLocale(d?.conciergeCta?.secondaryBtn),
        secondaryHref: String(d?.conciergeCta?.secondaryHref || ""),
      },

      newsletter: {
        enabled: d?.newsletter?.enabled !== false,
        title: safeLocale(d?.newsletter?.title),
        text: safeLocale(d?.newsletter?.text),
        btnLabel: safeLocale(d?.newsletter?.btnLabel),
        incentive: safeLocale(d?.newsletter?.incentive),
      },

      budgetShopping: {
        enabled: d?.budgetShopping?.enabled !== false,
        title: safeLocale(d?.budgetShopping?.title),
        text: safeLocale(d?.budgetShopping?.text),
      },
    };
  }

function HomeSectionsAdminPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const [data, setData] = useState<HomeSectionsDoc>(defaultData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const ref = doc(db, "site_options", "home_settings");
        const snap = await getDoc(ref);
        if (!alive) return;

        if (snap.exists()) {
          setData(normalizeDoc(snap.data()));
        } else {
          setData(defaultData);
        }
      } catch (err) {
        console.error("home sections load error:", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [db]);

  function setSectionEnabled(
    section: "luxuryServices" | "giftGuide" | "educationHub" | "customerPromiseBand" | "conciergeCta" | "newsletter" | "budgetShopping",
    value: boolean
  ) {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        enabled: value,
      },
    }));
  }

  function setLuxuryField(index: number, field: "href", value: string) {
    setData((prev) => {
      const next = [...prev.luxuryServices.items];
      next[index] = { ...next[index], [field]: value };
      return {
        ...prev,
        luxuryServices: {
          ...prev.luxuryServices,
          items: next,
        },
      };
    });
  }

  function setLuxuryLocale(index: number, field: "title" | "text", loc: "tr" | "en", value: string) {
    setData((prev) => {
      const next = [...prev.luxuryServices.items];
      next[index] = {
        ...next[index],
        [field]: {
          ...next[index][field],
          [loc]: value,
        },
      };
      return {
        ...prev,
        luxuryServices: {
          ...prev.luxuryServices,
          items: next,
        },
      };
    });
  }

  function setGiftField(field: "primaryHref" | "secondaryHref", value: string) {
    setData((prev) => ({
      ...prev,
      giftGuide: {
        ...prev.giftGuide,
        [field]: value,
      },
    }));
  }

  function setGiftLocale(field: "title" | "text" | "primaryBtn" | "secondaryBtn", loc: "tr" | "en", value: string) {
    setData((prev) => ({
      ...prev,
      giftGuide: {
        ...prev.giftGuide,
        [field]: {
          ...prev.giftGuide[field],
          [loc]: value,
        },
      },
    }));
  }

  function setGiftCardField(index: number, field: "href", value: string) {
    setData((prev) => {
      const next = [...prev.giftGuide.cards];
      next[index] = { ...next[index], [field]: value };
      return {
        ...prev,
        giftGuide: {
          ...prev.giftGuide,
          cards: next,
        },
      };
    });
  }

  function setGiftCardLocale(index: number, field: "title" | "text", loc: "tr" | "en", value: string) {
    setData((prev) => {
      const next = [...prev.giftGuide.cards];
      next[index] = {
        ...next[index],
        [field]: {
          ...next[index][field],
          [loc]: value,
        },
      };
      return {
        ...prev,
        giftGuide: {
          ...prev.giftGuide,
          cards: next,
        },
      };
    });
  }

  function setEducationField(index: number, field: "href", value: string) {
    setData((prev) => {
      const next = [...prev.educationHub.items];
      next[index] = { ...next[index], [field]: value };
      return {
        ...prev,
        educationHub: {
          ...prev.educationHub,
          items: next,
        },
      };
    });
  }

  function setEducationLocale(index: number, field: "title" | "text", loc: "tr" | "en", value: string) {
    setData((prev) => {
      const next = [...prev.educationHub.items];
      next[index] = {
        ...next[index],
        [field]: {
          ...next[index][field],
          [loc]: value,
        },
      };
      return {
        ...prev,
        educationHub: {
          ...prev.educationHub,
          items: next,
        },
      };
    });
  }

  function setPromise(index: number, value: string) {
    setData((prev) => {
      const next = [...prev.customerPromiseBand.items];
      next[index] = value;
      return {
        ...prev,
        customerPromiseBand: {
          ...prev.customerPromiseBand,
          items: next,
        },
      };
    });
  }

  function setConciergeField(field: "primaryHref" | "secondaryHref", value: string) {
    setData((prev) => ({
      ...prev,
      conciergeCta: {
        ...prev.conciergeCta,
        [field]: value,
      },
    }));
  }

  function setConciergeLocale(field: "title" | "text" | "primaryBtn" | "secondaryBtn", loc: "tr" | "en", value: string) {
    setData((prev) => ({
      ...prev,
      conciergeCta: {
        ...prev.conciergeCta,
        [field]: {
          ...prev.conciergeCta[field],
          [loc]: value,
        },
      },
    }));
  }

  function setNewsletterLocale(field: "title" | "text" | "btnLabel" | "incentive", loc: "tr" | "en", value: string) {
    setData((prev) => ({
      ...prev,
      newsletter: {
        ...prev.newsletter,
        [field]: {
          ...prev.newsletter[field],
          [loc]: value,
        },
      },
    }));
  }

  function setBudgetLocale(field: "title" | "text", loc: "tr" | "en", value: string) {
    setData((prev) => ({
      ...prev,
      budgetShopping: {
        ...prev.budgetShopping,
        [field]: {
          ...prev.budgetShopping[field],
          [loc]: value,
        },
      },
    }));
  }

  async function saveAll() {
    setSaving(true);
    setMsg("");

    try {
      const ref = doc(db, "site_options", "home_settings");

      await setDoc(
        ref,
        {
          luxuryServices: data.luxuryServices,
          giftGuide: data.giftGuide,
          educationHub: data.educationHub,
          customerPromiseBand: data.customerPromiseBand,
          conciergeCta: data.conciergeCta,
          newsletter: data.newsletter,
          budgetShopping: data.budgetShopping,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMsg("Kaydedildi ✅");
    } catch (err) {
      console.error("saveAll error:", err);
      setMsg("Kaydetme hatası oluştu");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 2500);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Yükleniyor...</div>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.topbar}>
          <div>
            <div className={styles.kicker}>HOME SECTIONS ADMIN</div>
            <h1 className={styles.title}>Anasayfa Ek Bölümler Yönetimi</h1>
            <p className={styles.desc}>Tüm yeni premium blokları tek panelden yönet.</p>
          </div>

          <div className={styles.topActions}>
            {msg ? <span className={styles.msg}>{msg}</span> : null}
            <button className={styles.saveBtn} onClick={saveAll} disabled={saving} type="button">
              {saving ? "Kaydediliyor..." : "Tümünü Kaydet"}
            </button>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>1. Premium Hizmetler</h2>
            <label className={styles.switch}>
  <input
    type="checkbox"
    checked={data.luxuryServices.enabled}
    onChange={(e) => setSectionEnabled("luxuryServices", e.target.checked)}
  />
  <span className={styles.slider} />
  <span className={styles.switchText}>Aktif</span>
</label>
          </div>

          <div className={styles.grid4}>
            {data.luxuryServices.items.map((item, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.cardTitle}>Kart {i + 1}</div>
                <input className={styles.input} value={item.title.tr} onChange={(e) => setLuxuryLocale(i, "title", "tr", e.target.value)} placeholder="Başlık TR" />
                <input className={styles.input} value={item.title.en} onChange={(e) => setLuxuryLocale(i, "title", "en", e.target.value)} placeholder="Title EN" />
                <textarea className={styles.textarea} value={item.text.tr} onChange={(e) => setLuxuryLocale(i, "text", "tr", e.target.value)} placeholder="Açıklama TR" />
                <textarea className={styles.textarea} value={item.text.en} onChange={(e) => setLuxuryLocale(i, "text", "en", e.target.value)} placeholder="Description EN" />
                <input className={styles.input} value={item.href} onChange={(e) => setLuxuryField(i, "href", e.target.value)} placeholder="/iletisim" />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>2. Hediye Rehberi</h2>
            <label className={styles.switch}>
  <input
    type="checkbox"
    checked={data.giftGuide.enabled}
    onChange={(e) => setSectionEnabled("giftGuide", e.target.checked)}
  />
  <span className={styles.slider} />
  <span className={styles.switchText}>Aktif</span>
</label>
          </div>

          <div className={styles.cardWide}>
            <div className={styles.twoCol}>
              <input className={styles.input} value={data.giftGuide.title.tr} onChange={(e) => setGiftLocale("title", "tr", e.target.value)} placeholder="Başlık TR" />
              <input className={styles.input} value={data.giftGuide.title.en} onChange={(e) => setGiftLocale("title", "en", e.target.value)} placeholder="Title EN" />
              <textarea className={styles.textarea} value={data.giftGuide.text.tr} onChange={(e) => setGiftLocale("text", "tr", e.target.value)} placeholder="Metin TR" />
              <textarea className={styles.textarea} value={data.giftGuide.text.en} onChange={(e) => setGiftLocale("text", "en", e.target.value)} placeholder="Text EN" />
              <input className={styles.input} value={data.giftGuide.primaryBtn.tr} onChange={(e) => setGiftLocale("primaryBtn", "tr", e.target.value)} placeholder="Ana Buton TR" />
              <input className={styles.input} value={data.giftGuide.primaryBtn.en} onChange={(e) => setGiftLocale("primaryBtn", "en", e.target.value)} placeholder="Primary Button EN" />
              <input className={styles.input} value={data.giftGuide.primaryHref} onChange={(e) => setGiftField("primaryHref", e.target.value)} placeholder="/shop" />
              <input className={styles.input} value={data.giftGuide.secondaryHref} onChange={(e) => setGiftField("secondaryHref", e.target.value)} placeholder="/iletisim" />
              <input className={styles.input} value={data.giftGuide.secondaryBtn.tr} onChange={(e) => setGiftLocale("secondaryBtn", "tr", e.target.value)} placeholder="İkinci Buton TR" />
              <input className={styles.input} value={data.giftGuide.secondaryBtn.en} onChange={(e) => setGiftLocale("secondaryBtn", "en", e.target.value)} placeholder="Secondary Button EN" />
            </div>

            <div className={styles.grid3}>
              {data.giftGuide.cards.map((item, i) => (
                <div key={i} className={styles.card}>
                  <div className={styles.cardTitle}>Kart {i + 1}</div>
                  <input className={styles.input} value={item.title.tr} onChange={(e) => setGiftCardLocale(i, "title", "tr", e.target.value)} placeholder="Başlık TR" />
                  <input className={styles.input} value={item.title.en} onChange={(e) => setGiftCardLocale(i, "title", "en", e.target.value)} placeholder="Title EN" />
                  <textarea className={styles.textarea} value={item.text.tr} onChange={(e) => setGiftCardLocale(i, "text", "tr", e.target.value)} placeholder="Açıklama TR" />
                  <textarea className={styles.textarea} value={item.text.en} onChange={(e) => setGiftCardLocale(i, "text", "en", e.target.value)} placeholder="Description EN" />
                  <input className={styles.input} value={item.href} onChange={(e) => setGiftCardField(i, "href", e.target.value)} placeholder="/shop?cat=hediye" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>3. Bilgilendirici İçerikler</h2>
            <label className={styles.switch}>
  <input
    type="checkbox"
    checked={data.educationHub.enabled}
    onChange={(e) => setSectionEnabled("educationHub", e.target.checked)}
  />
  <span className={styles.slider} />
  <span className={styles.switchText}>Aktif</span>
</label>
          </div>

          <div className={styles.grid3}>
            {data.educationHub.items.map((item, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.cardTitle}>İçerik {i + 1}</div>
                <input className={styles.input} value={item.title.tr} onChange={(e) => setEducationLocale(i, "title", "tr", e.target.value)} placeholder="Başlık TR" />
                <input className={styles.input} value={item.title.en} onChange={(e) => setEducationLocale(i, "title", "en", e.target.value)} placeholder="Title EN" />
                <textarea className={styles.textarea} value={item.text.tr} onChange={(e) => setEducationLocale(i, "text", "tr", e.target.value)} placeholder="Açıklama TR" />
                <textarea className={styles.textarea} value={item.text.en} onChange={(e) => setEducationLocale(i, "text", "en", e.target.value)} placeholder="Description EN" />
                <input className={styles.input} value={item.href} onChange={(e) => setEducationField(i, "href", e.target.value)} placeholder="/blog/ornek-yazi" />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>4. Müşteri Güvence Bandı</h2>
            <label className={styles.switch}>
  <input
    type="checkbox"
    checked={data.customerPromiseBand.enabled}
    onChange={(e) => setSectionEnabled("customerPromiseBand", e.target.checked)}
  />
  <span className={styles.slider} />
  <span className={styles.switchText}>Aktif</span>
</label>
          </div>

          <div className={styles.grid5}>
            {data.customerPromiseBand.items.map((item, i) => (
              <input
                key={i}
                className={styles.input}
                value={item}
                onChange={(e) => setPromise(i, e.target.value)}
                placeholder={`Madde ${i + 1}`}
              />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>5. Concierge CTA</h2>
            <label className={styles.switch}>
  <input
    type="checkbox"
    checked={data.conciergeCta.enabled}
    onChange={(e) => setSectionEnabled("conciergeCta", e.target.checked)}
  />
  <span className={styles.slider} />
  <span className={styles.switchText}>Aktif</span>
</label>
          </div>

          <div className={styles.cardWide}>
            <div className={styles.twoCol}>
              <input className={styles.input} value={data.conciergeCta.title.tr} onChange={(e) => setConciergeLocale("title", "tr", e.target.value)} placeholder="Başlık TR" />
              <input className={styles.input} value={data.conciergeCta.title.en} onChange={(e) => setConciergeLocale("title", "en", e.target.value)} placeholder="Title EN" />
              <textarea className={styles.textarea} value={data.conciergeCta.text.tr} onChange={(e) => setConciergeLocale("text", "tr", e.target.value)} placeholder="Metin TR" />
              <textarea className={styles.textarea} value={data.conciergeCta.text.en} onChange={(e) => setConciergeLocale("text", "en", e.target.value)} placeholder="Text EN" />
              <input className={styles.input} value={data.conciergeCta.primaryBtn.tr} onChange={(e) => setConciergeLocale("primaryBtn", "tr", e.target.value)} placeholder="Ana Buton TR" />
              <input className={styles.input} value={data.conciergeCta.primaryBtn.en} onChange={(e) => setConciergeLocale("primaryBtn", "en", e.target.value)} placeholder="Primary Button EN" />
              <input className={styles.input} value={data.conciergeCta.primaryHref} onChange={(e) => setConciergeField("primaryHref", e.target.value)} placeholder="/iletisim" />
              <input className={styles.input} value={data.conciergeCta.secondaryHref} onChange={(e) => setConciergeField("secondaryHref", e.target.value)} placeholder="/hesabim" />
              <input className={styles.input} value={data.conciergeCta.secondaryBtn.tr} onChange={(e) => setConciergeLocale("secondaryBtn", "tr", e.target.value)} placeholder="İkinci Buton TR" />
              <input className={styles.input} value={data.conciergeCta.secondaryBtn.en} onChange={(e) => setConciergeLocale("secondaryBtn", "en", e.target.value)} placeholder="Secondary Button EN" />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>6. Newsletter / E-Bülten</h2>
            <label className={styles.switch}>
  <input
    type="checkbox"
    checked={data.newsletter.enabled}
    onChange={(e) => setSectionEnabled("newsletter", e.target.checked)}
  />
  <span className={styles.slider} />
  <span className={styles.switchText}>Aktif</span>
</label>
          </div>

          <div className={styles.cardWide}>
            <div className={styles.twoCol}>
              <input className={styles.input} value={data.newsletter.title.tr} onChange={(e) => setNewsletterLocale("title", "tr", e.target.value)} placeholder="Başlık TR (boş = varsayılan)" />
              <input className={styles.input} value={data.newsletter.title.en} onChange={(e) => setNewsletterLocale("title", "en", e.target.value)} placeholder="Title EN (empty = default)" />
              <textarea className={styles.textarea} value={data.newsletter.text.tr} onChange={(e) => setNewsletterLocale("text", "tr", e.target.value)} placeholder="Açıklama TR" />
              <textarea className={styles.textarea} value={data.newsletter.text.en} onChange={(e) => setNewsletterLocale("text", "en", e.target.value)} placeholder="Description EN" />
              <input className={styles.input} value={data.newsletter.btnLabel.tr} onChange={(e) => setNewsletterLocale("btnLabel", "tr", e.target.value)} placeholder="Buton TR (boş = Abone Ol)" />
              <input className={styles.input} value={data.newsletter.btnLabel.en} onChange={(e) => setNewsletterLocale("btnLabel", "en", e.target.value)} placeholder="Button EN (empty = Subscribe)" />
              <input className={styles.input} value={data.newsletter.incentive.tr} onChange={(e) => setNewsletterLocale("incentive", "tr", e.target.value)} placeholder="Teşvik mesajı TR (boş = varsayılan)" />
              <input className={styles.input} value={data.newsletter.incentive.en} onChange={(e) => setNewsletterLocale("incentive", "en", e.target.value)} placeholder="Incentive EN (empty = default)" />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>7. Bütçeye Göre Alışveriş</h2>
            <label className={styles.switch}>
  <input
    type="checkbox"
    checked={data.budgetShopping.enabled}
    onChange={(e) => setSectionEnabled("budgetShopping", e.target.checked)}
  />
  <span className={styles.slider} />
  <span className={styles.switchText}>Aktif</span>
</label>
          </div>

          <div className={styles.cardWide}>
            <div className={styles.twoCol}>
              <input className={styles.input} value={data.budgetShopping.title.tr} onChange={(e) => setBudgetLocale("title", "tr", e.target.value)} placeholder="Başlık TR (boş = varsayılan)" />
              <input className={styles.input} value={data.budgetShopping.title.en} onChange={(e) => setBudgetLocale("title", "en", e.target.value)} placeholder="Title EN (empty = default)" />
              <textarea className={styles.textarea} value={data.budgetShopping.text.tr} onChange={(e) => setBudgetLocale("text", "tr", e.target.value)} placeholder="Açıklama TR" />
              <textarea className={styles.textarea} value={data.budgetShopping.text.en} onChange={(e) => setBudgetLocale("text", "en", e.target.value)} placeholder="Description EN" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
export default function HomeSectionsAdminPage() {
  return (
    <AdminGate>
      <PermissionGate permission="home_settings">
        <HomeSectionsAdminPageInner />
      </PermissionGate>
    </AdminGate>
  );
}