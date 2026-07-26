/**
 * Supabase client phía trình duyệt.
 * Đọc cấu hình từ biến môi trường Vite (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
 * Nếu chưa cấu hình, `supabase` = null và `isSupabaseConfigured` = false để app hiện
 * màn hình hướng dẫn thay vì vỡ.
 */
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";

// Đọc cấu hình PHẢI dùng optional chaining. `import.meta.env` chỉ tồn tại khi mã chạy qua Vite;
// dưới `tsx` (máy chủ dev `npm run dev`) và trong gói serverless thì nó là undefined, và đọc
// thẳng `.VITE_SUPABASE_URL` sẽ ném lỗi ngay lúc nạp module, giết chết cả tiến trình.
//
// Đây chính là Bẫy 2 trong AGENTS.md. Trong ngày 27/07/2026 nó cắn ba lần liên tiếp, mỗi lần vì
// một file khác lỡ nhập gián tiếp tới file này. Vá tại gốc ở đây thì mọi nơi nhập về sau đều an
// toàn, không phải nhớ đặt `define` ở từng công cụ đóng gói nữa.
const bienMoiTruong = (import.meta as any)?.env ?? {};
const url = bienMoiTruong.VITE_SUPABASE_URL as string | undefined;
const anon = bienMoiTruong.VITE_SUPABASE_ANON_KEY as string | undefined;

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

/**
 * Vì sao có hàm này: các hàm serverless AI bắt buộc token Supabase hợp lệ
 * (`functions-src/_lib/auth.ts`), trong khi giao diện đã gỡ hẳn màn đăng nhập. Hệ quả từng đo
 * được trên bản chạy thật: cả 4 cổng `/api/ai/*` trả 401, hỏi đáp và gợi ý âm thầm rơi về chế
 * độ ngoại tuyến, còn sinh câu hỏi từ tài liệu thì báo lỗi thẳng.
 *
 * Cách vá: tự tạo phiên ẩn danh để có token, người dùng không phải nhập gì. Phiên này chỉ dùng
 * để qua cửa xác thực, KHÔNG dùng làm danh tính đồng bộ đám mây (xem `main.tsx`).
 *
 * Điều kiện bắt buộc phía Supabase: bật "Anonymous sign-ins" trong Authentication. Chưa bật thì
 * hàm trả về null và ứng dụng chạy tiếp ở chế độ ngoại tuyến đúng như trước, không vỡ.
 */
let sessionInFlight: Promise<Session | null> | null = null;

async function resolveSession(): Promise<Session | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return data.session;

    const { data: created, error } = await supabase.auth.signInAnonymously();
    if (error) {
      // Nguyên nhân hay gặp nhất: chưa bật Anonymous sign-ins trong Supabase.
      console.warn("[supabase] Không tạo được phiên ẩn danh, AI sẽ chạy ngoại tuyến:", error.message);
      return null;
    }
    return created?.session ?? null;
  } catch (e: any) {
    console.warn("[supabase] Lỗi khi lấy phiên:", e?.message);
    return null;
  }
}

/**
 * Trả về phiên hiện có, hoặc tạo phiên ẩn danh nếu chưa có. Không bao giờ ném lỗi.
 *
 * Nhiều lời gọi đồng thời dùng chung MỘT lượt đăng nhập: nếu không gom lại, màn hình vừa mở đã
 * bắn vài lời gọi AI song song và mỗi lời gọi lại tạo một người dùng ẩn danh riêng.
 */
export async function ensureSession(): Promise<Session | null> {
  if (!supabase) return null;
  if (!sessionInFlight) {
    sessionInFlight = resolveSession().finally(() => {
      sessionInFlight = null;
    });
  }
  return sessionInFlight;
}
