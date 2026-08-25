# Dromocob Web

Dromocob; vitrini, ürün kataloğu, sepeti, ödeme akışı, müşteri hesabı ve kapsamlı yönetim paneli bulunan genel amaçlı bir e-ticaret başlangıç projesidir.

## Yapı

- `apps/web`: Next.js mağaza ve yönetim paneli
- `functions`: Firebase Functions backend görevleri
- `firebase.json`: Firebase Hosting ve Functions yapılandırması

## Yerel geliştirme

```bash
cd apps/web
cp .env.example .env.local
npm ci
npm run dev
```

Web uygulaması varsayılan olarak `http://localhost:3000` adresinde açılır. Firebase istemci değerlerini `apps/web/.env.local`, backend sırlarını Firebase Secret Manager veya dağıtım ortamı üzerinden tanımlayın. Gerçek anahtarları depoya eklemeyin.

Backend doğrulaması:

```bash
cd functions
cp .env.example .env.local
npm ci
npm run build
```

Üretim doğrulaması:

```bash
cd apps/web
npm run build
```

Firebase App Hosting bağlantısında canlı dal olarak `main`, uygulama kök dizini olarak `apps/web` seçilebilir.
