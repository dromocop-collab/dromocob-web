"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase.client";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import { uploadSettingsImage } from "@/lib/uploadProductImage";
import styles from "./aboutAdmin.module.css";

function s(v: any) {
  return String(v ?? "").trim();
}

const DEFAULTS = {
  isActive: true,
  hero: {
    eyebrow: "Dromocob",
    title: "İyi Tasarlanmış Deneyimler İçin Dromocob Yanınızda",
    description: "",
    primaryLabel: "Koleksiyonu İncele",
    primaryHref: "/shop",
    secondaryLabel: "Bizimle İletişime Geç",
    secondaryHref: "/iletisim",
  },
  story: {
    title: "Bizim Hikâyemiz",
    text1: "",
    text2: "",
  },
  gallery: {
    mainImage: "",
    sideImage1: "",
    sideImage2: "",
    mainTitle: "Mağaza dış cephesi veya en güçlü kurumsal kare",
    sideTitle1: "İç Mekân / Vitrin",
    sideTitle2: "Marka / Detay Kareleri",
  },
  highlights: [
    {
      title: "Köklü Deneyim",
      text: "Yılların birikimiyle şekillenen güven anlayışımızı, her misafirimize aynı özenle sunuyoruz.",
    },
    {
      title: "Özenli Seçki",
      text: "Her ürün; tasarım, işçilik ve materyal kalitesi açısından titizlikle değerlendirilerek koleksiyonumuza dahil edilir.",
    },
    {
      title: "Anlam Taşıyan Takılar",
      text: "Takıyı yalnızca bir aksesuar değil; hatıraları, duyguları ve özel anları taşıyan kıymetli bir parça olarak görüyoruz.",
    },
    {
      title: "Misafir Odaklı Yaklaşım",
      text: "Kapımızdan içeri giren herkesi müşteri değil, değerli dostumuz olarak görür; memnuniyeti merkeze koyarız.",
    },
  ],
  beliefs: {
    eyebrow: "Neye İnanıyoruz",
    title: "Her zevke hitap eden, her anı değerli kılan bir seçki",
    description:
      "Geniş ürün yelpazemizle farklı tarzlara, farklı hikâyelere ve farklı beğenilere hitap ediyoruz.",
    items: [
      "Zarafeti güçlü bir sunumla buluşturan seçkin özel ürün anlayışı",
      "Farklı tarzlara ve zevklere hitap eden geniş ürün yelpazesi",
      "Usta işçilikle şekillenen, güven veren kalite standardı",
      "Samimi, şeffaf ve uzun vadeli ilişki kuran hizmet yaklaşımı",
    ],
  },
  cta: {
    eyebrow: "Misafirlerimiz Önce Gelir",
    title: "Bizim için kıymetli misafir değil, değerli dostsunuz",
    description:
      "Dromocob olarak kapımızdan içeri giren herkesi saygıyla karşılar, memnuniyet odaklı bir yaklaşımı ilke ediniriz.",
    cards: [
      { title: "Konum", text: "İstanbul’nin kalbinde" },
      { title: "Yaklaşım", text: "Güven, zarafet, memnuniyet" },
      { title: "Amaç", text: "Herkesin kalbine dokunan seçimler" },
    ],
  },
};

export default function AdminAboutPage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings_admin">
        <AdminAboutPageInner />
      </PermissionGate>
    </AdminGate>
  );
}

function AdminAboutPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const ref = useMemo(() => doc(db, "site_options", "about_page"), [db]);

  const [cfg, setCfg] = useState<any>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    return onSnapshot(ref, (snap) => {
      setCfg({ ...DEFAULTS, ...(snap.data() || {}) });
    });
  }, [ref]);

  async function save() {
    setSaving(true);
    try {
      await setDoc(
        ref,
        {
          ...cfg,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMsg("Kaydedildi ✅");
      setTimeout(() => setMsg(""), 1600);
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(
    key: "mainImage" | "sideImage1" | "sideImage2",
    file?: File | null
  ) {
    if (!file) return;
    const url = await uploadSettingsImage(file, "about-page");
    setCfg((p: any) => ({
      ...p,
      gallery: {
        ...p.gallery,
        [key]: url,
      },
    }));
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.kicker}>Admin • Hakkımızda</div>
            <h1 className={styles.title}>Hakkımızda Sayfası Yönetimi</h1>
            <p className={styles.sub}>
              Hero metinleri, hikâye alanı ve görselleri buradan yönet.
            </p>
          </div>

          <div className={styles.heroRight}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={save}
              disabled={saving}
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </section>

        {msg ? <div className={`${styles.alert} ${styles.alertOk}`}>{msg}</div> : null}

        <div className={styles.layout}>
          <div className={styles.leftCol}>
            <div className={styles.stack}>
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.cardTitleWrap}>
                    <h2 className={styles.cardTitle}>Hero</h2>
                    <p className={styles.cardSub}>Üst alan başlık ve açıklama metinleri</p>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.grid2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Eyebrow</label>
                      <input
                        className={styles.input}
                        value={cfg.hero.eyebrow}
                        onChange={(e) =>
                          setCfg({ ...cfg, hero: { ...cfg.hero, eyebrow: e.target.value } })
                        }
                        placeholder="Eyebrow"
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Başlık</label>
                      <input
                        className={styles.input}
                        value={cfg.hero.title}
                        onChange={(e) =>
                          setCfg({ ...cfg, hero: { ...cfg.hero, title: e.target.value } })
                        }
                        placeholder="Başlık"
                      />
                    </div>
                  </div>

                  <div className={styles.field} style={{ marginTop: 16 }}>
                    <label className={styles.label}>Açıklama</label>
                    <textarea
                      className={styles.textarea}
                      value={cfg.hero.description}
                      onChange={(e) =>
                        setCfg({ ...cfg, hero: { ...cfg.hero, description: e.target.value } })
                      }
                      placeholder="Açıklama"
                      rows={5}
                    />
                  </div>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.cardTitleWrap}>
                    <h2 className={styles.cardTitle}>Hikâye</h2>
                    <p className={styles.cardSub}>Marka hikâyesi ve anlatım blokları</p>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.field}>
                    <label className={styles.label}>Blok Başlığı</label>
                    <input
                      className={styles.input}
                      value={cfg.story.title}
                      onChange={(e) =>
                        setCfg({ ...cfg, story: { ...cfg.story, title: e.target.value } })
                      }
                      placeholder="Blok başlığı"
                    />
                  </div>

                  <div className={styles.field} style={{ marginTop: 16 }}>
                    <label className={styles.label}>Metin 1</label>
                    <textarea
                      className={styles.textarea}
                      value={cfg.story.text1}
                      onChange={(e) =>
                        setCfg({ ...cfg, story: { ...cfg.story, text1: e.target.value } })
                      }
                      rows={5}
                    />
                  </div>

                  <div className={styles.field} style={{ marginTop: 16 }}>
                    <label className={styles.label}>Metin 2</label>
                    <textarea
                      className={styles.textarea}
                      value={cfg.story.text2}
                      onChange={(e) =>
                        setCfg({ ...cfg, story: { ...cfg.story, text2: e.target.value } })
                      }
                      rows={5}
                    />
                  </div>
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.cardTitleWrap}>
                    <h2 className={styles.cardTitle}>Görseller</h2>
                    <p className={styles.cardSub}>Ana görsel ve yan görselleri yükle</p>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.uploadGrid}>
                    <div className={styles.previewCard}>
                      <div className={styles.previewMedia}>
                        {s(cfg.gallery.mainImage) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cfg.gallery.mainImage} alt="" />
                        ) : (
                          <div className={styles.previewEmpty}>Ana Görsel</div>
                        )}
                      </div>
                      <div className={styles.previewBody}>
                        <div className={styles.previewTitle}>Ana Görsel</div>
                        <div className={styles.smallActions} style={{ marginTop: 12 }}>
                          <label className={styles.uploadBtn}>
                            Görsel Yükle
                            <input
                              className={styles.fileInput}
                              type="file"
                              accept="image/*"
                              onChange={(e) => onUpload("mainImage", e.target.files?.[0])}
                            />
                          </label>
                        </div>
                        <div className={styles.field} style={{ marginTop: 12 }}>
                          <input
                            className={styles.input}
                            value={s(cfg.gallery.mainImage)}
                            onChange={(e) =>
                              setCfg({
                                ...cfg,
                                gallery: { ...cfg.gallery, mainImage: e.target.value },
                              })
                            }
                            placeholder="Ana görsel URL"
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.sidePreviewGrid}>
                      <div className={styles.previewCard}>
                        <div className={`${styles.previewMedia} ${styles.previewMediaSmall}`}>
                          {s(cfg.gallery.sideImage1) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cfg.gallery.sideImage1} alt="" />
                          ) : (
                            <div className={styles.previewEmpty}>Yan Görsel 1</div>
                          )}
                        </div>
                        <div className={styles.previewBody}>
                          <div className={styles.previewTitle}>Yan Görsel 1</div>
                          <label className={styles.uploadBtn} style={{ marginTop: 12 }}>
                            Görsel Yükle
                            <input
                              className={styles.fileInput}
                              type="file"
                              accept="image/*"
                              onChange={(e) => onUpload("sideImage1", e.target.files?.[0])}
                            />
                          </label>
                        </div>
                      </div>

                      <div className={styles.previewCard}>
                        <div className={`${styles.previewMedia} ${styles.previewMediaSmall}`}>
                          {s(cfg.gallery.sideImage2) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cfg.gallery.sideImage2} alt="" />
                          ) : (
                            <div className={styles.previewEmpty}>Yan Görsel 2</div>
                          )}
                        </div>
                        <div className={styles.previewBody}>
                          <div className={styles.previewTitle}>Yan Görsel 2</div>
                          <label className={styles.uploadBtn} style={{ marginTop: 12 }}>
                            Görsel Yükle
                            <input
                              className={styles.fileInput}
                              type="file"
                              accept="image/*"
                              onChange={(e) => onUpload("sideImage2", e.target.files?.[0])}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </section>
              <section className={styles.card}>
  <div className={styles.cardHead}>
    <div className={styles.cardTitleWrap}>
      <h2 className={styles.cardTitle}>Öne Çıkan Kartlar</h2>
      <p className={styles.cardSub}>Köklü deneyim, seçki ve yaklaşım alanı</p>
    </div>
  </div>

  <div className={styles.cardBody}>
    <div className={styles.stack}>
      {cfg.highlights.map((item: any, i: number) => (
        <div key={i} className={styles.previewCard} style={{ padding: 16 }}>
          <div className={styles.field}>
            <label className={styles.label}>Başlık {i + 1}</label>
            <input
              className={styles.input}
              value={item.title}
              onChange={(e) => {
                const next = [...cfg.highlights];
                next[i] = { ...next[i], title: e.target.value };
                setCfg({ ...cfg, highlights: next });
              }}
            />
          </div>

          <div className={styles.field} style={{ marginTop: 12 }}>
            <label className={styles.label}>Metin {i + 1}</label>
            <textarea
              className={styles.textarea}
              rows={4}
              value={item.text}
              onChange={(e) => {
                const next = [...cfg.highlights];
                next[i] = { ...next[i], text: e.target.value };
                setCfg({ ...cfg, highlights: next });
              }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
</section>
<section className={styles.card}>
  <div className={styles.cardHead}>
    <div className={styles.cardTitleWrap}>
      <h2 className={styles.cardTitle}>Neye İnanıyoruz</h2>
      <p className={styles.cardSub}>Başlık, açıklama ve madde listesi</p>
    </div>
  </div>

  <div className={styles.cardBody}>
    <div className={styles.field}>
      <label className={styles.label}>Eyebrow</label>
      <input
        className={styles.input}
        value={cfg.beliefs.eyebrow}
        onChange={(e) =>
          setCfg({ ...cfg, beliefs: { ...cfg.beliefs, eyebrow: e.target.value } })
        }
      />
    </div>

    <div className={styles.field} style={{ marginTop: 16 }}>
      <label className={styles.label}>Başlık</label>
      <input
        className={styles.input}
        value={cfg.beliefs.title}
        onChange={(e) =>
          setCfg({ ...cfg, beliefs: { ...cfg.beliefs, title: e.target.value } })
        }
      />
    </div>

    <div className={styles.field} style={{ marginTop: 16 }}>
      <label className={styles.label}>Açıklama</label>
      <textarea
        className={styles.textarea}
        rows={5}
        value={cfg.beliefs.description}
        onChange={(e) =>
          setCfg({ ...cfg, beliefs: { ...cfg.beliefs, description: e.target.value } })
        }
      />
    </div>

    <div className={styles.sectionLine} />

    {cfg.beliefs.items.map((item: string, i: number) => (
      <div key={i} className={styles.field} style={{ marginTop: 12 }}>
        <label className={styles.label}>Madde {i + 1}</label>
        <input
          className={styles.input}
          value={item}
          onChange={(e) => {
            const next = [...cfg.beliefs.items];
            next[i] = e.target.value;
            setCfg({
              ...cfg,
              beliefs: { ...cfg.beliefs, items: next },
            });
          }}
        />
      </div>
    ))}
  </div>
</section>
<section className={styles.card}>
  <div className={styles.cardHead}>
    <div className={styles.cardTitleWrap}>
      <h2 className={styles.cardTitle}>Alt CTA Alanı</h2>
      <p className={styles.cardSub}>Koyu arka planlı kapanış bölümü</p>
    </div>
  </div>

  <div className={styles.cardBody}>
    <div className={styles.field}>
      <label className={styles.label}>Eyebrow</label>
      <input
        className={styles.input}
        value={cfg.cta.eyebrow}
        onChange={(e) =>
          setCfg({ ...cfg, cta: { ...cfg.cta, eyebrow: e.target.value } })
        }
      />
    </div>

    <div className={styles.field} style={{ marginTop: 16 }}>
      <label className={styles.label}>Başlık</label>
      <input
        className={styles.input}
        value={cfg.cta.title}
        onChange={(e) =>
          setCfg({ ...cfg, cta: { ...cfg.cta, title: e.target.value } })
        }
      />
    </div>

    <div className={styles.field} style={{ marginTop: 16 }}>
      <label className={styles.label}>Açıklama</label>
      <textarea
        className={styles.textarea}
        rows={5}
        value={cfg.cta.description}
        onChange={(e) =>
          setCfg({ ...cfg, cta: { ...cfg.cta, description: e.target.value } })
        }
      />
    </div>

    <div className={styles.sectionLine} />

    {cfg.cta.cards.map((card: any, i: number) => (
      <div key={i} className={styles.previewCard} style={{ padding: 16, marginTop: 12 }}>
        <div className={styles.field}>
          <label className={styles.label}>Kart Başlığı {i + 1}</label>
          <input
            className={styles.input}
            value={card.title}
            onChange={(e) => {
              const next = [...cfg.cta.cards];
              next[i] = { ...next[i], title: e.target.value };
              setCfg({ ...cfg, cta: { ...cfg.cta, cards: next } });
            }}
          />
        </div>

        <div className={styles.field} style={{ marginTop: 12 }}>
          <label className={styles.label}>Kart Metni {i + 1}</label>
          <input
            className={styles.input}
            value={card.text}
            onChange={(e) => {
              const next = [...cfg.cta.cards];
              next[i] = { ...next[i], text: e.target.value };
              setCfg({ ...cfg, cta: { ...cfg.cta, cards: next } });
            }}
          />
        </div>
      </div>
    ))}
  </div>
</section>
            </div>
          </div>

          <aside className={styles.rightCol}>
            <div className={styles.stickyCol}>
              <div className={styles.liveCard}>
                <div className={styles.liveHead}>
                  <h3 className={styles.liveTitle}>Canlı Önizleme</h3>
                  <p className={styles.liveSub}>Admin’de yaptığın değişikliklerin genel hissi</p>
                </div>

                <div className={styles.liveBody}>
                  <div className={styles.miniHero}>
                    <div className={styles.miniEyebrow}>{cfg.hero.eyebrow}</div>
                    <div className={styles.miniTitle}>{cfg.hero.title}</div>
                    <div className={styles.miniDesc}>{cfg.hero.description}</div>

                    <div className={styles.miniActions}>
                      <span className={styles.miniBtnPrimary}>{cfg.hero.primaryLabel}</span>
                      <span className={styles.miniBtnGhost}>{cfg.hero.secondaryLabel}</span>
                    </div>

                    <div className={styles.statusRow}>
                      <div className={styles.statusPill}>
                        <span className={styles.dot} />
                        Sayfa aktif
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}