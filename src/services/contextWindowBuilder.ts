/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvidenceSet, ReasoningContext } from "./evidencePipeline";
import { StudentModel } from "./learnerModel";
import { LearningPlan } from "./learningPlanner";
import { Question } from "../types";
import { conceptMemoryService } from "./conceptMemoryService";

export interface CompressedContext {
  conceptName: string;
  kbEvidenceSummary: string;
  studentSummary: string;
  learningPlanSummary: string;
  questionText: string;
  optionsSummary: string;
  selectedAnswerText: string;
  correctAnswerText: string;
  misconceptionsSummary: string;
  citationSummary: string;
}

export const contextWindowBuilder = {
  /**
   * Compresses and deduplicates context data before sending to Gemini Prompt Builder.
   * Strips unnecessary metadata to minimize token consumption while maintaining complete academic context.
   */
  buildCompressedContext(params: {
    subjectName: string;
    question: Question;
    selectedAnswer: string;
    evidence: EvidenceSet;
    reasoning: ReasoningContext;
    learningPlan: LearningPlan;
    studentModel: StudentModel;
    crossSubject?: { connectedSubject: string; topic: string; explanation: string } | null;
  }): CompressedContext {
    const { question, selectedAnswer, evidence, reasoning, learningPlan, studentModel, crossSubject } = params;

    // 1. Deduplicate & compress Knowledge Base Evidence
    const evidenceItems: string[] = [];
    if (evidence.definition) {
      evidenceItems.push(`Định nghĩa: ${evidence.definition.trim()}`);
    }
    if (evidence.textbookContext && evidence.textbookContext !== evidence.definition) {
      evidenceItems.push(`Nguyên văn giáo trình: ${evidence.textbookContext.trim()}`);
    }
    if (evidence.caseStudy) {
      evidenceItems.push(`Tình huống thực tế: ${evidence.caseStudy.trim()}`);
    }

    const uniqueEvidenceLines = Array.from(new Set(evidenceItems));
    const kbEvidenceSummary = uniqueEvidenceLines.length > 0
      ? uniqueEvidenceLines.join("\n")
      : `Khái niệm "${evidence.conceptName}" thuộc tài liệu ${evidence.slideSource?.pdf || "Giáo trình chính thức"} (Trang ${evidence.slideSource?.page || 1}).`;

    // 2. Compress Student Profile & Long-Term Concept Memory
    const conceptProfile = conceptMemoryService.getConceptProfile(evidence.conceptName);
    const mastery = conceptProfile.currentMastery || (studentModel.conceptMastery[evidence.conceptName] ?? 50);
    const fatigue = studentModel.adaptiveMemory.questionFatigue ?? 0;
    const guessFreq = studentModel.adaptiveMemory.guessingFrequency ?? 0;
    const rotatedStrategy = conceptMemoryService.getRotatedTeachingStrategy(
      evidence.conceptName,
      learningPlan.strategy || "Academic"
    );

    const studentSummary = [
      `Mức độ tinh thông hiện tại: ${mastery}% (Đỉnh lịch sử: ${conceptProfile.historicalPeak}%)`,
      `Độ ghi nhớ (Retention): ${Math.round(conceptProfile.retentionScore * 100)}%`,
      `Trạng thái: ${conceptProfile.isStableMastered ? "Đắc thụ Ổn định (Stable)" : conceptProfile.isRegressionDetected ? "Giảm sút (Regression)" : "Đang tiến bộ"}`,
      `Số lần ôn tập: ${conceptProfile.timesStudied}`,
      `Phong cách giảng dạy đề xuất: ${rotatedStrategy}`,
      `Chỉ số mệt mỏi nhận thức: ${fatigue}%`,
      `Xu hướng đoán mò: ${guessFreq > 0.3 ? "Có khả năng" : "Thấp"}`
    ].join(" | ");

    // 3. Compress Learning Plan Instructions
    const planLines = [
      `Nhiệm vụ trọng tâm: ${learningPlan.objective}`,
      `Bloom Level: ${learningPlan.bloom}`,
      `Chiến lược sư phạm: ${learningPlan.strategy}`,
      `Độ sâu giải thích: ${learningPlan.explanationDepth}`,
      `Sử dụng ẩn dụ: ${learningPlan.analogy ? "Có" : "Không"}`,
      `Khái niệm tiếp theo: ${learningPlan.nextConcept}`
    ];
    if (crossSubject) {
      planLines.push(`Liên kết liên môn: ${crossSubject.connectedSubject} (${crossSubject.topic}) - ${crossSubject.explanation}`);
    }
    const learningPlanSummary = planLines.join("\n");

    // 4. Compress Question Options
    const optionsSummary = Object.entries(question.options)
      .map(([key, val]) => `${key.toUpperCase()}: ${val.trim()}`)
      .join("\n");

    const selKey = selectedAnswer.toLowerCase();
    const corrKey = question.correctAnswer.toLowerCase();
    const selectedAnswerText = `${selectedAnswer.toUpperCase()} - ${question.options[selKey as keyof typeof question.options] || ""}`;
    const correctAnswerText = `${question.correctAnswer.toUpperCase()} - ${question.options[corrKey as keyof typeof question.options] || ""}`;

    // 5. Compress Misconception context
    const misconceptionsSummary = reasoning.detectedMisconception.hasMisconception
      ? `Phát hiện hiểu sai: ${reasoning.detectedMisconception.description}`
      : `Cảnh báo bẫy phổ biến: ${question.misconception || "Cần phân biệt rõ bản chất khái niệm với các biểu hiện bề ngoài."}`;

    // 6. Compress Citation Metadata
    const pdfName = evidence.slideSource?.pdf || "Giáo trình và Slide Bài Giảng";
    const pageNum = evidence.slideSource?.page || 1;
    const citationSummary = `${pdfName}, Trang ${pageNum}`;

    return {
      conceptName: evidence.conceptName,
      kbEvidenceSummary,
      studentSummary,
      learningPlanSummary,
      questionText: question.question,
      optionsSummary,
      selectedAnswerText,
      correctAnswerText,
      misconceptionsSummary,
      citationSummary
    };
  }
};
