"use client";

import styles from "./RichTextInspector.module.css";

type LocaleText = { tr?: string; en?: string };

type RichTextBlock = {
  id: string;
  type: "richText";
  html?: LocaleText;
  isActive?: boolean;
};

type Props = {
  block: RichTextBlock;
  onPatch: (patch: Partial<RichTextBlock>) => void;
  onLT: (key: string, loc: "tr" | "en", value: string) => void;
};

export default function RichTextInspector({ block, onPatch, onLT }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <div className={styles.kicker}>Rich Text Block</div>
          <h3 className={styles.title}>Metin / HTML Ayarları</h3>
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

      <div className={styles.note}>
        HTML destekli. Sonra editor de bağlarız ama şimdilik bu taş gibi çalışır.
      </div>

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>TR HTML</label>
          <textarea
            className={styles.textarea}
            value={block.html?.tr || ""}
            onChange={(e) => onLT("html", "tr", e.target.value)}
            placeholder="<p>TR içerik</p>"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>EN HTML</label>
          <textarea
            className={styles.textarea}
            value={block.html?.en || ""}
            onChange={(e) => onLT("html", "en", e.target.value)}
            placeholder="<p>EN content</p>"
          />
        </div>
      </div>
    </div>
  );
}