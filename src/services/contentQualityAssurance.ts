/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question } from "../types";
import { questionDuplicateDetector, DuplicateDetectionResult } from "./questionDuplicateDetector";

export interface ExplanationAuditResult {
  explainsCorrectAnswer: boolean;
  explainsDistractors: boolean;
  citesEvidence: boolean;
  usesExternalKnowledge: boolean;
  containsAmbiguousTerms: boolean;
  score: number; // 0 - 100
  feedback: string[];
}

export interface QuestionQualityMetrics {
  conceptCorrectness: number;     // 0 - 100
  evidenceCompleteness: number;   // 0 - 100
  answerUniqueness: number;       // 0 - 100
  distractorPlausibility: number; // 0 - 100
  bloomAlignment: number;         // 0 - 100
  difficultyConsistency: number;  // 0 - 100
  citationCompleteness: number;   // 0 - 100
  explanationCompleteness: number;// 0 - 100
  languageClarity: number;        // 0 - 100
  overallScore: number;           // 0 - 100
}

export interface QuestionVersionInfo {
  questionVersion: string;
  generatorVersion: string;
  knowledgeBaseVersion: string;
  evidenceVersion: string;
  reviewVersion: string;
  policyVersion: string;
}

export interface GateViolation {
  gate: "GROUNDING" | "ANSWER_UNIQUENESS" | "EVIDENCE_MISSING" | "DUPLICATE_DETECTED";
  message: string;
  severity: "CRITICAL" | "HIGH";
}

export interface HumanReviewStatus {
  status: "APPROVED" | "NEEDS_REVISION" | "REJECTED" | "PENDING";
  reviewerNotes?: string;
  reviewedAt?: string;
}

export interface QuestionQualityProfile {
  questionId: number;
  metrics: QuestionQualityMetrics;
  explanationAudit: ExplanationAuditResult;
  duplicateAnalysis: DuplicateDetectionResult;
  gatePassed: boolean;
  gateViolations: GateViolation[];
  versionInfo: QuestionVersionInfo;
  humanReview: HumanReviewStatus;
  academicLanguageIssues: string[];
}

// In-memory human review storage map
const humanReviewsStore = new Map<number, HumanReviewStatus>();

export const contentQualityAssurance = {
  /**
   * Audits a question's explanation for academic clarity and evidence citation.
   */
  auditExplanation(q: Question): ExplanationAuditResult {
    const exp = q.explanation || "";
    const feedback: string[] = [];

    const explainsCorrectAnswer = exp.length > 20 && (
      exp.toLowerCase().includes("đúng") || 
      exp.toLowerCase().includes("chính xác") || 
      exp.toLowerCase().includes("vì") ||
      exp.toLowerCase().includes("do đó")
    );

    const explainsDistractors = (
      exp.toLowerCase().includes("sai") || 
      exp.toLowerCase().includes("không phải") || 
      exp.toLowerCase().includes("loại trừ") ||
      exp.toLowerCase().includes("các phương án còn lại")
    );

    const citesEvidence = (
      (q.sourcePdf && q.sourcePdf.length > 0) ||
      exp.toLowerCase().includes("trang") ||
      exp.toLowerCase().includes("chương") ||
      exp.toLowerCase().includes("giáo trình") ||
      exp.toLowerCase().includes("theo")
    );

    // Simple heuristic for external knowledge without citation
    const usesExternalKnowledge = exp.toLowerCase().includes("ngoài ra") && !citesEvidence;

    const ambiguousWords = ["có thể đúng", "tùy trường hợp", "đôi khi", "nói chung", "mơ hồ"];
    const containsAmbiguousTerms = ambiguousWords.some(w => exp.toLowerCase().includes(w));

    let score = 50;
    if (explainsCorrectAnswer) score += 20;
    if (explainsDistractors) score += 15;
    if (citesEvidence) score += 15;
    if (containsAmbiguousTerms) score -= 15;
    if (usesExternalKnowledge) score -= 10;

    score = Math.max(0, Math.min(100, score));

    if (!explainsCorrectAnswer) feedback.push("Lời giải chưa giải thích rõ vì sao đáp án chọn là đúng.");
    if (!explainsDistractors) feedback.push("Lời giải chưa làm rõ lý do các phương án nhiễu bị loại trừ.");
    if (!citesEvidence) feedback.push("Chưa dẫn nguồn trang/chương giáo trình cụ thể.");
    if (containsAmbiguousTerms) feedback.push("Lời giải chứa thuật ngữ mơ hồ hoặc chưa khẳng định chắc chắn.");

    return {
      explainsCorrectAnswer,
      explainsDistractors,
      citesEvidence,
      usesExternalKnowledge,
      containsAmbiguousTerms,
      score,
      feedback
    };
  },

  /**
   * Reviews language for academic rigor and readability issues.
   */
  reviewAcademicLanguage(q: Question): string[] {
    const issues: string[] = [];
    const text = q.question || "";

    if (text.length > 200) {
      issues.push("Thân câu hỏi quá dài (> 200 ký tự), dễ gây quá tải nhận thức.");
    }

    if ((text.match(/không/g) || []).length >= 2) {
      issues.push("Phát hiện câu chứa phủ định kép (dùng nhiều từ 'không'), dễ gây nhầm lẫn.");
    }

    const vagueTerms = ["thường là", "hầu như", "đôi khi", "vân vân", "etc"];
    vagueTerms.forEach(term => {
      if (text.toLowerCase().includes(term)) {
        issues.push(`Từ ngữ mơ hồ '${term}' xuất hiện trong câu hỏi.`);
      }
    });

    // Check options for distinctness and length consistency
    const opts = Object.values(q.options || {});
    if (opts.some(o => !o || o.trim().length === 0)) {
      issues.push("Có lựa chọn đáp án bị trống.");
    }

    const uniqueOpts = new Set(opts.map(o => o.trim().toLowerCase()));
    if (uniqueOpts.size < opts.length) {
      issues.push("Các lựa chọn đáp án bị trùng lặp nội dung.");
    }

    return issues;
  },

  /**
   * Evaluates quality metrics and performs strict Quality Gate checks on a single question.
   */
  auditQuestion(q: Question, pool: Question[] = []): QuestionQualityProfile {
    const expAudit = this.auditExplanation(q);
    const dupResult = questionDuplicateDetector.checkQuestionDuplicates(q, pool);
    const langIssues = this.reviewAcademicLanguage(q);

    // Calculate component scores
    const hasEvidence = Boolean(q.sourcePdf && String(q.sourcePage));
    const evidenceCompleteness = hasEvidence ? 100 : 30;

    const opts = Object.values(q.options || {});
    const uniqueOptsCount = new Set(opts.map(o => o.trim().toLowerCase())).size;
    const answerUniqueness = uniqueOptsCount === 4 && ["a", "b", "c", "d"].includes(q.correctAnswer) ? 100 : 0;

    const distractorPlausibility = opts.length === 4 && opts.every(o => o.length >= 3) ? 90 : 50;
    const bloomAlignment = q.bloomLevel ? 95 : 75;
    const difficultyConsistency = q.estimatedTime > 0 ? 90 : 60;
    const citationCompleteness = expAudit.citesEvidence ? 100 : 40;
    const conceptCorrectness = q.concept || (q.knowledgeMapping && q.knowledgeMapping.length > 0) ? 95 : 70;
    const languageClarity = Math.max(20, 100 - (langIssues.length * 20));

    const overallScore = Math.round(
      conceptCorrectness * 0.15 +
      evidenceCompleteness * 0.15 +
      answerUniqueness * 0.20 +
      distractorPlausibility * 0.10 +
      bloomAlignment * 0.10 +
      expAudit.score * 0.15 +
      languageClarity * 0.15
    );

    // Quality Gates Evaluation
    const gateViolations: GateViolation[] = [];

    // Gate 1: Grounding / Evidence missing
    if (!hasEvidence) {
      gateViolations.push({
        gate: "EVIDENCE_MISSING",
        message: "Chưa dẫn nguồn giáo trình (sourcePdf/sourcePage bị thiếu).",
        severity: "CRITICAL"
      });
    }

    // Gate 2: Answer uniqueness
    if (answerUniqueness < 100) {
      gateViolations.push({
        gate: "ANSWER_UNIQUENESS",
        message: "Phương án trả lời bị trùng lặp hoặc không đạt chuẩn 4 lựa chọn duy nhất.",
        severity: "CRITICAL"
      });
    }

    // Gate 3: Duplicate detected
    if (dupResult.hasDuplicate) {
      gateViolations.push({
        gate: "DUPLICATE_DETECTED",
        message: `Phát hiện câu hỏi trùng lặp 100% với câu ID #${dupResult.matches[0]?.questionId}.`,
        severity: "CRITICAL"
      });
    }

    // Grounding threshold gate check from metadata if present
    const grounding = q.metadata?.groundingScore ?? 85;
    if (grounding < 70) {
      gateViolations.push({
        gate: "GROUNDING",
        message: `Độ căn cứ tài liệu (Grounding score: ${grounding}%) dưới ngưỡng cho phép (70%).`,
        severity: "CRITICAL"
      });
    }

    const gatePassed = gateViolations.length === 0;

    // Versioning Info
    const versionInfo: QuestionVersionInfo = {
      questionVersion: `v${q.version || 1}.0`,
      generatorVersion: q.metadata?.generatorVersion || "AI-GenEngine-v3.6",
      knowledgeBaseVersion: "KB-2026.07-POLI",
      evidenceVersion: "EVD-v1.0-AUTH",
      reviewVersion: "REV-1.0-STND",
      policyVersion: "POL-2026.1-STRICT"
    };

    // Human Review status
    const storedReview = humanReviewsStore.get(q.id) || {
      status: "PENDING"
    };

    return {
      questionId: q.id,
      metrics: {
        conceptCorrectness,
        evidenceCompleteness,
        answerUniqueness,
        distractorPlausibility,
        bloomAlignment,
        difficultyConsistency,
        citationCompleteness,
        explanationCompleteness: expAudit.score,
        languageClarity,
        overallScore
      },
      explanationAudit: expAudit,
      duplicateAnalysis: dupResult,
      gatePassed,
      gateViolations,
      versionInfo,
      humanReview: storedReview,
      academicLanguageIssues: langIssues
    };
  },

  /**
   * Human Review Support: Approves, requests revision, or rejects a question.
   */
  updateHumanReview(questionId: number, status: "APPROVED" | "NEEDS_REVISION" | "REJECTED", reviewerNotes?: string): HumanReviewStatus {
    const record: HumanReviewStatus = {
      status,
      reviewerNotes,
      reviewedAt: new Date().toISOString()
    };
    humanReviewsStore.set(questionId, record);
    return record;
  }
};
