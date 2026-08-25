"use client";

import styles from "./ButtonInspector.module.css";

type LocaleText = { tr?: string; en?: string };

type ButtonBlock = {
  id: string;
  type: "button";
  label?: LocaleText;
  href?: string;
  variant?: "primary" | "soft";
  align?: "left" | "center" | "right";
  isActive?: boolean;
};

type Props = {
  block: ButtonBlock;
  onPatch: (patch: Partial<ButtonBlock>) => void;
  onLT: (key: string, loc: "tr" | "en", value: string) => void;
};

export default function ButtonInspector({ block, onPatch, onLT }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <div className={styles.kicker}>Button Block</div>
          <h3 className={styles.title}>Buton Ayarları</h3>
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

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>Varyant</label>
          <select
            className={styles.select}
            value={block.variant || "primary"}
            onChange={(e) => onPatch({ variant: e.target.value as ButtonBlock["variant"] })}
          >
            <option value="primary">primary</option>
            <option value="soft">soft</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Hizalama</label>
          <select
            className={styles.select}
            value={block.align || "left"}
            onChange={(e) => onPatch({ align: e.target.value as ButtonBlock["align"] })}
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label}>Label TR</label>
          <input
            className={styles.input}
            value={block.label?.tr || ""}
            onChange={(e) => onLT("label", "tr", e.target.value)}
            placeholder="TR label"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Label EN</label>
          <input
            className={styles.input}
            value={block.label?.en || ""}
            onChange={(e) => onLT("label", "en", e.target.value)}
            placeholder="EN label"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Href</label>
        <input
          className={styles.input}
          value={block.href || ""}
          onChange={(e) => onPatch({ href: e.target.value })}
          placeholder="/shop veya https://..."
        />
      </div>
    </div>
  );
}