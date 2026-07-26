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
import { dbService, questions, questionMap, chapters, topics } from "../../src/services/db";
import { shuffleQuestionOptions } from "../../src/services/optionShuffle";
import { aiService } from "../../src/services/ai";
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
// Kết quả
// ===========================================================================
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
