-- =====================================================================
-- Sistem Absensi PPM Roudlotul Jannah Surakarta
-- Migration 002: Seed Data
-- =====================================================================
-- Data dummy secukupnya agar aplikasi langsung dapat dites. Data santri
-- sesungguhnya akan diimport lewat menu "Data Santri" (CSV/Excel).
-- =====================================================================

-- 1. Kelas akademik
insert into classes (name, sort_order) values
  ('Cepatan', 1),
  ('Lambatan', 2),
  ('Bacaan', 3)
on conflict (name) do nothing;

-- 2. Kelompok presensi (kelas x gender) -- 6 kelompok default
insert into groups (class_id, gender, name, sort_order)
select c.id, g.gender, c.name || ' ' || g.label, c.sort_order * 10 + g.sort_order
from classes c
cross join (
  values ('L', 'Putra', 1), ('P', 'Putri', 2)
) as g(gender, label, sort_order)
on conflict (name) do nothing;

-- 3. Default session settings (Subuh & Malam)
insert into session_settings (session_type, label, scan_start_time, on_time_until, end_time) values
  ('subuh', 'Subuh', '04:30', '04:45', '05:45'),
  ('malam', 'Malam', '19:00', '19:30', '21:00')
on conflict (session_type) do nothing;

-- 4. Beberapa santri dummy (secukupnya untuk testing)
do $$
declare
  v_cepatan_putra uuid;
  v_cepatan_putri uuid;
  v_lambatan_putra uuid;
  v_bacaan_putri uuid;
  v_class_cepatan uuid;
  v_class_lambatan uuid;
  v_class_bacaan uuid;
begin
  select id into v_class_cepatan from classes where name = 'Cepatan';
  select id into v_class_lambatan from classes where name = 'Lambatan';
  select id into v_class_bacaan from classes where name = 'Bacaan';

  select id into v_cepatan_putra from groups where name = 'Cepatan Putra';
  select id into v_cepatan_putri from groups where name = 'Cepatan Putri';
  select id into v_lambatan_putra from groups where name = 'Lambatan Putra';
  select id into v_bacaan_putri from groups where name = 'Bacaan Putri';

  insert into students (nis, name, class_id, gender, generation, active) values
    ('240123001', 'Ahmad Fauzan', v_class_cepatan, 'L', '2024', true),
    ('240123002', 'Muhammad Rizqi Abroori', v_class_cepatan, 'L', '2024', true),
    ('240123003', 'Gagah Satria Putra', v_class_cepatan, 'L', '2024', true),
    ('240123004', 'Siti Aisyah', v_class_cepatan, 'P', '2024', true),
    ('240123005', 'Nur Halimah', v_class_cepatan, 'P', '2024', true),
    ('230123006', 'Fajar Nur Ilham', v_class_lambatan, 'L', '2023', true),
    ('230123007', 'Rizky Maulana', v_class_lambatan, 'L', '2023', true),
    ('220123008', 'Khoirunnisa', v_class_bacaan, 'P', '2022', true),
    ('220123009', 'Dewi Lestari', v_class_bacaan, 'P', '2022', true),
    ('210123010', 'Santri Nonaktif Contoh', v_class_bacaan, 'L', '2021', false)
  on conflict (nis) do nothing;

  -- Riwayat kelas awal untuk seluruh santri di atas (berlaku sejak dibuat)
  insert into student_class_history (student_id, class_id, gender, effective_from, effective_to)
  select s.id, s.class_id, s.gender, current_date, null
  from students s
  where s.nis in (
    '240123001','240123002','240123003','240123004','240123005',
    '230123006','230123007','220123008','220123009','210123010'
  )
  on conflict do nothing;

  -- Beberapa petugas presensi dummy
  insert into attendance_operators (student_id, group_id, active)
  select s.id, v_cepatan_putra, true from students s where s.nis = '240123001'
  on conflict do nothing;

  insert into attendance_operators (student_id, group_id, active)
  select s.id, v_cepatan_putri, true from students s where s.nis = '240123004'
  on conflict do nothing;

  insert into attendance_operators (student_id, group_id, active)
  select s.id, v_lambatan_putra, true from students s where s.nis = '230123006'
  on conflict do nothing;

  insert into attendance_operators (student_id, group_id, active)
  select s.id, v_bacaan_putri, true from students s where s.nis = '220123008'
  on conflict do nothing;
end $$;
