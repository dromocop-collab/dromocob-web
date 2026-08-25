"use client";

import { useEffect, useCallback, useRef } from "react";
import { getCart } from "@/lib/cart";

/**
 * Sepette ürün varken sayfayı kapatmaya çalışan kullanıcıya uyarı gösterir.
 * beforeunload event'i kullanır — sadece sepet doluysa aktif olur.
 */
export default function CartAbandonGuard() {
  const hasItems = useRef(false);

  const checkCart = useCallback(() => {
    try {
      const cart = getCart();
      hasItems.current = Array.isArray(cart) && cart.length > 0;
    } catch {
      hasItems.current = false;
    }
  }, []);

  useEffect(() => {
    // İlk kontrol
    checkCart();

    // Sepet değişince tekrar kontrol
    const onStorage = (e: StorageEvent) => {
      if (e.key === "nci_cart_v1" || e.key === null) {
        checkCart();
      }
    };

    const onCartUpdate = () => checkCart();

    window.addEventListener("storage", onStorage);
    window.addEventListener("nci:cart-updated", onCartUpdate);

    // beforeunload handler
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasItems.current) return;

      // Checkout veya ödeme sayfasındaysa uyarma
      const path = window.location.pathname;
      if (path.startsWith("/pay/") || path.startsWith("/checkout")) return;

      e.preventDefault();
      // Modern browsers ignore custom messages, but this triggers the prompt
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    // Periyodik cart kontrolü (add/remove sonrası güncel kalması için)
    const interval = setInterval(checkCart, 5000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nci:cart-updated", onCartUpdate);
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearInterval(interval);
    };
  }, [checkCart]);

  return null; // UI render etmez
}
