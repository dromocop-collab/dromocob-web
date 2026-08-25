"use client";

import styles from "./SliderInspector.module.css";

type LocaleText = { tr?: string; en?: string };

type SlideItem = {
  title?: LocaleText;
  subtitle?: LocaleText;
  image?: string;
  cta?: {
    label?: LocaleText;
    href?: string;
  };
  isActive?: boolean;
};

type SliderBlock = {
  id: string;
  type: "slider";
  slides?: SlideItem[];
  isActive?: boolean;
};

type Props = {
  block: SliderBlock;
  onPatch: (patch: Partial<SliderBlock>) => void;
  sliderUploading: boolean;
  onUploadSlide: (blockId: string, slideIndex: number, file: File) => Promise<void> | void;
};

export default function SliderInspector({
  block,
  onPatch,
  sliderUploading,
  onUploadSlide,
}: Props) {
  const slides = Array.isArray(block.slides) ? block.slides : [];

  function updateSlide(index: number, patch: Partial<SlideItem>) {
    const next = slides.slice();
    next[index] = { ...next[index], ...patch };
    onPatch({ slides: next });
  }

  function updateSlideLT(
    index: number,
    key: "title" | "subtitle",
    loc: "tr" | "en",
    value: string
  ) {
    const next = slides.slice();
    const current = next[index] || {};
    next[index] = {
      ...current,
      [key]: {
        ...((current as any)[key] || {}),
        [loc]: value,
      },
    };
    onPatch({ slides: next });
  }

  function updateSlideCtaLabel(index: number, loc: "tr" | "en", value: string) {
    const next = slides.slice();
    const current = next[index] || {};
    next[index] = {
      ...current,
      cta: {
        ...(current.cta || {}),
        label: {
          ...(current.cta?.label || {}),
          [loc]: value,
        },
      },
    };
    onPatch({ slides: next });
  }

  function removeSlide(index: number) {
    onPatch({ slides: slides.filter((_, i) => i !== index) });
  }

  function addSlide() {
    onPatch({
      slides: [
        ...slides,
        {
          isActive: true,
          title: { tr: "Yeni Slide", en: "New Slide" },
          subtitle: { tr: "", en: "" },
          image: "",
          cta: {
            href: "/shop",
            label: { tr: "Mağaza", en: "Shop" },
          },
        },
      ],
    });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <div className={styles.kicker}>Slider Block</div>
          <h3 className={styles.title}>Slider Ayarları</h3>
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

      <div className={styles.actionRow}>
        <button className={styles.addBtn} type="button" onClick={addSlide}>
          + Slide Ekle
        </button>
        <span className={styles.countPill}>
          {sliderUploading ? "Yükleniyor..." : `${slides.length} slide`}
        </span>
      </div>

      <div className={styles.list}>
        {slides.map((slide, idx) => (
          <div key={idx} className={styles.slideBox}>
            <div className={styles.slideHead}>
              <b>Slide #{idx + 1}</b>
              <div className={styles.slideHeadActions}>
                <label className={styles.switchRowMini}>
                  <input
                    type="checkbox"
                    checked={slide.isActive !== false}
                    onChange={(e) => updateSlide(idx, { isActive: e.target.checked })}
                  />
                  <span>Aktif</span>
                </label>

                <button className={styles.delBtn} type="button" onClick={() => removeSlide(idx)}>
                  Sil
                </button>
              </div>
            </div>

            <div className={styles.grid2}>
              <input
                className={styles.input}
                value={slide.title?.tr || ""}
                onChange={(e) => updateSlideLT(idx, "title", "tr", e.target.value)}
                placeholder="Başlık TR"
              />
              <input
                className={styles.input}
                value={slide.title?.en || ""}
                onChange={(e) => updateSlideLT(idx, "title", "en", e.target.value)}
                placeholder="Title EN"
              />
            </div>

            <div className={styles.grid2}>
              <textarea
                className={styles.textarea}
                value={slide.subtitle?.tr || ""}
                onChange={(e) => updateSlideLT(idx, "subtitle", "tr", e.target.value)}
                placeholder="Alt başlık TR"
              />
              <textarea
                className={styles.textarea}
                value={slide.subtitle?.en || ""}
                onChange={(e) => updateSlideLT(idx, "subtitle", "en", e.target.value)}
                placeholder="Subtitle EN"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Görsel URL</label>
              <input
                className={styles.input}
                value={slide.image || ""}
                onChange={(e) => updateSlide(idx, { image: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <label className={styles.uploadBtn}>
              Slide Görseli Yükle
              <input
                type="file"
                accept="image/*"
                className={styles.hiddenFile}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (!file) return;
                  void onUploadSlide(String(block.id), idx, file);
                }}
              />
            </label>

            <div className={styles.grid2}>
              <input
                className={styles.input}
                value={slide.cta?.href || ""}
                onChange={(e) =>
                  updateSlide(idx, {
                    cta: {
                      ...(slide.cta || {}),
                      href: e.target.value,
                    },
                  })
                }
                placeholder="CTA href"
              />
              <input
                className={styles.input}
                value={slide.cta?.label?.tr || ""}
                onChange={(e) => updateSlideCtaLabel(idx, "tr", e.target.value)}
                placeholder="CTA label TR"
              />
            </div>

            <input
              className={styles.input}
              value={slide.cta?.label?.en || ""}
              onChange={(e) => updateSlideCtaLabel(idx, "en", e.target.value)}
              placeholder="CTA label EN"
            />
          </div>
        ))}
      </div>
    </div>
  );
}