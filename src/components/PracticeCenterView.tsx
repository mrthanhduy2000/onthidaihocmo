/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Play, Brain, RotateCcw, Award, Layers, ChevronRight, 
  BookOpen, Bookmark, Sparkles, Filter, Clock, CheckCircle2,
  Sliders
} from "lucide-react";
import { dbService, chapters, topics, questions } from "../services/db";
import { aiService } from "../services/ai";
import { ExamAttempt, DifficultyLevel } from "../types";
import PracticeView from "./PracticeView";
import AssessmentDesignDashboard from "./AssessmentDesignDashboard";

interface PracticeCenterProps {
  key?: string;
  activeExam: ExamAttempt | null;
  onStartExam: (exam: ExamAttempt) => void;
  onNavigateHome: () => void;
}

export default function PracticeCenterView({ activeExam, onStartExam, onNavigateHome }: PracticeCenterProps) {
  // If user is currently taking an exam, render PracticeView directly!
  if (activeExam) {
    return (
      <PracticeView 
        exam={activeExam} 
        onNavigateHome={onNavigateHome} 
      />
    );
  }

  // Secondary Custom Test Generator state
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>("Trung bình");
  const [randomCount, setRandomCount] = useState<number>(10);
  const [showAssessmentDesign, setShowAssessmentDesign] = useState<boolean>(false);
  // Số câu mong muốn cho mỗi đề theo chương (0 = làm hết số câu chương có).
  const [chapterCount, setChapterCount] = useState<number>(10);

  const stats = dbService.getStatistics();
  const incorrectCount = Object.keys(stats.incorrectQuestionHistory || {}).length;
  const bookmarkCount = (stats.bookmarks || []).length;

  // Thống kê từng chương: số câu có sẵn, số đã làm, độ chính xác, để dựng lộ trình.
  const chapterProgress = chapters.map((ch) => {
    const available = questions.filter((q) => q.chapterId === ch.id).length;
    const acc = stats.accuracyByChapter?.[ch.id] || { correct: 0, total: 0 };
    const accuracy = acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : null;
    return { chapter: ch, available, solved: acc.total, accuracy };
  });
  // Chương gợi ý làm tiếp: chương đầu tiên có câu hỏi mà chưa từng làm; nếu đã làm hết thì chương có độ chính xác thấp nhất.
  const nextChapterId = (() => {
    const untouched = chapterProgress.find((c) => c.available > 0 && c.solved === 0);
    if (untouched) return untouched.chapter.id;
    const withData = chapterProgress.filter((c) => c.available > 0 && c.accuracy !== null);
    if (withData.length === 0) return null;
    return withData.sort((a, b) => (a.accuracy! - b.accuracy!))[0].chapter.id;
  })();

  // Mode Handlers
  const handleStartAdaptive = () => {
    const exam = aiService.generateExam({ type: "adaptive", count: 15 });
    onStartExam(exam);
  };

  const handleStartSmartMock = () => {
    const exam = aiService.generateExam({ type: "ai-smart", count: 25 });
    onStartExam(exam);
  };

  const handleStartIncorrect = () => {
    if (incorrectCount === 0) return; // Không có câu sai thì không tạo đề (tránh trộn câu mọi chương).
    const exam = aiService.generateExam({ type: "incorrect" });
    onStartExam(exam);
  };

  const handleStartChapter = (chId: number) => {
    const available = questions.filter((q) => q.chapterId === chId).length;
    if (available === 0) return; // Chương chưa có câu hỏi thì bỏ qua.
    // chapterCount = 0 nghĩa là làm hết; ngược lại lấy tối đa bằng số câu chương có.
    const count = chapterCount === 0 ? available : Math.min(chapterCount, available);
    const exam = aiService.generateExam({ type: "chapter", chapterId: chId, count });
    onStartExam(exam);
  };

  const handleStartTopic = (tId: string) => {
    const exam = aiService.generateExam({ type: "topic", topicId: tId, count: 10 });
    onStartExam(exam);
  };

  const handleStartDifficulty = (diff: DifficultyLevel) => {
    const exam = aiService.generateExam({ type: "difficulty", difficulty: diff, count: 10 });
    onStartExam(exam);
  };

  const handleStartBookmark = () => {
    const exam = aiService.generateExam({ type: "bookmark" });
    onStartExam(exam);
  };

  const handleStartCustomRandom = () => {
    const exam = aiService.generateExam({ type: "random", count: randomCount });
    onStartExam(exam);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10 fade-in-up">
      {/* Header */}
      <div className="border-b border-border-primary pb-6 space-y-1">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-brand-info">
          <Brain className="w-4 h-4" />
          Trung tâm Rèn luyện
        </div>
        <h1 className="text-2xl font-display font-light text-text-primary">
          Chọn cách ôn tập
        </h1>
        <p className="text-text-muted text-xs font-sans">
          Chọn bài ngắn, thi thử hoặc ôn lại câu sai theo nhu cầu hiện tại.
        </p>
      </div>

      {/* Primary Modes Section (3 Main Cards) */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-text-muted">
          1. Nên bắt đầu ở đây
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Adaptive AI Mode */}
          <div 
            onClick={handleStartAdaptive}
            className="group relative bg-gradient-to-br from-bg-card to-bg-surface border border-brand-info/30 hover:border-brand-info rounded-2xl p-6 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-brand-info/10 text-brand-info flex items-center justify-center font-bold">
                  <Brain className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-brand-info/10 text-brand-info border border-brand-info/20">
                  Phổ biến nhất
                </span>
              </div>

              <div>
                <h3 className="text-base font-medium text-text-primary group-hover:text-brand-info transition">
                  Ôn theo điểm yếu
                </h3>
                <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                  Tập trung 15 câu vào phần sắp quên hoặc có tỉ lệ sai cao.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border-primary/60 flex items-center justify-between text-xs font-medium text-brand-info">
              <span>Bắt đầu ngay (15 câu)</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. Smart Mock Exam */}
          <div 
            onClick={handleStartSmartMock}
            className="group relative bg-bg-card border border-border-primary hover:border-text-primary rounded-2xl p-6 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-text-primary text-bg-app flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-text-muted">
                  Chuẩn 25 phút
                </span>
              </div>

              <div>
                <h3 className="text-base font-medium text-text-primary group-hover:text-text-primary transition">
                  Thi thử theo cấu trúc đề
                </h3>
                <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                  Làm 25 câu trải rộng các chương để kiểm tra mức sẵn sàng.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border-primary/60 flex items-center justify-between text-xs font-medium text-text-primary">
              <span>Vào thi thử ngay</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 3. Wrong Questions Review */}
          <div
            onClick={handleStartIncorrect}
            className={`group relative bg-bg-card border ${
              incorrectCount > 0 ? "border-brand-warning/40 hover:border-brand-warning cursor-pointer hover:shadow-md" : "border-border-primary opacity-80 cursor-not-allowed"
            } rounded-2xl p-6 transition-all duration-200 shadow-sm flex flex-col justify-between`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-brand-warning/10 text-brand-warning flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-warning/10 text-brand-warning font-semibold">
                  {incorrectCount} câu sai
                </span>
              </div>

              <div>
                <h3 className="text-base font-medium text-text-primary group-hover:text-brand-warning transition">
                  Sửa câu đã làm sai
                </h3>
                <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                  Làm lại các câu từng sai để hiểu rõ bẫy và tránh lặp lỗi.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border-primary/60 flex items-center justify-between text-xs font-medium text-brand-warning">
              <span>{incorrectCount > 0 ? `Ôn ngay ${incorrectCount} câu` : "Chưa có câu sai"}</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Progressive Disclosure Section: Bàn thiết kế đề thi */}
      <div className="space-y-3 pt-2">
        <button
          onClick={() => setShowAssessmentDesign(!showAssessmentDesign)}
          className="w-full p-3 bg-bg-card border border-border-primary hover:border-brand-info/60 rounded-xl flex items-center justify-between text-xs font-mono uppercase tracking-wider text-text-muted hover:text-text-primary transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand-info" />
            <span>Tùy chỉnh đề nâng cao</span>
          </div>
          <span className="text-[11px] text-brand-info font-sans lowercase">
            {showAssessmentDesign ? "Ẩn tùy chỉnh ▲" : "Mở tùy chỉnh ▼"}
          </span>
        </button>

        {showAssessmentDesign && (
          <div className="p-4 bg-bg-card border border-border-primary rounded-2xl fade-in space-y-3">
            <AssessmentDesignDashboard onStartExam={onStartExam} />
          </div>
        )}
      </div>

      {/* Secondary Custom Options Section (Collapsible/Grouped) */}
      <div className="space-y-4 pt-4 border-t border-border-primary/60">
        <h2 className="text-xs font-mono uppercase tracking-wider text-text-muted flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5" />
          Ôn theo chương hoặc mức độ
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lộ trình giải đề theo từng chương */}
          <div className="lg:col-span-2 bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-text-primary flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-info" />
                Giải đề theo chương (1 - {chapters.length})
              </span>

              {/* Bộ chọn số câu mỗi đề */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-text-muted font-mono">Số câu:</span>
                <div className="flex items-center gap-0.5 bg-bg-surface p-0.5 rounded-lg border border-border-primary/60">
                  {[5, 10, 15, 0].map((n) => (
                    <button
                      key={n}
                      onClick={() => setChapterCount(n)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        chapterCount === n
                          ? "bg-bg-card text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {n === 0 ? "Tất cả" : n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-text-muted leading-relaxed">
              Học xong chương nào, giải đề riêng chương đó để củng cố. Chương được gợi ý làm tiếp có viền xanh.
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {chapterProgress.map(({ chapter: ch, available, solved, accuracy }) => {
                const isEmpty = available === 0;
                const isSuggested = ch.id === nextChapterId;
                const willDo = isEmpty ? 0 : chapterCount === 0 ? available : Math.min(chapterCount, available);
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleStartChapter(ch.id)}
                    disabled={isEmpty}
                    className={`p-3.5 rounded-xl text-left transition group border ${
                      isEmpty
                        ? "bg-bg-surface/50 border-border-primary/50 opacity-70 cursor-not-allowed"
                        : isSuggested
                        ? "bg-brand-info/5 border-brand-info/50 hover:border-brand-info"
                        : "bg-bg-surface hover:bg-bg-surface-hover border-border-primary/80 hover:border-brand-info/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono text-brand-info font-semibold">Chương {ch.id}</span>
                          {isSuggested && !isEmpty && (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-brand-info/10 text-brand-info border border-brand-info/20 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> Nên làm tiếp
                            </span>
                          )}
                          {accuracy !== null && (
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                              accuracy >= 80
                                ? "bg-brand-success/10 text-brand-success border-brand-success/20"
                                : accuracy >= 50
                                ? "bg-brand-warning/10 text-brand-warning border-brand-warning/20"
                                : "bg-brand-danger/10 text-brand-danger border-brand-danger/20"
                            }`}>
                              Đúng {accuracy}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-text-primary truncate">{ch.title}</div>
                        <div className="text-[10px] text-text-muted font-mono">
                          {isEmpty ? "Chưa có câu hỏi" : `${available} câu có sẵn • đã làm ${solved} lượt`}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isEmpty ? (
                          <span className="text-[10px] text-text-muted font-mono">Sắp có</span>
                        ) : (
                          <>
                            <span className="text-[10px] font-mono text-brand-info hidden sm:inline">Giải {willDo} câu</span>
                            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-brand-info group-hover:translate-x-0.5 transition-transform" />
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty & Bookmarks Column */}
          <div className="space-y-4">
            {/* Difficulty Cards */}
            <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-3">
              <span className="text-xs font-semibold text-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-warning" />
                Lọc theo Mức độ
              </span>

              <div className="grid grid-cols-3 gap-2">
                {(["Dễ", "Trung bình", "Khó"] as DifficultyLevel[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => handleStartDifficulty(d)}
                    className="py-2.5 px-2 bg-bg-surface hover:bg-bg-surface-hover border border-border-primary rounded-xl text-center text-xs font-medium text-text-primary transition hover:border-text-primary"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Bookmarks & Quick Generator */}
            <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-brand-success" />
                  Câu hỏi đã đánh dấu
                </span>
                <span className="text-xs font-mono text-brand-success font-semibold">{bookmarkCount} câu</span>
              </div>

              <button
                onClick={handleStartBookmark}
                disabled={bookmarkCount === 0}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 ${
                  bookmarkCount > 0 
                    ? "bg-brand-success/10 border border-brand-success/30 text-brand-success hover:bg-brand-success/20" 
                    : "bg-bg-surface text-text-muted border border-border-primary cursor-not-allowed"
                }`}
              >
                <span>Ôn câu đã đánh dấu</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
