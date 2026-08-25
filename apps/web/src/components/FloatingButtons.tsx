"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getWhatsAppNumber, onWhatsAppNumberChange, buildWhatsAppUrl } from "@/lib/whatsapp";

const STORAGE_KEY = "nci_recently_viewed_v1";

function getProductWaMessage(): string | null {
  try {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (!path.startsWith("/products/")) return null;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const items = JSON.parse(raw);
    if (!Array.isArray(items) || !items.length) return null;

    const product = items[0];
    if (!product?.title) return null;

    const parts = [
      `Merhaba, bu urun hakkinda bilgi almak istiyorum:`,
      `Urun: ${product.title}`,
    ];

    if (product.priceTry && product.priceTry > 0) {
      try {
        const price = new Intl.NumberFormat("tr-TR", {
          style: "currency",
          currency: "TRY",
          maximumFractionDigits: 2,
        }).format(product.priceTry);
        parts.push(`Fiyat: ${price}`);
      } catch {
        /* skip */
      }
    }

    const slug = product.slug || product.id || "";
    if (slug) {
      parts.push(`Link: https://demo.dromocob.com/products/${encodeURIComponent(slug)}`);
    }

    return parts.join("\n");
  } catch {
    return null;
  }
}


export default function FloatingButtons() {
  const [showTop, setShowTop] = useState(false);
  const [waNumber, setWaNumber] = useState(getWhatsAppNumber);
  const pathname = usePathname();

  useEffect(() => {
    return onWhatsAppNumberChange(setWaNumber);
  }, []);

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 600);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const buildWaHref = useCallback(() => {
    const productMsg = getProductWaMessage();
    const msg = productMsg || "Merhaba, ürünleriniz hakkında bilgi almak istiyorum.";
    return buildWhatsAppUrl(msg, waNumber);
  }, [pathname, waNumber]); // pathname veya numara değişince yeniden hesapla

  return (
    <>
      {/* WhatsApp Floating Button — sol alt */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          window.open(buildWaHref(), "_blank", "noopener,noreferrer");
        }}
        aria-label="WhatsApp ile iletişim"
        style={{
          position: "fixed",
          bottom: 90,
          left: 20,
          zIndex: 9988,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#25D366",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            "0 4px 14px rgba(37,211,102,.45), 0 2px 6px rgba(0,0,0,.12)",
          transition: "transform .2s ease, box-shadow .2s ease",
          cursor: "pointer",
          textDecoration: "none",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 6px 20px rgba(37,211,102,.55), 0 4px 10px rgba(0,0,0,.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 4px 14px rgba(37,211,102,.45), 0 2px 6px rgba(0,0,0,.12)";
        }}
      >
        <svg
          viewBox="0 0 32 32"
          width={30}
          height={30}
          fill="white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16.004 2.002c-7.732 0-14.002 6.27-14.002 13.998 0 2.47.654 4.876 1.896 6.994L2 30l7.193-1.856A13.946 13.946 0 0 0 16.004 30c7.732 0 14.002-6.27 14.002-13.998S23.736 2.002 16.004 2.002Zm0 25.596a11.574 11.574 0 0 1-5.906-1.618l-.424-.252-4.388 1.13 1.168-4.256-.276-.44a11.56 11.56 0 0 1-1.778-6.16c0-6.412 5.218-11.63 11.63-11.63 6.412 0 11.63 5.218 11.63 11.63 0 6.412-5.218 11.596-11.656 11.596Zm6.372-8.694c-.35-.174-2.07-1.022-2.39-1.138-.32-.116-.554-.174-.786.174-.232.35-.904 1.138-1.108 1.37-.204.232-.408.262-.758.088-.35-.174-1.476-.544-2.812-1.734-1.04-.926-1.742-2.07-1.946-2.42-.204-.35-.022-.54.154-.714.158-.156.35-.408.524-.612.174-.204.232-.35.35-.582.116-.232.058-.436-.03-.61-.088-.174-.786-1.896-1.078-2.596-.284-.682-.572-.59-.786-.6l-.67-.012c-.232 0-.61.088-.928.436-.32.35-1.22 1.196-1.22 2.916s1.25 3.38 1.424 3.612c.174.232 2.458 3.756 5.956 5.266.832.36 1.482.574 1.99.736.836.266 1.596.228 2.198.138.67-.1 2.07-.846 2.36-1.664.292-.818.292-1.518.204-1.664-.088-.146-.32-.232-.67-.408Z" />
        </svg>
      </a>

      {/* Scroll to Top Button — sol alt */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Yukarı kaydır"
        style={{
          position: "fixed",
          bottom: 24,
          left: 20,
          zIndex: 9988,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(30,30,30,.82)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 10px rgba(0,0,0,.25)",
          transition: "opacity .3s ease, transform .3s ease",
          opacity: showTop ? 1 : 0,
          pointerEvents: showTop ? "auto" : "none",
          transform: showTop ? "translateY(0)" : "translateY(12px)",
        }}
      >
        <svg
          width={20}
          height={20}
          viewBox="0 0 20 20"
          fill="none"
          stroke="white"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 12 10 7 5 12" />
        </svg>
      </button>
    </>
  );
}
