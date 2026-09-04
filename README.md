# Absensi PPM Roudlotul Jannah

Aplikasi presensi santri berbasis web untuk mengelola sesi presensi, scan QR code, validasi petugas, rekap kehadiran, serta riwayat siswa dan sesi. Project ini dibangun dengan React melalui Next.js dan database MySQL/MariaDB.

## Fitur Utama

- Manajemen data santri
- Import data santri dari Excel/CSV
- Pembukaan sesi presensi per tanggal dan jenis sesi
- Scan QR Code santri untuk presensi
- Validasi petugas presensi dengan NIS
- Pengaturan waktu sesi (scan start, batas tepat waktu, selesai)
- Rekap kehadiran per periode
- Detail presensi per santri dan sesi
- Riwayat perubahan kelas santri
- Dashboard ringkasan presensi

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- MySQL/MariaDB
- Tailwind CSS
- SWR
- html5-qrcode
- xlsx

## Struktur Project

```bash
.
├── app/                  # Route dan halaman aplikasi Next.js
├── components/           # Komponen UI frontend
├── lib/                  # Service, helper, autentikasi, dan integrasi Supabase
├── public/               # Asset publik
├── supabase/             # Migration SQL legacy (gunakan SQL yang sesuai database hosting)
├── types/                # Type definitions
├── .env.example          # Contoh environment variables
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Prasyarat

Pastikan perangkat Anda sudah memiliki:

- Node.js 20+
- npm
- Database MySQL/MariaDB yang bisa diakses dari server hosting
- Browser modern

## Clone Repository

```bash
git clone <url-repository-anda>
cd absensi-ppm-roudlotul-jannah
```

## Instalasi

```bash
npm install
```

## Konfigurasi Environment

Buat file `.env.local` di root project, lalu isi konfigurasi berikut:

```env
DB_HOST=host-database-dari-provider
DB_PORT=3306
DB_USER=user_database
DB_PASSWORD=password_database
DB_NAME=nama_database
AUTH_SECRET=generate_random_secret_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password_anda
CRON_SECRET=opsional_secret_cron
```

Catatan:
- `AUTH_SECRET` digunakan untuk JWT login dashboard admin.
- `ADMIN_USERNAME` dan `ADMIN_PASSWORD` adalah credentials login administrator.
- Gunakan host database dari provider hosting, bukan `localhost`, jika database berada di server terpisah.
- Jalankan SQL schema pada database hosting sebelum aplikasi digunakan.

## Menjalankan Aplikasi

### Development

```bash
npm run dev
```

Aplikasi akan berjalan di:

```bash
http://localhost:3000
```

### Production Build

```bash
npm run build
npm run start
```

## Database MySQL/MariaDB

Project ini menggunakan MySQL/MariaDB melalui koneksi server-side.

Untuk setup awal database:

1. Buat database MySQL/MariaDB pada provider hosting.
2. Import SQL schema yang ada di folder `supabase/migrations` setelah menyesuaikan sintaks jika provider membutuhkannya.
3. Isi variabel `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, dan `DB_NAME` pada environment hosting.

File migration awal:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_seed_data.sql`

## Login Admin

Setelah aplikasi berjalan, login menggunakan username dan password yang sudah Anda set pada variabel environment:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Catatan Penting

- Semua akses database dilakukan melalui server-side service role Supabase.
- Browser tidak langsung mengakses data sensitif.
- Pastikan `.env.local` tidak ikut dipush ke GitHub untuk keamanan.

## Hosting

Aplikasi ini adalah React yang dijalankan oleh Next.js, sehingga hosting harus mendukung Node.js. Untuk Vercel, hubungkan repository, pilih framework Next.js, lalu isi environment variables di Project Settings. Untuk VPS atau hosting Node.js, jalankan:

```bash
npm install
npm run build
npm run start
```

Hosting statis seperti GitHub Pages tidak cukup karena aplikasi memiliki API login, API data, cookie session, dan koneksi database.

## GitHub Setup

Jika ingin push ke GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <url-github-anda>
git push -u origin main
```

## Lisensi

Project ini dibuat untuk kebutuhan internal PPM Roudlotul Jannah Surakarta.

## Kontributor

- Pengembang / Admin Project
