"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import s from "./NewsletterAdmin.module.css";

/* ──────────── Types ──────────── */
type Subscriber = {
  id: string;
  email: string;
  locale?: string;
  source?: string;
  subscribedAt?: any;
};

type CampaignTemplate = "promotion" | "newCollection" | "announcement" | "custom";

type Campaign = {
  id: string;
  subject: string;
  template: CampaignTemplate;
  body: string;
  recipientCount: number;
  status: "draft" | "sent";
  sentAt?: any;
  createdAt?: any;
};

/* ──────────── Helpers ──────────── */
function formatDate(ts: any): string {
  if (!ts) return "—";
  try {
    const d = typeof ts === "string" ? new Date(ts) : ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const TEMPLATES: { key: CampaignTemplate; label: string; icon: string; color: string }[] = [
  { key: "promotion", label: "İndirim / Kampanya", icon: "🏷️", color: "#f59e0b" },
  { key: "newCollection", label: "Yeni Koleksiyon", icon: "💎", color: "#8b5cf6" },
  { key: "announcement", label: "Duyuru / Bilgilendirme", icon: "📢", color: "#3b82f6" },
  { key: "custom", label: "Özel Şablon", icon: "✏️", color: "#10b981" },
];

function getTemplatePreview(_template: CampaignTemplate, subject: string, body: string): string {
  return `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12)">
    <!-- Gold accent -->
    <div style="height:4px;background:linear-gradient(90deg,#b8941f,#d4af37,#e6c874,#d4af37,#b8941f)"></div>
    <!-- Header -->
    <div style="background:#0f1728;padding:36px 32px;text-align:center">
      <div style="width:56px;height:56px;border-radius:50%;background:#d4af37;margin:0 auto 12px;line-height:56px;font-size:18px;font-weight:900;color:#0f1728;font-family:Georgia,serif">6'ncı</div>
      <div style="font-size:13px;font-weight:700;color:#d4af37;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">DROMOCOB</div>
      <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;font-family:Georgia,serif;line-height:1.3">${subject}</h1>
    </div>
    <!-- Body -->
    <div style="background:#ffffff;padding:40px 36px 32px">
      <p style="margin:0 0 8px;font-size:15px;color:#b8941f;font-weight:700">Merhaba,</p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.85;color:#333;font-family:Georgia,serif;white-space:pre-wrap">${body}</p>
      <div style="height:1px;background:linear-gradient(90deg,transparent,#e5ddd0,transparent);margin:0 0 28px"></div>
      <div style="text-align:center">
        <a href="#" style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#d4af37,#b8941f);color:#fff;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px;letter-spacing:0.5px">MAĞAZAYA GİT →</a>
      </div>
    </div>
    <!-- Footer -->
    <div style="background:#faf7f2;padding:28px 36px;border-top:1px solid #ede8df;text-align:center">
      <div style="margin-bottom:16px">
        <a href="#" style="color:#b8941f;text-decoration:none;font-size:13px;font-weight:600;margin:0 8px">Instagram</a>
        <span style="color:#d4cfc6">•</span>
        <a href="#" style="color:#b8941f;text-decoration:none;font-size:13px;font-weight:600;margin:0 8px">Web Site</a>
        <span style="color:#d4cfc6">•</span>
        <a href="#" style="color:#b8941f;text-decoration:none;font-size:13px;font-weight:600;margin:0 8px">WhatsApp</a>
      </div>
      <p style="margin:0 0 8px;font-size:12px;color:#999;line-height:1.6">Bizim Dromocob<br>İstanbul • Türkiye</p>
      <p style="margin:0;font-size:11px;color:#bbb">Bu e-postayı aldınız çünkü bültenimize abone oldunuz.</p>
    </div>
    <!-- Gold bottom accent -->
    <div style="height:4px;background:linear-gradient(90deg,#b8941f,#d4af37,#e6c874,#d4af37,#b8941f)"></div>
  </div>`;
}

/* ──────────── Main Component ──────────── */
function NewsletterAdminInner() {
  /* ---- State ---- */
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"subscribers" | "compose" | "campaigns">("subscribers");
  const [searchTerm, setSearchTerm] = useState("");

  /* compose */
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState<CampaignTemplate>("promotion");
  const [sending, setSending] = useState(false);
  const [composeMsg, setComposeMsg] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  /* ---- Fetch data via API routes (server-side, no Firestore rules needed) ---- */
  const fetchData = useCallback(async () => {
    try {
      const [subsRes, campRes] = await Promise.all([
        fetch("/api/newsletter/subscribers"),
        fetch("/api/newsletter/campaigns"),
      ]);

      if (subsRes.ok) {
        const data = await subsRes.json();
        setSubs(data.subs || []);
      }

      if (campRes.ok) {
        const data = await campRes.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error("newsletter fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Filtered subs ---- */
  const filteredSubs = useMemo(() => {
    if (!searchTerm.trim()) return subs;
    const q = searchTerm.toLowerCase();
    return subs.filter((sub) => sub.email?.toLowerCase().includes(q));
  }, [subs, searchTerm]);

  /* ---- Delete subscriber (via API) ---- */
  const deleteSub = useCallback(
    async (id: string) => {
      if (!confirm("Bu aboneyi silmek istediğinize emin misiniz?")) return;
      try {
        const res = await fetch(`/api/newsletter/subscribers?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          setSubs((prev) => prev.filter((s) => s.id !== id));
        }
      } catch (err) {
        console.error("delete sub error:", err);
      }
    },
    []
  );

  /* ---- Send campaign (via API) ---- */
  const sendCampaign = useCallback(async () => {
    if (!subject.trim() || !body.trim()) {
      setComposeMsg("Konu ve içerik alanları zorunludur.");
      return;
    }
    if (!confirm(`${subs.length} aboneye toplu e-posta göndermek istiyor musunuz?`)) return;

    setSending(true);
    setComposeMsg("");

    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          template,
          body: body.trim(),
          recipients: subs.map((sub) => sub.email),
        }),
      });

      if (res.ok) {
        setComposeMsg(`✅ ${subs.length} aboneye mail gönderildi ve kampanya kaydedildi!`);
      } else {
        const data = await res.json().catch(() => ({}));
        if (data?.code === "SMTP_NOT_CONFIGURED" || data?.code === "NODEMAILER_MISSING") {
          setComposeMsg(`✅ Kampanya kaydedildi. ⚠️ Mail gönderimi için SMTP yapılandırması gerekli.`);
        } else {
          setComposeMsg(`⚠️ ${data?.error || "Bir hata oluştu."}`);
        }
      }

      setSubject("");
      setBody("");
      setShowPreview(false);
      fetchData(); // Refresh data
    } catch (err) {
      console.error("send campaign error:", err);
      setComposeMsg("❌ Kampanya kaydedilirken hata oluştu.");
    } finally {
      setSending(false);
      setTimeout(() => setComposeMsg(""), 5000);
    }
  }, [subject, body, template, subs, fetchData]);

  /* ---- Stats ---- */
  const totalSubs = subs.length;
  const todaySubs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return subs.filter((sub) => {
      try {
        const d = new Date(sub.subscribedAt);
        return d >= today;
      } catch {
        return false;
      }
    }).length;
  }, [subs]);

  const totalCampaigns = campaigns.length;

  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.loading}>Yükleniyor...</div>
      </div>
    );
  }

  return (
    <main className={s.page}>
      <div className={s.wrap}>
        {/* ─── Header ─── */}
        <div className={s.topbar}>
          <div>
            <div className={s.kicker}>NEWSLETTER ADMIN</div>
            <h1 className={s.title}>E-Bülten Yönetimi</h1>
            <p className={s.desc}>Aboneleri yönet, temalı e-postalar oluştur ve toplu gönder.</p>
          </div>
        </div>

        {/* ─── Stats ─── */}
        <div className={s.statsGrid}>
          <div className={s.statCard}>
            <div className={s.statIcon}>👥</div>
            <div className={s.statInfo}>
              <div className={s.statValue}>{totalSubs}</div>
              <div className={s.statLabel}>Toplam Abone</div>
            </div>
          </div>
          <div className={s.statCard}>
            <div className={s.statIcon}>📈</div>
            <div className={s.statInfo}>
              <div className={s.statValue}>{todaySubs}</div>
              <div className={s.statLabel}>Bugün Yeni</div>
            </div>
          </div>
          <div className={s.statCard}>
            <div className={s.statIcon}>📧</div>
            <div className={s.statInfo}>
              <div className={s.statValue}>{totalCampaigns}</div>
              <div className={s.statLabel}>Gönderilen Kampanya</div>
            </div>
          </div>
        </div>

        {/* ─── Tabs ─── */}
        <div className={s.tabBar}>
          <button
            type="button"
            className={`${s.tabBtn} ${tab === "subscribers" ? s.tabBtnActive : ""}`}
            onClick={() => setTab("subscribers")}
          >
            👥 Aboneler ({totalSubs})
          </button>
          <button
            type="button"
            className={`${s.tabBtn} ${tab === "compose" ? s.tabBtnActive : ""}`}
            onClick={() => setTab("compose")}
          >
            ✏️ Yeni E-Posta
          </button>
          <button
            type="button"
            className={`${s.tabBtn} ${tab === "campaigns" ? s.tabBtnActive : ""}`}
            onClick={() => setTab("campaigns")}
          >
            📋 Geçmiş ({totalCampaigns})
          </button>
        </div>

        {/* ═══ TAB: Subscribers ═══ */}
        {tab === "subscribers" && (
          <section className={s.section}>
            <div className={s.searchWrap}>
              <input
                className={s.searchInput}
                placeholder="E-posta ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className={s.searchCount}>{filteredSubs.length} abone</span>
            </div>

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>E-posta</th>
                    <th>Dil</th>
                    <th>Kaynak</th>
                    <th>Tarih</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map((sub, i) => (
                    <tr key={sub.id}>
                      <td className={s.cellNum}>{i + 1}</td>
                      <td className={s.cellEmail}>{sub.email}</td>
                      <td>
                        <span className={s.localeBadge}>{sub.locale?.toUpperCase() || "TR"}</span>
                      </td>
                      <td className={s.cellSource}>{sub.source || "web"}</td>
                      <td className={s.cellDate}>{formatDate(sub.subscribedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className={s.deleteBtn}
                          onClick={() => deleteSub(sub.id)}
                          title="Sil"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredSubs.length === 0 && (
                    <tr>
                      <td colSpan={6} className={s.emptyRow}>
                        {searchTerm ? "Arama sonucu bulunamadı." : "Henüz abone yok."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ═══ TAB: Compose ═══ */}
        {tab === "compose" && (
          <section className={s.section}>
            <div className={s.composeGrid}>
              {/* Left - Form */}
              <div className={s.composeForm}>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>E-Posta Şablonu</label>
                  <div className={s.templateGrid}>
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`${s.templateCard} ${template === t.key ? s.templateCardActive : ""}`}
                        onClick={() => setTemplate(t.key)}
                        style={{ "--tpl-color": t.color } as any}
                      >
                        <span className={s.templateIcon}>{t.icon}</span>
                        <span className={s.templateLabel}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Konu Satırı</label>
                  <input
                    className={s.input}
                    placeholder="Örn: 🎉 Yeni Koleksiyonumuz Çıktı!"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>E-Posta İçeriği</label>
                  <textarea
                    className={s.textarea}
                    placeholder="E-posta gövde metni buraya yazılır..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                  />
                </div>

                <div className={s.composeActions}>
                  <button
                    type="button"
                    className={s.previewBtn}
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? "Önizlemeyi Kapat" : "👁️ Önizle"}
                  </button>

                  <button
                    type="button"
                    className={s.sendBtn}
                    onClick={sendCampaign}
                    disabled={sending || !subject.trim() || !body.trim()}
                  >
                    {sending ? "Gönderiliyor..." : `📤 ${totalSubs} Aboneye Gönder`}
                  </button>
                </div>

                {composeMsg && (
                  <div className={composeMsg.startsWith("❌") ? s.errorMsg : s.successMsg}>
                    {composeMsg}
                  </div>
                )}
              </div>

              {/* Right - Preview */}
              <div className={s.composePreview}>
                <div className={s.previewHeader}>
                  <div className={s.previewDots}>
                    <span /><span /><span />
                  </div>
                  <div className={s.previewTitle}>E-Posta Önizleme</div>
                </div>
                <div className={s.previewFrame}>
                  {subject || body ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: getTemplatePreview(template, subject || "Konu başlığı", body || "E-posta içeriği buraya gelecek..."),
                      }}
                    />
                  ) : (
                    <div className={s.previewEmpty}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
                      <p>Konu ve içerik girin,<br />önizleme burada görünecek.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══ TAB: Campaigns ═══ */}
        {tab === "campaigns" && (
          <section className={s.section}>
            {campaigns.length === 0 ? (
              <div className={s.emptyState}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <p>Henüz kampanya gönderilmedi.</p>
              </div>
            ) : (
              <div className={s.campaignList}>
                {campaigns.map((c) => (
                  <div key={c.id} className={s.campaignCard}>
                    <div className={s.campaignTop}>
                      <div className={s.campaignIcon}>
                        {TEMPLATES.find((t) => t.key === c.template)?.icon || "📧"}
                      </div>
                      <div className={s.campaignInfo}>
                        <div className={s.campaignSubject}>{c.subject}</div>
                        <div className={s.campaignMeta}>
                          {c.recipientCount} alıcı • {formatDate(c.createdAt)}
                        </div>
                      </div>
                      <div className={`${s.statusBadge} ${c.status === "sent" ? s.statusSent : s.statusDraft}`}>
                        {c.status === "sent" ? "Gönderildi" : "Taslak"}
                      </div>
                    </div>
                    <p className={s.campaignBody}>{c.body?.slice(0, 120)}...</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default function NewsletterAdminPage() {
  return (
    <AdminGate>
      <PermissionGate permission="home_settings">
        <NewsletterAdminInner />
      </PermissionGate>
    </AdminGate>
  );
}
