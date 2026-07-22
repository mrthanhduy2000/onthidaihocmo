/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QuestionSpecification, DifficultyLevel } from "../types";
import { kbService, KnowledgeNode } from "./kbService";
import { dbService } from "./db";
import { learnerModelService } from "./learnerModel";
import { SUPPORTED_BLUEPRINTS, BlueprintType, DistractorType, SUPPORTED_DISTRACTORS } from "./questionGenerationEngine";

export interface DecisionContext {
  subjectId: string;
  chapterId?: number;
  topicId?: string;
  targetDifficulty?: DifficultyLevel;
  preferredBlueprint?: BlueprintType;
  studentLevel?: "Yếu" | "Trung bình" | "Khá" | "Giỏi";
}

// ============================================================================
// PEDAGOGICAL DECISION RULES CATALOG
// ============================================================================

export const DECISION_RULES = {
  RULE_1_WEAK_CONCEPT_PRIORITY: "Ưu tiên chọn các khái niệm có điểm mastery thấp nhất từ Student Model để hỗ trợ lấp lỗ hổng kiến thức.",
  RULE_2_BLOOM_ALIGNMENT: "Căn chỉnh mức độ tư duy Bloom tương ứng với thứ bậc năng lực của sinh viên (Yếu -> Remember/Understand, Khá/Giỏi -> Apply/Analyze/Evaluate).",
  RULE_3_BLUEPRINT_FIT: "Khái niệm có bẫy sai lầm rõ ràng sẽ ưu tiên Blueprint MISCONCEPTION hoặc NOT_QUESTION để rèn luyện tư duy phản biện.",
  RULE_4_SCENARIO_FOR_APPLIED_CONCEPTS: "Các khái niệm có ví dụ thực tiễn phong phú sẽ được biên soạn theo Blueprint SCENARIO hoặc CASE_STUDY.",
  RULE_5_DISTRACTOR_MISCONCEPTION_PAIRING: "Bắt buộc cài cắm ít nhất 1 phương án nhiễu trực tiếp đánh vào bẫy sai lầm phổ biến đã ghi nhận trong Knowledge Graph.",
  RULE_6_SOURCE_EVIDENCE_STRICTNESS: "Mọi câu hỏi phải được ràng buộc bởi duy nhất Dữ liệu Chứng cứ (Evidence Slice) nguyên văn từ giáo trình upload."
};

export const pedagogicalIntelligenceEngine = {
  /**
   * Deterministically plans and creates a QuestionSpecification.
   * Does NOT call Gemini or generate question text.
   */
  createSpecification(context: DecisionContext): QuestionSpecification {
    const subjectId = context.subjectId || dbService.getActiveSubjectId();
    const knowledgeGraph = kbService.getKnowledgeGraph(subjectId);

    if (!knowledgeGraph || knowledgeGraph.length === 0) {
      throw new Error(`Knowledge Graph trống hoặc chưa khởi tạo cho môn ${subjectId}`);
    }

    // 1. Concept Selection (Knowledge Graph + Student Model Integration)
    let candidateNodes = knowledgeGraph;
    if (context.chapterId) {
      candidateNodes = candidateNodes.filter(n => n.chapter === context.chapterId);
    }
    if (context.topicId) {
      candidateNodes = candidateNodes.filter(n => n.topic === context.topicId);
    }
    if (candidateNodes.length === 0) {
      candidateNodes = knowledgeGraph;
    }

    const stats = dbService.getStatistics();
    const conceptMastery = stats.conceptMastery || {};

    // Sort by lowest mastery score (Student Model feedback)
    candidateNodes.sort((a, b) => {
      const mA = conceptMastery[a.concept] ?? 50;
      const mB = conceptMastery[b.concept] ?? 50;
      return mA - mB;
    });

    const selectedConceptNode = candidateNodes[0];

    // 2. Student Level Determination
    let studentLevel = context.studentLevel;
    if (!studentLevel) {
      const overallMastery = stats.totalSolved > 0 
        ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) 
        : 60;
      if (overallMastery < 50) studentLevel = "Yếu";
      else if (overallMastery < 70) studentLevel = "Trung bình";
      else if (overallMastery < 85) studentLevel = "Khá";
      else studentLevel = "Giỏi";
    }

    // 3. Blueprint & Bloom Decision Engine (100% Deterministic)
    let blueprintType: BlueprintType;
    if (context.preferredBlueprint && SUPPORTED_BLUEPRINTS[context.preferredBlueprint]) {
      blueprintType = context.preferredBlueprint;
    } else {
      // Deterministic Pedagogical Rules for Blueprint Selection based on Misconception Persistence
      const wrongCount = stats.incorrectQuestionHistory?.[selectedConceptNode.id] || 0;
      if (wrongCount >= 2 || (selectedConceptNode.commonMistakes && selectedConceptNode.commonMistakes.length > 10)) {
        blueprintType = wrongCount > 3 ? "MISCONCEPTION" : "NOT_QUESTION";
      } else if (selectedConceptNode.teaching?.realWorldExample) {
        blueprintType = studentLevel === "Giỏi" || studentLevel === "Khá" ? "SCENARIO" : "APPLICATION";
      } else if (selectedConceptNode.dependencies?.confusedWith && selectedConceptNode.dependencies.confusedWith.length > 0) {
        blueprintType = "COMPARISON";
      } else {
        blueprintType = studentLevel === "Yếu" ? "DEFINITION" : "RECOGNITION";
      }
    }

    const blueprintDef = SUPPORTED_BLUEPRINTS[blueprintType];
    const bloomLevel = blueprintDef.defaultBloom;

    // 4. Difficulty Decision
    let difficulty: DifficultyLevel = context.targetDifficulty || "Trung bình";
    if (!context.targetDifficulty) {
      if (bloomLevel === "Remember") difficulty = "Dễ";
      else if (bloomLevel === "Apply" || bloomLevel === "Understand") difficulty = "Trung bình";
      else difficulty = "Khó";
    }

    // 5. Misconception & Distractor Strategy Selection
    const expectedMisconception = selectedConceptNode.commonMistakes || 
      selectedConceptNode.teaching?.misconception || 
      `Nhầm lẫn bản chất lý thuyết giữa ${selectedConceptNode.concept} và các thuật ngữ cùng chương`;

    const distractorStrategyTypes: DistractorType[] = [
      "MISCONCEPTION",
      "CONFUSED_CONCEPT",
      "OPPOSITE_CONCEPT"
    ];

    if (blueprintType === "NOT_QUESTION" || blueprintType === "EXCEPTION") {
      distractorStrategyTypes[1] = "OVERGENERALIZATION";
    } else if (blueprintType === "DEFINITION" || blueprintType === "RECOGNITION") {
      distractorStrategyTypes[2] = "ALTERNATIVE_DEFINITION";
    }

    // 6. Learning Objective Construction
    const learningObjective = selectedConceptNode.teaching?.learningObjective ||
      `Đánh giá năng lực ${bloomLevel.toLowerCase()} về khái niệm "${selectedConceptNode.concept}" thuộc Chương ${selectedConceptNode.chapter}.`;

    // 7. Rationale & Explanations
    const pedagogicalReason = `Đánh giá năng lực của người học cấp độ [${studentLevel}] đối với khái niệm trọng tâm [${selectedConceptNode.concept}]. Sử dụng dạng bài [${blueprintDef.name}] để kiểm tra kĩ năng [${bloomLevel}] và xử lý bẫy nhận thức.`;

    const whyBlueprintSelected = `Blueprint [${blueprintDef.name}] được chọn vì phù hợp với đặc tính học thuật của khái niệm "${selectedConceptNode.concept}" và mục tiêu rèn luyện tư duy ${bloomLevel}.`;
    
    const whyDifficultySelected = `Độ khó [${difficulty}] được ấn định tương thích với trình độ hiện tại [${studentLevel}] của học viên trong Student Model.`;

    // 8. Prerequisites & Evidence IDs
    const prerequisiteConcepts = selectedConceptNode.dependencies?.relatedConcepts || [];
    const evidenceIds = [`EVID_${selectedConceptNode.id}_CH${selectedConceptNode.chapter}`];

    // 9. Generation Constraints
    const generationConstraints = [
      "SINGLE_SOURCE_OF_TRUTH: Tuyệt đối không sử dụng kiến thức ngoài tài liệu upload.",
      "EXACT_CITATION_REQUIRED: Lời giải bắt buộc trích dẫn nguồn giáo trình/slide/trang.",
      "DISTRACTOR_PLAUSIBILITY: 3 phương án nhiễu phải thiết kế theo đúng chiến lược nhiễu chỉ định.",
      "NO_PRETRAINED_KNOWLEDGE: Không tự thêm ví dụ không thuộc tài liệu trừ khi dán nhãn ví dụ minh họa.",
      "SINGLE_CORRECT_ANSWER: Đảm bảo có duy nhất 1 đáp án đúng hoàn toàn."
    ];

    return {
      questionIndex: 1,
      concept: selectedConceptNode.concept,
      bloom: bloomLevel as any,
      reason: pedagogicalReason,
      learningObjective,
      conceptId: selectedConceptNode.id,
      conceptName: selectedConceptNode.concept,
      chapterId: selectedConceptNode.chapter,
      topicId: selectedConceptNode.topic,
      subjectId,
      blueprint: blueprintType,
      bloomLevel,
      difficulty,
      targetStudentLevel: studentLevel,
      pedagogicalReason,
      expectedMisconception,
      prerequisiteConcepts,
      evidenceIds,
      distractorStrategy: distractorStrategyTypes,
      generationConstraints,
    };
  }
};
