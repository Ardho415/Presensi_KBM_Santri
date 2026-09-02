export type Gender = "L" | "P";

export type SessionType = "subuh" | "pagi" | "siang" | "malam";

export type AttendanceStatus = "hadir" | "terlambat" | "izin" | "sakit" | "alpa";

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: "Hadir",
  terlambat: "Terlambat",
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};

export const ATTENDANCE_STATUS_CODE: Record<AttendanceStatus, string> = {
  hadir: "H",
  terlambat: "T",
  izin: "I",
  sakit: "S",
  alpa: "A",
};

export interface ClassRow {
  id: string;
  name: string;
  sort_order: number;
}

export interface GroupRow {
  id: string;
  class_id: string;
  gender: Gender;
  name: string;
  sort_order: number;
}

export interface StudentRow {
  id: string;
  nis: string;
  name: string;
  class_id: string;
  gender: Gender;
  generation: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentWithClass extends StudentRow {
  class_name: string;
  group_name: string;
}

export interface OperatorRow {
  id: string;
  student_id: string;
  group_id: string;
  active: boolean;
}

export interface SessionSettingRow {
  id: string;
  session_type: SessionType;
  label: string;
  scan_start_time: string;
  on_time_until: string;
  end_time: string;
}

export interface AttendanceSessionRow {
  id: string;
  session_date: string;
  session_type: SessionType;
  scan_start_time: string;
  on_time_until: string;
  end_time: string;
  status: "open" | "closed";
}

export interface SessionGroupRow {
  id: string;
  session_id: string;
  group_id: string;
  opened: boolean;
  closed_manually: boolean;
  finalized: boolean;
}

export interface AttendanceRecordRow {
  id: string;
  session_id: string;
  student_id: string;
  group_id: string;
  status: AttendanceStatus;
  scanned_at: string | null;
  source: "scan" | "manual_nis" | "auto_alpa" | "edited";
  operator_id: string | null;
  class_id_snapshot: string;
  group_name_snapshot: string;
  gender_snapshot: Gender;
}

export interface ScanResult {
  ok: boolean;
  message: string;
  studentName?: string;
  status?: AttendanceStatus;
}
