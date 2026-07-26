/** Giải thích câu hỏi qua pipeline suy luận có dẫn chứng (Gemini 3.6 Flash). */
import { requireUser } from "../_lib/auth";
import { dbService, questionMap, topicMap } from "../../src/services/db";
import { aiOrchestrator } from "../../src/services/aiOrchestrator";
import { EvidenceBasedPipeline } from "../../src/services/evidencePipeline";

export default async function handler(req: any, res: any) {
  if (!(await requireUser(req, res))) return;
  try {
    const { questionId, selectedAnswer, explanationLevel, subjectName } = req.body || {};

    // Tra cứu PHẢI đi qua questionMap, đúng nguồn mà EvidenceBasedPipeline dùng ở bước sau.
    // Trước 27/07/2026 chỗ này tra trong `src/data/questions`, tức ngân hàng của môn Kinh tế
    // chính trị ĐÃ ĐÓNG (60 câu, id 1 đến 60), trong khi môn đang hoạt động có id từ 2001 trở
    // lên. Hai dải id không giao nhau nên MỌI lời gọi thật đều rơi vào 404, còn id 1 đến 60 thì
    // qua được cửa này rồi chết 500 ở pipeline. Giao diện nuốt lỗi và hiện lời giải ngoại tuyến,
    // nên nhìn ngoài tưởng AI đang chạy. Dùng questionMap cũng là đúng bất biến 4.1 trong
    // AGENTS.md: mọi thứ hiển thị cho người học phải đọc từ bản đã trộn phương án.
    const q = questionMap.get(questionId);
    if (!q) {
      return res.status(404).json({ error: "Không tìm thấy câu hỏi." });
    }

    const topicName = topicMap.get(q.topicId)?.title || "Chưa rõ";
    const currentSubjectName = subjectName || dbService.getActiveSubjectName();
    const subjectId = dbService.getActiveSubjectId();

    const defaultOfflineText = `*(Chế độ ngoại tuyến)*\n\n**Đáp án đúng**: **${q.correctAnswer.toUpperCase()}** - ${q.options[q.correctAnswer]}\n\n### Giải thích chi tiết:\n${q.explanation}\n\n### Ánh xạ kiến thức:\n- **Chương**: ${q.chapterId}\n- **Chủ đề**: ${q.topicId} (${topicName})\n- **Nguồn tài liệu**: *${q.sourcePdf}* (Trang ${q.sourcePage})\n- **Từ khóa**: ${q.knowledgeMapping.join(", ")}`;

    const pipelineResult = await EvidenceBasedPipeline.executePipeline({
      subjectId,
      subjectName: currentSubjectName,
      questionId,
      selectedAnswer,
      explanationLevel: explanationLevel || "academic",
      aiEngineExecutor: async (sysInstruction: string, prompt: string) => {
        const result = await aiOrchestrator.executeWithOrchestration({
          modelName: "gemini-3.6-flash",
          prompt,
          systemInstruction: sysInstruction,
          temperature: 0.2,
          clientId: "learner_explain",
          fallbackFunction: () => defaultOfflineText,
        });
        return result.text;
      },
      fallbackFunction: () => defaultOfflineText,
    });

    res.status(200).json({
      explanation: pipelineResult.text,
      strategyUsed: pipelineResult.strategyUsed,
      guessingProbability: pipelineResult.guessingProbability,
      unmasteredPrerequisites: pipelineResult.unmasteredPrerequisites,
      crossSubjectIntel: pipelineResult.crossSubjectIntel,
      validationReport: pipelineResult.validationReport,
      offlineMode: pipelineResult.validationReport.score === 100 && pipelineResult.text.includes("(Chế độ ngoại tuyến)"),
    });
  } catch (error: any) {
    console.error("Error in Explain Endpoint:", error);
    res.status(500).json({ error: "Lỗi kết nối AI Explainer." });
  }
}
