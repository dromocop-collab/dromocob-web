"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useT } from "@/lib/useT";
import PremiumMarquee from "@/components/home/PremiumMarquee";
import AnnouncementBar from "@/components/home/AnnouncementBar";
import HeroSlider from "@/components/home/HeroSlider";
import TrustBadges from "@/components/home/TrustBadges";
import HeroMosaic from "@/components/home/HeroMosaic";
import PremiumTrustStrip from "@/components/home/PremiumTrustStrip";
import FeaturedCategoriesSliderV2 from "@/components/home/FeaturedCategoriesSliderV2";
import PromoDealSlider from "@/components/home/PromoDealSlider";
import LuxuryServicesStrip from "@/components/home/LuxuryServicesStrip";
import GiftGuideShowcase from "@/components/home/GiftGuideShowcase";
import LifestyleEducationHub from "@/components/home/LifestyleEducationHub";
import CustomerPromiseBand from "@/components/home/CustomerPromiseBand";
import ConciergeCtaBlock from "@/components/home/ConciergeCtaBlock";
import SelectedProductsShowcase from "@/components/home/SelectedProductsShowcase";
import PopularProductsStrip from "@/components/home/PopularProductsStrip";
import MarketHighlights from "@/components/home/MarketHighlights";
import HomeSocialSection from "@/components/home/HomeSocialSection";
import RecentlyViewed from "@/components/RecentlyViewed";
import CustomerTestimonials from "@/components/home/CustomerTestimonials";
import CampaignCountdown from "@/components/home/CampaignCountdown";
import NewsletterStrip from "@/components/home/NewsletterStrip";
import BudgetShopping from "@/components/home/BudgetShopping";
import CorporateSolutions from "@/components/home/CorporateSolutions";
import HomeEditorialHero from "@/components/home/HomeEditorialHero";
import { MobileAppInline } from "@/components/mobile-app/MobileAppCampaign";
import {
  fetchFeaturedCategories,
  type HomeSettings,
  type Category,
  pickText,
} from "@/lib/homeApi";
import { getFirebaseDb } from "@/lib/firebase.client";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  doc,
  onSnapshot,
} from "firebase/firestore";

import styles from "./HomeClient.module.css";

/** ---------------- helpers ---------------- */
function asArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function s(v: any) {
  return String(v ?? "").trim();
}

type CatUI = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  order?: number;
};

type PopTabUI = {
  key: string;
  label?: any;
  section?: string;
  order?: number;
  limit?: number;
  enabled?: boolean;
  isActive?: boolean;
};

export default function HomeClient() {
  const { t, loc } = useT();
  const db = useMemo(() => getFirebaseDb(), []);

  const [home, setHome] = useState<HomeSettings | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [tabs, setTabs] = useState<PopTabUI[]>([]);
  const [activeKey, setActiveKey] = useState<string>("all");

  const [itemsMap, setItemsMap] = useState<Record<string, any[]>>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [busyKey, setBusyKey] = useState<string>("");

  const fallbackTabs: PopTabUI[] = useMemo(
    () => [
      {
        key: "all",
        label: { tr: "Tümü", en: "All" },
        section: "all",
        order: 0,
        limit: 12,
        enabled: true,
        isActive: true,
      },
      {
        key: "bestsellers",
        label: { tr: "Çok Satanlar", en: "Bestsellers" },
        section: "bestsellers",
        order: 10,
        limit: 12,
        enabled: true,
        isActive: true,
      },
      {
        key: "featured",
        label: { tr: "Gözde", en: "Featured" },
        section: "featured",
        order: 20,
        limit: 12,
        enabled: true,
        isActive: true,
      },
      {
        key: "new",
        label: { tr: "Yeni", en: "New" },
        section: "new",
        order: 30,
        limit: 12,
        enabled: true,
        isActive: true,
      },
    ],
    []
  );

  const tabsToShow = useMemo(() => {
    const source = tabs.length ? tabs : fallbackTabs;

    const cleaned: PopTabUI[] = source
      .filter((x) => s(x?.key))
      .map((x) => ({
        key: s(x?.key),
        label: x?.label,
        section: s(x?.section) || s(x?.key),
        order: typeof x?.order === "number" ? x.order : 999,
        limit: typeof x?.limit === "number" ? x.limit : 12,
        enabled:
          typeof x?.enabled === "boolean"
            ? x.enabled
            : typeof x?.isActive === "boolean"
            ? x.isActive
            : true,
        isActive:
          typeof x?.isActive === "boolean"
            ? x.isActive
            : typeof x?.enabled === "boolean"
            ? x.enabled
            : true,
      }))
      .filter((x) => x.key)
      .filter((x) => x.enabled !== false && x.isActive !== false);

    const hasAll = cleaned.some((x) => x.key === "all");

    const finalTabs = hasAll
      ? cleaned
      : [
          {
            key: "all",
            label: { tr: "Tümü", en: "All" },
            section: "all",
            order: -999,
            limit: 12,
            enabled: true,
            isActive: true,
          },
          ...cleaned,
        ];

    return finalTabs.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  }, [tabs, fallbackTabs]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const cRes = await fetchFeaturedCategories(12);
        if (!alive) return;
        setCats(asArray<Category>(cRes));
      } catch {
        //
      } finally {
        if (alive) setLoading(false);
      }
    })();

    const homeRef = doc(db, "site_options", "home_settings");

    const unsub = onSnapshot(
      homeRef,
      (snap) => {
        if (!alive) return;

        const data = snap.exists() ? (snap.data() as any) : null;
        setHome(data as any);

   const arr = asArray<any>(data?.popularTabs ?? data?.popular_tabs);

        const cleaned: PopTabUI[] = arr
          .map((x: any) => ({
            key: s(x?.key),
            label: x?.label ?? x?.title ?? x?.name,
            section: s(x?.section) || s(x?.key),
            order: typeof x?.order === "number" ? x.order : undefined,
            limit: typeof x?.limit === "number" ? x.limit : undefined,
            enabled:
              typeof x?.enabled === "boolean"
                ? x.enabled
                : typeof x?.isActive === "boolean"
                ? x.isActive
                : true,
            isActive:
              typeof x?.isActive === "boolean"
                ? x.isActive
                : typeof x?.enabled === "boolean"
                ? x.enabled
                : true,
          }))
          .filter((x) => x.key);

        setTabs(cleaned);

        const savedOrder = asArray<string>(
          data?.section_order ??
            data?.sectionOrder ??
            data?.sectionsOrder ??
            data?.homeSectionOrder
        )
          .map((x) => s(x))
          .filter(Boolean);

        setSectionOrder(savedOrder);
      },
      (err) => {
        console.error("home_settings onSnapshot error:", err);
      }
    );

    return () => {
      alive = false;
      unsub();
    };
  }, [db]);

  useEffect(() => {
    if (!tabsToShow.length) return;

    const firstKey = s(tabsToShow[0]?.key) || "all";

    setActiveKey((prev) => {
      const p = s(prev);
      if (!p) return firstKey;
      return tabsToShow.some((x) => x.key === p) ? p : firstKey;
    });
  }, [tabsToShow]);

  const fetchForTab = useCallback(
    async (tabKey: string) => {
      const key = s(tabKey) || "all";
      const tab = tabsToShow.find((x) => s(x.key) === key);
      const section = s(tab?.section) || key;
      const take = Number(tab?.limit ?? 12);

      if (itemsMap[key]) return;

      setBusyKey(key);

      try {
        const productsRef = collection(db, "products");
        const toList = (snap: any) =>
          snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));

       if (section === "all") {
  const fetchLimit = Math.max(take * 5, 60);

  try {
    const qs = await getDocs(
      query(
        productsRef,
        where("isActive", "==", true),
        orderBy("updatedAt", "desc"),
        limit(fetchLimit)
      )
    );

    setItemsMap((m) => ({ ...m, [key]: toList(qs) }));
    return;
  } catch {
    try {
      const qs2 = await getDocs(
        query(
          productsRef,
          where("isActive", "==", true),
          orderBy("createdAt", "desc"),
          limit(fetchLimit)
        )
      );

      setItemsMap((m) => ({ ...m, [key]: toList(qs2) }));
      return;
    } catch {
      const qs3 = await getDocs(
        query(productsRef, where("isActive", "==", true), limit(fetchLimit))
      );

      setItemsMap((m) => ({ ...m, [key]: toList(qs3) }));
      return;
    }
  }
}
        if (section === "new") {
          try {
            const qs1 = await getDocs(
              query(
                productsRef,
                where("isActive", "==", true),
                where("homeSections", "array-contains", "new"),
                limit(take)
              )
            );
            const list1 = toList(qs1);
            if (list1.length) {
              setItemsMap((m) => ({ ...m, [key]: list1 }));
              return;
            }
          } catch {
            //
          }

          try {
            const qs2 = await getDocs(
              query(
                productsRef,
                where("isActive", "==", true),
                orderBy("createdAt", "desc"),
                limit(take)
              )
            );
            setItemsMap((m) => ({ ...m, [key]: toList(qs2) }));
            return;
          } catch {
            const qs3 = await getDocs(
              query(productsRef, where("isActive", "==", true), limit(take))
            );
            setItemsMap((m) => ({ ...m, [key]: toList(qs3) }));
            return;
          }
        }

        const qs = await getDocs(
          query(
            productsRef,
            where("isActive", "==", true),
            where("homeSections", "array-contains", section),
            limit(take)
          )
        );

        setItemsMap((m) => ({ ...m, [key]: toList(qs) }));
      } catch (e) {
        console.error("popular fetch error:", e);
        setItemsMap((m) => ({ ...m, [key]: [] }));
      } finally {
        setBusyKey((prev) => (prev === key ? "" : prev));
      }
    },
    [db, itemsMap, tabsToShow]
  );

  useEffect(() => {
    if (!activeKey) return;
    fetchForTab(activeKey);
  }, [activeKey, fetchForTab]);

  const catsUi: CatUI[] = useMemo(() => {
    return (cats ?? [])
      .map((c: any) => ({
        id: s(c?.id),
        name:
          s(pickText(c?.name, loc)) ||
          s(c?.name?.tr) ||
          s(c?.name?.en) ||
          s(c?.title?.tr) ||
          s(c?.title?.en) ||
          s(c?.slug),
        slug: s(c?.slug),
        image: c?.image ? s(c.image) : undefined,
        order: typeof c?.order === "number" ? c.order : undefined,
      }))
      .filter((c) => c.id && c.name && c.slug);
  }, [cats, loc]);

  const trustBadges = useMemo(() => asArray<any>((home as any)?.trustBadges), [home]);
  const luxuryServices = (home as any)?.luxuryServices ?? null;
  const giftGuide = (home as any)?.giftGuide ?? null;
  const educationHub = (home as any)?.educationHub ?? null;
  const customerPromiseBand = (home as any)?.customerPromiseBand ?? null;
  const conciergeCta = (home as any)?.conciergeCta ?? null;
  const socialSection = (home as any)?.socialSection ?? null;
  const testimonials = (home as any)?.testimonials ?? null;
  const campaignCountdown = (home as any)?.campaignCountdown ?? null;
  const newsletterCfg = (home as any)?.newsletter ?? null;
  const budgetShoppingCfg = (home as any)?.budgetShopping ?? null;

  const activeItems = useMemo(() => itemsMap[s(activeKey)] ?? [], [itemsMap, activeKey]);
  const popularBusy = useMemo(
    () => busyKey === s(activeKey) && !activeItems.length,
    [busyKey, activeKey, activeItems.length]
  );

  const normalizedSectionOrder = useMemo(() => {
    const aliasMap: Record<string, string> = {
      announcementBar: "announcement",
      selectedProductsShowcase: "selectedProducts",
      luxuryServicesStrip: "luxuryServices",
      featuredCategoriesV2: "featuredCategories",
      giftGuideShowcase: "giftGuide",
    };

    return sectionOrder.map((key) => aliasMap[key] || key).filter(Boolean);
  }, [sectionOrder]);

  const rawSectionVisibility = useMemo(() => {
    const raw =
      (home as any)?.section_visibility &&
      typeof (home as any).section_visibility === "object"
        ? (home as any).section_visibility
        : {};

    const aliasMap: Record<string, string> = {
      announcementBar: "announcement",
      selectedProductsShowcase: "selectedProducts",
      luxuryServicesStrip: "luxuryServices",
      featuredCategoriesV2: "featuredCategories",
      giftGuideShowcase: "giftGuide",
    };

    const normalized: Record<string, boolean> = {};

    Object.keys(raw).forEach((key) => {
      const mappedKey = aliasMap[key] || key;
      normalized[mappedKey] = typeof raw[key] === "boolean" ? raw[key] : true;
    });

    return normalized;
  }, [home]);

  const defaultSectionOrder = useMemo(
    () => [
      "announcement",
      "premiumMarquee",
      "heroSlider",
      "heroMosaic",
      "marketHighlights",
      "selectedProducts",
      "mobileApp",
      "campaignCountdown",
      "budgetShopping",
      "customerPromiseBand",
      "luxuryServices",
      "corporateSolutions",
      "promoDealSlider",
      "giftGuide",
      "popularProducts",
      "trustBadgesTop",
      "ctaBox",
      "testimonials",
      "newsletter",
      "socialSection",
      "educationHub",
      "recentlyViewed",
      "trustBadgesBottom",
      "conciergeCta",
      "featuredCategories",
      "premiumTrustStrip",
    ],
    []
  );

  const finalSectionOrder = useMemo(() => {
    const base = normalizedSectionOrder.length
      ? normalizedSectionOrder
      : defaultSectionOrder;

    const merged = [...base, ...defaultSectionOrder.filter((key) => !base.includes(key))];
    const lead = ["announcement", "premiumMarquee", "editorialHero"];
    return [...lead, ...merged.filter((key) => !lead.includes(key))];
  }, [normalizedSectionOrder, defaultSectionOrder]);

  const visibleSectionOrder = useMemo(() => {
    return finalSectionOrder.filter((key) => {
      const visible = rawSectionVisibility[key];
      return typeof visible === "boolean" ? visible : true;
    });
  }, [finalSectionOrder, rawSectionVisibility]);

  const sectionMap: Record<string, React.ReactNode> = {
    editorialHero: <HomeEditorialHero />,
    announcement: <AnnouncementBar data={(home as any)?.announcement ?? null} />,
    premiumMarquee: <PremiumMarquee config={(home as any)?.premiumMarquee} />,
    heroSlider: <HeroSlider promoBanners={(home as any)?.promoBanners} />,
    heroMosaic: <HeroMosaic />,
    selectedProducts: <SelectedProductsShowcase />,
    mobileApp: <MobileAppInline />,

    customerPromiseBand:
      customerPromiseBand?.enabled && (customerPromiseBand?.items?.length ?? 0) > 0 ? (
        <CustomerPromiseBand items={customerPromiseBand.items} />
      ) : null,

    luxuryServices:
      luxuryServices?.enabled && (luxuryServices?.items?.length ?? 0) > 0 ? (
        <LuxuryServicesStrip items={luxuryServices.items} />
      ) : null,

    corporateSolutions: <CorporateSolutions loc={loc} />,

    promoDealSlider: <PromoDealSlider slides={(home as any)?.promoDealSlides} />,

    giftGuide: giftGuide?.enabled ? <GiftGuideShowcase data={giftGuide} /> : null,

    popularProducts: (
      <PopularProductsStrip
        loc={loc}
        title={t("popular_title")}
        desc={
          loc === "en"
            ? "Discover featured pieces, bestsellers and fresh arrivals chosen for a premium shopping experience."
            : "Öne çıkan ürünleri, çok satanları ve yeni gelenleri premium alışveriş deneyimi için tek alanda keşfet."
        }
        eyebrow={loc === "en" ? "Curated Selection" : "Seçili Koleksiyon"}
        tabs={tabsToShow}
        activeKey={activeKey}
        onChangeTab={setActiveKey}
        items={activeItems as any}
        loading={popularBusy}
      />
    ),

    trustBadgesTop: (
      <section className={`px-container ${styles.sectionTight}`}>
        <TrustBadges items={trustBadges} />
      </section>
    ),

    ctaBox: (
      <section className={`px-container ${styles.sectionWide}`}>
        <div className={styles.ctaBox}>
          <div className={styles.ctaContent}>
            <h3 className={styles.ctaTitle}>
              {loc === "en"
                ? "Want a more personal shopping experience?"
                : "Daha kişisel bir alışveriş deneyimi ister misin?"}
            </h3>

            <p className={styles.ctaText}>
              {loc === "en"
                ? "Book an appointment, find the store or contact us directly on WhatsApp for quick product guidance and premium support."
                : "Randevu al, mağazayı kolayca bul ya da WhatsApp üzerinden hızlı ürün danışmanlığı al. Premium hizmet, net bilgi, güvenli deneyim."}
            </p>
          </div>

          <div className={styles.ctaActions}>
            <Link className={styles.ctaBtn} href="/hesabim">
              {loc === "en" ? "Appointment / Account" : "Randevu / Hesabım"}
            </Link>

            <Link className={styles.ctaBtnGhost} href="/iletisim">
              {loc === "en" ? "Find Store" : "Mağazayı Bul"}
            </Link>

            <a
              className={styles.ctaBtnGhost}
              href="https://wa.me/90XXXXXXXXXX"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>
    ),

    educationHub:
      educationHub?.enabled && (educationHub?.items?.length ?? 0) > 0 ? (
        <LifestyleEducationHub
          items={educationHub.items}
          loc={loc}
          kicker={loc === "en" ? "Educational Content" : "Bilgilendirici İçerikler"}
          title={loc === "en" ? "Build trust before the sale" : "Satıştan önce güven ver"}
          allLabel={loc === "en" ? "All guides →" : "Tüm rehberler →"}
          allHref=""
        />
      ) : null,

    trustBadgesBottom: (
      <section className="px-container" style={{ padding: "0 18px 70px" }}>
        <TrustBadges items={trustBadges} />
      </section>
    ),

    conciergeCta: conciergeCta?.enabled ? (
      <section className={`px-container ${styles.sectionWide}`}>
        <ConciergeCtaBlock
          data={conciergeCta}
          loc={loc}
          kicker={loc === "en" ? "Personal Concierge" : "Kişisel Danışmanlık"}
        />
      </section>
    ) : null,

    featuredCategories: <FeaturedCategoriesSliderV2 items={catsUi} />,
    premiumTrustStrip: <PremiumTrustStrip />,

    marketHighlights: <MarketHighlights />,

    socialSection: <HomeSocialSection loc={loc} cfg={socialSection} />,

    recentlyViewed: <RecentlyViewed />,

    testimonials: (
      <CustomerTestimonials loc={loc} cfg={testimonials} />
    ),

    campaignCountdown: (
      <CampaignCountdown loc={loc} cfg={campaignCountdown} />
    ),

    newsletter: <NewsletterStrip cfg={newsletterCfg} />,

    budgetShopping: <BudgetShopping cfg={budgetShoppingCfg} />,
  };

  if (loading) {
    return (
      <main className={`px-container ${styles.page}`} style={{ padding: 18 }}>
        <div className={styles.loadingBox}>{t("loading")}</div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {visibleSectionOrder.map((key) => {
        const node = sectionMap[key];
        if (!node) return null;
        return <div key={key} className={styles.sectionSlot} data-home-section={key}>{node}</div>;
      })}
    </main>
  );
}
