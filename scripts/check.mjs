/**
 * MỘT LỆNH DUY NHẤT để tự kiểm chứng toàn bộ dự án: `npm run check`.
 *
 * Dành cho bất kỳ ai (người hoặc AI) vừa sửa mã nguồn và cần biết mình có làm hỏng gì không,
 * mà KHÔNG cần mở trình duyệt, KHÔNG cần đăng nhập, KHÔNG cần khóa API.
 *
 * Các chặng chạy theo thứ tự từ rẻ đến đắt, hỏng chặng nào dừng chặng đó:
 *   1. Rào bảo mật   quét khóa bí mật bị lộ vào file bị commit
 *   2. Kiểu dữ liệu  tsc --noEmit
 *   3. Tự kiểm chứng scripts/selftest/harness.ts chạy trên engine thật trong Node
 *   4. Build web     vite build
 *   5. Build Vercel  scripts/build-vercel.mjs
 *
 * Tham số:
 *   --fast    bỏ qua chặng 4 và 5 (vòng lặp sửa mã cho nhanh)
 *   --prod    kiểm tra thêm bản đã deploy (cần mạng), xem scripts/prodcheck.mjs
 */
import { build as esbuild } from "esbuild";
import { execFileSync, execSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const FAST = args.includes("--fast");
const PROD = args.includes("--prod");

const stages = [];
let failed = false;

function banner(title) {
  console.log(`\n${"=".repeat(64)}\n${title}\n${"=".repeat(64)}`);
}

function record(name, ok, detail = "") {
  stages.push({ name, ok, detail });
  if (!ok) failed = true;
}

function run(cmd, cmdArgs) {
  execFileSync(cmd, cmdArgs, { cwd: root, stdio: "inherit" });
}

// ---------------------------------------------------------------- 1. Bảo mật
banner("1/5  Rào bảo mật");
try {
  const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);

  const envTracked = tracked.filter(f => f === ".env" || f.startsWith(".env.") && f !== ".env.example");
  if (envTracked.length) throw new Error(`File môi trường bị commit lên git: ${envTracked.join(", ")}`);

  // Dạng khóa thật hay gặp: khóa Google AI (AIza...), JWT của Supabase (eyJ...), khóa OpenAI (sk-...).
  const secretPatterns = [
    { re: /AIza[0-9A-Za-z_\-]{30,}/, name: "khóa Google AI" },
    { re: /eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\./, name: "JWT Supabase" },
    { re: /sk-[A-Za-z0-9]{32,}/, name: "khóa OpenAI" },
  ];
  const scan = tracked.filter(f => /\.(ts|tsx|mjs|js|json|md|example|yml|yaml)$/.test(f) && existsSync(path.join(root, f)) && f !== "package-lock.json");
  const leaks = [];
  for (const f of scan) {
    const text = readFileSync(path.join(root, f), "utf8");
    for (const p of secretPatterns) if (p.re.test(text)) leaks.push(`${f} (${p.name})`);
  }
  if (leaks.length) throw new Error(`Nghi ngờ lộ khóa trong file đã commit: ${leaks.join(", ")}`);

  const gitignore = existsSync(path.join(root, ".gitignore")) ? readFileSync(path.join(root, ".gitignore"), "utf8") : "";
  if (!/^\.env\*?$/m.test(gitignore.trim()) && !gitignore.includes(".env")) throw new Error(".gitignore chưa loại trừ file .env");

  console.log(`Đã quét ${scan.length} file đã commit, không thấy khóa bí mật.`);
  record("Rào bảo mật", true, `${scan.length} file sạch`);
} catch (e) {
  console.error(`HỎNG: ${e.message}`);
  record("Rào bảo mật", false, e.message);
}

// ------------------------------------------------------------ 2. Kiểu dữ liệu
if (!failed) {
  banner("2/5  Kiểm tra kiểu dữ liệu (tsc)");
  try {
    run("npx", ["tsc", "--noEmit"]);
    console.log("Không có lỗi kiểu dữ liệu.");
    record("Kiểu dữ liệu", true);
  } catch {
    record("Kiểu dữ liệu", false, "tsc báo lỗi, xem log phía trên");
  }
}

// --------------------------------------------------------- 3. Tự kiểm chứng
if (!failed) {
  banner("3/5  Tự kiểm chứng trên engine thật");
  const tmp = mkdtempSync(path.join(tmpdir(), "onthi-selftest-"));
  const out = path.join(tmp, "harness.cjs");
  try {
    await esbuild({
      entryPoints: [path.join(root, "scripts/selftest/harness.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node22",
      // Mã nguồn frontend đọc cấu hình qua import.meta.env (chỉ Vite mới có). Thay bằng object
      // rỗng để supabaseClient trả về null và toàn bộ engine chạy được offline trong Node.
      define: { "import.meta.env": "{}" },
      outfile: out,
      logLevel: "error",
    });
    // TimeService cố đồng bộ giờ qua mạng; chặn lại để bộ kiểm chứng chạy ổn định khi offline.
    const guard = path.join(tmp, "run.cjs");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(guard, [
      "globalThis.fetch = () => Promise.reject(new Error('selftest chay offline'));",
      "const warn = console.warn, err = console.error;",
      "const mute = (fn) => (...a) => { if (String(a[0]).includes('[TimeService]')) return; fn(...a); };",
      "console.warn = mute(warn); console.error = mute(err);",
      `require(${JSON.stringify(out)});`,
    ].join("\n"));
    run("node", [guard]);
    record("Tự kiểm chứng", true);
  } catch {
    record("Tự kiểm chứng", false, "có phép kiểm không đạt, xem danh sách phía trên");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ 4/5 Build
if (!failed && !FAST) {
  banner("4/5  Build giao diện (vite)");
  try {
    run("npx", ["vite", "build"]);
    record("Build giao diện", true);
  } catch {
    record("Build giao diện", false, "vite build lỗi");
  }

  if (!failed) {
    banner("5/5  Build gói triển khai Vercel");
    try {
      run("node", ["scripts/build-vercel.mjs"]);
      record("Build Vercel", true);
    } catch {
      record("Build Vercel", false, "build-vercel lỗi");
    }
  }

  // ---------------------------------------------------- 6/6 Nạp thử từng gói hàm
  //
  // Vì sao có chặng này: ngày 27/07/2026 bản deploy chết 500 ở ba cổng AI trong khi cả 5 chặng
  // trên đều xanh. Nguyên nhân là gói hàm nổ NGAY LÚC NẠP (`import.meta.env` không tồn tại
  // ngoài Vite), thứ mà "đóng gói thành công" không hề nói lên. Chặng này nạp thật từng gói
  // trong Node, đúng cách Vercel làm, nên bắt được loại lỗi đó trước khi push.
  if (!failed) {
    banner("6/6  Nạp thử từng gói hàm serverless");
    const funcRoot = path.join(root, ".vercel/output/functions");
    const loi = [];
    let daKiem = 0;
    try {
      const { readdirSync } = await import("node:fs");
      const goi = readdirSync(funcRoot, { recursive: true, encoding: "utf8" })
        .filter(f => f.endsWith("index.js"));
      for (const g of goi) {
        const duongDan = path.join(funcRoot, g);
        try {
          const mod = await import(`file://${duongDan}`);
          const handler = mod.default?.default ?? mod.default;
          if (typeof handler !== "function") throw new Error("không xuất ra hàm xử lý");
          daKiem++;
          console.log(`  DAT   ${g.replace("/index.js", "")}`);
        } catch (e) {
          loi.push(`${g.replace("/index.js", "")}: ${e.message.split("\n")[0]}`);
          console.log(`  HONG  ${g.replace("/index.js", "")}: ${e.message.split("\n")[0]}`);
        }
      }
      if (loi.length) throw new Error(loi.join(" | "));
      record("Nạp gói hàm", true, `${daKiem} hàm nạp được`);
    } catch (e) {
      record("Nạp gói hàm", false, loi.length ? `${loi.length} hàm nổ lúc nạp` : e.message);
    }
  }
} else if (!failed) {
  console.log("\n(Bỏ qua chặng build vì có --fast)");
}

// ------------------------------------------------------------------ Bản deploy
if (PROD) {
  banner("Bổ sung  Kiểm tra bản đã deploy");
  try {
    run("node", ["scripts/prodcheck.mjs"]);
    record("Bản deploy", true);
  } catch {
    record("Bản deploy", false, "xem báo cáo phía trên");
  }
}

// ---------------------------------------------------------------- Tổng kết
banner("TỔNG KẾT");
for (const s of stages) {
  console.log(`${s.ok ? "DAT " : "HONG"}  ${s.name}${s.detail ? `  (${s.detail})` : ""}`);
}
if (failed) {
  console.log("\nCó chặng không đạt. Sửa xong chạy lại `npm run check`.");
  process.exit(1);
}
console.log("\nToàn bộ đều đạt.");
