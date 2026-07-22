/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question, DifficultyLevel } from "../types";
import { chapters } from "../data/chapters";
import { topics } from "../data/topics";
import { TimeService } from "./time";

export interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  processedQuestions: Question[];
  reports: {
    questionId?: number;
    questionText?: string;
    status: "success" | "warning" | "error";
    messages: string[];
  }[];
}

/**
 * Standardized Import Pipeline to parse, validate, sanitize, and normalize raw questions.
 * Allows effortless content additions (e.g., from CSV, JSON, or spreadsheets) without changing system logic.
 */
export function importQuestions(rawItems: any[]): ImportResult {
  const processedQuestions: Question[] = [];
  const reports: ImportResult["reports"] = [];
  let importedCount = 0;
  let skippedCount = 0;

  const validDifficulties: Set<DifficultyLevel> = new Set(["Dễ", "Trung bình", "Khó", "Rất khó"]);
  const chapterIds = new Set(chapters.map(c => c.id));
  const topicIdToChapter = new Map(topics.map(t => [t.id, t.chapterId]));

  rawItems.forEach((item, index) => {
    const messages: string[] = [];
    let hasError = false;
    let hasWarning = false;

    // Determine a fallback identifier for reporting
    const tempId = item.id ? Number(item.id) : (index + 1000);
    const textSummary = item.question ? (item.question.length > 40 ? item.question.substring(0, 40) + "..." : item.question) : `[Câu hỏi không tên dòng #${index}]`;

    // 1. Mandatory Field Verification
    if (!item.question || typeof item.question !== "string" || item.question.trim() === "") {
      messages.push("LỖI: Nội dung câu hỏi 'question' bị rỗng hoặc không đúng định dạng.");
      hasError = true;
    }

    if (!item.options || typeof item.options !== "object") {
      messages.push("LỖI: Thiếu đối tượng phương án 'options' hoặc không đúng định dạng.");
      hasError = true;
    } else {
      const optionKeys = ["a", "b", "c", "d"];
      optionKeys.forEach(k => {
        if (!item.options[k] || typeof item.options[k] !== "string" || item.options[k].trim() === "") {
          messages.push(`LỖI: Phương án '${k.toUpperCase()}' bị rỗng hoặc không đúng định dạng.`);
          hasError = true;
        }
      });
    }

    const cleanAnswer = item.correctAnswer ? item.correctAnswer.toString().trim().toLowerCase() : "";
    if (!["a", "b", "c", "d"].includes(cleanAnswer)) {
      messages.push(`LỖI: Đáp án đúng 'correctAnswer' ["${item.correctAnswer}"] phải là 'a', 'b', 'c', hoặc 'd'.`);
      hasError = true;
    }

    const chId = Number(item.chapterId);
    if (isNaN(chId) || !chapterIds.has(chId)) {
      messages.push(`LỖI: Mã chương 'chapterId' [${item.chapterId}] không tồn tại.`);
      hasError = true;
    }

    const tId = item.topicId ? item.topicId.toString().trim() : "";
    if (!topicIdToChapter.has(tId)) {
      messages.push(`LỖI: Mã chủ đề 'topicId' ["${item.topicId}"] không tồn tại.`);
      hasError = true;
    } else {
      const expectedChId = topicIdToChapter.get(tId);
      if (expectedChId !== chId) {
        messages.push(`LỖI: Chủ đề ["${tId}"] thuộc chương ${expectedChId}, nhưng câu hỏi khai báo chương ${chId}.`);
        hasError = true;
      }
    }

    // 2. Normalization & Sanitization
    let difficulty: DifficultyLevel = "Trung bình";
    if (item.difficulty && validDifficulties.has(item.difficulty)) {
      difficulty = item.difficulty as DifficultyLevel;
    } else {
      messages.push(`CẢNH BÁO: Độ khó ["${item.difficulty}"] không hợp lệ. Hệ thống tự động chuyển thành "Trung bình".`);
      hasWarning = true;
    }

    let difficultyRating = item.difficultyRating ? Number(item.difficultyRating) : 3;
    if (isNaN(difficultyRating) || difficultyRating < 1 || difficultyRating > 5) {
      difficultyRating = difficulty === "Dễ" ? 2 : difficulty === "Trung bình" ? 3 : difficulty === "Khó" ? 4 : 5;
      messages.push(`CẢNH BÁO: Đánh giá số sao độ khó không hợp lệ. Hệ thống tự gán: ${difficultyRating} sao.`);
      hasWarning = true;
    }

    let explanation = item.explanation ? item.explanation.toString().trim() : "";
    if (explanation === "") {
      explanation = `Đáp án đúng là ${cleanAnswer.toUpperCase()} dựa trên nội dung lý thuyết chính thức chương ${chId}.`;
      messages.push("CẢNH BÁO: Lời giải thích trống. Hệ thống tự động điền lời giải mặc định.");
      hasWarning = true;
    }

    // Standardize metadata fields
    const sourcePdf = item.sourcePdf ? item.sourcePdf.toString().trim() : "FULL CHƯƠNG.pdf";
    const sourcePage = item.sourcePage !== undefined ? item.sourcePage : "Chưa xác định";
    const knowledgeMapping = Array.isArray(item.knowledgeMapping) ? item.knowledgeMapping.map((k: any) => k.toString().trim()) : [];
    const relatedQuestions = Array.isArray(item.relatedQuestions) ? item.relatedQuestions.map((id: any) => Number(id)).filter(id => !isNaN(id)) : [];
    const estimatedTime = item.estimatedTime ? Number(item.estimatedTime) : 45;
    const learningObjective = item.learningObjective ? item.learningObjective.toString().trim() : "Nắm vững lý thuyết trọng tâm.";

    // Generated Fields (Audit & Expansion)
    const questionCode = item.questionCode ? item.questionCode.toString().trim() : `POLI-CH${chId}-Q${tempId}`;
    const createdAt = item.createdAt ? item.createdAt.toString().trim() : TimeService.now().toISOString();
    const updatedAt = TimeService.now().toISOString();
    const version = item.version ? Number(item.version) : 1;
    const tags = Array.isArray(item.tags) ? item.tags : knowledgeMapping;

    // 3. Assemble Normalized Question if no error
    if (hasError) {
      skippedCount++;
      reports.push({
        questionId: tempId,
        questionText: textSummary,
        status: "error",
        messages
      });
    } else {
      const normalizedQuestion: Question = {
        id: tempId,
        question: item.question.trim(),
        options: {
          a: item.options.a.trim(),
          b: item.options.b.trim(),
          c: item.options.c.trim(),
          d: item.options.d.trim()
        },
        correctAnswer: cleanAnswer as "a" | "b" | "c" | "d",
        chapterId: chId,
        topicId: tId,
        difficulty,
        difficultyRating,
        explanation,
        sourcePdf,
        sourcePage,
        knowledgeMapping,
        relatedQuestions,
        estimatedTime,
        questionType: "multiple-choice",
        learningObjective,
        // Audit and expansion fields
        questionCode,
        createdAt,
        updatedAt,
        version,
        tags
      };

      processedQuestions.push(normalizedQuestion);
      importedCount++;
      reports.push({
        questionId: tempId,
        questionText: textSummary,
        status: hasWarning ? "warning" : "success",
        messages: messages.length > 0 ? messages : ["Hợp lệ và sẵn sàng tích hợp."]
      });
    }
  });

  return {
    success: processedQuestions.length > 0,
    importedCount,
    skippedCount,
    processedQuestions,
    reports
  };
}
