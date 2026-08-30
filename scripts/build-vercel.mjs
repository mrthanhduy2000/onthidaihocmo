/**
 * Build cho Vercel bằng Build Output API (https://vercel.com/docs/build-output-api).
 *
 * Vì sao dùng cách này: bộ builder mặc định của Vercel (@vercel/node) transpile TỪNG file
 * .ts trong /api rời rạc, để lại các lệnh import không đuôi và loại bỏ thư mục tiền tố "_",
 * gây lỗi "Cannot find module" lúc chạy. Ở đây ta tự bundle mỗi hàm thành MỘT file
 * CommonJS hoàn chỉnh (mọi phụ thuộc được inline, không còn gì để resolve lúc chạy) rồi
 * đặt vào .vercel/output theo đúng chuẩn Vercel. Vercel sẽ deploy y nguyên, bỏ qua hoàn
 * toàn @vercel/node.
 *
 * Quan trọng: script này KHÔNG xóa/sửa file nguồn .ts nào. Chỉ ghi ra .vercel/output.
 */
import { build as esbuild } from "esbuild";
import { dinhNghiaPhienBan } from "./phien-ban-build.mjs";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, ".vercel", "output");
const NODE_RUNTIME = "nodejs22.x";

// Danh sách route serverless: đường dẫn file nguồn (ngoài /api để Vercel không tự build) -> route URL.
const routes = [
  { src: "functions-src/health.ts", route: "api/health" },
  { src: "functions-src/ai/generate.ts", route: "api/ai/generate" },
  { src: "functions-src/ai/complete.ts", route: "api/ai/complete" },
  { src: "functions-src/ai/chat.ts", route: "api/ai/chat" },
  { src: "functions-src/ai/recommend.ts", route: "api/ai/recommend" },
];

async function main() {
  // 1. Dọn output cũ.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // 2. Build frontend bằng Vite -> dist/, rồi copy sang .vercel/output/static.
  console.log("[build-vercel] Đang build frontend (vite)...");
  execSync("npx vite build", { cwd: root, stdio: "inherit" });
  const staticDir = path.join(outDir, "static");
  cpSync(path.join(root, "dist"), staticDir, { recursive: true });

  // 3. Bundle từng hàm serverless thành 1 file CommonJS tự chứa.
  for (const { src, route } of routes) {
    const handlerAbs = path.join(root, src);
    if (!existsSync(handlerAbs)) throw new Error(`Không tìm thấy handler nguồn: ${src}`);

    const funcDir = path.join(outDir, "functions", `${route}.func`);
    mkdirSync(funcDir, { recursive: true });

    // Entry nhỏ: lấy default export của handler làm module.exports (để launcher Vercel gọi trực tiếp).
    const entryContents = `const mod = require(${JSON.stringify(handlerAbs)});\nmodule.exports = mod && mod.default ? mod.default : mod;\n`;

    await esbuild({
      stdin: { contents: entryContents, resolveDir: root, loader: "js" },
      outfile: path.join(funcDir, "index.js"),
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node22",
      sourcemap: false,
      logLevel: "warning",
      legalComments: "none",
      // Bẫy 2 trong AGENTS.md, đã làm chết bản deploy ngày 27/07/2026: mã trong `src/services`
      // đọc `import.meta.env`, thứ chỉ Vite mới có. Chỉ cần một hàm serverless lỡ nhập gián
      // tiếp tới `supabaseClient` là cả gói nổ ngay lúc nạp, trả 500, dù build vẫn xanh.
      // Thay bằng object rỗng đúng như `scripts/check.mjs` vẫn làm.
      define: { "import.meta.env": "{}", ...dinhNghiaPhienBan() },
    });

    // Cấu hình runtime cho hàm. shouldAddHelpers=true để có sẵn req.body và res.status().json().
    writeFileSync(
      path.join(funcDir, ".vc-config.json"),
      JSON.stringify(
        { runtime: NODE_RUNTIME, handler: "index.js", launcherType: "Nodejs", shouldAddHelpers: true },
        null,
        2,
      ),
    );
    console.log(`[build-vercel] Đã đóng gói hàm: /${route}`);
  }

  // 4. config.json: phục vụ file tĩnh + hàm; còn lại fallback về index.html (SPA).
  writeFileSync(
    path.join(outDir, "config.json"),
    JSON.stringify(
      {
        version: 3,
        routes: [
          { handle: "filesystem" },
          { src: "/(.*)", dest: "/index.html" },
        ],
      },
      null,
      2,
    ),
  );

  console.log("[build-vercel] Hoàn tất. Kết quả trong .vercel/output");
}

main().catch((e) => {
  console.error("[build-vercel] LỖI:", e);
  process.exit(1);
});
