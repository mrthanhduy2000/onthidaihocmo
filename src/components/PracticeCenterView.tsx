/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Play, Brain, RotateCcw, Award, Layers, ChevronRight,
  BookOpen, Bookmark, Sparkles, Filter, Clock, CheckCircle2,
  Sliders, Shuffle
} from "lucide-react";
import { dbService, chapters, topics, questions } from "../services/db";
import { aiService } from "../services/ai";
import { ExamAttempt, DifficultyLevel } from "../types";
import PracticeView from "./PracticeView";
import ChapterQuestionGeneratorModal from "./ChapterQuestionGeneratorModal";

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
  // Số câu mong muốn cho mỗi đề theo chương (0 = làm hết số câu chương có).
  const [chapterCount, setChapterCount] = useState<number>(10);
  // Quy mô đề thi thử toàn bộ (số câu trải rộng các chương).
  const [mockCount, setMockCount] = useState<number>(25);
  // Chương đang mở modal tạo sinh AT (null = không mở). refreshKey để tính lại số liệu sau khi tạo.
  const [genChapter, setGenChapter] = useState<{ id: number; title: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

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

  // Số chương đang có câu hỏi (để hiển thị mức phủ của đề thi thử toàn bộ).
  const chaptersWithQuestions = chapterProgress.filter((c) => c.available > 0).length;
  const totalAvailable = chapterProgress.reduce((s, c) => s + c.available, 0);

  // Mode Handlers
  const handleStartAdaptive = () => {
    const exam = aiService.generateExam({ type: "adaptive", count: 15 });
    onStartExam(exam);
  };

  const handleStartSmartMock = () => {
    const exam = aiService.generateExam({ type: "ai-smart", count: mockCount });
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
    if (totalAvailable === 0) return;
    const count = Math.min(randomCount, totalAvailable);
    const exam = aiService.generateExam({ type: "random", count });
    onStartExam(exam);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10 fade-in-up" data-refresh={refreshKey}>
      {/* Header */}
      <div className="border-b border-border-primary pb-6 space-y-1">
        <div className="flex items-center gap-2 text-xs tabular-nums text-brand-info">
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
        {/* Bỏ số "1." vì trong trang KHÔNG hề có mục "2." nào; đánh số dở dang khiến người
            học đi tìm phần còn thiếu. Nhan đề nay dẫn dắt bằng cỡ chữ thay vì chữ hoa giãn cách. */}
        <h2 className="text-sm font-semibold text-text-primary">
          Nên bắt đầu ở đây
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
                <span className="text-2xs tabular-nums font-medium px-2 py-0.5 rounded bg-brand-info/10 text-brand-info border border-brand-info/20">
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
                <span className="text-2xs tabular-nums text-text-muted">
                  Phủ {chaptersWithQuestions}/{chapters.length} chương
                </span>
              </div>

              <div>
                <h3 className="text-base font-medium text-text-primary group-hover:text-text-primary transition">
                  Thi thử toàn bộ chương
                </h3>
                <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                  Làm {Math.min(mockCount, totalAvailable)} câu trải rộng các chương để kiểm tra mức sẵn sàng.
                </p>
              </div>

              {/* Chọn quy mô đề (chặn nổi bọt để không kích hoạt vào thi ngay) */}
              <div onClick={(e) => e.stopPropagation()} className="pt-1">
                <span className="text-2xs text-text-muted tabular-nums block mb-1">Quy mô đề:</span>
                <div className="flex items-center gap-0.5 bg-bg-surface p-0.5 rounded-lg border border-border-primary/60 w-fit">
                  {[25, 40, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMockCount(n)}
                      className={`px-2.5 py-0.5 rounded text-2xs font-medium transition ${
                        mockCount === n
                          ? "bg-bg-card text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {n} câu
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border-primary/60 flex items-center justify-between text-xs font-medium text-text-primary">
              <span>Vào thi thử ngay ({Math.min(mockCount, totalAvailable)} câu)</span>
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
                <span className="text-2xs tabular-nums px-2 py-0.5 rounded bg-brand-warning/10 text-brand-warning font-semibold">
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

            {/* Sổ câu sai trống thì thẻ này KHÔNG phải một lựa chọn: bỏ mũi tên và nói rõ
                cần làm gì để nó có nội dung, thay vì để một dòng cụt "Chưa có câu sai" kèm
                mũi tên mời bấm vào chỗ không có gì. */}
            <div className="mt-6 pt-4 border-t border-border-primary/60 flex items-center justify-between text-xs font-medium">
              {incorrectCount > 0 ? (
                <>
                  <span className="text-brand-warning">Ôn ngay {incorrectCount} câu</span>
                  <ChevronRight className="w-4 h-4 text-brand-warning group-hover:translate-x-1 transition-transform" />
                </>
              ) : (
                <span className="text-text-muted font-normal">Chưa có câu sai nào. Làm một bài ở trên để hệ thống ghi lại.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Giải đề ngẫu nhiên tổng hợp: rút câu ngẫu nhiên trải rộng mọi chương, ưu tiên câu ít gặp gần đây */}
      <div className="bg-gradient-to-r from-brand-info/10 to-bg-card border border-brand-info/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-info/15 text-brand-info flex items-center justify-center shrink-0">
            <Shuffle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-medium text-text-primary">Giải đề ngẫu nhiên tổng hợp</h3>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Rút {Math.min(randomCount, totalAvailable) || randomCount} câu trải rộng {chaptersWithQuestions}/{chapters.length} chương,
              ưu tiên ôn lại câu từng sai (lặp lại giãn cách) để nhớ lâu hơn. Kết quả tự cập nhật thống kê, điểm yếu và tiến độ sau khi nộp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Chọn quy mô đề ngẫu nhiên */}
          <div className="flex items-center gap-0.5 bg-bg-surface p-0.5 rounded-lg border border-border-primary/60">
            {[10, 20, 30].map((n) => (
              <button
                key={n}
                onClick={() => setRandomCount(n)}
                className={`px-2.5 py-1 rounded text-2xs font-medium transition ${
                  randomCount === n
                    ? "bg-bg-card text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {n} câu
              </button>
            ))}
          </div>
          <button
            onClick={handleStartCustomRandom}
            disabled={totalAvailable === 0}
            className="bg-brand-info text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Bắt đầu</span>
          </button>
        </div>
      </div>

      {/* Secondary Custom Options Section (Collapsible/Grouped) */}
      <div className="space-y-4 pt-4 border-t border-border-primary/60">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-text-muted" />
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
                <span className="text-2xs text-text-muted tabular-nums">Số câu:</span>
                <div className="flex items-center gap-0.5 bg-bg-surface p-0.5 rounded-lg border border-border-primary/60">
                  {[5, 10, 15, 0].map((n) => (
                    <button
                      key={n}
                      onClick={() => setChapterCount(n)}
                      className={`px-2 py-0.5 rounded text-2xs font-medium transition ${
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

            <p className="text-2xs text-text-muted leading-relaxed">
              Học xong chương nào, giải đề riêng chương đó để củng cố. Chương được gợi ý làm tiếp có viền xanh.
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {chapterProgress.map(({ chapter: ch, available, solved, accuracy }) => {
                const isEmpty = available === 0;
                const isSuggested = ch.id === nextChapterId;
                const willDo = isEmpty ? 0 : chapterCount === 0 ? available : Math.min(chapterCount, available);
                return (
                  <div
                    key={ch.id}
                    className={`p-3.5 rounded-xl transition group border ${
                      isEmpty
                        ? "bg-bg-surface/50 border-border-primary/50"
                        : isSuggested
                        ? "bg-brand-info/5 border-brand-info/50 hover:border-brand-info"
                        : "bg-bg-surface hover:bg-bg-surface-hover border-border-primary/80 hover:border-brand-info/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Vùng thông tin: bấm để giải đề chương (chỉ khi có câu hỏi) */}
                      <button
                        onClick={() => !isEmpty && handleStartChapter(ch.id)}
                        disabled={isEmpty}
                        className={`space-y-1 min-w-0 flex-1 text-left ${isEmpty ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-2xs tabular-nums text-brand-info font-semibold">Chương {ch.id}</span>
                          {isSuggested && !isEmpty && (
                            <span className="text-2xs tabular-nums px-1.5 py-0.5 rounded bg-brand-info/10 text-brand-info border border-brand-info/20 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> Nên làm tiếp
                            </span>
                          )}
                          {accuracy !== null && (
                            <span className={`text-2xs tabular-nums px-1.5 py-0.5 rounded border ${
                              accuracy >= 80
                                ? "bg-brand-success/10 text-brand-success border-brand-success/20"
                                : accuracy >= 50
                                ? "bg-brand-warning/10 text-brand-warning border-brand-warning/20"
                                : "bg-brand-error/10 text-brand-error border-brand-error/20"
                            }`}>
                              Đúng {accuracy}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-text-primary truncate">{ch.title}</div>
                        <div className="text-2xs text-text-muted tabular-nums">
                          {isEmpty ? "Chưa có câu hỏi" : `${available} câu có sẵn • đã làm ${solved} câu`}
                        </div>
                      </button>

                      <div className="shrink-0 flex items-center gap-2">
                        {/* Nút tạo câu hỏi AI cho đúng chương này */}
                        <button
                          onClick={() => setGenChapter({ id: ch.id, title: ch.title })}
                          title={`Dùng AI tạo câu hỏi cho Chương ${ch.id}`}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-medium border border-brand-info/30 text-brand-info hover:bg-brand-info/10 transition cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span className="hidden sm:inline">{isEmpty ? "Tạo bằng AI" : "Tạo thêm"}</span>
                        </button>

                        {isEmpty ? (
                          <span className="text-2xs text-text-muted tabular-nums hidden sm:inline">Chưa có đề</span>
                        ) : (
                          <button
                            onClick={() => handleStartChapter(ch.id)}
                            className="flex items-center gap-1 text-2xs tabular-nums text-brand-info cursor-pointer"
                          >
                            <span className="hidden sm:inline">Giải {willDo} câu</span>
                            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-brand-info group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
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
                <span className="text-xs tabular-nums text-brand-success font-semibold">{bookmarkCount} câu</span>
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

      {/* Modal tạo sinh câu hỏi AI cho đúng một chương */}
      {genChapter && (
        <ChapterQuestionGeneratorModal
          chapterId={genChapter.id}
          chapterTitle={genChapter.title}
          onClose={() => setGenChapter(null)}
          onDone={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
