-- =====================================================================
-- Sistem Absensi PPM Roudlotul Jannah Surakarta
-- Migration 002: Seed Data untuk MySQL
-- =====================================================================

-- 1. Kelas akademik
INSERT IGNORE INTO classes (id, name, sort_order) VALUES
  ('cls-1001-cepatan-001', 'Cepatan', 1),
  ('cls-1002-lambatan-002', 'Lambatan', 2),
  ('cls-1003-bacaan-0003', 'Bacaan', 3);

-- 2. Kelompok presensi
INSERT IGNORE INTO groups (id, class_id, gender, name, sort_order) VALUES
  ('grp-1001-cepatan-l', 'cls-1001-cepatan-001', 'L', 'Cepatan Putra', 11),
  ('grp-1002-cepatan-p', 'cls-1001-cepatan-001', 'P', 'Cepatan Putri', 12),
  ('grp-1003-lambatan-l', 'cls-1002-lambatan-002', 'L', 'Lambatan Putra', 21),
  ('grp-1004-lambatan-p', 'cls-1002-lambatan-002', 'P', 'Lambatan Putri', 22),
  ('grp-1005-bacaan-l', 'cls-1003-bacaan-0003', 'L', 'Bacaan Putra', 31),
  ('grp-1006-bacaan-p', 'cls-1003-bacaan-0003', 'P', 'Bacaan Putri', 32);

-- 3. Default session settings
INSERT IGNORE INTO session_settings (id, session_type, label, scan_start_time, on_time_until, end_time) VALUES
  ('set-0001-subuh-0000', 'subuh', 'Subuh', '04:30:00', '04:45:00', '05:45:00'),
  ('set-0002-malam-0000', 'malam', 'Malam', '19:00:00', '19:30:00', '21:00:00');


