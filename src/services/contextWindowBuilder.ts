/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvidenceSet, ReasoningContext } from "./evidencePipeline";
import { StudentModel } from "./learnerModel";
import { LearningPlan } from "./learningPlanner";
import { Question } from "../types";
import { conceptMemoryService } from "./conceptMemoryService";
import { kbService } from "./kbService";
import { dbService } from "./db";

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
    /** Mã môn, để tra đồ thị tri thức đúng môn. Thiếu thì rơi về môn đang mở. */
    subjectId?: string;
    question: Question;
    selectedAnswer: string;
    evidence: EvidenceSet;
    reasoning: ReasoningContext;
    learningPlan: LearningPlan;
    studentModel: StudentModel;
    crossSubject?: { connectedSubject: string; topic: string; explanation: string } | null;
  }): CompressedContext {
    const { question, selectedAnswer, evidence, reasoning, learningPlan, studentModel, crossSubject, subjectId } = params;

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

    // Hiệu chuẩn nhận thức của CHÍNH khái niệm này, suy từ nút cờ nghi vấn người học tự bấm.
    // Ba trạng thái đòi ba cách dạy khác hẳn nhau, nên đáng đưa vào lời nhắc:
    //   - thừa tự tin: người học không hề nghi ngờ mà vẫn sai, nên sẽ KHÔNG tự ôn lại phần này
    //   - thiếu tự tin: đã làm đúng nhưng vẫn tự đánh dấu, cần được khẳng định chỗ đã nắm chắc
    //   - chưa đủ dữ liệu: im lặng không phải bằng chứng, không nói gì thêm về mức chắc chắn
    const hieuChuanKhaiNiem = conceptProfile.calibrationState;
    const moTaHieuChuan =
      hieuChuanKhaiNiem === "overconfident"
        ? "Thừa tự tin ở khái niệm này (thường không tự đánh dấu nghi vấn nhưng vẫn trả lời sai), cần chỉ rõ chỗ hiểu lệch thay vì chỉ khen"
        : hieuChuanKhaiNiem === "underconfident"
          ? "Thiếu tự tin ở khái niệm này (hay tự đánh dấu nghi vấn dù trả lời đúng), nên khẳng định lại phần đã nắm chắc"
          : hieuChuanKhaiNiem === "calibrated"
            ? "Tự đánh giá khớp với kết quả thật"
            : "Chưa đủ dữ liệu để nói về mức tự tin";

    const studentSummary = [
      `Mức độ tinh thông hiện tại: ${mastery}% (Đỉnh lịch sử: ${conceptProfile.historicalPeak}%)`,
      `Độ ghi nhớ (Retention): ${Math.round(conceptProfile.retentionScore * 100)}%`,
      `Trạng thái: ${conceptProfile.isStableMastered ? "Đắc thụ Ổn định (Stable)" : conceptProfile.isRegressionDetected ? "Giảm sút (Regression)" : "Đang tiến bộ"}`,
      `Số lần ôn tập: ${conceptProfile.timesStudied}`,
      `Phong cách giảng dạy đề xuất: ${rotatedStrategy}`,
      `Chỉ số mệt mỏi nhận thức: ${fatigue}%`,
      `Xu hướng đoán mò: ${guessFreq > 0.3 ? "Có khả năng" : "Thấp"}`,
      `Hiệu chuẩn tự đánh giá: ${moTaHieuChuan}`
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

    // 5. Compress Misconception context.
    //
    // Thứ tự ưu tiên, từ cụ thể nhất tới chung nhất:
    //   1. Hiểu sai phát hiện được từ chính lựa chọn của người học.
    //   2. Bẫy hiểu sai của câu hỏi, nếu ngân hàng có điền.
    //   3. Bẫy hiểu sai BIÊN SOẠN TAY ở tầng khái niệm, tra qua đồ thị tri thức.
    //   4. Câu chung chung, chỉ dùng khi ba nguồn trên đều không có.
    //
    // Trước 27/07/2026 chỉ có bước 1, 2 và 4. Mà bước 2 rỗng ở 292/292 câu, nên thực tế gia sư
    // AI luôn nhận đúng một câu chung chung. Bổ sung bước 3 lấy được dữ liệu thật cho toàn bộ
    // ngân hàng. Xem `kbService.layCanhBaoBayHocThuat` để biết vì sao nút tổng hợp bị loại.
    const bayTheoCauHoi = String(question.misconception || "").trim();
    const bayTheoKhaiNiem = bayTheoCauHoi
      ? ""
      : (kbService.layCanhBaoBayHocThuat(subjectId || dbService.getActiveSubjectId(), question) || "");
    const bayPhoBien = bayTheoCauHoi || bayTheoKhaiNiem
      || "Cần phân biệt rõ bản chất khái niệm với các biểu hiện bề ngoài.";

    const misconceptionsSummary = reasoning.detectedMisconception.hasMisconception
      ? `Phát hiện hiểu sai: ${reasoning.detectedMisconception.description}`
      : `Cảnh báo bẫy phổ biến: ${bayPhoBien}`;

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
