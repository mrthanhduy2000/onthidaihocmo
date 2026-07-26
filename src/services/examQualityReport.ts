/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question, ExamSpecification, ExamAttempt } from "../types";
import { contentQualityAssurance, QuestionQualityProfile } from "./contentQualityAssurance";
import { chapters } from "./db";

export interface AcademicRiskCallout {
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "BLOOM_DISBALANCE" | "CHAPTER_BIAS" | "UNGROUNDED_CONTENT" | "DUPLICATE_QUESTION" | "EXPLANATION_GAP";
  title: string;
  description: string;
}

export interface ExamQualityReport {
  examId: string;
  totalQuestions: number;
  chapterCoveragePct: number;
  bloomDistribution: Record<string, { count: number; percentage: number }>;
  difficultyDistribution: Record<string, { count: number; percentage: number }>;
  chapterBalanceScore: number;     // 0 - 100
  conceptBalanceScore: number;     // 0 - 100
  questionDiversityScore: number;  // 0 - 100
  averageQualityScore: number;     // 0 - 100
  gatePassRatePct: number;         // 0 - 100
  estimatedExamReliability: number;// 0.00 - 1.00 (e.g. 0.88 Cronbach's Alpha equivalent)
  potentialRisks: AcademicRiskCallout[];
  recommendations: string[];
  questionProfiles: QuestionQualityProfile[];
  generatedAt: string;
}

export const examQualityReportService = {
  /**
   * Generates a comprehensive Academic Exam Quality Report for a list of questions or an exam attempt/spec.
   */
  generateReport(questions: Question[], examId: string = "EXAM-REPORT-001"): ExamQualityReport {
    if (!questions || questions.length === 0) {
      return {
        examId,
        totalQuestions: 0,
        chapterCoveragePct: 0,
        bloomDistribution: {},
        difficultyDistribution: {},
        chapterBalanceScore: 0,
        conceptBalanceScore: 0,
        questionDiversityScore: 0,
        averageQualityScore: 0,
        gatePassRatePct: 0,
        estimatedExamReliability: 0,
        potentialRisks: [{
          level: "CRITICAL",
          category: "CHAPTER_BIAS",
          title: "Đề thi trống",
          description: "Chưa có câu hỏi nào trong đề thi để tiến hành kiểm định chất lượng."
        }],
        recommendations: ["Thêm câu hỏi vào đề thi để tạo báo cáo chất lượng."],
        questionProfiles: [],
        generatedAt: new Date().toISOString()
      };
    }

    // 1. Audit individual questions
    const profiles = questions.map(q => contentQualityAssurance.auditQuestion(q, questions));

    // 2. Calculate average quality score & gate pass rate
    const totalQuality = profiles.reduce((acc, p) => acc + p.metrics.overallScore, 0);
    const averageQualityScore = Math.round(totalQuality / questions.length);

    const passingCount = profiles.filter(p => p.gatePassed).length;
    const gatePassRatePct = Math.round((passingCount / questions.length) * 100);

    // 3. Bloom & Difficulty Distributions
    const bloomCounts: Record<string, number> = {};
    const diffCounts: Record<string, number> = {};
    const chapterCounts: Record<number, number> = {};
    const conceptSet = new Set<string>();

    questions.forEach(q => {
      const bloom = q.bloomLevel || "Remember";
      bloomCounts[bloom] = (bloomCounts[bloom] || 0) + 1;

      const diff = q.difficulty || "Trung bình";
      diffCounts[diff] = (diffCounts[diff] || 0) + 1;

      const ch = q.chapterId || 1;
      chapterCounts[ch] = (chapterCounts[ch] || 0) + 1;

      if (q.concept) conceptSet.add(q.concept);
    });

    const bloomDistribution: Record<string, { count: number; percentage: number }> = {};
    Object.entries(bloomCounts).forEach(([b, c]) => {
      bloomDistribution[b] = { count: c, percentage: Math.round((c / questions.length) * 100) };
    });

    const difficultyDistribution: Record<string, { count: number; percentage: number }> = {};
    Object.entries(diffCounts).forEach(([d, c]) => {
      difficultyDistribution[d] = { count: c, percentage: Math.round((c / questions.length) * 100) };
    });

    // 4. Balance Scores & Reliability
    const uniqueChaptersCount = Object.keys(chapterCounts).length;
    // Mẫu số phải là SỐ CHƯƠNG THẬT của môn đang mở. Bản cũ chia cho 6 kèm chú thích "assuming
    // 6 standard chapters", trong khi môn đang học có 7 chương, nên một đề phủ đủ cả 7 chương
    // được báo là **117% độ phủ**. Sang môn khác thì con số còn lệch tùy tiện hơn nữa.
    const tongSoChuong = Math.max(1, chapters.length);
    const chapterCoveragePct = Math.min(100, Math.round((uniqueChaptersCount / tongSoChuong) * 100));
    const chapterBalanceScore = Math.min(100, Math.round(chapterCoveragePct * 0.9 + (uniqueChaptersCount > 2 ? 10 : 0)));

    const conceptBalanceScore = Math.min(100, Math.round((conceptSet.size / Math.max(1, questions.length * 0.7)) * 100));
    const questionDiversityScore = Math.min(100, Math.round((conceptBalanceScore * 0.5) + (chapterBalanceScore * 0.5)));

    // Estimated reliability (Cronbach's alpha proxy score: 0.75 - 0.95 range)
    const baseReliability = 0.70 + (questions.length * 0.008) + (averageQualityScore * 0.0015);
    const estimatedExamReliability = Number(Math.min(0.96, Math.max(0.60, baseReliability)).toFixed(2));

    // 5. Identify Potential Risks
    const potentialRisks: AcademicRiskCallout[] = [];
    const recommendations: string[] = [];

    // Risk: Bloom imbalance (e.g. > 70% Remember)
    const rememberPct = bloomDistribution["Remember"]?.percentage || 0;
    if (rememberPct > 60) {
      potentialRisks.push({
        level: "HIGH",
        category: "BLOOM_DISBALANCE",
        title: "Lệch thang đo Bloom (Tỷ lệ Nhận biết quá cao)",
        description: `${rememberPct}% câu hỏi thuộc mức Nhận biết. Nên bổ sung câu hỏi Vận dụng và Phân tích.`
      });
      recommendations.push("Bổ sung ít nhất 3 câu hỏi cấp độ Apply/Analyze để nâng cao độ phân hóa của đề thi.");
    }

    // Risk: Chapter bias
    const maxChapterCount = Math.max(...Object.values(chapterCounts));
    if (maxChapterCount / questions.length > 0.5 && questions.length > 5) {
      potentialRisks.push({
        level: "MEDIUM",
        category: "CHAPTER_BIAS",
        title: "Phân bổ chương chưa đồng đều",
        description: "Hơn 50% số câu hỏi tập trung vào duy nhất một chương."
      });
      recommendations.push("Cân bằng số lượng câu hỏi giữa các chương theo ma trận đề thi chuẩn.");
    }

    // Risk: Ungrounded / Evidence missing
    const missingEvidenceCount = profiles.filter(p => p.gateViolations.some(v => v.gate === "EVIDENCE_MISSING")).length;
    if (missingEvidenceCount > 0) {
      potentialRisks.push({
        level: "CRITICAL",
        category: "UNGROUNDED_CONTENT",
        title: "Thiếu căn cứ giáo trình",
        description: `Có ${missingEvidenceCount} câu hỏi chưa có trích dẫn nguồn trang/chương giáo trình cụ thể.`
      });
      recommendations.push("Cập nhật nguồn trích dẫn giáo trình (Source PDF / Page) cho toàn bộ các câu hỏi chưa gắn căn cứ.");
    }

    // Risk: Near duplicates
    const duplicateCount = profiles.filter(p => p.duplicateAnalysis.hasNearDuplicate || p.duplicateAnalysis.hasDuplicate).length;
    if (duplicateCount > 0) {
      potentialRisks.push({
        level: "HIGH",
        category: "DUPLICATE_QUESTION",
        title: "Phát hiện câu hỏi trùng lặp",
        description: `Có ${duplicateCount} câu hỏi có nội dung xấp xỉ hoặc trùng lặp với câu khác trong ngân hàng.`
      });
      recommendations.push("Thay thế hoặc biên tập lại các câu hỏi bị trùng lặp ý nghĩa.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Đề thi đạt tiêu chuẩn chất lượng học thuật cao. Sẵn sàng sử dụng cho học viên.");
    }

    return {
      examId,
      totalQuestions: questions.length,
      chapterCoveragePct,
      bloomDistribution,
      difficultyDistribution,
      chapterBalanceScore,
      conceptBalanceScore,
      questionDiversityScore,
      averageQualityScore,
      gatePassRatePct,
      estimatedExamReliability,
      potentialRisks,
      recommendations,
      questionProfiles: profiles,
      generatedAt: new Date().toISOString()
    };
  }
};
