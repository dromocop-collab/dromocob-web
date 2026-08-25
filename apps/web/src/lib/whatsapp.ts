/**
 * Merkezi WhatsApp numarası yönetimi.
 *
 * Tüm frontend componentleri bu modülü kullanarak WA numarasını alır.
 * Admin panelindeki settings/site → site.contact.whatsapp alanından
 * güncellenen numara, Firestore listener ile gerçek zamanlı yansır.
 *
 * Firestore'dan yüklenene kadar DEFAULT_WA_NUMBER kullanılır (fallback).
 */

import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";

/** Firestore henüz yüklenmediyse kullanılacak varsayılan numara */
const DEFAULT_WA_NUMBER = "905078482448";

/** Hafızada tutulan güncel numara */
let _currentNumber = DEFAULT_WA_NUMBER;

/** Listener kayıtlı mı? */
let _listening = false;

/** Değişiklik dinleyicileri */
const _listeners = new Set<(num: string) => void>();

/**
 * Firestore'dan WhatsApp numarasını dinlemeye başlar.
 * Birden fazla çağrılsa bile sadece 1 listener açar.
 */
function ensureListener() {
  if (_listening) return;
  _listening = true;

  try {
    const db = getFirebaseDb();
    const ref = doc(db, "settings", "site");

    onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as any;
        const wa = String(
          data?.site?.contact?.whatsapp || ""
        ).trim();

        if (wa && wa !== _currentNumber) {
          _currentNumber = wa;
          _listeners.forEach((cb) => cb(_currentNumber));
        }
      },
      () => {
        // Okuma başarısız — fallback'te kal
      }
    );
  } catch {
    // Firebase client hazır değilse fallback'te kal
  }
}

/**
 * Güncel WhatsApp numarasını döndürür.
 * İlk çağrıda Firestore listener'ı otomatik başlatır.
 */
export function getWhatsAppNumber(): string {
  if (typeof window !== "undefined") {
    ensureListener();
  }
  return _currentNumber;
}

/**
 * WhatsApp numarası değiştiğinde çağrılacak callback kaydet.
 * Unmount'ta unsubscribe fonksiyonunu çağır.
 */
export function onWhatsAppNumberChange(
  cb: (num: string) => void
): () => void {
  _listeners.add(cb);
  if (typeof window !== "undefined") {
    ensureListener();
  }
  return () => {
    _listeners.delete(cb);
  };
}

/**
 * wa.me linki oluşturur.
 */
export function buildWhatsAppUrl(
  message?: string,
  number?: string
): string {
  const num = number || getWhatsAppNumber();
  const msg = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${num}${msg}`;
}
