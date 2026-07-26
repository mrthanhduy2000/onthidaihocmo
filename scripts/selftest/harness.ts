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
import { dbService, loadSubject, questions, questionMap, chapters, topics, suyRaMucBloom, daDangKyDoThiTriThuc, setConceptMasteryBothKeys } from "../../src/services/db";
import { EvidenceBasedPipeline } from "../../src/services/evidencePipeline";
import { productObservabilityService } from "../../src/services/productObservabilityService";
import { curriculumIntelligenceEngine } from "../../src/services/curriculumIntelligenceEngine";
// Ngân hàng của môn ĐÃ ĐÓNG, nhập vào đây chỉ để đối chiếu dải id trong nhóm kiểm H.
import { questions as closedSubjectQuestions } from "../../src/data/questions";
import { shuffleQuestionOptions } from "../../src/services/optionShuffle";
import { aiService } from "../../src/services/ai";
import { learningEngine } from "../../src/services/learningEngine";
import { conceptMemoryService } from "../../src/services/conceptMemoryService";
import { assessmentDesignEngine } from "../../src/services/assessmentDesignEngine";
import { kbService } from "../../src/services/kbService";
import { learnerModelService, studentModelService } from "../../src/services/learnerModel";
import { examForecaster } from "../../src/services/examForecaster";
import { evidenceCoverageAuditService } from "../../src/services/evidenceCoverageAudit";
import { teachingAnalytics } from "../../src/services/teachingAnalytics";
import { examQualityReportService } from "../../src/services/examQualityReport";
import { Question } from "../../src/types";

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
check("Sai lệch dự báo nằm trong giới hạn", maxAbsErr <= 1.2,
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
const keHoach = dbService.getSubjectGoal();
const phutHienTai = keHoach.dailyStudyMinutes || 45;
const ngayHienTai = duBaoJ.metricsBreakdown.remainingDays;
const moPhongTaiCho = examForecaster.simulateDeadlineOutcome(phutHienTai, ngayHienTai);
check("Mô phỏng tại đúng kế hoạch hiện tại trùng với dự báo",
  Math.abs(moPhongTaiCho - duBaoJ.predictedScore) < 0.05,
  `dự báo ${duBaoJ.predictedScore}, mô phỏng ${moPhongTaiCho} tại ${phutHienTai} phút và ${ngayHienTai} ngày`);

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
  .then(inKetQua);
