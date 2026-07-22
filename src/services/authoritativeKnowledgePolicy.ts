/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const KNOWLEDGE_PRIORITY_HIERARCHY = {
  PRIORITY_1_AUTHORITATIVE_SOURCE: [
    "PDF giáo trình upload",
    "Slide bài giảng upload",
    "Tài liệu ôn tập upload",
    "Đề cương & Đề thi mẫu",
    "Ghi chú do người dùng upload"
  ],
  PRIORITY_2_KNOWLEDGE_GRAPH: [
    "Concepts & Definitions",
    "Relationships & Prerequisites",
    "Question Blueprints",
    "Misconceptions & Distractors",
    "Teaching Rules & Metadata"
  ],
  PRIORITY_3_LEARNING_MEMORY: [
    "Student Model & Adaptive Memory",
    "Concept Memory Profiles",
    "Evolution Timeline Snapshots",
    "Teaching Analytics & Mastery"
  ],
  PRIORITY_4_NLG_ENGINE: [
    "Gemini 3.6 Flash (NLG Engine)",
    "Natural Language Generation & Formatting",
    "Explanation & Socratic Dialogue",
    "Question & Hint Generation"
  ],
  PRIORITY_5_EXTERNAL_KNOWLEDGE: [
    "DISABLED (No external knowledge, no pretrained memory, no external examples unless in docs)"
  ]
};

export const AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION = `
===================================================================
AUTHORITATIVE KNOWLEDGE POLICY (SINGLE SOURCE OF TRUTH)
===================================================================
1. SỰ THẬT DUY NHẤT (SINGLE SOURCE OF TRUTH):
   - Các tài liệu học liệu được upload (PDF giáo trình, Slide bài giảng, Tài liệu ôn tập, Đề cương) là NGUỒN SỰ THẬT DUY NHẤT (Authoritative Knowledge Source).
   - Gemini CHỈ đóng vai trò là động cơ diễn đạt ngôn ngữ tự nhiên (Natural Language Generation - NLG Engine), KHÔNG PHẢI LÀ NGUỒN KIẾN THỨC.

2. QUY TẮC NGHIÊM NGẶT (STRICT KNOWLEDGE POLICY):
   - "Nếu tài liệu không đề cập thì hệ thống không biết."
   - KHÔNG tự suy luận để lấp khoảng trống ngoài tài liệu.
   - KHÔNG thêm định nghĩa, mô hình, thuật ngữ, ví dụ, case study, quy trình hoặc framework không xuất hiện trong tài liệu upload.
   - KIẾN THỨC BÊN NGOÀI (EXTERNAL KNOWLEDGE) LÀ HOÀN TOÀN TẮT (DISABLED). Không sử dụng tri thức pretrained hay ví dụ chung không có trong học liệu.

3. QUY TẮC XỬ LÝ THIẾU THÔNG TIN (MISSING INFORMATION POLICY):
   - Nếu dữ liệu/tài liệu không đủ để trả lời, BẮT BUỘC KHÔNG NÓI: "Theo kiến thức của tôi...", "Thông thường...", "Trong thực tế...", "Theo lý thuyết...".
   - BẮT BUỘC trả lời chính xác một trong các câu sau:
     "Trong tài liệu hiện tại chưa có đủ thông tin để xác định."
     hoặc
     "Nội dung này chưa xuất hiện trong nguồn học liệu đã nạp."

4. QUY TẮC TRUY VẾT & TRÍCH DẪN (CITATION & TRACEABILITY POLICY):
   - Mọi nội dung sinh ra (Câu hỏi, Đáp án, Giải thích, Gợi ý sư phạm) BẮT BUỘC giữ liên kết trích dẫn tới học liệu gốc:
     [Chương / Chủ đề / PDF / Slide / Trang / Concept ID].

5. AI COACH & AI GENERATION POLICY:
   - AI Coach chỉ được phép: diễn đạt lại, giải thích lại, rút gọn, hoặc mở rộng cách hiểu nhưng BẮT BUỘC giữ nguyên định nghĩa, thuật ngữ, logic và kết luận theo tài liệu gốc.
   - Mọi câu hỏi trắc nghiệm BẮT BUỘC được biên soạn từ [Knowledge Graph -> Concept -> Evidence -> Blueprint -> Question], KHÔNG ĐƯỢC sinh ra từ bộ nhớ tự do của AI.
===================================================================
`.trim();

export interface GroundingValidationResult {
  isPolicyCompliant: boolean;
  missingInfoTriggered: boolean;
  citationsIncluded: boolean;
  violations: string[];
}

export const authoritativeKnowledgePolicy = {
  /**
   * Evaluates AI generated output against the Authoritative Knowledge Policy
   */
  evaluateGrounding(response: string, evidenceSummary?: string): GroundingValidationResult {
    const violations: string[] = [];
    const lower = response.toLowerCase();

    // Check forbidden filler phrasing
    const forbiddenPhrases = [
      "theo kiến thức của tôi",
      "theo hiểu biết của tôi",
      "thông thường trong thực tế",
      "theo lý thuyết chung",
      "theo wikipedia"
    ];

    for (const phrase of forbiddenPhrases) {
      if (lower.includes(phrase)) {
        violations.push(`Phát hiện cụm từ vi phạm chính sách: "${phrase}"`);
      }
    }

    const missingInfoTriggered = 
      lower.includes("chưa có đủ thông tin để xác định") ||
      lower.includes("chưa xuất hiện trong nguồn học liệu đã nạp");

    const citationsIncluded = 
      lower.includes("nguồn:") || 
      lower.includes("trang") || 
      lower.includes("slide") || 
      lower.includes("chương") ||
      lower.includes("pdf");

    if (!citationsIncluded && !missingInfoTriggered) {
      violations.push("Thiếu trích dẫn nguồn học liệu gốc (Citation missing)");
    }

    return {
      isPolicyCompliant: violations.length === 0,
      missingInfoTriggered,
      citationsIncluded,
      violations
    };
  },

  /**
   * Formats missing info response safely
   */
  getStandardMissingInfoMessage(): string {
    return "Trong tài liệu hiện tại chưa có đủ thông tin để xác định.";
  }
};
