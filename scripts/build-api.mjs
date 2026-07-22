/**
 * Đóng gói (bundle) mỗi Serverless Function trong /api thành MỘT file .js độc lập,
 * dùng CommonJS thuần (require/module.exports), không còn bất kỳ import/export ES nào,
 * và không còn phụ thuộc resolve module nào ra ngoài file (mọi thứ được inline).
 *
 * Lý do: Vercel biên dịch từng file .ts trong /api RIÊNG LẺ rồi để Node tự resolve
 * các import tương đối lúc chạy (không tự bundle full graph như ta tưởng). Vì code
 * gốc dùng import không ghi đuôi (chuẩn "bundler" resolution của Vite/TS), Node's
 * loader thực tế (dù CJS hay ESM) đều gặp lỗi/cảnh báo khi cố resolve các file
 * "../../src/services/..." nằm ngoài /api. Bundle trước bằng esbuild loại bỏ hoàn
 * toàn vấn đề này: kết quả là 1 file .js tự chứa, không có gì để resolve nữa.
 *
 * Script này CHỈ chạy trong bước build của Vercel (xem vercel.json "buildCommand"),
 * KHÔNG ảnh hưởng tới dev cục bộ (server.ts vẫn dùng thẳng các file .ts qua tsx).
 */
import { build } from "esbuild";
import { readdirSync, statSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, "..", "api");

/** Tìm mọi file .ts entrypoint trong /api (bỏ qua thư mục "_lib" - đó là file dùng chung, không phải route). */
function findEntrypoints(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "_lib") continue; // helper dùng chung, không phải route
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...findEntrypoints(full));
    } else if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const entrypoints = findEntrypoints(apiDir);
console.log(`[build-api] Đóng gói ${entrypoints.length} hàm serverless:`);
entrypoints.forEach((f) => console.log(`  - ${path.relative(apiDir, f)}`));

for (const entry of entrypoints) {
  const outfile = entry.replace(/\.ts$/, ".js");
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    sourcemap: false,
    logLevel: "warning",
  });
  rmSync(entry); // Xóa .ts nguồn để Vercel chỉ thấy đúng 1 route (.js đã bundle), tránh trùng lặp.
}

// Xóa thư mục _lib (đã được inline vào từng file bundle, không còn cần thiết ở output).
rmSync(path.join(apiDir, "_lib"), { recursive: true, force: true });

console.log("[build-api] Hoàn tất.");
