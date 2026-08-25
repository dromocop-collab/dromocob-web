"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import { getLocale, type Locale } from "@/lib/i18n";
import s from "./pagesPublic.module.css";
import BlockRenderer from "@/components/pages/blocks/BlockRenderer";
type LocaleText = { tr?: string; en?: string };

type PageDoc = {
  title?: LocaleText;
  contentHtml?: LocaleText; // legacy
  blocks?: any[];   
  group?: string;
  slug?: string;
  isPublished?: boolean;
};

function pickLT(loc: Locale, v?: LocaleText, fallback = "") {
  const t = loc === "en" ? String(v?.en ?? "") : String(v?.tr ?? "");
  return t.trim() || String(fallback || "");
}

function normalize(data: any): PageDoc {
  const raw = data?.pageDoc && typeof data.pageDoc === "object" ? data.pageDoc : data;
  return {
    title: raw?.title,
    contentHtml: raw?.contentHtml,
    blocks: Array.isArray(raw?.blocks) ? raw.blocks : [],
    group: String(raw?.group || "").trim(),
    slug: String(raw?.slug || "").trim(),
    isPublished: raw?.isPublished !== false,
  };
}

/** Mini sanitize */
function safeHtml(html: string) {
  let out = String(html || "");
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  out = out.replace(/\son\w+="[^"]*"/gi, "");
  out = out.replace(/\son\w+='[^']*'/gi, "");
  out = out.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');
  out = out.replace(/src\s*=\s*["']\s*javascript:[^"']*["']/gi, 'src=""');
  return out;
}

function cleanSeg(x: string) {
  // url segment temizliği (çok sert değil)
  return String(x || "").trim().replace(/[^\w-]/g, "");
}

export default function PagePublicClient({ params }: { params: { group: string; slug: string } }) {
  const db = useMemo(() => getFirebaseDb(), []);

  const [loc, setLoc] = useState<Locale>("tr");
  const [allowedGroups, setAllowedGroups] = useState<string[] | null>(null);

  const [docData, setDocData] = useState<PageDoc | null>(null);
  const [exists, setExists] = useState(true);

  // locale listen
  useEffect(() => {
    setLoc(getLocale());
    const handler = (e: Event) => setLoc(((e as any)?.detail as Locale) || "tr");
    window.addEventListener("locale-changed", handler as any);
    return () => window.removeEventListener("locale-changed", handler as any);
  }, []);

  // ✅ 1) home_settings -> blockLibrary.groups oku (dinamik group listesi)
  useEffect(() => {
    const ref = doc(db, "site_options", "home_settings");
    return onSnapshot(
      ref,
      (snap) => {
        const d: any = snap.data() || {};
        const list = Array.isArray(d?.blockLibrary?.groups) ? d.blockLibrary.groups : [];
        const ids = list
          .filter((g: any) => g && g.isActive !== false)
          .map((g: any) => String(g?.id || "").trim())
          .filter(Boolean);
        setAllowedGroups(ids.length ? ids : []);
      },
      () => setAllowedGroups([])
    );
  }, [db]);

  // ✅ 2) pages/{group-slug} oku
  useEffect(() => {
    const group = cleanSeg(params.group);
    const slug = cleanSeg(params.slug);

    if (!group || !slug) {
      setExists(false);
      setDocData(null);
      return;
    }

    // allowedGroups null iken (yükleniyor) sayfayı hemen 404 yapmayalım
    if (allowedGroups && !allowedGroups.includes(group)) {
      setExists(false);
      setDocData(null);
      return;
    }

    const id = `${group}-${slug}`;
    const ref = doc(db, "pages", id);

    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setExists(false);
          setDocData(null);
          return;
        }
        setExists(true);
        setDocData(normalize(snap.data()));
      },
      () => {
        setExists(false);
        setDocData(null);
      }
    );
  }, [db, params.group, params.slug, allowedGroups]);

  const published = docData?.isPublished !== false;

  // loc’a göre render (subscribe tekrar yok)
  const _title = pickLT(loc, docData?.title, params.slug); // eslint-disable-line @typescript-eslint/no-unused-vars
  const html = safeHtml(pickLT(loc, docData?.contentHtml, ""));

  // groups yükleniyorsa mini loading
  if (allowedGroups === null) {
    return (
      <main className={s.page}>
        <div className={s.card}>
          <h1 className={s.h1}>{loc === "en" ? "Loading…" : "Yükleniyor…"}</h1>
          <p className={s.p}>{loc === "en" ? "Please wait." : "Bir saniye…"} </p>
        </div>
      </main>
    );
  }

  if (!exists || !published) {
    return (
      <main className={s.page}>
        <div className={s.card}>
          <h1 className={s.h1}>{loc === "en" ? "Page not found" : "Sayfa bulunamadı"}</h1>
          <p className={s.p}>{loc === "en" ? "Not published or wrong URL." : "Yayınlı değil ya da URL hatalı."}</p>
        </div>
      </main>
    );
  }
  const blocks = Array.isArray(docData?.blocks) ? docData!.blocks! : [];
  const hasBlocks = blocks.length > 0;
  return (
    <main className={s.page}>
      <div className={s.card}>
       
  
        {hasBlocks ? (
       <BlockRenderer blocks={blocks} loc={loc as any} />
        ) : (
          <div className={s.html} dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </main>
  );
}