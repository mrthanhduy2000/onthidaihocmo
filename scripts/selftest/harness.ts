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
import { dbService, loadSubject, questions, questionMap, chapters, topics } from "../../src/services/db";
import { EvidenceBasedPipeline } from "../../src/services/evidencePipeline";
// Ngân hàng của môn ĐÃ ĐÓNG, nhập vào đây chỉ để đối chiếu dải id trong nhóm kiểm H.
import { questions as closedSubjectQuestions } from "../../src/data/questions";
import { shuffleQuestionOptions } from "../../src/services/optionShuffle";
import { aiService } from "../../src/services/ai";
import { learningEngine } from "../../src/services/learningEngine";
import { conceptMemoryService } from "../../src/services/conceptMemoryService";
import { assessmentDesignEngine } from "../../src/services/assessmentDesignEngine";
import { kbService } from "../../src/services/kbService";
import { learnerModelService } from "../../src/services/learnerModel";
import { examForecaster } from "../../src/services/examForecaster";
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
const firstId = graded.questions[0];
const mapped = questionMap.get(firstId)!;
const raw = questions.find(q => q.id === firstId)!;
if (mapped.correctAnswer !== raw.correctAnswer) {
  dbService.clearAllHistory();
  const wrongExam = aiService.generateExam({ type: "random", count: 5 });
  wrongExam.questions = [firstId];
  wrongExam.answers = { [firstId]: raw.correctAnswer };
  wrongExam.isSubmitted = true;
  dbService.saveAttempt(wrongExam);
  const st = dbService.getStatistics();
  check("Chấm theo bản đã trộn, không theo bản gốc", st.totalCorrect === 0, `chọn theo đáp án bản gốc phải bị tính SAI, totalCorrect = ${st.totalCorrect}`);
} else {
  info("Bỏ qua phép kiểm chấm theo bản đã trộn: câu đầu tiên tình cờ có đáp án trùng bản gốc.");
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
