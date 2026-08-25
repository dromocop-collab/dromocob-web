# Dromocob Demo Store

Müşteri sunumları için hazırlanmış genel e-ticaret demo projesi.

Aktif uygulama `apps/demo` dizinindedir. Eski proje kodu `apps/web` altında yalnızca geçiş kaynağı olarak tutulur ve varsayılan build sürecine dahil edilmez.

## Güvenlik

- Canlı Firebase proje bağlantısı kaldırılmıştır.
- `.env` dosyaları ve eski Git geçmişi aktarılmaz.
- Demo ödeme, kargo, e-posta veya analitik servisine bağlanmaz.

## Çalıştırma

```bash
npm --prefix apps/demo install
npm run dev
```
