"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref as sRef, uploadBytes } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase.client";
import type { AnyBlock, PageDoc } from "../types";
import { pickLT, str } from "../utils";

export function usePageBuilder(id: string) {
  const db = useMemo(() => getFirebaseDb(), []);
  const storage = useMemo(() => getFirebaseStorage(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [docData, setDocData] = useState<PageDoc | null>(null);
  const [blocks, setBlocks] = useState<AnyBlock[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [htmlTr, setHtmlTr] = useState("<p></p>");
  const [htmlEn, setHtmlEn] = useState("<p></p>");
  const [sliderUploading, setSliderUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(""), 1600);
  }

  useEffect(() => {
    if (!id) return;
    const r = doc(db, "pages", id);
    return onSnapshot(
      r,
      (snap) => {
        if (!snap.exists()) {
          setDocData(null);
          setBlocks([]);
          setSelectedId("");
          setLoading(false);
          return;
        }

        const d = (snap.data() || {}) as any;
        const raw: PageDoc = d?.pageDoc && typeof d.pageDoc === "object" ? d.pageDoc : d;

        setDocData(raw);
        const list = Array.isArray(raw.blocks) ? raw.blocks : [];
        setBlocks(list);
        setHtmlTr(String(raw?.contentHtml?.tr ?? "<p></p>"));
        setHtmlEn(String(raw?.contentHtml?.en ?? "<p></p>"));
        setLoading(false);

        setSelectedId((prev) => prev || String(list[0]?.id || ""));
      },
      () => {
        setDocData(null);
        setBlocks([]);
        setSelectedId("");
        setLoading(false);
      }
    );
  }, [db, id]);

  const selected = blocks.find((b) => String(b.id) === String(selectedId)) || null;
  const group = str(docData?.group);
  const slug = str(docData?.slug);
  const titleTR = pickLT("tr", docData?.title, slug || id);
  const publicUrl = group && slug ? `/${group}/${slug}` : "";

  function updateBlock(id0: string, patch: any) {
    setBlocks((prev) =>
      prev.map((b) => (String(b.id) === String(id0) ? ({ ...b, ...patch } as AnyBlock) : b))
    );
  }

  function updateBlockLT(id0: string, key: string, loc: "tr" | "en", value: string) {
    setBlocks((prev) =>
      prev.map((b: any) => {
        if (String(b.id) !== String(id0)) return b;
        const cur = typeof b[key] === "object" && b[key] ? b[key] : {};
        return { ...b, [key]: { ...cur, [loc]: value } };
      })
    );
  }

  function removeBlock(id0: string) {
    setBlocks((prev) => prev.filter((b) => String(b.id) !== String(id0)));
    setSelectedId((prev) => (prev === id0 ? "" : prev));
  }

  function moveBlock(id0: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => String(b.id) === String(id0));
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  async function uploadToBlockImage(blockId: string) {
    const f = fileRef.current?.files?.[0];
    if (!f) return;

    setSaving(true);
    try {
      const path = `pages/${id}/${blockId}/${Date.now()}-${f.name}`;
      const r = sRef(storage, path);
      await uploadBytes(r, f);
      const url = await getDownloadURL(r);
      updateBlock(blockId, { src: url });
      showToast("Görsel yüklendi ✅");
    } catch (e: any) {
      showToast(e?.message || "Yüklenemedi");
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onUploadSlide(blockId: string, slideIndex: number, file: File) {
    setSliderUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `pages/${id}/${blockId}/slides/${slideIndex + 1}-${Date.now()}-${safeName}`;
      const r = sRef(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);

      setBlocks((prev) =>
        prev.map((b: any) => {
          if (String(b.id) !== String(blockId)) return b;
          const slides = Array.isArray(b.slides) ? b.slides : [];
          const nextSlides = slides.slice();
          nextSlides[slideIndex] = { ...(nextSlides[slideIndex] || {}), image: url };
          return { ...b, slides: nextSlides };
        })
      );

      showToast("Slide görseli yüklendi ✅");
    } catch (e: any) {
      showToast(e?.message || "Slide yüklenemedi");
    } finally {
      setSliderUploading(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "pages", id),
        {
          blocks,
          contentHtml: { tr: htmlTr, en: htmlEn },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("Kaydedildi ✅");
    } catch (e: any) {
      showToast(e?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return {
    loading,
    saving,
    toast,
    docData,
    blocks,
    selected,
    selectedId,
    setSelectedId,
    htmlTr,
    setHtmlTr,
    htmlEn,
    setHtmlEn,
    fileRef,
    sliderUploading,
    publicUrl,
    titleTR,
    updateBlock,
    updateBlockLT,
    removeBlock,
    moveBlock,
    uploadToBlockImage,
    onUploadSlide,
    saveAll,
    setBlocks,
    showToast,
  };
}