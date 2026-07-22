/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService, questions, chapters } from "./db";
import { 
  SubjectGoal, 
  ExamPrediction, 
  StudyActivityROI, 
  StudyDebtItem, 
  ForecastCalibrationProfile,
  SensitivityItem,
  UncertaintyDecomposition,
  StressTestReport
} from "../types";
import { TimeService } from "./time";

/**
 * PHASE NEXT — SELF-CALIBRATING FORECASTING ENGINE v3.0 (Deterministic Optimization Layer)
 * 
 * 1. Self-Calibration Layer (Bias tracking per chapter, difficulty, bloom, examType)
 * 2. Adaptive Weight Auto Optimization (Evidence-based weights without ML)
 * 3. Local Sensitivity Analysis (Marginal point gain & opportunity cost)
 * 4. Diminishing Return Model v2 (Non-linear exponential/logarithmic decay)
 * 5. Confidence Stability Index (Narrow vs Wide margin based on variance)
 * 6. Uncertainty Decomposition (7 distinct uncertainty vectors)
 * 7. Dependency Propagation (Prerequisite weakness decay downstream)
 * 8. Opportunity Cost Engine (Point loss if activities skipped)
 * 9. Deadline Pressure Curve (Stage-aware non-linear deadline curve)
 * 10. Transparent Explanation Engine (Detailed multi-factor audit)
 * 11. Forecast Stress Test (Deterministic scenario simulations)
 * 12. Complete Backward Compatibility & Zero External Dependencies
 */

// Prerequisite Knowledge Graph mapping (Concept Prerequisite Relationships)
const PREREQUISITE_MAP: Record<string, string[]> = {
  "GiaCanBang": ["CoDiem"],
  "DoanhThuToiDa": ["DoCoCoSo"],
  "PricingStrategy": ["DoCoCoSo", "GiaCanBang"],
  "ChiPhiDaiHan": ["ChiPhiNganHan"],
  "LoiNhuanToiDa": ["ChiPhiDaiHan", "GiaCanBang"],
  "ThiTruongDocQuyen": ["LoiNhuanToiDa"],
  "OligopolyEquilibrium": ["ThiTruongDocQuyen"]
};

// Ánh xạ tên giai đoạn ôn tập (khóa nội bộ tiếng Anh) sang nhãn hiển thị tiếng Việt cho người học.
const STAGE_LABEL_VN: Record<string, string> = {
  "Foundation": "Xây nền",
  "Memory Refresh": "Ôn nhớ nhanh",
  "Error Review": "Sửa lỗi sai",
  "Mock Exam": "Thi thử",
  "Adaptive Practice": "Luyện thích ứng",
  "Coverage": "Phủ kiến thức"
};
const stageLabelVN = (key: string): string => STAGE_LABEL_VN[key] || key;

export const examForecaster = {
  /**
   * Retrieves or initializes the persistent Forecast Calibration Profile for a subject.
   */
  getCalibrationProfile(subjectId?: string): ForecastCalibrationProfile {
    const activeSub = subjectId || dbService.getActiveSubjectId();
    const storageKey = `poly_econ_forecast_calibration_${activeSub}`;
    const raw = localStorage.getItem(storageKey);

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            subjectId: activeSub,
            overallBias: parsed.overallBias || 0,
            chapterBias: parsed.chapterBias || {},
            difficultyBias: parsed.difficultyBias || {},
            bloomBias: parsed.bloomBias || {},
            examTypeBias: parsed.examTypeBias || {},
            predictionVariance: parsed.predictionVariance || 0.15,
            calibrationCount: parsed.calibrationCount || 0,
            calibrationHistory: Array.isArray(parsed.calibrationHistory) ? parsed.calibrationHistory : []
          };
        }
      } catch (e) {
        console.warn("Error parsing calibration profile, resetting:", e);
      }
    }

    return {
      subjectId: activeSub,
      overallBias: 0,
      chapterBias: {},
      difficultyBias: {},
      bloomBias: {},
      examTypeBias: {},
      predictionVariance: 0.15,
      calibrationCount: 0,
      calibrationHistory: []
    };
  },

  /**
   * Saves calibration profile to localStorage.
   */
  saveCalibrationProfile(profile: ForecastCalibrationProfile): void {
    const storageKey = `poly_econ_forecast_calibration_${profile.subjectId}`;
    localStorage.setItem(storageKey, JSON.stringify(profile));
  },

  /**
   * Self-Calibration Method: Registers actual exam outcome to auto-calibrate system bias.
   */
  registerActualExamResult(params: {
    subjectId?: string;
    actualScore: number; // 0 - 10
    predictedScoreAtTime: number; // 0 - 10
    examType?: string;
    chapterId?: number;
    difficulty?: string;
    bloomLevel?: string;
  }): ForecastCalibrationProfile {
    const profile = this.getCalibrationProfile(params.subjectId);
    const bias = Math.round((params.actualScore - params.predictedScoreAtTime) * 100) / 100;
    
    const count = profile.calibrationCount;
    const newCount = count + 1;

    // Incremental Mean Bias calculation
    const newOverallBias = Math.round(((profile.overallBias * count + bias) / newCount) * 100) / 100;

    // Update specific chapter bias
    const chapterBias = { ...profile.chapterBias };
    if (params.chapterId !== undefined) {
      const prev = chapterBias[params.chapterId] || 0;
      chapterBias[params.chapterId] = Math.round(((prev * count + bias) / newCount) * 100) / 100;
    }

    // Update difficulty bias
    const difficultyBias = { ...profile.difficultyBias };
    if (params.difficulty) {
      const prev = difficultyBias[params.difficulty] || 0;
      difficultyBias[params.difficulty] = Math.round(((prev * count + bias) / newCount) * 100) / 100;
    }

    // Update bloom bias
    const bloomBias = { ...profile.bloomBias };
    if (params.bloomLevel) {
      const prev = bloomBias[params.bloomLevel] || 0;
      bloomBias[params.bloomLevel] = Math.round(((prev * count + bias) / newCount) * 100) / 100;
    }

    // Update examType bias
    const examTypeBias = { ...profile.examTypeBias };
    if (params.examType) {
      const prev = examTypeBias[params.examType] || 0;
      examTypeBias[params.examType] = Math.round(((prev * count + bias) / newCount) * 100) / 100;
    }

    // Variance update
    const history = [...profile.calibrationHistory, {
      timestamp: TimeService.now().toISOString(),
      predictedScore: params.predictedScoreAtTime,
      actualScore: params.actualScore,
      bias,
      examType: params.examType || "mock"
    }];

    const meanBias = newOverallBias;
    const sqDiffSum = history.reduce((sum, item) => sum + Math.pow(item.bias - meanBias, 2), 0);
    const newVariance = Math.round((sqDiffSum / history.length) * 1000) / 1000;

    const updatedProfile: ForecastCalibrationProfile = {
      ...profile,
      overallBias: newOverallBias,
      chapterBias,
      difficultyBias,
      bloomBias,
      examTypeBias,
      predictionVariance: newVariance,
      calibrationCount: newCount,
      calibrationHistory: history.slice(-20) // Keep last 20 snapshots
    };

    this.saveCalibrationProfile(updatedProfile);
    return updatedProfile;
  },

  /**
   * Deterministically calculates adaptive component weights based on historical evidence.
   */
  calculateAdaptiveWeights(profile: ForecastCalibrationProfile) {
    let masteryWeight = 0.30;
    let retentionWeight = 0.20;
    let coverageWeight = 0.20;
    let mockWeight = 0.20;
    let bloomWeight = 0.10;

    if (profile.calibrationCount >= 2) {
      // Evidence optimization: if mock exams have low bias error, increase mock weight
      const mockBias = Math.abs(profile.examTypeBias["mock"] || profile.overallBias);
      if (mockBias < 0.3) {
        mockWeight += 0.08;
        masteryWeight -= 0.04;
        coverageWeight -= 0.04;
      } else if (mockBias > 0.8) {
        // High error in mock exams -> rely more on stable mastery & coverage
        mockWeight -= 0.06;
        masteryWeight += 0.03;
        coverageWeight += 0.03;
      }

      // If high overall variance -> increase retention weight as safety buffer
      if (profile.predictionVariance > 0.4) {
        retentionWeight += 0.05;
        bloomWeight -= 0.05;
      }
    }

    // Normalize weights to strictly sum to 1.0
    const total = masteryWeight + retentionWeight + coverageWeight + mockWeight + bloomWeight;
    return {
      masteryWeight: Math.round((masteryWeight / total) * 100) / 100,
      retentionWeight: Math.round((retentionWeight / total) * 100) / 100,
      coverageWeight: Math.round((coverageWeight / total) * 100) / 100,
      mockWeight: Math.round((mockWeight / total) * 100) / 100,
      bloomWeight: Math.round((bloomWeight / total) * 100) / 100,
      debtWeight: 0.10 // Separate penalty weight
    };
  },

  /**
   * Deterministic Exam Outcome Predictor v3.0
   */
  calculatePrediction(subjectId?: string): ExamPrediction {
    const activeSub = subjectId || dbService.getActiveSubjectId();
    const stats = dbService.getStatistics();
    const history = dbService.getHistory();
    const goal = dbService.getSubjectGoal(activeSub);
    const profile = this.getCalibrationProfile(activeSub);

    const totalSolved = stats.totalSolved || 0;
    const totalCorrect = stats.totalCorrect || 0;
    const overallAccuracy = totalSolved > 0 ? (totalCorrect / totalSolved) : 0;
    const mockAttempts = history.filter(h => h.isSubmitted && h.questions && h.questions.length >= 5);

    // -------------------------------------------------------------
    // LAYER 1: Dependency Propagation & Stable Mastery
    // -------------------------------------------------------------
    const conceptMasteries = stats.conceptMastery || {};
    const conceptKeys = Object.keys(conceptMasteries);
    const totalConcepts = Math.max(1, conceptKeys.length);

    let sumStableMastery = 0;
    let totalDependencyPenalty = 0;

    conceptKeys.forEach(key => {
      let rawVal = conceptMasteries[key] || 0;

      // Dependency propagation check
      const prereqs = PREREQUISITE_MAP[key] || [];
      let prereqDecayMultiplier = 1.0;
      if (prereqs.length > 0) {
        prereqs.forEach(prereqKey => {
          const prereqMastery = conceptMasteries[prereqKey] || 50;
          if (prereqMastery < 70) {
            // Prerequisite weakness propagates 20% decay per missing mastery
            const deficit = (70 - prereqMastery) / 70;
            prereqDecayMultiplier *= (1.0 - 0.20 * deficit);
          }
        });
      }

      if (prereqDecayMultiplier < 1.0) {
        totalDependencyPenalty += (1.0 - prereqDecayMultiplier);
      }

      const effectiveMastery = rawVal * prereqDecayMultiplier;

      // Question count consistency weight
      const conceptQs = questions.filter(q => q.concept === key || q.topicId === key || q.learningObjective === key);
      const totalAttempts = conceptQs.reduce((acc, q) => acc + (stats.incorrectQuestionHistory?.[q.id] ? stats.incorrectQuestionHistory[q.id] + 1 : 1), 0);
      
      const consistencyFactor = Math.min(1.0, Math.max(0.4, totalAttempts / 4));
      const streakRetention = Math.min(1.0, 0.75 + (stats.studyStreak || 0) * 0.05);

      const stableConceptScore = (effectiveMastery * 0.50 + overallAccuracy * 100 * 0.30) * consistencyFactor * streakRetention;
      sumStableMastery += stableConceptScore;
    });

    const averageStableMastery = conceptKeys.length > 0 
      ? Math.round(sumStableMastery / totalConcepts) 
      : Math.round(overallAccuracy * 100);

    const avgDependencyDecay = totalConcepts > 0 ? Math.round((totalDependencyPenalty / totalConcepts) * 100) / 100 : 0;

    // -------------------------------------------------------------
    // LAYER 2: Non-Linear Learning Velocity & Acceleration
    // -------------------------------------------------------------
    const streak = Math.max(1, stats.studyStreak || 1);
    const currentVelocity = Math.round((totalSolved / streak) * 10) / 10;
    
    let acceleration = 0;
    if (history.length >= 4) {
      const recent4 = history.slice(-4);
      const prev4 = history.slice(-8, -4);
      const accRecent = recent4.reduce((s, h) => s + (h.score / Math.max(1, h.questions.length)), 0) / recent4.length;
      const accPrev = prev4.length > 0 ? prev4.reduce((s, h) => s + (h.score / Math.max(1, h.questions.length)), 0) / prev4.length : accRecent;
      acceleration = Math.round((accRecent - accPrev) * 100) / 100;
    }

    // -------------------------------------------------------------
    // LAYER 3: Syllabus & Chapter Coverage
    // -------------------------------------------------------------
    const attemptedChapters = Object.keys(stats.accuracyByChapter || {}).filter(cId => {
      const acc = stats.accuracyByChapter[Number(cId)];
      return acc && acc.total > 0;
    }).length;
    const totalChapCount = Math.max(1, chapters.length);
    const chapterCoverage = Math.round((attemptedChapters / totalChapCount) * 100);

    const masteredConceptsCount = conceptKeys.filter(k => (conceptMasteries[k] || 0) >= 70).length;
    const conceptCoverage = Math.round((masteredConceptsCount / totalConcepts) * 100);

    // -------------------------------------------------------------
    // LAYER 4: Mock Exam Score Breakdown
    // -------------------------------------------------------------
    let mockExamAverage = 0;
    if (mockAttempts.length > 0) {
      const recentMocks = mockAttempts.slice(-5);
      const totalScorePct = recentMocks.reduce((sum, m) => sum + (m.score / Math.max(1, m.questions.length)), 0);
      mockExamAverage = (totalScorePct / recentMocks.length) * 10;
    } else {
      mockExamAverage = overallAccuracy * 10;
    }

    // -------------------------------------------------------------
    // LAYER 5: Study Debt Penalty
    // -------------------------------------------------------------
    const studyDebtCount = Object.keys(stats.incorrectQuestionHistory || {}).length;
    const debtPenalty = Math.min(1.0, (studyDebtCount / 12) * 0.9);

    // -------------------------------------------------------------
    // LAYER 6: Deadline Proximity & Non-Linear Pressure Curve Stage
    // -------------------------------------------------------------
    let remainingDays = 14;
    if (goal.examDate) {
      const todayIso = TimeService.today();
      const diff = TimeService.daysBetween(todayIso, goal.examDate);
      remainingDays = Math.max(1, diff);
    }

    // Deadline Pressure Curve Mapping
    let pressureCurveStage = "Giai đoạn xây nền (còn trên 60 ngày)";
    let stageLabel = "Foundation";
    if (remainingDays <= 2) {
      pressureCurveStage = "Giai đoạn ôn nhớ nhanh (còn 1-2 ngày)";
      stageLabel = "Memory Refresh";
    } else if (remainingDays <= 6) {
      pressureCurveStage = "Giai đoạn sửa lỗi sai (còn 3-6 ngày)";
      stageLabel = "Error Review";
    } else if (remainingDays <= 13) {
      pressureCurveStage = "Giai đoạn thi thử (còn 7-13 ngày)";
      stageLabel = "Mock Exam";
    } else if (remainingDays <= 29) {
      pressureCurveStage = "Giai đoạn luyện thích ứng (còn 14-29 ngày)";
      stageLabel = "Adaptive Practice";
    } else if (remainingDays <= 59) {
      pressureCurveStage = "Giai đoạn phủ kiến thức (còn 30-59 ngày)";
      stageLabel = "Coverage";
    }

    const urgencyIndex = Math.round(
      ((goal.targetScore - 5.0) * (100 - conceptCoverage) * Math.max(1, studyDebtCount)) / Math.pow(remainingDays, 1.2)
    );

    // -------------------------------------------------------------
    // LAYER 7: Evidence-Based Adaptive Weighting
    // -------------------------------------------------------------
    const weights = this.calculateAdaptiveWeights(profile);

    const coverageScore10 = (chapterCoverage * 0.5 + conceptCoverage * 0.5) / 10;
    const masteryScore10 = averageStableMastery / 10;
    const mockScore10 = mockExamAverage;
    const bloomScore10 = Math.min(10, overallAccuracy * 11);
    const retentionScore10 = Math.min(10, (streak / 7) * 2 + overallAccuracy * 8);

    let baseAccumulatedScore = (
      (masteryScore10 * weights.masteryWeight) +
      (retentionScore10 * weights.retentionWeight) +
      (coverageScore10 * weights.coverageWeight) +
      (mockScore10 * weights.mockWeight) +
      (bloomScore10 * weights.bloomWeight)
    );

    // Non-linear Acceleration Growth S-Curve
    const roomToGrow = 10.0 - baseAccumulatedScore;
    const velocityBoost = (acceleration * 0.4) * (roomToGrow / 10.0);
    
    let rawPredicted = baseAccumulatedScore + velocityBoost - debtPenalty;

    // -------------------------------------------------------------
    // LAYER 8: Self-Calibration Profile Bias Adjustment
    // -------------------------------------------------------------
    let calibrationOffset = 0;
    if (profile.calibrationCount > 0) {
      const confidenceScale = Math.min(1.0, profile.calibrationCount / 4);
      calibrationOffset = Math.round(profile.overallBias * confidenceScale * 100) / 100;
    } else if (mockAttempts.length >= 2) {
      const recentMocks = mockAttempts.slice(-3);
      const actualAvg = recentMocks.reduce((s, m) => s + (m.score / Math.max(1, m.questions.length)) * 10, 0) / recentMocks.length;
      calibrationOffset = Math.round((actualAvg - rawPredicted) * 0.3 * 100) / 100;
    }

    rawPredicted += calibrationOffset;

    if (totalSolved === 0) {
      rawPredicted = 5.0;
    }

    const boundedPredicted = Math.min(10.0, Math.max(1.0, Math.round(rawPredicted * 10) / 10));

    // -------------------------------------------------------------
    // LAYER 9: Forecast Smoothing & EMA Filter
    // -------------------------------------------------------------
    const storageKey = `poly_econ_last_prediction_${activeSub}`;
    const previousSaved = localStorage.getItem(storageKey);
    let smoothedPrediction = boundedPredicted;

    if (previousSaved && totalSolved > 0) {
      const prevVal = parseFloat(previousSaved);
      if (!isNaN(prevVal)) {
        smoothedPrediction = Math.round((0.35 * boundedPredicted + 0.65 * prevVal) * 10) / 10;
      }
    }
    localStorage.setItem(storageKey, String(smoothedPrediction));

    const finalPredictedScore = Math.min(10.0, Math.max(1.0, smoothedPrediction));

    // -------------------------------------------------------------
    // LAYER 10: Uncertainty Decomposition (7 Vectors)
    // -------------------------------------------------------------
    const gap = Math.max(0, Math.round((goal.targetScore - finalPredictedScore) * 10) / 10);

    const knowledgeUncertainty = Math.min(1.0, Math.max(0, gap / Math.max(1, goal.targetScore)));
    const retentionUncertainty = Math.min(1.0, Math.max(0, (14 - streak) / 14));
    const coverageUncertainty = Math.min(1.0, Math.max(0, (100 - chapterCoverage) / 100));
    const timeUncertainty = Math.min(1.0, remainingDays <= 3 && (finalPredictedScore / goal.targetScore) < 0.8 ? 0.85 : remainingDays <= 7 ? 0.45 : 0.15);
    const behaviorUncertainty = totalSolved < 20 ? 0.7 : totalSolved < 50 ? 0.35 : 0.1;
    const dependencyUncertainty = Math.min(1.0, avgDependencyDecay * 2);
    const bloomUncertainty = overallAccuracy < 0.65 ? 0.5 : 0.15;

    const aggregateUncertainty = (
      knowledgeUncertainty * 0.20 +
      retentionUncertainty * 0.15 +
      coverageUncertainty * 0.20 +
      timeUncertainty * 0.15 +
      behaviorUncertainty * 0.10 +
      dependencyUncertainty * 0.10 +
      bloomUncertainty * 0.10
    );

    const overallConfidencePct = Math.min(98, Math.max(45, Math.round((1.0 - aggregateUncertainty) * 100)));

    // Confidence Stability Index
    const predictionVariance = profile.predictionVariance || 0.15;
    const stabilityIndex = Math.min(100, Math.max(10, Math.round(100 - (predictionVariance * 120 + (100 - overallConfidencePct) * 0.4))));

    // Dynamic Confidence Margin based on Stability Index
    let rawMargin = 0.30;
    if (stabilityIndex >= 80 && totalSolved >= 30) {
      rawMargin = 0.15 + (100 - stabilityIndex) * 0.005; // Narrow range: e.g. ±0.15
    } else if (stabilityIndex < 50 || totalSolved < 15) {
      rawMargin = 0.55 + (50 - stabilityIndex) * 0.008; // Wide range: e.g. ±0.65
    } else {
      rawMargin = 0.30;
    }
    const confidenceMargin = Math.min(1.2, Math.max(0.1, Math.round(rawMargin * 10) / 10));

    let confidenceLevel: "Cao" | "Trung bình" | "Cần thêm dữ liệu" = "Cần thêm dữ liệu";
    if (totalSolved >= 35 && stabilityIndex >= 70 && confidenceMargin <= 0.25) {
      confidenceLevel = "Cao";
    } else if (totalSolved >= 12) {
      confidenceLevel = "Trung bình";
    }

    const readinessPercentage = Math.min(100, Math.max(0, Math.round((finalPredictedScore / goal.targetScore) * 100)));

    // -------------------------------------------------------------
    // LAYER 11: Local Sensitivity Analysis & Opportunity Cost Engine
    // -------------------------------------------------------------
    // Diminishing returns curve calculation for activities
    const wrong30Gain = studyDebtCount > 0 
      ? Math.round((0.50 * (1 - Math.exp(-0.12 * Math.min(15, studyDebtCount)))) * 100) / 100 
      : 0.10;
    const practice30Gain = Math.round((0.35 * (1 - Math.exp(-0.03 * (100 - conceptCoverage)))) * 100) / 100;
    const mock30Gain = Math.round((0.40 * (1 - Math.exp(-0.25 * Math.max(1, 10 - mockExamAverage)))) * 100) / 100;
    const review30Gain = Math.round((0.25 * (1 - Math.exp(-0.10 * (14 - streak)))) * 100) / 100;

    const sensitivityAnalysis: SensitivityItem[] = [
      {
        activityKey: "wrong_notebook",
        activityLabel: "Sửa câu sai trong Sổ tay",
        additional30MinGain: wrong30Gain,
        elasticityIndex: Math.round((wrong30Gain / 0.3) * 100) / 100,
        diminishingPhase: studyDebtCount > 15 ? "HIGH_GAIN" : studyDebtCount > 5 ? "MODERATE_GAIN" : "SATURATED",
        opportunityCostIfSkipped: Math.round(-wrong30Gain * 0.9 * 100) / 100
      },
      {
        activityKey: "adaptive_practice",
        activityLabel: "Luyện tập tự thích ứng",
        additional30MinGain: practice30Gain,
        elasticityIndex: Math.round((practice30Gain / 0.3) * 100) / 100,
        diminishingPhase: conceptCoverage < 70 ? "HIGH_GAIN" : "MODERATE_GAIN",
        opportunityCostIfSkipped: Math.round(-practice30Gain * 0.8 * 100) / 100
      },
      {
        activityKey: "mock_exam",
        activityLabel: "Thi thử & Mô phỏng Áp lực",
        additional30MinGain: mock30Gain,
        elasticityIndex: Math.round((mock30Gain / 0.3) * 100) / 100,
        diminishingPhase: mockExamAverage < 7.5 ? "HIGH_GAIN" : "MODERATE_GAIN",
        opportunityCostIfSkipped: Math.round(-mock30Gain * 0.85 * 100) / 100
      },
      {
        activityKey: "spaced_review",
        activityLabel: "Ôn tập ngắt quãng",
        additional30MinGain: review30Gain,
        elasticityIndex: Math.round((review30Gain / 0.3) * 100) / 100,
        diminishingPhase: streak < 5 ? "HIGH_GAIN" : "SATURATED",
        opportunityCostIfSkipped: Math.round(-review30Gain * 0.95 * 100) / 100
      }
    ];

    // -------------------------------------------------------------
    // LAYER 12: Action Plan & Multidimensional Risk Report
    // -------------------------------------------------------------
    const gapActionPlan = [];

    if (studyDebtCount > 0) {
      gapActionPlan.push({
        id: "gap_debt",
        title: `Xử lý ${studyDebtCount} bẫy câu sai tồn đọng (Sổ tay câu sai)`,
        type: "debt" as const,
        impact: wrong30Gain,
        timeEstimateMinutes: Math.min(45, studyDebtCount * 3),
        completed: false,
        unlockedConceptsCount: studyDebtCount
      });
    }

    if (chapterCoverage < 100) {
      const missingChap = chapters.find(c => !stats.accuracyByChapter?.[c.id]?.total);
      const chapName = missingChap ? missingChap.title : "các chương chưa làm bài";
      gapActionPlan.push({
        id: "gap_chapter",
        title: `Phủ bài tập củng cố ${chapName}`,
        type: "chapter" as const,
        impact: practice30Gain,
        timeEstimateMinutes: 30,
        completed: false,
        unlockedConceptsCount: 3
      });
    }

    gapActionPlan.push({
      id: "gap_mastery",
      title: "Nâng độ thông thạo ổn định tổng hợp lên trên 80%",
      type: "mastery" as const,
      impact: 0.3,
      timeEstimateMinutes: 40,
      completed: averageStableMastery >= 80,
      unlockedConceptsCount: 5
    });

    gapActionPlan.push({
      id: "gap_mock",
      title: `Luyện 2 đề Thi thử Tự Thích ứng (${stageLabelVN(stageLabel)})`,
      type: "mock" as const,
      impact: mock30Gain,
      timeEstimateMinutes: 50,
      completed: mockAttempts.length >= 3,
      unlockedConceptsCount: 4
    });

    const riskReasons: string[] = [];
    const mitigations: string[] = [];

    if (gap > 1.0) {
      riskReasons.push(`Khoảng cách điểm mục tiêu (-${gap} điểm) cần được bù đắp khẩn cấp.`);
      mitigations.push(`Tăng thời lượng học hàng ngày từ ${goal.dailyStudyMinutes || 45} lên ${Math.min(120, (goal.dailyStudyMinutes || 45) + 30)} phút/ngày.`);
    }
    if (studyDebtCount >= 5) {
      riskReasons.push(`Có ${studyDebtCount} bẫy câu sai trong Sổ tay chưa được triệt phá.`);
      mitigations.push("Ưu tiên dọn sạch Sổ tay câu sai trước khi làm đề thi thử mới.");
    }
    if (remainingDays <= 5 && readinessPercentage < 75) {
      riskReasons.push(`Cận kề ngày thi (${remainingDays} ngày) trong khi độ sẵn sàng đạt ${readinessPercentage}%.`);
      mitigations.push(`Tập trung giai đoạn ${stageLabelVN(stageLabel)} làm đề thi thử tự thích ứng để gia tăng phản xạ.`);
    }
    if (coverageUncertainty > 0.3) {
      riskReasons.push(`Đề cương mới phủ ${chapterCoverage}%, còn hổng ${100 - chapterCoverage}% nội dung.`);
      mitigations.push("Làm các bài trắc nghiệm củng cố của chương chưa thực hành.");
    }
    if (avgDependencyDecay > 0.1) {
      riskReasons.push(`Khái niệm nền tảng bị suy giảm kéo theo hiệu ứng lan truyền suy thoái kiến thức.`);
      mitigations.push("Ôn lại khái niệm tiên quyết để khôi phục chuỗi kiến thức liên hoàn.");
    }

    let riskLevel: "Thấp" | "Trung bình" | "Cao" = "Thấp";
    if (aggregateUncertainty >= 0.50 || riskReasons.length >= 3) {
      riskLevel = "Cao";
    } else if (aggregateUncertainty >= 0.28 || riskReasons.length >= 1) {
      riskLevel = "Trung bình";
    }

    // -------------------------------------------------------------
    // LAYER 13: Detailed Multi-Factor Explanation Engine
    // -------------------------------------------------------------
    const majorPositives = [];
    if (overallAccuracy >= 0.7) majorPositives.push(`Độ chính xác tổng quan cao (${Math.round(overallAccuracy * 100)}%)`);
    if (chapterCoverage >= 80) majorPositives.push(`Độ phủ chương rộng (${chapterCoverage}%)`);
    if (mockAttempts.length >= 2) majorPositives.push(`Đã thi thử ${mockAttempts.length} đề`);
    if (profile.calibrationCount > 0) majorPositives.push(`Hệ thống tự hiệu chỉnh từ ${profile.calibrationCount} lần thi thực tế (Bias ${profile.overallBias > 0 ? '+' : ''}${profile.overallBias})`);

    const majorNegatives = [];
    if (studyDebtCount > 0) majorNegatives.push(`${studyDebtCount} câu sai tồn đọng trong Sổ tay`);
    if (chapterCoverage < 70) majorNegatives.push(`Chưa phủ ${100 - chapterCoverage}% syllabus môn học`);
    if (avgDependencyDecay > 0.05) majorNegatives.push(`Suy thoái kiến thức lan truyền từ khái niệm tiên quyết`);
    if (gap > 1.0) majorNegatives.push(`Còn cách điểm mục tiêu -${gap} điểm`);

    // Run internal Stress Test Report
    const stressTestReport = this.runForecastStressTest(activeSub, finalPredictedScore);

    return {
      subjectId: activeSub,
      predictedScore: finalPredictedScore,
      confidenceMargin,
      confidenceLevel,
      targetScore: goal.targetScore,
      gap,
      readinessPercentage,
      metricsBreakdown: {
        masteryScore: averageStableMastery,
        chapterCoverage,
        conceptCoverage,
        bloomDistributionScore: Math.min(100, Math.round(overallAccuracy * 110)),
        learningVelocity: currentVelocity,
        retentionRate: Math.min(95, Math.max(50, Math.round(overallAccuracy * 100 + 10))),
        wrongQuestionRate: Math.round((1 - overallAccuracy) * 100),
        mockExamAverage: Math.round(mockExamAverage * 10) / 10,
        studyDebtCount,
        remainingDays,
        stableMastery: averageStableMastery,
        learningAcceleration: acceleration,
        urgencyIndex,
        stageLabel
      },
      gapActionPlan,
      riskReport: {
        level: riskLevel,
        reasons: riskReasons.length > 0 ? riskReasons : ["Chưa phát hiện rủi ro lớn, tiến độ học tập ổn định."],
        mitigations: mitigations.length > 0 ? mitigations : ["Duy trì nhịp học hiện tại để giữ vững kết quả."],
        multidimensionalRisk: {
          knowledgeRisk: Math.round(knowledgeUncertainty * 100) / 100,
          retentionRisk: Math.round(retentionUncertainty * 100) / 100,
          timeRisk: Math.round(timeUncertainty * 100) / 100,
          coverageRisk: Math.round(coverageUncertainty * 100) / 100,
          bloomRisk: Math.round(bloomUncertainty * 100) / 100,
          consistencyRisk: Math.round(behaviorUncertainty * 100) / 100,
          fatigueRisk: Math.round(dependencyUncertainty * 100) / 100
        }
      },
      explainability: {
        decision: `Dự báo kết quả ${finalPredictedScore.toFixed(1)} ± ${confidenceMargin.toFixed(1)} (Mục tiêu: ${goal.targetScore.toFixed(1)})`,
        reason: `Mô hình tự hiệu chỉnh: trọng số thích ứng [Thông thạo ${(weights.masteryWeight * 100).toFixed(0)}%, Thi thử ${(weights.mockWeight * 100).toFixed(0)}%, Độ phủ ${(weights.coverageWeight * 100).toFixed(0)}%]. Hiệu chỉnh sai lệch: ${calibrationOffset > 0 ? '+' : ''}${calibrationOffset.toFixed(2)}. ${pressureCurveStage}.`,
        evidence: `Dữ liệu: ${totalSolved} câu đã giải, ${history.length} phiên thi, ${profile.calibrationCount} lần tự hiệu chỉnh, chỉ số ổn định ${stabilityIndex}/100.`,
        policy: "Thuật toán tất định v3.0 • Tự hiệu chỉnh • Tự tối ưu trọng số • Lan truyền phụ thuộc • Hiệu suất giảm dần phi tuyến.",
        timestamp: TimeService.now().toISOString(),
        majorPositives,
        majorNegatives,
        uncertaintySource: coverageUncertainty > 0.3 ? "Độ phủ chương chưa hoàn tất 100%" : studyDebtCount > 5 ? "Tồn đọng câu sai trong Sổ tay" : "Cần tích lũy thêm dữ liệu thi thực tế",
        nextAction: gapActionPlan[0]?.title || "Tiếp tục làm bài tập tự thích ứng"
      },
      calibration: {
        rawPrediction: boundedPredicted,
        calibrationOffset,
        smoothedPrediction: finalPredictedScore,
        historicalErrorAvg: Math.abs(calibrationOffset)
      },
      calibrationProfile: profile,
      sensitivityAnalysis,
      uncertaintyDecomposition: {
        knowledgeUncertainty: Math.round(knowledgeUncertainty * 100) / 100,
        retentionUncertainty: Math.round(retentionUncertainty * 100) / 100,
        coverageUncertainty: Math.round(coverageUncertainty * 100) / 100,
        timeUncertainty: Math.round(timeUncertainty * 100) / 100,
        behaviorUncertainty: Math.round(behaviorUncertainty * 100) / 100,
        dependencyUncertainty: Math.round(dependencyUncertainty * 100) / 100,
        bloomUncertainty: Math.round(bloomUncertainty * 100) / 100,
        overallConfidencePct,
        stabilityIndex
      },
      stressTestReport,
      pressureCurveStage,
      adaptiveWeights: weights
    };
  },

  /**
   * Internal Forecast Stress Test Simulator (Runs 5 key scenarios deterministically)
   */
  runForecastStressTest(subjectId?: string, baselinePredictedScore?: number): StressTestReport {
    const baseline = baselinePredictedScore || 7.5;
    const stats = dbService.getStatistics();
    const debtCount = Object.keys(stats.incorrectQuestionHistory || {}).length;

    // Scenario 1: Rest for 2 days (Decay penalty)
    const rest2DaysScore = Math.max(1.0, Math.round((baseline - 0.25) * 10) / 10);
    
    // Scenario 2: Increase daily study by +60 mins
    const add60MinsScore = Math.min(10.0, Math.round((baseline + 0.45) * 10) / 10);

    // Scenario 3: Resolve 100% of Wrong Notebook debt
    const resolveDebtScore = Math.min(10.0, Math.round((baseline + Math.min(0.8, debtCount * 0.08)) * 10) / 10);

    // Scenario 4: Complete 2 Full Mock Exams
    const completeMocksScore = Math.min(10.0, Math.round((baseline + 0.35) * 10) / 10);

    // Scenario 5: Master hardest chapter
    const masterHardestScore = Math.min(10.0, Math.round((baseline + 0.50) * 10) / 10);

    const scenarios = [
      {
        id: "stress_rest",
        scenarioName: "Nghỉ học 2 ngày liên tiếp",
        projectedScore: rest2DaysScore,
        deltaFromBaseline: -0.25,
        description: "Chỉ số phai mờ trí nhớ giảm làm sụt điểm dự báo."
      },
      {
        id: "stress_add_60m",
        scenarioName: "Tăng 60 phút học mỗi ngày",
        projectedScore: add60MinsScore,
        deltaFromBaseline: +0.45,
        description: "Gia tăng tốc độ hoàn thành và độ phủ chương syllabus."
      },
      {
        id: "stress_resolve_debt",
        scenarioName: "Giải quyết 100% câu sai Sổ tay",
        projectedScore: resolveDebtScore,
        deltaFromBaseline: Math.round(Math.min(0.8, debtCount * 0.08) * 10) / 10,
        description: "Xóa bỏ các bẫy nhận thức trọng yếu."
      },
      {
        id: "stress_mock_exams",
        scenarioName: "Hoàn thành 2 đề thi thử mô phỏng",
        projectedScore: completeMocksScore,
        deltaFromBaseline: +0.35,
        description: "Rèn luyện phản xạ thời gian thực."
      },
      {
        id: "stress_master_hardest",
        scenarioName: "Làm chủ 100% chương khó nhất",
        projectedScore: masterHardestScore,
        deltaFromBaseline: +0.50,
        description: "Lấp lỗ hổng kiến thức trọng tâm."
      }
    ];

    return {
      mostSensitiveVariable: debtCount > 5 ? "Tồn đọng bẫy câu sai trong Sổ tay" : "Độ phủ chương syllabus",
      mostEfficientAction: debtCount > 3 ? "Giải quyết toàn bộ câu sai trong Sổ tay" : "Tăng thời lượng học +60 phút/ngày",
      leastEfficientAction: "Tập trung giải bài tập mức độ Dễ lặp đi lặp lại",
      criticalBottleneck: debtCount > 8 ? "Bẫy nhận thức chưa giải quyết" : "Số lượng đề thi thử đã làm chưa đủ",
      scenarios
    };
  },

  /**
   * Deadline Pressure Curve Adaptive Daily Study Budget Planner
   */
  getDailyBudgetPlan(budgetMinutes: number) {
    const stats = dbService.getStatistics();
    const debtCount = Object.keys(stats.incorrectQuestionHistory || {}).length;
    const prediction = this.calculatePrediction();
    const stage = prediction.metricsBreakdown.stageLabel || "Foundation";

    let reviewRatio = 0.25;
    let practiceRatio = 0.50;
    let mockRatio = 0.25;

    // Deadline Pressure Curve allocation rules
    if (stage === "Memory Refresh") { // 1-2 days
      reviewRatio = 0.60;
      practiceRatio = 0.25;
      mockRatio = 0.15;
    } else if (stage === "Error Review") { // 3-6 days
      reviewRatio = debtCount > 0 ? 0.55 : 0.40;
      practiceRatio = 0.25;
      mockRatio = 0.20;
    } else if (stage === "Mock Exam") { // 7-13 days
      reviewRatio = 0.20;
      practiceRatio = 0.30;
      mockRatio = 0.50;
    } else if (stage === "Adaptive Practice") { // 14-29 days
      reviewRatio = 0.25;
      practiceRatio = 0.50;
      mockRatio = 0.25;
    } else { // Foundation / Coverage (30d+)
      reviewRatio = debtCount > 0 ? 0.30 : 0.15;
      practiceRatio = 0.60;
      mockRatio = 0.25 - (reviewRatio - 0.15);
    }

    const reviewMinutes = Math.max(5, Math.round(budgetMinutes * reviewRatio));
    const practiceMinutes = Math.max(10, Math.round(budgetMinutes * practiceRatio));
    const mockMinutes = Math.max(5, budgetMinutes - reviewMinutes - practiceMinutes);

    return {
      totalMinutes: budgetMinutes,
      stage,
      pressureCurveStage: prediction.pressureCurveStage,
      allocation: [
        { key: "review", label: `Ôn tập Sổ tay & ôn lại ngắt quãng (${stageLabelVN(stage)})`, minutes: reviewMinutes, ratio: Math.round((reviewMinutes / budgetMinutes) * 100) },
        { key: "adaptive", label: "Luyện tập tự thích ứng", minutes: practiceMinutes, ratio: Math.round((practiceMinutes / budgetMinutes) * 100) },
        { key: "mock", label: `Thi thử & mô phỏng giai đoạn ${stageLabelVN(stage)}`, minutes: mockMinutes, ratio: Math.round((mockMinutes / budgetMinutes) * 100) }
      ]
    };
  },

  /**
   * Marginal ROI Calculator with Diminishing Returns Model v2
   */
  getStudyActivitiesROI(): StudyActivityROI[] {
    const stats = dbService.getStatistics();
    const debtCount = Object.keys(stats.incorrectQuestionHistory || {}).length;
    const prediction = this.calculatePrediction();
    const stage = prediction.metricsBreakdown.stageLabel || "Foundation";

    // Exponential diminishing return formula
    const wrongGain = debtCount > 0 
      ? Math.round((0.50 * (1 - Math.exp(-0.12 * Math.min(15, debtCount)))) * 100) / 100 
      : 0.10;
    const wrongRoi = Math.round((wrongGain / 25 * 10) * 100) / 100;

    const adaptiveGain = Math.round((0.35 + (100 - prediction.metricsBreakdown.conceptCoverage) * 0.002) * 100) / 100;
    const adaptiveRoi = Math.round((adaptiveGain / 30 * 10) * 100) / 100;

    const mockGain = stage === "Mock Exam" || stage === "Error Review" ? 0.42 : 0.28;
    const mockRoi = Math.round((mockGain / 50 * 10) * 100) / 100;

    const activities: StudyActivityROI[] = [
      {
        id: "roi_wrong_notebook",
        title: "Sửa câu sai trong Sổ tay (Diminishing Return v2)",
        type: "wrong_notebook",
        durationMinutes: 25,
        forecastPointGain: wrongGain,
        roiValue: wrongRoi,
        priority: debtCount > 5 ? "Rất cao" : "Cao",
        reason: debtCount > 0 ? `Xử lý ${debtCount} điểm yếu. ROI biên tự động giảm dần khi bẫy câu sai được triệt phá.` : "Duy trì xem lại các câu đã ghi nhớ."
      },
      {
        id: "roi_adaptive_practice",
        title: "Luyện tập tự thích ứng",
        type: "adaptive_practice",
        durationMinutes: 30,
        forecastPointGain: adaptiveGain,
        roiValue: adaptiveRoi,
        priority: "Cao",
        reason: "Tự động bù đắp các vùng kiến thức chớm quên theo đường cong lãng quên Ebbinghaus."
      },
      {
        id: "roi_mock_exam",
        title: `Làm bài Thi thử mô phỏng (giai đoạn ${stageLabelVN(stage)})`,
        type: "mock_exam",
        durationMinutes: 50,
        forecastPointGain: mockGain,
        roiValue: mockRoi,
        priority: stage === "Mock Exam" || stage === "Error Review" ? "Rất cao" : "Trung bình",
        reason: "Rèn luyện áp lực thời gian và tổng hợp ma trận đề thi trước ngày thi chính thức."
      }
    ];

    return activities.sort((a, b) => b.roiValue - a.roiValue);
  },

  /**
   * Non-Linear Deadline Outcome Simulator
   */
  simulateDeadlineOutcome(dailyMinutes: number, daysRemaining: number): number {
    const prediction = this.calculatePrediction();
    const currentPredicted = prediction.predictedScore;
    
    const minutesDelta = dailyMinutes - 45;
    const daysDelta = daysRemaining - 14;

    const minutesImpact = (minutesDelta / 30) * 0.35 * Math.exp(-minutesDelta / 300);
    const daysImpact = (daysDelta / 7) * 0.25;

    const simulated = currentPredicted + minutesImpact + daysImpact;
    return Math.min(10.0, Math.max(1.0, Math.round(simulated * 10) / 10));
  },

  /**
   * What-if Sensitivity Analysis Scenarios
   */
  getWhatIfScenarios() {
    const prediction = this.calculatePrediction();
    const current = prediction.predictedScore;
    const sensitivity = prediction.sensitivityAnalysis || [];

    const wrongItem = sensitivity.find(s => s.activityKey === "wrong_notebook");
    const practiceItem = sensitivity.find(s => s.activityKey === "adaptive_practice");

    return [
      {
        title: "Nếu học thêm 30 phút Sổ tay câu sai",
        impactText: `+${wrongItem ? wrongItem.additional30MinGain : 0.4} điểm`,
        projectedScore: Math.min(10, Math.round((current + (wrongItem ? wrongItem.additional30MinGain : 0.4)) * 10) / 10),
        type: "positive"
      },
      {
        title: "Nếu học thêm 30 phút Luyện tập Tự thích ứng",
        impactText: `+${practiceItem ? practiceItem.additional30MinGain : 0.3} điểm`,
        projectedScore: Math.min(10, Math.round((current + (practiceItem ? practiceItem.additional30MinGain : 0.3)) * 10) / 10),
        type: "positive"
      },
      {
        title: "Nếu bỏ qua không ôn tập chương phức tạp nhất",
        impactText: "-0.8 điểm",
        projectedScore: Math.max(1, Math.round((current - 0.8) * 10) / 10),
        type: "negative"
      }
    ];
  },

  /**
   * Prioritized Study Debt Items with Dependency Weighting
   */
  getStudyDebtItems(): StudyDebtItem[] {
    const stats = dbService.getStatistics();
    const wrongHist = stats.incorrectQuestionHistory || {};

    const items: StudyDebtItem[] = [];
    Object.entries(wrongHist).forEach(([qIdStr, wrongCount]) => {
      const qId = Number(qIdStr);
      const q = questions.find(item => item.id === qId);
      if (q) {
        const relatedCount = questions.filter(other => other.topicId === q.topicId || other.concept === q.concept).length;
        const priorityScore = (wrongCount as number) * 1.5 + relatedCount * 0.2;

        items.push({
          id: `debt_q_${qId}`,
          questionId: qId,
          conceptName: q.concept || q.learningObjective || `Câu hỏi #${qId}`,
          chapterId: q.chapterId,
          topicId: q.topicId,
          debtType: "wrong_attempt",
          priority: priorityScore >= 3 ? "Cao" : "Trung bình",
          wrongCount: wrongCount as number,
          status: "pending"
        });
      }
    });

    chapters.forEach(c => {
      const acc = stats.accuracyByChapter?.[c.id];
      if (!acc || acc.total === 0) {
        items.push({
          id: `debt_chap_${c.id}`,
          conceptName: `Chưa bao phủ bài tập ${c.title}`,
          chapterId: c.id,
          topicId: `T${c.id}.1`,
          debtType: "unlearned_chapter",
          priority: "Cao",
          wrongCount: 0,
          status: "pending"
        });
      }
    });

    return items;
  }
};
