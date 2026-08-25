"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirebaseAuth } from "@/lib/firebase.client";
import { signOut, type User } from "firebase/auth";
import styles from "./WheelSpinModal.module.css";
import type { WheelCampaignDoc, WheelRewardDoc } from "@/types/wheel";
import WheelGuestForm, { type WheelGuestFormValue } from "./WheelGuestForm";
import WheelMemberPanel from "./WheelMemberPanel";
import {
  getWheelRewardsForCampaign,
  getWheelDeviceId,
  markSpunWheelCampaign,
} from "@/lib/wheel";

const SEEK_SPIN_DURATION_MS = 30000;
const LANDING_DURATION_MS = 3400;
const SEEK_TURNS = 24;
const LANDING_TURNS = 4;

const WHEEL_SIZE = 560;
const CENTER = WHEEL_SIZE / 2;
const OUTER_R = 250;
const INNER_R = 64;
const POINTER_ANGLE = 270;

type WheelSpinModalProps = {
  open: boolean;
  campaign: WheelCampaignDoc;
  authUser: User | null;
  memberDisplayName?: string;
  unlimitedSpins?: boolean;
  onClose: () => void;
  guestDataFromIntro?: WheelGuestFormValue | null;
};

type SegmentItem = {
  id: string;
  label: string;
  wheelLabel: string;
  color: string;
  textColor: string;
  isWinnable: boolean;
  weight: number;
  rewardType?: string;
  value?: number;
};

function formatRewardValue(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);
}

function wheelLabelForReward(reward: WheelRewardDoc) {
  const value = Number(reward.value || 0);
  if (reward.rewardType === "fixed") return `${formatRewardValue(value)} TL`;
  if (reward.rewardType === "percent") return `%${formatRewardValue(value)}`;
  if (reward.rewardType === "free_shipping") return "KARGO";
  if (reward.rewardType === "gift") return value > 1 ? `${formatRewardValue(value)} HEDİYE` : "HEDİYE";
  return String(reward.label || "ÖDÜL").trim().split(/\s+/).slice(0, 2).join(" ").toLocaleUpperCase("tr-TR");
}

function mapRewardsToSegments(rewards: WheelRewardDoc[]): SegmentItem[] {
  if (!rewards.length) return [];

  const palette = [
    { background: "#10244b", text: "#fff8e6" },
    { background: "#c89a3d", text: "#101b35" },
    { background: "#f2e5c4", text: "#15213b" },
    { background: "#1d365f", text: "#fff8e6" },
    { background: "#d9b75e", text: "#101b35" },
    { background: "#faf5e9", text: "#15213b" },
  ];

  const activeRewards = rewards.filter((r) => r.isActive !== false);

  if (!activeRewards.length) return [];

  return activeRewards.map((reward, index) => ({
    id: reward.id,
    label: String(reward.label || "Ödül").trim() || "Ödül",
    wheelLabel: wheelLabelForReward(reward),
    color: reward.color || palette[index % palette.length].background,
    textColor: palette[index % palette.length].text,
    isWinnable: reward.isWinnable !== false,
    weight: Number(reward.probabilityWeight || 0),
    rewardType: reward.rewardType,
    value: Number(reward.value || 0),
  }));
}



function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function segmentTextTransform(midAngle: number) {
  // Keep each label on the radius of its slice (outer edge -> wheel center),
  // matching a classic prize-wheel layout instead of a tangential caption.
  return midAngle + 90;
}

function segmentTextSize(segmentCount: number) {
  if (segmentCount >= 16) return 21;
  if (segmentCount >= 13) return 23;
  if (segmentCount >= 11) return 26;
  if (segmentCount >= 9) return 28;
  return 30;
}

export default function WheelSpinModal({
  open,
  campaign,
  authUser,
  memberDisplayName,
  unlimitedSpins = false,
  onClose,
  guestDataFromIntro,
}: WheelSpinModalProps) {
  const timeoutRef = useRef<number | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const spinRequestRef = useRef(false);

  const [step, setStep] = useState<"form" | "spin" | "result">("form");
  const [spinning, setSpinning] = useState(false);
  const [spinPhase, setSpinPhase] = useState<"idle" | "seeking" | "landing">("idle");
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SegmentItem | null>(null);
  const [guestData, setGuestData] = useState<WheelGuestFormValue | null>(null);
  const [rewardRows, setRewardRows] = useState<WheelRewardDoc[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [errorText, setErrorText] = useState("");
  const [copied, setCopied] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const isMember = Boolean(authUser && !authUser.isAnonymous);

  const segments = useMemo(() => {
    return mapRewardsToSegments(rewardRows);
  }, [rewardRows]);

  const segmentAngle = 360 / Math.max(segments.length, 1);
  const segmentFontSize = segmentTextSize(segments.length);

  function clearSpinTimer() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (celebrationTimerRef.current !== null) {
      window.clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
    }
  }

  function resetState() {
  setStep("form");
  setSpinning(false);
  setSpinPhase("idle");
  spinRequestRef.current = false;
  setResult(null);
  setGuestData(null);
  setRewardRows([]);
  setCouponCode("");
  setErrorText("");
  setCopied(false);
  setRotation(0);
  setLoadingRewards(false);
  setCelebrating(false);
}

function handleClose() {
  if (spinning) return;

  clearSpinTimer();
  resetState();
  onClose();
}

  useEffect(() => {
    let alive = true;

    async function loadRewards() {
      if (!open || !campaign?.id) return;

      try {
        setLoadingRewards(true);
        const rows = await getWheelRewardsForCampaign(campaign.id);
        if (!alive) return;
        setRewardRows(Array.isArray(rows) ? rows : []);
      } catch (error) {
        console.error("wheel rewards load error:", error);
        if (!alive) return;
        setRewardRows([]);
      } finally {
        if (alive) setLoadingRewards(false);
      }
    }

    void loadRewards();

    return () => {
      alive = false;
    };
  }, [open, campaign?.id]);
useEffect(() => {
  if (!open) {
    clearSpinTimer();
    resetState();
    return;
  }

  const introGuest = guestDataFromIntro || null;
  setGuestData(introGuest);

  if (isMember) {
    setStep("spin");
  } else {
    setStep(introGuest ? "spin" : "form");
  }

  return () => {
    clearSpinTimer();
  };
}, [open, guestDataFromIntro, isMember]);

  function handleGuestContinue(value: WheelGuestFormValue) {
    setGuestData(value);
    setStep("spin");
  }

  function handleMemberContinue() {
    setStep("spin");
  }

function handleSpin() {
  if (spinRequestRef.current || spinning || !segments.length || !campaign?.id) return;

  if (!isMember && !guestData) {
    setStep("form");
    return;
  }

  spinRequestRef.current = true;
  setSpinning(true);
  setSpinPhase("seeking");
  setResult(null);
  setCelebrating(false);
  setErrorText("");
  clearSpinTimer();
  const baseRotation = rotation;
  const spinStartedAt = performance.now();

  // Sunucu sonucunu beklerken kullanıcı boş bir ekran görmez; çark tıklamayla
  // aynı karede harekete başlar ve sonuç gelince hedef dilime yumuşakça kilitlenir.
  setRotation(baseRotation + SEEK_TURNS * 360);

  void (async () => {
    try {
      const auth = getFirebaseAuth();

      if (!isMember && auth.currentUser?.isAnonymous) {
        await signOut(auth);
      }

      const functions = getFunctions(getFirebaseApp(), "europe-west1");
      const callable = httpsCallable(functions, "spinWheelV1");

      const res: any = await callable({
        campaignId: campaign.id,
        guestData: !isMember ? guestData : null,
        deviceId: getWheelDeviceId(),
      });

      const data = res?.data || {};
      const serverWinner = data?.winner || null;
      const serverCouponCode = String(data?.couponCode || "").trim();

      if (!serverWinner?.id || !serverCouponCode) {
        throw new Error("Spin sonucu alınamadı.");
      }

      const finalWinner = segments.find((x) => x.id === serverWinner.id);

      if (!finalWinner) {
        throw new Error("Kazanan dilim çarkta bulunamadı.");
      }

      const winnerIndex = segments.findIndex((x) => x.id === finalWinner.id);
      const winnerCenterAngle = winnerIndex * segmentAngle + segmentAngle / 2;
      const offsetToPointer = normalizeAngle(POINTER_ANGLE - winnerCenterAngle);
      const elapsedRatio = Math.min(
        (performance.now() - spinStartedAt) / SEEK_SPIN_DURATION_MS,
        (SEEK_TURNS - 1) / SEEK_TURNS
      );
      const completedTurns = elapsedRatio * SEEK_TURNS;
      const finalTurns = Math.ceil(completedTurns) + LANDING_TURNS;
      const finalRotation = baseRotation + finalTurns * 360 + offsetToPointer;

      setSpinPhase("landing");
      setRotation(finalRotation);

      timeoutRef.current = window.setTimeout(() => {
        if (!unlimitedSpins) {
          markSpunWheelCampaign(
            campaign.id,
            isMember ? authUser?.uid || null : null
          );
        }

        setSpinning(false);
        setSpinPhase("idle");
        spinRequestRef.current = false;
        setResult(finalWinner);
        setCouponCode(serverCouponCode);
        setStep("result");
        setCelebrating(true);
        celebrationTimerRef.current = window.setTimeout(() => {
          setCelebrating(false);
          celebrationTimerRef.current = null;
        }, 1800);
        timeoutRef.current = null;
      }, LANDING_DURATION_MS);
    } catch (error: any) {
      console.error("spinWheelV1 error FULL:", error);

      const msg = String(error?.message || error?.details || "");
      const alreadySpun =
        msg.toLowerCase().includes("already-exists") ||
        msg.includes("daha önce çark çevrilmiş");

      if (alreadySpun && !unlimitedSpins) {
        markSpunWheelCampaign(
          campaign.id,
          isMember ? authUser?.uid || null : null
        );
      }

      setSpinning(false);
      setSpinPhase("idle");
      spinRequestRef.current = false;
      timeoutRef.current = null;

      if (alreadySpun) {
        onClose();
        return;
      }

      setErrorText(msg || "Çark şu anda çevrilemedi. Lütfen tekrar dene.");
    }
  })();
}

  async function copyCoupon() {
    try {
      await navigator.clipboard.writeText(couponCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Şans Çarkı"
    >
      <div className={`${styles.modal} ${spinning ? styles.modalSpinning : ""} ${celebrating ? styles.modalCelebrating : ""} ${step === "result" ? styles.modalResult : ""}`}>
        <div className={styles.ambientGlow} aria-hidden="true" />
        <button
          type="button"
          className={styles.close}
          onClick={handleClose}
          aria-label="Kapat"
          disabled={spinning}
        >
          ×
        </button>

        <div className={styles.left}>
          <div className={styles.kicker}>DROMOCOB • ŞANS ÇARKI</div>

          <div className={styles.stepRail} aria-label="Kampanya adımları">
            <span className={step === "form" ? styles.stepActive : styles.stepDone}>1 <i>Bilgiler</i></span>
            <b aria-hidden="true" />
            <span className={step === "spin" ? styles.stepActive : step === "result" ? styles.stepDone : ""}>2 <i>Çevir</i></span>
            <b aria-hidden="true" />
            <span className={step === "result" ? styles.stepActive : ""}>3 <i>Ödül</i></span>
          </div>

          <h2 className={styles.title}>
            {campaign?.ui?.headline ||
              campaign?.heroTitle ||
              campaign?.title ||
              "Şans Çarkı"}
          </h2>

          <p className={styles.sub}>
            {campaign?.ui?.subheadline ||
              campaign?.heroText ||
              "Formu doldur, çarkı çevir, kazandığın kuponu anında al."}
          </p>

          <div className={styles.badges}>
            <span className={styles.badgePill}>✦ Anında kupon</span>
            <span className={styles.badgePill}>✓ Güvenli tek çevirim</span>
            <span className={styles.badgePill}>✉ E-posta teslimi</span>
          </div>

          {step === "form" ? (
            isMember ? (
              <WheelMemberPanel
                displayName={memberDisplayName || authUser?.displayName || "Üye kullanıcı"}
                email={authUser?.email || ""}
                onContinue={handleMemberContinue}
                disabled={loadingRewards}
              />
            ) : (
              <WheelGuestForm
                requireEmail
                requirePhone={campaign.requirePhone !== false}
                requireConsent={campaign.requireConsent !== false}
                onSubmit={handleGuestContinue}
                disabled={loadingRewards}
              />
            )
          ) : null}

          {step === "spin" ? (
            <div className={styles.actionArea}>
              <button
                type="button"
                className={styles.spinBtn}
                onClick={handleSpin}
                disabled={spinning || loadingRewards || segments.length < 2}
              >
                {spinning
                  ? "Çevriliyor..."
                  : loadingRewards
                  ? "Çark hazırlanıyor..."
                  : campaign?.ui?.buttonLabel || "Çevir ve Kazan"}
              </button>
              <p className={styles.secureNote}>
                {unlimitedSpins
                  ? "Ana admin test modu aktif: çevirim hakkın sınırsızdır."
                  : "Aynı hesap, e-posta, cihaz ve bağlantı için yalnızca bir katılım hakkı vardır."}
              </p>
            </div>
          ) : null}

       {step === "result" && result ? (
  <div className={styles.resultBox}>
    <div className={styles.resultKicker}>TEBRİKLER • KUPONUN HAZIR</div>
    <div className={styles.successSeal} aria-hidden="true">✓</div>
    <div className={styles.resultLabel}>Kazandığın ödül</div>
    <div className={styles.resultValue}>{result.label}</div>

    <button type="button" className={styles.couponTicket} onClick={copyCoupon}>
      <span>Kupon kodun</span>
      <strong>{couponCode}</strong>
      <small>{copied ? "Kopyalandı ✓" : "Kopyalamak için dokun"}</small>
    </button>

    <div className={styles.resultHint}>
      {isMember
        ? "Kupon hesabına tanımlandı. Profilindeki kuponlar alanında ve checkout ekranında kullanabilirsin."
        : "Kupon kodun başarıyla oluşturuldu. E-posta adresine de gönderildi, checkout ekranında kullanabilirsin."}
    </div>

    <div className={styles.resultBenefits} aria-label="Kupon bilgileri">
      <span>✓ Güvenle kaydedildi</span>
      <span>✦ Ödeme ekranında hazır</span>
    </div>

    {!isMember && guestData ? (
      <div className={styles.resultMeta}>
        Gönderilen e-posta: <strong>{guestData.email}</strong>
      </div>
    ) : null}

    <button
      type="button"
      className={styles.spinBtn}
      onClick={handleClose}
    >
      Tamam
    </button>
  </div>
) : (
  <div className={styles.infoCard}>
    <div className={styles.infoTitle}>Bugünün fırsatı</div>
    <div className={styles.infoText}>
      {loadingRewards
        ? "Ödüller yükleniyor..."
        : rewardRows.length
        ? "Üye kullanıcıda kupon hesabına düşer. Misafir kullanıcıda kupon hem ekranda gösterilir hem de e-posta adresine gönderilir."
        : "Bu kampanya için henüz aktif ödül yok."}
    </div>
  </div>
)}
          {errorText ? <div className={styles.errorBanner} role="alert">{errorText}</div> : null}
        </div>

        <div className={styles.right}>
          {celebrating ? (
            <div className={styles.celebration} aria-hidden="true">
              {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
            </div>
          ) : null}
          <div className={`${styles.wheelShell} ${spinning ? styles.wheelShellSpinning : ""} ${celebrating ? styles.wheelShellCelebrating : ""}`}>
            <div className={styles.pointer} />

            <div
              className={styles.wheelSvgWrap}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? spinPhase === "landing"
                    ? `transform ${LANDING_DURATION_MS}ms cubic-bezier(.08,.74,.12,1)`
                    : `transform ${SEEK_SPIN_DURATION_MS}ms linear`
                  : "none",
              }}
            >
              <svg
                viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
                className={styles.wheelSvg}
                aria-hidden="true"
              >
                {segments.map((item, i) => {
                  const startAngle = i * segmentAngle;
                  const endAngle = startAngle + segmentAngle;
                  const midAngle = startAngle + segmentAngle / 2;

                  const path = describeSlice(
                    CENTER,
                    CENTER,
                    OUTER_R,
                    startAngle,
                    endAngle
                  );

                  const textPoint = polarToCartesian(
                    CENTER,
                    CENTER,
                    OUTER_R * 0.63,
                    midAngle
                  );

                  const textRotate = segmentTextTransform(midAngle);

                  return (
                    <g key={item.id}>
                      <path d={path} fill={item.color} className={styles.segmentSlice} />
                     <text
                        x={textPoint.x}
                        y={textPoint.y}
                        className={styles.segmentText}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${textRotate} ${textPoint.x} ${textPoint.y})`}
                        style={{
                          fill: item.textColor,
                          fontSize: `${segmentFontSize}px`,
                        }}
                      >
                        {item.wheelLabel}
                      </text>
                    </g>
                  );
                })}

                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={OUTER_R}
                  className={styles.wheelOutline}
                />
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={INNER_R}
                  className={styles.centerCircle}
                />
                <text
                  x={CENTER}
                  y={CENTER}
                  className={styles.centerSix}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  6
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
