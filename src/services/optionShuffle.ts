/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question } from "../types";

/**
 * Trộn thứ tự các phương án A/B/C/D của câu hỏi để xóa thiên lệch vị trí đáp án
 * (ví dụ ngân hàng câu hỏi hiện có tới hơn nửa số câu đáp án đúng nằm ở "b").
 *
 * Nguyên tắc an toàn:
 * - Trộn TẤT ĐỊNH theo id câu hỏi (không dùng Math.random), nên mỗi lần tải trang
 *   một câu luôn cho ra cùng một thứ tự. Nhờ vậy điểm số và lịch sử đã lưu vẫn
 *   được chấm nhất quán, không bị đảo loạn khi tải lại.
 * - Sau khi đảo vị trí, remap luôn đáp án đúng VÀ các nhãn phương án được nhắc
 *   trong phần lời giải (ví dụ "phương án b, c, d không phản ánh...").
 * - Nếu lời giải còn chữ cái đơn KHÔNG chắc chắn là nhãn phương án (ví dụ "C.Mác",
 *   "ký hiệu là c", "thương hiệu A, B, C, D", nhãn quảng cáo A/B), câu đó được GIỮ
 *   NGUYÊN thứ tự để tuyệt đối không làm sai lời giải.
 */

type OptKey = "a" | "b" | "c" | "d";
const KEYS: OptKey[] = ["a", "b", "c", "d"];

// PRNG tất định (mulberry32) seed từ id câu hỏi
function seededPermutation(seed: number): number[] {
  let t = (seed >>> 0) + 0x6d2b79f5;
  const rand = () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = [0, 1, 2, 3];
  // Fisher-Yates tất định
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const LETTER = "[A-Da-d]";
const RB = "(?![\\wÀ-ỹ])"; // biên phải: không có chữ cái theo sau
const KW_BEFORE = "(?:các phương án|các lựa chọn|phương án|đáp án|lựa chọn|option|ý|câu)";
const LIST = `(?:${LETTER}${RB})(?:\\s*(?:,|và|hoặc|&|/|;)\\s*${LETTER}${RB})*`;
const AFTER =
  "(?:là đáp án|là phương án|là lựa chọn|là câu|là chiến dịch|là ý|sai\\b|đúng\\b|thuộc\\b|liên quan|mô tả|ngược lại|không chính xác|không phản ánh|không đúng|bị |đề cập)";

/**
 * Tìm vị trí (index) các chữ cái trong lời giải chắc chắn là nhãn phương án.
 * Trả về null nếu phát hiện chữ cái đơn không phân loại được (=> không nên trộn).
 */
function findOptionLetterIndices(text: string): Set<number> | null {
  const opt = new Set<number>();

  // 1) Từ khóa đứng trước + danh sách chữ: "phương án b, c, d"
  const reBefore = new RegExp(`${KW_BEFORE}\\s+(${LIST})`, "gi");
  for (let m = reBefore.exec(text); m; m = reBefore.exec(text)) {
    const groupStart = m.index + m[0].length - m[1].length;
    const reL = /[A-Da-d]/g;
    for (let lm = reL.exec(m[1]); lm; lm = reL.exec(m[1])) {
      opt.add(groupStart + lm.index);
    }
  }

  // 2) Chữ (hoặc danh sách chữ) + động từ nhận định phía sau: "c là đáp án đúng", "b và d sai"
  const reAfter = new RegExp(`(?<![\\wÀ-ỹ'.])(${LIST})\\s+${AFTER}`, "g");
  for (let m = reAfter.exec(text); m; m = reAfter.exec(text)) {
    const groupStart = m.index; // group 1 bắt đầu ngay đầu match do lookbehind không tiêu ký tự
    const reL = /[A-Da-d]/g;
    for (let lm = reL.exec(m[1]); lm; lm = reL.exec(m[1])) {
      opt.add(groupStart + lm.index);
    }
  }

  // 3) Quét mọi chữ cái đơn còn lại; nếu có chữ không nằm trong vùng đã nhận diện,
  //    không nằm trong dấu nháy đơn, và không phải initial kiểu "C." => bỏ trộn cho an toàn.
  const quoteMask = new Set<number>();
  const reQuote = /'[^']*'/g;
  for (let qm = reQuote.exec(text); qm; qm = reQuote.exec(text)) {
    for (let i = qm.index; i < qm.index + qm[0].length; i++) quoteMask.add(i);
  }
  const reLone = /(?<![\wÀ-ỹ'.])([A-Da-d])(?![\wÀ-ỹ])/g;
  for (let lm = reLone.exec(text); lm; lm = reLone.exec(text)) {
    const p = lm.index;
    if (opt.has(p)) continue;
    if (quoteMask.has(p)) continue;
    if (/[A-Da-d]\./.test(text.slice(p, p + 2))) continue; // initial tên riêng "C.Mác"
    return null; // còn chữ cái không phân loại được
  }

  return opt;
}

function remapExplanation(text: string, indices: Set<number>, map: Record<OptKey, OptKey>): string {
  if (indices.size === 0) return text;
  const chars = text.split("");
  indices.forEach((i) => {
    const ch = chars[i];
    const lower = ch.toLowerCase() as OptKey;
    if (KEYS.includes(lower)) {
      const mapped = map[lower];
      chars[i] = ch === ch.toUpperCase() ? mapped.toUpperCase() : mapped;
    }
  });
  return chars.join("");
}

export function shuffleQuestionOptions(q: Question): Question {
  if (!q || !q.options || !q.correctAnswer) return q;

  // Chỉ trộn khi lời giải remap được an toàn
  const optIndices = q.explanation ? findOptionLetterIndices(q.explanation) : new Set<number>();
  if (optIndices === null) return q;

  const perm = seededPermutation(q.id);

  // perm[i] = chỉ số khóa gốc được đưa vào vị trí i
  const newOptions = { a: "", b: "", c: "", d: "" } as Record<OptKey, string>;
  const oldToNew = {} as Record<OptKey, OptKey>;
  for (let i = 0; i < 4; i++) {
    const oldKey = KEYS[perm[i]];
    const newKey = KEYS[i];
    newOptions[newKey] = q.options[oldKey];
    oldToNew[oldKey] = newKey;
  }

  const newCorrect = oldToNew[q.correctAnswer as OptKey];
  const newExplanation = q.explanation ? remapExplanation(q.explanation, optIndices, oldToNew) : q.explanation;

  return {
    ...q,
    options: newOptions,
    correctAnswer: newCorrect,
    explanation: newExplanation,
  };
}
