"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./wheel-rewards.module.css";

type RewardType = "percent" | "fixed" | "free_shipping" | "gift";

type CampaignOption = {
  id: string;
  title: string;
  isActive?: boolean;
};

type RewardRow = {
  id: string;
  campaignId: string;
  label: string;
  rewardType: RewardType;
  value: number;
  probabilityWeight: number;
  isActive: boolean;
  couponPrefix?: string;
  couponDurationDays?: number;
  singleUse?: boolean;
  minCartAmount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type ImportRewardRow = {
  rowNumber: number;
  campaignId: string;
  label: string;
  rewardType: RewardType;
  value: number;
  probabilityWeight: number;
  couponPrefix: string;
  couponDurationDays: number;
  singleUse: boolean;
  minCartAmount: number;
  isActive: boolean;
  errors: string[];
};

type SpreadsheetRow = Record<string, unknown>;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeRewardType(v: unknown): RewardType {
  const x = safeStr(v);
  if (
    x === "percent" ||
    x === "fixed" ||
    x === "free_shipping" ||
    x === "gift"
  ) {
    return x;
  }
  return "fixed";
}

function normalizeHeader(v: unknown) {
  return safeStr(v)
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSpreadsheetRow(row: SpreadsheetRow) {
  return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[normalizeHeader(key)] = value;
    return acc;
  }, {});
}

function readField(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && safeStr(value) !== "") return value;
  }
  return "";
}

function parseSpreadsheetBoolean(value: unknown, fallback: boolean) {
  const normalized = normalizeHeader(value);
  if (["evet", "true", "1", "aktif", "yes"].includes(normalized)) return true;
  if (["hayir", "false", "0", "pasif", "no"].includes(normalized)) return false;
  return fallback;
}

function normalizeCouponPrefix(value: unknown) {
  return safeStr(value || "WHEEL")
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10) || "WHEEL";
}

function parseSpreadsheetNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const compact = safeStr(value).replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!compact) return fallback;

  const commaIndex = compact.lastIndexOf(",");
  const dotIndex = compact.lastIndexOf(".");
  let normalized = compact;

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = compact.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else if (commaIndex >= 0 || dotIndex >= 0) {
    const separator = commaIndex >= 0 ? "," : ".";
    const parts = compact.split(separator);
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    normalized = looksLikeThousands ? parts.join("") : compact.replace(separator, ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rewardTypeLabel(v: RewardType) {
  if (v === "fixed") return "Sabit";
  if (v === "percent") return "Yüzde";
  if (v === "free_shipping") return "Ücretsiz Kargo";
  if (v === "gift") return "Hediye";
  return v;
}

function rewardValueLabel(type: RewardType, value: number) {
  if (type === "fixed") return `${value} TL`;
  if (type === "percent") return `%${value}`;
  if (type === "free_shipping") return "Ücretsiz Kargo";
  if (type === "gift") return `${value || 1} adet`;
  return String(value);
}

function tsMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return Number(v.toMillis());
    if (typeof v === "number") return v;
    const parsed = Date.parse(String(v));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function fmtDate(v: unknown) {
  const ms = tsMs(v);
  if (!ms) return "-";
  return new Date(ms).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(v: unknown) {
  const ms = tsMs(v);
  if (!ms) return "-";

  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);

  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  if (hour < 24) return `${hour} sa önce`;
  return `${day} gün önce`;
}

export default function WheelRewardsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <WheelRewardsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}

function WheelRewardsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [rows, setRows] = useState<RewardRow[]>([]);

  const [campaignId, setCampaignId] = useState("");
  const [label, setLabel] = useState("");
  const [rewardType, setRewardType] = useState<RewardType>("fixed");
  const [value, setValue] = useState<number>(50);
  const [probabilityWeight, setProbabilityWeight] = useState<number>(10);
  const [couponPrefix, setCouponPrefix] = useState("WHEEL");
  const [couponDurationDays, setCouponDurationDays] = useState<number>(7);
  const [singleUse, setSingleUse] = useState(true);
  const [minCartAmount, setMinCartAmount] = useState<number>(0);

  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [qText, setQText] = useState("");
  const [filterCampaignId, setFilterCampaignId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [importRows, setImportRows] = useState<ImportRewardRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const campaignsQ = query(
      collection(db, "wheel_campaigns"),
      orderBy("createdAt", "desc")
    );

    const unsubCampaigns = onSnapshot(
      campaignsQ,
      (snap) => {
        const list: CampaignOption[] = snap.docs.map((d) => {
          const x: any = d.data();
          return {
            id: d.id,
            title: safeStr(x?.title) || d.id,
            isActive: x?.isActive === true,
          };
        });

        setCampaigns(list);

        setCampaignId((prev) => {
          if (prev && list.some((x) => x.id === prev)) return prev;
          return list[0]?.id || "";
        });
      },
      (error) => {
        console.error("wheel campaigns read error:", error);
        setCampaigns([]);
        setNote("Kampanyalar okunamadı.");
      }
    );

    const rewardsQ = query(
      collection(db, "wheel_rewards"),
      orderBy("createdAt", "desc")
    );

    const unsubRewards = onSnapshot(
      rewardsQ,
      (snap) => {
        const list: RewardRow[] = snap.docs.map((d) => {
          const x: any = d.data();

          return {
            id: d.id,
            campaignId: safeStr(x?.campaignId),
            label: safeStr(x?.label),
            rewardType: safeRewardType(x?.rewardType),
            value: safeNum(x?.value, 0),
            probabilityWeight: safeNum(x?.probabilityWeight, 0),
            isActive: x?.isActive !== false,
            couponPrefix: safeStr(x?.couponPrefix || "WHEEL"),
            couponDurationDays: safeNum(x?.couponDurationDays, 7),
            singleUse: x?.singleUse !== false,
            minCartAmount: safeNum(x?.minCartAmount, 0),
            createdAt: x?.createdAt,
            updatedAt: x?.updatedAt,
          };
        });

        setRows(list);
      },
      (error) => {
        console.error("wheel rewards read error:", error);
        setRows([]);
        setNote("Ödüller okunamadı.");
      }
    );

    return () => {
      unsubCampaigns();
      unsubRewards();
    };
  }, [db]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((x) => x.isActive).length,
      percent: rows.filter((x) => x.rewardType === "percent").length,
      fixed: rows.filter((x) => x.rewardType === "fixed").length,
      shipping: rows.filter((x) => x.rewardType === "free_shipping").length,
      gift: rows.filter((x) => x.rewardType === "gift").length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = qText.trim().toLocaleLowerCase("tr-TR");

    return rows.filter((row) => {
      if (filterCampaignId && row.campaignId !== filterCampaignId) return false;

      const hay = [
        row.label,
        row.campaignId,
        row.rewardType,
        String(row.value),
        String(row.probabilityWeight),
        String(row.couponDurationDays || 7),
        String(row.minCartAmount || 0),
        String(row.couponPrefix || "WHEEL"),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return q ? hay.includes(q) : true;
    });
  }, [rows, qText, filterCampaignId]);

  const importSummary = useMemo(() => {
    const valid = importRows.filter((row) => row.errors.length === 0).length;
    return { valid, invalid: importRows.length - valid };
  }, [importRows]);

  function campaignTitle(id: string) {
    return campaigns.find((x) => x.id === id)?.title || id || "-";
  }

  function resetForm() {
    setLabel("");
    setValue(50);
    setProbabilityWeight(10);
    setRewardType("fixed");
    setCouponPrefix("WHEEL");
    setCouponDurationDays(7);
    setSingleUse(true);
    setMinCartAmount(0);
  }

  function validate() {
    if (!campaignId) return "Önce kampanya seç.";
    if (!label.trim()) return "Ödül başlığı zorunlu.";
    if (rewardType !== "free_shipping" && value < 0) return "Değer eksi olamaz.";
    if (probabilityWeight < 0) return "Ağırlık eksi olamaz.";
    if (couponDurationDays < 1) return "Kupon süresi en az 1 gün olmalı.";
    if (minCartAmount < 0) return "Minimum sepet tutarı eksi olamaz.";
    return "";
  }

  async function handleCreate() {
    const validation = validate();
    if (validation) {
      setNote(validation);
      return;
    }

    setSaving(true);
    setNote("");

    try {
      await addDoc(collection(db, "wheel_rewards"), {
        campaignId,
        label: label.trim(),
        rewardType,
        value: rewardType === "free_shipping" ? 0 : Number(value || 0),
        probabilityWeight: Number(probabilityWeight || 0),
        isActive: true,
        couponPrefix: safeStr(couponPrefix || "WHEEL") || "WHEEL",
        couponDurationDays: Number(couponDurationDays || 7),
        singleUse: singleUse === true,
        minCartAmount: Number(minCartAmount || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetForm();
      setNote("Ödül başarıyla eklendi.");
    } catch (error) {
      console.error("wheel reward create error:", error);
      setNote("Ödül eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  function clearImport() {
    setImportRows([]);
    setImportFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
    setNote("");
    setImportRows([]);
    setImportFileName(file.name);

    if (!campaignId) {
      setNote("Excel yüklemeden önce varsayılan kampanyayı seç.");
      clearImport();
      return;
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setNote("Yalnızca .xlsx veya .xls dosyası yükleyebilirsin.");
      clearImport();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNote("Excel dosyası en fazla 5 MB olabilir.");
      clearImport();
      return;
    }

    setParsingFile(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: false,
      });
      const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === "oduller")
        || workbook.SheetNames[0];
      const worksheet = sheetName ? workbook.Sheets[sheetName] : null;
      if (!worksheet) throw new Error("Excel dosyasında okunabilir sayfa bulunamadı.");

      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      const headerRow = Array.isArray(matrix[0]) ? matrix[0].map(normalizeHeader) : [];
      const requiredHeaders = ["odul_basligi", "odul_tipi", "deger", "agirlik"];
      const missingHeaders = requiredHeaders.filter((header) => !headerRow.includes(header));
      if (missingHeaders.length) {
        throw new Error(`Eksik kolon: ${missingHeaders.join(", ")}. Lütfen paneldeki şablonu kullan.`);
      }

      const rawRows = XLSX.utils
        .sheet_to_json<SpreadsheetRow>(worksheet, {
          defval: "",
          // Para biçimli hücreler (örn. "250 TL") metne dönüştürülürse
          // Number(...) başarısız olur. Ham hücre değerini okuyarak gerçek sayıyı koru.
          raw: true,
        })
        .filter((row) => Object.values(row).some((value) => safeStr(value) !== ""));
      if (rawRows.length > 400) {
        throw new Error("Tek dosyada en fazla 400 ödül yüklenebilir.");
      }

      const validCampaignIds = new Set(campaigns.map((item) => item.id));
      const existingKeys = new Set(
        rows.map((row) => `${row.campaignId}::${row.label.toLocaleLowerCase("tr-TR")}`)
      );
      const fileKeys = new Set<string>();

      const parsedRows = rawRows.map((sourceRow, index): ImportRewardRow => {
        const row = normalizeSpreadsheetRow(sourceRow);
        const errors: string[] = [];
        const targetCampaignId = safeStr(readField(row, ["kampanya_id", "campaign_id"])) || campaignId;
        const rewardLabel = safeStr(readField(row, ["odul_basligi", "odul", "label"])).slice(0, 100);
        const typeRaw = normalizeHeader(readField(row, ["odul_tipi", "reward_type", "tip"]));
        const allowedTypes: RewardType[] = ["fixed", "percent", "free_shipping", "gift"];
        const parsedType = allowedTypes.includes(typeRaw as RewardType)
          ? (typeRaw as RewardType)
          : "fixed";
        const rawValue = readField(row, ["deger", "value"]);
        const parsedValue = parsedType === "free_shipping" ? 0 : parseSpreadsheetNumber(rawValue, 0);
        const weight = parseSpreadsheetNumber(readField(row, ["agirlik", "probability_weight", "weight"]), 0);
        const duration = Math.floor(parseSpreadsheetNumber(readField(row, ["kupon_suresi_gun", "coupon_duration_days"]), 7));
        const minimumCart = parseSpreadsheetNumber(readField(row, ["minimum_sepet_tutari", "min_cart_amount"]), 0);
        const prefix = normalizeCouponPrefix(readField(row, ["kupon_prefix", "coupon_prefix"]));
        const oneUse = parseSpreadsheetBoolean(readField(row, ["tek_kullanimlik", "single_use"]), true);
        const active = parseSpreadsheetBoolean(readField(row, ["aktif", "is_active"]), true);

        if (!targetCampaignId || !validCampaignIds.has(targetCampaignId)) errors.push("Kampanya bulunamadı");
        if (!rewardLabel) errors.push("Ödül başlığı boş");
        if (!allowedTypes.includes(typeRaw as RewardType)) errors.push("Ödül tipi geçersiz");
        if (safeStr(rawValue) === "" && parsedType !== "free_shipping") errors.push("Değer boş");
        if (parsedValue < 0) errors.push("Değer eksi olamaz");
        if (parsedType === "fixed" && parsedValue <= 0) errors.push("Sabit indirim 0'dan büyük olmalı");
        if (parsedType === "percent" && (parsedValue <= 0 || parsedValue > 100)) errors.push("Yüzde 0-100 arasında olmalı");
        if (weight <= 0) errors.push("Ağırlık 0'dan büyük olmalı");
        if (duration < 1 || duration > 365) errors.push("Kupon süresi 1-365 gün olmalı");
        if (minimumCart < 0) errors.push("Minimum sepet eksi olamaz");

        const uniqueKey = `${targetCampaignId}::${rewardLabel.toLocaleLowerCase("tr-TR")}`;
        if (existingKeys.has(uniqueKey)) errors.push("Bu ödül kampanyada zaten var");
        if (fileKeys.has(uniqueKey)) errors.push("Dosyada aynı ödül tekrarlanmış");
        fileKeys.add(uniqueKey);

        return {
          rowNumber: index + 2,
          campaignId: targetCampaignId,
          label: rewardLabel,
          rewardType: parsedType,
          value: parsedValue,
          probabilityWeight: weight,
          couponPrefix: prefix,
          couponDurationDays: duration,
          singleUse: oneUse,
          minCartAmount: minimumCart,
          isActive: active,
          errors,
        };
      });

      if (!parsedRows.length) throw new Error("Ödüller sayfasında veri satırı bulunamadı.");
      setImportRows(parsedRows);
      const validCount = parsedRows.filter((row) => row.errors.length === 0).length;
      setNote(`${file.name}: ${validCount} satır yüklemeye hazır, ${parsedRows.length - validCount} satır hatalı.`);
    } catch (error: any) {
      console.error("wheel rewards excel parse error:", error);
      clearImport();
      setNote(error?.message || "Excel dosyası okunamadı.");
    } finally {
      setParsingFile(false);
    }
  }

  async function handleBulkImport() {
    const validRows = importRows.filter((row) => row.errors.length === 0);
    if (!validRows.length) {
      setNote("Yüklenecek hatasız satır bulunamadı.");
      return;
    }

    setImporting(true);
    setNote("");
    try {
      for (let start = 0; start < validRows.length; start += 400) {
        const batch = writeBatch(db);
        validRows.slice(start, start + 400).forEach((row) => {
          const rewardRef = doc(collection(db, "wheel_rewards"));
          batch.set(rewardRef, {
            campaignId: row.campaignId,
            label: row.label,
            rewardType: row.rewardType,
            value: row.rewardType === "free_shipping" ? 0 : row.value,
            probabilityWeight: row.probabilityWeight,
            isActive: row.isActive,
            couponPrefix: row.couponPrefix,
            couponDurationDays: row.couponDurationDays,
            singleUse: row.singleUse,
            minCartAmount: row.minCartAmount,
            source: "excel_import",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      const skipped = importRows.length - validRows.length;
      clearImport();
      setNote(`${validRows.length} ödül başarıyla yüklendi${skipped ? `, ${skipped} hatalı satır atlandı` : ""}.`);
    } catch (error) {
      console.error("wheel rewards bulk import error:", error);
      setNote("Toplu yükleme tamamlanamadı. Hiçbir satırı tekrar yüklemeden önce listeyi kontrol et.");
    } finally {
      setImporting(false);
    }
  }

  async function toggleActive(row: RewardRow) {
    try {
      setBusyId(row.id);
      setNote("");

      await updateDoc(doc(db, "wheel_rewards", row.id), {
        isActive: !row.isActive,
        updatedAt: serverTimestamp(),
      });

      setNote(
        row.isActive
          ? `"${row.label}" pasife çekildi.`
          : `"${row.label}" aktifleştirildi.`
      );
    } catch (error) {
      console.error("wheel reward toggle error:", error);
      setNote("Durum güncellenemedi.");
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(row: RewardRow) {
    const ok = window.confirm(`"${row.label}" ödülünü silmek istiyor musun?`);
    if (!ok) return;

    try {
      setBusyId(row.id);
      setNote("");

      await deleteDoc(doc(db, "wheel_rewards", row.id));
      setNote("Ödül silindi.");
    } catch (error) {
      console.error("wheel reward delete error:", error);
      setNote("Ödül silinemedi.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Wheel • Rewards</div>
          <h1 className={styles.h1}>Ödüller</h1>
          <p className={styles.sub}>
            Çarkın dilimleri burada yönetilir. Ne düşecek, ne sıklıkla düşecek,
            kupon kaç gün yaşayacak — hepsi burada.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/admin/wheel" className={styles.ghostBtn}>
            ← Wheel Dashboard
          </Link>
        </div>
      </section>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Toplam</span>
          <strong className={styles.statValue}>{stats.total}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Aktif</span>
          <strong className={styles.statValue}>{stats.active}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Sabit</span>
          <strong className={styles.statValue}>{stats.fixed}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Yüzde</span>
          <strong className={styles.statValue}>{stats.percent}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Kargo</span>
          <strong className={styles.statValue}>{stats.shipping}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Hediye</span>
          <strong className={styles.statValue}>{stats.gift}</strong>
        </div>
      </section>

      {note ? <div className={styles.noteBar}>{note}</div> : null}

      <section className={`${styles.card} ${styles.importCard}`}>
        <div className={styles.cardTop}>
          <div>
            <div className={styles.importKicker}>Excel • Güvenli Toplu İşlem</div>
            <h2 className={styles.cardTitle}>Toplu Ödül Yükle</h2>
            <p className={styles.cardDesc}>
              Şablonu indir, ödülleri doldur ve yükle. Dosya önce doğrulanır;
              hatalı satırlar Firestore&apos;a yazılmaz.
            </p>
          </div>

          <a
            href="/templates/Dromocob-cark-odul-toplu-yukleme-sablonu.xlsx"
            download="Dromocob-cark-odul-toplu-yukleme-sablonu.xlsx"
            className={styles.templateBtn}
          >
            ↓ Excel Şablonunu İndir
          </a>
        </div>

        <div className={styles.importFlow}>
          <div className={styles.importStep}>
            <span>1</span>
            <div><strong>Şablonu indir</strong><small>Kolonları değiştirmeden doldur.</small></div>
          </div>
          <div className={styles.importStep}>
            <span>2</span>
            <div><strong>Dosyayı seç</strong><small>.xlsx veya .xls, en fazla 5 MB.</small></div>
          </div>
          <div className={styles.importStep}>
            <span>3</span>
            <div><strong>Kontrol edip yükle</strong><small>Yalnızca yeşil satırlar eklenir.</small></div>
          </div>
        </div>

        <div className={styles.importControls}>
          <label className={styles.importCampaignField}>
            <span className={styles.label}>Boş kampanya ID&apos;leri için varsayılan kampanya</span>
            <select
              className={styles.select}
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
              disabled={parsingFile || importing}
            >
              <option value="">Kampanya seç</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.title}</option>
              ))}
            </select>
          </label>

          <label
            className={styles.dropZone}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleImportFile(event.dataTransfer.files?.[0] || null);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(event) => void handleImportFile(event.target.files?.[0] || null)}
              disabled={parsingFile || importing}
            />
            <span className={styles.dropIcon}>↥</span>
            <strong>{parsingFile ? "Excel kontrol ediliyor..." : importFileName || "Excel dosyasını seç veya buraya bırak"}</strong>
            <small>Dosyan önce yerel olarak okunur ve satır satır doğrulanır.</small>
          </label>
        </div>

        {importRows.length ? (
          <div className={styles.importPreview}>
            <div className={styles.previewTop}>
              <div>
                <strong>Yükleme önizlemesi</strong>
                <span className={styles.previewOk}>{importSummary.valid} hazır</span>
                {importSummary.invalid ? <span className={styles.previewBad}>{importSummary.invalid} hatalı</span> : null}
              </div>
              <button type="button" className={styles.clearBtn} onClick={clearImport} disabled={importing}>
                Dosyayı Temizle
              </button>
            </div>

            <div className={styles.previewTableWrap}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Satır</th><th>Durum</th><th>Kampanya</th><th>Ödül</th>
                    <th>Tip</th><th>Değer</th><th>Ağırlık</th><th>Kontrol</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 80).map((row) => (
                    <tr key={`${row.rowNumber}-${row.campaignId}-${row.label}`} className={row.errors.length ? styles.previewErrorRow : undefined}>
                      <td>{row.rowNumber}</td>
                      <td><span className={row.errors.length ? styles.badgeBad : styles.badgeOk}>{row.errors.length ? "Hatalı" : "Hazır"}</span></td>
                      <td>{campaignTitle(row.campaignId)}</td>
                      <td>{row.label || "—"}</td>
                      <td>{rewardTypeLabel(row.rewardType)}</td>
                      <td>{rewardValueLabel(row.rewardType, row.value)}</td>
                      <td>{row.probabilityWeight}</td>
                      <td>{row.errors.length ? row.errors.join(" • ") : "Tüm kontroller geçti"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importRows.length > 80 ? <p className={styles.previewLimit}>İlk 80 satır gösteriliyor; tüm satırlar yükleme sırasında işlenir.</p> : null}

            <div className={styles.importFooter}>
              <p>
                <strong>{importSummary.valid} ödül</strong> eklenecek.
                {importSummary.invalid ? ` ${importSummary.invalid} hatalı satır atlanacak.` : " Hata bulunamadı."}
              </p>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleBulkImport}
                disabled={importing || importSummary.valid === 0}
              >
                {importing ? "Ödüller yükleniyor..." : `${importSummary.valid} Ödülü Güvenle Yükle`}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.card}>
        <div className={styles.cardTop}>
          <div>
            <h2 className={styles.cardTitle}>Yeni Ödül Ekle</h2>
            <p className={styles.cardDesc}>
              Buraya eklenen kayıtlar çarkta gerçek dilim olarak görünür.
            </p>
          </div>
        </div>

        <div className={styles.formGrid3}>
          <label className={styles.field}>
            <span className={styles.label}>Kampanya</span>
            <select
              className={styles.select}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">Kampanya seç</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Ödül Başlığı</span>
            <input
              className={styles.input}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="250 TL İndirim"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Ödül Tipi</span>
            <select
              className={styles.select}
              value={rewardType}
              onChange={(e) => setRewardType(e.target.value as RewardType)}
            >
              <option value="fixed">Sabit Tutar</option>
              <option value="percent">Yüzde</option>
              <option value="free_shipping">Ücretsiz Kargo</option>
              <option value="gift">Hediye</option>
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Değer</span>
            <input
              className={styles.input}
              type="number"
              value={value}
              onChange={(e) => setValue(safeNum(e.target.value, 0))}
              disabled={rewardType === "free_shipping"}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Ağırlık</span>
            <input
              className={styles.input}
              type="number"
              value={probabilityWeight}
              onChange={(e) => setProbabilityWeight(safeNum(e.target.value, 0))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Kupon Prefix</span>
            <input
              className={styles.input}
              value={couponPrefix}
              onChange={(e) => setCouponPrefix(e.target.value)}
              placeholder="WHEEL"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Kupon Süresi (Gün)</span>
            <input
              className={styles.input}
              type="number"
              value={couponDurationDays}
              onChange={(e) => setCouponDurationDays(safeNum(e.target.value, 1))}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Minimum Sepet Tutarı</span>
            <input
              className={styles.input}
              type="number"
              value={minCartAmount}
              onChange={(e) => setMinCartAmount(safeNum(e.target.value, 0))}
            />
          </label>

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={singleUse}
              onChange={(e) => setSingleUse(e.target.checked)}
            />
            <span>Tek Kullanımlık Kupon</span>
          </label>

          <div className={styles.field}>
            <span className={styles.label}>İşlem</span>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleCreate}
              disabled={saving || !campaignId}
            >
              {saving ? "Ekleniyor..." : "Ödül Ekle"}
            </button>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTop}>
          <div>
            <h2 className={styles.cardTitle}>Ödül Listesi</h2>
            <p className={styles.cardDesc}>
              Weight artarsa daha sık düşer. Fazla açarsan müşteri sevinir, kasa düşünür.
            </p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.search}
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Ödül adı / kampanya / tip ara"
          />

          <select
            className={styles.select}
            value={filterCampaignId}
            onChange={(e) => setFilterCampaignId(e.target.value)}
          >
            <option value="">Tüm kampanyalar</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {filteredRows.length === 0 ? (
          <div className={styles.empty}>Henüz ödül yok.</div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Kampanya</th>
                    <th>Ödül</th>
                    <th>Tip</th>
                    <th>Değer</th>
                    <th>Ağırlık</th>
                    <th>Süre</th>
                    <th>Min Sepet</th>
                    <th>Prefix</th>
                    <th>Durum</th>
                    <th>Oluşturma</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const rowBusy = busyId === row.id;

                    return (
                      <tr key={row.id}>
                        <td>
                          <div className={styles.rowTitle}>
                            <div className={styles.rowTitleMain}>
                              {campaignTitle(row.campaignId)}
                            </div>
                            <div className={styles.rowTitleSub}>{row.campaignId}</div>
                          </div>
                        </td>

                        <td>
                          <div className={styles.rowTitle}>
                            <div className={styles.rowTitleMain}>{row.label}</div>
                            <div className={styles.rowTitleSub}>
                              {row.singleUse ? "Tek kullanımlık" : "Çoklu kullanım"}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={styles.badge}>
                            {rewardTypeLabel(row.rewardType)}
                          </span>
                        </td>

                        <td>{rewardValueLabel(row.rewardType, row.value)}</td>
                        <td>{row.probabilityWeight}</td>
                        <td>{row.couponDurationDays || 7} gün</td>
                        <td>{row.minCartAmount || 0} TL</td>
                        <td>{row.couponPrefix || "WHEEL"}</td>

                        <td>
                          <span className={row.isActive ? styles.badgeOk : styles.badgeOff}>
                            {row.isActive ? "Aktif" : "Pasif"}
                          </span>
                        </td>

                        <td>
                          <div className={styles.rowTitle}>
                            <div className={styles.rowTitleMain}>
                              {relTime(row.createdAt)}
                            </div>
                            <div className={styles.rowTitleSub}>
                              {fmtDate(row.createdAt)}
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.ghostBtnSm}
                              onClick={() => toggleActive(row)}
                              disabled={rowBusy}
                            >
                              {rowBusy
                                ? "İşleniyor..."
                                : row.isActive
                                ? "Pasifleştir"
                                : "Aktifleştir"}
                            </button>

                            <button
                              type="button"
                              className={styles.dangerBtnSm}
                              onClick={() => handleDelete(row)}
                              disabled={rowBusy}
                            >
                              {rowBusy ? "..." : "Sil"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileList}>
              {filteredRows.map((row) => {
                const rowBusy = busyId === row.id;

                return (
                  <article key={row.id} className={styles.mobileCard}>
                    <div className={styles.mobileTop}>
                      <div>
                        <div className={styles.mobileCode}>{row.label}</div>
                        <div className={styles.mobileSub}>
                          {campaignTitle(row.campaignId)}
                        </div>
                      </div>

                      <span className={row.isActive ? styles.badgeOk : styles.badgeOff}>
                        {row.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </div>

                    <div className={styles.mobileGrid}>
                      <div>
                        <span className={styles.mobileLabel}>Tip</span>
                        <div className={styles.mobileVal}>
                          {rewardTypeLabel(row.rewardType)}
                        </div>
                      </div>

                      <div>
                        <span className={styles.mobileLabel}>Değer</span>
                        <div className={styles.mobileVal}>
                          {rewardValueLabel(row.rewardType, row.value)}
                        </div>
                      </div>

                      <div>
                        <span className={styles.mobileLabel}>Ağırlık</span>
                        <div className={styles.mobileVal}>{row.probabilityWeight}</div>
                      </div>

                      <div>
                        <span className={styles.mobileLabel}>Kupon Süresi</span>
                        <div className={styles.mobileVal}>
                          {row.couponDurationDays || 7} gün
                        </div>
                      </div>

                      <div>
                        <span className={styles.mobileLabel}>Min Sepet</span>
                        <div className={styles.mobileVal}>
                          {row.minCartAmount || 0} TL
                        </div>
                      </div>

                      <div>
                        <span className={styles.mobileLabel}>Prefix</span>
                        <div className={styles.mobileVal}>
                          {row.couponPrefix || "WHEEL"}
                        </div>
                      </div>

                      <div>
                        <span className={styles.mobileLabel}>Kullanım</span>
                        <div className={styles.mobileVal}>
                          {row.singleUse ? "Tek kullanımlık" : "Çoklu kullanım"}
                        </div>
                      </div>

                      <div>
                        <span className={styles.mobileLabel}>Oluşturma</span>
                        <div className={styles.mobileVal}>{fmtDate(row.createdAt)}</div>
                      </div>
                    </div>

                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.ghostBtnSm}
                        onClick={() => toggleActive(row)}
                        disabled={rowBusy}
                      >
                        {rowBusy
                          ? "İşleniyor..."
                          : row.isActive
                          ? "Pasifleştir"
                          : "Aktifleştir"}
                      </button>

                      <button
                        type="button"
                        className={styles.dangerBtnSm}
                        onClick={() => handleDelete(row)}
                        disabled={rowBusy}
                      >
                        {rowBusy ? "..." : "Sil"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
