/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudentModel } from "./learnerModel";
import { EvidenceSet, ReasoningContext } from "./evidencePipeline";
import { TeachingDecision } from "./teachingDecisionEngine";

export interface LearningPlan {
  objective: string;
  nextConcept: string;
  bloom: string;
  strategy: string;
  explanationDepth: "academic" | "simplified" | "intuitive" | "visual";
  reviewMode: boolean;
  reviewReason?: string;
  microQuiz: boolean;
  analogy: boolean;
  counterExample: boolean;
  followUp: string;
}

export const learningPlanner = {
  /**
   * Generates a completely deterministic LearningPlan based on student state and teaching decision.
   * Runs locally on the server without any LLM intervention, establishing clear modular boundaries.
   */
  generatePlan(params: {
    subjectId: string;
    conceptName: string;
    studentModel: StudentModel;
    evidence: EvidenceSet;
    reasoning: ReasoningContext;
    decision: TeachingDecision;
    guessingProbability: number;
  }): LearningPlan {
    const { conceptName, studentModel, decision, reasoning, guessingProbability } = params;
    
    // 1. Determine learning objective
    let objective = `Tìm hiểu và làm chủ khái niệm "${conceptName}" ở cấp độ tư duy "${decision.suggestedBloomLevel}"`;
    if (decision.actionType === "RemediateMisconception" && decision.targetMisconception) {
      objective = `Khắc phục triệt để bẫy nhận thức về "${decision.targetMisconception}" đối với khái niệm "${conceptName}"`;
    } else if (decision.actionType === "IntroduceConcept" && decision.remedialConceptName) {
      objective = `Củng cố lại khái niệm tiên quyết "${decision.remedialConceptName}" để bổ trợ vững chắc trước khi tiếp thu khái niệm "${conceptName}"`;
    } else if (decision.actionType === "AdvanceBloomLevel") {
      objective = `Nâng nấc thang nhận thức tư duy cho khái niệm "${conceptName}" lên cấp độ mới "${decision.suggestedBloomLevel}"`;
    } else if (decision.actionType === "ReviewSpacedRepetition") {
      objective = `Kích hoạt cơ chế ôn tập ngắt quãng (Spaced Repetition) để gia cố vết hằn trí nhớ dài hạn đối với khái niệm "${conceptName}"`;
    } else if (decision.actionType === "BoostConfidence") {
      objective = `Củng cố độ tự tin tích lũy và giải thích trực quan, sinh động khái niệm "${conceptName}" cho học viên`;
    }

    // 2. Next concept target
    const nextConcept = (decision.actionType === "IntroduceConcept" && decision.remedialConceptName)
      ? decision.remedialConceptName
      : conceptName;

    // 3. Bloom level
    const bloom = decision.suggestedBloomLevel;

    // 4. Strategy name
    const strategy = decision.actionType;

    // 5. Explanation style depth
    let explanationDepth: LearningPlan["explanationDepth"] = "academic";
    const prefStyle = studentModel.adaptiveMemory.preferredExplanationStyle;
    if (prefStyle) {
      explanationDepth = prefStyle;
    } else {
      const mastery = studentModel.conceptMastery[conceptName] !== undefined ? studentModel.conceptMastery[conceptName] : 50;
      if (mastery < 45 || studentModel.adaptiveMemory.questionFatigue > 70) {
        explanationDepth = "simplified";
      } else if (mastery > 80) {
        explanationDepth = "academic";
      }
    }

    // 6. Review mode flag
    const reviewMode = decision.actionType === "ReviewSpacedRepetition" || decision.actionType === "IntroduceConcept";

    // 7. Review reason explanation
    let reviewReason: string | undefined;
    if (decision.actionType === "ReviewSpacedRepetition") {
      reviewReason = `Chỉ số độ bền trí nhớ dài hạn đã giảm xuống dưới mức an toàn (${Math.round(decision.developerTrace.forgettingScore * 100)}%), cần ôn tập khẩn cấp.`;
    } else if (decision.actionType === "IntroduceConcept" && decision.remedialConceptName) {
      reviewReason = `Chưa vượt qua chốt chặn năng lực tiên quyết "${decision.remedialConceptName}". Cần quay lại bù đắp lỗ hổng kiến thức nền móng.`;
    }

    // 8. Micro quiz inclusion flag
    const microQuiz = decision.actionType === "AdvanceBloomLevel" || (studentModel.conceptMastery[conceptName] || 50) > 75;

    // 9. Analogy inclusion flag
    const analogy = decision.actionType === "BoostConfidence" || 
                    decision.actionType === "RemediateMisconception" || 
                    (studentModel.conceptMastery[conceptName] || 50) < 60 || 
                    studentModel.adaptiveMemory.preferredAnalogy === "daily_life";

    // 10. Counter-example inclusion flag
    const counterExample = decision.actionType === "RemediateMisconception" || guessingProbability > 0.5;

    // 11. Follow up plan
    let followUp = `Đánh giá nhanh độ hiểu bài bằng câu hỏi ngắn hoặc trắc nghiệm bám sát giáo trình.`;
    if (decision.actionType === "RemediateMisconception") {
      followUp = `Yêu cầu học viên tự giải thích lại bẫy nhận thức bằng cách so sánh phương án đúng/sai.`;
    } else if (decision.actionType === "IntroduceConcept" && decision.remedialConceptName) {
      followUp = `Kiểm tra xem học viên đã thấu suốt khái niệm nền tảng chưa để chuyển tiếp quay lại câu hỏi gốc.`;
    } else if (decision.actionType === "AdvanceBloomLevel") {
      followUp = `Đưa ra bài tập áp dụng thực tiễn của khái niệm này ở cấp độ năng lực tư duy mới nâng cao.`;
    }

    return {
      objective,
      nextConcept,
      bloom,
      strategy,
      explanationDepth,
      reviewMode,
      reviewReason,
      microQuiz,
      analogy,
      counterExample,
      followUp
    };
  }
};
