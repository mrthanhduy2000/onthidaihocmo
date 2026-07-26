/**
 * Kiểm tra BẢN ĐÃ DEPLOY (cần mạng): `npm run check:prod`.
 *
 * Vì sao cần: build xanh trên máy KHÔNG có nghĩa là bản chạy thật còn sống. Đã từng xảy ra
 * đúng tình huống này: gỡ đăng nhập ở giao diện nhưng serverless vẫn đòi token Supabase, nên
 * mọi tính năng AI trên bản thật trả 401 mà giao diện lại âm thầm rơi về chế độ ngoại tuyến,
 * nhìn ngoài không thấy hỏng. Script này phơi bày đúng loại lỗi im lặng đó.
 *
 * Đọc kết quả:
 *   - /api/health phải 200. Sai là bản deploy hỏng.
 *   - Các /api/ai/* trả 401 nghĩa là máy chủ đang BẮT BUỘC đăng nhập (functions-src/_lib/auth.ts).
 *     Nếu giao diện không còn màn đăng nhập thì đây là mâu thuẫn cần xử lý, không phải chuyện nhỏ.
 *   - Trả 200 hoặc 4xx khác nghĩa là cổng AI đang MỞ cho mọi người gọi.
 *
 * Đổi địa chỉ kiểm tra: `node scripts/prodcheck.mjs https://ten-mien-khac`
 */
const BASE = process.argv[2] || "https://onthidaihocmo.vercel.app";
const TIMEOUT_MS = 25000;

async function hit(method, urlPath, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + urlPath, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
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

console.log("");
if (locked === aiRoutes.length) {
  console.log("KẾT LUẬN: máy chủ đang BẮT BUỘC đăng nhập cho mọi cổng AI.");
  console.log("  Giao diện hiện KHÔNG còn màn đăng nhập (src/main.tsx), nên trên bản thật:");
  console.log("  hỏi đáp AI, gợi ý AI và giải thích sâu đều rơi về chế độ ngoại tuyến trong im lặng,");
  console.log("  còn chức năng sinh câu hỏi từ tài liệu sẽ báo lỗi thẳng.");
  console.log("  Cách xử lý xem mục 'Bẫy đã biết' trong AGENTS.md.");
} else if (open === aiRoutes.length) {
  console.log("KẾT LUẬN: cổng AI đang MỞ, ai biết địa chỉ cũng gọi được và tiêu quota Gemini.");
  console.log("  Chấp nhận được nếu đó là lựa chọn có chủ đích, nhưng phải biết mình đang chấp nhận rủi ro gì.");
} else {
  console.log("KẾT LUẬN: các cổng AI không đồng nhất trạng thái, cần xem lại từng cổng.");
  bad = true;
}

process.exit(bad ? 1 : 0);
