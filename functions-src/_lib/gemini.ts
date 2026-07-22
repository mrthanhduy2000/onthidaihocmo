/**
 * Khởi tạo Gemini client dùng chung cho các serverless function.
 * Khởi tạo LƯỜI (chỉ tạo khi gọi lần đầu) để đọc GEMINI_API_KEY tại thời điểm chạy,
 * hoạt động đúng cả trên Vercel (env runtime) lẫn local (dotenv nạp trước khi có request).
 */
import { GoogleGenAI, Type } from "@google/genai";

export { Type };

let _ai: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return _ai;
}
