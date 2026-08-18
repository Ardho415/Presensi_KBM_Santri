# Absensi PPM Roudlotul Jannah

Aplikasi presensi santri berbasis web untuk mengelola sesi presensi, scan QR code, validasi petugas, rekap kehadiran, serta riwayat siswa dan sesi. Project ini dibangun dengan Next.js dan Supabase.

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
- Supabase
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
├── supabase/             # Migration database
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
- Akun Supabase
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
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_supabase_service_role_key
AUTH_SECRET=generate_random_secret_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password_anda
```

Catatan:
- `AUTH_SECRET` digunakan untuk JWT login dashboard admin.
- `ADMIN_USERNAME` dan `ADMIN_PASSWORD` adalah credentials login administrator.
- `SUPABASE_SECRET_KEY` harus menggunakan service role key dari Supabase.

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

## Database Supabase

Project ini menggunakan Supabase dan migration SQL yang ada di folder `supabase/migrations`.

Untuk setup awal database:

1. Buat project baru di Supabase
2. Buka SQL Editor di Supabase
3. Jalankan migration yang ada di folder `supabase/migrations` secara berurutan

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
