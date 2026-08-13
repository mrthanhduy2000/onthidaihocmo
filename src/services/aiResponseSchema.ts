/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/*
  KHÔNG nhập `Type` từ `@google/genai`.

  `Type` chỉ là một enum chuỗi (`Type.OBJECT` chính là `"OBJECT"`), nhưng nhập nó kéo theo TOÀN BỘ
  bộ SDK vào gói trình duyệt. Đo ngày 13/08/2026: `@google/genai` bị gói vào bản trình duyệt qua ba
  file, trong khi trình duyệt luôn đi qua cổng chuyển tiếp `/api/ai/complete` và không bao giờ gọi
  SDK. Viết thẳng chuỗi là bỏ được cả phụ thuộc mà không đổi một byte nào của dữ liệu gửi đi.

  Giá trị lấy đúng từ enum của thư viện: TYPE_UNSPECIFIED, STRING, NUMBER, INTEGER, BOOLEAN,
  ARRAY, OBJECT, NULL.
*/
const Type = {
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT",
} as const;

export interface StructuredAIExplanationResponse {
  concept: string;
  definition: string;
  reasoning: string;
  example: string;
  misconception: string;
  application: string;
  citation: string;
  aiExpansion: string;
  confidence: number;
}

export const GEMINI_EXPLANATION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    concept: {
      type: Type.STRING,
      description: "Tên khái niệm hoặc học thuyết cốt lõi"
    },
    definition: {
      type: Type.STRING,
      description: "Định nghĩa chuẩn xác của khái niệm từ giáo trình tài liệu"
    },
    reasoning: {
      type: Type.STRING,
      description: "Giải thích lý do tại sao phương án đúng là chính xác và các phương án khác chưa chính xác"
    },
    example: {
      type: Type.STRING,
      description: "Ví dụ thực tiễn minh họa sinh động (Bắt buộc chứa nhãn: '(Ví dụ minh họa do AI tạo.)')"
    },
    misconception: {
      type: Type.STRING,
      description: "Cảnh báo hiểu sai/bẫy bối cảnh phổ biến cần tránh"
    },
    application: {
      type: Type.STRING,
      description: "Ứng dụng thực tế của khái niệm trong quản trị, kinh tế hoặc đời sống"
    },
    citation: {
      type: Type.STRING,
      description: "Trích dẫn chính xác nguồn giáo trình (Tên tài liệu, trang)"
    },
    aiExpansion: {
      type: Type.STRING,
      description: "Nội dung phân tích mở rộng chuyên sâu do AI suy luận logic (Nếu không có, ghi 'Không có nội dung mở rộng ngoài giáo trình.')"
    },
    confidence: {
      type: Type.NUMBER,
      description: "Độ tin cậy học thuật của câu trả lời từ 0.0 đến 1.0"
    }
  },
  required: [
    "concept",
    "definition",
    "reasoning",
    "example",
    "misconception",
    "application",
    "citation",
    "aiExpansion",
    "confidence"
  ]
};
