"use client";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase.client";

type UploadFolder = "product-images" | "category-images" | "settings-images";

const MAX_IMAGE_SIZE_MB = 8;
const MAX_IMAGE_SIZE = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

function toPathSafe(s: string) {
  const raw = String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const safe = raw
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  return safe || "image";
}

function extFromMime(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg") return "jpg";
  return "jpg";
}

function normalizeImageFile(file: File) {
  const type = String(file.type || "").trim().toLowerCase();

  if (!ALLOWED_TYPES.includes(type as any)) {
    throw new Error("Sadece PNG, JPG/JPEG veya WEBP görsel yükleyebilirsin.");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`Görsel en fazla ${MAX_IMAGE_SIZE_MB} MB olabilir.`);
  }

  const ext = extFromMime(type);
  const base = toPathSafe(file.name.replace(/\.[^/.]+$/, ""));

  return {
    contentType: type,
    ext,
    base,
  };
}

function uniquePart() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export async function uploadImage(options: {
  file: File;
  folder: UploadFolder;
  entityId: string;
}) {
  const storage = getFirebaseStorage();

  const { contentType, ext, base } = normalizeImageFile(options.file);

  const safeId = toPathSafe(options.entityId || "x");
  const path = `${options.folder}/${safeId}/${Date.now()}-${uniquePart()}-${base}.${ext}`;

  const r = ref(storage, path);

  await uploadBytes(r, options.file, {
    contentType,
    cacheControl: "public,max-age=31536000,immutable",
  });

  return await getDownloadURL(r);
}

export async function uploadProductImage(file: File, productId: string) {
  return uploadImage({
    file,
    folder: "product-images",
    entityId: productId,
  });
}

export async function uploadCategoryImage(file: File, categorySlug: string) {
  return uploadImage({
    file,
    folder: "category-images",
    entityId: categorySlug,
  });
}

export async function uploadPromoImage(file: File, promoId: string) {
  return uploadImage({
    file,
    folder: "settings-images",
    entityId: `promo-${promoId}`,
  });
}

export async function uploadPromoThumb(file: File, promoId: string) {
  return uploadImage({
    file,
    folder: "settings-images",
    entityId: `promo-${promoId}-thumb`,
  });
}

export async function uploadSettingsImage(file: File, settingsKey: string) {
  return uploadImage({
    file,
    folder: "settings-images",
    entityId: settingsKey,
  });
}