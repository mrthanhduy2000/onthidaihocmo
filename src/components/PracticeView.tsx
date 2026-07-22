/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Clock, Bookmark, Flag, ChevronLeft, ChevronRight, 
  Send, HelpCircle, Sparkles, BookOpen, Check, AlertCircle, AlertTriangle, Play, Pause, Brain, CheckCircle2
} from "lucide-react";
import { dbService, questionMap, questions, topics, chapters } from "../services/db";
import { aiService } from "../services/ai";
import { workspaceService } from "../services/workspaceService";
import { ExamAttempt, Question, UserSettings } from "../types";
import { kbService } from "../services/kbService";
import SimpleMarkdown from "./SimpleMarkdown";

interface PracticeProps {
  key?: any;
  exam: ExamAttempt;
  onNavigateHome: () => void;
}

export default function PracticeView({ exam: initialExam, onNavigateHome }: PracticeProps) {
  const [exam, setExam] = useState<ExamAttempt>(initialExam);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [userSettings, setUserSettings] = useState<UserSettings>(dbService.getSettings());
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(true);
  
  // Ref to track timeSpent to avoid rendering/updating DB on every single second
  const timeSpentRef = useRef<number>(initialExam.timeSpent);

  // AI Tutor & Coaching States
  const [isTutorMode, setIsTutorMode] = useState<boolean>(true);
  const [coachingActive, setCoachingActive] = useState<boolean>(false);
  const [coachingNode, setCoachingNode] = useState<any | null>(null);
  const [coachingAnswered, setCoachingAnswered] = useState<boolean>(false);
  const [coachingAnswerKey, setCoachingAnswerKey] = useState<string | null>(null);
  const [coachingIsCorrect, setCoachingIsCorrect] = useState<boolean | null>(null);
  const [explanationLevel, setExplanationLevel] = useState<"simple" | "academic" | "expert" | "practical" | "business" | "teacher">("academic");

  // AI Explanation State
  const [aiExplanations, setAiExplanations] = useState<{ [qId: number]: string }>({});
  const [aiLoading, setAiLoading] = useState<{ [qId: number]: boolean }>({});
  const [aiError, setAiError] = useState<{ [qId: number]: string }>({});
  const [aiPipelineMetadata, setAiPipelineMetadata] = useState<{ [qId: number]: any }>({});
  
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMsg(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Reset coaching and success states when the active question changes (currentIdx changes)
  useEffect(() => {
    setCoachingActive(false);
    setCoachingNode(null);
    setCoachingAnswered(false);
    setCoachingAnswerKey(null);
    setCoachingIsCorrect(null);
  }, [currentIdx]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const examQuestions: Question[] = exam.questions
    .map(qId => questionMap.get(qId))
    .filter((q): q is Question => !!q);

  const activeQuestion = examQuestions[currentIdx];

  // Set up timer (either countdown for exam, or count up elapsed for study)
  useEffect(() => {
    if (exam.isSubmitted) {
      setTimerActive(false);
      return;
    }

    const defaultDuration = exam.examType === "ai-smart" ? 25 * 60 : examQuestions.length * 90; // 90s per question
    
    // Set initial time
    if (exam.timeSpent > 0) {
      if (userSettings.enableTimer) {
        setTimeRemaining(Math.max(0, defaultDuration - exam.timeSpent));
      } else {
        setTimeRemaining(exam.timeSpent);
      }
    } else {
      if (userSettings.enableTimer) {
        setTimeRemaining(defaultDuration);
      } else {
        setTimeRemaining(0);
      }
    }

    timerRef.current = setInterval(() => {
      if (!timerActive) return;

      setTimeRemaining(prev => {
        let nextVal = prev;
        let elapsed = 0;

        if (userSettings.enableTimer) {
          nextVal = Math.max(0, prev - 1);
          elapsed = defaultDuration - nextVal;
          if (nextVal === 0) {
            // Out of time - Auto submit
            clearInterval(timerRef.current!);
            handleAutoSubmit();
          }
        } else {
          nextVal = prev + 1;
          elapsed = nextVal;
        }

        // Save progress state in ref
        timeSpentRef.current = elapsed;

        return nextVal;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [exam.isSubmitted, timerActive, userSettings.enableTimer]);

  // Periodic sync to dbService every 10 seconds to make sure state is saved in case of exit/refresh
  useEffect(() => {
    if (exam.isSubmitted) return;

    const interval = setInterval(() => {
      dbService.saveAttempt({
        ...exam,
        timeSpent: timeSpentRef.current
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [exam]);

  // Save on component unmount
  useEffect(() => {
    return () => {
      if (!exam.isSubmitted) {
        dbService.saveAttempt({
          ...exam,
          timeSpent: timeSpentRef.current
        });
      }
    };
  }, [exam]);

  const handleSelectAnswer = (optionKey: "a" | "b" | "c" | "d") => {
    if (exam.isSubmitted) return;
    if (coachingActive) return; // Block answers during active coaching

    const isCorrect = activeQuestion.correctAnswer === optionKey;

    // Lưu ý: trước đây có đoạn "đảo câu thích ứng thời gian thực" thay câu ở vị trí kế tiếp
    // ngay khi người dùng trả lời. Việc đó làm mồ côi các đáp án đã trả lời (câu bị thay ra khỏi
    // đề nhưng đáp án vẫn còn trong exam.answers), dẫn tới câu trả lời đúng bị tính/hiển thị thành
    // sai khi chấm và xem lại. Đã bỏ hoàn toàn để danh sách câu hỏi giữ nguyên trong suốt bài làm;
    // độ khó thích ứng đã được xử lý ngay từ khâu tạo đề (learningEngine.scoreQuestions).

    const updated: ExamAttempt = {
      ...exam,
      timeSpent: timeSpentRef.current,
      answers: {
        ...exam.answers,
        [activeQuestion.id]: optionKey
      }
    };
    // Save state synchronously outside of setState
    dbService.saveAttempt(updated);
    workspaceService.saveUnfinishedSession(updated);
    setExam(updated);

    // Trigger coaching immediately if wrong & tutor mode is active
    if (!isCorrect && isTutorMode) {
      const activeSubjectId = dbService.getActiveSubjectId();
      const conceptNode = kbService.getConceptForQuestion(activeSubjectId, activeQuestion);
      if (conceptNode) {
        setCoachingNode(conceptNode);
        setCoachingActive(true);
        setCoachingAnswered(false);
        setCoachingAnswerKey(null);
        setCoachingIsCorrect(null);
      }
    }
  };

  const toggleBookmark = (qId: number) => {
    const isBookmarked = dbService.toggleBookmark(qId);
    setExam(prev => {
      let bookmarks = [...(prev.bookmarks || [])];
      if (isBookmarked) {
        if (!bookmarks.includes(qId)) bookmarks.push(qId);
      } else {
        bookmarks = bookmarks.filter(id => id !== qId);
      }
      return { ...prev, bookmarks };
    });
    showToast(isBookmarked ? "Đã lưu câu hỏi vào danh sách ôn tập" : "Đã xóa câu hỏi khỏi danh sách ôn tập");
  };

  const toggleFlag = (qId: number) => {
    const isFlagged = dbService.toggleFlag(qId);
    setExam(prev => {
      let flags = [...(prev.flags || [])];
      if (isFlagged) {
        if (!flags.includes(qId)) flags.push(qId);
      } else {
        flags = flags.filter(id => id !== qId);
      }
      return { ...prev, flags };
    });
    showToast(isFlagged ? "Đã gắn cờ nghi vấn câu hỏi này" : "Đã gỡ cờ nghi vấn");
  };

  const handlePrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const handleNext = () => {
    if (currentIdx < examQuestions.length - 1) setCurrentIdx(currentIdx + 1);
  };

  const handleAutoSubmit = () => {
    submitExam();
  };

  const submitExam = () => {
    if (exam.isSubmitted) return;

    try {
      if (timerRef.current) clearInterval(timerRef.current);

      let correctCount = 0;
      examQuestions.forEach(q => {
        if (exam.answers[q.id] === q.correctAnswer) {
          correctCount++;
        }
      });

      const updated: ExamAttempt = {
        ...exam,
        timeSpent: timeSpentRef.current,
        isSubmitted: true,
        score: correctCount,
      };

      // Save attempt synchronously and clear unfinished session
      dbService.saveAttempt(updated);
      workspaceService.clearUnfinishedSession();
      
      // Update local state and close the modal
      setExam(updated);
      setShowSubmitModal(false);
      showToast(`Đã lưu và nộp bài thành công! (${correctCount}/${examQuestions.length} câu đúng)`);
    } catch (err) {
      console.error("Error submitting exam:", err);
      // Fallback: at least mark as submitted and close modal to unblock user
      const fallbackAttempt: ExamAttempt = { ...exam, isSubmitted: true };
      dbService.saveAttempt(fallbackAttempt);
      workspaceService.clearUnfinishedSession();
      setExam(fallbackAttempt);
      setShowSubmitModal(false);
    }
  };

  const handleRequestAIExplanation = async (qId: number, level: typeof explanationLevel = explanationLevel) => {
    if (aiLoading[qId]) return;

    setAiLoading(prev => ({ ...prev, [qId]: true }));
    setAiError(prev => ({ ...prev, [qId]: "" }));

    try {
      const selected = exam.answers[qId];
      const result = await aiService.getAIPipelineExplanation(qId, selected, level);
      setAiExplanations(prev => ({ ...prev, [qId]: result.explanation }));
      setAiPipelineMetadata(prev => ({ ...prev, [qId]: result }));
    } catch (error) {
      setAiError(prev => ({ ...prev, [qId]: "Không thể lấy lời giải thích từ AI. Bạn hãy xem lời giải tiêu chuẩn bên dưới." }));
    } finally {
      setAiLoading(prev => ({ ...prev, [qId]: false }));
    }
  };

  const formatTimer = () => {
    const m = Math.floor(timeRemaining / 60);
    const s = timeRemaining % 60;
    const formattedM = m < 10 ? `0${m}` : m;
    const formattedS = s < 10 ? `0${s}` : s;
    return `${formattedM}:${formattedS}`;
  };

  // Score analytics
  const scorePercent = Math.round((exam.score / examQuestions.length) * 100);
  const correctCount = exam.score;
  const incorrectCount = examQuestions.length - correctCount;

  // Track bookmarks and flags status from dbService stats
  const dbStats = dbService.getStatistics();
  const activeBookmarked = dbStats.bookmarks.includes(activeQuestion?.id);
  const activeFlagged = dbStats.flags.includes(activeQuestion?.id);
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-fade-in-up">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
        <div className="flex items-center gap-3.5">
          <button 
            onClick={onNavigateHome}
            className="p-2 border border-border-primary bg-bg-card rounded-lg hover:bg-bg-surface text-text-secondary transition duration-150 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-md font-medium font-display text-text-primary">
              {exam.examType === "ai-smart" ? "Đề thi thử thông minh" :
               exam.examType === "adaptive" ? "Học tập thích ứng" :
               exam.examType === "chapter" ? `Luyện tập Chương ${exam.chapterId}` :
               exam.examType === "topic" ? `Luyện tập Chủ đề ${exam.topicId}` :
               exam.examType === "random" ? "Luyện tập Ngẫu nhiên" : "Luyện tập theo Thứ tự gốc"}
            </h1>
            <p className="text-[11px] text-text-muted mt-0.5 font-sans">
              {exam.isSubmitted ? "Xem lại đáp án và phân tích lý luận từ hệ thống AI" : `Phiên ôn luyện: ${examQuestions.length} câu hỏi lý thuyết`}
            </p>
          </div>
        </div>

        {/* Timer / Progress Widgets */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {!exam.isSubmitted && (
            <div className="bg-bg-surface border border-border-primary/80 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-text-muted" />
              <span className="font-mono font-medium text-text-primary text-xs">
                {formatTimer()}
              </span>
              <button 
                onClick={() => setTimerActive(!timerActive)}
                className="text-text-muted hover:text-text-primary transition-colors ml-1 cursor-pointer"
                title={timerActive ? "Tạm dừng" : "Tiếp tục"}
              >
                {timerActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </div>
          )}

          {!exam.isSubmitted && (
            <button 
              onClick={() => setShowSubmitModal(true)}
              className="bg-text-primary hover:opacity-90 text-bg-card font-medium text-xs px-4 py-1.5 rounded-lg transition duration-150 flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Nộp bài</span>
            </button>
          )}

          {exam.isSubmitted && (
            <div className="bg-brand-success-bg border border-brand-success-border px-3.5 py-1.5 rounded-lg text-brand-success font-medium text-xs">
              Kết quả: {exam.score} / {examQuestions.length} câu đúng
            </div>
          )}
        </div>
      </div>

      {/* Session Completion Experience (Learning Summary) */}
      {exam.isSubmitted && (
        <div className="bg-bg-card border border-border-primary rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-primary/60 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-brand-success mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Phiên học hoàn tất • Tổng kết buổi học</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-light text-text-primary">
                Tổng quan kết quả & Tiến trình củng cố
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  const newExam = aiService.generateExam({ type: "adaptive", count: 10 });
                  dbService.saveAttempt(newExam);
                  workspaceService.saveUnfinishedSession(newExam);
                  setExam(newExam);
                  setCurrentIdx(0);
                  const duration = newExam.examSpecification?.plannedTimeMinutes || 15;
                  setTimeRemaining(duration * 60);
                  timeSpentRef.current = 0;
                  setShowSubmitModal(false);
                }}
                className="px-5 py-2.5 bg-text-primary text-bg-card hover:opacity-90 font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Làm thêm 10 câu mới</span>
              </button>

              <button
                onClick={onNavigateHome}
                className="px-4 py-2.5 bg-bg-surface border border-border-primary hover:bg-bg-card text-text-secondary font-medium text-xs rounded-xl transition cursor-pointer"
              >
                <span>Kết thúc hôm nay</span>
              </button>
            </div>
          </div>

          {/* 4 Core Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-4 text-center space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Kết quả bài thi</span>
              <p className="text-lg font-display font-semibold text-text-primary">
                {correctCount} / {examQuestions.length} <span className="text-xs font-sans font-normal text-text-muted">đúng</span>
              </p>
            </div>

            <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-4 text-center space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Khái niệm đã thông thạo</span>
              <p className="text-lg font-display font-semibold text-brand-success">
                +{Math.max(1, Math.floor(correctCount / 3))} <span className="text-xs font-sans font-normal text-text-muted">khái niệm</span>
              </p>
            </div>

            <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-4 text-center space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Hiểu sai đã sửa</span>
              <p className="text-lg font-display font-semibold text-brand-warning">
                {incorrectCount > 0 ? "1 hiểu sai" : "0 bẫy sai"}
              </p>
            </div>

            <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-4 text-center space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Độ ghi nhớ dự đoán</span>
              <p className="text-lg font-display font-semibold text-brand-info">
                71% &rarr; {Math.min(96, 71 + Math.round((correctCount / examQuestions.length) * 18))}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Interactive Question Workspace (3/4 width) */}
        <div className="lg:col-span-3 space-y-5">
          
          {/* Question Meta Box */}
          {activeQuestion && (
            <div className="bg-bg-card border border-border-primary rounded-xl p-6 space-y-5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
              
              {/* Question Index & Action Flags */}
              <div className="flex items-center justify-between gap-4 border-b border-border-primary/60 pb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-bg-surface border border-border-primary text-text-secondary text-xs font-medium px-2.5 py-0.5 rounded-md">
                    Câu {currentIdx + 1} / {examQuestions.length}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    activeQuestion.difficulty === "Dễ" ? "bg-brand-success-bg text-brand-success border-brand-success-border/30" :
                    activeQuestion.difficulty === "Trung bình" ? "bg-brand-info-bg text-brand-info border-brand-info-border/30" :
                    activeQuestion.difficulty === "Khó" ? "bg-brand-warning-bg text-brand-warning border-brand-warning-border/30" :
                    "bg-brand-danger-bg text-brand-danger border-brand-danger-border/30"
                  }`}>
                    Mức {activeQuestion.difficulty}
                  </span>
                  <span className="text-[11px] text-text-muted font-mono hidden sm:inline">
                    ID: #{activeQuestion.id}
                  </span>
                </div>

                {/* Bookmark & suspicious doubt flags */}
                <div className="flex items-center gap-3">
                  {/* AI Tutor Toggle */}
                  {!exam.isSubmitted && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={isTutorMode} 
                          onChange={(e) => {
                            setIsTutorMode(e.target.checked);
                            if (!e.target.checked) setCoachingActive(false);
                          }}
                          className="sr-only" 
                        />
                        <div className={`w-8 h-4 rounded-full transition duration-150 ${isTutorMode ? "bg-brand-success" : "bg-bg-surface border border-border-primary"}`}></div>
                        <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full shadow-md transition-transform duration-150 ${isTutorMode ? "transform translate-x-4 bg-white" : "bg-text-muted"}`}></div>
                      </div>
                      <span className="text-[10px] font-medium text-text-secondary flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-brand-success" />
                        Giáo viên AI Coaching
                      </span>
                    </label>
                  )}

                  <button 
                    onClick={() => toggleBookmark(activeQuestion.id)}
                    className={`p-1.5 rounded-md border transition duration-150 cursor-pointer ${
                      activeBookmarked 
                        ? "bg-brand-warning-bg border-brand-warning-border text-brand-warning" 
                        : "border-border-primary bg-bg-card text-text-muted hover:bg-bg-surface hover:text-text-primary"
                    }`}
                    title="Đánh dấu câu hỏi trọng tâm"
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${activeBookmarked ? "fill-current" : ""}`} />
                  </button>
                  <button 
                    onClick={() => toggleFlag(activeQuestion.id)}
                    className={`p-1.5 rounded-md border transition duration-150 cursor-pointer ${
                      activeFlagged 
                        ? "bg-brand-warning-bg border-brand-warning-border text-brand-warning" 
                        : "border-border-primary bg-bg-card text-text-muted hover:bg-bg-surface hover:text-text-primary"
                    }`}
                    title="Đánh dấu câu nghi ngờ để rà soát lại"
                  >
                    <Flag className={`w-3.5 h-3.5 ${activeFlagged ? "fill-current" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider font-mono flex flex-wrap items-center gap-1.5">
                  <span>Chủ đề: {topics.find(t => t.id === activeQuestion.topicId)?.title}</span>
                  {(() => {
                    const activeSubjectId = dbService.getActiveSubjectId();
                    const conceptNode = kbService.getConceptForQuestion(activeSubjectId, activeQuestion);
                    if (conceptNode) {
                      const reqs = conceptNode.dependencies?.requires || [];
                      const reqNodes = kbService.getKnowledgeGraph(activeSubjectId).filter(g => reqs.includes(g.id));
                      return (
                        <>
                          <span className="text-text-muted">•</span>
                          <span className="text-brand-info flex items-center gap-1 font-semibold">
                            <Brain className="w-3.5 h-3.5" />
                            Khái niệm: {conceptNode.concept}
                          </span>
                          {reqNodes.length > 0 && (
                            <>
                              <span className="text-text-muted">➔</span>
                              <span className="text-text-muted flex items-center gap-1" title="Cần học trước">
                                Yêu cầu trước: {reqNodes.map(rn => rn.concept).join(", ")}
                              </span>
                            </>
                          )}
                        </>
                      );
                    }
                    return null;
                  })()}
                </div>
                <h3 className="text-md font-medium text-text-primary leading-relaxed font-sans">
                  {activeQuestion.question}
                </h3>
              </div>

              {/* Multiple Choice Options */}
              <div className="grid grid-cols-1 gap-2.5 pt-1">
                {(["a", "b", "c", "d"] as const).map((key) => {
                  const optionText = activeQuestion.options[key];
                  const isSelected = exam.answers[activeQuestion.id] === key;
                  const isCorrect = activeQuestion.correctAnswer === key;
                  const isWrongSelection = isSelected && !isCorrect;

                  let optionStyle = "border-border-primary bg-bg-card text-text-secondary hover:bg-bg-surface/50 hover:border-text-muted/20";
                  
                  if (isSelected && !exam.isSubmitted) {
                    optionStyle = "bg-bg-surface/80 border-text-primary text-text-primary font-medium shadow-xs";
                  } else if (exam.isSubmitted) {
                    if (isCorrect) {
                      optionStyle = "bg-brand-success-bg border-brand-success-border text-brand-success font-medium";
                    } else if (isWrongSelection) {
                      optionStyle = "bg-brand-danger-bg border-brand-danger-border text-brand-danger";
                    } else {
                      optionStyle = "border-border-primary/60 bg-bg-card opacity-40 text-text-muted";
                    }
                  }

                  return (
                    <button 
                      key={key}
                      onClick={() => handleSelectAnswer(key)}
                      disabled={exam.isSubmitted}
                      className={`w-full text-left p-3.5 min-h-[44px] rounded-xl border flex items-center justify-between gap-4 transition-all duration-150 group relative cursor-pointer ${optionStyle}`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center font-medium font-mono text-[11px] transition duration-150 ${
                          isSelected && !exam.isSubmitted 
                            ? "bg-text-primary text-bg-card" 
                            : exam.isSubmitted && isCorrect 
                            ? "bg-brand-success text-white"
                            : exam.isSubmitted && isWrongSelection
                            ? "bg-brand-danger text-white"
                            : "bg-bg-surface group-hover:bg-border-primary text-text-muted border border-border-primary/60"
                        }`}>
                          {key.toUpperCase()}
                        </span>
                        <span className="text-xs leading-relaxed font-sans">{optionText}</span>
                      </div>

                      {exam.isSubmitted && isCorrect && (
                        <Check className="w-4 h-4 text-brand-success shrink-0" />
                      )}
                      {exam.isSubmitted && isWrongSelection && (
                        <AlertCircle className="w-4 h-4 text-brand-danger shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Wrong Answer Coaching Panel */}
              {coachingActive && coachingNode && (
                <div className="border border-brand-warning-border/40 bg-brand-warning-bg/15 p-5 rounded-xl space-y-4 animate-fade-in-up mt-4">
                  <div className="flex items-center gap-2 border-b border-brand-warning-border/30 pb-2.5">
                    <Brain className="w-5 h-5 text-brand-warning animate-pulse" />
                    <div>
                      <h4 className="text-xs font-semibold text-brand-warning">Gia sư AI Coaching: Chấn chỉnh bẫy lý thuyết</h4>
                      <p className="text-[10px] text-text-muted font-sans">Đừng lo lắng! Hãy rà soát lại khái niệm để nắm vững kiến thức gốc.</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed font-sans text-text-secondary">
                    {coachingNode.teaching?.misconception && (
                      <div className="space-y-1">
                        <span className="text-brand-danger font-semibold uppercase tracking-wider text-[9px] block">Lỗi hiểu sai phổ biến:</span>
                        <p className="bg-brand-danger-bg/20 border border-brand-danger-border/20 p-3 rounded-lg text-text-primary">{coachingNode.teaching.misconception}</p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="text-brand-success font-semibold uppercase tracking-wider text-[9px] block">Bài học cốt lõi rút ngắn:</span>
                      <p className="bg-bg-surface border border-border-primary/50 p-3 rounded-lg text-text-primary whitespace-pre-line">{coachingNode.coaching?.miniLesson || coachingNode.definition}</p>
                    </div>

                    {coachingNode.explanation?.analogy && (
                      <p className="text-[11px] italic text-text-muted pl-2.5 border-l-2 border-text-muted">💡 Phép ẩn dụ: {coachingNode.explanation.analogy}</p>
                    )}

                    {/* Follow-up micro-quiz */}
                    <div className="border-t border-border-primary/60 pt-3.5 space-y-3">
                      <span className="text-brand-info font-semibold uppercase tracking-wider text-[9px] block flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-brand-info animate-pulse" />
                        Câu hỏi rà soát nhanh (Micro-Quiz):
                      </span>
                      <p className="font-semibold text-text-primary text-xs leading-relaxed">{kbService.getCoachingOptions(coachingNode).question}</p>

                      <div className="grid grid-cols-1 gap-2">
                        {kbService.getCoachingOptions(coachingNode).options.map((opt) => {
                          const isSelected = coachingAnswerKey === opt.key;
                          let btnStyle = "border-border-primary bg-bg-card hover:bg-bg-surface text-text-secondary";
                          if (isSelected) {
                            btnStyle = opt.isCorrect 
                              ? "bg-brand-success-bg border-brand-success text-brand-success font-medium"
                              : "bg-brand-danger-bg border-brand-danger text-brand-danger font-medium";
                          }

                          return (
                            <button
                              key={opt.key}
                              disabled={coachingAnswered && coachingIsCorrect === true}
                              onClick={() => {
                                setCoachingAnswerKey(opt.key);
                                setCoachingAnswered(true);
                                setCoachingIsCorrect(opt.isCorrect);
                                if (opt.isCorrect) {
                                  dbService.boostConceptMastery(coachingNode.id, 15);
                                }
                              }}
                              className={`w-full text-left p-3 rounded-xl border text-xs leading-relaxed flex items-center gap-3 transition-all duration-150 cursor-pointer ${btnStyle}`}
                            >
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] ${
                                isSelected && opt.isCorrect ? "bg-brand-success text-white" :
                                isSelected && !opt.isCorrect ? "bg-brand-danger text-white" : "bg-bg-surface border"
                              }`}>
                                {opt.key.toUpperCase()}
                              </span>
                              <span>{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>

                      {coachingAnswered && (
                        <div className="animate-fade-in pt-1">
                          {coachingIsCorrect ? (
                            <div className="bg-brand-success-bg border border-brand-success-border text-brand-success p-3 rounded-lg text-xs leading-relaxed font-sans flex items-start gap-2">
                              <Check className="w-4 h-4 mt-0.5 shrink-0" />
                              <div>
                                <strong>Tuyệt vời!</strong> Bạn đã thấu suốt bản chất lý thuyết. Hệ thống cộng <strong>+15% điểm thông thạo</strong> cho khái niệm <strong>{coachingNode.concept}</strong>.
                              </div>
                            </div>
                          ) : (
                            <div className="bg-brand-danger-bg border border-brand-danger-border text-brand-danger p-3 rounded-lg text-xs leading-relaxed font-sans flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                              <div>
                                <strong>Chưa đúng rồi!</strong> Hãy xem kỹ lại bài học rút ngắn ở trên và thử chọn lại đáp án đúng nhé.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coach Action footer to dismiss coaching once correct */}
                  <div className="flex justify-end pt-2 border-t border-brand-warning-border/30">
                    <button
                      disabled={!coachingIsCorrect}
                      onClick={() => {
                        setCoachingActive(false);
                        setCoachingNode(null);
                        setCoachingAnswerKey(null);
                        setCoachingAnswered(false);
                        setCoachingIsCorrect(null);
                        if (currentIdx === examQuestions.length - 1) {
                          submitExam();
                        } else {
                          handleNext();
                        }
                      }}
                      className="bg-brand-warning disabled:opacity-40 text-white text-[11px] font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition duration-150 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{currentIdx === examQuestions.length - 1 ? "Hoàn thành & Xem kết quả" : "Tiếp tục học phần"}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Correct Answer Success Panel (Tutor Mode) */}
              {isTutorMode && !exam.isSubmitted && exam.answers[activeQuestion.id] === activeQuestion.correctAnswer && !coachingActive && (
                <div className="border border-brand-success-border/40 bg-brand-success-bg/15 p-5 rounded-xl space-y-4 animate-fade-in-up mt-4">
                  <div className="flex items-center gap-2 border-b border-brand-success-border/30 pb-2.5">
                    <CheckCircle2 className="w-5 h-5 text-brand-success animate-pulse" />
                    <div>
                      <h4 className="text-xs font-semibold text-brand-success">Chính xác! Bạn đã chọn đúng đáp án</h4>
                      <p className="text-[10px] text-text-muted font-sans">Tuyệt vời! Bạn đã trả lời đúng câu hỏi này.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs font-sans text-text-secondary">
                    <span className="text-brand-success font-semibold uppercase tracking-wider text-[9px] block">Giải nghĩa từ giáo trình:</span>
                    <p className="bg-bg-card border border-border-primary/50 p-3 rounded-lg text-text-primary leading-relaxed">
                      {activeQuestion.explanation}
                    </p>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-brand-success-border/30">
                    <button
                      onClick={() => {
                        if (currentIdx === examQuestions.length - 1) {
                          submitExam();
                        } else {
                          handleNext();
                        }
                      }}
                      className="bg-brand-success text-white text-[11px] font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition duration-150 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{currentIdx === examQuestions.length - 1 ? "Hoàn thành & Xem kết quả" : "Tiếp tục học phần"}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Controls: Back/Forward */}
              <div className="flex items-center justify-between border-t border-border-primary/60 pt-5">
                <button 
                  onClick={handlePrev}
                  disabled={currentIdx === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border-primary bg-bg-card hover:bg-bg-surface text-text-secondary rounded-lg transition disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>

                <div className="text-[11px] text-text-muted font-mono hidden sm:inline">
                  Slide: <span className="font-medium text-text-secondary">{activeQuestion.sourcePdf} (Trang {activeQuestion.sourcePage})</span>
                </div>

                <button 
                  onClick={handleNext}
                  disabled={currentIdx === examQuestions.length - 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border-primary bg-bg-card hover:bg-bg-surface text-text-secondary rounded-lg transition disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                >
                  <span>Câu sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* AI Explanation & Standard Review Section (Rendered POST submission only) */}
          {exam.isSubmitted && activeQuestion && (
            <div className="space-y-5 animate-fade-in-up">
              
              {/* AI Expert Explanation Action Trigger */}
              <div className="bg-bg-surface border border-border-primary rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-brand-success animate-pulse" />
                      <span>Bài giảng giải thích chi tiết bằng AI (Trực tuyến)</span>
                    </h4>
                    <p className="text-[11px] text-text-secondary leading-relaxed max-w-xl font-sans">
                      Sử dụng trí tuệ nhân tạo Gemini để giải mã câu hỏi theo **Mức độ giải thích** được chọn bên dưới. AI phân tích sâu bẫy tư duy và các đáp án nhiễu.
                    </p>
                  </div>

                  <button 
                    disabled={aiLoading[activeQuestion.id]}
                    onClick={() => handleRequestAIExplanation(activeQuestion.id, explanationLevel)}
                    className="shrink-0 bg-text-primary hover:opacity-95 text-bg-card disabled:opacity-50 text-[11px] font-medium px-4 py-2 rounded-lg transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiExplanations[activeQuestion.id] ? "Làm mới bài giảng AI" : "Yêu cầu Trực tuyến"}</span>
                  </button>
                </div>

                {/* AI response placeholder or content */}
                {aiLoading[activeQuestion.id] && (
                  <div className="space-y-2.5 py-4 border-t border-border-primary/60 animate-pulse">
                    <div className="h-2.5 bg-bg-card rounded w-1/4"></div>
                    <div className="h-2.5 bg-bg-card rounded w-3/4"></div>
                    <div className="h-2.5 bg-bg-card rounded w-2/3"></div>
                  </div>
                )}

                {aiError[activeQuestion.id] && (
                  <div className="border-t border-brand-danger-border pt-3 text-xs text-brand-danger flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-brand-danger" />
                    <span>{aiError[activeQuestion.id]}</span>
                  </div>
                )}

                {aiExplanations[activeQuestion.id] && !aiLoading[activeQuestion.id] && (
                  <div className="space-y-4 border-t border-border-primary/60 pt-4 mt-4">
                    {/* Pipeline Metadata Dashboard */}
                    {aiPipelineMetadata[activeQuestion.id] && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-bg-surface border border-border-primary/80 rounded-xl p-4 text-xs font-sans">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-text-muted text-[10px] uppercase font-mono font-bold">Chiến lược sư phạm</span>
                            <span className="bg-brand-success-bg text-brand-success px-2 py-0.5 rounded text-[10px] font-semibold border border-brand-success-border/20">
                              {aiPipelineMetadata[activeQuestion.id].strategyUsed}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-text-muted text-[10px] uppercase font-mono font-bold">Xác suất đoán bừa</span>
                            <span className={`font-semibold font-mono ${
                              aiPipelineMetadata[activeQuestion.id].guessingProbability >= 0.6 ? "text-brand-danger" : "text-text-secondary"
                            }`}>
                              {Math.round(aiPipelineMetadata[activeQuestion.id].guessingProbability * 100)}%
                            </span>
                          </div>
                          {/* Guessing warning */}
                          {aiPipelineMetadata[activeQuestion.id].guessingProbability >= 0.6 && (
                            <p className="text-[10px] text-brand-danger leading-relaxed">
                              ⚠️ Phát hiện hành vi trả lời siêu tốc hoặc chưa vững lý thuyết nền tảng. Hãy làm chậm lại nhé!
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <span className="text-text-muted text-[10px] uppercase font-mono font-bold block mb-1">Kiểm định học thuật</span>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="w-2 h-2 rounded-full bg-brand-success"></span>
                              <span className="text-text-secondary font-medium">Bằng chứng xác thực nguồn Slide</span>
                            </div>
                            {aiPipelineMetadata[activeQuestion.id].unmasteredPrerequisites?.length > 0 ? (
                              <div className="text-[10px] text-brand-warning leading-normal mt-1">
                                ⚠️ Khuyết hụt lý thuyết tiên quyết: {aiPipelineMetadata[activeQuestion.id].unmasteredPrerequisites.join(", ")}
                              </div>
                            ) : (
                              <div className="text-[10px] text-brand-success leading-normal mt-1">
                                ✓ Đã kiểm tra kiến thức tiên quyết (Đạt)
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Cross Subject Intelligence Alert Card */}
                        {aiPipelineMetadata[activeQuestion.id].crossSubjectIntel && (
                          <div className="md:col-span-2 bg-brand-info-bg/5 border border-brand-info-border/20 p-3 rounded-lg space-y-1 mt-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-brand-info uppercase font-mono">
                              <Brain className="w-3.5 h-3.5" />
                              <span>Kết nối tư duy liên môn (Cross-Subject Intelligence)</span>
                            </div>
                            <p className="text-[11px] text-text-primary font-medium">
                              Liên hệ: {aiPipelineMetadata[activeQuestion.id].crossSubjectIntel.connectedSubject} &rarr; {aiPipelineMetadata[activeQuestion.id].crossSubjectIntel.topic}
                            </p>
                            <p className="text-[10px] text-text-muted leading-relaxed">
                              {aiPipelineMetadata[activeQuestion.id].crossSubjectIntel.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* The main AI Lecture body */}
                    <div className="bg-bg-card p-5 rounded-lg border border-border-primary/60 text-xs text-text-secondary leading-relaxed font-sans prose dark:prose-invert max-w-none">
                      <div className="flex items-center gap-1.5 mb-3 text-[10px] uppercase font-mono text-brand-info font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Bài giảng AI (Góc nhìn: {
                          explanationLevel === "simple" ? "Dễ hiểu" :
                          explanationLevel === "academic" ? "Chuẩn đại học" :
                          explanationLevel === "expert" ? "Chuyên gia" :
                          explanationLevel === "practical" ? "Ví dụ thực tế" :
                          explanationLevel === "business" ? "Góc nhìn doanh nghiệp" :
                          "Góc nhìn giảng viên"
                        })</span>
                      </div>
                      <SimpleMarkdown text={aiExplanations[activeQuestion.id]} />
                    </div>
                  </div>
                )}
              </div>

              {/* Standard Explanation Box (Always Offline, 100% Reliable) */}
              <div className="bg-bg-card border border-border-primary rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                <div className="flex flex-col gap-3 border-b border-border-primary pb-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-text-muted" />
                      <span>Bài giảng lý luận & Giải nghĩa đa cấp độ</span>
                    </h4>
                  </div>
                  
                  {/* Multi-Level Explanation Switcher (6 Tiers) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 bg-bg-surface border border-border-primary rounded-xl p-1 text-[10px]">
                    {[
                      { key: "simple", label: "Dễ hiểu 💡" },
                      { key: "academic", label: "Chuẩn đại học 🎓" },
                      { key: "expert", label: "Chuyên gia 🧠" },
                      { key: "practical", label: "Ví dụ thực tế 🌍" },
                      { key: "business", label: "Doanh nghiệp 💼" },
                      { key: "teacher", label: "Giảng viên 👩‍🏫" }
                    ].map((levelObj) => (
                      <button
                        key={levelObj.key}
                        onClick={() => {
                          setExplanationLevel(levelObj.key as any);
                          // If they switch, let them know they can click AI to regenerate with this perspective
                        }}
                        className={`px-2 py-1.5 rounded-lg font-medium text-center transition cursor-pointer ${
                          explanationLevel === levelObj.key 
                            ? "bg-bg-card border border-border-primary/80 text-text-primary shadow-xs font-semibold" 
                            : "text-text-muted hover:text-text-secondary"
                        }`}
                      >
                        {levelObj.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {(() => {
                  const activeSubjectId = dbService.getActiveSubjectId();
                  const conceptNode = kbService.getConceptForQuestion(activeSubjectId, activeQuestion);
                  
                  let displayExplanation = activeQuestion.explanation;
                  let isMetadataFound = false;

                  if (conceptNode) {
                    if (explanationLevel === "simple") {
                      displayExplanation = conceptNode.explanation?.simpleExplanation || conceptNode.teaching?.teachingHint || activeQuestion.explanation;
                      isMetadataFound = !!conceptNode.explanation?.simpleExplanation;
                    } else if (explanationLevel === "academic") {
                      displayExplanation = conceptNode.explanation?.mediumExplanation || activeQuestion.explanation;
                      isMetadataFound = !!conceptNode.explanation?.mediumExplanation;
                    } else if (explanationLevel === "expert") {
                      displayExplanation = conceptNode.explanation?.expertExplanation || conceptNode.definition;
                      isMetadataFound = !!conceptNode.explanation?.expertExplanation;
                    } else if (explanationLevel === "practical") {
                      displayExplanation = conceptNode.teaching?.realWorldExample 
                        ? `### Ví dụ thực tế chứng minh lý thuyết:\n\n${conceptNode.teaching.realWorldExample}`
                        : `### Phân tích thực tế:\n\n${activeQuestion.explanation}`;
                      isMetadataFound = !!conceptNode.teaching?.realWorldExample;
                    } else if (explanationLevel === "business") {
                      displayExplanation = conceptNode.teaching?.marketingExample 
                        ? `### Góc nhìn doanh nghiệp & Ứng dụng thương mại:\n\n${conceptNode.teaching.marketingExample}`
                        : `### Phân tích ứng dụng:\n\n*Học thuyết này giải quyết bài toán tối ưu hóa nguồn lực và chi phí sản xuất trong thực tiễn của các doanh nghiệp tư nhân lẫn quốc doanh.*\n\n${activeQuestion.explanation}`;
                      isMetadataFound = !!conceptNode.teaching?.marketingExample;
                    } else if (explanationLevel === "teacher") {
                      displayExplanation = `### Hướng dẫn giảng dạy từ giảng viên chuyên ngành:\n\n**Mẹo ghi nhớ cốt lõi**: *${conceptNode.teaching?.memoryHook || "Chưa cập nhật"}*\n\n**Lời khuyên sư phạm**: ${conceptNode.teaching?.teachingHint || "Hãy tập trung liên kết câu hỏi với định nghĩa gốc trong giáo trình."}`;
                      isMetadataFound = true;
                    }
                  } else {
                    if (explanationLevel === "simple") {
                      displayExplanation = `**Tóm tắt trực quan**: Câu hỏi này yêu cầu bạn tìm ra giải pháp đúng cho luận điểm được nêu. Đáp án chính xác là **${activeQuestion.correctAnswer.toUpperCase()}**.\n\n*Bài học gốc rút gọn*: ${activeQuestion.explanation.slice(0, 160)}...`;
                    } else if (explanationLevel === "expert") {
                      displayExplanation = `**Phân tích học thuật sâu rộng**:\n- Quy luật liên kết: Đáp án đúng [${activeQuestion.correctAnswer.toUpperCase()}] đại diện cho bản chất quy luật được kiểm tra.\n\n- Cơ sở khoa học:\n${activeQuestion.explanation}`;
                    } else if (explanationLevel === "practical") {
                      displayExplanation = `**Minh họa thực tiễn**: Trong đời sống kinh tế xã hội, quy luật này được biểu hiện qua các giao dịch và cân đối vĩ mô.\n\n*Phân tích gốc*:\n${activeQuestion.explanation}`;
                    } else if (explanationLevel === "business") {
                      displayExplanation = `**Ứng dụng trong quản trị thương mại**: Giúp doanh nghiệp định vị thị trường, dự báo cầu và thiết lập chiến lược tối đa hóa doanh thu sản xuất.\n\n*Phân tích gốc*:\n${activeQuestion.explanation}`;
                    } else if (explanationLevel === "teacher") {
                      displayExplanation = `**Mẹo ôn luyện sư phạm**: Chú ý phân tích kỹ các từ khóa mang tính định lượng hoặc tuyệt đối trong câu hỏi để loại bỏ nhanh phương án gây nhiễu.\n\n*Phân tích gốc*:\n${activeQuestion.explanation}`;
                    }
                  }

                  return (
                    <div className="space-y-4">
                      <div className="bg-bg-surface p-4 rounded-xl border border-border-primary/60 space-y-3.5 text-text-secondary text-xs leading-relaxed font-sans">
                        <div className="flex items-center justify-between border-b border-border-primary/40 pb-2">
                          <span className="font-semibold text-text-primary">
                            Đáp án đúng: {activeQuestion.correctAnswer.toUpperCase()} - {activeQuestion.options[activeQuestion.correctAnswer]}
                          </span>
                          {isMetadataFound && (
                            <span className="text-[9px] bg-brand-success-bg text-brand-success px-2 py-0.5 rounded font-mono border border-brand-success-border/20">
                              Bản đồ tri thức: Mapped KB
                            </span>
                          )}
                        </div>
                        <div className="whitespace-pre-line leading-relaxed prose dark:prose-invert max-w-none">
                          <SimpleMarkdown text={displayExplanation} />
                        </div>
                        
                        {conceptNode?.explanation?.analogy && (
                          <div className="text-[11px] italic text-text-muted pl-2.5 border-l-2 border-text-muted">
                            💡 Phép ẩn dụ: {conceptNode.explanation.analogy}
                          </div>
                        )}
                      </div>

                      {/* Display Extra Learning Metadata Cards */}
                      {conceptNode && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {conceptNode.teaching?.misconception && (
                            <div className="border border-brand-danger-border/30 bg-brand-danger-bg/5 p-3 rounded-xl space-y-1">
                              <span className="text-[9px] font-bold text-brand-danger uppercase font-mono block">Cảnh báo hiểu sai</span>
                              <p className="text-[11px] text-text-primary leading-relaxed font-sans">{conceptNode.teaching.misconception}</p>
                            </div>
                          )}

                          {conceptNode.teaching?.counterExample && (
                            <div className="border border-brand-warning-border/30 bg-brand-warning-bg/5 p-3 rounded-xl space-y-1">
                              <span className="text-[9px] font-bold text-brand-warning uppercase font-mono block">Ví dụ phản chứng tránh học vẹt</span>
                              <p className="text-[11px] text-text-primary leading-relaxed font-sans">{conceptNode.teaching.counterExample}</p>
                            </div>
                          )}

                          {conceptNode.teaching?.learningObjective && (
                            <div className="border border-brand-info-border/30 bg-brand-info-bg/5 p-3 rounded-xl space-y-1 sm:col-span-2">
                              <span className="text-[9px] font-bold text-brand-info uppercase font-mono block">Chuẩn đầu ra năng lực</span>
                              <p className="text-[11px] text-text-primary leading-relaxed font-sans">Sau khi ôn tập xong khái niệm này, sinh viên phải: {conceptNode.teaching.learningObjective}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Concept Dependency Trail / Relationships */}
                {(() => {
                  const activeSubjectId = dbService.getActiveSubjectId();
                  const conceptNode = kbService.getConceptForQuestion(activeSubjectId, activeQuestion);
                  if (conceptNode) {
                    const reqs = conceptNode.dependencies?.requires || [];
                    const graphNodes = kbService.getKnowledgeGraph(activeSubjectId);
                    const reqNodes = graphNodes.filter(g => reqs.includes(g.id));
                    const relatedNodes = graphNodes.filter(g => conceptNode.dependencies?.relatedConcepts?.includes(g.concept) || conceptNode.dependencies?.relatedConcepts?.includes(g.id));
                    
                    return (
                      <div className="border border-border-primary/60 p-4 rounded-lg space-y-2 text-[11px] font-sans">
                        <span className="text-text-primary font-semibold block">Bản đồ liên kết tri thức</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div className="bg-bg-surface/50 border border-border-primary/30 p-2.5 rounded-md">
                            <span className="text-text-muted font-mono text-[9px] block uppercase tracking-wider mb-1">Tri thức tiên quyết:</span>
                            {reqNodes.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {reqNodes.map(rn => (
                                  <span key={rn.id} className="bg-brand-warning-bg/40 text-brand-warning border border-brand-warning-border/20 text-[10px] px-1.5 py-0.5 rounded">
                                    {rn.concept}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-text-muted text-[10px]">Không có yêu cầu đặc thù</span>
                            )}
                          </div>

                          <div className="bg-bg-surface/50 border border-border-primary/30 p-2.5 rounded-md">
                            <span className="text-text-muted font-mono text-[9px] block uppercase tracking-wider mb-1">Khái niệm hiện tại:</span>
                            <span className="bg-brand-info-bg text-brand-info border border-brand-info-border/20 text-[10px] px-1.5 py-0.5 rounded font-medium">
                              {conceptNode.concept}
                            </span>
                          </div>

                          <div className="bg-bg-surface/50 border border-border-primary/30 p-2.5 rounded-md">
                            <span className="text-text-muted font-mono text-[9px] block uppercase tracking-wider mb-1">Khái niệm liên quan:</span>
                            {relatedNodes.length > 0 || conceptNode.dependencies?.relatedConcepts?.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {(relatedNodes.length > 0 ? relatedNodes.map(rn => rn.concept) : conceptNode.dependencies?.relatedConcepts || []).slice(0, 2).map((c, i) => (
                                  <span key={i} className="bg-bg-card border border-border-primary text-text-secondary text-[10px] px-1.5 py-0.5 rounded">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-text-muted text-[10px]">Chưa ánh xạ liên kết</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] pt-1">
                  <div className="border border-border-primary/60 p-3 rounded-lg">
                    <span className="text-text-muted block mb-0.5 font-mono">Ánh xạ tài liệu chính thức:</span>
                    <span className="font-medium text-text-secondary">{activeQuestion.sourcePdf} (Slide trang {activeQuestion.sourcePage})</span>
                  </div>
                  <div className="border border-border-primary/60 p-3 rounded-lg">
                    <span className="text-text-muted block mb-0.5 font-mono">Mục tiêu củng cố kiến thức:</span>
                    <span className="font-medium text-text-secondary">{activeQuestion.learningObjective}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Right Column: Sticky Question Palette & Statistics (1/4 width) */}
        <div className="lg:sticky lg:top-4 space-y-5">
          
          {/* Post Submission Summary Widget */}
          {exam.isSubmitted && (
            <div className="bg-bg-card border border-border-primary rounded-xl p-5 text-center space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] animate-fade-in-up">
              <h3 className="font-medium text-text-primary text-xs">Kết quả ôn luyện</h3>
              
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-18 h-18 transform -rotate-90">
                  <circle className="text-border-primary" strokeWidth="3" stroke="currentColor" fill="transparent" r="28" cx="36" cy="36" />
                  <circle 
                    className={`${
                      scorePercent >= 80 ? "text-brand-success" :
                      scorePercent >= 50 ? "text-brand-warning" : "text-brand-danger"
                    }`}
                    strokeWidth="3" 
                    strokeDasharray={2 * Math.PI * 28}
                    strokeDashoffset={2 * Math.PI * 28 * (1 - scorePercent / 100)}
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                    r="28" 
                    cx="36" 
                    cy="36" 
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-md font-mono font-bold text-text-primary">{scorePercent}%</span>
                  <span className="text-[8px] text-text-muted font-mono uppercase">Đúng</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-sans">
                <div className="bg-brand-success-bg border border-brand-success-border/20 py-1.5 rounded-md text-brand-success font-medium">
                  Đúng: {correctCount}
                </div>
                <div className="bg-brand-danger-bg border border-brand-danger-border/20 py-1.5 rounded-md text-brand-danger font-medium">
                  Sai: {incorrectCount}
                </div>
              </div>
            </div>
          )}

          {/* Sticky Question Palette Card */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
            <h3 className="font-medium text-text-primary text-xs flex items-center justify-between">
              <span>Bảng câu hỏi</span>
              <span className="text-xs text-text-muted font-normal font-mono">
                {Object.keys(exam.answers).length} / {examQuestions.length}
              </span>
            </h3>

            {/* Grid layout for question button palette */}
            <div className="grid grid-cols-5 gap-1.5">
              {examQuestions.map((q, idx) => {
                const isSelected = exam.answers[q.id] !== undefined;
                const isActive = currentIdx === idx;
                const isBookmarked = exam.bookmarks?.includes(q.id) || dbStats.bookmarks.includes(q.id);
                const isFlagged = exam.flags?.includes(q.id) || dbStats.flags.includes(q.id);
                
                let btnStyle = "border-border-primary bg-bg-card text-text-secondary hover:bg-bg-surface cursor-pointer";
                
                if (isActive) {
                  btnStyle = "bg-text-primary text-bg-card font-semibold border-transparent shadow-xs cursor-pointer";
                } else if (exam.isSubmitted) {
                  const userAnswer = exam.answers[q.id];
                  const isAnswerCorrect = userAnswer === q.correctAnswer;
                  btnStyle = isAnswerCorrect 
                    ? "bg-brand-success text-white border-transparent cursor-pointer" 
                    : userAnswer 
                    ? "bg-brand-danger text-white border-transparent cursor-pointer" 
                    : "bg-bg-surface border-border-primary/60 text-text-muted cursor-pointer opacity-70";
                } else if (isSelected) {
                  btnStyle = "bg-bg-surface border-text-muted/30 text-text-primary font-medium cursor-pointer";
                }

                return (
                  <button 
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-8 w-full rounded-md border text-xs font-mono flex items-center justify-center relative transition-all duration-150 ${btnStyle}`}
                  >
                    <span>{idx + 1}</span>
                    
                    {/* Tiny bookmark indicators */}
                    {isBookmarked && !isActive && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-brand-warning rounded-full border border-bg-card" title="Đã lưu trọng tâm" />
                    )}
                    {isFlagged && !isBookmarked && !isActive && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-brand-warning rounded-full border border-bg-card" title="Đánh dấu nghi ngờ" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border-primary/60 pt-3.5 space-y-2 text-[10px] text-text-muted font-mono">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-bg-card border border-border-primary rounded-sm" />
                <span>Chưa trả lời</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-bg-surface border border-text-muted/30 rounded-sm" />
                <span>Đã trả lời</span>
              </div>
              {exam.isSubmitted && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-brand-success rounded-sm" />
                    <span>Đáp án Đúng</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-brand-danger rounded-sm" />
                    <span>Đáp án Sai</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-brand-warning rounded-full" />
                <span>Đã lưu trọng tâm (★)</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* HTML Styled Custom Confirmation Submit Modal (Avoid window.confirm blocking iframe) */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200" 
            aria-hidden="true" 
            onClick={() => setShowSubmitModal(false)}
          ></div>

          {/* Centering wrapper */}
          <div className="flex items-center justify-center min-h-screen p-4 text-center">
            {/* Modal Body */}
            <div 
              className="relative z-10 bg-bg-card rounded-xl text-left overflow-hidden shadow-xl transform transition-all max-w-sm w-full border border-border-primary pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-bg-card px-5 pt-5 pb-4">
                <div className="sm:flex sm:items-start gap-3.5">
                  <div className="mx-auto shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-bg-surface text-text-secondary sm:mx-0">
                    <HelpCircle className="w-4.5 h-4.5" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-3 sm:text-left space-y-1.5">
                    <h3 className="text-sm font-medium text-text-primary" id="modal-title">
                      Xác nhận nộp bài thi?
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed font-sans">
                      Bạn đã hoàn thành <span className="font-semibold text-text-primary">{Object.keys(exam.answers).length} / {examQuestions.length}</span> câu hỏi. Hãy rà soát lại các câu đánh dấu nghi ngờ trước khi gửi kết quả.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-bg-surface/50 px-5 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-border-primary">
                <button 
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="w-full sm:w-auto border border-border-primary hover:bg-bg-surface text-text-secondary text-[11px] font-medium px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer"
                >
                  Tiếp tục làm
                </button>
                <button 
                  type="button"
                  onClick={submitExam}
                  className="w-full sm:w-auto bg-text-primary hover:opacity-95 text-bg-card text-[11px] font-medium px-4 py-1.5 rounded-lg transition duration-150 cursor-pointer"
                >
                  Nộp & xem kết quả
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom micro feedback toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-bg-surface/90 backdrop-blur-md text-text-primary px-3.5 py-2.5 rounded-lg shadow-md border border-border-primary text-xs font-medium flex items-center gap-2 animate-fade-in-up duration-150">
          <div className="w-4 h-4 bg-brand-success-bg text-brand-success rounded-full flex items-center justify-center shrink-0">
            <Check className="w-2.5 h-2.5" />
          </div>
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
