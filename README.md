# LocalUpload

Yerel ağda dosya paylaşımı yapmanızı sağlayan, şifre korumalı, minimal ve modern bir web uygulamasıdır. Aynı Wi-Fi ağına bağlı cihazlar arasında hızlıca dosya transferi yapabilirsiniz.

## Özellikler

- **Şifre koruması** — Uygulamaya erişim şifre ile kontrol edilir
- **Sürükle-bırak yükleme** — Dosyaları sürükleyerek veya tıklayarak yükleyin
- **Çoklu dosya desteği** — Aynı anda birden fazla dosya yükleyebilirsiniz
- **5 GB dosya limiti** — Büyük dosyaları da aktarabilirsiniz
- **Dosya yönetimi** — Yüklenen dosyaları indirin veya silin
- **Gerçek zamanlı güncelleme** — Dosya listesi otomatik olarak yenilenir
- **Mobil uyumlu** — Telefon ve tabletten de rahatça kullanılabilir
- **Koyu tema** — Göz yormayan modern arayüz

## Gereksinimler

- [Node.js](https://nodejs.org/) (v18 veya üzeri önerilir)

## Kurulum

```bash
git clone git@github.com:fatihcimen/LocalUpload.git
cd LocalUpload
npm install
```

## Kullanım

Sunucuyu başlatın:

```bash
node server.js
```

Çıktıda yerel ve ağ adresleri gösterilecektir:

```
  ╔══════════════════════════════════════════╗
  ║       LOCAL UPLOAD - Dosya Paylaşımı     ║
  ╠══════════════════════════════════════════╣
  ║  Yerel:   http://localhost:8080          ║
  ║  Ağ:      http://192.168.x.x:8080       ║
  ╠══════════════════════════════════════════╣
  ║  Şifre:   localupload2026               ║
  ╠══════════════════════════════════════════╣
  ║  Ağ adresini paylaşarak dosya gönderin   ║
  ╚══════════════════════════════════════════╝
```

**Ağ adresi** (`http://192.168.x.x:8080`) linkini aynı Wi-Fi ağındaki diğer cihazlarla paylaşın. Karşı taraf tarayıcıdan bu adrese girip şifreyi yazarak dosya gönderebilir veya indirebilir.

**Varsayılan şifre:** `localupload2026`

> Şifreyi değiştirmek için `server.js` dosyasındaki `PASSWORD` değişkenini düzenleyin.

## API Uç Noktaları

| Metot    | Yol                      | Açıklama           |
| -------- | ------------------------ | ------------------- |
| `GET`    | `/`                      | Ana sayfa (UI)      |
| `POST`   | `/login`                 | Şifre ile giriş     |
| `GET`    | `/api/files`             | Dosya listesi        |
| `POST`   | `/upload`                | Dosya yükleme        |
| `GET`    | `/download/:filename`    | Dosya indirme        |
| `DELETE` | `/api/files/:filename`   | Dosya silme          |

## Proje Yapısı

```
LocalUpload/
├── server.js        # Ana sunucu dosyası (Express + Multer + gömülü UI)
├── downloads/       # Yüklenen dosyaların saklandığı klasör
├── package.json
└── README.md
```

## Lisans

ISC
