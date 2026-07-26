/** Trợ lý AI hỏi đáp (Gemini 3.6 Flash) qua bộ điều phối. */
import { requireUser } from "../_lib/auth";
import { AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION } from "../../src/services/authoritativeKnowledgePolicy";
import { aiOrchestrator, PromptBuilder } from "../../src/services/aiOrchestrator";
import { CrossSubjectIntelligenceEngine } from "../../src/services/evidencePipeline";

export default async function handler(req: any, res: any) {
  if (!(await requireUser(req, res))) return;
  try {
    const { message, history, subjectId, subjectName, kbContext, learnerProfile } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "Thiếu nội dung câu hỏi." });
    }

    const currentSubjectName = subjectName || "môn đang học";
    // Nhận thẳng mã môn từ giao diện. Trước đây chỗ này suy mã môn bằng cách dò chữ trong TÊN
    // môn ("Khách hàng" thì là customer_behavior, còn lại là poli_econ), nên mọi môn người dùng
    // tự tạo đều bị nhận nhầm thành Kinh tế chính trị. Giao diện luôn biết chính xác mã môn,
    // không có lý do gì bắt máy chủ phải đoán.
    const activeSubjectId = subjectId || "";

    let crossIntelContext = "";
    const crossSubject = CrossSubjectIntelligenceEngine.findCrossSubjectConnection(activeSubjectId, message);
    if (crossSubject) {
      crossIntelContext = `\n[LIÊN KẾT LIÊN MÔN DÀNH CHO GIẢNG VIÊN]: Người học đang hỏi một chủ đề giao thoa. Hãy kết nối lý thuyết này với môn: ${crossSubject.connectedSubject} (Chủ đề: ${crossSubject.topic}). Giải thích liên kết này: ${crossSubject.explanation}`;
    }

    const systemInstruction = `${AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION}

Bạn là một giảng viên đại học thông thái dạy môn ${currentSubjectName} có phong cách giảng dạy truyền cảm hứng, ngôn ngữ chuẩn mực chính xác, rành mạch và dễ hiểu. Hãy giải thích ngắn gọn, súc tích và có tính sư phạm cao. Sử dụng Markdown để định dạng câu trả lời đẹp mắt.${crossIntelContext ? ` Sử dụng gợi ý liên môn này nếu thấy phù hợp để kích thích tư duy rộng của học viên: ${crossIntelContext}` : ""}`;

    const builder = new PromptBuilder();
    builder.setSystem(systemInstruction)
      .setSubject(`Môn học: ${currentSubjectName}.`)
      .setConceptContext(kbContext ? `Cơ sở Tri thức môn học đã được tìm thấy:\n${kbContext}${crossIntelContext ? `\n${crossIntelContext}` : ""}` : (crossIntelContext || "Sử dụng tri thức giảng dạy chung."))
      .setLearnerContext(learnerProfile ? `Hồ sơ năng lực học tập của sinh viên:\n${JSON.stringify(learnerProfile)}` : "Học viên mới tham gia học tập.")
      .setTeachingStyle("Hãy giải thích ngắn gọn, súc tích, mang tính giáo sư truyền cảm hứng học tập, lồng ghép các mẹo ghi nhớ nhanh và bối cảnh học thuật rõ ràng.")
      .setUserQuery(`Lịch sử hội thoại trước đó (đã thu gọn):\n${JSON.stringify(history || [])}\n\nHọc viên hỏi: "${message}"`);

    const result = await aiOrchestrator.executeWithOrchestration({
      taskType: "GeneralChat",
      modelName: "gemini-3.6-flash",
      prompt: builder.build(),
      systemInstruction,
      temperature: 0.7,
      clientId: "learner_chat",
      fallbackFunction: () =>
        `*(Chế độ ngoại tuyến)*\n\nTôi không thể kết nối đến máy chủ AI trực tuyến vào lúc này. Tuy nhiên, bạn có thể tham khảo **Bộ tài liệu slide bài giảng FULL CHƯƠNG.pdf** được tích hợp sẵn trong ứng dụng để đọc lý thuyết chi tiết về chủ đề này. Hãy kiểm tra lại cấu hình GEMINI_API_KEY.`,
    });

    res.status(200).json({
      reply: result.text,
      tokensUsed: result.tokensUsed,
      estimatedCostUsd: result.estimatedCostUsd,
      cacheHit: result.cacheHit,
      responseTimeMs: result.responseTimeMs,
      offlineMode: result.offlineMode,
    });
  } catch (error: any) {
    console.error("Error in Chat Endpoint:", error);
    res.status(500).json({ error: "Lỗi kết nối Trợ lý AI." });
  }
}
