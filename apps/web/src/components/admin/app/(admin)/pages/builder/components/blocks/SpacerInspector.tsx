"use client";

import styles from "./SpacerInspector.module.css";

type SpacerBlock = {
  id: string;
  type: "spacer";
  height?: number;
  isActive?: boolean;
};

type Props = {
  block: SpacerBlock;
  onPatch: (patch: Partial<SpacerBlock>) => void;
};

export default function SpacerInspector({ block, onPatch }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <div className={styles.kicker}>Spacer Block</div>
          <h3 className={styles.title}>Boşluk Ayarları</h3>
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
        <label className={styles.label}>Yükseklik (px)</label>
        <input
          className={styles.input}
          type="number"
          value={String(block.height ?? 24)}
          onChange={(e) => onPatch({ height: Number(e.target.value || 0) })}
        />
      </div>

      <div className={styles.preview}>
        <div className={styles.previewInner} style={{ height: `${block.height ?? 24}px` }} />
      </div>
    </div>
  );
}