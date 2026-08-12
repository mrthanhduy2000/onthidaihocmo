/**
 * ĐO CHẤT LƯỢNG NGÂN HÀNG CÂU HỎI: `node scripts/bank-audit.mjs`
 *
 * Công cụ này KHÔNG sửa gì, chỉ in ra một bảng số. Nó là cái thước để so trước và sau mỗi lượt
 * đụng vào dữ liệu câu hỏi.
 *
 * VÌ SAO CẦN MỘT CÔNG CỤ RIÊNG, trong khi đã có 227 phép tự kiểm chứng
 *
 * Bộ kiểm ở `scripts/selftest/harness.ts` canh MÃ NGUỒN: engine tính đúng chưa, màn hình có nói
 * dối không, token màu có định nghĩa chưa. Nó không canh CHẤT LƯỢNG SOẠN ĐỀ, vì chất lượng soạn
 * đề không phải tính chất của mã mà là tính chất của dữ liệu.
 *
 * Ngày 12/08/2026 đo lần đầu và bắt được một lỗi đã sống sót qua toàn bộ 227 phép kiểm:
 *
 *     Đáp án đúng là phương án DÀI NHẤT ở 176 trên 280 câu, tức 62,9%, trong khi ngẫu nhiên là 25%.
 *     Chỉ cần luôn chọn phương án dài nhất mà KHÔNG ĐỌC CÂU HỎI là được 6,3 trên 10 điểm.
 *
 * Đây là lỗi kinh điển của câu trắc nghiệm do mô hình ngôn ngữ sinh: nó viết đáp án đúng thật
 * đầy đủ và chính xác, còn ba phương án nhiễu thì viết ngắn cho nhanh.
 *
 * Điểm hiểm: dự án ĐÃ lo chuyện thiên lệch VỊ TRÍ và xử lý bằng `optionShuffle` trộn tất định
 * theo mã câu. Nhưng trộn vị trí KHÔNG ĐỤNG GÌ TỚI ĐỘ DÀI, nên cái bẫy còn nguyên sau khi trộn.
 * Một biện pháp phòng thủ đã có sẵn khiến người đọc mã tin rằng chuyện thiên lệch đã được lo,
 * trong khi nó chỉ lo đúng một nửa.
 *
 * Hệ quả không dừng ở màn làm bài. Mọi tầng đo lường phía sau (mô hình người học, đường cong
 * quên, độ thạo khái niệm, bộ dự báo điểm) đều ăn chuỗi trả lời này làm đầu vào. Bộ dự báo đã
 * được hiệu chuẩn rất công phu tới độ dốc 1,00 và sai lệch trung bình 0,22, nhưng nó đang hiệu
 * chuẩn trên một tín hiệu bị nhiễm. Máy đo chính xác tuyệt đối vẫn cho kết quả sai nếu vật cần
 * đo bị đặt lệch.
 *
 * CÁCH ĐỌC DỮ LIỆU, và cái bẫy phải tránh
 *
 * Không đọc file dữ liệu bằng biểu thức chính quy, vì `customer_behavior.ts` viết khoá KHÔNG có
 * dấu nháy (đó là TypeScript, không phải JSON) trong khi `customer_behavior_generated.ts` lại
 * viết có dấu nháy. Một bộ tách bằng biểu thức chính quy sẽ đúng với file này và sai âm thầm với
 * file kia.
 *
 * Cũng không nhập thẳng `src/services/db.ts`, vì nó đi qua `import.meta.env` vốn chỉ Vite mới có
 * (Bẫy 2 trong AGENTS.md), và nó còn nạp môn ngay ở mức module.
 *
 * Cách đúng, dùng lại đúng khuôn của `check.mjs`: cho esbuild đóng gói các file dữ liệu rồi nạp
 * gói ấy vào Node. Các file trong `src/data/` chỉ nhập KIỂU từ `../types`, mà kiểu thì bị xoá lúc
 * biên dịch, nên gói ra hoàn toàn sạch và không cần một biến môi trường nào.
 */
import { build as esbuild } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Khai báo các ngân hàng cần đo. Thêm môn mới thì thêm một dòng ở đây, không phải sửa chỗ nào khác.
 *
 * `doThi` là tên biến chứa đồ thị tri thức của môn, dùng để đối chiếu nhãn `knowledgeMapping`.
 * Môn nào chưa có đồ thị thì để trống, phần đối chiếu sẽ tự bỏ qua thay vì báo lỗi.
 */
const NGAN_HANG = [
  {
    ten: "Hành vi khách hàng, phần biên soạn tay",
    file: "src/data/customer_behavior.ts",
    bien: "cbQuestions",
    doThiFile: "src/data/customer_behavior_kb.ts",
    doThiBien: "cbKnowledgeGraph",
  },
  {
    ten: "Hành vi khách hàng, phần AI sinh",
    file: "src/data/customer_behavior_generated.ts",
    bien: "cbGeneratedQuestions",
    doThiFile: "src/data/customer_behavior_kb.ts",
    doThiBien: "cbKnowledgeGraph",
  },
  {
    ten: "Kinh tế chính trị, môn đã đóng",
    file: "src/data/questions.ts",
    bien: "questions",
    doThiFile: "",
    doThiBien: "",
  },
];

const PHUONG_AN = ["a", "b", "c", "d"];

/**
 * Độ lệch độ dài của một câu: đáp án đúng dài hơn phương án dài NHÌ bao nhiêu phần.
 *
 * So với phương án dài nhì chứ không so với trung bình ba phương án còn lại, vì người làm bài
 * chọn bằng cách nhìn phương án nào NỔI HẲN LÊN, tức so với đối thủ gần nhất của nó. Một câu có
 * đáp án đúng 100 ký tự và ba phương án 95, 30, 30 thì trung bình lệch nhiều nhưng mắt không
 * nhặt ra được đáp án, vì đã có một phương án khác dài xấp xỉ.
 *
 * Trả về số dương khi đáp án đúng dài hơn, số âm khi nó ngắn hơn.
 */
export function doLechDoDai(q) {
  const dungLen = String(q.options?.[q.correctAnswer] ?? "").length;
  if (dungLen === 0) return 0;
  const conLai = PHUONG_AN.filter(k => k !== q.correctAnswer).map(k => String(q.options?.[k] ?? "").length);
  const daiNhi = Math.max(...conLai);
  return (dungLen - daiNhi) / dungLen;
}

function trungVi(mang) {
  if (mang.length === 0) return 0;
  const s = [...mang].sort((x, y) => x - y);
  const giua = Math.floor(s.length / 2);
  return s.length % 2 ? s[giua] : (s[giua - 1] + s[giua]) / 2;
}

/** Viết số thập phân theo cách đọc của người Việt, dùng dấu phẩy. */
function so(x, chuSo = 1) {
  return x.toLocaleString("vi-VN", { minimumFractionDigits: chuSo, maximumFractionDigits: chuSo });
}

function chuanHoa(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Tách chuỗi thành tập từ, dùng để so nhãn với tên nút đồ thị. */
function tachTu(s) {
  return new Set(chuanHoa(s).split(/[^a-zà-ỹ0-9]+/i).filter(t => t.length > 1));
}

function doMotNganHang(nhan, cauHoi, doThi) {
  const n = cauHoi.length;
  console.log(`\n${"=".repeat(72)}\n${nhan}\n${"=".repeat(72)}`);
  if (n === 0) {
    console.log("Ngân hàng rỗng, bỏ qua.");
    return null;
  }
  console.log(`Tổng số câu: ${n}`);

  // ------------------------------------------------------- 1. Thiên lệch độ dài
  let daiNhat = 0, nganNhat = 0;
  const lechSoVoiTrungBinh = [];
  const lechSoVoiDaiNhi = [];
  for (const q of cauHoi) {
    const doDai = PHUONG_AN.map(k => [k, String(q.options?.[k] ?? "").length]).sort((a, b) => b[1] - a[1]);
    if (doDai[0][0] === q.correctAnswer) daiNhat++;
    if (doDai[doDai.length - 1][0] === q.correctAnswer) nganNhat++;

    const dungLen = String(q.options?.[q.correctAnswer] ?? "").length;
    const conLai = PHUONG_AN.filter(k => k !== q.correctAnswer).map(k => String(q.options?.[k] ?? "").length);
    lechSoVoiTrungBinh.push(dungLen - conLai.reduce((a, b) => a + b, 0) / conLai.length);
    lechSoVoiDaiNhi.push(dungLen - Math.max(...conLai));
  }
  const tyLeDaiNhat = (daiNhat / n) * 100;

  console.log("\nThiên lệch độ dài phương án");
  console.log(`  Đáp án đúng là phương án DÀI NHẤT : ${daiNhat}/${n} câu, tức ${so(tyLeDaiNhat)}%   (ngẫu nhiên: 25,0%)`);
  console.log(`  Đáp án đúng là phương án NGẮN NHẤT: ${nganNhat}/${n} câu, tức ${so((nganNhat / n) * 100)}%`);
  console.log(`  Dài hơn trung bình ba phương án còn lại: ${so(lechSoVoiTrungBinh.reduce((a, b) => a + b, 0) / n)} ký tự`);
  console.log(`  Trung vị chênh so với phương án dài nhì : ${so(trungVi(lechSoVoiDaiNhi), 0)} ký tự`);
  for (const nguong of [10, 20, 40]) {
    const dem = lechSoVoiDaiNhi.filter(x => x > nguong).length;
    console.log(`  Chênh hơn ${String(nguong).padStart(2)} ký tự so với phương án dài nhì: ${String(dem).padStart(3)} câu, tức ${so((dem / n) * 100)}%`);
  }
  const vuotNguong = cauHoi.filter(q => doLechDoDai(q) > 0.2).length;
  console.log(`  Vượt ngưỡng 20% của phép kiểm AJ1     : ${vuotNguong} câu, tức ${so((vuotNguong / n) * 100)}%`);
  console.log(`\n  ĐIỂM NẾU LUÔN CHỌN PHƯƠNG ÁN DÀI NHẤT MÀ KHÔNG ĐỌC CÂU HỎI: ${so(tyLeDaiNhat / 10)} trên 10`);

  // -------------------------------------------- 2. Vị trí đáp án đúng trong file gốc
  // Đây là số liệu của BẢN GỐC, trước khi `optionShuffle` trộn lúc nạp môn. Nó lệch nặng là bình
  // thường và không gây hại, vì bộ trộn đã xử lý. Ghi lại để người sau khỏi tưởng đây là lỗi mới.
  const viTri = {};
  for (const q of cauHoi) viTri[q.correctAnswer] = (viTri[q.correctAnswer] || 0) + 1;
  console.log("\nVị trí đáp án đúng trong file gốc, trước khi optionShuffle trộn");
  console.log(`  ${PHUONG_AN.map(k => `${k}: ${String(viTri[k] || 0).padStart(3)}`).join("   ")}`);

  // ------------------------------------------------------------- 3. Trường rỗng
  const rong = {};
  for (const q of cauHoi) {
    for (const truong of ["concept", "explanation", "learningObjective", "misconception", "bloomLevel", "knowledgeMapping"]) {
      const v = q[truong];
      const trong = Array.isArray(v) ? v.length === 0 : !String(v || "").trim();
      if (trong) rong[truong] = (rong[truong] || 0) + 1;
    }
  }
  console.log("\nTrường rỗng");
  if (Object.keys(rong).length === 0) {
    console.log("  không trường nào rỗng");
  } else {
    for (const [k, v] of Object.entries(rong)) {
      // `bloomLevel` rỗng trong file dữ liệu KHÔNG phải lỗi: `loadSubject` gọi `suyRaMucBloom`
      // điền lại lúc nạp môn, suy từ `learningObjective` rồi mới lùi về độ khó.
      const ghiChu = k === "bloomLevel" ? "   (được suy ra lúc nạp môn, không phải lỗi)" : "";
      console.log(`  ${k.padEnd(18)}: ${String(v).padStart(3)}/${n}${ghiChu}`);
    }
  }

  // --------------------------------------- 4. Nhãn kiến thức so với đồ thị tri thức
  if (doThi && doThi.length) {
    const nhanSet = new Set();
    for (const q of cauHoi) (q.knowledgeMapping || []).forEach(t => nhanSet.add(t));
    const tenNut = new Set(doThi.map(nut => chuanHoa(nut.concept)));
    let khopDungTen = 0;
    let khopTuKhoa = 0;
    for (const nhan of nhanSet) {
      if (tenNut.has(chuanHoa(nhan))) khopDungTen++;
      const tuNhan = tachTu(nhan);
      const co = doThi.some(nut => {
        const tuNut = tachTu(nut.concept);
        return [...tuNhan].some(t => tuNut.has(t));
      });
      if (co) khopTuKhoa++;
    }
    console.log("\nNhãn knowledgeMapping so với đồ thị tri thức");
    console.log(`  Số nhãn khác nhau            : ${nhanSet.size}`);
    console.log(`  Số nút trong đồ thị tri thức : ${doThi.length}`);
    console.log(`  Nhãn khớp ĐÚNG TÊN một nút   : ${khopDungTen}/${nhanSet.size}`);
    console.log(`  Nhãn có ít nhất một từ chung : ${khopTuKhoa}/${nhanSet.size}`);
    if (khopDungTen === 0) {
      console.log("  Ghi chú: khớp đúng tên bằng 0 KHÔNG phải lỗi. `kbService.resolveConceptsForQuestion`");
      console.log("  ghép câu với nút chủ yếu bằng cấu trúc (trùng chủ đề 0,5 và trùng chương 0,2),");
      console.log("  phần trùng chữ chỉ góp 0,3. Con số này cho biết TRẦN ĐỘ CHÍNH XÁC của việc ghép,");
      console.log("  tức độ thạo đang đo ở mức cụm chủ đề chứ không phải mức từng khái niệm.");
    }
  }

  // ------------------------------------------- 5. Độ khó và thời gian ước lượng
  const theoDoKho = {};
  for (const q of cauHoi) {
    const k = q.difficulty || "không ghi";
    (theoDoKho[k] ||= []).push(Number(q.estimatedTime) || 0);
  }
  console.log("\nĐộ khó và thời gian ước lượng");
  const thoiGianTheoMuc = [];
  for (const [k, v] of Object.entries(theoDoKho)) {
    const tb = v.reduce((a, b) => a + b, 0) / v.length;
    thoiGianTheoMuc.push(tb);
    console.log(`  ${k.padEnd(12)}: ${String(v.length).padStart(3)} câu, estimatedTime trung bình ${so(tb)} giây`);
  }
  const bienThienThoiGian = Math.max(...thoiGianTheoMuc) - Math.min(...thoiGianTheoMuc);
  if (bienThienThoiGian < 1) {
    console.log("  CẢNH BÁO: estimatedTime KHÔNG bám độ khó, chênh lệch giữa các mức dưới 1 giây.");
    console.log("  Trường này là hằng số đội lốt số đo. Đừng dùng nó làm mốc phán đoán mò.");
  }

  // ----------------------------------------------------------- 6. Trùng lặp
  const daGap = new Map();
  let trungVanBan = 0;
  for (const q of cauHoi) {
    const khoa = chuanHoa(q.question);
    if (!khoa) continue;
    if (daGap.has(khoa)) trungVanBan++;
    else daGap.set(khoa, q.id);
  }
  console.log(`\nTrùng lặp\n  Câu trùng văn bản chính xác: ${trungVanBan}`);

  return { n, tyLeDaiNhat, vuotNguong };
}

// ============================================================================ chạy
const tmp = mkdtempSync(path.join(tmpdir(), "bank-audit-"));
try {
  // Một file vào duy nhất nhập lại mọi ngân hàng và mọi đồ thị, để chỉ phải đóng gói một lần.
  const canDoThi = [...new Set(NGAN_HANG.filter(b => b.doThiFile).map(b => `${b.doThiFile}|${b.doThiBien}`))];
  const dongNhap = [
    ...NGAN_HANG.map(b => `export { ${b.bien} } from ${JSON.stringify(path.join(root, b.file))};`),
    ...canDoThi.map(k => {
      const [f, v] = k.split("|");
      return `export { ${v} } from ${JSON.stringify(path.join(root, f))};`;
    }),
  ];
  const entry = path.join(tmp, "entry.ts");
  writeFileSync(entry, dongNhap.join("\n"));

  const out = path.join(tmp, "banks.mjs");
  await esbuild({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    // Cùng lý do với check.mjs: mã nguồn frontend đọc cấu hình qua import.meta.env, chỉ Vite mới
    // có. Ở đây các file dữ liệu không dùng tới, nhưng để nguyên cho an toàn nếu sau này chúng
    // nhập thêm thứ gì khác.
    define: { "import.meta.env": "{}" },
    outfile: out,
    logLevel: "error",
  });
  const mod = await import(pathToFileURL(out).href);

  console.log(`\nĐO NGÂN HÀNG CÂU HỎI`);
  console.log(`Chạy lúc: ${new Date().toLocaleString("vi-VN")}`);

  const tongKet = [];
  for (const b of NGAN_HANG) {
    const cauHoi = mod[b.bien] || [];
    const doThi = b.doThiBien ? mod[b.doThiBien] : null;
    const kq = doMotNganHang(b.ten, cauHoi, doThi);
    if (kq) tongKet.push({ ten: b.ten, ...kq });
  }

  console.log(`\n${"=".repeat(72)}\nTỔNG KẾT\n${"=".repeat(72)}`);
  for (const t of tongKet) {
    const dat = t.tyLeDaiNhat >= 20 && t.tyLeDaiNhat <= 35;
    console.log(`${dat ? "DAT " : "LECH"}  ${t.ten}`);
    console.log(`      ${t.n} câu, đáp án đúng dài nhất ở ${so(t.tyLeDaiNhat)}%, ${t.vuotNguong} câu vượt ngưỡng 20%`);
  }
  console.log("\nVùng đạt của tỷ lệ dài nhất là 20% tới 35%, quanh mức ngẫu nhiên 25%.");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
