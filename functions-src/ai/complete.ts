/**
 * Cổng chuyển tiếp tới Gemini cho tầng suy luận chạy phía trình duyệt.
 *
 * Vì sao có cổng này: tầng suy luận có dẫn chứng (`EvidenceBasedPipeline`) cần biết ngân hàng
 * câu hỏi, đồ thị khái niệm và lịch sử học của môn ĐANG mở. Toàn bộ những thứ đó chỉ tồn tại
 * trong trình duyệt, đặc biệt với môn do người dùng tự tạo (dữ liệu nằm ở localStorage, máy chủ
 * chưa từng thấy). Đưa suy luận về trình duyệt là cách duy nhất để mọi môn đều dùng được, không
 * phải deploy lại mỗi lần thêm môn.
 *
 * Máy chủ vì thế chỉ còn giữ đúng thứ bắt buộc phải giữ bí mật: khóa Gemini.
 *
 * Ba rào chắn ở lại phía máy chủ, đừng gỡ:
 *   1. `requireUser`: phải có token mới gọi được.
 *   2. Chỉ dẫn hệ thống ghép TẠI ĐÂY, không nhận từ giao diện. Giao diện chỉ gửi phần nội dung.
 *   3. Trần độ dài lời nhắc, để không ai biến khóa Gemini thành chatbot miễn phí.
 */
import { requireUser } from "../_lib/auth";
import { AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION } from "../../src/services/authoritativeKnowledgePolicy";
import { aiOrchestrator } from "../../src/services/aiOrchestrator";
import { TaskType } from "../../src/services/temperatureStrategy";

/** Trần độ dài lời nhắc. Lời nhắc dài nhất mà pipeline dựng ra đo được khoảng 12 nghìn ký tự. */
const MAX_PROMPT_CHARS = 24000;

const ALLOWED_TASK_TYPES: TaskType[] = [
  "AcademicExplanation",
  "SocraticGuidance",
  "ExampleGeneration",
  "QuizGeneration",
  "GeneralChat",
  "DiagnosticRecommendation",
  "RecallGrading",
];

export default async function handler(req: any, res: any) {
  if (!(await requireUser(req, res))) return;
  try {
    const { prompt, taskType, subjectName, temperature, responseMimeType, responseSchema } = req.body || {};

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: "Thiếu nội dung lời nhắc." });
    }
    if (String(prompt).length > MAX_PROMPT_CHARS) {
      return res.status(413).json({
        error: `Lời nhắc quá dài (${String(prompt).length} ký tự, trần là ${MAX_PROMPT_CHARS}).`,
      });
    }

    const safeTaskType: TaskType = ALLOWED_TASK_TYPES.includes(taskType)
      ? taskType
      : "AcademicExplanation";

    // Chỉ dẫn hệ thống dựng ở máy chủ. Giao diện KHÔNG được thay thế phần này, chỉ được thêm
    // tên môn để xưng hô cho đúng.
    const systemInstruction = `${AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION}

Bạn đang hỗ trợ học viên môn ${subjectName || "đang học"}. Trả lời bằng tiếng Việt, chuẩn mực học
thuật, có tính sư phạm cao, dùng Markdown để trình bày rõ ràng.`;

    const result = await aiOrchestrator.executeWithOrchestration({
      taskType: safeTaskType,
      modelName: "gemini-3.6-flash",
      prompt: String(prompt),
      systemInstruction,
      temperature: typeof temperature === "number" ? temperature : undefined,
      // Tầng suy luận yêu cầu Gemini trả về JSON theo lược đồ cố định. Không chuyển tiếp hai
      // trường này thì phía trình duyệt nhận về văn xuôi rồi phải đoán, chất lượng tụt hẳn.
      responseMimeType: typeof responseMimeType === "string" ? responseMimeType : undefined,
      responseSchema: responseSchema || undefined,
      clientId: "learner_pipeline",
      // Giao diện tự có bản dự phòng ngoại tuyến đầy đủ hơn (đọc được lời giải sẵn trong dữ
      // liệu), nên ở đây chỉ cần báo hiệu để giao diện biết mà rơi về bản của nó.
      fallbackFunction: () => "",
    });

    res.status(200).json({
      text: result.text,
      offlineMode: result.offlineMode,
      tokensUsed: result.tokensUsed,
      estimatedCostUsd: result.estimatedCostUsd,
      cacheHit: result.cacheHit,
      responseTimeMs: result.responseTimeMs,
    });
  } catch (error: any) {
    console.error("Error in Complete Endpoint:", error);
    res.status(500).json({ error: "Lỗi kết nối AI." });
  }
}
