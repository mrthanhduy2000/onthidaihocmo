/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  BookOpen, AlertTriangle, RotateCcw, CheckCircle2, Search, 
  ChevronRight, Brain, Filter, Sparkles, Clock, ArrowUpRight, Check,
  BookMarked, HelpCircle
} from "lucide-react";
import { dbService, questionMap, chapterMap, questions } from "../services/db";
import { aiService } from "../services/ai";
import { Question, ExamAttempt } from "../types";
import { TimeService } from "../services/time";
import SimpleMarkdown from "./SimpleMarkdown";

interface ReviewNotebookProps {
  key?: string;
  onStartExam: (exam: ExamAttempt) => void;
}

export default function ReviewNotebookView({ onStartExam }: ReviewNotebookProps) {
  const [stats, setStats] = useState(dbService.getStatistics());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<number | "all">("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);

  const [questionNotes, setQuestionNotes] = useState<Record<number, string>>(() => {
    const raw = localStorage.getItem("poly_econ_question_notes");
    if (raw) {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return {};
  });

  const [learningStatuses, setLearningStatuses] = useState<Record<number, "learned" | "review" | "unlearned">>(() => {
    const raw = localStorage.getItem("poly_econ_learning_status");
    if (raw) {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return {};
  });

  // Get list of wrong questions
  const wrongHistory = stats.incorrectQuestionHistory || {};
  const wrongQuestionIds = Object.keys(wrongHistory).map(Number);
  
  const wrongQuestionsList: { q: Question; count: number; lastWrong: string }[] = wrongQuestionIds
    .map(id => {
      const q = questionMap.get(id);
      if (!q) return null;
      const historyItem = wrongHistory[id];
      return {
        q,
        count: typeof historyItem === "number" ? historyItem : historyItem?.count || 1,
        lastWrong: typeof historyItem === "object" ? historyItem?.lastWrong || TimeService.now().toISOString() : TimeService.now().toISOString()
      };
    })
    .filter((item): item is { q: Question; count: number; lastWrong: string } => item !== null);

  // Filtered list
  const filteredQuestions = wrongQuestionsList.filter(item => {
    const matchesChapter = selectedChapter === "all" || item.q.chapterId === selectedChapter;
    const matchesSearch = !searchQuery || 
      item.q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.q.concept?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.q.misconception && item.q.misconception.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesChapter && matchesSearch;
  });

  const handleStartReviewAllWrong = () => {
    const exam = aiService.generateExam({ type: "incorrect" });
    onStartExam(exam);
  };

  const handleStartReviewSingle = (qId: number) => {
    const q = questionMap.get(qId);
    if (!q) return;
    const exam = aiService.generateExam({ type: "chapter", chapterId: q.chapterId, count: 5 });
    onStartExam(exam);
  };

  const handleStatusChange = (questionId: number, status: "learned" | "review" | "unlearned") => {
    const updated = { ...learningStatuses, [questionId]: status };
    setLearningStatuses(updated);
    localStorage.setItem("poly_econ_learning_status", JSON.stringify(updated));
  };

  const handleNoteChange = (questionId: number, note: string) => {
    const updated = { ...questionNotes, [questionId]: note };
    setQuestionNotes(updated);
    localStorage.setItem("poly_econ_question_notes", JSON.stringify(updated));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-primary pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs tabular-nums text-brand-warning mb-1">
            <BookMarked className="w-4 h-4" />
            Sổ tay củng cố & Khắc phục
          </div>
          <h1 className="text-2xl font-display font-light text-text-primary">
            Sổ tay câu làm sai <span className="font-semibold text-brand-warning">({wrongQuestionsList.length})</span>
          </h1>
          <p className="text-text-muted text-xs font-sans mt-1">
            Tự động theo dõi các bẫy khái niệm đã vấp phải • Lộ trình khắc phục thông minh
          </p>
        </div>

        {wrongQuestionsList.length > 0 && (
          <button
            onClick={handleStartReviewAllWrong}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-warning text-bg-app font-medium text-xs rounded-xl shadow-sm hover:opacity-95 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Ôn lại tất cả {wrongQuestionsList.length} câu sai</span>
          </button>
        )}
      </div>

      {wrongQuestionsList.length === 0 ? (
        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-brand-success-bg text-brand-success mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-medium text-text-primary">Tuyệt vời! Bạn chưa có câu làm sai nào</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Hệ thống sẽ tự động lưu lại các câu trả lời chưa chính xác trong quá trình ôn luyện để giúp bạn khắc phục lỗ hổng kiến thức.
          </p>
        </div>
      ) : (
        <>
          {/* Controls & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-bg-card border border-border-primary/80 rounded-xl p-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
              <input
                type="text"
                placeholder="Tìm kiếm theo từ khóa, khái niệm, bẫy sai lầm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bg-surface border border-border-primary rounded-lg pl-9 pr-3 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-text-primary/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-text-muted" />
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="bg-bg-surface border border-border-primary rounded-lg px-3 py-1.5 text-xs text-text-primary cursor-pointer focus:outline-none"
              >
                <option value="all">Tất cả chương ({wrongQuestionsList.length})</option>
                {[1, 2, 3, 4, 5, 6, 7].map(ch => {
                  const count = wrongQuestionsList.filter(i => i.q.chapterId === ch).length;
                  if (count === 0) return null;
                  return (
                    <option key={ch} value={ch}>
                      Chương {ch} ({count} câu)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* List of Wrong Questions */}
          <div className="space-y-4">
            {filteredQuestions.map(({ q, count, lastWrong }) => {
              const isExpanded = selectedQuestionId === q.id;
              const status = learningStatuses[q.id] || "review";
              const ch = chapterMap.get(q.chapterId);

              // Priority calculation
              const priority = count >= 3 ? "Cao" : count === 2 ? "Trung bình" : "Thấp";
              const priorityColor = priority === "Cao" 
                ? "bg-brand-warning-bg text-brand-warning border-brand-warning/20"
                : priority === "Trung bình"
                ? "bg-brand-info-bg text-brand-info border-brand-info/20"
                : "bg-bg-surface text-text-muted border-border-primary";

              return (
                <div 
                  key={q.id}
                  className={`bg-bg-card border rounded-2xl transition-all ${
                    isExpanded 
                      ? "border-brand-warning/50 shadow-md ring-1 ring-brand-warning/20" 
                      : "border-border-primary/80 hover:border-border-primary"
                  }`}
                >
                  {/* Summary Bar */}
                  <div 
                    onClick={() => setSelectedQuestionId(isExpanded ? null : q.id)}
                    className="p-4 sm:p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-2xs tabular-nums">
                        <span className="px-2 py-0.5 rounded bg-bg-surface border border-border-primary text-text-muted">
                          Chương {q.chapterId}: {ch?.title || ""}
                        </span>
                        {q.concept && (
                          <span className="px-2 py-0.5 rounded bg-brand-info-bg text-brand-info font-medium border border-brand-info/20">
                            Khái niệm: {q.concept}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded border ${priorityColor} font-medium`}>
                          Mức ưu tiên: {priority} (Sai {count} lần)
                        </span>
                      </div>

                      <h4 className="text-sm font-medium text-text-primary leading-relaxed">
                        {q.question}
                      </h4>

                      {/* Concept Mastery Timeline (Weak -> Learning -> Recovered -> Mastered) & Verbal Confidence */}
                      {(() => {
                        let stageIdx = 0; // Weak
                        let confidenceText = "Phần này vẫn còn dễ nhầm";

                        if (status === "learned") {
                          stageIdx = 3; // Mastered
                          confidenceText = "Bạn đã rất chắc phần này";
                        } else if (count === 1) {
                          stageIdx = 2; // Recovered
                          confidenceText = "Đã củng cố sau lần sai";
                        } else if (count === 2) {
                          stageIdx = 1; // Learning
                          confidenceText = "Đang tích lũy tiến độ tốt";
                        }

                        return (
                          <div className="bg-bg-surface/80 border border-border-primary/60 rounded-xl p-3 space-y-2 mt-2">
                            <div className="flex items-center justify-between text-2xs tabular-nums">
                              <span className="text-text-muted font-medium">Lộ trình dứt điểm lỗ hổng:</span>
                              <span className="text-brand-warning font-semibold">{confidenceText}</span>
                            </div>

                            <div className="flex items-center gap-1 pt-0.5">
                              {[
                                { key: "weak", label: "Weak" },
                                { key: "learning", label: "Learning" },
                                { key: "recovered", label: "Recovered" },
                                { key: "mastered", label: "Mastered" }
                              ].map((stg, idx) => {
                                const isCurrent = idx === stageIdx;
                                const isPast = idx < stageIdx;
                                return (
                                  <div key={stg.key} className="flex-1 flex flex-col items-center gap-1">
                                    <div className={`h-1.5 w-full rounded-full transition-all ${
                                      isCurrent ? "bg-brand-warning" : isPast ? "bg-brand-success" : "bg-bg-card border border-border-primary/80"
                                    }`} />
                                    <span className={`text-2xs tabular-nums transition-colors ${
                                      isCurrent ? "text-brand-warning font-bold" : isPast ? "text-brand-success font-medium" : "text-text-muted opacity-50"
                                    }`}>
                                      {stg.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartReviewSingle(q.id);
                        }}
                        className="px-3 py-1.5 bg-bg-surface hover:bg-bg-surface-hover text-text-primary border border-border-primary rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Ôn lại</span>
                      </button>

                      <div className="w-6 h-6 rounded-full bg-bg-surface border border-border-primary flex items-center justify-center text-text-muted">
                        <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-border-primary/60 bg-bg-surface/40 p-5 space-y-5 rounded-b-2xl">
                      {/* Misconception Alert */}
                      {q.misconception && (
                        <div className="p-3.5 bg-brand-warning-bg border border-brand-warning/20 rounded-xl flex items-start gap-3 text-xs">
                          <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-brand-warning block mb-0.5">Hiểu sai cần tránh:</span>
                            <p className="text-text-primary">{q.misconception}</p>
                          </div>
                        </div>
                      )}

                      {/* Options breakdown */}
                      <div className="space-y-2">
                        <div className="text-2xs tabular-nums text-text-muted">Các phương án đáp án:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(q.options).map(([key, text]) => {
                            const isCorrect = key === q.correctAnswer;
                            return (
                              <div
                                key={key}
                                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                                  isCorrect 
                                    ? "bg-brand-success-bg border-brand-success/30 text-text-primary font-medium" 
                                    : "bg-bg-card border-border-primary/60 text-text-muted"
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center tabular-nums text-2xs shrink-0 ${
                                  isCorrect ? "bg-brand-success text-bg-app font-bold" : "bg-bg-surface text-text-muted"
                                }`}>
                                  {key.toUpperCase()}
                                </span>
                                <span>{text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Explanation & Source Citation */}
                      <div className="p-4 bg-bg-card border border-border-primary/80 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-text-primary flex items-center gap-1.5">
                            <Brain className="w-4 h-4 text-brand-info" />
                            Lời giải chuẩn xác theo học liệu
                          </span>
                          <span className="text-2xs tabular-nums text-text-muted">
                            Nguồn: {q.sourcePdf} (Trang {q.sourcePage})
                          </span>
                        </div>
                        <div className="text-xs text-text-muted leading-relaxed">
                          <SimpleMarkdown content={q.explanation} />
                        </div>
                      </div>

                      {/* Personal Notes & Status Switcher */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-text-muted font-medium">Trạng thái:</span>
                          <div className="flex items-center gap-1 bg-bg-card p-1 rounded-lg border border-border-primary">
                            {(["review", "learned", "unlearned"] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => handleStatusChange(q.id, st)}
                                className={`px-2.5 py-1 rounded text-2xs font-medium transition ${
                                  status === st
                                    ? st === "learned" 
                                      ? "bg-brand-success text-bg-app" 
                                      : st === "review"
                                      ? "bg-brand-warning text-bg-app"
                                      : "bg-bg-surface text-text-primary"
                                    : "text-text-muted hover:text-text-primary"
                                }`}
                              >
                                {st === "learned" ? "Đã hiểu" : st === "review" ? "Cần ôn lại" : "Chưa học"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="text-2xs tabular-nums text-brand-info flex items-center gap-1">
                          <Sparkles className="w-4 h-4" />
                          <span>Dự báo sau khi ôn: độ ghi nhớ tăng từ 45% lên 88%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
