/**
 * VIẾT LẠI PHƯƠNG ÁN NHIỄU CHO CÁC CÂU BỊ LỘ ĐÁP ÁN QUA ĐỘ DÀI.
 *
 *     node scripts/rebalance-distractors.mjs --dry-run     xem danh sách, không gọi AI
 *     node scripts/rebalance-distractors.mjs --limit 5     làm thử 5 câu
 *     node scripts/rebalance-distractors.mjs               làm hết
 *
 * VÌ SAO
 *
 * Đo ngày 12/08/2026: đáp án đúng là phương án DÀI NHẤT ở 67,1% số câu của môn đang mở, ngẫu
 * nhiên là 25%. Chọn phương án dài nhất mà không đọc câu hỏi được hơn 6 điểm. Chi tiết trong
 * chú thích `NGUONG_LECH_DO_DAI` ở `src/services/ai.ts` và trong nhóm kiểm AJ.
 *
 * Lượt trước đã chặn NGUỒN (lời nhắc cộng chốt chặn ở cổng nhận). Script này sửa phần đã nằm
 * sẵn trong ngân hàng, thứ mà chặn nguồn không với tới được.
 *
 * BỐN QUYẾT ĐỊNH THIẾT KẾ, đọc trước khi sửa script này
 *
 * 1. **Không rút gọn đáp án đúng, chỉ kéo dài phương án nhiễu.** Cắt đáp án đúng cho ngắn lại thì
 *    hết lệch nhưng câu hỏi mất giá trị học, vì đáp án đúng chính là phần người học cần đọc kỹ
 *    nhất. Đàm đã chọn hướng này.
 *
 * 2. **Thẩm định ngược, và đây là chốt chặn quan trọng nhất.** Rủi ro thật của việc viết lại
 *    không phải sai định dạng mà là **biến một phương án nhiễu thành đúng**. Nên sau khi viết
 *    lại, câu đã sửa được gửi đi ở MỘT LƯỢT GỌI ĐỘC LẬP, không cho biết đáp án, hỏi "phương án
 *    nào đúng". Trả lời khác `correctAnswer` thì **giữ nguyên bản cũ** và ghi vào danh sách cần
 *    người xem. Thà để một câu lệch còn hơn đưa vào ngân hàng một câu có hai đáp án đúng.
 *
 * 3. **Thay chuỗi tại chỗ, không dựng lại file.** Mỗi phương án là một chuỗi dài và duy nhất
 *    trong toàn bộ file, nên thay đúng chuỗi đó là phép sửa nhỏ nhất có thể. Dựng lại cả file từ
 *    đối tượng đã nạp sẽ làm mất chú thích, mất định dạng tay, và với
 *    `src/data/customer_behavior.ts` thì còn xoá luôn ba mảng dữ liệu khác cùng nằm trong file.
 *    Script tự kiểm tính duy nhất trước khi thay; không duy nhất thì bỏ qua và báo.
 *
 * 4. **Viết lại luôn lời giải, và phải nói RÕ ba chữ cái nhiễu là những chữ nào.** Lời giải cũ mô
 *    tả các phương án nhiễu cũ, để nguyên là màn hình tự mâu thuẫn. Nhưng bản đầu của lời nhắc chỉ
 *    viết "giữ đúng lối gọi tên 'phương án b, c, d'" với ý là giữ VĂN PHONG, và mô hình hiểu thành
 *    giữ đúng BA CHỮ CÁI ấy, nên sinh ra lời giải tự gọi chính đáp án đúng là phương án sai. Xem
 *    chú thích `loiGiaiGoiNhamDapAnDung` bên dưới.
 *
 *    CẨN THẬN: `optionShuffle` ĐỌC lời giải để tìm nhãn phương án rồi remap theo thứ tự đã trộn,
 *    và câu nào có chữ cái đơn không phân loại được thì nó GIỮ NGUYÊN không trộn. Nên lời giải gọi
 *    sai tên sẽ được remap y như thật rồi sai tiếp sang cả bản đã trộn.
 */
import { build as esbuild } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const GIOI_HAN = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : Infinity;
})();

/** Phải khớp `NGUONG_LECH_DO_DAI` trong `src/services/ai.ts`. Nhóm kiểm AJ5 canh sự khớp này. */
const NGUONG = 0.10;
/**
 * Số câu chạy song song. Mỗi câu tốn hai lượt gọi Gemini (viết lại, rồi thẩm định ngược), nên
 * 140 câu là 280 lượt. Ở mức 4 song song lượt chạy đầu vượt 10 phút; 6 là mức cân giữa tốc độ và
 * nguy cơ chạm trần số lời gọi mỗi phút.
 */
const SO_LUONG_SONG_SONG = 6;

/** Số lần thử lại khi một lời gọi hỏng, kèm chờ tăng dần. Lỗi mạng lẻ tẻ không nên làm mất câu. */
const SO_LAN_THU_LAI = 2;

async function thuLai(fn, moTa) {
  let loiCuoi;
  for (let lan = 0; lan <= SO_LAN_THU_LAI; lan++) {
    try {
      return await fn();
    } catch (e) {
      loiCuoi = e;
      if (lan < SO_LAN_THU_LAI) {
        await new Promise(r => setTimeout(r, 2000 * (lan + 1)));
      }
    }
  }
  throw new Error(`${moTa} hỏng sau ${SO_LAN_THU_LAI + 1} lần thử: ${loiCuoi?.message || loiCuoi}`);
}

const NGAN_HANG = [
  { file: "src/data/customer_behavior.ts", bien: "cbQuestions" },
  { file: "src/data/customer_behavior_generated.ts", bien: "cbGeneratedQuestions" },
];

const K = ["a", "b", "c", "d"];

function doLechDoDai(q) {
  const dung = String(q?.options?.[q?.correctAnswer] ?? "");
  if (dung.length === 0) return 0;
  const conLai = K.filter(k => k !== q.correctAnswer).map(k => String(q?.options?.[k] ?? "").length);
  return (dung.length - Math.max(...conLai)) / dung.length;
}

// ------------------------------------------------------------------ nạp dữ liệu
const tmp = mkdtempSync(path.join(tmpdir(), "rebalance-"));
const entry = path.join(tmp, "entry.ts");
writeFileSync(entry, NGAN_HANG.map(b =>
  `export { ${b.bien} } from ${JSON.stringify(path.join(root, b.file))};`).join("\n"));
const outBundle = path.join(tmp, "banks.mjs");
await esbuild({
  entryPoints: [entry], bundle: true, platform: "node", format: "esm",
  target: "node22", define: { "import.meta.env": "{}" }, outfile: outBundle, logLevel: "error",
});
const mod = await import(pathToFileURL(outBundle).href);
rmSync(tmp, { recursive: true, force: true });

// --------------------------------------------------------------- lập danh sách
const canSua = [];
for (const b of NGAN_HANG) {
  for (const q of (mod[b.bien] || [])) {
    const lech = doLechDoDai(q);
    if (lech > NGUONG) canSua.push({ q, lech, file: b.file });
  }
}
canSua.sort((a, b) => b.lech - a.lech);
const danhSach = canSua.slice(0, GIOI_HAN);

console.log(`Ngưỡng lệch: ${NGUONG}`);
console.log(`Số câu cần viết lại: ${canSua.length}${danhSach.length < canSua.length ? `, lượt này làm ${danhSach.length}` : ""}`);
for (const b of NGAN_HANG) {
  const n = canSua.filter(c => c.file === b.file).length;
  console.log(`  ${b.file}: ${n} câu`);
}

if (DRY_RUN) {
  console.log("\nChế độ thử, không gọi AI. Mười câu lệch nặng nhất:");
  for (const c of canSua.slice(0, 10)) {
    console.log(`  #${c.q.id}  lệch ${(c.lech * 100).toFixed(0)}%  ${String(c.q.question).slice(0, 70)}...`);
  }
  process.exit(0);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("Thiếu GEMINI_API_KEY. Đặt trong .env rồi chạy lại.");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ------------------------------------------------------------------ gọi Gemini
/**
 * Lời giải viết lại phải gọi ĐÚNG TÊN ba phương án nhiễu, và tuyệt đối không được gọi tên đáp án
 * đúng như một phương án sai.
 *
 * BẮT ĐƯỢC KHI CHẠY THỬ 3 CÂU, ngày 12/08/2026. Lời nhắc bản đầu viết "vẫn gọi tên phương án theo
 * đúng lối 'phương án b, c, d không phản ánh...'" với ý là giữ nguyên VĂN PHONG. Mô hình hiểu
 * thành giữ nguyên ĐÚNG BA CHỮ CÁI ấy, nên:
 *
 *     câu #2004, đáp án đúng là 'b'  ->  lời giải viết "Các phương án b, c, d không phản ánh đúng"
 *     câu #2012, đáp án đúng là 'c'  ->  lời giải viết "Các phương án b, c, d không phản ánh đúng"
 *
 * Tức lời giải tự gọi chính đáp án đúng là phương án sai. Thẩm định ngược KHÔNG bắt được, vì nó
 * chỉ hỏi phương án nào đúng chứ không đọc lời giải.
 *
 * Nặng hơn nữa: `optionShuffle` ĐỌC lời giải để tìm nhãn phương án rồi remap theo thứ tự đã trộn,
 * nên một lời giải gọi sai tên sẽ được remap y như thật và sai đi theo cả bản đã trộn.
 *
 * Hai lớp phòng thủ: nói thẳng ba chữ cái nhiễu trong lời nhắc, và kiểm lại đầu ra bằng hàm này.
 */
function loiGiaiGoiNhamDapAnDung(loiGiai, chuCaiDung) {
  const chuoi = String(loiGiai || "").toLowerCase();
  // Bắt các cụm kiểu "phương án b, c, d", "các phương án a và d", "đáp án b, c".
  const re = /(?:phương án|đáp án|lựa chọn)\s+((?:[a-d]\s*(?:,|và|hoặc|\/|;)?\s*){2,})/gi;
  for (let m = re.exec(chuoi); m; m = re.exec(chuoi)) {
    const chuCai = (m[1].match(/[a-d]/g) || []);
    if (chuCai.includes(chuCaiDung.toLowerCase())) return true;
  }
  return false;
}

async function vietLai(q) {
  const dung = String(q.options[q.correctAnswer]);
  const chuCaiNhieu = K.filter(k => k !== q.correctAnswer);
  const nhieuCu = chuCaiNhieu.map(k => `${k}) ${q.options[k]}`).join("\n");
  const prompt = `Một câu hỏi trắc nghiệm đang bị lỗi: đáp án đúng dài hơn hẳn ba phương án nhiễu, nên người học đoán được đáp án chỉ bằng cách chọn phương án dài nhất mà không cần đọc câu hỏi.

Câu hỏi: ${q.question}

Đáp án ĐÚNG (giữ nguyên, tuyệt đối không sửa, dài ${dung.length} ký tự):
${dung}

Ba phương án nhiễu hiện tại, cần viết lại:
${nhieuCu}

Lời giải hiện tại:
${q.explanation || "(chưa có)"}

Viết lại ĐÚNG BA phương án nhiễu theo các ràng buộc sau:
1. Mỗi phương án nhiễu dài từ ${Math.round(dung.length * 0.85)} tới ${Math.round(dung.length * 1.15)} ký tự. Đây là ràng buộc quan trọng nhất, hãy đếm ký tự trước khi trả về.
2. Cùng cấu trúc ngữ pháp và cùng mức độ chi tiết với đáp án đúng.
3. SAI rõ ràng về mặt học thuật. Mỗi phương án nhắm vào một hiểu sai có thật của sinh viên: nhầm sang khái niệm lân cận, đảo ngược quan hệ nhân quả, hoặc lấy một phần thay cho toàn thể.
4. TUYỆT ĐỐI KHÔNG được là cách diễn đạt khác của đáp án đúng, và không phương án nào được đúng một phần tới mức gây tranh cãi. Một câu hỏi có hai đáp án đúng còn tệ hơn một câu hỏi lộ đáp án.
5. Viết lại phần lời giải cho khớp nội dung mới, gồm hai ý: vì sao đáp án đúng là đúng, và vì sao ba phương án nhiễu là sai.
6. CỰC KỲ QUAN TRỌNG khi gọi tên phương án trong lời giải: đáp án ĐÚNG của câu này là phương án '${q.correctAnswer}'. Ba phương án SAI là '${chuCaiNhieu.join("', '")}'. Khi viết câu kiểu "các phương án ... không phản ánh đúng", chỉ được liệt kê ĐÚNG ba chữ cái ${chuCaiNhieu.join(", ")}. Tuyệt đối KHÔNG được nhắc chữ '${q.correctAnswer}' trong danh sách các phương án sai, vì đó chính là đáp án đúng.
7. Viết bằng tiếng Việt, không pha tiếng Anh.`;

  const res = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          phuongAnNhieu: { type: Type.ARRAY, items: { type: Type.STRING } },
          loiGiai: { type: Type.STRING },
        },
        required: ["phuongAnNhieu", "loiGiai"],
      },
    },
  });
  const parsed = JSON.parse(res.text.trim());
  const moi = Array.isArray(parsed.phuongAnNhieu) ? parsed.phuongAnNhieu.map(s => String(s).trim()) : [];
  if (moi.length !== 3 || moi.some(s => !s)) return null;
  return { phuongAnNhieu: moi, loiGiai: String(parsed.loiGiai || "").trim() };
}

/**
 * Thẩm định ngược: đưa câu ĐÃ SỬA cho một lượt gọi độc lập, KHÔNG nói đáp án, hỏi phương án nào
 * đúng. Đây là cách duy nhất bắt được lỗi "viết lại làm một phương án nhiễu thành đúng".
 */
async function thamDinhNguoc(cauHoi, options) {
  const prompt = `Đây là một câu hỏi trắc nghiệm. Hãy đọc kỹ và cho biết phương án nào ĐÚNG.

Câu hỏi: ${cauHoi}

a) ${options.a}
b) ${options.b}
c) ${options.c}
d) ${options.d}

Trả về JSON gồm: dapAn là một trong 'a','b','c','d'; và soPhuongAnDung là số phương án mà bạn cho là đúng (nếu có nhiều hơn một phương án đúng thì ghi đúng con số đó).`;

  const res = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dapAn: { type: Type.STRING },
          soPhuongAnDung: { type: Type.INTEGER },
        },
        required: ["dapAn", "soPhuongAnDung"],
      },
    },
  });
  const parsed = JSON.parse(res.text.trim());
  return {
    dapAn: String(parsed.dapAn || "").trim().toLowerCase(),
    soPhuongAnDung: Number(parsed.soPhuongAnDung) || 1,
  };
}

// --------------------------------------------------------------------- xử lý
const ketQua = [];
let dem = 0;

async function xuLyMot(muc) {
  const { q, lech, file } = muc;
  const stt = ++dem;
  try {
    const moi = await thuLai(() => vietLai(q), `viết lại #${q.id}`);
    if (!moi) return ketQua.push({ q, file, lech, trangThai: "AI trả về không hợp lệ" });

    const options = { ...q.options };
    K.filter(k => k !== q.correctAnswer).forEach((k, i) => { options[k] = moi.phuongAnNhieu[i]; });

    const lechMoi = doLechDoDai({ options, correctAnswer: q.correctAnswer });
    if (lechMoi > NGUONG) {
      return ketQua.push({ q, file, lech, lechMoi, trangThai: `viết lại vẫn lệch ${(lechMoi * 100).toFixed(0)}%` });
    }
    const trung = new Set(K.map(k => String(options[k]).toLowerCase().trim()));
    if (trung.size < 4) {
      return ketQua.push({ q, file, lech, trangThai: "viết lại tạo ra hai phương án trùng nhau" });
    }

    if (loiGiaiGoiNhamDapAnDung(moi.loiGiai, q.correctAnswer)) {
      return ketQua.push({
        q, file, lech, options, moi,
        trangThai: `lời giải gọi nhầm đáp án đúng '${q.correctAnswer}' là phương án sai`,
      });
    }

    const td = await thuLai(() => thamDinhNguoc(q.question, options), `thẩm định #${q.id}`);
    if (td.dapAn !== q.correctAnswer || td.soPhuongAnDung !== 1) {
      return ketQua.push({
        q, file, lech, options, moi,
        trangThai: `THẨM ĐỊNH NGƯỢC KHÔNG QUA: AI chọn '${td.dapAn}' (đáp án thật '${q.correctAnswer}'), báo ${td.soPhuongAnDung} phương án đúng`,
      });
    }

    ketQua.push({ q, file, lech, lechMoi, options, moi, trangThai: "OK" });
    console.log(`  [${stt}/${danhSach.length}] #${q.id} lệch ${(lech * 100).toFixed(0)}% -> ${(lechMoi * 100).toFixed(0)}%  OK`);
  } catch (e) {
    ketQua.push({ q, file, lech, trangThai: `lỗi gọi AI: ${e?.message || e}` });
    console.log(`  [${stt}/${danhSach.length}] #${q.id} LỖI: ${e?.message || e}`);
  }
}

console.log(`\nBắt đầu, chạy ${SO_LUONG_SONG_SONG} câu song song...\n`);
const hangDoi = [...danhSach];
await Promise.all(Array.from({ length: SO_LUONG_SONG_SONG }, async () => {
  while (hangDoi.length) {
    const muc = hangDoi.shift();
    if (muc) await xuLyMot(muc);
  }
}));

// ---------------------------------------------------- áp vào file, thay chuỗi
const thanhCong = ketQua.filter(r => r.trangThai === "OK");
const thatBai = ketQua.filter(r => r.trangThai !== "OK");

// Sao lưu trước khi ghi đè, để ngoài repo cho khỏi lọt vào commit.
const thuMucLuu = path.join(homedir(), ".claude", "backups", "onthidaihocmo");
mkdirSync(thuMucLuu, { recursive: true });

let daThay = 0;
const khongThayDuoc = [];
for (const b of NGAN_HANG) {
  const duongDan = path.join(root, b.file);
  copyFileSync(duongDan, path.join(thuMucLuu, `${path.basename(b.file)}.bak`));
  let nguon = readFileSync(duongDan, "utf8");

  for (const r of thanhCong.filter(x => x.file === b.file)) {
    const capThay = [];
    for (const k of K.filter(k => k !== r.q.correctAnswer)) {
      capThay.push([String(r.q.options[k]), String(r.options[k])]);
    }
    if (r.moi.loiGiai && r.q.explanation) capThay.push([String(r.q.explanation), r.moi.loiGiai]);

    // Chỉ thay khi chuỗi cũ xuất hiện ĐÚNG MỘT LẦN trong file. Không duy nhất thì bỏ cả câu, vì
    // thay nhầm sang câu khác nguy hiểm hơn hẳn việc bỏ sót một câu.
    const demXuatHien = capThay.map(([cu]) => nguon.split(JSON.stringify(cu).slice(1, -1)).length - 1);
    const duyNhat = capThay.every(([cu], i) => {
      const escaped = JSON.stringify(cu).slice(1, -1);
      return nguon.split(escaped).length - 1 === 1 || demXuatHien[i] === 1;
    });
    if (!duyNhat) { khongThayDuoc.push(r.q.id); continue; }

    for (const [cu, moiChuoi] of capThay) {
      const escapedCu = JSON.stringify(cu).slice(1, -1);
      const escapedMoi = JSON.stringify(moiChuoi).slice(1, -1);
      nguon = nguon.replace(escapedCu, escapedMoi);
    }
    daThay++;
  }
  writeFileSync(duongDan, nguon);
}

// ------------------------------------------------------------------- báo cáo
const dong = [];
dong.push("# Báo cáo viết lại phương án nhiễu\n");
dong.push(`Chạy lúc: ${new Date().toLocaleString("vi-VN")}\n`);
dong.push(`Ngưỡng lệch: ${NGUONG}. Tổng câu xét: ${danhSach.length}.\n`);
dong.push(`- Viết lại thành công và đã áp vào file: **${daThay}**`);
dong.push(`- Qua được viết lại nhưng không thay được vào file (chuỗi cũ không duy nhất): **${khongThayDuoc.length}**`);
dong.push(`- Không sửa được, giữ nguyên bản cũ: **${thatBai.length}**\n`);

if (thatBai.length) {
  dong.push("## Các câu KHÔNG sửa được, giữ nguyên bản cũ\n");
  dong.push("Đọc kỹ phần thẩm định ngược: đó là những câu mà bản viết lại có thể có hai đáp án đúng.\n");
  for (const r of thatBai) {
    dong.push(`### Câu #${r.q.id} (${r.file})`);
    dong.push(`- Lệch: ${(r.lech * 100).toFixed(0)}%`);
    dong.push(`- Lý do: ${r.trangThai}`);
    dong.push(`- Câu hỏi: ${r.q.question}`);
    dong.push("");
  }
}

dong.push("## Các câu đã sửa, cần Đàm soát tay ít nhất 20 câu ngẫu nhiên\n");
for (const r of thanhCong) {
  dong.push(`### Câu #${r.q.id} (${r.file})`);
  dong.push(`Lệch ${(r.lech * 100).toFixed(0)}% xuống ${(r.lechMoi * 100).toFixed(0)}%\n`);
  dong.push(`**Câu hỏi**: ${r.q.question}\n`);
  dong.push(`**Đáp án đúng (giữ nguyên, ${r.q.correctAnswer})**: ${r.q.options[r.q.correctAnswer]}\n`);
  dong.push("| Phương án | Trước | Sau |");
  dong.push("|---|---|---|");
  for (const k of K.filter(k => k !== r.q.correctAnswer)) {
    dong.push(`| ${k} | ${String(r.q.options[k]).replace(/\|/g, "\\|")} | ${String(r.options[k]).replace(/\|/g, "\\|")} |`);
  }
  dong.push("");
}

const duongDanBaoCao = path.join(root, "rebalance-report.md");
writeFileSync(duongDanBaoCao, dong.join("\n"));

console.log(`\n${"=".repeat(64)}`);
console.log(`Đã áp vào file : ${daThay} câu`);
console.log(`Không thay được: ${khongThayDuoc.length} câu${khongThayDuoc.length ? ` (${khongThayDuoc.join(", ")})` : ""}`);
console.log(`Giữ nguyên     : ${thatBai.length} câu`);
const truot = thatBai.filter(r => String(r.trangThai).includes("THẨM ĐỊNH NGƯỢC"));
if (truot.length) {
  console.log(`  trong đó ${truot.length} câu TRƯỢT THẨM ĐỊNH NGƯỢC, tức bản viết lại có thể có hai đáp án đúng.`);
}
console.log(`Bản sao lưu    : ${thuMucLuu}`);
console.log(`Báo cáo        : ${duongDanBaoCao}`);
console.log(`\nBước tiếp theo: đọc báo cáo, soát tay ít nhất 20 câu, rồi chạy 'node scripts/bank-audit.mjs'.`);
