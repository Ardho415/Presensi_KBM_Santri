import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase khusus server, menggunakan SUPABASE_SECRET_KEY (service
 * role). File ini di-guard dengan paket `server-only` sehingga build akan
 * gagal apabila secara tidak sengaja diimport dari kode client/browser.
 *
 * JANGAN PERNAH mengimport file ini dari komponen yang berjalan di
 * browser ("use client").
 */

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Konfigurasi Supabase tidak lengkap. Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY sudah diset di environment variables."
    );
  }

  cachedClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
