"use client";

import type React from "react";
import styles from "./ImageInspector.module.css";

type LocaleText = { tr?: string; en?: string };

type ImageBlock = {
  id: string;
  type: "image";
  src?: string;
  alt?: LocaleText;
  link?: string;
  isActive?: boolean;
};

type Props = {
  block: ImageBlock;
  onPatch: (patch: Partial<ImageBlock>) => void;
  onLT: (key: string, loc: "tr" | "en", value: string) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  onUpload: () => void;
  saving: boolean;
};

export default function ImageInspector({
  block,
  onPatch,
  onLT,
  fileRef,
  onUpload,
  saving,
}: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <div className={styles.kicker}>Image Block</div>
          <h3 className={styles.title}>Görsel Ayarları</h3>
        </div>

        <label className={styles.switchRow}>
          <input
            type="checkbox"
            checked={block.isActive !== false}
            onChange={(e) => onPatch({ isActive: e.target.checked })}
          />
          <span>Aktif</span>
        </label>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Görsel URL</label>
        <input
          className={styles.input}
          value={block.src || ""}
          onChange={(e) => onPatch({ src: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <div className={styles.uploadRow}>
        <label className={styles.uploadBtn}>
          Dosya Seç
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className={styles.hiddenFile}
          />
        </label>

        <button
          className={styles.primaryBtn}
          type="button"
          onClick={onUpload}
          disabled={saving}
        >
          {saving ? "Yükleniyor..." : "Yükle"}
        </button>
      </div>

      {block.src ? (
        <div className={styles.previewBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src} alt="" className={styles.previewImg} />
        </div>
      ) : null}

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>Alt TR</label>
          <input
            className={styles.input}
            value={block.alt?.tr || ""}
            onChange={(e) => onLT("alt", "tr", e.target.value)}
            placeholder="TR alt text"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Alt EN</label>
          <input
            className={styles.input}
            value={block.alt?.en || ""}
            onChange={(e) => onLT("alt", "en", e.target.value)}
            placeholder="EN alt text"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Tıklama Linki</label>
        <input
          className={styles.input}
          value={block.link || ""}
          onChange={(e) => onPatch({ link: e.target.value })}
          placeholder="/shop veya https://..."
        />
      </div>
    </div>
  );
}