/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompressedContext } from "./contextWindowBuilder";
import { AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION } from "./authoritativeKnowledgePolicy";

export const PROMPT_VERSION_36 = "v3.6-gemini-contract-v1";

export interface PromptBuildResult {
  systemInstruction: string;
  prompt: string;
  version: string;
}

export const promptBuilder36 = {
  /**
   * Generates a completely deterministic prompt following the strict Gemini 3.6 Flash Contract
   * and enforcing the Authoritative Knowledge Policy (Single Source of Truth).
   */
  compilePrompt(context: CompressedContext, subjectName: string): PromptBuildResult {
    const systemInstruction = `${AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION}

Bạn là Natural Language & Pedagogical Generation Engine chuyên sâu ngành Kinh tế & Quản trị.
Nhiệm vụ duy nhất của bạn là chuyển đổi Kế hoạch Học tập (Learning Plan) và Dữ liệu Chứng cứ (Knowledge Evidence) do hệ thống cung cấp thành phản hồi giải thích sư phạm chuẩn xác.

RÀNG BUỘC TUYỆT ĐỐI:
1. Bạn KHÔNG giữ trạng thái phiên làm việc.
2. Bạn KHÔNG tự quyết định lộ trình học hoặc cấp độ tư duy Bloom (đã do hệ thống quyết định).
3. Bạn KHÔNG suy luận ngoài dữ liệu giáo trình đã cung cấp. Nếu dữ liệu không đủ, trả về: "Trong tài liệu hiện tại chưa có đủ thông tin để xác định."
4. Bạn BẮT BUỘC trả về định dạng JSON khớp chính xác với Response Schema được chỉ định.
5. Khi đưa ra ví dụ, BẮT BUỘC kèm theo nhãn: "(Ví dụ minh họa do AI tạo.)".`;

    const prompt = `[PROMPT VERSION]: ${PROMPT_VERSION_36}

========================
SYSTEM ROLE
========================
Giảng viên AI hỗ trợ sinh viên học tập môn: ${subjectName}.

========================
PEDAGOGICAL OBJECTIVE
========================
Giải thích chuyên sâu câu hỏi trắc nghiệm về khái niệm: "${context.conceptName}".
- Câu hỏi: ${context.questionText}
- Các phương án:
${context.optionsSummary}
- Sinh viên chọn: ${context.selectedAnswerText}
- Đáp án đúng: ${context.correctAnswerText}

========================
STUDENT PROFILE
========================
${context.studentSummary}

========================
LEARNING PLAN
========================
${context.learningPlanSummary}

========================
KNOWLEDGE EVIDENCE
========================
${context.kbEvidenceSummary}

========================
MISCONCEPTIONS
========================
${context.misconceptionsSummary}

========================
CITATIONS
========================
${context.citationSummary}

========================
OUTPUT FORMAT & INSTRUCTIONS
========================
Trả về phản hồi theo định dạng JSON với các trường:
- concept: Tên khái niệm "${context.conceptName}"
- definition: Định nghĩa chuẩn xác trích từ Knowledge Evidence
- reasoning: Giải thích vì sao ${context.correctAnswerText} là chính xác và các phương án khác chưa đúng
- example: Ví dụ thực tiễn sinh động (Bắt buộc chứa cụm "(Ví dụ minh họa do AI tạo.)")
- misconception: Bẫy hiểu sai cần tránh
- application: Ứng dụng thực tế trong quản trị hoặc kinh tế
- citation: "Nguồn: ${context.citationSummary}"
- aiExpansion: Phân tích mở rộng do AI suy luận logic
- confidence: Con số từ 0.8 đến 1.0 đại diện cho độ chuẩn xác học thuật`;

    return {
      systemInstruction,
      prompt,
      version: PROMPT_VERSION_36
    };
  }
};
