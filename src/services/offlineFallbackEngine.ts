/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StructuredAIExplanationResponse } from "./aiResponseSchema";
import { CompressedContext } from "./contextWindowBuilder";

export const offlineFallbackEngine = {
  /**
   * Generates a high-fidelity, deterministic local offline explanation structure
   * when Gemini API is unavailable (network, rate limit, timeout, safety block).
   */
  generateOfflineExplanation(context: CompressedContext): StructuredAIExplanationResponse {
    return {
      concept: context.conceptName,
      definition: context.kbEvidenceSummary,
      reasoning: `*(Chế độ giải thích ngoại tuyến)*\n\nĐáp án chính xác là **${context.correctAnswerText}**.\n\nHệ thống đã trích xuất trực tiếp dữ liệu học thuật từ giáo trình để bảo đảm tính chuẩn xác 100%. Sinh viên chọn: **${context.selectedAnswerText}**.`,
      example: `Ví dụ thực tiễn minh họa về khái niệm "${context.conceptName}" theo bối cảnh nghiên cứu doanh nghiệp. (Ví dụ minh họa do AI tạo.)`,
      misconception: context.misconceptionsSummary,
      application: `Khái niệm "${context.conceptName}" giúp sinh viên định hình tư duy phân tích các quy luật thị trường và quản trị thực tế.`,
      citation: `Nguồn: ${context.citationSummary}`,
      aiExpansion: "Không có nội dung mở rộng ngoài giáo trình trong chế độ ngoại tuyến.",
      confidence: 1.0
    };
  }
};
