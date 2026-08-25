"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { getFirebaseDb } from "@/lib/firebase.client";
import { upsertDoc } from "@/lib/adminApi";

/* =========================================================
   TYPES
========================================================= */

type PriceMode =
  | "fixed"
  | "rate_plus"
  | "rate_plus_fixed"
  | "weight_rate"
  | "weight_rate_plus"
  | "weight_rate_plus_fixed";

type CategoryDoc = {
  id: string;
  slug: string;
  parentId?: string | null;
  level?: number;
  isActive?: boolean;
  name?: any;
};

type RowAny = Record<string, any>;

type ImportStatus =
  | "ready"
  | "importing"
  | "success"
  | "failed";

type ImportProduct = {
  rowNumber: number;
  id: string;
  payload: any;
  warnings: string[];
  errors: string[];
  status: ImportStatus;
  importError?: string;
};

type ImportProgress = {
  done: number;
  total: number;
  ok: number;
  fail: number;
};

type LocaleText = {
  tr?: string;
  en?: string;
};

type VariantOption = {
  value: string;
  label: LocaleText;
  hasGram?: number;
  weightGram?: number;
  priceDelta?: number;
  stockDelta?: number;
  isActive?: boolean;
  order?: number;
};

type VariantGroup = {
  id: string;
  label: LocaleText;
  type:
  | "select"
  | "button"
  | "radio"
  | "pill"
  | "swatch"
  | "grid"
  | "card";
  required: boolean;
  options: VariantOption[];
};

type CategoryVariantPreset = {
  enabled: boolean;
  groups: VariantGroup[];
};
type DiamondStoneGroup = {
  id?: string;

  stoneType?: string;
  diamondOrigin?: "natural" | "lab_grown" | "";

  weightCt?: number;
  quantity?: number;

  color?: string;
  clarity?: string;
  cut?: string;

  fluorescence?: string;
  polish?: string;
  symmetry?: string;

  treatment?: string;
  origin?: string;

  certificateLab?: string;
  certificateNumber?: string;
};

type DiamondData = {
  enabled?: boolean;

  metalColor?: "white" | "yellow" | "rose" | "mixed" | "";
  metalType?: "gold" | "platinum" | "silver" | "other" | "";
  metalKarat?: number;
  handmade?: boolean;
  settingType?: string;

  diamondOrigin?: "natural" | "lab_grown" | "mixed" | "";
  totalCarat?: number;
  centerStoneCarat?: number;
  totalStoneQuantity?: number;

  certificateLab?: string;
  certificateNumber?: string;
  certificateUrl?: string;
  certificateNote?: string;

  fluorescence?: string;
  polish?: string;
  symmetry?: string;
  treatment?: string;
  origin?: string;

  stoneGroups?: DiamondStoneGroup[];
};
/* =========================================================
   CONSTANTS
========================================================= */

const FALLBACK_PRODUCT_LOGO = "/dromocob-mark.svg";

const VALID_PRICE_MODES: PriceMode[] = [
  "fixed",
  "rate_plus",
  "rate_plus_fixed",
  "weight_rate",
  "weight_rate_plus",
  "weight_rate_plus_fixed",
];

const VALID_VARIANT_TYPES: VariantGroup["type"][] = [
  "select",
  "button",
  "radio",
  "pill",
  "swatch",
  "grid",
  "card",
];

const VALID_BUNDLE_DISCOUNT_TYPES = [
  "none",
  "fixed",
  "percent",
] as const;

const MAX_IMPORT_ROWS = 2000;
const VALID_DIAMOND_METAL_TYPES = [
  "gold",
  "platinum",
  "silver",
  "other",
] as const;

const VALID_DIAMOND_METAL_COLORS = [
  "white",
  "yellow",
  "rose",
  "mixed",
] as const;

const VALID_DIAMOND_ORIGINS = [
  "natural",
  "lab_grown",
  "mixed",
] as const;

const VALID_STONE_ORIGINS = [
  "natural",
  "lab_grown",
] as const;

const VALID_DIAMOND_SETTING_TYPES = [
  "prong",
  "bezel",
  "pave",
  "channel",
  "halo",
  "tension",
  "flush",
  "cluster",
  "other",
] as const;

const VALID_DIAMOND_STONE_TYPES = [
  "diamond",
  "lab_diamond",
  "sapphire",
  "ruby",
  "emerald",
  "zircon",
  "moissanite",
  "topaz",
  "amethyst",
  "aquamarine",
  "pearl",
  "other",
] as const;

const VALID_DIAMOND_CUTS = [
  "round",
  "princess",
  "oval",
  "emerald",
  "pear",
  "marquise",
  "cushion",
  "radiant",
  "asscher",
  "heart",
  "baguette",
  "trillion",
  "other",
] as const;

const VALID_DIAMOND_CLARITIES = [
  "FL",
  "IF",
  "VVS",
  "VVS1",
  "VVS2",
  "VS",
  "VS1",
  "VS2",
  "SI",
  "SI1",
  "SI2",
  "I",
  "I1",
  "I2",
  "I3",
] as const;
const VALID_DIAMOND_COLORS = [
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",

  // mağaza etiketlerinde kullanılan renk aralıkları
  "D-E",
  "E-F",
  "F-G",
  "G-H",
  "H-I",
  "I-J",
  "J-K",

  "fancy",
] as const;
const VALID_DIAMOND_GRADES = [
  "excellent",
  "very_good",
  "good",
  "fair",
  "poor",
] as const;

const VALID_DIAMOND_FLUORESCENCE = [
  "none",
  "faint",
  "medium",
  "strong",
  "very_strong",
] as const;

const VALID_DIAMOND_CERTIFICATE_LABS = [
  "GIA",
  "IGI",
  "HRD",
  "AGS",
  "GRS",
  "LOCAL",
  "OTHER",
] as const;

const VALID_DIAMOND_METAL_KARATS = [
  8,
  9,
  10,
  14,
  18,
  22,
  24,
] as const;

/* =========================================================
   BASIC HELPERS
========================================================= */

function str(v: any) {
  return String(v ?? "").trim();
}

function hasValue(v: any) {
  return v !== undefined && v !== null && str(v) !== "";
}

function bool(v: any, defaultValue = false) {
  if (!hasValue(v)) return defaultValue;

  if (typeof v === "boolean") return v;

  if (typeof v === "number") {
    return v !== 0;
  }

  const x = str(v).toLocaleLowerCase("tr-TR");

  if (
    [
      "1",
      "true",
      "yes",
      "evet",
      "e",
      "on",
      "aktif",
      "active",
    ].includes(x)
  ) {
    return true;
  }

  if (
    [
      "0",
      "false",
      "no",
      "hayir",
      "hayır",
      "h",
      "off",
      "pasif",
      "inactive",
    ].includes(x)
  ) {
    return false;
  }

  return defaultValue;
}

function num(v: any, defaultValue = 0) {
  if (!hasValue(v)) return defaultValue;

  if (typeof v === "number") {
    return Number.isFinite(v) ? v : defaultValue;
  }

  let raw = str(v)
    .replace(/\s/g, "")
    .replace(/[₺$€]/g, "");

  /*
   * TR:
   * 1.234,56 -> 1234.56
   *
   * EN:
   * 1,234.56 -> 1234.56
   */

  if (raw.includes(",") && raw.includes(".")) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");

    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (raw.includes(",")) {
    raw = raw.replace(",", ".");
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed)
    ? parsed
    : defaultValue;
}

function optionalNum(v: any): number | undefined {
  if (!hasValue(v)) return undefined;

  const parsed = num(v, NaN);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function nonNegative(v: any, defaultValue = 0) {
  return Math.max(0, num(v, defaultValue));
}

function int(v: any, defaultValue = 0) {
  return Math.floor(num(v, defaultValue));
}

function toPathSafe(value: string) {
  return str(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueStrings(values: any[]) {
  return Array.from(
    new Set(
      values
        .map((x) => str(x))
        .filter(Boolean)
    )
  );
}

function splitFlexible(v: any) {
  const raw = str(v);

  if (!raw) return [];

  return uniqueStrings(
    raw
      .split(/[|\n;]/g)
      .map((x) => x.trim())
  );
}

function splitComma(v: any) {
  const raw = str(v);

  if (!raw) return [];

  return uniqueStrings(
    raw
      .split(/[,|\n;]/g)
      .map((x) => x.trim())
  );
}

function normalizeHeaderObject(row: RowAny): RowAny {
  const result: RowAny = {};

  Object.entries(row || {}).forEach(([key, value]) => {
    const cleanKey = str(key)
      .replace(/^\uFEFF/, "")
      .trim();

    if (cleanKey) {
      result[cleanKey] = value;
    }
  });

  return result;
}

function firstValue(
  row: RowAny,
  ...keys: string[]
) {
  for (const key of keys) {
    if (hasValue(row[key])) {
      return row[key];
    }
  }

  return "";
}
function enumValue<T extends readonly string[]>(
  value: any,
  allowed: T,
  warnings: string[],
  fieldName: string
): T[number] | undefined {
  const clean = str(value);

  if (!clean) {
    return undefined;
  }

  if (
    allowed.includes(
      clean as T[number]
    )
  ) {
    return clean as T[number];
  }

  warnings.push(
    `${fieldName} geçersiz: "${clean}"`
  );

  return undefined;
}
/* =========================================================
   DEEP CLEAN
========================================================= */

function deepClean(value: any): any {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => deepClean(item))
      .filter((item) => item !== undefined);
  }

  if (
    typeof value === "object" &&
    !(value instanceof Date)
  ) {
    const result: Record<string, any> = {};

    Object.entries(value).forEach(([key, item]) => {
      const cleaned = deepClean(item);

      if (cleaned === undefined) {
        return;
      }

      if (
        typeof cleaned === "object" &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned).length === 0
      ) {
        return;
      }

      result[key] = cleaned;
    });

    return Object.keys(result).length
      ? result
      : undefined;
  }

  if (typeof value === "string") {
    const clean = value.trim();

    return clean === ""
      ? undefined
      : clean;
  }

  if (
    typeof value === "number" &&
    !Number.isFinite(value)
  ) {
    return undefined;
  }

  return value;
}

/* =========================================================
   JSON PARSER
========================================================= */

function parseJsonSafe(
  value: any,
  warnings: string[],
  fieldName: string
): any {
  if (!hasValue(value)) return undefined;

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(str(value));
  } catch {
    warnings.push(
      `${fieldName} JSON formatı okunamadı`
    );

    return undefined;
  }
}

/* =========================================================
   VARIANT PARSER
========================================================= */

function cleanVariantNumber(v: any) {
  const value = num(v, 0);

  if (!Number.isFinite(value)) return 0;

  return Math.max(
    0,
    Math.round(value * 10000) / 10000
  );
}

function cleanProductVariantPreset(
  value: any
): CategoryVariantPreset {
  if (!value || typeof value !== "object") {
    return {
      enabled: false,
      groups: [],
    };
  }

  const groupsRaw = Array.isArray(value.groups)
    ? value.groups
    : [];

  const groups: VariantGroup[] = groupsRaw
    .map((group: any, groupIndex: number) => {
      const groupId =
        toPathSafe(str(group?.id)) ||
        `variant-${groupIndex + 1}`;

      const type: VariantGroup["type"] =
        VALID_VARIANT_TYPES.includes(group?.type)
          ? group.type
          : "select";

      const optionsRaw = Array.isArray(group?.options)
        ? group.options
        : [];

      const options: VariantOption[] =
        optionsRaw
          .map(
            (
              option: any,
              optionIndex: number
            ) => {
              const optionValue = str(
                option?.value
              );

              if (!optionValue) return null;

              const hasGram =
                cleanVariantNumber(
                  option?.hasGram ??
                  option?.weightGram ??
                  option?.gram ??
                  0
                );

              return {
                value: optionValue,

                label: {
                  tr:
                    str(option?.label?.tr) ||
                    optionValue,

                  en:
                    str(option?.label?.en) ||
                    optionValue,
                },

                ...(hasGram > 0
                  ? {
                    hasGram,
                    weightGram: hasGram,
                  }
                  : {}),

                priceDelta:
                  cleanVariantNumber(
                    option?.priceDelta
                  ),

                stockDelta:
                  int(option?.stockDelta, 0),

                isActive:
                  option?.isActive !== false,

                order:
                  Number.isFinite(
                    Number(option?.order)
                  )
                    ? Number(option.order)
                    : optionIndex,
              };
            }
          )
          .filter(Boolean) as VariantOption[];

      options.sort(
        (a, b) =>
          Number(a.order ?? 0) -
          Number(b.order ?? 0)
      );

      if (!options.length) {
        return null;
      }

      return {
        id: groupId,

        label: {
          tr:
            str(group?.label?.tr) ||
            groupId,

          en:
            str(group?.label?.en),
        },

        type,

        required:
          group?.required !== false,

        options,
      };
    })
    .filter(Boolean) as VariantGroup[];

  return {
    enabled:
      value.enabled === true &&
      groups.length > 0,

    groups,
  };
}

/* =========================================================
   SIMPLE VARIANT FORMAT
========================================================= */

/*
 Excel'de alternatif kolay format:

 variantGroupId:
 ring_size

 variantLabel_tr:
 Yüzük Ölçüsü

 variantType:
 select

 variantOptions:
 8:2.10:0|9:2.15:100|10:2.20:200

 Format:
 VALUE:HAS_GRAM:PRICE_DELTA
*/

function buildSimpleVariantPreset(
  row: RowAny
): CategoryVariantPreset {
  const groupId =
    toPathSafe(str(row.variantGroupId));

  const rawOptions =
    splitFlexible(row.variantOptions);

  if (!groupId || !rawOptions.length) {
    return {
      enabled: false,
      groups: [],
    };
  }

  const options: VariantOption[] =
    rawOptions
      .map((raw, index) => {
        const parts = raw
          .split(":")
          .map((x) => x.trim());

        const value = str(parts[0]);

        if (!value) return null;

        const hasGram =
          cleanVariantNumber(parts[1]);

        const priceDelta =
          cleanVariantNumber(parts[2]);

        return {
          value,

          label: {
            tr: value,
            en: value,
          },

          ...(hasGram > 0
            ? {
              hasGram,
              weightGram: hasGram,
            }
            : {}),

          priceDelta,
          stockDelta: 0,
          isActive: true,
          order: index,
        };
      })
      .filter(Boolean) as VariantOption[];

  if (!options.length) {
    return {
      enabled: false,
      groups: [],
    };
  }

  const type =
    VALID_VARIANT_TYPES.includes(
      str(row.variantType) as any
    )
      ? (str(row.variantType) as VariantGroup["type"])
      : "select";

  return {
    enabled: true,

    groups: [
      {
        id: groupId,

        label: {
          tr:
            str(row.variantLabel_tr) ||
            groupId,

          en:
            str(row.variantLabel_en),
        },

        type,

        required:
          hasValue(row.variantRequired)
            ? bool(row.variantRequired, true)
            : true,

        options,
      },
    ],
  };
}

/* =========================================================
   DETAIL ROW PARSER
========================================================= */

/*
 detailRows JSON destekler.

 Alternatif:
 detailLabels_tr:
 Materyal|Taş|Ölçü

 detailValues_tr:
 14 Ayar Altın|Zirkon|15 mm

 detailIcons:
 gem|sparkles|ruler
*/

function buildDetailRows(
  row: RowAny,
  warnings: string[]
) {
  const json = parseJsonSafe(
    row.detailRows,
    warnings,
    "detailRows"
  );

  if (Array.isArray(json)) {
    return json
      .map((item: any, index: number) => ({
        id:
          str(item?.id) ||
          `row_${index + 1}`,

        icon:
          str(item?.icon) ||
          undefined,

        label: {
          tr: str(item?.label?.tr),
          en: str(item?.label?.en),
        },

        value: {
          tr: str(item?.value?.tr),
          en: str(item?.value?.en),
        },
      }))
      .filter(
        (item: any) =>
          item.label.tr ||
          item.label.en ||
          item.value.tr ||
          item.value.en
      );
  }

  const labelsTr =
    splitFlexible(row.detailLabels_tr);

  const labelsEn =
    splitFlexible(row.detailLabels_en);

  const valuesTr =
    splitFlexible(row.detailValues_tr);

  const valuesEn =
    splitFlexible(row.detailValues_en);

  const icons =
    splitFlexible(row.detailIcons);

  const count = Math.max(
    labelsTr.length,
    labelsEn.length,
    valuesTr.length,
    valuesEn.length,
    icons.length
  );

  const result = [];

  for (let i = 0; i < count; i++) {
    const labelTr = str(labelsTr[i]);
    const labelEn = str(labelsEn[i]);
    const valueTr = str(valuesTr[i]);
    const valueEn = str(valuesEn[i]);

    if (
      !labelTr &&
      !labelEn &&
      !valueTr &&
      !valueEn
    ) {
      continue;
    }

    result.push({
      id: `row_${i + 1}`,

      icon:
        str(icons[i]) ||
        undefined,

      label: {
        tr: labelTr,
        en: labelEn,
      },

      value: {
        tr: valueTr,
        en: valueEn,
      },
    });
  }

  return result;
}
/* =========================================================
   DIAMOND PARSER
========================================================= */

function buildDiamondData(
  row: RowAny,
  warnings: string[]
): DiamondData | undefined {
  /*
   * Tam JSON desteği:
   *
   * diamond
   * veya
   * diamondJson
   *
   * kolonuna komple JSON verilebilir.
   */
  const diamondJson = parseJsonSafe(
    firstValue(
      row,
      "diamond",
      "diamondJson"
    ),
    warnings,
    "diamond"
  );

  /*
   * Stone Groups ayrıca JSON olarak da
   * verilebilir.
   */
  const stoneGroupsJson =
    parseJsonSafe(
      firstValue(
        row,
        "diamondStoneGroups",
        "stoneGroups"
      ),
      warnings,
      "diamondStoneGroups"
    );

  const source =
    diamondJson &&
      typeof diamondJson === "object" &&
      !Array.isArray(diamondJson)
      ? diamondJson
      : {};

  /* -------------------------------------------------------
     ENABLED
  ------------------------------------------------------- */

  const hasDiamondColumns = [
    row.diamond,
    row.diamondJson,
    row.diamondEnabled,
    row.diamondMetalType,
    row.diamondMetalColor,
    row.diamondMetalKarat,
    row.diamondHandmade,
    row.diamondSettingType,
    row.diamondOrigin,
    row.diamondTotalCarat,
    row.diamondCenterStoneCarat,
    row.diamondTotalStoneQuantity,
    row.diamondCertificateLab,
    row.diamondCertificateNumber,
    row.diamondCertificateUrl,
    row.diamondCertificateNote,
    row.diamondFluorescence,
    row.diamondPolish,
    row.diamondSymmetry,
    row.diamondTreatment,
    row.diamondCountryOrigin,
    row.diamondStoneGroups,
    row.stoneGroups,
  ].some(hasValue);

  const enabled =
    hasValue(row.diamondEnabled)
      ? bool(row.diamondEnabled)
      : hasValue(source.enabled)
        ? bool(source.enabled)
        : hasDiamondColumns ||
        Object.keys(source).length > 0;

  if (!enabled) {
    /*
     * Excel'de diamondEnabled açıkça false verilmişse
     * veya diamond JSON içinde enabled:false varsa
     * pırlanta özelliğini gerçekten kapat.
     */
    if (
      hasValue(row.diamondEnabled) ||
      hasValue(source.enabled)
    ) {
      return {
        enabled: false,
      };
    }

    /*
     * Diamond ile ilgili hiçbir veri yoksa
     * mevcut üründeki pırlanta bilgisine dokunma.
     */
    return undefined;
  }

  /* -------------------------------------------------------
     METAL
  ------------------------------------------------------- */

  const metalType =
    enumValue(
      firstValue(
        row,
        "diamondMetalType",
        "metalType"
      ) || source.metalType,
      VALID_DIAMOND_METAL_TYPES,
      warnings,
      "diamondMetalType"
    );

  const metalColor =
    enumValue(
      firstValue(
        row,
        "diamondMetalColor",
        "metalColor"
      ) || source.metalColor,
      VALID_DIAMOND_METAL_COLORS,
      warnings,
      "diamondMetalColor"
    );

  let metalKarat =
    optionalNum(
      firstValue(
        row,
        "diamondMetalKarat",
        "metalKarat"
      ) || source.metalKarat
    );

  if (
    metalKarat !== undefined &&
    !VALID_DIAMOND_METAL_KARATS.includes(
      metalKarat as any
    )
  ) {
    warnings.push(
      `diamondMetalKarat geçersiz: "${metalKarat}"`
    );

    metalKarat = undefined;
  }

  const settingType =
    enumValue(
      firstValue(
        row,
        "diamondSettingType",
        "settingType"
      ) || source.settingType,
      VALID_DIAMOND_SETTING_TYPES,
      warnings,
      "diamondSettingType"
    );

  /* -------------------------------------------------------
     GENERAL
  ------------------------------------------------------- */

  const diamondOrigin =
    enumValue(
      firstValue(
        row,
        "diamondOrigin"
      ) || source.diamondOrigin,
      VALID_DIAMOND_ORIGINS,
      warnings,
      "diamondOrigin"
    );

  /* -------------------------------------------------------
     QUALITY
  ------------------------------------------------------- */

  const fluorescence =
    enumValue(
      firstValue(
        row,
        "diamondFluorescence"
      ) || source.fluorescence,
      VALID_DIAMOND_FLUORESCENCE,
      warnings,
      "diamondFluorescence"
    );

  const polish =
    enumValue(
      firstValue(
        row,
        "diamondPolish"
      ) || source.polish,
      VALID_DIAMOND_GRADES,
      warnings,
      "diamondPolish"
    );

  const symmetry =
    enumValue(
      firstValue(
        row,
        "diamondSymmetry"
      ) || source.symmetry,
      VALID_DIAMOND_GRADES,
      warnings,
      "diamondSymmetry"
    );

  /* -------------------------------------------------------
     CERTIFICATE
  ------------------------------------------------------- */

  const certificateLab =
    enumValue(
      firstValue(
        row,
        "diamondCertificateLab"
      ) || source.certificateLab,
      VALID_DIAMOND_CERTIFICATE_LABS,
      warnings,
      "diamondCertificateLab"
    );

  /* -------------------------------------------------------
     STONE GROUPS
  ------------------------------------------------------- */

  const rawStoneGroups =
    Array.isArray(stoneGroupsJson)
      ? stoneGroupsJson
      : Array.isArray(source.stoneGroups)
        ? source.stoneGroups
        : [];

  const stoneGroups: DiamondStoneGroup[] =
    rawStoneGroups
      .map(
        (
          stone: any,
          index: number
        ) => {
          const stoneType =
            enumValue(
              stone?.stoneType,
              VALID_DIAMOND_STONE_TYPES,
              warnings,
              `stoneGroups[${index}].stoneType`
            );

          const stoneOrigin =
            enumValue(
              stone?.diamondOrigin,
              VALID_STONE_ORIGINS,
              warnings,
              `stoneGroups[${index}].diamondOrigin`
            );

          const color =
            enumValue(
              stone?.color,
              VALID_DIAMOND_COLORS,
              warnings,
              `stoneGroups[${index}].color`
            );

          const clarity =
            enumValue(
              stone?.clarity,
              VALID_DIAMOND_CLARITIES,
              warnings,
              `stoneGroups[${index}].clarity`
            );

          const cut =
            enumValue(
              stone?.cut,
              VALID_DIAMOND_CUTS,
              warnings,
              `stoneGroups[${index}].cut`
            );

          const stoneFluorescence =
            enumValue(
              stone?.fluorescence,
              VALID_DIAMOND_FLUORESCENCE,
              warnings,
              `stoneGroups[${index}].fluorescence`
            );

          const stonePolish =
            enumValue(
              stone?.polish,
              VALID_DIAMOND_GRADES,
              warnings,
              `stoneGroups[${index}].polish`
            );

          const stoneSymmetry =
            enumValue(
              stone?.symmetry,
              VALID_DIAMOND_GRADES,
              warnings,
              `stoneGroups[${index}].symmetry`
            );

          const stoneCertificateLab =
            enumValue(
              stone?.certificateLab,
              VALID_DIAMOND_CERTIFICATE_LABS,
              warnings,
              `stoneGroups[${index}].certificateLab`
            );

          return deepClean({
            id:
              str(stone?.id) ||
              `stone_${index + 1}`,

            stoneType,

            diamondOrigin:
              stoneOrigin,

            weightCt:
              hasValue(stone?.weightCt)
                ? nonNegative(
                  stone.weightCt
                )
                : undefined,

            quantity:
              hasValue(stone?.quantity)
                ? Math.max(
                  0,
                  int(
                    stone.quantity
                  )
                )
                : undefined,

            color:
              color ||
              undefined,

            clarity,

            cut,

            fluorescence:
              stoneFluorescence,

            polish:
              stonePolish,

            symmetry:
              stoneSymmetry,

            treatment:
              str(
                stone?.treatment
              ) ||
              undefined,

            origin:
              str(stone?.origin) ||
              undefined,

            certificateLab:
              stoneCertificateLab,

            certificateNumber:
              str(
                stone?.certificateNumber
              ) ||
              undefined,
          });
        }
      )
      .filter(Boolean) as DiamondStoneGroup[];

  /* -------------------------------------------------------
     FINAL DIAMOND OBJECT
  ------------------------------------------------------- */

  return deepClean({
    enabled: true,

    metalType,
    metalColor,
    metalKarat,

    handmade:
      hasValue(
        row.diamondHandmade
      )
        ? bool(
          row.diamondHandmade
        )
        : hasValue(
          source.handmade
        )
          ? bool(source.handmade)
          : undefined,

    settingType,

    diamondOrigin,

    totalCarat:
      hasValue(
        row.diamondTotalCarat
      )
        ? nonNegative(
          row.diamondTotalCarat
        )
        : hasValue(
          source.totalCarat
        )
          ? nonNegative(
            source.totalCarat
          )
          : undefined,

    centerStoneCarat:
      hasValue(
        row.diamondCenterStoneCarat
      )
        ? nonNegative(
          row.diamondCenterStoneCarat
        )
        : hasValue(
          source.centerStoneCarat
        )
          ? nonNegative(
            source.centerStoneCarat
          )
          : undefined,

    totalStoneQuantity:
      hasValue(
        row.diamondTotalStoneQuantity
      )
        ? Math.max(
          0,
          int(
            row.diamondTotalStoneQuantity
          )
        )
        : hasValue(
          source.totalStoneQuantity
        )
          ? Math.max(
            0,
            int(
              source.totalStoneQuantity
            )
          )
          : undefined,

    certificateLab,

    certificateNumber:
      str(
        firstValue(
          row,
          "diamondCertificateNumber"
        ) ||
        source.certificateNumber
      ) ||
      undefined,

    certificateUrl:
      str(
        firstValue(
          row,
          "diamondCertificateUrl"
        ) ||
        source.certificateUrl
      ) ||
      undefined,

    certificateNote:
      str(
        firstValue(
          row,
          "diamondCertificateNote"
        ) ||
        source.certificateNote
      ) ||
      undefined,

    fluorescence,
    polish,
    symmetry,

    treatment:
      str(
        firstValue(
          row,
          "diamondTreatment"
        ) ||
        source.treatment
      ) ||
      undefined,

    /*
     * "diamondOrigin" zaten natural/lab_grown.
     *
     * Paneldeki origin ise Menşei alanı.
     * Excel'de karışmaması için
     * diamondCountryOrigin kullanıyoruz.
     */
    origin:
      str(
        firstValue(
          row,
          "diamondCountryOrigin"
        ) ||
        source.origin
      ) ||
      undefined,

    ...(stoneGroups.length
      ? {
        stoneGroups,
      }
      : {}),
  }) as DiamondData;
}
/* =========================================================
   PAGE
========================================================= */

export default function ProductsImportPage() {
  const db = useMemo(
    () => getFirebaseDb(),
    []
  );
  const [safeUpdateMode, setSafeUpdateMode] =
    useState(true);
  const [cats, setCats] =
    useState<CategoryDoc[]>([]);

  const [catMap, setCatMap] =
    useState<Record<string, string>>({});

  const [loadingCats, setLoadingCats] =
    useState(true);

  const [catsError, setCatsError] =
    useState("");

  const [fileName, setFileName] =
    useState("");

  const [items, setItems] =
    useState<ImportProduct[]>([]);

  const [busy, setBusy] =
    useState(false);

  const [progress, setProgress] =
    useState<ImportProgress>({
      done: 0,
      total: 0,
      ok: 0,
      fail: 0,
    });

  const [globalError, setGlobalError] =
    useState("");

  /* =======================================================
     CATEGORY LOAD
  ======================================================= */

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingCats(true);
      setCatsError("");

      try {
        const qy = query(
          collection(db, "categories"),
          orderBy("order", "asc")
        );

        const snap = await getDocs(qy);

        if (!alive) return;

        const list: CategoryDoc[] =
          snap.docs.map((docSnap) => {
            const data: any =
              docSnap.data();

            return {
              id: docSnap.id,

              slug:
                str(data?.slug) ||
                docSnap.id,

              parentId:
                data?.parentId ?? null,

              level:
                typeof data?.level ===
                  "number"
                  ? data.level
                  : undefined,

              isActive:
                typeof data?.isActive ===
                  "boolean"
                  ? data.isActive
                  : undefined,

              name:
                data?.name ??
                data?.title ??
                "",
            };
          });

        const map: Record<
          string,
          string
        > = {};

        for (const category of list) {
          map[category.id] =
            category.id;

          if (category.slug) {
            map[category.slug] =
              category.id;

            map[
              category.slug.toLocaleLowerCase(
                "tr-TR"
              )
            ] = category.id;
          }
        }

        setCats(list);
        setCatMap(map);
      } catch (error: any) {
        console.error(
          "category load error",
          error
        );

        if (!alive) return;

        setCats([]);
        setCatMap({});

        setCatsError(
          error?.message ||
          "Kategoriler yüklenemedi."
        );
      } finally {
        if (alive) {
          setLoadingCats(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [db]);

  /* =======================================================
     CATEGORY RESOLVER
  ======================================================= */

  function resolveCategoryIds(
    row: RowAny,
    warnings: string[]
  ) {
    const tokens = uniqueStrings([
      ...splitComma(row.categoryIds),
      ...splitComma(row.categorySlugs),
    ]);

    const result = new Set<string>();

    for (const token of tokens) {
      const clean = str(token);

      if (!clean) continue;

      const resolved =
        catMap[clean] ||
        catMap[
        clean.toLocaleLowerCase("tr-TR")
        ];

      if (!resolved) {
        warnings.push(
          `Kategori bulunamadı: "${clean}"`
        );

        continue;
      }

      result.add(resolved);
    }

    return Array.from(result);
  }

  /* =======================================================
     FILE PICK
  ======================================================= */

  async function onPickFile(file: File) {
    setGlobalError("");
    setFileName(file.name);
    setItems([]);

    setProgress({
      done: 0,
      total: 0,
      ok: 0,
      fail: 0,
    });

    try {
      const extension =
        file.name
          .toLocaleLowerCase("tr-TR")
          .split(".")
          .pop() || "";

      const isExcel =
        extension === "xlsx" ||
        extension === "xls";

      const isCsv =
        extension === "csv";

      const isNumbers =
        extension === "numbers";

      if (isNumbers) {
        throw new Error(
          "Apple Numbers (.numbers) dosyası algılandı. " +
          "Numbers uygulamasında Dosya → Dışa Aktar → Excel seçerek " +
          ".xlsx formatında kaydet ve tekrar yükle."
        );
      }

      if (!isExcel && !isCsv) {
        throw new Error(
          `Desteklenmeyen dosya formatı: .${extension || "bilinmiyor"}`
        );
      }

      let rows: RowAny[] = [];

      if (isExcel) {
        const buffer =
          await file.arrayBuffer();

        const workbook =
          XLSX.read(buffer, {
            type: "array",
            cellDates: false,
          });

        const firstSheetName =
          workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error(
            "Excel dosyasında sayfa bulunamadı."
          );
        }

        const worksheet =
          workbook.Sheets[firstSheetName];

        if (!worksheet) {
          throw new Error(
            "Excel çalışma sayfası okunamadı."
          );
        }

        rows =
          XLSX.utils.sheet_to_json<RowAny>(
            worksheet,
            {
              defval: "",
              raw: false,
            }
          );
      } else if (isCsv) {
        const text =
          await file.text();

        const parsed =
          Papa.parse<RowAny>(text, {
            header: true,
            skipEmptyLines: true,

            transformHeader: (header) =>
              str(header).replace(
                /^\uFEFF/,
                ""
              ),
          });

        if (parsed.errors.length) {
          console.warn(
            "CSV parse warnings",
            parsed.errors
          );
        }

        rows =
          Array.isArray(parsed.data)
            ? parsed.data
            : [];
      }

      rows = rows
        .map(normalizeHeaderObject)
        .filter((row) =>
          Object.values(row).some(
            (value) => hasValue(value)
          )
        );

      if (!rows.length) {
        throw new Error(
          "Dosyada ürün satırı bulunamadı."
        );
      }

      if (rows.length > MAX_IMPORT_ROWS) {
        throw new Error(
          `Tek seferde en fazla ${MAX_IMPORT_ROWS} ürün içe aktarılabilir. Dosyada ${rows.length} satır var.`
        );
      }

      buildPreview(rows);
    } catch (error: any) {
      console.error(
        "file parse error",
        error
      );

      setGlobalError(
        error?.message ||
        "Dosya okunamadı."
      );
    }
  }

  /* =======================================================
     BUILD PREVIEW
  ======================================================= */

  function buildPreview(data: RowAny[]) {
    const duplicateIds =
      new Map<string, number>();

    const duplicateSlugs =
      new Map<string, number>();

    const duplicateSkus =
      new Map<string, number>();

    const prepared =
      data.map((rawRow, index) => {
        const row =
          normalizeHeaderObject(
            rawRow
          );

        const warnings: string[] = [];
        const errors: string[] = [];

        /* -----------------------------------------------
           BASIC
        ------------------------------------------------ */

        const title =
          str(
            firstValue(
              row,
              "title",
              "title_tr",
              "titleTr"
            )
          );



        let slug =
          toPathSafe(
            str(row.slug)
          );

        let sku =
          str(row.sku);

        if (!slug && title) {
          slug =
            toPathSafe(title);

          warnings.push(
            "slug boştu, başlıktan otomatik üretildi"
          );
        }

        if (!slug && sku) {
          slug =
            toPathSafe(sku);
        }

        if (!sku && slug) {
          sku = slug;

          warnings.push(
            "SKU boştu, slug kullanıldı"
          );
        }

        const explicitId =
          toPathSafe(str(row.id));

        const id =
          explicitId ||
          slug ||
          toPathSafe(sku);

        if (!title) {
          errors.push(
            "Ürün başlığı boş"
          );
        }

        if (!slug) {
          errors.push(
            "Slug üretilemedi"
          );
        }

        if (!id) {
          errors.push(
            "Firestore document ID üretilemedi"
          );
        }

        /* -----------------------------------------------
           DUPLICATES
        ------------------------------------------------ */

        if (id) {
          duplicateIds.set(
            id,
            (duplicateIds.get(id) || 0) +
            1
          );
        }

        if (slug) {
          duplicateSlugs.set(
            slug,
            (duplicateSlugs.get(slug) ||
              0) + 1
          );
        }

        if (sku) {
          const skuKey =
            sku.toLocaleLowerCase(
              "tr-TR"
            );

          duplicateSkus.set(
            skuKey,
            (duplicateSkus.get(
              skuKey
            ) || 0) + 1
          );
        }

        /* -----------------------------------------------
           PRICE MODE
        ------------------------------------------------ */

        const rawPriceMode =
          str(row.priceMode) ||
          "fixed";

        const priceMode =
          rawPriceMode as PriceMode;

        if (
          !VALID_PRICE_MODES.includes(
            priceMode
          )
        ) {
          errors.push(
            `priceMode geçersiz: ${rawPriceMode}`
          );
        }

        /* -----------------------------------------------
           PRICE MOTOR 2
        ------------------------------------------------ */

        const price2Enabled =
          bool(
            row.price2Enabled,
            false
          );

        const rawPrice2Mode =
          str(row.price2Mode) ||
          "weight_rate";

        const price2Mode =
          rawPrice2Mode as PriceMode;

        if (
          price2Enabled &&
          !VALID_PRICE_MODES.includes(
            price2Mode
          )
        ) {
          errors.push(
            `price2Mode geçersiz: ${rawPrice2Mode}`
          );
        }

        /* -----------------------------------------------
           CATEGORY
        ------------------------------------------------ */

        const categoryIds =
          resolveCategoryIds(
            row,
            warnings
          );

        if (!categoryIds.length) {
          warnings.push(
            "Geçerli kategori seçilmedi"
          );
        }

        /* -----------------------------------------------
           IMAGES
        ------------------------------------------------ */

        const images =
          uniqueStrings([
            ...splitFlexible(
              row.images
            ),

            ...(hasValue(row.image)
              ? [row.image]
              : []),

            ...(hasValue(
              row.mainImage
            )
              ? [row.mainImage]
              : []),
          ]);

        const hasImportedImages =
          images.length > 0;
        /* -----------------------------------------------
           ADVANCED
        ------------------------------------------------ */

        const detailRows =
          buildDetailRows(
            row,
            warnings
          );
        const diamond =
          buildDiamondData(
            row,
            warnings
          );
        const advanced: any = {
          ...(diamond
            ? {
              diamond,
            }
            : {}),
          shortDescription: {
            tr: str(
              row.shortDescription_tr
            ),

            en: str(
              row.shortDescription_en
            ),
          },

          description: {
            tr: str(
              row.description_tr
            ),

            en: str(
              row.description_en
            ),
          },

          colors:
            splitFlexible(
              row.colors
            )
              .map((value) => {
                const separator =
                  value.indexOf(":");

                if (
                  separator === -1
                ) {
                  return {
                    name: value,
                  };
                }

                return {
                  name: str(
                    value.slice(
                      0,
                      separator
                    )
                  ),

                  hex: str(
                    value.slice(
                      separator + 1
                    )
                  ),
                };
              })
              .filter(
                (color) =>
                  color.name
              ),

          sizes:
            splitFlexible(
              row.sizes
            ),

          tags:
            splitFlexible(
              row.tags
            ),

          galleryVideos:
            splitFlexible(
              row.galleryVideos
            ),

          hasSizeOptions:
            hasValue(
              row.hasSizeOptions
            )
              ? bool(
                row.hasSizeOptions
              )
              : splitFlexible(
                row.sizes
              ).length > 0,

          detailRows,

          specs: {
            weightGr:
              optionalNum(
                row.weightGr
              ),

            widthMm:
              optionalNum(
                row.widthMm
              ),

            lengthMm:
              hasValue(
                row.lengthCm
              )
                ? num(
                  row.lengthCm
                ) * 10
                : optionalNum(
                  row.lengthMm
                ),

            heightMm:
              optionalNum(
                row.heightMm
              ),
          },

          shipping: {
            fastShipping:
              hasValue(
                row.fastShipping
              )
                ? bool(
                  row.fastShipping
                )
                : true,

            shippingDaysMin:
              hasValue(
                row.shippingDaysMin
              )
                ? nonNegative(
                  row.shippingDaysMin
                )
                : 1,

            shippingDaysMax:
              hasValue(
                row.shippingDaysMax
              )
                ? nonNegative(
                  row.shippingDaysMax
                )
                : 3,

            cargoNote:
              str(row.cargoNote),
          },

          returns: {
            title: {
              tr:
                str(
                  row.returnsTitle_tr
                ) ||
                "İade & Değişim",

              en:
                str(
                  row.returnsTitle_en
                ) ||
                "Returns & Exchange",
            },

            content: {
              tr: str(
                row.returnsContent_tr
              ),

              en: str(
                row.returnsContent_en
              ),
            },
          },

          seo: {
            title: {
              tr: str(
                row.seoTitle_tr
              ),

              en: str(
                row.seoTitle_en
              ),
            },

            description: {
              tr: str(
                row.seoDesc_tr
              ),

              en: str(
                row.seoDesc_en
              ),
            },

            keywords:
              splitFlexible(
                row.seoKeywords
              ),

            ogImage:
              str(row.ogImage) ||
              (hasImportedImages
                ? images[0]
                : ""),

            canonical:
              str(row.canonical) ||
              (slug
                ? `/products/${slug}`
                : ""),
          },
        };

        /* -----------------------------------------------
           VARIANT
        ------------------------------------------------ */

        let productVariantPreset:
          CategoryVariantPreset = {
          enabled: false,
          groups: [],
        };

        const variantJson =
          parseJsonSafe(
            row.productVariantPreset,
            warnings,
            "productVariantPreset"
          );

        if (variantJson) {
          productVariantPreset =
            cleanProductVariantPreset(
              variantJson
            );
        } else {
          productVariantPreset =
            buildSimpleVariantPreset(
              row
            );
        }

        /* -----------------------------------------------
           HOME
        ------------------------------------------------ */

        let homeSections =
          splitFlexible(
            row.homeSections
          );

        if (
          bool(
            row.isBestseller,
            false
          ) &&
          !homeSections.includes(
            "bestsellers"
          )
        ) {
          homeSections.push(
            "bestsellers"
          );
        }

        if (
          bool(
            row.isFeatured,
            false
          ) &&
          !homeSections.includes(
            "featured"
          )
        ) {
          homeSections.push(
            "featured"
          );
        }

        homeSections =
          uniqueStrings(
            homeSections
          );

        /* -----------------------------------------------
           SHOWCASE
        ------------------------------------------------ */

        const showcaseGroups =
          splitFlexible(
            row.showcaseGroups
          );

        const showcaseEnabled =
          hasValue(
            row.showcaseEnabled
          )
            ? bool(
              row.showcaseEnabled
            )
            : showcaseGroups.length >
            0;

        /* -----------------------------------------------
           BUNDLE
        ------------------------------------------------ */

        const setBundleProductIds =
          splitFlexible(
            row.setBundleProductIds
          );

        const rawDiscountType =
          str(
            row.setBundleDiscountType
          ) || "none";

        const setBundleDiscountType =
          VALID_BUNDLE_DISCOUNT_TYPES.includes(
            rawDiscountType as any
          )
            ? rawDiscountType
            : "none";

        if (
          rawDiscountType !==
          setBundleDiscountType
        ) {
          warnings.push(
            `Geçersiz setBundleDiscountType "${rawDiscountType}", none kullanıldı`
          );
        }

        /* -----------------------------------------------
           GRAM
        ------------------------------------------------ */

        const gram =
          nonNegative(
            firstValue(
              row,
              "gram",
              "weightGram"
            ),
            0
          );

        const hasGram =
          nonNegative(
            firstValue(
              row,
              "hasGram",
              "gram",
              "weightGram"
            ),
            0
          );

        /* -----------------------------------------------
           PAYLOAD
        ------------------------------------------------ */

        const payload: any = {
          /*
           * ProductEdit title STRING bekliyor.
           * Burada obje kullanmıyoruz.
           */
          title,

          slug,
          sku,

          price:
            nonNegative(
              row.price,
              0
            ),

          currency:
            str(row.currency) ||
            "TRY",

          ...(hasImportedImages
            ? {
              images,
              image: images[0],
              mainImage: images[0],
            }
            : {}),

          stock: Math.max(
            1,
            nonNegative(
              row.stock,
              1
            )
          ),

          stockAlarm:
            nonNegative(
              row.stockAlarm,
              0
            ),

          karat:
            hasValue(row.karat)
              ? nonNegative(row.karat)
              : diamond?.metalKarat ?? 22,

          gram,
          hasGram,

          categoryIds,

          homeSections,

          isActive:
            hasValue(
              row.isActive
            )
              ? bool(
                row.isActive
              )
              : true,

          isBestseller:
            bool(
              row.isBestseller,
              false
            ),

          isFeatured:
            bool(
              row.isFeatured,
              false
            ),

          /* PRICE MOTOR 1 */

          priceMode,

          priceRateCode:
            str(
              row.priceRateCode
            ),

          pricePercent:
            num(
              row.pricePercent,
              0
            ),

          priceFixedAdd:
            num(
              row.priceFixedAdd,
              0
            ),

          /* PRICE MOTOR 2 */

          price2Enabled,

          ...(price2Enabled
            ? {
              price2Mode,

              price2RateCode:
                str(
                  row.price2RateCode
                ),

              price2HasGram:
                nonNegative(
                  row.price2HasGram,
                  0
                ),

              price2Percent:
                num(
                  row.price2Percent,
                  0
                ),

              price2FixedAdd:
                num(
                  row.price2FixedAdd,
                  0
                ),
            }
            : {}),

          /* OVERRIDE */

          priceOverrideEnabled:
            bool(
              row.priceOverrideEnabled,
              false
            ),

          priceOverride:
            nonNegative(
              row.priceOverride,
              0
            ),

          /* COMPARE AT */

          compareAtOverrideEnabled:
            bool(
              row.compareAtOverrideEnabled,
              false
            ),

          compareAtEnabled:
            bool(
              row.compareAtEnabled,
              false
            ),

          compareAtPercent:
            nonNegative(
              row.compareAtPercent,
              0
            ),

          /* FINAL */

          finalPrice:
            hasValue(
              row.finalPrice
            )
              ? nonNegative(
                row.finalPrice
              )
              : nonNegative(
                row.price
              ),

          finalCurrency:
            str(
              row.finalCurrency
            ) ||
            str(row.currency) ||
            "TRY",

          /* ICON */

          badgeIconUrl:
            str(
              row.badgeIconUrl
            ),

          badgeIconAlt: {
            tr: str(
              row.badgeIconAlt_tr
            ),

            en: str(
              row.badgeIconAlt_en
            ),
          },

          /* VARIANT */

          productVariantPreset,

          /* SHOWCASE */

          showcase: {
            enabled:
              showcaseEnabled,

            groups:
              showcaseGroups,

            order:
              num(
                row.showcaseOrder,
                999
              ),
          },

          /* BUNDLE */

          setBundle: {
            enabled:
              hasValue(
                row.setBundleEnabled
              )
                ? bool(
                  row.setBundleEnabled
                )
                : setBundleProductIds.length >
                0,

            title: {
              tr:
                str(
                  row.setBundleTitle_tr
                ) ||
                "Set olarak satın al",

              en:
                str(
                  row.setBundleTitle_en
                ) ||
                "Buy as a set",
            },

            subtitle: {
              tr:
                str(
                  row.setBundleSubtitle_tr
                ) ||
                "Uyumlu parçaları tek seferde sepete ekleyerek daha güçlü bir kombin oluştur.",

              en:
                str(
                  row.setBundleSubtitle_en
                ) ||
                "Build a stronger combination by adding matching pieces at once.",
            },

            productIds:
              setBundleProductIds,

            discountType:
              setBundleDiscountType,

            discountValue:
              nonNegative(
                row.setBundleDiscountValue,
                0
              ),
          },

          advanced:
            deepClean(
              advanced
            ),

          updatedAt:
            new Date().toISOString(),

          ...(hasValue(
            row.createdAt
          )
            ? {
              createdAt:
                row.createdAt,
            }
            : {}),
        };

        /*
         * Eski importer'daki showInParentCategories
         * kullanılıyorsa koruyoruz.
         */
        if (
          hasValue(
            row.showInParentCategories
          )
        ) {
          payload.showInParentCategories =
            bool(
              row.showInParentCategories,
              true
            );
        }

        return {
          rowNumber: index + 2,
          id,
          payload:
            deepClean(payload) ||
            {},
          warnings,
          errors,
          status:
            "ready" as ImportStatus,
        };
      });

    /* =====================================================
       DUPLICATE VALIDATION
    ===================================================== */

    prepared.forEach((item) => {
      const id = item.id;

      const slug =
        str(item.payload.slug);

      const sku =
        str(
          item.payload.sku
        ).toLocaleLowerCase(
          "tr-TR"
        );

      if (
        id &&
        (duplicateIds.get(id) ||
          0) > 1
      ) {
        item.errors.push(
          `Dosyada aynı document ID birden fazla kez var: ${id}`
        );
      }

      if (
        slug &&
        (duplicateSlugs.get(
          slug
        ) || 0) > 1
      ) {
        item.errors.push(
          `Dosyada aynı slug birden fazla kez var: ${slug}`
        );
      }

      if (
        sku &&
        (duplicateSkus.get(
          sku
        ) || 0) > 1
      ) {
        item.warnings.push(
          `Dosyada aynı SKU birden fazla kez var: ${item.payload.sku}`
        );
      }

      item.errors =
        uniqueStrings(
          item.errors
        );

      item.warnings =
        uniqueStrings(
          item.warnings
        );
    });

    setItems(prepared);
  }

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary = useMemo(() => {
    let errors = 0;
    let warnings = 0;

    items.forEach((item) => {
      errors +=
        item.errors.length;

      warnings +=
        item.warnings.length;
    });

    return {
      products: items.length,
      errors,
      warnings,

      ready: items.filter(
        (x) =>
          !x.errors.length
      ).length,
    };
  }, [items]);

  /* =======================================================
     IMPORT
  ======================================================= */

  async function doImport() {
    if (!items.length) {
      return;
    }

    if (busy) {
      return;
    }

    const invalid =
      items.filter(
        (item) =>
          item.errors.length > 0
      );

    if (invalid.length) {
      alert(
        `${invalid.length} üründe kritik hata var. Hataları düzeltmeden içe aktarma yapılamaz.`
      );

      return;
    }

    const confirmed =
      window.confirm(
        `${items.length} ürün Firestore'a yazılacak.\n\nAynı document ID mevcutsa ürün güncellenecek.\n\nDevam edilsin mi?`
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);

    setProgress({
      done: 0,
      total: items.length,
      ok: 0,
      fail: 0,
    });

    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: "ready",
        importError:
          undefined,
      }))
    );

    let ok = 0;
    let fail = 0;

    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const item =
        items[index];

      setItems((prev) =>
        prev.map(
          (current, i) =>
            i === index
              ? {
                ...current,
                status:
                  "importing",
              }
              : current
        )
      );

      try {
        if (!item.id) {
          throw new Error(
            "Document ID boş."
          );
        }

        const fullPayload = item.payload;

        const safePayload: any = {
          updatedAt: new Date().toISOString(),

          // TEMEL
          title: fullPayload.title,
          slug: fullPayload.slug,
          sku: fullPayload.sku,

          // KATEGORİ
          categoryIds: fullPayload.categoryIds,

          // DURUM
          isActive: fullPayload.isActive,

          // GRAM / AYAR
          karat: fullPayload.karat,
          gram: fullPayload.gram,
          hasGram: fullPayload.hasGram,

          // =========================
          // FİYAT MOTORU 1
          // =========================
          priceMode: fullPayload.priceMode,
          currency: fullPayload.currency,
          price: fullPayload.price,

          priceRateCode: fullPayload.priceRateCode,
          pricePercent: fullPayload.pricePercent,
          priceFixedAdd: fullPayload.priceFixedAdd,

          // MANUEL FİYAT
          priceOverrideEnabled:
            fullPayload.priceOverrideEnabled,

          priceOverride:
            fullPayload.priceOverride,

          // İNDİRİM
          compareAtOverrideEnabled:
            fullPayload.compareAtOverrideEnabled,

          compareAtEnabled:
            fullPayload.compareAtEnabled,

          compareAtPercent:
            fullPayload.compareAtPercent,

          // HESAPLANMIŞ FİYAT
          finalPrice: fullPayload.finalPrice,
          finalCurrency: fullPayload.finalCurrency,

          // =========================
          // FİYAT MOTORU 2
          // =========================
          price2Enabled:
            fullPayload.price2Enabled,

          ...(fullPayload.price2Enabled
            ? {
              price2Mode:
                fullPayload.price2Mode,

              price2RateCode:
                fullPayload.price2RateCode,

              price2HasGram:
                fullPayload.price2HasGram,

              price2Percent:
                fullPayload.price2Percent,

              price2FixedAdd:
                fullPayload.price2FixedAdd,
            }
            : {}),

          // HOME / SHOWCASE
          homeSections:
            fullPayload.homeSections,

          showcase:
            fullPayload.showcase,

          // VARIANT
          productVariantPreset:
            fullPayload.productVariantPreset,
        };
        const safeAdvanced: any = {};

        /*
         * AÇIKLAMA
         */
        if (fullPayload?.advanced?.shortDescription) {
          safeAdvanced.shortDescription =
            fullPayload.advanced.shortDescription;
        }

        if (fullPayload?.advanced?.description) {
          safeAdvanced.description =
            fullPayload.advanced.description;
        }

        /*
         * DETAYLAR
         */
        if (fullPayload?.advanced?.detailRows) {
          safeAdvanced.detailRows =
            fullPayload.advanced.detailRows;
        }

        /*
         * SPECS
         */
        if (fullPayload?.advanced?.specs) {
          safeAdvanced.specs =
            fullPayload.advanced.specs;
        }

        /*
         * PIRLANTA
         */
        if (fullPayload?.advanced?.diamond) {
          safeAdvanced.diamond =
            fullPayload.advanced.diamond;
        }

        /*
         * ADVANCED altında gerçekten veri varsa ekle
         */
        if (Object.keys(safeAdvanced).length > 0) {
          safePayload.advanced = safeAdvanced;
        }
        /*
         * Eğer Excel'de açıkça gönderilmişse SKU vs.
         * ekleyebiliriz; fakat şu an istemiyoruz.
         */

        await upsertDoc(
          "products",
          item.id,
          safeUpdateMode
            ? safePayload
            : fullPayload
        );

        ok++;

        setItems((prev) =>
          prev.map(
            (current, i) =>
              i === index
                ? {
                  ...current,
                  status:
                    "success",
                  importError:
                    undefined,
                }
                : current
          )
        );
      } catch (error: any) {
        console.error(
          "product import fail",
          item.id,
          error
        );

        fail++;

        setItems((prev) =>
          prev.map(
            (current, i) =>
              i === index
                ? {
                  ...current,
                  status:
                    "failed",
                  importError:
                    error?.message ||
                    "Bilinmeyen hata",
                }
                : current
          )
        );
      }

      setProgress({
        done: index + 1,
        total: items.length,
        ok,
        fail,
      });
    }

    setBusy(false);

    alert(
      `İçe aktarma tamamlandı.\n\nBaşarılı: ${ok}\nBaşarısız: ${fail}`
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div
      style={{
        padding: 20,
        display: "grid",
        gap: 16,
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      {/* HEADER */}

      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 950,
          }}
        >
          Toplu Ürün Yükleme
        </h1>

        <div
          style={{
            marginTop: 6,
            opacity: 0.68,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          CSV, XLS ve XLSX dosyalarından
          ürünleri doğrula, önizle ve
          Firestore&apos;a aktar.
          Apple Numbers dosyaları Excel (.xlsx)
          olarak dışa aktarıldıktan sonra yüklenebilir.
        </div>
      </div>

      {/* CATEGORY STATUS */}

      <div
        style={{
          padding: 14,
          borderRadius: 16,
          border:
            "1px solid rgba(15,23,42,.08)",
          background: "#fff",
        }}
      >
        {loadingCats ? (
          <div
            style={{
              fontWeight: 850,
            }}
          >
            ⏳ Kategoriler yükleniyor…
          </div>
        ) : catsError ? (
          <div
            style={{
              color: "#b91c1c",
              fontWeight: 850,
            }}
          >
            ❌ {catsError}
          </div>
        ) : (
          <div
            style={{
              fontWeight: 850,
              color: "#166534",
            }}
          >
            ✓ {cats.length} kategori
            hazır
          </div>
        )}
      </div>
      {/* EXCEL TEMPLATE DOWNLOAD */}

      <div
        style={{
          padding: 18,
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,.08)",
          background: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#ecfdf5",
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            📊
          </div>

          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 950,
                color: "#0f172a",
              }}
            >
              Pırlanta Toplu Ürün Şablonu
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: 700,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              Pırlanta ürünlerini toplu yüklemek için hazırlanmış
              Excel şablonunu indir, ürünleri doldur ve tekrar
              buradan yükle.
            </div>
          </div>
        </div>

        <a
          href="/templates/pirlanta-toplu-urun-sablonu.xlsx"
          download="pirlanta-toplu-urun-sablonu.xlsx"
          style={{
            padding: "11px 16px",
            borderRadius: 12,
            border: "1px solid rgba(22,101,52,.15)",
            background: "#166534",
            color: "#fff",
            fontWeight: 900,
            fontSize: 13,
            textDecoration: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          ⬇️ Excel Şablonunu İndir
        </a>
      </div>
      {/* FILE PICKER */}

      <div
        style={{
          padding: 18,
          borderRadius: 18,
          border:
            "1px solid rgba(15,23,42,.08)",
          background: "#fff",
          display: "flex",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            padding: "11px 16px",
            borderRadius: 12,
            border: 0,
            background: "#0f172a",
            color: "#fff",
            fontWeight: 900,
            cursor:
              loadingCats || busy
                ? "not-allowed"
                : "pointer",
            opacity:
              loadingCats || busy
                ? 0.5
                : 1,
          }}
        >
          📂 Dosya Seç

          <input
            type="file"
            accept=".csv,.xlsx,.xls,.numbers"
            disabled={
              loadingCats || busy
            }
            style={{
              display: "none",
            }}
            onChange={(e) => {
              const file =
                e.target.files?.[0];

              if (file) {
                void onPickFile(
                  file
                );
              }

              e.currentTarget.value =
                "";
            }}
          />
        </label>

        <div
          style={{
            fontWeight: 800,
            opacity: 0.75,
          }}
        >
          {fileName
            ? `Seçilen: ${fileName}`
            : "Henüz dosya seçilmedi"}
        </div>
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 14,
          borderRadius: 14,
          background: "#f8fafc",
          border: "1px solid rgba(15,23,42,.08)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={safeUpdateMode}
          onChange={(e) =>
            setSafeUpdateMode(e.target.checked)
          }
        />

        <div>
          <div
            style={{
              fontWeight: 900,
            }}
          >
            🛡️ Güvenli Güncelleme Modu
          </div>

          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              opacity: 0.7,
              fontWeight: 700,
            }}
          >
            Mevcut ürünlerde yalnızca Excel&apos;de verilen alanları
            günceller. Görsel, fiyat ve diğer mevcut bilgiler korunur.
          </div>
        </div>
      </label>
      {/* GLOBAL ERROR */}

      {globalError ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#fef2f2",
            border:
              "1px solid #fecaca",
            color: "#991b1b",
            fontWeight: 850,
          }}
        >
          ❌ {globalError}
        </div>
      ) : null}

      {/* SUMMARY */}

      {items.length ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(150px,1fr))",
              gap: 10,
            }}
          >
            <SummaryCard
              label="Ürün"
              value={
                summary.products
              }
            />

            <SummaryCard
              label="Hazır"
              value={summary.ready}
            />

            <SummaryCard
              label="Uyarı"
              value={
                summary.warnings
              }
            />

            <SummaryCard
              label="Hata"
              value={
                summary.errors
              }
            />
          </div>

          {/* IMPORT CARD */}

          <div
            style={{
              padding: 16,
              borderRadius: 18,
              border:
                "1px solid rgba(15,23,42,.08)",
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: 16,
                  }}
                >
                  Ürün Önizleme
                </div>

                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.65,
                    marginTop: 3,
                    fontWeight: 700,
                  }}
                >
                  {items.length} ürün
                  analiz edildi.
                </div>
              </div>

              <button
                type="button"
                disabled={
                  busy ||
                  summary.errors > 0
                }
                onClick={() =>
                  void doImport()
                }
                style={{
                  padding:
                    "11px 18px",
                  borderRadius: 12,
                  border: 0,

                  background:
                    summary.errors > 0
                      ? "#94a3b8"
                      : "#0f172a",

                  color: "#fff",
                  fontWeight: 950,

                  cursor:
                    busy ||
                      summary.errors > 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {busy
                  ? `⏳ ${progress.done}/${progress.total}`
                  : "🚀 İçe Aktar"}
              </button>
            </div>

            {/* PROGRESS */}

            {progress.total > 0 ? (
              <div
                style={{
                  marginTop: 14,
                }}
              >
                <div
                  style={{
                    height: 8,
                    background:
                      "#e2e8f0",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progress.total
                        ? Math.round(
                          (progress.done /
                            progress.total) *
                          100
                        )
                        : 0
                        }%`,
                      background:
                        "#0f172a",
                      transition:
                        "width .2s ease",
                    }}
                  />
                </div>

                <div
                  style={{
                    marginTop: 7,
                    fontSize: 12,
                    fontWeight: 850,
                  }}
                >
                  {progress.done}/
                  {progress.total}
                  {" • "}
                  Başarılı:{" "}
                  {progress.ok}
                  {" • "}
                  Hata:{" "}
                  {progress.fail}
                </div>
              </div>
            ) : null}

            {/* ITEMS */}

            <div
              style={{
                marginTop: 14,
                maxHeight: 600,
                overflow: "auto",
                borderTop:
                  "1px solid rgba(15,23,42,.06)",
              }}
            >
              {items.map(
                (item, index) => {
                  const image =
                    item.payload
                      ?.images?.[0] ||
                    FALLBACK_PRODUCT_LOGO;

                  return (
                    <div
                      key={`${item.id}-${index}`}
                      style={{
                        padding:
                          "13px 4px",
                        borderBottom:
                          "1px solid rgba(15,23,42,.06)",
                        display:
                          "flex",
                        gap: 12,
                        alignItems:
                          "flex-start",
                      }}
                    >
                      {/* IMAGE */}

                      {image ? (
                        <img
                          src={image}
                          alt=""
                          style={{
                            width: 58,
                            height: 58,
                            borderRadius: 12,
                            objectFit:
                              "cover",
                            background:
                              "#f1f5f9",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 58,
                            height: 58,
                            borderRadius: 12,
                            background:
                              "#f1f5f9",
                            display:
                              "grid",
                            placeItems:
                              "center",
                          }}
                        >
                          📷
                        </div>
                      )}

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                            alignItems:
                              "center",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <strong>
                            {index + 1}.{" "}
                            {item.payload
                              ?.title ||
                              "—"}
                          </strong>

                          <StatusBadge
                            status={
                              item.status
                            }
                          />
                        </div>

                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            opacity: 0.72,
                            fontWeight: 750,
                          }}
                        >
                          ID:{" "}
                          {item.id ||
                            "—"}
                          {" • "}
                          SKU:{" "}
                          {item.payload
                            ?.sku ||
                            "—"}
                          {" • "}
                          {item.payload
                            ?.karat ||
                            0}
                          K
                          {" • "}
                          {item.payload
                            ?.hasGram ||
                            0}{" "}
                          gr
                        </div>

                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            opacity: 0.72,
                            fontWeight: 750,
                          }}
                        >
                          Kategori:{" "}
                          {(
                            item.payload
                              ?.categoryIds ||
                            []
                          ).join(", ") ||
                            "—"}
                          {" • "}
                          Fiyat:{" "}
                          {item.payload
                            ?.priceMode}
                          {" • "}
                          Kur:{" "}
                          {item.payload
                            ?.priceRateCode ||
                            "—"}
                        </div>

                        {item.warnings
                          .length ? (
                          <div
                            style={{
                              marginTop: 6,
                              color:
                                "#a16207",
                              fontSize: 12,
                              fontWeight: 850,
                            }}
                          >
                            ⚠{" "}
                            {item.warnings.join(
                              " • "
                            )}
                          </div>
                        ) : null}

                        {item.errors
                          .length ? (
                          <div
                            style={{
                              marginTop: 6,
                              color:
                                "#b91c1c",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            ❌{" "}
                            {item.errors.join(
                              " • "
                            )}
                          </div>
                        ) : null}

                        {item.importError ? (
                          <div
                            style={{
                              marginTop: 6,
                              color:
                                "#b91c1c",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            Firestore:{" "}
                            {
                              item.importError
                            }
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* INFO */}

      <div
        style={{
          padding: 14,
          borderRadius: 14,
          background: "#f8fafc",
          border:
            "1px solid rgba(15,23,42,.06)",
          fontSize: 12,
          fontWeight: 750,
          lineHeight: 1.7,
          color: "#475569",
        }}
      >
        <strong>
          Import sistemi:
        </strong>{" "}
        kategori alanında slug veya
        Firestore document ID
        kullanabilirsin. Bulunamayan
        kategoriler ürüne yazılmaz ve
        uyarı olarak gösterilir. Aynı
        document ID mevcutsa{" "}
        <code>upsertDoc</code>{" "}
        davranışına göre ürün
        güncellenir.
      </div>
    </div>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        background: "#fff",
        border:
          "1px solid rgba(15,23,42,.08)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 850,
          opacity: 0.6,
          textTransform:
            "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 24,
          fontWeight: 950,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: ImportStatus;
}) {
  let text = "Hazır";
  let background = "#e2e8f0";
  let color = "#334155";

  if (status === "importing") {
    text = "Yükleniyor";
    background = "#dbeafe";
    color = "#1d4ed8";
  }

  if (status === "success") {
    text = "Başarılı";
    background = "#dcfce7";
    color = "#166534";
  }

  if (status === "failed") {
    text = "Hata";
    background = "#fee2e2";
    color = "#991b1b";
  }

  return (
    <span
      style={{
        padding: "3px 8px",
        borderRadius: 999,
        background,
        color,
        fontSize: 10,
        fontWeight: 900,
      }}
    >
      {text}
    </span>
  );
}