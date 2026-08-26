"use client";

import styles from "./HeadingInspector.module.css";

type LocaleText = { tr?: string; en?: string };

type HeadingBlock = {
  id: string;
  type: "heading";
  title?: LocaleText;
  subtitle?: LocaleText;
  align?: "left" | "center" | "right";
  isActive?: boolean;
};

type Props = {
  block: HeadingBlock;
  onPatch: (patch: Partial<HeadingBlock>) => void;
  onLT: (key: string, loc: "tr" | "en", value: string) => void;
};

export default function HeadingInspector({ block, onPatch, onLT }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <div className={styles.kicker}>Heading Block</div>
          <h3 className={styles.title}>Başlık Ayarları</h3>
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
        <label className={styles.label}>Hizalama</label>
        <select
          className={styles.select}
          value={block.align || "left"}
          onChange={(e) => onPatch({ align: e.target.value as HeadingBlock["align"] })}
        >
          <option value="left">Sol</option>
          <option value="center">Orta</option>
          <option value="right">Sağ</option>
        </select>
      </div>

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>Başlık TR</label>
          <input
            className={styles.input}
            value={block.title?.tr || ""}
            onChange={(e) => onLT("title", "tr", e.target.value)}
            placeholder="TR başlık"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Başlık EN</label>
          <input
            className={styles.input}
            value={block.title?.en || ""}
            onChange={(e) => onLT("title", "en", e.target.value)}
            placeholder="EN title"
          />
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>Alt Başlık TR</label>
          <textarea
            className={styles.textarea}
            value={block.subtitle?.tr || ""}
            onChange={(e) => onLT("subtitle", "tr", e.target.value)}
            placeholder="TR alt başlık"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Alt Başlık EN</label>
          <textarea
            className={styles.textarea}
            value={block.subtitle?.en || ""}
            onChange={(e) => onLT("subtitle", "en", e.target.value)}
            placeholder="EN subtitle"
          />
        </div>
      </div>
    </div>
  );
}