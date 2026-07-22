/** Sinh câu hỏi trắc nghiệm từ nội dung tài liệu (Gemini 3.6 Flash). */
import { getAI, Type } from "../_lib/gemini";
import { requireUser } from "../_lib/auth";
import { AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION } from "../../src/services/authoritativeKnowledgePolicy";
import { questionGenerationEngine } from "../../src/services/questionGenerationEngine";
import { pedagogicalIntelligenceEngine } from "../../src/services/pedagogicalIntelligenceEngine";
import { pedagogicalReviewEngine } from "../../src/services/pedagogicalReviewEngine";

export default async function handler(req: any, res: any) {
  if (!(await requireUser(req, res))) return;
  try {
    const { text, count, subjectName, chapterOutline } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "Thiếu nội dung tài liệu để tạo câu hỏi." });
    }

    const targetCount = count ? Math.min(Math.max(parseInt(count), 2), 15) : 5;
    const currentSubjectName = subjectName || "Hành vi Khách hàng";

    // Dàn ý chương thật của môn (nếu client gửi lên) để AI gán chapterId chính xác.
    const chapterGuide = chapterOutline && String(chapterOutline).trim()
      ? `\n\nDàn ý các chương của môn học (chỉ được dùng đúng các số chương này):\n${chapterOutline}`
      : "";
    const chapterInstruction = chapterGuide
      ? `5. Gán chapterId: chọn ĐÚNG số chương phù hợp nhất trong dàn ý chương bên dưới, không dùng số chương nằm ngoài danh sách.`
      : `5. Gán chapterId: hãy cố gắng phân tích xem câu hỏi này thuộc chương nào trong slide, sử dụng một số nguyên từ 1 đến 7.`;

    const prompt = `Bạn là chuyên gia khảo thí và xây dựng đề thi trắc nghiệm đại học xuất sắc cho môn: ${currentSubjectName}.
Hãy phân tích tài liệu sau và biên soạn chính xác ${targetCount} câu hỏi trắc nghiệm (multiple-choice) chất lượng cao, có tính phân hóa tốt, bao quát các kiến thức cốt lõi.

Tài liệu gốc:
"""
${text}
"""

Yêu cầu biên soạn:
1. Mỗi câu hỏi phải có đúng 4 phương án lựa chọn (A, B, C, D) rõ ràng, khoa học, tránh bẫy ngôn từ vô nghĩa.
2. Chỉ có duy nhất 1 phương án đúng.
3. Đáp án đúng được lưu dưới dạng chữ thường ('a', 'b', 'c', hoặc 'd').
4. Phần giải thích (explanation) phải viết bằng tiếng Việt thật chi tiết, có tính sư phạm cao, lý giải rõ tại sao phương án đó là đúng và tại sao các phương án khác chưa chính xác.
${chapterInstruction}
6. Gán topicId: sử dụng mã chủ đề phù hợp, ví dụ 'CB_T1.1', 'CB_T2.1' hoặc 'T1.1' tùy theo nội dung và chương học.
7. Chọn mức độ khó (difficulty): 'Dễ', 'Trung bình', 'Khó' hoặc 'Rất khó'.
8. Gán difficultyRating: từ 1 đến 5 sao tương ứng với độ khó.
9. Điền kiến thức liên kết (knowledgeMapping) là một danh sách các từ khóa lý thuyết quan trọng xuất hiện trong câu hỏi này.
10. Điền estimatedTime: thời gian ước lượng làm bài (từ 20 đến 60 giây).
11. Điền learningObjective: mục tiêu học tập cụ thể của câu hỏi này.
12. Điền concept: Tên khái niệm/học thuyết cụ thể (ví dụ 'Cầu dẫn dụ - Derived Demand', 'Tổ hợp Marketing', 'Quy luật giá trị thặng dư').
13. Điền misconception: Hiểu sai phổ biến nhất của sinh viên về khái niệm này mà đề bài đang nhắm tới cài bẫy.
14. Điền bloomLevel: Phân loại theo thang đo Bloom: 'Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'.${chapterGuide}`;

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: `${AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION}\n\nBạn là trợ lý khảo thí chuyên nghiệp, luôn biên soạn đề thi BẮT BUỘC dựa hoàn toàn trên tài liệu gốc được cung cấp và trả về kết quả định dạng JSON khớp chính xác với schema yêu cầu.`,
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.OBJECT,
                properties: {
                  a: { type: Type.STRING },
                  b: { type: Type.STRING },
                  c: { type: Type.STRING },
                  d: { type: Type.STRING },
                },
                required: ["a", "b", "c", "d"],
              },
              correctAnswer: { type: Type.STRING, description: "Must be exactly one of: 'a', 'b', 'c', or 'd'" },
              chapterId: { type: Type.INTEGER },
              topicId: { type: Type.STRING },
              difficulty: { type: Type.STRING, description: "Must be exactly one of: 'Dễ', 'Trung bình', 'Khó', 'Rất khó'" },
              difficultyRating: { type: Type.INTEGER, description: "Rating from 1 to 5" },
              explanation: { type: Type.STRING, description: "pedagogical explanation in Vietnamese" },
              knowledgeMapping: { type: Type.ARRAY, items: { type: Type.STRING } },
              estimatedTime: { type: Type.INTEGER },
              learningObjective: { type: Type.STRING },
              concept: { type: Type.STRING, description: "Theory or core concept name" },
              misconception: { type: Type.STRING, description: "Common misunderstanding details" },
              bloomLevel: { type: Type.STRING, description: "Bloom Taxonomy Level: Remember, Understand, Apply, Analyze, Evaluate, Create" },
            },
            required: [
              "question", "options", "correctAnswer", "chapterId", "topicId",
              "difficulty", "difficultyRating", "explanation", "knowledgeMapping",
              "estimatedTime", "learningObjective", "concept", "misconception", "bloomLevel",
            ],
          },
        },
      },
    });

    const rawQuestions = JSON.parse(response.text.trim());

    const questionsList = rawQuestions.map((q: any, idx: number) => {
      const subjectId = currentSubjectName.toLowerCase().replace(/\s+/g, "_");

      const pedSpec = pedagogicalIntelligenceEngine.createSpecification({
        subjectId,
        chapterId: q.chapterId || 1,
        topicId: q.topicId || "T1.1",
        targetDifficulty: q.difficulty || "Trung bình",
      });

      const spec = questionGenerationEngine.buildQuestionSpec({
        subjectId,
        chapterId: q.chapterId || 1,
        topicId: q.topicId || "T1.1",
        targetDifficulty: q.difficulty || "Trung bình",
        preferredBlueprint: pedSpec.blueprint as any,
      });

      const verification = questionGenerationEngine.verifyAndScoreQuestion(q, spec);
      const metadata = questionGenerationEngine.generateMetadata(q.id || `q_gen_${Date.now()}_${idx}`, spec, verification);
      const reviewResult = pedagogicalReviewEngine.reviewQuestion(q, pedSpec);

      return { ...q, metadata, pedagogicalMetadata: reviewResult.pedagogicalMetadata };
    });

    res.status(200).json({ questions: questionsList });
  } catch (error: any) {
    console.error("Gemini API Error in Quiz Generator Endpoint:", error);
    res.status(500).json({ error: "Lỗi tạo đề tự động từ AI. Vui lòng thử lại sau." });
  }
}
