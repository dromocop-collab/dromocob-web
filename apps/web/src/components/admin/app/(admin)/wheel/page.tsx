"use client";

import Link from "next/link";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./wheel-home.module.css";

function AdminWheelHomeInner() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>Admin • Wheel Suite</div>
          <h1 className={styles.h1}>Şans Çarkı Yönetimi</h1>
          <p className={styles.sub}>
            Çark kampanyalarını, ödül dağılımını, kupon üretimini ve spin kayıtlarını
            tek panelden yönet. Kurgu premium, mantık kontrollü, sonuç satış odaklı.
          </p>
        </div>

        <div className={styles.heroActions}>
          <Link href="/admin/wheel/campaigns" className={styles.primaryBtn}>
            Kampanyaları Yönet
          </Link>
          <Link href="/admin/wheel/spins" className={styles.ghostBtn}>
            Spin Kayıtları
          </Link>
        </div>
      </section>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Aktif Kampanya</span>
          <strong className={styles.statValue}>1</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Toplam Ödül Tipi</span>
          <strong className={styles.statValue}>8</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Üretilen Kupon</span>
          <strong className={styles.statValue}>0</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Bugünkü Spin</span>
          <strong className={styles.statValue}>0</strong>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.leftCol}>
          <article className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Yönetim Alanları</h2>
                <p className={styles.cardDesc}>
                  Wheel sisteminin tüm alt modülleri burada. Her sayfa tek omurgada çalışır.
                </p>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Modül</th>
                    <th>Açıklama</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className={styles.rowTitle}>
                        <div className={styles.rowTitleMain}>Campaigns</div>
                        <div className={styles.rowTitleSub}>Kampanya kurgusu</div>
                      </div>
                    </td>
                    <td>Popup, oran, aktif dönem, segment ve görünüm yönetimi.</td>
                    <td>
                      <div className={styles.actionsRow}>
                        <Link href="/admin/wheel/campaigns" className={styles.softBtn}>
                          Aç
                        </Link>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div className={styles.rowTitle}>
                        <div className={styles.rowTitleMain}>Rewards</div>
                        <div className={styles.rowTitleSub}>Ödül segmentleri</div>
                      </div>
                    </td>
                    <td>İndirim, sabit kupon, yüzdelik avantaj ve limitli ödüller.</td>
                    <td>
                      <div className={styles.actionsRow}>
                        <Link href="/admin/wheel/rewards" className={styles.softBtn}>
                          Aç
                        </Link>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div className={styles.rowTitle}>
                        <div className={styles.rowTitleMain}>Coupons</div>
                        <div className={styles.rowTitleSub}>Kupon kontrolü</div>
                      </div>
                    </td>
                    <td>Üretilmiş kodlar, kullanım durumu, eşleşen ödül ve kampanya takibi.</td>
                    <td>
                      <div className={styles.actionsRow}>
                        <Link href="/admin/wheel/coupons" className={styles.softBtn}>
                          Aç
                        </Link>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <div className={styles.rowTitle}>
                        <div className={styles.rowTitleMain}>Spins</div>
                        <div className={styles.rowTitleSub}>Müşteri hareketleri</div>
                      </div>
                    </td>
                    <td>Kim çevirdi, ne kazandı, hangi kupon oluştu, abuse kontrolü.</td>
                    <td>
                      <div className={styles.actionsRow}>
                        <Link href="/admin/wheel/spins" className={styles.softBtn}>
                          Aç
                        </Link>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <div className={styles.rightCol}>
          <article className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Canlı Önizleme</h2>
                <p className={styles.cardDesc}>Müşterinin göreceği premium çark hissi.</p>
              </div>
            </div>

            <div className={styles.previewBox}>
              <div className={styles.previewWheel} />
              <div className={styles.previewMini}>
                <span className={styles.previewLabel}>Aktif Kampanya</span>
                <div className={styles.previewValue}>Anneler Günü Çarkı</div>
              </div>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2 className={styles.cardTitle}>Teknik Not</h2>
                <p className={styles.cardDesc}>Bu modül satışa dokunduğu için kurallı ilerle.</p>
              </div>
            </div>

            <div className={styles.kv}>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Kupon mantığı</span>
                <div className={styles.kvVal}>
                  Her spin sonunda tekil kod üretilecek ve checkout tarafında doğrulanacak.
                </div>
              </div>
              <div className={styles.kvItem}>
                <span className={styles.kvKey}>Abuse koruması</span>
                <div className={styles.kvVal}>
                  IP, email, cihaz ve zaman limitiyle kötüye kullanım kesilecek.
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

export default function AdminWheelHomePage() {
  return (
    <AdminGate>
      <PermissionGate permission="settings">
        <AdminWheelHomeInner />
      </PermissionGate>
    </AdminGate>
  );
}