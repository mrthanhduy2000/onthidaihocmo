/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question, DifficultyLevel, GeneratedQuestionMetadata, QuestionSpecification } from "../types";
import { kbService, KnowledgeNode } from "./kbService";
import { dbService } from "./db";
import { learnerModelService } from "./learnerModel";
import { TimeService } from "./time";
import { AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION, authoritativeKnowledgePolicy } from "./authoritativeKnowledgePolicy";
import { pedagogicalIntelligenceEngine } from "./pedagogicalIntelligenceEngine";
import { pedagogicalReviewEngine } from "./pedagogicalReviewEngine";

// ============================================================================
// 1. TYPES & INTERFACES FOR AUTHORITATIVE QUESTION ENGINE
// ============================================================================

export type BlueprintType =
  | "RECOGNITION"
  | "APPLICATION"
  | "ANALYSIS"
  | "COMPARISON"
  | "SCENARIO"
  | "CASE_STUDY"
  | "MISCONCEPTION"
  | "EXCEPTION"
  | "DEFINITION"
  | "RELATIONSHIP"
  | "SEQUENCE"
  | "CAUSE_EFFECT"
  | "BEST_CHOICE"
  | "MOST_APPROPRIATE"
  | "NOT_QUESTION"
  | "TRUE_FALSE"
  | "MULTI_STEP_REASONING";

export type DistractorType =
  | "MISCONCEPTION"
  | "CONFUSED_CONCEPT"
  | "OPPOSITE_CONCEPT"
  | "FREQUENTLY_WRONG"
  | "ALTERNATIVE_DEFINITION"
  | "OVERGENERALIZATION"
  | "OVERNARROWING";

export interface BlueprintDefinition {
  id: BlueprintType;
  name: string;
  description: string;
  defaultBloom: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
  promptInstruction: string;
}

export interface DistractorStrategy {
  type: DistractorType;
  name: string;
  description: string;
  instruction: string;
}

export interface EvidenceSlice {
  evidenceId: string;
  conceptName: string;
  chapterId: number;
  topicId: string;
  definition: string;
  details: string;
  teachingObjective: string;
  misconception: string;
  sourcePdf: string;
  sourcePage: string;
  examples: string[];
  relatedConcepts: string[];
  oppositeConcepts: string[];
  confusedWith: string[];
}

export interface QuestionGenSpec {
  subjectId: string;
  chapterId: number;
  topicId: string;
  conceptId: string;
  conceptName: string;
  blueprint: BlueprintDefinition;
  bloomLevel: string;
  evidence: EvidenceSlice;
  distractorRules: DistractorStrategy[];
  targetDifficulty: DifficultyLevel;
  targetDifficultyRating: number;
  estimatedTimeSeconds: number;
}

export interface QualityMetrics {
  overallScore: number;
  groundingScore: number;
  conceptCoverage: number;
  distractorQuality: number;
  bloomAccuracy: number;
  evidenceCoverage: number;
  difficultyConfidence: number;
  pedagogicalValue: number;
  questionDiversity: number;
}

export interface QuestionVerificationResult {
  isValid: boolean;
  qualityMetrics: QualityMetrics;
  failedChecks: string[];
}

// ============================================================================
// 2. BLUEPRINTS DEFINITION CATALOG (17 SUPPORTED BLUEPRINTS)
// ============================================================================

export const SUPPORTED_BLUEPRINTS: Record<BlueprintType, BlueprintDefinition> = {
  RECOGNITION: {
    id: "RECOGNITION",
    name: "Nhận diện Khái niệm",
    description: "Kiểm tra khả năng nhận biết thuật ngữ và định nghĩa nguyên văn từ học liệu gốc.",
    defaultBloom: "Remember",
    promptInstruction: "Yêu cầu người học nhận diện chính xác thuật ngữ hoặc biểu hiện của khái niệm dựa strictly trên giáo trình."
  },
  DEFINITION: {
    id: "DEFINITION",
    name: "Xác định Định nghĩa Chuẩn",
    description: "Yêu cầu chọn phát biểu định nghĩa hoàn chỉnh và chính xác nhất theo tài liệu.",
    defaultBloom: "Remember",
    promptInstruction: "Cho phát biểu định nghĩa cốt lõi, yêu cầu chọn định nghĩa đúng nhất theo giáo trình gốc."
  },
  APPLICATION: {
    id: "APPLICATION",
    name: "Vận dụng Tình huống",
    description: "Áp dụng nguyên lý lý thuyết vào một hoàn cảnh hoặc bài tập cụ thể.",
    defaultBloom: "Apply",
    promptInstruction: "Xây dựng một tình huống ngắn thực tế và yêu cầu vận dụng lý thuyết để giải quyết hoặc phân loại."
  },
  ANALYSIS: {
    id: "ANALYSIS",
    name: "Phân tích Cấu trúc & Cơ chế",
    description: "Phân tích các thành phần cấu thành hoặc cơ chế vận hành của khái niệm.",
    defaultBloom: "Analyze",
    promptInstruction: "Mô tả một cơ chế hoặc hiện tượng, yêu cầu phân tích bản chất cấu trúc lý thuyết đằng sau."
  },
  COMPARISON: {
    id: "COMPARISON",
    name: "So sánh & Phân biệt",
    description: "So sánh sự giống và khác nhau giữa hai hay nhiều khái niệm học thuật.",
    defaultBloom: "Understand",
    promptInstruction: "Đặt khái niệm vào đối sánh với một khái niệm tương đồng hoặc dễ nhầm lẫn trong cùng chương."
  },
  SCENARIO: {
    id: "SCENARIO",
    name: "Kịch bản Thực tiễn",
    description: "Tình huống thực tế doanh nghiệp hoặc hành vi tiêu dùng kiểm tra khả năng nhận diện quy luật.",
    defaultBloom: "Apply",
    promptInstruction: "Tạo kịch bản cụ thể 2-3 câu, yêu cầu xác định xem quy luật hay khái niệm nào đang chi phối kịch bản này."
  },
  CASE_STUDY: {
    id: "CASE_STUDY",
    name: "Mini Case Study",
    description: "Tình huống tổng hợp chứa nhiều dữ kiện cần xâu chuỗi dữ liệu.",
    defaultBloom: "Analyze",
    promptInstruction: "Biên soạn một case study ngắn đầy đủ ngữ cảnh thực tế, yêu cầu đưa ra kết luận hoặc đánh giá."
  },
  MISCONCEPTION: {
    id: "MISCONCEPTION",
    name: "Bẫy Sai lầm Phổ biến",
    description: "Cài cắm sai lầm sinh viên hay mắc phải để kiểm tra sự tỉnh táo lý luận.",
    defaultBloom: "Evaluate",
    promptInstruction: "Tập trung xoáy vào sai lầm hay gặp (misconception) trong tài liệu để kiểm tra sinh viên có bị lừa không."
  },
  EXCEPTION: {
    id: "EXCEPTION",
    name: "Ngoại lệ & Điều kiện Biên",
    description: "Kiểm tra việc nắm bắt các điều kiện giới hạn hoặc ngoại lệ của quy luật.",
    defaultBloom: "Analyze",
    promptInstruction: "Hỏi về điều kiện giới hạn hoặc trường hợp ngoại lệ mà lý thuyết giáo trình quy định."
  },
  RELATIONSHIP: {
    id: "RELATIONSHIP",
    name: "Mối quan hệ Phụ thuộc",
    description: "Kiểm tra hiểu biết về quan hệ nguyên nhân - kết quả hoặc tác động qua lại.",
    defaultBloom: "Understand",
    promptInstruction: "Hỏi về chiều hướng tác động (tăng/giảm, trực tiếp/gián tiếp) giữa khái niệm này và nhân tố khác."
  },
  SEQUENCE: {
    id: "SEQUENCE",
    name: "Trật tự Quy trình / Các bước",
    description: "Xác định thứ tự đúng của các bước trong một quy trình lý thuyết.",
    defaultBloom: "Remember",
    promptInstruction: "Hỏi về bước cụ thể hoặc trật tự diễn tiến chính xác của quy trình theo giáo trình."
  },
  CAUSE_EFFECT: {
    id: "CAUSE_EFFECT",
    name: "Phân tích Nhân quả",
    description: "Yêu cầu giải thích nguyên nhân dẫn đến một hiện tượng học thuật cụ thể.",
    defaultBloom: "Analyze",
    promptInstruction: "Đặt câu hỏi 'Vì sao...' hoặc 'Nguyên nhân trực tiếp nào...' dựa trên lập luận lý thuyết gốc."
  },
  BEST_CHOICE: {
    id: "BEST_CHOICE",
    name: "Lựa chọn Tối ưu",
    description: "Chọn phương án đúng và tối ưu nhất trong số các phương án có vẻ hợp lý.",
    defaultBloom: "Evaluate",
    promptInstruction: "Đưa ra các phương án có vẻ đúng nhưng chỉ có 1 phương án phản ánh chính xác nhất bản chất lý thuyết."
  },
  MOST_APPROPRIATE: {
    id: "MOST_APPROPRIATE",
    name: "Phù hợp nhất theo Giáo trình",
    description: "Xác định nhận định chuẩn xác nhất theo đúng quan điểm giáo trình.",
    defaultBloom: "Understand",
    promptInstruction: "Yêu cầu chọn câu trả lời đúng chuẩn quan điểm tác giả/giáo trình môn học."
  },
  NOT_QUESTION: {
    id: "NOT_QUESTION",
    name: "Câu hỏi Phủ định (KHÔNG ĐÚNG)",
    description: "Tìm phát biểu sai hoặc không thuộc đặc điểm của khái niệm.",
    defaultBloom: "Understand",
    promptInstruction: "Đặt câu hỏi phủ định: 'Phát biểu nào sau đây KHÔNG đúng khi nói về...?'"
  },
  TRUE_FALSE: {
    id: "TRUE_FALSE",
    name: "Đúng / Sai kèm Phân tích",
    description: "Đánh giá tính đúng sai của một luận điểm kèm giải thích.",
    defaultBloom: "Evaluate",
    promptInstruction: "Đưa ra luận điểm khẳng định, chọn đáp án nhận định Đúng/Sai đi kèm lý do chuẩn xác."
  },
  MULTI_STEP_REASONING: {
    id: "MULTI_STEP_REASONING",
    name: "Suy luận Đa bước",
    description: "Đòi hỏi kết hợp 2 tiền đề trở lên trong giáo trình để suy ra kết luận.",
    defaultBloom: "Analyze",
    promptInstruction: "Yêu cầu người học liên kết 2 mảng kiến thức trong giáo trình để rút ra kết luận logic."
  }
};

// ============================================================================
// 3. DISTRACTOR STRATEGIES CATALOG (7 SUPPORTED TYPES)
// ============================================================================

export const SUPPORTED_DISTRACTORS: Record<DistractorType, DistractorStrategy> = {
  MISCONCEPTION: {
    type: "MISCONCEPTION",
    name: "Phương án Sai lầm Nhận thức",
    description: "Dựa trên hiểu lầm phổ biến của sinh viên được ghi nhận trong Knowledge Graph.",
    instruction: "Tạo 1 phương án nhiễu dựa trực tiếp trên nhận thức sai (misconception) của sinh viên về khái niệm này."
  },
  CONFUSED_CONCEPT: {
    type: "CONFUSED_CONCEPT",
    name: "Phương án Khái niệm Tương đồng",
    description: "Dùng thuật ngữ hoặc định nghĩa của một khái niệm dễ gây nhầm lẫn trong cùng chương.",
    instruction: "Tạo 1 phương án nhiễu bằng cách đưa ra đặc điểm của một khái niệm khác dễ nhầm lẫn trong cùng chương."
  },
  OPPOSITE_CONCEPT: {
    type: "OPPOSITE_CONCEPT",
    name: "Phương án Đảo ngược Logic",
    description: "Khẳng định ngược lại với quy luật hoặc chiều tác động lý thuyết.",
    instruction: "Tạo 1 phương án nhiễu khẳng định đảo ngược lại logic hoặc kết luận chính xác của giáo trình."
  },
  FREQUENTLY_WRONG: {
    type: "FREQUENTLY_WRONG",
    name: "Phương án Cảm tính / Bề nổi",
    description: "Phản ánh suy nghĩ bề nổi hoặc cảm quan cá nhân không có căn cứ học thuật.",
    instruction: "Tạo 1 phương án nhiễu nhìn qua có vẻ hợp lý theo kinh nghiệm đời sống nhưng sai về mặt lý luận chuyên môn."
  },
  ALTERNATIVE_DEFINITION: {
    type: "ALTERNATIVE_DEFINITION",
    name: "Phương án Tráo Định nghĩa",
    description: "Sử dụng nguyên văn định nghĩa của một thuật ngữ khác trong môn học.",
    instruction: "Tạo 1 phương án nhiễu lấy định nghĩa chính xác của một thuật ngữ thuộc chương/bài khác."
  },
  OVERGENERALIZATION: {
    type: "OVERGENERALIZATION",
    name: "Phương án Khái quát quá mức",
    description: "Mở rộng kết luận ra mọi trường hợp, bỏ qua điều kiện ràng buộc trong giáo trình.",
    instruction: "Tạo 1 phương án nhiễu dùng từ tuyệt đối ('mọi', 'luôn luôn', 'hoàn toàn') bỏ qua điều kiện ràng buộc."
  },
  OVERNARROWING: {
    type: "OVERNARROWING",
    name: "Phương án Thu hẹp quá mức",
    description: "Giới hạn khái niệm chỉ trong 1 biểu hiện nhỏ, bỏ qua các khía cạnh còn lại.",
    instruction: "Tạo 1 phương án nhiễu thu hẹp khái niệm chỉ bằng một trường hợp riêng lẻ."
  }
};

// ============================================================================
// 4. DIVERSITY & FREQUENCY TRACKER
// ============================================================================

class DiversityTracker {
  private conceptFrequency: Record<string, number> = {};
  private blueprintFrequency: Record<string, number> = {};
  private distractorFrequency: Record<string, number> = {};
  private bloomFrequency: Record<string, number> = {};
  private generatedQuestionsHistory: string[] = [];

  recordSpec(spec: QuestionGenSpec) {
    this.conceptFrequency[spec.conceptName] = (this.conceptFrequency[spec.conceptName] || 0) + 1;
    this.blueprintFrequency[spec.blueprint.id] = (this.blueprintFrequency[spec.blueprint.id] || 0) + 1;
    this.bloomFrequency[spec.bloomLevel] = (this.bloomFrequency[spec.bloomLevel] || 0) + 1;
    spec.distractorRules.forEach(r => {
      this.distractorFrequency[r.type] = (this.distractorFrequency[r.type] || 0) + 1;
    });
  }

  recordQuestionText(text: string) {
    this.generatedQuestionsHistory.push(text);
    if (this.generatedQuestionsHistory.length > 50) {
      this.generatedQuestionsHistory.shift();
    }
  }

  getUnderusedBlueprint(): BlueprintType {
    const keys = Object.keys(SUPPORTED_BLUEPRINTS) as BlueprintType[];
    let minKey = keys[0];
    let minVal = Infinity;

    for (const k of keys) {
      const count = this.blueprintFrequency[k] || 0;
      if (count < minVal) {
        minVal = count;
        minKey = k;
      }
    }
    return minKey;
  }

  calculateTextUniqueness(newText: string): number {
    if (this.generatedQuestionsHistory.length === 0) return 100;
    
    let maxSimilarity = 0;
    const cleanNew = newText.toLowerCase().replace(/[^a-z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ\s]/g, "");
    
    for (const oldText of this.generatedQuestionsHistory) {
      const cleanOld = oldText.toLowerCase().replace(/[^a-z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ\s]/g, "");
      
      const wordsNew = new Set(cleanNew.split(/\s+/));
      const wordsOld = new Set(cleanOld.split(/\s+/));
      
      let intersection = 0;
      wordsNew.forEach(w => {
        if (wordsOld.has(w) && w.length > 2) intersection++;
      });
      
      const similarity = (intersection / Math.max(wordsNew.size, 1)) * 100;
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    }

    return Math.max(0, Math.round(100 - maxSimilarity));
  }

  reset() {
    this.conceptFrequency = {};
    this.blueprintFrequency = {};
    this.distractorFrequency = {};
    this.bloomFrequency = {};
    this.generatedQuestionsHistory = [];
  }
}

export const diversityTracker = new DiversityTracker();

// ============================================================================
// 5. QUESTION GENERATION ENGINE (CORE DETERMINISTIC SERVICE)
// ============================================================================

export const questionGenerationEngine = {
  /**
   * Builds an EvidenceSlice strictly from the Knowledge Graph / KB Node.
   */
  extractEvidenceSlice(node: KnowledgeNode): EvidenceSlice {
    return {
      evidenceId: `EVID_${node.id}_${node.chapter}`,
      conceptName: node.concept,
      chapterId: node.chapter,
      topicId: node.topic,
      definition: node.definition || `Định nghĩa về ${node.concept} trong giáo trình.`,
      details: node.details || node.explanation?.mediumExplanation || "",
      teachingObjective: node.teaching?.learningObjective || `Nắm vững bản chất khái niệm ${node.concept}.`,
      misconception: node.commonMistakes || node.teaching?.misconception || `Nhầm lẫn bản chất của ${node.concept}.`,
      sourcePdf: node.source || "Giáo trình chính thức",
      sourcePage: String(node.page || 1),
      examples: [
        node.teaching?.realWorldExample || "",
        node.teaching?.marketingExample || ""
      ].filter(Boolean),
      relatedConcepts: node.dependencies?.relatedConcepts || [],
      oppositeConcepts: node.dependencies?.oppositeConcepts || [],
      confusedWith: node.dependencies?.confusedWith || []
    };
  },

  /**
   * Deterministically decides the exact QuestionGenSpec without calling Gemini.
   */
  buildQuestionSpec(params: {
    subjectId: string;
    chapterId?: number;
    topicId?: string;
    targetDifficulty?: DifficultyLevel;
    preferredBlueprint?: BlueprintType;
  }): QuestionGenSpec {
    const subjectId = params.subjectId || dbService.getActiveSubjectId();
    const knowledgeGraph = kbService.getKnowledgeGraph(subjectId);

    if (knowledgeGraph.length === 0) {
      throw new Error(`Khái niệm chưa được khởi tạo trong Knowledge Graph cho môn ${subjectId}`);
    }

    // 1. Concept Selection
    let eligibleNodes = knowledgeGraph;
    if (params.chapterId) {
      eligibleNodes = eligibleNodes.filter(n => n.chapter === params.chapterId);
    }
    if (params.topicId) {
      eligibleNodes = eligibleNodes.filter(n => n.topic === params.topicId);
    }
    if (eligibleNodes.length === 0) {
      eligibleNodes = knowledgeGraph;
    }

    // Prioritize concepts with lower mastery in Student Model if available
    const stats = dbService.getStatistics();
    const conceptMastery = stats.conceptMastery || {};

    // CHÉP RA MẢNG RIÊNG rồi mới sắp xếp. Bản cũ gọi thẳng `.sort()` lên mảng do
    // `kbService.getKnowledgeGraph` trả về, mà đó là mảng DÙNG CHUNG cho cả ứng dụng, nên một
    // lần sinh câu hỏi làm xáo trộn vĩnh viễn thứ tự khái niệm của mọi nơi khác: lộ trình học
    // (`learningEngine.generateLearningRoadmap` duyệt đồ thị theo đúng thứ tự này), bản đồ độ
    // thạo, màn AI Hub, các bảng quan trắc. Đo ngày 27/07/2026: thứ tự 5 nút đầu đổi từ
    // CB_C4_N2, CB_C7_N2, CB_C3_N2... thành CB_C2_N4, CB_C6_N3, CB_C2_N3... chỉ sau MỘT lần gọi.
    //
    // Nhánh dính lỗi là nhánh không lọc được nút nào (dòng `eligibleNodes = knowledgeGraph` ở
    // trên), tức đúng lúc câu hỏi sinh ra mang mã chương hoặc mã chủ đề chưa có trong đồ thị.
    // Đó là tình huống thường gặp nhất với môn tự tạo từ tài liệu, chính là đường Đàm dùng nhiều.
    //
    // Hàm so sánh cũng phải là THỨ TỰ TOÀN PHẦN (bất biến 4.7): độ thạo bằng nhau thì so tiếp
    // bằng mã nút, nếu không thứ tự các khái niệm cùng mức thạo sẽ phụ thuộc vào thuật toán sắp
    // xếp chứ không phải vào dữ liệu.
    const nodesTheoDoThao = [...eligibleNodes].sort((a, b) => {
      const masteryA = conceptMastery[a.concept] ?? 50;
      const masteryB = conceptMastery[b.concept] ?? 50;
      return (masteryA - masteryB) || a.id.localeCompare(b.id); // Lowest mastery first
    });

    const selectedNode = nodesTheoDoThao[0];
    const evidence = this.extractEvidenceSlice(selectedNode);

    // 2. Blueprint Selection
    let blueprintType: BlueprintType;
    if (params.preferredBlueprint && SUPPORTED_BLUEPRINTS[params.preferredBlueprint]) {
      blueprintType = params.preferredBlueprint;
    } else {
      blueprintType = diversityTracker.getUnderusedBlueprint();
    }
    const blueprint = SUPPORTED_BLUEPRINTS[blueprintType];

    // 3. Bloom Level Determination
    const bloomLevel = blueprint.defaultBloom;

    // 4. Difficulty & Time
    const targetDifficulty: DifficultyLevel = params.targetDifficulty || 
      (bloomLevel === "Remember" ? "Dễ" : bloomLevel === "Apply" ? "Trung bình" : "Khó");
    
    const difficultyRating = targetDifficulty === "Dễ" ? 2 : targetDifficulty === "Trung bình" ? 3 : targetDifficulty === "Khó" ? 4 : 5;
    const targetDifficultyRating = targetDifficulty === "Dễ" ? 1 : targetDifficulty === "Trung bình" ? 2 : targetDifficulty === "Khó" ? 3 : 4;
    const estimatedTimeSeconds = targetDifficulty === "Dễ" ? 30 : targetDifficulty === "Trung bình" ? 45 : 60;

    // 5. Select 3 Distractor Strategies
    const distractorTypes: DistractorType[] = [
      "MISCONCEPTION",
      "CONFUSED_CONCEPT",
      "OPPOSITE_CONCEPT"
    ];
    if (blueprintType === "NOT_QUESTION" || blueprintType === "EXCEPTION") {
      distractorTypes[1] = "OVERGENERALIZATION";
    }

    const distractorRules = distractorTypes.map(t => SUPPORTED_DISTRACTORS[t]);

    const spec: QuestionGenSpec = {
      subjectId,
      chapterId: selectedNode.chapter,
      topicId: selectedNode.topic,
      conceptId: selectedNode.id,
      conceptName: selectedNode.concept,
      blueprint,
      bloomLevel,
      evidence,
      distractorRules,
      targetDifficulty,
      targetDifficultyRating,
      estimatedTimeSeconds
    };

    diversityTracker.recordSpec(spec);
    return spec;
  },

  /**
   * Compiles the strict prompt for Gemini NLG based on the QuestionGenSpec.
   */
  compileNlgPrompt(spec: QuestionGenSpec): string {
    return `
${AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION}

===================================================================
NLG EXAM GENERATION SPECIFICATION (DETERMINISTIC BLUEPRINT)
===================================================================
MÔN HỌC ID: ${spec.subjectId}
CHƯƠNG: ${spec.chapterId} | CHỦ ĐỀ ID: ${spec.topicId}
KHÁI NIỆM TRỌNG TÂM: "${spec.conceptName}" (ID: ${spec.conceptId})
MỨC ĐỘ THANG BLOOM: ${spec.bloomLevel}
ĐỘ KHÓ YÊU CẦU: ${spec.targetDifficulty} (Rating: ${spec.targetDifficultyRating}/5)
DẠNG BÀI BLUEPRINT: ${spec.blueprint.name} (${spec.blueprint.id})
MÔ TẢ BLUEPRINT: ${spec.blueprint.description}
CHỈ DẪN BIÊN SOẠN BLUEPRINT: ${spec.blueprint.promptInstruction}

-------------------------------------------------------------------
TÀI LIỆU CHỨNG CỨ TRÍCH DẪN (AUTHORITATIVE EVIDENCE SLICE)
-------------------------------------------------------------------
- Định nghĩa chuẩn: "${spec.evidence.definition}"
- Nội dung chi tiết: "${spec.evidence.details}"
- Mục tiêu bài học: "${spec.evidence.teachingObjective}"
- Bẫy sai lầm phổ biến: "${spec.evidence.misconception}"
- Nguồn học liệu: ${spec.evidence.sourcePdf} (Trang ${spec.evidence.sourcePage})
- Khái niệm liên quan trong chương: ${spec.evidence.relatedConcepts.join(", ") || "Không có"}
- Khái niệm dễ gây nhầm lẫn: ${spec.evidence.confusedWith.join(", ") || "Không có"}

-------------------------------------------------------------------
QUY TẮC THIẾT KẾ 4 PHƯƠNG ÁN LỰA CHỌN (1 ĐÚNG + 3 NHIỄU)
-------------------------------------------------------------------
- PHƯƠNG ÁN ĐÚNG: Phải phản ánh chính xác 100% định nghĩa và lý luận trong Dữ liệu Chứng cứ trên.
- PHƯƠNG ÁN NHIỄU 1 (${spec.distractorRules[0].name}): ${spec.distractorRules[0].instruction}
- PHƯƠNG ÁN NHIỄU 2 (${spec.distractorRules[1].name}): ${spec.distractorRules[1].instruction}
- PHƯƠNG ÁN NHIỄU 3 (${spec.distractorRules[2].name}): ${spec.distractorRules[2].instruction}

-------------------------------------------------------------------
YÊU CẦU ĐẦU RA (STRICT JSON ONLY)
-------------------------------------------------------------------
Hãy tạo duy nhất 1 câu hỏi trắc nghiệm tiếng Việt mới hoàn toàn, sáng tạo ngữ cảnh nhưng 100% grounded trong Dữ liệu Chứng cứ.
Trả về định dạng JSON object khớp chính xác với cấu trúc sau:
{
  "question": "Nội dung câu hỏi trắc nghiệm...",
  "options": {
    "a": "Nội dung phương án A",
    "b": "Nội dung phương án B",
    "c": "Nội dung phương án C",
    "d": "Nội dung phương án D"
  },
  "correctAnswer": "a", // Hoặc 'b', 'c', 'd'
  "explanation": "Giải thích chi tiết có trích dẫn nguồn: ${spec.evidence.sourcePdf} (Trang ${spec.evidence.sourcePage}). Lý giải rõ tại sao phương án đúng là chính xác và vì sao 3 phương án nhiễu chưa đúng theo lý thuyết.",
  "learningObjective": "${spec.evidence.teachingObjective}"
}
`.trim();
  },

  /**
   * Verifies and evaluates a generated question across 8 Quality Metrics.
   */
  verifyAndScoreQuestion(
    question: Question,
    spec: QuestionGenSpec
  ): QuestionVerificationResult {
    const failedChecks: string[] = [];

    // 1. Grounding Score Check
    const groundingResult = authoritativeKnowledgePolicy.evaluateGrounding(
      `${question.question}\n${question.explanation}`,
      spec.evidence.definition
    );

    if (!groundingResult.isPolicyCompliant) {
      failedChecks.push(...groundingResult.violations);
    }

    // 2. Concept Coverage
    const lowerQuestion = question.question.toLowerCase();
    const lowerConcept = spec.conceptName.toLowerCase();
    const conceptCoverage = (lowerQuestion.includes(lowerConcept) || question.explanation.toLowerCase().includes(lowerConcept)) ? 100 : 50;
    if (conceptCoverage < 60) {
      failedChecks.push(`Câu hỏi thiếu sự hiện diện rõ ràng của khái niệm "${spec.conceptName}"`);
    }

    // 3. Distractor Quality
    const opts = [question.options.a, question.options.b, question.options.c, question.options.d];
    const uniqueOpts = new Set(opts.map(o => o.trim().toLowerCase()));
    const distractorQuality = uniqueOpts.size === 4 ? 95 : 30;
    if (uniqueOpts.size < 4) {
      failedChecks.push("Các phương án lựa chọn bị lặp lại hoặc trùng lặp nội dung");
    }

    // 4. Bloom Accuracy
    const bloomAccuracy = question.bloomLevel === spec.bloomLevel ? 100 : 80;

    // 5. Evidence Coverage
    const hasSourceMention = question.explanation.includes(spec.evidence.sourcePdf) || 
                             question.explanation.includes(String(spec.evidence.sourcePage)) ||
                             question.explanation.includes("Trang") ||
                             question.explanation.includes("Slide");
    const evidenceCoverage = hasSourceMention ? 100 : 60;

    // 6. Difficulty Confidence
    const difficultyConfidence = question.difficulty === spec.targetDifficulty ? 100 : 85;

    // 7. Pedagogical Value
    const pedagogicalValue = question.explanation && question.explanation.length > 50 ? 95 : 40;
    if (pedagogicalValue < 60) {
      failedChecks.push("Phần giải thích sư phạm quá ngắn hoặc thiếu trích dẫn");
    }

    // 8. Question Diversity
    const questionDiversity = diversityTracker.calculateTextUniqueness(question.question);
    if (questionDiversity < 50) {
      failedChecks.push("Câu hỏi có độ trùng lặp cao với các câu hỏi đã sinh trước đó");
    }

    diversityTracker.recordQuestionText(question.question);

    const overallScore = Math.round(
      (groundingResult.isPolicyCompliant ? 100 : 40) * 0.25 +
      conceptCoverage * 0.15 +
      distractorQuality * 0.15 +
      bloomAccuracy * 0.10 +
      evidenceCoverage * 0.10 +
      difficultyConfidence * 0.05 +
      pedagogicalValue * 0.10 +
      questionDiversity * 0.10
    );

    const qualityMetrics: QualityMetrics = {
      overallScore,
      groundingScore: groundingResult.isPolicyCompliant ? 100 : 40,
      conceptCoverage,
      distractorQuality,
      bloomAccuracy,
      evidenceCoverage,
      difficultyConfidence,
      pedagogicalValue,
      questionDiversity
    };

    return {
      isValid: overallScore >= 60 && failedChecks.length === 0,
      qualityMetrics,
      failedChecks
    };
  },

  /**
   * Generates full Metadata for a verified question.
   */
  generateMetadata(
    questionId: string | number,
    spec: QuestionGenSpec,
    verification: QuestionVerificationResult
  ): GeneratedQuestionMetadata {
    return {
      questionId,
      subjectId: spec.subjectId,
      chapterId: spec.chapterId,
      conceptId: spec.conceptId,
      blueprintId: spec.blueprint.id,
      evidenceIds: [spec.evidence.evidenceId],
      difficulty: spec.targetDifficultyRating,
      bloomLevel: spec.bloomLevel,
      generationStrategy: `Deterministic Blueprint (${spec.blueprint.name}) + Authoritative NLG`,
      generatedAt: TimeService.now().toISOString(),
      generatorVersion: "v3.6-authoritative-qgen-v1",
      groundingScore: verification.qualityMetrics.groundingScore,
      qualityMetrics: verification.qualityMetrics
    };
  },

  /**
   * Deterministic Fallback Question Generator (Zero External Calls / Pure Grounded Synthesis).
   */
  generateDeterministicFallbackQuestion(spec: QuestionGenSpec, id: number): Question {
    const ev = spec.evidence;
    const qText = `[Chương ${spec.chapterId}] Phát biểu nào sau đây phản ánh chính xác nhất định nghĩa chuẩn về khái niệm "${spec.conceptName}" theo học liệu ${ev.sourcePdf}?`;

    const options = {
      a: ev.definition,
      b: `${ev.definition.slice(0, Math.floor(ev.definition.length / 2))} nhưng áp dụng cho tất cả mọi trường hợp ngoại lệ trong thực tế.`,
      c: `Nhầm lẫn khái niệm ${spec.conceptName} với các thuật ngữ tương đồng thuộc các chương khác.`,
      d: `Là hành vi bề nổi mang tính kinh nghiệm cá nhân không thuộc nội dung giáo trình.`
    };

    const explanation = `**Đáp án đúng: A**. Theo tài liệu "${ev.sourcePdf}" (Trang ${ev.sourcePage}), khái niệm "${spec.conceptName}" được định nghĩa chuẩn xác như sau: "${ev.definition}". Các phương án B, C, D đều vi phạm quy tắc lý luận hoặc chưa chuẩn xác theo nội dung học liệu gốc.`;

    const question: Question = {
      id,
      question: qText,
      options,
      correctAnswer: "a",
      chapterId: spec.chapterId,
      topicId: spec.topicId,
      difficulty: spec.targetDifficulty,
      difficultyRating: spec.targetDifficultyRating,
      explanation,
      sourcePdf: ev.sourcePdf,
      sourcePage: ev.sourcePage,
      knowledgeMapping: [spec.conceptName, `Chương ${spec.chapterId}`],
      relatedQuestions: [],
      estimatedTime: spec.estimatedTimeSeconds,
      questionType: "multiple-choice",
      learningObjective: ev.teachingObjective,
      concept: spec.conceptName,
      misconception: ev.misconception,
      bloomLevel: spec.bloomLevel
    };

    const pedSpec: QuestionSpecification = pedagogicalIntelligenceEngine.createSpecification({
      subjectId: spec.subjectId,
      chapterId: spec.chapterId,
      topicId: spec.topicId,
      targetDifficulty: spec.targetDifficulty,
      preferredBlueprint: spec.blueprint.id
    });

    const verification = this.verifyAndScoreQuestion(question, spec);
    const reviewResult = pedagogicalReviewEngine.reviewQuestion(question, pedSpec);

    question.metadata = this.generateMetadata(id, spec, verification);
    question.pedagogicalMetadata = reviewResult.pedagogicalMetadata;

    return question;
  }
};
