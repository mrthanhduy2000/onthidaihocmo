/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  cbKnowledgeGraph, 
  cbDistractors, 
  cbBlueprints, 
  cbAdaptiveMetadata,
  KnowledgeNode,
  DistractorItem,
  BlueprintItem,
  AdaptiveMetadata
} from "../data/customer_behavior_kb";
import { questions, topics, chapters, questionMap, dbService, dangKyDoThiTriThuc } from "./db";
import { Question } from "../types";

// Re-export core types
export type { KnowledgeNode, DistractorItem, BlueprintItem, AdaptiveMetadata };

/**
 * Hư từ tiếng Việt và vài từ nối tiếng Anh hay xuất hiện trong tên khái niệm. Loại chúng đi
 * để hai chuỗi không bị coi là giống nhau chỉ vì cùng chứa "của", "và", "các".
 */
const STOPWORDS = new Set([
  "và", "của", "các", "những", "trong", "cho", "với", "là", "một", "có", "được", "về",
  "theo", "khi", "này", "đó", "hay", "hoặc", "tới", "đến", "từ", "ở", "trên", "dưới",
  "the", "of", "and", "in", "for", "to", "a", "an"
]);

/**
 * Tách chuỗi thành tập từ đã chuẩn hóa để so khớp từ vựng.
 * Bỏ phần chú thích tiếng Anh trong ngoặc đơn, bỏ dấu câu, bỏ hư từ, bỏ từ quá ngắn.
 * Ví dụ: "Hành vi khách hàng (Consumer Behavior)" cho ra {hành, vi, khách, hàng}.
 */
function tokenize(text: string): Set<string> {
  const cleaned = String(text || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const out = new Set<string>();
  cleaned.split(" ").forEach(w => {
    if (w.length >= 2 && !STOPWORDS.has(w)) out.add(w);
  });
  return out;
}

/** Hệ số Jaccard giữa hai tập từ: cỡ phần giao chia cho cỡ phần hợp. Trả về 0 khi một bên rỗng. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach(w => { if (b.has(w)) inter++; });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export const kbService = {
  /**
   * Returns the knowledge graph nodes for the active subject.
   * If the subject is 'customer_behavior', returns the rich predefined KB.
   * For other subjects, dynamically synthesizes a high-fidelity virtual Knowledge Graph from questions and topics.
   */
  getKnowledgeGraph(subjectId: string): KnowledgeNode[] {
    if (subjectId === "customer_behavior") {
      return cbKnowledgeGraph;
    }

    // Dynamic Synthesis for Subject Independence
    const subjectQuestions = questions.filter(q => q.questionType === "multiple-choice" || q.questionType === undefined || q.questionType as any === "multiple-choice");
    
    // Extract unique concepts from question knowledgeMapping tags
    const conceptMap = new Map<string, {
      chapter: number;
      topic: string;
      questions: Question[];
      source: string;
      page: string;
    }>();

    subjectQuestions.forEach(q => {
      const tags = q.knowledgeMapping || [];
      tags.forEach(tag => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        
        if (!conceptMap.has(trimmed)) {
          conceptMap.set(trimmed, {
            chapter: q.chapterId,
            topic: q.topicId,
            questions: [q],
            source: q.sourcePdf || "Tài liệu môn học",
            page: String(q.sourcePage || "Chưa rõ")
          });
        } else {
          const entry = conceptMap.get(trimmed)!;
          entry.questions.push(q);
          // Prefer earlier chapters or lower IDs if there's inconsistency
          if (q.chapterId < entry.chapter) {
            entry.chapter = q.chapterId;
            entry.topic = q.topicId;
          }
        }
      });
    });

    // Generate nodes
    const synthNodes: KnowledgeNode[] = [];
    let idx = 1;

    conceptMap.forEach((meta, conceptName) => {
      const nodeId = `synth_${subjectId}_N${idx++}`;
      const firstQ = meta.questions[0];
      const definitionsFromExplanations = meta.questions
        .map(q => q.explanation)
        .filter(exp => exp && exp.length > 20)
        .join(" | ");
      
      const definition = definitionsFromExplanations.slice(0, 200) || `Khái niệm lý luận trọng tâm về ${conceptName} trong chương trình học.`;
      
      synthNodes.push({
        id: nodeId,
        chapter: meta.chapter,
        topic: meta.topic,
        concept: conceptName,
        definition,
        importance: Math.min(5, Math.max(1, meta.questions.length)),
        source: meta.source,
        page: meta.page,
        confidence: 4,
        type: "Definition",
        details: `Nội dung cốt lõi về ${conceptName}. Bao gồm các câu hỏi ứng dụng thực tế và bài tập kiểm tra trong hệ thống.`,
        marketingApplication: `Vận dụng lý luận ${conceptName} để phân tích, đánh giá các tình huống và giải quyết các bài tập liên quan.`,
        commonMistakes: `Sinh viên hay nhầm lẫn định nghĩa ${conceptName} hoặc áp dụng sai quy luật lý thuyết.`,
        
        teaching: {
          learningObjective: firstQ?.learningObjective || `Hiểu sâu sắc và phân biệt rõ ràng khái niệm "${conceptName}" trong hệ thống lý thuyết.`,
          misconception: `Nhầm lẫn bản chất lý thuyết của "${conceptName}" với các thuật ngữ tương đồng hoặc các hiện tượng thực tế bề nổi.`,
          teachingHint: `Bắt đầu bằng việc phân tích các ví dụ trắc nghiệm và giải thích chi tiết đáp án của câu hỏi về "${conceptName}".`,
          memoryHook: `Ghi nhớ "${conceptName}" gắn liền với Chương ${meta.chapter} và các từ khóa: ${conceptName}.`,
          realWorldExample: `Tình huống thực tế liên quan đến ${conceptName} được biên soạn trong câu hỏi số ${firstQ?.id || "chưa rõ"}.`,
          marketingExample: `Ví dụ ứng dụng thực tiễn của ${conceptName} trong các trường hợp bài tập cụ thể.`
        },
        
        dependencies: {
          // KHÔNG bịa quan hệ tiên quyết. Bản cũ ghi requires = [`synth_N{idx-2}`], nghĩa là
          // khái niệm thứ n bị coi là cần khái niệm thứ n-2 làm nền, chỉ vì chúng tình cờ
          // đứng cạnh nhau trong thứ tự duyệt Map. Đó là cấu trúc tri thức HOÀN TOÀN BỊA,
          // mà nó lại điều khiển những quyết định thật: learningEngine nhân chìm điểm ưu
          // tiên của câu hỏi, còn lộ trình học dán nhãn "bị khóa" cho khái niệm. Người học
          // bị chặn khỏi một bài học vì một liên hệ không hề tồn tại. Thà không biết quan hệ
          // tiên quyết còn hơn khẳng định sai, nên để rỗng cho tới khi có dữ liệu thật.
          requires: [],
          requiredBy: [],
          relatedConcepts: meta.questions.flatMap(q => q.knowledgeMapping || []).filter(t => t !== conceptName).slice(0, 3),
          oppositeConcepts: [],
          confusedWith: [`Khái niệm tương đồng với ${conceptName}`]
        },
        
        review: {
          reviewPriority: meta.questions.length > 2 ? "high" : "medium",
          estimatedStudyMinutes: 10,
          estimatedRetentionDifficulty: "medium",
          firstReviewDays: 3,
          secondReviewDays: 7,
          thirdReviewDays: 14
        },
        
        explanation: {
          simpleExplanation: `**Định nghĩa đơn giản**: ${conceptName} là một từ khóa lý thuyết thuộc Chương ${meta.chapter}.\n\n*Phân tích trực quan*: ${firstQ?.explanation || "Xem chi tiết ở câu hỏi liên quan."}`,
          mediumExplanation: `**Bài giảng lý thuyết**: ${definition}\n\n**Ứng dụng**: ${firstQ?.explanation || ""}`,
          expertExplanation: `**Phân tích chuyên sâu (Academic/Expert)**: Khái niệm "${conceptName}" giữ vai trò quan trọng trong việc xây dựng hệ thống lý thuyết học phần.\n\n*Chi tiết*: ${firstQ?.explanation || ""}`,
          analogy: `Hãy tưởng tượng ${conceptName} giống như một mắt xích quan trọng trong chuỗi kiến thức Chương ${meta.chapter}.`,
          commonStudentQuestion: `Làm sao để không bị nhầm lẫn khi làm câu hỏi về ${conceptName}?`,
          answerTemplate: `Cần bám sát định nghĩa trong giáo trình môn học: "${definition}"`
        },
        
        questionGen: {
          possibleQuestionTypes: ["definition", "comparison", "scenario"],
          difficultyDistribution: {
            easy: 40,
            medium: 40,
            hard: 15,
            veryHard: 5
          }
        },
        
        coaching: {
          likelyReason: `Người học chưa phân biệt rõ khái niệm ${conceptName} hoặc đọc chưa kỹ đề bài.`,
          followUpQuestion: `Khái niệm "${conceptName}" có phải là nội dung trọng tâm của Chương ${meta.chapter} không? (Đúng/Sai)`,
          miniLesson: `**Tóm tắt bài học nhanh**: ${definition}\n\nHãy nhớ rằng: ${firstQ?.explanation || ""}`,
          relatedConceptToReview: conceptName
        }
      });
    });

    return synthNodes;
  },

  /**
   * Returns distractors for a concept.
   */
  getDistractors(subjectId: string, conceptId: string): DistractorItem[] {
    if (subjectId === "customer_behavior") {
      return cbDistractors.filter(d => d.conceptId === conceptId);
    }
    return [];
  },

  /**
   * Returns blueprints for a concept.
   */
  getBlueprints(subjectId: string): BlueprintItem[] {
    if (subjectId === "customer_behavior") {
      return cbBlueprints;
    }
    return [];
  },

  /**
   * Returns adaptive metadata for a concept.
   */
  getAdaptiveMetadata(subjectId: string): AdaptiveMetadata[] {
    if (subjectId === "customer_behavior") {
      return cbAdaptiveMetadata;
    }
    return [];
  },

  /**
   * Map question to concept node
   */
  /**
   * Tra khái niệm cho một câu hỏi, có CHẤM ĐỘ GẦN GŨI và XẾP HẠNG.
   *
   * BỐI CẢNH: trước đây có hai bộ tra cứu riêng biệt và cả hai đều hỏng, theo hai hướng
   * ngược nhau.
   *
   *   - learningEngine đòi nhãn của câu hỏi TRÙNG TUYỆT ĐỐI với tên khái niệm. Đo thực tế:
   *     0 trên 292 câu tra được, vì nhãn câu hỏi thuộc một bộ từ vựng khác hẳn tên khái
   *     niệm trong đồ thị (ví dụ nhãn "Khái niệm" so với tên "Hành vi khách hàng (Consumer
   *     Behavior)"). Hệ quả: toàn bộ mô hình chấm thích ứng chưa từng chạy thật, mọi câu
   *     đều rơi vào nhánh dự phòng.
   *   - kbService lại dùng `node.concept.includes(tag)` và lấy kết quả ĐẦU TIÊN tìm thấy.
   *     Một nhãn ngắn và phổ biến như "Khái niệm" khớp với gần như mọi thứ, nên phần giảng
   *     giải trả về nội dung của một khái niệm không liên quan tới câu hỏi.
   *
   * CÁCH LÀM: một hàm duy nhất, chấm điểm cộng dồn trên ba nguồn bằng chứng độc lập, rồi
   * xếp hạng. Toàn bộ tất định và giải thích được, không dùng mô hình ngôn ngữ.
   *
   *     doGanGui = 0,50*trungChuDe + 0,20*trungChuong + 0,30*tuongDongTuVung
   *
   * trong đó tuongDongTuVung là hệ số Jaccard trên tập từ đã chuẩn hóa, lấy giá trị lớn
   * nhất trên mọi nhãn của câu hỏi. Ngưỡng nhận 0,20 để thà không gán còn hơn gán bừa.
   */
  resolveConceptsForQuestion(
    subjectId: string,
    question: Question,
    limit: number = 3
  ): Array<{ node: KnowledgeNode; affinity: number }> {
    const graph = this.getKnowledgeGraph(subjectId);
    if (graph.length === 0) return [];

    const qTokenSets = (question.knowledgeMapping || [])
      .map(tag => tokenize(tag))
      .filter(s => s.size > 0);

    const scored = graph.map(node => {
      let affinity = 0;
      if (node.topic && question.topicId && node.topic === question.topicId) affinity += 0.5;
      if (node.chapter && node.chapter === question.chapterId) affinity += 0.2;

      const nodeTokens = tokenize(node.concept);
      let bestLex = 0;
      qTokenSets.forEach(tagTokens => {
        bestLex = Math.max(bestLex, jaccard(tagTokens, nodeTokens));
      });
      affinity += 0.3 * bestLex;

      return { node, affinity: Number(affinity.toFixed(4)) };
    });

    return scored
      .filter(s => s.affinity >= 0.2)
      .sort((a, b) => (b.affinity - a.affinity) || a.node.id.localeCompare(b.node.id))
      .slice(0, Math.max(1, limit));
  },

  getConceptForQuestion(subjectId: string, question: Question): KnowledgeNode | null {
    // Dùng chung bộ tra cứu có xếp hạng ở trên, lấy khái niệm gần gũi nhất. Nhờ vậy phần
    // giảng giải và phần chấm ưu tiên luôn nói về cùng một khái niệm, thay vì mỗi nơi suy
    // luận một kiểu như trước.
    const ranked = this.resolveConceptsForQuestion(subjectId, question, 1);
    return ranked.length > 0 ? ranked[0].node : null;
  },

  /**
   * Returns interactive options for the coaching follow-up question
   */
  getCoachingOptions(node: KnowledgeNode): {
    question: string;
    options: { key: string; text: string; isCorrect: boolean }[];
  } {
    const qText = node.coaching?.followUpQuestion || "Bạn đã nắm rõ bài học nhỏ này chưa?";
    
    if (node.id === "CB_C1_N1") {
      return {
        question: qText,
        options: [
          { key: "a", text: "Quyết định xử lý tủ lạnh hỏng ảnh hưởng trực tiếp đến khả năng tái mua sản phẩm mới.", isCorrect: true },
          { key: "b", text: "Không có tác động vì hành vi khách hàng chỉ tính đến khi thanh toán xong.", isCorrect: false }
        ]
      };
    }
    if (node.id === "CB_C1_N2") {
      return {
        question: qText,
        options: [
          { key: "a", text: "Phản ứng tốt hơn với quảng cáo sôi động bên ngoài.", isCorrect: true },
          { key: "b", text: "Bị ảnh hưởng bởi quy trình họp nội bộ của phòng kế toán.", isCorrect: false }
        ]
      };
    }
    if (node.id === "CB_C2_N1") {
      return {
        question: qText,
        options: [
          { key: "a", text: "Sai. Nhánh văn hóa luôn năng động và không ngừng biến chuyển.", isCorrect: true },
          { key: "b", text: "Đúng. Nhánh văn hóa là di sản cố định bền vững bất biến.", isCorrect: false }
        ]
      };
    }
    
    // Fallback True/False structure
    return {
      question: qText,
      options: [
        { key: "a", text: "ĐÚNG. Khái niệm này là chính xác và phù hợp với lý luận giáo trình.", isCorrect: true },
        { key: "b", text: "SAI. Khái niệm này mâu thuẫn hoặc chưa đầy đủ.", isCorrect: false }
      ]
    };
  }
};

// Nối `db.ts` với đồ thị tri thức mà KHÔNG tạo vòng nhập.
//
// `db.ts` cần biết đồ thị của môn đang mở để ghi độ thạo dưới cả hai khóa (bất biến 4.6), nhưng
// file này đã nhập `db.ts` ở đầu, nên `db.ts` tuyệt đối không được nhập ngược lại. Thay vào đó
// `db.ts` mở một ô đăng ký, và file này tự cắm vào ngay khi được nạp. Xem chú thích dài trong
// `db.ts`, phần ĐỒ THỊ TRI THỨC CỦA MÔN ĐANG MỞ.
dangKyDoThiTriThuc((subjectId: string) => kbService.getKnowledgeGraph(subjectId));
