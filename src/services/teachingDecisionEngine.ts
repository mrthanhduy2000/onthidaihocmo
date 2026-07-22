/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { studentModelService, learnerModelService } from "./learnerModel";
import { kbService, KnowledgeNode } from "./kbService";
import { dbService } from "./db";
import { TimeService } from "./time";

export interface TeachingDecision {
  decisionId: string;
  timestamp: string;
  conceptName: string;
  actionType: "IntroduceConcept" | "RemediateMisconception" | "AdvanceBloomLevel" | "ReviewSpacedRepetition" | "BoostConfidence" | "StandardTeaching";
  reasonCode: "ConceptWeak" | "MisconceptionDetected" | "ConceptMasteredReadyToAdvance" | "ConceptReviewDue" | "ConfidenceLow" | "StandardTeachingCycle";
  reasonText: string;
  suggestedBloomLevel: string;
  remedialConceptName?: string;
  remedialExplanation?: string;
  targetMisconception?: string;
  developerTrace: {
    forgettingScore: number;
    currentMastery: number;
    currentConfidence: number;
    consecutiveIncorrectCount: number;
    bloomProgression: string;
    learningVelocity: number;
    decisionPath: string;
  };
}

export const teachingDecisionEngine = {
  /**
   * Evaluates the Student Model and Knowledge Model to make an authoritative teaching decision.
   */
  makeDecision(
    subjectId: string,
    conceptName: string,
    questionId?: number
  ): TeachingDecision {
    const studentModel = studentModelService.getStudentModel();
    const graph = kbService.getKnowledgeGraph(subjectId);
    
    // Find concept node by concept name or id
    const conceptNode = graph.find(
      n => n.concept.toLowerCase() === conceptName.toLowerCase() || n.id.toLowerCase() === conceptName.toLowerCase()
    );

    const actualConceptName = conceptNode ? conceptNode.concept : conceptName;

    const mastery = studentModel.conceptMastery[actualConceptName] !== undefined 
      ? studentModel.conceptMastery[actualConceptName] 
      : 50;

    const confidenceHistory = studentModel.confidenceHistory[actualConceptName] || [0.5];
    const currentConfidence = confidenceHistory[confidenceHistory.length - 1] ?? 0.5;
    
    const forgettingScore = studentModel.forgettingScore[actualConceptName] !== undefined 
      ? studentModel.forgettingScore[actualConceptName] 
      : 1.0;

    const bloomLevel = studentModel.bloomLevel[actualConceptName] || "Understand";
    const velocity = studentModel.learningVelocity[actualConceptName] || 0;
    const misconceptions = studentModel.misconceptionHistory[actualConceptName] || [];

    // Analyze consecutive failures
    let consecutiveIncorrectCount = 0;
    const profiles = learnerModelService.getConceptProfiles();
    const profile = profiles[actualConceptName];
    if (profile) {
      consecutiveIncorrectCount = profile.streak === 0 ? Math.min(profile.incorrectCount, 3) : 0;
    }

    let actionType: TeachingDecision["actionType"] = "StandardTeaching";
    let reasonCode: TeachingDecision["reasonCode"] = "StandardTeachingCycle";
    let reasonText = `Thực hiện chu trình giảng dạy chuẩn tắc dựa trên giáo trình cho khái niệm "${actualConceptName}".`;
    let suggestedBloomLevel = bloomLevel;
    let remedialConceptName: string | undefined;
    let remedialExplanation: string | undefined;
    let targetMisconception: string | undefined;
    let decisionPath = "Default standard path";

    // DECISION TREE (Deterministic, explainable rules in order of structural priority):
    
    // Rule 1. Active Misconception Remediation (High Priority)
    if (misconceptions.length > 0 && consecutiveIncorrectCount >= 1) {
      const lastMisconception = misconceptions[misconceptions.length - 1];
      actionType = "RemediateMisconception";
      reasonCode = "MisconceptionDetected";
      reasonText = `Phát hiện bẫy nhận thức lặp lại: "${lastMisconception.misconception}". Cần tập trung sửa sai bẫy tư duy này bằng phương pháp đối chiếu Socratic.`;
      targetMisconception = lastMisconception.misconception;
      decisionPath = "Rule 1: Active Misconception Remediation";
    }
    // Rule 2. Prerequisite Checking (Concept Dependency Graph)
    else if (conceptNode?.dependencies?.requires && conceptNode.dependencies.requires.length > 0) {
      const nodeMap = new Map<string, KnowledgeNode>();
      graph.forEach(n => {
        nodeMap.set(n.concept.toLowerCase(), n);
        nodeMap.set(n.id.toLowerCase(), n);
      });

      // Find first unmastered prerequisite (< 50% mastery)
      let weakPrereq: KnowledgeNode | undefined;
      for (const req of conceptNode.dependencies.requires) {
        const reqNode = nodeMap.get(req.toLowerCase());
        if (reqNode) {
          const reqMastery = studentModel.conceptMastery[reqNode.concept] !== undefined 
            ? studentModel.conceptMastery[reqNode.concept] 
            : 50;
          if (reqMastery < 50) {
            weakPrereq = reqNode;
            break;
          }
        }
      }

      if (weakPrereq) {
        actionType = "IntroduceConcept";
        reasonCode = "ConceptWeak";
        reasonText = `Học viên bị hổng kiến thức nền tảng tại khái niệm tiên quyết "${weakPrereq.concept}" (Độ thạo: ${studentModel.conceptMastery[weakPrereq.concept] || 0}%). Hệ thống quyết định tạm dừng bài giảng "${actualConceptName}" để quay lại củng cố khái niệm nền móng này.`;
        remedialConceptName = weakPrereq.concept;
        remedialExplanation = weakPrereq.definition;
        decisionPath = `Rule 2: Prerequisite knowledge block -> Remediate ${weakPrereq.concept}`;
      }
    }

    // Rule 3. Spaced Repetition Due (Forgetting curve decay below 60%)
    if (actionType === "StandardTeaching" && forgettingScore < 0.6) {
      actionType = "ReviewSpacedRepetition";
      reasonCode = "ConceptReviewDue";
      reasonText = `Chỉ số ghi nhớ của khái niệm "${actualConceptName}" đã suy giảm xuống mức cảnh báo ${Math.round(forgettingScore * 100)}%. Cần kích hoạt phiên ôn tập Spaced Repetition ngay để củng cố vết hằn trí nhớ dài hạn.`;
      decisionPath = "Rule 3: Spaced Repetition Due";
    }
    // Rule 4. Low Confidence Booster (Confidence below 35%)
    else if (actionType === "StandardTeaching" && currentConfidence < 0.35) {
      actionType = "BoostConfidence";
      reasonCode = "ConfidenceLow";
      reasonText = `Mức độ tự tin tích lũy của học viên đối với khái niệm "${actualConceptName}" đang ở mức rất thấp (${Math.round(currentConfidence * 100)}%). Cần hạ độ phức tạp sư phạm, cung cấp các ví dụ thực tiễn trực quan sinh động và lời khuyên động viên tích cực.`;
      decisionPath = "Rule 4: Low Confidence Booster";
    }
    // Rule 5. Concept Mastered -> Ready to Advance Bloom level
    else if (actionType === "StandardTeaching" && mastery >= 80) {
      if (studentModel.adaptiveMemory.questionFatigue > 75) {
        actionType = "BoostConfidence";
        reasonCode = "ConfidenceLow";
        reasonText = `Học viên tinh thông khái niệm "${actualConceptName}" (${mastery}%) nhưng chỉ số mệt mỏi nhận thức đang cao (${studentModel.adaptiveMemory.questionFatigue}%). Tạm hoãn nâng nấc Bloom để tránh quá tải, tập trung củng cố thư giãn.`;
        decisionPath = "Rule 5 Alt: High Fatigue -> Boost Confidence Instead";
      } else {
        actionType = "AdvanceBloomLevel";
        reasonCode = "ConceptMasteredReadyToAdvance";
        
        const bloomLevels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
        const currentIdx = bloomLevels.indexOf(bloomLevel);
        const nextBloom = currentIdx < bloomLevels.length - 1 ? bloomLevels[currentIdx + 1] : "Create";
        
        reasonText = `Học viên đã tinh thông xuất sắc khái niệm "${actualConceptName}" với độ thạo ${mastery}%. Hệ thống quyết định nâng nấc thang năng lực tư duy (Bloom Level) từ "${bloomLevel}" lên nấc mới "${nextBloom}" để kích thích phát triển trí tuệ chuyên gia.`;
        suggestedBloomLevel = nextBloom;
        decisionPath = "Rule 5: Mastery Peak -> Advance Bloom Level";
      }
    }

    const decision: TeachingDecision = {
      decisionId: `td-${TimeService.nowTimestamp()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: TimeService.now().toISOString(),
      conceptName: actualConceptName,
      actionType,
      reasonCode,
      reasonText,
      suggestedBloomLevel,
      remedialConceptName,
      remedialExplanation,
      targetMisconception,
      developerTrace: {
        forgettingScore,
        currentMastery: mastery,
        currentConfidence,
        consecutiveIncorrectCount,
        bloomProgression: `${bloomLevel} -> ${suggestedBloomLevel}`,
        learningVelocity: velocity,
        decisionPath
      }
    };

    // Store teaching decision history in LocalStorage for developer trace log audit
    this.logDecision(decision);

    return decision;
  },

  logDecision(decision: TeachingDecision): void {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_teaching_decisions_log_${activeSubjectId}`;
    const raw = localStorage.getItem(key);
    let logs: TeachingDecision[] = [];
    if (raw) {
      try {
        logs = JSON.parse(raw);
      } catch {
        logs = [];
      }
    }
    logs.push(decision);
    // Keep last 100 decisions
    localStorage.setItem(key, JSON.stringify(logs.slice(-100)));
    
    // Also log to console for debugging and trace validation
    console.log(`[TEACHING DECISION LOG] ID: ${decision.decisionId} | Action: ${decision.actionType} | Reason: ${decision.reasonText}`);
  },

  getDecisionHistory(): TeachingDecision[] {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_teaching_decisions_log_${activeSubjectId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
};
