/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService, questionMap, topicMap, chapterMap, questions, chapters, topics } from "./db";
import { kbService } from "./kbService";
import { contentQualityAssurance } from "./contentQualityAssurance";
import { TimeService } from "./time";
import { learningEngine } from "./learningEngine";
import { learnerModelService, SO_CAU_MOI_KHAI_NIEM } from "./learnerModel";
import { assessmentDesignEngine } from "./assessmentDesignEngine";
import { examReviewEngine } from "./examReviewEngine";
import { workspaceService } from "./workspaceService";
import { AIRecommendation, ExamAttempt, Question, DifficultyLevel } from "../types";
import { ensureSession, supabase } from "./supabaseClient";
import { EvidenceBasedPipeline } from "./evidencePipeline";

/**
 * Header cho lời gọi API: JSON + token Supabase để máy chủ xác thực.
 *
 * Dùng `ensureSession` chứ không phải `getSession`: ứng dụng không còn màn đăng nhập nên bình
 * thường sẽ chẳng có phiên nào sẵn, và `getSession` trả rỗng khiến mọi cổng AI nhận 401.
 * `ensureSession` tự dựng phiên ẩn danh khi cần, người dùng không phải nhập gì.
 */
async function apiHeaders(): Promise<Record<string, string>> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  try {
    if (!supabase) return base;
    const session = await ensureSession();
    const token = session?.access_token;
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
  } catch {
    return base;
  }
}

/**
 * Gửi một lời nhắc đã dựng sẵn lên Gemini qua cổng chuyển tiếp `/api/ai/complete`.
 *
 * Vì sao tầng suy luận chạy ở trình duyệt chứ không ở máy chủ: nó cần ngân hàng câu hỏi, đồ thị
 * khái niệm và lịch sử học của môn ĐANG mở. Với môn người dùng tự tạo trong ứng dụng, những thứ
 * đó chỉ nằm trong localStorage của trình duyệt, máy chủ chưa từng thấy. Trước đây máy chủ tự đi
 * tra câu hỏi theo id nên môn tự tạo luôn nhận 404 và âm thầm rơi về lời giải ngoại tuyến.
 * Chạy ở trình duyệt thì mọi môn đều đúng, không phải deploy lại khi thêm môn.
 */
async function callGemini(
  prompt: string,
  taskType: string,
  subjectName: string,
  /**
   * Ràng buộc dạng đầu ra. Cổng `complete.ts` đã chuyển tiếp sẵn hai trường này xuống Gemini;
   * không truyền thì nhận về văn xuôi rồi phải đoán, chất lượng tụt hẳn.
   */
  dangDauRa?: { responseMimeType?: string; responseSchema?: unknown }
): Promise<string> {
  const response = await fetch("/api/ai/complete", {
    method: "POST",
    headers: await apiHeaders(),
    body: JSON.stringify({ prompt, taskType, subjectName, ...(dangDauRa || {}) }),
  });
  if (!response.ok) {
    throw new Error(`Cổng AI trả về ${response.status}`);
  }
  const data = await response.json();
  // Máy chủ trả chuỗi rỗng khi Gemini không dùng được; ném lỗi để nơi gọi rơi về bản dự phòng
  // ngoại tuyến của mình, vốn đầy đủ hơn (có lời giải sẵn trong dữ liệu môn học).
  if (!data.text || data.offlineMode) {
    throw new Error("Cổng AI đang ở chế độ ngoại tuyến");
  }
  return data.text as string;
}

/** Bản dự phòng ngoại tuyến: đọc thẳng lời giải có sẵn trong dữ liệu môn học. */
function offlineExplanation(questionId: number): string {
  const q = questionMap.get(questionId);
  if (!q) return "Không tìm thấy câu hỏi.";
  return `*(Chế độ ngoại tuyến)*\n\n**Đáp án đúng**: **${q.correctAnswer.toUpperCase()}** - ${q.options[q.correctAnswer]}\n\n### Giải thích chi tiết:\n${q.explanation}\n\n### Ánh xạ kiến thức:\n- **Chương**: ${q.chapterId}\n- **Chủ đề**: ${q.topicId} (${topicMap.get(q.topicId)?.title || q.topicId})\n- **Nguồn tài liệu**: *${q.sourcePdf}* (Trang ${q.sourcePage})\n- **Từ khóa**: ${q.knowledgeMapping.join(", ")}`;
}

/** Chạy tầng suy luận có dẫn chứng ngay tại trình duyệt cho câu hỏi đang xét. */
async function runPipeline(questionId: number, selectedAnswer?: string, explanationLevel?: string) {
  const subjectId = dbService.getActiveSubjectId();
  const subjectName = dbService.getActiveSubjectName();
  return EvidenceBasedPipeline.executePipeline({
    subjectId,
    subjectName,
    questionId,
    selectedAnswer,
    explanationLevel: explanationLevel || "academic",
    // CẢNH BÁO cho người sau: `executePipeline` KHÔNG hề gọi tham số này. Nó gọi thẳng
    // `aiProviderRegistry` ở bước 9. Tham số này là mã chết còn sót lại, đã kiểm chứng bằng
    // cách dò toàn bộ evidencePipeline.ts. Vẫn truyền một hàm chạy đúng để nếu sau này có ai
    // đấu nối lại thì nó hoạt động, chứ không nổ.
    // Đường đi thật của lời gọi AI nằm ở `Gemini36FlashProvider.execute`, nơi tự phân biệt
    // đang chạy trên máy chủ hay trên trình duyệt.
    aiEngineExecutor: async (_sysInstruction: string, prompt: string) =>
      callGemini(prompt, "AcademicExplanation", subjectName),
    fallbackFunction: () => offlineExplanation(questionId),
  });
}

// ===== Hỗ trợ sinh câu hỏi hàng loạt từ tài liệu dài =====

/** Chia tài liệu dài thành nhiều đoạn theo ranh giới đoạn văn, mỗi đoạn tối đa maxChars ký tự. */
function splitIntoChunks(text: string, maxChars = 2800): string[] {
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > maxChars) {
      chunks.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${p}` : p;
    while (cur.length > maxChars) {
      chunks.push(cur.slice(0, maxChars));
      cur = cur.slice(maxChars);
    }
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.length ? chunks : [text];
}

/** Xáo trộn mảng tại chỗ (Fisher-Yates) để mỗi lần tạo đề cho ra thứ tự/lựa chọn câu khác nhau. */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Nhiễu tất định trong [0, 1) sinh từ (id câu hỏi, hạt giống). Cùng cặp đầu vào luôn cho cùng
 * kết quả, nên thứ hạng tái lập được và có thể kiểm chứng, khác hẳn việc gọi Math.random
 * ngay trong hàm so sánh (vừa phá hợp đồng sắp xếp vừa không tái lập được).
 */
function jitter01(id: number, seed: number): number {
  let h = (id * 2654435761 + seed * 40503) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return h / 4294967296;
}

/**
 * Hạt giống cho đề thích ứng, lấy từ chính danh sách câu vừa ra gần đây. Danh sách này đổi
 * sau mỗi lần tạo đề, nên mỗi đề có nhiễu khác nhau; đồng thời nó là trạng thái đã lưu, nên
 * cùng một trạng thái sẽ dựng lại đúng thứ hạng cũ, phục vụ việc kiểm chứng và truy vết.
 */
function adaptiveSeed(): number {
  const recent = workspaceService.getRecentlyServedQuestionIds();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < recent.length; i++) {
    h ^= recent[i] & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h ^ recent.length) >>> 0;
}

/** Chuẩn hóa đề bài để so trùng lặp (bỏ hoa/thường, dấu câu, khoảng trắng thừa). */
function normalizeQuestionText(s: string): string {
  return String(s).toLowerCase().replace(/[.,;:?!"'“”()\-]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Kiểm tra một câu thô từ AI có đạt chất lượng tối thiểu không: có đề bài, đủ 4 phương án
 * khác rỗng, đáp án đúng nằm trong a/b/c/d và 4 phương án không trùng lặp nhau.
 */
/** Các giai đoạn của một lượt sinh ngân hàng, dùng để giao diện nói đúng việc đang chạy. */
export type GiaiDoanSinhCauHoi = "soan" | "canbang" | "luu";

/**
 * NGƯỠNG LỆCH ĐỘ DÀI PHƯƠNG ÁN, và vì sao đúng con số này.
 *
 * Đo ngày 12/08/2026 bằng `scripts/bank-audit.mjs`: đáp án đúng là phương án DÀI NHẤT ở **63,4%**
 * số câu của môn đang mở, trong khi ngẫu nhiên là 25%. Chỉ cần luôn chọn phương án dài nhất mà
 * KHÔNG ĐỌC CÂU HỎI là được **6,3 trên 10 điểm**. Phần biên soạn tay còn lệch nặng hơn phần AI
 * sinh (75,0% so với 62,9%), nên đây là thói quen soạn đề nói chung chứ không phải tật riêng của
 * mô hình ngôn ngữ: người soạn viết đáp án đúng cho thật đủ ý rồi viết ba phương án nhiễu cho xong.
 *
 * Vì sao `optionShuffle` không cứu được: nó trộn tất định để xoá thiên lệch **vị trí**, và làm
 * đúng việc đó. Nhưng **trộn vị trí không đụng gì tới độ dài**, nên cái bẫy còn nguyên sau khi
 * trộn. Một biện pháp phòng thủ có sẵn khiến người đọc mã tin rằng thiên lệch đã được lo xong.
 *
 * Ngưỡng 0,10 chọn theo số đo chứ không chọn cho tròn. Bản đầu đặt 0,20 và **tự mâu thuẫn**:
 *
 *   | Ngưỡng | Số câu phải sửa | Tỷ lệ "dài nhất" còn lại |
 *   |--------|-----------------|--------------------------|
 *   | 0,20   | 87              | 41,1%  rớt vùng đạt      |
 *   | 0,15   | 119             | 32,9%  sát mép trên      |
 *   | 0,10   | 140             | 27,4%  giữa vùng đạt     |
 *   | 0,05   | 162             | 21,9%  sát mép dưới      |
 *
 * Vùng đạt là 20% tới 35%, quanh mức ngẫu nhiên 25%. Nhóm kiểm AJ canh cả hai đầu.
 */
export const NGUONG_LECH_DO_DAI = 0.10;

const CHU_CAI_PHUONG_AN = ["a", "b", "c", "d"] as const;

/**
 * Đáp án đúng dài hơn phương án dài NHÌ bao nhiêu phần.
 *
 * So với phương án dài nhì chứ không so với trung bình ba phương án còn lại, vì người làm bài
 * nhặt đáp án bằng cách nhìn phương án nào NỔI HẲN LÊN, tức so với đối thủ gần nhất của nó. Một
 * câu có đáp án đúng 100 ký tự và ba phương án 95, 30, 30 thì lệch nhiều so với trung bình nhưng
 * mắt không nhặt ra được đáp án, vì đã có một phương án khác dài xấp xỉ.
 *
 * Trả về số dương khi đáp án đúng dài hơn, số âm khi nó ngắn hơn. Công thức này trùng đúng với
 * `doLechDoDai` trong `scripts/bank-audit.mjs`; sửa một bên thì phải sửa bên kia.
 */
export function doLechDoDaiPhuongAn(q: any): number {
  const dung = String(q?.options?.[q?.correctAnswer] ?? "");
  if (dung.length === 0) return 0;
  const conLai = CHU_CAI_PHUONG_AN
    .filter(k => k !== q.correctAnswer)
    .map(k => String(q?.options?.[k] ?? "").length);
  if (conLai.length === 0) return 0;
  return (dung.length - Math.max(...conLai)) / dung.length;
}

/** Câu có bốn phương án đủ cân về độ dài để không lộ đáp án. */
export function canBangDoDaiPhuongAn(q: any): boolean {
  return doLechDoDaiPhuongAn(q) <= NGUONG_LECH_DO_DAI;
}

/**
 * Mẫu bắt đoạn lời giải liệt kê tên các phương án SAI, ví dụ "các phương án a, c và d không...".
 * Đòi ít nhất hai nhãn liền nhau để không dính vào câu "đáp án b đúng vì...".
 *
 * `(?![\p{L}\p{M}])` là phần bắt buộc, đừng bỏ. Bản đầu thiếu nó và **báo nhầm ngay lượt chạy thử
 * đầu tiên**: "Phương án a bị ngược mệnh đề" bị đọc thành nhãn 'a' rồi nhãn 'b' của chữ "bị", còn
 * "Phương án b chính xác" thành nhãn 'b' rồi nhãn 'c' của chữ "chính". Hai câu #3084 và #3137
 * hoàn toàn lành lặn bị kết tội, và tệ hơn, công cụ viết lại đã vứt bỏ 4 bản viết lại tốt vì cùng
 * lý do ấy, tức đốt lượt gọi Gemini rồi trả câu về đúng bản lệch cũ.
 *
 * Chép nguyên văn sang `NHAN_PHUONG_AN_TRONG_LOI_GIAI` của `scripts/rebalance-distractors.mjs`;
 * phép kiểm AJ5 canh hai bản khớp nhau.
 */
export const NHAN_PHUONG_AN_TRONG_LOI_GIAI =
  /(?:phương án|đáp án|lựa chọn)\s+((?:[a-d](?![\p{L}\p{M}])\s*(?:,|và|hoặc|\/|;)?\s*){2,})/giu;

/**
 * Lời giải có tự gọi chính ĐÁP ÁN ĐÚNG là một phương án sai không.
 *
 * VÌ SAO CÓ HÀM NÀY, đây là lỗi nội dung nguy hiểm nhất bắt được trong đợt 12/08/2026. Lời nhắc
 * viết lại phương án nhiễu có nêu ví dụ bằng giá trị cụ thể, "vẫn gọi tên phương án theo đúng lối
 * 'phương án b, c, d không phản ánh...'", với ý là giữ VĂN PHONG. Mô hình hiểu thành giữ đúng BA
 * CHỮ CÁI ấy, nên sinh ra lời giải gọi chính đáp án đúng là phương án sai:
 *
 *     câu #2004, đáp án đúng 'b'  ->  "Các phương án b, c, d không phản ánh đúng..."
 *     câu #2012, đáp án đúng 'c'  ->  "Các phương án b, c, d không phản ánh đúng..."
 *
 * Bài học ghi lại để khỏi lặp: chỉ dẫn nêu ví dụ bằng giá trị cụ thể thì mô hình sẽ chép lại chính
 * giá trị ấy. Nêu ví dụ bằng ô trống, hoặc bơm thẳng giá trị thật của từng câu vào lời nhắc.
 *
 * Thẩm định ngược KHÔNG bắt được lỗi này, vì nó chỉ hỏi phương án nào đúng chứ không đọc lời giải.
 * Một chốt chặn đúng đắn vẫn có vùng mù rộng đúng bằng phạm vi câu hỏi nó đặt ra.
 *
 * Còn một đường lây nữa khiến lỗi này đắt hơn vẻ ngoài: `optionShuffle` ĐỌC lời giải để tìm nhãn
 * phương án rồi remap theo thứ tự đã trộn, nên nhãn sai được remap y như thật và sai tiếp sang bản
 * đã trộn.
 */
export function loiGiaiGoiNhamDapAnDung(loiGiai: string, chuCaiDung: string): boolean {
  const chuoi = String(loiGiai || "").toLowerCase();
  const chuCai = String(chuCaiDung || "").toLowerCase();
  const re = new RegExp(NHAN_PHUONG_AN_TRONG_LOI_GIAI.source, "giu");
  for (let m = re.exec(chuoi); m; m = re.exec(chuoi)) {
    const chuCaiTrongDoan: string[] = m[1].match(/[a-d]/g) ?? [];
    if (chuCaiTrongDoan.includes(chuCai)) return true;
  }
  return false;
}

/**
 * Nhờ AI viết lại ĐÚNG BA phương án nhiễu cho một câu bị lệch độ dài, giữ nguyên câu hỏi và đáp
 * án đúng. Trả về câu đã sửa, hoặc `null` nếu không sửa được.
 *
 * Ba điều cố ý:
 *
 * 1. **Không rút gọn đáp án đúng.** Cắt đáp án đúng cho ngắn lại thì hết lệch nhưng câu hỏi mất
 *    giá trị học, vì đáp án đúng chính là phần người học cần đọc kỹ nhất.
 * 2. **Viết lại luôn phần lời giải nói về phương án nhiễu.** Lời giải cũ đang mô tả nội dung cũ,
 *    để nguyên là màn hình tự mâu thuẫn. Chú ý: `optionShuffle` ĐỌC lời giải để tìm nhãn phương
 *    án rồi remap theo thứ tự mới.
 *
 *    **Bơm thẳng ba chữ cái thật của câu vào lời nhắc, tuyệt đối không nêu ví dụ bằng "b, c, d".**
 *    Bản đầu viết đúng như vậy với ý là giữ VĂN PHONG, và mô hình chép lại nguyên ba chữ cái ấy,
 *    đẻ ra lời giải gọi chính đáp án đúng là phương án sai. Xem `loiGiaiGoiNhamDapAnDung`.
 * 3. **Đi qua `/api/ai/complete`**, cổng chuyển tiếp đã có, chứ không dựng cổng mới. Bất biến 4.8:
 *    máy chủ không giữ dữ liệu môn học, chỉ chuyển tiếp lời nhắc.
 */
async function vietLaiPhuongAnNhieu(q: any, subjectName: string): Promise<any | null> {
  const dung = String(q?.options?.[q?.correctAnswer] ?? "");
  const chuCaiNhieu = CHU_CAI_PHUONG_AN.filter(k => k !== q.correctAnswer);
  const nhieuCu = chuCaiNhieu
    .map(k => `${k}) ${String(q?.options?.[k] ?? "")}`)
    .join("\n");
  const doDaiDich = dung.length;

  const prompt = `Một câu hỏi trắc nghiệm đang bị lỗi: đáp án đúng dài hơn hẳn ba phương án nhiễu, nên người học đoán được đáp án chỉ bằng cách chọn phương án dài nhất.

Câu hỏi: ${String(q?.question ?? "")}

Đáp án ĐÚNG (giữ nguyên, tuyệt đối không sửa, dài ${doDaiDich} ký tự):
${dung}

Ba phương án nhiễu hiện tại, cần viết lại, theo đúng thứ tự '${chuCaiNhieu.join("', '")}':
${nhieuCu}

Lời giải hiện tại:
${String(q?.explanation ?? "")}

Hãy viết lại ĐÚNG BA phương án nhiễu theo các ràng buộc sau:
1. Mỗi phương án nhiễu dài từ ${Math.round(doDaiDich * 0.85)} tới ${Math.round(doDaiDich * 1.15)} ký tự.
2. Cùng cấu trúc ngữ pháp và cùng mức độ chi tiết với đáp án đúng.
3. SAI rõ ràng về mặt học thuật. Mỗi phương án nhắm vào một hiểu sai có thật: nhầm sang khái niệm lân cận, đảo ngược quan hệ nhân quả, hoặc lấy một phần thay cho toàn thể.
4. Tuyệt đối KHÔNG được là cách diễn đạt khác của đáp án đúng, và không phương án nào được đúng một phần tới mức gây tranh cãi.
5. Viết lại phần lời giải cho khớp nội dung mới, gồm hai ý: vì sao đáp án đúng là đúng, và vì sao ba phương án nhiễu là sai.
6. Trong lời giải, ba chữ cái được phép gọi là phương án sai CHỈ GỒM: ${chuCaiNhieu.join(", ")}. Tuyệt đối không nhắc chữ '${q.correctAnswer}' trong danh sách phương án sai, vì '${q.correctAnswer}' chính là đáp án đúng.

Trả về JSON đúng lược đồ.`;

  try {
    const raw = await callGemini(prompt, "QuizGeneration", subjectName, {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          phuongAnNhieu: { type: "array", items: { type: "string" } },
          loiGiai: { type: "string" },
        },
        required: ["phuongAnNhieu", "loiGiai"],
      },
    });
    const parsed = JSON.parse(raw);
    const moi: string[] = Array.isArray(parsed?.phuongAnNhieu) ? parsed.phuongAnNhieu.map((s: any) => String(s).trim()) : [];
    if (moi.length !== 3 || moi.some(s => s.length === 0)) return null;

    const options: any = { ...q.options };
    chuCaiNhieu.forEach((k, i) => { options[k] = moi[i]; });

    const loiGiaiMoi = String(parsed?.loiGiai ?? q.explanation ?? "").trim() || q.explanation;
    // Lời giải mới gọi chính đáp án đúng là phương án sai thì bỏ cả bản viết lại. Giữ lại câu lệch
    // còn hơn đưa vào ngân hàng một lời giải tự mâu thuẫn, vì lời giải sai còn lây tiếp sang bản đã
    // trộn qua `optionShuffle`.
    if (loiGiaiGoiNhamDapAnDung(String(loiGiaiMoi ?? ""), String(q.correctAnswer ?? ""))) return null;

    const suaXong = { ...q, options, explanation: loiGiaiMoi };
    // Chạy lại toàn bộ cổng chất lượng, không chỉ kiểm độ dài: bản viết lại vẫn có thể tạo ra hai
    // phương án trùng nhau hoặc một phương án rỗng.
    return isQualityQuestion(suaXong) ? suaXong : null;
  } catch {
    return null;
  }
}

function isQualityQuestion(q: any): boolean {
  if (!q || typeof q.question !== "string" || q.question.trim().length < 8) return false;
  const o = q.options;
  if (!o) return false;
  const vals = [o.a, o.b, o.c, o.d].map(v => String(v ?? "").trim());
  if (vals.some(v => v.length === 0)) return false;
  // Bốn phương án phải phân biệt (không có hai phương án giống hệt nhau).
  const uniq = new Set(vals.map(v => v.toLowerCase()));
  if (uniq.size < 4) return false;
  const ca = String(q.correctAnswer || "").trim().toLowerCase();
  if (!["a", "b", "c", "d"].includes(ca)) return false;
  return true;
}

/**
 * Gọi 1 lượt API sinh câu hỏi, trả về mảng câu đạt chất lượng (chưa gán ID). Ném lỗi nếu request thất bại.
 * targetChapterId (nếu có) được gửi kèm để AI bám sát đúng chương đang cần tạo.
 */
async function requestQuestionBatch(text: string, count: number, targetChapterId?: number): Promise<any[]> {
  const subjectName = dbService.getActiveSubjectName();
  const chapterOutline = chapters.map(c => `${c.id}. ${c.title}`).join("\n");
  const targetChapterTitle = targetChapterId
    ? (chapters.find(c => c.id === targetChapterId)?.title || "")
    : undefined;
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: await apiHeaders(),
    body: JSON.stringify({ text, count, subjectName, chapterOutline, targetChapterId, targetChapterTitle }),
  });
  if (!response.ok) {
    let msg = "Không tạo được câu hỏi từ AI. Vui lòng thử lại.";
    try { const err = await response.json(); if (err?.error) msg = err.error; } catch {}
    throw new Error(msg);
  }
  const data = await response.json();
  const raw: any[] = Array.isArray(data.questions) ? data.questions : [];
  return raw.filter(isQualityQuestion);
}

/**
 * Chuẩn hóa 1 câu thô từ AI thành đối tượng Question hoàn chỉnh (gán ID, kẹp chapterId hợp lệ).
 * forcedChapterId (nếu có) ép câu về đúng chương đích, bỏ qua chapterId AI tự đoán.
 */
function rawToQuestion(q: any, id: number, source: string, forcedChapterId?: number): Question {
  const maxChapter = chapters.length || 1;
  const validDiff = ["Dễ", "Trung bình", "Khó", "Rất khó"];
  const chapterId = forcedChapterId
    ? Math.min(Math.max(forcedChapterId, 1), maxChapter)
    : Math.min(Math.max(parseInt(q.chapterId) || 1, 1), maxChapter);
  const ca = String(q.correctAnswer || "a").trim().toLowerCase();
  const correctAnswer = (["a", "b", "c", "d"].includes(ca) ? ca : "a") as "a" | "b" | "c" | "d";
  // Khi ép chương: giữ topicId của AI nếu nó thuộc đúng chương, ngược lại đưa về chủ đề đầu chương.
  const rawTopic = typeof q.topicId === "string" ? q.topicId : "";
  const topicId = forcedChapterId
    ? (rawTopic.includes(`${forcedChapterId}.`) ? rawTopic : `T${chapterId}.1`)
    : (rawTopic || `T${chapterId}.1`);
  return {
    id,
    question: String(q.question).trim(),
    options: { a: String(q.options.a), b: String(q.options.b), c: String(q.options.c), d: String(q.options.d) },
    correctAnswer,
    chapterId,
    topicId,
    difficulty: validDiff.includes(q.difficulty) ? q.difficulty : "Trung bình",
    difficultyRating: Number(q.difficultyRating) || 3,
    explanation: q.explanation || "",
    sourcePdf: source,
    sourcePage: "AI tạo sinh",
    knowledgeMapping: Array.isArray(q.knowledgeMapping) ? q.knowledgeMapping : [],
    relatedQuestions: [],
    estimatedTime: Number(q.estimatedTime) || 45,
    questionType: "multiple-choice",
    learningObjective: q.learningObjective || "",
    concept: q.concept,
    misconception: q.misconception,
    bloomLevel: q.bloomLevel,
    createdAt: TimeService.now().toISOString(),
    metadata: q.metadata,
    pedagogicalMetadata: q.pedagogicalMetadata,
  };
}

/**
 * Cổng gọi AI ở mức thấp, mở ra cho các dịch vụ khác dựng lời nhắc RIÊNG của mình.
 *
 * Vì sao mở: chế độ nhớ lại chủ động cần một lời nhắc chấm bài hoàn toàn khác lời nhắc giải thích
 * câu hỏi, và `ai.ts` đã 1.055 dòng. Nhét thêm một họ lời nhắc nữa vào đây là làm file này thành
 * chỗ chứa mọi thứ. Nhưng phần TRUYỀN TẢI thì phải dùng chung, vì bất biến 4.8 đòi mọi lượt gọi
 * đều đi qua `/api/ai/complete` và máy chủ không được giữ dữ liệu môn học.
 *
 * Đây KHÔNG phải cửa để bỏ qua kiểm tra đầu ra. Nơi gọi tự chịu trách nhiệm kiểm tra thứ nhận về,
 * và phải nói "chưa làm được" khi mô hình trả rác chứ không được tự điền giá trị thay nó.
 */
export async function goiCongAI(
  prompt: string,
  taskType: string,
  subjectName: string,
  dangDauRa?: { responseMimeType?: string; responseSchema?: unknown }
): Promise<string> {
  return callGemini(prompt, taskType, subjectName, dangDauRa);
}

export const aiService = {
  /**
   * Generates a local diagnostic recommendation based on user performance history.
   * Serving as a high-fidelity local fallback if Gemini is offline or not configured.
   */
  generateLocalRecommendation(): AIRecommendation {
    const stats = dbService.getStatistics();
    const overview = dbService.getDashboardOverview();
    // Tên môn và chương phải lấy từ môn ĐANG MỞ. Bản cũ chào người học bằng chuỗi cứng
    // "Kinh tế chính trị Mác - Lênin" và "Chương 1", nên khi môn đang mở là Hành vi Khách hàng
    // thì câu đầu tiên người học đọc được đã sai tên môn. Đây là kho luyện thi nhiều môn, mỗi
    // chuỗi cứng như vậy là một lời nói dối chờ tới lượt.
    const tenMonDangMo = dbService.getActiveSubjectName();
    const chuongDau = chapters[0];

    if (stats.totalSolved === 0) {
      return {
        id: "initial-rec",
        date: TimeService.now().toISOString(),
        weakChapters: [],
        weakTopics: [],
        recommendationText: `Chào mừng bạn đến với phần luyện thi môn **${tenMonDangMo}**! Hệ thống ghi nhận bạn chưa làm bài tập nào. Hãy bắt đầu bằng cách làm đề luyện tập **Ngẫu nhiên 10 câu**${chuongDau ? ` hoặc ôn tập theo **${chuongDau.title}**` : ""} để hệ thống thu thập dữ liệu chẩn đoán năng lực của bạn.`,
        suggestedAction: {
          type: "smart-exam",
          count: 10
        }
      };
    }

    // Các khái niệm ĐANG TRÔI, tính lại theo thời điểm hiện tại chứ không đọc con số cũ đã lưu.
    //
    // Vì sao thêm: gợi ý cũ chỉ nhìn tỷ lệ đúng theo chương và theo chủ đề, tức chỉ nhìn thứ đã
    // xảy ra, không nhìn thứ đang mất dần. Người đúng 100% luôn nhận đúng một câu "chúc mừng
    // phong độ xuất sắc" kể cả khi mọi khái niệm đã quá hạn ôn từ lâu. Mà toàn bộ hạ tầng đường
    // cong quên thì có sẵn, chỉ là chưa ai nối vào chỗ ra lời khuyên.
    const bayGio = TimeService.now().getTime();
    const khaiNiemDangTroi = Object.values(learnerModelService.getConceptProfiles())
      .filter(p => p.attemptsCount > 0 && p.lastStudiedAt)
      .map(p => learnerModelService.recalculateForgettingScore(p))
      .filter(p => p.forgettingScore < 0.6)
      .map(p => ({
        ten: p.conceptName,
        conNho: p.forgettingScore,
        soNgayQuaHan: p.nextReviewAt ? (bayGio - new Date(p.nextReviewAt).getTime()) / 86400000 : 0,
      }))
      .sort((a, b) => (a.conNho - b.conNho) || a.ten.localeCompare(b.ten));

    const quaHan = khaiNiemDangTroi.filter(k => k.soNgayQuaHan > 0);

    /** Một dòng cảnh báo trôi kiến thức, hoặc chuỗi rỗng nếu chưa có gì đáng lo. */
    const dongCanhBaoTroi = khaiNiemDangTroi.length === 0
      ? ""
      : `\n\n### Kiến thức đang trôi:\n${khaiNiemDangTroi.slice(0, 3)
        .map(k => `- **${k.ten}**: ước tính còn nhớ **${Math.round(k.conNho * 100)}%**${k.soNgayQuaHan > 0 ? `, đã quá hạn ôn ${Math.round(k.soNgayQuaHan)} ngày` : ""}`)
        .join("\n")}${khaiNiemDangTroi.length > 3 ? `\n- và ${khaiNiemDangTroi.length - 3} khái niệm khác cùng nhóm.` : ""}`;

    // Trôi kiến thức được ưu tiên TRƯỚC chương yếu, vì nó có tính thời điểm: chương yếu để tuần
    // sau vẫn yếu y như vậy, còn khái niệm sắp trôi thì để càng lâu càng phải học lại từ đầu.
    // Chỉ giành quyền ưu tiên khi đã quá hạn ít nhất 3 khái niệm, để một hai khái niệm lẻ không
    // chiếm chỗ của chẩn đoán năng lực.
    if (quaHan.length >= 3) {
      const chuongCanOn = quaHan
        .map(k => kbService.getKnowledgeGraph(dbService.getActiveSubjectId()).find(n => n.concept === k.ten)?.chapter)
        .filter((c): c is number => typeof c === "number");
      const demTheoChuong = new Map<number, number>();
      chuongCanOn.forEach(c => demTheoChuong.set(c, (demTheoChuong.get(c) || 0) + 1));
      const chuongNong = [...demTheoChuong.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))[0];

      return {
        id: `local-rec-${TimeService.nowTimestamp()}`,
        date: TimeService.now().toISOString(),
        weakChapters: chuongNong ? [chuongNong[0]] : [],
        weakTopics: [],
        recommendationText: `### Ưu tiên ngay lúc này: ôn lại trước khi trôi
Bạn có **${quaHan.length} khái niệm** đã quá hạn ôn tập. Theo đường cong quên được hiệu chuẩn từ chính lịch sử học của bạn, để càng lâu thì công sức học lại càng lớn, nên việc này nên làm trước cả việc luyện thêm câu mới.${dongCanhBaoTroi}

### Gợi ý lộ trình:
Làm một đề ôn tập ngắn phủ đúng các khái niệm trên. Trả lời đúng một lần lúc sắp quên có giá trị củng cố cao hơn nhiều so với đọc lại lý thuyết khi vẫn còn nhớ rõ.`,
        suggestedAction: {
          type: chuongNong ? "chapter-review" : "smart-exam",
          chapterId: chuongNong ? chuongNong[0] : undefined,
          count: 15
        }
      };
    }

    // Identify weak chapters (accuracy < 70% and total > 0)
    const weakChapters: number[] = [];
    Object.entries(stats.accuracyByChapter).forEach(([chIdStr, data]) => {
      const chId = parseInt(chIdStr);
      if (data.total > 0) {
        const accuracy = data.correct / data.total;
        if (accuracy < 0.7) {
          weakChapters.push(chId);
        }
      }
    });

    // Identify weak topics (accuracy < 65% and total > 0)
    const weakTopics: string[] = [];
    Object.entries(stats.accuracyByTopic).forEach(([tId, data]) => {
      if (data.total > 0) {
        const accuracy = data.correct / data.total;
        if (accuracy < 0.65) {
          weakTopics.push(tId);
        }
      }
    });

    let recommendationText = "";
    let actionType: "smart-exam" | "chapter-review" | "topic-review" = "smart-exam";
    let actionChapterId: number | undefined;
    let actionTopicId: string | undefined;
    let actionCount = 10;

    const overallAccuracy = stats.totalSolved > 0 ? (stats.totalCorrect / stats.totalSolved) * 100 : 0;

    if (weakChapters.length > 0) {
      // Sort weak chapters by accuracy (worst first)
      weakChapters.sort((a, b) => {
        const accA = stats.accuracyByChapter[a].correct / stats.accuracyByChapter[a].total;
        const accB = stats.accuracyByChapter[b].correct / stats.accuracyByChapter[b].total;
        return accA - accB;
      });

      const primaryWeakChId = weakChapters[0];
      const primaryCh = chapters.find(c => c.id === primaryWeakChId);
      const chAcc = Math.round((stats.accuracyByChapter[primaryWeakChId].correct / stats.accuracyByChapter[primaryWeakChId].total) * 100);

      recommendationText = `### Phân tích Chẩn đoán năng lực:
Hệ thống AI nhận diện bạn đang gặp khó khăn nhiều nhất ở **${primaryCh?.title}** với tỷ lệ làm đúng khá thấp (chỉ đạt **${chAcc}%**).${dongCanhBaoTroi}

### Gợi ý lộ trình ôn tập:
1. **Ôn lại lý thuyết**: Bạn nên xem lại slide bài giảng và giáo trình liên quan đến chương này.
2. **Luyện tập trọng tâm**: Tập trung giải các câu hỏi của chương này để khắc sâu kiến thức.
3. **Giải thích chi tiết**: Sử dụng nút **Hỏi giải thích AI** ở mỗi câu làm sai để thấu hiểu bản chất.

Chúng tôi khuyến nghị bạn thực hiện ngay một đề **Ôn tập trọng tâm Chương ${primaryWeakChId}** với 15 câu để cải thiện điểm số.`;

      actionType = "chapter-review";
      actionChapterId = primaryWeakChId;
      actionCount = 15;
    } else if (weakTopics.length > 0) {
      // Sort weak topics
      weakTopics.sort((a, b) => {
        const accA = stats.accuracyByTopic[a].correct / stats.accuracyByTopic[a].total;
        const accB = stats.accuracyByTopic[b].correct / stats.accuracyByTopic[b].total;
        return accA - accB;
      });

      const primaryWeakTId = weakTopics[0];
      const primaryTopic = topics.find(t => t.id === primaryWeakTId);
      const tAcc = Math.round((stats.accuracyByTopic[primaryWeakTId].correct / stats.accuracyByTopic[primaryWeakTId].total) * 100);

      recommendationText = `### Phân tích Chẩn đoán năng lực:
Năng lực tổng thể của bạn rất tốt! Tuy nhiên, bạn có một điểm khuyết nhỏ ở chủ đề **"${primaryTopic?.title}"** với tỷ lệ chính xác chỉ đạt **${tAcc}%**.${dongCanhBaoTroi}

### Gợi ý lộ trình:
Hãy làm một bộ đề luyện tập ngắn (10 câu) tập trung riêng biệt vào chủ đề này để lấp đầy lỗ hổng kiến thức và tối ưu hóa điểm số thi thật của bạn.`;

      actionType = "topic-review";
      actionTopicId = primaryWeakTId;
      actionCount = 10;
    } else {
      // Không còn chương yếu nào. Nhưng "không có chương yếu" KHÁC "không có gì phải làm": lời
      // khen suông trong khi kiến thức đang trôi là lời khuyên tệ nhất, vì nó khiến người học
      // yên tâm đúng lúc không nên yên tâm.
      recommendationText = khaiNiemDangTroi.length > 0
        ? `### Phong độ tốt, nhưng có vài chỗ đang nguội
Tỷ lệ làm đúng trung bình của bạn đạt **${Math.round(overallAccuracy)}%** và không có chương nào dưới 70%. Điều còn lại cần giữ là **duy trì**: có ${khaiNiemDangTroi.length} khái niệm đang tụt dưới mức nhớ an toàn.${dongCanhBaoTroi}

### Gợi ý lộ trình:
Xen kẽ đề thi thử với vài lượt ôn ngắn cho đúng các khái niệm trên. Đề **AI Smart Exam** mô phỏng tỷ lệ phân bổ chương và độ khó như đề thi thật, thích hợp để kiểm tra tổng thể sau khi đã củng cố xong.`
        : `### Chúc mừng phong độ xuất sắc!
Bạn đang có phong độ học tập cực kỳ ấn tượng với tỷ lệ làm đúng trung bình đạt **${Math.round(overallAccuracy)}%**, không có chương yếu nào dưới 70%, và không có khái niệm nào đang tụt dưới mức nhớ an toàn.

### Gợi ý lộ trình:
Để chuẩn bị tốt nhất cho kỳ thi chính thức đạt điểm tối đa (A+), bạn hãy thử sức với chế độ **AI Smart Exam (Đề thi thử AI)** được thiết kế mô phỏng tỷ lệ phân bổ chương và độ khó chuẩn như một đề thi đại học chính thức.`;

      actionType = "smart-exam";
      actionCount = 20;
    }

    return {
      id: `local-rec-${TimeService.nowTimestamp()}`,
      date: TimeService.now().toISOString(),
      weakChapters,
      weakTopics,
      recommendationText,
      suggestedAction: {
        type: actionType,
        chapterId: actionChapterId,
        topicId: actionTopicId,
        count: actionCount
      }
    };
  },

  /**
   * Fetches advanced explanation from server-side Gemini client
   */
  async getAIExplanation(questionId: number, selectedAnswer?: string, explanationLevel?: string): Promise<string> {
    try {
      const result = await runPipeline(questionId, selectedAnswer, explanationLevel);
      return result.text;
    } catch (error) {
      console.warn("Tầng suy luận không chạy được, dùng lời giải cục bộ:", error);
      return offlineExplanation(questionId);
    }
  },

  /**
   * Fetches the complete advanced evidence-based reasoning pipeline's results
   */
  async getAIPipelineExplanation(questionId: number, selectedAnswer?: string, explanationLevel?: string): Promise<{
    explanation: string;
    strategyUsed: string;
    guessingProbability: number;
    unmasteredPrerequisites: string[];
    crossSubjectIntel: any;
    validationReport: any;
  }> {
    try {
      const result = await runPipeline(questionId, selectedAnswer, explanationLevel);
      return {
        explanation: result.text,
        strategyUsed: result.strategyUsed || "Academic Lecture",
        guessingProbability: result.guessingProbability || 0,
        unmasteredPrerequisites: result.unmasteredPrerequisites || [],
        crossSubjectIntel: result.crossSubjectIntel || null,
        validationReport: result.validationReport || { isValid: true, score: 100, failedChecks: [] }
      };
    } catch (error) {
      console.warn("Tầng suy luận không chạy được, dùng lời giải cục bộ:", error);
      return {
        explanation: offlineExplanation(questionId),
        strategyUsed: "Offline Local Fallback",
        guessingProbability: 0,
        unmasteredPrerequisites: [],
        crossSubjectIntel: null,
        validationReport: { isValid: true, score: 100, failedChecks: [] }
      };
    }
  },

  /**
   * Fetches advanced personalized recommendations from Gemini
   */
  async getGeminiRecommendation(): Promise<AIRecommendation> {
    try {
      const stats = dbService.getStatistics();
      const activeSubjectName = dbService.getActiveSubjectName();
      const response = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: await apiHeaders(),
        body: JSON.stringify({ stats, subjectName: activeSubjectName }),
      });
      if (!response.ok) {
        throw new Error("API request failed");
      }
      return await response.json();
    } catch (error) {
      console.warn("Gemini recommendation unavailable, using local diagnostic heuristics:", error);
      return this.generateLocalRecommendation();
    }
  },

  /**
   * Asks AI Tutor a question with server API fallback
   */
  async askTutorQuestion(message: string): Promise<string> {
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: await apiHeaders(),
        body: JSON.stringify({
          message,
          // Gửi kèm mã môn để máy chủ khỏi phải đoán từ tên môn, vốn đoán sai với mọi môn tự tạo.
          subjectId: dbService.getActiveSubjectId(),
          subjectName: dbService.getActiveSubjectName(),
        }),
      });
      if (!response.ok) throw new Error("API request failed");
      const data = await response.json();
      return data.reply || data.response || "Tôi đã ghi nhận câu hỏi của bạn.";
    } catch (error) {
      console.warn("Gemini chat unavailable, fallback:", error);
      return "Xin chào! Tôi là Trợ lý AI Khảo thí. Hiện tại đang ở chế độ offline, nhưng tôi vẫn có thể hỗ trợ bạn chọn đề thi, ôn luyện khái niệm và phân tích tiến độ học tập.";
    }
  },

  /**
   * Sinh ngân hàng câu hỏi từ tài liệu (Gemini 3.6 Flash): tự chia nhỏ nội dung dài thành
   * nhiều đoạn, gọi AI nhiều lượt (mỗi lượt tối đa 8 câu, chạy tuần tự tránh nghẽn), khử
   * trùng lặp, **cân bằng độ dài phương án**, rồi lưu vào ngân hàng của môn đang chọn.
   * onProgress(batchDone, totalBatches, accumulated, giaiDoan) để cập nhật tiến trình.
   */
  async generateQuestionBankFromText(
    text: string,
    targetTotal: number,
    sourceTitle?: string,
    onProgress?: (batchDone: number, totalBatches: number, accumulated: number, giaiDoan?: GiaiDoanSinhCauHoi) => void,
    targetChapterId?: number
  ): Promise<{ added: number; requested: number; batches: number; duplicatesSkipped: number; failedBatches: number; lechDoDaiDaSua: number; lechDoDaiBiLoai: number }> {
    const subjectId = dbService.getActiveSubjectId();
    const target = Math.min(Math.max(Math.floor(targetTotal) || 5, 2), 60);
    const perBatchMax = 8;

    const chunks = splitIntoChunks(text);

    // Phân bổ số câu cho từng đoạn (một lượt gọi/đoạn), dừng khi đủ mục tiêu.
    const plan: { chunk: string; count: number }[] = [];
    let remaining = target;
    for (let i = 0; i < chunks.length && remaining > 0; i++) {
      const chunksLeft = chunks.length - i;
      const share = Math.min(perBatchMax, Math.max(2, Math.ceil(remaining / chunksLeft)));
      const count = Math.min(share, remaining);
      plan.push({ chunk: chunks[i], count });
      remaining -= count;
    }
    const totalBatches = plan.length;

    // Khử trùng lặp so với câu đã có trong ngân hàng lẫn giữa các lượt.
    const seen = new Set(questions.map(q => normalizeQuestionText(q.question)));
    const source = (sourceTitle && sourceTitle.trim()) || "Tài liệu AI tạo sinh";

    const collected: any[] = [];
    let duplicatesSkipped = 0;
    let failedBatches = 0;
    let lastError: Error | null = null;

    for (let b = 0; b < plan.length; b++) {
      if (onProgress) onProgress(b, totalBatches, collected.length, "soan");
      try {
        const raw = await requestQuestionBatch(plan[b].chunk, plan[b].count, targetChapterId);
        for (const q of raw) {
          const key = normalizeQuestionText(q.question);
          if (!key) continue;
          if (seen.has(key)) { duplicatesSkipped++; continue; }
          seen.add(key);
          collected.push(q);
        }
      } catch (e: any) {
        // Một lượt lỗi không làm hỏng cả mẻ; đếm lại và ghi lỗi để báo cho người dùng.
        failedBatches++;
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }

    if (collected.length === 0) {
      throw lastError || new Error("AI chưa tạo được câu hỏi hợp lệ. Hãy thử lại với nội dung dài và rõ hơn.");
    }

    // ------------------------------------------------- Cân bằng độ dài phương án
    //
    // Chặng này chặn ngay tại cổng nhận, trước khi câu hỏi kịp vào ngân hàng. Lời nhắc ở
    // `functions-src/ai/generate.ts` đã yêu cầu bốn phương án dài tương đương (yêu cầu 15 tới 17),
    // nhưng lời nhắc là lời khuyên chứ không phải ràng buộc: mô hình vẫn trượt. Đây là chốt chặn
    // thật, đo bằng số ký tự.
    //
    // Câu lệch được gửi đi viết lại ĐÚNG MỘT lượt. Lệch tiếp thì LOẠI HẲN chứ không cho vào ngân
    // hàng kèm một lời ghi chú, vì một câu hỏi lộ đáp án qua độ dài không dạy được gì ngoài mẹo
    // làm bài, và mọi tầng đo lường phía sau sẽ ăn phải tín hiệu nhiễm đó.
    const subjectName = dbService.getActiveSubjectName();
    const daCanBang: any[] = [];
    let lechDoDaiDaSua = 0;
    let lechDoDaiBiLoai = 0;
    for (let i = 0; i < collected.length; i++) {
      const q = collected[i];
      if (canBangDoDaiPhuongAn(q)) { daCanBang.push(q); continue; }
      if (onProgress) onProgress(i, collected.length, daCanBang.length, "canbang");
      const sua = await vietLaiPhuongAnNhieu(q, subjectName);
      if (sua && canBangDoDaiPhuongAn(sua)) {
        daCanBang.push(sua);
        lechDoDaiDaSua++;
      } else {
        lechDoDaiBiLoai++;
      }
    }

    if (daCanBang.length === 0) {
      throw new Error(
        `AI có soạn được ${collected.length} câu nhưng câu nào cũng bị lộ đáp án qua độ dài phương án, và lượt viết lại cũng không cứu được. Hãy thử lại với nội dung dài và rõ hơn.`
      );
    }

    if (onProgress) onProgress(collected.length, collected.length, daCanBang.length, "luu");

    // Gán ID mới không trùng rồi lưu một lần. Ép về chương đích nếu người dùng chỉ định.
    const existingIds = questions.map(q => q.id);
    let nextId = (existingIds.length ? Math.max(...existingIds) : 0) + 1;
    const processed: Question[] = daCanBang.map(q => rawToQuestion(q, nextId++, source, targetChapterId));

    dbService.addQuestionsToSubject(subjectId, processed);
    return {
      added: processed.length,
      requested: target,
      batches: totalBatches,
      duplicatesSkipped,
      failedBatches,
      lechDoDaiDaSua,
      lechDoDaiBiLoai,
    };
  },

  /**
   * Generates a practicing exam attempt based on selected modes using Assessment Design Engine
   */
  generateExam(config: {
    type: ExamAttempt["examType"];
    chapterId?: number;
    topicId?: string;
    difficulty?: DifficultyLevel;
    count?: number;
  }): ExamAttempt {
    /** Số câu do HÀNG ĐỢI ôn quyết định, chỉ đặt cho đề loại tới hạn. `null` là giữ số của nơi gọi. */
    let soCauEpTheoHangDoi: number | null = null;

    // 1. Generate 100% deterministic ExamSpecification first via Assessment Design Engine
    const specType = config.type === "ai-smart" ? "mock" : config.type as any;
    const examSpec = assessmentDesignEngine.designExam({
      examType: specType,
      questionCount: config.count || (config.type === "ai-smart" ? 20 : 10),
      chapterId: config.chapterId,
      topicId: config.topicId,
      difficulty: config.difficulty
    });

    let pool = [...questions];

    // LOẠI BỎ CÂU NGƯỜI HỌC ĐÃ BÁO LÀ SAI, trước mọi bước lọc theo loại đề.
    //
    // Đây là thay đổi nhỏ nhất trong cả đợt nhưng tạo khác biệt lớn nhất: trước 13/08/2026 trạng
    // thái `REJECTED` lưu được mà KHÔNG nơi nào đọc, nên đánh dấu một câu là sai đáp án hoàn toàn
    // không ngăn nó xuất hiện lại. Cả tầng duyệt nội dung tồn tại mà không đổi được gì.
    //
    // Đặt ở đây, tức thao tác trên `pool` lấy từ `questionMap` (bản ĐÃ TRỘN phương án, bất biến
    // 4.1), không đụng mảng gốc.
    const maCauBiLoai = new Set(contentQualityAssurance.layMaCauBiLoai());
    if (maCauBiLoai.size > 0) {
      pool = pool.filter(q => !maCauBiLoai.has(q.id));
    }

    // Filter candidate pool according to config
    if (config.type === "chapter" && config.chapterId) {
      pool = pool.filter(q => q.chapterId === config.chapterId);
    } else if (config.type === "topic" && config.topicId) {
      pool = pool.filter(q => q.topicId === config.topicId);
    } else if (config.type === "difficulty" && config.difficulty) {
      pool = pool.filter(q => q.difficulty === config.difficulty);
    } else if (config.type === "incorrect") {
      const stats = dbService.getStatistics();
      const incorrectIds = Object.keys(stats.incorrectQuestionHistory).map(id => parseInt(id));
      pool = pool.filter(q => incorrectIds.includes(q.id));
    } else if (config.type === "bookmark") {
      const stats = dbService.getStatistics();
      pool = pool.filter(q => stats.bookmarks.includes(q.id));
    } else if (config.type === "due") {
      // ĐỀ TỚI HẠN ÔN: chỉ lấy câu thuộc các khái niệm đang nằm trong hàng đợi ôn hôm nay, và giữ
      // ĐÚNG THỨ TỰ ƯU TIÊN của hàng đợi ấy.
      //
      // Thứ tự là phần dễ đánh mất nhất. Hàng đợi đã xếp theo lợi ích cho ngày thi, nên nếu ở đây
      // chỉ lọc rồi để `pool` giữ thứ tự cũ thì công sức xếp lịch bay sạch: người học vẫn gặp câu
      // của khái niệm ít lợi ích nhất trước tiên khi đề bị cắt ngắn.
      //
      // Bất biến 4.5: tra khái niệm qua `kbService`, không dùng `question.concept` (nhãn ấy khớp
      // bộ tra chính thống ở 0/292 câu).
      const hangDoi = learnerModelService.layKhaiNiemToiHan();
      const thuHang = new Map<string, number>();
      hangDoi.danhSach.forEach((m, i) => thuHang.set(m.tenKhaiNiem, i));

      const chamTheoHangDoi = (q: any): number | null => {
        const ds = kbService.resolveConceptsForQuestion(dbService.getActiveSubjectId(), q, 3);
        let tot: number | null = null;
        for (const r of ds) {
          const hang = thuHang.get(r.node.concept);
          if (hang !== undefined && (tot === null || hang < tot)) tot = hang;
        }
        return tot;
      };

      // Nhóm bị hoãn xếp SAU nhóm chính, nhưng vẫn được vào đề. Chúng thật sự đã tới hạn ôn, chỉ
      // là ôn hôm nay ít lợi cho ngày thi; khi người học xin nhiều câu hơn số hàng đợi chính có
      // thì lấy chúng vẫn đúng hơn hẳn việc lấy bừa câu của khái niệm chưa tới hạn.
      const soTrongDanhSachChinh = hangDoi.danhSach.length;
      hangDoi.hoanLai.forEach((m, i) => {
        if (!thuHang.has(m.tenKhaiNiem)) thuHang.set(m.tenKhaiNiem, soTrongDanhSachChinh + i);
      });

      const coHang = pool
        .map(q => ({ q, hang: chamTheoHangDoi(q) }))
        .filter((x): x is { q: any; hang: number } => x.hang !== null);
      coHang.sort((a, b) => (a.hang - b.hang) || (a.q.id - b.q.id));

      pool = coHang.map(x => x.q);

      /*
        SỐ CÂU PHẢI KHỚP LỜI HỨA CỦA HÀNG ĐỢI.

        Nút trên Bàn học ghi "Ôn N khái niệm này", và quỹ thời gian của hàng đợi tính theo
        `SO_CAU_MOI_KHAI_NIEM` câu cho mỗi khái niệm. Nhưng nơi gọi luôn truyền cứng 10 câu, nên
        một hàng đợi 6 khái niệm chỉ được 10 câu, phủ chưa tới hai phần ba số khái niệm đã hứa.
        Hàng đợi là nguồn duy nhất quyết định "hôm nay bao nhiêu việc", nên số câu suy từ nó.
      */
      const soCauTheoHangDoi = hangDoi.danhSach.length * SO_CAU_MOI_KHAI_NIEM;
      if (soCauTheoHangDoi > 0) soCauEpTheoHangDoi = Math.min(soCauTheoHangDoi, pool.length);
    } else if (config.type === "adaptive") {
      // Xếp hạng theo điểm ưu tiên, có nhiễu NHÂN nhẹ để hai đề liên tiếp không giống hệt nhau.
      //
      // Bản cũ viết: sort((a, b) => (b.score + Math.random()*2) - (a.score + Math.random()*2)).
      // Đó là lỗi thuật toán thật sự, không phải chuyện thẩm mỹ:
      //   - Hàm so sánh gọi Math.random NGAY TRONG lúc so, nên so cùng một cặp hai lần có thể
      //     ra hai kết quả trái ngược. Điều này vi phạm hợp đồng của Array.prototype.sort
      //     (phải phản đối xứng và bắc cầu), và với thuật toán sắp xếp thật thì kết quả trở
      //     nên tùy tiện, không tái lập được, thậm chí đánh mất phần lớn tín hiệu điểm số.
      //   - Nhiễu CỘNG biên độ 2,0 còn lớn hơn cả khoảng biến thiên của điểm ưu tiên, nên
      //     thứ hạng gần như do may rủi quyết định chứ không do nhu cầu học.
      // Cách sửa: rút thăm MỘT lần cho mỗi câu, nhân vào điểm ở biên độ +/-15%, rồi mới sắp
      // xếp bằng hàm so sánh thuần túy có mốc phân giải hòa theo id để kết quả luôn xác định.
      const scored = learningEngine.scoreQuestions(pool);
      const jittered = scored.map(s => ({
        s,
        key: s.score * (0.85 + 0.3 * jitter01(s.q.id, adaptiveSeed()))
      }));
      jittered.sort((a, b) => (b.key - a.key) || (a.s.q.id - b.s.q.id));
      pool = jittered.map(j => j.s.q);
    }

    // Chống lặp câu cũ + ôn tập thông minh.
    if (config.type === "random") {
      // Đề ngẫu nhiên tổng hợp = ôn tập để NHỚ LÂU: ưu tiên theo khoa học ghi nhớ (giãn cách + xen kẽ):
      //   1) câu TỪNG SAI (nợ kiến thức, cần gặp lại để củng cố)
      //   2) câu CHƯA TỪNG LÀM (mở rộng độ phủ)
      //   3) câu ĐÃ ĐÚNG (ôn lại giãn cách để khỏi quên)
      // Trong mỗi nhóm, câu chưa ra gần đây đứng trước; câu vừa ra dồn xuống cuối để tránh lặp ngay.
      const stats = dbService.getStatistics();
      const wrong = new Set<number>(Object.keys(stats.incorrectQuestionHistory || {}).map(id => parseInt(id)));
      const answered = new Set<number>();
      dbService.getHistory().forEach(h => {
        if (h && h.answers) Object.keys(h.answers).forEach(id => answered.add(parseInt(id)));
      });
      const recent = new Set<number>(workspaceService.getRecentlyServedQuestionIds());
      const notRecent = (q: Question) => !recent.has(q.id);
      const wrongB = shuffleInPlace(pool.filter(q => wrong.has(q.id) && notRecent(q)));
      const freshB = shuffleInPlace(pool.filter(q => !answered.has(q.id) && !wrong.has(q.id) && notRecent(q)));
      const correctB = shuffleInPlace(pool.filter(q => answered.has(q.id) && !wrong.has(q.id) && notRecent(q)));
      const recentB = shuffleInPlace(pool.filter(q => recent.has(q.id)));
      pool = [...wrongB, ...freshB, ...correctB, ...recentB];
    } else if (config.type !== "adaptive") {
      // Các loại đề còn lại (đã tự sắp theo điểm với "adaptive"): xếp ưu tiên theo 2 tiêu chí:
      // (1) chưa từng làm hơn đã làm, (2) chưa ra gần đây hơn vừa ra.
      const answered = new Set<number>();
      dbService.getHistory().forEach(h => {
        if (h && h.answers) Object.keys(h.answers).forEach(id => answered.add(parseInt(id)));
      });
      const recent = new Set<number>(workspaceService.getRecentlyServedQuestionIds());
      const freshNew = shuffleInPlace(pool.filter(q => !answered.has(q.id) && !recent.has(q.id)));
      const seenNew = shuffleInPlace(pool.filter(q => answered.has(q.id) && !recent.has(q.id)));
      const freshRecent = shuffleInPlace(pool.filter(q => !answered.has(q.id) && recent.has(q.id)));
      const seenRecent = shuffleInPlace(pool.filter(q => answered.has(q.id) && recent.has(q.id)));
      pool = [...freshNew, ...seenNew, ...freshRecent, ...seenRecent];
    }

    // Với các loại đề có ràng buộc (chương, chủ đề, mức độ, câu sai, câu đánh dấu),
    // KHÔNG được lấy bù từ toàn bộ ngân hàng câu hỏi khi lọc ra rỗng, nếu không
    // "đề theo Chương X" sẽ bị trộn câu của chương khác mà vẫn dán nhãn Chương X.
    // "due" PHẢI nằm trong danh sách này. Thiếu nó thì hàng đợi rỗng sẽ khiến `pool` được lấy bù
    // bằng TOÀN BỘ ngân hàng, và đề dán nhãn "ôn khái niệm tới hạn" lại toàn câu của khái niệm
    // chưa tới hạn. Phép kiểm AL6 bắt được đúng ca ấy: 10 trên 10 câu lạc đề.
    const constrainedTypes = ["chapter", "topic", "difficulty", "incorrect", "bookmark", "due"];
    if (pool.length === 0 && !constrainedTypes.includes(config.type as string)) {
      pool = [...questions];
    }

    // 2. Fulfill ExamSpecification question by question
    let selectedQuestions: Question[] = [];
    const usedIds = new Set<number>();

    examSpec.questionSpecs.forEach(qSpec => {
      // Try best match: chapter & difficulty & concept
      let match = pool.find(q => !usedIds.has(q.id) && q.chapterId === qSpec.chapterId && q.knowledgeMapping?.includes(qSpec.concept));
      if (!match) {
        match = pool.find(q => !usedIds.has(q.id) && q.chapterId === qSpec.chapterId);
      }
      if (!match) {
        match = pool.find(q => !usedIds.has(q.id));
      }

      if (match) {
        usedIds.add(match.id);
        selectedQuestions.push(match);
      }
    });

    // Fallback if less than target count.
    //
    // Đề tới hạn ôn lấy số câu từ HÀNG ĐỢI chứ không từ nơi gọi: nút trên Bàn học ghi "Ôn N khái
    // niệm này" và quỹ thời gian tính theo `SO_CAU_MOI_KHAI_NIEM` câu mỗi khái niệm, nên số câu
    // phải khớp lời hứa ấy. Nơi gọi truyền cứng 10 cho mọi loại đề.
    const targetCount = soCauEpTheoHangDoi ?? (config.count || examSpec.questionCount);
    while (selectedQuestions.length < targetCount && selectedQuestions.length < pool.length) {
      const remaining = pool.find(q => !usedIds.has(q.id));
      if (!remaining) break;
      usedIds.add(remaining.id);
      selectedQuestions.push(remaining);
    }

    /*
      XEN KẼ CÁC KHÁI NIỆM cho đề tới hạn ôn. Đây là thay đổi về học thuật, không phải trình bày.

      ĐẶT Ở ĐÂY chứ không đặt lúc sắp `pool`: sau khi sắp `pool` còn một vòng chọn theo bản thiết
      kế đề và một vòng bù cho đủ số câu, cả hai đều xếp lại thứ tự. Đo được ngày 30/08/2026: xen kẽ
      ở `pool` xong thì đề cuối cùng vẫn còn 7 cặp câu liền nhau cùng khái niệm. Thứ tự chỉ chốt
      được ở bước cuối.

      VÌ SAO PHẢI XEN KẼ. Bản trước gom ba câu liền của một khái niệm rồi mới sang khái niệm sau.
      Cách ấy hại theo HAI đường cùng lúc:

      1. Luyện kém hơn. Xen kẽ là một trong những kết quả vững nhất của ngành nghiên cứu học tập:
         trộn các dạng bài làm điểm TRONG buổi học tệ đi nhưng giữ được lâu hơn và chuyển giao tốt
         hơn hẳn so với gom cụm. Với người ôn thi thì đó đúng là đánh đổi cần lấy.

      2. Làm nhiễu chính SỐ ĐO. Câu thứ hai và thứ ba của cùng một khái niệm dễ hơn hẳn vì khái
         niệm vẫn còn trong trí nhớ làm việc, chưa cần nhớ lại thật. Mà đúng sai của chúng chảy
         thẳng vào đường cong quên qua `addOnSubmit`. Gom cụm tức là tự bơm bằng chứng lạc quan vào
         bộ xếp lịch của chính mình.

      Chia vòng: mỗi vòng lấy MỘT câu của từng khái niệm, giữ nguyên thứ tự ưu tiên đã xếp. Tất
      định (bất biến 4.7): thứ tự trong một khái niệm giữ nguyên thứ tự đã chọn.
    */
    if (config.type === "due" && selectedQuestions.length > 1) {
      const theoKhaiNiem = new Map<string, any[]>();
      selectedQuestions.forEach(q => {
        const nut = kbService.getConceptForQuestion(dbService.getActiveSubjectId(), q);
        const ten = nut ? nut.concept : `khong-tra-duoc-${q.id}`;
        if (!theoKhaiNiem.has(ten)) theoKhaiNiem.set(ten, []);
        theoKhaiNiem.get(ten)!.push(q);
      });
      if (theoKhaiNiem.size > 1) {
        /*
          Xếp theo lối "nhóm còn nhiều nhất đi trước, và không lặp lại nhóm vừa dùng".

          Chia vòng đều thì chỉ đúng khi các nhóm BẰNG NHAU. Đo được ngày 30/08/2026: cơ chế chống
          lặp câu cũ (`recordServedQuestionIds`) làm số câu mỗi khái niệm lệch nhau, và chia vòng
          đều để lại 4 cặp trùng ở đuôi, vì các vòng cuối chỉ còn đúng một nhóm.

          Cách này luôn cho 0 cặp trùng khi nhóm lớn nhất không quá nửa tổng số câu, và khi vượt
          quá nửa thì nó đạt mức trùng ÍT NHẤT có thể về mặt toán học. Tất định (bất biến 4.7):
          hoà số lượng thì so tên khái niệm.
        */
        const conLai = [...theoKhaiNiem.entries()]
          .map(([ten, ds]) => ({ ten, ds: [...ds] }));
        const xenKe: any[] = [];
        let tenVuaDung = "";
        while (xenKe.length < selectedQuestions.length) {
          const ungVien = conLai
            .filter(n => n.ds.length > 0)
            .sort((a, b) => (b.ds.length - a.ds.length) || a.ten.localeCompare(b.ten, "vi"));
          if (ungVien.length === 0) break;
          // Ưu tiên nhóm khác nhóm vừa dùng; hết cách thì đành lấy lại, và đó là ca bắt buộc.
          const chon = ungVien.find(n => n.ten !== tenVuaDung) ?? ungVien[0];
          xenKe.push(chon.ds.shift());
          tenVuaDung = chon.ten;
        }
        selectedQuestions = xenKe;
      }
    }

    // 3. Review assembled exam via Exam Review Engine
    const reviewResult = examReviewEngine.reviewExam(examSpec, selectedQuestions);

    // Ghi nhận các câu vừa ra để lượt sau tránh lặp lại ngay (chống lặp câu cũ).
    workspaceService.recordServedQuestionIds(selectedQuestions.map(q => q.id));

    return {
      id: `exam-${config.type}-${TimeService.nowTimestamp()}`,
      examType: config.type,
      chapterId: config.chapterId,
      topicId: config.topicId,
      difficulty: config.difficulty,
      startTime: TimeService.now().toISOString(),
      questions: selectedQuestions.map(q => q.id),
      answers: {},
      bookmarks: [],
      flags: [],
      isSubmitted: false,
      score: 0,
      timeSpent: 0,
      examSpecification: examSpec,
      examReviewResult: reviewResult
    };
  }
};
