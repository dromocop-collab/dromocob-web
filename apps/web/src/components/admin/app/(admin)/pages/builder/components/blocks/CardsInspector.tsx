"use client";

import styles from "./CardsInspector.module.css";

type LocaleText = { tr?: string; en?: string };

type CardItem = {
  title?: LocaleText;
  desc?: LocaleText;
  icon?: string;
};

type CardsBlock = {
  id: string;
  type: "cards";
  columns?: number;
  items?: CardItem[];
  isActive?: boolean;
};

type Props = {
  block: CardsBlock;
  onPatch: (patch: Partial<CardsBlock>) => void;
};

export default function CardsInspector({ block, onPatch }: Props) {
  const items = Array.isArray(block.items) ? block.items : [];

  function updateItem(index: number, patch: Partial<CardItem>) {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onPatch({ items: next });
  }

  function updateItemLT(index: number, key: "title" | "desc", loc: "tr" | "en", value: string) {
    const next = items.slice();
    const current = next[index] || {};
    next[index] = {
      ...current,
      [key]: {
        ...((current as any)[key] || {}),
        [loc]: value,
      },
    };
    onPatch({ items: next });
  }

  function removeItem(index: number) {
    onPatch({ items: items.filter((_, i) => i !== index) });
  }

  function addItem() {
    onPatch({
      items: [
        ...items,
        {
          title: { tr: "Yeni Kart", en: "New Card" },
          desc: { tr: "", en: "" },
          icon: "",
        },
      ],
    });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <div className={styles.kicker}>Cards Block</div>
          <h3 className={styles.title}>Kartlar Ayarları</h3>
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
        <label className={styles.label}>Kolon Sayısı</label>
        <select
          className={styles.select}
          value={String(block.columns || 3)}
          onChange={(e) => onPatch({ columns: Number(e.target.value) })}
        >
          <option value="2">2 kolon</option>
          <option value="3">3 kolon</option>
          <option value="4">4 kolon</option>
        </select>
      </div>

      <div className={styles.actionRow}>
        <button className={styles.addBtn} type="button" onClick={addItem}>
          + Kart Ekle
        </button>
        <span className={styles.countPill}>{items.length} kart</span>
      </div>

      <div className={styles.list}>
        {items.map((item, idx) => (
          <div key={idx} className={styles.cardBox}>
            <div className={styles.cardHead}>
              <b>Kart #{idx + 1}</b>
              <button className={styles.delBtn} type="button" onClick={() => removeItem(idx)}>
                Sil
              </button>
            </div>

            <div className={styles.grid2}>
              <input
                className={styles.input}
                value={item.title?.tr || ""}
                onChange={(e) => updateItemLT(idx, "title", "tr", e.target.value)}
                placeholder="Başlık TR"
              />
              <input
                className={styles.input}
                value={item.title?.en || ""}
                onChange={(e) => updateItemLT(idx, "title", "en", e.target.value)}
                placeholder="Title EN"
              />
            </div>

            <div className={styles.grid2}>
              <textarea
                className={styles.textarea}
                value={item.desc?.tr || ""}
                onChange={(e) => updateItemLT(idx, "desc", "tr", e.target.value)}
                placeholder="Açıklama TR"
              />
              <textarea
                className={styles.textarea}
                value={item.desc?.en || ""}
                onChange={(e) => updateItemLT(idx, "desc", "en", e.target.value)}
                placeholder="Description EN"
              />
            </div>

            <input
              className={styles.input}
              value={item.icon || ""}
              onChange={(e) => updateItem(idx, { icon: e.target.value })}
              placeholder="icon adı (opsiyonel)"
            />
          </div>
        ))}
      </div>
    </div>
  );
}