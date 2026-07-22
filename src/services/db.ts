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

import { questions as defaultQuestions } from "../data/questions";
import { topics as defaultTopics } from "../data/topics";
import { chapters as defaultChapters } from "../data/chapters";
import { cbQuestions, cbTopics, cbChapters } from "../data/customer_behavior";
import { cbGeneratedQuestions } from "../data/customer_behavior_generated";
import { cbKnowledgeGraph } from "../data/customer_behavior_kb";
import { TimeService } from "./time";
import { shuffleQuestionOptions } from "./optionShuffle";
import { ExamAttempt, Statistics, UserSettings, DashboardOverview, Chapter, Topic, Question, SubjectGoal } from "../types";

export interface Subject {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
}

// Pre-computed mutable arrays and maps for O(1) high-speed query indexing
export const questions: Question[] = [];
export const topics: Topic[] = [];
export const chapters: Chapter[] = [];
export const questionMap = new Map<number, Question>();
export const topicMap = new Map<string, Topic>();
export const chapterMap = new Map<number, Chapter>();

// Keys
const SETTINGS_KEY = "poly_econ_settings";
let activeSubjectId = localStorage.getItem("poly_econ_active_subject_id") || "customer_behavior";
// Môn Kinh tế chính trị đã đóng: nếu trạng thái cũ (kể cả đã đồng bộ từ cloud) đang chọn
// môn này thì tự chuyển về Hành vi khách hàng để không kẹt ở môn không còn hiển thị.
if (activeSubjectId === "poli_econ") activeSubjectId = "customer_behavior";

const HISTORY_KEY = () => `poly_econ_history_${activeSubjectId}`;
const STATS_KEY = () => `poly_econ_statistics_${activeSubjectId}`;

const defaultSettings: UserSettings = {
  theme: "light",
  fontSize: "base",
  enableAnimations: true,
  enableTimer: true,
  enableSound: true,
  autoSaveProgress: true
};

const defaultStats: Statistics = {
  totalSolved: 0,
  totalCorrect: 0,
  totalTimeSpent: 0,
  studyStreak: 0,
  accuracyByChapter: {},
  accuracyByTopic: {},
  incorrectQuestionHistory: {},
  bookmarks: [],
  flags: []
};

// Initialize statistics structure for all chapters/topics
const initStatsStructure = (): Statistics => {
  const stats: Statistics = { 
    ...defaultStats, 
    accuracyByChapter: {}, 
    accuracyByTopic: {}, 
    incorrectQuestionHistory: {},
    conceptMastery: {}
  };
  
  chapters.forEach(c => {
    stats.accuracyByChapter[c.id] = { correct: 0, total: 0 };
  });
  
  const topicsSet = new Set(questions.map(q => q.topicId));
  topicsSet.forEach(tId => {
    stats.accuracyByTopic[tId] = { correct: 0, total: 0 };
  });

  return stats;
};

// Load subject data in-place
export function loadSubject(subjectId: string) {
  questions.length = 0;
  topics.length = 0;
  chapters.length = 0;

  questionMap.clear();
  topicMap.clear();
  chapterMap.clear();

  if (subjectId === "customer_behavior") {
    questions.push(...cbQuestions);
    questions.push(...cbGeneratedQuestions);
    topics.push(...cbTopics);
    chapters.push(...cbChapters);

    // load overrides/AI generated questions
    const overrideKey = `poly_econ_overrides_questions_${subjectId}`;
    const raw = localStorage.getItem(overrideKey);
    if (raw) {
      try {
        const parsed: Question[] = JSON.parse(raw);
        // Avoid duplicate IDs
        parsed.forEach(q => {
          if (!questions.some(existing => existing.id === q.id)) {
            questions.push(q);
          }
        });
      } catch {}
    }
  } else if (subjectId === "poli_econ") {
    questions.push(...defaultQuestions);
    topics.push(...defaultTopics);
    chapters.push(...defaultChapters);

    // load overrides/AI generated questions
    const overrideKey = `poly_econ_overrides_questions_${subjectId}`;
    const raw = localStorage.getItem(overrideKey);
    if (raw) {
      try {
        const parsed: Question[] = JSON.parse(raw);
        parsed.forEach(q => {
          if (!questions.some(existing => existing.id === q.id)) {
            questions.push(q);
          }
        });
      } catch {}
    }
  } else {
    // Custom subject
    const storedQ = localStorage.getItem(`poly_econ_custom_questions_${subjectId}`);
    const storedT = localStorage.getItem(`poly_econ_custom_topics_${subjectId}`);
    const storedC = localStorage.getItem(`poly_econ_custom_chapters_${subjectId}`);

    if (storedC) {
      try { chapters.push(...JSON.parse(storedC)); } catch {}
    } else {
      chapters.push({ id: 1, code: "CH1", title: "Chương 1: Tổng quan", description: "Nội dung học tập tổng quan." });
    }

    if (storedT) {
      try { topics.push(...JSON.parse(storedT)); } catch {}
    } else {
      topics.push({ id: subjectId + "_T1.1", chapterId: 1, title: "Chủ đề 1.1: Giới thiệu", description: "Khái quát nội dung môn học." });
    }

    if (storedQ) {
      try { questions.push(...JSON.parse(storedQ)); } catch {}
    }
  }

  // Populate maps.
  // questionMap giữ bản ĐÃ TRỘN thứ tự phương án (tất định theo id) để xóa thiên lệch vị trí đáp án;
  // mảng `questions` giữ nguyên bản gốc để việc lưu/override/ngân hàng câu hỏi không bị trộn lồng nhiều lần.
  questions.forEach(q => questionMap.set(q.id, shuffleQuestionOptions(q)));
  topics.forEach(t => topicMap.set(t.id, t));
  chapters.forEach(c => chapterMap.set(c.id, c));
}

// Initial subject load
loadSubject(activeSubjectId);

export const dbService = {
  getSubjects(): Subject[] {
    // Môn Kinh tế chính trị Mác - Lênin đã đóng (đã thi xong) nên gỡ khỏi danh sách hiển thị.
    // Dữ liệu môn này vẫn còn trong code nhưng không được chọn nữa.
    const defaultSubjects: Subject[] = [
      {
        id: "customer_behavior",
        name: "Hành vi Khách hàng",
        description: "Tìm hiểu hành vi người tiêu dùng và khách hàng tổ chức dưới góc độ văn hóa, xã hội, cá nhân và tâm lý học kích thích."
      }
    ];

    const raw = localStorage.getItem("poly_econ_custom_subjects");
    if (!raw) return defaultSubjects;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return [...defaultSubjects, ...parsed];
      }
      return defaultSubjects;
    } catch {
      return defaultSubjects;
    }
  },

  addSubject(name: string, description: string): Subject {
    const id = "custom_" + Date.now();
    const newSubject: Subject = {
      id,
      name,
      description,
      isCustom: true
    };
    
    const raw = localStorage.getItem("poly_econ_custom_subjects") || "[]";
    try {
      const customOnly: Subject[] = JSON.parse(raw);
      customOnly.push(newSubject);
      localStorage.setItem("poly_econ_custom_subjects", JSON.stringify(customOnly));
    } catch {
      localStorage.setItem("poly_econ_custom_subjects", JSON.stringify([newSubject]));
    }

    // Initialize custom subject data
    const initialChapters: Chapter[] = [
      { id: 1, code: "CH1", title: "Chương 1: Tổng quan", description: "Các kiến thức cơ bản." }
    ];
    const initialTopics: Topic[] = [
      { id: id + "_T1.1", chapterId: 1, title: "Chủ đề 1.1: Nhập môn", description: "Tổng quan chung về môn học." }
    ];
    const initialQuestions: Question[] = [];

    localStorage.setItem(`poly_econ_custom_questions_${id}`, JSON.stringify(initialQuestions));
    localStorage.setItem(`poly_econ_custom_topics_${id}`, JSON.stringify(initialTopics));
    localStorage.setItem(`poly_econ_custom_chapters_${id}`, JSON.stringify(initialChapters));

    return newSubject;
  },

  deleteSubject(id: string): void {
    if (id === "poli_econ" || id === "customer_behavior") return;
    
    const raw = localStorage.getItem("poly_econ_custom_subjects") || "[]";
    try {
      const customOnly: Subject[] = JSON.parse(raw);
      const updated = customOnly.filter(s => s.id !== id);
      localStorage.setItem("poly_econ_custom_subjects", JSON.stringify(updated));
    } catch {}

    localStorage.removeItem(`poly_econ_custom_questions_${id}`);
    localStorage.removeItem(`poly_econ_custom_topics_${id}`);
    localStorage.removeItem(`poly_econ_custom_chapters_${id}`);
    localStorage.removeItem(`poly_econ_history_${id}`);
    localStorage.removeItem(`poly_econ_statistics_${id}`);

    if (activeSubjectId === id) {
      this.setActiveSubjectId("customer_behavior");
    }
  },

  getActiveSubjectId(): string {
    return activeSubjectId;
  },

  getActiveSubjectName(): string {
    const subjects = this.getSubjects();
    const currentSubject = subjects.find(s => s.id === activeSubjectId);
    return currentSubject ? currentSubject.name : "Hành vi Khách hàng";
  },

  addCustomSubject(id: string, name: string, description: string): Subject {
    const newSubject: Subject = {
      id,
      name,
      description,
      isCustom: true
    };
    
    const raw = localStorage.getItem("poly_econ_custom_subjects") || "[]";
    try {
      const customOnly: Subject[] = JSON.parse(raw);
      if (!customOnly.some(s => s.id === id)) {
        customOnly.push(newSubject);
        localStorage.setItem("poly_econ_custom_subjects", JSON.stringify(customOnly));
      }
    } catch {
      localStorage.setItem("poly_econ_custom_subjects", JSON.stringify([newSubject]));
    }

    if (!localStorage.getItem(`poly_econ_custom_chapters_${id}`)) {
      const initialChapters: Chapter[] = [
        { id: 1, code: "CH1", title: "Chương 1: Tổng quan", description: "Các kiến thức cơ bản." }
      ];
      localStorage.setItem(`poly_econ_custom_chapters_${id}`, JSON.stringify(initialChapters));
    }
    if (!localStorage.getItem(`poly_econ_custom_topics_${id}`)) {
      const initialTopics: Topic[] = [
        { id: id + "_T1.1", chapterId: 1, title: "Chủ đề 1.1: Nhập môn", description: "Tổng quan chung về môn học." }
      ];
      localStorage.setItem(`poly_econ_custom_topics_${id}`, JSON.stringify(initialTopics));
    }
    if (!localStorage.getItem(`poly_econ_custom_questions_${id}`)) {
      const initialQuestions: Question[] = [];
      localStorage.setItem(`poly_econ_custom_questions_${id}`, JSON.stringify(initialQuestions));
    }

    return newSubject;
  },

  setActiveSubjectId(id: string): void {
    activeSubjectId = id;
    localStorage.setItem("poly_econ_active_subject_id", id);
    loadSubject(id);
    this.recomputeStatistics();
  },

  addQuestionsToSubject(subjectId: string, newQs: Question[], newChapters?: Chapter[], newTopics?: Topic[]): void {
    if (newChapters && newChapters.length > 0) {
      if (subjectId !== "poli_econ" && subjectId !== "customer_behavior") {
        const key = `poly_econ_custom_chapters_${subjectId}`;
        const raw = localStorage.getItem(key) || "[]";
        try {
          const customChapters: Chapter[] = JSON.parse(raw);
          newChapters.forEach(nc => {
            if (!customChapters.some(c => c.id === nc.id)) {
              customChapters.push(nc);
            }
          });
          localStorage.setItem(key, JSON.stringify(customChapters));
        } catch {}
      }
    }

    if (newTopics && newTopics.length > 0) {
      if (subjectId !== "poli_econ" && subjectId !== "customer_behavior") {
        const key = `poly_econ_custom_topics_${subjectId}`;
        const raw = localStorage.getItem(key) || "[]";
        try {
          const customTopics: Topic[] = JSON.parse(raw);
          newTopics.forEach(nt => {
            if (!customTopics.some(t => t.id === nt.id)) {
              customTopics.push(nt);
            }
          });
          localStorage.setItem(key, JSON.stringify(customTopics));
        } catch {}
      }
    }

    if (subjectId === "poli_econ" || subjectId === "customer_behavior") {
      const overrideKey = `poly_econ_overrides_questions_${subjectId}`;
      const raw = localStorage.getItem(overrideKey) || "[]";
      try {
        const overrides: Question[] = JSON.parse(raw);
        overrides.push(...newQs);
        localStorage.setItem(overrideKey, JSON.stringify(overrides));
      } catch (e) {
        localStorage.setItem(overrideKey, JSON.stringify(newQs));
      }
    } else {
      const key = `poly_econ_custom_questions_${subjectId}`;
      const raw = localStorage.getItem(key) || "[]";
      try {
        const customQs: Question[] = JSON.parse(raw);
        customQs.push(...newQs);
        localStorage.setItem(key, JSON.stringify(customQs));
      } catch (e) {
        localStorage.setItem(key, JSON.stringify(newQs));
      }
    }
    
    // Reload if active
    if (activeSubjectId === subjectId) {
      loadSubject(subjectId);
      this.recomputeStatistics();
    }
  },

  getSettings(): UserSettings {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    try {
      return { ...defaultSettings, ...JSON.parse(raw) };
    } catch {
      return defaultSettings;
    }
  },

  saveSettings(settings: UserSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (settings.theme === "dark" || (settings.theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },

  getQuestions(): Question[] {
    return questions;
  },

  getHistory(): ExamAttempt[] {
    const raw = localStorage.getItem(HISTORY_KEY());
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is ExamAttempt => 
          !!item && 
          typeof item === "object" && 
          typeof item.id === "string"
        );
      }
      return [];
    } catch {
      return [];
    }
  },

  saveHistory(history: ExamAttempt[]): void {
    localStorage.setItem(HISTORY_KEY(), JSON.stringify(history));
    this.recomputeStatistics();
  },

  _submitHooks: [] as Array<(attempt: ExamAttempt) => void>,
  
  addOnSubmit(hook: (attempt: ExamAttempt) => void): void {
    this._submitHooks.push(hook);
  },

  getQuestionMap() {
    return questionMap;
  },

  saveAttempt(attempt: ExamAttempt): void {
    const history = this.getHistory();
    const existingIndex = history.findIndex(h => h.id === attempt.id);
    if (existingIndex >= 0) {
      history[existingIndex] = attempt;
    } else {
      history.push(attempt);
    }
    localStorage.setItem(HISTORY_KEY(), JSON.stringify(history));

    if (attempt.isSubmitted) {
      if (typeof window !== "undefined" && window.localStorage) {
        // Xóa cả key cũ dùng chung lẫn key theo môn để phiên đã nộp không hiện lại "chưa hoàn thành".
        window.localStorage.removeItem("poly_econ_unfinished_session");
        window.localStorage.removeItem(`poly_econ_unfinished_session_${activeSubjectId}`);
      }
      this.recomputeStatistics();
      this._submitHooks.forEach(hook => {
        try { hook(attempt); } catch (e) { console.error("Error in dbSubmitHook:", e); }
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("poly_econ_exam_submitted", { detail: attempt }));
      }
    }
  },

  getStatistics(): Statistics {
    const raw = localStorage.getItem(STATS_KEY());
    if (!raw) {
      const stats = initStatsStructure();
      this.saveStatistics(stats);
      return stats;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.accuracyByChapter) parsed.accuracyByChapter = {};
      if (!parsed.accuracyByTopic) parsed.accuracyByTopic = {};
      if (!parsed.incorrectQuestionHistory) parsed.incorrectQuestionHistory = {};
      if (!parsed.bookmarks) parsed.bookmarks = [];
      if (!parsed.flags) parsed.flags = [];
      return parsed;
    } catch {
      const stats = initStatsStructure();
      this.saveStatistics(stats);
      return stats;
    }
  },

  saveStatistics(stats: Statistics): void {
    localStorage.setItem(STATS_KEY(), JSON.stringify(stats));
  },

  boostConceptMastery(conceptId: string, amount: number = 10): void {
    const stats = this.getStatistics();
    if (!stats.conceptMastery) stats.conceptMastery = {};
    const current = stats.conceptMastery[conceptId] || 0;
    stats.conceptMastery[conceptId] = Math.min(100, current + amount);
    this.saveStatistics(stats);
  },

  toggleBookmark(questionId: number): boolean {
    const stats = this.getStatistics();
    const index = stats.bookmarks.indexOf(questionId);
    let bookmarked = false;
    if (index >= 0) {
      stats.bookmarks.splice(index, 1);
    } else {
      stats.bookmarks.push(questionId);
      bookmarked = true;
    }
    this.saveStatistics(stats);
    return bookmarked;
  },

  toggleFlag(questionId: number): boolean {
    const stats = this.getStatistics();
    const index = stats.flags.indexOf(questionId);
    let flagged = false;
    if (index >= 0) {
      stats.flags.splice(index, 1);
    } else {
      stats.flags.push(questionId);
      flagged = true;
    }
    this.saveStatistics(stats);
    return flagged;
  },

  recomputeStatistics(): void {
    const history = this.getHistory().filter(h => h && h.isSubmitted);
    const stats = initStatsStructure();
    
    const currentStats = this.getStatistics();
    stats.bookmarks = currentStats.bookmarks || [];
    stats.flags = currentStats.flags || [];

    let totalSolvedSet = new Set<number>();
    let totalCorrectSet = new Set<number>();
    let totalTime = 0;

    const studyDates = new Set<string>();

    // Sort history chronologically (oldest first)
    const sortedHistory = [...history].sort((a, b) => {
      const tA = TimeService.parseToDate(a.startTime || "2000-01-01").getTime();
      const tB = TimeService.parseToDate(b.startTime || "2000-01-01").getTime();
      return tA - tB;
    });

    sortedHistory.forEach(attempt => {
      if (!attempt) return;
      totalTime += attempt.timeSpent || 0;
      
      const startTimeStr = attempt.startTime || TimeService.now().toISOString();
      const dateStr = TimeService.formatDateISO(startTimeStr);
      studyDates.add(dateStr);

      const answers = attempt.answers || {};
      // Chỉ tính các câu thực sự thuộc đề của lượt làm này. Tránh đếm "đáp án mồ côi"
      // (câu từng bị thay ra khỏi đề bởi cơ chế đảo câu cũ) làm sai lệch điểm và thống kê.
      const questionIdSet = Array.isArray(attempt.questions) ? new Set(attempt.questions) : null;
      Object.entries(answers).forEach(([qIdStr, answer]) => {
        const qId = parseInt(qIdStr);
        if (questionIdSet && !questionIdSet.has(qId)) return;
        const q = questionMap.get(qId);
        if (!q) return;

        totalSolvedSet.add(qId);
        const isCorrect = q.correctAnswer === answer;

        if (isCorrect) {
          totalCorrectSet.add(qId);
          delete stats.incorrectQuestionHistory[qId];
        } else {
          stats.incorrectQuestionHistory[qId] = (stats.incorrectQuestionHistory[qId] || 0) + 1;
        }

        if (!stats.accuracyByChapter[q.chapterId]) {
          stats.accuracyByChapter[q.chapterId] = { correct: 0, total: 0 };
        }
        stats.accuracyByChapter[q.chapterId].total++;
        if (isCorrect) stats.accuracyByChapter[q.chapterId].correct++;

        if (!stats.accuracyByTopic[q.topicId]) {
          stats.accuracyByTopic[q.topicId] = { correct: 0, total: 0 };
        }
        stats.accuracyByTopic[q.topicId].total++;
        if (isCorrect) stats.accuracyByTopic[q.topicId].correct++;
      });
    });

    stats.totalSolved = totalSolvedSet.size;
    stats.totalCorrect = totalCorrectSet.size;
    stats.totalTimeSpent = totalTime;

    // Compute concept masteries dynamically based on active subject
    stats.conceptMastery = {};
    if (activeSubjectId === "customer_behavior") {
      cbKnowledgeGraph.forEach(node => {
        // Find questions that belong to this concept
        const conceptQs = questions.filter(q => 
          q.topicId === node.topic || 
          q.knowledgeMapping?.some(tag => node.concept.toLowerCase().includes(tag.toLowerCase()) || tag.toLowerCase().includes(node.concept.toLowerCase()))
        );
        const total = conceptQs.length;
        if (total > 0) {
          const correct = conceptQs.filter(q => totalCorrectSet.has(q.id)).length;
          stats.conceptMastery![node.id] = Math.round((correct / total) * 100);
        } else {
          stats.conceptMastery![node.id] = 0;
        }
      });
    } else {
      // Find all unique tags for other subjects
      const uniqueTags = Array.from(new Set(questions.flatMap(q => q.knowledgeMapping || [])));
      uniqueTags.forEach(tag => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        const conceptQs = questions.filter(q => q.knowledgeMapping?.includes(trimmed));
        const total = conceptQs.length;
        if (total > 0) {
          const correct = conceptQs.filter(q => totalCorrectSet.has(q.id)).length;
          stats.conceptMastery![trimmed] = Math.round((correct / total) * 100);
        } else {
          stats.conceptMastery![trimmed] = 0;
        }
      });
    }

    if (studyDates.size > 0) {
      const sortedDates = Array.from(studyDates).sort((a, b) => b.localeCompare(a));

      let streak = 0;
      const todayStr = TimeService.today();
      const yesterdayStr = TimeService.formatDateISO(TimeService.parseToDate(TimeService.now().getTime() - 24 * 60 * 60 * 1000));

      const mostRecent = sortedDates[0];
      if (mostRecent === todayStr || mostRecent === yesterdayStr) {
        streak = 1;
        let lastDateStr = mostRecent;

        for (let i = 1; i < sortedDates.length; i++) {
          const checkDateStr = sortedDates[i];
          const diffDays = TimeService.daysBetween(lastDateStr, checkDateStr);

          if (diffDays === 1) {
            streak++;
            lastDateStr = checkDateStr;
          } else if (diffDays > 1) {
            break;
          }
        }
      }
      stats.studyStreak = streak;
      if (sortedDates.length > 0 && sortedDates[0]) {
        const mostRecentAttempt = history
          .filter(a => a && a.startTime && TimeService.formatDateISO(a.startTime) === sortedDates[0])
          .sort((a, b) => TimeService.parseToDate(b.startTime!).getTime() - TimeService.parseToDate(a.startTime!).getTime())[0];
        stats.lastStudyDate = mostRecentAttempt?.startTime || TimeService.now().toISOString();
      }
    } else {
      stats.studyStreak = 0;
    }

    this.saveStatistics(stats);
  },

  getDashboardOverview(): DashboardOverview {
    const stats = this.getStatistics();
    const history = this.getHistory();
    const totalQuestions = questions.length;
    const completedCount = stats.totalCorrect;
    
    const completionRate = totalQuestions > 0 ? Math.round((completedCount / totalQuestions) * 100) : 0;
    const progress = totalQuestions > 0 ? Math.round((stats.totalSolved / totalQuestions) * 100) : 0;
    const lastExam = history.length > 0 ? history[history.length - 1] : undefined;

    const subjects = this.getSubjects();
    const currentSubject = subjects.find(s => s.id === activeSubjectId) || subjects[0];

    return {
      subjectName: currentSubject.name,
      totalQuestions,
      totalChapters: chapters.length,
      totalTopics: topics.length,
      completionRate,
      progress,
      lastExam
    };
  },

  getSubjectGoal(subjectId?: string): SubjectGoal {
    const subId = subjectId || activeSubjectId;
    const key = `poly_econ_goal_${subId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    // Default fallback goal
    const defaultDate = TimeService.formatDateISO(TimeService.parseToDate(TimeService.now().getTime() + 14 * 24 * 60 * 60 * 1000));
    return {
      subjectId: subId,
      targetScore: 8.5,
      examDate: defaultDate,
      dailyStudyMinutes: 45,
      priority: "High",
      updatedAt: TimeService.now().toISOString()
    };
  },

  saveSubjectGoal(goal: SubjectGoal): void {
    const key = `poly_econ_goal_${goal.subjectId || activeSubjectId}`;
    localStorage.setItem(key, JSON.stringify(goal));
  },

  deleteHistoryAttempt(attemptId: string): void {
    const history = this.getHistory();
    const filtered = history.filter(h => h.id !== attemptId);
    this.saveHistory(filtered);
    this.recomputeStatistics();
  },

  duplicateAttempt(attemptId: string): ExamAttempt | null {
    const history = this.getHistory();
    const found = history.find(h => h.id === attemptId);
    if (!found) return null;

    const newAttempt: ExamAttempt = {
      ...found,
      id: `exam_dup_${Date.now()}`,
      startTime: TimeService.now().toISOString(),
      endTime: undefined,
      isSubmitted: false,
      answers: {},
      score: 0,
      timeSpent: 0
    };

    history.push(newAttempt);
    this.saveHistory(history);
    return newAttempt;
  },

  clearAllHistory(): void {
    localStorage.removeItem(HISTORY_KEY());
    localStorage.removeItem(STATS_KEY());
    // Dọn luôn phiên chưa hoàn thành (cả key cũ dùng chung lẫn key theo môn) để không còn
    // banner "phiên chưa hoàn thành" tồn đọng sau khi làm mới tiến trình.
    localStorage.removeItem("poly_econ_unfinished_session");
    localStorage.removeItem(`poly_econ_unfinished_session_${activeSubjectId}`);
    this.recomputeStatistics();
  },

  resetProgress(): void {
    localStorage.removeItem(HISTORY_KEY());
    localStorage.removeItem(STATS_KEY());
    this.getStatistics();
  }
};

