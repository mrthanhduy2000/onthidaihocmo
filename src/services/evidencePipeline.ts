/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService, questionMap, questions, topics, chapters, topicMap, chapterMap } from "./db";
import { kbService, KnowledgeNode, BlueprintItem, DistractorItem } from "./kbService";
import { learnerModelService, ConceptProfile, studentModelService, StudentModel } from "./learnerModel";
import { teachingDecisionEngine, TeachingDecision } from "./teachingDecisionEngine";
import { learningPlanner, LearningPlan } from "./learningPlanner";
import { responseFormatterService } from "./responseFormatter";
import { contextWindowBuilder } from "./contextWindowBuilder";
import { promptBuilder36 } from "./promptBuilder36";
import { GEMINI_EXPLANATION_RESPONSE_SCHEMA } from "./aiResponseSchema";
import { outputValidationService } from "./outputValidationService";
import { aiProviderRegistry } from "./aiProvider";
import { telemetryService } from "./telemetryService";
import { TimeService } from "./time";
import { Question } from "../types";
import { pedagogicalEvaluationEngine } from "./pedagogicalEvaluationEngine";
import { adaptiveTeachingPolicy } from "./adaptiveTeachingPolicy";
import { studentEvolutionEngine } from "./studentEvolutionEngine";
import { conceptMemoryService } from "./conceptMemoryService";
import { authoritativeKnowledgePolicy } from "./authoritativeKnowledgePolicy";

// ==========================================
// 1. TYPING & INTERFACES
// ==========================================

export interface EvidenceSet {
  conceptName: string;
  definition: string;
  knowledgeNode: KnowledgeNode | null;
  knowledgeGraphLinks: string[];
  slideSource: { pdf: string; page: string | number };
  textbookContext: string;
  reviewMetadata: {
    priority: "high" | "medium" | "low";
    studyMinutes: number;
    retentionDifficulty: string;
  };
  blueprints: BlueprintItem[];
  caseStudy: string;
  faq: { question: string; answer: string }[];
  usingFallbackSearch: boolean;
}

export interface ReasoningContext {
  learnerObjective: string;
  questionAnalysis: string;
  bloomLevel: string;
  difficultyLevel: string;
  unmasteredPrerequisites: string[];
  detectedMisconception: {
    hasMisconception: boolean;
    description: string;
    triggeringOption?: string;
  };
  forgettingScore: number;
  isOverdueReview: boolean;
}

export interface AIMemoryEntry {
  questionId: number;
  conceptName: string;
  selectedAnswer?: string;
  analogyUsed?: string;
  misconceptionFlagged?: string;
  timestamp: string;
}

export interface GuessAnalysis {
  isGuessLikely: boolean;
  probability: number; // 0.0 to 1.0
  reasons: string[];
}

export interface ValidationReport {
  isValid: boolean;
  score: number; // 0 to 100
  failedChecks: string[];
  correctedText?: string;
}

// ==========================================
// 2. CORE ENGINES IMPLEMENTATION
// ==========================================

/**
 * [Evidence Retrieval Engine]
 * Retrieves factual knowledge, slide links, textbook content, blueprints, case studies, and FAQs.
 * Fallback to AI Search only if local DB is entirely blank on the topic.
 */
export const EvidenceRetrievalEngine = {
  retrieveEvidence(subjectId: string, qId: number, query?: string): EvidenceSet {
    const q = questionMap.get(qId);
    let conceptName = "Khái niệm học thuật";
    let definition = "Nội dung lý luận môn học.";
    let node: KnowledgeNode | null = null;
    let slideSource: { pdf: string; page: string | number } = { pdf: "Giáo trình và Slide chính thức.pdf", page: "Chưa rõ" };

    if (q) {
      conceptName = q.concept || q.knowledgeMapping?.[0] || conceptName;
      node = kbService.getConceptForQuestion(subjectId, q);
      slideSource = { pdf: q.sourcePdf, page: q.sourcePage };
    }

    if (node) {
      conceptName = node.concept;
      definition = node.definition;
    }

    // Knowledge Graph Links (Requires & RequiredBy)
    const links: string[] = [];
    if (node?.dependencies) {
      node.dependencies.requires.forEach(r => links.push(`Yêu cầu học trước: ${r}`));
      node.dependencies.requiredBy.forEach(r => links.push(`Làm nền tảng cho: ${r}`));
      node.dependencies.relatedConcepts.forEach(r => links.push(`Liên kết chặt chẽ: ${r}`));
    }

    // Textbook Context
    const textbookContext = node?.explanation?.expertExplanation || node?.details || q?.explanation || definition;

    // Review Metadata
    const reviewMetadata = {
      priority: node?.review?.reviewPriority || "medium",
      studyMinutes: node?.review?.estimatedStudyMinutes || 10,
      retentionDifficulty: node?.review?.estimatedRetentionDifficulty || "medium"
    };

    // Blueprint Items
    const allBlueprints = kbService.getBlueprints(subjectId);
    const blueprints = allBlueprints.filter(bp => bp.id === node?.id || bp.concept.toLowerCase() === conceptName.toLowerCase());

    // Case Study
    const caseStudy = node?.marketingApplication || node?.teaching?.realWorldExample || "Không có tình huống mẫu cụ thể.";

    // FAQ
    const faq: { question: string; answer: string }[] = [];
    if (node?.explanation?.commonStudentQuestion) {
      faq.push({
        question: node.explanation.commonStudentQuestion,
        answer: node.explanation.answerTemplate || "Xem hướng dẫn chi tiết của giáo viên."
      });
    }

    return {
      conceptName,
      definition,
      knowledgeNode: node,
      knowledgeGraphLinks: links,
      slideSource,
      textbookContext,
      reviewMetadata,
      blueprints,
      caseStudy,
      faq,
      usingFallbackSearch: !node
    };
  }
};

/**
 * [Reasoning Engine]
 * Performs purely programmatic calculations regarding prerequisites, bloom levels,
 * spaced repetition schedules, and student mistakes (misconceptions).
 */
export const ReasoningEngine = {
  analyzeReasoning(subjectId: string, qId: number, selectedAnswer?: string): ReasoningContext {
    const q = questionMap.get(qId);
    const node = q ? kbService.getConceptForQuestion(subjectId, q) : null;
    const conceptName = node?.concept || q?.concept || q?.knowledgeMapping?.[0] || "";

    const activeSubjectId = dbService.getActiveSubjectId();
    const graph = kbService.getKnowledgeGraph(activeSubjectId);
    const nodeMap = new Map<string, KnowledgeNode>();
    graph.forEach(n => {
      nodeMap.set(n.concept.toLowerCase(), n);
      nodeMap.set(n.id.toLowerCase(), n);
    });

    // 1. Learner Objective
    const learnerObjective = q?.learningObjective || node?.teaching?.learningObjective || "Hiểu sâu sắc kiến thức bài học.";

    // 2. Question Analysis
    const questionAnalysis = q ? `Câu hỏi trắc nghiệm kiểm tra mức Bloom: ${q.bloomLevel || "Understand"} thuộc chủ đề ${q.topicId}.` : "";

    // 3. Bloom & Difficulty
    const bloomLevel = q?.bloomLevel || "Understand";
    const difficultyLevel = q?.difficulty || "Trung bình";

    // 4. Check unmastered prerequisites
    const unmasteredPrerequisites: string[] = [];
    const stats = dbService.getStatistics();
    if (node?.dependencies?.requires) {
      node.dependencies.requires.forEach(reqNameOrId => {
        const reqNode = nodeMap.get(reqNameOrId.toLowerCase());
        if (reqNode) {
          const reqMastery = stats.conceptMastery?.[reqNode.concept] ?? stats.conceptMastery?.[reqNode.id] ?? 50;
          if (reqMastery < 50) {
            unmasteredPrerequisites.push(reqNode.concept);
          }
        }
      });
    }

    // 5. Misconception analysis
    let hasMisconception = false;
    let description = "";
    if (q && selectedAnswer && selectedAnswer !== q.correctAnswer) {
      hasMisconception = true;
      // Đi qua `layCanhBaoBayHocThuat` thay vì đọc thẳng `node.teaching.misconception`, để nút
      // TỔNG HỢP TỰ ĐỘNG của môn tự tạo không lọt chuỗi mẫu vào đây. Chuỗi đó đúng với mọi khái
      // niệm nên không nói lên gì, mà lại được trình bày như một bẫy đã biết.
      description = q.misconception
        || kbService.layCanhBaoBayHocThuat(subjectId, q)
        || "Sinh viên chưa phân biệt rõ bản chất học thuật của khái niệm.";
      
      // Look up specific distractor details if available
      const distractors = kbService.getDistractors(subjectId, node?.id || "");
      const matchedDistractor = distractors.find(d => d.correctAnswer === q.correctAnswer && d.distractor.toLowerCase().includes(selectedAnswer.toLowerCase()));
      if (matchedDistractor) {
        description = matchedDistractor.reason;
      }
    }

    // 6. Forgetting state
    let forgettingScore = 1.0;
    let isOverdueReview = false;
    if (conceptName) {
      const profile = learnerModelService.getOrCreateProfile(conceptName);
      forgettingScore = profile.forgettingScore;
      isOverdueReview = profile.nextReviewAt ? new Date(profile.nextReviewAt).getTime() < TimeService.now().getTime() : false;
    }

    return {
      learnerObjective,
      questionAnalysis,
      bloomLevel,
      difficultyLevel,
      unmasteredPrerequisites,
      detectedMisconception: {
        hasMisconception,
        description,
        triggeringOption: selectedAnswer
      },
      forgettingScore,
      isOverdueReview
    };
  }
};

/**
 * [Teaching Strategy Engine]
 * Dynamically selects explanations based on user mastery and retry counts.
 * Integrates Socratic Tutor and Explain Again systems.
 */
export const TeachingStrategyEngine = {
  determineStrategy(
    subjectId: string,
    conceptName: string,
    historyCount: number,
    learnerProfile: ConceptProfile
  ): { strategy: string; instructions: string } {
    const mastery = dbService.getStatistics().conceptMastery?.[conceptName] || 50;

    // Socratic Mode triggers when student asks multiple times or has high attempts with low accuracy
    if (historyCount >= 2 || (learnerProfile.attemptsCount >= 3 && learnerProfile.correctCount / learnerProfile.attemptsCount < 0.4)) {
      return {
        strategy: "Socratic",
        instructions: "HÃY SỬ DỤNG PHƯƠNG PHÁP SOCRATIC. Không cung cấp trực tiếp câu trả lời ngay lập tức. Hãy dẫn dắt người học bằng 1 câu gợi ý lý thuyết ngắn, sau đó hỏi 1 câu hỏi dẫn dắt (Socratic prompt) để kích thích họ tự suy luận ra đáp án đúng."
      };
    }

    // Explain Again Mode triggers if they are asking the exact concept for the second time
    if (historyCount === 1) {
      return {
        strategy: "Explain Again",
        instructions: "HÃY THAY ĐỔI HOÀN TOÀN CÁCH GIẢI THÍCH (Explain Again). Tránh lặp lại lối lập luận cũ. Hãy sử dụng một PHÉP ẨN DỤ (Analogy) hoàn toàn mới, phân rã khái niệm phức tạp thành các mẩu kiến thức nhỏ (chunking) và hỏi xem người học bị vướng mắc ở mắt xích cụ thể nào."
      };
    }

    // Normal Strategies based on Mastery Levels
    if (mastery < 45) {
      return {
        strategy: "Simple/Analogy",
        instructions: "HÃY GIẢI THÍCH THẬT ĐƠN GIẢN, TRỰC QUAN. Sử dụng các ẩn dụ thực tế đời sống quen thuộc. Tránh dùng thuật ngữ bác học chồng chéo. Phù hợp cho trình độ nhập môn."
      };
    } else if (mastery > 80) {
      return {
        strategy: "Expert Deep-Dive",
        instructions: "HÃY ĐÓNG VAI CHUYÊN GIA/BIÊN SOẠN KHẢO THÍ ĐẦU NGÀNH. Phân tích lý luận phản biện nâng cao, chỉ ra mối quan hệ cấu trúc học thuật và liên hệ với các góc nhìn kinh tế/doanh nghiệp toàn cầu."
      };
    }

    // Default Academic Strategy
    return {
      strategy: "Academic Lecture",
      instructions: "HÃY GIẢI THÍCH CHUẨN SƯ PHẠM ĐẠI HỌC. Trình bày khoa học, chặt chẽ, rành mạch từng phần: Lý giải đáp án đúng, Phân tích phương án sai, và Mẹo ghi nhớ."
    };
  }
};

/**
 * [AIMemory 2.0 Engine]
 * Persists student question, choices, and previous pedagogical interactions in LocalStorage.
 */
export const AIMemory2Engine = {
  getMemoryStore(subjectId: string): AIMemoryEntry[] {
    const key = `poly_econ_ai_memory_v2_${subjectId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveMemoryStore(subjectId: string, store: AIMemoryEntry[]): void {
    const key = `poly_econ_ai_memory_v2_${subjectId}`;
    localStorage.setItem(key, JSON.stringify(store.slice(-50))); // Keep last 50 interactions
  },

  logInteraction(subjectId: string, entry: Omit<AIMemoryEntry, "timestamp">): void {
    const store = this.getMemoryStore(subjectId);
    store.push({
      ...entry,
      timestamp: TimeService.now().toISOString()
    });
    this.saveMemoryStore(subjectId, store);
  },

  getConceptQueryCount(subjectId: string, conceptName: string): number {
    const store = this.getMemoryStore(subjectId);
    return store.filter(e => e.conceptName === conceptName).length;
  }
};

/**
 * [Confidence Engine & Forgetting Curve]
 */
export const ConfidenceEngine = {
  calculateEstimatedConfidence(profile: ConceptProfile, timeSpent: number, isCorrect: boolean): number {
    let score = profile.confidence;

    // Time multiplier: answering too fast (< 10s) or too slow (> 120s) adjust confidence slightly
    if (isCorrect) {
      if (timeSpent >= 15 && timeSpent <= 45) {
        score = Math.min(1.0, score + 0.08); // Optimal thinking window
      } else if (timeSpent < 8) {
        score = Math.min(1.0, score + 0.02); // Possible guess or extremely proficient
      }
    } else {
      score = Math.max(0.0, score - 0.12);
    }

    return parseFloat(score.toFixed(3));
  }
};

/**
 * [Citation Engine]
 * Ensures strict verifiability by dividing facts into 'Standard Textbook Cites' and 'AI Reasoning Extensions'.
 */
export const CitationEngine = {
  formatCitations(evidence: EvidenceSet): string {
    const chId = evidence.knowledgeNode?.chapter;
    const chTitle = chId ? (chapterMap.get(chId)?.title || `Chương ${chId}`) : "Chưa rõ";
    const topicId = evidence.knowledgeNode?.topic;
    const topicTitle = topicId ? (topicMap.get(topicId)?.title || topicId) : "Chưa rõ";
    const concept = evidence.conceptName;

    return `\n\n---
### 📚 TÀI LIỆU CHỨNG CỨ TRÍCH DẪN (VERIFIABLE SOURCE CITATIONS)
- **Học phần**: ${dbService.getActiveSubjectName()}
- **Khái niệm gốc**: \`${concept}\`
- **Nguồn tài liệu**: Knowledge Base - ${chTitle} - ${topicTitle}
- **Vị trí tài liệu phụ trợ** (nếu có): *${evidence.slideSource.pdf}* (Trang/Slide ${evidence.slideSource.page})
- **Định nghĩa chuẩn Giáo trình**: "${evidence.definition}"
- **Bản đồ năng lực (Knowledge Graph Links)**:
${evidence.knowledgeGraphLinks.map(link => `  * ${link}`).join("\n")}

*LƯU Ý AN TOÀN HỌC THUẬT: Những luận điểm nằm trong khung chứng cứ trên được trích xuất trực tiếp từ bài giảng của Nhà trường. Mọi lập luận giải thích bổ trợ bên dưới do AI suy luận logic tự động để giúp sinh viên trực quan hóa lý thuyết.*`;
  }
};

/**
 * [Guess Detection & Assessment Engine]
 * Evaluates answer correctness, response speed, and prerequisites to detect guessing probability.
 */
export const GuessDetectionEngine = {
  analyzeGuessing(
    timeSpent: number,
    correctAnswerSelected: boolean,
    prerequisiteUnmasteredCount: number,
    currentConfidence: number
  ): GuessAnalysis {
    let probability = 0.0;
    const reasons: string[] = [];

    if (!correctAnswerSelected) {
      return { isGuessLikely: false, probability: 0, reasons };
    }

    // Reason 1: Extremely fast response (< 8 seconds)
    if (timeSpent < 8) {
      probability += 0.5;
      reasons.push(`Tốc độ làm bài siêu tốc (${timeSpent} giây)`);
    }

    // Reason 2: Key prerequisites are entirely unmastered
    if (prerequisiteUnmasteredCount > 0) {
      probability += 0.25 * prerequisiteUnmasteredCount;
      reasons.push(`Thiếu hụt nặng lý thuyết tiên quyết (${prerequisiteUnmasteredCount} khái niệm chưa vững)`);
    }

    // Reason 3: Very low profile confidence
    if (currentConfidence < 0.3) {
      probability += 0.2;
      reasons.push(`Chỉ số tự tin tích lũy rất thấp (${Math.round(currentConfidence * 100)}%)`);
    }

    probability = Math.min(1.0, Math.max(0.0, probability));
    const isGuessLikely = probability >= 0.65;

    return {
      isGuessLikely,
      probability: parseFloat(probability.toFixed(2)),
      reasons
    };
  }
};

/**
 * [Evidence Validation Engine]
 * Double-checks the generated text against retrieved evidence blocks to prevent AI hallucinations.
 */
export const EvidenceValidationEngine = {
  validateOutput(generatedText: string, evidence: EvidenceSet): ValidationReport {
    const failedChecks: string[] = [];
    let score = 100;

    // Rule 1: Text must mention the core concept name
    const conceptRegex = new RegExp(evidence.conceptName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (!conceptRegex.test(generatedText)) {
      failedChecks.push(`Thiếu từ khóa khái niệm chính "${evidence.conceptName}" trong bài giảng.`);
      score -= 30;
    }

    // Rule 2: Must not contradict standard definition keywords
    // Extract key nouns/terms from definition to check
    const definitionWords = evidence.definition
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 4);
    
    let matchCount = 0;
    definitionWords.slice(0, 8).forEach(w => {
      if (generatedText.toLowerCase().includes(w)) {
        matchCount++;
      }
    });

    if (matchCount < Math.min(2, definitionWords.length)) {
      failedChecks.push("Lập luận AI quá rời rạc, có dấu hiệu lệch hướng khỏi chứng cứ định nghĩa gốc của giáo trình.");
      score -= 25;
    }

    // Rule 3: Must include citation boundaries & Authoritative Knowledge Policy Grounding Check
    const groundingResult = authoritativeKnowledgePolicy.evaluateGrounding(generatedText, evidence.definition);
    if (!groundingResult.isPolicyCompliant) {
      failedChecks.push(...groundingResult.violations);
      score -= groundingResult.violations.length * 15;
    }

    const hasCitation = generatedText.includes("TÀI LIỆU CHỨNG CỨ TRÍCH DẪN") || 
                        generatedText.includes("VERIFIABLE SOURCE CITATIONS") || 
                        generatedText.includes("START_CITATION_BLOCK") || 
                        generatedText.toLowerCase().includes("nguồn:");
    if (!hasCitation) {
      failedChecks.push("Thiếu nhãn trích dẫn học thuật bắt buộc.");
      score -= 20;
    }

    return {
      isValid: score >= 60,
      score: Math.max(0, score),
      failedChecks
    };
  }
};

/**
 * [Cross Subject Intelligence Engine]
 * Searches for inter-subject connections to build multi-disciplinary intelligence.
 */
export const CrossSubjectIntelligenceEngine = {
  findCrossSubjectConnection(subjectId: string, conceptName: string): { connectedSubject: string; topic: string; explanation: string } | null {
    const conceptLower = conceptName.toLowerCase();
    
    if (subjectId === "poli_econ") {
      if (conceptLower.includes("hàng hóa") || conceptLower.includes("thị trường") || conceptLower.includes("giá cả")) {
        return {
          connectedSubject: "Hành vi Khách hàng (Customer Behavior)",
          topic: "Tác động kích thích thị trường & Quyết định mua",
          explanation: "Trong Kinh tế chính trị, 'Hàng hóa' và 'Quy luật giá trị' quyết định giá trị thặng dư trao đổi. Sang môn 'Hành vi Khách hàng', chính các yếu tố giá cả và định vị giá trị này sẽ kích thích tâm lý nhận thức và tác động trực tiếp đến quyết định lựa chọn thương hiệu của người tiêu dùng."
        };
      }
    } else if (subjectId === "customer_behavior") {
      if (conceptLower.includes("nhận thức") || conceptLower.includes("thái độ")) {
        return {
          connectedSubject: "Kinh tế Chính trị Mác - Lênin",
          topic: "Ý thức xã hội & Quan hệ sản xuất",
          explanation: "Nhận thức và tâm lý người tiêu dùng là phản ánh của môi trường kinh tế vĩ mô. Quy luật giá trị và điều kiện sản xuất định hình khả năng thu nhập và thói quen tiêu dùng."
        };
      }
    }
    return null;
  }
};

/**
 * [Prompt Builder 2.0]
 * Converts a deterministic LearningPlan and EvidenceSet into a strict prompt for Gemini.
 * Gemini is strictly restricted to Natural Language Generation (NLG).
 */
export const PromptBuilder2 = {
  compilePrompt(params: {
    subjectName: string;
    question: Question;
    selectedAnswer?: string;
    evidence: EvidenceSet;
    reasoning: ReasoningContext;
    learningPlan: LearningPlan;
    crossSubject: any;
  }): { systemInstruction: string; prompt: string } {
    const q = params.question;
    const optLetters = ["a", "b", "c", "d"] as const;
    const optionText = optLetters.map(l => `${l.toUpperCase()}. ${q.options[l]}`).join("\n");

    const systemInstruction = `Bạn là một giảng viên đại học dạy môn ${params.subjectName} có phong cách giảng dạy thông thái, ngôn ngữ chuẩn mực chính xác, rành mạch và truyền cảm hứng học tập.
Bạn tuân thủ tuyệt đối quy định giảng dạy dựa trên bằng chứng (Evidence-Based Education). Bạn không bao giờ bịa đặt hay suy diễn kiến thức ngoài tài liệu chính thống.`;

    const prompt = `[HỆ THỐNG PHÂN TÍCH CHỨNG CỨ & LÝ LUẬN - PIPELINE v4.0 (AI LEARNING OPERATING SYSTEM)]
--------------------------------------------------
MÔN HỌC: ${params.subjectName}
CÂU HỎI KIỂM TRA: "${q.question}"
CÁC PHƯƠNG ÁN LỰA CHỌN:
${optionText}

ĐÁP ÁN ĐÚNG THEO KHẢO THÍ: ${q.correctAnswer.toUpperCase()} - "${q.options[q.correctAnswer]}"
${params.selectedAnswer ? `HỌC VIÊN ĐÃ CHỌN: ${params.selectedAnswer.toUpperCase()} - "${q.options[params.selectedAnswer as keyof typeof q.options] || ""}"` : "Học viên chưa chọn đáp án (đang xem lý thuyết chủ động)"}

--------------------------------------------------
[BƯỚC 1: CHỨNG CỨ TRÍCH XUẤT (EVIDENCE RETRIEVAL)]
- Định nghĩa chuẩn: "${params.evidence.definition}"
- Toàn văn lý thuyết: "${params.evidence.textbookContext}"

--------------------------------------------------
[BƯỚC 2: KẾ HOẠCH HỌC TẬP THỜI GIAN THỰC (REAL-TIME LEARNING PLAN)]
Hệ thống AI Learning OS đã tính toán và ban hành Kế hoạch học tập cố định dưới đây:
- Mục tiêu phiên học: ${params.learningPlan.objective}
- Khái niệm tập trung tiếp theo: ${params.learningPlan.nextConcept}
- Cấp độ tư duy (Bloom): ${params.learningPlan.bloom}
- Loại hình sư phạm: ${params.learningPlan.strategy}
- Độ sâu giải thích: ${params.learningPlan.explanationDepth}
${params.learningPlan.reviewReason ? `- Lý do ôn tập: ${params.learningPlan.reviewReason}` : ""}
- Cần ví dụ ẩn dụ (Analogy): ${params.learningPlan.analogy ? "Có" : "Không"}
- Cần phản ví dụ (Counter-Example): ${params.learningPlan.counterExample ? "Có" : "Không"}
- Cần thử thách micro-quiz: ${params.learningPlan.microQuiz ? "Có" : "Không"}

--------------------------------------------------
[BƯỚC 3: LIÊN KẾT LIÊN MÔN (CROSS SUBJECT INTELLIGENCE)]
${params.crossSubject ? `- Kết nối liên môn đến: ${params.crossSubject.connectedSubject} (Chủ đề: ${params.crossSubject.topic}) -> ${params.crossSubject.explanation}` : "- Không có kết nối liên môn đặc biệt ở mức độ này."}

--------------------------------------------------
[BƯỚC 4: HƯỚNG DẪN SINH NỘI DUNG TỰ NHIÊN CHO GEMINI (NO FORMATTING ALLOWED)]
Bạn là một LLM đóng vai trò người giảng dạy thông thái, nhưng bạn KHÔNG CÓ QUYỀN TỰ QUYẾT định chiến lược sư phạm hay định dạng giao diện. Bạn BẮT BUỘC phải thực hiện sinh nội dung thô (Raw Content) chính xác theo đúng các chỉ định trong Kế hoạch học tập ở Bước 2:

1. Bạn chỉ chịu trách nhiệm sinh nội dung tự nhiên, mượt mà, rành mạch bằng tiếng Việt. Tuyệt đối không nhắc lại các thông số lập trình hệ thống (như Bloom level, LearningPlan, v.v.).
2. Tuyệt đối không tự ý phát minh, suy diễn ra định nghĩa mới ngoài chứng cứ trích xuất ở Bước 1. Nếu cả giáo trình bài học lẫn tài liệu đều không nhắc đến chủ đề người dùng hỏi, hãy ghi rõ: "Tài liệu hiện có không đề cập nội dung này." và tuyệt đối không tự suy diễn thêm.
3. Nếu bạn đưa ra ví dụ minh họa do bạn tự tạo ra để bổ trợ học tập, bạn BẮT BUỘC phải chèn dòng chú thích: "(Ví dụ minh họa do AI tạo.)" ngay bên cạnh ví dụ đó.
4. Trình bày nội dung thô rành mạch theo các nhãn phân đoạn (section) cụ thể sau:
   - ### [KHÁI NIỆM]: Trình bày định nghĩa chuẩn của khái niệm học thuật dựa trên dữ liệu chuẩn ở Bước 1.
   - ### [GIẢI THÍCH]: Phân tích khoa học lý do vì sao đáp án đúng là chính xác, giải mã lý do các đáp án khác là sai dưới lăng kính cấp độ tư duy "${params.learningPlan.bloom}".
   ${params.learningPlan.analogy ? `- ### [ẨN DỤ]: Đưa ra một phép ẩn dụ trực quan, sinh động để giải thích khái niệm này dễ hiểu.` : ""}
   ${params.learningPlan.counterExample ? `- ### [PHẢN VÍ DỤ]: Chỉ rõ ranh giới dễ nhầm lẫn hoặc hiểu sai của khái niệm này. Cung cấp một phản ví dụ đối lập để làm nổi bật bẫy nhận thức.` : ""}
   - ### [ỨNG DỤNG]: Trình bày ứng dụng thực tế của khái niệm này trong đời sống hoặc doanh nghiệp.
   - ### [MỞ RỘNG]: Phân tích học thuật chuyên sâu mở rộng bổ trợ học thuật cho học viên (Nếu không có, hãy ghi: "Không có nội dung mở rộng ngoài giáo trình.").

Bắt đầu viết bài giảng tự nhiên của bạn bằng tiếng Việt:`;

    return { systemInstruction, prompt };
  }
};

// ==========================================
// 4. THE COMPREHENSIVE PIPELINE IMPLEMENTATION
// ==========================================

export const EvidenceBasedPipeline = {
  async executePipeline(params: {
    subjectId: string;
    subjectName: string;
    questionId: number;
    selectedAnswer?: string;
    timeSpent?: number;
    retryCount?: number;
    explanationLevel?: string;
    aiEngineExecutor: (systemInstruction: string, prompt: string) => Promise<string>;
    fallbackFunction: () => string;
  }): Promise<{
    text: string;
    citations: string;
    strategyUsed: string;
    guessingProbability: number;
    unmasteredPrerequisites: string[];
    crossSubjectIntel: any;
    validationReport: ValidationReport;
    pedagogicalEvaluation?: any;
    policyAudit?: any;
    evolutionSnapshot?: any;
    evolutionAudit?: any;
  }> {
    const startTime = Date.now();
    const q = questionMap.get(params.questionId);
    if (!q) {
      throw new Error(`Question ID ${params.questionId} not found.`);
    }

    const timeSpent = params.timeSpent || 15;

    // 1. Evidence Retrieval (Knowledge Model)
    const evidence = EvidenceRetrievalEngine.retrieveEvidence(params.subjectId, params.questionId);

    // 2. Reasoning Engine
    const reasoning = ReasoningEngine.analyzeReasoning(params.subjectId, params.questionId, params.selectedAnswer);

    // Log detected misconception to Student Model if it exists
    if (reasoning.detectedMisconception.hasMisconception) {
      studentModelService.logMisconception(
        evidence.conceptName,
        reasoning.detectedMisconception.description,
        params.questionId
      );
    }

    // 3. Local Heuristic for Guessing Analysis
    const profile = learnerModelService.getOrCreateProfile(evidence.conceptName);
    const correctSelected = params.selectedAnswer === q.correctAnswer;
    const guessing = GuessDetectionEngine.analyzeGuessing(
      timeSpent,
      correctSelected,
      reasoning.unmasteredPrerequisites.length,
      profile.confidence
    );

    // Update Student Model Adaptive Memory
    studentModelService.updateAdaptiveMemory({
      timeSpent,
      wordCount: q.question.length + Object.values(q.options).join(" ").length,
      isCorrect: correctSelected,
      isGuessLikely: guessing.isGuessLikely,
      misconception: reasoning.detectedMisconception.hasMisconception ? reasoning.detectedMisconception.description : undefined
    });

    const studentModel = studentModelService.getStudentModel();

    // 4. Teaching Strategy Decision (Teaching Decision Engine)
    const decision = teachingDecisionEngine.makeDecision(params.subjectId, evidence.conceptName, params.questionId);

    // 5. Learning Planner (Generates deterministic plan)
    const learningPlan = learningPlanner.generatePlan({
      subjectId: params.subjectId,
      conceptName: evidence.conceptName,
      studentModel,
      evidence,
      reasoning,
      decision,
      guessingProbability: guessing.probability
    });

    // 6. Cross Subject Intelligence
    const crossSubject = CrossSubjectIntelligenceEngine.findCrossSubjectConnection(params.subjectId, evidence.conceptName);

    // 7. Context Window Builder (Deduplication & Token Compression)
    const compressedContext = contextWindowBuilder.buildCompressedContext({
      subjectName: params.subjectName,
      subjectId: params.subjectId,
      question: q,
      selectedAnswer: params.selectedAnswer,
      evidence,
      reasoning,
      learningPlan,
      studentModel,
      crossSubject
    });

    // 8. Deterministic Prompt Compilation (Gemini 3.6 Flash Contract)
    const promptBuild = promptBuilder36.compilePrompt(compressedContext, params.subjectName);

    // 9. AI Engine Execution via AIProvider Abstraction
    const provider = aiProviderRegistry.getProvider("gemini-3.6-flash");
    const providerResult = await provider.execute({
      taskType: "AcademicExplanation",
      prompt: promptBuild.prompt,
      systemInstruction: promptBuild.systemInstruction,
      responseMimeType: "application/json",
      responseSchema: GEMINI_EXPLANATION_RESPONSE_SCHEMA,
      compressedContext,
      fallbackFunction: params.fallbackFunction
    });

    // 10. Extract & Validate Structured Explanation
    let explanationObj = providerResult.parsedStructured;
    if (!explanationObj) {
      const valResult = outputValidationService.validateAndSanitize(providerResult.rawText, compressedContext);
      explanationObj = valResult.sanitized;
    }

    // Convert structured explanation to clean Markdown section blocks
    const aiOutputMarkdown = [
      `### [KHÁI NIỆM]: ${explanationObj.concept}`,
      `**Định nghĩa**: ${explanationObj.definition}`,
      `\n### [GIẢI THÍCH CHUYÊN SÂU]`,
      explanationObj.reasoning,
      `\n### [VÍ DỤ THỰC TIỄN]`,
      explanationObj.example,
      `\n### [BẪY HIỂU SAI CẦN TRÁNH]`,
      explanationObj.misconception,
      `\n### [ỨNG DỤNG THỰC TẾ]`,
      explanationObj.application,
      `\n### [TRÍCH DẪN]`,
      explanationObj.citation,
      `\n### [MỞ RỘNG LOGIC (AI EXPANSION)]`,
      explanationObj.aiExpansion
    ].join("\n\n");

    // 11. Confidence Calibration & Evidence Coverage
    const confidence = responseFormatterService.calibrateConfidence({
      evidence,
      reasoning,
      studentModel
    });

    const optionsStr = Object.values(q.options).join(" ");
    const coverageScore = responseFormatterService.calculateEvidenceCoverage(evidence, q.question, optionsStr);

    // 12. Response Formatter (Renders final Markdown UI layout)
    const formatted = responseFormatterService.formatResponse({
      rawText: aiOutputMarkdown,
      learningPlan,
      evidence,
      reasoning,
      studentModel,
      confidence,
      coverageScore
    });

    // 13. Evidence Validation Report
    const validationReport = providerResult.qualityReport ? {
      isValid: providerResult.qualityReport.isPassed,
      failedChecks: providerResult.qualityReport.issuesFound,
      score: Math.round(providerResult.qualityReport.overallScore * 100)
    } : EvidenceValidationEngine.validateOutput(aiOutputMarkdown, evidence);

    // 14. Explainability & Tracing Log
    const responseTimeMs = Date.now() - startTime;
    responseFormatterService.logTracingEntry({
      conceptName: evidence.conceptName,
      teachingDecision: decision,
      learningPlan,
      evidenceUsed: evidence,
      reasoningTrace: decision.developerTrace.decisionPath,
      promptVersion: promptBuild.version,
      modelVersion: providerResult.modelUsed,
      responseTimeMs,
      tokenUsage: {
        inputTokens: Math.round(promptBuild.prompt.length / 4),
        outputTokens: Math.round(aiOutputMarkdown.length / 4),
        totalTokens: providerResult.tokensUsed || Math.round((promptBuild.prompt.length + aiOutputMarkdown.length) / 4)
      },
      confidence,
      coverageScore
    });

    // Update Learner Model stats
    if (correctSelected && !guessing.isGuessLikely) {
      learnerModelService.adjustConfidence(evidence.conceptName, 0.1);
    }

    // 15. Pedagogical Evaluation Engine & Adaptive Teaching Policy Update
    const evaluation = pedagogicalEvaluationEngine.evaluateInteraction({
      learningPlan,
      teachingDecision: decision,
      studentModel,
      question: q,
      studentAnswer: params.selectedAnswer || "",
      correctAnswer: q.correctAnswer,
      responseTimeSeconds: params.timeSpent || 15,
      retryCount: params.retryCount || 0,
      confidence: confidence.overallConfidence,
      guessDetection: guessing.isGuessLikely,
      evidenceCoverage: coverageScore,
      teachingStrategy: decision.actionType || "Academic",
      bloomLevel: learningPlan.bloom,
      misconceptionType: reasoning.detectedMisconception.hasMisconception ? reasoning.detectedMisconception.description : undefined
    });

    const policyResult = adaptiveTeachingPolicy.evaluateAndUpdatePolicy(studentModel, evaluation);

    // 16. Student Evolution Engine & Long-Term Concept Memory Update
    const evolutionResult = studentEvolutionEngine.processInteraction({
      conceptName: evidence.conceptName,
      update: {
        wasCorrect: correctSelected,
        responseTimeSeconds: params.timeSpent || 15,
        confidence: confidence.overallConfidence,
        detectedMisconception: reasoning.detectedMisconception.hasMisconception ? reasoning.detectedMisconception.description : undefined,
        teachingStrategy: decision.actionType || "Academic",
        explanationLength: learningPlan.explanationDepth || "medium",
        questionId: q.id
      },
      evaluation
    });

    const finalRenderedText = `${formatted.formattedText}\n${formatted.citationsBlock}`;

    return {
      text: finalRenderedText,
      citations: formatted.citationsBlock,
      strategyUsed: decision.actionType,
      guessingProbability: guessing.probability,
      unmasteredPrerequisites: reasoning.unmasteredPrerequisites,
      crossSubjectIntel: crossSubject,
      validationReport,
      pedagogicalEvaluation: evaluation,
      policyAudit: policyResult.auditEntry,
      evolutionSnapshot: evolutionResult.snapshot,
      evolutionAudit: evolutionResult.auditEntry
    };
  }
};
