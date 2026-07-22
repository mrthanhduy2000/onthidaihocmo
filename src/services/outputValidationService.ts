/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StructuredAIExplanationResponse } from "./aiResponseSchema";
import { CompressedContext } from "./contextWindowBuilder";

export interface QualityScoreReport {
  evidenceCoverage: number;
  citationQuality: number;
  schemaCompleteness: number;
  confidence: number;
  teachingQuality: number;
  overallScore: number;
  isPassed: boolean;
  issuesFound: string[];
}

export const outputValidationService = {
  /**
   * Validates and auto-repairs AI JSON output prior to rendering.
   * Guarantees that the UI never receives malformed, unformatted or incomplete AI data.
   */
  validateAndSanitize(
    rawResponse: any,
    context: CompressedContext
  ): { sanitized: StructuredAIExplanationResponse; report: QualityScoreReport } {
    const issuesFound: string[] = [];
    let parsed: Partial<StructuredAIExplanationResponse> = {};

    if (typeof rawResponse === "string") {
      try {
        const cleanJsonStr = rawResponse
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(cleanJsonStr);
      } catch {
        issuesFound.push("Raw response was not valid JSON format.");
      }
    } else if (typeof rawResponse === "object" && rawResponse !== null) {
      parsed = rawResponse;
    }

    // Check required fields & auto-fill missing values
    const concept = parsed.concept || context.conceptName;
    const definition = parsed.definition || `Khái niệm ${context.conceptName} theo giáo trình chuẩn.`;
    const reasoning = parsed.reasoning || `Đáp án chính xác là ${context.correctAnswerText}.`;
    
    let example = parsed.example || `Ví dụ thực tế về ${context.conceptName} trong môi trường doanh nghiệp.`;
    if (!example.includes("(Ví dụ minh họa do AI tạo.)")) {
      example = `${example} (Ví dụ minh họa do AI tạo.)`;
      issuesFound.push("Auto-appended missing '(Ví dụ minh họa do AI tạo.)' label.");
    }

    const misconception = parsed.misconception || context.misconceptionsSummary;
    const application = parsed.application || `Ánh xạ ứng dụng của ${context.conceptName} vào phân tích thực tiễn.`;
    
    let citation = parsed.citation || `Nguồn: ${context.citationSummary}`;
    if (!citation.toLowerCase().includes("nguồn") && !citation.toLowerCase().includes("trang")) {
      citation = `Nguồn: ${context.citationSummary}`;
      issuesFound.push("Normalized missing citation reference.");
    }

    const aiExpansion = parsed.aiExpansion || "Không có nội dung mở rộng ngoài giáo trình.";
    const confidence = typeof parsed.confidence === "number" && !isNaN(parsed.confidence) 
      ? Math.min(Math.max(parsed.confidence, 0.5), 1.0) 
      : 0.95;

    const sanitized: StructuredAIExplanationResponse = {
      concept,
      definition,
      reasoning,
      example,
      misconception,
      application,
      citation,
      aiExpansion,
      confidence
    };

    // Calculate Quality Metrics
    const schemaCompleteness = Math.max(0, 1 - (issuesFound.length * 0.2));
    const evidenceCoverage = definition.length > 20 ? 0.95 : 0.6;
    const citationQuality = citation.includes("Trang") || citation.includes("FULL") ? 1.0 : 0.7;
    const teachingQuality = reasoning.length > 50 && example.length > 30 ? 0.95 : 0.7;

    const overallScore = parseFloat((
      (evidenceCoverage * 0.3) +
      (citationQuality * 0.2) +
      (schemaCompleteness * 0.2) +
      (confidence * 0.15) +
      (teachingQuality * 0.15)
    ).toFixed(2));

    const report: QualityScoreReport = {
      evidenceCoverage,
      citationQuality,
      schemaCompleteness,
      confidence,
      teachingQuality,
      overallScore,
      isPassed: overallScore >= 0.75,
      issuesFound
    };

    return { sanitized, report };
  }
};
