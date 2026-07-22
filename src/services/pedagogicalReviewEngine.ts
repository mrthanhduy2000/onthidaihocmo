/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question, QuestionSpecification, PedagogicalMetadata, PedagogicalQualityMetrics } from "../types";
import { authoritativeKnowledgePolicy } from "./authoritativeKnowledgePolicy";
import { diversityTracker } from "./questionGenerationEngine";

export interface PedagogicalReviewResult {
  reviewPassed: boolean;
  reviewIssues: string[];
  reviewScore: number;
  pedagogicalMetadata: PedagogicalMetadata;
}

export const REVIEW_RULES = {
  RULE_1_ANSWER_UNIQUENESS: "Đảm bảo duy nhất 1 đáp án đúng hoàn toàn, 3 phương án còn lại không đúng hoặc không tối ưu bằng.",
  RULE_2_DISTRACTOR_QUALITY: "Các phương án nhiễu phải khác biệt, mang tính thuyết phục cao và không trùng lặp câu chữ.",
  RULE_3_NO_ANSWER_LEAKAGE: "Thân câu hỏi không được vô tình tiết lộ từ khóa chỉ dẫn trực tiếp tới đáp án đúng.",
  RULE_4_GROUNDING_COMPLIANCE: "Mọi luận điểm và trích dẫn trong lời giải phải nằm 100% trong học liệu upload.",
  RULE_5_PEDAGOGICAL_CLARITY: "Câu hỏi và lời giải phải diễn đạt rành mạch, có giá trị hướng dẫn người học.",
  RULE_6_BLUEPRINT_ALIGNMENT: "Cấu trúc câu hỏi phải trung thực với đặc tả Blueprint đã đề ra trong QuestionSpecification."
};

export const pedagogicalReviewEngine = {
  /**
   * Deterministically reviews a generated question against QuestionSpecification and Authoritative Knowledge Policy.
   */
  reviewQuestion(
    question: Question,
    spec: QuestionSpecification
  ): PedagogicalReviewResult {
    const issues: string[] = [];

    // 1. Check Option Uniqueness & Distractor Quality
    const opts = [
      question.options.a,
      question.options.b,
      question.options.c,
      question.options.d
    ].map(o => o.trim());

    const uniqueOpts = new Set(opts.map(o => o.toLowerCase()));
    let answerUniqueness = 100;
    let distractorPlausibility = 95;

    if (uniqueOpts.size < 4) {
      issues.push("Phát hiện phương án trùng lặp hoặc lặp lại nội dung.");
      answerUniqueness = 40;
      distractorPlausibility = 30;
    }

    // Check if correct option is valid
    if (!["a", "b", "c", "d"].includes(question.correctAnswer.toLowerCase())) {
      issues.push("Đáp án đúng không nằm trong danh sách các lựa chọn [a, b, c, d].");
      answerUniqueness = 0;
    }

    // 2. Ambiguity & Stem Leakage Check
    const lowerStem = question.question.toLowerCase();
    const correctOptText = (question.options[question.correctAnswer as "a" | "b" | "c" | "d"] || "").toLowerCase();
    
    let questionAmbiguity = 95; // 95 = high clarity (low ambiguity)
    
    if (lowerStem.length < 15) {
      issues.push("Thân câu hỏi quá ngắn, dễ gây mơ hồ cho người học.");
      questionAmbiguity -= 40;
    }

    // Check if question stem gives away the answer too blatantly
    if (correctOptText.length > 10 && lowerStem.includes(correctOptText)) {
      issues.push("Thân câu hỏi lộ nguyên văn phương án trả lời đúng (Stem leakage).");
      questionAmbiguity -= 30;
    }

    // 3. Grounding & Authoritative Knowledge Policy Verification
    const fullTextForGrounding = `${question.question}\n${question.explanation}`;
    const groundingResult = authoritativeKnowledgePolicy.evaluateGrounding(fullTextForGrounding);

    let evidenceSufficiency = 100;
    if (!groundingResult.isPolicyCompliant) {
      issues.push(...groundingResult.violations);
      evidenceSufficiency = 40;
    }

    // 4. Blueprint & Bloom Consistency
    let blueprintConsistency = 100;
    if (spec.blueprint === "NOT_QUESTION" && !lowerStem.includes("không")) {
      issues.push("Yêu cầu Blueprint KHÔNG ĐÚNG nhưng câu hỏi thiếu từ khóa phủ định.");
      blueprintConsistency = 50;
    } else if (spec.blueprint === "COMPARISON" && !lowerStem.includes("so sánh") && !lowerStem.includes("khác") && !lowerStem.includes("giống")) {
      blueprintConsistency = 75;
    }

    let bloomConsistency = question.bloomLevel === spec.bloomLevel ? 100 : 85;

    // 5. Difficulty Consistency
    let difficultyConsistency = question.difficulty === spec.difficulty ? 100 : 85;

    // 6. Pedagogical Clarity & Teaching Value
    let pedagogicalClarity = 95;
    let teachingValue = 90;

    if (!question.explanation || question.explanation.length < 30) {
      issues.push("Lời giải thích sư phạm chưa đầy đủ hoặc quá sơ sài.");
      pedagogicalClarity = 40;
      teachingValue = 40;
    }

    // 7. Question Originality (Diversity)
    const questionOriginality = diversityTracker.calculateTextUniqueness(question.question);
    if (questionOriginality < 50) {
      issues.push("Độ trùng lặp ngữ liệu cao so với các câu hỏi trong ngân hàng đề.");
    }

    // Calculate Overall Review Score (0 - 100)
    const reviewScore = Math.round(
      answerUniqueness * 0.20 +
      distractorPlausibility * 0.15 +
      questionAmbiguity * 0.15 +
      evidenceSufficiency * 0.15 +
      blueprintConsistency * 0.10 +
      pedagogicalClarity * 0.10 +
      questionOriginality * 0.15
    );

    const reviewPassed = reviewScore >= 65 && issues.length === 0;

    const metrics: PedagogicalQualityMetrics = {
      questionAmbiguity,
      answerUniqueness,
      distractorPlausibility,
      pedagogicalClarity,
      evidenceSufficiency,
      blueprintConsistency,
      bloomConsistency,
      difficultyConsistency,
      teachingValue,
      questionOriginality
    };

    const whyBlueprintSelected = `Dạng bài Blueprint [${spec.blueprint}] được quyết định dựa trên mô hình sư phạm để rèn luyện kĩ năng [${spec.bloomLevel}].`;
    const whyDifficultySelected = `Độ khó [${spec.difficulty}] được thiết lập nhằm nâng cao năng lực cho nhóm sinh viên [${spec.targetStudentLevel}].`;

    const pedagogicalMetadata: PedagogicalMetadata = {
      learningObjective: spec.learningObjective,
      pedagogicalReason: spec.pedagogicalReason,
      expectedMisconception: spec.expectedMisconception,
      whyBlueprintSelected,
      whyDifficultySelected,
      reviewPassed,
      reviewIssues: issues,
      reviewScore,
      metrics
    };

    return {
      reviewPassed,
      reviewIssues: issues,
      reviewScore,
      pedagogicalMetadata
    };
  }
};
