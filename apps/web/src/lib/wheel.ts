"use client";

import {
  collection,
  getDocs,
  limit,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import type {
  WheelCampaignDoc,
  WheelRewardDoc,
  WheelRewardType,
} from "@/types/wheel";

function toMs(v: unknown): number {
  try {
    if (!v) return 0;
    if (typeof (v as { toMillis?: () => number })?.toMillis === "function") {
      return (v as { toMillis: () => number }).toMillis();
    }
    if (v instanceof Timestamp) return v.toMillis();
    if (typeof v === "number") return v;

    const parsed = Date.parse(String(v));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function safeStr(v: unknown, fallback = ""): string {
  const x = String(v ?? "").trim();
  return x || fallback;
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function storageKey(prefix: string, campaignId: string, uid?: string | null) {
  return `wheel:${prefix}:${campaignId}:${uid || "guest"}`;
}

export function getWheelDeviceId(): string {
  const key = "wheel:device:v1";
  try {
    const current = localStorage.getItem(key)?.trim();
    if (current) return current;

    const next = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(key, next);
    return next;
  } catch {
    return `web-session-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

function normalizeCampaign(id: string, x: any): WheelCampaignDoc {
  return {
    id,
    title: safeStr(x?.title),
    slug: safeStr(x?.slug),
    description: safeStr(x?.description),
    heroTitle: safeStr(x?.heroTitle),
    heroText: safeStr(x?.heroText),
    buttonLabel: safeStr(x?.ui?.buttonLabel || x?.buttonLabel, "Çevir ve Kazan"),

    popupEnabled: x?.popupEnabled !== false,
    isActive: x?.isActive === true,
    published: x?.published === true,
    status: safeStr(x?.status, "draft"),

    startsAt: x?.startsAt || null,
    endsAt: x?.endsAt || null,

    requireConsent: x?.rules?.requireConsent ?? x?.requireConsent ?? true,
    requirePhone: x?.rules?.requirePhone ?? x?.requirePhone ?? true,
    requireEmail: x?.rules?.requireEmail ?? x?.requireEmail ?? true,
    requireLogin: x?.rules?.requireLogin ?? x?.requireLogin ?? false,

    maxSpinsPerUser: safeNum(x?.maxSpinsPerUser, 1),
    cooldownHours: safeNum(x?.cooldownHours, 720),

    ui: x?.ui && typeof x.ui === "object" ? x.ui : {},
    rules: x?.rules && typeof x.rules === "object" ? x.rules : {},
    wheelTheme: x?.wheelTheme && typeof x.wheelTheme === "object" ? x.wheelTheme : {},
  };
}

function normalizeRewardType(v: unknown): WheelRewardType {
  const x = safeStr(v);

  if (
    x === "percent" ||
    x === "fixed" ||
    x === "free_shipping" ||
    x === "gift" ||
    x === "teaser"
  ) {
    return x;
  }

  return "fixed";
}

function normalizeReward(id: string, x: any): WheelRewardDoc {
  return {
    id,
    campaignId: safeStr(x?.campaignId),
    label: safeStr(x?.label),
    rewardType: normalizeRewardType(x?.rewardType),
    value: safeNum(x?.value, 0),
    probabilityWeight: safeNum(x?.probabilityWeight, 0),

    isActive: x?.isActive !== false,
    isVisibleOnWheel: x?.isVisibleOnWheel !== false,
    isWinnable: x?.isWinnable !== false,

    color: safeStr(x?.color),
    sortOrder: safeNum(x?.sortOrder, 0),

    couponPrefix: safeStr(x?.couponPrefix, "WHEEL"),
    couponDurationDays: safeNum(x?.couponDurationDays, 7),
    singleUse: x?.singleUse !== false,
    minCartAmount: safeNum(x?.minCartAmount, 0),

    createdAt: x?.createdAt || null,
    updatedAt: x?.updatedAt || null,
  };
}

function isCampaignTimeActive(data: any) {
  const now = Date.now();
  const startsAtMs = toMs(data?.startsAt);
  let endsAtMs = toMs(data?.endsAt);

  if (startsAtMs && now < startsAtMs) return false;

  // Eski oluşturma ekranı başlangıç ve bitişi aynı 00:00 anına yazıyordu.
  // Bu kayıtları "anında süresi dolmuş" saymak yerine açık uçlu kabul et.
  if (startsAtMs && endsAtMs === startsAtMs) endsAtMs = 0;

  // Saat seçilmeden yalnızca gün girilmiş eski kayıtlar o günün sonunda biter.
  if (endsAtMs) {
    const endDate = new Date(endsAtMs);
    const isMidnight =
      endDate.getHours() === 0 &&
      endDate.getMinutes() === 0 &&
      endDate.getSeconds() === 0 &&
      endDate.getMilliseconds() === 0;
    if (isMidnight) endsAtMs += 24 * 60 * 60 * 1000 - 1;
  }

  if (endsAtMs && now > endsAtMs) return false;

  return true;
}

export async function getActiveWheelCampaign(): Promise<WheelCampaignDoc | null> {
  try {
    const db = getFirebaseDb();

    // Tek alanlı sorgu, yeni ortamlarda eksik composite index yüzünden popup'ın
    // tamamen kaybolmasını önler. Diğer yayın koşulları istemci tarafında da
    // kesin olarak doğrulanır.
    const qy = query(
      collection(db, "wheel_campaigns"),
      where("published", "==", true),
      limit(20)
    );

    const snap = await getDocs(qy);
    if (snap.empty) return null;

    const activeDoc = snap.docs.find((item) => {
      const data = item.data();
      return (
        data?.popupEnabled !== false &&
        data?.isActive === true &&
        safeStr(data?.status) === "active" &&
        isCampaignTimeActive(data)
      );
    });

    return activeDoc ? normalizeCampaign(activeDoc.id, activeDoc.data()) : null;
  } catch (error) {
    console.error("getActiveWheelCampaign error:", error);
    return null;
  }
}

export async function getWheelRewardsForCampaign(
  campaignId: string
): Promise<WheelRewardDoc[]> {
  try {
    if (!campaignId) return [];

    const response = await fetch(
      `/api/wheel/campaigns/${encodeURIComponent(campaignId)}/rewards`,
      { cache: "no-store" }
    );
    if (response.ok) {
      const payload = await response.json();
      const publicRewards = Array.isArray(payload?.rewards) ? payload.rewards : [];
      return publicRewards
        .map((item: any) => normalizeReward(String(item?.id || ""), item))
        .filter((item: WheelRewardDoc) => item.id && item.isVisibleOnWheel !== false && item.label.length > 0)
        .sort((a: WheelRewardDoc, b: WheelRewardDoc) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    }

    const db = getFirebaseDb();

    const qy = query(
      collection(db, "wheel_rewards"),
      where("campaignId", "==", campaignId),
      where("isActive", "==", true)
    );

    const snap = await getDocs(qy);

    return snap.docs
      .map((d) => normalizeReward(d.id, d.data()))
      .filter((x) => x.isVisibleOnWheel !== false && x.label.length > 0)
      .sort((a, b) => {
        const aSort = Number(a.sortOrder ?? 0);
        const bSort = Number(b.sortOrder ?? 0);

        if (aSort !== bSort) return aSort - bSort;
        return toMs(a.createdAt) - toMs(b.createdAt);
      });
  } catch (error) {
    console.error("getWheelRewardsForCampaign error:", error);
    return [];
  }
}

export function hasDismissedWheelCampaign(campaignId: string, uid?: string | null) {
  try {
    return localStorage.getItem(storageKey("dismissed", campaignId, uid)) === "1";
  } catch {
    return false;
  }
}

export function markDismissedWheelCampaign(campaignId: string, uid?: string | null) {
  try {
    localStorage.setItem(storageKey("dismissed", campaignId, uid), "1");
  } catch {
    //
  }
}

export function hasSpunWheelCampaign(campaignId: string, uid?: string | null) {
  try {
    const userKey = storageKey("spun", campaignId, uid);
    const guestKey = storageKey("spun", campaignId, null);

    return (
      localStorage.getItem(userKey) === "1" ||
      localStorage.getItem(guestKey) === "1"
    );
  } catch {
    return false;
  }
}

export function markSpunWheelCampaign(campaignId: string, uid?: string | null) {
  try {
    localStorage.setItem(storageKey("spun", campaignId, uid), "1");
  } catch {
    //
  }
}

export function hasSeenWheelCampaign(campaignId: string, uid?: string | null) {
  try {
    return localStorage.getItem(storageKey("seen", campaignId, uid)) === "1";
  } catch {
    return false;
  }
}

export function markSeenWheelCampaign(campaignId: string, uid?: string | null) {
  try {
    localStorage.setItem(storageKey("seen", campaignId, uid), "1");
  } catch {
    //
  }
}
