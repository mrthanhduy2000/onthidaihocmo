/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService, chapters, questions } from "./db";
import { 
  LearningResource, 
  KnowledgeHealthItem, 
  KnowledgeVersion, 
  LearningLogEntry, 
  StudySnapshot, 
  AppSettings,
  ExamAttempt
} from "../types";
import { TimeService } from "./time";

const RESOURCES_KEY = (subId: string) => `poly_econ_resources_${subId}`;
const SETTINGS_KEY = "poly_econ_settings";
// Phiên chưa hoàn thành lưu riêng theo từng môn để không lẫn giữa các môn.
const UNFINISHED_SESSION_KEY = () => `poly_econ_unfinished_session_${dbService.getActiveSubjectId()}`;
// Key cũ dùng chung (không theo môn) - đọc để dọn nốt phiên treo tồn đọng.
const LEGACY_UNFINISHED_KEY = "poly_econ_unfinished_session";
const ARCHIVED_SUBJECTS_KEY = "poly_econ_archived_subjects";
// Danh sách id câu hỏi vừa ra ở các lượt gần đây (theo môn) để chống lặp câu cũ liên tục.
const RECENT_SERVED_KEY = () => `poly_econ_recent_served_${dbService.getActiveSubjectId()}`;
// Giữ tối đa bao nhiêu id gần nhất trong hàng đợi chống lặp.
const RECENT_SERVED_LIMIT = 80;

export const workspaceService = {
  /**
   * Resource Manager for Textbooks, Slides, Past Exams, Flashcards, Notes, Mindmaps
   */
  getResources(subjectId?: string): LearningResource[] {
    const subId = subjectId || dbService.getActiveSubjectId();
    const raw = localStorage.getItem(RESOURCES_KEY(subId));
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    // Default initial resources for active subject
    const defaultResources: LearningResource[] = [
      {
        id: "res_1",
        title: "Giáo trình Kinh tế Chính trị Mác-Lênin (NXB Lý luận chính trị)",
        type: "giáo trình",
        status: "available",
        conceptCount: 42,
        updatedAt: "2026-07-01",
        fileSize: "4.8 MB"
      },
      {
        id: "res_2",
        title: "Slide Bài giảng Hệ thống các Chương 1-6",
        type: "slide",
        status: "available",
        conceptCount: 38,
        updatedAt: "2026-07-05",
        fileSize: "12.3 MB"
      },
      {
        id: "res_3",
        title: "Bộ Đề thi Ôn tập Trắc nghiệm các học kỳ trước",
        type: "đề cũ",
        status: "available",
        conceptCount: 50,
        updatedAt: "2026-07-10",
        fileSize: "2.1 MB"
      },
      {
        id: "res_4",
        title: "Bộ Flashcard Khái niệm & Thuật ngữ Trọng tâm",
        type: "flashcard",
        status: "available",
        conceptCount: 28,
        updatedAt: "2026-07-12",
        fileSize: "850 KB"
      },
      {
        id: "res_5",
        title: "Sổ tay Ghi chú Tóm tắt Công thức & Mô hình",
        type: "ghi chú",
        status: "available",
        conceptCount: 19,
        updatedAt: "2026-07-15",
        fileSize: "1.1 MB"
      },
      {
        id: "res_6",
        title: "Sơ đồ Tư duy Mối quan hệ Sản xuất - Lực lượng Sản xuất",
        type: "mindmap",
        status: "missing",
        conceptCount: 0,
        updatedAt: "—"
      }
    ];
    return defaultResources;
  },

  addResource(resource: Omit<LearningResource, "id" | "updatedAt">, subjectId?: string): LearningResource {
    const subId = subjectId || dbService.getActiveSubjectId();
    const current = this.getResources(subId);
    const newRes: LearningResource = {
      ...resource,
      id: `res_${Date.now()}`,
      updatedAt: TimeService.formatDateISO(TimeService.now())
    };
    const updated = [newRes, ...current];
    localStorage.setItem(RESOURCES_KEY(subId), JSON.stringify(updated));
    return newRes;
  },

  /**
   * Knowledge Health Audit
   */
  getKnowledgeHealth(): KnowledgeHealthItem[] {
    const stats = dbService.getStatistics();
    
    return chapters.map(ch => {
      const acc = stats.accuracyByChapter?.[ch.id];
      const solved = acc ? acc.total : 0;
      const coveragePercentage = solved > 0 ? Math.min(100, Math.round((solved / 10) * 100)) : 0;
      
      const missingConcepts: string[] = [];
      if (coveragePercentage < 100) {
        if (ch.id === 1) missingConcepts.push("Đối tượng & Phương pháp nghiên cứu");
        else if (ch.id === 2) missingConcepts.push("Hàng hóa dịch vụ & Giá trị thặng dư");
        else if (ch.id === 3) missingConcepts.push("Tích lũy tư bản & Tỷ suất lợi nhuận");
        else if (ch.id === 4) missingConcepts.push("Cạnh tranh độc quyền & Giá cả độc quyền");
        else if (ch.id === 5) missingConcepts.push("Kinh tế thị trường định hướng XHCN");
        else if (ch.id === 6) missingConcepts.push("Hội nhập kinh tế quốc tế & Cách mạng 4.0");
      }

      return {
        chapterId: ch.id,
        chapterTitle: ch.title,
        coveragePercentage,
        missingConcepts,
        totalConcepts: 10
      };
    });
  },

  /**
   * Version History Tracker
   */
  getKnowledgeVersions(): KnowledgeVersion[] {
    return [
      {
        version: "v3.1",
        date: "2026-07-20",
        addedConceptsCount: 12,
        removedDuplicatesCount: 3,
        coveragePercentage: 96,
        description: "Bổ sung Ma trận Blueprint Bloom level 4-5 & chuẩn hóa Evidence Mapping."
      },
      {
        version: "v2.0",
        date: "2026-07-10",
        addedConceptsCount: 18,
        removedDuplicatesCount: 5,
        coveragePercentage: 88,
        description: "Cập nhật Giáo trình tái bản 2026 & Tự động phát hiện khái niệm trùng lặp."
      },
      {
        version: "v1.0",
        date: "2026-06-15",
        addedConceptsCount: 45,
        removedDuplicatesCount: 0,
        coveragePercentage: 70,
        description: "Khởi tạo Knowledge Graph ban đầu cho môn học."
      }
    ];
  },

  /**
   * Git-like Learning Log Timeline
   */
  getLearningTimeline(): LearningLogEntry[] {
    const history = dbService.getHistory();
    const timeline: LearningLogEntry[] = [];

    if (history.length > 0) {
      history.slice(-8).reverse().forEach(h => {
        timeline.push({
          id: `log_${h.id}`,
          date: TimeService.formatDate(h.startTime),
          type: h.examType === "adaptive" ? "Adaptive" : h.examType === "ai-smart" ? "Mock Exam" : "Review",
          title: `Thực hiện bài thi ${h.examType}`,
          detail: `Đã làm ${h.questions?.length || 0} câu hỏi trong ${Math.round(h.timeSpent / 60)} phút.`,
          score: `${h.score}/${h.questions?.length || 0}`
        });
      });
    }

    // Default milestones if history is short
    if (timeline.length < 4) {
      timeline.push(
        { id: "log_def_1", date: "2026-07-18", type: "Mastered", title: "Mastered Quy luật Giá trị", detail: "Chỉ số ghi nhớ đạt 94% qua 3 lần kiểm tra lặp lại." },
        { id: "log_def_2", date: "2026-07-16", type: "Retention", title: "Củng cố Spaced Repetition", detail: "Xem lại 5 câu hỏi hay nhầm lẫn trong Sổ tay." }
      );
    }

    return timeline;
  },

  /**
   * Study Snapshots (Weekly evolution rewinds)
   */
  getStudySnapshots(): StudySnapshot[] {
    const stats = dbService.getStatistics();
    const totalSolved = stats.totalSolved || 0;
    const currentAccuracy = totalSolved > 0 ? Math.round((stats.totalCorrect / totalSolved) * 100) : 78;

    return [
      { weekLabel: "Tuần 1", date: "2026-07-01", masteryPct: 32, forecastScore: 6.2, debtCount: 14, solvedQuestions: Math.round(totalSolved * 0.2) },
      { weekLabel: "Tuần 2", date: "2026-07-08", masteryPct: 51, forecastScore: 7.1, debtCount: 9, solvedQuestions: Math.round(totalSolved * 0.5) },
      { weekLabel: "Tuần 3", date: "2026-07-15", masteryPct: 67, forecastScore: 7.8, debtCount: 5, solvedQuestions: Math.round(totalSolved * 0.8) },
      { weekLabel: "Tuần 4 (Hiện tại)", date: "2026-07-21", masteryPct: currentAccuracy, forecastScore: 8.3, debtCount: Object.keys(stats.incorrectQuestionHistory || {}).length, solvedQuestions: totalSolved }
    ];
  },

  /**
   * Session Recovery (Save/Detect/Resume)
   */
  getUnfinishedSession(): ExamAttempt | null {
    // Dọn nốt phiên treo ở key cũ dùng chung (di sản trước khi tách theo môn).
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LEGACY_UNFINISHED_KEY);
    }
    const raw = localStorage.getItem(UNFINISHED_SESSION_KEY());
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.isSubmitted) return null;
      // Nếu bài này đã có bản đã nộp trong lịch sử thì coi như đã hoàn thành, không hiện lại.
      const submittedBefore = dbService.getHistory().some(h => h && h.id === parsed.id && h.isSubmitted);
      if (submittedBefore) {
        localStorage.removeItem(UNFINISHED_SESSION_KEY());
        return null;
      }
      return parsed;
    } catch {}
    return null;
  },

  saveUnfinishedSession(session: ExamAttempt): void {
    if (!session.isSubmitted) {
      localStorage.setItem(UNFINISHED_SESSION_KEY(), JSON.stringify(session));
    } else {
      localStorage.removeItem(UNFINISHED_SESSION_KEY());
    }
  },

  clearUnfinishedSession(): void {
    localStorage.removeItem(UNFINISHED_SESSION_KEY());
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LEGACY_UNFINISHED_KEY);
    }
  },

  /**
   * Chống lặp câu cũ: hàng đợi id câu vừa ra gần đây (theo môn).
   * Các lượt tạo đề sẽ đẩy những câu này xuống cuối để ưu tiên câu mới hơn.
   */
  getRecentlyServedQuestionIds(): number[] {
    const raw = localStorage.getItem(RECENT_SERVED_KEY());
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((n: any) => typeof n === "number") : [];
    } catch {
      return [];
    }
  },

  recordServedQuestionIds(ids: number[]): void {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const prev = this.getRecentlyServedQuestionIds();
    // Câu mới ra đưa lên đầu; loại trùng; cắt theo hạn mức.
    const merged = [...ids, ...prev.filter(id => !ids.includes(id))].slice(0, RECENT_SERVED_LIMIT);
    localStorage.setItem(RECENT_SERVED_KEY(), JSON.stringify(merged));
  },

  /**
   * Subject Archiving Manager
   */
  getArchivedSubjectIds(): string[] {
    const raw = localStorage.getItem(ARCHIVED_SUBJECTS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  toggleSubjectArchive(subjectId: string): boolean {
    const archived = this.getArchivedSubjectIds();
    const isArchived = archived.includes(subjectId);
    let updated: string[];
    if (isArchived) {
      updated = archived.filter(id => id !== subjectId);
    } else {
      updated = [...archived, subjectId];
    }
    localStorage.setItem(ARCHIVED_SUBJECTS_KEY, JSON.stringify(updated));
    return !isArchived;
  },

  /**
   * App Settings Manager
   */
  getSettings(): AppSettings {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return {
      focusMode: false,
      keyboardShortcuts: true,
      animations: true,
      autoSaveSession: true,
      soundEffects: true,
      dailyReminderTime: "20:00"
    };
  },

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  /**
   * Backup & Restore System Data
   */
  exportBackupData(): string {
    const backupObj = {
      version: "2026.1",
      timestamp: TimeService.now().toISOString(),
      activeSubjectId: dbService.getActiveSubjectId(),
      history: dbService.getHistory(),
      statistics: dbService.getStatistics(),
      userSettings: dbService.getSettings(),
      appSettings: this.getSettings(),
      subjectGoal: dbService.getSubjectGoal(),
      resources: this.getResources()
    };
    return JSON.stringify(backupObj, null, 2);
  },

  importBackupData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.history) dbService.saveHistory(data.history);
      if (data.appSettings) this.saveSettings(data.appSettings);
      if (data.subjectGoal) dbService.saveSubjectGoal(data.subjectGoal);
      dbService.recomputeStatistics();
      return true;
    } catch {
      return false;
    }
  }
};
