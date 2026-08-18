import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ClassRow, GroupRow, SessionSettingRow } from "@/types/domain";

export async function listClasses(): Promise<ClassRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listGroups(): Promise<GroupRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("groups")
    .select("id, class_id, gender, name, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listSessionSettings(): Promise<SessionSettingRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("session_settings")
    .select("id, session_type, label, scan_start_time, on_time_until, end_time")
    .order("session_type", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
