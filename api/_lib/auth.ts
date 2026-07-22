/**
 * Xác thực người dùng cho các serverless function AI.
 * - Nếu ĐÃ cấu hình Supabase (SUPABASE_URL + SUPABASE_ANON_KEY): bắt buộc có token hợp lệ,
 *   ngăn người lạ gọi API Gemini làm tốn quota.
 * - Nếu CHƯA cấu hình (chạy dev cục bộ không có Supabase): bỏ qua xác thực để tiện phát triển.
 */
import { createClient } from "@supabase/supabase-js";

export async function requireUser(req: any, res: any): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;

  // Chưa cấu hình Supabase -> cho qua (môi trường dev).
  if (!url || !anon) return true;

  const authz: string = req.headers?.authorization || req.headers?.Authorization || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Bạn cần đăng nhập để dùng tính năng AI." });
    return false;
  }

  try {
    const supabase = createClient(url, anon);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: "Không xác thực được phiên đăng nhập." });
    return false;
  }
}
