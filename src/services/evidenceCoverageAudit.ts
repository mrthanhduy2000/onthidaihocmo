/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { kbService, KnowledgeNode } from "./kbService";
import { questions, dbService } from "./db";
import { Question } from "../types";
import { contentQualityAssurance } from "./contentQualityAssurance";
import { questionDuplicateDetector } from "./questionDuplicateDetector";

export interface ConceptCoverageDetail {
  conceptId: string;
  conceptName: string;
  chapterId: number;
  questionCount: number;
  questionIds: number[];
  usedBloomLevels: string[];
  missingBloomLevels: string[];
  usedBlueprints: string[];
  unexploitedEvidence: string[];
  coverageStatus: "FULL" | "PARTIAL" | "UNEXPLOITED";
}

export interface CoverageMatrixEntry {
  concept: string;
  chapterId: number;
  evidenceSnippet: string;
  blueprintsUsed: string[];
  bloomLevelsUsed: string[];
  questionCount: number;
  questionIds: number[];
}

export interface SubjectHealthOverview {
  subjectId: string;
  coveragePct: number;
  totalQuestions: number;
  totalConcepts: number;
  unexploitedEvidenceCount: number;
  weakDistractorCount: number;
  duplicateQuestionCount: number;
  averageQualityScore: number;
  missingConcepts: string[];
  blueprintUsage: Record<string, number>;
  bloomUsage: Record<string, number>;
  generatedAt: string;
}

export const evidenceCoverageAuditService = {
  /**
   * Soát độ phủ bằng chứng và tri thức của một môn.
   *
   * Mặc định phải là MÔN ĐANG MỞ, không phải một mã môn viết cứng.
   *
   * Bản cũ đặt `subjectId: string = "customer_behavior"`, mà cả ba nơi gọi trong
   * `AcademicQualityDashboard.tsx` đều gọi không kèm tham số. Nghĩa là dù Đàm đang mở môn nào,
   * màn Chất lượng học thuật cũng chấm điểm cho môn Hành vi khách hàng, và không có dấu hiệu
   * nào cho thấy nó đang nói về môn khác. Lỗi này chỉ lộ ra khi có từ hai môn trở lên.
   */
  auditSubject(subjectId?: string): {
    healthOverview: SubjectHealthOverview;
    conceptDetails: ConceptCoverageDetail[];
    coverageMatrix: CoverageMatrixEntry[];
  } {
    const monDangMo = subjectId || dbService.getActiveSubjectId();
    const knowledgeNodes: KnowledgeNode[] = kbService.getKnowledgeGraph(monDangMo);
    const pool: Question[] = questions.filter(q => q.questionType === "multiple-choice" || !q.questionType);

    const allBloomLevels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
    const conceptDetails: ConceptCoverageDetail[] = [];
    const coverageMatrix: CoverageMatrixEntry[] = [];

    const blueprintUsage: Record<string, number> = {};
    const bloomUsage: Record<string, number> = {};
    const missingConcepts: string[] = [];

    let totalQuestionReferences = 0;
    let unexploitedEvidenceCount = 0;

    // Audit each knowledge node
    knowledgeNodes.forEach(node => {
      // Find matching questions for this concept
      const matchedQ = pool.filter(q => {
        if (q.concept && q.concept.toLowerCase() === node.concept.toLowerCase()) return true;
        if (q.knowledgeMapping && q.knowledgeMapping.some(k => k.toLowerCase() === node.concept.toLowerCase())) return true;
        return false;
      });

      const questionIds = matchedQ.map(q => q.id);
      const usedBloomLevels = Array.from(new Set(matchedQ.map(q => q.bloomLevel || "Remember")));
      const missingBloomLevels = allBloomLevels.filter(b => !usedBloomLevels.includes(b));
      const usedBlueprints = Array.from(new Set(matchedQ.map(q => q.pedagogicalMetadata?.whyBlueprintSelected || "definition-recall")));

      // Evidence audit
      const unexploitedEvidence: string[] = [];
      const evidenceSnippet = node.definition || `Kiến thức giáo trình CHƯƠNG ${node.chapter}`;

      if (matchedQ.length === 0) {
        unexploitedEvidence.push(evidenceSnippet);
        unexploitedEvidenceCount++;
        missingConcepts.push(node.concept);
      }

      const coverageStatus: "FULL" | "PARTIAL" | "UNEXPLOITED" = 
        matchedQ.length >= 3 && usedBloomLevels.length >= 2 ? "FULL" :
        matchedQ.length > 0 ? "PARTIAL" : "UNEXPLOITED";

      conceptDetails.push({
        conceptId: node.id,
        conceptName: node.concept,
        chapterId: node.chapter,
        questionCount: matchedQ.length,
        questionIds,
        usedBloomLevels,
        missingBloomLevels,
        usedBlueprints,
        unexploitedEvidence,
        coverageStatus
      });

      // Populate coverage matrix
      coverageMatrix.push({
        concept: node.concept,
        chapterId: node.chapter,
        evidenceSnippet,
        blueprintsUsed: usedBlueprints,
        bloomLevelsUsed: usedBloomLevels,
        questionCount: matchedQ.length,
        questionIds
      });

      // Tally usage stats
      matchedQ.forEach(q => {
        const b = q.bloomLevel || "Remember";
        bloomUsage[b] = (bloomUsage[b] || 0) + 1;

        const bp = q.metadata?.blueprintId || "definition-recall";
        blueprintUsage[bp] = (blueprintUsage[bp] || 0) + 1;
      });

      totalQuestionReferences += matchedQ.length;
    });

    // Quality Audit across all pool questions
    let weakDistractorCount = 0;
    let duplicateQuestionCount = 0;
    let totalQualitySum = 0;

    pool.forEach(q => {
      const profile = contentQualityAssurance.auditQuestion(q, pool);
      totalQualitySum += profile.metrics.overallScore;

      if (profile.metrics.distractorPlausibility < 70) {
        weakDistractorCount++;
      }
      if (profile.duplicateAnalysis.hasDuplicate || profile.duplicateAnalysis.hasNearDuplicate) {
        duplicateQuestionCount++;
      }
    });

    const averageQualityScore = pool.length > 0 ? Math.round(totalQualitySum / pool.length) : 0;
    const coveredConceptsCount = knowledgeNodes.length - missingConcepts.length;
    const coveragePct = knowledgeNodes.length > 0 
      ? Math.round((coveredConceptsCount / knowledgeNodes.length) * 100) 
      : 0;

    const healthOverview: SubjectHealthOverview = {
      subjectId: monDangMo,
      coveragePct,
      totalQuestions: pool.length,
      totalConcepts: knowledgeNodes.length,
      unexploitedEvidenceCount,
      weakDistractorCount,
      duplicateQuestionCount,
      averageQualityScore,
      missingConcepts,
      blueprintUsage,
      bloomUsage,
      generatedAt: new Date().toISOString()
    };

    return {
      healthOverview,
      conceptDetails,
      coverageMatrix
    };
  }
};
