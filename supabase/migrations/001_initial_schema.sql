-- =====================================================================
-- Sistem Absensi PPM Roudlotul Jannah Surakarta
-- Migration 001: Initial Schema
-- =====================================================================
-- Jalankan file ini di Supabase SQL Editor (atau via Supabase CLI
-- migration) pada project yang masih kosong. File ini idempotent
-- sebagian (memakai IF NOT EXISTS) sehingga aman dijalankan ulang saat
-- development, tetapi tetap disarankan hanya dijalankan sekali di
-- project production.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. classes
-- Kelas akademik: Bacaan, Lambatan, Cepatan. Dapat ditambah/diubah
-- oleh admin di masa depan (lihat requirement #5).
-- ---------------------------------------------------------------------
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. groups (kelompok presensi = kelas x gender)
-- Contoh: "Cepatan Putra", "Cepatan Putri", dst (6 kelompok default).
-- ---------------------------------------------------------------------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete restrict,
  gender text not null check (gender in ('L', 'P')),
  name text not null unique, -- snapshot label, contoh: "Cepatan Putra"
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (class_id, gender)
);

-- ---------------------------------------------------------------------
-- 3. students (santri)
-- ---------------------------------------------------------------------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  name text not null,
  class_id uuid not null references classes(id) on delete restrict,
  gender text not null check (gender in ('L', 'P')),
  generation text, -- angkatan
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_class on students(class_id);
create index if not exists idx_students_active on students(active);

-- current group santri (kelas + gender) diturunkan dari class_id + gender
-- kita simpan view helper di bawah setelah tabel groups terisi.

-- ---------------------------------------------------------------------
-- 4. student_class_history
-- Riwayat perpindahan kelas santri, agar laporan historis tidak berubah
-- ketika santri pindah kelas (requirement #7 & #41).
-- effective_from = tanggal mulai berlaku (WIB, date only).
-- effective_to = null berarti masih berlaku sampai sekarang, atau berisi
-- tanggal sebelum baris berikutnya mulai berlaku.
-- ---------------------------------------------------------------------
create table if not exists student_class_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete restrict,
  gender text not null check (gender in ('L', 'P')),
  effective_from date not null,
  effective_to date, -- null = masih berlaku
  created_at timestamptz not null default now()
);

create index if not exists idx_sch_student on student_class_history(student_id, effective_from);

-- ---------------------------------------------------------------------
-- 5. attendance_operators (petugas presensi)
-- ---------------------------------------------------------------------
create table if not exists attendance_operators (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  group_id uuid not null references groups(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (student_id, group_id)
);

create index if not exists idx_operators_active on attendance_operators(active);

-- ---------------------------------------------------------------------
-- 6. session_settings
-- Default waktu per jenis sesi (Subuh / Malam). Dapat diedit admin dan
-- dipakai sebagai nilai default ketika membuka sesi baru.
-- ---------------------------------------------------------------------
create table if not exists session_settings (
  id uuid primary key default gen_random_uuid(),
  session_type text not null unique check (session_type in ('subuh', 'pagi', 'siang', 'malam')),
  label text not null,
  scan_start_time time not null,
  on_time_until time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. attendance_sessions
-- Satu baris = satu (tanggal, jenis sesi). Waktu disalin dari
-- session_settings saat sesi dibuat, tapi dapat diedit khusus untuk
-- tanggal tersebut tanpa mengubah default global.
-- ---------------------------------------------------------------------
create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  session_type text not null check (session_type in ('subuh', 'pagi', 'siang', 'malam')),
  scan_start_time time not null,
  on_time_until time not null,
  end_time time not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_date, session_type)
);

create index if not exists idx_sessions_date on attendance_sessions(session_date);

-- ---------------------------------------------------------------------
-- 8. session_groups
-- Menyimpan kelompok mana saja yang dibuka pada suatu sesi, dan status
-- buka/tutup manual + status finalisasi otomatis (Alpa).
-- ---------------------------------------------------------------------
create table if not exists session_groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  group_id uuid not null references groups(id) on delete restrict,
  opened boolean not null default true, -- dipilih saat sesi dibuka
  closed_manually boolean not null default false, -- ditutup admin lebih awal
  finalized boolean not null default false, -- sudah diproses Alpa otomatis
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, group_id)
);

create index if not exists idx_session_groups_session on session_groups(session_id);
create index if not exists idx_session_groups_finalized on session_groups(finalized) where finalized = false;

-- ---------------------------------------------------------------------
-- 9. attendance_records
-- Satu santri hanya boleh punya satu record per sesi (unique constraint).
-- Snapshot class/group/gender disimpan agar histori laporan tetap akurat
-- walau santri pindah kelas di kemudian hari.
-- ---------------------------------------------------------------------
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete restrict,
  group_id uuid not null references groups(id) on delete restrict,
  status text not null check (status in ('hadir', 'terlambat', 'izin', 'sakit', 'alpa')),
  scanned_at timestamptz, -- null untuk Alpa otomatis / izin-sakit manual tanpa scan
  source text not null default 'scan' check (source in ('scan', 'manual_nis', 'auto_alpa', 'edited')),
  operator_id uuid references attendance_operators(id) on delete set null,
  class_id_snapshot uuid not null references classes(id),
  group_name_snapshot text not null,
  gender_snapshot text not null check (gender_snapshot in ('L', 'P')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists idx_attendance_session on attendance_records(session_id);
create index if not exists idx_attendance_student on attendance_records(student_id);
create index if not exists idx_attendance_group on attendance_records(group_id);

-- ---------------------------------------------------------------------
-- Trigger helper: auto-update updated_at
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_students_updated_at on students;
create trigger trg_students_updated_at before update on students
  for each row execute function set_updated_at();

drop trigger if exists trg_sessions_updated_at on attendance_sessions;
create trigger trg_sessions_updated_at before update on attendance_sessions
  for each row execute function set_updated_at();

drop trigger if exists trg_records_updated_at on attendance_records;
create trigger trg_records_updated_at before update on attendance_records
  for each row execute function set_updated_at();

drop trigger if exists trg_settings_updated_at on session_settings;
create trigger trg_settings_updated_at before update on session_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- Semua akses tabel dilakukan dari server (service role) menggunakan
-- SUPABASE_SECRET_KEY, tidak pernah langsung dari browser. Karena itu
-- RLS diaktifkan tanpa policy publik apa pun -- service role secara
-- default melewati RLS, sedangkan anon/browser tidak akan mendapatkan
-- akses apa pun ke tabel-tabel ini.
-- ---------------------------------------------------------------------
alter table classes enable row level security;
alter table groups enable row level security;
alter table students enable row level security;
alter table student_class_history enable row level security;
alter table attendance_operators enable row level security;
alter table session_settings enable row level security;
alter table attendance_sessions enable row level security;
alter table session_groups enable row level security;
alter table attendance_records enable row level security;

-- Tidak ada CREATE POLICY untuk anon/authenticated: secara default semua
-- akses non-service-role akan ditolak, sesuai prinsip least privilege.
