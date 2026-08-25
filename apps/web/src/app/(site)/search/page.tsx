"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  limit,
  query,
} from "firebase/firestore";
import { Search, Sparkles, PackageSearch } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase.client";
import { listenRatesLatest } from "@/lib/firestore";
import { resolveProductPriceTRY, type RatesLatest } from "@/lib/pricing";
import s from "./searchPage.module.css";

type Product = {
  id: string;
  title?: string;
  slug?: string;
  sku?: string;
  price?: number;
  finalPrice?: number;
  currency?: string;
  images?: string[];
  isActive?: boolean;
  raw?: any;
};

function clampQ(v: string) {
  return String(v || "").trim().toLowerCase().slice(0, 80);
}

function isHttpUrl(v: string) {
  return /^https?:\/\//i.test(String(v || "").trim());
}

function moneyTR(v?: number, cur = "₺") {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return `${n.toLocaleString("tr-TR")} ${cur}`;
}



function pickImage(images?: string[]) {
  const raw = Array.isArray(images) ? String(images[0] || "").trim() : "";
  if (raw && isHttpUrl(raw)) return raw;
  return "/pixio/assets/images/no-image.png";
}

function pickTitle(x: any) {
  if (typeof x?.title === "string") return x.title;
  if (typeof x?.name === "string") return x.name;

  if (x?.title && typeof x.title === "object") {
    return String(x.title.tr || x.title.en || "");
  }

  if (x?.name && typeof x.name === "object") {
    return String(x.name.tr || x.name.en || "");
  }

  return "";
}

export default function SearchPage() {
  const [qText, setQText] = useState("");
  const [qRun, setQRun] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
const [rates, setRates] = useState<RatesLatest | null>(null);
  const qNorm = useMemo(() => clampQ(qText), [qText]);
useEffect(() => {
  const unsub = listenRatesLatest(setRates);
  return () => unsub();
}, []);
  useEffect(() => {
    const t = window.setTimeout(() => setQRun(qNorm), 320);
    return () => window.clearTimeout(t);
  }, [qNorm]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setMsg(null);
      setItems([]);

      if (!qRun) {
        setHasSearched(false);
        return;
      }

      setBusy(true);
      setHasSearched(true);

      try {
        const db = getFirebaseDb();
        const col = collection(db, "products");

        // titleLower bağımlılığını kaldırıyoruz
        const qq = query(col, limit(300));
        const snap = await getDocs(qq);

        if (!alive) return;

        const all: Product[] = snap.docs.map((d) => {
          const x: any = d.data();

          return {
            id: d.id,
            title: pickTitle(x),
            slug: String(x.slug || d.id),
            sku: String(x.sku || ""),
            finalPrice:
              typeof x.finalPrice === "number"
                ? x.finalPrice
                : Number(x.finalPrice || 0),
            price:
              typeof x.price === "number"
                ? x.price
                : Number(x.price || 0),
            currency: String(x.currency || "TRY"),
            images: Array.isArray(x.images)
              ? x.images
              : x.image
              ? [x.image]
              : [],
            isActive: x.isActive !== false,
            raw: x,
          };
        });

        const filtered = all
          .filter((x) => x.isActive !== false)
          .filter((x) => {
            const hay = [
              x.title || "",
              x.slug || "",
              x.sku || "",
              x.id || "",
            ]
              .join(" ")
              .toLowerCase();

            return hay.includes(qRun);
          })
          .slice(0, 24);

        setItems(filtered);

        if (!filtered.length) {
          setMsg("Aradığın kelimeyle eşleşen ürün bulunamadı.");
        }
      } catch (e: any) {
        if (!alive) return;
        setMsg(String(e?.message || "Arama başarısız"));
      } finally {
        if (!alive) return;
        setBusy(false);
      }
      
    })();

    return () => {
      alive = false;
    };
  }, [qRun]);

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <div className={s.heroBadge}>
          <Sparkles size={16} />
          <span>Akıllı Arama</span>
        </div>

        <h1 className={s.title}>Ara</h1>
        <p className={s.sub}>
          Ürün adı, bileklik, yüzük, kolye ya da slug ile hızlıca arama yap.
        </p>

        <div className={s.searchShell}>
          <div className={s.searchBox}>
            <Search size={20} className={s.searchIcon} />
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Örn: bileklik, yüzük, kolye..."
              className={s.input}
            />
          </div>

          <button
            type="button"
            onClick={() => setQRun(qNorm)}
            className={s.searchBtn}
            disabled={busy}
          >
            {busy ? "Aranıyor..." : "Ara"}
          </button>
        </div>

        <div className={s.quickInfo}>
          <span className={s.quickPill}>
            {busy ? "Sorgu çalışıyor" : "Canlı ürün taraması"}
          </span>
          <span className={s.quickPill}>
            {hasSearched ? `${items.length} sonuç` : "Hazır"}
          </span>
        </div>
      </section>

      {busy ? <div className={s.stateBox}>Ürünler aranıyor...</div> : null}
      {!busy && msg ? <div className={s.stateBox}>{msg}</div> : null}

      {!busy && hasSearched && !items.length && !msg ? (
        <div className={s.emptyBox}>
          <PackageSearch size={28} />
          <div>
            <strong>Sonuç bulunamadı</strong>
            <p>Daha kısa ya da farklı bir kelime deneyebilirsin.</p>
          </div>
        </div>
      ) : null}

      {!!items.length && (
        <section className={s.resultsWrap}>
          <div className={s.resultsHead}>
            <h2 className={s.resultsTitle}>Sonuçlar</h2>
            <div className={s.resultsMeta}>{items.length} ürün listelendi</div>
          </div>

          <div className={s.grid}>
         {items.map((p) => {
  const resolved = resolveProductPriceTRY(p.raw, rates);

  const fallbackPrice =
    typeof p.finalPrice === "number" && p.finalPrice > 0
      ? p.finalPrice
      : typeof p.price === "number" && p.price > 0
      ? p.price
      : 0;

  const finalShownPrice =
    resolved?.price && resolved.price > 0 ? resolved.price : fallbackPrice;

  const imgSrc = pickImage(p.images);

 

  return (
    <Link
      key={p.id}
      href={`/products/${encodeURIComponent(p.slug || p.id)}`}
      className={s.card}
    >
      <div className={s.cardMedia}>
        <img
          src={imgSrc}
          alt={p.title || "Ürün"}
          className={s.cardImage}
        />
      </div>

      <div className={s.cardBody}>
        <div className={s.cardTop}>
          <h3 className={s.cardTitle}>{p.title || "Ürün"}</h3>
        </div>

        <div className={s.cardMeta}>
          <span className={s.cardSlug}>{p.slug || p.id}</span>
           {p.sku ? (
    <span className={s.cardSku}>
      <span className={s.cardSkuLabel}>SKU</span>
      <span className={s.cardSkuValue}>{p.sku}</span>
    </span>
    ) : null}
        </div>

        <div className={s.priceRow}>
          <span className={s.priceLabel}>Fiyat</span>
          <strong className={s.priceValue}>
            {finalShownPrice > 0 ? moneyTR(finalShownPrice, "₺") : "Fiyat yok"}
          </strong>
        </div>
      </div>
    </Link>
  );
})}
          </div>
        </section>
      )}
    </main>
  );
}