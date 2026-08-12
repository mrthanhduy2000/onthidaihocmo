/**
 * VIẾT LẠI PHƯƠNG ÁN NHIỄU CHO CÁC CÂU BỊ LỘ ĐÁP ÁN QUA ĐỘ DÀI.
 *
 *     node scripts/rebalance-distractors.mjs --dry-run     xem danh sách, không gọi AI
 *     node scripts/rebalance-distractors.mjs --limit 8     làm thử 8 câu
 *     node scripts/rebalance-distractors.mjs               làm hết
 *     node scripts/rebalance-distractors.mjs --ap-dung     chỉ áp bộ nhớ đệm vào file, không gọi AI
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
 * NĂM QUYẾT ĐỊNH THIẾT KẾ, đọc trước khi sửa script này
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
 *
 * 5. **TIẾT KIỆM LỜI GỌI GEMINI**, thêm ngày 12/08/2026 theo yêu cầu của Đàm, và cũng vì lượt
 *    chạy đầu đã đâm vào trần chi tiêu tháng.
 *
 *    | | Bản đầu | Bản này |
 *    |---|---|---|
 *    | Viết lại | 1 lời gọi mỗi câu, 140 lượt | gộp lô 4 câu, **35 lượt** |
 *    | Thẩm định ngược | 1 lời gọi mỗi câu, 140 lượt | gộp lô 8 câu, **18 lượt** |
 *    | Thử lại khi hỏng | 2 lần | 1 lần |
 *    | Chạy lại sau khi đứt | làm lại từ đầu | **bỏ qua phần đã xong** |
 *    | **Tổng** | **280 lượt** | **khoảng 53 lượt** |
 *
 *    Bộ nhớ đệm nằm NGOÀI repo (`~/.claude/backups/onthidaihocmo/`) nên không lọt vào commit và
 *    không bị `git checkout` xoá mất. Đây là phần đáng giá nhất: lượt chạy đầu đã đốt 31 lượt gọi
 *    rồi mất trắng vì chưa có bộ nhớ đệm.
 *
 *    Đánh đổi phải biết: gộp lô làm mô hình chia sự chú ý cho nhiều câu cùng lúc, nên chất lượng
 *    từng câu có thể tụt. Lô 4 là mức đã cân; đừng nâng lên 10 để tiết kiệm thêm.
 */
import { build as esbuild } from "esbuild";
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, copyFileSync, mkdirSync, existsSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const CHI_AP_DUNG = args.includes("--ap-dung");
const GIOI_HAN = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : Infinity;
})();

/** Phải khớp `NGUONG_LECH_DO_DAI` trong `src/services/ai.ts`. Nhóm kiểm AJ5 canh sự khớp này. */
const NGUONG = 0.10;

const KICH_THUOC_LO_VIET_LAI = 4;
const KICH_THUOC_LO_THAM_DINH = 8;
const SO_LO_SONG_SONG = 3;
const SO_LAN_THU_LAI = 1;

const THU_MUC_NGOAI = path.join(homedir(), ".claude", "backups", "onthidaihocmo");
const FILE_DEM = path.join(THU_MUC_NGOAI, "rebalance-cache.json");

const NGAN_HANG = [
  { file: "src/data/customer_behavior.ts", bien: "cbQuestions" },
  { file: "src/data/customer_behavior_generated.ts", bien: "cbGeneratedQuestions" },
];

const K = ["a", "b", "c", "d"];

/**
 * ĐÁP ÁN ĐÚNG CÓ ĐƯỢC PHÉP LÀ PHƯƠNG ÁN DÀI NHẤT KHÔNG, quyết theo mã câu nên tất định.
 *
 * ĐO NGÀY 12/08/2026 TRÊN MẺ THỬ 8 CÂU, đây là chỗ bản kế hoạch tính sai. Lời nhắc bản đầu chỉ
 * nói "mỗi phương án nhiễu dài 85 tới 115% đáp án đúng" và ngầm tin rằng mô hình rải đều trong
 * khoảng đó, nên đáp án đúng sẽ là dài nhất với xác suất về mức ngẫu nhiên 25%. Mẻ thử cho kết
 * quả thật: **4 trên 6 câu, tức 67%, đáp án đúng VẪN là dài nhất**, vì mô hình bám mép dưới của
 * khoảng cho an toàn. Độ lệch tụt từ 0,47 xuống 0,05 nhưng dấu vẫn dương.
 *
 * Chạy cả 140 câu theo lời nhắc ấy sẽ cho tỷ lệ cuối khoảng 40 tới 48%, trượt vùng đạt 20 tới 35%
 * mà chính phép kiểm AJ2 đòi hỏi. Tức lại đúng cái lỗi tự mâu thuẫn đã mắc một lần khi chọn
 * ngưỡng 0,20.
 *
 * Nên không giao việc rải phân phối cho mô hình nữa mà quyết ngay tại đây: một phần tư số câu
 * (mã chia hết cho 4) giữ đáp án đúng làm phương án dài nhất, ba phần tư còn lại bắt buộc có ít
 * nhất một phương án nhiễu dài hơn. Cộng với 45 câu vốn đã lệch dưới ngưỡng nên không đụng tới,
 * dự phóng ra 27,4%, nằm giữa vùng đạt.
 *
 * Vì sao KHÔNG cho hết về 0% cho chắc: "đáp án đúng không bao giờ là phương án dài nhất" cũng là
 * một mẹo làm bài, chỉ là mẹo ngược. Mục tiêu là xoá tín hiệu, không phải đảo chiều nó.
 */
function nhomLai(id) {
  return Number(id) % 4 === 0;
}

function doLechDoDai(q) {
  const dung = String(q?.options?.[q?.correctAnswer] ?? "");
  if (dung.length === 0) return 0;
  const conLai = K.filter(k => k !== q.correctAnswer).map(k => String(q?.options?.[k] ?? "").length);
  return (dung.length - Math.max(...conLai)) / dung.length;
}

async function thuLai(fn, moTa) {
  let loiCuoi;
  for (let lan = 0; lan <= SO_LAN_THU_LAI; lan++) {
    try {
      return await fn();
    } catch (e) {
      loiCuoi = e;
      const thongBao = String(e?.message || e);
      // Chạm trần chi tiêu hoặc hết hạn mức thì thử lại cũng vô ích, và còn đốt thêm lượt gọi.
      if (thongBao.includes("RESOURCE_EXHAUSTED") || thongBao.includes("spending cap")) throw e;
      if (lan < SO_LAN_THU_LAI) await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error(`${moTa} hỏng sau ${SO_LAN_THU_LAI + 1} lần thử: ${loiCuoi?.message || loiCuoi}`);
}

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
 * chỉ hỏi phương án nào đúng chứ không đọc lời giải. Một chốt chặn đúng đắn vẫn có vùng mù đúng
 * bằng phạm vi câu hỏi nó đặt ra.
 */
/** Chép nguyên văn từ `src/services/ai.ts`; phép kiểm AJ5 canh hai bản khớp nhau. */
const NHAN_PHUONG_AN_TRONG_LOI_GIAI =
  /(?:phương án|đáp án|lựa chọn)\s+((?:[a-d](?![\p{L}\p{M}])\s*(?:,|và|hoặc|\/|;)?\s*){2,})/giu;

function loiGiaiGoiNhamDapAnDung(loiGiai, chuCaiDung) {
  const chuoi = String(loiGiai || "").toLowerCase();
  const re = new RegExp(NHAN_PHUONG_AN_TRONG_LOI_GIAI.source, "giu");
  for (let m = re.exec(chuoi); m; m = re.exec(chuoi)) {
    if ((m[1].match(/[a-d]/g) || []).includes(chuCaiDung.toLowerCase())) return true;
  }
  return false;
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

const bangCau = new Map();
for (const b of NGAN_HANG) {
  for (const q of (mod[b.bien] || [])) bangCau.set(q.id, { q, file: b.file });
}

// --------------------------------------------------------------- bộ nhớ đệm
mkdirSync(THU_MUC_NGOAI, { recursive: true });
/** { [id]: { trangThai, phuongAnNhieu?, loiGiai? } } */
let dem = {};
if (existsSync(FILE_DEM)) {
  try { dem = JSON.parse(readFileSync(FILE_DEM, "utf8")); } catch { dem = {}; }
}
function luuDem() {
  writeFileSync(FILE_DEM, JSON.stringify(dem, null, 2));
}

// --------------------------------------------------------------- lập danh sách
const canSua = [];
for (const [id, { q, file }] of bangCau) {
  const lech = doLechDoDai(q);
  if (lech > NGUONG) canSua.push({ q, lech, file, id });
}
canSua.sort((a, b) => b.lech - a.lech);

const chuaLam = canSua.filter(c => !dem[c.id]);
const danhSach = chuaLam.slice(0, GIOI_HAN);

console.log(`Ngưỡng lệch: ${NGUONG}`);
console.log(`Số câu còn lệch trong ngân hàng: ${canSua.length}`);
console.log(`Đã có trong bộ nhớ đệm: ${canSua.length - chuaLam.length}`);
console.log(`Cần gọi AI lượt này: ${danhSach.length}`);
if (danhSach.length) {
  const loViet = Math.ceil(danhSach.length / KICH_THUOC_LO_VIET_LAI);
  const loTham = Math.ceil(danhSach.length / KICH_THUOC_LO_THAM_DINH);
  console.log(`Ước lượng số lời gọi Gemini: ${loViet} + ${loTham} = ${loViet + loTham}`);
}

if (DRY_RUN) {
  console.log("\nChế độ thử, không gọi AI. Mười câu lệch nặng nhất:");
  for (const c of canSua.slice(0, 10)) {
    console.log(`  #${c.id}  lệch ${(c.lech * 100).toFixed(0)}%  ${String(c.q.question).slice(0, 70)}...`);
  }
  process.exit(0);
}

const ai = CHI_AP_DUNG ? null : (() => {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Thiếu GEMINI_API_KEY. Đặt trong .env rồi chạy lại.");
    process.exit(1);
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
})();

// ------------------------------------------------------------ gọi Gemini, gộp lô
async function vietLaiLo(lo) {
  const moTaCau = lo.map(({ q }, i) => {
    const dung = String(q.options[q.correctAnswer]);
    const chuCaiNhieu = K.filter(k => k !== q.correctAnswer);
    const yeuCauDoDai = nhomLai(q.id)
      ? `Cả ba phương án nhiễu phải NGẮN HƠN đáp án đúng một chút, mỗi phương án dài từ ${Math.round(dung.length * 0.92)} tới ${Math.round(dung.length * 0.99)} ký tự.`
      : `ÍT NHẤT MỘT trong ba phương án nhiễu phải DÀI HƠN đáp án đúng, cụ thể từ ${Math.round(dung.length * 1.04)} tới ${Math.round(dung.length * 1.12)} ký tự. Hai phương án còn lại dài từ ${Math.round(dung.length * 0.9)} tới ${Math.round(dung.length * 1.05)} ký tự.`;
    return `--- CÂU ${i + 1}, mã ${q.id} ---
Câu hỏi: ${q.question}
Đáp án ĐÚNG là phương án '${q.correctAnswer}' (giữ nguyên, tuyệt đối không sửa, dài ${dung.length} ký tự):
${dung}
Ba phương án SAI cần viết lại, theo đúng thứ tự '${chuCaiNhieu.join("', '")}':
${chuCaiNhieu.map(k => `${k}) ${q.options[k]}`).join("\n")}
Lời giải hiện tại: ${q.explanation || "(chưa có)"}
Ràng buộc độ dài của riêng câu này: ${yeuCauDoDai}
Trong lời giải, ba chữ cái được phép gọi là phương án sai chỉ gồm: ${chuCaiNhieu.join(", ")}. Tuyệt đối không nhắc chữ '${q.correctAnswer}' trong danh sách phương án sai.`;
  }).join("\n\n");

  const prompt = `${lo.length} câu hỏi trắc nghiệm dưới đây đang bị cùng một lỗi: đáp án đúng dài hơn hẳn ba phương án nhiễu, nên người học đoán được đáp án chỉ bằng cách chọn phương án dài nhất mà không cần đọc câu hỏi.

${moTaCau}

Với TỪNG câu, hãy viết lại ĐÚNG BA phương án nhiễu theo các ràng buộc sau:
1. Mỗi phương án nhiễu dài đúng trong khoảng ký tự đã ghi ở câu đó. Đây là ràng buộc quan trọng nhất, hãy đếm ký tự trước khi trả về.
2. Cùng cấu trúc ngữ pháp và cùng mức độ chi tiết với đáp án đúng của chính câu đó.
3. SAI rõ ràng về mặt học thuật. Mỗi phương án nhắm vào một hiểu sai có thật của sinh viên: nhầm sang khái niệm lân cận, đảo ngược quan hệ nhân quả, hoặc lấy một phần thay cho toàn thể.
4. TUYỆT ĐỐI KHÔNG được là cách diễn đạt khác của đáp án đúng, và không phương án nào được đúng một phần tới mức gây tranh cãi. Một câu hỏi có hai đáp án đúng còn tệ hơn một câu hỏi lộ đáp án.
5. Viết lại phần lời giải cho khớp nội dung mới, gồm hai ý: vì sao đáp án đúng là đúng, và vì sao ba phương án nhiễu là sai. Chỉ gọi tên đúng ba chữ cái đã liệt kê ở từng câu.
6. Viết bằng tiếng Việt, không pha tiếng Anh.

Trả về mảng JSON, mỗi phần tử gồm: id là mã câu, phuongAnNhieu là mảng đúng 3 chuỗi theo đúng thứ tự chữ cái đã nêu, loiGiai là lời giải mới.`;

  const res = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            phuongAnNhieu: { type: Type.ARRAY, items: { type: Type.STRING } },
            loiGiai: { type: Type.STRING },
          },
          required: ["id", "phuongAnNhieu", "loiGiai"],
        },
      },
    },
  });
  return JSON.parse(res.text.trim());
}

/**
 * Thẩm định ngược gộp lô: đưa các câu ĐÃ SỬA cho một lượt gọi độc lập, KHÔNG nói đáp án, hỏi
 * phương án nào đúng. Đây là cách duy nhất bắt được lỗi "viết lại làm một phương án nhiễu thành
 * đúng". Nhiệt độ 0 để trả lời ổn định.
 */
async function thamDinhNguocLo(lo) {
  const moTa = lo.map(({ q, options }, i) => `--- CÂU ${i + 1}, mã ${q.id} ---
${q.question}
a) ${options.a}
b) ${options.b}
c) ${options.c}
d) ${options.d}`).join("\n\n");

  const prompt = `Dưới đây là ${lo.length} câu hỏi trắc nghiệm. Với TỪNG câu, hãy đọc kỹ và cho biết phương án nào ĐÚNG.

${moTa}

Trả về mảng JSON, mỗi phần tử gồm: id là mã câu, dapAn là một trong 'a','b','c','d', và soPhuongAnDung là số phương án mà bạn cho là đúng trong câu đó (nếu có nhiều hơn một phương án đúng thì ghi đúng con số đó).`;

  const res = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            dapAn: { type: Type.STRING },
            soPhuongAnDung: { type: Type.INTEGER },
          },
          required: ["id", "dapAn", "soPhuongAnDung"],
        },
      },
    },
  });
  return JSON.parse(res.text.trim());
}

function chiaLo(mang, kichThuoc) {
  const lo = [];
  for (let i = 0; i < mang.length; i += kichThuoc) lo.push(mang.slice(i, i + kichThuoc));
  return lo;
}

async function chayHangDoi(cacLo, xuLy) {
  const hangDoi = [...cacLo];
  await Promise.all(Array.from({ length: SO_LO_SONG_SONG }, async () => {
    while (hangDoi.length) {
      const lo = hangDoi.shift();
      if (lo) await xuLy(lo);
    }
  }));
}

// --------------------------------------------------------------------- chạy
if (!CHI_AP_DUNG && danhSach.length) {
  console.log(`\nBước 1: viết lại, ${Math.ceil(danhSach.length / KICH_THUOC_LO_VIET_LAI)} lô, ${SO_LO_SONG_SONG} lô song song...\n`);

  /** Các câu đã qua bước viết lại và qua mọi phép kiểm cục bộ, chờ thẩm định ngược. */
  const choThamDinh = [];

  await chayHangDoi(chiaLo(danhSach, KICH_THUOC_LO_VIET_LAI), async (lo) => {
    let traVe;
    try {
      traVe = await thuLai(() => vietLaiLo(lo), `viết lại lô ${lo.map(c => c.id).join(",")}`);
    } catch (e) {
      const thongBao = String(e?.message || e);
      for (const c of lo) dem[c.id] = { trangThai: `lỗi gọi AI: ${thongBao.slice(0, 160)}` };
      luuDem();
      console.log(`  lô ${lo.map(c => c.id).join(",")} LỖI: ${thongBao.slice(0, 120)}`);
      return;
    }

    const theoId = new Map((Array.isArray(traVe) ? traVe : []).map(r => [Number(r.id), r]));
    for (const c of lo) {
      const r = theoId.get(c.id);
      const moi = Array.isArray(r?.phuongAnNhieu) ? r.phuongAnNhieu.map(s => String(s).trim()) : [];
      if (moi.length !== 3 || moi.some(s => !s)) {
        dem[c.id] = { trangThai: "AI trả về không hợp lệ" };
        continue;
      }
      const options = { ...c.q.options };
      K.filter(k => k !== c.q.correctAnswer).forEach((k, i) => { options[k] = moi[i]; });

      const lechMoi = doLechDoDai({ options, correctAnswer: c.q.correctAnswer });

      // Nhận khi đã qua ngưỡng, HOẶC khi chưa qua ngưỡng nhưng đã bớt được ít nhất một nửa độ
      // lệch. Mẻ thử cho hai câu về 0,10 và 0,12 rồi bị loại, tức trả chúng về đúng bản 0,57 và
      // 0,56 cũ. Vứt bản tốt hơn để giữ bản tệ hơn chỉ vì trượt một ngưỡng là quy tắc sai, và còn
      // phí đúng lượt gọi Gemini vừa tiêu.
      const daBotMotNua = lechMoi <= c.lech * 0.5;
      if (lechMoi > NGUONG && !daBotMotNua) {
        dem[c.id] = { trangThai: `viết lại vẫn lệch ${(lechMoi * 100).toFixed(0)}%` };
        continue;
      }
      // Chặn phía ngược: một phương án nhiễu dài gấp rưỡi ba phương án kia thì lại thành mẹo làm
      // bài chiều ngược, "phương án dài nhất là phương án sai".
      const doDai = K.map(k => String(options[k]).length);
      const doTraiRong = (Math.max(...doDai) - Math.min(...doDai)) / Math.max(...doDai);
      if (doTraiRong > 0.35) {
        dem[c.id] = { trangThai: `bốn phương án trải quá rộng, ${(doTraiRong * 100).toFixed(0)}%` };
        continue;
      }
      if (new Set(K.map(k => String(options[k]).toLowerCase().trim())).size < 4) {
        dem[c.id] = { trangThai: "viết lại tạo ra hai phương án trùng nhau" };
        continue;
      }
      const loiGiai = String(r.loiGiai || "").trim();
      if (loiGiaiGoiNhamDapAnDung(loiGiai, c.q.correctAnswer)) {
        dem[c.id] = { trangThai: `lời giải gọi nhầm đáp án đúng '${c.q.correctAnswer}' là phương án sai` };
        continue;
      }
      choThamDinh.push({ ...c, options, phuongAnNhieu: moi, loiGiai, lechMoi });
    }
    luuDem();
    console.log(`  lô ${lo.map(c => c.id).join(",")} xong, ${choThamDinh.length} câu chờ thẩm định`);
  });

  console.log(`\nBước 2: thẩm định ngược ${choThamDinh.length} câu, ${Math.ceil(choThamDinh.length / KICH_THUOC_LO_THAM_DINH)} lô...\n`);

  await chayHangDoi(chiaLo(choThamDinh, KICH_THUOC_LO_THAM_DINH), async (lo) => {
    let traVe;
    try {
      traVe = await thuLai(() => thamDinhNguocLo(lo), `thẩm định lô ${lo.map(c => c.id).join(",")}`);
    } catch (e) {
      const thongBao = String(e?.message || e);
      for (const c of lo) dem[c.id] = { trangThai: `lỗi thẩm định: ${thongBao.slice(0, 160)}` };
      luuDem();
      console.log(`  lô ${lo.map(c => c.id).join(",")} LỖI thẩm định: ${thongBao.slice(0, 120)}`);
      return;
    }
    const theoId = new Map((Array.isArray(traVe) ? traVe : []).map(r => [Number(r.id), r]));
    let qua = 0;
    for (const c of lo) {
      const r = theoId.get(c.id);
      const dapAn = String(r?.dapAn || "").trim().toLowerCase();
      const soDung = Number(r?.soPhuongAnDung) || 0;
      if (dapAn !== c.q.correctAnswer || soDung !== 1) {
        dem[c.id] = {
          trangThai: `THẨM ĐỊNH NGƯỢC KHÔNG QUA: AI chọn '${dapAn || "?"}' (đáp án thật '${c.q.correctAnswer}'), báo ${soDung} phương án đúng`,
        };
        continue;
      }
      dem[c.id] = {
        trangThai: "OK",
        // Lưu luôn bản GỐC. Lượt chạy sau nạp lại file đã sửa, nên nếu lấy `q.options` làm bản cũ
        // thì cột "Trước" của báo cáo sẽ in ra chính giá trị mới, và phép thay chuỗi mất mốc neo.
        phuongAnNhieuCu: K.filter(k => k !== c.q.correctAnswer).map(k => String(c.q.options[k])),
        loiGiaiCu: String(c.q.explanation || ""),
        phuongAnNhieu: c.phuongAnNhieu,
        loiGiai: c.loiGiai,
        lechCu: c.lech,
        lechMoi: c.lechMoi,
      };
      qua++;
    }
    luuDem();
    console.log(`  lô ${lo.map(c => c.id).join(",")} thẩm định xong, ${qua}/${lo.length} qua`);
  });
}

// ---------------------------------------------------- áp vào file, thay chuỗi
const idOK = Object.keys(dem).filter(id => dem[id].trangThai === "OK").map(Number).filter(id => bangCau.has(id));
const idHong = Object.keys(dem).filter(id => dem[id].trangThai !== "OK").map(Number).filter(id => bangCau.has(id));

let daThay = 0;
let daApTruocDo = 0;
const khongThayDuoc = [];
for (const b of NGAN_HANG) {
  const duongDan = path.join(root, b.file);
  copyFileSync(duongDan, path.join(THU_MUC_NGOAI, `${path.basename(b.file)}.bak`));
  let nguon = readFileSync(duongDan, "utf8");

  for (const id of idOK) {
    const { q, file } = bangCau.get(id);
    if (file !== b.file) continue;
    const banGhi = dem[id];

    const capThay = [];
    banGhi.phuongAnNhieuCu.forEach((cu, i) => {
      if (cu !== banGhi.phuongAnNhieu[i]) capThay.push([cu, String(banGhi.phuongAnNhieu[i])]);
    });
    if (banGhi.loiGiai && banGhi.loiGiaiCu && banGhi.loiGiaiCu !== banGhi.loiGiai) {
      capThay.push([banGhi.loiGiaiCu, banGhi.loiGiai]);
    }
    if (!capThay.length) continue;

    const demChuoi = (s) => nguon.split(JSON.stringify(s).slice(1, -1)).length - 1;

    // BA TRẠNG THÁI, đừng gộp lại thành hai. Bản đầu chỉ hỏi "chuỗi cũ có duy nhất không" nên lượt
    // chạy lại báo 134 câu "không thay được", nghe như 134 câu hỏng, trong khi thật ra chúng đã
    // được áp xong từ lượt trước. Một báo cáo gộp nhầm hai trạng thái thì đúng bằng không có báo
    // cáo, vì không còn phân biệt được ca cần người xem với ca đã xong.
    if (capThay.every(([, moiChuoi]) => demChuoi(moiChuoi) === 1) && capThay.every(([cu]) => demChuoi(cu) === 0)) {
      daApTruocDo++;
      continue;
    }

    // Thay được ngay khi mọi chuỗi cũ đều duy nhất trong cả file.
    if (capThay.every(([cu]) => demChuoi(cu) === 1)) {
      for (const [cu, moiChuoi] of capThay) {
        nguon = nguon.replace(JSON.stringify(cu).slice(1, -1), JSON.stringify(moiChuoi).slice(1, -1));
      }
      daThay++;
      continue;
    }

    // ĐƯỜNG DỰ PHÒNG: THU MỎ NEO VỀ ĐÚNG MỘT CÂU.
    //
    // Đường thay theo cả file bó tay với phương án ngắn, vì chuỗi ngắn trùng nhau giữa các câu:
    // "Kinh tế vi mô" xuất hiện 12 lần, "Quan sát" 3 lần, "Bản ngã thực tế (Real Self)" 3 lần.
    // Đó là 5 câu duy nhất còn vượt ngưỡng sau cả đợt, tức đúng phần cần nhất lại là phần chặn
    // chốt an toàn từ chối.
    //
    // Cách gỡ: neo vào CÂU HỎI, thứ duy nhất trong cả ngân hàng (công cụ đo xác nhận 0 câu trùng
    // văn bản), rồi chỉ thay trong cửa sổ từ câu hỏi tới hết lời giải của chính câu ấy. Trật tự
    // trường trong file là question, options, correctAnswer, ..., explanation, nên cửa sổ này bao
    // trọn bốn phương án và không chạm sang câu bên cạnh.
    //
    // Vẫn giữ nguyên tinh thần chốt an toàn: trong cửa sổ, mỗi chuỗi cũ vẫn phải xuất hiện đúng
    // một lần, không thì bỏ cả câu.
    const neoCauHoi = JSON.stringify(String(q.question ?? "")).slice(1, -1);
    const viTri = neoCauHoi ? nguon.indexOf(neoCauHoi) : -1;
    const duyNhatCauHoi = neoCauHoi && nguon.split(neoCauHoi).length - 1 === 1;
    const neoLoiGiai = JSON.stringify(String(banGhi.loiGiaiCu ?? "")).slice(1, -1);
    const ketThuc = neoLoiGiai && viTri >= 0 && nguon.indexOf(neoLoiGiai, viTri) > viTri
      ? nguon.indexOf(neoLoiGiai, viTri) + neoLoiGiai.length
      : -1;

    if (!duyNhatCauHoi || viTri < 0 || ketThuc < 0) { khongThayDuoc.push(id); continue; }

    let cuaSo = nguon.slice(viTri, ketThuc);
    const duyNhatTrongCuaSo = capThay.every(([cu]) => {
      const e = JSON.stringify(cu).slice(1, -1);
      return cuaSo.split(e).length - 1 === 1;
    });
    if (!duyNhatTrongCuaSo) { khongThayDuoc.push(id); continue; }

    for (const [cu, moiChuoi] of capThay) {
      cuaSo = cuaSo.replace(JSON.stringify(cu).slice(1, -1), JSON.stringify(moiChuoi).slice(1, -1));
    }
    nguon = nguon.slice(0, viTri) + cuaSo + nguon.slice(ketThuc);
    daThay++;
  }
  writeFileSync(duongDan, nguon);
}

// ------------------------------------------------------------------- báo cáo
const dong = [];
dong.push("# Báo cáo viết lại phương án nhiễu\n");
dong.push(`Chạy lúc: ${new Date().toLocaleString("vi-VN")}\n`);
dong.push(`Ngưỡng lệch: ${NGUONG}.\n`);
dong.push(`- Viết lại thành công và đã áp vào file lượt này: **${daThay}**`);
dong.push(`- Đã áp từ lượt chạy trước, lượt này bỏ qua: **${daApTruocDo}**`);
dong.push(`- Qua được viết lại nhưng chuỗi cũ không duy nhất nên không thay được: **${khongThayDuoc.length}**`);
dong.push(`- Không sửa được, giữ nguyên bản cũ: **${idHong.length}**\n`);

if (idHong.length) {
  dong.push("## Các câu KHÔNG sửa được, giữ nguyên bản cũ\n");
  dong.push("Đọc kỹ phần thẩm định ngược: đó là những câu mà bản viết lại có thể có hai đáp án đúng.\n");
  for (const id of idHong) {
    const { q, file } = bangCau.get(id);
    dong.push(`### Câu #${id} (${file})`);
    dong.push(`- Lệch hiện tại: ${(doLechDoDai(q) * 100).toFixed(0)}%`);
    dong.push(`- Lý do: ${dem[id].trangThai}`);
    dong.push(`- Câu hỏi: ${q.question}\n`);
  }
}

dong.push("## Các câu đã sửa, cần Đàm soát tay ít nhất 20 câu ngẫu nhiên\n");
for (const id of idOK) {
  const { q, file } = bangCau.get(id);
  const banGhi = dem[id];
  const chuCaiNhieu = K.filter(k => k !== q.correctAnswer);
  dong.push(`### Câu #${id} (${file})`);
  dong.push(`Lệch ${((banGhi.lechCu ?? 0) * 100).toFixed(0)}% xuống ${((banGhi.lechMoi ?? 0) * 100).toFixed(0)}%\n`);
  dong.push(`**Câu hỏi**: ${q.question}\n`);
  dong.push(`**Đáp án đúng (giữ nguyên, ${q.correctAnswer})**: ${q.options[q.correctAnswer]}\n`);
  dong.push("| Phương án | Trước | Sau |");
  dong.push("|---|---|---|");
  chuCaiNhieu.forEach((k, i) => {
    const cu = String(banGhi.phuongAnNhieuCu?.[i] ?? q.options[k]).replace(/\|/g, "\\|");
    dong.push(`| ${k} | ${cu} | ${String(banGhi.phuongAnNhieu[i]).replace(/\|/g, "\\|")} |`);
  });
  dong.push(`\n**Lời giải mới**: ${banGhi.loiGiai}\n`);
}

const duongDanBaoCao = path.join(root, "rebalance-report.md");
writeFileSync(duongDanBaoCao, dong.join("\n"));

console.log(`\n${"=".repeat(64)}`);
console.log(`Đã áp lượt này : ${daThay} câu`);
console.log(`Đã áp từ trước : ${daApTruocDo} câu`);
console.log(`Không thay được: ${khongThayDuoc.length} câu${khongThayDuoc.length ? ` (${khongThayDuoc.join(", ")})` : ""}`);
console.log(`Giữ nguyên     : ${idHong.length} câu`);
const truot = idHong.filter(id => String(dem[id].trangThai).includes("THẨM ĐỊNH NGƯỢC"));
if (truot.length) {
  console.log(`  trong đó ${truot.length} câu TRƯỢT THẨM ĐỊNH NGƯỢC, tức bản viết lại có thể có hai đáp án đúng.`);
}
console.log(`Bộ nhớ đệm     : ${FILE_DEM}`);
console.log(`Bản sao lưu    : ${THU_MUC_NGOAI}`);
console.log(`Báo cáo        : ${duongDanBaoCao}`);
console.log(`\nBước tiếp theo: đọc báo cáo, soát tay ít nhất 20 câu, rồi chạy 'node scripts/bank-audit.mjs'.`);
