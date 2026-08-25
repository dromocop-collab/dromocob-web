"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackMetaPageView } from "@/lib/metaPixel";

/**
 * SPA route değişikliklerinde Meta Pixel PageView event'i gönderir.
 * İlk PageView layout.tsx'deki Script tag'ı ile zaten tetikleniyor,
 * bu component sadece sonraki route geçişlerini takip eder.
 */
export default function MetaPixelRouteEvents() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRef = useRef(true);

  useEffect(() => {
    // İlk render'da PageView zaten Script tag ile tetiklenmiş oluyor, atla
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }

    // Route değiştiğinde yeni PageView gönder
    // fbq yüklenmemiş olabilir, biraz bekle
    const timer = window.setTimeout(() => {
      trackMetaPageView();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [pathname, searchParams]);

  return null;
}