/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LearningPlan } from "./learningPlanner";
import { TeachingDecision } from "./teachingDecisionEngine";
import { StudentModel } from "./learnerModel";
import { Question } from "../types";

export interface StrategyStats {
  strategyName: string;
  totalInteractions: number;
  successRate: number; // 0.0 to 1.0
  averageMasteryGain: number;
  averageRetryCount: number;
  averageTimeImprovement: number;
  averageConfidenceGain: number;
  averageMisconceptionRecovery: number;
  averageSessionCompletion: number;
}

export interface PedagogicalEvaluation {
  id: string;
  timestamp: string;
  conceptName: string;
  teachingStrategy: string;
  bloomLevel: string;
  effectivenessScore: number; // 0.0 to 1.0
  teachingWorked: boolean;
  masteryImprovement: number;
  misconceptionResolved: boolean;
  confidenceDelta: number;
  recommendedBloom: string;
  recommendedDifficulty: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
  retryStrategy: string;
  needsPrerequisiteReview: boolean;
  recommendedTeachingStyle: "Simple" | "Academic" | "Expert" | "Business" | "Real-world" | "Analogy" | "Socratic";
  recommendedReviewInterval: number; // in hours
  nextLearningAction: string;
  reason: string;
  metrics: {
    immediateUnderstanding: number;
    misconceptionRecovery: number;
    responseTimeImprovement: number;
    confidenceCalibration: number;
    bloomReadiness: number;
    retentionPrediction: number;
    teachingStrategyEffectiveness: number;
    cognitiveLoad: number;
    questionFatigue: number;
  };
}

const STRATEGY_STATS_KEY = "poly_econ_pedagogical_strategy_stats";
const EVALUATION_HISTORY_KEY = "poly_econ_pedagogical_evaluation_history";
const MAX_HISTORY = 100;

export const pedagogicalEvaluationEngine = {
  /**
   * Deterministically evaluates the pedagogical outcome of a completed interaction.
   * Does NOT evaluate LLM prose or wording; evaluates ONLY learning effectiveness.
   */
  evaluateInteraction(params: {
    learningPlan: LearningPlan;
    teachingDecision: TeachingDecision;
    studentModel: StudentModel;
    question: Question;
    studentAnswer: string;
    correctAnswer: string;
    responseTimeSeconds: number;
    retryCount: number;
    confidence: number;
    guessDetection: boolean;
    evidenceCoverage: number;
    teachingStrategy: string;
    bloomLevel: string;
    misconceptionType?: string;
  }): PedagogicalEvaluation {
    const {
      learningPlan,
      studentModel,
      question,
      studentAnswer,
      correctAnswer,
      responseTimeSeconds,
      retryCount,
      confidence,
      guessDetection,
      teachingStrategy,
      bloomLevel,
      misconceptionType
    } = params;

    const isCorrect = studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    const conceptName = question.concept || "Khái niệm học thuật";

    // 1. Immediate Understanding Metric (0.0 to 1.0)
    let immediateUnderstanding = isCorrect ? 1.0 : 0.0;
    if (isCorrect && retryCount > 0) {
      immediateUnderstanding = Math.max(0.3, 1.0 - (retryCount * 0.25));
    }
    if (guessDetection) {
      immediateUnderstanding *= 0.5; // Penalize guessing
    }

    // 2. Misconception Recovery Metric (0.0 to 1.0)
    let misconceptionResolved = false;
    let misconceptionRecovery = 0.8;
    if (misconceptionType || question.misconception) {
      if (isCorrect) {
        misconceptionResolved = true;
        misconceptionRecovery = 1.0;
      } else {
        misconceptionResolved = false;
        misconceptionRecovery = 0.1;
      }
    }

    // 3. Response Time Improvement Metric (0.0 to 1.0)
    const avgTime = studentModel.adaptiveMemory.averageThinkingTimeSeconds || 15;
    let responseTimeImprovement = 0.7;
    if (responseTimeSeconds < avgTime && isCorrect) {
      responseTimeImprovement = 1.0; // Fluent mastery
    } else if (responseTimeSeconds < 3 && !isCorrect) {
      responseTimeImprovement = 0.1; // Impulsive error
    } else if (responseTimeSeconds > avgTime * 2.5) {
      responseTimeImprovement = 0.4; // High cognitive struggle
    }

    // 4. Confidence Calibration Metric (0.0 to 1.0)
    let confidenceCalibration = 0.8;
    const confidenceDelta = isCorrect ? +0.08 : -0.12;
    if (confidence > 0.7 && !isCorrect) {
      confidenceCalibration = 0.2; // Overconfidence trap
    } else if (confidence < 0.4 && isCorrect) {
      confidenceCalibration = 0.6; // Underconfident success
    } else if (confidence > 0.7 && isCorrect) {
      confidenceCalibration = 1.0; // Well-calibrated mastery
    }

    // 5. Bloom Readiness Metric (0.0 to 1.0)
    const currentMastery = studentModel.conceptMastery[conceptName] ?? 50;
    let bloomReadiness = 0.5;
    if (isCorrect && currentMastery >= 75) {
      bloomReadiness = 1.0; // Ready for higher Bloom level
    } else if (isCorrect) {
      bloomReadiness = 0.75;
    } else {
      bloomReadiness = 0.2;
    }

    // 6. Retention Prediction Metric (0.0 to 1.0)
    const forgettingScore = studentModel.forgettingScore[conceptName] ?? 1.0;
    const retentionPrediction = isCorrect 
      ? Math.min(1.0, forgettingScore + 0.15)
      : Math.max(0.1, forgettingScore - 0.25);

    // 7. Cognitive Load & Question Fatigue
    const cognitiveLoad = Math.min(1.0, (question.question.length / 300) + (responseTimeSeconds / 60));
    const questionFatigue = studentModel.adaptiveMemory.questionFatigue || 0;

    // 8. Composite Teaching Strategy Effectiveness (0.0 to 1.0)
    const teachingStrategyEffectiveness = parseFloat((
      (immediateUnderstanding * 0.35) +
      (misconceptionRecovery * 0.25) +
      (confidenceCalibration * 0.20) +
      (responseTimeImprovement * 0.20)
    ).toFixed(2));

    const effectivenessScore = teachingStrategyEffectiveness;
    const teachingWorked = effectivenessScore >= 0.70;

    // 9. Mastery Improvement Calculation
    let masteryImprovement = 0;
    if (isCorrect) {
      masteryImprovement = retryCount === 0 ? +10 : +5;
      if (guessDetection) masteryImprovement = +2;
    } else {
      masteryImprovement = -5;
    }

    // 10. Next Pedagogical Recommendations (Strictly Deterministic Rules)
    let recommendedBloom = bloomLevel;
    let recommendedDifficulty: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create" = "Understand";
    let retryStrategy = "socratic_prompt";
    let needsPrerequisiteReview = false;
    let recommendedTeachingStyle: "Simple" | "Academic" | "Expert" | "Business" | "Real-world" | "Analogy" | "Socratic" = "Academic";
    let recommendedReviewInterval = 24; // hours
    let nextLearningAction = "Củng cố lý thuyết bằng câu hỏi thực hành.";
    let reason = "";

    if (!isCorrect) {
      if (retryCount >= 2 || currentMastery < 40) {
        needsPrerequisiteReview = true;
        recommendedTeachingStyle = "Simple";
        recommendedDifficulty = "Remember";
        retryStrategy = "prerequisite_remedial";
        recommendedReviewInterval = 12;
        nextLearningAction = "Quay lại ôn tập kiến thức nền tảng và đọc định nghĩa cốt lõi.";
        reason = `Học viên chưa nắm vững khái niệm ${conceptName} (Độ tinh thông: ${currentMastery}%). Cần hạ cấp Bloom xuống Remember và giảng giải theo phương pháp Simple.`;
      } else {
        recommendedTeachingStyle = "Analogy";
        recommendedDifficulty = "Understand";
        retryStrategy = "socratic_prompt";
        recommendedReviewInterval = 18;
        nextLearningAction = "Đặt câu hỏi gợi mở Socratic với ví dụ ẩn dụ.";
        reason = `Học viên trả lời chưa đúng nhưng có thể tự điều chỉnh. Đề xuất gợi ý Socratic ngắn gọn kết hợp ẩn dụ thực tế.`;
      }
    } else {
      if (bloomReadiness > 0.8 && currentMastery >= 70) {
        const bloomOrder = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
        const curIdx = bloomOrder.indexOf(bloomLevel);
        const nextIdx = Math.min(bloomOrder.length - 1, curIdx + 1);
        recommendedBloom = bloomOrder[nextIdx];
        recommendedDifficulty = recommendedBloom as any;
        recommendedTeachingStyle = "Business";
        recommendedReviewInterval = 72; // 3 days
        nextLearningAction = "Nâng cấp cấp độ tư duy Bloom và thử thách câu hỏi tình huống thực tế.";
        reason = `Học viên đạt hiệu quả học tập cao (${Math.round(effectivenessScore * 100)}%). Sẵn sàng nâng cấp tư duy Bloom lên ${recommendedBloom}.`;
      } else {
        recommendedTeachingStyle = "Socratic";
        recommendedDifficulty = "Understand";
        recommendedReviewInterval = 48; // 2 days
        nextLearningAction = "Củng cố phản xạ câu hỏi với bài tập tương tự.";
        reason = `Học viên tiếp thu đúng nhưng cần rèn luyện độ bền ghi nhớ trước khi tiến xa hơn.`;
      }
    }

    const evaluation: PedagogicalEvaluation = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      conceptName,
      teachingStrategy,
      bloomLevel,
      effectivenessScore,
      teachingWorked,
      masteryImprovement,
      misconceptionResolved,
      confidenceDelta,
      recommendedBloom,
      recommendedDifficulty,
      retryStrategy,
      needsPrerequisiteReview,
      recommendedTeachingStyle,
      recommendedReviewInterval,
      nextLearningAction,
      reason,
      metrics: {
        immediateUnderstanding,
        misconceptionRecovery,
        responseTimeImprovement,
        confidenceCalibration,
        bloomReadiness,
        retentionPrediction,
        teachingStrategyEffectiveness,
        cognitiveLoad,
        questionFatigue
      }
    };

    // 11. Save to Strategy Stats Database & Evaluation History
    this.recordStrategyStats(teachingStrategy, evaluation);
    this.saveEvaluationHistory(evaluation);

    return evaluation;
  },

  getStrategyStats(): Record<string, StrategyStats> {
    const raw = localStorage.getItem(STRATEGY_STATS_KEY);
    const defaults: Record<string, StrategyStats> = {
      Simple: { strategyName: "Simple", totalInteractions: 0, successRate: 0, averageMasteryGain: 0, averageRetryCount: 0, averageTimeImprovement: 0, averageConfidenceGain: 0, averageMisconceptionRecovery: 0, averageSessionCompletion: 100 },
      Academic: { strategyName: "Academic", totalInteractions: 0, successRate: 0, averageMasteryGain: 0, averageRetryCount: 0, averageTimeImprovement: 0, averageConfidenceGain: 0, averageMisconceptionRecovery: 0, averageSessionCompletion: 100 },
      Expert: { strategyName: "Expert", totalInteractions: 0, successRate: 0, averageMasteryGain: 0, averageRetryCount: 0, averageTimeImprovement: 0, averageConfidenceGain: 0, averageMisconceptionRecovery: 0, averageSessionCompletion: 100 },
      Business: { strategyName: "Business", totalInteractions: 0, successRate: 0, averageMasteryGain: 0, averageRetryCount: 0, averageTimeImprovement: 0, averageConfidenceGain: 0, averageMisconceptionRecovery: 0, averageSessionCompletion: 100 },
      "Real-world": { strategyName: "Real-world", totalInteractions: 0, successRate: 0, averageMasteryGain: 0, averageRetryCount: 0, averageTimeImprovement: 0, averageConfidenceGain: 0, averageMisconceptionRecovery: 0, averageSessionCompletion: 100 },
      Analogy: { strategyName: "Analogy", totalInteractions: 0, successRate: 0, averageMasteryGain: 0, averageRetryCount: 0, averageTimeImprovement: 0, averageConfidenceGain: 0, averageMisconceptionRecovery: 0, averageSessionCompletion: 100 },
      Socratic: { strategyName: "Socratic", totalInteractions: 0, successRate: 0, averageMasteryGain: 0, averageRetryCount: 0, averageTimeImprovement: 0, averageConfidenceGain: 0, averageMisconceptionRecovery: 0, averageSessionCompletion: 100 }
    };

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      } catch {
        // return defaults
      }
    }
    return defaults;
  },

  recordStrategyStats(strategyName: string, evalResult: PedagogicalEvaluation): void {
    const stats = this.getStrategyStats();
    const current = stats[strategyName] || {
      strategyName,
      totalInteractions: 0,
      successRate: 0,
      averageMasteryGain: 0,
      averageRetryCount: 0,
      averageTimeImprovement: 0,
      averageConfidenceGain: 0,
      averageMisconceptionRecovery: 0,
      averageSessionCompletion: 100
    };

    const n = current.totalInteractions + 1;
    const isSuccess = evalResult.teachingWorked ? 1 : 0;

    stats[strategyName] = {
      strategyName,
      totalInteractions: n,
      successRate: parseFloat(((current.successRate * (n - 1) + isSuccess) / n).toFixed(2)),
      averageMasteryGain: parseFloat(((current.averageMasteryGain * (n - 1) + evalResult.masteryImprovement) / n).toFixed(2)),
      averageRetryCount: parseFloat(((current.averageRetryCount * (n - 1) + (evalResult.teachingWorked ? 0 : 1)) / n).toFixed(2)),
      averageTimeImprovement: parseFloat(((current.averageTimeImprovement * (n - 1) + evalResult.metrics.responseTimeImprovement) / n).toFixed(2)),
      averageConfidenceGain: parseFloat(((current.averageConfidenceGain * (n - 1) + evalResult.confidenceDelta) / n).toFixed(3)),
      averageMisconceptionRecovery: parseFloat(((current.averageMisconceptionRecovery * (n - 1) + evalResult.metrics.misconceptionRecovery) / n).toFixed(2)),
      averageSessionCompletion: 100
    };

    localStorage.setItem(STRATEGY_STATS_KEY, JSON.stringify(stats));
  },

  getEvaluationHistory(): PedagogicalEvaluation[] {
    const raw = localStorage.getItem(EVALUATION_HISTORY_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  },

  saveEvaluationHistory(evalResult: PedagogicalEvaluation): void {
    const history = this.getEvaluationHistory();
    history.unshift(evalResult);
    if (history.length > MAX_HISTORY) {
      history.pop();
    }
    localStorage.setItem(EVALUATION_HISTORY_KEY, JSON.stringify(history));
  }
};
