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

export const questionDuplicateDetector = {
  /**
   * Normalizes a string for clean comparisons by stripping punctuation and lowercasing.
   */
  normalizeText(str: string): string {
    return (str || "")
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  /**
   * Calculates Jaccard word-set similarity score (0 - 100).
   */
  calculateSimilarity(text1: string, text2: string): number {
    const norm1 = this.normalizeText(text1);
    const norm2 = this.normalizeText(text2);

    if (norm1 === norm2 && norm1.length > 0) return 100;
    if (!norm1 || !norm2) return 0;

    const words1 = new Set(norm1.split(" "));
    const words2 = new Set(norm2.split(" "));

    let intersectionCount = 0;
    words1.forEach(w => {
      if (words2.has(w)) intersectionCount++;
    });

    const unionCount = new Set([...words1, ...words2]).size;
    if (unionCount === 0) return 0;

    return Math.round((intersectionCount / unionCount) * 100);
  },

  /**
   * Checks a question against a pool of existing questions for exact or near-duplicates.
   */
  checkQuestionDuplicates(target: Question, pool: Question[]): DuplicateDetectionResult {
    const matches: DuplicateMatch[] = [];

    const normTargetQ = this.normalizeText(target.question);

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

      // 2. Similarity analysis
      const textSimilarity = this.calculateSimilarity(target.question, existing.question);

      // Option set overlap check
      const optionsTarget = Object.values(target.options || {}).map(o => this.normalizeText(o)).sort().join("|");
      const optionsExisting = Object.values(existing.options || {}).map(o => this.normalizeText(o)).sort().join("|");
      const optionSimilarity = this.calculateSimilarity(optionsTarget, optionsExisting);

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
