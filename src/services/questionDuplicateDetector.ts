/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question } from "../types";

export interface DuplicateMatch {
  questionId: number;
  similarityScore: number; // 0 - 100
  matchType: "EXACT" | "NEAR_DUPLICATE" | "CONCEPT_OVERLAP";
  reason: string;
}

export interface DuplicateDetectionResult {
  hasDuplicate: boolean;
  hasNearDuplicate: boolean;
  maxSimilarityScore: number;
  matches: DuplicateMatch[];
}

/**
 * Đệm kết quả chuẩn hóa chuỗi.
 *
 * Dò trùng lặp so mỗi câu với toàn bộ ngân hàng, nên cùng một câu bị chuẩn hóa lại hàng trăm
 * lần. Với 292 câu, đó là khoảng 85 nghìn lượt chuẩn hóa cho đúng 292 chuỗi khác nhau.
 */
const demChuanHoa = new Map<string, string>();

export const questionDuplicateDetector = {
  /**
   * Normalizes a string for clean comparisons by stripping punctuation and lowercasing.
   */
  normalizeText(str: string): string {
    const raw = str || "";
    const daCo = demChuanHoa.get(raw);
    if (daCo !== undefined) return daCo;

    const ketQua = raw
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Chặn phình bộ nhớ khi có nhiều chuỗi lạ (ví dụ nhập tài liệu dài). Ngân hàng thật chỉ
    // khoảng vài nghìn chuỗi riêng biệt nên gần như không bao giờ chạm trần.
    if (demChuanHoa.size > 20000) demChuanHoa.clear();
    demChuanHoa.set(raw, ketQua);
    return ketQua;
  },

  /**
   * Calculates Jaccard word-set similarity score (0 - 100).
   */
  calculateSimilarity(text1: string, text2: string): number {
    return this.similarityTuTapTu(this.normalizeText(text1), this.normalizeText(text2));
  },

  /**
   * Bản dùng chung của phép Jaccard, nhận vào chuỗi ĐÃ chuẩn hóa.
   *
   * Vì sao tách ra: `checkQuestionDuplicates` quét câu đang xét với toàn bộ ngân hàng, và bản cũ
   * chuẩn hóa lại chính câu đang xét ở MỖI vòng lặp. Với 292 câu, đó là 292 × 292 lần chuẩn hóa
   * thừa cho cùng một chuỗi. Đo được: một lượt quét cả ngân hàng mất khoảng 4 giây, đủ để treo
   * giao diện khi mở màn hình Đài quan sát.
   */
  similarityTuTapTu(norm1: string, norm2: string): number {
    if (norm1 === norm2 && norm1.length > 0) return 100;
    if (!norm1 || !norm2) return 0;

    const words1 = new Set(norm1.split(" "));
    const words2 = new Set(norm2.split(" "));

    let intersectionCount = 0;
    let unionCount = words1.size;
    words2.forEach(w => {
      if (words1.has(w)) intersectionCount++;
      else unionCount++;
    });

    if (unionCount === 0) return 0;
    return Math.round((intersectionCount / unionCount) * 100);
  },

  /**
   * Checks a question against a pool of existing questions for exact or near-duplicates.
   */
  checkQuestionDuplicates(target: Question, pool: Question[]): DuplicateDetectionResult {
    const matches: DuplicateMatch[] = [];

    // Chuẩn hóa câu đang xét ĐÚNG MỘT LẦN, ngoài vòng lặp.
    const normTargetQ = this.normalizeText(target.question);
    const normTargetOpts = Object.values(target.options || {})
      .map(o => this.normalizeText(o))
      .sort()
      .join("|");

    for (const existing of pool) {
      if (existing.id === target.id) continue;

      const normExistingQ = this.normalizeText(existing.question);

      // 1. Exact string match
      if (normTargetQ === normExistingQ) {
        matches.push({
          questionId: existing.id,
          similarityScore: 100,
          matchType: "EXACT",
          reason: `Nội dung câu hỏi trùng lặp 100% với câu ID #${existing.id}`
        });
        continue;
      }

      // 2. Similarity analysis (dùng lại chuỗi đã chuẩn hóa, không chuẩn hóa lại)
      const textSimilarity = this.similarityTuTapTu(normTargetQ, normExistingQ);

      // Option set overlap check
      const optionsExisting = Object.values(existing.options || {}).map(o => this.normalizeText(o)).sort().join("|");
      const optionSimilarity = this.similarityTuTapTu(normTargetOpts, optionsExisting);

      const combinedScore = Math.round(textSimilarity * 0.7 + optionSimilarity * 0.3);

      if (combinedScore >= 85) {
        matches.push({
          questionId: existing.id,
          similarityScore: combinedScore,
          matchType: "NEAR_DUPLICATE",
          reason: `Trùng lặp ý nghĩa xấp xỉ (${combinedScore}%) với câu ID #${existing.id}`
        });
      } else if (target.concept && existing.concept && target.concept.toLowerCase() === existing.concept.toLowerCase() && combinedScore >= 65) {
        matches.push({
          questionId: existing.id,
          similarityScore: combinedScore,
          matchType: "CONCEPT_OVERLAP",
          reason: `Cùng kiểm tra khái niệm '${target.concept}' với nội dung gần giống nhau (${combinedScore}%)`
        });
      }
    }

    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    const hasDuplicate = matches.some(m => m.matchType === "EXACT");
    const hasNearDuplicate = matches.some(m => m.matchType === "NEAR_DUPLICATE");
    const maxSimilarityScore = matches.length > 0 ? matches[0].similarityScore : 0;

    return {
      hasDuplicate,
      hasNearDuplicate,
      maxSimilarityScore,
      matches
    };
  }
};
