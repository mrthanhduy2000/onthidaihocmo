/**
 * Supabase client phía trình duyệt.
 * Đọc cấu hình từ biến môi trường Vite (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 * Nếu chưa cấu hình, `supabase` = null và `isSupabaseConfigured` = false để app hiện
 * màn hình hướng dẫn thay vì vỡ.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anon as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
