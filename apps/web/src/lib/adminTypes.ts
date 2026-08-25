import type { Timestamp } from "firebase/firestore";

export type AdminRole = "admin" | "sub_admin";

export type AdminPermissions = {
  dashboard: boolean;
  orders: boolean;
  products: boolean;
  categories: boolean;
  home_settings: boolean;
  footer_settings: boolean;
  users_admin: boolean;
  pages_admin: boolean;
  settings_admin: boolean;
  support: boolean;
  support_notifications: boolean;
  notifications: boolean;
  wheel: boolean;
  system: boolean;
  settings: boolean;
};

export type AdminUserDoc = {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  permissions: AdminPermissions;
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
  createdBy?: string;
};

export const defaultSubAdminPermissions: AdminPermissions = {
  dashboard: true,
  orders: false,
  products: false,
  categories: false,
  home_settings: false,
  footer_settings: false,
  users_admin: false,
  pages_admin: false,
  settings_admin: false,
  support: false,
  support_notifications: false,
  notifications: false,
  wheel: false,
  system: false,
  settings: false,
};

export const fullAdminPermissions: AdminPermissions = {
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
  support_notifications: true,
  notifications: true,
  wheel: true,
  system: true,
  settings: true,
};

export const permissionLabels: {
  key: keyof AdminPermissions;
  label: string;
  desc: string;
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    desc: "Panel ana ekranını ve genel yönetim özetini görür.",
  },
  {
    key: "orders",
    label: "Siparişler",
    desc: "Sipariş listeleme, durum güncelleme ve satış akışını yönetir.",
  },
  {
    key: "products",
    label: "Ürünler",
    desc: "Ürün ekleme, düzenleme, stok ve vitrin alanlarını yönetir.",
  },
  {
    key: "categories",
    label: "Kategoriler",
    desc: "Kategori ve alt kategori yapısını yönetir.",
  },
  {
    key: "home_settings",
    label: "Anasayfa Ayarları",
    desc: "Anasayfa bölümleri, slider, promo ve içerik alanlarını düzenler.",
  },
  {
    key: "footer_settings",
    label: "Footer Ayarları",
    desc: "Footer içerikleri ve alt alan yapılarını yönetir.",
  },
  {
    key: "users_admin",
    label: "Yönetici Yetkileri",
    desc: "Admin ve sub admin kullanıcıların rol/yetki yönetimini yapar.",
  },
  {
    key: "pages_admin",
    label: "Sayfa Yönetimi",
    desc: "Özel sayfaları ve içerik düzenleme ekranlarını yönetir.",
  },
  {
    key: "settings_admin",
    label: "Genel Ayarlar",
    desc: "Site genel ayarları, mağaza ayarları ve temel yapılandırmaları düzenler.",
  },
  {
    key: "settings",
    label: "Operasyonel Ayarlar",
    desc: "Uygulama içi operasyon, ödeme, kargo, panel ve çeşitli ayar ekranlarına erişir.",
  },
  {
    key: "support",
    label: "Destek",
    desc: "Canlı destek paneli, thread listesi ve mesaj yönetimine erişir.",
  },
  {
    key: "support_notifications",
    label: "Destek Bildirimleri",
    desc: "Yeni destek mesajlarında push bildirim alır.",
  },
  {
    key: "notifications",
    label: "Bildirim Merkezi",
    desc: "Push bildirim merkezi, bildirim kayıtları ve gönderim ekranlarına erişir.",
  },
  {
    key: "wheel",
    label: "Şans Çarkı Yönetimi",
    desc: "Çark dashboard, kampanyalar, ödüller, kuponlar ve spin kayıtlarını yönetir.",
  },
  {
    key: "system",
    label: "Kontrol Merkezi",
    desc: "Sistem sağlık, log, hata ve teknik izleme ekranlarını yönetir.",
  },
];