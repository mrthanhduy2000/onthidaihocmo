/** Giải thích câu hỏi qua pipeline suy luận có dẫn chứng (Gemini 3.6 Flash). */
import { requireUser } from "../_lib/auth";
import { questions } from "../../src/data/questions";
import { topics } from "../../src/data/topics";
import { aiOrchestrator } from "../../src/services/aiOrchestrator";
import { EvidenceBasedPipeline } from "../../src/services/evidencePipeline";

export default async function handler(req: any, res: any) {
  if (!(await requireUser(req, res))) return;
  try {
    const { questionId, selectedAnswer, explanationLevel, subjectName } = req.body || {};
    const q = questions.find((question) => question.id === questionId);
    if (!q) {
      return res.status(404).json({ error: "Không tìm thấy câu hỏi." });
    }

    const topicName = topics.find((t) => t.id === q.topicId)?.title || "Chưa rõ";
    const currentSubjectName = subjectName || "Kinh tế chính trị Mác - Lênin";
    const subjectId = q.chapterId <= 6 && q.topicId.startsWith("T") ? "poli_econ" : "customer_behavior";

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
