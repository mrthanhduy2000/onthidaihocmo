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
import { questions, topics, chapters, questionMap, dbService } from "./db";
import { Question } from "../types";

// Re-export core types
export type { KnowledgeNode, DistractorItem, BlueprintItem, AdaptiveMetadata };

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
          requires: idx > 3 ? [`synth_${subjectId}_N${idx - 2}`] : [],
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
  getConceptForQuestion(subjectId: string, question: Question): KnowledgeNode | null {
    const graph = this.getKnowledgeGraph(subjectId);
    if (subjectId === "customer_behavior") {
      // Direct mapping by topic/chapter or match string
      const matched = graph.find(node => 
        node.topic === question.topicId || 
        question.knowledgeMapping?.some(tag => node.concept.toLowerCase().includes(tag.toLowerCase()))
      );
      return matched || null;
    } else {
      // Matches synthesized concept node based on knowledgeMapping tag
      const matched = graph.find(node => 
        question.knowledgeMapping?.some(tag => tag.trim() === node.concept)
      );
      return matched || null;
    }
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
