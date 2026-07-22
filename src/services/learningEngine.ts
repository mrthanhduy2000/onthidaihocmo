/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService } from "./db";
import { kbService, KnowledgeNode } from "./kbService";
import { learnerModelService, ConceptProfile } from "./learnerModel";
import { Question, ExamAttempt, DifficultyLevel } from "../types";
import { TimeService } from "./time";

export interface LearningRoadmapStep {
  id: string;
  conceptName: string;
  status: "locked" | "available" | "mastered";
  chapter: number;
  reason: string;
  actionRecommendation: string;
}

export interface LearningRoadmap {
  subjectName: string;
  overallProgress: number;
  steps: LearningRoadmapStep[];
}

export interface CoachDiagnostic {
  conceptName: string;
  definition: string;
  misconceptionDetected: string;
  miniLesson: string;
  analogy: string;
  memoryHook: string;
  followUpQuiz: {
    question: string;
    options: { key: string; text: string; isCorrect: boolean }[];
  };
}

export const learningEngine = {
  /**
   * Adaptive Question Chooser Algorithm
   * Computes composite score for all candidate questions based on detailed learner model
   */
  scoreQuestions(pool: Question[]): { q: Question; score: number; reasons: string[] }[] {
    const stats = dbService.getStatistics();
    const activeSubjectId = dbService.getActiveSubjectId();
    const graph = kbService.getKnowledgeGraph(activeSubjectId);
    
    const now = TimeService.now().getTime();

    // Map graph nodes for rapid lookup
    const nodeMap = new Map<string, KnowledgeNode>();
    graph.forEach(node => {
      nodeMap.set(node.concept.toLowerCase(), node);
      nodeMap.set(node.id.toLowerCase(), node);
    });

    return pool.map(q => {
      let score = 1.0;
      const reasons: string[] = [];

      // Find concept mapped to this question
      const conceptTags = q.knowledgeMapping || [];
      const matchedNodes = conceptTags
        .map(tag => nodeMap.get(tag.trim().toLowerCase()))
        .filter((node): node is KnowledgeNode => !!node);

      if (matchedNodes.length === 0) {
        // Fallback standard weights
        const incorrectCount = stats.incorrectQuestionHistory[q.id] || 0;
        if (incorrectCount > 0) {
          score += incorrectCount * 2.0;
          reasons.push(`Lịch sử làm sai (+${incorrectCount * 2.0})`);
        }
        return { q, score: Math.max(0.1, score), reasons };
      }

      // Aggregate weights over mapped concepts
      matchedNodes.forEach(node => {
        const profile = learnerModelService.getOrCreateProfile(node.concept);

        // 1. Mastery Multiplier
        // Low mastery increases weight, high mastery reduces weight
        const mastery = stats.conceptMastery?.[node.id] || stats.conceptMastery?.[node.concept] || 0;
        if (mastery < 40) {
          score += 3.5;
          reasons.push(`Khái niệm chưa vững "${node.concept}" (+3.5)`);
        } else if (mastery > 85) {
          score -= 2.0;
          reasons.push(`Khái niệm đã tinh thông "${node.concept}" (-2.0)`);
        }

        // 2. Spaced Repetition (Forgetting Curve Score)
        // If forgetting curve score is low, we must review immediately!
        const retention = profile.forgettingScore; // 0.0 to 1.0
        if (retention < 0.6) {
          const boost = (1.0 - retention) * 6.0;
          score += boost;
          reasons.push(`Suy giảm trí nhớ (Retention: ${Math.round(retention * 100)}%) (+${boost.toFixed(1)})`);
        } else {
          // If retention is high (freshly studied), reduce probability
          score -= 1.5;
        }

        // 3. Prerequisite Checking (Concept Dependency Graph)
        // If Concept X requires Prerequisite Concept Y, and Y is NOT mastered (mastery < 50),
        // we lock or heavily suppress Concept X, and prioritize Concept Y!
        if (node.dependencies && node.dependencies.requires) {
          node.dependencies.requires.forEach(reqNameOrId => {
            const reqNode = nodeMap.get(reqNameOrId.toLowerCase());
            if (reqNode) {
              const reqMastery = stats.conceptMastery?.[reqNode.id] || stats.conceptMastery?.[reqNode.concept] || 0;
              if (reqMastery < 50) {
                // Suppress this question because prerequisite is unmastered
                score *= 0.15;
                reasons.push(`Khóa do rỗng tiên quyết "${reqNode.concept}" (x0.15)`);
              }
            }
          });
        }

        // 4. Overdue Spaced Repetition Priority
        if (profile.nextReviewAt && new Date(profile.nextReviewAt).getTime() < now) {
          score += 3.0;
          reasons.push(`Quá hạn ôn tập Spaced Repetition (+3.0)`);
        }

        // 5. Confidence Gap
        if (profile.confidence < 0.4) {
          const gapBoost = (1.0 - profile.confidence) * 2.5;
          score += gapBoost;
          reasons.push(`Độ tự tin thấp (${Math.round(profile.confidence * 100)}%) (+${gapBoost.toFixed(1)})`);
        }

        // 6. Importance of Concept
        if (node.importance) {
          score += node.importance * 0.4;
          reasons.push(`Độ quan trọng khái niệm (+${(node.importance * 0.4).toFixed(1)})`);
        }

        // 7. Dynamic Bloom Level Matching
        // Match question's bloom level with learner's dynamic progress
        const targetBloom = profile.difficultyPreference; // Remember, Understand, Apply, etc.
        const questionBloom = q.bloomLevel || "Understand";
        if (questionBloom.toLowerCase() === targetBloom.toLowerCase()) {
          score += 2.0;
          reasons.push(`Khớp nấc thang Bloom: ${targetBloom} (+2.0)`);
        } else {
          // Softly discourage mismatch
          score *= 0.8;
        }
      });

      // 8. Individual Question Wrong History boost
      const wrongCount = stats.incorrectQuestionHistory[q.id] || 0;
      if (wrongCount > 0) {
        score += wrongCount * 1.5;
        reasons.push(`Lịch sử sai ở câu này (+${wrongCount * 1.5})`);
      }

      // Ensure score is always positive
      score = Math.max(0.1, score);
      return { q, score, reasons };
    });
  },

  /**
   * Generates a fully adaptive exam attempt using scored weight distribution.
   */
  generateAdaptiveExam(count: number = 10): ExamAttempt {
    const pool = [...dbService.getDashboardOverview().lastExam?.questions === undefined ? [] : [], ...dbService.getSubjects().length > 0 ? (dbService as any).questions || [] : []];
    const scored = this.scoreQuestions(pool);
    
    // Sort scored questions by score descending, adding moderate randomness to avoid deterministic repeats
    const sorted = scored.sort((a, b) => {
      const randFactorA = Math.random() * 2.5;
      const randFactorB = Math.random() * 2.5;
      return (b.score + randFactorB) - (a.score + randFactorA);
    });

    const selectedQs = sorted.slice(0, count).map(s => s.q);

    return {
      id: `exam-adaptive-${TimeService.nowTimestamp()}`,
      examType: "adaptive",
      startTime: TimeService.now().toISOString(),
      questions: selectedQs.map(q => q.id),
      answers: {},
      bookmarks: [],
      flags: [],
      isSubmitted: false,
      score: 0,
      timeSpent: 0
    };
  },

  /**
   * Generates a customized topological Learning Roadmap for the student.
   * Leverages Knowledge Graph dependencies and student Mastery levels.
   */
  generateLearningRoadmap(): LearningRoadmap {
    const activeSubjectId = dbService.getActiveSubjectId();
    const subjectName = dbService.getActiveSubjectName();
    const stats = dbService.getStatistics();
    const graph = kbService.getKnowledgeGraph(activeSubjectId);

    const nodeMap = new Map<string, KnowledgeNode>();
    graph.forEach(node => {
      nodeMap.set(node.concept.toLowerCase(), node);
      nodeMap.set(node.id.toLowerCase(), node);
    });

    const steps: LearningRoadmapStep[] = [];

    graph.forEach(node => {
      const profile = learnerModelService.getOrCreateProfile(node.concept);
      const mastery = stats.conceptMastery?.[node.id] || stats.conceptMastery?.[node.concept] || 0;

      let status: LearningRoadmapStep["status"] = "available";
      let reason = "Khái niệm đã mở khóa, sẵn sàng luyện tập.";
      let actionRecommendation = `Luyện đề thích ứng để tăng độ thành thạo và nấc thang Bloom.`;

      if (mastery >= 75) {
        status = "mastered";
        reason = `Đã tinh thông khái niệm này (Độ thạo: ${mastery}%).`;
        actionRecommendation = `Duy trì tần suất ôn tập Spaced Repetition định kỳ.`;
      } else {
        // Check prerequisites
        let blockedBy: string[] = [];
        if (node.dependencies && node.dependencies.requires) {
          node.dependencies.requires.forEach(reqNameOrId => {
            const reqNode = nodeMap.get(reqNameOrId.toLowerCase());
            if (reqNode) {
              const reqMastery = stats.conceptMastery?.[reqNode.id] || stats.conceptMastery?.[reqNode.concept] || 0;
              if (reqMastery < 50) {
                blockedBy.push(reqNode.concept);
              }
            }
          });
        }

        if (blockedBy.length > 0) {
          status = "locked";
          reason = `Bị khóa do chưa làm chủ kiến thức nền tảng: ${blockedBy.join(", ")}.`;
          actionRecommendation = `Hãy tập trung học và làm đúng các câu hỏi về "${blockedBy[0]}" trước để mở khóa.`;
        } else {
          // Available and unmastered
          if (profile.attemptsCount === 0) {
            reason = "Khái niệm mới hoàn toàn chưa học.";
            actionRecommendation = "Mở AI Hub, thảo luận lý thuyết hoặc khởi chạy Đề thích ứng ngay.";
          } else {
            reason = `Đang trong tiến trình học (Độ thạo: ${mastery}%, Tự tin: ${Math.round(profile.confidence * 100)}%).`;
            actionRecommendation = "Ôn tập các bẫy hiểu sai phổ biến (misconception) và luyện thêm 5 câu.";
          }
        }
      }

      steps.push({
        id: node.id,
        conceptName: node.concept,
        status,
        chapter: node.chapter || 1,
        reason,
        actionRecommendation
      });
    });

    // Calculate completion rate based on mastered steps
    const masteredCount = steps.filter(s => s.status === "mastered").length;
    const overallProgress = steps.length > 0 ? Math.round((masteredCount / steps.length) * 100) : 0;

    return {
      subjectName,
      overallProgress,
      steps: steps.sort((a, b) => a.chapter - b.chapter)
    };
  },

  /**
   * Wrong Answer Coach Diagnostic Generator
   * Extracts tutoring context, misconceptions, mini lessons, analogies, and quizzes without requiring AI calls!
   */
  getWrongAnswerCoachDiagnostics(question: Question): CoachDiagnostic | null {
    const activeSubjectId = dbService.getActiveSubjectId();
    const conceptNode = kbService.getConceptForQuestion(activeSubjectId, question);
    if (!conceptNode) return null;

    const quizOptions = kbService.getCoachingOptions(conceptNode);

    return {
      conceptName: conceptNode.concept,
      definition: conceptNode.definition,
      misconceptionDetected: question.misconception || conceptNode.teaching?.misconception || "Nhầm lẫn bản chất khái niệm.",
      miniLesson: conceptNode.coaching?.miniLesson || conceptNode.explanation?.simpleExplanation || "Xem bối cảnh lý thuyết.",
      analogy: conceptNode.explanation?.analogy || "Liên tưởng trực quan sinh động.",
      memoryHook: conceptNode.teaching?.memoryHook || `Ghi nhớ gắn liền với Chương ${conceptNode.chapter}.`,
      followUpQuiz: quizOptions
    };
  },

  /**
   * Forecasts learner's score if they take a university exam today vs in 3 days.
   * Utilizes forgetting curves, mastery, and confidence distribution.
   */
  calculateLearningForecast(): { scoreToday: number; scoreThreeDays: number; velocity: number } {
    const stats = dbService.getStatistics();
    const profiles = learnerModelService.getConceptProfiles();
    
    let totalScore = 0;
    let count = 0;

    let totalScoreInThreeDays = 0;

    // We can average accuracy over chapters, but concept-profile level prediction is much richer
    const profileList = Object.values(profiles);
    if (profileList.length === 0) {
      // Return default baseline prediction based on solved questions
      const accuracy = stats.totalSolved > 0 ? stats.totalCorrect / stats.totalSolved : 0.6;
      const today = Math.round(accuracy * 100);
      return {
        scoreToday: today,
        scoreThreeDays: Math.max(30, Math.round(today - 4)), // default memory decay if inactive
        velocity: 0
      };
    }

    let sumVelocity = 0;

    profileList.forEach(p => {
      // Today: Score prediction is a mixture of base concept mastery and confidence
      const pMastery = stats.conceptMastery?.[p.conceptId] || stats.conceptMastery?.[p.conceptName] || 50;
      const conceptScoreToday = (pMastery * 0.7) + (p.confidence * 100 * 0.3);
      totalScore += conceptScoreToday;
      count++;

      // In Three Days: Score decays according to predicted forgetting score decay
      // Let's compute retention after 3 days
      const lastStudied = p.lastStudiedAt ? new Date(p.lastStudiedAt).getTime() : TimeService.now().getTime();
      const threeDaysFromNow = TimeService.now().getTime() + (3 * 24 * 60 * 60 * 1000);
      const elapsedDays = (threeDaysFromNow - lastStudied) / (1000 * 60 * 60 * 24);

      const halfLife = 0.5 * Math.pow(2.2, Math.min(6, p.streak)) * (0.5 + p.confidence);
      const retentionInThreeDays = Math.max(0.01, Math.min(1.0, Math.exp(-elapsedDays / halfLife)));

      const conceptScoreInThreeDays = (conceptScoreToday * 0.5) + (retentionInThreeDays * 100 * 0.5);
      totalScoreInThreeDays += conceptScoreInThreeDays;

      sumVelocity += p.learningVelocity || 0;
    });

    const scoreToday = Math.round(totalScore / count);
    const scoreThreeDays = Math.round(totalScoreInThreeDays / count);
    const avgVelocity = parseFloat((sumVelocity / count).toFixed(3));

    return {
      scoreToday: Math.min(100, Math.max(10, scoreToday)),
      scoreThreeDays: Math.min(100, Math.max(10, scoreThreeDays)),
      velocity: avgVelocity
    };
  }
};
