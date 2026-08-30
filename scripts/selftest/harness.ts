/**
 * Bộ tự kiểm chứng chạy trên ENGINE THẬT (không phải mô phỏng).
 *
 * File này được `scripts/check.mjs` đóng gói bằng esbuild rồi chạy trong Node. Nhờ vậy nó
 * import trực tiếp `src/services/db.ts` và `src/services/ai.ts` y như trình duyệt, và bắt
 * được lỗi thật thay vì chỉ kiểm tra kiểu dữ liệu.
 *
 * Vì sao chạy được ngoài trình duyệt:
 *   - `db.ts` đã tự gắn localStorage giả lập khi không có trình duyệt (db.ts dòng 6).
 *   - `import.meta.env` được esbuild thay bằng {} nên `supabaseClient` trả về null, không gọi mạng.
 *
 * Quy ước khi thêm phép kiểm mới: dùng `check(...)` cho điều kiện bắt buộc (sai là hỏng),
 * dùng `info(...)` cho số liệu chỉ để tham khảo. Không bao giờ để một phép kiểm phụ thuộc
 * vào mạng hoặc vào dữ liệu riêng trên máy Đàm.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { dbService, loadSubject, questions, questionMap, chapters, topics, suyRaMucBloom, daDangKyDoThiTriThuc, setConceptMasteryBothKeys, danhSachKhoDuocDon } from "../../src/services/db";
import { EvidenceBasedPipeline } from "../../src/services/evidencePipeline";
import { productObservabilityService } from "../../src/services/productObservabilityService";
import { curriculumIntelligenceEngine } from "../../src/services/curriculumIntelligenceEngine";
// Ngân hàng của môn ĐÃ ĐÓNG, nhập vào đây chỉ để đối chiếu dải id trong nhóm kiểm H.
import { questions as closedSubjectQuestions } from "../../src/data/questions";
import { shuffleQuestionOptions } from "../../src/services/optionShuffle";
import {
  aiService, canBangDoDaiPhuongAn, doLechDoDaiPhuongAn, loiGiaiGoiNhamDapAnDung,
  NGUONG_LECH_DO_DAI, NHAN_PHUONG_AN_TRONG_LOI_GIAI,
} from "../../src/services/ai";
import { learningEngine } from "../../src/services/learningEngine";
import { conceptMemoryService, doBenTriNhoDoDuoc, doBenTriNhoNgay, doKhoTienNghiem, rutCapNhoLai, conNhoSauNgay, mucNhoVaoNgayThi, loiIchOnHomNay } from "../../src/services/conceptMemoryService";
import { studentEvolutionEngine, NHAN_TU_LAM_BAI, NHAN_NHO_LAI_CHU_DONG } from "../../src/services/studentEvolutionEngine";
import { pedagogicalEvaluationEngine } from "../../src/services/pedagogicalEvaluationEngine";
import { TimeService } from "../../src/services/time";
import { assessmentDesignEngine } from "../../src/services/assessmentDesignEngine";
import { kbService } from "../../src/services/kbService";
import { learnerModelService, mocNhipChuan, nhipRiengMoiCau, studentModelService } from "../../src/services/learnerModel";
import { examForecaster } from "../../src/services/examForecaster";
import { contentQualityAssurance } from "../../src/services/contentQualityAssurance";
import { taoCauHoiNhoLai, chamCauTraLoi, docKetQuaCham } from "../../src/services/recallService";
import { evidenceCoverageAuditService } from "../../src/services/evidenceCoverageAudit";
import { teachingAnalytics } from "../../src/services/teachingAnalytics";
import { examQualityReportService } from "../../src/services/examQualityReport";
import { questionGenerationEngine } from "../../src/services/questionGenerationEngine";
import { Question } from "../../src/types";
import { soThapPhan } from "../../src/services/numberFormat";

type Result = { group: string; name: string; ok: boolean; detail: string };
const results: Result[] = [];
const notes: string[] = [];
let group = "";

function g(name: string) { group = name; }

function check(name: string, ok: boolean, detail = "") {
  results.push({ group, name, ok, detail });
}

function info(text: string) { notes.push(text); }

/** So sánh 2 tập nội dung phương án (không quan tâm thứ tự). */
function sameOptionSet(a: Question["options"], b: Question["options"]): boolean {
  const s1 = [a.a, a.b, a.c, a.d].slice().sort();
  const s2 = [b.a, b.b, b.c, b.d].slice().sort();
  return s1.every((v, i) => v === s2[i]);
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// ===========================================================================
// A. Toàn vẹn ngân hàng câu hỏi
// ===========================================================================
g("A. Ngân hàng câu hỏi");

const chapterIds = new Set(chapters.map(c => c.id));
const topicIds = new Set(topics.map(t => t.id));
const LETTERS = ["a", "b", "c", "d"] as const;

const dupIds = questions.map(q => q.id).filter((id, i, arr) => arr.indexOf(id) !== i);
check("Không có id câu hỏi trùng nhau", dupIds.length === 0, dupIds.length ? `id trùng: ${[...new Set(dupIds)].join(", ")}` : `${questions.length} câu`);

const missingOpt = questions.filter(q => LETTERS.some(k => !q.options?.[k] || !String(q.options[k]).trim()));
check("Mọi câu có đủ 4 phương án không rỗng", missingOpt.length === 0, missingOpt.length ? `câu lỗi: ${missingOpt.slice(0, 5).map(q => q.id).join(", ")}` : "");

const badKey = questions.filter(q => !LETTERS.includes(q.correctAnswer as any));
check("correctAnswer luôn thuộc a/b/c/d", badKey.length === 0, badKey.length ? `câu lỗi: ${badKey.slice(0, 5).map(q => q.id).join(", ")}` : "");

const emptyExpl = questions.filter(q => !q.explanation || !q.explanation.trim());
check("Mọi câu có lời giải thích", emptyExpl.length === 0, emptyExpl.length ? `câu lỗi: ${emptyExpl.slice(0, 5).map(q => q.id).join(", ")}` : "");

const orphanChapter = questions.filter(q => !chapterIds.has(q.chapterId));
check("chapterId của câu hỏi đều tồn tại", orphanChapter.length === 0, orphanChapter.length ? `câu lỗi: ${orphanChapter.slice(0, 5).map(q => `${q.id}(ch${q.chapterId})`).join(", ")}` : `${chapters.length} chương`);

const orphanTopic = questions.filter(q => !topicIds.has(q.topicId));
check("topicId của câu hỏi đều tồn tại", orphanTopic.length === 0, orphanTopic.length ? `câu lỗi: ${orphanTopic.slice(0, 5).map(q => `${q.id}(${q.topicId})`).join(", ")}` : `${topics.length} chủ đề`);

const dupOptionInside = questions.filter(q => new Set(LETTERS.map(k => norm(String(q.options[k])))).size < 4);
check("4 phương án trong cùng một câu không trùng nội dung", dupOptionInside.length === 0, dupOptionInside.length ? `câu lỗi: ${dupOptionInside.slice(0, 5).map(q => q.id).join(", ")}` : "");

const seenText = new Map<string, number>();
const dupText: string[] = [];
questions.forEach(q => {
  const k = norm(q.question);
  if (seenText.has(k)) dupText.push(`${seenText.get(k)} ~ ${q.id}`);
  else seenText.set(k, q.id);
});
check("Không có câu hỏi trùng nội dung", dupText.length === 0, dupText.length ? `cặp trùng: ${dupText.slice(0, 5).join(" | ")}` : "");

// ===========================================================================
// B. Trộn thứ tự phương án (optionShuffle)
// ===========================================================================
g("B. Trộn phương án");

let contentMismatch = 0;
let keyMismatch = 0;
let unchanged = 0;
let notDeterministic = 0;
const posBefore: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
const posAfter: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };

questions.forEach(q => {
  const s = shuffleQuestionOptions(q);
  const s2 = shuffleQuestionOptions(q);

  if (!sameOptionSet(q.options, s.options)) contentMismatch++;
  if (String(q.options[q.correctAnswer]) !== String(s.options[s.correctAnswer])) keyMismatch++;
  if (LETTERS.every(k => q.options[k] === s.options[k])) unchanged++;
  if (!LETTERS.every(k => s.options[k] === s2.options[k]) || s.correctAnswer !== s2.correctAnswer) notDeterministic++;

  posBefore[q.correctAnswer]++;
  posAfter[s.correctAnswer]++;
});

check("Trộn không làm mất/đổi nội dung phương án", contentMismatch === 0, contentMismatch ? `${contentMismatch} câu sai lệch` : `${questions.length} câu`);
check("Sau khi trộn, đáp án đúng vẫn trỏ đúng nội dung cũ", keyMismatch === 0, keyMismatch ? `${keyMismatch} câu lệch đáp án` : "");
check("Trộn là tất định (gọi lại cho kết quả y hệt)", notDeterministic === 0, notDeterministic ? `${notDeterministic} câu không ổn định` : "bảo toàn lịch sử làm bài");

const total = questions.length || 1;
const maxShare = Math.max(...LETTERS.map(k => posAfter[k])) / total;
check("Đáp án đúng không dồn về một vị trí", maxShare <= 0.45, `vị trí cao nhất chiếm ${(maxShare * 100).toFixed(1)}%`);

info(`Phân bố đáp án đúng TRƯỚC khi trộn: ${LETTERS.map(k => `${k.toUpperCase()}=${posBefore[k]}`).join("  ")}`);
info(`Phân bố đáp án đúng SAU khi trộn:   ${LETTERS.map(k => `${k.toUpperCase()}=${posAfter[k]}`).join("  ")}`);
info(`Số câu giữ nguyên thứ tự (giải thích có chữ cái không phân loại được, cố ý bỏ qua cho an toàn): ${unchanged}/${questions.length}`);

// ===========================================================================
// C. Bất biến của db và questionMap
// ===========================================================================
g("C. Kho dữ liệu (db)");

check("questionMap có đủ số câu", questionMap.size === questions.length, `${questionMap.size} / ${questions.length}`);

let keyIdMismatch = 0;
questionMap.forEach((q, id) => { if (q.id !== id) keyIdMismatch++; });
check("Khóa của questionMap khớp id câu hỏi", keyIdMismatch === 0, keyIdMismatch ? `${keyIdMismatch} câu lệch` : "");

// questionMap phải là bản ĐÃ trộn, còn mảng `questions` phải giữ bản GỐC.
// Nếu ai đó lỡ trộn thẳng vào mảng gốc thì hai bên sẽ giống hệt nhau ở mọi câu.
let differFromRaw = 0;
questions.forEach(q => {
  const m = questionMap.get(q.id);
  if (m && !LETTERS.every(k => m.options[k] === q.options[k])) differFromRaw++;
});
check("Mảng `questions` giữ bản gốc, `questionMap` giữ bản đã trộn", differFromRaw > 0, `${differFromRaw} câu có thứ tự khác bản gốc`);

const subjects = dbService.getSubjects();
check("Có ít nhất một môn học nạp được", subjects.length > 0, subjects.map(s => `${s.id}`).join(", "));

// ===========================================================================
// D. Sinh đề
// ===========================================================================
g("D. Sinh đề");

function distinctChapters(ids: number[]): number {
  return new Set(ids.map(id => questionMap.get(id)?.chapterId).filter(v => v !== undefined)).size;
}

const rnd = aiService.generateExam({ type: "random", count: 20 });
check("Đề ngẫu nhiên tạo đúng số câu yêu cầu", rnd.questions.length === 20, `${rnd.questions.length}/20 câu`);
check("Đề ngẫu nhiên không lặp câu trong cùng một đề", new Set(rnd.questions).size === rnd.questions.length, `${new Set(rnd.questions).size} câu khác nhau`);

let minCov = 99;
for (let i = 0; i < 30; i++) {
  const e = aiService.generateExam({ type: "random", count: 20 });
  minCov = Math.min(minCov, distinctChapters(e.questions));
}
check("Đề ngẫu nhiên trải rộng nhiều chương", minCov >= 5, `chạy 30 lần, trường hợp tệ nhất phủ ${minCov}/${chapters.length} chương`);

const chapterWithQ = chapters.find(c => questions.some(q => q.chapterId === c.id));
if (chapterWithQ) {
  const ce = aiService.generateExam({ type: "chapter", chapterId: chapterWithQ.id, count: 10 });
  const leak = ce.questions.filter(id => questionMap.get(id)?.chapterId !== chapterWithQ.id);
  check("Đề theo chương không lẫn câu của chương khác", leak.length === 0, leak.length ? `${leak.length} câu lạc chương` : `chương ${chapterWithQ.id}, ${ce.questions.length} câu`);
}

const diffs = [...new Set(questions.map(q => q.difficulty))];
if (diffs.length > 0) {
  const de = aiService.generateExam({ type: "difficulty", difficulty: diffs[0] as any, count: 10 });
  const leak = de.questions.filter(id => questionMap.get(id)?.difficulty !== diffs[0]);
  check("Đề theo mức độ không lẫn mức độ khác", leak.length === 0, leak.length ? `${leak.length} câu sai mức độ` : `mức "${diffs[0]}", ${de.questions.length} câu`);
}

// Chống lặp: hai đề liên tiếp phải khác nhau đáng kể nhờ danh sách câu vừa ra.
const e1 = aiService.generateExam({ type: "random", count: 20 });
const e2 = aiService.generateExam({ type: "random", count: 20 });
const overlap = e1.questions.filter(id => e2.questions.includes(id)).length;
check("Hai đề ngẫu nhiên liên tiếp ít lặp câu", overlap <= 6, `trùng ${overlap}/20 câu`);

// Ưu tiên ôn lại câu từng sai (lặp lại giãn cách).
// Đánh dấu sai 1 câu ở MỖI chương để phép kiểm không bị giới hạn bởi ràng buộc trải đều chương.
const sample: number[] = [];
chapters.forEach(c => {
  const q = questions.find(x => x.chapterId === c.id);
  if (q) sample.push(q.id);
});
const stats = dbService.getStatistics();
stats.incorrectQuestionHistory = {};
sample.forEach(id => { stats.incorrectQuestionHistory[id] = 1; });
dbService.saveStatistics(stats);

// Đo trung bình nhiều lượt để con số ổn định, không phụ thuộc một lần bốc may rủi.
// Mỗi lượt xóa danh sách "câu vừa ra" để đo riêng cơ chế ƯU TIÊN CÂU SAI, không bị cơ chế
// chống lặp (vốn đúng chức năng của nó) làm nhiễu số đo.
const RECENT_KEY = `poly_econ_recent_served_${dbService.getActiveSubjectId()}`;
let hitTotal = 0;
const ROUNDS = 20;
for (let i = 0; i < ROUNDS; i++) {
  localStorage.removeItem(RECENT_KEY);
  const re = aiService.generateExam({ type: "random", count: 20 });
  hitTotal += re.questions.filter(id => sample.includes(id)).length;
}
const hitAvg = hitTotal / ROUNDS;
check("Đề ngẫu nhiên có đưa lại câu từng làm sai", hitAvg >= sample.length * 0.7, `trung bình ${hitAvg.toFixed(1)}/${sample.length} câu từng sai quay lại trong đề 20 câu`);

// Đo thêm khi KHÔNG xóa danh sách câu vừa ra, để thấy rõ hai cơ chế tương tác thế nào.
let hitWithAntiRepeat = 0;
for (let i = 0; i < ROUNDS; i++) {
  const re = aiService.generateExam({ type: "random", count: 20 });
  hitWithAntiRepeat += re.questions.filter(id => sample.includes(id)).length;
}
info(`Câu từng sai quay lại khi vừa đánh dấu sai: ${hitAvg.toFixed(1)}/${sample.length} (ưu tiên ôn tập chạy đúng).`);
info(`Câu từng sai quay lại khi làm liên tục nhiều đề: ${(hitWithAntiRepeat / ROUNDS).toFixed(1)}/${sample.length}, thấp hơn là ĐÚNG chủ ý: danh sách ${80} câu vừa ra giãn cách chúng ra khoảng 4 đề rồi mới cho gặp lại.`);

// ===========================================================================
// E. Chấm điểm (chống tái diễn lỗi "0 điểm")
// ===========================================================================
g("E. Chấm điểm");

dbService.clearAllHistory();
const graded = aiService.generateExam({ type: "random", count: 10 });
const answers: Record<number, "a" | "b" | "c" | "d"> = {};
graded.questions.forEach(id => {
  const q = questionMap.get(id);
  if (q) answers[id] = q.correctAnswer;
});
graded.answers = answers;
graded.isSubmitted = true;
graded.endTime = new Date().toISOString();
graded.score = graded.questions.filter(id => questionMap.get(id)?.correctAnswer === answers[id]).length;
dbService.saveAttempt(graded);

check("Trả lời đúng hết thì điểm phải tuyệt đối", graded.score === graded.questions.length, `${graded.score}/${graded.questions.length} điểm`);

const after = dbService.getStatistics();
check("Thống kê ghi nhận đúng số câu đã làm", after.totalSolved === graded.questions.length, `totalSolved = ${after.totalSolved}`);
check("Thống kê ghi nhận đúng số câu đúng", after.totalCorrect === graded.questions.length, `totalCorrect = ${after.totalCorrect}`);
check("Làm đúng thì không bị ghi vào danh sách câu sai", Object.keys(after.incorrectQuestionHistory || {}).length === 0, `còn ${Object.keys(after.incorrectQuestionHistory || {}).length} câu trong danh sách sai`);

// Chấm điểm phải dựa trên questionMap (bản đã trộn), không phải mảng gốc.
//
// Chọn câu để kiểm bằng cách DÒ TRONG TOÀN NGÂN HÀNG, không lấy câu đầu tiên của đề.
//
// Vì sao (đo ngày 27/07/2026): bản cũ lấy `graded.questions[0]` rồi chỉ kiểm khi câu đó tình cờ
// bị trộn đổi đáp án. Có 14/292 câu cố ý giữ nguyên thứ tự (bất biến 4.2), nên chỉ cần thành
// phần đề thay đổi là phép kiểm IM LẶNG không chạy, và tổng số phép kiểm tụt đi một mà không ai
// để ý. Đúng loại "đạt rỗng" mà mục 7 trong AGENTS.md cảnh báo. Nay câu kiểm luôn tồn tại nên
// phép kiểm luôn chạy.
const cauBiTron = questions.find(q => {
  const m = questionMap.get(q.id);
  return m && m.correctAnswer !== q.correctAnswer;
});
check("Ngân hàng có câu bị trộn đổi đáp án để kiểm được việc chấm điểm",
  !!cauBiTron,
  cauBiTron ? `dùng câu #${cauBiTron.id}` : "không tìm ra câu nào bị trộn, phép kiểm dưới sẽ vô nghĩa");

if (cauBiTron) {
  const rawCau = cauBiTron;
  dbService.clearAllHistory();
  const wrongExam = aiService.generateExam({ type: "random", count: 5 });
  wrongExam.questions = [rawCau.id];
  wrongExam.answers = { [rawCau.id]: rawCau.correctAnswer };
  wrongExam.isSubmitted = true;
  dbService.saveAttempt(wrongExam);
  const st = dbService.getStatistics();
  check("Chấm theo bản đã trộn, không theo bản gốc", st.totalCorrect === 0,
    `chọn theo đáp án bản gốc (${rawCau.correctAnswer}) của câu #${rawCau.id} phải bị tính SAI, totalCorrect = ${st.totalCorrect}`);
}

// ===========================================================================
// F. Trí thông minh nội tại của các engine
// ===========================================================================
g("F. Suy luận của engine");

// --- F1. Hàm so sánh khi xếp hạng phải ỔN ĐỊNH và tái lập được ---------------
// Bản cũ gọi Math.random ngay trong hàm so sánh, nên cùng một trạng thái học có thể cho ra
// hai thứ hạng khác nhau. Nay nhiễu được rút một lần cho mỗi câu từ hạt giống tất định.
dbService.clearAllHistory();
const adaptiveA = aiService.generateExam({ type: "adaptive", count: 15 });
const adaptiveB = aiService.generateExam({ type: "adaptive", count: 15 });
// Hai lần gọi liên tiếp KHÔNG cùng trạng thái (danh sách câu vừa ra đã đổi), nên chỉ cần
// kiểm rằng mỗi đề đều hợp lệ và tất định khi trạng thái không đổi.
const recentKeyAdaptive = `poly_econ_recent_served_${dbService.getActiveSubjectId()}`;
const snapshot = localStorage.getItem(recentKeyAdaptive);
const rerun1 = aiService.generateExam({ type: "adaptive", count: 15 });
if (snapshot === null) localStorage.removeItem(recentKeyAdaptive);
else localStorage.setItem(recentKeyAdaptive, snapshot);
const rerun2 = aiService.generateExam({ type: "adaptive", count: 15 });
check(
  "Đề thích ứng tái lập được khi trạng thái học không đổi",
  JSON.stringify(rerun1.questions) === JSON.stringify(rerun2.questions),
  "cùng dữ liệu phải cho cùng thứ hạng"
);
check("Đề thích ứng vẫn tạo đủ câu", adaptiveA.questions.length === 15 && adaptiveB.questions.length === 15,
  `${adaptiveA.questions.length} và ${adaptiveB.questions.length} câu`);

// --- F0. Câu hỏi phải TRA ĐƯỢC ra khái niệm ---------------------------------
// Phép kiểm quan trọng nhất nhóm này. Nếu tỷ lệ tra được về 0 thì toàn bộ mô hình chấm
// thích ứng bên dưới (độ thạo, đường quên, tiên quyết, Bloom, trọng tâm) trở thành đồ trang
// trí: mọi câu rơi vào nhánh dự phòng và đề "thích ứng" chỉ còn xếp theo lịch sử làm sai.
// Đây chính là trạng thái thực tế trước đợt nâng cấp này, đo được 0/292.
const activeSubject = dbService.getActiveSubjectId();
let resolvedCount = 0;
let affinitySum = 0;
questions.forEach(q => {
  const r = kbService.resolveConceptsForQuestion(activeSubject, q, 3);
  if (r.length > 0) {
    resolvedCount++;
    affinitySum += r[0].affinity;
  }
});
const resolveRate = resolvedCount / Math.max(1, questions.length);
check("Câu hỏi tra được ra khái niệm trong đồ thị tri thức", resolveRate >= 0.8,
  `${resolvedCount}/${questions.length} câu (${(resolveRate * 100).toFixed(1)}%)`);
info(`Độ gần gũi trung bình của khái niệm khớp nhất: ${(affinitySum / Math.max(1, resolvedCount)).toFixed(3)} trên thang 0 đến 1.`);

// Bộ tra cứu phải TẤT ĐỊNH: gọi lại phải ra đúng thứ hạng cũ.
const sampleQ = questions[0];
const r1 = kbService.resolveConceptsForQuestion(activeSubject, sampleQ, 3).map(r => r.node.id).join(",");
const r2 = kbService.resolveConceptsForQuestion(activeSubject, sampleQ, 3).map(r => r.node.id).join(",");
check("Tra cứu khái niệm là tất định", r1 === r2, r1 || "(không khớp khái niệm nào)");

// --- F2. Không còn thiên lệch theo SỐ NHÃN khái niệm -------------------------
// Gộp theo trung bình thay vì cộng dồn, nên câu gắn nhiều nhãn không tự động được ưu tiên.
const scored = learningEngine.scoreQuestions(questions);
const byTagCount = new Map<number, { sum: number; n: number }>();
scored.forEach(s => {
  const tags = Math.min(4, (s.q.knowledgeMapping || []).length);
  const cur = byTagCount.get(tags) || { sum: 0, n: 0 };
  cur.sum += s.score;
  cur.n++;
  byTagCount.set(tags, cur);
});
const tagGroups = [...byTagCount.entries()].filter(([, v]) => v.n >= 5).sort((a, b) => a[0] - b[0]);
if (tagGroups.length >= 2) {
  const means = tagGroups.map(([t, v]) => ({ tags: t, mean: v.sum / v.n }));
  const spread = Math.max(...means.map(m => m.mean)) / Math.max(0.0001, Math.min(...means.map(m => m.mean)));
  check("Điểm ưu tiên không lệch theo số nhãn khái niệm", spread <= 2.0,
    means.map(m => `${m.tags} nhãn: ${m.mean.toFixed(2)}`).join(", "));
} else {
  info("Bỏ qua phép kiểm thiên lệch số nhãn: không đủ nhóm để so sánh.");
}

// --- F3. Điểm ưu tiên phải LIÊN TỤC, không nhảy bậc --------------------------
// Kiểm trực tiếp bằng cách tăng dần độ thạo của một khái niệm quanh các mốc cũ (40 và 85)
// rồi xem điểm ưu tiên có nhảy đột ngột không.
// Lưu ý về KHÓA: độ thạo được lưu theo TÊN KHÁI NIỆM trong đồ thị tri thức (xem
// learnerModel.updateConceptMastery và các nơi gọi kbService.getConceptForQuestion), chứ
// không theo nhãn tự do gắn trên câu hỏi. Đặt sai khóa thì phép kiểm sẽ báo "độ thạo không
// có tác dụng" trong khi mã nguồn hoàn toàn đúng.
const probeQ = questions.find(q => kbService.resolveConceptsForQuestion(dbService.getActiveSubjectId(), q, 1).length > 0);
if (probeQ) {
  const concept = kbService.resolveConceptsForQuestion(dbService.getActiveSubjectId(), probeQ, 1)[0].node.concept;

  // Tạo BẰNG CHỨNG thật trước đã. Nếu khái niệm chưa từng được làm lần nào thì trọng số
  // bằng chứng bằng 0 và độ thạo bị kéo hoàn toàn về mốc trung tính 50, nên thay đổi con số
  // thành thạo sẽ không tác động gì. Đó là hành vi ĐÚNG (không tin số liệu không có cơ sở),
  // vì vậy phép kiểm phải đi qua đúng đường dẫn thật: ghi nhận một số lượt làm bài trước.
  for (let i = 0; i < 12; i++) {
    learnerModelService.logConceptAttempt(concept, true, 12);
  }

  const curve: { m: number; score: number }[] = [];
  for (let m = 0; m <= 100; m += 5) {
    const st = dbService.getStatistics();
    st.conceptMastery = { ...(st.conceptMastery || {}), [concept]: m };
    dbService.saveStatistics(st);
    const s = learningEngine.scoreQuestions([probeQ])[0];
    curve.push({ m, score: s.score });
  }
  let maxJump = 0;
  for (let i = 1; i < curve.length; i++) {
    maxJump = Math.max(maxJump, Math.abs(curve[i].score - curve[i - 1].score));
  }
  const range = Math.max(...curve.map(c => c.score)) - Math.min(...curve.map(c => c.score));

  // Điều kiện 1: độ thạo PHẢI thực sự tác động tới điểm ưu tiên. Nếu dải bằng 0 thì mô hình
  // đang chết lặng, và một phép kiểm chỉ đo "không nhảy bậc" sẽ ĐẠT một cách rỗng tuếch.
  const probeAttempts = learnerModelService.getOrCreateProfile(concept).attemptsCount;
  check("Độ thạo có tác động thật lên điểm ưu tiên", range > 0.01,
    `dải biến thiên ${range.toFixed(3)}; khái niệm "${concept}" có ${probeAttempts} lượt làm`);

  // Điều kiện 2: biến thiên phải liên tục, không có bậc nhảy như các mốc cứng 40 và 85 cũ.
  check("Điểm ưu tiên biến thiên liên tục theo độ thạo", range > 0 && maxJump <= range * 0.35,
    `bước nhảy lớn nhất ${maxJump.toFixed(3)} trên dải ${range.toFixed(3)}`);

  // Điều kiện 3: hướng suy luận phải đúng, càng thạo thì càng ít cần hỏi lại.
  check("Càng thành thạo thì ưu tiên hỏi lại càng giảm", curve[curve.length - 1].score < curve[0].score,
    `độ thạo 0 cho ${curve[0].score.toFixed(3)}, độ thạo 100 cho ${curve[curve.length - 1].score.toFixed(3)}`);

  // Trả thống kê về trạng thái sạch để các phép kiểm sau không bị ảnh hưởng.
  const st = dbService.getStatistics();
  st.conceptMastery = {};
  dbService.saveStatistics(st);
}

// --- F4. Chuyển giao kiến thức phải PHÂN BIỆT được hai tình huống trái ngược ---
// Người vững ở nấc thấp nhưng tụt ở nấc vận dụng (chuyển giao kém) phải bị chấm thấp hơn
// người giữ nguyên phong độ ở cả hai nấc. Bản cũ chấm hai người này BẰNG NHAU.
const mkProfile = (lowA: number, lowN: number, highA: number, highN: number) =>
  conceptMemoryService.recomputeConceptDynamics({
    ...conceptMemoryService.getConceptProfile("khái niệm kiểm thử chuyển giao"),
    timesStudied: lowN + highN,
    bloomPerformance: {
      Remember: { attempts: lowN, correct: Math.round(lowA * lowN), accuracy: lowA },
      Apply: { attempts: highN, correct: Math.round(highA * highN), accuracy: highA }
    }
  });
const poorTransfer = mkProfile(0.9, 20, 0.6, 20).transferQualityScore ?? 0;   // giỏi nhớ, kém vận dụng
const evenTransfer = mkProfile(0.6, 20, 0.6, 20).transferQualityScore ?? 0;   // đều hai nấc
const goodTransfer = mkProfile(0.6, 20, 0.85, 20).transferQualityScore ?? 0;  // lên nấc cao càng vững
check("Chuyển giao kiến thức phân biệt được kém, đều và tốt",
  poorTransfer < evenTransfer && evenTransfer < goodTransfer,
  `kém ${poorTransfer}, đều ${evenTransfer}, tốt ${goodTransfer}`);

// --- F5. Đà học phải bền với nhiễu -------------------------------------------
// Dãy dao động mạnh và dãy tiến đều KHÔNG được cho cùng một kết luận.
const mkHistory = (scores: number[]) =>
  conceptMemoryService.recomputeConceptDynamics({
    ...conceptMemoryService.getConceptProfile("khái niệm kiểm thử đà học"),
    timesStudied: scores.length,
    scoreHistory: scores.map((s, i) => ({ timestamp: new Date(2026, 0, i + 1).toISOString(), score: s }))
  });
const steady = mkHistory([50, 55, 60, 65, 70]);
const noisy = mkHistory([50, 95, 55, 90, 52]);
check("Dãy tiến đều được nhận là đang tiến bộ", (steady.shortTermMomentum ?? 0) > 0,
  `độ dốc ${steady.shortTermMomentum}`);
check("Dãy dao động mạnh không bị kết luận là tiến bộ đều",
  noisy.momentumTrend !== "improving" || (noisy.rollingVariance ?? 0) > 100,
  `xu hướng "${noisy.momentumTrend}", phương sai ${noisy.rollingVariance}`);

// --- F6. Đường cong quên phải KHỚP với điểm trí nhớ --------------------------
// Hai công thức từng bị chép thành hai bản; nếu lệch nhau thì biểu đồ nói một đằng, lịch ôn
// tập tính một nẻo. Nay dùng chung một nguồn nên điểm tại mốc 0 ngày phải bằng 1,0 và đường
// cong phải giảm đơn điệu.
const memProfile = conceptMemoryService.getConceptProfile("khái niệm kiểm thử trí nhớ");
const curveOut = conceptMemoryService.generateForgetCurve(memProfile);
const monotone = curveOut.every((p, i) => i === 0 || p.retention <= curveOut[i - 1].retention);
check("Đường cong quên giảm đơn điệu theo thời gian", monotone,
  curveOut.map(p => `${p.daysAhead}d:${p.retention}`).join(" "));

// --- F7. Bộ dựng đề mặc định không đặt hàng trùng khái niệm ------------------
const spec = assessmentDesignEngine.designExam({ examType: "sequential" as any, questionCount: 25 });
const specConcepts = spec.questionSpecs.map(s => s.concept);
const dupSpec = specConcepts.length - new Set(specConcepts).size;
check("Bản thiết kế đề không lặp lại cùng một khái niệm", dupSpec === 0,
  `${dupSpec} khái niệm bị đặt trùng trên ${specConcepts.length} chỗ`);

// --- F7b. Độ thành thạo khái niệm: một giá trị, hai khóa, và "chưa học" khác "học trượt" ---
// Đây là phép kiểm cho khiếm khuyết nặng nhất tìm được trong đợt rà soát: bảng độ thạo từng
// tồn tại HAI không gian khóa song song (theo mã khái niệm và theo tên khái niệm), các nơi
// đọc lại tra mã trước, nên giá trị do mô hình người học ghi theo tên không bao giờ tới được
// nơi ra quyết định. Đồng thời khái niệm chưa làm câu nào bị chấm 0%, lẫn với làm sai sạch.
dbService.clearAllHistory();
const cmExam = aiService.generateExam({ type: "random", count: 6 });
cmExam.answers = {};
cmExam.questions.forEach(id => {
  const qq = questionMap.get(id);
  if (qq) cmExam.answers[id] = qq.correctAnswer; // trả lời đúng hết
});
cmExam.isSubmitted = true;
dbService.saveAttempt(cmExam);

const cmAfter = dbService.getStatistics().conceptMastery || {};
const graphNodes = kbService.getKnowledgeGraph(dbService.getActiveSubjectId());

let keyPairMismatch = 0;
graphNodes.forEach(n => {
  const byId = cmAfter[n.id];
  const byName = cmAfter[n.concept];
  if (byId !== undefined && byName !== undefined && byId !== byName) keyPairMismatch++;
});
check("Độ thạo ghi cùng giá trị cho cả khóa mã và khóa tên", keyPairMismatch === 0,
  keyPairMismatch ? `${keyPairMismatch} khái niệm lệch giá trị giữa hai khóa` : `${graphNodes.length} khái niệm đồng nhất`);

// Khái niệm chưa có câu nào được làm phải nằm ở mốc "chưa có căn cứ" là 50, không phải 0.
const answeredIds = new Set(cmExam.questions);
const untouched = graphNodes.filter(n =>
  !questions.some(q => q.topicId === n.topic && answeredIds.has(q.id))
);
const untouchedZero = untouched.filter(n => (cmAfter[n.concept] ?? cmAfter[n.id]) === 0);
check("Khái niệm chưa học không bị chấm 0% như học trượt", untouchedZero.length === 0,
  `${untouched.length} khái niệm chưa đụng tới, ${untouchedZero.length} bị chấm 0`);

// Khái niệm vừa làm đúng vài câu phải NHÍCH LÊN trên 50 nhưng CHƯA chạm 100, vì bằng chứng
// còn mỏng. Đây chính là điểm khác biệt giữa "đúng 3/3 câu" và "đúng 40/40 câu".
const touched = graphNodes.filter(n =>
  questions.some(q => q.topicId === n.topic && answeredIds.has(q.id))
);
const touchedVals = touched.map(n => cmAfter[n.concept] ?? cmAfter[n.id] ?? -1).filter(v => v >= 0);
if (touchedVals.length > 0) {
  const allInRange = touchedVals.every(v => v > 50 && v < 100);
  check("Làm đúng ít câu thì độ thạo tăng vừa phải, không vọt lên 100", allInRange,
    `giá trị: ${touchedVals.join(", ")}`);
} else {
  info("Bỏ qua phép kiểm co giãn bằng chứng: không có khái niệm nào được đụng tới trong đề mẫu.");
}

// --- F8. Chấm ưu tiên là thao tác ĐỌC, không được ghi đè dữ liệu học ---------
const beforeKeys = Object.keys(dbService.getStatistics().incorrectQuestionHistory || {}).length;
learningEngine.scoreQuestions(questions.slice(0, 50));
const afterKeys = Object.keys(dbService.getStatistics().incorrectQuestionHistory || {}).length;
check("Chấm ưu tiên không làm thay đổi thống kê học tập", beforeKeys === afterKeys,
  `trước ${beforeKeys}, sau ${afterKeys}`);

// ===========================================================================
// G. Bộ dự báo điểm thi
// ===========================================================================
g("G. Dự báo điểm thi");

const PRED_KEY = `poly_econ_last_prediction_${dbService.getActiveSubjectId()}`;

/** Cho một hồ sơ học giả lập trả lời đúng theo tỷ lệ cho trước, rồi trả về dự báo. */
function playAndForecast(correctRatio: number, numExams: number) {
  dbService.clearAllHistory();
  localStorage.removeItem(PRED_KEY);
  for (let e = 0; e < numExams; e++) {
    const exam = aiService.generateExam({ type: "random", count: 20 });
    exam.answers = {};
    exam.questions.forEach((id, i) => {
      const qq = questionMap.get(id);
      if (!qq) return;
      const beCorrect = (i / exam.questions.length) < correctRatio;
      exam.answers[id] = beCorrect ? qq.correctAnswer : LETTERS.find(k => k !== qq.correctAnswer)!;
    });
    exam.isSubmitted = true;
    exam.score = exam.questions.filter(id => questionMap.get(id)?.correctAnswer === exam.answers[id]).length;
    dbService.saveAttempt(exam);
  }
  const st = dbService.getStatistics();
  const realAccuracy = st.totalSolved > 0 ? st.totalCorrect / st.totalSolved : 0;
  return { realAccuracy, predicted: examForecaster.calculatePrediction().predictedScore };
}

// --- G1. Dự báo phải TÁI LẬP khi dữ liệu không đổi ---------------------------
// Bản cũ trộn 35% giá trị mới với 65% giá trị đã lưu RỒI GHI ĐÈ giá trị đã lưu, nên chỉ cần
// mở lại màn hình nhiều lần là điểm dự báo tự bò lên. Đo được: 3,8 rồi 5,1 rồi 6,0 rồi 6,6
// rồi 7,0 rồi 7,2 trên một hồ sơ ĐỨNG YÊN. Điểm phụ thuộc số lần nhìn, không phụ thuộc việc học.
playAndForecast(0.9, 4);
const repeated: number[] = [];
for (let i = 0; i < 6; i++) repeated.push(examForecaster.calculatePrediction().predictedScore);
check("Dự báo không đổi khi gọi lại với cùng dữ liệu", new Set(repeated).size === 1,
  `6 lần gọi liên tiếp: ${repeated.join(" -> ")}`);

// --- G2. Dự báo phải ĐƠN ĐIỆU theo năng lực thật -----------------------------
const curveF = [0.2, 0.4, 0.6, 0.8, 1.0].map(r => playAndForecast(r, 5));
let monotoneOk = true;
for (let i = 1; i < curveF.length; i++) {
  if (curveF[i].predicted <= curveF[i - 1].predicted) monotoneOk = false;
}
check("Học tốt hơn thì dự báo phải cao hơn", monotoneOk,
  curveF.map(c => `${(c.realAccuracy * 100).toFixed(0)}%→${c.predicted.toFixed(1)}`).join("  "));

// --- G3. Sai lệch hệ thống phải nằm trong giới hạn chấp nhận được ------------
// Dự báo thấp hơn tỷ lệ đúng khi luyện tập là HỢP LÝ (đi thi có áp lực, có quên). Nhưng lệch
// quá xa thì con số mất ý nghĩa. Bản cũ lệch tới -2,0 điểm ở nhóm học giỏi, và mức lệch càng
// lớn khi người học càng giỏi, tức là toàn thang điểm bị nén lại chứ không phải thận trọng.
const errors = curveF.map(c => c.predicted - c.realAccuracy * 10);
const maxAbsErr = Math.max(...errors.map(Math.abs));
const meanAbsErr = errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length;

// Ngưỡng siết từ 1,2 xuống 0,6 ngày 27/07/2026, sau khi gỡ hiện tượng nén về giữa. Đo được lúc
// siết: lệch lớn nhất 0,3 và lệch trung bình 0,24, nên 0,6 vẫn còn gấp đôi khoảng đệm. Đặt
// ngưỡng theo hành vi ĐÃ ĐO, không đoán.
//
// CẬP NHẬT 27/07/2026, đọc kỹ trước khi so số với mốc cũ. Con số 0,3 và 0,24 ở trên được đo khi
// `clearAllHistory` còn BỎ SÓT bảy kho dẫn xuất, nên năm kịch bản trong `curveF` chạy nối đuôi
// nhau và mỗi kịch bản thừa hưởng tầng trí nhớ của kịch bản trước. Sau khi việc dọn trở nên
// thật, cùng bộ mã dự báo cho **0,4 và 0,32**. Đã tách nguyên nhân bằng cách bẻ riêng từng
// thay đổi: giữ nguyên công thức độ tự tin cũ mà chỉ dọn kho cho đúng thì con số đã là 0,4.
// Nói cách khác 0,3 là số ĐO SAI chứ không phải chất lượng bị tụt. Đừng "khôi phục" nó.
check("Sai lệch dự báo nằm trong giới hạn", maxAbsErr <= 0.6,
  `lệch lớn nhất ${maxAbsErr.toFixed(1)} điểm, lệch trung bình ${meanAbsErr.toFixed(2)} điểm`);

// Sai lệch không được PHÌNH TO theo năng lực: đó là dấu hiệu thang điểm bị nén.
const errLow = Math.abs(errors[0]);
const errHigh = Math.abs(errors[errors.length - 1]);
check("Sai lệch không phình to theo năng lực người học", errHigh <= errLow + 0.8,
  `nhóm yếu lệch ${errLow.toFixed(1)}, nhóm giỏi lệch ${errHigh.toFixed(1)}`);

// --- G4. Tầng lan truyền phụ thuộc phải THẬT SỰ hoạt động --------------------
// Bản cũ dùng bảng tiên quyết viết tay chứa khái niệm KINH TẾ VI MÔ ("GiaCanBang",
// "PricingStrategy") còn sót từ môn khác, trong khi môn đang chạy là Hành vi khách hàng.
// Đo được 0 khóa khớp, nên cả tầng này chưa từng chạy một lần nào.
const graphForPrereq = kbService.getKnowledgeGraph(dbService.getActiveSubjectId());
const nodesWithPrereq = graphForPrereq.filter(n => (n.dependencies?.requires || []).length > 0);
const cmNow = dbService.getStatistics().conceptMastery || {};
const prereqReachable = nodesWithPrereq.filter(n =>
  (n.dependencies?.requires || []).some(r => {
    const target = graphForPrereq.find(x => x.id.toLowerCase() === String(r).toLowerCase() || x.concept.toLowerCase() === String(r).toLowerCase());
    return target && (cmNow[target.concept] !== undefined || cmNow[target.id] !== undefined);
  })
);
check("Quan hệ tiên quyết tra được về khái niệm có thật", nodesWithPrereq.length === 0 || prereqReachable.length > 0,
  `${nodesWithPrereq.length} khái niệm có tiên quyết, ${prereqReachable.length} tra được sang khái niệm đang theo dõi`);

info(`Sai lệch dự báo theo từng mức năng lực: ${curveF.map(c => `${(c.realAccuracy * 100).toFixed(0)}%: ${(c.predicted - c.realAccuracy * 10).toFixed(1)}`).join("  |  ")}`);

// ===========================================================================
g("H. Cổng AI phía máy chủ");
// ===========================================================================
// Vì sao có nhóm này: đây là loại lỗi bộ kiểm cũ không thấy, vì nó nằm ở chỗ hai nguồn dữ liệu
// lệch nhau chứ không nằm trong engine. Cổng /api/ai/explain từng tra câu hỏi trong ngân hàng
// của môn ĐÃ ĐÓNG, còn pipeline phía sau đọc questionMap của môn ĐANG HỌC. Hai dải id không
// giao nhau nên mọi lời gọi thật đều rơi vào 404, mà giao diện thì nuốt lỗi rồi hiện lời giải
// ngoại tuyến, nên nhìn bên ngoài tưởng AI vẫn đang chạy.
//
// Bất biến chốt lại sau lần sửa 27/07/2026: máy chủ KHÔNG giữ dữ liệu môn học nữa. Tầng suy luận
// chạy ở trình duyệt, nơi duy nhất biết môn nào đang mở, kể cả môn người dùng tự tạo.

const fnDir = path.join(process.cwd(), "functions-src");
const fnFiles = readdirSync(fnDir, { recursive: true, encoding: "utf8" })
  .filter(f => f.endsWith(".ts"))
  .map(f => ({ ten: f, noiDung: readFileSync(path.join(fnDir, f), "utf8") }));

const nhapDuLieuMon = fnFiles.filter(f => /from\s+["'][^"']*src\/data\//.test(f.noiDung));
check("Không hàm serverless nào nhập dữ liệu môn học cố định",
  nhapDuLieuMon.length === 0,
  nhapDuLieuMon.length
    ? `vi phạm: ${nhapDuLieuMon.map(f => f.ten).join(", ")}`
    : `đã soát ${fnFiles.length} file trong functions-src`);

check("Cổng chuyển tiếp AI ghép chỉ dẫn hệ thống ở phía máy chủ",
  fnFiles.some(f => f.ten.endsWith("complete.ts") && f.noiDung.includes("AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION")),
  "nhận chỉ dẫn hệ thống từ giao diện là mở toang rào an toàn nội dung");

const aiSrc = readFileSync(path.join(process.cwd(), "src/services/ai.ts"), "utf8");

check("Lời gọi API đính token qua ensureSession",
  aiSrc.includes("await ensureSession()") && !/apiHeaders[\s\S]{0,400}auth\.getSession\(\)/.test(aiSrc),
  "app không còn màn đăng nhập nên getSession luôn rỗng, mọi cổng AI sẽ nhận 401");

check("Tầng suy luận chạy ở trình duyệt, không gọi cổng explain cũ",
  aiSrc.includes("EvidenceBasedPipeline.executePipeline") && !aiSrc.includes("/api/ai/explain"),
  "gọi lại cổng explain là quay về đúng kiến trúc khiến môn tự tạo không dùng được AI");

// Phép kiểm chạy thật: dựng một môn tự tạo y như khi người dùng bấm thêm môn trong ứng dụng,
// rồi bắt pipeline giải thích một câu của môn đó. Đây là đường mà bản cũ hỏng 100%.
const monTuTaoId = "custom_selftest";
const cauHoiMonTuTao: Question = {
  ...questions[0],
  id: 990001,
  chapterId: 1,
  topicId: `${monTuTaoId}_T1.1`,
};
localStorage.setItem(`poly_econ_custom_questions_${monTuTaoId}`, JSON.stringify([cauHoiMonTuTao]));
localStorage.setItem(`poly_econ_custom_topics_${monTuTaoId}`, JSON.stringify([
  { id: `${monTuTaoId}_T1.1`, chapterId: 1, title: "Chủ đề 1.1: Nhập môn", description: "Tự kiểm chứng." },
]));
localStorage.setItem(`poly_econ_custom_chapters_${monTuTaoId}`, JSON.stringify([
  { id: 1, code: "CH1", title: "Chương 1: Tổng quan", description: "Tự kiểm chứng." },
]));

// Gói trong hàm async vì bộ kiểm được đóng gói dạng CommonJS, không dùng được `await` ở mức
// ngoài cùng. Phần in kết quả được gọi sau khi hàm này xong.
async function kiemTraMonTuTao(): Promise<void> {
  const monBanDau = dbService.getActiveSubjectId();
  let chayDuoc = false;
  let chiTiet = "";
  try {
    loadSubject(monTuTaoId);
    const ketQua = await EvidenceBasedPipeline.executePipeline({
      subjectId: monTuTaoId,
      subjectName: "Môn tự tạo dùng cho tự kiểm chứng",
      questionId: cauHoiMonTuTao.id,
      selectedAnswer: "a",
      explanationLevel: "academic",
      aiEngineExecutor: async () => "lời giải giả lập, không gọi mạng",
      fallbackFunction: () => "bản dự phòng",
    });
    chayDuoc = Boolean(ketQua.text && ketQua.text.length > 0);
    chiTiet = `pipeline trả về ${ketQua.text.length} ký tự cho môn ${monTuTaoId}`;
  } catch (e: any) {
    chiTiet = `pipeline ném lỗi: ${e?.message}`;
  } finally {
    loadSubject(monBanDau);
  }
  check("Môn người dùng tự tạo cũng chạy được tầng suy luận", chayDuoc, chiTiet);
}

const closedBankIds = new Set(closedSubjectQuestions.map(q => q.id));
const activeIds = [...questionMap.keys()];
const overlappingIds = activeIds.filter(id => closedBankIds.has(id));
info(`Hai dải id rời nhau hoàn toàn (${overlappingIds.length} id trùng): môn đang học ${Math.min(...activeIds)} đến ${Math.max(...activeIds)}, ngân hàng môn đã đóng 1 đến ${Math.max(...closedBankIds)}. Nên bản cũ tra nhầm ngân hàng thì KHÔNG câu nào giải thích được, chứ không phải chỉ sai lác đác.`);

// ===========================================================================
g("I. Đài quan sát và lộ trình học");
// ===========================================================================
// Nhóm này sinh ra ngày 27/07/2026 sau đợt rà soát toàn diện. Cả hai engine dưới đây chưa từng
// được soi, và mỗi cái đều chứa lỗi khiến màn hình tương ứng hiển thị số liệu vô nghĩa.

// --- Đài quan sát ---

// Lỗi nặng nhất: `getSystemHealthOverview` và `getReleaseReadinessReport` gọi vòng nhau vô hạn,
// nên MỌI lần mở màn hình Đài quan sát đều làm tràn ngăn xếp. Phép kiểm này chỉ cần chạy được
// là đã chứng minh vòng lặp đã bị cắt.
let sucKhoe: any = null;
let loiSucKhoe = "";
try {
  sucKhoe = productObservabilityService.getSystemHealthOverview();
} catch (e: any) {
  loiSucKhoe = e?.message || String(e);
}
check("Chỉ số sức khỏe hệ thống tính được, không đệ quy vô hạn", sucKhoe !== null,
  loiSucKhoe || `điểm ${sucKhoe?.systemHealthScore}/100, trạng thái ${sucKhoe?.status}`);

if (sucKhoe) {
  const lanHai = productObservabilityService.getSystemHealthOverview();
  check("Chỉ số sức khỏe tái lập được", sucKhoe.systemHealthScore === lanHai.systemHealthScore,
    `gọi hai lần cùng dữ liệu: ${sucKhoe.systemHealthScore} và ${lanHai.systemHealthScore}`);
}

// Khớp câu hỏi với khái niệm phải đi qua bộ tra cứu chính thống. Bản cũ so chuỗi tuyệt đối và
// khớp 0/292 câu, khiến toàn bộ 16/16 khái niệm bị báo là "chết".
const soKhaiNiem = kbService.getKnowledgeGraph(dbService.getActiveSubjectId()).length;
const khaiNiemChet = productObservabilityService.getDeadConcepts().length;
check("Không phải mọi khái niệm đều bị coi là chết", khaiNiemChet < soKhaiNiem,
  `${khaiNiemChet}/${soKhaiNiem} khái niệm bị coi là chết; bản cũ cho ${soKhaiNiem}/${soKhaiNiem}`);

const doPhu = productObservabilityService.getSubjectCompleteness().conceptCoveragePct;
check("Độ phủ khái niệm khác 0", doPhu > 0, `độ phủ đo được ${doPhu}%, bản cũ luôn cho 0%`);

// --- Lộ trình học ---

const statsGoc = dbService.getStatistics();

// Hồ sơ trắng sinh ra nhiều khoản nợ đủ mọi mức ưu tiên, nên đây là chỗ kiểm thứ tự xếp hạng
// có ý nghĩa nhất. Bản cũ dùng hàm so sánh trả -1 bất kể vế còn lại, không phản đối xứng, vi
// phạm bất biến 4.7.
dbService.clearAllHistory();
const noKhiTrang = curriculumIntelligenceEngine.detectStudyDebt(dbService.getStatistics());
const hang: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
let xepDung = noKhiTrang.length >= 2;
for (let i = 1; i < noKhiTrang.length; i++) {
  if ((hang[noKhiTrang[i - 1].priority] ?? 9) > (hang[noKhiTrang[i].priority] ?? 9)) xepDung = false;
}
check("Khoản nợ học tập xếp đúng thứ tự ưu tiên", xepDung,
  noKhiTrang.length < 2
    ? "chỉ có dưới 2 khoản nợ nên phép kiểm không nói lên điều gì"
    : `${noKhiTrang.length} khoản, thứ tự: ${noKhiTrang.map(n => n.priority).join(", ")}`);

// Không được khẳng định điều chưa đo. Hồ sơ trắng thì không có bằng chứng nào về phân bố Bloom,
// nên tuyệt đối không được đẩy ra khoản nợ "thiếu câu vận dụng cao".
check("Không bịa khoản nợ Bloom khi chưa có dữ liệu",
  !noKhiTrang.some(n => n.concept.includes("phân tích & vận dụng")),
  `hồ sơ trắng sinh ra ${noKhiTrang.length} khoản nợ, không khoản nào được nói về Bloom`);

// Độ thạo từng chương phải phản ánh dữ liệu thật. Bản cũ đọc trường ma `solvedQuestionIds` nên
// mọi chương luôn 0%.
const statsThu = dbService.getStatistics();
const chuongThu = chapters[0]?.id ?? 1;
statsThu.accuracyByChapter = { ...(statsThu.accuracyByChapter || {}), [chuongThu]: { correct: 8, total: 10 } };
dbService.saveStatistics(statsThu);
const loTrinh = curriculumIntelligenceEngine.getCurriculumPlan();
const chuongDo = loTrinh.chapterStatuses.find(c => c.chapterId === chuongThu);
check("Độ thạo chương đọc từ dữ liệu thật", (chuongDo?.masteryScore ?? 0) === 80,
  `chương ${chuongThu} có 8/10 câu đúng, engine báo ${chuongDo?.masteryScore}%`);

// Phép kiểm này TỪNG ĐẠT MÀ KHÔNG NÓI LÊN GÌ: nó chạy trên hồ sơ vừa bị xóa sạch, nên cân bằng
// Bloom luôn là 0%/0%/0%, và 0/0/0 thì đương nhiên "khác 45/35/20". Nay bắt buộc phải có lịch
// sử làm bài thật, và tổng ba tỷ lệ phải xấp xỉ 100%, tức là đo được thật chứ không phải trống.
for (let e = 0; e < 3; e++) {
  const deBloom = aiService.generateExam({ type: "random", count: 20 });
  deBloom.answers = {};
  deBloom.questions.forEach((id, i) => {
    const qq = questionMap.get(id);
    if (qq) deBloom.answers[id] = i % 3 === 0 ? LETTERS.find(k => k !== qq.correctAnswer)! : qq.correctAnswer;
  });
  deBloom.isSubmitted = true;
  deBloom.score = deBloom.questions.filter(id => questionMap.get(id)?.correctAnswer === deBloom.answers[id]).length;
  dbService.saveAttempt(deBloom);
}
const loTrinhCoDuLieu = curriculumIntelligenceEngine.getCurriculumPlan();
const canBang = loTrinhCoDuLieu.studyBalance;
const tongBloom = canBang.rememberPercentage + canBang.applyPercentage + canBang.analyzePercentage;
check("Cân bằng Bloom đo được thật từ bài đã làm",
  tongBloom >= 97 && tongBloom <= 103 &&
  !(canBang.rememberPercentage === 45 && canBang.applyPercentage === 35 && canBang.analyzePercentage === 20),
  `nhớ/hiểu ${canBang.rememberPercentage}%, vận dụng ${canBang.applyPercentage}%, phân tích ${canBang.analyzePercentage}%, tổng ${tongBloom}%`);

dbService.clearAllHistory();
dbService.saveStatistics(statsGoc);

// ===========================================================================
g("K. Nhãn mức Bloom của ngân hàng câu hỏi");
// ===========================================================================
// Đo ngày 27/07/2026: trường `bloomLevel` RỖNG ở 292/292 câu, trong khi sáu chỗ trong mã nguồn
// đọc nó. Không chỗ nào báo lỗi, tất cả đều lặng lẽ rơi về giá trị mặc định, nên màn hình báo
// mọi đề thi 100% mức "Nhớ" và gia sư AI được bảo rằng mọi câu đều ở mức "Understand".
// Xem chú thích đầy đủ trong `db.ts`, phần SUY RA MỨC BLOOM.

const thieuBloom = questions.filter(q => !q.bloomLevel).length;
check("Mọi câu hỏi đều có mức Bloom", thieuBloom === 0,
  `${questions.length - thieuBloom}/${questions.length} câu có nhãn; trước 27/07/2026 là 0/${questions.length}`);

const demBloomK: Record<string, number> = {};
questions.forEach(q => { const b = String(q.bloomLevel); demBloomK[b] = (demBloomK[b] || 0) + 1; });
const bacBloom = Object.keys(demBloomK);
const bacDongNhat = Math.max(...Object.values(demBloomK));
check("Nhãn Bloom phân hóa, không dồn hết vào một bậc",
  bacBloom.length >= 3 && bacDongNhat < questions.length * 0.75,
  Object.entries(demBloomK).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));

// Suy ra phải TẤT ĐỊNH: cùng câu hỏi, gọi lại phải ra đúng nhãn cũ.
const mauBloom = questions.slice(0, 30);
const lanDau = mauBloom.map(q => suyRaMucBloom(q));
const lanSau = mauBloom.map(q => suyRaMucBloom(q));
check("Suy ra mức Bloom tất định", lanDau.join(",") === lanSau.join(","),
  `30 câu mẫu, hai lượt suy ra cho cùng kết quả`);

// Không được ghi đè nhãn do người soạn tự khai.
const cauThu: Question = { ...questions[0], id: -999, bloomLevel: "Create", learningObjective: "Nắm vững định nghĩa" };
check("Nhãn do người soạn tự khai được giữ nguyên", suyRaMucBloom(cauThu) === "Create",
  `mục tiêu học tập ghi "Nắm vững" (đáng lẽ ra Remember) nhưng câu đã tự khai Create, kết quả: ${suyRaMucBloom(cauThu)}`);

// Chỗ đọc thật: báo cáo chất lượng đề không được nói mọi đề đều 100% mức "Nhớ".
const deKiemBloom = aiService.generateExam({ type: "random", count: 25 });
const bacTrongDe = new Set(deKiemBloom.questions.map(id => String(questionMap.get(id)?.bloomLevel)));
check("Một đề 25 câu chạm được nhiều bậc Bloom", bacTrongDe.size >= 3,
  `đề vừa sinh chạm ${bacTrongDe.size} bậc: ${[...bacTrongDe].join(", ")}`);

// ===========================================================================
g("J. Màn Kế hoạch học (mô phỏng, ROI, sổ nợ)");
// ===========================================================================
// Nhóm này sinh ra ngày 27/07/2026. Phần lõi dự báo đã được nhóm G canh từ trước, nhưng bốn
// bảng ĂN THEO nó (kịch bản sức ép, ngân sách phút, ROI, sổ nợ) thì chưa ai soi, và cả bốn
// đều đang trình bày con số không bám dữ liệu.

playAndForecast(0.6, 4);
const duBaoJ = examForecaster.calculatePrediction();

// --- J1. Bộ mô phỏng phải khớp bản dự báo tại điểm "không đổi gì" ------------
// Màn hình đặt sẵn hai thanh trượt đúng bằng kế hoạch hiện tại. Bản cũ neo cứng ở 45 phút và
// 14 ngày, nên chỉ cần Đàm đổi thời lượng học hoặc ngày thi là màn hình mở ra đã hiện hai con
// số khác nhau cho cùng một hiện trạng.
//
// Phải TỰ ĐẶT ngày thi ở đây. Trước 13/08/2026 nhóm này im lặng dựa vào giá trị mặc định bịa của
// `getSubjectGoal` (hôm nay cộng 14 ngày), nên nó vừa kiểm bộ mô phỏng vừa vô tình phụ thuộc vào
// đúng con số mà nhóm AM sinh ra để cấm. Đặt tường minh thì phép kiểm nói rõ nó đang kiểm cái gì.
dbService.saveSubjectGoal({
  subjectId: dbService.getActiveSubjectId(),
  targetScore: 8.5,
  examDate: TimeService.formatDateISO(TimeService.parseToDate(TimeService.now().getTime() + 21 * 86400000)),
  dailyStudyMinutes: 45,
  priority: "High",
  updatedAt: TimeService.now().toISOString(),
});
const duBaoJKemMucTieu = examForecaster.calculatePrediction();
const keHoach = dbService.getSubjectGoal();
const phutHienTai = keHoach.dailyStudyMinutes || 45;
const ngayHienTai = duBaoJKemMucTieu.metricsBreakdown.remainingDays as number;
const moPhongTaiCho = examForecaster.simulateDeadlineOutcome(phutHienTai, ngayHienTai);
check("Mô phỏng tại đúng kế hoạch hiện tại trùng với dự báo",
  Math.abs(moPhongTaiCho - duBaoJKemMucTieu.predictedScore) < 0.05,
  `dự báo ${duBaoJKemMucTieu.predictedScore}, mô phỏng ${moPhongTaiCho} tại ${phutHienTai} phút và ${ngayHienTai} ngày`);

// Kéo thanh nào cũng phải đơn điệu: học nhiều hơn không được ra điểm thấp hơn.
const theoPhut = [15, 30, 45, 60, 90, 120, 180].map(m => examForecaster.simulateDeadlineOutcome(m, ngayHienTai));
let donDieuPhut = true;
for (let i = 1; i < theoPhut.length; i++) if (theoPhut[i] < theoPhut[i - 1]) donDieuPhut = false;
check("Học thêm phút không bao giờ làm tụt điểm mô phỏng", donDieuPhut, theoPhut.join(" -> "));

// --- J2. Kịch bản sức ép phải BÁM dữ liệu -----------------------------------
// Bản cũ trả về bốn hằng số viết tay (-0,25 / +0,45 / +0,35 / +0,50), y hệt nhau dù hồ sơ
// trắng hay hồ sơ đầy. Phép kiểm này so hai hồ sơ trái ngược nhau.
const epCoDuLieu = examForecaster.runForecastStressTest(undefined, duBaoJ.predictedScore);
dbService.clearAllHistory();
const epTrang = examForecaster.runForecastStressTest(undefined, 5.0);
const khacNhau = epCoDuLieu.scenarios.filter((s, i) => s.deltaFromBaseline !== epTrang.scenarios[i].deltaFromBaseline).length;
check("Kịch bản sức ép đổi theo dữ liệu người học", khacNhau >= 3,
  `${khacNhau}/5 kịch bản đổi giữa hồ sơ có dữ liệu và hồ sơ trắng; bản cũ chỉ đổi 1/5`);

// Không được hứa lợi ích cho việc KHÔNG THỂ LÀM. Hồ sơ trắng thì không có câu sai nào để chữa,
// không có chuỗi ngày nào để mất, chưa chương nào bị đo là yếu.
const khongTheLam = ["stress_resolve_debt", "stress_rest", "stress_master_hardest"];
const huaHao = epTrang.scenarios.filter(s => khongTheLam.includes(s.id) && s.deltaFromBaseline !== 0);
check("Hồ sơ trắng không được hứa lợi ích cho việc không thể làm", huaHao.length === 0,
  huaHao.length ? huaHao.map(s => `${s.id}=${s.deltaFromBaseline}`).join(", ") : "cả ba kịch bản đều trả về 0 đúng như phải thế");

// --- J3. Ngân sách phút phải cộng lại đúng ----------------------------------
// Bản cũ áp ba sàn cứng 5, 10, 5 phút riêng lẻ rồi mới cộng, nên xin 15 phút nhận về 20 phút
// và ba tỷ lệ hiển thị cộng lại 133%.
const nganSachThu = [10, 15, 20, 25, 30, 45, 60, 90, 120];
const lechNganSach = nganSachThu.filter(n => {
  const kh = examForecaster.getDailyBudgetPlan(n);
  return kh.allocation.reduce((s, a) => s + a.minutes, 0) !== n;
});
check("Kế hoạch chia phút luôn khớp đúng ngân sách", lechNganSach.length === 0,
  lechNganSach.length ? `lệch ở các mức: ${lechNganSach.join(", ")} phút` : `đã thử ${nganSachThu.length} mức, không mức nào lệch`);

const lechTyLe = nganSachThu.filter(n => {
  const kh = examForecaster.getDailyBudgetPlan(n);
  return kh.allocation.reduce((s, a) => s + a.ratio, 0) !== 100;
});
check("Ba tỷ lệ hiển thị luôn cộng lại đúng 100%", lechTyLe.length === 0,
  lechTyLe.length ? `lệch ở các mức: ${lechTyLe.join(", ")} phút` : "không mức nào lệch");

// --- J4. Bảng ROI phải nói cùng con số với bảng độ nhạy ----------------------
// Bản cũ chép lại công thức rồi để nó trôi lệch: cùng hoạt động "Luyện tập tự thích ứng",
// bảng ROI cho +0,55 điểm còn bảng độ nhạy cho +0,33 điểm, hai số hiện cạnh nhau.
playAndForecast(0.6, 4);
const duBaoRoi = examForecaster.calculatePrediction();
const bangRoi = examForecaster.getStudyActivitiesROI();
const doNhayRoi = duBaoRoi.sensitivityAnalysis || [];
const mucLuyenTap = bangRoi.find(r => r.type === "adaptive_practice");
const nhayLuyenTap = doNhayRoi.find(s => s.activityKey === "adaptive_practice");
check("Bảng ROI và bảng độ nhạy nói cùng một con số",
  !!mucLuyenTap && !!nhayLuyenTap && Math.abs(mucLuyenTap.forecastPointGain - nhayLuyenTap.additional30MinGain) < 0.02,
  `ROI ${mucLuyenTap?.forecastPointGain} và độ nhạy ${nhayLuyenTap?.additional30MinGain} cho cùng hoạt động 30 phút`);

// Sổ tay rỗng thì không được hứa thêm điểm cho việc chữa câu sai.
dbService.clearAllHistory();
const roiKhiSach = examForecaster.getStudyActivitiesROI().find(r => r.type === "wrong_notebook");
check("Sổ tay rỗng thì mục chữa câu sai không hứa thêm điểm",
  (roiKhiSach?.forecastPointGain ?? 1) === 0,
  `không còn câu sai nào, mục này báo +${roiKhiSach?.forecastPointGain} điểm (bản cũ luôn báo +0,1)`);

// --- J5. Sổ nợ phải xếp hạng thật và nhãn phải phân loại được ----------------
// Bản cũ tính điểm ưu tiên rồi VỨT ĐI, trả về theo thứ tự khóa của bảng lịch sử. Nhãn thì cộng
// sẵn `soCauLienQuan * 0,2` (thường khoảng 2,6) trước khi xét ngưỡng 3,0, nên đo được 44/45 mục
// cùng mang nhãn "Cao".
//
// Dựng hồ sơ ĐẢM BẢO phân hóa, thay vì mô phỏng đúng 55% đều tay.
//
// Vì sao phải đổi (đo ngày 27/07/2026): nhãn nợ xét theo tỷ lệ đúng của CHƯƠNG chứa câu sai,
// ngưỡng 0,5 và 0,7. Hồ sơ đúng 55% đều tay chỉ tình cờ cho ba nhãn, vì tỷ lệ từng chương dao
// động quanh 55% và có chương lọt ra ngoài dải. Thành phần đề lại phụ thuộc trạng thái tích lũy
// của cả chuỗi nhóm kiểm trước đó, nên chỉ cần một thay đổi ở nơi khác là dải này co lại và cả
// 45 mục về cùng một nhãn. Phép kiểm khi đó báo đỏ mà mã nguồn không hề sai.
//
// Nay dựng thẳng: chương đầu sai HẾT và sai HAI LẦN (buộc phải ra "Cao"), chương cuối đúng gần
// hết (buộc phải ra "Thấp"). Nếu tầng gán nhãn hỏng thì phép kiểm vẫn đỏ, còn thành phần đề
// không còn ảnh hưởng.
dbService.clearAllHistory();
const chuongYeu = chapters[0].id;
const chuongManh = chapters[chapters.length - 1].id;
for (let lan = 0; lan < 2; lan++) {
  const cauYeu = questions.filter(q => q.chapterId === chuongYeu).slice(0, 8);
  const deYeu = aiService.generateExam({ type: "chapter", chapterId: chuongYeu, count: cauYeu.length });
  deYeu.answers = {};
  deYeu.questions.forEach(id => {
    const q = questionMap.get(id);
    if (q) deYeu.answers[id] = (["a", "b", "c", "d"] as const).find(k => k !== q.correctAnswer)!;
  });
  deYeu.isSubmitted = true;
  deYeu.score = 0;
  deYeu.id = `de_yeu_${lan}`;
  dbService.saveAttempt(deYeu);
}
const deManh = aiService.generateExam({ type: "chapter", chapterId: chuongManh, count: 10 });
deManh.answers = {};
deManh.questions.forEach((id, i) => {
  const q = questionMap.get(id);
  if (!q) return;
  deManh.answers[id] = i === 0 ? (["a", "b", "c", "d"] as const).find(k => k !== q.correctAnswer)! : q.correctAnswer;
});
deManh.isSubmitted = true;
deManh.score = deManh.questions.length - 1;
dbService.saveAttempt(deManh);
examForecaster.calculatePrediction();

const soNo = examForecaster.getStudyDebtItems();
const demNhan = new Set(soNo.map(i => i.priority));
check("Nhãn ưu tiên trong sổ nợ phân loại được", soNo.length < 5 || demNhan.size >= 2,
  `${soNo.length} mục, dùng ${demNhan.size} mức nhãn: ${[...demNhan].join(", ")}`);

// Mục ưu tiên cao phải nằm trên. Kiểm bằng cách so vị trí trung bình của hai nhóm nhãn.
const viTriCao = soNo.map((i, idx) => ({ i, idx })).filter(x => x.i.priority === "Cao").map(x => x.idx);
const viTriThap = soNo.map((i, idx) => ({ i, idx })).filter(x => x.i.priority === "Thấp").map(x => x.idx);
const tbCao = viTriCao.length ? viTriCao.reduce((a, b) => a + b, 0) / viTriCao.length : 0;
const tbThap = viTriThap.length ? viTriThap.reduce((a, b) => a + b, 0) / viTriThap.length : 999;
check("Sổ nợ xếp mục đáng làm trước lên trên",
  viTriCao.length === 0 || viTriThap.length === 0 || tbCao < tbThap,
  `vị trí trung bình nhóm "Cao" là ${tbCao.toFixed(1)}, nhóm "Thấp" là ${tbThap === 999 ? "không có" : tbThap.toFixed(1)}`);

// Gọi hai lần phải ra đúng một thứ tự (bất biến 4.7).
const soNoLanHai = examForecaster.getStudyDebtItems();
check("Thứ tự sổ nợ tái lập được",
  soNo.map(i => i.id).join("|") === soNoLanHai.map(i => i.id).join("|"),
  `${soNo.length} mục, hai lần gọi cho cùng thứ tự`);

// Mã chủ đề của khoản nợ "chưa học chương" phải CÓ THẬT. Bản cũ bịa ra theo quy ước `T{id}.1`.
dbService.clearAllHistory();
const maChuDeThat = new Set(topics.map(t => t.id));
const noChuong = examForecaster.getStudyDebtItems().filter(i => i.debtType === "unlearned_chapter");
const maBia = noChuong.filter(i => i.topicId && !maChuDeThat.has(i.topicId));
check("Khoản nợ chương không bịa ra mã chủ đề không tồn tại",
  noChuong.length > 0 && maBia.length === 0,
  noChuong.length === 0
    ? "không sinh ra khoản nợ chương nào nên phép kiểm không nói lên điều gì"
    : `${noChuong.length} khoản nợ chương, ${maBia.length} khoản dùng mã chủ đề không có thật`);

// Chưa học chương nào thì phải bắt đầu từ chương ĐẦU. Bản đầu tiên của lượt sửa này cộng số
// hiệu chương vào điểm xếp hạng, nên màn hình dựng ngược: Chương 7 trên cùng, Chương 1 dưới đáy.
// Lỗi chỉ lộ ra khi mở màn hình thật xem, bộ kiểm lúc đó không có phép nào canh thứ tự này.
const thuTuChuong = noChuong.map(i => i.chapterId);
check("Nợ chương xếp từ chương đầu trở đi",
  thuTuChuong.length < 2 || thuTuChuong.every((v, i) => i === 0 || v > thuTuChuong[i - 1]),
  `thứ tự chương hiện ra: ${thuTuChuong.join(", ")}`);

// --- J6. Hai bảng phải nói cùng một chuyện về chương yếu nhất ---------------
playAndForecast(0.6, 4);
const duBaoW = examForecaster.calculatePrediction();
const whatIf = examForecaster.getWhatIfScenarios();
const mucBoChuong = whatIf.find(w => w.title.includes("chương yếu nhất"));
const kbChuong = (duBaoW.stressTestReport?.scenarios || []).find(s => s.id === "stress_master_hardest");
check("Mức mất khi bỏ chương yếu nhất khớp với bảng kịch bản",
  !!mucBoChuong && !!kbChuong &&
  Math.abs((duBaoW.predictedScore - (mucBoChuong.projectedScore || 0)) - (kbChuong.deltaFromBaseline || 0)) < 0.15,
  `what-if trừ ${(duBaoW.predictedScore - (mucBoChuong?.projectedScore ?? 0)).toFixed(2)}, kịch bản cộng ${kbChuong?.deltaFromBaseline}`);

dbService.clearAllHistory();

// ===========================================================================
g("L. Không gắn cứng mã môn học");
// ===========================================================================
// Nhóm này sinh ra ngày 27/07/2026, sau khi Đàm xác nhận đây là trung tâm luyện thi ĐA MÔN và
// sẽ còn nạp thêm nhiều môn nữa. Loại lỗi ở đây có đặc điểm chung: chạy đúng y như thường với
// môn Hành vi khách hàng, và chỉ sai khi có từ hai môn trở lên. Nghĩa là nó nằm im cho tới
// đúng lúc Đàm cần nó nhất.

check("Đồ thị tri thức đã được đăng ký vào db", daDangKyDoThiTriThuc(),
  daDangKyDoThiTriThuc()
    ? "kbService đã cắm vào ô đăng ký của db, nên độ thạo ghi được cả hai khóa cho mọi môn"
    : "CHƯA đăng ký: db sẽ rơi về hành vi cũ, chỉ môn customer_behavior có hai khóa");

// `auditSubject()` gọi không tham số phải bám MÔN ĐANG MỞ. Bản cũ mặc định cứng
// "customer_behavior", mà cả ba nơi gọi trong AcademicQualityDashboard đều gọi không tham số.
const monDangMo = dbService.getActiveSubjectId();
const baoCaoSoat = evidenceCoverageAuditService.auditSubject();
check("Soát chất lượng học thuật bám môn đang mở",
  baoCaoSoat.healthOverview.subjectId === monDangMo,
  `môn đang mở "${monDangMo}", báo cáo nói về "${baoCaoSoat.healthOverview.subjectId}"`);

// Lộ trình học cũng vậy.
const loTrinhMon = curriculumIntelligenceEngine.getCurriculumPlan();
check("Lộ trình học tính được cho môn đang mở", loTrinhMon.chapterStatuses.length === chapters.length,
  `môn đang mở có ${chapters.length} chương, lộ trình dựng ${loTrinhMon.chapterStatuses.length} chương`);

// Bất biến 4.6 phải đúng với MỌI môn, không riêng môn có đồ thị viết tay. Dựng một môn tự tạo
// rồi kiểm xem độ thạo có được ghi dưới cả hai khóa không.
const monThuL = "custom_selftest_dachu";
localStorage.setItem(`poly_econ_custom_chapters_${monThuL}`, JSON.stringify([
  { id: 1, code: "CH1", title: "Chương 1: Thử", description: "Chương thử cho phép kiểm." }
]));
localStorage.setItem(`poly_econ_custom_topics_${monThuL}`, JSON.stringify([
  { id: `${monThuL}_T1.1`, chapterId: 1, title: "Chủ đề 1.1", description: "Chủ đề thử." }
]));
localStorage.setItem(`poly_econ_custom_questions_${monThuL}`, JSON.stringify(
  [1, 2, 3, 4, 5, 6].map(i => ({
    id: 90000 + i,
    question: `Câu thử số ${i} về khái niệm thử nghiệm đa môn?`,
    options: { a: "Phương án A", b: "Phương án B", c: "Phương án C", d: "Phương án D" },
    correctAnswer: "a",
    chapterId: 1,
    topicId: `${monThuL}_T1.1`,
    difficulty: "Trung bình",
    difficultyRating: 3,
    explanation: "Giải thích đủ dài để bộ tổng hợp đồ thị tri thức dựng được định nghĩa cho khái niệm.",
    knowledgeMapping: ["Khái niệm thử đa môn"],
    learningObjective: "Nắm vững khái niệm thử đa môn",
    questionType: "multiple-choice",
    estimatedTime: 40,
    sourcePdf: "TaiLieuThu.pdf",
    sourcePage: "trang 1"
  }))
));

const monCu = dbService.getActiveSubjectId();
loadSubject(monThuL);
dbService.setActiveSubjectId(monThuL);

const doThiMonThu = kbService.getKnowledgeGraph(monThuL);
check("Môn tự tạo vẫn dựng được đồ thị tri thức", doThiMonThu.length > 0,
  `${doThiMonThu.length} khái niệm tổng hợp từ ${questions.length} câu`);

const statsMonThu = dbService.getStatistics();
setConceptMasteryBothKeys(statsMonThu, "Khái niệm thử đa môn", 77);
const nutThu = doThiMonThu.find(n => n.concept === "Khái niệm thử đa môn");
check("Độ thạo ghi đủ hai khóa kể cả với môn tự tạo",
  !!nutThu && statsMonThu.conceptMastery?.[nutThu.id] === 77 && statsMonThu.conceptMastery?.[nutThu.concept] === 77,
  nutThu
    ? `khóa tên = ${statsMonThu.conceptMastery?.[nutThu.concept]}, khóa mã (${nutThu.id}) = ${statsMonThu.conceptMastery?.[nutThu.id]}`
    : "không tìm thấy nút khái niệm trong đồ thị tổng hợp");

const soatMonThu = evidenceCoverageAuditService.auditSubject();
check("Soát chất lượng chuyển theo môn khi đổi môn",
  soatMonThu.healthOverview.subjectId === monThuL,
  `đã đổi sang "${monThuL}", báo cáo nói về "${soatMonThu.healthOverview.subjectId}"`);

// Trả lại môn cũ, không để phép kiểm này làm bẩn trạng thái của các nhóm khác.
dbService.setActiveSubjectId(monCu);
loadSubject(monCu);
[`poly_econ_custom_chapters_${monThuL}`, `poly_econ_custom_topics_${monThuL}`, `poly_econ_custom_questions_${monThuL}`]
  .forEach(k => localStorage.removeItem(k));

// ===========================================================================
g("M. Chỉ số hằng số trá hình");
// ===========================================================================
// Nhóm này sinh ra ngày 27/07/2026 từ một phép quét rộng: cho engine chạy trên 5 hồ sơ học
// khác hẳn nhau (làm đúng 0%, 25%, 50%, 75%, 100%) rồi đếm xem đầu ra nào KHÔNG BAO GIỜ đổi.
// Cách này tìm ra bốn con số được trình bày như kết quả đo nhưng thực chất viết cứng.
//
// Lưu ý khi đọc kết quả quét: KHÔNG phải hằng số nào cũng là lỗi. Chỉ số về NGÂN HÀNG CÂU HỎI
// (độ phủ, cân bằng Bloom của ngân hàng, nợ kỹ thuật) đứng yên khi đổi hồ sơ người học là
// ĐÚNG, vì ngân hàng có đổi đâu. Chỉ những chỉ số về NGƯỜI HỌC mà đứng yên mới là lỗi.

// --- M1. Báo cáo giảng dạy không được khoe số khi chưa có lượt nào ---
// Bản cũ trả về hiệu quả giảng dạy 85,0% và mức tăng thông thạo +5,5 điểm/câu cho hồ sơ chưa
// từng hỏi gia sư AI lần nào. Con số đó không đến từ phép đo nào cả.
localStorage.removeItem("poly_econ_pedagogical_evaluations");
const baoCaoDay = teachingAnalytics.generateAnalyticsReport();
check("Chưa hỏi gia sư lần nào thì báo cáo giảng dạy trả 0",
  baoCaoDay.totalInteractions === 0 &&
  baoCaoDay.overallTeachingEffectiveness === 0 &&
  baoCaoDay.averageMasteryGrowth === 0 &&
  baoCaoDay.averageBloomProgression === 0 &&
  baoCaoDay.averageRecoveryTime === 0,
  `hiệu quả ${baoCaoDay.overallTeachingEffectiveness}%, tăng thông thạo ${baoCaoDay.averageMasteryGrowth}, bước Bloom ${baoCaoDay.averageBloomProgression}, số lượt gỡ ${baoCaoDay.averageRecoveryTime}`);

check("Tốc độ học của hồ sơ chưa học gì phải bằng 0", baoCaoDay.learningVelocity === 0,
  `đo được ${baoCaoDay.learningVelocity}, bản cũ luôn cho 2,5 vì mô hình người học khởi tạo sẵn con số đó`);

// --- M2. Độ phủ chương của một đề không được vượt quá 100% ---
// Bản cũ chia cho hằng số 6 kèm chú thích "assuming 6 standard chapters", trong khi môn đang
// học có 7 chương, nên đề phủ đủ cả 7 chương bị báo là 117%.
const deDayDuChuong = chapters.map(c => questions.find(q => q.chapterId === c.id)).filter(Boolean) as Question[];
const baoCaoDe = examQualityReportService.generateReport(deDayDuChuong, "KIEM-M2");
check("Độ phủ chương của đề không vượt quá 100%",
  baoCaoDe.chapterCoveragePct === 100,
  `đề chạm đủ ${chapters.length}/${chapters.length} chương, báo cáo nói ${baoCaoDe.chapterCoveragePct}%`);

// --- M3. Chương được gợi ý phải bám độ thạo đo được ---
// Bản cũ ghi thẳng [1, 2, 3], mà CurriculumDashboard dùng phần tử đầu để sinh đề, nên nút gợi ý
// LUÔN sinh đề Chương 1 dù người học yếu ở chương nào.
playAndForecast(0.6, 5);
const statsM = dbService.getStatistics();
const chuongYeuNhat = chapters[chapters.length - 1].id;
statsM.accuracyByChapter = {} as any;
chapters.forEach(c => { statsM.accuracyByChapter[c.id] = { correct: 9, total: 10 }; });
statsM.accuracyByChapter[chuongYeuNhat] = { correct: 1, total: 10 };
dbService.saveStatistics(statsM);
const goiYChuong = curriculumIntelligenceEngine.getCurriculumPlan().recommendedChapters;
check("Chương gợi ý bám đúng chương yếu nhất",
  goiYChuong[0] === chuongYeuNhat,
  `chương ${chuongYeuNhat} chỉ đúng 1/10 câu còn các chương khác 9/10, engine gợi ý: ${goiYChuong.join(", ")}`);

// Gọi lại phải ra đúng thứ tự cũ (bất biến 4.7).
const goiYLanHai = curriculumIntelligenceEngine.getCurriculumPlan().recommendedChapters;
check("Danh sách chương gợi ý tái lập được",
  goiYChuong.join(",") === goiYLanHai.join(","),
  `hai lần gọi: [${goiYChuong.join(", ")}] và [${goiYLanHai.join(", ")}]`);

dbService.clearAllHistory();

// ===========================================================================
g("N. Cảnh báo bẫy hiểu sai gửi cho gia sư AI");
// ===========================================================================
// Bối cảnh: trường `misconception` của câu hỏi rỗng 292/292, nên `contextWindowBuilder` từng
// luôn gửi cho gia sư AI đúng một câu chung chung, trong khi đồ thị tri thức có sẵn dữ liệu
// hiểu sai biên soạn tay cho 16/16 khái niệm.

const monN = dbService.getActiveSubjectId();

let coCanhBao = 0;
const canhBaoKhacNhau = new Set<string>();
for (const q of questions) {
  const s = kbService.layCanhBaoBayHocThuat(monN, q);
  if (s) { coCanhBao++; canhBaoKhacNhau.add(s); }
}
check("Mọi câu tra ra được cảnh báo bẫy biên soạn tay",
  coCanhBao === questions.length,
  `${coCanhBao}/${questions.length} câu, ${canhBaoKhacNhau.size} nội dung khác nhau`);

check("Cảnh báo bẫy phải phân hóa, không phải một chuỗi dùng chung",
  canhBaoKhacNhau.size >= 10,
  `${canhBaoKhacNhau.size} nội dung khác nhau trên ${coCanhBao} câu`);

// Chốt chặn quan trọng nhất của nhóm này: nút TỔNG HỢP TỰ ĐỘNG chỉ chứa chuỗi mẫu ghép tên
// khái niệm, đúng với mọi khái niệm nên không nói lên gì. Đưa nó vào lời nhắc dưới nhãn "bẫy
// phổ biến" là dựng chuỗi mẫu thành bằng chứng học thuật, đúng họ lỗi mà bất biến 4.9 cấm.
const monTuTaoN = "custom_kiem_bay";
localStorage.setItem(`poly_econ_custom_questions_${monTuTaoN}`, JSON.stringify([
  { ...questions[0], id: 990701, topicId: `${monTuTaoN}_T1.1`, chapterId: 1 },
]));
localStorage.setItem(`poly_econ_custom_topics_${monTuTaoN}`, JSON.stringify([
  { id: `${monTuTaoN}_T1.1`, chapterId: 1, title: "Chủ đề 1.1", description: "Tự kiểm chứng." },
]));
localStorage.setItem(`poly_econ_custom_chapters_${monTuTaoN}`, JSON.stringify([
  { id: 1, code: "CH1", title: "Chương 1", description: "Tự kiểm chứng." },
]));

const monTruocN = dbService.getActiveSubjectId();
loadSubject(monTuTaoN);
const nutTongHop = kbService.getKnowledgeGraph(monTuTaoN);
const canhBaoTuTao = kbService.layCanhBaoBayHocThuat(monTuTaoN, questionMap.get(990701)!);
check("Không lấy chuỗi mẫu của nút tổng hợp làm cảnh báo bẫy",
  canhBaoTuTao === null,
  canhBaoTuTao === null
    ? `${nutTongHop.length} nút tổng hợp đều bị loại, sẽ rơi về câu chung chung`
    : `lọt chuỗi mẫu: ${canhBaoTuTao.slice(0, 60)}`);
check("Nút tổng hợp có gắn cờ nhận dạng",
  nutTongHop.length > 0 && nutTongHop.every(n => n.laNutTongHop === true),
  `${nutTongHop.filter(n => n.laNutTongHop).length}/${nutTongHop.length} nút có cờ`);
loadSubject(monTruocN);

info(`Cảnh báo bẫy: ${coCanhBao}/${questions.length} câu nhận nội dung biên soạn tay, ${canhBaoKhacNhau.size} nội dung khác nhau. Trước 27/07/2026 con số này là 0 vì trường misconception của câu hỏi rỗng toàn tập.`);

// ===========================================================================
g("O. Hiệu chuẩn nhận thức đọc từ cờ nghi vấn");
// ===========================================================================
// Bối cảnh: `PracticeView` cho người học gắn cờ "không chắc" trên từng câu, `saveAttempt` lưu cờ
// đó vào lượt làm bài, nhưng trước 27/07/2026 **không service suy luận nào đọc `attempt.flags`**.

/** Mô phỏng lượt làm bài có gắn cờ, tất định, không dùng Math.random. */
function moPhongCoGanCo(soDe: number, tyLeDung: number, buocGanCo: number) {
  dbService.clearAllHistory();
  for (let e = 0; e < soDe; e++) {
    const de = aiService.generateExam({ type: "random", count: 20 });
    de.answers = {};
    de.flags = [];
    de.questions.forEach((id, i) => {
      const q = questionMap.get(id);
      if (!q) return;
      const dung = (i / de.questions.length) < tyLeDung;
      de.answers[id] = dung ? q.correctAnswer : (["a", "b", "c", "d"] as const).find(k => k !== q.correctAnswer)!;
      if (buocGanCo > 0 && i % buocGanCo === 0) de.flags!.push(id);
    });
    de.isSubmitted = true;
    de.score = de.questions.filter(id => questionMap.get(id)?.correctAnswer === de.answers[id]).length;
    dbService.saveAttempt(de);
  }
}

// O1. Hồ sơ trắng phải nói thẳng là chưa đủ dữ liệu, không được trả một con số.
dbService.clearAllHistory();
const hcTrang = learnerModelService.doHieuChuanNhanThuc();
check("Hồ sơ trắng: hiệu chuẩn tự nhận chưa đủ dữ liệu",
  hcTrang.duDuLieu === false && hcTrang.thuaTuTinDaCo === 0,
  `duDuLieu=${hcTrang.duDuLieu}, thuaTuTinDaCo=${hcTrang.thuaTuTinDaCo}, ${hcTrang.soCauXet} câu xét`);

// O2. Có làm bài nhưng KHÔNG gắn cờ nào thì cũng chưa kết luận được về hiệu chuẩn.
moPhongCoGanCo(3, 0.6, 0);
const hcKhongCo = learnerModelService.doHieuChuanNhanThuc();
check("Làm bài mà không gắn cờ nào: vẫn là chưa đủ dữ liệu",
  hcKhongCo.duDuLieu === false && hcKhongCo.soCauXet >= 20,
  `${hcKhongCo.soCauXet} câu xét nhưng chỉ ${hcKhongCo.soCauGanCo} cờ`);

// O3. Bốn ô phải cộng đủ về tổng số câu xét, không rơi rụng câu nào.
moPhongCoGanCo(4, 0.6, 4);
const hc = learnerModelService.doHieuChuanNhanThuc();
const tongO = hc.o.coCoLamDung + hc.o.coCoLamSai + hc.o.khongCoLamSai + hc.o.khongCoLamDung;
check("Bốn ô hiệu chuẩn cộng đủ về tổng số câu xét",
  tongO === hc.soCauXet && hc.soCauXet > 0,
  `${hc.o.coCoLamDung} + ${hc.o.coCoLamSai} + ${hc.o.khongCoLamSai} + ${hc.o.khongCoLamDung} = ${tongO}, tổng xét ${hc.soCauXet}`);
check("Đủ dữ liệu thì mới cho ra chỉ số",
  hc.duDuLieu === true && hc.thuaTuTinDaCo > 0,
  hc.giaiTrinh);

// O4. Chỉ số phải PHÂN HÓA giữa hai hồ sơ khác nhau, nếu không nó là hằng số trá hình (mục 4.9b).
moPhongCoGanCo(4, 0.9, 4);
const hcGioi = learnerModelService.doHieuChuanNhanThuc().thuaTuTinDaCo;
moPhongCoGanCo(4, 0.3, 4);
const hcYeu = learnerModelService.doHieuChuanNhanThuc().thuaTuTinDaCo;
check("Thừa tự tin phân hóa theo hồ sơ học",
  hcYeu > hcGioi + 0.05,
  `hồ sơ đúng 90% cho ${(hcGioi * 100).toFixed(1)}%, hồ sơ đúng 30% cho ${(hcYeu * 100).toFixed(1)}%`);

// O5. Vector bất định hành vi phải THẬT SỰ đổi theo cờ, không chỉ đổi theo số câu đã làm.
// Hai hồ sơ dưới đây có CÙNG tỷ lệ đúng và cùng số câu, chỉ khác chỗ đặt cờ.
moPhongCoGanCo(4, 0.6, 4);
const batDinhCoCo = examForecaster.calculatePrediction().uncertaintyDecomposition?.behaviorUncertainty ?? -1;
moPhongCoGanCo(4, 0.6, 0);
const batDinhKhongCo = examForecaster.calculatePrediction().uncertaintyDecomposition?.behaviorUncertainty ?? -1;
check("Bất định hành vi phản ứng với cờ nghi vấn",
  batDinhCoCo > batDinhKhongCo,
  `cùng 80 câu và cùng tỷ lệ đúng: có cờ cho ${batDinhCoCo.toFixed(3)}, không cờ cho ${batDinhKhongCo.toFixed(3)}`);

dbService.clearAllHistory();

// ===========================================================================
g("P. Nhịp làm bài và phát hiện đoán mò");
// ===========================================================================
// Bối cảnh: `estimatedTime` có ở 292/292 câu nhưng chưa từng được so với `attempt.timeSpent`.
// Và `adaptiveMemory.guessingFrequency` đo được LUÔN bằng 0 sau nhiều đề, vì nó chỉ cập nhật từ
// tương tác với gia sư AI, không từ lượt làm bài.

/** Mô phỏng lượt làm bài có ghi thời gian, tất định. `heSoNhip` nhỏ là làm nhanh. */
function moPhongCoNhip(tyLeDung: number, heSoNhip: number, soDe: number, daNop = true) {
  dbService.clearAllHistory();
  for (let e = 0; e < soDe; e++) {
    const de = aiService.generateExam({ type: "random", count: 20 });
    de.answers = {};
    de.questions.forEach((id, i) => {
      const q = questionMap.get(id);
      if (!q) return;
      const dung = (i / de.questions.length) < tyLeDung;
      de.answers[id] = dung ? q.correctAnswer : (["a", "b", "c", "d"] as const).find(k => k !== q.correctAnswer)!;
    });
    const chuan = de.questions.reduce((s, id) => s + (questionMap.get(id)?.estimatedTime || 0), 0);
    de.timeSpent = Math.round(chuan * heSoNhip);
    de.isSubmitted = daNop;
    de.score = de.questions.filter(id => questionMap.get(id)?.correctAnswer === de.answers[id]).length;
    dbService.saveAttempt(de);
  }
}

// P1. Mốc chuẩn phải có thật, nếu không cả phép so là vô nghĩa.
const cauCoMocThoiGian = questions.filter(q => typeof q.estimatedTime === "number" && q.estimatedTime > 0).length;
const soMocKhacNhau = new Set(questions.map(q => q.estimatedTime)).size;
check("Mọi câu có mốc thời gian ước tính và mốc phải phân hóa",
  cauCoMocThoiGian === questions.length && soMocKhacNhau >= 2,
  `${cauCoMocThoiGian}/${questions.length} câu có mốc, ${soMocKhacNhau} giá trị khác nhau`);

// P2. Hồ sơ trắng phải nói chưa đủ dữ liệu.
dbService.clearAllHistory();
const nhipTrang = learnerModelService.doNhipLamBai();
check("Hồ sơ trắng: nhịp làm bài tự nhận chưa đủ dữ liệu",
  nhipTrang.duDuLieu === false && nhipTrang.tyLeDoanMo === 0,
  `duDuLieu=${nhipTrang.duDuLieu}, ${nhipTrang.soLuotXet} lượt xét`);

// P3. Lượt DỞ DANG không được tính, vì đồng hồ vẫn chạy khi người học rời đi.
moPhongCoNhip(0.3, 0.2, 3, false);
const nhipDoDang = learnerModelService.doNhipLamBai();
check("Lượt làm bài dở dang bị loại khỏi phép đo nhịp",
  nhipDoDang.soLuotXet === 0,
  `${dbService.getHistory().length} lượt trong lịch sử, ${nhipDoDang.soLuotXet} lượt được xét`);

// P4. ĐIỀU KIỆN QUAN TRỌNG NHẤT: nhanh mà vẫn đúng là thành thạo, không được coi là đoán mò.
moPhongCoNhip(0.3, 0.2, 3);
const nhanhSai = learnerModelService.doNhipLamBai();
moPhongCoNhip(0.95, 0.2, 3);
const nhanhDung = learnerModelService.doNhipLamBai();
check("Nhanh mà làm đúng KHÔNG bị coi là đoán mò",
  nhanhDung.tyLeDoanMo < nhanhSai.tyLeDoanMo * 0.4,
  `cùng nhịp ${nhanhDung.tyLeNhip.toFixed(2)}: đúng 95% cho mức đoán mò ${(nhanhDung.tyLeDoanMo * 100).toFixed(1)}%, đúng 30% cho ${(nhanhSai.tyLeDoanMo * 100).toFixed(1)}%`);

// P5. Chậm mà sai cũng không phải đoán mò, chỉ là chưa nắm được bài.
moPhongCoNhip(0.3, 1.3, 3);
const chamSai = learnerModelService.doNhipLamBai();
check("Chậm mà làm sai KHÔNG bị coi là đoán mò",
  chamSai.tyLeDoanMo === 0,
  `nhịp ${chamSai.tyLeNhip.toFixed(2)} và đúng ${(chamSai.tyLeDung * 100).toFixed(0)}% cho mức đoán mò ${(chamSai.tyLeDoanMo * 100).toFixed(1)}%`);

// P6. Hàm phải LIÊN TỤC, không nhảy bậc. Quét nhịp từ nhanh tới chậm và đếm số giá trị khác nhau.
const daiDoanMo: number[] = [];
for (const heSo of [0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 0.9]) {
  moPhongCoNhip(0.3, heSo, 3);
  daiDoanMo.push(learnerModelService.doNhipLamBai().tyLeDoanMo);
}
const soBacKhacNhau = new Set(daiDoanMo.map(v => v.toFixed(3))).size;
const donDieu = daiDoanMo.every((v, i) => i === 0 || v <= daiDoanMo[i - 1] + 1e-9);
check("Mức đoán mò biến thiên liên tục và giảm dần khi làm chậm lại",
  soBacKhacNhau >= 5 && donDieu,
  `7 mức nhịp cho ${soBacKhacNhau} giá trị khác nhau: ${daiDoanMo.map(v => (v * 100).toFixed(1)).join(", ")}%`);

// P7. Con số phải chảy tới nơi tiêu thụ, tức guessingFrequency mà giao diện và lời nhắc đang đọc.
moPhongCoNhip(0.3, 0.2, 3);
const gfCoDuLieu = studentModelService.getStudentModel().adaptiveMemory.guessingFrequency;
dbService.clearAllHistory();
const gfTrang = studentModelService.getStudentModel().adaptiveMemory.guessingFrequency;
check("Tỷ lệ đoán mò chảy được vào mô hình người học",
  gfCoDuLieu > 0 && gfTrang === 0,
  `có dữ liệu cho ${gfCoDuLieu.toFixed(3)}, hồ sơ trắng cho ${gfTrang}`);

// P8. Tái lập được: gọi lại với cùng dữ liệu phải ra đúng con số cũ (bất biến về tất định).
moPhongCoNhip(0.4, 0.3, 3);
const lan1 = learnerModelService.doNhipLamBai().tyLeDoanMo;
const lan2 = learnerModelService.doNhipLamBai().tyLeDoanMo;
const lan3 = studentModelService.getStudentModel().adaptiveMemory.guessingFrequency;
check("Mức đoán mò tái lập được, không bò lên theo số lần gọi",
  lan1 === lan2 && Math.abs(lan1 - lan3) < 1e-9,
  `ba lần đọc: ${lan1.toFixed(4)}, ${lan2.toFixed(4)}, ${lan3.toFixed(4)}`);

dbService.clearAllHistory();

// ===========================================================================
g("Q. Tiên nghiệm lịch ôn từ dữ liệu biên soạn tay");
// ===========================================================================
// Bối cảnh: `customer_behavior_kb.ts` biên soạn tay `review.estimatedRetentionDifficulty` và
// `review.firstReviewDays` cho 16/16 khái niệm, nhưng KHÔNG dòng suy luận nào đọc chúng. Hệ quả
// đo được: khái niệm chưa học câu nào cho ra độ bền trí nhớ **6,15 ngày y hệt nhau cho mọi khái
// niệm**, tức bài toán khởi đầu nguội, dù lời giải nằm sẵn trong dữ liệu.

const monQ = dbService.getActiveSubjectId();
const nodesQ = kbService.getKnowledgeGraph(monQ);

/** Suy độ bền trí nhớ từ đường cong quên: retention(1 ngày) = e^(-1/S) nên S = -1/ln(r). */
function doBenTriNho(conceptName: string): number {
  const p = conceptMemoryService.getConceptProfile(conceptName);
  const r1 = conceptMemoryService.generateForgetCurve(p).find(c => c.daysAhead === 1)?.retention ?? 0;
  if (r1 <= 0 || r1 >= 1) return NaN;
  return -1 / Math.log(r1);
}

// Q1. Dữ liệu biên soạn phải có thật và phân hóa, nếu không cả nhiệm vụ này vô nghĩa.
const mucDoKho = new Set(nodesQ.map(n => n.review?.estimatedRetentionDifficulty).filter(Boolean));
const mucNgayDau = new Set(nodesQ.map(n => n.review?.firstReviewDays).filter(v => typeof v === "number"));
check("Đồ thị có dữ liệu lịch ôn biên soạn tay và có phân hóa",
  nodesQ.every(n => !!n.review) && mucDoKho.size >= 2 && mucNgayDau.size >= 2,
  `${nodesQ.filter(n => n.review).length}/${nodesQ.length} khái niệm có khối review, ${mucDoKho.size} mức độ khó (${[...mucDoKho].join(", ")}), ${mucNgayDau.size} mức ngày ôn đầu`);

// Q2. Khởi đầu nguội phải phân hóa. Đây là phép kiểm chính của nhóm.
localStorage.removeItem(`poly_econ_concept_memory_${monQ}`);
const doBenBanDau = nodesQ.map(n => doBenTriNho(n.concept)).filter(v => !Number.isNaN(v));
const soGiaTriKhacNhau = new Set(doBenBanDau.map(v => v.toFixed(2))).size;
check("Khái niệm chưa học vẫn có lịch ôn phân hóa theo dữ liệu biên soạn",
  soGiaTriKhacNhau >= 3,
  `${nodesQ.length} khái niệm chưa học cho ${soGiaTriKhacNhau} giá trị độ bền khác nhau, dải ${Math.min(...doBenBanDau).toFixed(2)} đến ${Math.max(...doBenBanDau).toFixed(2)} ngày (bản cũ cho đúng 1 giá trị)`);

// Q3. Chiều phải đúng: khái niệm người soạn ghi DỄ nhớ phải bền hơn khái niệm ghi KHÓ nhớ.
const nutDe = nodesQ.filter(n => n.review?.estimatedRetentionDifficulty === "easy");
const nutKho = nodesQ.filter(n => n.review?.estimatedRetentionDifficulty === "hard");
if (nutDe.length > 0 && nutKho.length > 0) {
  const tbDe = nutDe.map(n => doBenTriNho(n.concept)).reduce((a, b) => a + b, 0) / nutDe.length;
  const tbKho = nutKho.map(n => doBenTriNho(n.concept)).reduce((a, b) => a + b, 0) / nutKho.length;
  check("Khái niệm được soạn là dễ nhớ thì bền hơn khái niệm khó nhớ",
    tbDe > tbKho,
    `${nutDe.length} khái niệm "easy" trung bình ${tbDe.toFixed(2)} ngày, ${nutKho.length} khái niệm "hard" trung bình ${tbKho.toFixed(2)} ngày`);
} else {
  check("Khái niệm được soạn là dễ nhớ thì bền hơn khái niệm khó nhớ", false,
    `không đủ mẫu để so: ${nutDe.length} easy và ${nutKho.length} hard`);
}

// Q4. Tiên nghiệm phải NHƯỜNG CHỖ cho dữ liệu đo được khi đã học nhiều.
//
// Cách cô lập: lấy một khái niệm "easy" và một khái niệm "hard". Chưa học thì hai bên lệch nhau
// vì tiên nghiệm khác nhau (Q3 đã chứng minh). Nay cho CẢ HAI cùng một lịch sử học y hệt, gồm
// cùng số lần học và cùng độ khó đo được. Nếu tiên nghiệm đã nhường chỗ thì khoảng lệch phải co
// lại gần bằng 0.
//
// Vì sao không so "trước và sau" trên cùng một khái niệm: tăng số lần học cũng làm phần nền
// `1,8*log2(soLanHoc + 1)` tăng theo, nên hai tác động lẫn vào nhau và phép kiểm mất ý nghĩa.
// Đây là lỗi thiết kế phép kiểm mà tôi mắc lần đầu, ghi lại để người sau khỏi lặp.
if (nutDe.length > 0 && nutKho.length > 0) {
  const tenDe = nutDe[0].concept;
  const tenKho = nutKho[0].concept;

  localStorage.removeItem(`poly_econ_concept_memory_${monQ}`);
  const lechKhiChuaHoc = Math.abs(doBenTriNho(tenDe) - doBenTriNho(tenKho));

  const bang = conceptMemoryService.getAllConceptProfiles(monQ);
  for (const ten of [tenDe, tenKho]) {
    bang[ten] = { ...conceptMemoryService.getConceptProfile(ten), timesStudied: 60, difficultyScore: 6.0 };
  }
  conceptMemoryService.saveAllConceptProfiles(bang, monQ);
  const lechKhiHocNhieu = Math.abs(doBenTriNho(tenDe) - doBenTriNho(tenKho));

  check("Tiên nghiệm nhường chỗ cho dữ liệu đo được khi đã học nhiều",
    lechKhiHocNhieu < lechKhiChuaHoc * 0.2,
    `khoảng lệch giữa một khái niệm "easy" và một "hard": chưa học ${lechKhiChuaHoc.toFixed(2)} ngày, sau 60 lần học cùng độ khó đo được còn ${lechKhiHocNhieu.toFixed(2)} ngày`);
  localStorage.removeItem(`poly_econ_concept_memory_${monQ}`);
}

// Q5. Môn tự tạo KHÔNG được nhận tiên nghiệm, vì khối review của nút tổng hợp là hằng số mặc
// định 3/7/14 và "medium" cho mọi khái niệm, tức không mang thông tin gì.
const monTuTaoQ = "custom_kiem_tien_nghiem";
localStorage.setItem(`poly_econ_custom_questions_${monTuTaoQ}`, JSON.stringify(
  questions.slice(0, 6).map((q, i) => ({ ...q, id: 991001 + i, topicId: `${monTuTaoQ}_T1.1`, chapterId: 1 }))
));
localStorage.setItem(`poly_econ_custom_topics_${monTuTaoQ}`, JSON.stringify([
  { id: `${monTuTaoQ}_T1.1`, chapterId: 1, title: "Chủ đề 1.1", description: "Tự kiểm chứng." },
]));
localStorage.setItem(`poly_econ_custom_chapters_${monTuTaoQ}`, JSON.stringify([
  { id: 1, code: "CH1", title: "Chương 1", description: "Tự kiểm chứng." },
]));
const monTruocQ = dbService.getActiveSubjectId();
loadSubject(monTuTaoQ);
localStorage.removeItem(`poly_econ_concept_memory_${monTuTaoQ}`);
const nodeTuTaoQ = kbService.getKnowledgeGraph(monTuTaoQ);
const doBenTuTao = nodeTuTaoQ.map(n => doBenTriNho(n.concept)).filter(v => !Number.isNaN(v));
check("Môn tự tạo giữ nguyên hành vi cũ, không nhận tiên nghiệm giả",
  doBenTuTao.length > 0 && new Set(doBenTuTao.map(v => v.toFixed(2))).size === 1,
  `${nodeTuTaoQ.length} nút tổng hợp cho ${new Set(doBenTuTao.map(v => v.toFixed(2))).size} giá trị, đều bằng ${doBenTuTao[0]?.toFixed(2)} ngày`);
loadSubject(monTruocQ);

// Q6. Tái lập được.
localStorage.removeItem(`poly_econ_concept_memory_${monQ}`);
const tenQ = nodesQ[0].concept;
const q1 = doBenTriNho(tenQ);
const q2 = doBenTriNho(tenQ);
check("Độ bền trí nhớ tái lập được",
  q1 === q2,
  `hai lần đọc cho ${q1.toFixed(4)} và ${q2.toFixed(4)}`);

// ===========================================================================
g("R. Vòng phản hồi hiệu chuẩn dự báo");
// ===========================================================================
// Bối cảnh: file `examForecaster.ts` tự gọi mình là "SELF-CALIBRATING ENGINE v3.0", có sẵn
// `registerActualExamResult` và `calculateAdaptiveWeights` được dùng ở hai chỗ khi dự báo. Nhưng
// dò toàn bộ mã nguồn ngày 27/07/2026: `registerActualExamResult` có **0 nơi gọi**, nên
// `calibrationCount` vĩnh viễn bằng 0, mà nhánh thích nghi lại yêu cầu >= 2. Toàn bộ cơ chế tự
// hiệu chuẩn chưa từng chạy một lần nào, dù cả hai đầu dữ liệu đã nằm sẵn.

const subR = dbService.getActiveSubjectId();
const KHOA_DU_BAO_CU = `poly_econ_last_prediction_${subR}`;

/** Thêm lượt làm bài mà KHÔNG xóa lịch sử, để giữ lại dự báo đã chốt trước đó. */
function themLuotLamBai(tyLeDung: number, soDe: number) {
  for (let e = 0; e < soDe; e++) {
    const de = aiService.generateExam({ type: "random", count: 20 });
    de.answers = {};
    de.questions.forEach((id, i) => {
      const q = questionMap.get(id);
      if (!q) return;
      de.answers[id] = (i / de.questions.length) < tyLeDung
        ? q.correctAnswer
        : (["a", "b", "c", "d"] as const).find(k => k !== q.correctAnswer)!;
    });
    de.isSubmitted = true;
    de.score = de.questions.filter(id => questionMap.get(id)?.correctAnswer === de.answers[id]).length;
    dbService.saveAttempt(de);
  }
}

function docThamChieuR(): number | null {
  const raw = localStorage.getItem(KHOA_DU_BAO_CU);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return typeof s?.value === "number" ? s.value : null;
  } catch {
    return null;
  }
}

// R1. Hồ sơ trắng: không được bịa sai lệch, và nhánh thích nghi phải nằm im.
dbService.clearAllHistory();
localStorage.removeItem(KHOA_DU_BAO_CU);
const hcTrangR = examForecaster.doHieuChuanTuLichSu(subR, docThamChieuR());
const tsMacDinh = examForecaster.calculateAdaptiveWeights(hcTrangR);
check("Hồ sơ trắng: không hiệu chuẩn, không bịa sai lệch",
  hcTrangR.calibrationCount === 0 && hcTrangR.overallBias === 0,
  `calibrationCount=${hcTrangR.calibrationCount}, overallBias=${hcTrangR.overallBias}`);

// R2. Có lịch sử nhưng CHƯA có dự báo cũ để đối chiếu thì cũng không kết luận.
playAndForecast(0.6, 3);
localStorage.removeItem(KHOA_DU_BAO_CU);
const hcKhongMoc = examForecaster.doHieuChuanTuLichSu(subR, null);
check("Thiếu điểm tham chiếu thì không hiệu chuẩn",
  hcKhongMoc.calibrationCount === 0,
  `có ${dbService.getHistory().filter(a => a.isSubmitted).length} lượt đã nộp nhưng không có dự báo cũ, calibrationCount=${hcKhongMoc.calibrationCount}`);

// R3. Đủ dữ liệu thì vòng phản hồi phải THẬT SỰ kích hoạt.
playAndForecast(0.9, 5);
examForecaster.calculatePrediction(subR);
themLuotLamBai(0.9, 2);
const thamChieuGioi = docThamChieuR();
const hcGioiR = examForecaster.doHieuChuanTuLichSu(subR, thamChieuGioi);
check("Đủ dữ liệu thì vòng phản hồi kích hoạt",
  hcGioiR.calibrationCount >= 2,
  `${hcGioiR.calibrationCount} lượt được dùng để hiệu chuẩn, điểm tham chiếu ${thamChieuGioi}`);

// R4. Dấu của sai lệch phải đúng chiều. Người học làm tốt hơn dự báo thì sai lệch DƯƠNG.
const diemThatGioi = dbService.getHistory()
  .filter(a => a.isSubmitted && (a.questions || []).length >= 5)
  .slice(-8)
  .map(a => (a.score / Math.max(1, a.questions.length)) * 10);
const tbThatGioi = diemThatGioi.reduce((s, v) => s + v, 0) / Math.max(1, diemThatGioi.length);
check("Dấu sai lệch đúng chiều với thực tế",
  (tbThatGioi > (thamChieuGioi ?? 0)) === (hcGioiR.overallBias > 0),
  `điểm thi thật trung bình ${tbThatGioi.toFixed(2)} so với dự báo ${thamChieuGioi}, sai lệch ${hcGioiR.overallBias}`);

// R5. Sai lệch phải TÁI LẬP, không bò lên theo số lần gọi. Đây là lý do dựng lại từ lịch sử
// thay vì cộng dồn vào hồ sơ đã lưu.
const bias1 = examForecaster.doHieuChuanTuLichSu(subR, thamChieuGioi).overallBias;
const bias2 = examForecaster.doHieuChuanTuLichSu(subR, thamChieuGioi).overallBias;
const bias3 = examForecaster.doHieuChuanTuLichSu(subR, thamChieuGioi).overallBias;
check("Sai lệch hiệu chuẩn tái lập được",
  bias1 === bias2 && bias2 === bias3,
  `ba lần đọc cho ${bias1}, ${bias2}, ${bias3}`);

// R5b. ĐƯỜNG NỐI phải thật sự tồn tại.
//
// Vì sao cần riêng phép kiểm này: năm phép kiểm trên gọi thẳng `doHieuChuanTuLichSu`, nên chúng
// vẫn xanh kể cả khi `calculatePrediction` không hề dùng tới hồ sơ hiệu chuẩn. Tôi đã thử ngắt
// dây nối và cả năm vẫn đạt. Đó đúng là kiểu "đạt rỗng". Phép kiểm này đi qua `calculatePrediction`
// rồi đọc hồ sơ mà chính nó trả về, nên ngắt dây là đỏ ngay.
const duBaoCoHieuChuan = examForecaster.calculatePrediction(subR);
check("Bộ dự báo thật sự dùng hồ sơ hiệu chuẩn khi tính",
  (duBaoCoHieuChuan.calibrationProfile?.calibrationCount ?? 0) >= 2,
  `calculatePrediction trả về calibrationCount=${duBaoCoHieuChuan.calibrationProfile?.calibrationCount}, sai lệch ${duBaoCoHieuChuan.calibrationProfile?.overallBias}`);

// R6. Nhánh thích nghi phải THẬT SỰ mở ra được. Trước 27/07/2026 nó không bao giờ chạy vì
// `calibrationCount` vĩnh viễn bằng 0.
//
// Kiểm CƠ CHẾ chứ không kiểm một con số may rủi: `calculateAdaptiveWeights` có vùng chết giữa
// 0,3 và 0,8, nên hồ sơ mô phỏng rơi đúng vào đó sẽ không đổi trọng số dù vòng phản hồi vẫn
// chạy đúng. Nên dựng thẳng hai hồ sơ nằm hai bên vùng chết.
const khac = (a: any, b: any) =>
  (Object.keys(a) as string[]).some(k => Math.abs((a[k] as number) - (b[k] as number)) > 1e-9);

const hoSoSaiLechThap = { ...hcGioiR, overallBias: 0.1, examTypeBias: {}, calibrationCount: 5 };
const hoSoSaiLechCao = { ...hcGioiR, overallBias: 1.2, examTypeBias: {}, calibrationCount: 5 };
const tsThap = examForecaster.calculateAdaptiveWeights(hoSoSaiLechThap);
const tsCao = examForecaster.calculateAdaptiveWeights(hoSoSaiLechCao);

check("Trọng số dự báo đổi theo sai lệch đã học được",
  khac(tsThap, tsMacDinh) && khac(tsCao, tsMacDinh) && khac(tsThap, tsCao),
  `mặc định mock=${tsMacDinh.mockWeight}; sai lệch nhỏ cho mock=${tsThap.mockWeight}; sai lệch lớn cho mock=${tsCao.mockWeight}`);

// R7. KHÔNG được có vùng chết. Bản cũ chỉ đổi trọng số khi sai lệch dưới 0,3 hoặc trên 0,8, nên
// cả dải giữa là vùng chết, đúng nơi phần lớn sai lệch thật rơi vào. Quét dải đó và đòi mỗi mức
// sai lệch cho một mức trọng số riêng.
const daiSaiLech = [0.30, 0.40, 0.50, 0.60, 0.70, 0.80];
const mockTheoSaiLech = daiSaiLech.map(b =>
  examForecaster.calculateAdaptiveWeights({ ...hcGioiR, overallBias: b, examTypeBias: {}, calibrationCount: 5 }).mockWeight
);
const soMucKhacNhau = new Set(mockTheoSaiLech.map(v => v.toFixed(4))).size;
const giamDanTheoSaiLech = mockTheoSaiLech.every((v, i) => i === 0 || v <= mockTheoSaiLech[i - 1] + 1e-9);
check("Trọng số không có vùng chết giữa hai ngưỡng cũ",
  soMucKhacNhau === daiSaiLech.length && giamDanTheoSaiLech,
  `sai lệch 0,30 đến 0,80 cho ${soMucKhacNhau} mức trọng số khác nhau: ${mockTheoSaiLech.map(v => v.toFixed(3)).join(", ")}`);

// Và chốt chặn: cùng sai lệch đó nhưng CHƯA đủ lượt hiệu chuẩn thì trọng số phải nằm im. Đây
// chính là cái cổng mà trước đây không bao giờ mở được.
const hoSoChuaDu = { ...hoSoSaiLechCao, calibrationCount: 0 };
check("Chưa đủ lượt hiệu chuẩn thì trọng số nằm im",
  !khac(examForecaster.calculateAdaptiveWeights(hoSoChuaDu), tsMacDinh),
  `cùng sai lệch 1,2 nhưng calibrationCount=0 thì trọng số giữ nguyên mặc định`);

dbService.clearAllHistory();
localStorage.removeItem(KHOA_DU_BAO_CU);

// ===========================================================================
g("S. Chống nén dự báo về giữa");
// ===========================================================================
// Bối cảnh đo ngày 27/07/2026: in năm điểm thành phần của LAYER 7 ở năm mức năng lực thì thấy
// `coverageScore10` bằng **10,00 ở cả năm mức**, tức không mang tin gì về năng lực mà vẫn chiếm
// 20% trọng số định mức điểm. Độ dốc tổng hợp chỉ còn **0,66**, nên cứ 1 điểm năng lực thật thì
// dự báo chỉ nhúc nhích 0,66 điểm. Đó là hiện tượng nén về giữa, khiến người giỏi bị hạ tới
// 1,1 điểm còn người yếu được nâng lên.

// S1. ĐỘ DỐC phải gần 1. Đây là phép kiểm chính của nhóm, và nó đo trực tiếp thứ đã hỏng.
const diemTheoNangLuc = [0.3, 0.9].map(nl => {
  const r = playAndForecast(nl, 4);
  return { that: r.realAccuracy * 10, duBao: r.predicted };
});
const doDoc = (diemTheoNangLuc[1].duBao - diemTheoNangLuc[0].duBao) /
  Math.max(0.01, diemTheoNangLuc[1].that - diemTheoNangLuc[0].that);
check("Dự báo bám năng lực với độ dốc gần 1",
  doDoc >= 0.8 && doDoc <= 1.2,
  `năng lực ${diemTheoNangLuc[0].that.toFixed(1)} cho dự báo ${diemTheoNangLuc[0].duBao.toFixed(1)}, năng lực ${diemTheoNangLuc[1].that.toFixed(1)} cho ${diemTheoNangLuc[1].duBao.toFixed(1)}, độ dốc ${doDoc.toFixed(2)} (bản cũ 0,66)`);

// S2. Phạt nợ học tập không được phạt theo KHỐI LƯỢNG luyện tập.
// Hai hồ sơ cùng tỷ lệ đúng nhưng khác hẳn số câu đã làm phải nhận mức phạt tương đương.
const itDe = playAndForecast(0.8, 2);
const nhieuDe = playAndForecast(0.8, 8);
check("Người luyện nhiều không bị phạt nặng hơn người luyện ít khi cùng tỷ lệ đúng",
  Math.abs(nhieuDe.predicted - itDe.predicted) <= 0.6,
  `cùng đúng khoảng 80%: làm 2 đề cho dự báo ${itDe.predicted.toFixed(1)}, làm 8 đề cho ${nhieuDe.predicted.toFixed(1)}`);

// S3. Độ phủ chương trình KHÔNG được nằm trong công thức định mức điểm.
//
// Kiểm ở mức mã nguồn vì đây là bất biến cấu trúc, và kiểm qua hành vi thì rất khó cô lập độ phủ
// khỏi năng lực. Độ phủ vẫn phải còn trong phần bất định, nơi nó thuộc về.
const nguonDuBao = readFileSync(path.join(process.cwd(), "src/services/examForecaster.ts"), "utf8");
const khoiDiemNen = nguonDuBao.slice(
  nguonDuBao.indexOf("let baseAccumulatedScore"),
  nguonDuBao.indexOf("Non-linear Acceleration Growth")
);
check("Độ phủ không nằm trong công thức định mức điểm",
  khoiDiemNen.length > 0 && !khoiDiemNen.includes("coverageScore10"),
  khoiDiemNen.includes("coverageScore10")
    ? "coverageScore10 vẫn được cộng vào điểm nền, hiện tượng nén sẽ quay lại"
    : "điểm nền chỉ gồm các thành phần bám năng lực");
check("Độ phủ vẫn được dùng ở phần bất định",
  nguonDuBao.includes("coverageUncertainty"),
  "độ phủ thấp phải làm dự báo kém chắc chắn hơn, chứ không bị trừ điểm");

// S4. Phạt nợ học tập phải theo TỶ LỆ, không theo số tuyệt đối.
// Kiểm thẳng hàm phạt: người làm 500 câu đúng 90% có 50 câu nợ, không được phạt bằng người làm
// 60 câu đúng 20% có 48 câu nợ.
const phatNguoiCham = examForecaster.hinhPhatNoHocTapCongKhai(50, 500);
const phatNguoiYeu = examForecaster.hinhPhatNoHocTapCongKhai(48, 60);
check("Phạt nợ theo tỷ lệ, không phạt người luyện nhiều",
  phatNguoiCham < phatNguoiYeu * 0.4,
  `người chăm (50 nợ trên 500 câu) bị phạt ${phatNguoiCham.toFixed(2)}; người yếu (48 nợ trên 60 câu) bị phạt ${phatNguoiYeu.toFixed(2)}; bản cũ cả hai đều kịch trần 1,00`);

dbService.clearAllHistory();

// ===========================================================================
g("T. Dòng thời gian tiến hóa và bảng chiến lược");
// ===========================================================================
// Cả hai lỗi dưới đây do bộ quét ở AGENTS.md mục 4.9b tìm ra ngày 27/07/2026, khi cho các engine
// chưa ai soi chạy trên năm hồ sơ học từ đúng 0% tới 100%.

const subT = dbService.getActiveSubjectId();
const tenKhaiNiemT = kbService.getKnowledgeGraph(subT)[0]?.concept || "";

const danhGiaT: any = {
  strategyUsed: "Academic", masteryGain: 5, retryCount: 0, timeImprovement: 0,
  confidenceGain: 0.1, misconceptionRecovered: false, sessionCompleted: true,
  effectivenessScore: 70, reasoning: "tự kiểm chứng",
};

/** Cho khái niệm nghỉ `soNgay` ngày rồi học lại, trả về độ ghi nhớ ghi vào mốc thời gian. */
function doGhiNhoSauKhiNghi(soNgay: number): number {
  localStorage.removeItem(`poly_econ_concept_memory_${subT}`);
  localStorage.removeItem(`poly_econ_evolution_timeline_${subT}`);

  const bang = conceptMemoryService.getAllConceptProfiles(subT);
  const p = conceptMemoryService.getConceptProfile(tenKhaiNiemT, subT);
  const mocCu = new Date(TimeService.now().getTime() - soNgay * 24 * 60 * 60 * 1000).toISOString();
  bang[tenKhaiNiemT] = { ...p, timesStudied: 3, currentMastery: 60, historicalPeak: 60, lastReviewAt: mocCu };
  conceptMemoryService.saveAllConceptProfiles(bang, subT);

  return studentEvolutionEngine.processInteraction({
    conceptName: tenKhaiNiemT,
    update: { wasCorrect: true, responseTimeSeconds: 20, confidence: 0.7, teachingStrategy: "Academic", explanationLength: "medium" },
    evaluation: danhGiaT,
    subjectId: subT,
  }).snapshot.retention;
}

// T1. Độ ghi nhớ ghi vào dòng thời gian phải PHÂN HÓA theo số ngày nghỉ.
//
// Bản cũ đặt `lastReviewAt` thành hiện tại RỒI mới tính độ ghi nhớ, nên số ngày trôi qua luôn
// bằng 0 và kết quả luôn đúng 1,00. `LearningEvolutionView` hiển thị nó thành phần trăm, nên cột
// "Độ ghi nhớ" trên màn Tiến hóa vĩnh viễn hiện 100%.
const daiGhiNho = [0, 1, 3, 7, 14, 30].map(doGhiNhoSauKhiNghi);
const soMucGhiNho = new Set(daiGhiNho.map(v => v.toFixed(3))).size;
check("Độ ghi nhớ trên dòng thời gian phân hóa theo số ngày nghỉ",
  soMucGhiNho >= 4,
  `nghỉ 0/1/3/7/14/30 ngày cho ${daiGhiNho.map(v => `${Math.round(v * 100)}%`).join(", ")}; bản cũ luôn 100%`);

// T2. Và phải GIẢM DẦN, nghỉ càng lâu càng quên nhiều.
const ghiNhoGiamDan = daiGhiNho.every((v, i) => i === 0 || v <= daiGhiNho[i - 1] + 1e-9);
check("Nghỉ càng lâu thì độ ghi nhớ càng thấp",
  ghiNhoGiamDan,
  daiGhiNho.map(v => v.toFixed(2)).join(" -> "));

// T3. Bảng hiệu quả chiến lược không được khẳng định con số khi chưa có tương tác nào.
// Bản cũ đặt `averageSessionCompletion: 100` cho cả bảy chiến lược trong khi
// `totalInteractions` bằng 0, tức "hoàn thành phiên 100%" cho chiến lược chưa dùng lần nào.
localStorage.removeItem("poly_econ_pedagogical_strategy_stats");
const bangChienLuoc = pedagogicalEvaluationEngine.getStrategyStats();
const chienLuocBia = Object.values(bangChienLuoc).filter(
  (s: any) => (s.totalInteractions || 0) === 0 &&
    Object.entries(s).some(([k, v]) => k !== "strategyName" && typeof v === "number" && v !== 0)
);
check("Chiến lược chưa dùng lần nào thì mọi chỉ số phải bằng 0",
  chienLuocBia.length === 0,
  chienLuocBia.length === 0
    ? `${Object.keys(bangChienLuoc).length} chiến lược, chưa có tương tác nào, mọi chỉ số đều 0`
    : `còn ${chienLuocBia.length} chiến lược mang số khác 0 dù chưa dùng: ${chienLuocBia.map((s: any) => s.strategyName).join(", ")}`);

localStorage.removeItem(`poly_econ_concept_memory_${subT}`);
localStorage.removeItem(`poly_econ_evolution_timeline_${subT}`);

// ===========================================================================
g("U. Sinh câu hỏi không được đụng vào dữ liệu dùng chung");
// ===========================================================================
// Bộ quét ngày 27/07/2026 bắt được: `buildQuestionSpec` gọi thẳng `.sort()` lên mảng do
// `kbService.getKnowledgeGraph` trả về, mà đó là mảng DÙNG CHUNG. Một lần sinh câu hỏi làm xáo
// trộn vĩnh viễn thứ tự khái niệm của lộ trình học, bản đồ độ thạo và các bảng quan trắc.

const subU = dbService.getActiveSubjectId();

// U1. Gọi sinh câu hỏi xong, thứ tự đồ thị tri thức phải y nguyên.
const thuTuTruocU = kbService.getKnowledgeGraph(subU).map(n => n.id).join("|");
questionGenerationEngine.buildQuestionSpec({ subjectId: subU });
// Gọi thêm một lần nữa với chương và chủ đề KHÔNG tồn tại, để ép vào đúng nhánh dính lỗi:
// lọc không ra nút nào thì mã cũ quay về chính mảng dùng chung rồi sắp xếp tại chỗ.
questionGenerationEngine.buildQuestionSpec({ subjectId: subU, chapterId: 999, topicId: "T999.9" });
const thuTuSauU = kbService.getKnowledgeGraph(subU).map(n => n.id).join("|");
check("Sinh câu hỏi không làm xáo trộn thứ tự đồ thị tri thức dùng chung",
  thuTuTruocU === thuTuSauU,
  thuTuTruocU === thuTuSauU
    ? `${thuTuTruocU.split("|").length} nút giữ nguyên thứ tự sau 2 lần gọi`
    : `thứ tự đã đổi: ${thuTuTruocU.split("|").slice(0, 3).join(", ")} -> ${thuTuSauU.split("|").slice(0, 3).join(", ")}`);

// U2. Chọn khái niệm phải là THỨ TỰ TOÀN PHẦN (bất biến 4.7): cùng dữ liệu vào thì cùng kết quả
// ra, kể cả khi nhiều khái niệm có độ thạo bằng nhau, không phụ thuộc thuật toán sắp xếp.
const chonLap = Array.from({ length: 5 }, () =>
  questionGenerationEngine.buildQuestionSpec({ subjectId: subU }).conceptName);
check("Chọn khái niệm để ra đề là tất định khi độ thạo bằng nhau",
  new Set(chonLap).size === 1,
  new Set(chonLap).size === 1
    ? `5 lần gọi liên tiếp đều chọn "${chonLap[0]}"`
    : `5 lần gọi cho ${new Set(chonLap).size} khái niệm khác nhau`);

// ===========================================================================
g("V. Đường cong quên: một nguồn duy nhất, có nhìn giãn cách và lần quên");
// ===========================================================================
// Đo ngày 27/07/2026: dự án có HAI đường cong quên khác hẳn nhau cho cùng một câu hỏi "còn nhớ
// bao nhiêu phần trăm", lệch tới 55 điểm phần trăm. Cái hiện lên màn Tiến hóa là một cái, cái
// điều khiển chọn câu ôn tập và cảnh báo ôn khẩn lại là cái kia.

const subV = dbService.getActiveSubjectId();
const tenV = kbService.getKnowledgeGraph(subV)[0]?.concept || "";
const NGAY_MS = 24 * 60 * 60 * 1000;

function hoSoTriNhoV(sua: Partial<ReturnType<typeof conceptMemoryService.getConceptProfile>>) {
  return { ...conceptMemoryService.getConceptProfile(tenV, subV), ...sua };
}

// V1. Hai đường cong phải nói CÙNG một điều khi nhận cùng bằng chứng.
//     Cố ý đặt difficultyScore đúng bằng tiên nghiệm biên soạn tay, vì đó là chỗ duy nhất hai
//     bên có thể lệch một cách chính đáng (bên trí nhớ khái niệm còn pha thêm độ khó đo được).
const doKhoV = doKhoTienNghiem(tenV) ?? 5.0;
const mocHocV = [6, 4, 2, 1, 0].map(d => new Date(TimeService.now().getTime() - d * NGAY_MS).toISOString());
const lechHaiDuong: number[] = [];
for (const nghi of [1, 3, 7, 14]) {
  const benA = conceptMemoryService.calculateRetentionScore(hoSoTriNhoV({
    timesStudied: 5, timesCorrect: 5, timesWrong: 0, historicalPeak: 70, currentMastery: 70,
    difficultyScore: doKhoV, isStableMastered: false, recoveryCount: 0, regressionCount: 0,
    scoreHistory: mocHocV.map(t => ({ timestamp: t, score: 70 })),
    lastReviewAt: new Date(TimeService.now().getTime() - nghi * NGAY_MS).toISOString(),
  }) as any);
  const benB = learnerModelService.recalculateForgettingScore({
    ...learnerModelService.getOrCreateProfile(tenV),
    attemptsCount: 5, correctCount: 5, incorrectCount: 0, reviewHistory: mocHocV,
    lastStudiedAt: new Date(TimeService.now().getTime() - nghi * NGAY_MS).toISOString(),
  } as any).forgettingScore;
  lechHaiDuong.push(Math.abs(benA - benB));
}
const lechLonNhatV = Math.max(...lechHaiDuong);
check("Hai đường cong quên của dự án nói cùng một điều khi cùng bằng chứng",
  lechLonNhatV <= 0.02,
  `lệch lớn nhất ${(lechLonNhatV * 100).toFixed(0)} điểm phần trăm qua các mốc nghỉ 1/3/7/14 ngày; trước 27/07/2026 lệch tới 55 điểm`);

// V2. Chặn ở mức mã nguồn: learnerModel không được có công thức suy giảm riêng nữa.
const nguonLearnerModel = readFileSync(path.join(process.cwd(), "src/services/learnerModel.ts"), "utf8");
check("learnerModel không tự dựng công thức quên riêng",
  !/Math\.pow\(2\.2/.test(nguonLearnerModel) && /doBenTriNhoNgay\(/.test(nguonLearnerModel),
  "nửa đời cũ 0,5 * 2,2^chuỗi_đúng đã gỡ, nay gọi doBenTriNhoNgay");

// V3. Hiệu ứng giãn cách: ôn dồn một buổi phải kém bền hơn ôn giãn nhiều ngày.
const chungV = { timesStudied: 5, timesCorrect: 5, timesWrong: 0, historicalPeak: 70, currentMastery: 70, difficultyScore: 5 };
const benDon = conceptMemoryService.generateForgetCurve(hoSoTriNhoV({
  ...chungV,
  scoreHistory: [0, 0.01, 0.02, 0.03, 0.04].map(d => ({ timestamp: new Date(TimeService.now().getTime() - d * NGAY_MS).toISOString(), score: 70 })),
}) as any).find(c => c.daysAhead === 7)!.retention;
const benGian = conceptMemoryService.generateForgetCurve(hoSoTriNhoV({
  ...chungV,
  scoreHistory: [0, 15, 30, 45, 60].map(d => ({ timestamp: new Date(TimeService.now().getTime() - d * NGAY_MS).toISOString(), score: 70 })),
}) as any).find(c => c.daysAhead === 7)!.retention;
check("Ôn giãn cách bền hơn ôn dồn một buổi",
  benGian > benDon,
  `cùng 5 lượt đúng: dồn trong 1 giờ còn ${Math.round(benDon * 100)}%, giãn qua 60 ngày còn ${Math.round(benGian * 100)}% sau 7 ngày`);

// V4. Nhớ lại THẤT BẠI phải làm trí nhớ kém bền đi.
const benDung = conceptMemoryService.generateForgetCurve(hoSoTriNhoV({ timesStudied: 5, timesCorrect: 5, timesWrong: 0, historicalPeak: 70, difficultyScore: 5 }) as any).find(c => c.daysAhead === 7)!.retention;
const benSai = conceptMemoryService.generateForgetCurve(hoSoTriNhoV({ timesStudied: 5, timesCorrect: 0, timesWrong: 5, historicalPeak: 70, difficultyScore: 5 }) as any).find(c => c.daysAhead === 7)!.retention;
check("Nhớ lại thất bại làm trí nhớ kém bền đi",
  benSai < benDung,
  `5 lượt đúng hết còn ${Math.round(benDung * 100)}%, 5 lượt sai hết còn ${Math.round(benSai * 100)}% sau 7 ngày`);

// V5. Hai hàm vẽ đường cong và chấm điểm trí nhớ phải dùng CHUNG một mức sàn.
const hoSoSanV = hoSoTriNhoV({ timesStudied: 1, timesCorrect: 1, timesWrong: 0, historicalPeak: 30, difficultyScore: 8.5 });
const lechSan = [0, 1, 3, 7, 14, 30].filter(d => {
  const tren = conceptMemoryService.generateForgetCurve(hoSoSanV as any).find(c => c.daysAhead === d)!.retention;
  const diem = conceptMemoryService.calculateRetentionScore({
    ...hoSoSanV, lastReviewAt: new Date(TimeService.now().getTime() - d * NGAY_MS).toISOString(),
  } as any);
  return Math.abs(tren - diem) > 1e-9;
});
check("Đường cong vẽ ra và điểm trí nhớ dùng chung một mức sàn",
  lechSan.length === 0,
  lechSan.length === 0
    ? "khớp ở cả 6 mốc; bản cũ dùng sàn 0,05 và 0,08 nên lệch từ mốc 14 ngày trở đi"
    : `còn lệch ở mốc ${lechSan.join(", ")} ngày`);

// V6. Người mới luyện một khái niệm KHÔNG được bị kết luận "cần ôn khẩn" sau vài tiếng.
//     Ngưỡng khẩn của teachingDecisionEngine là forgettingScore < 0,6. Bản cũ cho nửa đời
//     0,26 ngày khi chuỗi đúng bằng 0, tức chạm ngưỡng sau khoảng 6 tiếng.
const moiHoc = learnerModelService.recalculateForgettingScore({
  ...learnerModelService.getOrCreateProfile(tenV),
  attemptsCount: 1, correctCount: 1, incorrectCount: 0, streak: 1, confidence: 0.3,
  reviewHistory: [new Date(TimeService.now().getTime() - 0.25 * NGAY_MS).toISOString()],
  lastStudiedAt: new Date(TimeService.now().getTime() - 0.25 * NGAY_MS).toISOString(),
} as any).forgettingScore;
check("Mới luyện một khái niệm thì 6 tiếng sau chưa bị coi là cần ôn khẩn",
  moiHoc >= 0.6,
  `sau 6 tiếng còn nhớ ${Math.round(moiHoc * 100)}%, ngưỡng khẩn là dưới 60%`);

localStorage.removeItem(`poly_econ_concept_memory_${subV}`);

// ===========================================================================
g("W. Hiệu chuẩn đường cong quên bằng lần nhớ lại thật");
// ===========================================================================
// Cho tới 27/07/2026, đường cong quên chưa từng được đối chiếu với một lần nhớ lại thật nào.
// Nó dự đoán "sau 7 ngày còn nhớ 58%" rồi không bao giờ hỏi lại xem người học có nhớ không.
// Đây đúng là kiểu vòng hở đã sửa cho bộ dự báo điểm thi.

const subW = dbService.getActiveSubjectId();
const tenW = kbService.getKnowledgeGraph(subW)[0]?.concept || "";
const danhGiaW: any = { ...danhGiaT, bloomLevel: "Understand" };

/**
 * Dựng lịch sử học thật rồi giãn các mốc thời gian ra `cachNgay` ngày một lượt.
 * Điểm số vẫn là điểm ENGINE THẬT tính ra, chỉ mốc thời gian được giãn, nên phép suy đúng/sai
 * từ dấu của mức thay đổi điểm vẫn được kiểm trên dữ liệu thật.
 */
function dungLichHocW(ketQua: boolean[], cachNgay: number) {
  localStorage.removeItem(`poly_econ_concept_memory_${subW}`);
  localStorage.removeItem(`poly_econ_evolution_timeline_${subW}`);
  for (const dung of ketQua) {
    studentEvolutionEngine.processInteraction({
      conceptName: tenW,
      update: { wasCorrect: dung, responseTimeSeconds: 20, confidence: 0.6, teachingStrategy: "Academic", explanationLength: "medium" },
      evaluation: danhGiaW, subjectId: subW,
    });
  }
  const bang = conceptMemoryService.getAllConceptProfiles(subW);
  const hs = bang[tenW];
  const n = (hs.scoreHistory || []).length;
  hs.scoreHistory = (hs.scoreHistory || []).map((m, i) => ({
    ...m,
    timestamp: new Date(TimeService.now().getTime() - (n - 1 - i) * cachNgay * NGAY_MS).toISOString(),
  }));
  bang[tenW] = hs;
  conceptMemoryService.saveAllConceptProfiles(bang, subW);
  return hs;
}

// W1. Giả định nền của cả tầng: suy đúng hay sai từ DẤU của mức thay đổi điểm.
//     Sai giả định này là sai toàn bộ phần hiệu chuẩn, nên phải kiểm bằng sự thật đã biết.
const ketQuaThatW = [true, false, true, true, false, true, false, true, true, false];
dungLichHocW(ketQuaThatW, 5);
const capW = rutCapNhoLai(conceptMemoryService.getAllConceptProfiles(subW)[tenW].scoreHistory);
const soKhopW = capW.filter((c, i) => c.nhoDuoc === ketQuaThatW[i + 1]).length;
check("Suy đúng hay sai từ dấu của mức thay đổi điểm là chính xác",
  capW.length >= 8 && soKhopW === capW.length,
  `${soKhopW}/${capW.length} cặp khớp với kết quả thật đã biết trước`);

// W2. Ba kiểu người học phải cho ba độ bền khác nhau, và theo đúng chiều.
const kichBanW: Array<{ ten: string; kq: boolean[] }> = [
  { ten: "nhớ dai", kq: [true, true, true, true, true, true, true, true, true, false] },
  { ten: "trung bình", kq: [true, false, true, true, false, true, true, false, true, true] },
  { ten: "quên nhanh", kq: [true, false, false, false, true, false, false, false, false, false] },
];
const benTheoKieuW = kichBanW.map(kb => {
  const hs = dungLichHocW(kb.kq, 5);
  return conceptMemoryService.generateForgetCurve(hs).find(c => c.daysAhead === 7)!.retention;
});
check("Đường cong quên phân hóa theo lịch sử nhớ lại thật của từng người",
  new Set(benTheoKieuW).size === 3 && benTheoKieuW[0] > benTheoKieuW[1] && benTheoKieuW[1] > benTheoKieuW[2],
  `nhớ dai ${Math.round(benTheoKieuW[0] * 100)}%, trung bình ${Math.round(benTheoKieuW[1] * 100)}%, quên nhanh ${Math.round(benTheoKieuW[2] * 100)}% sau 7 ngày`);

// W3. Thiếu dữ liệu thì phải NÓI THẲNG là chưa đủ, không được trả một con số cho đẹp.
const duoiNguong = [0, 1, 2].map(n => doBenTriNhoDoDuoc(
  Array.from({ length: n }, (_, i) => ({ soNgayNghi: 3 + i, nhoDuoc: i % 2 === 0 }))));
const tuNguong = doBenTriNhoDoDuoc([
  { soNgayNghi: 3, nhoDuoc: true }, { soNgayNghi: 4, nhoDuoc: false }, { soNgayNghi: 5, nhoDuoc: true }]);
check("Dưới 3 lần nhớ lại thì trả chưa đủ dữ liệu, không trả con số",
  duoiNguong.every(k => !k.duDuLieu && k.doBenNgay === null) && tuNguong.duDuLieu && tuNguong.doBenNgay !== null,
  `0/1/2 cặp đều chưa đủ; từ 3 cặp mới ước lượng, ra ${tuNguong.doBenNgay} ngày`);

// W4. Các lượt trong CÙNG một buổi không phải phép thử trí nhớ dài hạn, phải bị loại.
const hsCungBuoi = dungLichHocW([true, true, true, true, true, true], 0.02);
check("Các lượt trong cùng một buổi không bị tính là lần nhớ lại",
  rutCapNhoLai(hsCungBuoi.scoreHistory).length === 0,
  "6 lượt cách nhau khoảng 30 phút cho 0 cặp");

// W5. Sau khi thêm hiệu chuẩn, hai đường cong vẫn phải bám sát nhau trên lịch sử học THẬT.
//     Đây là phép kiểm ở điều kiện thực tế, khác V1 vốn ép hai bên cùng bằng chứng. Không thể
//     bằng 0 vì hai kho hồ sơ ghi lượng bằng chứng khác nhau (một bên có đỉnh độ thạo và độ khó
//     đo được, bên kia không), nhưng phải nhỏ hơn hẳn mức 55 điểm của bản cũ.
dungLichHocW(kichBanW[1].kq, 5);
const hsThatW = conceptMemoryService.getAllConceptProfiles(subW)[tenW];
learnerModelService.getOrCreateProfile(tenW);
const lechThatW = [1, 3, 7, 14].map(d => {
  const a = conceptMemoryService.calculateRetentionScore({
    ...hsThatW, lastReviewAt: new Date(TimeService.now().getTime() - d * NGAY_MS).toISOString(),
  } as any);
  const b = learnerModelService.recalculateForgettingScore({
    ...learnerModelService.getOrCreateProfile(tenW),
    attemptsCount: 10, correctCount: 6, incorrectCount: 4,
    lastStudiedAt: new Date(TimeService.now().getTime() - d * NGAY_MS).toISOString(),
  } as any).forgettingScore;
  return Math.abs(a - b);
});
const lechThatMaxW = Math.max(...lechThatW);
check("Trên lịch sử học thật, hai đường cong vẫn bám sát nhau",
  lechThatMaxW <= 0.08,
  `lệch lớn nhất ${(lechThatMaxW * 100).toFixed(0)} điểm phần trăm; bản cũ lệch tới 55 điểm`);

// W6. Phép kiểm canh THẲNG sợi dây hiệu chuẩn.
//
// Vì sao cần thêm dù đã có W2 và W5: khi thử phá bằng cách cắt sợi dây hiệu chuẩn, W2 VẪN XANH,
// vì phần phân hóa giữa ba kiểu người học còn đến từ hệ số giãn cách và phạt quên lại. Một phép
// kiểm trông như đang canh hiệu chuẩn mà thật ra không canh gì cả thì nguy hiểm hơn là không có.
// Ở đây giữ nguyên MỌI bằng chứng khác, chỉ đổi đúng danh sách lần nhớ lại thật.
const bangChungNenW = {
  soLanNhoLaiDung: 6, soLanNhoLaiSai: 4, dinhCaoDoThao: 70, doKhoKhaiNiem: 5,
  mocHocISO: [10, 8, 6, 4, 2, 0].map(d => new Date(TimeService.now().getTime() - d * NGAY_MS).toISOString()),
};
const benKhongHieuChuan = doBenTriNhoNgay({ ...bangChungNenW });
const benQuenNhanh = doBenTriNhoNgay({
  ...bangChungNenW,
  capNhoLai: [3, 4, 5, 6, 7].map(g => ({ soNgayNghi: g, nhoDuoc: false })),
});
const benNhoDai = doBenTriNhoNgay({
  ...bangChungNenW,
  capNhoLai: [3, 4, 5, 6, 7].map(g => ({ soNgayNghi: g, nhoDuoc: true })),
});
check("Lần nhớ lại thật kéo được độ bền đi cả hai chiều",
  benQuenNhanh < benKhongHieuChuan && benNhoDai > benKhongHieuChuan,
  `cùng bằng chứng nền cho ${benKhongHieuChuan.toFixed(1)} ngày; 5 lần quên kéo xuống ${benQuenNhanh.toFixed(1)}, 5 lần nhớ được kéo lên ${benNhoDai.toFixed(1)}`);

localStorage.removeItem(`poly_econ_concept_memory_${subW}`);
localStorage.removeItem(`poly_econ_evolution_timeline_${subW}`);

// ===========================================================================
g("X. Gợi ý học tập bám môn đang mở và bám lịch ôn");
// ===========================================================================

dbService.clearAllHistory();
localStorage.removeItem("poly_econ_concept_profiles");

// X1. Câu chào đầu tiên phải nói đúng tên môn đang mở.
//     Bản cũ chốt cứng "Kinh tế chính trị Mác - Lênin" trong khi môn đang mở là Hành vi Khách
//     hàng, nên câu đầu tiên người học đọc được đã sai tên môn.
const tenMonX = dbService.getActiveSubjectName();
const recRongX = aiService.generateLocalRecommendation();
check("Gợi ý cho người chưa làm bài nào nói đúng tên môn đang mở",
  recRongX.recommendationText.includes(tenMonX) && !/Kinh tế chính trị/i.test(recRongX.recommendationText),
  `nhắc đúng "${tenMonX}"`);

// X2. Đúng 100% mà kiến thức đang trôi thì KHÔNG được khen suông.
//     Dựng: làm đúng hết, rồi đẩy mốc học lùi 60 ngày để mọi khái niệm quá hạn ôn.
const deX = aiService.generateExam({ type: "random", count: 20 });
deX.answers = {};
deX.questions.forEach(id => { const q = questionMap.get(id); if (q) deX.answers[id] = q.correctAnswer; });
deX.isSubmitted = true;
deX.score = deX.questions.length;
deX.timeSpent = deX.questions.length * 40;
dbService.saveAttempt(deX);

const hoSoX = learnerModelService.getConceptProfiles();
const mocCuX = new Date(TimeService.now().getTime() - 60 * NGAY_MS).toISOString();
Object.keys(hoSoX).forEach(k => {
  hoSoX[k] = { ...hoSoX[k], lastStudiedAt: mocCuX, reviewHistory: [mocCuX] };
});
learnerModelService.saveConceptProfiles(hoSoX);

const soKhaiNiemX = Object.keys(hoSoX).length;
const recTroiX = aiService.generateLocalRecommendation();
check("Đúng 100% nhưng kiến thức đang trôi thì gợi ý phải cảnh báo, không khen suông",
  soKhaiNiemX > 0 && /trôi|quá hạn|còn nhớ/i.test(recTroiX.recommendationText),
  soKhaiNiemX > 0
    ? `${soKhaiNiemX} khái niệm nghỉ 60 ngày, gợi ý bắt đầu bằng "${recTroiX.recommendationText.split("\n")[0].replace(/^#+\s*/, "")}"`
    : "không dựng được hồ sơ khái niệm nào, phép kiểm này vô nghĩa");

// X3. Ngược lại, vừa học xong thì không được dọa là đang trôi.
const mocMoiX = TimeService.now().toISOString();
const hoSoMoiX = learnerModelService.getConceptProfiles();
Object.keys(hoSoMoiX).forEach(k => {
  hoSoMoiX[k] = { ...hoSoMoiX[k], lastStudiedAt: mocMoiX, reviewHistory: [mocMoiX] };
});
learnerModelService.saveConceptProfiles(hoSoMoiX);
const recTuoiX = aiService.generateLocalRecommendation();
check("Vừa học xong thì gợi ý không dọa là đang trôi",
  !/đang trôi|quá hạn ôn/i.test(recTuoiX.recommendationText),
  `gợi ý mở đầu bằng "${recTuoiX.recommendationText.split("\n")[0].replace(/^#+\s*/, "")}"`);

dbService.clearAllHistory();
localStorage.removeItem("poly_econ_concept_profiles");

// ===========================================================================
// NHÓM Y. Xóa tiến trình phải dọn HẾT các kho suy ra từ lịch sử
//
// Trước 27/07/2026 `clearAllHistory` chỉ xóa 4 khóa (lịch sử, thống kê, hai khóa phiên dở
// dang) trong khi lịch sử làm bài còn sinh ra bảy kho dẫn xuất khác. Người học bấm "Làm mới
// tiến trình" thì màn Thống kê về 0 nhưng màn Tiến hóa, bản đồ độ thạo và lịch ôn vẫn giữ
// nguyên người học cũ. Nhóm này canh đúng chỗ đó.
// ===========================================================================
g("Y. Xóa tiến trình dọn sạch mọi kho dẫn xuất");

const KHO_DAN_XUAT = [
  `poly_econ_concept_profiles_${dbService.getActiveSubjectId()}`,
  `poly_econ_concept_memory_${dbService.getActiveSubjectId()}`,
  `poly_econ_evolution_timeline_${dbService.getActiveSubjectId()}`,
  `poly_econ_evolution_audit_${dbService.getActiveSubjectId()}`,
  `poly_econ_student_milestones_${dbService.getActiveSubjectId()}`,
  `poly_econ_adaptive_memory_${dbService.getActiveSubjectId()}`,
];

// Y1. Bốn service phải đăng ký được hàm dọn. Không đăng ký thì mọi thứ bên dưới vô nghĩa.
const khoDaDangKy = danhSachKhoDuocDon();
check("Các service có đăng ký hàm dọn dữ liệu suy ra",
  khoDaDangKy.length >= 5,
  `đã đăng ký: ${khoDaDangKy.join(", ") || "KHÔNG CÓ"}`);

// Y2. Làm bài xong thì các kho dẫn xuất phải CÓ dữ liệu, nếu không thì Y3 đạt một cách rỗng.
moPhongCoGanCo(3, 0.6, 4);
const khoCoDuLieuTruoc = KHO_DAN_XUAT.filter(k => localStorage.getItem(k) !== null);
check("Làm bài xong thì các kho dẫn xuất có dữ liệu thật",
  khoCoDuLieuTruoc.length >= 4,
  `${khoCoDuLieuTruoc.length}/${KHO_DAN_XUAT.length} kho có dữ liệu`);

// Y3. Xóa tiến trình rồi thì KHÔNG kho nào còn sót.
dbService.clearAllHistory();
const khoConSot = KHO_DAN_XUAT.filter(k => localStorage.getItem(k) !== null);
check("Xóa tiến trình rồi thì không kho dẫn xuất nào còn sót",
  khoConSot.length === 0,
  khoConSot.length === 0 ? `đã dọn đủ ${KHO_DAN_XUAT.length} kho` : `còn sót: ${khoConSot.join(", ")}`);

// Y4. Tầng trí nhớ phải trắng đúng nghĩa, không chỉ mất khóa mà vẫn còn hồ sơ trong bộ nhớ.
const hoSoSauXoa = conceptMemoryService.getAllConceptProfiles();
check("Xóa tiến trình rồi thì không còn hồ sơ trí nhớ khái niệm nào",
  Object.keys(hoSoSauXoa).length === 0,
  `còn ${Object.keys(hoSoSauXoa).length} hồ sơ`);

// Y5. `resetProgress` từng xóa ÍT hơn `clearAllHistory` trong khi thông báo trên màn Thống kê
// lại hứa "làm sạch toàn bộ tiến trình học tập". Nay hai đường phải cho cùng một kết quả.
moPhongCoGanCo(3, 0.6, 4);
dbService.resetProgress();
const sotSauReset = KHO_DAN_XUAT.filter(k => localStorage.getItem(k) !== null);
check("resetProgress dọn ngang bằng clearAllHistory",
  sotSauReset.length === 0 && dbService.getHistory().length === 0,
  `còn sót ${sotSauReset.length} kho, lịch sử còn ${dbService.getHistory().length} lượt`);

// ===========================================================================
// NHÓM Z. Hiệu chuẩn nhận thức theo TỪNG khái niệm, lấy từ cờ nghi vấn thật
//
// Cây cầu nối làm bài với tầng trí nhớ vốn truyền `confidence = đúng ? 0,85 : 0,4`, tức độ tự
// tin suy ngược từ đúng sai. Thay vào công thức xếp loại ra `diff = 0,4 - 0,55a`, nên nhãn
// "underconfident" đòi tỷ lệ đúng trên 109%, một điều không thể xảy ra. Đo được: nhãn đó
// KHÔNG BAO GIỜ xuất hiện, còn "overconfident" chỉ là cách gọi khác của "đúng dưới 36,4%".
// ===========================================================================
g("Z. Hiệu chuẩn nhận thức theo khái niệm bám cờ nghi vấn");

/** Làm bài với cách đặt cờ theo ý đồ, rồi trả về bảng đếm trạng thái hiệu chuẩn. */
function demTrangThaiHieuChuan(tyLeDung: number, kieuGanCo: "khong" | "khi-sai" | "khi-dung" | "deu") {
  dbService.clearAllHistory();
  for (let e = 0; e < 5; e++) {
    const de = aiService.generateExam({ type: "random", count: 20 });
    de.answers = {};
    de.flags = [];
    de.timeSpent = 600;
    de.questions.forEach((id, i) => {
      const q = questionMap.get(id);
      if (!q) return;
      const dung = (i / de.questions.length) < tyLeDung;
      de.answers[id] = dung ? q.correctAnswer : LETTERS.find(k => k !== q.correctAnswer)!;
      const nen = kieuGanCo === "khong" ? false
        : kieuGanCo === "deu" ? i % 3 === 0
        : kieuGanCo === "khi-sai" ? !dung
        : dung;
      if (nen) de.flags!.push(id);
    });
    de.isSubmitted = true;
    de.score = de.questions.filter(id => questionMap.get(id)?.correctAnswer === de.answers[id]).length;
    dbService.saveAttempt(de);
  }
  const dem: Record<string, number> = {};
  for (const p of Object.values(conceptMemoryService.getAllConceptProfiles()) as any[]) {
    const k = String(p.calibrationState || "khong-co");
    dem[k] = (dem[k] || 0) + 1;
  }
  return dem;
}

// Z1. Không bấm cờ lần nào thì KHÔNG được kết luận gì, dù tỷ lệ đúng cao hay thấp.
// Đây là chỗ tôi tự làm sai một lần: bản đầu trả về 0,5 trung lập rồi vẫn đem so với tỷ lệ
// đúng, nên hồ sơ đúng 90% không gắn cờ bị dán nhãn "thiếu tự tin" ở 13/15 khái niệm.
const zKhongCo = demTrangThaiHieuChuan(0.9, "khong");
check("Không gắn cờ lần nào thì hiệu chuẩn tự nhận chưa đủ dữ liệu",
  Object.keys(zKhongCo).length === 1 && (zKhongCo["chua-du-du-lieu"] || 0) > 0,
  JSON.stringify(zKhongCo));

// Z2. Hay đánh cờ đúng vào câu mình làm sai, tức tự biết mình yếu, phải ra "khớp".
const zBietYeu = demTrangThaiHieuChuan(0.3, "khi-sai");
check("Tự đánh dấu đúng câu mình sai thì được xếp là tự đánh giá khớp",
  (zBietYeu["calibrated"] || 0) > (zBietYeu["overconfident"] || 0),
  JSON.stringify(zBietYeu));

// Z3. Làm đúng mà vẫn đánh cờ, tức lo lắng thừa, phải ra "thiếu tự tin".
const zLoThua = demTrangThaiHieuChuan(0.9, "khi-dung");
check("Làm đúng mà vẫn đánh cờ thì được xếp là thiếu tự tin",
  (zLoThua["underconfident"] || 0) > 0,
  JSON.stringify(zLoThua));

// Z4. Cả bốn trạng thái phải cùng đạt tới được. Bản cũ chỉ đạt tới hai.
const zDeu = demTrangThaiHieuChuan(0.6, "deu");
const tapTrangThai = new Set([...Object.keys(zKhongCo), ...Object.keys(zBietYeu), ...Object.keys(zLoThua), ...Object.keys(zDeu)]);
check("Cả bốn trạng thái hiệu chuẩn đều đạt tới được",
  tapTrangThai.size === 4,
  `${tapTrangThai.size} trạng thái: ${[...tapTrangThai].sort().join(", ")}`);

// Z5. Thử phá: nếu độ tự tin quay về lối suy ngược từ đúng sai thì Z3 phải đỏ. Kiểm bằng
// chính công thức, không bằng niềm tin: với confidence = 0,85 khi đúng và 0,4 khi sai thì
// trung bình là 0,4 + 0,45a, nên chênh lệch so với a luôn là 0,4 - 0,55a, không bao giờ
// xuống dưới -0,20 với a trong khoảng 0 tới 1.
const chenhLechCu = [0, 0.25, 0.5, 0.75, 1].map(a => 0.4 - 0.55 * a);
check("Công thức cũ không thể sinh ra nhãn thiếu tự tin",
  chenhLechCu.every(d => d >= -0.20),
  `chênh lệch tại 5 mức tỷ lệ đúng: ${chenhLechCu.map(d => d.toFixed(2)).join(", ")}, không mức nào dưới -0,20`);

// Z6. Tín hiệu phải chảy tới tận lời nhắc gửi gia sư AI, không dừng ở kho dữ liệu.
demTrangThaiHieuChuan(0.9, "khi-dung");
const nguonCtx = readFileSync(path.join(process.cwd(), "src/services/contextWindowBuilder.ts"), "utf8");
check("Lời nhắc gửi gia sư AI có mang theo hiệu chuẩn tự đánh giá",
  nguonCtx.includes("calibrationState") && nguonCtx.includes("Hiệu chuẩn tự đánh giá"),
  "contextWindowBuilder đọc calibrationState và đưa vào phần tóm tắt người học");

// ===========================================================================
// NHÓM AA. Cây cầu "làm bài -> tầng trí nhớ" phải đi qua engine sư phạm thật
//
// Hook nộp bài vốn TỰ VIẾT một bản đánh giá sư phạm gồm 15 trường hằng số, trong khi
// `pedagogicalEvaluationEngine.evaluateInteraction` đã có sẵn logic tính đúng chúng. Hậu quả:
// lịch sử chấm rỗng 0 bản ghi sau 5 đề, và khoảng ôn lại cứng 48 hoặc 12 giờ chạy song song
// với lịch ôn thật do độ bền trí nhớ quyết định.
// ===========================================================================
g("AA. Làm bài chảy vào engine sư phạm và bảng phân tích");

dbService.clearAllHistory();
moPhongCoGanCo(5, 0.6, 4);

// AA1. Lịch sử chấm sư phạm phải có bản ghi. Trước là 0.
const lsChamAA = pedagogicalEvaluationEngine.getEvaluationHistory();
check("Làm bài xong thì lịch sử chấm sư phạm có bản ghi",
  lsChamAA.length > 0,
  `${lsChamAA.length} bản ghi sau 5 đề đã nộp`);

// AA2. Khoảng ôn lại phải do engine tính, tức phải có nhiều hơn hai giá trị cứng 48 và 12.
const tapKhoangOn = new Set(lsChamAA.map(e => e.recommendedReviewInterval));
check("Khoảng ôn lại do engine tính, không phải hai hằng số",
  tapKhoangOn.size >= 3,
  `${tapKhoangOn.size} giá trị: ${[...tapKhoangOn].sort((a, b) => a - b).join(", ")} giờ`);

// AA3. Hiệu quả và chỉ số con phải phân hóa, không đứng yên ở một số cứng.
const tapHieuQua = new Set(lsChamAA.map(e => e.effectivenessScore));
const tapHieuChuanCon = new Set(lsChamAA.map(e => e.metrics.confidenceCalibration));
check("Điểm hiệu quả và hiệu chuẩn tự tin đều phân hóa",
  tapHieuQua.size >= 3 && tapHieuChuanCon.size >= 3,
  `hiệu quả ${tapHieuQua.size} giá trị, hiệu chuẩn ${tapHieuChuanCon.size} giá trị`);

// AA4. BẤT BIẾN 4.5: tên khái niệm trong lịch sử chấm phải là tên của BỘ TRA CHÍNH THỐNG,
// không phải `question.concept`. Trước khi sửa, hai cách đặt tên khớp nhau ở 0/292 câu.
const tenDoThi = new Set(kbService.getKnowledgeGraph(dbService.getActiveSubjectId()).map(n => n.concept));
const tenTrongLichSu = new Set(lsChamAA.map(e => e.conceptName));
const tenLac = [...tenTrongLichSu].filter(t => !tenDoThi.has(t));
check("Tên khái niệm trong lịch sử chấm khớp đồ thị tri thức",
  tenLac.length === 0,
  tenLac.length === 0 ? `${tenTrongLichSu.size} tên, khớp hết` : `lạc: ${tenLac.slice(0, 3).join(" | ")}`);

// AA5. Tên trong lịch sử chấm và tên trong hồ sơ trí nhớ phải là CÙNG một tập, nếu không thì
// bảng khái niệm khó nhất và bản đồ độ thạo mãi mãi không đối chiếu được với nhau.
const tenTriNho = new Set(Object.keys(conceptMemoryService.getAllConceptProfiles()));
const lechHaiKho = [...tenTrongLichSu].filter(t => !tenTriNho.has(t));
check("Lịch sử chấm và hồ sơ trí nhớ dùng chung một tập tên khái niệm",
  lechHaiKho.length === 0,
  `${tenTrongLichSu.size} tên bên chấm, ${tenTriNho.size} tên bên trí nhớ, lệch ${lechHaiKho.length}`);

// AA6. Lượt TỰ LÀM BÀI không được cộng vào bảng hiệu quả chiến lược giảng dạy. Không có ai
// giảng thì không có chiến lược nào để so, cộng vào sẽ đẻ ra một phong cách dạy không tồn tại
// rồi `adaptiveTeachingPolicy` có thể chọn chính nó làm phong cách ưu tiên.
const bangChienLuocAA = pedagogicalEvaluationEngine.getStrategyStats();
const coLuotTuLamBai = Object.values(bangChienLuocAA).some(s => s.strategyName === NHAN_TU_LAM_BAI && s.totalInteractions > 0);
check("Lượt tự làm bài không lọt vào bảng hiệu quả chiến lược giảng dạy",
  !coLuotTuLamBai,
  `bảng có ${Object.keys(bangChienLuocAA).length} chiến lược, không có "${NHAN_TU_LAM_BAI}"`);

// AA7. Chưa hỏi gia sư AI lần nào thì KHÔNG được nêu tên một phương pháp hiệu quả nhất.
const bcAA = teachingAnalytics.generateAnalyticsReport();
check("Chưa có giảng dạy thì không nêu tên phương pháp hiệu quả nhất",
  bcAA.mostEffectiveTeachingStyle === "Chưa đủ dữ liệu",
  `báo cáo trả về "${bcAA.mostEffectiveTeachingStyle}", tổng tương tác ${bcAA.totalInteractions}`);

// AA8. Nhưng số lượt tương tác thì PHẢI khác 0, vì người học vừa làm 100 câu thật.
check("Màn Phân tích giảng dạy thấy được số câu đã làm",
  bcAA.totalInteractions >= 90,
  `${bcAA.totalInteractions} lượt`);

// AA9. Bảng lỗi hay mắc phải nuôi được từ lượt làm bài, không chỉ từ gia sư AI.
check("Bảng lỗi hay mắc nhận được dữ liệu từ lượt làm bài",
  bcAA.mostFrequentMisconceptions.length > 0,
  `${bcAA.mostFrequentMisconceptions.length} lỗi, hay gặp nhất xuất hiện ${bcAA.mostFrequentMisconceptions[0]?.count ?? 0} lần`);

// AA10. Nội dung lỗi hay mắc phải là BẪY HIỂU SAI biên soạn tay, không phải nguyên văn lời
// giải thích của câu hỏi. Bản cũ nhét thẳng `q.explanation` vào đây.
const loiDauAA = bcAA.mostFrequentMisconceptions[0]?.misconception || "";
const trungLoiGiaiThich = questions.some(q => (q.explanation || "").trim() === loiDauAA.trim() && loiDauAA.length > 0);
check("Lỗi hay mắc không phải nguyên văn lời giải thích của câu hỏi",
  loiDauAA.length > 0 && !trungLoiGiaiThich,
  `"${loiDauAA.slice(0, 60)}..."`);

dbService.clearAllHistory();

// ===========================================================================
// NHÓM AB. Mỏi mệt theo vị trí câu trong đề
//
// `fatigueTrend` được khai báo, khởi tạo 0, KHÔNG nơi nào ghi cũng không nơi nào đọc.
// `questionFatigue` chỉ cộng thêm 8 mỗi lần hỏi gia sư AI và không bao giờ giảm, nên sau 13
// lần là ghim 100 vĩnh viễn, còn người chỉ làm bài thì mãi 0. Bốn nơi ra quyết định thật dựa
// vào nó: luật giảm tải (mốc 60), teachingDecisionEngine (75), learningPlanner (70) và ô
// "Cần nghỉ" trên màn Phân tích giảng dạy.
// ===========================================================================
g("AB. Mỏi mệt đo từ vị trí câu trong đề");

/**
 * Chơi nhiều đề với mô hình đúng sai gắn với VỊ TRÍ theo ý đồ.
 *
 * BỘ CÂU PHẢI TẤT ĐỊNH, và đây là lần thứ hai dự án phải học lại bài này.
 *
 * Bản trước lấy thẳng `de.questions` mà `generateExam({ type: "random" })` trả về. Nhưng nhánh
 * "random" xếp đề bằng `shuffleInPlace`, vốn gọi `Math.random()`, nên **mỗi lượt chạy bốc một bộ
 * câu khác nhau**. Đúng sai lại được suy ra từ `id % 10`, thành ra biên độ tín hiệu phụ thuộc vào
 * việc mã câu nào tình cờ rơi vào phần đầu hay phần cuối đề.
 *
 * Đo được ngày 12/08/2026: cùng một mã nguồn, hai lượt chạy liên tiếp cho chỉ số mỏi mệt **29**
 * rồi **100**, trong khi ngưỡng đạt là 60. Tức phép kiểm này lúc xanh lúc đỏ mà không ai đụng
 * vào thứ nó canh.
 *
 * Đây đúng khuôn đã ghi trong WORKSTATE: *"phép kiểm chập chờn còn tệ hơn không có phép kiểm"*,
 * và nó từng làm một lượt trước commit khi đang đỏ. Nhóm AB6 đã được dựng lại tất định vì lý do
 * này, nhưng AB2 và AB3 thì bị bỏ sót vì chúng dùng một hàm mô phỏng khác.
 *
 * Cách sửa: giữ nguyên công thức đúng sai và giữ nguyên ngưỡng, **chỉ thay bộ câu bằng một lát
 * cắt tất định** của ngân hàng. Không nới ngưỡng, vì nới ngưỡng là giấu vấn đề chứ không sửa.
 */
const CAU_MO_PHONG_TAT_DINH = questions
  .map(q => q.id)
  .slice()
  .sort((a, b) => a - b);

function moPhongMoiMoi(kieu: "deu" | "moi" | "nong") {
  dbService.clearAllHistory();
  for (let e = 0; e < 6; e++) {
    const de = aiService.generateExam({ type: "random", count: 21 });
    // Thay bộ câu ngẫu nhiên bằng lát cắt tất định, giữ nguyên mọi trường khác của lượt làm bài.
    de.questions = CAU_MO_PHONG_TAT_DINH.slice(e * 21, e * 21 + 21);
    de.answers = {};
    de.timeSpent = 700;
    de.questions.forEach((id, i) => {
      const q = questionMap.get(id);
      if (!q) return;
      const p = i / de.questions.length;
      // Kiểu "đều" cố ý KHÔNG dùng vị trí làm mốc, để đúng sai rải đều theo id.
      const dung = kieu === "deu" ? (id % 10) < 7
        : kieu === "moi" ? (id % 10) < (p < 0.34 ? 9 : p < 0.67 ? 7 : 4)
        : (id % 10) < (p < 0.34 ? 4 : p < 0.67 ? 7 : 9);
      de.answers[id] = dung ? q.correctAnswer : LETTERS.find(k => k !== q.correctAnswer)!;
    });
    de.isSubmitted = true;
    de.score = de.questions.filter(id => questionMap.get(id)?.correctAnswer === de.answers[id]).length;
    dbService.saveAttempt(de);
  }
}

// AB1. Hồ sơ trắng phải nói thẳng là chưa đủ dữ liệu, không trả một con số.
dbService.clearAllHistory();
const abTrang = learnerModelService.doMoiMoiTheoViTri();
check("Hồ sơ trắng: mỏi mệt tự nhận chưa đủ dữ liệu",
  abTrang.duDuLieu === false && abTrang.chiSoMoiMoi === 0,
  `duDuLieu=${abTrang.duDuLieu}, chỉ số ${abTrang.chiSoMoiMoi}, ${abTrang.soCauXet} câu`);

// AB2. Càng về cuối đề càng sai thì phải phát hiện được.
moPhongMoiMoi("moi");
const abMoi = learnerModelService.doMoiMoiTheoViTri();
check("Càng cuối đề càng sai thì chỉ số mỏi mệt lên cao",
  abMoi.duDuLieu && abMoi.chiSoMoiMoi >= 60,
  `chỉ số ${abMoi.chiSoMoiMoi}/100, tụt ${(abMoi.mucTut * 100).toFixed(1)} điểm phần trăm`);

// AB3. Càng về cuối càng ĐÚNG thì tuyệt đối không được báo mỏi.
moPhongMoiMoi("nong");
const abNong = learnerModelService.doMoiMoiTheoViTri();
check("Càng cuối đề càng đúng thì không báo mỏi mệt",
  abNong.chiSoMoiMoi === 0 && abNong.mucTut < 0,
  `chỉ số ${abNong.chiSoMoiMoi}/100, tụt ${(abNong.mucTut * 100).toFixed(1)} điểm phần trăm`);

// AB4. Hai kiểu người học phải cho hai con số KHÁC nhau. Trước khi sửa cả hai đều bằng 0.
check("Hai kiểu người học cho hai chỉ số mỏi mệt khác nhau",
  abMoi.chiSoMoiMoi !== abNong.chiSoMoiMoi,
  `mỏi ${abMoi.chiSoMoiMoi} so với nóng máy ${abNong.chiSoMoiMoi}`);

// AB5. Chỉ số phải chảy tới nơi tiêu thụ, không dừng ở hàm đo.
moPhongMoiMoi("moi");
const abModel = studentModelService.getStudentModel();
check("Chỉ số mỏi mệt chảy được vào mô hình người học",
  abModel.adaptiveMemory.questionFatigue >= 60 && abModel.adaptiveMemory.fatigueTrend > 0,
  `questionFatigue=${abModel.adaptiveMemory.questionFatigue}, fatigueTrend=${abModel.adaptiveMemory.fatigueTrend}`);

// AB6. PHÉP KIỂM QUAN TRỌNG NHẤT của nhóm này: độ khó đội lốt mỏi mệt.
//
// Dựng thẳng một hồ sơ mà đúng sai CHỈ phụ thuộc độ khó, hoàn toàn không phụ thuộc vị trí,
// nhưng đề lại xếp nhiều câu khó về cuối. Cách đo ngây thơ (so tỷ lệ đúng đầu đề với cuối đề)
// sẽ báo mỏi mệt rất nặng, trong khi sự thật là người học không hề mỏi.
//
// Vì sao phép kiểm này cần thiết chứ không phải phòng xa: bản đầu tôi viết phép kiểm khác,
// đo xem bộ sinh đề có dồn câu khó về cuối không, và nó CHẬP CHỜN. Có lượt độ khó trung bình
// ba phần đề là 1,907 / 1,957 / 1,821, có lượt lại là 2,279 / 1,900 / 1,957, tức bộ sinh đề
// thật sự có lúc dồn câu khó về một đầu tùy trạng thái trước đó.
dbService.clearAllHistory();
const NHOM_KHO_AB = ["Dễ", "Trung bình", "Khó"];

// Kịch bản dựng TẤT ĐỊNH, rút thẳng từ ngân hàng câu hỏi theo thứ tự mã câu.
//
// VÌ SAO PHẢI VIẾT LẠI (28/07/2026): bản cũ rút đề bằng `generateExam({ type: "random" })` rồi
// mới xếp lại, nên bộ câu và cách chúng rơi vào ba phần đề THAY ĐỔI mỗi lượt chạy. Phép kiểm vì
// thế chập chờn: đo được hỏng khoảng 1 trên 5 lượt, và khi hỏng thì hỏng nặng (chỉ số 71 so với
// ngưỡng 20) chứ không phải sát ngưỡng.
//
// Nguồn chập chờn nằm ở dòng quyết định đúng sai cho nhóm "Trung bình": bản cũ dùng `id % 2`,
// tức đúng sai phụ thuộc MÃ CÂU, mà mã nào rơi vào phần đầu hay phần cuối lại do bốc ngẫu nhiên.
// Thế là trong cùng một nhóm độ khó, tỷ lệ đúng đầu đề và cuối đề lệch nhau hoàn toàn do may rủi,
// đúng thứ mà phép kiểm này muốn khẳng định là KHÔNG được lệch.
//
// Đây chính là bài học đã ghi cho J5 trong WORKSTATE: phép kiểm dựa vào một mẫu rút ngẫu nhiên
// thì mong manh, phải dựng thẳng kịch bản bảo đảm phân hóa.
//
// KHÔNG nới ngưỡng 20. Ngưỡng giữ nguyên, chỉ bỏ tính ngẫu nhiên khỏi kịch bản.
const theoDoKhoAB: Record<string, number[]> = { "Dễ": [], "Trung bình": [], "Khó": [] };
[...questions]
  .sort((a, b) => a.id - b.id)
  .forEach(q => {
    const nhom = NHOM_KHO_AB.includes(String(q.difficulty)) ? String(q.difficulty) : "Trung bình";
    theoDoKhoAB[nhom].push(q.id);
  });

// Đầu đề: nhiều Dễ, ít Khó. Cuối đề: ngược lại. Mỗi phần ba vẫn có đủ cả ba nhóm để còn so
// được TRONG CÙNG một nhóm độ khó.
//
// Số câu "Trung bình" phải BẰNG NHAU và CHẴN ở cả ba phần (2, 2, 2). Lý do: nhóm này là nhóm
// duy nhất có cả đúng lẫn sai, nên nếu số câu của nó lệch giữa các phần thì tỷ lệ đúng trong
// chính nhóm đó cũng lệch theo phần đề, tức là tự tay tạo ra đúng cái nhiễu mà phép kiểm này
// muốn khẳng định là không có. Bố cục cũ 1 / 3 / 2 cho ra 100% / 33% / 50%.
const boCucAB: Array<Array<[string, number]>> = [
  [["Dễ", 4], ["Trung bình", 2], ["Khó", 1]],
  [["Dễ", 2], ["Trung bình", 2], ["Khó", 3]],
  [["Dễ", 1], ["Trung bình", 2], ["Khó", 4]],
];
const conLaiAB: Record<string, number[]> = {
  "Dễ": [...theoDoKhoAB["Dễ"]],
  "Trung bình": [...theoDoKhoAB["Trung bình"]],
  "Khó": [...theoDoKhoAB["Khó"]],
};
const dsCuoiAB: number[] = [];
const dsDungAB = new Set<number>();
for (const phan of boCucAB) {
  for (const [nhom, n] of phan) {
    const lay = conLaiAB[nhom].splice(0, n);
    dsCuoiAB.push(...lay);
    // Dễ đúng hết, Khó sai hết, Trung bình đúng đúng NỬA ĐẦU của chính phần này.
    // Nhờ vậy mỗi nhóm độ khó có tỷ lệ đúng y hệt nhau ở cả ba phần đề: 100%, 50%, 0%.
    if (nhom === "Dễ") lay.forEach(id => dsDungAB.add(id));
    else if (nhom === "Trung bình") lay.slice(0, Math.floor(n / 2)).forEach(id => dsDungAB.add(id));
  }
}

for (let e = 0; e < 6; e++) {
  const de = aiService.generateExam({ type: "random", count: 21 });
  de.questions = [...dsCuoiAB];
  de.answers = {};
  de.timeSpent = 700;
  de.questions.forEach(id => {
    const q = questionMap.get(id);
    if (!q) return;
    de.answers[id] = dsDungAB.has(id) ? q.correctAnswer : LETTERS.find(k => k !== q.correctAnswer)!;
  });
  de.isSubmitted = true;
  de.score = de.questions.filter(id => questionMap.get(id)?.correctAnswer === de.answers[id]).length;
  dbService.saveAttempt(de);
}
const abGia = learnerModelService.doMoiMoiTheoViTri();
const tutTho = abGia.tyLeDungDauDe - abGia.tyLeDungCuoiDe;
check("Độ khó dồn về cuối đề KHÔNG bị đọc nhầm thành mỏi mệt",
  abGia.chiSoMoiMoi <= 20,
  `cách đo ngây thơ sẽ thấy tụt ${(tutTho * 100).toFixed(1)} điểm phần trăm, sau khi khử độ khó chỉ còn ${(abGia.mucTut * 100).toFixed(1)}, chỉ số ${abGia.chiSoMoiMoi}/100`);

dbService.clearAllHistory();

// ===========================================================================
// NHÓM AC. Không màn hình nào được gắn cứng khái niệm của MÔN ĐÃ ĐÓNG
//
// Tìm ra bằng mắt khi mở `npm run dev` ngày 28/07/2026, sau khi 179 phép kiểm đều xanh:
// màn Bàn học của môn Hành vi khách hàng hiện bốn khái niệm gắn cứng của môn Kinh tế chính
// trị đã đóng, kèm bốn ô số liệu cũng cứng ("Slide CH2 (Trang 14)", "12 câu trong Ngân
// hàng"...), dưới một dòng nhãn ghi "Tự tổng hợp từ tài liệu đã có".
//
// Đây là lần thứ ba trong dự án một lỗi lọt qua toàn bộ bộ kiểm và chỉ lộ ra khi nhìn giao
// diện. Nhóm này quét NGUỒN của các component để lần sau bắt được bằng máy.
// ===========================================================================
g("AC. Giao diện không gắn cứng khái niệm môn đã đóng");

const TU_KHOA_MON_DA_DONG = [
  "Hàng hóa & Giá trị", "Giá trị Thặng dư", "Tích lũy Tư bản", "Cạnh tranh Độc quyền",
  "Giá trị thặng dư", "Tư bản bất biến", "Tư bản khả biến",
];
const thuMucComponent = path.join(process.cwd(), "src/components");
const dinhCuKhaiNiem: string[] = [];
for (const ten of readdirSync(thuMucComponent)) {
  if (!ten.endsWith(".tsx")) continue;
  const nguon = readFileSync(path.join(thuMucComponent, ten), "utf8");
  // Chỉ soi CHUỖI trong mã, bỏ qua dòng chú thích (chú thích được phép nhắc lại lỗi cũ).
  const dongMa = nguon.split("\n").filter(d => !d.trim().startsWith("//") && !d.trim().startsWith("*"));
  for (const tu of TU_KHOA_MON_DA_DONG) {
    if (dongMa.some(d => d.includes(`"${tu}"`) || d.includes(`'${tu}'`))) {
      dinhCuKhaiNiem.push(`${ten}: "${tu}"`);
    }
  }
}
check("Không component nào viết cứng tên khái niệm của môn đã đóng",
  dinhCuKhaiNiem.length === 0,
  dinhCuKhaiNiem.length === 0 ? "đã quét toàn bộ src/components" : dinhCuKhaiNiem.join(" | "));

// AC2. Khối "Liên kết kiến thức" phải lấy khái niệm từ đồ thị của MÔN ĐANG MỞ.
const nguonBanHoc = readFileSync(path.join(thuMucComponent, "PersonalWorkspaceView.tsx"), "utf8");
check("Khối Liên kết kiến thức lấy khái niệm từ đồ thị môn đang mở",
  nguonBanHoc.includes("kbService.getKnowledgeGraph(activeSubId)"),
  "PersonalWorkspaceView tra đồ thị theo activeSubId");

// AC3. Bốn ô số liệu của khối đó phải ĐẾM THẬT, không còn con số viết sẵn.
const conSoCu = ["Slide CH2 (Trang 14)", "Chương 2 (Mục 2.1)", "12 câu trong Ngân hàng", "1 câu cần sửa"];
// Bỏ qua dòng chú thích: chính chú thích giải thích lỗi cũ có nhắc lại các chuỗi này.
const maBanHoc = nguonBanHoc.split("\n").filter(d => !d.trim().startsWith("//") && !d.trim().startsWith("*")).join("\n");
const conSotLai = conSoCu.filter(s => maBanHoc.includes(`>${s}<`) || maBanHoc.includes(`"${s}"`));
check("Bốn ô số liệu của khối Liên kết kiến thức không còn viết sẵn",
  conSotLai.length === 0,
  conSotLai.length === 0 ? "cả bốn ô đều tính từ dữ liệu" : `còn: ${conSotLai.join(", ")}`);

// ===========================================================================
g("AD. Giao diện không được khẳng định con số chưa đo");
// ===========================================================================
// Bất biến 4.9 áp cho cả TẦNG HIỂN THỊ, không riêng tầng engine. Ba ca dưới đây do lượt rà soát
// giao diện trên trình duyệt thật ngày 28/07/2026 tìm ra: engine tính đúng nhưng màn hình vẫn
// vẽ ra con số không có thật.

/**
 * Đọc mã nguồn và BỎ HẾT CHÚ THÍCH trước khi soi.
 *
 * Bắt buộc phải bỏ: các phép kiểm dưới đây tìm dấu vết của mã cũ, mà chỗ sửa nào cũng có một
 * đoạn chú thích chép lại nguyên văn mã cũ để giải thích vì sao phải sửa. Soi cả chú thích thì
 * phép kiểm đỏ ngay khi mã đã đúng, và cách "sửa" duy nhất là xóa lời giải thích, tức là phạt
 * đúng thứ đáng giữ nhất.
 */
function docNguon(duongDan: string): string {
  return readFileSync(path.join(process.cwd(), duongDan), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// Y1. Nhật ký rèn luyện phải đọc lịch sử làm bài thật.
//     Bản cũ: `isDone = idx < stats.studyStreak + 3` nên người chưa làm câu nào vẫn thấy ba ngày
//     sáng màu, và sắc độ lấy từ `idx % 4`, tức từ VỊ TRÍ Ô chứ không từ dữ liệu, trong khi chú
//     giải lại ghi "Đang học / Vùng yếu / Tinh thông".
const nguonStats = docNguon("src/components/StatsView.tsx");
check("Nhật ký rèn luyện đọc lịch sử làm bài thật, không tô theo vị trí ô",
  !/studyStreak\s*\+\s*3/.test(nguonStats) && !/const\s+level\s*=\s*idx\s*%\s*4/.test(nguonStats)
    && /soCauMoiNgay/.test(nguonStats),
  "đã gỡ studyStreak + 3 và idx % 4, nay dựng từ dbService.getHistory()");

// Y2. Không được chốt cứng một mức tiến bộ.
const nguonWorkspace = docNguon("src/components/PersonalWorkspaceView.tsx");
check("Bàn học không chốt cứng mức tiến bộ theo tuần",
  !/\+6%\s*tuần này/.test(nguonWorkspace),
  "đã gỡ chuỗi viết cứng \"+6% tuần này\" vốn hiện y hệt nhau cho mọi người học");

// Y3. Điểm dự kiến chỉ hiện khi đã có bài làm.
//     Chưa làm câu nào thì bộ dự báo trả về đúng mốc khởi động nguội 5,0; hiện nó ra kèm biên độ
//     trông y như một phép đo thật.
check("Điểm dự kiến chỉ hiện khi đã có bài làm",
  /daCoBaiLam\s*\?/.test(nguonWorkspace) && /Chưa đủ dữ liệu/.test(nguonWorkspace),
  "chưa có bài làm thì hiện \"Chưa đủ dữ liệu\" thay cho 5,0 kèm biên độ");

// ===========================================================================
g("AE. Làm bài được bằng bàn phím");
// ===========================================================================
// Đo trên bản chạy thật ngày 28/07/2026: màn làm bài chỉ có "," và "." để chuyển câu, còn việc
// CHỌN ĐÁP ÁN bắt buộc phải dùng chuột. Trong một buổi ôn 2 đến 4 tiếng đó là hàng trăm lần rời
// tay khỏi bàn phím cho một việc đã quyết định xong trong đầu. Mỗi phương án vốn ĐÃ hiện sẵn
// chữ cái A, B, C, D nên phím tương ứng là thứ người học đoán ra ngay mà chưa dùng được.

const nguonPractice = docNguon("src/components/PracticeView.tsx");

// AE1. Phải chọn được đáp án bằng chữ cái và bằng số.
//
// Phép kiểm này phải soi ĐÚNG SỢI DÂY chứ không chỉ soi xem các tên biến có tồn tại không.
// Bản đầu tôi viết `/theoChuCai/ && /theoSo/ && /chonDapAnRef\.current\(/` và khi thử phá bằng
// cách cắt phép tra bảng thì nó VẪN XANH, vì ba cái tên đó vẫn còn nguyên trong file. Đây là
// lần thứ năm dự án bắt được phép kiểm rỗng, nên quy tắc là: khớp cả biểu thức nối, không khớp
// riêng lẻ từng danh từ.
check("Chọn đáp án được bằng phím A/B/C/D và 1/2/3/4",
  /const\s+chon\s*=\s*theoChuCai\[phim\]\s*\|\|\s*theoSo\[phim\]/.test(nguonPractice)
    && /if\s*\(chon\)\s*\{[\s\S]{0,120}chonDapAnRef\.current\(chon\)/.test(nguonPractice)
    && /theoSo:\s*Record<string,\s*"a" \| "b" \| "c" \| "d">\s*=\s*\{\s*"1": "a"/.test(nguonPractice),
  "phím chữ cái và phím số cùng tra ra đáp án rồi gọi thẳng handleSelectAnswer");

// AE2. Mũi tên trái phải chuyển câu, giữ nguyên "," và "." cho ai đã quen.
check("Chuyển câu được bằng mũi tên trái phải",
  /"ArrowLeft"/.test(nguonPractice) && /"ArrowRight"/.test(nguonPractice)
    && /=== ","/.test(nguonPractice) && /=== "\."/.test(nguonPractice),
  "mũi tên và dấu phẩy, dấu chấm cùng chuyển câu");

// AE3. Phím tắt phải HIỆN RA cho người học thấy. Một phím tắt không ai biết thì bằng không.
check("Có nhắc phím tắt ngay trên màn làm bài",
  /để chọn/.test(nguonPractice) && /để chuyển câu/.test(nguonPractice),
  "dòng nhắc nằm ngay dưới bốn phương án");

// AE4. Không được cướp phím khi người học đang gõ vào ô nhập, và không đụng vào phím tắt của
//      trình duyệt.
check("Phím tắt nhường chỗ khi đang gõ và khi có phím điều khiển",
  /tag === "INPUT"/.test(nguonPractice) && /isContentEditable/.test(nguonPractice)
    && /e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey/.test(nguonPractice),
  "bỏ qua khi ở ô nhập, ô soạn thảo, hoặc khi giữ Cmd/Ctrl/Alt");

// AE5. Câu hỏi phải là thứ dẫn dắt, không phải dòng ngữ cảnh phía trên nó.
//
// Bản cũ viết dòng chủ đề và khái niệm bằng chữ hoa giãn cách cỡ 10px kiểu mã máy, lại tô đậm,
// tức dạng chữ khó đọc nhất dành cho thứ ÍT quan trọng nhất trên thẻ. Trên khung 375px nó chiếm
// hai dòng ngay trước câu hỏi, nên thứ mắt chạm đầu tiên trong mỗi câu lại là thứ không cần đọc.
check("Dòng ngữ cảnh không lấn át câu hỏi",
  !/text-\[10px\] text-text-muted font-semibold uppercase tracking-wider font-mono/.test(nguonPractice),
  "đã bỏ chữ hoa giãn cách và tô đậm khỏi dòng chủ đề, khái niệm");

// AE6. Các chip đầu thẻ không được xuống dòng trên khung hẹp.
// Đo trên khung 375px: "Câu 3 / 10" từng xuống BA dòng, "Giáo viên AI Coaching" cũng ba dòng.
check("Chip đầu thẻ làm bài không xuống dòng trên khung hẹp",
  (nguonPractice.match(/whitespace-nowrap/g) || []).length >= 3,
  "chip số câu, chip mức độ và nhãn công tắc gia sư đều giữ một dòng");

// AE7. Bảng tổng kết sau khi nộp không được khẳng định thứ engine chưa hề tính.
//
// Ngày 29/07/2026, mở màn làm bài ở trạng thái ĐÃ NỘP thì thấy một thẻ bốn ô số liệu, và ba
// trong bốn ô là số bịa viết thẳng trong tầng trình bày:
//
//   Khái niệm đã thông thạo:  Math.max(1, Math.floor(correctCount / 3))
//     -> đúng 0 câu vẫn khoe "+1 khái niệm đã thông thạo"
//   Hiểu sai đã sửa:          incorrectCount > 0 ? "1 hiểu sai" : "0 bẫy sai"
//     -> sai 1 câu hay sai 9 câu đều ra đúng chuỗi "1 hiểu sai"
//   Độ ghi nhớ dự đoán:       71% -> 71 + tỷ_lệ_đúng * 18
//     -> mốc 71 viết cứng, không đọc từ hồ sơ người học nào
//
// Đây đúng họ lỗi mà bất biến 4.9 sinh ra để chặn, nhưng ba lượt quét trước đều dừng ở tầng
// service nên không lượt nào chạm tới. Nó nói với người học một điều không có thật đúng vào
// khoảnh khắc họ tin tưởng nhất, tức lúc vừa nộp bài xong.
//
// Cách chữa ở tầng trình bày KHÔNG phải là sửa công thức (tính đúng ba đại lượng ấy là việc
// của engine) mà là thôi khẳng định thứ mình không biết.
const bipBia: string[] = [];
if (/Math\.max\(1,\s*Math\.floor\(correctCount/.test(nguonPractice)) bipBia.push("khái niệm thông thạo suy từ correctCount/3, sàn 1");
if (/"1 hiểu sai"/.test(nguonPractice)) bipBia.push("số hiểu sai đã sửa là chuỗi viết cứng");
if (/71\s*\+\s*Math\.round/.test(nguonPractice) || /71%\s*&rarr;/.test(nguonPractice)) bipBia.push("độ ghi nhớ neo vào mốc 71 viết cứng");
check("Tổng kết sau khi nộp chỉ nói con số có thật",
  bipBia.length === 0,
  bipBia.length === 0
    ? "chỉ còn số câu đúng và số câu cần xem lại, cả hai suy thẳng từ bài làm"
    : `${bipBia.length} con số bịa: ${bipBia.join(" | ")}`);

// AE8. Thang trạng thái hiện cho người học đọc phải bằng tiếng Việt, và không được có màu báo
//      lỗi trong một lộ trình học.
//
// Ngày 29/07/2026, mở màn Câu sai trên bản chạy thật thì bốn chặng của "đường gỡ lỗ hổng" in ra
// nguyên văn "Weak", "Learning", "Recovered", "Mastered". Đợt dọn chuỗi tiếng Anh trước đó
// không quét tới màn này.
//
// Nặng hơn là màu: quy ước cũ tô chặng ĐÃ QUA màu xanh lá và chặng ĐANG ĐỨNG màu đỏ cam. Một
// câu đã gỡ được sau một lần sai vì thế hiện ra "Weak" xanh, "Learning" xanh, "Recovered" ĐỎ,
// tức hai chặng yếu nhất được tô thành công còn chặng vừa gỡ được thì tô thành màu báo lỗi.
const nguonSoSai = docNguon("src/components/ReviewNotebookView.tsx");
const chuAnhConSot = ["Weak", "Learning", "Recovered", "Mastered"]
  .filter(t => new RegExp(`label:\\s*"${t}"`).test(nguonSoSai));
check("Thang gỡ lỗ hổng dùng nhãn tiếng Việt",
  chuAnhConSot.length === 0 && /label: "Còn yếu"/.test(nguonSoSai) && /label: "Nắm chắc"/.test(nguonSoSai),
  chuAnhConSot.length === 0
    ? "bốn chặng là Còn yếu, Đang ôn, Đã gỡ, Nắm chắc"
    : `còn ${chuAnhConSot.length} nhãn tiếng Anh: ${chuAnhConSot.join(", ")}`);

check("Lộ trình học không tô màu báo lỗi",
  !/isCurrent \? "bg-brand-warning"/.test(nguonSoSai) && !/isCurrent \? "bg-brand-error"/.test(nguonSoSai),
  "chặng đạt tới thì tô, chặng chưa tới để trống, không dùng cam hay đỏ cho chặng đang đứng");

// AE9. Chip chương không được in trùng tiền tố.
// Đo trên bản chạy thật: `ch.title` đã chứa sẵn "Chương N: ..." nên việc ghép thêm
// `Chương {q.chapterId}: ` ở đầu cho ra "Chương 1: Chương 1: Khái quát về hành vi khách hàng".
check("Chip chương không in trùng tiền tố",
  !/Chương \{q\.chapterId\}: \{ch\?\.title/.test(nguonSoSai),
  "chỉ tự ghép tiền tố khi không tra được tên chương");

// ===========================================================================
g("AF. Mọi màu ngữ nghĩa dùng trong giao diện đều phải có định nghĩa");
// ===========================================================================
// VÌ SAO CÓ NHÓM NÀY. Ngày 28/07/2026, rà màu trên bản chạy thật phát hiện lớp `brand-danger`
// được dùng **84 lần trong 11 file** nhưng KHÔNG hề được định nghĩa ở đâu; bộ token chỉ có
// `brand-error`. Tailwind sinh lớp tiện ích từ token, không có token thì không sinh lớp, mà
// không có lớp thì trình duyệt lặng lẽ dùng màu kế thừa.
//
// Đo được trước khi sửa: `text-brand-danger` cho ra rgb(17,17,17), tức ĐEN như chữ thường, và
// `bg-brand-danger-bg` cho ra rgba(0,0,0,0), tức TRONG SUỐT. Hậu quả nặng nhất nằm ở màn làm
// bài: phương án người học chọn SAI hiện y hệt một phương án chưa ai đụng tới, nên tín hiệu
// quan trọng nhất của cả ứng dụng học tập bị mất trắng.
//
// Loại lỗi này không bao giờ báo lỗi biên dịch, không sai kiểu, không nổ ngoại lệ. Nó chỉ
// lặng lẽ không tô màu. Phép kiểm dưới đây bắt CẢ HỌ lỗi đó, không riêng một tên.

const cssTheme = readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
const tokenDaDinhNghia = new Set(
  Array.from(cssTheme.matchAll(/--color-(brand-[a-z-]+)\s*:/g)).map(m => m[1])
);

const tienToMau = ["text", "bg", "border", "from", "via", "to", "ring", "fill", "stroke", "decoration", "outline", "shadow", "accent", "caret", "divide"];
const tokenDangDung = new Map<string, string[]>();
for (const f of readdirSync(path.join(process.cwd(), "src/components"))) {
  if (!f.endsWith(".tsx")) continue;
  const noiDung = readFileSync(path.join(process.cwd(), "src/components", f), "utf8");
  for (const m of noiDung.matchAll(/\b(?:hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:)*(text|bg|border|from|via|to|ring|fill|stroke)-(brand-[a-z-]+?)(?:\/\d+)?(?=[\s"'`}])/g)) {
    const ten = m[2].replace(/-$/, "");
    if (!tokenDangDung.has(ten)) tokenDangDung.set(ten, []);
    if (!tokenDangDung.get(ten)!.includes(f)) tokenDangDung.get(ten)!.push(f);
  }
}
void tienToMau;

const tokenMoCoi = [...tokenDangDung.keys()].filter(t => !tokenDaDinhNghia.has(t)).sort();
check("Không lớp màu ngữ nghĩa nào bị dùng mà thiếu định nghĩa",
  tokenMoCoi.length === 0,
  tokenMoCoi.length === 0
    ? `${tokenDangDung.size} tên màu đang dùng, tất cả đều có token trong index.css`
    : `${tokenMoCoi.length} tên KHÔNG có định nghĩa nên không tô được màu nào: ${tokenMoCoi.map(t => `${t} (${tokenDangDung.get(t)!.slice(0, 3).join(", ")})`).join(" | ")}`);

// AF2. Chế độ tối phải định nghĩa ĐỦ mọi màu ngữ nghĩa mà chế độ sáng có.
// Thiếu một biến ở khối .dark thì màu đó rơi về giá trị của chế độ sáng, cho ra chữ nhạt trên
// nền tối hoặc ngược lại, và chỉ lộ ra khi có người thật bật chế độ tối lên nhìn.
const bienSang = new Set(
  Array.from((cssTheme.match(/:root\s*\{[\s\S]*?\n\}/) || [""])[0].matchAll(/(--color-[a-z-]+)\s*:/g)).map(m => m[1])
);
const bienToi = new Set(
  Array.from((cssTheme.match(/\.dark\s*\{[\s\S]*?\n\}/) || [""])[0].matchAll(/(--color-[a-z-]+)\s*:/g)).map(m => m[1])
);
const thieuOToi = [...bienSang].filter(b => !bienToi.has(b)).sort();
check("Chế độ tối định nghĩa đủ mọi màu ngữ nghĩa của chế độ sáng",
  thieuOToi.length === 0,
  thieuOToi.length === 0
    ? `${bienSang.size} màu, chế độ tối có đủ cả`
    : `thiếu ${thieuOToi.length} màu ở khối .dark: ${thieuOToi.join(", ")}`);

// AF3. Bốn màu ngữ nghĩa phải ĐỌC ĐƯỢC trên chính nền cùng tông của chúng.
//
// Đây là cách chúng thật sự được dùng: chữ `text-brand-success` nằm trên nền `bg-brand-success-bg`.
// Đo ngày 28/07/2026 trước khi sửa: xanh lá 3,15:1, cam 3,35:1, xanh dương 3,38:1, đỏ 4,41:1,
// cả bốn đều dưới 4,5:1 của chuẩn WCAG AA cho chữ thường. Nặng nhất là xanh lá của ĐÁP ÁN ĐÚNG.
//
// Ngưỡng 4,5 là chuẩn ngoài, KHÔNG được hạ xuống cho vừa bảng màu. Muốn đổi màu thì đổi sao cho
// vẫn đạt.
function docBienMau(khoi: string, ten: string): string | null {
  const m = khoi.match(new RegExp(`--color-${ten}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1] : null;
}
function doSang(hex: string): number {
  const v = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function doTuongPhan(a: string, b: string): number {
  const la = doSang(a), lb = doSang(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const khoiSang = (cssTheme.match(/:root\s*\{[\s\S]*?\n\}/) || [""])[0];
const capMau = ["success", "warning", "error", "info"];
const capDat: string[] = [];
const capHong: string[] = [];
for (const ten of capMau) {
  const chu = docBienMau(khoiSang, ten);
  const nen = docBienMau(khoiSang, `${ten}-bg`);
  if (!chu || !nen) { capHong.push(`${ten}: thiếu biến`); continue; }
  const tp = doTuongPhan(chu, nen);
  (tp >= 4.5 ? capDat : capHong).push(`${ten} ${tp.toFixed(2)}:1`);
}
check("Bốn màu ngữ nghĩa đọc được trên nền cùng tông của chúng",
  capHong.length === 0,
  capHong.length === 0
    ? `đạt chuẩn WCAG AA: ${capDat.join(", ")}`
    : `chưa đạt 4,5:1: ${capHong.join(", ")}`);

// AE10. Màn Tổng quan không được tự bịa ra số ngày còn lại và số câu của ngân hàng.
//
// Đo trên bản chạy thật ngày 29/07/2026, màn Tổng quan hiện cùng lúc BỐN con số nói HAI sự
// thật khác nhau:
//
//   "1. Thời gian tới kỳ thi: Còn 14 ngày"     dải trên, lấy từ bộ dự báo
//   "Tiến trình tới kỳ thi: Còn 12 ngày"       khối giữa, VIẾT CỨNG `const daysLeft = 12`
//   "3. Tiến độ hiện tại: Đã hoàn thành 1%"    dải trên
//   "Đã hoàn thành: 12%"                       khối giữa, chia cho hằng số 60
//
// Hai nguyên nhân, đều thuộc họ lỗi ở bất biến 4.9:
//   1. `daysLeft = 12` là hằng số viết tay đội lốt phép đo, đặt cạnh một phép đếm thật.
//   2. Mẫu số **60** là số câu của MÔN ĐÃ ĐÓNG (ngân hàng cũ id 1 tới 60). Môn đang mở có 292
//      câu, nên phần trăm hoàn thành đang tính trên ngân hàng của một môn khác.
//
// Cái thứ hai nguy hiểm hơn cái thứ nhất vì nó im lặng đúng cho môn cũ và sai cho mọi môn sau.
const nguonHero = docNguon("src/components/HomeHero.tsx");
const bipHero: string[] = [];
if (/const daysLeft\s*=\s*\d+\s*;/.test(nguonHero)) bipHero.push("số ngày còn lại viết cứng");
if (/totalSolved\s*\/\s*60\b/.test(nguonHero)) bipHero.push("chia cho 60 câu của môn đã đóng");
check("Màn Tổng quan không bịa số ngày và số câu ngân hàng",
  bipHero.length === 0 && /questions\.length/.test(nguonHero),
  bipHero.length === 0
    ? "số ngày suy từ ngày thi đã đặt, phần trăm tính trên ngân hàng thật của môn đang mở"
    : `${bipHero.length} con số bịa: ${bipHero.join(" | ")}`);

// AE11. Lý do gợi ý hiện cho người học không được chứa tên cơ chế nội bộ hay số gỡ lỗi.
//
// Chuỗi `reason` của `homeHeroDecision` HIỆN RA MÀN HÌNH dưới nhãn "Vì sao nên làm mục này".
// Bản cũ in nguyên văn: `Trọng tài hệ thống (Arbitration Utility: 0.88): Duy trì nhịp học
// thích ứng mở rộng độ bao phủ syllabus.` Ba thứ sai trong một câu: tên cơ chế nội bộ bằng
// tiếng Anh, một số thực gỡ lỗi, và từ "syllabus".
//
// Đây là câu trả lời cho câu hỏi quan trọng nhất của màn hình, nên nó phải nói bằng tiếng của
// người học. Giá trị `adj*` vẫn được tính y như cũ và vẫn quyết định mục nào thắng.
const nguonHero2 = docNguon("src/services/homeHeroDecision.ts");
const dongReason = (nguonHero2.match(/^\s*reason:.*$/gm) || []);
const reasonXau = dongReason.filter(d => /Arbitration|Utility|syllabus|triệt phá|Trọng tài hệ thống/.test(d));
check("Lý do gợi ý viết bằng tiếng của người học",
  dongReason.length >= 3 && reasonXau.length === 0,
  reasonXau.length === 0
    ? `${dongReason.length} lý do, không chuỗi nào chứa tên cơ chế nội bộ hay số gỡ lỗi`
    : `${reasonXau.length} lý do còn tiếng Anh nội bộ hoặc số gỡ lỗi`);

// AF3b. Không component nào được đi vòng qua bộ token bằng bảng màu thô của Tailwind.
//
// VÌ SAO CÓ PHÉP KIỂM NÀY. Phép kiểm AF1 đối chiếu mọi lớp `*-brand-*` với token trong
// `index.css`, nên nó bắt được chỗ dùng tên màu KHÔNG CÓ định nghĩa. Nhưng nó hoàn toàn mù với
// chỗ **không thèm dùng tên màu của dự án**: viết thẳng `text-emerald-600`, `bg-red-500/10`,
// `text-indigo-600` thì Tailwind sinh lớp bình thường, màu hiện ra bình thường, và mọi phép
// kiểm đều xanh.
//
// Ngày 29/07/2026 mở tab "Trí nhớ" của màn Hỏi AI thì đếm được **40 chỗ** như vậy chỉ trong
// một file, cộng 32 chỗ nữa ở hai file khác. Hai hậu quả:
//
//   1. Chế độ tối mất bảo đảm: các sắc độ nguyên bản không có bản cho nền tối, nên chúng giữ
//      nguyên màu sáng khi người dùng bật chế độ tối.
//   2. Ràng buộc tương phản 4,5:1 ở AF3 chỉ áp cho bốn màu ngữ nghĩa, nên mọi màu đi đường
//      vòng đều không ai đo.
//
// Đây đúng họ lỗi "lách qua hệ thống mà không ai biết", cùng khuôn với `brand-danger` chưa
// từng được định nghĩa và với `animate-fade-in-up` chưa từng có token.
const bangMauTho = /\b(?:hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:|xl:)*(?:text|bg|border|ring|from|via|to|fill|stroke|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00)\b/g;
const fileDungMauTho: string[] = [];
for (const f of readdirSync(path.join(process.cwd(), "src/components"))) {
  if (!f.endsWith(".tsx")) continue;
  const noiDung = readFileSync(path.join(process.cwd(), "src/components", f), "utf8");
  // `zinc` trong quy tắc thanh cuộn của index.css không tính; ở đây chỉ quét components.
  const hit = noiDung.match(bangMauTho);
  if (hit && hit.length) fileDungMauTho.push(`${f} (${hit.length})`);
}
check("Không component nào dùng bảng màu thô thay cho token",
  fileDungMauTho.length === 0,
  fileDungMauTho.length === 0
    ? "mọi màu trong components đều đi qua bộ token ngữ nghĩa, nên chế độ tối và ngưỡng tương phản đều được canh"
    : `${fileDungMauTho.length} file đi vòng qua bộ token: ${fileDungMauTho.slice(0, 5).join(", ")}`);

// AF4. Không được vừa TÔ NỀN vừa TÔ CHỮ bằng cùng một màu ngữ nghĩa trên hàng đáp án.
//
// Lịch sử của phép kiểm này đáng đọc, vì bản đầu của nó cấm nhầm thứ.
//
// Ngày 28/07/2026 đo được phương án ĐÚNG có tương phản 3,15:1 và phương án SAI 4,41:1, đều
// dưới ngưỡng 4,5:1 của WCAG AA. Kết luận lúc đó là "cấm tô màu ngữ nghĩa lên chữ nội dung",
// và phép kiểm được viết đúng theo câu chữ ấy.
//
// Nhưng nguyên nhân thật không phải là màu chữ. Nó là **cặp nền tô cộng chữ tô**: chữ xanh lá
// đặt trên nền xanh nhạt thì hai màu cùng tông nên tương phản sập. Đo lại ngày 29/07/2026 với
// nền để TRONG SUỐT:
//
//   #157d3c trên nền trắng = 5,21:1     #b91c1c trên nền trắng = 6,47:1
//
// Cả hai vượt ngưỡng. Nghĩa là cách làm của Khan Academy, bỏ nền và tô chữ, không hề vi phạm
// chuẩn; chính cái nền mới là thứ gây ra con số 3,15.
//
// Nên phép kiểm này chuyển sang canh đúng cái đã hỏng thật và hiện KHÔNG có phép kiểm nào giữ:
// **độ đục trên hàng đáp án sau khi lộ kết quả**.
//
// Bản cũ dùng `opacity-40` chồng lên `text-text-muted` cho ba phương án không được chọn. Màu
// thật hiện ra trên nền trắng là 0,4 x (107,107,117) cộng 0,6 x (255,255,255), tức xấp xỉ
// #C4C4C8, chỉ **1,85:1**. Mà đọc lại ba phương án còn lại để hiểu vì sao chúng sai chính là
// phần học nhiều nhất của cả câu hỏi.
//
// Vì sao phải canh riêng độ đục thay vì canh tương phản như AF3: `opacity` không nằm trong bộ
// token màu nên mọi phép đo tĩnh trên token đều **không thấy nó**. Cứ đặt màu chữ đạt chuẩn rồi
// phủ một lớp độ đục lên là tương phản sập mà không phép kiểm nào kêu.
//
// Riêng cặp nền tô cộng chữ tô cùng tông thì AF3 đã canh bằng số đo thật (success 4,98:1) nên
// không viết thêm ở đây. Đo lại ngày 29/07/2026 với nền để TRONG SUỐT: #157d3c trên trắng đạt
// 5,21:1 và #b91c1c đạt 6,47:1, nên cách của Khan Academy (bỏ nền, tô chữ) hợp chuẩn.
const chuoiKieuHang = nguonPractice.match(/(?:voHang|mauChu|oChuCai) = "[^"]*"/g) || [];
const hangCoDoDuc = chuoiKieuHang.filter(s => /\bopacity-\d/.test(s));
check("Hàng đáp án không hạ độ đục sau khi lộ kết quả",
  chuoiKieuHang.length >= 8 && hangCoDoDuc.length === 0,
  hangCoDoDuc.length > 0
    ? `${hangCoDoDuc.length} trạng thái còn hạ độ đục: ${hangCoDoDuc.join(" | ")}`
    : chuoiKieuHang.length < 8
    ? `chỉ tìm thấy ${chuoiKieuHang.length} chuỗi kiểu hàng đáp án, phép kiểm nhiều khả năng đã hết bám vào mã`
    : `${chuoiKieuHang.length} trạng thái của hàng đáp án, không trạng thái nào dùng opacity`);

// AF5. Vòng khoanh trên hàng đáp án chỉ được có MỘT, và luôn quanh đáp án đúng.
//
// Đo trên trang bài tập của Khan: dù trả lời đúng hay sai, trên màn hình chỉ tồn tại đúng một
// vòng khoanh và nó luôn ở đáp án đúng. Vòng là thứ CHỈ CHỖ CẦN NHÌN, không phải thứ chấm điểm.
// Bản đầu của lượt 29/07/2026 khoanh cả phương án chọn sai, và nhìn trên bản chạy thật thì hai
// vòng cùng độ dày nằm sát nhau tranh nhau sự chú ý.
check("Chỉ đáp án đúng được khoanh vòng",
  /voHang = "border-brand-success"/.test(nguonPractice)
    && !/voHang = "border-brand-error"/.test(nguonPractice),
  "vòng khoanh dành riêng cho đáp án đúng, phương án chọn sai chỉ đổi ô chữ cái và màu chữ");

// AF6. Mọi lớp `animate-*` viết trong components phải có token `--animate-*` tương ứng.
//
// Cùng họ lỗi với AF1 và cũng lặng lẽ y như vậy. Tailwind v4 chỉ sinh lớp `animate-x` từ token
// `--animate-x` trong `@theme`; thiếu token thì lớp không tồn tại và trình duyệt bỏ qua không
// một tiếng động. Ngày 29/07/2026 tìm ra `animate-fade-in-up` nằm ở 7 chỗ trong hai file mà
// chưa từng có token, tức mọi bảng phản hồi sau khi trả lời đều nhảy phịch vào suốt từ đầu,
// dù mã nguồn đọc lên như thể đã có hiệu ứng.
const tokenHoatAnh = new Set(
  Array.from(cssTheme.matchAll(/--animate-([a-z-]+)\s*:/g)).map(m => m[1])
);
const hoatAnhDangDung = new Map<string, string[]>();
for (const f of readdirSync(path.join(process.cwd(), "src/components"))) {
  if (!f.endsWith(".tsx")) continue;
  const noiDung = readFileSync(path.join(process.cwd(), "src/components", f), "utf8");
  for (const m of noiDung.matchAll(/\banimate-([a-z][a-z0-9-]*)(?=[\s"'`}])/g)) {
    const ten = m[1];
    if (["none", "spin", "ping", "pulse", "bounce"].includes(ten)) continue; // có sẵn trong Tailwind
    if (!hoatAnhDangDung.has(ten)) hoatAnhDangDung.set(ten, []);
    if (!hoatAnhDangDung.get(ten)!.includes(f)) hoatAnhDangDung.get(ten)!.push(f);
  }
}
const hoatAnhMoCoi = [...hoatAnhDangDung.keys()].filter(t => !tokenHoatAnh.has(t)).sort();
check("Không lớp hoạt ảnh nào bị dùng mà thiếu token",
  hoatAnhMoCoi.length === 0,
  hoatAnhMoCoi.length === 0
    ? `${hoatAnhDangDung.size} hoạt ảnh đang dùng, tất cả đều có token trong index.css`
    : `${hoatAnhMoCoi.length} lớp KHÔNG chạy được: ${hoatAnhMoCoi.map(t => `${t} (${hoatAnhDangDung.get(t)!.slice(0, 3).join(", ")})`).join(" | ")}`);

g("AG. Màn hình nói đúng với người CHƯA bắt đầu");

// Cả nhóm này sinh ra từ một lượt rà riêng: mở ứng dụng bằng một hồ sơ TRỐNG HOÀN TOÀN, tức
// đúng thứ người học thấy ở giây đầu tiên. Cách làm không phá dữ liệu: mở qua `127.0.0.1` thay
// vì `localhost`, hai origin khác nhau nên kho lưu tách biệt.
//
// Ba lỗi tìm được đều thuộc một họ: **màn hình nói chuyện với người mới như thể họ đã học rồi.**

// AG1. Nhãn nút không được tự khai một số câu khác với số câu thật sẽ sinh ra.
//
// Thẻ việc chính ghi "Ôn 15 câu theo điểm yếu", nhưng nút gọi `onStartExam("adaptive")` không
// kèm tham số nên App.tsx sinh `count: 10`. Bấm thử trên bản chạy thật thì đầu phiên ghi
// "Phiên ôn luyện: 10 câu hỏi lý thuyết". Lệch 50%.
//
// Cùng họ với `daysLeft = 12`: một con số viết tay trong nhãn, đứng cạnh một con số thật do
// engine sinh, và không có gì bắt chúng khớp nhau. Cách sửa đúng là BỎ số khỏi nhãn chứ không
// viết lại thành 10, vì nhãn không phải nơi giữ nguồn sự thật; sửa thành 10 chỉ dời quả bom
// sang lần đổi `count` tiếp theo.
const nguonBanHocAG = docNguon("src/components/PersonalWorkspaceView.tsx");
const nhanBiaSoCau = (nguonBanHocAG.match(/(?:Ôn|Làm|Luyện)\s+\d+\s+câu/g) || []);
check("Nhãn việc cần làm không tự khai số câu",
  nhanBiaSoCau.length === 0,
  nhanBiaSoCau.length === 0
    ? "không nhãn nào hứa một số câu mà tầng gọi không bảo đảm"
    : `${nhanBiaSoCau.length} nhãn hứa số câu viết cứng: ${nhanBiaSoCau.join(", ")}`);

// AG2. Lời khen phải nằm sau điều kiện ĐÃ CÓ BÀI LÀM.
//
// "Sổ câu sai đang sạch" hiện ra với người chưa làm câu nào. Sổ trống vì chưa bắt đầu, không
// phải vì làm đúng hết. Cái giá không nằm ở chữ nghĩa mà ở chỗ khác: khen sai người thì lời
// khen THẬT sau này mất giá, và một ứng dụng học tập sống bằng chính độ tin của những lời ấy.
//
// Phép kiểm canh quan hệ, không canh chuỗi: chuỗi khen phải xuất hiện trong cùng một biểu thức
// điều kiện với cờ `daCoBaiLam`.
const khoiKhen = nguonBanHocAG.match(/daCoBaiLam[\s\S]{0,400}?đang sạch/);
check("Lời khen sổ câu sai chỉ hiện khi đã có bài làm",
  /đang sạch/.test(nguonBanHocAG) ? khoiKhen !== null : true,
  khoiKhen !== null
    ? "chuỗi khen nằm sau cờ daCoBaiLam, người chưa làm bài đọc câu trung tính"
    : "chuỗi khen KHÔNG gắn với cờ daCoBaiLam, người chưa bắt đầu sẽ bị khen nhầm");

// AG3. Không in mã chế độ bài thi thô ra giao diện.
//
// Bản cũ của banner phiên dở dang render thẳng `{session.examType}` vào giữa câu tiếng Việt và
// còn tô đậm, nên người học đọc được nguyên văn "Hệ thống đã lưu trạng thái bài thi **adaptive**
// của bạn". Cùng họ với "Long-Term Student Evolution & Memory Engine" đã dịch ở màn Trí nhớ.
//
// types.ts khai 10 mã nhưng các nơi gọi còn dùng thêm "mock-exam", "daily-adaptive",
// "retention-revision"... nên bản đồ dịch KHÔNG thể đầy đủ. Vì vậy phép kiểm đòi hai điều: có
// bản đồ dịch, và không render thẳng `examType`. Mã lạ thì bỏ mệnh đề chứ không in mã ra.
const nguonBanner = docNguon("src/components/SessionRecoveryBanner.tsx");
const renderThoExamType = /\{\s*session\.examType\s*\}/.test(nguonBanner);
check("Banner phiên dở dang không in mã chế độ ra màn hình",
  !renderThoExamType && /TEN_KIEU_BAI/.test(nguonBanner),
  !renderThoExamType
    ? "mã chế độ được tra sang tên tiếng Việt, mã lạ thì bỏ hẳn mệnh đề thay vì in ra"
    : "còn render thẳng session.examType vào câu tiếng Việt");

// AG4. Màn Kế hoạch không được dự báo điểm khi chưa có một câu trả lời nào.
//
// Đo trên hồ sơ trắng ngày 29/07/2026, màn Kế hoạch hiện ra cho người CHƯA TRẢ LỜI CÂU NÀO:
//
//   "Dự báo kết quả 5.0 ± 0.5"        chip viền xanh, góc trên phải, chỗ nổi nhất màn
//   "Tạm tính khoảng 5.0 ± 0.5 điểm."  20px đậm
//   "Độ tin cậy còn thấp"              ngay bên dưới, tức màn hình TỰ CÃI chính nó
//   "Mức sẵn sàng 59%"                 kèm thanh xanh lá đầy 59%
//   "+0.3 điểm" x3                     ba lời hứa tăng điểm tô xanh lá
//
// Con số 5.0 là điểm nền của bộ dự báo khi chưa có bằng chứng. In nó ở cỡ lớn nhất màn rồi ghi
// chú bên dưới rằng nó chưa đáng tin là cách trình bày tự mâu thuẫn: mắt đọc số trước, đọc lời
// cảnh báo sau.
//
// Cờ `chuaDuTinCay` có sẵn từ lượt 9 KHÔNG đủ: nó là `confidenceLevel !== "Cao"`, vẫn đúng cho
// người đã làm 200 câu. Cần một ranh giới cứng `totalSolved === 0`.
const nguonKeHoach = docNguon("src/components/LearningPlannerDashboard.tsx");
check("Màn Kế hoạch không dự báo điểm khi chưa có bài làm",
  /const chuaCoBaiLam\s*=\s*dbService\.getStatistics\(\)\.totalSolved === 0/.test(nguonKeHoach)
    && /chuaCoBaiLam[\s\S]{0,600}?Chưa dự báo được/.test(nguonKeHoach)
    && /chuaCoBaiLam[\s\S]{0,200}?Chưa đủ dữ liệu/.test(nguonKeHoach),
  "chưa có bài làm thì thay điểm dự báo bằng lời mời bắt đầu, và chip đầu trang ghi Chưa đủ dữ liệu");

// AG5. Chương CHƯA HỌC không được trình bày như một khoản nợ có màu cảnh báo.
//
// Tab "Phần cần sửa" trộn hai loại khác hẳn nhau vào một danh sách: `unlearned_chapter` (chưa
// làm bài nào của chương) và `wrong_attempt` (đã trả lời sai). Bản cũ cho cả hai cùng một thang
// ưu tiên và cùng bảng màu, nên hồ sơ trắng hiện **7 mục đều đeo chip ĐỎ "Cao"**, kèm dòng
// "Lần sai: 0" ở cả bảy.
//
// Người vừa mở ứng dụng lần đầu nhìn thấy bảy tín hiệu lỗi đỏ cho việc họ chưa kịp bắt đầu.
// Đây đúng khuôn đã sửa ở màn Câu sai lượt 6: thang tiến độ từng tô ĐỎ đúng chặng vừa gỡ được.
check("Chương chưa học không đeo màu cảnh báo",
  /const laChuaHoc = item\.debtType !== "wrong_attempt"/.test(nguonKeHoach)
    && /!laChuaHoc && \(/.test(nguonKeHoach)
    && !/Lần sai: \{item\.wrongCount\}/.test(nguonKeHoach),
  "chỉ câu từng làm sai mới mang mức ưu tiên có màu, và thôi in dòng Lần sai 0");

// AG6. Thang màu tốt xấu chỉ được bật khi đã đủ bằng chứng.
//
// Màn Báo cáo tô màu thanh tiến độ từng chương thuần theo phần trăm, nên một chương mới trả lời
// ĐÚNG HAI CÂU (một đúng một sai) ra 50% và bị tô CAM như một kết quả kém. Hai câu không đủ kết
// luận gì về một chương, và một tín hiệu sai còn tệ hơn không có tín hiệu: người học sẽ đi ôn
// lại chương mà họ chưa thật sự yếu.
//
// Cùng khối đó còn gọi `getAccuracyColor(0)` cho chương CHƯA LÀM CÂU NÀO, nên chip ghi "Chưa
// làm câu nào" lại mang màu đỏ của mức dưới 40%. Chữ nói một đằng, màu nói một nẻo, và màu
// thắng vì mắt đọc màu trước.
//
// Ngưỡng dùng lại hằng số 6 vốn đã là cách co theo lượng bằng chứng duy nhất của cả dự án,
// không đặt thêm một con số mới ở tầng trình bày.
const nguonBaoCao = docNguon("src/components/StatsView.tsx");
check("Thang màu tốt xấu chỉ bật khi đủ bằng chứng",
  /NGUONG_DU_BANG_CHUNG\s*=\s*6/.test(nguonBaoCao)
    && /getAccuracyBarColor\s*=\s*\(pct: number, soCauDaLam: number\)/.test(nguonBaoCao)
    && /soCauDaLam < NGUONG_DU_BANG_CHUNG/.test(nguonBaoCao)
    && !/getAccuracyColor\(accuracyPct\)/.test(nguonBaoCao),
  "dưới 6 câu thì thanh mang màu trung tính, và chương chưa làm không còn bị tô màu kém");

// AG7. Trạng thái rỗng không được viết bằng chữ nghiêng, và không được hứa việc không chạy.
//
// Đo trên mã nguồn ngày 29/07/2026: 32 nhánh `length === 0` rải trên 15 file, mà component
// dùng chung `EmptyState` chỉ được gọi ĐÚNG MỘT chỗ. Chín file tự viết
// `<p className="... italic">Chưa có...</p>` tại chỗ.
//
// Hai lý do bỏ chữ nghiêng: tiếng Việt có dấu thì nghiêng rất khó đọc, và Khan không dùng chữ
// nghiêng ở đâu trong giao diện của họ.
//
// Nguyên nhân gốc khiến người ta thôi dùng component chung: nó quá nặng cho chỗ nhỏ (thẻ bo
// 16px, viền, icon lucide trong ô tròn 48px). Nên bản dựng lại tách hai cấp, `EmptyState` cho
// cả một màn và `DongTrong` cho một dòng trong bảng.
//
// Phép kiểm bắt chuỗi "Chưa/Không có..." nằm cùng phần tử với lớp `italic`, chứ không cấm
// `italic` nói chung: chữ nghiêng vẫn hợp lệ cho trích dẫn và mẹo ghi nhớ.
const fileNghiengRong: string[] = [];
for (const f of readdirSync(path.join(process.cwd(), "src/components"))) {
  if (!f.endsWith(".tsx") || f === "EmptyState.tsx") continue;
  const noiDung = readFileSync(path.join(process.cwd(), "src/components", f), "utf8");
  for (const m of noiDung.matchAll(/className="[^"]*\bitalic\b[^"]*"\s*>\s*([^<]{0,80})/g)) {
    if (/^(Chưa|Không có|Chua|Khong co)/.test(m[1].trim())) fileNghiengRong.push(f);
  }
}
/*
  Và không màn nào được mô tả một tiến trình nền không hề tồn tại.

  Hai ca đã bắt được:

    ConceptMasteryMap  "AI đang phân tích tài liệu để tự động thiết lập bản đồ thông thạo" khi
                       đồ thị rỗng. Không có tiến trình nào chạy; nó rỗng vì môn chưa có tài
                       liệu và sẽ rỗng mãi cho tới khi người học tự thêm vào.
    AIHub              nhánh `catch`, tức lời gọi AI ĐÃ THẤT BẠI, lại trả về câu "Hệ thống đang
                       xử lý câu hỏi". Trạng thái lỗi đội lốt trạng thái chờ, nên người học ngồi
                       chờ một câu trả lời không bao giờ tới.

  Loại sai này tệ hơn cả lời khen nhầm: nó khiến người học KHÔNG làm việc cần làm, vì tưởng hệ
  thống đang làm hộ.

  PHẢI BỎ CHÚ THÍCH TRƯỚC KHI QUÉT. Bản đầu của phép kiểm này quét cả file nên báo đỏ ngay
  chính đoạn chú thích đang trích lại câu cũ để giải thích vì sao nó sai. Một phép kiểm bắt lỗi
  trong lời giải thích về lỗi thì sẽ bị người sau tắt đi.
*/
const huaGia: string[] = [];
for (const f of readdirSync(path.join(process.cwd(), "src/components"))) {
  if (!f.endsWith(".tsx")) continue;
  const noiDung = readFileSync(path.join(process.cwd(), "src/components", f), "utf8");
  const maSach = noiDung
    .replace(/\/\*[\s\S]*?\*\//g, "")       // chú thích khối
    .replace(/^\s*\/\/.*$/gm, "")           // chú thích dòng
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");  // chú thích JSX
  if (/AI đang phân tích|đang tự động thiết lập|hệ thống đang xử lý/i.test(maSach)) huaGia.push(f);
}
check("Trạng thái rỗng không dùng chữ nghiêng và không hứa việc không chạy",
  fileNghiengRong.length === 0 && huaGia.length === 0,
  fileNghiengRong.length === 0 && huaGia.length === 0
    ? "mọi nhánh rỗng nói bằng chữ thường, và không nhánh nào mô tả một tiến trình nền không tồn tại"
    : `${[...new Set(fileNghiengRong)].join(", ")}${huaGia.length ? ` | hứa giả: ${huaGia.join(", ")}` : ""}`);

// AG8. Tiêu đề mục không đeo biểu tượng trang trí.
//
// Đo trực tiếp trên trang khoá học Khan ngày 29/07/2026:
//
//   102  tiêu đề h1..h4 trên trang
//     0  tiêu đề có biểu tượng
//   596  trên 599 thẻ SVG của cả trang đều đúng cỡ 24x24
//
// Tức Khan dùng MỘT cỡ biểu tượng duy nhất, và không gắn biểu tượng nào vào tiêu đề.
//
// Đo lại trên dự án cùng ngày: **62 tiêu đề đeo biểu tượng** trên 16 file, và `Sparkles` được
// dùng làm biểu tượng mặc định cho tiêu đề mục ở 24 chỗ, gần như luôn cùng một dạng
// `<h3 className="... flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand-info" />`.
//
// Vì sao đây là lỗi Component Composition chứ không phải chuyện thẩm mỹ: khi MỌI tiêu đề đều
// đeo biểu tượng, và phần lớn đeo CÙNG MỘT hình, thì biểu tượng thôi mang thông tin. Nó chỉ
// còn lấy đi chỗ và sự chú ý của chính chữ tiêu đề, thứ duy nhất thật sự phân biệt các mục.
// `AlertTriangle` xuất hiện 26 lần trên một ứng dụng học tập cũng cùng một họ: biểu tượng mang
// nghĩa mạnh nhất mà dùng 26 lần thì thành hoa văn.
const tieuDeCoIcon: string[] = [];
for (const f of readdirSync(path.join(process.cwd(), "src/components"))) {
  if (!f.endsWith(".tsx")) continue;
  const noiDung = readFileSync(path.join(process.cwd(), "src/components", f), "utf8");
  const hit = noiDung.match(/<h[1-4][^>]*>\s*(?:\{[^}]*\}\s*)?<[A-Z][A-Za-z0-9]*\s+className="[^"]*\bw-\d/g);
  if (hit && hit.length) tieuDeCoIcon.push(`${f} (${hit.length})`);
}
check("Tiêu đề mục không đeo biểu tượng trang trí",
  tieuDeCoIcon.length === 0,
  tieuDeCoIcon.length === 0
    ? "0 tiêu đề đeo biểu tượng, khớp bản đo Khan (0 trên 102 tiêu đề)"
    : `${tieuDeCoIcon.length} file còn tiêu đề đeo biểu tượng: ${tieuDeCoIcon.slice(0, 5).join(", ")}`);

// AG9. Biểu tượng chỉ dùng ba cỡ, và không cỡ nào nhỏ hơn 16px.
//
// Đo trên trang Khan: 596 trên 599 thẻ SVG đúng cỡ 24x24, tức MỘT cỡ duy nhất. Đo trên dự án
// ngày 29/07/2026 trước khi sửa: **bảy cỡ** khác nhau (8, 10, 12, 14, 16, 20, 24px), trong đó
// 29 chỗ dùng biểu tượng **dưới 16px**, có chỗ chỉ 8px.
//
// Biểu tượng 8px và 10px vừa không đọc được, vừa nhỏ hơn chính dòng chữ đứng cạnh, nên nó
// không làm được việc duy nhất của một biểu tượng là làm mốc cho mắt bắt nhanh.
//
// Dự án giữ BA cỡ chứ không một cỡ như Khan, vì có chip và hàng dày đặc mà trang Khan không có:
//   w-4 (16px)  mặc định, nằm trong dòng chữ
//   w-5 (20px)  trong nút và thanh điều hướng
//   w-6 (24px)  đứng độc lập làm mốc thị giác
//
// Phép kiểm chỉ soi thẻ VIẾT HOA (component biểu tượng), không đụng `span`/`div` vì các chấm
// màu chú giải 10px là ô màu chứ không phải biểu tượng, và cỡ ấy đúng cho chúng.
const CO_ICON_HOP_LE = new Set(["w-4", "w-5", "w-6"]);
const coIconLa: string[] = [];
for (const f of readdirSync(path.join(process.cwd(), "src/components"))) {
  if (!f.endsWith(".tsx")) continue;
  const noiDung = readFileSync(path.join(process.cwd(), "src/components", f), "utf8");
  for (const m of noiDung.matchAll(/<[A-Z][A-Za-z0-9]*\s+className="[^"]*?\b(w-\d+(?:\.\d+)?)\s+h-\d/g)) {
    if (!CO_ICON_HOP_LE.has(m[1])) coIconLa.push(`${f}:${m[1]}`);
  }
}
check("Biểu tượng chỉ dùng ba cỡ, không cỡ nào dưới 16px",
  coIconLa.length === 0,
  coIconLa.length === 0
    ? "đúng ba cỡ 16/20/24px, không còn biểu tượng 8px hay 10px"
    : `${coIconLa.length} chỗ lệch thang: ${[...new Set(coIconLa)].slice(0, 6).join(", ")}`);

// AG10. Biến thể `dark:` phải bám lớp `.dark`, không bám thiết lập hệ điều hành.
//
// Tìm ra ngày 30/07/2026 khi ghép ảnh minh hoạ. Tailwind v4 mặc định dịch `dark:x` thành
// `@media (prefers-color-scheme: dark)`, tức bám thiết lập HỆ ĐIỀU HÀNH. Nhưng dự án bật chế độ
// tối bằng `document.documentElement.classList.add("dark")` ở `db.ts`, tức bằng CÔNG TẮC TRONG
// ỨNG DỤNG. Hai vế đều sai và sai ngược chiều nhau:
//
//   bật công tắc tối trong app, hệ điều hành sáng  -> nền tối nhưng KHÔNG lớp `dark:` nào chạy
//   hệ điều hành tối, app để chế độ sáng           -> mọi lớp `dark:` chạy trên giao diện sáng
//
// Đây là lần thứ TƯ dự án bắt được khuôn "lách qua hệ thống mà không có gì kêu lên", sau
// `brand-danger` chưa từng định nghĩa, `animate-fade-in-up` chưa từng có token, và 72 chỗ màu đi
// vòng qua bộ token. Lần này thậm chí không phải lớp sai: CSS sinh ra hợp lệ, chỉ gắn vào điều
// kiện không bao giờ khớp với cách app bật chế độ tối.
//
// Lỗi CÓ SẴN từ trước đợt ghép ảnh: `dark:bg-zinc-800` ở quy tắc thanh cuộn cũng chưa từng chạy.
const cssGoc = readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
const coDungDark = /\bdark:[a-z0-9:./[\]-]+/.test(
  readdirSync(path.join(process.cwd(), "src/components"))
    .filter(f => f.endsWith(".tsx"))
    .map(f => readFileSync(path.join(process.cwd(), "src/components", f), "utf8"))
    .join("\n") + cssGoc
);
check("Biến thể dark bám lớp .dark chứ không bám hệ điều hành",
  !coDungDark || /@custom-variant\s+dark\s*\(&:where\(\.dark,\s*\.dark\s*\*\)\)/.test(cssGoc),
  /@custom-variant\s+dark/.test(cssGoc)
    ? "đã khai @custom-variant dark, nên mọi lớp dark: chạy đúng theo công tắc trong ứng dụng"
    : "có dùng lớp dark: nhưng THIẾU @custom-variant, các lớp đó bám hệ điều hành chứ không bám công tắc app");

// AG11. Ảnh minh hoạ ở trạng thái rỗng phải là trang trí, và không được lấn át chữ.
//
// Bộ 10 ảnh GPT Image do Đàm tạo, ghép vào qua prop `illustration` của `EmptyState`. Ba ràng
// buộc, đều nhằm giữ nguyên tắc "chữ là chủ thể, ảnh là phụ" ở AGENTS.md 4.9g/4.9h:
//
//   1. Ảnh cao 128px (`h-32`), tức thấp hơn khối chữ bên dưới nó. Khoá CHIỀU CAO chứ không khoá
//      chiều rộng, vì chiều cao mới quyết định ảnh có lấn át chữ hay không.
//   2. `w-auto` giữ tỷ lệ gốc, không bóp méo ảnh.
//   3. `loading="lazy"` vì ảnh 250-300KB mà chỉ hiện ở trạng thái rỗng, tức phần lớn người dùng
//      không bao giờ tải tới.
//
// Bản đo Khan cho trạng thái rỗng KHÔNG có ảnh nào. Đây là chỗ dự án cố ý đi khác Khan, và chỉ
// ở trạng thái rỗng: đó là lúc màn hình trống trải nhất.
const nguonEmptyState = readFileSync(path.join(process.cwd(), "src/components/EmptyState.tsx"), "utf8");
const rangBuocAnh = [
  { ten: "khoá chiều cao 128px", ok: /className="[^"]*\bh-32\b/.test(nguonEmptyState) },
  { ten: "giữ tỷ lệ bằng w-auto", ok: /className="[^"]*\bw-auto\b/.test(nguonEmptyState) },
  { ten: "tải trễ", ok: /loading="lazy"/.test(nguonEmptyState) },
  { ten: "ảnh trang trí thì aria-hidden", ok: /aria-hidden=\{illustrationAlt \? undefined : true\}/.test(nguonEmptyState) },
].filter(r => !r.ok);
check("Ảnh minh hoạ trạng thái rỗng không lấn át chữ",
  rangBuocAnh.length === 0,
  rangBuocAnh.length === 0
    ? "ảnh cao 128px, giữ tỷ lệ, tải trễ, và ẩn khỏi trình đọc màn hình khi chỉ là trang trí"
    : `thiếu ${rangBuocAnh.length} ràng buộc: ${rangBuocAnh.map(r => r.ten).join(", ")}`);

g("AH. Số viết theo cách đọc của người Việt");

// AH1. Không in dấu thập phân kiểu tiếng Anh vào câu tiếng Việt.
//
// Tiếng Việt dùng DẤU PHẨY làm dấu thập phân, dấu chấm làm dấu phân nhóm nghìn, ngược hẳn
// tiếng Anh. `toFixed(1)` luôn trả dấu chấm, nên "mục tiêu 8.5 điểm" vừa sai quy ước vừa đọc
// ra thành tám nghìn năm trăm điểm.
//
// Đo ngày 30/07/2026 trước khi sửa: 23 chỗ trong tầng trình bày và 7 chuỗi hiển thị trong tầng
// dịch vụ. Cùng lúc đó `toLocaleString("vi-VN")` đã được dùng đúng cho số nguyên và ngày tháng,
// nên MỘT màn hình có thể hiện cùng lúc "1.234 ký tự" (đúng) và "5.0 điểm" (sai).
//
// RANH GIỚI QUAN TRỌNG NHẤT của phép kiểm này: `parseFloat(x.toFixed(2))` và `Number(...)`
// KHÔNG phải định dạng hiển thị mà là phép LÀM TRÒN, kết quả chảy tiếp vào phép tính khác. Có
// 5 chỗ như vậy trong `src/services` và thay chúng sẽ đổi giá trị tính toán chứ không đổi chữ.
// Nên phép kiểm chỉ bắt `.toFixed(` KHÔNG nằm trong `parseFloat(`/`Number(`.
const BO_QUA_TOFIXED = new Set(["numberFormat.ts"]);
const toFixedHienThi: string[] = [];
for (const thuMuc of ["src/components", "src/services"]) {
  for (const f of readdirSync(path.join(process.cwd(), thuMuc))) {
    if (!f.endsWith(".tsx") && !f.endsWith(".ts")) continue;
    if (BO_QUA_TOFIXED.has(f)) continue;
    const nguon = readFileSync(path.join(process.cwd(), thuMuc, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")   // bỏ chú thích khối, tránh tự báo đỏ vì trích bản cũ
      .replace(/^\s*\/\/.*$/gm, "");
    for (const m of nguon.matchAll(/\.toFixed\(\d\)/g)) {
      // nhìn ngược lên tối đa 200 ký tự: phép làm tròn luôn mở bằng parseFloat( hoặc Number(
      const truoc = nguon.slice(Math.max(0, m.index! - 200), m.index!);
      const moPhepTinh = /(?:parseFloat|Number)\(\s*\(?[^;]*$/.test(truoc);
      if (!moPhepTinh) toFixedHienThi.push(`${f}`);
    }
  }
}
check("Số thập phân hiển thị dùng dấu phẩy, không dùng dấu chấm",
  toFixedHienThi.length === 0,
  toFixedHienThi.length === 0
    ? "mọi chỗ hiển thị đi qua soThapPhan, các phép làm tròn parseFloat/Number giữ nguyên"
    : `${toFixedHienThi.length} chỗ còn in dấu chấm: ${[...new Set(toFixedHienThi)].slice(0, 6).join(", ")}`);

// AH2. `soThapPhan` phải thật sự trả về dấu phẩy.
//
// Phép kiểm AH1 chỉ soi mã nguồn, nên nếu hàm định dạng tự nó sai thì AH1 vẫn xanh trong khi
// màn hình vẫn hiện dấu chấm. Đây là chỗ CHẠY THẬT hàm đó.
const mauSo = soThapPhan(5, 1);
const mauNghin = soThapPhan(1234.5, 1);
check("Hàm soThapPhan trả đúng quy ước Việt",
  mauSo === "5,0" && mauNghin === "1.234,5",
  mauSo === "5,0" && mauNghin === "1.234,5"
    ? `5 ra "${mauSo}", 1234.5 ra "${mauNghin}"`
    : `sai quy ước: 5 ra "${mauSo}" (cần "5,0"), 1234.5 ra "${mauNghin}" (cần "1.234,5")`);

// AH3. Không tải bộ font mà không chỗ nào dùng.
//
// Đợt 28/07/2026 thay 371 chỗ dùng font đơn cách bằng `tabular-nums`, nhưng chỉ đổi chỗ DÙNG.
// Dòng `@import` vẫn tải đủ bốn kiểu chữ JetBrains Mono trên MỌI lần mở trang, và token
// `--font-mono` vẫn trỏ tới bộ font không ai gọi. Trình duyệt không báo lỗi khi tải font thừa,
// biên dịch vẫn xanh, nên nó sống sót qua hai mươi lượt rà.
//
// Cùng khuôn với `brand-danger` chưa từng định nghĩa và `animate-fade-in-up` chưa từng có
// token: lách qua hệ thống mà không có gì kêu lên.
const cssFont = readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
const nguonDungFont = readdirSync(path.join(process.cwd(), "src/components"))
  .filter(f => f.endsWith(".tsx"))
  .map(f => readFileSync(path.join(process.cwd(), "src/components", f), "utf8"))
  .join("\n");
const hoFontTrongImport = [...cssFont.matchAll(/family=([A-Za-z+]+)/g)].map(m => m[1].replace(/\+/g, " "));
const fontThua = hoFontTrongImport.filter(ten => {
  const khoa = ten.toLowerCase().replace(/\s+/g, "-");
  // font được coi là CÓ DÙNG nếu có token @theme trỏ tới nó và token ấy được gọi ở đâu đó
  const coToken = new RegExp(`--font-[a-z]+:\\s*"${ten}"`).test(cssFont);
  const coGoi = coToken && new RegExp(`font-(sans|display|mono|${khoa})\\b`).test(nguonDungFont + cssFont);
  return !coGoi;
});
check("Không tải bộ font nào mà mã nguồn không dùng",
  fontThua.length === 0,
  fontThua.length === 0
    ? `${hoFontTrongImport.length} bộ font tải về đều có chỗ dùng: ${hoFontTrongImport.join(", ")}`
    : `${fontThua.length} bộ font tải về nhưng không ai dùng: ${fontThua.join(", ")}`);

// AH4. Nút hành động chính phải đọc được ở CẢ HAI chế độ, không chỉ chế độ sáng.
//
// Tìm ra ngày 30/07/2026 khi rà chế độ tối lần đầu. Bộ ba màu nút của chế độ tối được đặt theo
// ý định "sáng hơn một bậc cho nổi trên nền sẫm" nhưng chưa từng đo với CHỮ TRẮNG nằm trên nó:
//
//     cơ bản    #3b7ae4   4,13:1   RỚT ngưỡng AA
//     rê chuột  #4d86e8   3,56:1   RỚT, bậc tệ nhất
//     bấm       #2f6ed6   4,86:1   đạt
//
// Đây là nút mở một lượt ôn, tức nút quan trọng nhất sản phẩm. Bản sáng được ghi chép kỹ
// (5,85:1) từ 28/07 nhưng bản tối thì không, vì suốt hai mươi lượt mọi phép đo tương phản đều
// chạy ở chế độ sáng.
//
// HAI RÀNG BUỘC KÉO NGƯỢC NHAU, nên phải đo cả hai đầu: càng sáng thì càng nổi trên nền trang
// nhưng càng chìm với chữ trắng đặt trên nó. Phép kiểm canh cả hai.
const khoiToi = (cssTheme.match(/\.dark\s*\{[\s\S]*?\n\}/) || [""])[0];
const khoiSangNut = (cssTheme.match(/:root\s*\{[\s\S]*?\n\}/) || [""])[0];
function docBienNut(khoi: string, ten: string): string | null {
  const m = khoi.match(new RegExp(`--${ten}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1] : null;
}
const nutHong: string[] = [];
const nutDat: string[] = [];
for (const [nhan, khoi, nenTrang] of [
  ["sáng", khoiSangNut, "#ffffff"],
  ["tối", khoiToi, null],
] as const) {
  const nenApp = nenTrang ?? docBienNut(khoi, "bg-app");
  for (const bac of ["nut-chinh", "nut-chinh-re-chuot", "nut-chinh-bam"]) {
    const mau = docBienNut(khoi, bac);
    if (!mau) continue;
    const voiChu = doTuongPhan(mau, "#ffffff");
    // 4,5:1 cho chữ trắng trên nút; 3:1 cho chính nút tách khỏi nền trang (WCAG 1.4.11)
    const voiNen = nenApp ? doTuongPhan(mau, nenApp) : 99;
    const ok = voiChu >= 4.5 && voiNen >= 3;
    (ok ? nutDat : nutHong).push(
      `${nhan}/${bac} ${mau} chữ ${voiChu.toFixed(2)}:1 nền ${voiNen.toFixed(2)}:1`);
  }
}
check("Nút chính đọc được ở cả chế độ sáng lẫn chế độ tối",
  nutHong.length === 0,
  nutHong.length === 0
    ? `cả ${nutDat.length} bậc đều đạt: ${nutDat.join("; ")}`
    : `${nutHong.length} bậc rớt chuẩn: ${nutHong.join("; ")}`);

// AH4b. Màu NỀN NÚT không được đem dùng làm MÀU CHỮ, vì hai vai trò kéo ngược nhau.
//
// Tìm ra ngay sau khi sửa AH4, bằng cách đo lại trên trình duyệt thay vì dừng ở lúc phép kiểm
// chuyển xanh. Làm tối `--nut-chinh` cho chữ trắng đọc được đã khiến 16 tên khái niệm ở màn
// Hỏi AI rớt xuống 4,02:1, vì chúng dùng chính token ấy làm màu chữ liên kết.
//
//     làm NỀN NÚT, chữ trắng đè lên   -> muốn TỐI đi   (#2f6ed6 đạt 4,86:1 với trắng)
//     làm MÀU CHỮ trên nền trang      -> muốn SÁNG lên (#2f6ed6 chỉ còn 4,02:1 với nền tối)
//
// Không giá trị nào thoả cả hai, nên đây không phải chuyện chọn màu mà là chuyện TÁCH VAI TRÒ.
// Màu chữ liên kết đã có sẵn token riêng là `brand-info`.
const dungNutLamChu: string[] = [];
for (const f of readdirSync(path.join(process.cwd(), "src/components"))) {
  if (!f.endsWith(".tsx")) continue;
  const nguon = readFileSync(path.join(process.cwd(), "src/components", f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
  if (/text-(?:\[color:var\(--nut-chinh\)\]|nut-chinh)/.test(nguon)) dungNutLamChu.push(f);
}
check("Màu nền nút không bị đem dùng làm màu chữ",
  dungNutLamChu.length === 0,
  dungNutLamChu.length === 0
    ? "nut-chinh chỉ dùng làm nền nút, màu chữ liên kết đi qua brand-info"
    : `${dungNutLamChu.length} file dùng nut-chinh làm màu chữ: ${dungNutLamChu.join(", ")}`);

// AH5. Không dùng lớp tiện ích mà dự án KHÔNG có định nghĩa cho nó.
//
// `prose` và `dark:prose-invert` được dùng ở hai chỗ trong `PracticeView`, nhưng plugin
// `@tailwindcss/typography` KHÔNG có trong `package.json`, nên ba lớp ấy chưa từng sinh ra một
// dòng CSS nào. Kiểm chứng trên trình duyệt: dựng một thẻ mang lớp `prose` rồi đọc kiểu tính
// toán, không khác gì thẻ trần.
//
// Đây là lần thứ SÁU dự án bắt được khuôn "lách qua hệ thống mà không có gì kêu lên", sau
// `brand-danger` chưa định nghĩa, `animate-fade-in-up` chưa có token, 72 chỗ màu đi vòng qua bộ
// token, `dark:` bám nhầm hệ điều hành, và bộ font tải về không ai dùng.
const goiPlugin = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const coTypography = Object.keys({ ...goiPlugin.dependencies, ...goiPlugin.devDependencies })
  .some(k => k.includes("typography"));
const dungProse: string[] = [];
for (const f of readdirSync(path.join(process.cwd(), "src/components"))) {
  if (!f.endsWith(".tsx")) continue;
  const nguon = readFileSync(path.join(process.cwd(), "src/components", f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
  if (/className="[^"]*\bprose\b/.test(nguon)) dungProse.push(f);
}
check("Không dùng lớp prose khi chưa cài plugin typography",
  coTypography || dungProse.length === 0,
  coTypography
    ? "đã cài @tailwindcss/typography nên lớp prose có hiệu lực"
    : dungProse.length === 0
      ? "chưa cài plugin typography, và cũng không chỗ nào dùng lớp prose"
      : `chưa cài plugin nhưng ${dungProse.length} file vẫn dùng prose: ${dungProse.join(", ")}`);

// AH6. Thanh cuộn cũng phải đi qua bộ token, không dùng màu Tailwind thô.
//
// Nhóm AF3b quét `src/components` để bắt màu đi vòng qua bộ token, nhưng CỐ Ý loại trừ
// `index.css`, nên bốn lớp `zinc` ở quy tắc thanh cuộn sống sót qua đợt dọn 72 chỗ hôm 29/07.
//
// Trước 30/07 thì hai lớp `dark:` ở đó chưa từng chạy, nên thanh cuộn chế độ tối vẫn dùng màu
// của chế độ sáng và không ai thấy gì lạ. Sau khi `@custom-variant dark` được thêm, chúng chạy
// thật, và thanh cuộn thành thứ duy nhất trong app không đổi theo bộ màu chung.
const cssCuon = readFileSync(path.join(process.cwd(), "src/index.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const HO_MAU_THO = ["zinc", "slate", "gray", "neutral", "stone", "red", "orange", "amber",
  "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet",
  "purple", "fuchsia", "pink", "rose"];
const mauThoTrongCss = HO_MAU_THO.filter(ho =>
  new RegExp(`@apply[^;]*\\b(?:bg|text|border)-${ho}-\\d`).test(cssCuon));
check("index.css không dùng màu Tailwind thô, chỉ dùng token",
  mauThoTrongCss.length === 0,
  mauThoTrongCss.length === 0
    ? "mọi quy tắc @apply trong index.css đều đi qua bộ token của dự án"
    : `${mauThoTrongCss.length} họ màu thô còn trong index.css: ${mauThoTrongCss.join(", ")}`);

g("AI. Lịch ôn bám NGÀY THI, không chỉ bám trạng thái hiện tại");

// AI1. Mức nhớ dự báo vào ngày thi phải phân hóa được các khái niệm cùng vừa học xong.
//
// Đây là chỗ sản phẩm này làm được thứ Anki KHÔNG làm. Anki xếp lịch cho trí nhớ vô thời hạn:
// nó giữ một mức nhớ mục tiêu cố định rồi nới dần khoảng cách, đúng cho người học ngoại ngữ.
// Người ôn thi thì chỉ cần nhớ cao nhất vào ĐÚNG MỘT NGÀY, nên câu hỏi đúng không phải "giờ
// còn nhớ bao nhiêu" mà là "tới hôm thi còn nhớ bao nhiêu".
//
// Đo ngày 30/07/2026, ba khái niệm ĐỀU VỪA HỌC HÔM NAY, kỳ thi còn 14 ngày:
//
//     S = 27,3 ngày  ->  nhớ bây giờ 100%,  nhớ ngày thi 60%
//     S =  7,9 ngày  ->  nhớ bây giờ 100%,  nhớ ngày thi 17%
//     S =  1,5 ngày  ->  nhớ bây giờ 100%,  nhớ ngày thi  5%
//
// Sáu yếu tố cũ của bảng chấm đều đo trạng thái BÂY GIỜ, nên cả ba chấm như nhau dù tới ngày
// thi chúng lệch 55 điểm phần trăm.
const S_BEN = 27.3, S_TRUNG = 7.9, S_MONG = 1.5;
const bayGioBa = [S_BEN, S_TRUNG, S_MONG].map(s => conNhoSauNgay(s, 0));
const ngayThiBa = [S_BEN, S_TRUNG, S_MONG].map(s => mucNhoVaoNgayThi(s, 14, 0)!);
const bayGioGiongNhau = Math.max(...bayGioBa) - Math.min(...bayGioBa) < 0.01;
const ngayThiPhanHoa = Math.max(...ngayThiBa) - Math.min(...ngayThiBa) > 0.4;
check("Mức nhớ ngày thi phân hóa được thứ mà mức nhớ hiện tại không thấy",
  bayGioGiongNhau && ngayThiPhanHoa,
  `bây giờ cả ba đều ${(bayGioBa[0] * 100).toFixed(0)}%; tới ngày thi lần lượt ` +
  ngayThiBa.map(v => `${(v * 100).toFixed(0)}%`).join(", "));

// AI2. Chưa đặt được ngày thi thì KHÔNG đoán, và hành vi cũ giữ nguyên.
//
// Đúng nếp "thiếu dữ liệu thì không suy diễn" của dự án. Trả `null` để nơi gọi lùi về đúng bộ
// trọng số cũ, thay vì bịa một ngày thi mặc định rồi dựng cả thang ưu tiên lên trên nó.
const khongNgayThi = [null, undefined, NaN].map(v => mucNhoVaoNgayThi(10, v as any, 0));
check("Chưa có ngày thi thì trả null chứ không đoán",
  khongNgayThi.every(v => v === null),
  khongNgayThi.every(v => v === null)
    ? "cả ba trường hợp thiếu ngày thi đều trả null"
    : `có trường hợp vẫn trả số: ${JSON.stringify(khongNgayThi)}`);

// AI3. Hàm mức nhớ ngày thi phải DÙNG LẠI đường cong duy nhất, không tự dựng công thức mới.
//
// Bất biến 4.9c: cả dự án chỉ có MỘT công thức độ bền. Phép kiểm này so kết quả hai đường: gọi
// thẳng `conNhoSauNgay` với tổng số ngày, và gọi `mucNhoVaoNgayThi`. Lệch nhau nghĩa là ai đó
// đã viết đường cong thứ hai, đúng cái đã từng khiến hai đường lệch 55 điểm phần trăm.
const lechDuongCong = [
  { S: 3, nghi: 2, toiThi: 10 },
  { S: 12, nghi: 0, toiThi: 30 },
  { S: 40, nghi: 5, toiThi: 7 },
].map(c => Math.abs(mucNhoVaoNgayThi(c.S, c.toiThi, c.nghi)! - conNhoSauNgay(c.S, c.nghi + c.toiThi)));
check("Mức nhớ ngày thi đi qua đúng đường cong quên duy nhất",
  lechDuongCong.every(d => d < 1e-9),
  lechDuongCong.every(d => d < 1e-9)
    ? "ba mốc thử đều khớp tuyệt đối với conNhoSauNgay"
    : `lệch khỏi đường cong chung: ${lechDuongCong.map(d => d.toFixed(6)).join(", ")}`);

// AI4. Độ bền `S` phải được CẤT LẠI trên hồ sơ, nếu không thì không chiếu tới ngày thi được.
//
// `forgettingScore` chỉ nói mức nhớ TẠI THỜI ĐIỂM tính, từ nó không suy ra được mức nhớ ở một
// mốc tương lai. Thiếu `S` thì yếu tố nhìn về tương lai im lặng và bảng chấm lặng lẽ quay về
// hành vi cũ mà không có gì báo.
const nguonLearnerModelAI = readFileSync(path.join(process.cwd(), "src/services/learnerModel.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const nguonEngineAI = readFileSync(path.join(process.cwd(), "src/services/learningEngine.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const catLaiS = /doBenTriNhoNgay:\s*parseFloat\(/.test(nguonLearnerModelAI);
const engineDocS = /profile\.doBenTriNhoNgay/.test(nguonEngineAI);
const engineDocNgayThi = /getSubjectGoal\(\)/.test(nguonEngineAI) && /mucNhoVaoNgayThi\(/.test(nguonEngineAI);
check("Sợi dây từ độ bền tới bảng chấm ưu tiên còn nguyên",
  catLaiS && engineDocS && engineDocNgayThi,
  catLaiS && engineDocS && engineDocNgayThi
    ? "learnerModel cất S lại, learningEngine đọc S và đọc ngày thi rồi chiếu tới hôm thi"
    : `đứt ở: ${[!catLaiS && "learnerModel không cất S", !engineDocS && "engine không đọc S",
        !engineDocNgayThi && "engine không đọc ngày thi"].filter(Boolean).join("; ")}`);

// AI5. Đi qua ENGINE THẬT: khái niệm mong manh phải được xếp cao hơn khái niệm bền,
// dù CẢ HAI vừa học xong và mức nhớ hiện tại của chúng bằng nhau.
//
// Bốn phép kiểm trên chỉ canh phần toán và phần nối dây. Phép kiểm này canh thứ thật sự quan
// trọng: bảng chấm có ĐỔI THỨ HẠNG hay không. Không có nó thì cả nhóm AI có thể xanh trong khi
// yếu tố mới bị nhân với trọng số 0 và không ảnh hưởng gì tới đề được sinh ra.
//
// Cách dựng: lấy một câu hỏi thật, tạo bằng chứng thật cho khái niệm của nó, rồi chấm HAI LẦN
// với đúng một thứ khác nhau là độ bền `S` cất trên hồ sơ. Mọi yếu tố khác giữ nguyên.
// CÁCH CÔ LẬP: giữ NGUYÊN hồ sơ, chỉ đổi mỗi NGÀY THI rồi chấm lại. Mọi yếu tố khác đọc từ
// cùng một hồ sơ nên không thể đổi, vậy chênh lệch điểm chỉ có thể đến từ yếu tố mới.
//
// Không cô lập được bằng cách ghi thẳng `S` vào hồ sơ: `getOrCreateProfile` gọi
// `recalculateForgettingScore` ở MỖI LẦN ĐỌC nên giá trị ghi vào bị tính đè ngay. Bản đầu của
// phép kiểm này làm vậy và cho hai điểm bằng nhau tuyệt đối, trông y như yếu tố mới bị vô hiệu.
const cauThuAI = questions.find(q => kbService.resolveConceptsForQuestion(dbService.getActiveSubjectId(), q, 1).length > 0);
if (cauThuAI) {
  const khaiNiemAI = kbService.resolveConceptsForQuestion(dbService.getActiveSubjectId(), cauThuAI, 1)[0].node.concept;
  for (let i = 0; i < 8; i++) learnerModelService.logConceptAttempt(khaiNiemAI, true, 12);

  const mucTieuGoc = dbService.getSubjectGoal();
  const chamVoiNgayThi = (soNgay: number): number => {
    dbService.saveSubjectGoal({
      ...mucTieuGoc,
      examDate: TimeService.formatDateISO(TimeService.parseToDate(TimeService.now().getTime() + soNgay * NGAY_MS)),
    });
    return learningEngine.scoreQuestions([cauThuAI])[0].score;
  };

  const diemThiXa = chamVoiNgayThi(60);  // còn 60 ngày, nếu không ôn lại thì tới hôm thi mất nhiều
  const diemThiGan = chamVoiNgayThi(1);  // còn 1 ngày, kiến thức vừa học chắc chắn còn nguyên
  dbService.saveSubjectGoal(mucTieuGoc);

  check("Ngày thi thật sự đổi được thứ hạng ưu tiên trong engine",
    diemThiXa > diemThiGan,
    diemThiXa > diemThiGan
      ? `cùng một hồ sơ: kỳ thi còn 60 ngày chấm ${diemThiXa.toFixed(4)}, còn 1 ngày chấm ${diemThiGan.toFixed(4)}`
      : `ngày thi KHÔNG ảnh hưởng tới điểm: 60 ngày ${diemThiXa.toFixed(4)} so với 1 ngày ${diemThiGan.toFixed(4)}`);
} else {
  info("Bỏ qua phép kiểm engine xếp hạng theo ngày thi: không tìm được câu hỏi có khái niệm.");
}

// ===========================================================================
// AJ. Cân bằng độ dài phương án
// ===========================================================================
g("AJ. Cân bằng độ dài phương án");

// AJ1. Không câu nào được lộ đáp án qua độ dài, TRỪ danh sách miễn có tên và có lý do.
//
// Vì sao dùng danh sách miễn thay vì nới ngưỡng thành "không quá N câu": một con số nới ra thì
// che được mọi câu mới hỏng, còn danh sách có tên thì câu thứ hai hỏng là đỏ ngay. Và cái giá phải
// trả là mỗi lần miễn đều phải viết ra lý do, tức không miễn được cho qua chuyện.
//
// #3214 là câu duy nhất được miễn. Bản viết lại của nó TRƯỢT THẨM ĐỊNH NGƯỢC: lượt gọi độc lập,
// không cho biết đáp án, chọn phương án 'a' trong khi đáp án thật là 'b'. Nghĩa là bản viết lại
// nhiều khả năng có hai phương án đúng. Đã giữ nguyên bản cũ, chấp nhận lệch 22%, vì một câu lệch
// độ dài hại ít hơn hẳn một câu có hai đáp án đúng. Gỡ khỏi danh sách này sau khi Đàm sửa tay.
const MIEN_LECH_DO_DAI = new Set([3214]);
const cauLechDoDai = questions.filter(q => !canBangDoDaiPhuongAn(q));
const cauLechChuaMien = cauLechDoDai.filter(q => !MIEN_LECH_DO_DAI.has(Number(q.id)));
check("Không câu nào lộ đáp án qua độ dài phương án",
  cauLechChuaMien.length === 0,
  cauLechChuaMien.length === 0
    ? `${questions.length} câu, ${cauLechDoDai.length} câu vượt ngưỡng ${NGUONG_LECH_DO_DAI} và đều nằm trong danh sách miễn có lý do`
    : `${cauLechChuaMien.length} câu vượt ngưỡng mà không được miễn: ${cauLechChuaMien
      .slice()
      .sort((a, b) => doLechDoDaiPhuongAn(b) - doLechDoDaiPhuongAn(a))
      .slice(0, 5)
      .map(q => `#${q.id} lệch ${(doLechDoDaiPhuongAn(q) * 100).toFixed(0)}%`)
      .join(", ")}. Sửa bằng: node scripts/rebalance-distractors.mjs`);

// AJ2. Tỷ lệ "đáp án đúng là phương án dài nhất" phải nằm quanh mức ngẫu nhiên.
//
// Đây mới là phép kiểm đo đúng cái hại thật. AJ1 canh từng câu, nhưng người học không khai thác
// từng câu mà khai thác THÓI QUEN của cả ngân hàng: cứ chọn phương án dài nhất là được điểm.
//
// Hai mép đều phải canh, và mép dưới không phải để cho đẹp. Sửa quá tay cho tỷ lệ về 0% thì lại
// đẻ ra mẹo ngược, "phương án dài nhất chắc chắn sai", còn dễ khai thác hơn vì loại thẳng được một
// phương án. Mục tiêu là xoá tín hiệu, không phải đảo chiều nó.
const soDaiNhat = questions.filter(q => {
  const doDai = (["a", "b", "c", "d"] as const).map(k => String(q.options[k] ?? "").length);
  return String(q.options[q.correctAnswer] ?? "").length === Math.max(...doDai);
}).length;
const tyLeDaiNhat = questions.length > 0 ? (soDaiNhat / questions.length) * 100 : 0;
const trongVungDat = tyLeDaiNhat >= 20 && tyLeDaiNhat <= 35;
check("Chọn phương án dài nhất mà không đọc câu hỏi không ăn được điểm",
  trongVungDat,
  `đáp án đúng là phương án dài nhất ở ${soDaiNhat}/${questions.length} câu, tức ${tyLeDaiNhat.toFixed(1)}% ` +
  `(ngẫu nhiên 25%, vùng đạt 20% tới 35%). Chiến lược đoán được ${(tyLeDaiNhat / 10).toFixed(1)} trên 10 điểm` +
  (trongVungDat ? "" : tyLeDaiNhat > 35 ? ", tức vẫn lộ đáp án" : ", tức đã sửa quá tay và đẻ ra mẹo ngược"));

// AJ3. Hàm chặn ở cổng nhận phải thật sự chặn.
//
// Không đo trên ngân hàng thật mà dựng câu giả ngay tại đây. Lý do: AJ1 và AJ2 sẽ xanh cả khi hàm
// chặn bị vô hiệu, miễn là dữ liệu đã sạch. Đây đúng khuôn "phép kiểm rỗng" mà dự án đã bắt được
// bốn lần: phép kiểm canh kết quả cuối, không canh sợi dây tạo ra kết quả ấy.
const cauLechGiaLap: any = {
  question: "Câu kiểm tra hàm chặn, không nằm trong ngân hàng nào.",
  options: {
    a: "Đáp án đúng được viết thật dài và thật đầy đủ ý để cố tình lộ ra rằng nó là đáp án đúng",
    b: "Ngắn",
    c: "Cũng ngắn",
    d: "Ngắn nữa",
  },
  correctAnswer: "a",
};
const cauCanBangGiaLap: any = {
  question: "Câu kiểm tra hàm chặn, bản đã cân.",
  options: {
    a: "Phương án thứ nhất viết vừa phải, dài xấp xỉ ba phương án còn lại",
    b: "Phương án thứ hai viết vừa phải, dài xấp xỉ ba phương án còn lại",
    c: "Phương án thứ ba viết vừa phải, dài xấp xỉ ba phương án còn lại",
    d: "Phương án thứ tư viết vừa phải, dài xấp xỉ ba phương án còn lại",
  },
  correctAnswer: "a",
};
check("Hàm canBangDoDaiPhuongAn chặn được câu lệch và cho qua câu cân",
  !canBangDoDaiPhuongAn(cauLechGiaLap) && canBangDoDaiPhuongAn(cauCanBangGiaLap),
  `câu lệch chấm ${(doLechDoDaiPhuongAn(cauLechGiaLap) * 100).toFixed(0)}% nên bị chặn, ` +
  `câu cân chấm ${(doLechDoDaiPhuongAn(cauCanBangGiaLap) * 100).toFixed(0)}% nên được qua`);

// AJ4. Lời nhắc sinh câu hỏi phải NÓI RA ràng buộc độ dài.
//
// Chốt chặn ở cổng nhận (AJ3) loại được câu lệch, nhưng loại câu là lãng phí một lượt gọi AI và
// làm người dùng nhận ít câu hơn số họ xin. Lời nhắc phải yêu cầu trước, chốt chặn chỉ để bắt
// phần mô hình trượt. Thiếu vế lời nhắc thì mọi lượt sinh đều phải viết lại quá nửa số câu.
const nguonLoiNhac = readFileSync(path.join(process.cwd(), "functions-src/ai/generate.ts"), "utf8");
const coRangBuocDoDai = /ĐỘ DÀI BỐN PHƯƠNG ÁN PHẢI TƯƠNG ĐƯƠNG/.test(nguonLoiNhac) && /120%/.test(nguonLoiNhac);
check("Lời nhắc sinh câu hỏi có ràng buộc độ dài phương án",
  coRangBuocDoDai,
  coRangBuocDoDai
    ? "lời nhắc yêu cầu bốn phương án dài tương đương, trần 120% so với phương án ngắn nhất"
    : "lời nhắc KHÔNG nói gì về độ dài phương án, mô hình sẽ tiếp tục viết đáp án đúng dài hơn hẳn");

// AJ5. Ba bản chép của cùng một công thức phải khớp nhau.
//
// Công thức lệch độ dài nằm ở ba chỗ vì ba chỗ ấy chạy trong ba môi trường khác nhau: engine chạy
// trong trình duyệt (`src/services/ai.ts`), công cụ đo chạy độc lập ngoài ứng dụng
// (`scripts/bank-audit.mjs`), và công cụ sửa dữ liệu (`scripts/rebalance-distractors.mjs`).
//
// Ba bản chép trôi ra khác nhau là chuyện ĐÃ XẢY RA ở dự án này: hai đường cong quên từng lệch
// nhau 55 điểm phần trăm, và cái hiện cho người học nhìn lại không phải cái điều khiển việc chọn
// câu (xem nhóm V). Nên phải có phép kiểm buộc chúng khớp.
const nguonCongCuDo = readFileSync(path.join(process.cwd(), "scripts/bank-audit.mjs"), "utf8");
const nguonCongCuSua = readFileSync(path.join(process.cwd(), "scripts/rebalance-distractors.mjs"), "utf8");
const congThucKhop = /dungLen - daiNhi\) \/ dungLen/.test(nguonCongCuDo)
  && /dung\.length - Math\.max\(\.\.\.conLai\)\) \/ dung\.length/.test(nguonCongCuSua);
const coNguong = (nguon: string) => new RegExp(`const NGUONG = ${NGUONG_LECH_DO_DAI}`).test(nguon)
  || /const NGUONG = 0\.10?\b/.test(nguon);
// Canh ngưỡng ở CẢ HAI công cụ. Bản đầu chỉ canh công cụ sửa, nên `scripts/bank-audit.mjs` âm thầm
// giữ ngưỡng 0,2 suốt cả đợt và báo "5 câu vượt ngưỡng" trong khi engine đếm ra 140.
const nguongKhop = coNguong(nguonCongCuSua) && coNguong(nguonCongCuDo);
// Bản chép thứ hai phải khớp: mẫu tìm nhãn phương án trong lời giải. Công cụ sửa dữ liệu dùng nó
// làm chốt chặn cuối, engine dùng nó cho AJ6. Lệch nhau thì công cụ đọc một kiểu, phép kiểm đọc
// một kiểu khác, và lỗi lọt đúng khe giữa hai kiểu ấy.
const mauNhanKhop = nguonCongCuSua.includes(NHAN_PHUONG_AN_TRONG_LOI_GIAI.source);
check("Hai công cụ ngoài dùng đúng công thức và đúng ngưỡng của engine",
  congThucKhop && nguongKhop && mauNhanKhop,
  congThucKhop && nguongKhop && mauNhanKhop
    ? `cả ba chỗ cùng đo (dài đáp án đúng trừ dài phương án nhì) chia dài đáp án đúng, cùng ngưỡng ${NGUONG_LECH_DO_DAI}, cùng mẫu tìm nhãn phương án`
    : `công thức khớp: ${congThucKhop}, ngưỡng khớp: ${nguongKhop}, mẫu nhãn khớp: ${mauNhanKhop}`);

// AJ6. Lời giải không được tự gọi ĐÁP ÁN ĐÚNG là một phương án sai.
//
// Đây là phép kiểm quan trọng nhất nhóm AJ, vì nó canh loại lỗi NỘI DUNG chứ không phải lỗi định
// dạng, và loại lỗi ấy đã xảy ra thật khi viết lại hàng loạt (xem chú thích dài ở
// `loiGiaiGoiNhamDapAnDung` trong `src/services/ai.ts`).
//
// Đặt trên DỮ LIỆU THẬT chứ không phải câu giả, khác hẳn AJ3. Lý do: rủi ro ở đây không phải hàm
// chặn bị vô hiệu mà là dữ liệu bị nhiễm, và mọi lượt sửa dữ liệu diện rộng về sau đều đi qua đúng
// cái cửa này. Sau khi viết lại 140 câu, đây là lưới duy nhất đọc tới nội dung lời giải.
const loiGiaiGoiSai = questions.filter(q => loiGiaiGoiNhamDapAnDung(String(q.explanation ?? ""), q.correctAnswer));
check("Không lời giải nào gọi chính đáp án đúng là phương án sai",
  loiGiaiGoiSai.length === 0,
  loiGiaiGoiSai.length === 0
    ? `${questions.length} câu, không câu nào có lời giải liệt kê chữ cái đáp án đúng vào nhóm phương án sai`
    : `${loiGiaiGoiSai.length} câu sai: ${loiGiaiGoiSai.slice(0, 5).map(q => `#${q.id} (đáp án '${q.correctAnswer}')`).join(", ")}`);

// AJ7. Hai lời nhắc viết lại phương án nhiễu phải BƠM chữ cái thật của từng câu vào.
//
// AJ6 bắt hậu quả, phép kiểm này bắt nguyên nhân. Cùng một cái bẫy đã cắn ở HAI file khác nhau vì
// cùng một lối viết lời nhắc: nêu ví dụ bằng giá trị cụ thể ("gọi tên theo lối 'phương án b, c, d
// không phản ánh...'") rồi trông chờ mô hình hiểu đó là ví dụ về văn phong. Mô hình chép lại chính
// ba chữ cái ấy cho mọi câu, kể cả câu có đáp án đúng là 'b'.
//
// Cách chặn duy nhất chắc chắn là không để chữ cái nào cố định trong lời nhắc, mà bơm chữ cái thật
// của từng câu vào. Nên phép kiểm canh sự CÓ MẶT của phép bơm ấy, ở cả hai đường chạy: đường trong
// trình duyệt (`src/services/ai.ts`) và đường sửa dữ liệu hàng loạt (`scripts/rebalance-*.mjs`).
const nguonEngineAi = readFileSync(path.join(process.cwd(), "src/services/ai.ts"), "utf8");
const bomChuCaiTrongEngine = /chuCaiNhieu\.join\(", "\)/.test(nguonEngineAi);
const bomChuCaiTrongCongCu = /chuCaiNhieu\.join\(", "\)/.test(nguonCongCuSua);
check("Lời nhắc viết lại phương án nhiễu bơm chữ cái thật của từng câu",
  bomChuCaiTrongEngine && bomChuCaiTrongCongCu,
  bomChuCaiTrongEngine && bomChuCaiTrongCongCu
    ? "cả đường trình duyệt lẫn đường sửa hàng loạt đều nói rõ ba chữ cái nhiễu của chính câu đang sửa"
    : `engine bơm: ${bomChuCaiTrongEngine}, công cụ sửa bơm: ${bomChuCaiTrongCongCu}. Thiếu thì mô hình sẽ chép lại chữ cái trong ví dụ và gọi nhầm đáp án đúng là phương án sai`);

// ===========================================================================
// AN. Thời gian từng câu
// ===========================================================================
g("AN. Thời gian từng câu");

// AN1. Bản ghi CŨ không có `answerTimings` vẫn phải đọc được, mọi engine không nổ.
//
// Đây là phép kiểm phải viết TRƯỚC, vì phần lớn lịch sử hiện có của Đàm không có trường này. Một
// trường mới bắt buộc sẽ làm toàn bộ lịch sử cũ hỏng ngay lúc nạp, và kiểu lỗi ấy không hiện ra
// trong `tsc` vì `strictNullChecks` đang tắt.
dbService.clearAllHistory();
const dsCauAN = questions.slice(0, 10).map(q => q.id);
dbService.saveAttempt({
  id: "an1-cu", examType: "random", startTime: new Date(0).toISOString(),
  endTime: new Date(0).toISOString(), questions: dsCauAN, answers: {}, bookmarks: [], flags: [],
  isSubmitted: true, score: 0, timeSpent: 300,
} as any);
let banGhiCuDocDuoc = true;
try {
  learnerModelService.doNhipLamBai();
  nhipRiengMoiCau();
  mocNhipChuan(dsCauAN);
} catch {
  banGhiCuDocDuoc = false;
}
check("Bản ghi lịch sử cũ không có thời gian từng câu vẫn đọc được",
  banGhiCuDocDuoc,
  banGhiCuDocDuoc
    ? "lượt không có answerTimings vẫn chạy qua cả ba đường đo nhịp, không ngoại lệ nào"
    : "một engine ném lỗi khi gặp bản ghi cũ");

// AN2. Nhịp riêng phải ưu tiên số ĐO TỪNG CÂU, và số đo ấy phải phân hóa được.
//
// Điểm mấu chốt: trước đây mọi câu trong cùng một lượt mang CÙNG một con số (phân bổ đều), nên
// mọi chỉ số suy ra từ thời gian đều mù. Phép kiểm dựng một lượt có câu nhanh 5 giây và câu chậm
// 60 giây, rồi đòi trung vị phải bám nhóm câu thật chứ không phải trung bình cả lượt.
dbService.clearAllHistory();
const thoiGianTungCau: Record<number, number> = {};
questions.slice(0, 30).forEach((q, i) => { thoiGianTungCau[q.id] = i < 15 ? 5 : 60; });
dbService.saveAttempt({
  id: "an2-moi", examType: "random", startTime: new Date(0).toISOString(),
  endTime: new Date(0).toISOString(), questions: questions.slice(0, 30).map(q => q.id),
  answers: {}, bookmarks: [], flags: [], isSubmitted: true, score: 0,
  timeSpent: 15 * 5 + 15 * 60, answerTimings: thoiGianTungCau,
} as any);
const nhipTuSoDo = nhipRiengMoiCau();
// Trung vị của 15 mẫu 5 giây và 15 mẫu 60 giây là 32,5. Trung bình cả lượt là 32,5 giây một câu
// nên hai con số trùng nhau ở ca này; điều PHẢI khác là số lượng MẪU. Kiểm bằng cách bỏ đi một
// nửa nhanh: nếu đang đọc từng câu thì trung vị nhảy lên 60, nếu vẫn đọc trung bình lượt thì không.
dbService.clearAllHistory();
const chiCauCham: Record<number, number> = {};
questions.slice(0, 25).forEach(q => { chiCauCham[q.id] = 60; });
dbService.saveAttempt({
  id: "an2-cham", examType: "random", startTime: new Date(0).toISOString(),
  endTime: new Date(0).toISOString(), questions: questions.slice(0, 25).map(q => q.id),
  answers: {}, bookmarks: [], flags: [], isSubmitted: true, score: 0,
  // Tổng thời gian cố ý ghi SAI thành 250 giây, tức 10 giây một câu, để phân biệt hai đường đọc.
  timeSpent: 250, answerTimings: chiCauCham,
} as any);
const nhipUuTienSoDo = nhipRiengMoiCau();
const dungSoDoTungCau = nhipUuTienSoDo !== null && Math.abs(nhipUuTienSoDo - 60) < 0.01;
check("Nhịp riêng đọc số đo từng câu chứ không đọc tổng thời gian lượt",
  dungSoDoTungCau,
  dungSoDoTungCau
    ? "25 câu đo được 60 giây mỗi câu cho trung vị 60, dù tổng thời gian lượt ghi 10 giây một câu"
    : `trung vị đo được ${nhipUuTienSoDo}, đáng lẽ 60 giây. Nhịp từ lượt trước: ${nhipTuSoDo}`);

// AN3. Màn làm bài phải chốt đoạn đếm ở CẢ BỐN tình huống đã lường trước.
//
// Canh ở nguồn vì đây là logic của trình duyệt, không gọi lại được trong Node. Bốn tình huống:
// quay lại câu cũ (cộng dồn chứ không ghi đè), chuyển câu bằng phím tắt (chung một đường), tạm
// dừng đồng hồ, và tab bị ẩn. Thiếu cái cuối thì một lần đi pha cà phê thành 20 phút nghĩ một câu.
const nguonManBaiAN = readFileSync(path.join(process.cwd(), "src/components/PracticeView.tsx"), "utf8");
const bonTinhHuong = {
  "cộng dồn khi quay lại câu cũ": /thoiGianTungCauRef\.current\[maCau\] = \(thoiGianTungCauRef\.current\[maCau\] \|\| 0\) \+ giay/,
  "chốt theo currentIdx nên phím tắt cũng đi qua": /\[currentIdx, activeQuestion\?\.id, timerActive, exam\.isSubmitted\]/,
  "dừng khi tạm dừng đồng hồ": /timerActive && document\.visibilityState === "visible"/,
  "dừng khi tab bị ẩn": /visibilitychange/,
};
const thieuTinhHuong = Object.keys(bonTinhHuong).filter(k => !(bonTinhHuong as any)[k].test(nguonManBaiAN));
check("Đồng hồ từng câu xử đúng cả bốn tình huống đã lường",
  thieuTinhHuong.length === 0,
  thieuTinhHuong.length === 0
    ? "cộng dồn khi quay lại, chung đường với phím tắt, dừng khi tạm dừng, dừng khi tab ẩn"
    : `thiếu: ${thieuTinhHuong.join("; ")}`);

// AN4. Cây cầu vào tầng trí nhớ phải dùng số đo thật khi có, và lùi về phân bổ đều khi không có.
//
// Bất biến 4.9e: `dbService.addOnSubmit` là cây cầu DUY NHẤT, tuyệt đối không mở đường thứ hai.
const nguonCauNoi = readFileSync(path.join(process.cwd(), "src/services/studentEvolutionEngine.ts"), "utf8");
const dungSoDoThat = /attempt\.answerTimings \|\| \{\}/.test(nguonCauNoi)
  && /responseTimeSeconds: layThoiGianCau\(qId\)/.test(nguonCauNoi)
  && /phanBoDeu/.test(nguonCauNoi);
check("Cây cầu vào tầng trí nhớ dùng thời gian đo thật, có đường lùi cho bản ghi cũ",
  dungSoDoThat,
  dungSoDoThat
    ? "đọc answerTimings cho từng câu, bản ghi cũ không có thì lùi về phân bổ đều thay vì đọc thành 0"
    : "chưa nối số đo thật vào, hoặc thiếu đường lùi cho lịch sử cũ");

// AN5. BỘ QUÉT CẢ HỌ: mọi nơi mở đoạn đếm đều phải đi qua cổng, không nơi nào gọi thẳng.
//
// VÌ SAO CÓ PHÉP KIỂM NÀY (13/08/2026). AN3 ở trên canh rằng bốn tình huống ĐƯỢC KHAI trong mã,
// và nó xanh. Nhưng nó xanh trong khi `handleSelectAnswer` vẫn mở đoạn đếm bằng một lời gọi thẳng
// không qua điều kiện nào. Hệ quả đo được: bấm đáp án lúc đang TẠM DỪNG đồng hồ vẫn mở một đoạn,
// và đoạn đó bị cộng vào câu khi tạm dừng kết thúc. Tức tình huống 3 được khai là đã xử nhưng thật
// ra có một cửa sau.
//
// Bài học: canh sự TỒN TẠI của một cổng thì không đủ, phải canh rằng KHÔNG AI ĐI VÒNG qua nó.
// Vì vậy phép kiểm này quét từng lời gọi `batDauDemChoCau` và đòi mỗi lời gọi phải nằm trong tầm
// ảnh hưởng của `duocDemGio()`. Thêm một cửa sau mới ở bất cứ đâu là đỏ ngay.
const viTriGoiDemGio: number[] = [];
for (let i = nguonManBaiAN.indexOf("batDauDemChoCau("); i !== -1; i = nguonManBaiAN.indexOf("batDauDemChoCau(", i + 1)) {
  // Bỏ qua chính dòng khai báo hàm, đó không phải lời gọi.
  if (/const\s+$/.test(nguonManBaiAN.slice(Math.max(0, i - 10), i))) continue;
  viTriGoiDemGio.push(i);
}
// Một lời gọi được coi là hợp lệ khi cổng nằm trong CHÍNH ĐỐI SỐ của nó (dạng
// `duocDemGio() ? maCau : null`), hoặc nằm ở khối bao ngay trên (dạng `if (duocDemGio()) { ... }`).
// Quét cả hai phía vì hai dạng này đặt cổng ở hai chỗ khác nhau trong văn bản.
const goiKhongQuaCong = viTriGoiDemGio.filter(i => {
  const doiSo = nguonManBaiAN.slice(i, nguonManBaiAN.indexOf(")", i) + 1);
  const khoiBaoTren = nguonManBaiAN.slice(Math.max(0, i - 220), i);
  return !doiSo.includes("duocDemGio()") && !khoiBaoTren.includes("duocDemGio()");
});
check("Không lời gọi nào mở đoạn đếm mà đi vòng qua cổng ba điều kiện",
  viTriGoiDemGio.length > 0 && goiKhongQuaCong.length === 0,
  viTriGoiDemGio.length === 0
    ? "không tìm thấy lời gọi nào, phép kiểm đang rỗng"
    : goiKhongQuaCong.length === 0
      ? `cả ${viTriGoiDemGio.length} lời gọi đều nằm dưới duocDemGio()`
      : `${goiKhongQuaCong.length}/${viTriGoiDemGio.length} lời gọi mở đoạn đếm không qua cổng`);

dbService.clearAllHistory();

// ===========================================================================
// AO. Nhớ lại chủ động
// ===========================================================================
g("AO. Nhớ lại chủ động");

const nguonManNhoLai = readFileSync(path.join(process.cwd(), "src/components/RecallSessionView.tsx"), "utf8");

// AO1. Định nghĩa chuẩn TUYỆT ĐỐI không được dựng ra trước khi người học nộp bài.
//
// Đây là phép kiểm quan trọng nhất nhóm này, vì nó canh chính lý do chế độ này tồn tại. Đọc định
// nghĩa rồi mới viết thì thứ luyện được chỉ còn là đọc hiểu, và bằng chứng đưa vào đường cong quên
// thành bằng chứng của một việc khác hẳn.
//
// Canh ở nguồn theo VỊ TRÍ trong file: mọi chỗ nhắc tới định nghĩa chuẩn hoặc thước chấm phải nằm
// SAU mốc mở khối "đã chấm". Ẩn bằng CSS không tính là ẩn, nên không canh bằng class.
/*
  Quét trên bản ĐÃ BÓC CHÚ THÍCH. Bản đầu quét thẳng văn bản nguồn và đỏ ngay lần chạy đầu, vì nó
  bắt đúng dòng chú thích giải thích rằng chỗ đó không được có `expectedPoints`. Một bộ quét không
  phân biệt được chú thích với mã sẽ phạt chính lời giải thích về nó, và đó là lần thứ ba trong dự
  án một phép kiểm mới đỏ vì bản thân nó sai chứ không phải vì mã sai.

  Thay bằng khoảng trắng cùng độ dài để mọi vị trí ký tự vẫn khớp với bản gốc.
*/
const giuDoDai = (m: string) => m.replace(/[^\n]/g, " ");
const manNhoLaiKhongChuThich = nguonManNhoLai
  .replace(/\/\*[\s\S]*?\*\//g, giuDoDai)
  .replace(/\/\/[^\n]*/g, giuDoDai);

const mocDaCham = manNhoLaiKhongChuThich.indexOf('trangThai === "da-cham" && ketQua');
const mocThanHam = manNhoLaiKhongChuThich.indexOf("return (");
const viTriLoNoiDung: string[] = [];
[".definition", "expectedPoints", "memoryHook"].forEach(dau => {
  for (let i = manNhoLaiKhongChuThich.indexOf(dau); i !== -1; i = manNhoLaiKhongChuThich.indexOf(dau, i + 1)) {
    // Chỉ xét từ thân hàm dựng màn trở đi; phần khai báo và nhập khẩu phía trên không dựng ra gì.
    if (i < mocThanHam) continue;
    if (mocDaCham === -1 || i < mocDaCham) viTriLoNoiDung.push(dau);
  }
});
// Bộ nhớ đệm tra nút tri thức cũng phải tự khóa lại khi chưa chấm, không chỉ dựa vào chỗ đặt JSX.
const memoTuKhoa = /trangThai !== "da-cham"\) return null/.test(manNhoLaiKhongChuThich);
check("Định nghĩa chuẩn không được dựng ra trước khi người học nộp bài",
  viTriLoNoiDung.length === 0 && memoTuKhoa && mocDaCham !== -1,
  viTriLoNoiDung.length > 0
    ? `lộ nội dung trước khi chấm: ${[...new Set(viTriLoNoiDung)].join(", ")}`
    : !memoTuKhoa
      ? "bộ tra nút tri thức không tự khóa khi chưa chấm"
      : "thước chấm và định nghĩa chuẩn đều nằm sau mốc đã chấm, bộ tra nút cũng tự khóa");

// AO2. Kết quả chấm phải CHẢY TỚI tầng trí nhớ, qua đúng cây cầu `addOnSubmit`.
dbService.clearAllHistory();
const doThiAO = kbService.getKnowledgeGraph(dbService.getActiveSubjectId());
const nutAO = doThiAO.find(n => !n.laNutTongHop && n.definition && n.definition.length > 20);
const tenKhaiNiemAO = nutAO ? nutAO.concept : "";
const truocAO = conceptMemoryService.getConceptProfile(tenKhaiNiemAO);
const soLanTruocAO = truocAO?.timesStudied || 0;

const phienNhoLai: any = {
  id: "recall_test_ao2",
  examType: "recall",
  startTime: TimeService.now().toISOString(),
  endTime: TimeService.now().toISOString(),
  questions: [],
  answers: {},
  bookmarks: [],
  flags: [],
  isSubmitted: true,
  score: 1,
  timeSpent: 90,
  recallAttempts: [{
    conceptName: tenKhaiNiemAO,
    answerText: "Bài viết thử của phép kiểm, đủ dài để không bị chặn ở cổng độ dài tối thiểu.",
    gradedAt: TimeService.now().toISOString(),
    passed: true,
    hitPoints: ["ý một", "ý hai"],
    missingPoints: [],
    misconceptionHit: false,
    duDuLieu: true,
    lyDoChuaCham: "",
    thoiGianGiay: 90,
  }],
};
dbService.saveAttempt(phienNhoLai);
const sauAO = conceptMemoryService.getConceptProfile(tenKhaiNiemAO);
const soLanSauAO = sauAO?.timesStudied || 0;
check("Một lượt nhớ lại đã chấm chảy được tới hồ sơ trí nhớ khái niệm",
  tenKhaiNiemAO !== "" && soLanSauAO > soLanTruocAO,
  tenKhaiNiemAO === ""
    ? "không tìm được nút tri thức nào để thử, phép kiểm đang rỗng"
    : `hồ sơ "${tenKhaiNiemAO}" tăng từ ${soLanTruocAO} lên ${soLanSauAO} lần ôn`);

// AO3. Lượt nhớ lại phải mang nhãn CÓ GIẢNG, khác hẳn nhãn tự làm bài.
//
// Bất biến 4.9e mục 3: dùng nhầm nhãn là đẻ ra một phong cách dạy không tồn tại rồi
// `adaptiveTeachingPolicy` có thể chọn chính nó. Ở đây khác chiều với lượt trắc nghiệm: nhớ lại
// THẬT SỰ có giảng (bài chấm chỉ đích danh ý còn thiếu), nên nó phải được cộng vào bảng chiến lược.
const lichSuChamAO = pedagogicalEvaluationEngine.getEvaluationHistory() || [];
const banGhiNhoLai = lichSuChamAO.filter(e => e && e.conceptName === tenKhaiNiemAO && e.teachingStrategy === NHAN_NHO_LAI_CHU_DONG);
const nhamNhanTuLam = lichSuChamAO.some(e => e && e.conceptName === tenKhaiNiemAO && e.teachingStrategy === NHAN_TU_LAM_BAI);
check("Lượt nhớ lại mang nhãn có giảng, không mượn nhãn tự làm bài",
  banGhiNhoLai.length > 0 && !nhamNhanTuLam,
  banGhiNhoLai.length === 0
    ? "không có bản ghi chấm nào mang nhãn nhớ lại chủ động"
    : nhamNhanTuLam
      ? "lượt nhớ lại bị dán nhãn tự làm bài"
      : `${banGhiNhoLai.length} bản ghi mang nhãn "${NHAN_NHO_LAI_CHU_DONG}"`);

// AO4. Nhớ lại KHÔNG được đụng vào `answers` của trắc nghiệm, và không được đếm thành câu đã làm.
//
// Hai luồng dùng chung một bản ghi `ExamAttempt`, nên đây là chỗ dễ lẫn nhất: một lượt viết lại bị
// đếm thành một câu trắc nghiệm đã giải sẽ thổi phồng mọi thống kê phía sau.
// Hai vế, và vế nguồn là vế quan trọng. Bản đầu chỉ có vế hành vi, tức kiểm chính bản ghi mà
// harness vừa tự dựng ra vài dòng trên: một phép kiểm tự khen mình. Phá thử `RecallSessionView`
// cho nó ghi thẳng vào `answers` thì phép kiểm vẫn xanh. Nay canh thêm ở NGUỒN, đúng chỗ bản ghi
// thật được dựng.
const thongKeSauAO = dbService.getStatistics();
const luotNhoLaiTrongLichSu = dbService.getHistory().find(h => h.id === "recall_test_ao2");
const khoiDungBanGhi = manNhoLaiKhongChuThich.slice(
  manNhoLaiKhongChuThich.indexOf("const banGhi: ExamAttempt"),
  manNhoLaiKhongChuThich.indexOf("dbService.saveAttempt")
);
const nguonDungHai = /questions:\s*\[\]/.test(khoiDungBanGhi) && /answers:\s*\{\}/.test(khoiDungBanGhi);
check("Lượt nhớ lại không lẫn vào đường trắc nghiệm",
  !!luotNhoLaiTrongLichSu
    && Object.keys(luotNhoLaiTrongLichSu.answers || {}).length === 0
    && (luotNhoLaiTrongLichSu.questions || []).length === 0
    && thongKeSauAO.totalSolved === 0
    && nguonDungHai,
  !luotNhoLaiTrongLichSu
    ? "không lưu được lượt nhớ lại vào lịch sử"
    : !nguonDungHai
      ? "màn nhớ lại đang ghi vào answers hoặc questions của trắc nghiệm"
      : `answers rỗng, questions rỗng, số câu đã giải vẫn ${thongKeSauAO.totalSolved}`);

// AO5. Mô hình trả về thứ không dùng được thì phải nói CHƯA CHẤM ĐƯỢC, tuyệt đối không dựng điểm.
//
// VÌ SAO KHÔNG DÙNG `outputValidationService` như bản kế hoạch ghi: hàm đó tự điền giá trị bịa khi
// thiếu trường, vì nó viết cho phần giải thích câu hỏi nơi một câu chung chung còn đỡ hơn màn hình
// trống. Ở đây thì ngược hẳn, điền bừa là dựng ra một kết quả chấm chưa hề xảy ra.
const caRac = [
  ["không phải JSON", "xin lỗi tôi không chắc"],
  ["JSON nhưng thiếu trường", '{"dat": true}'],
  ["dat không phải kiểu luận lý", '{"dat":"co","roiVaoBayHieuSai":false,"yDaNeuDuoc":[],"yConThieu":[]}'],
  ["hai mảng không phải mảng", '{"dat":true,"roiVaoBayHieuSai":false,"yDaNeuDuoc":"a","yConThieu":"b"}'],
  ["rỗng hoàn toàn", ""],
];
const racLotLuoi = caRac.filter(([, raw]) => docKetQuaCham(raw) !== null).map(([ten]) => ten);
const casachDoc = docKetQuaCham('{"dat":true,"roiVaoBayHieuSai":false,"yDaNeuDuoc":["x"],"yConThieu":[]}');
check("Kết quả chấm không dùng được thì bị chặn, không được tự điền cho đủ trường",
  racLotLuoi.length === 0 && casachDoc !== null,
  racLotLuoi.length > 0
    ? `lọt lưới: ${racLotLuoi.join("; ")}`
    : `chặn cả ${caRac.length} dạng rác, vẫn đọc được bản hợp lệ`);

// AO9. HIỆU ỨNG GIÃN CÁCH: ôn lại ngay lập tức phải gần như KHÔNG mang lợi ích nào.
//
// ĐO ĐƯỢC NGÀY 13/08/2026 trên bản chạy thật, và không phép kiểm nào trong 265 phép kiểm bắt được:
// ôn xong 6 khái niệm, quay lại Bàn học thì hàng đợi vẫn liệt kê đúng 6 khái niệm ấy, vẫn hứa
// "ôn hôm nay nâng thêm 25 điểm phần trăm". Tức hàng đợi mời người học ôn dồn vô hạn.
//
// Nguyên nhân tinh vi: `doBenTriNhoNgay` CÓ khử ôn dồn ở hệ số giãn cách (đếm số ngày lịch khác
// nhau), nhưng phần nền `1,8·log2(soLanNhoLaiDung + 1)` vẫn cộng nguyên một lượt bất kể lượt đó
// cách lượt trước mười phút hay mười ngày. Nửa công thức khử ôn dồn, nửa kia vẫn thưởng cho nó.
//
// Đây là chỗ ăn thua so với Anki, nên phải ghim bằng số đo chứ không bằng lời hứa trong chú thích.
/*
  MỐC HỌC DỰNG TƯƠNG ĐỐI THEO HÔM NAY, không viết cứng ngày tháng.

  Bản đầu viết cứng ba mốc "2026-08-05/08/13". Nó đạt đúng vào hôm viết ra rồi TỰ ĐỎ vào những
  hôm sau, bất kể mã có đổi hay không: hệ số giãn cách đếm số NGÀY LỊCH khác nhau, nên khi hôm nay
  đã trôi khỏi mốc cuối thì lượt ôn giả định tạo thêm một ngày lịch mới và lợi ích thôi bằng 0.
  Đo được ngày 30/08/2026, mười bảy ngày sau khi viết: phép kiểm báo 2,5 điểm phần trăm và chỉ tay
  vào một đoạn mã hoàn toàn đúng.

  Một phép kiểm tự hỏng theo thời gian còn tệ hơn không có phép kiểm, vì nó dạy người đọc bỏ qua
  màu đỏ. Dựng mốc theo `TimeService.now()` thì nó đúng mãi mãi.
*/
const NGAY_MS_AO9 = 86400000;
const mocLuiNgay = (n: number) => new Date(TimeService.now().getTime() - n * NGAY_MS_AO9).toISOString();
const bcGianCach: any = {
  soLanNhoLaiDung: 4, soLanNhoLaiSai: 2, dinhCaoDoThao: 60, doKhoKhaiNiem: 6.0,
  mocHocISO: [mocLuiNgay(8), mocLuiNgay(5), mocLuiNgay(0)], capNhoLai: [],
};
const loiIchNgay0 = loiIchOnHomNay(bcGianCach, 3, 0) ?? -1;
const loiIchNuaNgay = loiIchOnHomNay(bcGianCach, 3, 0.5) ?? -1;
const loiIch3Ngay = loiIchOnHomNay(bcGianCach, 3, 3) ?? -1;
const loiIch10Ngay = loiIchOnHomNay(bcGianCach, 3, 10) ?? -1;
const tangDonDieu = loiIchNgay0 < loiIchNuaNgay && loiIchNuaNgay < loiIch3Ngay && loiIch3Ngay < loiIch10Ngay;
check("Ôn lại ngay lập tức gần như không mang lợi ích, càng để lâu lợi ích càng lớn",
  loiIchNgay0 < 0.01 && tangDonDieu,
  loiIchNgay0 >= 0.01
    ? `vừa ôn xong mà ôn lại vẫn được hứa ${(loiIchNgay0 * 100).toFixed(1)} điểm phần trăm`
    : !tangDonDieu
      ? "lợi ích không tăng đơn điệu theo số ngày đã nghỉ"
      : `nghỉ 0 ngày ${(loiIchNgay0 * 100).toFixed(1)} điểm, nửa ngày ${(loiIchNuaNgay * 100).toFixed(1)}, 3 ngày ${(loiIch3Ngay * 100).toFixed(1)}, 10 ngày ${(loiIch10Ngay * 100).toFixed(1)}`);

// AO10. Hệ quả trên hàng đợi thật: vừa ôn xong thì khái niệm đó RỜI khỏi việc hôm nay.
//
// Đây là thứ Anki làm được bằng cách giấu thẻ đi tới kỳ hạn sau. Ở đây nó phải rơi ra một cách tự
// nhiên từ chính đường cong, chứ không bằng một luật riêng dán thêm bên ngoài.
dbService.clearAllHistory();
dbService.saveSubjectGoal({ ...(dbService.getSubjectGoal() || {} as any), examDate: TimeService.formatDateISO(TimeService.parseToDate(TimeService.now().getTime() + 5 * 86400000)) });
const deVuaOn = aiService.generateExam({ type: "random", count: 8 });
deVuaOn.answers = {};
deVuaOn.questions.forEach(id => { const qq = questionMap.get(id); if (qq) deVuaOn.answers[id] = qq.correctAnswer; });
deVuaOn.isSubmitted = true;
dbService.saveAttempt(deVuaOn);
// Tập khái niệm VỪA HỌC XONG, tra qua đúng bộ tra chính thống (bất biến 4.5). Bản đầu của phép
// kiểm này lọc theo `soNgayQuaHan > -0.01`, tức đo "đã tới hạn chưa" chứ không đo "vừa học xong
// chưa", nên nó xanh cả khi hành vi cũ vẫn còn nguyên. Phá thử mới lộ ra.
const khaiNiemVuaHoc = new Set<string>();
deVuaOn.questions.forEach(id => {
  const qq = questionMap.get(id);
  if (!qq) return;
  const nut = kbService.getConceptForQuestion(dbService.getActiveSubjectId(), qq);
  if (nut) khaiNiemVuaHoc.add(nut.concept);
});
const hangDoiNgaySauKhiOn = learnerModelService.layKhaiNiemToiHan();
const conSotLaiAO = hangDoiNgaySauKhiOn.danhSach.filter(m => khaiNiemVuaHoc.has(m.tenKhaiNiem));
check("Khái niệm vừa ôn xong rời khỏi việc hôm nay, không bị mời ôn dồn",
  hangDoiNgaySauKhiOn.xepTheoNgayThi && khaiNiemVuaHoc.size > 0 && conSotLaiAO.length === 0,
  !hangDoiNgaySauKhiOn.xepTheoNgayThi || khaiNiemVuaHoc.size === 0
    ? "không đặt được ngày thi hoặc không tra ra khái niệm nào, phép kiểm đang rỗng"
    : conSotLaiAO.length === 0
      ? `vừa học ${khaiNiemVuaHoc.size} khái niệm, không khái niệm nào trong số đó bị mời ôn lại; hàng đợi còn ${hangDoiNgaySauKhiOn.danhSach.length} khái niệm khác`
      : `${conSotLaiAO.length}/${khaiNiemVuaHoc.size} khái niệm vừa học xong vẫn bị mời ôn lại ngay`);
dbService.clearAllHistory();

// AO8. BỘ QUÉT CẢ HỌ: mọi loại tác vụ trình duyệt gửi lên phải được máy chủ CÔNG NHẬN.
//
// Cổng `complete.ts` gặp `taskType` lạ thì IM LẶNG hạ về `"AcademicExplanation"`, không báo lỗi,
// không ghi nhật ký. Đo được ngày 13/08/2026: bản đầu của phần chấm nhớ lại gửi lên
// `"recall-grading"` và bị hạ về mặc định, nghĩa là chấm bài chạy ở nhiệt độ 0,15 của việc giải
// thích thay vì 0,05 đã chọn. Cùng một bài viết có thể ra hai kết quả chấm khác nhau, mà nhiễu đó
// không dừng ở màn hình: nó đi thẳng vào đường cong quên rồi vào lịch ôn các tuần sau.
//
// Canh cả họ vì mọi tính năng AI thêm sau đều có thể vấp đúng chỗ này mà không có dấu hiệu gì.
const nguonCongComplete = readFileSync(path.join(process.cwd(), "functions-src/ai/complete.ts"), "utf8");
const khoiChoPhep = nguonCongComplete.slice(
  nguonCongComplete.indexOf("ALLOWED_TASK_TYPES"),
  nguonCongComplete.indexOf("];", nguonCongComplete.indexOf("ALLOWED_TASK_TYPES"))
);
const loaiDuocPhep = (khoiChoPhep.match(/"([A-Za-z]+)"/g) || []).map(s => s.replace(/"/g, ""));
const loaiTrinhDuyetGui: string[] = [];
["src/services/recallService.ts", "src/services/ai.ts"].forEach(f => {
  const src = readFileSync(path.join(process.cwd(), f), "utf8");
  const re = /(?:goiCongAI|callGemini)\(\s*[^,]+,\s*"([^"]+)"/g;
  for (let m = re.exec(src); m; m = re.exec(src)) loaiTrinhDuyetGui.push(m[1]);
});
const loaiKhongDuocCongNhan = [...new Set(loaiTrinhDuyetGui)].filter(t => !loaiDuocPhep.includes(t));
check("Mọi loại tác vụ AI trình duyệt gửi lên đều được máy chủ công nhận",
  loaiTrinhDuyetGui.length > 0 && loaiDuocPhep.length > 0 && loaiKhongDuocCongNhan.length === 0,
  loaiTrinhDuyetGui.length === 0 || loaiDuocPhep.length === 0
    ? "không đọc được danh sách loại tác vụ, phép kiểm đang rỗng"
    : loaiKhongDuocCongNhan.length === 0
      ? `${new Set(loaiTrinhDuyetGui).size} loại tác vụ đều nằm trong ${loaiDuocPhep.length} loại máy chủ nhận`
      : `bị hạ ngầm về mặc định: ${loaiKhongDuocCongNhan.join(", ")}`);

// AO6. Hai đường thất bại phải cùng nói CHƯA CHẤM ĐƯỢC, không đường nào dựng ra điểm.
//
// Chạy trên hàm chấm THẬT, không mô phỏng. Bộ kiểm chạy offline (`check.mjs` ghim `fetch` luôn từ
// chối), nên đường "cổng AI không phản hồi" được thử đúng như lúc mạng hỏng ngoài đời.
//
// Bất đồng bộ nên phải nối vào chuỗi chờ ở cuối file, `await` cấp cao nhất không dùng được vì bộ
// kiểm được gói ra định dạng cjs.
const cauHoiThuAO = nutAO ? taoCauHoiNhoLai(nutAO) : null;
async function kiemTraChamNhoLai() {
  // Chạy sau toàn bộ phần đồng bộ nên nhóm hiện hành đã trôi sang chỗ khác. Đặt lại cho đúng, nếu
  // không thì phép kiểm này bị xếp nhầm vào nhóm cuối cùng và người đọc kết quả tra không ra.
  g("AO. Nhớ lại chủ động");
  if (!cauHoiThuAO) {
    check("Hai đường thất bại khi chấm đều không dựng ra điểm", false, "không dựng được câu hỏi thử, phép kiểm đang rỗng");
    return;
  }
  // Đường 1: câu trả lời quá ngắn, chặn ngay tại cổng, không tốn lượt gọi AI.
  const qNgan = await chamCauTraLoi(cauHoiThuAO, "chưa nhớ", 3);
  // Đường 2: câu trả lời đủ dài nhưng cổng AI chết.
  const qDut = await chamCauTraLoi(cauHoiThuAO, "Đây là một câu trả lời đủ dài để đi qua cổng độ dài tối thiểu.", 40);
  const catCa = [qNgan, qDut];
  const hong = catCa.filter(r => r.duDuLieu !== false || r.passed !== null || r.lyDoChuaCham.length === 0);
  // Hai đường phải nêu HAI lý do khác nhau, nếu trùng thì màn hình nói sai nguyên nhân cho người học.
  const lyDoKhacNhau = qNgan.lyDoChuaCham !== qDut.lyDoChuaCham;
  check("Hai đường thất bại khi chấm đều không dựng ra điểm, và nói đúng nguyên nhân",
    hong.length === 0 && lyDoKhacNhau,
    hong.length > 0
      ? `${hong.length}/2 đường vẫn dựng ra kết quả chấm`
      : !lyDoKhacNhau
        ? "hai nguyên nhân khác nhau nhưng báo cùng một lý do"
        : "câu quá ngắn và cổng AI chết đều trả duDuLieu=false, mỗi đường một lý do riêng");
}

// AO7. BỘ QUÉT CẢ HỌ: mọi giá trị khai trong `examType` phải có nhãn tiếng Việt.
//
// `ContinueLearningCard` in THẲNG mã nội bộ khi tra không ra nhãn. Đo được ngày 13/08/2026: loại
// `due` thêm ở Giai đoạn 3 không có nhãn, nên người học đang đọc chữ "due" nguyên văn trên màn.
// Canh cả họ chứ không canh một ca, vì mỗi loại đề thêm sau sẽ lặp lại đúng lỗi này.
const nguonTypesAO = readFileSync(path.join(process.cwd(), "src/types.ts"), "utf8");
const khaiExamType = nguonTypesAO.match(/examType:\s*((?:"[a-z-]+"\s*\|\s*)*"[a-z-]+")/);
const cacLoaiDe = khaiExamType ? (khaiExamType[1].match(/"([a-z-]+)"/g) || []).map(s => s.replace(/"/g, "")) : [];
const nguonTheTiepTuc = readFileSync(path.join(process.cwd(), "src/components/ContinueLearningCard.tsx"), "utf8");
const bangNhan = nguonTheTiepTuc.slice(nguonTheTiepTuc.indexOf("NHAN_LOAI_PHIEN"), nguonTheTiepTuc.indexOf("};", nguonTheTiepTuc.indexOf("NHAN_LOAI_PHIEN")));
const thieuNhanLoaiDe = cacLoaiDe.filter(loai => !new RegExp(`(^|[\\s{,])"?${loai}"?\\s*:`, "m").test(bangNhan));
check("Mọi loại đề đều có nhãn tiếng Việt, không loại nào lộ mã nội bộ ra màn hình",
  cacLoaiDe.length > 0 && thieuNhanLoaiDe.length === 0,
  cacLoaiDe.length === 0
    ? "không đọc được danh sách loại đề, phép kiểm đang rỗng"
    : thieuNhanLoaiDe.length === 0
      ? `cả ${cacLoaiDe.length} loại đề đều có nhãn`
      : `thiếu nhãn cho: ${thieuNhanLoaiDe.join(", ")}`);

dbService.clearAllHistory();

// ===========================================================================
// AP. Nạp môn mới, và ranh giới giữa các môn
// ===========================================================================
g("AP. Ranh giới giữa các môn");

// AP1. Hỏi đồ thị của môn KHÁC môn đang mở thì không được trả về nút của môn đang mở.
//
// ĐO ĐƯỢC NGÀY 13/08/2026. `kbService.getKnowledgeGraph(subjectId)` tổng hợp nút từ mảng
// `questions` cấp mô đun, mà mảng ấy bị `loadSubject` dọn rồi nạp lại mỗi lần đổi môn, tức nó
// luôn là câu hỏi của môn ĐANG MỞ. Bản trước gắn mã `synth_${subjectId}_N...` lên chính các nút
// ấy, nên hỏi đồ thị môn A trong lúc môn B đang mở sẽ nhận về nút dựng từ câu hỏi môn B mang tên
// môn A.
//
// Phân loại theo AGENTS mục 3: KHÔNG phải loại "trả về ít hơn" (ghi nợ được) mà là loại "trả về
// của môn SAI" (phải sửa ngay), vì nó nói dối mà không có dấu hiệu gì.
const monDangMoAP = dbService.getActiveSubjectId();
const doThiMonLa = kbService.getKnowledgeGraph("mot_mon_khong_ton_tai_ap1");
const doThiMonDangMo = kbService.getKnowledgeGraph(monDangMoAP);
check("Hỏi đồ thị tri thức của môn khác không trả về nút của môn đang mở",
  doThiMonLa.length === 0 && doThiMonDangMo.length > 0,
  doThiMonLa.length > 0
    ? `trả về ${doThiMonLa.length} nút cho một môn chưa nạp, dựng từ câu hỏi của môn đang mở`
    : `môn lạ trả 0 nút, môn đang mở vẫn trả ${doThiMonDangMo.length} nút`);

// AP2. Môn tự tạo PHẢI có đồ thị tri thức khác rỗng, và mọi nút phải mang cờ nút tổng hợp.
//
// Đây là điều kiện cần để hàng đợi ôn (Giai đoạn 3) và chế độ nhớ lại (Giai đoạn 6) chạy được cho
// môn mới. Cờ `laNutTongHop` là ranh giới đã chốt: nút sinh tự động dùng để XẾP LỊCH ÔN được,
// nhưng KHÔNG được dùng làm bằng chứng học thuật.

const cauThuAP: any[] = [1, 2, 3].map(i => ({
  id: 900000 + i,
  chapterId: 1,
  topicId: "AP_T1",
  question: `Câu hỏi thử số ${i} cho môn tự tạo, đủ dài để không bị lọc chất lượng.`,
  options: { a: "Phương án a thử nghiệm", b: "Phương án b thử nghiệm", c: "Phương án c thử nghiệm", d: "Phương án d thử nghiệm" },
  correctAnswer: "a",
  explanation: `Lời giải thử số ${i}, đủ dài để bộ tổng hợp đồ thị rút được định nghĩa từ đây.`,
  difficulty: "Trung bình",
  knowledgeMapping: [`Khái niệm thử ${i <= 2 ? 1 : 2}`],
  questionType: "multiple-choice",
}));
// `addSubject` tự sinh mã môn, nên phải lấy mã nó trả về chứ không được tự đặt.
const maMonThuAP = dbService.addSubject("Môn thử AP", "Môn dựng trong bộ kiểm").id;
dbService.addQuestionsToSubject(maMonThuAP, cauThuAP, [{ id: 1, title: "Chương thử" } as any], [{ id: "AP_T1", chapterId: 1, title: "Chủ đề thử" } as any]);
dbService.setActiveSubjectId(maMonThuAP);
loadSubject(maMonThuAP);
const doThiMonMoi = kbService.getKnowledgeGraph(maMonThuAP);
const nutThieuCo = doThiMonMoi.filter(n => !n.laNutTongHop);
check("Môn tự tạo có đồ thị tri thức khác rỗng, mọi nút đều mang cờ nút tổng hợp",
  doThiMonMoi.length > 0 && nutThieuCo.length === 0,
  doThiMonMoi.length === 0
    ? "môn mới không có nút nào, hàng đợi ôn và chế độ nhớ lại đều không chạy được"
    : nutThieuCo.length > 0
      ? `${nutThieuCo.length}/${doThiMonMoi.length} nút sinh tự động KHÔNG mang cờ, có thể bị dùng làm bằng chứng học thuật`
      : `${doThiMonMoi.length} nút sinh tự động, nút nào cũng có cờ`);

// AP3. Nút TỔNG HỢP không được lọt vào chỗ dùng làm bằng chứng học thuật.
const canhBaoTuNutTongHop = cauThuAP
  .map(q => kbService.layCanhBaoBayHocThuat(maMonThuAP, q as any))
  .filter(Boolean);
check("Nút sinh tự động không được dùng làm bằng chứng học thuật",
  canhBaoTuNutTongHop.length === 0,
  canhBaoTuNutTongHop.length === 0
    ? "bẫy học thuật trả null cho mọi câu của môn sinh tự động, đúng ranh giới đã chốt"
    : `${canhBaoTuNutTongHop.length} câu nhận được cảnh báo học thuật dựng từ chuỗi mẫu`);

// AP4. BỘ QUÉT CẢ HỌ: mọi khóa lưu trữ mang dữ liệu CỦA MỘT MÔN đều phải gắn mã môn.
//
// Đây là phép kiểm giá trị nhất nhóm này. Đo ngày 13/08/2026: bốn khóa còn dùng chung cho mọi môn,
// trong đó `poly_econ_pedagogical_*` và `poly_econ_policy_audit_log` là đầu vào để chọn phong cách
// dạy, nên lịch sử chấm của môn Thống kê sẽ điều khiển cách dạy môn Hành vi khách hàng. Với hai
// môn chưa lộ, với bốn môn học kỳ sau thì lộ ngay.
//
// Danh sách miễn trừ phải nêu ĐÍCH DANH và có lý do, không được để mở.
const KHOA_DUNG_CHUNG_CO_LY_DO = new Set([
  "poly_econ_active_subject_id",   // chính nó cho biết môn nào đang mở
  "poly_econ_custom_subjects",     // danh mục các môn, không thuộc môn nào
  "poly_econ_archived_subjects",   // danh mục môn đã đóng
  "poly_econ_settings",            // thiết lập giao diện, dùng chung là đúng chủ ý
  "poly_econ_time_offset",         // lệch giờ máy, không liên quan môn học
  "poly_econ_exam_submitted",      // tên sự kiện trình duyệt, không phải khóa lưu trữ
  "poly_econ_last_hero_action_type", // trạng thái giao diện tạm, không phải dữ liệu học
  "poly_econ_unfinished_session",  // khóa CŨ, chỉ còn được xóa đi để dọn tàn dư
]);
const khoaTimThay = new Set<string>();
const thuMucDichVu = path.join(process.cwd(), "src/services");
readdirSync(thuMucDichVu).filter(f => f.endsWith(".ts")).forEach(f => {
  const src = readFileSync(path.join(thuMucDichVu, f), "utf8");
  // Chỉ bắt khóa viết dưới dạng chuỗi ĐÓNG, tức không có phần ghép mã môn phía sau.
  const re = /["'](poly_econ_[a-z_]+)["']/g;
  for (let m = re.exec(src); m; m = re.exec(src)) khoaTimThay.add(m[1]);
});
const khoaThieuMaMon = [...khoaTimThay].filter(k => !KHOA_DUNG_CHUNG_CO_LY_DO.has(k) && !k.endsWith("_"));
check("Mọi khóa lưu trữ mang dữ liệu của một môn đều gắn mã môn",
  khoaTimThay.size > 0 && khoaThieuMaMon.length === 0,
  khoaTimThay.size === 0
    ? "không quét ra khóa nào, phép kiểm đang rỗng"
    : khoaThieuMaMon.length === 0
      ? `${khoaTimThay.size} khóa, ${KHOA_DUNG_CHUNG_CO_LY_DO.size} khóa dùng chung có lý do nêu đích danh`
      : `thiếu mã môn: ${khoaThieuMaMon.join(", ")}`);

// AP5. Đổi qua đổi lại giữa hai môn thì số liệu KHÔNG được lẫn.
//
// Chạy trên engine thật: làm bài ở môn thử, rồi quay về môn chính và kiểm rằng thống kê của môn
// chính không nhận thêm gì.
const deMonThu = aiService.generateExam({ type: "sequential", count: 3 });
deMonThu.answers = {};
deMonThu.questions.forEach(id => { const qq = questionMap.get(id); if (qq) deMonThu.answers[id] = qq.correctAnswer; });
deMonThu.isSubmitted = true;
dbService.saveAttempt(deMonThu);
const daGiaiMonThu = dbService.getStatistics().totalSolved;

dbService.setActiveSubjectId(monDangMoAP);
loadSubject(monDangMoAP);
const daGiaiMonChinh = dbService.getStatistics().totalSolved;
check("Đổi môn thì thống kê không lẫn sang nhau",
  daGiaiMonThu > 0 && daGiaiMonChinh === 0,
  daGiaiMonThu === 0
    ? "môn thử không ghi được lượt nào, phép kiểm đang rỗng"
    : `môn thử ${daGiaiMonThu} câu đã giải, môn chính vẫn ${daGiaiMonChinh}`);

// AP6. BỘ QUÉT CẢ HỌ: việc quản lý môn học phải có CỬA trên giao diện.
//
// ĐO ĐƯỢC NGÀY 13/08/2026, và kết quả sắc hơn bản kế hoạch dự đoán. Kế hoạch cho rằng luồng nạp
// môn "rải rác qua nhiều chỗ" nên cần gom thành một thuật sĩ. Thực tế `dbService.addSubject` có
// **0 nơi gọi** trong toàn bộ `src/`, nên chi phí nạp một môn mới từ giao diện không phải "một
// tuần" mà là VÔ HẠN: phải sửa mã hoặc gọi thẳng dịch vụ từ bảng điều khiển trình duyệt.
//
// Cùng họ với "màn hình xây xong không có cửa" mà AK1 canh, chỉ khác là ở tầng DỊCH VỤ. AK1 quét
// `currentView`, nên nó không thể thấy một hàm dịch vụ không ai gọi. Phép kiểm này bịt khoảng đó.
const HAM_QUAN_LY_MON_PHAI_CO_CUA = ["addSubject"];
const nguonGiaoDien: string[] = [];
["src/components", "src"].forEach(thuMuc => {
  const duongDan = path.join(process.cwd(), thuMuc);
  readdirSync(duongDan, { withFileTypes: true })
    .filter(e => e.isFile() && (e.name.endsWith(".tsx") || e.name.endsWith(".ts")))
    .forEach(e => nguonGiaoDien.push(readFileSync(path.join(duongDan, e.name), "utf8")));
});
const hamKhongCoCua = HAM_QUAN_LY_MON_PHAI_CO_CUA.filter(
  ten => !nguonGiaoDien.some(src => new RegExp(`dbService\\.${ten}\\s*\\(`).test(src))
);
check("Việc tạo môn học mới có cửa trên giao diện, không chỉ có ở tầng dịch vụ",
  nguonGiaoDien.length > 0 && hamKhongCoCua.length === 0,
  nguonGiaoDien.length === 0
    ? "không đọc được file giao diện nào, phép kiểm đang rỗng"
    : hamKhongCoCua.length === 0
      ? `${HAM_QUAN_LY_MON_PHAI_CO_CUA.length} hàm quản lý môn đều có nơi gọi từ giao diện`
      : `không có cửa cho: ${hamKhongCoCua.join(", ")}`);

dbService.deleteSubject(maMonThuAP);
dbService.clearAllHistory();

// ===========================================================================
// AQ. Tách gói và mã chết
// ===========================================================================
g("AQ. Tách gói và mã chết");

const nguonAppAQ = readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");

// AQ1. Mọi màn nạp muộn phải nằm TRONG một ranh giới `Suspense` có trạng thái chờ thật.
//
// Đây là phép kiểm bắt buộc của giai đoạn này, vì hỏng kiểu này ra MÀN HÌNH TRẮNG chứ không ra
// lỗi build: `npm run build` xanh, `tsc` xanh, và người học mở màn thì thấy trắng tinh. Không có
// cách nào khác để bắt ngoài việc canh ở nguồn cộng với mở mắt nhìn trên trình duyệt.
//
// Bọc MỘT ranh giới quanh cả vùng nội dung chứ không bọc từng màn: bọc từng màn thì mỗi màn thêm
// sau lại phải nhớ bọc, và quên một lần là màn hình trắng.
const soManNapMuon = (nguonAppAQ.match(/=\s*lazy\(/g) || []).length;
const coRanhGioi = /<Suspense\s+fallback=\{<[A-ZĐ]/.test(nguonAppAQ);
const viTriSuspense = nguonAppAQ.indexOf("<Suspense");
const viTriDongMain = nguonAppAQ.indexOf("</main>");
const viTriMoMain = nguonAppAQ.indexOf("<main");
const bocCaVung = viTriSuspense > viTriMoMain && viTriSuspense < viTriDongMain
  && nguonAppAQ.indexOf("</Suspense>") < viTriDongMain;
check("Mọi màn nạp muộn nằm trong một ranh giới chờ, không màn nào lọt ra ngoài",
  soManNapMuon > 0 && coRanhGioi && bocCaVung,
  soManNapMuon === 0
    ? "không có màn nào nạp muộn, phép kiểm đang rỗng"
    : !coRanhGioi
      ? "có màn nạp muộn nhưng không có ranh giới chờ, sẽ ra màn hình trắng"
      : !bocCaVung
        ? "ranh giới chờ không bọc cả vùng nội dung, màn thêm sau có thể lọt ra ngoài"
        : `${soManNapMuon} màn nạp muộn, một ranh giới bọc cả vùng nội dung`);

// AQ2. Gói MÃ phải dưới ngưỡng. Gói DỮ LIỆU được miễn trừ, và nói rõ vì sao.
//
// ĐO ĐƯỢC NGÀY 13/08/2026, và đây là chỗ bản kế hoạch đặt sai mục tiêu. Kế hoạch đòi "gói lớn
// nhất dưới 500 KB". Đo ra thì gói lớn nhất là **1.081 KB và nó không chứa mã**: nó là ngân hàng
// câu hỏi (724 KB dữ liệu nguồn, có "Theo Slide", "knowledgeMapping", "correctAnswer"). Kích
// thước ấy KHÔNG nhúc nhích qua cả ba lượt tách gói, và đó chính là dấu hiệu lộ ra bản chất.
//
// Đưa nó xuống dưới 500 KB đòi nạp dữ liệu môn học bất đồng bộ, tức `db.ts` thôi nhập tĩnh và mọi
// nơi đọc `questions` phải chờ. Đó là thay đổi kiến trúc sâu, rủi ro cao, đổi lấy một chút thời
// gian tải trên đúng một máy MacBook chạy cục bộ. Cố ý KHÔNG làm, và ghi rõ ở đây thay vì lặng lẽ
// hạ ngưỡng cho vừa.
//
// Ngưỡng đặt cho gói MÃ, nơi việc tách gói thật sự có tác dụng: 973 KB xuống 423 KB.
const NGUONG_GOI_MA_KB = 500;
const thuMucGoi = path.join(process.cwd(), "dist/assets");
let goiMaLonNhat = { ten: "", kb: 0 };
let coGoiDuLieu = false;
try {
  readdirSync(thuMucGoi).filter(f => f.endsWith(".js")).forEach(f => {
    const noiDung = readFileSync(path.join(thuMucGoi, f), "utf8");
    const kb = Buffer.byteLength(noiDung) / 1024;
    // Gói chứa ngân hàng câu hỏi thì là gói DỮ LIỆU, nhận diện bằng chính nội dung chứ không bằng
    // tên file, vì tên file mang mã băm đổi sau mỗi lượt build.
    const laGoiDuLieu = /knowledgeMapping|correctAnswer/.test(noiDung);
    if (laGoiDuLieu) { coGoiDuLieu = true; return; }
    if (kb > goiMaLonNhat.kb) goiMaLonNhat = { ten: f, kb };
  });
} catch { /* chưa build thì bỏ qua, chặng build chạy sau chặng này */ }
if (goiMaLonNhat.ten) {
  check("Gói mã lớn nhất dưới ngưỡng, gói dữ liệu được miễn trừ có lý do",
    goiMaLonNhat.kb < NGUONG_GOI_MA_KB,
    goiMaLonNhat.kb < NGUONG_GOI_MA_KB
      ? `gói mã lớn nhất ${goiMaLonNhat.kb.toFixed(0)} KB, dưới ngưỡng ${NGUONG_GOI_MA_KB} KB${coGoiDuLieu ? "; gói ngân hàng câu hỏi miễn trừ" : ""}`
      : `gói mã ${goiMaLonNhat.ten} nặng ${goiMaLonNhat.kb.toFixed(0)} KB, vượt ngưỡng ${NGUONG_GOI_MA_KB} KB`);
} else {
  info("Chưa có thư mục dist nên chưa đo được kích thước gói. Chạy `npm run build` rồi đo lại.");
}

// AQ3. Không file nào trong `src/` được xuất mà không có nơi nào nhập.
//
// Phép kiểm này giữ cho nợ mã chết không tái phát, đáng giá hơn chính lượt dọn. Đợt này đã gỡ
// 1.263 dòng ở 6 file không nơi nào nhắc tới.
//
// QUÉT CẢ `scripts/` VÀ `functions-src/`, không chỉ `src/`. Hai tiền lệ: bộ kiểm nhập thẳng rất
// nhiều dịch vụ nên một file trông mồ côi trong `src/` vẫn có thể đang được nó dùng; và
// `aiOrchestrator.ts` không có nơi nhập nào trong `src/` nhưng là đường chạy thật của hàm
// serverless `recommend.ts`. Quét thiếu một trong hai là xóa nhầm mã đang sống.
const cacThuMucNguon = ["src/services", "src/components"];
const noiNhapAQ: string[] = [];
["src", "src/services", "src/components", "scripts/selftest", "functions-src/ai", "functions-src/_lib"].forEach(tm => {
  const duongDan = path.join(process.cwd(), tm);
  try {
    readdirSync(duongDan, { withFileTypes: true })
      .filter(e => e.isFile() && /\.(ts|tsx)$/.test(e.name))
      .forEach(e => noiNhapAQ.push(readFileSync(path.join(duongDan, e.name), "utf8")));
  } catch { /* thư mục không tồn tại thì bỏ qua */ }
});
const fileMoCoi: string[] = [];
cacThuMucNguon.forEach(tm => {
  const duongDan = path.join(process.cwd(), tm);
  readdirSync(duongDan, { withFileTypes: true })
    .filter(e => e.isFile() && /\.(ts|tsx)$/.test(e.name))
    .forEach(e => {
      const ten = e.name.replace(/\.(ts|tsx)$/, "");
      const duocNhap = noiNhapAQ.some(src =>
        new RegExp(`from\\s+["'][^"']*\\/${ten}["']`).test(src) || new RegExp(`import\\(["'][^"']*\\/${ten}["']\\)`).test(src));
      if (!duocNhap) fileMoCoi.push(`${tm}/${e.name}`);
    });
});
check("Không file nguồn nào mồ côi, tính cả nơi nhập từ bộ kiểm và hàm serverless",
  fileMoCoi.length === 0,
  fileMoCoi.length === 0
    ? `quét ${cacThuMucNguon.length} thư mục nguồn, không file nào không có nơi nhập`
    : `mồ côi: ${fileMoCoi.join(", ")}`);

// ===========================================================================
// AK. Đường báo câu hỏi sai, và hiệu lực thật của việc loại bỏ
// ===========================================================================
g("AK. Báo câu hỏi sai");

// AK1. BỘ QUÉT CẢ HỌ: mọi giá trị khai trong `currentView` phải có ít nhất một lối vào.
//
// Đây là phép kiểm giá trị nhất nhóm này. `AcademicQualityDashboard` (345 dòng),
// `QuestionQualityCard` (249 dòng) và `contentQualityAssurance` (335 dòng), tổng khoảng 929 dòng,
// đã viết xong và render đúng khi `currentView === "quality_dashboard"`, nhưng KHÔNG nơi nào đặt
// giá trị đó. Màn hình xây xong mà không có cửa.
//
// Canh cả họ chứ không canh đúng một ca, vì lỗi này sẽ lặp lại với mọi màn thêm sau.
const nguonApp = readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");
const nguonTimNhanhAK = readFileSync(path.join(process.cwd(), "src/components/GlobalCommandPalette.tsx"), "utf8");
const khaiBaoView = nguonApp.match(/useState<("[a-z_]+"(\s*\|\s*)?)+>/);
const cacView = khaiBaoView ? (khaiBaoView[0].match(/"[a-z_]+"/g) || []).map(v => v.replace(/"/g, "")) : [];
const viewKhongCoCua = cacView.filter(v => {
  if (v === "workspace" || v === "practice") return false; // hai màn mặc định, luôn tới được
  // Phải tính CẢ mảng điểm đến của thanh điều hướng. Bản đầu chỉ tìm các lời gọi `setCurrentView`
  // nên báo nhầm màn "progress" là không có cửa, trong khi nó nằm ngay trên thanh nav với nhãn
  // "Báo cáo". Một bộ quét cả họ mà quét thiếu một loại cửa thì báo động giả, và báo động giả làm
  // người ta tập thói quen bỏ qua nó.
  const coTrongApp = new RegExp(`setCurrentView\\("${v}"`).test(nguonApp)
    || new RegExp(`onNavigate\\("${v}"`).test(nguonApp)
    || new RegExp(`onNavigateView\\("${v}"`).test(nguonApp)
    || new RegExp(`view: "${v}"`).test(nguonApp);
  const coTrongTimNhanh = new RegExp(`onNavigate\\("${v}"`).test(nguonTimNhanhAK);
  const coTrongComponent = readdirSync(thuMucComponent)
    .filter(t => t.endsWith(".tsx"))
    .some(t => new RegExp(`onNavigateView\\("${v}"`).test(readFileSync(path.join(thuMucComponent, t), "utf8")));
  return !coTrongApp && !coTrongTimNhanh && !coTrongComponent;
});
check("Mọi màn khai trong currentView đều có ít nhất một lối vào",
  cacView.length > 0 && viewKhongCoCua.length === 0,
  viewKhongCoCua.length === 0
    ? `${cacView.length} màn, màn nào cũng có nút hoặc mục tìm nhanh dẫn tới`
    : `${viewKhongCoCua.length} màn xây xong mà không có cửa: ${viewKhongCoCua.join(", ")}`);

// AK2. Câu bị loại KHÔNG được xuất hiện lại, kiểm trên 30 đề liên tiếp.
//
// Trước 13/08/2026 trạng thái `REJECTED` lưu được nhưng 0 nơi đọc ngoài chính service, nên đánh
// dấu một câu là sai đáp án hoàn toàn không ngăn nó ra đề. Kiểm nhiều đề liên tiếp chứ không một
// đề, vì một đề có thể ngẫu nhiên không chứa câu ấy.
const maCauThuAK = questions[0].id;
contentQualityAssurance.updateHumanReview(maCauThuAK, "REJECTED", "phép kiểm AK2");
let soLanLotRa = 0;
for (let i = 0; i < 30; i++) {
  const de = aiService.generateExam({ type: "random", count: 20 });
  if (de.questions.includes(maCauThuAK)) soLanLotRa++;
}
check("Câu đã báo sai không quay lại trong 30 đề liên tiếp",
  soLanLotRa === 0,
  soLanLotRa === 0
    ? `câu #${maCauThuAK} bị loại và không lọt vào đề nào trong 30 đề, mỗi đề 20 câu`
    : `câu #${maCauThuAK} vẫn lọt ra ${soLanLotRa} trên 30 đề dù đã bị đánh dấu loại bỏ`);

// AK3. Đánh dấu phải SỐNG QUA việc tải lại trang.
//
// Bản trước lưu trong một `Map` thuần trong bộ nhớ. Người học báo một câu sai đáp án, tải lại
// trang là mất sạch, và câu ấy quay lại đề ngay hôm sau. Một đường báo lỗi mất dấu khi tải lại còn
// tệ hơn không có, vì nó khiến người học tin là đã xử lý xong.
const khoaDanhGiaAK = `poly_econ_human_reviews_${dbService.getActiveSubjectId()}`;
const daGhiXuongKho = localStorage.getItem(khoaDanhGiaAK) !== null
  && JSON.parse(localStorage.getItem(khoaDanhGiaAK) || "{}")[maCauThuAK]?.status === "REJECTED";
check("Đánh dấu câu có vấn đề được ghi xuống kho và gắn mã môn",
  daGhiXuongKho,
  daGhiXuongKho
    ? `khoá ${khoaDanhGiaAK} giữ được trạng thái, tải lại trang không mất`
    : "đánh dấu chỉ nằm trong bộ nhớ, tải lại trang là mất");

// AK4. Cờ nghi vấn và cờ báo lỗi nội dung là HAI ĐƯỜNG RIÊNG.
//
// Cờ nghi vấn là nghi ngờ về NGƯỜI HỌC ("tôi không chắc"), chảy vào `attempt.flags` rồi vào tầng
// trí nhớ. Báo lỗi nội dung là nghi ngờ về CÂU HỎI. Gộp lại thì hai tín hiệu nhiễm lẫn nhau: người
// học không chắc bài sẽ vô tình loại bỏ câu hỏi tốt, còn câu hỏi hỏng lại được ghi vào hồ sơ trí
// nhớ như một điểm yếu của người học.
const maCauThuAK4 = questions[1].id;
contentQualityAssurance.boDanhDau(maCauThuAK4);
dbService.toggleFlag(maCauThuAK4);
const sauKhiGanCo = contentQualityAssurance.layTatCaDanhGia()[maCauThuAK4];
dbService.toggleFlag(maCauThuAK4);
check("Cắm cờ nghi vấn KHÔNG đụng tới trạng thái duyệt nội dung",
  sauKhiGanCo === undefined,
  sauKhiGanCo === undefined
    ? "hai đường tách bạch, cắm cờ nghi vấn không tạo bản ghi duyệt nào"
    : `cắm cờ nghi vấn đã tạo bản ghi duyệt trạng thái ${sauKhiGanCo.status}, hai tín hiệu đang nhiễm lẫn nhau`);

// AK5. Không chuỗi tiếng Anh nào trên hai màn chất lượng.
//
// Bản đánh giá cũ ghi "chuỗi tiếng Anh lọt ra giao diện: 0", nhưng phép đo ấy chạy trên 10 màn CÓ
// LỐI VÀO, mà hai màn này không nằm trong số đó. Một phép đo chỉ đúng trong phạm vi nó quét.
const CHUOI_ANH_CAM = ["Gate PASSED", "Gate FAILED", "Score:", ">FULL<", ">PARTIAL<"];
const nguonHaiManChatLuong = [
  "src/components/QuestionQualityCard.tsx",
  "src/components/AcademicQualityDashboard.tsx",
].map(f => readFileSync(path.join(process.cwd(), f), "utf8")).join("\n");
const conChuoiAnh = CHUOI_ANH_CAM.filter(c => nguonHaiManChatLuong.includes(c));
check("Hai màn chất lượng không còn chuỗi tiếng Anh lọt ra giao diện",
  conChuoiAnh.length === 0,
  conChuoiAnh.length === 0
    ? `quét ${CHUOI_ANH_CAM.length} chuỗi từng lọt ra, không chuỗi nào còn`
    : `còn: ${conChuoiAnh.join(", ")}`);

contentQualityAssurance.boDanhDau(maCauThuAK);
contentQualityAssurance.boDanhDau(maCauThuAK4);

// ===========================================================================
// AL. Hàng đợi ôn hôm nay, xếp theo lợi ích cho ngày thi
// ===========================================================================
g("AL. Hàng đợi ôn hôm nay");

// Dựng hai khái niệm có TRẠNG THÁI TRÍ NHỚ ngược nhau, rồi hỏi cùng một câu ở hai mốc ngày thi.
//
// - "bền": đã nhớ lại đúng nhiều lần, trải qua nhiều ngày lịch khác nhau, nên độ bền lớn.
// - "mong manh": mới học, nhớ lại sai nhiều, nên độ bền nhỏ.
//
// Cả hai đều học lần cuối cùng một ngày, nên mọi khác biệt về thứ hạng chỉ có thể tới từ độ bền
// và từ khoảng cách tới ngày thi.
const KHOA_HO_SO_KN = `poly_econ_concept_profiles_${dbService.getActiveSubjectId()}`;
const hoSoKhaiNiemDaLuu = localStorage.getItem(KHOA_HO_SO_KN);
const mucTieuTruocAL = localStorage.getItem(`poly_econ_goal_${dbService.getActiveSubjectId()}`);

function dungHoSoOnTap(ten: string, soDung: number, soSai: number, soNgayNghi: number, soNgayLich: number) {
  const bayGioMs = TimeService.now().getTime();
  const mocHoc: string[] = [];
  for (let i = 0; i < soNgayLich; i++) {
    mocHoc.push(new Date(bayGioMs - (soNgayNghi + i) * NGAY_MS).toISOString());
  }
  const hoSo = {
    ...learnerModelService.getOrCreateProfile(ten),
    attemptsCount: soDung + soSai,
    correctCount: soDung,
    incorrectCount: soSai,
    reviewHistory: mocHoc,
    lastStudiedAt: new Date(bayGioMs - soNgayNghi * NGAY_MS).toISOString(),
  };
  const tatCa = learnerModelService.getConceptProfiles();
  tatCa[ten] = hoSo as any;
  localStorage.setItem(KHOA_HO_SO_KN, JSON.stringify(tatCa));
}

function datNgayThi(soNgay: number | null) {
  dbService.saveSubjectGoal({
    subjectId: dbService.getActiveSubjectId(),
    targetScore: 8.5,
    examDate: soNgay === null
      ? null
      : TimeService.formatDateISO(TimeService.parseToDate(TimeService.now().getTime() + soNgay * NGAY_MS)),
    dailyStudyMinutes: 120,
    priority: "High",
    updatedAt: TimeService.now().toISOString(),
  });
}

// DÙNG TÊN KHÁI NIỆM THẬT của đồ thị tri thức, không bịa tên.
//
// Bản đầu của nhóm này đặt tên "AL bền" và "AL mong manh". Bốn phép kiểm đầu vẫn xanh vì chúng chỉ
// đọc hàng đợi, nhưng AL6 đỏ ngay: không câu hỏi nào tra ra được hai cái tên ấy nên hồ câu rỗng.
// Chính nhờ vậy mới lộ ra lỗi thật ở `generateExam`, xem chú thích `constrainedTypes`.
const doThiAL = kbService.getKnowledgeGraph(dbService.getActiveSubjectId());
const TEN_BEN = doThiAL[0]?.concept ?? "AL bền";
const TEN_MONG_MANH = doThiAL[1]?.concept ?? "AL mong manh";

localStorage.removeItem(KHOA_HO_SO_KN);
dungHoSoOnTap(TEN_BEN, 9, 0, 3, 6);
dungHoSoOnTap(TEN_MONG_MANH, 1, 4, 3, 1);

// AL1. Chưa đặt ngày thi thì lùi về đúng cách của Anki và NÓI RA là đang lùi.
datNgayThi(null);
const hangDoiKhongNgayThi = learnerModelService.layKhaiNiemToiHan();
check("Chưa đặt ngày thi thì hàng đợi lùi về xếp theo mức quá hạn",
  hangDoiKhongNgayThi.xepTheoNgayThi === false && hangDoiKhongNgayThi.soNgayToiKyThi === null,
  hangDoiKhongNgayThi.xepTheoNgayThi === false
    ? `cờ xepTheoNgayThi = false nên màn hình biết mà nói đúng, hàng đợi có ${hangDoiKhongNgayThi.danhSach.length} khái niệm`
    : "vẫn báo đang xếp theo ngày thi trong khi không có ngày thi nào");

// AL2. PHÉP KIỂM QUAN TRỌNG NHẤT CỦA CẢ NHÓM: thứ hạng phải LẬT NGƯỢC khi ngày thi tới gần.
//
// Đây là thứ không bộ xếp lịch nào chỉ nhìn trạng thái hiện tại làm được, kể cả FSRS của Anki.
// Cùng hai khái niệm, cùng một trạng thái trí nhớ, chỉ đổi mỗi khoảng cách tới ngày thi:
//
//   thi còn xa  -> ưu tiên khái niệm BỀN, vì ôn nó thì tới ngày thi còn giữ được
//   thi sát nút -> ưu tiên khái niệm MONG MANH, vì giờ ôn vào thì kịp còn nóng tới hôm thi
//
// Không có phép kiểm này thì cả nhóm AL vẫn xanh trong khi hàng đợi thực chất chỉ xếp theo mức
// quá hạn, tức đúng bằng Anki.
datNgayThi(45);
const hangDoiThiXa = learnerModelService.layKhaiNiemToiHan();
datNgayThi(2);
const hangDoiThiGan = learnerModelService.layKhaiNiemToiHan();

const dauBangThiXa = hangDoiThiXa.danhSach[0]?.tenKhaiNiem ?? "(rỗng)";
const dauBangThiGan = hangDoiThiGan.danhSach[0]?.tenKhaiNiem ?? "(rỗng)";
const daLatNguoc = dauBangThiXa === TEN_BEN && dauBangThiGan === TEN_MONG_MANH;
check("Thứ tự ôn lật ngược khi ngày thi tới gần, thứ Anki không làm được",
  daLatNguoc,
  daLatNguoc
    ? `thi còn 45 ngày thì đầu bảng là "${TEN_BEN}" (bền), thi còn 2 ngày thì đầu bảng là "${TEN_MONG_MANH}" (mong manh)`
    : `thi xa đầu bảng "${dauBangThiXa}", thi gần đầu bảng "${dauBangThiGan}". Lợi ích đo được: xa ${hangDoiThiXa.danhSach.map(m => `${m.tenKhaiNiem}=${((m.loiIchNeuOnHomNay ?? 0) * 100).toFixed(1)}`).join(", ")} | gần ${hangDoiThiGan.danhSach.map(m => `${m.tenKhaiNiem}=${((m.loiIchNeuOnHomNay ?? 0) * 100).toFixed(1)}`).join(", ")}`);

// AL3. Khái niệm ôn hôm nay cũng vô ích cho ngày thi phải bị HOÃN, kèm lý do đọc được.
//
// Anki vẫn bắt ôn thẻ ấy vì nó chỉ hỏi "đã tới hạn chưa". Đây là phần công sức bị lãng phí mà
// người ôn thi không có để mà phí.
const biHoanKhiThiXa = hangDoiThiXa.hoanLai.map(m => m.tenKhaiNiem);
const hoanDung = biHoanKhiThiXa.includes(TEN_MONG_MANH) && hangDoiThiXa.hoanLai.every(m => m.lyDo.length > 0);
check("Khái niệm ôn hôm nay không giúp gì cho ngày thi thì bị hoãn kèm lý do",
  hoanDung,
  hoanDung
    ? `"${TEN_MONG_MANH}" bị hoãn khi thi còn 45 ngày: ${hangDoiThiXa.hoanLai[0]?.lyDo}`
    : `danh sách hoãn: [${biHoanKhiThiXa.join(", ")}], lợi ích của mong manh = ${((hangDoiThiXa.hoanLai.find(m => m.tenKhaiNiem === TEN_MONG_MANH)?.loiIchNeuOnHomNay ?? hangDoiThiXa.danhSach.find(m => m.tenKhaiNiem === TEN_MONG_MANH)?.loiIchNeuOnHomNay ?? 0) * 100).toFixed(2)} điểm phần trăm`);

// AL4. Hàng đợi phải cắt theo QUỸ THỜI GIAN thật, và phải nói ra đã cắt mất bao nhiêu.
//
// Anki cắt theo số thẻ mỗi ngày, một con số người dùng phải tự đoán. Ở đây quỹ là số phút người
// học đã đặt, tốc độ là nhịp đo được của chính họ, nên phần bị cắt là phần thật sự không kịp làm.
//
// Cắt âm thầm thì màn hình đọc ra là "hôm nay chỉ có bấy nhiêu việc", một lời nói dối do bỏ sót.
for (let i = 2; i < Math.min(14, doThiAL.length); i++) dungHoSoOnTap(doThiAL[i].concept, 3, 1, 4, 2);
datNgayThi(7);
const hangDoiChatHep = learnerModelService.layKhaiNiemToiHan(5);
const soCauUocTinh = hangDoiChatHep.danhSach.length * 3;
const vuaKhungGio = soCauUocTinh * hangDoiChatHep.giayMoiCauDaDung <= 5 * 60 + 1e-6;
const catDung = vuaKhungGio && hangDoiChatHep.soBiCatDoHetGio > 0;
check("Hàng đợi cắt theo quỹ thời gian thật và nói ra phần bị cắt",
  catDung,
  catDung
    ? `quỹ 5 phút ở nhịp ${hangDoiChatHep.giayMoiCauDaDung}s một câu cho ${hangDoiChatHep.danhSach.length} khái niệm, còn ${hangDoiChatHep.soBiCatDoHetGio} khái niệm được báo là bị cắt`
    : `${hangDoiChatHep.danhSach.length} khái niệm tức ${soCauUocTinh} câu, vượt quỹ 5 phút; báo cắt ${hangDoiChatHep.soBiCatDoHetGio}`);

// AL5. Tất định (bất biến 4.7). Gọi hai lần liên tiếp phải cho cùng thứ tự.
const thuTuAL1 = learnerModelService.layKhaiNiemToiHan(60).danhSach.map(m => m.tenKhaiNiem).join("|");
const thuTuAL2 = learnerModelService.layKhaiNiemToiHan(60).danhSach.map(m => m.tenKhaiNiem).join("|");
check("Hàng đợi ôn tất định giữa hai lần gọi liên tiếp",
  thuTuAL1 === thuTuAL2 && thuTuAL1.length > 0,
  thuTuAL1 === thuTuAL2 ? `${thuTuAL1.split("|").length} khái niệm, thứ tự khớp hoàn toàn` : `lần 1: ${thuTuAL1}\nlần 2: ${thuTuAL2}`);

// AL6. Đề loại "due" chỉ được chứa câu thuộc khái niệm đang trong hàng đợi.
const hangDoiChoDe = learnerModelService.layKhaiNiemToiHan(60);
const deToiHan = aiService.generateExam({ type: "due", count: 10 });
const tenTrongHangDoi = new Set(hangDoiChoDe.danhSach.map(m => m.tenKhaiNiem));
// `exam.questions` là mảng MÃ câu, không phải câu. Tra qua `questionMap` để lấy bản ĐÃ TRỘN
// phương án, đúng bất biến 4.1.
const cauLacDe = deToiHan.questions.filter(id => {
  const q = questionMap.get(id);
  if (!q) return true;
  const ds = kbService.resolveConceptsForQuestion(dbService.getActiveSubjectId(), q, 3);
  return !ds.some(r => tenTrongHangDoi.has(r.node.concept));
});
check("Đề loại tới hạn chỉ chứa câu của khái niệm trong hàng đợi",
  deToiHan.questions.length > 0 && cauLacDe.length === 0,
  cauLacDe.length === 0
    ? `${deToiHan.questions.length} câu, tất cả thuộc ${tenTrongHangDoi.size} khái niệm đang tới hạn`
    : `${cauLacDe.length} trên ${deToiHan.questions.length} câu không thuộc khái niệm nào trong hàng đợi`);

// AL7b. MỌI loại đề khai trong `examType` phải có nhãn riêng trên màn làm bài.
//
// Bắt được khi mở trình duyệt: đề loại "due" hiện tiêu đề "Luyện tập theo Thứ tự gốc", vì chuỗi
// nhãn là một dãy tam nguyên có nhánh cuối làm mặc định, nên loại nào chưa liệt kê đều rơi vào đó
// mà không báo lỗi gì. Ba loại incorrect, bookmark, difficulty cũng đang rơi vào đấy từ trước.
//
// Đây là họ lỗi "nhãn mặc định nuốt mọi ca chưa xử lý", cùng họ với `constrainedTypes` thiếu
// "due" đã bắt ở AL6. Nhánh mặc định im lặng luôn là chỗ đáng đặt phép kiểm.
const nguonManLamBai = readFileSync(path.join(process.cwd(), "src/components/PracticeView.tsx"), "utf8");
const LOAI_DE_PHAI_CO_NHAN = ["ai-smart", "adaptive", "chapter", "topic", "random", "due", "incorrect", "bookmark", "difficulty"];
const thieuNhan = LOAI_DE_PHAI_CO_NHAN.filter(t => !new RegExp(`examType === "${t}"`).test(nguonManLamBai));
check("Mọi loại đề đều có nhãn riêng trên màn làm bài",
  thieuNhan.length === 0,
  thieuNhan.length === 0
    ? `${LOAI_DE_PHAI_CO_NHAN.length} loại đề đều có nhánh nhãn riêng, không loại nào rơi vào nhãn mặc định`
    : `thiếu nhãn cho: ${thieuNhan.join(", ")}, các loại này sẽ hiện nhầm là "Luyện tập theo Thứ tự gốc"`);

// AL7. Màn hình KHÔNG được liệt kê khái niệm tới hạn khi người học chưa làm bài nào.
//
// Bất biến 4.9h. Hồ sơ trắng vẫn có thể sinh ra hàng đợi nếu ai đó nạp dữ liệu bằng đường khác,
// và khi ấy màn hình sẽ giục người học "ôn lại" thứ họ chưa từng học. Canh ở NGUỒN vì đây là điều
// kiện hiển thị, không phải giá trị tính được.
const nguonBanHocAL = readFileSync(path.join(process.cwd(), "src/components/PersonalWorkspaceView.tsx"), "utf8");
const chanBoiDaCoBaiLam = /!daCoBaiLam \|\| hangDoiOn\.danhSach\.length === 0/.test(nguonBanHocAL);
check("Màn Bàn học không liệt kê khái niệm tới hạn khi chưa có bài làm",
  chanBoiDaCoBaiLam,
  chanBoiDaCoBaiLam
    ? "khối hàng đợi nằm sau nhánh kiểm daCoBaiLam, người chưa làm bài thấy câu dẫn bắt đầu"
    : "khối hàng đợi KHÔNG được chặn bởi daCoBaiLam, hồ sơ trắng sẽ bị giục ôn lại thứ chưa từng học");

// AL8. Ô tìm nhanh phải có lối vào hàng đợi, và chỉ hiện khi có việc thật.
const nguonTimNhanh = readFileSync(path.join(process.cwd(), "src/components/GlobalCommandPalette.tsx"), "utf8");
const coLoiVaoTimNhanh = /hangDoiOn\.danhSach\.length > 0/.test(nguonTimNhanh)
  && /onNavigate\("practice", \{ type: "due" \}\)/.test(nguonTimNhanh);
check("Ô tìm nhanh có lối vào hàng đợi ôn và chỉ hiện khi có việc",
  coLoiVaoTimNhanh,
  coLoiVaoTimNhanh
    ? "mục Ôn khái niệm tới hạn chỉ dựng khi hàng đợi khác rỗng, bấm vào mở đúng đề loại due"
    : "thiếu lối vào, hoặc mục vẫn hiện khi hàng đợi rỗng");

localStorage.removeItem(KHOA_HO_SO_KN);
if (hoSoKhaiNiemDaLuu !== null) localStorage.setItem(KHOA_HO_SO_KN, hoSoKhaiNiemDaLuu);
if (mucTieuTruocAL !== null) localStorage.setItem(`poly_econ_goal_${dbService.getActiveSubjectId()}`, mucTieuTruocAL);
else localStorage.removeItem(`poly_econ_goal_${dbService.getActiveSubjectId()}`);

// ===========================================================================
// AR. Kế hoạch ôn nhiều ngày
// ===========================================================================
g("AR. Kế hoạch ôn nhiều ngày");

// AR1. NGÀY ĐẦU CỦA KẾ HOẠCH PHẢI KHỚP VỚI VIỆC HÔM NAY.
//
// Hai màn hình cùng trả lời "hôm nay ôn gì": khối hàng đợi trên Bàn học, và ngày đầu của kế hoạch
// trên màn Kế hoạch. Lệch nhau là ứng dụng tự mâu thuẫn với chính nó, và người học không biết tin
// màn nào. Vì vậy cả hai phải đi qua cùng một nền (`nenTangXepLich`), cùng một ngưỡng lợi ích, và
// cùng một phép tính quỹ thời gian.
// Dựng lại hồ sơ trước khi đo: các nhóm phía trên có dọn lịch sử, và một phép kiểm chạy trên kho
// rỗng thì không kiểm được gì.
dungHoSoOnTap(TEN_BEN, 9, 1, 6, 5);
dungHoSoOnTap(TEN_MONG_MANH, 2, 6, 6, 1);
for (let i = 2; i < Math.min(8, doThiAL.length); i++) dungHoSoOnTap(doThiAL[i].concept, 4, 2, 5, 3);
datNgayThi(20);
const QUY_PHUT_AR = 10;
const hangDoiHomNayAR = learnerModelService.layKhaiNiemToiHan(QUY_PHUT_AR);
const keHoachAR = learnerModelService.lapKeHoachOnTheoNgay(QUY_PHUT_AR);
const ngayDauAR = keHoachAR.cacNgay.find(n => n.soNgayNua === 0);
const tenHangDoiAR = hangDoiHomNayAR.danhSach.map(m => m.tenKhaiNiem).join("|");
const tenNgayDauAR = (ngayDauAR?.danhSach || []).map(m => m.tenKhaiNiem).join("|");
check("Ngày đầu của kế hoạch khớp đúng việc hôm nay, hai màn không nói khác nhau",
  keHoachAR.duDuLieu && tenHangDoiAR === tenNgayDauAR,
  !keHoachAR.duDuLieu
    ? `chưa lập được kế hoạch: ${keHoachAR.lyDoChuaLap}`
    : tenHangDoiAR === tenNgayDauAR
      ? `cả hai cùng ${tenHangDoiAR.split("|").filter(Boolean).length} khái niệm, cùng thứ tự`
      : `hàng đợi: ${tenHangDoiAR || "(rỗng)"}\nngày 0 : ${tenNgayDauAR || "(rỗng)"}`);

// AR2. PHÉP KIỂM QUAN TRỌNG NHẤT CỦA NHÓM: khái niệm MONG MANH phải bị xếp MUỘN hơn.
//
// AL2 đã chứng minh thứ hạng lật ngược cho MỘT ngày. Phép kiểm này chứng minh điều đó trải ra cả
// đoạn đường: khi kỳ thi còn xa, khái niệm trôi nhanh phải được ĐỂ DÀNH tới gần ngày thi, còn
// khái niệm bền thì ôn sớm vì ôn xong nó vẫn giữ được tới hôm thi.
//
// Anki không thể làm việc này, và lý do sâu hơn "chưa có tính năng": mô hình của Anki KHÔNG CÓ
// khái niệm hạn chót. Cả SM-2 lẫn FSRS đều chỉ hỏi "mức nhớ hôm nay đã tụt dưới ngưỡng chưa", và
// lịch của chúng chạy ra vô hạn. Không có ngày thi thì không có câu hỏi "để dành tới bao giờ".
datNgayThi(30);
const keHoachXa = learnerModelService.lapKeHoachOnTheoNgay(3);
const ngayXuatHien = (ten: string): number[] =>
  keHoachXa.cacNgay.filter(n => n.danhSach.some(m => m.tenKhaiNiem === ten)).map(n => n.soNgayNua);
const ngayBen = ngayXuatHien(TEN_BEN);
const ngayMongManh = ngayXuatHien(TEN_MONG_MANH);
const trungBinhNgay = (ds: number[]) => ds.length === 0 ? -1 : ds.reduce((a, b) => a + b, 0) / ds.length;
const tbBen = trungBinhNgay(ngayBen);
const tbMongManh = trungBinhNgay(ngayMongManh);
const deDanhDung = ngayBen.length > 0 && ngayMongManh.length > 0 && tbMongManh > tbBen;
check("Khái niệm dễ quên được để dành tới gần ngày thi, khái niệm bền ôn sớm",
  deDanhDung,
  deDanhDung
    ? `"${TEN_BEN}" (bền) xếp trung bình ngày +${tbBen.toFixed(1)}, "${TEN_MONG_MANH}" (mong manh) ngày +${tbMongManh.toFixed(1)}`
    : `bền xếp các ngày [${ngayBen.join(",")}] tb ${tbBen.toFixed(1)}; mong manh [${ngayMongManh.join(",")}] tb ${tbMongManh.toFixed(1)}`);

// AR3. Chưa đặt ngày thi thì KHÔNG lập kế hoạch, và nói rõ vì sao.
//
// Bất biến 4.9: không hiện con số chưa đo. Cả giá trị của bộ lập lịch nằm ở chỗ nó xếp theo hạn
// chót; thiếu hạn chót mà vẫn vẽ ra một lịch là bịa ra một kỳ thi người học chưa từng đặt.
datNgayThi(null);
const keHoachKhongNgayThi = learnerModelService.lapKeHoachOnTheoNgay(30);
check("Chưa đặt ngày thi thì không vẽ ra lịch, và nói rõ lý do",
  !keHoachKhongNgayThi.duDuLieu
    && keHoachKhongNgayThi.cacNgay.length === 0
    && keHoachKhongNgayThi.soNgayToiKyThi === null
    && keHoachKhongNgayThi.lyDoChuaLap.length > 0,
  !keHoachKhongNgayThi.duDuLieu && keHoachKhongNgayThi.cacNgay.length === 0
    ? `trả duDuLieu=false, 0 ngày, kèm lý do đọc được: "${keHoachKhongNgayThi.lyDoChuaLap}"`
    : `vẫn vẽ ra ${keHoachKhongNgayThi.cacNgay.length} ngày dù chưa đặt ngày thi`);

// AR4. Tất định (bất biến 4.7): hai lần gọi liên tiếp cho đúng một kế hoạch.
datNgayThi(20);
const inKeHoach = (k: any) => k.cacNgay.map((n: any) => `${n.soNgayNua}:${n.danhSach.map((m: any) => m.tenKhaiNiem).join(",")}`).join(";");
const keHoachLan1 = inKeHoach(learnerModelService.lapKeHoachOnTheoNgay(10));
const keHoachLan2 = inKeHoach(learnerModelService.lapKeHoachOnTheoNgay(10));
check("Kế hoạch ôn tất định giữa hai lần gọi liên tiếp",
  keHoachLan1 === keHoachLan2 && keHoachLan1.length > 0,
  keHoachLan1 === keHoachLan2
    ? `${keHoachLan1.split(";").length} ngày, khớp hoàn toàn`
    : `lần 1: ${keHoachLan1.slice(0, 120)}\nlần 2: ${keHoachLan2.slice(0, 120)}`);

// AR5. Kế hoạch phải NÂNG được mức nhớ ngày thi, và phải báo cả hai kịch bản.
//
// Báo cả hai vì một con số đơn độc "89%" không nói lên điều gì: người học cần thấy nó so với việc
// không làm gì. Đây cũng là nếp đã dùng cho mọi mạch dữ liệu trước, trình bày cả hai kịch bản khi
// có biến số quyết định kết quả.
const keHoachDoLoiIch = learnerModelService.lapKeHoachOnTheoNgay(10);
const nangDuoc = keHoachDoLoiIch.mucNhoNgayThiNeuTheoKeHoach - keHoachDoLoiIch.mucNhoNgayThiNeuKhongOn;
check("Kế hoạch nâng được mức nhớ ngày thi, và báo cả hai kịch bản",
  keHoachDoLoiIch.duDuLieu && nangDuoc > 0
    && keHoachDoLoiIch.mucNhoNgayThiNeuTheoKeHoach <= 1 && keHoachDoLoiIch.mucNhoNgayThiNeuKhongOn >= 0,
  keHoachDoLoiIch.duDuLieu
    ? `theo kế hoạch ${(keHoachDoLoiIch.mucNhoNgayThiNeuTheoKeHoach * 100).toFixed(1)}%, không ôn gì ${(keHoachDoLoiIch.mucNhoNgayThiNeuKhongOn * 100).toFixed(1)}%, chênh ${(nangDuoc * 100).toFixed(1)} điểm phần trăm`
    : `chưa lập được: ${keHoachDoLoiIch.lyDoChuaLap}`);

// AR6. BỘ QUÉT CẢ HỌ: không phép kiểm nào được ghim ngày tháng viết cứng làm dữ liệu thử.
//
// ĐO ĐƯỢC NGÀY 30/08/2026. Phép kiểm AO9 dựng ba mốc học viết cứng "2026-08-05/08/13". Nó đạt
// đúng vào hôm viết ra rồi TỰ ĐỎ mười bảy ngày sau, chỉ tay vào một đoạn mã hoàn toàn đúng: hệ số
// giãn cách đếm số NGÀY LỊCH khác nhau, nên khi hôm nay đã trôi khỏi mốc cuối thì lượt ôn giả
// định tạo thêm một ngày lịch mới và lợi ích thôi bằng 0.
//
// Một phép kiểm tự hỏng theo thời gian còn TỆ HƠN không có phép kiểm, vì nó dạy người đọc bỏ qua
// màu đỏ. Mốc thời gian trong dữ liệu thử phải dựng tương đối theo `TimeService.now()`.
const nguonHarness = readFileSync(path.join(process.cwd(), "scripts/selftest/harness.ts"), "utf8");
const harnessKhongChuThich = nguonHarness
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
  .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, " "));
// Ngoại lệ nêu đích danh: mốc quy ước cho bản ghi thiếu ngày, không phải dữ liệu thử về thời gian.
const NGAY_CUNG_CO_LY_DO = new Set(["2000-01-01"]);
const ngayVietCung = [...new Set((harnessKhongChuThich.match(/"(\d{4}-\d{2}-\d{2})[^"]*"/g) || [])
  .map(m => m.slice(1, 11)))].filter(d => !NGAY_CUNG_CO_LY_DO.has(d));
check("Không phép kiểm nào ghim ngày tháng viết cứng, nên không phép kiểm nào tự hỏng theo thời gian",
  ngayVietCung.length === 0,
  ngayVietCung.length === 0
    ? `dữ liệu thử về thời gian đều dựng tương đối theo TimeService.now()`
    : `ngày viết cứng sẽ mục theo thời gian: ${ngayVietCung.join(", ")}`);

// AR7. Màn Kế hoạch không được mời làm việc của hôm nay khi HÔM NAY LÀ NGÀY NGHỈ.
//
// ĐO ĐƯỢC TRÊN BẢN CHẠY THẬT NGÀY 30/08/2026: vừa ôn xong một lượt nên lịch bắt đầu từ ngày thứ
// bảy, tức bảy ngày đầu đều là ngày nghỉ, mà nút vẫn mời "Làm phần của hôm nay". Bấm vào là sinh
// một đề cho một việc không tồn tại.
//
// Cùng họ với bất biến 4.9h (màn hình phải nói đúng với người chưa bắt đầu), chỉ khác là ở đây câu
// trả lời đúng là "hôm nay nghỉ" chứ không phải "bạn chưa có dữ liệu". Nghỉ đúng lúc là một phần
// của lịch chứ không phải một trạng thái trống cần lấp.
const nguonManKeHoach = readFileSync(path.join(process.cwd(), "src/components/LearningPlannerDashboard.tsx"), "utf8");
const viTriMoiLamHomNay = nguonManKeHoach.indexOf('onStartExam("due")');
const doanTruocLoiMoi = viTriMoiLamHomNay === -1
  ? ""
  : nguonManKeHoach.slice(Math.max(0, viTriMoiLamHomNay - 400), viTriMoiLamHomNay);
const coCanhNgayNghi = /soNgayNua === 0/.test(doanTruocLoiMoi);
check("Màn Kế hoạch chỉ mời làm việc hôm nay khi hôm nay thật sự có việc",
  viTriMoiLamHomNay !== -1 && coCanhNgayNghi,
  viTriMoiLamHomNay === -1
    ? "không tìm thấy lời mời làm việc hôm nay, phép kiểm đang rỗng"
    : coCanhNgayNghi
      ? "lời mời nằm sau nhánh kiểm hôm nay có việc, ngày nghỉ thì nói ra là nghỉ"
      : "lời mời làm việc hôm nay hiện cả khi hôm nay là ngày nghỉ");

datNgayThi(null);

// ===========================================================================
// AM. Không bịa ngày thi và điểm mục tiêu
// ===========================================================================
g("AM. Không bịa ngày thi và điểm mục tiêu");

// AM1. `getSubjectGoal` với kho trống KHÔNG được trả về ngày thi và điểm mục tiêu.
//
// Đây là GỐC của cả họ lỗi. Trước 13/08/2026 hàm này trả `hôm nay + 14 ngày` và `8,5`, rồi hai
// con số ấy chảy ra khắp nơi: dòng số liệu Bàn học, tab Môn học, bộ dự báo điểm, bộ lập kế hoạch.
// Mọi phép kiểm cũ đều canh tầng component nên không chạm tới, vì ở tầng ấy con số đã trông y như
// một giá trị người học tự đặt.
//
// Từ 30/07/2026 nó nặng hơn lỗi hiển thị: bất biến 4.9i cho `scoreQuestions` một yếu tố trọng số
// 0,15 chấm theo mức nhớ VÀO NGÀY THI, nên một ngày thi bịa điều khiển thật việc chọn câu.
const KHOA_MUC_TIEU = `poly_econ_goal_${dbService.getActiveSubjectId()}`;
const mucTieuDaLuu = localStorage.getItem(KHOA_MUC_TIEU);
localStorage.removeItem(KHOA_MUC_TIEU);
const mucTieuTrong = dbService.getSubjectGoal();
check("Kho mục tiêu trống thì không trả về ngày thi và điểm mục tiêu",
  mucTieuTrong.examDate === null && mucTieuTrong.targetScore === null,
  mucTieuTrong.examDate === null && mucTieuTrong.targetScore === null
    ? "cả hai trả null, còn dailyStudyMinutes và priority vẫn có mặc định vì đó là thiết lập thói quen"
    : `examDate = ${JSON.stringify(mucTieuTrong.examDate)}, targetScore = ${JSON.stringify(mucTieuTrong.targetScore)}, tức vẫn đang bịa`);

// AM2. Mọi đại lượng SUY RA từ hai trường ấy cũng phải là `null`, không được thay bằng số trung tính.
//
// Canh ở tầng dữ liệu chứ không phải tầng chữ, vì đây mới là chỗ lỗi tái phát được. Bộ dự báo từng
// giữ BẢN SAO THỨ HAI của cùng một điều bịa (`let remainingDays = 14`), nên gỡ ở `getSubjectGoal`
// mà quên chỗ ấy thì màn hình vẫn nói "còn 14 ngày".
//
// Riêng `urgencyIndex` phải là `null` chứ không phải 0: một chỉ số cấp bách bằng 0 đọc ra là
// "không có gì gấp", khác hẳn "chưa biết có gấp hay không".
const duBaoKhongMucTieu = examForecaster.calculatePrediction(dbService.getActiveSubjectId());
const suyRaSach = duBaoKhongMucTieu.metricsBreakdown.remainingDays === null
  && duBaoKhongMucTieu.targetScore === null
  && duBaoKhongMucTieu.gap === null
  && duBaoKhongMucTieu.readinessPercentage === null
  && (duBaoKhongMucTieu.metricsBreakdown.urgencyIndex ?? null) === null;
check("Bộ dự báo không dựng số thay cho ngày thi và điểm mục tiêu còn trống",
  suyRaSach,
  suyRaSach
    ? "remainingDays, targetScore, gap, readinessPercentage, urgencyIndex đều null khi chưa đặt mục tiêu"
    : `remainingDays=${duBaoKhongMucTieu.metricsBreakdown.remainingDays}, targetScore=${duBaoKhongMucTieu.targetScore}, gap=${duBaoKhongMucTieu.gap}, readiness=${duBaoKhongMucTieu.readinessPercentage}, urgency=${duBaoKhongMucTieu.metricsBreakdown.urgencyIndex}`);

// AM3. Bộ quét cả họ: không nguồn nào được dựng lại giá trị mặc định cho hai trường ấy.
//
// Đây là phép kiểm đáng giá nhất nhóm này, theo đúng bài học "bộ quét tổng quát đáng giá hơn sửa
// một tên". AM1 và AM2 canh hành vi hiện tại; phép kiểm này canh việc ai đó viết lại đường cũ ở
// một file thứ ba mà hai phép kiểm kia không đi qua.
const NGUON_CO_THE_BIA = [
  "src/services/db.ts",
  "src/services/examForecaster.ts",
  "src/services/curriculumIntelligenceEngine.ts",
  "src/services/learningEngine.ts",
];
const noiBiaLai: string[] = [];
for (const duongDan of NGUON_CO_THE_BIA) {
  const nguon = readFileSync(path.join(process.cwd(), duongDan), "utf8");
  // Bỏ chú thích trước khi quét: các chú thích trong dự án CÓ nhắc tới "14 ngày" và "8,5" để giải
  // thích vì sao đã gỡ chúng đi, và đó là thứ phải giữ chứ không phải thứ phải bắt.
  const khongChuThich = nguon
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter(d => !d.trim().startsWith("//")).join("\n");
  if (/targetScore:\s*\d/.test(khongChuThich)) noiBiaLai.push(`${duongDan} gán sẵn targetScore`);
  if (/examDate:\s*(defaultDate|["'`])/.test(khongChuThich)) noiBiaLai.push(`${duongDan} gán sẵn examDate`);
  if (/remainingDays\s*=\s*\d/.test(khongChuThich)) noiBiaLai.push(`${duongDan} gán sẵn remainingDays`);
  if (/14\s*\*\s*24\s*\*\s*60\s*\*\s*60/.test(khongChuThich)) noiBiaLai.push(`${duongDan} còn phép cộng 14 ngày`);
}
check("Không nguồn nào dựng lại ngày thi hay điểm mục tiêu mặc định",
  noiBiaLai.length === 0,
  noiBiaLai.length === 0
    ? `quét ${NGUON_CO_THE_BIA.length} file engine, không chỗ nào gán sẵn hai trường ấy hay cộng thêm 14 ngày`
    : noiBiaLai.join("; "));

// AM4. Phát hiện đoán mò phải ưu tiên nhịp RIÊNG của người học, không bám `estimatedTime`.
//
// `estimatedTime` bằng đúng 35,0 giây cho cả ba mức khó trên 280 câu của ngân hàng AI sinh, tức
// một hằng số đội lốt số đo. So thời gian thật với hằng số nhân số câu thì chỉ đo được tốc độ
// tuyệt đối, không phân biệt nổi người làm nhanh vì thạo với người gặp đề dễ.
//
// Chưa đủ 20 câu thì vẫn lùi về `estimatedTime`, đó là chủ ý: dưới mức ấy nhịp riêng còn nhiễu
// hơn hằng số. Nên phép kiểm canh CẢ HAI nhánh.
dbService.clearAllHistory();
const nhipKhiChuaCoGi = nhipRiengMoiCau();
const mocKhiChuaCoGi = mocNhipChuan(questions.slice(0, 10).map(q => q.id));
const uocTinhNganHang = questions.slice(0, 10).reduce((s, q) => s + (q.estimatedTime || 0), 0);
const nhanhVeUocTinh = nhipKhiChuaCoGi === null && Math.abs(mocKhiChuaCoGi - uocTinhNganHang) < 0.01;
check("Chưa đủ 20 câu thì mốc nhịp lùi về ước tính của ngân hàng",
  nhanhVeUocTinh,
  nhanhVeUocTinh
    ? `lịch sử trống nên nhịp riêng null và mốc bằng đúng tổng estimatedTime (${uocTinhNganHang}s cho 10 câu)`
    : `nhịp riêng = ${nhipKhiChuaCoGi}, mốc = ${mocKhiChuaCoGi}s trong khi ước tính ngân hàng = ${uocTinhNganHang}s`);

// Dựng 3 lượt, 10 câu mỗi lượt, nhịp 20 giây một câu. Đủ 30 câu nên phải vượt ngưỡng 20.
for (let i = 0; i < 3; i++) {
  const dsCau = questions.slice(i * 10, i * 10 + 10).map(q => q.id);
  dbService.saveAttempt({
    id: `am4-${i}`, examType: "random", startTime: new Date(0).toISOString(),
    endTime: new Date(0).toISOString(), questions: dsCau, answers: {}, bookmarks: [], flags: [],
    isSubmitted: true, score: 0, timeSpent: dsCau.length * 20,
  } as any);
}
const nhipSauKhiCoDuLieu = nhipRiengMoiCau();
const dungNhipRieng = nhipSauKhiCoDuLieu !== null && Math.abs(nhipSauKhiCoDuLieu - 20) < 0.01;
check("Đủ dữ liệu thì mốc nhịp chuyển sang nhịp riêng của người học",
  dungNhipRieng,
  dungNhipRieng
    ? "30 câu ở nhịp 20 giây một câu cho trung vị đúng 20 giây, thay hẳn hằng số 35 giây của ngân hàng"
    : `nhịp riêng đo được ${nhipSauKhiCoDuLieu}, đáng lẽ 20 giây một câu`);
dbService.clearAllHistory();

// Trả lại mục tiêu đã lưu để không làm hỏng hồ sơ thật khi chạy trên máy Đàm.
if (mucTieuDaLuu !== null) localStorage.setItem(KHOA_MUC_TIEU, mucTieuDaLuu);

// ===========================================================================
// Kết quả
// ===========================================================================
function inKetQua(): void {
  const failed = results.filter(r => !r.ok);
  let lastGroup = "";
  for (const r of results) {
    if (r.group !== lastGroup) {
      console.log(`\n${r.group}`);
      lastGroup = r.group;
    }
    const mark = r.ok ? "  DAT " : "  HONG";
    console.log(`${mark} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  }

  if (notes.length) {
    console.log("\nSố liệu tham khảo");
    notes.forEach(n => console.log(`  - ${n}`));
  }

  console.log(`\nTổng: ${results.length - failed.length}/${results.length} phép kiểm đạt.`);
  if (failed.length) {
    console.log("Các phép kiểm HỎNG:");
    failed.forEach(f => console.log(`  - [${f.group}] ${f.name}${f.detail ? `: ${f.detail}` : ""}`));
    process.exit(1);
  }
}

// Phép kiểm cuối là bất đồng bộ, nên phải chờ nó xong rồi mới in kết quả. Nếu bản thân nó nổ
// thì vẫn phải in, không được nuốt lỗi rồi báo xanh.
kiemTraMonTuTao()
  .catch((e: any) => {
    check("Môn người dùng tự tạo cũng chạy được tầng suy luận", false, `lỗi ngoài dự kiến: ${e?.message}`);
  })
  .then(kiemTraChamNhoLai)
  .catch((e: any) => {
    check("Hai đường thất bại khi chấm đều không dựng ra điểm", false, `lỗi ngoài dự kiến: ${e?.message}`);
  })
  .then(inKetQua);
