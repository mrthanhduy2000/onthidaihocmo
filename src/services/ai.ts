/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService, questionMap, topicMap, chapterMap, questions, chapters, topics } from "./db";
import { kbService } from "./kbService";
import { TimeService } from "./time";
import { learningEngine } from "./learningEngine";
import { learnerModelService } from "./learnerModel";
import { assessmentDesignEngine } from "./assessmentDesignEngine";
import { examReviewEngine } from "./examReviewEngine";
import { workspaceService } from "./workspaceService";
import { AIRecommendation, ExamAttempt, Question, DifficultyLevel } from "../types";
import { supabase } from "./supabaseClient";

/** Header cho lời gọi API: JSON + token đăng nhập Supabase (nếu có) để máy chủ xác thực. */
async function apiHeaders(): Promise<Record<string, string>> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  try {
    if (!supabase) return base;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
  } catch {
    return base;
  }
}

// ===== Hỗ trợ sinh câu hỏi hàng loạt từ tài liệu dài =====

/** Chia tài liệu dài thành nhiều đoạn theo ranh giới đoạn văn, mỗi đoạn tối đa maxChars ký tự. */
function splitIntoChunks(text: string, maxChars = 2800): string[] {
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > maxChars) {
      chunks.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${p}` : p;
    while (cur.length > maxChars) {
      chunks.push(cur.slice(0, maxChars));
      cur = cur.slice(maxChars);
    }
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.length ? chunks : [text];
}

/** Xáo trộn mảng tại chỗ (Fisher-Yates) để mỗi lần tạo đề cho ra thứ tự/lựa chọn câu khác nhau. */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Chuẩn hóa đề bài để so trùng lặp (bỏ hoa/thường, dấu câu, khoảng trắng thừa). */
function normalizeQuestionText(s: string): string {
  return String(s).toLowerCase().replace(/[.,;:?!"'“”()\-]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Kiểm tra một câu thô từ AI có đạt chất lượng tối thiểu không: có đề bài, đủ 4 phương án
 * khác rỗng, đáp án đúng nằm trong a/b/c/d và 4 phương án không trùng lặp nhau.
 */
function isQualityQuestion(q: any): boolean {
  if (!q || typeof q.question !== "string" || q.question.trim().length < 8) return false;
  const o = q.options;
  if (!o) return false;
  const vals = [o.a, o.b, o.c, o.d].map(v => String(v ?? "").trim());
  if (vals.some(v => v.length === 0)) return false;
  // Bốn phương án phải phân biệt (không có hai phương án giống hệt nhau).
  const uniq = new Set(vals.map(v => v.toLowerCase()));
  if (uniq.size < 4) return false;
  const ca = String(q.correctAnswer || "").trim().toLowerCase();
  if (!["a", "b", "c", "d"].includes(ca)) return false;
  return true;
}

/**
 * Gọi 1 lượt API sinh câu hỏi, trả về mảng câu đạt chất lượng (chưa gán ID). Ném lỗi nếu request thất bại.
 * targetChapterId (nếu có) được gửi kèm để AI bám sát đúng chương đang cần tạo.
 */
async function requestQuestionBatch(text: string, count: number, targetChapterId?: number): Promise<any[]> {
  const subjectName = dbService.getActiveSubjectName();
  const chapterOutline = chapters.map(c => `${c.id}. ${c.title}`).join("\n");
  const targetChapterTitle = targetChapterId
    ? (chapters.find(c => c.id === targetChapterId)?.title || "")
    : undefined;
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: await apiHeaders(),
    body: JSON.stringify({ text, count, subjectName, chapterOutline, targetChapterId, targetChapterTitle }),
  });
  if (!response.ok) {
    let msg = "Không tạo được câu hỏi từ AI. Vui lòng thử lại.";
    try { const err = await response.json(); if (err?.error) msg = err.error; } catch {}
    throw new Error(msg);
  }
  const data = await response.json();
  const raw: any[] = Array.isArray(data.questions) ? data.questions : [];
  return raw.filter(isQualityQuestion);
}

/**
 * Chuẩn hóa 1 câu thô từ AI thành đối tượng Question hoàn chỉnh (gán ID, kẹp chapterId hợp lệ).
 * forcedChapterId (nếu có) ép câu về đúng chương đích, bỏ qua chapterId AI tự đoán.
 */
function rawToQuestion(q: any, id: number, source: string, forcedChapterId?: number): Question {
  const maxChapter = chapters.length || 1;
  const validDiff = ["Dễ", "Trung bình", "Khó", "Rất khó"];
  const chapterId = forcedChapterId
    ? Math.min(Math.max(forcedChapterId, 1), maxChapter)
    : Math.min(Math.max(parseInt(q.chapterId) || 1, 1), maxChapter);
  const ca = String(q.correctAnswer || "a").trim().toLowerCase();
  const correctAnswer = (["a", "b", "c", "d"].includes(ca) ? ca : "a") as "a" | "b" | "c" | "d";
  // Khi ép chương: giữ topicId của AI nếu nó thuộc đúng chương, ngược lại đưa về chủ đề đầu chương.
  const rawTopic = typeof q.topicId === "string" ? q.topicId : "";
  const topicId = forcedChapterId
    ? (rawTopic.includes(`${forcedChapterId}.`) ? rawTopic : `T${chapterId}.1`)
    : (rawTopic || `T${chapterId}.1`);
  return {
    id,
    question: String(q.question).trim(),
    options: { a: String(q.options.a), b: String(q.options.b), c: String(q.options.c), d: String(q.options.d) },
    correctAnswer,
    chapterId,
    topicId,
    difficulty: validDiff.includes(q.difficulty) ? q.difficulty : "Trung bình",
    difficultyRating: Number(q.difficultyRating) || 3,
    explanation: q.explanation || "",
    sourcePdf: source,
    sourcePage: "AI tạo sinh",
    knowledgeMapping: Array.isArray(q.knowledgeMapping) ? q.knowledgeMapping : [],
    relatedQuestions: [],
    estimatedTime: Number(q.estimatedTime) || 45,
    questionType: "multiple-choice",
    learningObjective: q.learningObjective || "",
    concept: q.concept,
    misconception: q.misconception,
    bloomLevel: q.bloomLevel,
    createdAt: TimeService.now().toISOString(),
    metadata: q.metadata,
    pedagogicalMetadata: q.pedagogicalMetadata,
  };
}

export const aiService = {
  /**
   * Generates a local diagnostic recommendation based on user performance history.
   * Serving as a high-fidelity local fallback if Gemini is offline or not configured.
   */
  generateLocalRecommendation(): AIRecommendation {
    const stats = dbService.getStatistics();
    const overview = dbService.getDashboardOverview();

    if (stats.totalSolved === 0) {
      return {
        id: "initial-rec",
        date: TimeService.now().toISOString(),
        weakChapters: [],
        weakTopics: [],
        recommendationText: "Chào mừng bạn đến với Nền tảng luyện thi Kinh tế chính trị Mác - Lênin! Hệ thống ghi nhận bạn chưa làm bài tập nào. Hãy bắt đầu bằng cách làm đề luyện tập **Ngẫu nhiên 10 câu** hoặc ôn tập theo **Chương 1** để hệ thống thu thập dữ liệu chẩn đoán năng lực của bạn.",
        suggestedAction: {
          type: "smart-exam",
          count: 10
        }
      };
    }

    // Identify weak chapters (accuracy < 70% and total > 0)
    const weakChapters: number[] = [];
    Object.entries(stats.accuracyByChapter).forEach(([chIdStr, data]) => {
      const chId = parseInt(chIdStr);
      if (data.total > 0) {
        const accuracy = data.correct / data.total;
        if (accuracy < 0.7) {
          weakChapters.push(chId);
        }
      }
    });

    // Identify weak topics (accuracy < 65% and total > 0)
    const weakTopics: string[] = [];
    Object.entries(stats.accuracyByTopic).forEach(([tId, data]) => {
      if (data.total > 0) {
        const accuracy = data.correct / data.total;
        if (accuracy < 0.65) {
          weakTopics.push(tId);
        }
      }
    });

    let recommendationText = "";
    let actionType: "smart-exam" | "chapter-review" | "topic-review" = "smart-exam";
    let actionChapterId: number | undefined;
    let actionTopicId: string | undefined;
    let actionCount = 10;

    const overallAccuracy = stats.totalSolved > 0 ? (stats.totalCorrect / stats.totalSolved) * 100 : 0;

    if (weakChapters.length > 0) {
      // Sort weak chapters by accuracy (worst first)
      weakChapters.sort((a, b) => {
        const accA = stats.accuracyByChapter[a].correct / stats.accuracyByChapter[a].total;
        const accB = stats.accuracyByChapter[b].correct / stats.accuracyByChapter[b].total;
        return accA - accB;
      });

      const primaryWeakChId = weakChapters[0];
      const primaryCh = chapters.find(c => c.id === primaryWeakChId);
      const chAcc = Math.round((stats.accuracyByChapter[primaryWeakChId].correct / stats.accuracyByChapter[primaryWeakChId].total) * 100);

      recommendationText = `### Phân tích Chẩn đoán năng lực:
Hệ thống AI nhận diện bạn đang gặp khó khăn nhiều nhất ở **${primaryCh?.title}** với tỷ lệ làm đúng khá thấp (chỉ đạt **${chAcc}%**). 

### Gợi ý lộ trình ôn tập:
1. **Ôn lại lý thuyết**: Bạn nên xem lại slide bài giảng và giáo trình liên quan đến chương này.
2. **Luyện tập trọng tâm**: Tập trung giải các câu hỏi của chương này để khắc sâu kiến thức.
3. **Giải thích chi tiết**: Sử dụng nút **Hỏi giải thích AI** ở mỗi câu làm sai để thấu hiểu bản chất.

Chúng tôi khuyến nghị bạn thực hiện ngay một đề **Ôn tập trọng tâm Chương ${primaryWeakChId}** với 15 câu để cải thiện điểm số.`;

      actionType = "chapter-review";
      actionChapterId = primaryWeakChId;
      actionCount = 15;
    } else if (weakTopics.length > 0) {
      // Sort weak topics
      weakTopics.sort((a, b) => {
        const accA = stats.accuracyByTopic[a].correct / stats.accuracyByTopic[a].total;
        const accB = stats.accuracyByTopic[b].correct / stats.accuracyByTopic[b].total;
        return accA - accB;
      });

      const primaryWeakTId = weakTopics[0];
      const primaryTopic = topics.find(t => t.id === primaryWeakTId);
      const tAcc = Math.round((stats.accuracyByTopic[primaryWeakTId].correct / stats.accuracyByTopic[primaryWeakTId].total) * 100);

      recommendationText = `### Phân tích Chẩn đoán năng lực:
Năng lực tổng thể của bạn rất tốt! Tuy nhiên, bạn có một điểm khuyết nhỏ ở chủ đề **"${primaryTopic?.title}"** với tỷ lệ chính xác chỉ đạt **${tAcc}%**.

### Gợi ý lộ trình:
Hãy làm một bộ đề luyện tập ngắn (10 câu) tập trung riêng biệt vào chủ đề này để lấp đầy lỗ hổng kiến thức và tối ưu hóa điểm số thi thật của bạn.`;

      actionType = "topic-review";
      actionTopicId = primaryWeakTId;
      actionCount = 10;
    } else {
      // User is doing great!
      recommendationText = `### Chúc mừng phong độ xuất sắc!
Bạn đang có phong độ học tập cực kỳ ấn tượng với tỷ lệ làm đúng trung bình đạt **${Math.round(overallAccuracy)}%** và không có chương yếu nào dưới 70%!

### Gợi ý lộ trình:
Để chuẩn bị tốt nhất cho kỳ thi chính thức đạt điểm tối đa (A+), bạn hãy thử sức với chế độ **AI Smart Exam (Đề thi thử AI)** được thiết kế mô phỏng tỷ lệ phân bổ chương và độ khó chuẩn như một đề thi đại học chính thức.`;

      actionType = "smart-exam";
      actionCount = 20;
    }

    return {
      id: `local-rec-${TimeService.nowTimestamp()}`,
      date: TimeService.now().toISOString(),
      weakChapters,
      weakTopics,
      recommendationText,
      suggestedAction: {
        type: actionType,
        chapterId: actionChapterId,
        topicId: actionTopicId,
        count: actionCount
      }
    };
  },

  /**
   * Fetches advanced explanation from server-side Gemini client
   */
  async getAIExplanation(questionId: number, selectedAnswer?: string, explanationLevel?: string): Promise<string> {
    try {
      const activeSubjectId = dbService.getActiveSubjectId();
      const activeSubjectName = dbService.getActiveSubjectName();
      const q = questionMap.get(questionId);
      
      let learnerProfile: any = null;
      if (q) {
        const conceptNode = kbService.getConceptForQuestion(activeSubjectId, q);
        if (conceptNode) {
          learnerProfile = learnerModelService.getOrCreateProfile(conceptNode.concept);
        }
      }

      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: await apiHeaders(),
        body: JSON.stringify({ 
          questionId, 
          selectedAnswer, 
          explanationLevel: explanationLevel || "academic", 
          learnerProfile,
          subjectName: activeSubjectName
        }),
      });
      if (!response.ok) {
        throw new Error("API request failed");
      }
      const data = await response.json();
      return data.explanation;
    } catch (error) {
      console.warn("Gemini explainer unavailable, generating local explanation:", error);
      const q = questionMap.get(questionId);
      if (!q) return "Không tìm thấy câu hỏi.";
      return `*(Chế độ ngoại tuyến)*\n\n**Đáp án đúng**: **${q.correctAnswer.toUpperCase()}** - ${q.options[q.correctAnswer]}\n\n### Giải thích chi tiết:\n${q.explanation}\n\n### Ánh xạ kiến thức:\n- **Chương**: ${q.chapterId}\n- **Chủ đề**: ${q.topicId} (${topicMap.get(q.topicId)?.title || q.topicId})\n- **Nguồn tài liệu**: *${q.sourcePdf}* (Trang ${q.sourcePage})\n- **Từ khóa**: ${q.knowledgeMapping.join(", ")}`;
    }
  },

  /**
   * Fetches the complete advanced evidence-based reasoning pipeline's results
   */
  async getAIPipelineExplanation(questionId: number, selectedAnswer?: string, explanationLevel?: string): Promise<{
    explanation: string;
    strategyUsed: string;
    guessingProbability: number;
    unmasteredPrerequisites: string[];
    crossSubjectIntel: any;
    validationReport: any;
  }> {
    try {
      const activeSubjectId = dbService.getActiveSubjectId();
      const activeSubjectName = dbService.getActiveSubjectName();
      const q = questionMap.get(questionId);
      
      let learnerProfile: any = null;
      if (q) {
        const conceptNode = kbService.getConceptForQuestion(activeSubjectId, q);
        if (conceptNode) {
          learnerProfile = learnerModelService.getOrCreateProfile(conceptNode.concept);
        }
      }

      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: await apiHeaders(),
        body: JSON.stringify({ 
          questionId, 
          selectedAnswer, 
          explanationLevel: explanationLevel || "academic", 
          learnerProfile,
          subjectName: activeSubjectName
        }),
      });
      if (!response.ok) {
        throw new Error("API request failed");
      }
      const data = await response.json();
      return {
        explanation: data.explanation,
        strategyUsed: data.strategyUsed || "Academic Lecture",
        guessingProbability: data.guessingProbability || 0,
        unmasteredPrerequisites: data.unmasteredPrerequisites || [],
        crossSubjectIntel: data.crossSubjectIntel || null,
        validationReport: data.validationReport || { isValid: true, score: 100, failedChecks: [] }
      };
    } catch (error) {
      console.warn("Gemini explainer pipeline unavailable, generating local explanation:", error);
      const q = questionMap.get(questionId);
      const fallbackText = q 
        ? `*(Chế độ ngoại tuyến)*\n\n**Đáp án đúng**: **${q.correctAnswer.toUpperCase()}** - ${q.options[q.correctAnswer]}\n\n### Giải thích chi tiết:\n${q.explanation}\n\n### Ánh xạ kiến thức:\n- **Chương**: ${q.chapterId}\n- **Chủ đề**: ${q.topicId} (${topicMap.get(q.topicId)?.title || q.topicId})\n- **Nguồn tài liệu**: *${q.sourcePdf}* (Trang ${q.sourcePage})\n- **Từ khóa**: ${q.knowledgeMapping.join(", ")}`
        : "Không tìm thấy câu hỏi.";

      return {
        explanation: fallbackText,
        strategyUsed: "Offline Local Fallback",
        guessingProbability: 0,
        unmasteredPrerequisites: [],
        crossSubjectIntel: null,
        validationReport: { isValid: true, score: 100, failedChecks: [] }
      };
    }
  },

  /**
   * Fetches advanced personalized recommendations from Gemini
   */
  async getGeminiRecommendation(): Promise<AIRecommendation> {
    try {
      const stats = dbService.getStatistics();
      const activeSubjectName = dbService.getActiveSubjectName();
      const response = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: await apiHeaders(),
        body: JSON.stringify({ stats, subjectName: activeSubjectName }),
      });
      if (!response.ok) {
        throw new Error("API request failed");
      }
      return await response.json();
    } catch (error) {
      console.warn("Gemini recommendation unavailable, using local diagnostic heuristics:", error);
      return this.generateLocalRecommendation();
    }
  },

  /**
   * Asks AI Tutor a question with server API fallback
   */
  async askTutorQuestion(message: string): Promise<string> {
    try {
      const activeSubjectName = dbService.getActiveSubjectName();
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: await apiHeaders(),
        body: JSON.stringify({ message, subjectName: activeSubjectName }),
      });
      if (!response.ok) throw new Error("API request failed");
      const data = await response.json();
      return data.reply || data.response || "Tôi đã ghi nhận câu hỏi của bạn.";
    } catch (error) {
      console.warn("Gemini chat unavailable, fallback:", error);
      return "Xin chào! Tôi là Trợ lý AI Khảo thí. Hiện tại đang ở chế độ offline, nhưng tôi vẫn có thể hỗ trợ bạn chọn đề thi, ôn luyện khái niệm và phân tích tiến độ học tập.";
    }
  },

  /**
   * Sinh ngân hàng câu hỏi từ tài liệu (Gemini 3.6 Flash): tự chia nhỏ nội dung dài thành
   * nhiều đoạn, gọi AI nhiều lượt (mỗi lượt tối đa 8 câu, chạy tuần tự tránh nghẽn), khử
   * trùng lặp rồi lưu vào ngân hàng của môn đang chọn.
   * onProgress(batchDone, totalBatches, accumulated) để cập nhật tiến trình theo lượt.
   */
  async generateQuestionBankFromText(
    text: string,
    targetTotal: number,
    sourceTitle?: string,
    onProgress?: (batchDone: number, totalBatches: number, accumulated: number) => void,
    targetChapterId?: number
  ): Promise<{ added: number; requested: number; batches: number; duplicatesSkipped: number; failedBatches: number }> {
    const subjectId = dbService.getActiveSubjectId();
    const target = Math.min(Math.max(Math.floor(targetTotal) || 5, 2), 60);
    const perBatchMax = 8;

    const chunks = splitIntoChunks(text);

    // Phân bổ số câu cho từng đoạn (một lượt gọi/đoạn), dừng khi đủ mục tiêu.
    const plan: { chunk: string; count: number }[] = [];
    let remaining = target;
    for (let i = 0; i < chunks.length && remaining > 0; i++) {
      const chunksLeft = chunks.length - i;
      const share = Math.min(perBatchMax, Math.max(2, Math.ceil(remaining / chunksLeft)));
      const count = Math.min(share, remaining);
      plan.push({ chunk: chunks[i], count });
      remaining -= count;
    }
    const totalBatches = plan.length;

    // Khử trùng lặp so với câu đã có trong ngân hàng lẫn giữa các lượt.
    const seen = new Set(questions.map(q => normalizeQuestionText(q.question)));
    const source = (sourceTitle && sourceTitle.trim()) || "Tài liệu AI tạo sinh";

    const collected: any[] = [];
    let duplicatesSkipped = 0;
    let failedBatches = 0;
    let lastError: Error | null = null;

    for (let b = 0; b < plan.length; b++) {
      if (onProgress) onProgress(b, totalBatches, collected.length);
      try {
        const raw = await requestQuestionBatch(plan[b].chunk, plan[b].count, targetChapterId);
        for (const q of raw) {
          const key = normalizeQuestionText(q.question);
          if (!key) continue;
          if (seen.has(key)) { duplicatesSkipped++; continue; }
          seen.add(key);
          collected.push(q);
        }
      } catch (e: any) {
        // Một lượt lỗi không làm hỏng cả mẻ; đếm lại và ghi lỗi để báo cho người dùng.
        failedBatches++;
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    if (onProgress) onProgress(totalBatches, totalBatches, collected.length);

    if (collected.length === 0) {
      throw lastError || new Error("AI chưa tạo được câu hỏi hợp lệ. Hãy thử lại với nội dung dài và rõ hơn.");
    }

    // Gán ID mới không trùng rồi lưu một lần. Ép về chương đích nếu người dùng chỉ định.
    const existingIds = questions.map(q => q.id);
    let nextId = (existingIds.length ? Math.max(...existingIds) : 0) + 1;
    const processed: Question[] = collected.map(q => rawToQuestion(q, nextId++, source, targetChapterId));

    dbService.addQuestionsToSubject(subjectId, processed);
    return { added: processed.length, requested: target, batches: totalBatches, duplicatesSkipped, failedBatches };
  },

  /**
   * Generates a practicing exam attempt based on selected modes using Assessment Design Engine
   */
  generateExam(config: {
    type: ExamAttempt["examType"];
    chapterId?: number;
    topicId?: string;
    difficulty?: DifficultyLevel;
    count?: number;
  }): ExamAttempt {
    // 1. Generate 100% deterministic ExamSpecification first via Assessment Design Engine
    const specType = config.type === "ai-smart" ? "mock" : config.type as any;
    const examSpec = assessmentDesignEngine.designExam({
      examType: specType,
      questionCount: config.count || (config.type === "ai-smart" ? 20 : 10),
      chapterId: config.chapterId,
      topicId: config.topicId,
      difficulty: config.difficulty
    });

    let pool = [...questions];

    // Filter candidate pool according to config
    if (config.type === "chapter" && config.chapterId) {
      pool = pool.filter(q => q.chapterId === config.chapterId);
    } else if (config.type === "topic" && config.topicId) {
      pool = pool.filter(q => q.topicId === config.topicId);
    } else if (config.type === "difficulty" && config.difficulty) {
      pool = pool.filter(q => q.difficulty === config.difficulty);
    } else if (config.type === "incorrect") {
      const stats = dbService.getStatistics();
      const incorrectIds = Object.keys(stats.incorrectQuestionHistory).map(id => parseInt(id));
      pool = pool.filter(q => incorrectIds.includes(q.id));
    } else if (config.type === "bookmark") {
      const stats = dbService.getStatistics();
      pool = pool.filter(q => stats.bookmarks.includes(q.id));
    } else if (config.type === "adaptive") {
      const scored = learningEngine.scoreQuestions(pool);
      scored.sort((a, b) => (b.score + Math.random() * 2) - (a.score + Math.random() * 2));
      pool = scored.map(s => s.q);
    }

    // Chống lặp câu cũ + ôn tập thông minh.
    if (config.type === "random") {
      // Đề ngẫu nhiên tổng hợp = ôn tập để NHỚ LÂU: ưu tiên theo khoa học ghi nhớ (giãn cách + xen kẽ):
      //   1) câu TỪNG SAI (nợ kiến thức, cần gặp lại để củng cố)
      //   2) câu CHƯA TỪNG LÀM (mở rộng độ phủ)
      //   3) câu ĐÃ ĐÚNG (ôn lại giãn cách để khỏi quên)
      // Trong mỗi nhóm, câu chưa ra gần đây đứng trước; câu vừa ra dồn xuống cuối để tránh lặp ngay.
      const stats = dbService.getStatistics();
      const wrong = new Set<number>(Object.keys(stats.incorrectQuestionHistory || {}).map(id => parseInt(id)));
      const answered = new Set<number>();
      dbService.getHistory().forEach(h => {
        if (h && h.answers) Object.keys(h.answers).forEach(id => answered.add(parseInt(id)));
      });
      const recent = new Set<number>(workspaceService.getRecentlyServedQuestionIds());
      const notRecent = (q: Question) => !recent.has(q.id);
      const wrongB = shuffleInPlace(pool.filter(q => wrong.has(q.id) && notRecent(q)));
      const freshB = shuffleInPlace(pool.filter(q => !answered.has(q.id) && !wrong.has(q.id) && notRecent(q)));
      const correctB = shuffleInPlace(pool.filter(q => answered.has(q.id) && !wrong.has(q.id) && notRecent(q)));
      const recentB = shuffleInPlace(pool.filter(q => recent.has(q.id)));
      pool = [...wrongB, ...freshB, ...correctB, ...recentB];
    } else if (config.type !== "adaptive") {
      // Các loại đề còn lại (đã tự sắp theo điểm với "adaptive"): xếp ưu tiên theo 2 tiêu chí:
      // (1) chưa từng làm hơn đã làm, (2) chưa ra gần đây hơn vừa ra.
      const answered = new Set<number>();
      dbService.getHistory().forEach(h => {
        if (h && h.answers) Object.keys(h.answers).forEach(id => answered.add(parseInt(id)));
      });
      const recent = new Set<number>(workspaceService.getRecentlyServedQuestionIds());
      const freshNew = shuffleInPlace(pool.filter(q => !answered.has(q.id) && !recent.has(q.id)));
      const seenNew = shuffleInPlace(pool.filter(q => answered.has(q.id) && !recent.has(q.id)));
      const freshRecent = shuffleInPlace(pool.filter(q => !answered.has(q.id) && recent.has(q.id)));
      const seenRecent = shuffleInPlace(pool.filter(q => answered.has(q.id) && recent.has(q.id)));
      pool = [...freshNew, ...seenNew, ...freshRecent, ...seenRecent];
    }

    // Với các loại đề có ràng buộc (chương, chủ đề, mức độ, câu sai, câu đánh dấu),
    // KHÔNG được lấy bù từ toàn bộ ngân hàng câu hỏi khi lọc ra rỗng, nếu không
    // "đề theo Chương X" sẽ bị trộn câu của chương khác mà vẫn dán nhãn Chương X.
    const constrainedTypes = ["chapter", "topic", "difficulty", "incorrect", "bookmark"];
    if (pool.length === 0 && !constrainedTypes.includes(config.type as string)) {
      pool = [...questions];
    }

    // 2. Fulfill ExamSpecification question by question
    const selectedQuestions: Question[] = [];
    const usedIds = new Set<number>();

    examSpec.questionSpecs.forEach(qSpec => {
      // Try best match: chapter & difficulty & concept
      let match = pool.find(q => !usedIds.has(q.id) && q.chapterId === qSpec.chapterId && q.knowledgeMapping?.includes(qSpec.concept));
      if (!match) {
        match = pool.find(q => !usedIds.has(q.id) && q.chapterId === qSpec.chapterId);
      }
      if (!match) {
        match = pool.find(q => !usedIds.has(q.id));
      }

      if (match) {
        usedIds.add(match.id);
        selectedQuestions.push(match);
      }
    });

    // Fallback if less than target count
    const targetCount = config.count || examSpec.questionCount;
    while (selectedQuestions.length < targetCount && selectedQuestions.length < pool.length) {
      const remaining = pool.find(q => !usedIds.has(q.id));
      if (!remaining) break;
      usedIds.add(remaining.id);
      selectedQuestions.push(remaining);
    }

    // 3. Review assembled exam via Exam Review Engine
    const reviewResult = examReviewEngine.reviewExam(examSpec, selectedQuestions);

    // Ghi nhận các câu vừa ra để lượt sau tránh lặp lại ngay (chống lặp câu cũ).
    workspaceService.recordServedQuestionIds(selectedQuestions.map(q => q.id));

    return {
      id: `exam-${config.type}-${TimeService.nowTimestamp()}`,
      examType: config.type,
      chapterId: config.chapterId,
      topicId: config.topicId,
      difficulty: config.difficulty,
      startTime: TimeService.now().toISOString(),
      questions: selectedQuestions.map(q => q.id),
      answers: {},
      bookmarks: [],
      flags: [],
      isSubmitted: false,
      score: 0,
      timeSpent: 0,
      examSpecification: examSpec,
      examReviewResult: reviewResult
    };
  }
};
