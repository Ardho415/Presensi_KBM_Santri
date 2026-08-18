import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SessionType } from "@/types/domain";

export interface CreateSessionInput {
  sessionDate: string;
  sessionType: SessionType;
  scanStartTime: string;
  onTimeUntil: string;
  endTime: string;
  groupIds: string[];
}

export async function createSession(input: CreateSessionInput) {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("session_date", input.sessionDate)
    .eq("session_type", input.sessionType)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    throw new Error(
      `Sesi ${input.sessionType} untuk tanggal ${input.sessionDate} sudah ada. Satu tanggal + jenis sesi hanya boleh memiliki satu sesi.`
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .insert({
      session_date: input.sessionDate,
      session_type: input.sessionType,
      scan_start_time: input.scanStartTime,
      on_time_until: input.onTimeUntil,
      end_time: input.endTime,
      status: "open",
    })
    .select("id")
    .single();

  if (sessionError) throw sessionError;

  if (input.groupIds.length > 0) {
    const rows = input.groupIds.map((groupId) => ({
      session_id: session.id,
      group_id: groupId,
      opened: true,
      closed_manually: false,
      finalized: false,
    }));
    const { error: sgError } = await supabase.from("session_groups").insert(rows);
    if (sgError) throw sgError;
  }

  return session.id as string;
}

export async function listSessions(limit = 30) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(
      "id, session_date, session_type, scan_start_time, on_time_until, end_time, status, session_groups(id, opened, closed_manually, finalized, groups(id, name))"
    )
    .order("session_date", { ascending: false })
    .order("session_type", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getSessionDetail(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(
      "id, session_date, session_type, scan_start_time, on_time_until, end_time, status, session_groups(id, group_id, opened, closed_manually, finalized, groups(id, name))"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSession(id: string) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("attendance_sessions").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleSessionGroup(
  sessionId: string,
  groupId: string,
  action: "close" | "reopen"
) {
  const supabase = getSupabaseAdmin();
  const { data: sg, error: findError } = await supabase
    .from("session_groups")
    .select("id")
    .eq("session_id", sessionId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (findError) throw findError;
  if (!sg) throw new Error("Kelompok tidak ditemukan pada sesi ini.");

  const { error } = await supabase
    .from("session_groups")
    .update({ closed_manually: action === "close" })
    .eq("id", sg.id);
  if (error) throw error;
}

export async function getActiveSessionSummaryForToday(todayStr: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("id, session_type, scan_start_time, on_time_until, end_time, status")
    .eq("session_date", todayStr)
    .order("session_type", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
