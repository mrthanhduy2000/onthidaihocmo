/**
 * Kiểm tra BẢN ĐÃ DEPLOY (cần mạng): `npm run check:prod`.
 *
 * Vì sao cần: build xanh trên máy KHÔNG có nghĩa là bản chạy thật còn sống. Đã từng xảy ra
 * đúng tình huống này: gỡ đăng nhập ở giao diện nhưng serverless vẫn đòi token Supabase, nên
 * mọi tính năng AI trên bản thật trả 401 mà giao diện lại âm thầm rơi về chế độ ngoại tuyến,
 * nhìn ngoài không thấy hỏng. Script này phơi bày đúng loại lỗi im lặng đó.
 *
 * Script chạy HAI lượt gọi, và phải đọc cả hai mới kết luận được:
 *   Lượt 1, KHÔNG kèm token: mong đợi 401. Đây là hàng rào chặn người lạ tiêu quota Gemini.
 *           Nếu lượt này trả 200 thì cổng AI đang mở toang cho cả thiên hạ.
 *   Lượt 2, CÓ token phiên ẩn danh: mong đợi KHÁC 401. Đây mới là thứ chứng minh ứng dụng thật
 *           sự dùng được, vì từ 27/07/2026 giao diện tự tạo phiên ẩn danh để lấy token
 *           (`src/services/supabaseClient.ts`).
 *
 * Chỉ nhìn lượt 1 rồi kết luận là sai lầm đã từng mắc: 401 khi không có token là ĐÚNG, không
 * phải hỏng.
 *
 * Lưu ý: lượt 2 gọi thật vào Gemini nên tiêu một ít quota. Đó là cái giá để biết chắc, thay vì
 * đoán từ mã nguồn.
 *
 * Cần `.env` có VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY thì mới chạy được lượt 2.
 *
 * Đổi địa chỉ kiểm tra: `node scripts/prodcheck.mjs https://ten-mien-khac`
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ quiet: true });

const BASE = process.argv[2] || "https://onthidaihocmo.vercel.app";
const TIMEOUT_MS = 25000;

async function hit(method, urlPath, body, token) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(BASE + urlPath, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 200) };
  } catch (e) {
    return { status: 0, body: `không gọi được: ${e.message}` };
  } finally {
    clearTimeout(timer);
  }
}

console.log(`Địa chỉ kiểm tra: ${BASE}\n`);

let bad = false;

const page = await hit("GET", "/");
const pageOk = page.status === 200;
console.log(`${pageOk ? "DAT " : "HONG"}  Trang chủ tải được  (HTTP ${page.status})`);
if (!pageOk) bad = true;

const health = await hit("GET", "/api/health");
const healthOk = health.status === 200;
console.log(`${healthOk ? "DAT " : "HONG"}  /api/health  (HTTP ${health.status})  ${health.body.replace(/\s+/g, " ")}`);
if (!healthOk) bad = true;

console.log("\nTrạng thái các cổng AI (gọi KHÔNG kèm token đăng nhập):");
const aiRoutes = [
  ["/api/ai/generate", { prompt: "kiem tra" }],
  ["/api/ai/explain", { questionId: 1, selectedAnswer: "a" }],
  ["/api/ai/chat", { message: "kiem tra" }],
  ["/api/ai/recommend", { stats: {} }],
];

let locked = 0;
let open = 0;
for (const [route, payload] of aiRoutes) {
  const r = await hit("POST", route, payload);
  const state = r.status === 401 ? "KHOA (doi dang nhap)" : r.status === 0 ? "KHONG GOI DUOC" : "MO";
  if (r.status === 401) locked++;
  else if (r.status !== 0) open++;
  console.log(`  ${route}  HTTP ${r.status}  ${state}`);
}

// ===== Lượt 2: gọi lại đúng các cổng đó, lần này KÈM token phiên ẩn danh =====

console.log("\nTrạng thái các cổng AI (gọi KÈM token phiên ẩn danh, giống hệt giao diện thật):");

const sbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const sbAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

let token = "";
let tokenNote = "";

if (!sbUrl || !sbAnon) {
  tokenNote = "BO QUA: thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env, không tạo được phiên.";
} else {
  try {
    const sb = createClient(sbUrl, sbAnon, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) {
      tokenNote = `HONG: không tạo được phiên ẩn danh. Lý do Supabase trả về: ${error.message}`;
      bad = true;
    } else {
      token = data?.session?.access_token || "";
      if (!token) {
        tokenNote = "HONG: Supabase nhận đăng nhập nhưng không trả token.";
        bad = true;
      }
    }
  } catch (e) {
    tokenNote = `HONG: lỗi khi gọi Supabase: ${e.message}`;
    bad = true;
  }
}

let usable = 0;
if (token) {
  for (const [route, payload] of aiRoutes) {
    const r = await hit("POST", route, payload, token);
    // Chỉ quan tâm một điều: có qua được cửa xác thực không. 401 là chưa qua.
    // Các mã khác (200, 400, 500) đều chứng tỏ đã qua cửa và đang chạy logic thật bên trong.
    const passed = r.status !== 401 && r.status !== 0;
    if (passed) usable++;
    console.log(`  ${passed ? "DAT " : "HONG"}  ${route}  HTTP ${r.status}${passed ? "" : "  VAN BI CHAN"}`);
    if (!passed) bad = true;
  }
} else {
  console.log(`  ${tokenNote}`);
}

console.log("");
if (token && usable === aiRoutes.length && locked === aiRoutes.length) {
  console.log("KẾT LUẬN: đúng trạng thái mong muốn.");
  console.log("  Người lạ không token bị chặn (401), còn giao diện thật có token thì dùng được đủ 4 cổng.");
} else if (locked !== aiRoutes.length && open === aiRoutes.length) {
  console.log("KẾT LUẬN: cổng AI đang MỞ cho mọi người, không cần token.");
  console.log("  Ai biết địa chỉ cũng gọi được và tiêu quota Gemini. Chấp nhận được nếu là chủ ý,");
  console.log("  nhưng phải biết mình đang chấp nhận rủi ro gì.");
} else if (!token) {
  console.log("KẾT LUẬN: chưa xác minh được đường có token, nên CHƯA biết ứng dụng thật có dùng được AI không.");
  console.log("  Nếu Supabase báo anonymous sign-ins bị tắt: vào Supabase > Authentication > Sign In / Providers");
  console.log("  và bật 'Anonymous sign-ins'. Đó là điều kiện bắt buộc của cách vá hiện tại.");
} else {
  console.log("KẾT LUẬN: trạng thái không nhất quán, phải xem lại từng cổng ở hai lượt gọi bên trên.");
  bad = true;
}

process.exit(bad ? 1 : 0);
