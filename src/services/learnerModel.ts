/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

if (typeof globalThis !== "undefined" && typeof (globalThis as any).localStorage === "undefined") {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
}

import { dbService, setConceptMasteryBothKeys } from "./db";
import { kbService, KnowledgeNode } from "./kbService";
import { TimeService } from "./time";

export interface ConceptProfile {
  conceptId: string;
  conceptName: string;
  attemptsCount: number;
  correctCount: number;
  incorrectCount: number;
  lastStudiedAt?: string;
  avgTimeSpent: number; // in seconds
  confidence: number; // 0.0 to 1.0
  forgettingScore: number; // 0.0 to 1.0 (1.0 = fully retained, 0.0 = forgotten)
  reviewHistory: string[]; // ISO timestamps
  difficultyPreference: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
  streak: number;
  isBookmarked: boolean;
  isFlagged: boolean;
  learningVelocity: number; // average score slope
  nextReviewAt?: string; // ISO timestamp
}

export interface AdaptiveMemory {
  preferredExplanationStyle: "academic" | "simplified" | "intuitive" | "visual";
  preferredAnalogy: "business" | "daily_life" | "technology" | "sports";
  readingSpeedWpm: number;
  averageThinkingTimeSeconds: number;
  typicalMistakes: string[];
  guessingFrequency: number; // 0 to 1
  reviewCompliance: number; // 0 to 1
  socraticSuccessRate: number; // 0 to 1
  questionFatigue: number; // 0 to 100

  // Extended Continuous Learning Properties
  preferredTeachingStyle: "Simple" | "Academic" | "Expert" | "Business" | "Real-world" | "Analogy" | "Socratic";
  preferredExplanationLength: "short" | "medium" | "deep";
  preferredAnalogyDensity: number; // 0.0 to 1.0
  preferredExampleDensity: number; // 0.0 to 1.0
  preferredBloomSpeed: "cautious" | "balanced" | "accelerated";
  preferredDifficultyCurve: "gentle" | "steep" | "adaptive";
  preferredRetryPattern: "immediate_hint" | "socratic_prompt" | "prerequisite_remedial";
  preferredSessionLength: number;
  preferredQuestionStyle: "concept_focused" | "case_study" | "analytical";
  learningVelocity: number;
  fatigueTrend: number;
  engagementTrend: "increasing" | "stable" | "declining";
  strategyPerformance: Record<string, { attempts: number; successes: number; avgMasteryGain: number; avgConfidenceGain: number }>;
  consecutiveFailures: Record<string, number>;
}

export interface StudentModel {
  subjectId: string;
  conceptMastery: Record<string, number>; // conceptName -> mastery level (0-100)
  chapterMastery: Record<number, number>; // chapterId -> mastery level (0-100)
  bloomLevel: Record<string, string>; // conceptName -> Current Bloom Level
  misconceptionHistory: Record<string, { misconception: string; timestamp: string; questionId: number }[]>; // conceptName -> misconceptions history
  confidenceHistory: Record<string, number[]>; // conceptName -> confidence scores history
  forgettingScore: Record<string, number>; // conceptName -> forgetting score (0.0 to 1.0)
  lastStudiedAt: Record<string, string>; // conceptName -> last studied ISO string
  learningVelocity: Record<string, number>; // conceptName -> learning velocity (rate of mastery change)
  adaptiveMemory: AdaptiveMemory;
}

export interface AIOrchestratorStats {
  apiCallsCount: number;
  totalTokensCount: number;
  estimatedCostUsd: number;
  cacheHitCount: number;
  responseTimeMsList: number[];
  fallbackOfflineCount: number;
  errorCount: number;
}

const ORCHESTRATOR_STATS_KEY = "poly_econ_orchestrator_stats";

export const studentModelService = {
  /**
   * Constructs and returns the complete StudentModel (Digital Twin) for the active subject.
   */
  getStudentModel(): StudentModel {
    const activeSubjectId = dbService.getActiveSubjectId();
    const profiles = learnerModelService.getConceptProfiles();
    const stats = dbService.getStatistics();

    const conceptMastery: Record<string, number> = {};
    const chapterMastery: Record<number, number> = {};
    const bloomLevel: Record<string, string> = {};
    const misconceptionHistory: Record<string, { misconception: string; timestamp: string; questionId: number }[]> = {};
    const confidenceHistory: Record<string, number[]> = {};
    const forgettingScore: Record<string, number> = {};
    const lastStudiedAt: Record<string, string> = {};
    const learningVelocity: Record<string, number> = {};

    // Load extra histories from localStorage
    const extraHistoriesKey = `poly_econ_student_model_extras_${activeSubjectId}`;
    let extras: {
      misconceptionHistory: Record<string, { misconception: string; timestamp: string; questionId: number }[]>;
      confidenceHistory: Record<string, number[]>;
    } = { misconceptionHistory: {}, confidenceHistory: {} };

    const rawExtras = localStorage.getItem(extraHistoriesKey);
    if (rawExtras) {
      try {
        extras = JSON.parse(rawExtras);
      } catch {
        // use default
      }
    }

    // Map profiles into StudentModel fields
    Object.entries(profiles).forEach(([conceptName, p]) => {
      const updatedP = learnerModelService.recalculateForgettingScore(p);
      const mastery = stats.conceptMastery?.[p.conceptId] || stats.conceptMastery?.[p.conceptName] || 50;
      
      conceptMastery[conceptName] = mastery;
      bloomLevel[conceptName] = updatedP.difficultyPreference;
      forgettingScore[conceptName] = updatedP.forgettingScore;
      if (updatedP.lastStudiedAt) {
        lastStudiedAt[conceptName] = updatedP.lastStudiedAt;
      }
      learningVelocity[conceptName] = updatedP.learningVelocity;

      misconceptionHistory[conceptName] = extras.misconceptionHistory[conceptName] || [];
      confidenceHistory[conceptName] = extras.confidenceHistory[conceptName] || [updatedP.confidence];
    });

    // Populate chapter mastery from stats
    Object.entries(stats.accuracyByChapter || {}).forEach(([chIdStr, data]: any) => {
      const chId = parseInt(chIdStr);
      if (data.total > 0) {
        chapterMastery[chId] = Math.round((data.correct / data.total) * 100);
      } else {
        chapterMastery[chId] = 0;
      }
    });

    const adaptiveMemory = this.getAdaptiveMemory();

    return {
      subjectId: activeSubjectId,
      conceptMastery,
      chapterMastery,
      bloomLevel,
      misconceptionHistory,
      confidenceHistory,
      forgettingScore,
      lastStudiedAt,
      learningVelocity,
      adaptiveMemory
    };
  },

  getAdaptiveMemory(): AdaptiveMemory {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_adaptive_memory_${activeSubjectId}`;
    const defaults: AdaptiveMemory = {
      preferredExplanationStyle: "academic",
      preferredAnalogy: "business",
      readingSpeedWpm: 250,
      averageThinkingTimeSeconds: 15,
      typicalMistakes: [],
      guessingFrequency: 0.0,
      reviewCompliance: 1.0,
      socraticSuccessRate: 0.8,
      questionFatigue: 0,

      preferredTeachingStyle: "Academic",
      preferredExplanationLength: "medium",
      preferredAnalogyDensity: 0.5,
      preferredExampleDensity: 0.7,
      preferredBloomSpeed: "balanced",
      preferredDifficultyCurve: "adaptive",
      preferredRetryPattern: "socratic_prompt",
      preferredSessionLength: 10,
      preferredQuestionStyle: "concept_focused",
      // Tốc độ học của một hồ sơ CHƯA HỌC GÌ phải là 0, không phải 2,5. Bản cũ đặt 2,5, và con
      // số đó chảy thẳng ra màn hình Phân tích giảng dạy ở ô "Tốc độ Học tập" như thể đã đo
      // được. Các trường sở thích phía trên là mặc định về HÀNH VI DẠY (chọn kiểu giải thích
      // nào khi chưa biết gì về người học), khác hẳn về bản chất với một chỉ số đo lường.
      learningVelocity: 0,
      fatigueTrend: 0,
      engagementTrend: "stable",
      strategyPerformance: {},
      consecutiveFailures: {}
    };

    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      } catch {
        // use default
      }
    }
    return defaults;
  },

  saveAdaptiveMemory(memory: AdaptiveMemory): void {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_adaptive_memory_${activeSubjectId}`;
    localStorage.setItem(key, JSON.stringify(memory));
  },

  updateAdaptiveMemory(params: {
    timeSpent: number;
    wordCount: number;
    isCorrect: boolean;
    isGuessLikely: boolean;
    misconception?: string;
  }): void {
    const memory = this.getAdaptiveMemory();
    
    // 1. Reading Speed (words per minute), limit to sensible bounds
    if (params.timeSpent > 2 && params.wordCount > 5) {
      const currentSpeed = (params.wordCount / (params.timeSpent / 60));
      if (currentSpeed > 50 && currentSpeed < 1000) {
        memory.readingSpeedWpm = Math.round(memory.readingSpeedWpm * 0.8 + currentSpeed * 0.2);
      }
    }

    // 2. Average Thinking Time
    memory.averageThinkingTimeSeconds = Math.round(memory.averageThinkingTimeSeconds * 0.7 + params.timeSpent * 0.3);

    // 3. Guessing Frequency
    const guessWeight = params.isGuessLikely ? 1 : 0;
    memory.guessingFrequency = parseFloat((memory.guessingFrequency * 0.8 + guessWeight * 0.2).toFixed(3));

    // 4. Typical Mistakes
    if (params.misconception && !memory.typicalMistakes.includes(params.misconception)) {
      memory.typicalMistakes.push(params.misconception);
      if (memory.typicalMistakes.length > 10) {
        memory.typicalMistakes.shift();
      }
    }

    // 5. Question Fatigue
    memory.questionFatigue = Math.min(100, memory.questionFatigue + 8);

    // 6. Dynamic Explanation Style / Analogy adjustment based on performance
    if (params.isCorrect) {
      if (memory.questionFatigue > 60) {
        memory.preferredExplanationStyle = "visual";
      } else {
        memory.preferredExplanationStyle = "academic";
      }
    } else {
      memory.preferredExplanationStyle = "simplified";
      memory.preferredAnalogy = "daily_life";
    }

    this.saveAdaptiveMemory(memory);
  },

  saveStudentModelExtraHistories(
    misconceptionHistory: Record<string, { misconception: string; timestamp: string; questionId: number }[]>,
    confidenceHistory: Record<string, number[]>
  ): void {
    const activeSubjectId = dbService.getActiveSubjectId();
    const extraHistoriesKey = `poly_econ_student_model_extras_${activeSubjectId}`;
    localStorage.setItem(extraHistoriesKey, JSON.stringify({ misconceptionHistory, confidenceHistory }));
  },

  logMisconception(conceptName: string, misconception: string, questionId: number): void {
    const model = this.getStudentModel();
    const history = model.misconceptionHistory[conceptName] || [];
    history.push({
      misconception,
      timestamp: TimeService.now().toISOString(),
      questionId
    });
    model.misconceptionHistory[conceptName] = history.slice(-10); // Keep last 10
    this.saveStudentModelExtraHistories(model.misconceptionHistory, model.confidenceHistory);
  },

  logConfidenceValue(conceptName: string, confidence: number): void {
    const model = this.getStudentModel();
    const history = model.confidenceHistory[conceptName] || [];
    history.push(confidence);
    model.confidenceHistory[conceptName] = history.slice(-20); // Keep last 20
    this.saveStudentModelExtraHistories(model.misconceptionHistory, model.confidenceHistory);
  },

  updateConceptMastery(conceptName: string, mastery: number): void {
    const stats = dbService.getStatistics();
    if (!stats.conceptMastery) {
      stats.conceptMastery = {};
    }
    // Ghi đồng thời khóa mã và khóa tên để hai nguồn cập nhật độ thạo không bao giờ lệch
    // nhau (xem chú thích tại setConceptMasteryBothKeys trong db.ts).
    setConceptMasteryBothKeys(stats, conceptName, mastery);
    dbService.saveStatistics(stats);
  }
};

export const learnerModelService = {
  /**
   * Retrieves the detailed concept profiles for the active subject.
   */
  getConceptProfiles(): Record<string, ConceptProfile> {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_concept_profiles_${activeSubjectId}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  /**
   * Saves the concept profiles.
   */
  saveConceptProfiles(profiles: Record<string, ConceptProfile>): void {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_concept_profiles_${activeSubjectId}`;
    localStorage.setItem(key, JSON.stringify(profiles));
  },

  /**
   * Returns or initializes the profile for a specific concept.
   */
  getOrCreateProfile(conceptName: string): ConceptProfile {
    const profiles = this.getConceptProfiles();
    if (profiles[conceptName]) {
      // Re-calculate forgetting score on retrieval to ensure real-time decay
      const updatedProfile = this.recalculateForgettingScore(profiles[conceptName]);
      profiles[conceptName] = updatedProfile;
      this.saveConceptProfiles(profiles);
      return updatedProfile;
    }

    const newProfile: ConceptProfile = {
      conceptId: conceptName.replace(/\s+/g, "_").toLowerCase(),
      conceptName,
      attemptsCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      avgTimeSpent: 0,
      confidence: 0.1, // starts with a baseline confidence
      forgettingScore: 1.0,
      reviewHistory: [],
      difficultyPreference: "Understand",
      streak: 0,
      isBookmarked: false,
      isFlagged: false,
      learningVelocity: 0,
      nextReviewAt: TimeService.now().toISOString()
    };
    profiles[conceptName] = newProfile;
    this.saveConceptProfiles(profiles);
    return newProfile;
  },

  /**
   * Recalculates the forgetting score using half-life and elapsed time.
   */
  recalculateForgettingScore(profile: ConceptProfile): ConceptProfile {
    if (!profile.lastStudiedAt) return { ...profile, forgettingScore: 1.0 };

    const lastStudied = new Date(profile.lastStudiedAt).getTime();
    const now = TimeService.now().getTime();
    const elapsedDays = (now - lastStudied) / (1000 * 60 * 60 * 24);

    // Calculate half-life in days based on correctness streak and confidence
    // baseline is 0.5 days, scaling exponentially up to 30 days
    const halfLife = 0.5 * Math.pow(2.2, Math.min(6, profile.streak)) * (0.5 + profile.confidence);

    // Forgetting curve formula: R = e^(-t / h)
    const forgettingScore = Math.max(0.01, Math.min(1.0, Math.exp(-elapsedDays / halfLife)));

    // Spaced Repetition threshold for next review is when retention falls to 60%
    const nextReviewDays = -Math.log(0.6) * halfLife; // ~0.51 * half-life
    const nextReviewTime = lastStudied + nextReviewDays * (1000 * 60 * 60 * 24);

    return {
      ...profile,
      forgettingScore: parseFloat(forgettingScore.toFixed(3)),
      nextReviewAt: new Date(nextReviewTime).toISOString()
    };
  },

  /**
   * Dynamically updates the concept profiles based on exam attempts.
   */
  logConceptAttempt(conceptName: string, isCorrect: boolean, timeSpent: number): ConceptProfile {
    const profile = this.getOrCreateProfile(conceptName);
    const nowIso = TimeService.now().toISOString();

    // 1. Update counters
    const newAttempts = profile.attemptsCount + 1;
    const newCorrect = isCorrect ? profile.correctCount + 1 : profile.correctCount;
    const newIncorrect = !isCorrect ? profile.incorrectCount + 1 : profile.incorrectCount;

    // 2. Average time spent moving average
    const newAvgTimeSpent = parseFloat(
      ((profile.avgTimeSpent * profile.attemptsCount + timeSpent) / newAttempts).toFixed(1)
    );

    // 3. Streak
    const newStreak = isCorrect ? profile.streak + 1 : 0;

    // 4. Learning Velocity (accuracy change trend)
    const oldAccuracy = profile.attemptsCount > 0 ? profile.correctCount / profile.attemptsCount : 0.5;
    const newAccuracy = newCorrect / newAttempts;
    const velocity = parseFloat((newAccuracy - oldAccuracy).toFixed(3));

    // 5. Confidence logic: goes up with correct, down with incorrect
    let confidence = profile.confidence;
    if (isCorrect) {
      confidence = Math.min(1.0, confidence + 0.15 * (1.0 - confidence));
    } else {
      confidence = Math.max(0.0, confidence - 0.25 * confidence);
    }

    // 6. Dynamic Difficulty progression
    // Bloom Levels: Remember -> Understand -> Apply -> Analyze -> Evaluate -> Create
    const bloomLevels: ConceptProfile["difficultyPreference"][] = [
      "Remember",
      "Understand",
      "Apply",
      "Analyze",
      "Evaluate",
      "Create"
    ];
    let currentIndex = bloomLevels.indexOf(profile.difficultyPreference);
    if (currentIndex === -1) currentIndex = 1;

    let nextDifficulty = profile.difficultyPreference;
    if (isCorrect && newStreak >= 3 && currentIndex < bloomLevels.length - 1) {
      nextDifficulty = bloomLevels[currentIndex + 1];
    } else if (!isCorrect && currentIndex > 0) {
      nextDifficulty = bloomLevels[currentIndex - 1];
    }

    // 7. Update history
    const updatedHistory = [...profile.reviewHistory, nowIso].slice(-20); // Keep last 20 reviews

    const updatedProfile: ConceptProfile = {
      ...profile,
      attemptsCount: newAttempts,
      correctCount: newCorrect,
      incorrectCount: newIncorrect,
      lastStudiedAt: nowIso,
      avgTimeSpent: newAvgTimeSpent,
      streak: newStreak,
      confidence: parseFloat(confidence.toFixed(3)),
      learningVelocity: velocity,
      difficultyPreference: nextDifficulty,
      reviewHistory: updatedHistory,
      isBookmarked: profile.isBookmarked,
      isFlagged: profile.isFlagged
    };

    const finalProfile = this.recalculateForgettingScore(updatedProfile);
    
    // Log confidence value trend to Digital Twin
    studentModelService.logConfidenceValue(conceptName, finalProfile.confidence);

    const profiles = this.getConceptProfiles();
    profiles[conceptName] = finalProfile;
    this.saveConceptProfiles(profiles);

    // Update the dbService conceptMastery as well for compatibility
    dbService.boostConceptMastery(conceptName, isCorrect ? 15 : -10);

    return finalProfile;
  },

  /**
   * Manually sets concept confidence, e.g. after a mini lesson or quiz in coach
   */
  adjustConfidence(conceptName: string, delta: number): void {
    const profile = this.getOrCreateProfile(conceptName);
    profile.confidence = Math.max(0.0, Math.min(1.0, parseFloat((profile.confidence + delta).toFixed(3))));
    
    // Log confidence value trend to Digital Twin
    studentModelService.logConfidenceValue(conceptName, profile.confidence);

    const profiles = this.getConceptProfiles();
    profiles[conceptName] = this.recalculateForgettingScore(profile);
    this.saveConceptProfiles(profiles);
  },

  /**
   * Bookmarks/Unbookmarks a concept
   */
  toggleConceptBookmark(conceptName: string): boolean {
    const profile = this.getOrCreateProfile(conceptName);
    const newState = !profile.isBookmarked;
    profile.isBookmarked = newState;

    const profiles = this.getConceptProfiles();
    profiles[conceptName] = profile;
    this.saveConceptProfiles(profiles);
    return newState;
  },

  /**
   * Flags/Unflags a concept
   */
  toggleConceptFlag(conceptName: string): boolean {
    const profile = this.getOrCreateProfile(conceptName);
    const newState = !profile.isFlagged;
    profile.isFlagged = newState;

    const profiles = this.getConceptProfiles();
    profiles[conceptName] = profile;
    this.saveConceptProfiles(profiles);
    return newState;
  },

  /**
   * Orchestrator Stats / AI Telemetry persistence
   */
  getOrchestratorStats(): AIOrchestratorStats {
    const raw = localStorage.getItem(ORCHESTRATOR_STATS_KEY);
    if (!raw) {
      return {
        apiCallsCount: 0,
        totalTokensCount: 0,
        estimatedCostUsd: 0.0,
        cacheHitCount: 0,
        responseTimeMsList: [],
        fallbackOfflineCount: 0,
        errorCount: 0
      };
    }
    try {
      return JSON.parse(raw);
    } catch {
      return {
        apiCallsCount: 0,
        totalTokensCount: 0,
        estimatedCostUsd: 0.0,
        cacheHitCount: 0,
        responseTimeMsList: [],
        fallbackOfflineCount: 0,
        errorCount: 0
      };
    }
  },

  saveOrchestratorStats(stats: AIOrchestratorStats): void {
    localStorage.setItem(ORCHESTRATOR_STATS_KEY, JSON.stringify(stats));
  },

  logAiCall(tokens: number, cost: number, responseTimeMs: number, cacheHit: boolean = false): void {
    const stats = this.getOrchestratorStats();
    stats.apiCallsCount += 1;
    stats.totalTokensCount += tokens;
    stats.estimatedCostUsd = parseFloat((stats.estimatedCostUsd + cost).toFixed(5));
    if (cacheHit) stats.cacheHitCount += 1;
    
    const times = stats.responseTimeMsList || [];
    times.push(responseTimeMs);
    stats.responseTimeMsList = times.slice(-100); // keep last 100
    
    this.saveOrchestratorStats(stats);
  },

  logAiOfflineFallback(): void {
    const stats = this.getOrchestratorStats();
    stats.fallbackOfflineCount += 1;
    this.saveOrchestratorStats(stats);
  },

  logAiError(): void {
    const stats = this.getOrchestratorStats();
    stats.errorCount += 1;
    this.saveOrchestratorStats(stats);
  }
};

// Auto-synchronize learner profile concept metrics with student answer submissions
dbService.addOnSubmit((attempt) => {
  const activeSubjectId = dbService.getActiveSubjectId();
  const answers = attempt.answers || {};
  const questionMap = dbService.getQuestionMap();
  const timeSpentPerQ = Math.round((attempt.timeSpent || 0) / Math.max(1, Object.keys(answers).length)) || 15;
  
  Object.entries(answers).forEach(([qIdStr, answer]) => {
    const qId = parseInt(qIdStr);
    const q = questionMap.get(qId);
    if (!q) return;
    const isCorrect = q.correctAnswer === answer;
    const conceptNode = kbService.getConceptForQuestion(activeSubjectId, q);
    if (conceptNode) {
      learnerModelService.logConceptAttempt(conceptNode.concept, isCorrect, timeSpentPerQ);
    }
  });
});
