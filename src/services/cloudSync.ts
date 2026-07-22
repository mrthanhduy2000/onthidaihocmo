/**
 * Đồng bộ TOÀN BỘ trạng thái người dùng lên Supabase (mô hình 1 người dùng).
 * - pull(): tải bản chụp trạng thái từ Supabase về, nạp thẳng vào localStorage TRƯỚC khi
 *   app khởi động (để dbService đọc đúng dữ liệu đã đồng bộ).
 * - startAutoPush(): vá localStorage.setItem để mỗi thay đổi (có tiền tố poly_econ) sẽ
 *   được đẩy lên Supabase sau một khoảng chờ (debounce), cộng đẩy nốt khi rời trang.
 *
 * Bản chụp là toàn bộ cặp key/value trong localStorage bắt đầu bằng "poly_econ",
 * bao gồm cả ngân hàng câu hỏi AI (poly_econ_overrides_questions_*), lịch sử, thống kê,
 * mục tiêu, tài nguyên, mô hình học... nên không sót dữ liệu.
 */
import { supabase } from "./supabaseClient";

const TABLE = "app_state";
const PREFIX = "poly_econ";
const DEBOUNCE_MS = 2500;

let currentUserId: string | null = null;
let hydrating = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let patched = false;

function snapshotLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    }
  }
  return out;
}

function restoreLocal(snap: Record<string, string>): void {
  // Xóa các key cũ cùng tiền tố rồi nạp lại bản chụp từ cloud.
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  Object.entries(snap).forEach(([k, v]) => {
    try { localStorage.setItem(k, v); } catch {}
  });
}

export const cloudSync = {
  /** Tải trạng thái từ cloud về localStorage. Trả về true nếu có dữ liệu đã nạp. */
  async pull(userId: string): Promise<boolean> {
    if (!supabase) return false;
    currentUserId = userId;
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.warn("[cloudSync] pull error:", error.message);
        return false;
      }
      const snap = data?.data as Record<string, string> | undefined;
      if (snap && typeof snap === "object" && Object.keys(snap).length > 0) {
        hydrating = true;
        restoreLocal(snap);
        hydrating = false;
        return true;
      }
      return false;
    } catch (e: any) {
      console.warn("[cloudSync] pull exception:", e?.message);
      return false;
    }
  },

  /** Đẩy trạng thái hiện tại lên cloud (upsert 1 dòng theo user_id). */
  async push(): Promise<void> {
    if (!supabase || !currentUserId) return;
    try {
      const snap = snapshotLocal();
      await supabase
        .from(TABLE)
        .upsert({ user_id: currentUserId, data: snap, updated_at: new Date().toISOString() });
    } catch (e: any) {
      console.warn("[cloudSync] push error:", e?.message);
    }
  },

  schedulePush(): void {
    if (hydrating || !currentUserId) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { void cloudSync.push(); }, DEBOUNCE_MS);
  },

  /** Bắt đầu tự động đẩy lên cloud mỗi khi localStorage thay đổi. Gọi SAU pull(). */
  startAutoPush(userId: string): void {
    currentUserId = userId;
    if (patched) return;
    patched = true;

    const rawSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key: string, value: string) => {
      rawSetItem(key, value);
      if (!hydrating && key.startsWith(PREFIX)) cloudSync.schedulePush();
    };

    window.addEventListener("beforeunload", () => { void cloudSync.push(); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void cloudSync.push();
    });
  },
};
