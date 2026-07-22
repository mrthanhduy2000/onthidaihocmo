/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from "@google/genai";

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
