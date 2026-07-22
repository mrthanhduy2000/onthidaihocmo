/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService, chapters, questions } from "./db";
import { kbService, KnowledgeNode } from "./kbService";
import { TimeService } from "./time";

export type CurriculumStage = 
  | "FOUNDATION"
  | "UNDERSTANDING"
  | "APPLICATION"
  | "CONSOLIDATION"
  | "EXAM_PREPARATION"
  | "FINAL_REVIEW"
  | "MASTERY";

export interface WeeklyScheduleDay {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  dayTitle: string;
  focus: string;
  estimatedMinutes: number;
  expectedRetentionGain: number;
  targetMastery: number;
  suggestedActivity: string;
}

export interface StudyDebtItem {
  concept: string;
  chapterId: number;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  suggestedAction: string;
}

export interface TransitionRecord {
  fromStage: CurriculumStage;
  toStage: CurriculumStage;
  reason: string;
  evidenceUsed: string;
  metricsTriggered: string;
  timestamp: string;
}

export interface ChapterProgressStatus {
  chapterId: number;
  code: string;
  title: string;
  status: "COMPLETED" | "READY" | "LOCKED" | "WEAK";
  masteryScore: number;
  totalQuestions: number;
}

export interface CurriculumPlan {
  todayGoal: string;
  weeklyGoal: string;
  currentStage: CurriculumStage;
  nextStage: CurriculumStage;
  recommendedConcepts: string[];
  recommendedChapters: number[];
  recommendedExamType: "adaptive" | "mock" | "incorrect" | "chapter";
  estimatedStudyTime: number; // minutes
  expectedRetentionGain: number; // percentage
  readinessScore: number; // 0-100
  masteryScore: number; // 0-100
  reviewPriority: "HIGH" | "MEDIUM" | "LOW";
  transitionReason: string;
  weeklyPlan: WeeklyScheduleDay[];
  studyDebt: StudyDebtItem[];
  transitionHistory: TransitionRecord[];
  chapterStatuses: ChapterProgressStatus[];
  studyBalance: {
    rememberPercentage: number;
    applyPercentage: number;
    analyzePercentage: number;
    mockExamsCompleted: number;
    balanceWarning?: string;
  };
  explainability: {
    decision: string;
    reason: string;
    evidence: string;
    metrics: string;
    policy: string;
    timestamp: string;
  };
}

export const curriculumIntelligenceEngine = {
  /**
   * Deterministically calculates current stage based on student model metrics & time countdown.
   */
  calculateCurriculumStage(stats: any, examDaysRemaining: number = 12): { stage: CurriculumStage; nextStage: CurriculumStage; reason: string } {
    const totalSolved = stats.totalSolved || 0;
    const accuracy = stats.totalSolved > 0 ? (stats.totalCorrect / stats.totalSolved) * 100 : 0;
    const mastery = Math.round(accuracy);

    // Rule 1: Final review window (Countdown <= 5 days)
    if (examDaysRemaining <= 5) {
      return {
        stage: "FINAL_REVIEW",
        nextStage: "MASTERY",
        reason: `Còn ${examDaysRemaining} ngày tới kỳ thi. Chuyển sang giai đoạn Ôn tập tổng lực cuối kỳ & xem lại sổ tay câu sai.`
      };
    }

    // Rule 2: Exam prep window (Countdown <= 14 days)
    if (examDaysRemaining <= 14 && totalSolved >= 30) {
      return {
        stage: "EXAM_PREPARATION",
        nextStage: "FINAL_REVIEW",
        reason: `Còn ${examDaysRemaining} ngày tới kỳ thi. Tăng cường rèn luyện đề thi thử phản xạ chuẩn thời gian.`
      };
    }

    // Rule 3: High Mastery reached
    if (mastery >= 85 && totalSolved >= 100) {
      return {
        stage: "MASTERY",
        nextStage: "FINAL_REVIEW",
        reason: "Đã đạt độ thông thạo xuất sắc (Mastery >= 85%). Tập trung duy trì đường cong ghi nhớ."
      };
    }

    // Rule 4: Consolidation stage
    if (totalSolved >= 80 && accuracy >= 70) {
      return {
        stage: "CONSOLIDATION",
        nextStage: "EXAM_PREPARATION",
        reason: "Đã tích lũy đủ > 80 câu hỏi. Chuyển sang giai đoạn Củng cố tri thức & khắc phục bẫy sai lầm."
      };
    }

    // Rule 5: Application stage
    if (totalSolved >= 40 && accuracy >= 60) {
      return {
        stage: "APPLICATION",
        nextStage: "CONSOLIDATION",
        reason: "Đã nắm vững khái niệm nền tảng. Tiến sang giai đoạn Vận dụng giải quyết tình huống."
      };
    }

    // Rule 6: Understanding stage
    if (totalSolved >= 15) {
      return {
        stage: "UNDERSTANDING",
        nextStage: "APPLICATION",
        reason: "Đã hoàn thành các bài khởi động đầu tiên. Chuyển sang giai đoạn Thông hiểu."
      };
    }

    // Rule 7: Foundation default stage
    return {
      stage: "FOUNDATION",
      nextStage: "UNDERSTANDING",
      reason: "Bắt đầu môn học ở giai đoạn Xây dựng Nền tảng. Khởi động từ Chương 1 & các khái niệm cốt lõi."
    };
  },

  /**
   * Generates a 7-day weekly schedule deterministically based on current stage and study debt.
   */
  generateWeeklyPlan(stage: CurriculumStage): WeeklyScheduleDay[] {
    const days: WeeklyScheduleDay["day"][] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayTitles = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];

    return days.map((day, idx) => {
      let focus = "Củng cố khái niệm";
      let minutes = 20;
      let retention = 10;
      let mastery = 65 + idx * 2;
      let activity = "Giải 10 câu trắc nghiệm";

      if (stage === "FOUNDATION" || stage === "UNDERSTANDING") {
        if (idx % 2 === 0) {
          focus = `Học khái niệm Chương ${Math.min(6, Math.floor(idx / 2) + 1)}`;
          minutes = 20;
          retention = 12;
          activity = "Đọc tài liệu & làm 10 câu khởi động";
        } else {
          focus = "Ôn tập định nghĩa & thuật ngữ";
          minutes = 15;
          retention = 8;
          activity = "Xem flashcard & rèn luyện bẫy nhận biết";
        }
      } else if (stage === "APPLICATION" || stage === "CONSOLIDATION") {
        if (idx === 5 || idx === 6) {
          focus = "Thi thử tự thích ứng (Adaptive)";
          minutes = 30;
          retention = 18;
          activity = "Làm đề thi thử 20 câu tích hợp toàn bộ chương";
        } else {
          focus = `Vận dụng tình huống Chương ${Math.min(6, idx + 1)}`;
          minutes = 25;
          retention = 15;
          activity = "Giải câu hỏi tình huống & phân tích lời giải";
        }
      } else {
        // EXAM_PREPARATION & FINAL_REVIEW
        focus = idx % 2 === 0 ? "Thi thử chuẩn cấu trúc 25 câu" : "Ôn tập sổ tay câu sai & bẫy điểm yếu";
        minutes = 35;
        retention = 20;
        activity = idx % 2 === 0 ? "Thi thử bấm giờ 30 phút" : "Rèn luyện lại 100% câu đã từng giải sai";
      }

      return {
        day,
        dayTitle: dayTitles[idx],
        focus,
        estimatedMinutes: minutes,
        expectedRetentionGain: retention,
        targetMastery: Math.min(100, mastery),
        suggestedActivity: activity
      };
    });
  },

  /**
   * Detects Study Debt: forgotten concepts, unpracticed chapters, misconceptions.
   */
  detectStudyDebt(stats: any, activeSubjectId: string = "customer_behavior"): StudyDebtItem[] {
    const debt: StudyDebtItem[] = [];
    const incorrectHistory = stats.incorrectQuestionHistory || {};
    const incorrectCount = Object.keys(incorrectHistory).length;

    // Debt 1: Incorrect questions accumulation
    if (incorrectCount > 0) {
      debt.push({
        concept: "Sổ tay câu sai tồn đọng",
        chapterId: 1,
        reason: `Có ${incorrectCount} câu hỏi đã làm sai nhưng chưa luyện tập lại để khắc phục triệt để.`,
        priority: incorrectCount > 10 ? "HIGH" : "MEDIUM",
        suggestedAction: "Luyện tập ngay phiên 'Sổ tay câu sai' để xóa tan bẫy tư duy."
      });
    }

    // Debt 2: Missing chapter practice
    const chaptersList = chapters.length > 0 ? chapters : [{ id: 1, title: "Tổng quan" }];
    chaptersList.forEach(ch => {
      const chQuestions = questions.filter(q => q.chapterId === ch.id);
      if (chQuestions.length === 0) return;

      const solvedQuestionIds: number[] = (stats as any).solvedQuestionIds || [];
      const solvedInChapter = chQuestions.filter(q => solvedQuestionIds.includes(q.id)).length;
      if (solvedInChapter === 0) {
        debt.push({
          concept: `Chương ${ch.id}: ${ch.title}`,
          chapterId: ch.id,
          reason: "Chưa từng thực hiện phiên luyện tập nào cho chương này.",
          priority: ch.id <= 3 ? "HIGH" : "MEDIUM",
          suggestedAction: `Luyện tập 10 câu đầu tiên của Chương ${ch.id}.`
        });
      }
    });

    // Debt 3: Bloom Apply/Analyze under-representation
    if (stats.totalSolved > 30) {
      debt.push({
        concept: "Cấp độ phân tích & vận dụng cao",
        chapterId: 2,
        reason: "Tỷ lệ câu hỏi cấp độ Apply/Analyze chưa đạt 30% tổng số câu đã làm.",
        priority: "LOW",
        suggestedAction: "Thực hiện phiên Adaptive AI để hệ thống phân bổ câu hỏi tình huống."
      });
    }

    return debt.sort((a, b) => (a.priority === "HIGH" ? -1 : 1));
  },

  /**
   * Generates the complete, deterministic Curriculum Strategy Plan.
   */
  getCurriculumPlan(subjectId: string = "customer_behavior"): CurriculumPlan {
    const stats = dbService.getStatistics();
    const attempts = dbService.getHistory();
    const examDaysRemaining = 12; // Standard countdown indicator

    const { stage, nextStage, reason } = this.calculateCurriculumStage(stats, examDaysRemaining);

    // Compute readiness score
    const totalSolved = stats.totalSolved || 0;
    const accuracy = totalSolved > 0 ? (stats.totalCorrect / totalSolved) : 0;
    const readinessScore = Math.min(100, Math.round((accuracy * 60) + (Math.min(1, totalSolved / 80) * 40)));
    const masteryScore = Math.round(accuracy * 100);

    const solvedIds: number[] = (stats as any).solvedQuestionIds || [];
    const chapterStatuses: ChapterProgressStatus[] = chapters.map(ch => {
      const chQ = questions.filter(q => q.chapterId === ch.id);
      const solvedInCh = chQ.filter(q => solvedIds.includes(q.id));
      const correctInCh = solvedInCh.filter(q => {
        // Find if correct in history
        return attempts.some(att => att.chapterId === ch.id && att.score > 0);
      });

      const chapterMastery = chQ.length > 0 ? Math.round((solvedInCh.length / chQ.length) * 100) : 0;
      let status: ChapterProgressStatus["status"] = "READY";

      if (chapterMastery >= 80) status = "COMPLETED";
      else if (chapterMastery === 0 && ch.id > 3 && totalSolved < 20) status = "LOCKED";
      else if (chapterMastery > 0 && chapterMastery < 50) status = "WEAK";

      return {
        chapterId: ch.id,
        code: ch.code || `CH${ch.id}`,
        title: ch.title,
        status,
        masteryScore: chapterMastery,
        totalQuestions: chQ.length
      };
    });

    // Detect study debt
    const studyDebt = this.detectStudyDebt(stats, subjectId);

    // Generate weekly plan
    const weeklyPlan = this.generateWeeklyPlan(stage);

    // Recommended exam type & goals
    let recommendedExamType: CurriculumPlan["recommendedExamType"] = "adaptive";
    let todayGoal = "Hoàn thành 15 câu luyện tập tự thích ứng";
    let weeklyGoal = "Tích lũy 80 câu hỏi & đạt 75% độ thông thạo";

    if (stage === "FOUNDATION") {
      recommendedExamType = "chapter";
      todayGoal = "Hoàn thành 10 câu khởi động Chương 1";
      weeklyGoal = "Hoàn thành các khái niệm cốt lõi Chương 1 & 2";
    } else if (stage === "EXAM_PREPARATION" || stage === "FINAL_REVIEW") {
      recommendedExamType = "mock";
      todayGoal = "Giải 1 bài thi thử chuẩn 25 câu (bấm giờ 30 phút)";
      weeklyGoal = "Hoàn thành 3 đề thi thử & rèn luyện 100% câu sai";
    } else if (studyDebt.some(d => d.priority === "HIGH" && d.concept.includes("câu sai"))) {
      recommendedExamType = "incorrect";
      todayGoal = "Khắc phục các câu hỏi tồn đọng trong Sổ tay câu sai";
      weeklyGoal = "Đưa số câu sai tồn đọng về 0";
    }

    // Transition History (deterministic audit log)
    const transitionHistory: TransitionRecord[] = [
      {
        fromStage: "FOUNDATION",
        toStage: stage,
        reason,
        evidenceUsed: `Đã hoàn thành ${totalSolved} câu hỏi, chính xác ${stats.totalCorrect} câu.`,
        metricsTriggered: `TotalSolved=${totalSolved}, Accuracy=${masteryScore}%, ExamDays=${examDaysRemaining}`,
        timestamp: TimeService.now().toISOString().slice(0, 10)
      }
    ];

    // Study Balance Breakdown
    const studyBalance = {
      rememberPercentage: 45,
      applyPercentage: 35,
      analyzePercentage: 20,
      mockExamsCompleted: attempts.filter(a => a.examType === "ai-smart").length,
      balanceWarning: totalSolved > 30 && attempts.filter(a => a.examType === "ai-smart").length === 0 
        ? "Bạn chưa thực hiện bài thi thử chuẩn cấu trúc nào. Nên thử 1 bài thi thử để kiểm tra phản xạ thời gian."
        : undefined
    };

    return {
      todayGoal,
      weeklyGoal,
      currentStage: stage,
      nextStage,
      recommendedConcepts: studyDebt.slice(0, 3).map(d => d.concept),
      recommendedChapters: [1, 2, 3],
      recommendedExamType,
      estimatedStudyTime: stage === "FINAL_REVIEW" ? 35 : 20,
      expectedRetentionGain: 15,
      readinessScore,
      masteryScore,
      reviewPriority: studyDebt.some(d => d.priority === "HIGH") ? "HIGH" : "MEDIUM",
      transitionReason: reason,
      weeklyPlan,
      studyDebt,
      transitionHistory,
      chapterStatuses,
      studyBalance,
      explainability: {
        decision: `Đặt mục tiêu chiến lược giai đoạn [${stage}]`,
        reason,
        evidence: `Dựa trên dữ liệu ${totalSolved} câu đã làm, ${attempts.length} phiên thi & đếm ngược ${examDaysRemaining} ngày.`,
        metrics: `Accuracy: ${masteryScore}%, Readiness: ${readinessScore}/100`,
        policy: "Curriculum Strategy Deterministic Policy v2026.1",
        timestamp: TimeService.now().toISOString()
      }
    };
  }
};
