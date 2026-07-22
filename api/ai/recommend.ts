/** Gợi ý lộ trình học thích ứng từ thống kê (Gemini 3.6 Flash) qua bộ điều phối. */
import { Type } from "../_lib/gemini";
import { requireUser } from "../_lib/auth";
import { AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION } from "../../src/services/authoritativeKnowledgePolicy";
import { aiOrchestrator } from "../../src/services/aiOrchestrator";

export default async function handler(req: any, res: any) {
  if (!(await requireUser(req, res))) return;
  try {
    const { stats, subjectName } = req.body || {};
    if (!stats) {
      return res.status(400).json({ error: "Thiếu dữ liệu thống kê." });
    }

    const currentSubject = subjectName || "Kinh tế chính trị Mác - Lênin";
    const systemInstruction = `${AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION}\n\nBạn là Chuyên gia Khảo thí và AI học tập thích ứng của hệ thống luyện thi đại học môn ${currentSubject}.`;

    const prompt = `Hãy phân tích các thông số thống kê học tập của học viên để đưa ra một bản báo cáo phân tích năng lực và gợi ý lộ trình học tập tối ưu nhất.

Thống kê học tập hiện tại của học viên:
- Tổng số câu đã giải: ${stats.totalSolved}
- Tổng số câu làm đúng ít nhất một lần: ${stats.totalCorrect}
- Tổng thời gian luyện tập: ${Math.round((stats.totalTimeSpent || 0) / 60)} phút
- Chuỗi ngày học liên tục (streak): ${stats.studyStreak} ngày
- Tỷ lệ làm đúng theo từng chương (Chapter ID -> { correct, total }):
${JSON.stringify(stats.accuracyByChapter, null, 2)}
- Tỷ lệ làm đúng theo từng chủ đề (Topic ID -> { correct, total }):
${JSON.stringify(stats.accuracyByTopic, null, 2)}

Hãy phân tích kỹ lưỡng xem học viên đang rỗng kiến thức hoặc yếu nhất ở chương nào, chủ đề nào. Sau đó phản hồi lại kết quả bằng JSON khớp chính xác với cấu trúc yêu cầu.

Lưu ý quan trọng:
- Trường "recommendationText" phải viết bằng tiếng Việt, định dạng Markdown thật đẹp, chuyên nghiệp, cấu trúc rõ ràng với các tiêu đề, in đậm, danh sách gạch đầu dòng. Bản phân tích phải chứa:
  1) Nhận xét khách quan về tiến độ và kết quả (khen ngợi nếu làm tốt, động viên nếu kết quả thấp).
  2) Chỉ ra chính xác 1-2 chương yếu nhất và chủ đề cần khắc phục ngay.
  3) Lời khuyên cụ thể về việc đọc phần lý thuyết nào để lấp đầy lỗ hổng.
- Trường "suggestedAction" phải hướng dẫn học viên làm bài tập khắc phục:
  - "type" có thể là: "smart-exam" (đề thi thử AI), "chapter-review" (ôn theo chương), hoặc "topic-review" (ôn theo chủ đề).
  - Cung cấp "chapterId" hoặc "topicId" tương ứng khớp với mảng "weakChapters" hoặc "weakTopics".
  - "count" là số câu hỏi đề xuất làm thêm (từ 10 đến 25 câu).`;

    const result = await aiOrchestrator.executeWithOrchestration({
      taskType: "DiagnosticRecommendation",
      modelName: "gemini-3.6-flash",
      prompt,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          weakChapters: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: "Array of chapter IDs where accuracy is low" },
          weakTopics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of topic IDs where accuracy is low" },
          recommendationText: { type: Type.STRING, description: "Rich markdown analysis and study plan recommendations" },
          suggestedAction: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, description: "Must be 'smart-exam' or 'chapter-review' or 'topic-review'" },
              chapterId: { type: Type.INTEGER },
              topicId: { type: Type.STRING },
              count: { type: Type.INTEGER },
            },
            required: ["type", "count"],
          },
        },
        required: ["weakChapters", "weakTopics", "recommendationText", "suggestedAction"],
      },
      clientId: "learner_recommend",
      fallbackFunction: () => {
        const localHeuristics = {
          weakChapters: Object.entries(stats.accuracyByChapter || {})
            .filter(([_, data]: any) => data.total > 0 && (data.correct / data.total) < 0.7)
            .map(([chId]) => parseInt(chId)),
          weakTopics: Object.entries(stats.accuracyByTopic || {})
            .filter(([_, data]: any) => data.total > 0 && (data.correct / data.total) < 0.65)
            .map(([tId]) => tId),
          recommendationText: `### Phân tích Chẩn đoán (Ngoại tuyến):
Hệ thống ghi nhận tỷ lệ làm đúng trung bình hiện tại của bạn. Bạn nên tập trung tăng cường ôn tập các bẫy trắc nghiệm của chủ đề chưa đạt chuẩn 70% bằng Đề thi thích ứng mới.`,
          suggestedAction: { type: "smart-exam", count: 10 },
        };
        return JSON.stringify(localHeuristics);
      },
    });

    try {
      const recommendation = JSON.parse(result.text.trim());
      res.status(200).json({
        ...recommendation,
        tokensUsed: result.tokensUsed,
        estimatedCostUsd: result.estimatedCostUsd,
        cacheHit: result.cacheHit,
        responseTimeMs: result.responseTimeMs,
        offlineMode: result.offlineMode,
      });
    } catch {
      res.status(200).json({
        weakChapters: [],
        weakTopics: [],
        recommendationText: result.text,
        suggestedAction: { type: "smart-exam", count: 10 },
        offlineMode: true,
      });
    }
  } catch (error: any) {
    console.error("Error in Recommendation Endpoint:", error);
    res.status(500).json({ error: "Lỗi kết nối AI Recommendation." });
  }
}
