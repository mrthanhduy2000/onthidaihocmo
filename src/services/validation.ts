/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { questions } from "../data/questions";
import { chapters } from "../data/chapters";
import { topics } from "../data/topics";
import { Question, DifficultyLevel } from "../types";

export interface ValidationError {
  questionId: number;
  questionTextSummary: string;
  field: string;
  severity: "error" | "warning";
  message: string;
}

export interface DatabaseAuditReport {
  totalQuestions: number;
  totalChapters: number;
  totalTopics: number;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  duplicateQuestionsDetected: number;
  unmappedTopics: string[];
}

/**
 * Performs a comprehensive database and content audit.
 * Designed to support scaling from 60 to 10,000+ items without performance or logical failure.
 */
export function auditQuestionsDatabase(): DatabaseAuditReport {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const chapterIds = new Set(chapters.map(c => c.id));
  const topicIdToChapter = new Map(topics.map(t => [t.id, t.chapterId]));
  const seenIds = new Set<number>();
  const seenTexts = new Map<string, number>(); // text -> first ID seen

  const validDifficulties: Set<DifficultyLevel> = new Set(["Dễ", "Trung bình", "Khó", "Rất khó"]);

  questions.forEach(q => {
    const textSummary = q.question.length > 50 ? q.question.substring(0, 50) + "..." : q.question;

    // 1. Unique ID Validation
    if (seenIds.has(q.id)) {
      errors.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "id",
        severity: "error",
        message: `Trùng lặp mã định danh câu hỏi (Duplicate Question ID: ${q.id})`
      });
    } else {
      seenIds.add(q.id);
    }

    // 2. Duplicate Question Text Validation
    const cleanText = q.question.trim().toLowerCase().replace(/\s+/g, " ");
    if (seenTexts.has(cleanText)) {
      const originalId = seenTexts.get(cleanText)!;
      warnings.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "question",
        severity: "warning",
        message: `Trùng lặp nội dung câu hỏi với câu hỏi mã ${originalId}`
      });
    } else {
      seenTexts.set(cleanText, q.id);
    }

    // 3. Chapter Validation
    if (!chapterIds.has(q.chapterId)) {
      errors.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "chapterId",
        severity: "error",
        message: `Mã chương chapterId [${q.chapterId}] không tồn tại trong danh mục chapters.`
      });
    }

    // 4. Topic Validation
    if (!topicIdToChapter.has(q.topicId)) {
      errors.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "topicId",
        severity: "error",
        message: `Mã chủ đề topicId ["${q.topicId}"] không tồn tại trong danh mục topics.`
      });
    } else {
      // 5. Parent-Child Relationship Validation (Topic must belong to the correct Chapter)
      const expectedChapterId = topicIdToChapter.get(q.topicId);
      if (expectedChapterId !== q.chapterId) {
        errors.push({
          questionId: q.id,
          questionTextSummary: textSummary,
          field: "chapterId/topicId",
          severity: "error",
          message: `Mâu thuẫn quan hệ cha-con: Chủ đề ["${q.topicId}"] thuộc chương ${expectedChapterId}, nhưng câu hỏi lại khai báo chương ${q.chapterId}.`
        });
      }
    }

    // 6. Difficulty validation
    if (!validDifficulties.has(q.difficulty)) {
      errors.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "difficulty",
        severity: "error",
        message: `Mức độ khó ["${q.difficulty}"] không hợp lệ. Phải là một trong: "Dễ", "Trung bình", "Khó", "Rất khó".`
      });
    }

    // 7. Difficulty Rating Validation
    if (typeof q.difficultyRating !== "number" || q.difficultyRating < 1 || q.difficultyRating > 5) {
      warnings.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "difficultyRating",
        severity: "warning",
        message: `Độ khó đánh giá difficultyRating [${q.difficultyRating}] nên nằm trong khoảng từ 1 đến 5.`
      });
    }

    // 8. Options Integrity Validation
    if (!q.options || typeof q.options !== "object") {
      errors.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "options",
        severity: "error",
        message: "Không tìm thấy hoặc sai cấu trúc đối tượng phương án lựa chọn options."
      });
    } else {
      const keys: Array<"a" | "b" | "c" | "d"> = ["a", "b", "c", "d"];
      const optionTexts = new Set<string>();

      keys.forEach(k => {
        const optVal = q.options[k];
        if (typeof optVal !== "string" || optVal.trim() === "") {
          errors.push({
            questionId: q.id,
            questionTextSummary: textSummary,
            field: `options.${k}`,
            severity: "error",
            message: `Phương án [${k.toUpperCase()}] bị rỗng hoặc không phải là chuỗi.`
          });
        } else {
          const cleanOpt = optVal.trim().toLowerCase();
          if (optionTexts.has(cleanOpt)) {
            warnings.push({
              questionId: q.id,
              questionTextSummary: textSummary,
              field: "options",
              severity: "warning",
              message: `Phát hiện phương án trùng lặp nội dung trong cùng câu hỏi: "${optVal}"`
            });
          }
          optionTexts.add(cleanOpt);
        }
      });
    }

    // 9. Correct Answer Validation
    if (!["a", "b", "c", "d"].includes(q.correctAnswer)) {
      errors.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "correctAnswer",
        severity: "error",
        message: `Đáp án correctAnswer ["${q.correctAnswer}"] không hợp lệ. Phải là "a", "b", "c" hoặc "d".`
      });
    }

    // 10. Explanation Integrity Validation
    if (!q.explanation || q.explanation.trim() === "") {
      errors.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "explanation",
        severity: "error",
        message: "Nội dung lời giải chi tiết explanation không được để trống."
      });
    } else if (q.explanation.trim().length < 15) {
      warnings.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "explanation",
        severity: "warning",
        message: `Nội dung lời giải chi tiết quá ngắn (${q.explanation.trim().length} ký tự).`
      });
    }

    // 11. Estimated Time Validation
    if (typeof q.estimatedTime !== "number" || q.estimatedTime <= 0) {
      warnings.push({
        questionId: q.id,
        questionTextSummary: textSummary,
        field: "estimatedTime",
        severity: "warning",
        message: `Thời gian ước tính làm bài estimatedTime [${q.estimatedTime}] phải lớn hơn 0.`
      });
    }
  });

  // Check for any topics without questions
  const topicsWithQuestions = new Set(questions.map(q => q.topicId));
  const unmappedTopics = topics
    .map(t => t.id)
    .filter(tId => !topicsWithQuestions.has(tId));

  const isValid = errors.length === 0;

  return {
    totalQuestions: questions.length,
    totalChapters: chapters.length,
    totalTopics: topics.length,
    isValid,
    errors,
    warnings,
    duplicateQuestionsDetected: warnings.filter(w => w.field === "question").length,
    unmappedTopics
  };
}
