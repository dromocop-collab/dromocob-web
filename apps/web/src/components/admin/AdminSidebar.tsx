"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getIdTokenResult, onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import type { AdminPermissions, AdminRole } from "@/lib/adminTypes";
import { defaultSubAdminPermissions } from "@/lib/adminTypes";
import s from "./AdminSidebar.module.css";

type PermissionKey = keyof AdminPermissions;

type NavItem = {
  href: string;
  label: string;
  icon?: string;
  badge?: string;
  section?: string;
  permission?: PermissionKey;
  badgeKey?:

  | "orders"

  | "refunds"

  | "reviews"

  | "support"

  | "stock"

  | "notifications"

  | "campaigns"
  | "appointments";
tone?: "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan";
};

type ViewRole = AdminRole | "member";

type SidebarUserState = {
  ready: boolean;
  uid: string;
  email: string;
  role: ViewRole;
  isActive: boolean;
  permissions: AdminPermissions;
};

type LiveCounts = {
  orders: number;
  refunds: number;
  reviews: number;
  support: number;
  stock: number;
  notifications: number;
  campaigns: number;
  appointments: number;
};

const items: NavItem[] = [
  /* ── Genel ── */
  { section: "Genel", href: "/admin", label: "Dashboard", icon: "⌂", permission: "dashboard", tone: "blue" },
  { section: "Genel", href: "/admin/project-briefs", label: "Proje Talepleri", icon: "✦", permission: "dashboard", tone: "violet" },

  /* ── Katalog ── */
  { section: "Katalog", href: "/admin/products", label: "Ürünler", icon: "◩", permission: "products", tone: "blue" },
  { section: "Katalog", href: "/admin/categories", label: "Kategoriler", icon: "⌁", permission: "categories", tone: "violet" },
  { section: "Katalog", href: "/admin/subcategories", label: "Alt Kategoriler", icon: "⋮", permission: "categories", tone: "rose" },
  { section: "Katalog", href: "/admin/stock", label: "Stok Yönetimi", icon: "▦", permission: "products", badgeKey: "stock", tone: "amber" },
  { section: "Katalog", href: "/admin/products/import", label: "Toplu Ürün Yükle", icon: "⬆", permission: "products", tone: "emerald" },
  { section: "Katalog", href: "/admin/mobile-product-drafts", label: "Mobil Taslaklar", icon: "📱", permission: "products", tone: "cyan" },

  /* ── Satış ── */
  { section: "Satış", href: "/admin/orders", label: "Siparişler", icon: "⎘", permission: "orders", badgeKey: "orders", tone: "emerald" },
  { section: "Satış", href: "/admin/refunds", label: "İade Talepleri", icon: "↺", permission: "orders", badgeKey: "refunds", tone: "rose" },
  { section: "Satış", href: "/admin/customers", label: "Müşteriler", icon: "◈", permission: "orders", tone: "blue" },
  { section: "Satış", href: "/admin/accounting", label: "Muhasebe", icon: "₺", permission: "orders", tone: "cyan" },
  { section: "Satış", href: "/admin/payment", label: "Ödeme Ayarları", icon: "¤", permission: "settings", tone: "amber" },
  { section: "Satış", href: "/admin/installments", label: "Taksit Ayarları", icon: "💳", permission: "settings", tone: "cyan" },

  /* ── İçerik ── */
  { section: "İçerik", href: "/admin/HomeSectionsOrderPage", label: "Anasayfa Düzeni", icon: "▤", permission: "home_settings", tone: "emerald" },
  { section: "İçerik", href: "/admin/home-sections", label: "Anasayfa Genel", icon: "▥", permission: "home_settings", tone: "cyan" },
  { section: "İçerik", href: "/admin/home-promos", label: "Slider Yönetimi", icon: "◎", permission: "home_settings", tone: "blue" },
  { section: "İçerik", href: "/admin/home-popular", label: "Popüler Etiketler", icon: "✦", permission: "home_settings", tone: "amber" },
  { section: "İçerik", href: "/admin/media", label: "Medya Yükleme", icon: "⇪", permission: "home_settings", tone: "violet" },

  /* ── Pazarlama ── */
  { section: "Pazarlama", href: "/admin/showcase-products", label: "Vitrin Ürünleri", icon: "✦", permission: "products", tone: "amber" },
  { section: "Pazarlama", href: "/admin/newsletter", label: "E-Bülten", icon: "✉", permission: "home_settings", tone: "emerald" },
  { section: "Pazarlama", href: "/admin/discounts", label: "İndirim Yönetimi", icon: "🏷", permission: "products", tone: "emerald" },
  { section: "Pazarlama", href: "/admin/campaigns", label: "Kampanyalar", icon: "🏷️", permission: "settings", badgeKey: "campaigns", tone: "rose" },
  { section: "Pazarlama", href: "/admin/social", label: "Instagram Feed", icon: "◎", permission: "home_settings", tone: "violet" },
  { section: "Pazarlama", href: "/admin/home-marquee", label: "Kayan Yazı", icon: "↔", permission: "home_settings", tone: "cyan" },
  { section: "Pazarlama", href: "/admin/reviews", label: "Yorumlar", icon: "★", permission: "products", badgeKey: "reviews", tone: "amber" },
  { section: "Pazarlama", href: "/admin/testimonials", label: "Vitrin Yorumları", icon: "❝", permission: "home_settings", tone: "blue" },
  { section: "Pazarlama", href: "/admin/home-promo", label: "Promo Slider", icon: "♥", permission: "home_settings", tone: "rose" },
  { section: "Pazarlama", href: "/admin/opening-popup", label: "Açılış Popup", icon: "◫", permission: "home_settings", tone: "violet" },
  { section: "Pazarlama", href: "/admin/analytics", label: "Analitik", icon: "📊", permission: "dashboard", tone: "blue" },
  { section: "Pazarlama", href: "/admin/tracking", label: "Reklam Kodları", icon: "📡", permission: "settings_admin", tone: "cyan" },
  { section: "Pazarlama", href: "/admin/marketing-checklist", label: "Reklam Hazırlığı", icon: "✅", permission: "dashboard", tone: "emerald" },

  /* ── Wheel ── */
  { section: "Wheel", href: "/admin/wheel", label: "Çark Dashboard", icon: "◉", permission: "settings", tone: "violet" },
  { section: "Wheel", href: "/admin/wheel/campaigns", label: "Kampanyalar", icon: "◌", permission: "settings", tone: "blue" },
  { section: "Wheel", href: "/admin/wheel/rewards", label: "Ödüller", icon: "✦", permission: "settings", tone: "amber" },
  { section: "Wheel", href: "/admin/wheel/coupons", label: "Kuponlar", icon: "⌗", permission: "orders", tone: "emerald" },
  { section: "Wheel", href: "/admin/wheel/spins", label: "Çevirimler", icon: "↻", permission: "settings", tone: "cyan" },

  /* ── Operasyon ── */
  { section: "Operasyon", href: "/admin/support", label: "Canlı Destek", icon: "◌", permission: "support", badgeKey: "support", tone: "blue" },
  { section: "Operasyon", href: "/admin/appointments", label: "Özel Randevular", icon: "◷", permission: "support", badgeKey: "appointments", tone: "amber" },
  { section: "Operasyon", href: "/admin/Shipping", label: "Kargo Ayarları", icon: "◫", permission: "settings", tone: "cyan" },
  { section: "Operasyon", href: "/admin/rates-provider", label: "Döviz Kurları", icon: "₺", permission: "settings_admin", tone: "emerald" },
  { section: "Operasyon", href: "/admin/rate-health", label: "Kur Sağlık", icon: "📊", permission: "settings", tone: "amber" },
  { section: "Operasyon", href: "/admin/market-pricing", label: "Piyasa Analizi", icon: "📈", permission: "products", tone: "emerald" },
  { section: "Operasyon", href: "/admin/stock-alerts", label: "Stok Bildirimleri", icon: "🔔", permission: "settings", tone: "rose" },
  { section: "Operasyon", href: "/admin/notifications", label: "Push Bildirim", icon: "⚑", permission: "settings", badgeKey: "notifications", tone: "violet" },

  /* ── Ayarlar ── */
  { section: "Ayarlar", href: "/admin/permissions", label: "Admin Yetki", icon: "◈", permission: "users_admin", tone: "violet" },
  { section: "Ayarlar", href: "/admin/settings", label: "Site Ayarları", icon: "⚙", permission: "settings_admin", tone: "blue" },
  { section: "Ayarlar", href: "/admin/shop-settings", label: "Mağaza Ayarları", icon: "◫", permission: "settings_admin", tone: "cyan" },
  { section: "Ayarlar", href: "/admin/settings/hero-slides", label: "Slider Ayarları", icon: "⚑", permission: "home_settings", tone: "amber" },
  { section: "Ayarlar", href: "/admin/hakkimizda", label: "Hakkımızda", icon: "⚑", permission: "home_settings", tone: "emerald" },
  { section: "Ayarlar", href: "/admin/refund-settings", label: "İade Ayarları", icon: "↩", permission: "settings_admin", tone: "rose" },
  { section: "Ayarlar", href: "/admin/pages", label: "Sayfa Yönetimi", icon: "☰", permission: "pages_admin", tone: "violet" },
  { section: "Ayarlar", href: "/admin/footer", label: "Footer", icon: "▭", permission: "footer_settings", tone: "cyan" },
  { section: "Ayarlar", href: "/admin/seo", label: "SEO", icon: "⌕", permission: "settings_admin", tone: "blue" },
  { section: "Ayarlar", href: "/admin/maintenance", label: "Bakım Modu", icon: "✦", permission: "system", tone: "amber" },
  { section: "Ayarlar", href: "/admin/system", label: "Sistem", icon: "◍", permission: "system", tone: "rose" },
];

function isActive(path: string, href: string) {
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(href + "/");
}

function emptyPermissions(): AdminPermissions {
  return { ...defaultSubAdminPermissions };
}

function hasPermission(
  item: NavItem,
  role: ViewRole,
  permissions: AdminPermissions,
  isActiveUser: boolean
) {
  if (!isActiveUser) return false;
  if (role === "admin") return true;
  if (role !== "sub_admin") return false;
  if (!item.permission) return true;
  return Boolean(permissions[item.permission]);
}

function getRoleLabel(role: ViewRole) {
  if (role === "admin") return "Admin";
  if (role === "sub_admin") return "Sub Admin";
  return "Yetkisiz";
}

function getRoleTone(role: ViewRole, isActive: boolean) {
  if (!isActive) return "passive";
  if (role === "admin") return "admin";
  if (role === "sub_admin") return "subadmin";
  return "member";
}

function clampBadge(n: number) {
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
}
function asArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v);
  return [];
}
export default function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();

  const [userState, setUserState] = useState<SidebarUserState>({
    ready: false,
    uid: "",
    email: "",
    role: "member",
    isActive: false,
    permissions: emptyPermissions(),
  });
const [counts, setCounts] = useState<LiveCounts>({
  orders: 0,
  refunds: 0,
  reviews: 0,
  support: 0,
  stock: 0,
  notifications: 0,
  campaigns: 0,
  appointments: 0,
});

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Genel: true,
    Katalog: true,
    Satış: true,
    İçerik: false,
    Pazarlama: false,
    Wheel: true,
    Operasyon: true,
    Ayarlar: false,
    Diğer: false,
  });
useEffect(() => {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  let alive = true;

  const unsub = onAuthStateChanged(auth, async (user) => {
    if (!alive) return;

    if (!user) {
      setUserState({
        ready: true,
        uid: "",
        email: "",
        role: "member",
        isActive: false,
        permissions: emptyPermissions(),
      });
      return;
    }

    try {
      const emailLower = String(user.email || "").trim().toLowerCase();
      const [tokenResult, snap, legacyAdminSnap] = await Promise.all([
        getIdTokenResult(user, true).catch(() => null),
        getDoc(doc(db, "users", user.uid)).catch(() => null),
        emailLower ? getDoc(doc(db, "admins", emailLower)).catch(() => null) : Promise.resolve(null),
      ]);

      const claims: any = tokenResult?.claims || {};
      const data: any = snap?.exists?.() ? snap.data() : {};

      const claimRoles = Array.isArray(claims.roles)
        ? claims.roles.map((x: any) => String(x))
        : [];

      const claimRole = String(claims.role || "").trim();
      const docRole = String(data?.role || "").trim();
      const isLegacyAdmin = Boolean(legacyAdminSnap?.exists?.() && legacyAdminSnap.data()?.enabled === true);
      const isBootstrapAdmin = (emailLower === "zerayakkabi@gmail.com" && user.emailVerified) || isLegacyAdmin;

      const isClaimAdmin =
        isBootstrapAdmin ||
        claims.admin === true ||
        claimRole === "admin" ||
        claimRoles.includes("admin");

      const isClaimSubAdmin =
        claimRole === "sub_admin" ||
        claimRoles.includes("sub_admin");

      const role: ViewRole = isClaimAdmin
        ? "admin"
        : isClaimSubAdmin
          ? "sub_admin"
          : docRole === "admin" || docRole === "sub_admin"
            ? docRole
            : "member";

      const isActive = role === "admin" ? true : data?.isActive !== false;

      const permissions: AdminPermissions =
        role === "admin"
          ? {
              dashboard: true,
              orders: true,
              products: true,
              categories: true,
              home_settings: true,
              footer_settings: true,
              users_admin: true,
              pages_admin: true,
              settings_admin: true,
              support: true,
              system: true,
            }
          : {
              ...defaultSubAdminPermissions,
              ...(data?.permissions || {}),
            };

      if (!alive) return;

      setUserState({
        ready: true,
        uid: user.uid,
        email: String(user.email || "").trim(),
        role,
        isActive,
        permissions,
      });
    } catch (e) {
      console.error("admin sidebar auth read error:", e);

      if (!alive) return;

      setUserState({
        ready: true,
        uid: user.uid,
        email: String(user.email || "").trim(),
        role: "member",
        isActive: false,
        permissions: emptyPermissions(),
      });
    }
  });

  return () => {
    alive = false;
    unsub();
  };
}, []);
  useEffect(() => {
  const db = getFirebaseDb();
  const unsubs: Array<() => void> = [];

  unsubs.push(
    onSnapshot(
      query(collection(db, "appointments"), where("status", "==", "new"), limit(100)),
      (snap) => setCounts((prev) => ({ ...prev, appointments: snap.size })),
      () => setCounts((prev) => ({ ...prev, appointments: 0 }))
    )
  );

  unsubs.push(
    onSnapshot(
      query(
        collection(db, "orders"),
        where("status", "in", ["pending_payment", "paid", "preparing"]),
        limit(100)
      ),
      (snap) => setCounts((prev) => ({ ...prev, orders: snap.size })),
      () => setCounts((prev) => ({ ...prev, orders: 0 }))
    )
  );

  unsubs.push(
    onSnapshot(
      query(
        collection(db, "refund_requests"),
        where("status", "in", [
          "pending",
          "processing",
          "approved",
          "return_label_created",
        ]),
        limit(100)
      ),
      (snap) => setCounts((prev) => ({ ...prev, refunds: snap.size })),
      () => setCounts((prev) => ({ ...prev, refunds: 0 }))
    )
  );

  unsubs.push(
    onSnapshot(
      query(
        collection(db, "product_reviews"),
        where("approved", "==", false),
        limit(100)
      ),
      (snap) => setCounts((prev) => ({ ...prev, reviews: snap.size })),
      () => setCounts((prev) => ({ ...prev, reviews: 0 }))
    )
  );

  // ✅ Chat: unreadByAdmin number olduğu için true değil > 0 bakıyoruz
  unsubs.push(
    onSnapshot(
      query(
        collection(db, "support_threads"),
        where("status", "==", "open"),
        where("unreadByAdmin", ">", 0),
        limit(100)
      ),
      (snap) => setCounts((prev) => ({ ...prev, support: snap.size })),
      () => setCounts((prev) => ({ ...prev, support: 0 }))
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, "products"), where("stock", "<=", 0), limit(100)),
      (snap) => setCounts((prev) => ({ ...prev, stock: snap.size })),
      () => setCounts((prev) => ({ ...prev, stock: 0 }))
    )
  );

  unsubs.push(
    onSnapshot(
      query(
        collection(db, "notifications"),
        where("status", "==", "queued"),
        limit(100)
      ),
      (snap) => setCounts((prev) => ({ ...prev, notifications: snap.size })),
      () => setCounts((prev) => ({ ...prev, notifications: 0 }))
    )
  );

  // ✅ Kampanyalar site_options/campaign_settings dokümanından sayılır
  unsubs.push(
    onSnapshot(
      doc(db, "site_options", "campaign_settings"),
      (snap) => {
        const d: any = snap.exists() ? snap.data() : {};
        const campaigns = asArray(d?.campaigns || d?.items || d?.list);

        const activeCount = campaigns.filter((x: any) => {
          return x?.isActive !== false && x?.enabled !== false;
        }).length;

        setCounts((prev) => ({ ...prev, campaigns: activeCount }));
      },
      () => setCounts((prev) => ({ ...prev, campaigns: 0 }))
    )
  );

  return () => {
    unsubs.forEach((x) => x());
  };
}, []);

 

  const visibleItems = useMemo(() => {
    if (!userState.ready) return [];
    return items.filter((item) =>
      hasPermission(item, userState.role, userState.permissions, userState.isActive)
    );
  }, [userState]);

  const sections = useMemo(() => {
    return visibleItems.reduce<Record<string, NavItem[]>>((acc, it) => {
      const key = it.section || "Diğer";
      (acc[key] ||= []).push(it);
      return acc;
    }, {});
  }, [visibleItems]);

  const sectionOrder = [
    "Genel",
    "Katalog",
    "Satış",
    "İçerik",
    "Pazarlama",
    "Wheel",
    "Operasyon",
    "Ayarlar",
    "Diğer",
  ].filter((k) => sections[k]?.length);

  const roleLabel = getRoleLabel(userState.role);
  const roleTone = getRoleTone(userState.role, userState.isActive);

  function toggleSection(section: string) {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

function getDynamicBadge(item: NavItem) {
  if (!item.badgeKey) return item.badge || "";

  const value = Number(counts[item.badgeKey] || 0);
  return clampBadge(value);
}

  return (
    <aside className={s.wrap}>
      <div className={s.topGlow} />

      <div className={s.brand}>
        <div className={s.logoBox}>
          <div className={s.logo}>D</div>
        </div>

        <div className={s.brandText}>
          <div className={s.name}>Dromocob</div>
          <div className={s.meta}>Admin Console</div>
        </div>
      </div>

      <div className={s.userCard}>
        <div className={s.userCardTop}>
          <div className={s.avatar}>
            {userState.email ? userState.email.charAt(0).toUpperCase() : "A"}
          </div>

          <div className={s.userInfo}>
            <div className={s.userEmail}>
              {userState.email || (userState.ready ? "Yetki okunamadı" : "Kontrol ediliyor...")}
            </div>
            <div className={s.userHint}>
              {userState.ready ? "Yetki tabanlı görünüm aktif" : "Yetkiler yükleniyor"}
            </div>
          </div>
        </div>

        <div className={s.userBottom}>
          <span className={`${s.rolePill} ${s[`role_${roleTone}`]}`}>
            {userState.ready ? roleLabel : "Yükleniyor..."}
          </span>
          <span className={`${s.statusDot} ${userState.isActive ? s.statusOn : s.statusOff}`} />
        </div>
      </div>

      <nav className={s.nav} aria-label="Admin menü">
        {!userState.ready ? (
          <div className={s.stateBox}>Menü yükleniyor…</div>
        ) : sectionOrder.length === 0 ? (
          <div className={s.stateBox}>Bu kullanıcı için görünür menü yok.</div>
        ) : (
          sectionOrder.map((sec) => {
            const isOpen = openSections[sec] ?? true;
            const sectionItems = sections[sec] || [];
            const totalBadgeCount = sectionItems.reduce((acc, item) => {
              const raw = getDynamicBadge(item);
              const parsed = Number(raw);
              return Number.isFinite(parsed) ? acc + parsed : acc;
            }, 0);

            return (
              <div className={s.section} key={sec}>
                <button
                  type="button"
                  className={`${s.sectionToggle} ${isOpen ? s.sectionToggleOpen : ""}`}
                  onClick={() => toggleSection(sec)}
                >
                  <span className={s.sectionTitle}>{sec}</span>

                  <div className={s.sectionToggleRight}>
                    {totalBadgeCount > 0 ? (
                      <span className={s.sectionCount}>{clampBadge(totalBadgeCount)}</span>
                    ) : null}
                    <span className={s.sectionChevron}>⌄</span>
                  </div>
                </button>

                <div className={`${s.sectionItems} ${isOpen ? s.sectionItemsOpen : ""}`}>
                  {sectionItems.map((it) => {
                    const active = isActive(path, it.href);
                    const badge = getDynamicBadge(it);

                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        prefetch={false}
                        onClick={onNavigate}
                        className={`${s.item} ${active ? s.active : ""}`}
                      >
                                            <span className={`${s.iconWrap} ${s[`tone_${it.tone || "blue"}`]}`}>
                        <span className={s.icon} aria-hidden="true">
                          {it.icon || "•"}
                        </span>
                      </span>

                        <span className={s.label}>{it.label}</span>

                        {badge ? <span className={s.badge}>{badge}</span> : null}

                        <span className={s.chev} aria-hidden="true">
                          ›
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </nav>

      <div className={s.footerCard}>
        <div className={s.footerTitle}>
          {userState.isActive ? "Premium mod aktif" : "Kullanıcı pasif"}
        </div>
        <div className={s.footerMeta}>v2 • Dromocob Yönetim Paneli</div>
      </div>
    </aside>
  );
}
