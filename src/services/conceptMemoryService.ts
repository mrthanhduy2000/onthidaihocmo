/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService } from "./db";
import { TimeService } from "./time";

export interface ConceptMemoryProfile {
  conceptId: string;
  conceptName: string;
  currentMastery: number; // 0 - 100
  historicalPeak: number; // 0 - 100
  historicalLowest: number; // 0 - 100
  timesStudied: number;
  timesCorrect: number;
  timesWrong: number;
  averageResponseTime: number; // in seconds
  averageConfidence: number; // 0.0 - 1.0
  confidenceTrend: "rising" | "stable" | "falling";
  retentionScore: number; // 0.0 - 1.0 (decayed memory accessibility)
  difficultyScore: number; // 1.0 - 10.0
  misconceptionHistory: Array<{
    misconception: string;
    timestamp: string;
    resolved: boolean;
    questionId?: number;
  }>;
  preferredTeachingStyle: "Academic" | "Business" | "Analogy" | "Socratic" | "Simple" | "Real-world";
  preferredExplanationLength: "short" | "medium" | "deep";
  lastReviewAt?: string; // ISO string
  nextReviewAt?: string; // ISO string
  estimatedForgetCurve: Array<{ daysAhead: number; retention: number }>;
  learningVelocity: number; // points change per session
  recoveryCount: number; // number of times recovered from low mastery / regression
  regressionCount: number; // number of times mastery or retention dropped significantly
  isStableMastered: boolean; // mastery >= 85, >= 3 spaced sessions, 0 active misconceptions
  isRegressionDetected: boolean;
  explanationsHistory: Array<{
    timestamp: string;
    strategy: string;
    length: string;
    wasSuccessful: boolean;
  }>;

  // PHASE NEXT — LEARNING DYNAMICS ENGINE FIELDS
  shortTermMomentum?: number; // slope of last 3 attempts
  mediumTermMomentum?: number; // slope of last 7 attempts
  longTermMomentum?: number; // slope of last 15 attempts
  momentumTrend?: "accelerating" | "improving" | "plateau" | "regression";
  rollingVariance?: number; // variance across recent practice scores
  stabilityScore?: number; // 0.0 to 1.0 (consistency)
  averageRepairAttempts?: number; // avg repair attempts to resolve a misconception
  repairLatencySeconds?: number; // avg time to repair misconception
  relapseFrequency?: number; // count of relapses after resolution
  permanentRecoveryRate?: number; // 0.0 to 1.0
  evidenceStrength?: number; // 0.0 to 1.0 based on count, variety, time, bloom
  fragilityScore?: number; // 0.0 to 1.0 (robustness indicator)
  bloomPerformance?: Record<string, { attempts: number; correct: number; accuracy: number }>;
  transferQualityScore?: number; // 0.0 to 1.0 (cross-Bloom transfer)
  maturityStage?: "New" | "Emerging" | "Developing" | "Stable" | "Mature" | "Automatic";
  learningGainPerMinute?: number;
  learningGainPerQuestion?: number;
  learningGainPerSession?: number;
  efficiencyScore?: number; // 0.0 to 10.0
  persistentErrorPenalty?: number; // multiplier >= 1.0
  calibrationState?: "overconfident" | "underconfident" | "calibrated";
  calibrationScore?: number; // 0.0 to 1.0
  scoreHistory?: Array<{
    timestamp: string;
    score: number;
    bloomLevel?: string;
    timeSpent?: number;
    confidence?: number;
    questionId?: number;
  }>;
}

export interface ConceptMemoryUpdate {
  wasCorrect: boolean;
  responseTimeSeconds: number;
  confidence: number; // 0.0 to 1.0
  detectedMisconception?: string;
  teachingStrategy: string;
  explanationLength: string;
  questionId?: number;
}

const STORAGE_PREFIX = "poly_econ_concept_memory_";

/**
 * Độ bền trí nhớ của một khái niệm, tính bằng ngày. Đây là NGUỒN DUY NHẤT của công thức này.
 *
 * Trước đây công thức bị chép làm hai bản giống hệt nhau ở calculateRetentionScore và
 * generateForgetCurve. Hai bản chép tay như vậy chắc chắn sẽ lệch nhau khi ai đó chỉ sửa một
 * chỗ, và khi đó đường cong quên vẽ ra màn hình sẽ mâu thuẫn với điểm trí nhớ dùng để xếp
 * lịch ôn. Nay cả hai đều gọi hàm này.
 *
 *     S = S_nen * heSoPhucHoi * phatTuiLui * heSoDoKho * thuongOnDinh
 *     S_nen = max(1, 1,8*log2(soLanHoc + 1) + dinhCaoLichSu/25)
 */
function memoryStrengthDays(profile: ConceptMemoryProfile): number {
  const logStudied = Math.log2(Math.max(1, profile.timesStudied) + 1);
  const baseStrength = Math.max(1.0, (logStudied * 1.8) + (profile.historicalPeak / 25));
  const recoveryFactor = 1.0 + 0.35 * Math.min(5, profile.recoveryCount || 0);
  const regressionPenalty = 1.0 / (1.0 + 0.40 * Math.min(5, profile.regressionCount || 0));
  const difficultyFactor = Math.max(0.6, 8.0 / Math.max(4.0, profile.difficultyScore || 5.0));
  const stableBonus = profile.isStableMastered ? 2.2 : 1.0;
  return baseStrength * recoveryFactor * regressionPenalty * difficultyFactor * stableBonus;
}

/**
 * Độ dốc hồi quy tuyến tính bình phương tối thiểu của một dãy điểm, đơn vị: điểm mỗi lần làm.
 *
 * Vì sao cần: bản cũ đo đà học bằng hiệu hai đầu mút (điểm cuối trừ điểm đầu) và bỏ qua mọi
 * điểm ở giữa. Dãy 50, 90, 52 và dãy 50, 51, 52 đều cho ra cùng một con số là 2, dù dãy đầu
 * đang dao động dữ dội còn dãy sau tiến đều. Chỉ cần một lần trả lời may rủi ở đúng đầu hoặc
 * cuối cửa sổ là kết luận "đang tiến bộ" hay "đang tụt" bị lật ngược. Hồi quy dùng toàn bộ
 * số liệu nên bền với nhiễu hơn hẳn, và vẫn hoàn toàn tất định.
 */
function leastSquaresSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (values[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

export const conceptMemoryService = {
  /**
   * Retrieves all Concept Memory Profiles for a given subject.
   */
  getAllConceptProfiles(subjectId?: string): Record<string, ConceptMemoryProfile> {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${STORAGE_PREFIX}${sId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      console.error("[conceptMemoryService] Error loading concept profiles:", e);
      return {};
    }
  },

  /**
   * Saves all Concept Memory Profiles for a given subject.
   */
  saveAllConceptProfiles(profiles: Record<string, ConceptMemoryProfile>, subjectId?: string): void {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${STORAGE_PREFIX}${sId}`;
    try {
      localStorage.setItem(key, JSON.stringify(profiles));
    } catch (e) {
      console.error("[conceptMemoryService] Error saving concept profiles:", e);
    }
  },

  /**
   * Retrieves or initializes a single ConceptMemoryProfile for a concept.
   */
  getConceptProfile(conceptName: string, subjectId?: string): ConceptMemoryProfile {
    const profiles = this.getAllConceptProfiles(subjectId);
    if (profiles[conceptName]) {
      return this.recomputeConceptDynamics(profiles[conceptName]);
    }

    // Default initialization
    const newProfile: ConceptMemoryProfile = {
      conceptId: `concept_${conceptName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      conceptName,
      currentMastery: 50,
      historicalPeak: 50,
      historicalLowest: 50,
      timesStudied: 0,
      timesCorrect: 0,
      timesWrong: 0,
      averageResponseTime: 15,
      averageConfidence: 0.5,
      confidenceTrend: "stable",
      retentionScore: 1.0,
      difficultyScore: 5.0,
      misconceptionHistory: [],
      preferredTeachingStyle: "Academic",
      preferredExplanationLength: "medium",
      estimatedForgetCurve: [
        { daysAhead: 0, retention: 1.0 },
        { daysAhead: 1, retention: 0.85 },
        { daysAhead: 3, retention: 0.70 },
        { daysAhead: 7, retention: 0.55 },
        { daysAhead: 14, retention: 0.40 },
        { daysAhead: 30, retention: 0.25 }
      ],
      learningVelocity: 0,
      recoveryCount: 0,
      regressionCount: 0,
      isStableMastered: false,
      isRegressionDetected: false,
      explanationsHistory: [],
      scoreHistory: []
    };

    return this.recomputeConceptDynamics(newProfile);
  },

  /**
   * PHASE NEXT — LEARNING DYNAMICS ENGINE v4.0
   * Recomputes all 10 temporal behavior intelligence dynamics for a concept profile:
   * 1. Learning Momentum (short, medium, long term slopes & trend)
   * 2. Learning Stability (rolling variance & consistency score)
   * 3. Recovery Efficiency (repair attempts, latency, relapse rate, recovery)
   * 4. Knowledge Fragility (evidence strength vs raw mastery)
   * 5. Knowledge Transfer Quality (cross-Bloom cognitive transfer)
   * 6. Concept Maturity Lifecycle (New -> Emerging -> Developing -> Stable -> Mature -> Automatic)
   * 7. Learning Efficiency (gain per min/q/session)
   * 8. Persistent Error Dynamics (structural misconception penalty)
   * 9. Confidence Calibration (overconfidence / underconfidence / calibrated)
   * 10. Dynamic Student Evolution parameters
   */
  recomputeConceptDynamics(profile: ConceptMemoryProfile): ConceptMemoryProfile {
    const history = profile.scoreHistory || [];
    const N = profile.timesStudied || 0;

    // 1. Đà học, đo bằng độ dốc hồi quy trên toàn cửa sổ (điểm mỗi lần làm).
    //    Cả ba mốc ngắn/vừa/dài nay cùng một đơn vị nên so sánh được với nhau, khác bản cũ
    //    trong đó đà ngắn hạn là HIỆU hai đầu mút còn đà trung hạn lại là hiệu CHIA cho số
    //    bước; so hai đại lượng khác đơn vị với nhau (dòng "shortTerm > mediumTerm + 1,5")
    //    là phép so sai bản chất, khiến nhãn "đang tăng tốc" bật lên gần như tùy tiện.
    const shortTermMomentum = Number(leastSquaresSlope(history.slice(-3).map(h => h.score)).toFixed(2));
    const mediumTermMomentum = Number(leastSquaresSlope(history.slice(-7).map(h => h.score)).toFixed(2));
    const longTermMomentum = Number(leastSquaresSlope(history.slice(-15).map(h => h.score)).toFixed(2));

    // Ngưỡng phân loại xu hướng lấy theo ĐỘ NHIỄU của chính người học, không phải hằng số cứng.
    // Bản cũ chốt cứng 1,0 và -2,0 điểm. Với người có kết quả dao động mạnh thì hai mốc đó
    // bị vượt liên tục nên hệ thống lúc nào cũng hô "tiến bộ" rồi "tụt lùi"; với người rất
    // ổn định thì không bao giờ chạm tới nên lúc nào cũng báo "đi ngang". Nay ngưỡng tỉ lệ
    // với độ lệch chuẩn gần đây, tức là "đáng kể" được hiểu theo thước đo của từng người.
    const recentScores = history.slice(-10).map(h => h.score);
    let sd = 0;
    if (recentScores.length >= 2) {
      const m = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      sd = Math.sqrt(recentScores.reduce((a, b) => a + (b - m) * (b - m), 0) / (recentScores.length - 1));
    }
    const noiseBand = Math.max(0.8, 0.35 * sd); // sàn 0,8 để dữ liệu quá ít không tạo nhãn ảo

    let momentumTrend: ConceptMemoryProfile["momentumTrend"] = "plateau";
    if (shortTermMomentum < -noiseBand) {
      momentumTrend = "regression";
    } else if (shortTermMomentum > noiseBand && shortTermMomentum > mediumTermMomentum + noiseBand) {
      momentumTrend = "accelerating";
    } else if (shortTermMomentum > noiseBand) {
      momentumTrend = "improving";
    } else {
      momentumTrend = "plateau";
    }

    // 2. Learning Stability (Rolling Variance)
    const scores = history.slice(-10).map(h => h.score);
    let variance = 0;
    if (scores.length >= 2) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (scores.length - 1);
    }
    const rollingVariance = Number(variance.toFixed(2));
    const stabilityScore = Number((100 / (100 + rollingVariance)).toFixed(2));

    // 3. Recovery Efficiency
    const misconceptions = profile.misconceptionHistory || [];
    const resolvedCount = misconceptions.filter(m => m.resolved).length;
    const totalMisconceptions = misconceptions.length;
    const averageRepairAttempts = Number((totalMisconceptions > 0 ? totalMisconceptions / Math.max(1, resolvedCount) : 1.0).toFixed(2));
    const relapseFrequency = profile.regressionCount || 0;
    const permanentRecoveryRate = totalMisconceptions > 0 ? Number((resolvedCount / totalMisconceptions).toFixed(2)) : 1.0;
    const repairLatencySeconds = Number((profile.averageResponseTime * averageRepairAttempts).toFixed(1));

    // 4. Knowledge Fragility (Evidence Strength)
    const obsWeight = 1.0 - Math.exp(-N / 6.0);
    const uniqueQuestions = new Set(history.map(h => h.questionId).filter(Boolean)).size;
    const questionVariety = Math.min(1.0, uniqueQuestions / Math.max(1, Math.min(10, N)));
    const bloomPerf = profile.bloomPerformance || {};
    const bloomDiversity = Math.min(1.0, Object.keys(bloomPerf).length / 5.0);
    const evidenceStrength = Number((0.4 * obsWeight + 0.3 * questionVariety + 0.3 * bloomDiversity).toFixed(2));
    const fragilityScore = Number(Math.max(0, 1.0 - (evidenceStrength * (profile.currentMastery / 100))).toFixed(2));

    // 5. Chất lượng chuyển giao kiến thức giữa các nấc Bloom.
    //
    // LỖI CỦA BẢN CŨ: công thức là min(1, higherAcc / max(1, lowerAcc)). Nhưng lowerAcc là tỷ
    // lệ đúng nên luôn nằm trong [0, 1], khiến max(1, lowerAcc) LUÔN BẰNG 1. Phép chia bị vô
    // hiệu, và chỉ số "chuyển giao" thực chất chỉ còn là độ chính xác ở nấc cao, không hề so
    // với nấc thấp như tên gọi và như ý đồ thiết kế. Người học đúng 90% ở nấc nhớ mà chỉ 60%
    // ở nấc vận dụng (chuyển giao KÉM) lại được chấm 0,60, ngang với người đúng 60% ở cả hai
    // nấc (chuyển giao TỐT). Hai tình huống sư phạm trái ngược nhau bị gộp thành một điểm số.
    //
    // BẢN MỚI: gộp theo tổng số lượt thay vì trung bình cộng các tỷ lệ, để một nấc chỉ làm 1
    // câu không nặng ngang nấc đã làm 20 câu. Sau đó lấy tỷ số có làm trơn Laplace và quy về
    // [0, 1] quanh mốc 1,0 (giữ nguyên phong độ khi lên nấc cao = 0,5 điểm chuyển giao).
    const sumBloom = (keys: string[]) => keys.reduce(
      (acc, k) => ({
        attempts: acc.attempts + (bloomPerf[k]?.attempts || 0),
        correct: acc.correct + (bloomPerf[k]?.correct || 0)
      }),
      { attempts: 0, correct: 0 }
    );
    const low = sumBloom(["Remember", "Understand"]);
    const high = sumBloom(["Apply", "Analyze", "Evaluate", "Create"]);

    let transferQualityScore: number;
    if (low.attempts > 0 && high.attempts > 0) {
      // Làm trơn Laplace: cộng 1 thành công và 2 lượt vào mỗi bên, tránh chia cho 0 và tránh
      // kết luận cực đoan khi mới chỉ có một vài quan sát.
      const lowAcc = (low.correct + 1) / (low.attempts + 2);
      const highAcc = (high.correct + 1) / (high.attempts + 2);
      const ratio = highAcc / lowAcc; // > 1: lên nấc cao vẫn vững; < 1: tụt khi phải vận dụng
      transferQualityScore = Number(Math.max(0, Math.min(1, ratio / 2)).toFixed(2));
    } else {
      // Chưa đủ bằng chứng ở cả hai phía thì giữ mốc trung tính, không suy đoán.
      transferQualityScore = N >= 3 ? 0.5 : 0.5;
    }

    // 6. Concept Maturity Lifecycle
    let maturityStage: ConceptMemoryProfile["maturityStage"] = "New";
    if (N <= 1) {
      maturityStage = "New";
    } else if (N <= 3 || profile.currentMastery < 60) {
      maturityStage = "Emerging";
    } else if (profile.currentMastery < 75 || stabilityScore < 0.60) {
      maturityStage = "Developing";
    } else if (profile.currentMastery >= 90 && (profile.retentionScore || 1) >= 0.90 && fragilityScore <= 0.20 && transferQualityScore >= 0.80 && profile.averageResponseTime <= 12 && N >= 10) {
      maturityStage = "Automatic";
    } else if (profile.currentMastery >= 85 && (profile.retentionScore || 1) >= 0.80 && fragilityScore <= 0.35 && transferQualityScore >= 0.60 && N >= 6) {
      maturityStage = "Mature";
    } else {
      maturityStage = "Stable";
    }

    // 7. Learning Efficiency
    const totalGain = Math.max(0, profile.currentMastery - profile.historicalLowest);
    const learningGainPerQuestion = Number((totalGain / Math.max(1, N)).toFixed(2));
    const learningGainPerMinute = Number((totalGain / Math.max(1, (N * profile.averageResponseTime) / 60)).toFixed(2));
    const learningGainPerSession = Number((totalGain / Math.max(1, profile.recoveryCount + 1)).toFixed(2));
    const efficiencyScore = Number(Math.min(10, Math.max(0.5, learningGainPerQuestion * 0.6 + learningGainPerMinute * 0.4)).toFixed(2));

    // 8. Persistent Error Dynamics
    const unresolvedCount = misconceptions.filter(m => !m.resolved).length;
    const persistentErrorPenalty = Number((1.0 + 0.4 * unresolvedCount + 0.5 * relapseFrequency).toFixed(2));

    // 9. Confidence Calibration
    const objectiveAccuracy = N > 0 ? profile.timesCorrect / N : 0.5;
    const diff = profile.averageConfidence - objectiveAccuracy;
    let calibrationState: ConceptMemoryProfile["calibrationState"] = "calibrated";
    if (diff > 0.20) calibrationState = "overconfident";
    else if (diff < -0.20) calibrationState = "underconfident";
    else calibrationState = "calibrated";
    const calibrationScore = Number((1.0 - Math.min(1.0, Math.abs(diff))).toFixed(2));

    return {
      ...profile,
      shortTermMomentum,
      mediumTermMomentum,
      longTermMomentum,
      momentumTrend,
      rollingVariance,
      stabilityScore,
      averageRepairAttempts,
      repairLatencySeconds,
      relapseFrequency,
      permanentRecoveryRate,
      evidenceStrength,
      fragilityScore,
      bloomPerformance: bloomPerf,
      transferQualityScore,
      maturityStage,
      learningGainPerMinute,
      learningGainPerQuestion,
      learningGainPerSession,
      efficiencyScore,
      persistentErrorPenalty,
      calibrationState,
      calibrationScore,
      scoreHistory: history
    };
  },

  /**
   * Calculates forgetting curve & retention score based on time elapsed since last review.
   * Context-Aware Memory Decay v3.0:
   * S = S_base * recoveryFactor * regressionPenalty * difficultyFactor * stableBonus
   * Re-recovered concepts decay slower; repeatedly forgotten concepts decay faster.
   */
  calculateRetentionScore(profile: ConceptMemoryProfile): number {
    if (!profile.lastReviewAt) return 1.0;
    const now = TimeService.now();
    const last = new Date(profile.lastReviewAt);
    const diffMs = now.getTime() - last.getTime();
    const daysElapsed = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

    // Dùng chung công thức độ bền trí nhớ, không chép lại (xem memoryStrengthDays ở đầu file).
    const retention = Math.max(0.08, Math.exp(-daysElapsed / memoryStrengthDays(profile)));
    return Number(retention.toFixed(2));
  },

  /**
   * Bayesian-like Confidence Accumulation (without black-box Bayesian inference).
   * Distinguishes high-confidence 80% (50 observations) from low-confidence 80% (3 observations).
   * w = 1 - e^(-N / 8)
   */
  calculateBayesianMastery(profile: ConceptMemoryProfile): {
    effectiveMastery: number;
    observationConfidence: number; // 0 - 100%
    observationCount: number;
  } {
    const N = profile.timesStudied || 0;
    const confidenceWeight = 1.0 - Math.exp(-N / 8.0); // Smooth non-linear saturation
    const prior = 50.0; // Neutral prior
    const effectiveMastery = Math.round((confidenceWeight * profile.currentMastery) + ((1.0 - confidenceWeight) * prior));

    return {
      effectiveMastery,
      observationConfidence: Math.round(confidenceWeight * 100),
      observationCount: N
    };
  },

  /**
   * Generates projected future forgetting curve points for visualization.
   */
  generateForgetCurve(profile: ConceptMemoryProfile): Array<{ daysAhead: number; retention: number }> {
    // Dùng chung đúng công thức với calculateRetentionScore, nên đường cong vẽ ra màn hình
    // luôn khớp với điểm trí nhớ dùng để xếp lịch ôn tập.
    const memoryStrength = memoryStrengthDays(profile);
    const days = [0, 1, 3, 7, 14, 30];
    return days.map(d => ({
      daysAhead: d,
      retention: Number(Math.max(0.05, Math.exp(-d / memoryStrength)).toFixed(2))
    }));
  },

  /**
   * Records a teaching explanation history attempt for teaching memory rotation.
   * Ensures AI does not repeat verbatim explanations if previous ones failed.
   */
  recordExplanation(
    conceptName: string,
    strategy: string,
    length: string,
    wasSuccessful: boolean,
    subjectId?: string
  ): void {
    const profiles = this.getAllConceptProfiles(subjectId);
    const profile = profiles[conceptName] || this.getConceptProfile(conceptName, subjectId);

    const now = TimeService.now().toISOString();
    profile.explanationsHistory.unshift({
      timestamp: now,
      strategy,
      length,
      wasSuccessful
    });

    // Keep history compact (max 20)
    if (profile.explanationsHistory.length > 20) {
      profile.explanationsHistory = profile.explanationsHistory.slice(0, 20);
    }

    // Auto-update preferred teaching style if a strategy works well
    if (wasSuccessful) {
      profile.preferredTeachingStyle = strategy as any;
    }

    profiles[conceptName] = profile;
    this.saveAllConceptProfiles(profiles, subjectId);
  },

  /**
   * Rotates teaching strategy if previous attempts with current strategy failed.
   */
  getRotatedTeachingStrategy(conceptName: string, defaultStrategy: string, subjectId?: string): string {
    const profile = this.getConceptProfile(conceptName, subjectId);
    const history = profile.explanationsHistory;

    if (history.length === 0) return defaultStrategy;

    // Check last 2 attempts for this concept
    const recentFailed = history.slice(0, 2).filter(h => !h.wasSuccessful);
    if (recentFailed.length >= 2) {
      const styles: Array<"Academic" | "Business" | "Analogy" | "Socratic" | "Real-world" | "Simple"> = [
        "Academic", "Business", "Analogy", "Socratic", "Real-world", "Simple"
      ];
      const usedStyles = new Set(recentFailed.map(r => r.strategy));
      const unused = styles.find(s => !usedStyles.has(s));
      return unused || "Analogy";
    }

    return profile.preferredTeachingStyle || defaultStrategy;
  }
};
