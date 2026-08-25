"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref as sRef, uploadBytes } from "firebase/storage";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
} from "@dnd-kit/sortable";

import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase.client";
import s from "./builder.module.css";
import type { AnyBlock, BlockKind, PageDoc } from "./types";
import { str, pickLT, makeDefaultBlock } from "./utils";
import BlockLibrary from "./components/BlockLibrary";
import BuilderCanvas from "./components/BuilderCanvas";
import InspectorPanel from "./components/InspectorPanel";

export default function BuilderScreen({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const db = useMemo(() => getFirebaseDb(), []);
  const storage = useMemo(() => getFirebaseStorage(), []);
  const id = decodeURIComponent(params.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [docData, setDocData] = useState<PageDoc | null>(null);
  const [blocks, setBlocks] = useState<AnyBlock[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [htmlTr, setHtmlTr] = useState("<p></p>");
  const [htmlEn, setHtmlEn] = useState("<p></p>");
  const [sliderUploading, setSliderUploading] = useState(false);

  const [activeDragId, setActiveDragId] = useState<string>("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(""), 1600);
  }

  useEffect(() => {
    if (!id) return;

    const pageRef = doc(db, "pages", id);

    return onSnapshot(
      pageRef,
      (snap) => {
        if (!snap.exists()) {
          setDocData(null);
          setBlocks([]);
          setSelectedId("");
          setLoading(false);
          return;
        }

        const data = (snap.data() || {}) as any;
        const raw: PageDoc =
          data?.pageDoc && typeof data.pageDoc === "object" ? data.pageDoc : data;

        const nextBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];

        setDocData(raw);
        setBlocks(nextBlocks);
        setHtmlTr(String(raw?.contentHtml?.tr ?? "<p></p>"));
        setHtmlEn(String(raw?.contentHtml?.en ?? "<p></p>"));
        setLoading(false);

        setSelectedId((prev) => {
          if (prev && nextBlocks.some((b) => String(b.id) === String(prev))) {
            return prev;
          }
          return nextBlocks[0]?.id ? String(nextBlocks[0].id) : "";
        });
      },
      () => {
        setDocData(null);
        setBlocks([]);
        setSelectedId("");
        setLoading(false);
      }
    );
  }, [db, id]);

  const group = str(docData?.group);
  const slug = str(docData?.slug);
  const titleTR = pickLT("tr", docData?.title, slug || id);
  const publicUrl = group && slug ? `/${group}/${slug}` : "";

  const selected = useMemo(() => {
    return blocks.find((b) => String(b.id) === String(selectedId)) || null;
  }, [blocks, selectedId]);

  function updateBlock(blockId: string, patch: Partial<AnyBlock>) {
    setBlocks((prev) =>
      prev.map((b) =>
        String(b.id) === String(blockId) ? ({ ...b, ...patch } as AnyBlock) : b
      )
    );
  }

  function updateBlockLT(
    blockId: string,
    key: string,
    loc: "tr" | "en",
    value: string
  ) {
    setBlocks((prev) =>
      prev.map((b: any) => {
        if (String(b.id) !== String(blockId)) return b;
        const current = typeof b[key] === "object" && b[key] ? b[key] : {};
        return { ...b, [key]: { ...current, [loc]: value } };
      })
    );
  }

  function addBlock(type: BlockKind) {
    const block = makeDefaultBlock(type);
    setBlocks((prev) => [...prev, block]);
    setSelectedId(String(block.id));
  }

  function insertBlockAt(type: BlockKind, index: number) {
    const block = makeDefaultBlock(type);

    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 0, block);
      return next;
    });

    setSelectedId(String(block.id));
  }

  function removeBlock(blockId: string) {
    if (!confirm("Blok silinsin mi?")) return;

    setBlocks((prev) => prev.filter((b) => String(b.id) !== String(blockId)));
    setSelectedId((prev) => (String(prev) === String(blockId) ? "" : prev));
  }

  function moveBlock(blockId: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const currentIndex = prev.findIndex((b) => String(b.id) === String(blockId));
      if (currentIndex < 0) return prev;

      const nextIndex = currentIndex + dir;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;

      return arrayMove(prev, currentIndex, nextIndex);
    });
  }

  async function uploadToBlockImage(blockId: string) {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setSaving(true);

    try {
      const path = `pages/${id}/${blockId}/${Date.now()}-${file.name}`;
      const storageRef = sRef(storage, path);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      updateBlock(blockId, { src: url } as Partial<AnyBlock>);
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
      const storageRef = sRef(storage, path);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setBlocks((prev) =>
        prev.map((b: any) => {
          if (String(b.id) !== String(blockId)) return b;

          const slides = Array.isArray(b.slides) ? [...b.slides] : [];
          slides[slideIndex] = {
            ...(slides[slideIndex] || {}),
            image: url,
          };

          return { ...b, slides };
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
          contentHtml: {
            tr: htmlTr,
            en: htmlEn,
          },
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

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  setActiveDragId("");

  if (!over) return;

  const activeId = String(active.id);
  const overId = String(over.id);

  // 1) Sol kütüphaneden yeni blok sürüklenip bırakıldıysa
  if (activeId.startsWith("library:")) {
    const blockType = active.data.current?.blockType as BlockKind | undefined;
    if (!blockType) return;

    // boş canvas alanına bırakıldı
    if (overId === "canvas-dropzone") {
      addBlock(blockType);
      return;
    }

    // mevcut bir bloğun üstüne bırakıldıysa, onun indexine ekle
    if (overId.startsWith("block:")) {
      const targetBlockId = overId.replace("block:", "");
      const targetIndex = blocks.findIndex(
        (b) => String(b.id) === String(targetBlockId)
      );

      if (targetIndex >= 0) {
        insertBlockAt(blockType, targetIndex);
        return;
      }
    }

    return;
  }

  // 2) Canvas içindeki blokların kendi arasında sıralanması
  if (activeId.startsWith("block:") && overId.startsWith("block:")) {
    const activeBlockId = activeId.replace("block:", "");
    const overBlockId = overId.replace("block:", "");

    if (activeBlockId === overBlockId) return;

    const oldIndex = blocks.findIndex(
      (b) => String(b.id) === String(activeBlockId)
    );
    const newIndex = blocks.findIndex(
      (b) => String(b.id) === String(overBlockId)
    );

    if (oldIndex < 0 || newIndex < 0) return;

    setBlocks((prev) => arrayMove(prev, oldIndex, newIndex));
    setSelectedId(activeBlockId);
    return;
  }
}

  if (loading) {
    return (
      <main className={s.page}>
        <div className={s.emptyBox}>Yükleniyor…</div>
      </main>
    );
  }

  if (!docData) {
    return (
      <main className={s.page}>
        <div className={s.emptyBox}>
          <b>Sayfa bulunamadı</b>

          <div className={s.hint}>
            id: <span className={s.mono}>{id}</span>
          </div>

          <div style={{ marginTop: 10 }}>
            <button
              className={s.softBtn}
              type="button"
              onClick={() => router.push("/admin/pages")}
            >
              ← Liste
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      {toast ? <div className={s.toast}>{toast}</div> : null}

      <div className={s.top}>
        <div>
          <div className={s.kicker}>Admin • Builder</div>
          <h1 className={s.title}>{titleTR}</h1>

          <div className={s.sub}>
            id: <b className={s.mono}>{id}</b>
            {publicUrl ? (
              <>
                {" "}• URL:{" "}
                <a
                  className={s.mono}
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {publicUrl}
                </a>
              </>
            ) : null}
          </div>
        </div>

        <div className={s.right}>
          <button
            className={s.softBtn}
            type="button"
            onClick={() => router.push("/admin/pages")}
          >
            ← Liste
          </button>

          {publicUrl ? (
            <a className={s.softBtn} href={publicUrl} target="_blank" rel="noreferrer">
              Gör
            </a>
          ) : null}

          <button
            className={s.primaryBtn}
            type="button"
            onClick={saveAll}
            disabled={saving}
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={s.builderGrid}>
          <div className={s.builderSide}>
            <BlockLibrary />
          </div>

          <div className={s.builderMid}>
            <BuilderCanvas
              blocks={blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMoveUp={(blockId) => moveBlock(blockId, -1)}
              onMoveDown={(blockId) => moveBlock(blockId, 1)}
              onToggleActive={(blockId) => {
                const found = blocks.find((b) => String(b.id) === String(blockId));
                if (!found) return;
                updateBlock(blockId, { isActive: found.isActive === false });
              }}
              onRemove={removeBlock}
            />

            <div className={s.card} style={{ marginTop: 12 }}>
              <b className={s.miniTitle}>HTML (Legacy) — TR/EN</b>

              <div className={s.grid2}>
                <div>
                  <div className={s.miniTitle}>TR (HTML)</div>
                  <textarea
                    className={s.textarea}
                    value={htmlTr}
                    onChange={(e) => setHtmlTr(e.target.value)}
                  />
                </div>

                <div>
                  <div className={s.miniTitle}>EN (HTML)</div>
                  <textarea
                    className={s.textarea}
                    value={htmlEn}
                    onChange={(e) => setHtmlEn(e.target.value)}
                  />
                </div>
              </div>

              <div className={s.hint}>Blocks kullanıyorsan HTML’i boş bırakabilirsin.</div>
            </div>
          </div>

          <div className={s.builderSide}>
            <div className={s.card}>
              <div className={s.rowBetween}>
                <b className={s.miniTitle}>Blok Ayarları</b>
                {selected ? <span className={s.pill}>{selected.type}</span> : null}
              </div>

              <InspectorPanel
                block={selected}
                onPatch={(patch) => {
                  if (!selected) return;
                  updateBlock(String(selected.id), patch);
                }}
                onLT={(key, loc, val) => {
                  if (!selected) return;
                  updateBlockLT(String(selected.id), key, loc, val);
                }}
                fileRef={fileRef}
                onUpload={() => {
                  if (!selected) return;
                  void uploadToBlockImage(String(selected.id));
                }}
                saving={saving}
                onUploadSlide={onUploadSlide}
                sliderUploading={sliderUploading}
              />
            </div>
          </div>
        </div>

        <DragOverlay>
  {activeDragId ? (
    <div className={s.dragOverlay}>
      {activeDragId.startsWith("library:")
        ? activeDragId.replace("library:", "")
        : activeDragId.replace("block:", "")}
    </div>
  ) : null}
</DragOverlay>
      </DndContext>
    </main>
  );
}