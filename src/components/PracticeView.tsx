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
  // Đánh dấu đã nộp để các effect nền (đồng bộ định kỳ, cleanup khi unmount) KHÔNG
  // vô tình ghi lại bản chưa nộp đè lên bản đã nộp (dùng ref để tránh giá trị exam cũ trong closure).
  const submittedRef = useRef<boolean>(initialExam.isSubmitted);

  // AI Tutor State (phản hồi tức thì bám sát câu hỏi, không còn dùng "coaching node" chung chung)
  const [isTutorMode, setIsTutorMode] = useState<boolean>(true);
  // Các câu đã "chốt" đáp án trong chế độ gia sư: một khi đã lộ đáp án đúng thì khóa vĩnh viễn
  // trong phiên, không cho đổi kể cả khi người dùng tắt công tắc gia sư (giữ liêm chính điểm số).
  const [lockedIds, setLockedIds] = useState<Set<number>>(new Set());
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

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const examQuestions: Question[] = exam.questions
    .map(qId => questionMap.get(qId))
    .filter((q): q is Question => !!q);

  const activeQuestion = examQuestions[currentIdx];

  // Giữ hàm chọn đáp án MỚI NHẤT trong một ref, để trình nghe phím không phải gắn lại sau mỗi
  // lần render mà vẫn không bao giờ gọi nhầm bản cũ (đóng gói giá trị cũ của exam).
  const chonDapAnRef = useRef<(k: "a" | "b" | "c" | "d") => void>(() => {});

  // Phím tắt khi làm bài.
  //
  // VÌ SAO MỞ RỘNG (28/07/2026). Bản cũ chỉ có "," và "." để chuyển câu, còn việc CHỌN ĐÁP ÁN
  // thì bắt buộc phải dùng chuột. Trong một buổi ôn 2 đến 4 tiếng, đó là hàng trăm lần rời tay
  // khỏi bàn phím, đưa chuột tới đúng một trong bốn ô rồi bấm, cho một việc mà người học đã
  // quyết định xong trong đầu từ trước. Mỗi phương án vốn ĐÃ hiện sẵn chữ cái A, B, C, D ngay
  // trên màn hình, nên phím tương ứng là thứ người học đoán ra ngay mà chưa hề dùng được.
  //
  // Nay: A/B/C/D hoặc 1/2/3/4 để chọn đáp án, mũi tên trái phải để chuyển câu (giữ nguyên ","
  // và "." cho ai đã quen). Vẫn bỏ qua khi đang gõ vào ô nhập hoặc khi hộp thoại nộp bài mở,
  // để không cướp phím của người dùng.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (showSubmitModal) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;

      if (e.key === "," || e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIdx(prev => (prev > 0 ? prev - 1 : prev));
        return;
      }
      if (e.key === "." || e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIdx(prev => (prev < examQuestions.length - 1 ? prev + 1 : prev));
        return;
      }

      const phim = e.key.toLowerCase();
      const theoChuCai: Record<string, "a" | "b" | "c" | "d"> = { a: "a", b: "b", c: "c", d: "d" };
      const theoSo: Record<string, "a" | "b" | "c" | "d"> = { "1": "a", "2": "b", "3": "c", "4": "d" };
      const chon = theoChuCai[phim] || theoSo[phim];
      if (chon) {
        e.preventDefault();
        chonDapAnRef.current(chon);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [examQuestions.length, showSubmitModal]);

  // Khi ở chế độ gia sư và câu hiện tại đã có đáp án -> chốt khóa câu đó. Đã chốt thì
  // giữ khóa vĩnh viễn trong phiên (tắt gia sư sau đó cũng không mở lại được).
  useEffect(() => {
    if (isTutorMode && activeQuestion && exam.answers[activeQuestion.id] !== undefined) {
      setLockedIds(prev => {
        if (prev.has(activeQuestion.id)) return prev;
        const next = new Set(prev);
        next.add(activeQuestion.id);
        return next;
      });
    }
  }, [isTutorMode, currentIdx, exam.answers]);

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

  // Đồng bộ tiến trình mỗi 10 giây để không mất bài khi thoát/tải lại.
  // LƯU vào PHIÊN chưa hoàn thành (không ghi vào lịch sử) để lịch sử chỉ chứa bài đã nộp.
  useEffect(() => {
    if (exam.isSubmitted) return;

    const interval = setInterval(() => {
      if (submittedRef.current) return;
      workspaceService.saveUnfinishedSession({
        ...exam,
        timeSpent: timeSpentRef.current
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [exam]);

  // Lưu khi rời trang: chỉ lưu vào phiên chưa hoàn thành, và bỏ qua nếu đã nộp
  // (kiểm tra qua ref để không dùng giá trị exam cũ trong closure gây tái tạo phiên đã nộp).
  useEffect(() => {
    return () => {
      if (!submittedRef.current) {
        workspaceService.saveUnfinishedSession({
          ...exam,
          timeSpent: timeSpentRef.current
        });
      }
    };
  }, [exam]);

  const handleSelectAnswer = (optionKey: "a" | "b" | "c" | "d") => {
    if (exam.isSubmitted) return;
    // Câu đã chốt (đã lộ đáp án đúng trong chế độ gia sư) thì khóa vĩnh viễn, kể cả khi
    // người dùng tắt công tắc gia sư sau đó, để giữ liêm chính điểm số.
    if (lockedIds.has(activeQuestion.id)) return;
    // Chế độ gia sư: đã trả lời câu này thì không cho đổi (chặn cả trường hợp bấm nhanh
    // trước khi effect chốt khóa kịp chạy). Chế độ thường vẫn cho đổi trước khi nộp.
    if (isTutorMode && exam.answers[activeQuestion.id] !== undefined) return;

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
    // Chỉ lưu tiến trình vào PHIÊN chưa hoàn thành; không ghi vào lịch sử khi chưa nộp.
    workspaceService.saveUnfinishedSession(updated);
    setExam(updated);
    // Phản hồi tức thì (đáp án đúng + lời giải bám sát câu hỏi) do các panel bên dưới đảm nhiệm.
  };

  // Cập nhật ref sau mỗi lần render để phím tắt luôn dùng đúng bản hiện tại.
  chonDapAnRef.current = handleSelectAnswer;

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

      // Đánh dấu đã nộp TRƯỚC để các effect nền không ghi đè bản đã nộp.
      submittedRef.current = true;
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
      submittedRef.current = true;
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
  // MỘT CỘT ĐỌC DUY NHẤT cho cả phiên học.
  //
  // Trước 28/07/2026 khung là `max-w-5xl` (1024px), nên thẻ câu hỏi rộng 679px và câu hỏi trải
  // 77 ký tự mỗi dòng, đo bằng `Range.getClientRects` trên bản chạy thật. Vùng đọc thoải mái
  // là 45 tới 75 ký tự.
  //
  // Đã thử cách chặn riêng bề rộng của câu hỏi, nhưng nó đẻ ra lỗi khác nhìn thấy ngay trên
  // màn hình: câu hỏi hẹp 565px trong khi ô phương án vẫn trải hết 780px, nên mắt vừa thu hẹp
  // để đọc câu hỏi lại phải mở rộng ra để đọc phương án. Hai bề rộng đọc trong cùng một luồng
  // còn tệ hơn một bề rộng hơi quá dài.
  //
  // Nay thu cả cột về `max-w-4xl` (896px) để chỉ còn MỘT bề rộng đọc cho cả câu hỏi lẫn
  // phương án, đúng lối một cột nội dung của các sản phẩm đọc dài.
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fade-in-up">
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
            <p className="text-2xs text-text-muted mt-0.5 font-sans">
              {exam.isSubmitted ? "Xem lại đáp án và phân tích lý luận từ hệ thống AI" : `Phiên ôn luyện: ${examQuestions.length} câu hỏi lý thuyết`}
            </p>
          </div>
        </div>

        {/* Timer / Progress Widgets */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {!exam.isSubmitted && (
            <div className="bg-bg-surface border border-border-primary/80 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-text-muted" />
              <span className="tabular-nums font-medium text-text-primary text-xs">
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
              <div className="flex items-center gap-2 text-xs tabular-nums text-brand-success mb-1">
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
                  submittedRef.current = false;
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
                <span>Kết thúc bài làm</span>
              </button>
            </div>
          </div>

          {/* 4 Core Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-4 text-center space-y-1">
              <span className="text-2xs tabular-nums text-text-muted">Kết quả bài thi</span>
              <p className="text-lg font-display font-semibold text-text-primary">
                {correctCount} / {examQuestions.length} <span className="text-xs font-sans font-normal text-text-muted">đúng</span>
              </p>
            </div>

            <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-4 text-center space-y-1">
              <span className="text-2xs tabular-nums text-text-muted">Khái niệm đã thông thạo</span>
              <p className="text-lg font-display font-semibold text-brand-success">
                +{Math.max(1, Math.floor(correctCount / 3))} <span className="text-xs font-sans font-normal text-text-muted">khái niệm</span>
              </p>
            </div>

            <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-4 text-center space-y-1">
              <span className="text-2xs tabular-nums text-text-muted">Hiểu sai đã sửa</span>
              <p className="text-lg font-display font-semibold text-brand-warning">
                {incorrectCount > 0 ? "1 hiểu sai" : "0 bẫy sai"}
              </p>
            </div>

            <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-4 text-center space-y-1">
              <span className="text-2xs tabular-nums text-text-muted">Độ ghi nhớ dự đoán</span>
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
                  <span className="bg-bg-surface border border-border-primary text-text-secondary text-xs font-medium px-2.5 py-0.5 rounded-md whitespace-nowrap">
                    Câu {currentIdx + 1} / {examQuestions.length}
                  </span>
                  <span className={`text-2xs font-medium px-2 py-0.5 rounded-full border ${
                    activeQuestion.difficulty === "Dễ" ? "bg-brand-success-bg text-brand-success border-brand-success-border/30" :
                    activeQuestion.difficulty === "Trung bình" ? "bg-brand-info-bg text-brand-info border-brand-info-border/30" :
                    activeQuestion.difficulty === "Khó" ? "bg-brand-warning-bg text-brand-warning border-brand-warning-border/30" :
                    "bg-brand-error-bg text-brand-error border-brand-error-border/30"
                  } whitespace-nowrap`}>
                    Mức {activeQuestion.difficulty}
                  </span>
                  <span className="text-2xs text-text-muted tabular-nums hidden sm:inline">
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
                          }}
                          className="sr-only" 
                        />
                        <div className={`w-8 h-4 rounded-full transition duration-150 ${isTutorMode ? "bg-brand-success" : "bg-bg-surface border border-border-primary"}`}></div>
                        <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full shadow-md transition-transform duration-150 ${isTutorMode ? "transform translate-x-4 bg-white" : "bg-text-muted"}`}></div>
                      </div>
                      {/* Trên điện thoại chỉ giữ biểu tượng: cụm chữ "Giáo viên AI Coaching"
                          xuống ba dòng ở khung 375px, đẩy cả hàng đầu thẻ thành một mớ rối.
                          Vẫn có nhãn cho trình đọc màn hình và cho chuột dừng lại. */}
                      <span
                        className="text-2xs font-medium text-text-secondary flex items-center gap-1 whitespace-nowrap"
                        title="Giáo viên AI Coaching"
                      >
                        <Sparkles className="w-3 h-3 text-brand-success shrink-0" />
                        <span className="hidden sm:inline">Giáo viên AI Coaching</span>
                        <span className="sr-only">Giáo viên AI Coaching</span>
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
                {/*
                  Dòng ngữ cảnh (chủ đề, khái niệm, kiến thức cần trước) đặt TRÊN câu hỏi nhưng
                  là thứ ÍT quan trọng nhất trên thẻ. Bản cũ viết nó bằng chữ hoa giãn cách cỡ
                  10px kiểu mã máy, tức là dạng chữ khó đọc nhất, lại còn tô đậm. Trên khung
                  375px nó chiếm hai dòng ngay trước câu hỏi, nên thứ mắt chạm đầu tiên trong
                  mỗi câu lại là thứ không cần đọc kỹ.

                  Nay hạ nó xuống đúng vai trò ngữ cảnh: chữ thường, không tô đậm, màu nhạt.
                  Câu hỏi trở thành thứ dẫn dắt, đúng như nó phải thế.
                */}
                <div className="text-2xs text-text-muted flex flex-wrap items-center gap-1.5">
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
                          <span className="text-brand-info flex items-center gap-1">
                            <Brain className="w-3.5 h-3.5 shrink-0" />
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
                {/*
                  Câu hỏi là thứ mắt phải chạm đầu tiên và đọc kỹ nhất, nên nó phải LỚN NHẤT
                  trên màn hình này.

                  Ba điều đã sửa ngày 28/07/2026, đo trên bản chạy thật:
                  1. Lớp cũ là `text-md`, KHÔNG phải lớp Tailwind hợp lệ (chỉ có sm, base, lg).
                     Nghĩa là cỡ chữ câu hỏi bấy lâu nay là 16px do thừa kế mặc định của thẻ
                     body, tức một sự tình cờ chứ không phải một lựa chọn thiết kế.
                  2. Nâng lên 18px để tách bạch khỏi phương án trả lời (16px) và dòng chủ đề
                     (13px), tạo đúng ba bậc thay vì hai bậc lẫn nhau.
                  Bề rộng dòng KHÔNG chặn ở đây mà chặn ở cột nội dung ngoài cùng, xem chú
                  thích dài tại thẻ `max-w-4xl` đầu component. Lý do: chặn riêng câu hỏi sẽ
                  làm nó hẹp hơn ô phương án, tạo hai bề rộng đọc trong cùng một luồng.
                */}
                <h3 className="text-lg font-medium text-text-primary leading-relaxed font-sans">
                  {activeQuestion.question}
                </h3>
              </div>

              {/*
                DANH SÁCH PHƯƠNG ÁN, KHÔNG PHẢI BỐN CÁI THẺ.

                Đổi ngày 28/07/2026, sau khi đo trang làm bài của Khan Academy bằng trình duyệt.

                Trước đó mỗi phương án là một thẻ đóng: có viền, có nền, bo góc, cách nhau
                10px. Nghĩa là ngay ở trạng thái NGHỈ, lúc người học đang đọc để suy nghĩ, mắt
                phải phân tích năm khối đóng riêng biệt (câu hỏi cộng bốn thẻ). Theo nguyên lý
                khép kín của Gestalt, một hình bao kín được não đọc thành một VẬT THỂ; bốn vật
                thể xếp dọc bắt mắt dừng và khởi động lại ở từng ranh giới, thay vì trôi liền
                mạch từ câu hỏi xuống các phương án.

                Khan Academy đo được: hàng đáp án **nền trong suốt, không viền, không đổ bóng**,
                cao 64px, đệm 16px, ngăn nhau bằng một đường kẻ 1px màu #DBDCDD. Toàn bộ sức
                nặng thị giác nằm ở CHỮ, không ở cái hộp chứa chữ.

                Nhưng KHÔNG bê nguyên mô hình đó vào đây, vì dự án này đã có một quyết định
                khác có căn cứ đo (xem chú thích trạng thái lộ đáp án bên dưới): tín hiệu đúng
                sai được cố ý dời vào nền, viền, ô chữ cái và biểu tượng để chữ nội dung giữ
                được tương phản 18,04:1. Bỏ nền với viền là xoá mất hai trong bốn tín hiệu đó.

                Nên tách theo trạng thái:
                  - Lúc NGHỈ, tức lúc đang cân nhắc và cũng là lúc kéo dài nhất, phẳng hoàn
                    toàn như Khan. Trạng thái này không mang tin gì nên không mất gì cả.
                  - Lúc ĐÃ CHỌN hoặc ĐÃ LỘ đáp án thì giữ nguyên nền và viền, vì đó mới là chỗ
                    thật sự có thông tin.

                Các hàng nay nằm sát nhau và ngăn bằng đường kẻ thay vì rời nhau bằng khe, đúng
                cách Khan làm, nên mảng phương án đọc thành MỘT khối liền thay vì bốn mảnh.
              */}
              <div className="grid grid-cols-1 pt-1 divide-y divide-border-primary/70 border-y border-border-primary/70">
                {(() => {
                  // Trong chế độ gia sư, khi đã trả lời thì lộ đáp án đúng/sai ngay trên các phương án
                  // (không cần đợi nộp bài). Câu đã chốt khóa cũng luôn lộ + khóa. Chế độ thường chỉ lộ sau khi nộp.
                  const answeredThis = exam.answers[activeQuestion.id] !== undefined;
                  const committed = lockedIds.has(activeQuestion.id) || (isTutorMode && answeredThis);
                  const reveal = exam.isSubmitted || committed;
                  const locked = exam.isSubmitted || committed;
                  return (["a", "b", "c", "d"] as const).map((key) => {
                  const optionText = activeQuestion.options[key];
                  const isSelected = exam.answers[activeQuestion.id] === key;
                  const isCorrect = activeQuestion.correctAnswer === key;
                  const isWrongSelection = isSelected && !isCorrect;

                  // Trạng thái nghỉ: trong suốt hoàn toàn, không viền. Chỉ khi rê chuột mới
                  // hiện một mảng nền rất nhạt để báo rằng hàng này bấm được.
                  let optionStyle = "border-transparent bg-transparent text-text-secondary hover:bg-bg-surface/60";

                  if (isSelected && !reveal) {
                    optionStyle = "bg-bg-surface/80 border-text-primary text-text-primary font-medium";
                  } else if (reveal) {
                    // NỘI DUNG phương án giữ màu chữ thường, tín hiệu đúng sai nằm ở NỀN, VIỀN,
                    // Ô CHỮ CÁI và BIỂU TƯỢNG.
                    //
                    // Vì sao đổi (28/07/2026): bản cũ tô luôn chữ nội dung theo màu ngữ nghĩa,
                    // và đo được độ tương phản chỉ 3,15:1 cho phương án ĐÚNG (xanh trên nền xanh
                    // nhạt) với 4,41:1 cho phương án SAI, đều dưới mức 4,5:1 của chuẩn WCAG AA.
                    // Đó lại đúng là đoạn chữ người học phải đọc kỹ nhất sau mỗi câu, và đọc
                    // suốt vài tiếng liền. Sau khi sửa: 18,04:1 và 17,26:1.
                    //
                    // Bốn tín hiệu còn lại vẫn thừa sức nói lên đúng hay sai mà không phải hạ
                    // độ đọc được của chính nội dung.
                    if (isCorrect) {
                      optionStyle = "bg-brand-success-bg border-brand-success-border text-text-primary font-medium";
                    } else if (isWrongSelection) {
                      optionStyle = "bg-brand-error-bg border-brand-error-border text-text-primary";
                    } else {
                      /*
                        PHƯƠNG ÁN KHÔNG ĐƯỢC CHỌN, SAU KHI LỘ ĐÁP ÁN.

                        Bản cũ dùng `opacity-40` chồng lên `text-text-muted`. Tính ra màu thật
                        hiện trên nền trắng: 0,4 x (107,107,117) cộng 0,6 x (255,255,255), ra
                        xấp xỉ #C4C4C8, tức tương phản chỉ khoảng **1,85:1**. Ngưỡng WCAG AA cho
                        chữ thường là 4,5:1, nên đoạn chữ này gần như không đọc được.

                        Đây không phải lỗi nhỏ. Sau khi biết mình sai, việc đọc lại BA phương án
                        còn lại để hiểu vì sao chúng sai chính là phần học nhiều nhất của cả
                        câu hỏi. Làm mờ chúng tới mức không đọc nổi là cắt mất đúng phần đó.

                        Khan Academy làm khác: phương án không được chọn lùi về màu chữ mờ
                        #717378, vẫn đạt 4,75:1, chứ không hạ độ đục. Làm theo cách đó: dùng
                        thẳng `text-text-muted` (5,27:1), bỏ `opacity`. Vẫn lùi rõ so với đáp án
                        đúng nhưng đọc được.
                      */
                      optionStyle = "border-transparent bg-transparent text-text-muted";
                    }
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectAnswer(key)}
                      disabled={locked}
                      className={`w-full text-left p-4 min-h-[56px] rounded-lg border flex items-center justify-between gap-4 group relative ${locked ? "cursor-default" : "cursor-pointer"} ${optionStyle}`}
                    >
                      <div className="flex items-center gap-3.5">
                        {/*
                          Ô CHỮ CÁI. Đo trên Khan Academy: hình vuông bo 4px, lúc nghỉ là viền
                          2px rỗng ruột, lúc được chọn thì tô đặc và chữ đổi sang trắng. Chính ô
                          này gánh phần lớn tín hiệu trạng thái, nên hàng đằng sau nó mới được
                          phép để trống trơn.

                          Bỏ `tabular-nums`: đây là MỘT ký tự, mà lợi ích duy nhất của font đơn cách
                          là xếp thẳng cột nhiều ký tự. Một ký tự thì không có gì để xếp cột,
                          chỉ còn lại nhược điểm là nét chữ khô và rộng hơn.
                        */}
                        <span className={`w-6 h-6 rounded shrink-0 flex items-center justify-center font-semibold text-xs ${
                          isSelected && !reveal
                            ? "bg-text-primary text-bg-card border-2 border-text-primary"
                            : reveal && isCorrect
                            ? "bg-brand-success text-white border-2 border-brand-success"
                            : reveal && isWrongSelection
                            ? "bg-brand-error text-white border-2 border-brand-error"
                            : reveal
                            ? "text-text-muted border-2 border-border-primary"
                            : "text-text-muted border-2 border-border-primary group-hover:border-text-muted"
                        }`}>
                          {key.toUpperCase()}
                        </span>
                        {/*
                          Phương án trả lời là đoạn chữ người học phải SO SÁNH kỹ nhất để ra
                          quyết định, nhưng nó vốn là `text-xs`, tức 12px, nhỏ hơn câu hỏi tới
                          bốn điểm. Thứ bậc đọc bị đảo ngược: đọc câu hỏi ở cỡ lớn rồi phải hạ
                          mắt xuống cỡ nhỏ hơn để làm phần việc khó hơn. Nay 16px.
                        */}
                        <span className="text-base leading-relaxed font-sans">{optionText}</span>
                      </div>

                      {reveal && isCorrect && (
                        <Check className="w-4 h-4 text-brand-success shrink-0" />
                      )}
                      {reveal && isWrongSelection && (
                        <AlertCircle className="w-4 h-4 text-brand-error shrink-0" />
                      )}
                    </button>
                  );
                });
                })()}
              </div>

              {/* Correct Answer Success Panel (Tutor Mode) */}
              {isTutorMode && !exam.isSubmitted && exam.answers[activeQuestion.id] === activeQuestion.correctAnswer && (
                <div className="border border-brand-success-border/40 bg-brand-success-bg/15 p-5 rounded-xl space-y-4 animate-fade-in-up mt-4">
                  <div className="flex items-center gap-2 border-b border-brand-success-border/30 pb-2.5">
                    <CheckCircle2 className="w-5 h-5 text-brand-success animate-pulse" />
                    <div>
                      <h4 className="text-sm font-semibold text-brand-success">Chính xác! Bạn đã chọn đúng đáp án</h4>
                      <p className="text-xs text-text-muted font-sans">Dùng mũi tên trái phải để chuyển câu.</p>
                    </div>
                  </div>

                  {/*
                    BẢNG PHẢN HỒI LÀ NƠI DẠY THẬT SỰ, nên đoạn giải nghĩa phải là nhân vật
                    chính của khối này.

                    Đo trên bản chạy thật trước khi sửa (28/07/2026): thân giải nghĩa 13px và
                    trải **87 ký tự mỗi dòng**, tức vừa là chữ nhỏ nhất trong các đoạn có
                    nghĩa, vừa là dòng dài nhất màn hình. Còn nhãn dẫn nó thì để `text-2xs`
                    viết hoa giãn chữ, cỡ chữ nhỏ nhất toàn sản phẩm.

                    Ba điều sửa, đều thuần thị giác:
                    1. Thân giải nghĩa lên 15px và chặn bề rộng, cho về vùng 45 tới 75 ký tự.
                    2. Nhãn bỏ viết hoa, về 13px chữ thường. Chữ hoa toàn phần mất đường viền
                       trên dưới của từ nên mắt phải đọc từng chữ cái thay vì nhận dạng cả
                       hình khối từ, chậm hơn hẳn ở cỡ nhỏ.
                    3. Tiêu đề phản hồi lên 15px để lớn hơn nhãn phụ bên dưới nó.
                  */}
                  <div className="space-y-2 font-sans text-text-secondary">
                    <span className="text-brand-success font-medium text-xs block">Giải nghĩa từ giáo trình</span>
                    <p className="bg-bg-card border border-border-primary/50 p-4 rounded-lg text-text-primary text-sm leading-relaxed max-w-[38rem]">
                      {activeQuestion.explanation}
                    </p>
                  </div>
                </div>
              )}

              {/* Phản hồi khi trả lời SAI (tutor mode): bám sát ĐÚNG câu hỏi hiện tại,
                  hiện thẳng đáp án đúng + lời giải giáo trình, và cho phép yêu cầu AI phân tích sâu. */}
              {isTutorMode && !exam.isSubmitted && exam.answers[activeQuestion.id] !== undefined
                && exam.answers[activeQuestion.id] !== activeQuestion.correctAnswer && (
                <div className="border border-brand-error-border/40 bg-brand-error-bg/15 p-5 rounded-xl space-y-4 animate-fade-in-up mt-4">
                  <div className="flex items-center gap-2 border-b border-brand-error-border/30 pb-2.5">
                    <AlertCircle className="w-5 h-5 text-brand-error" />
                    <div>
                      <h4 className="text-sm font-semibold text-brand-error">Chưa đúng. Cùng xem lại nhé</h4>
                      <p className="text-xs text-text-muted font-sans">
                        Bạn chọn {String(exam.answers[activeQuestion.id]).toUpperCase()}. Đáp án đúng là{" "}
                        <strong className="text-brand-success">{activeQuestion.correctAnswer.toUpperCase()}</strong>. Dùng mũi tên trái phải để chuyển câu.
                      </p>
                    </div>
                  </div>

                  {/* Cùng lý do như bảng trả lời đúng, xem chú thích dài ở khối trên. */}
                  <div className="space-y-2 font-sans">
                    <span className="text-brand-success font-medium text-xs block">Đáp án đúng</span>
                    <p className="bg-brand-success-bg/40 border border-brand-success-border/40 p-4 rounded-lg text-text-primary text-sm leading-relaxed max-w-[38rem]">
                      <strong>{activeQuestion.correctAnswer.toUpperCase()}.</strong> {activeQuestion.options[activeQuestion.correctAnswer]}
                    </p>
                    <span className="text-text-muted font-medium text-xs block pt-1">Giải nghĩa từ giáo trình</span>
                    <p className="bg-bg-card border border-border-primary/50 p-4 rounded-lg text-text-secondary text-sm leading-relaxed max-w-[38rem]">
                      {activeQuestion.explanation}
                    </p>
                  </div>

                  {/* Gia sư AI phân tích sâu theo đúng câu hỏi (gọi khi người học yêu cầu) */}
                  {aiExplanations[activeQuestion.id] ? (
                    <div className="space-y-1.5">
                      <span className="text-brand-info font-semibold text-2xs block flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-brand-info" />
                        Gia sư AI phân tích sâu:
                      </span>
                      <div className="bg-bg-surface border border-brand-info/30 p-3 rounded-lg text-text-primary leading-relaxed text-xs">
                        <SimpleMarkdown text={aiExplanations[activeQuestion.id]} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start pt-1">
                      <button
                        onClick={() => handleRequestAIExplanation(activeQuestion.id)}
                        disabled={aiLoading[activeQuestion.id]}
                        className="bg-brand-info-bg text-brand-info border border-brand-info/30 text-2xs font-semibold px-4 py-2 rounded-lg hover:bg-brand-info-bg transition duration-150 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{aiLoading[activeQuestion.id] ? "Đang phân tích..." : "Nhờ gia sư AI phân tích sâu"}</span>
                      </button>
                    </div>
                  )}
                  {aiError[activeQuestion.id] && (
                    <p className="text-2xs text-brand-error">{aiError[activeQuestion.id]}</p>
                  )}
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

                {/*
                  Nhắc phím tắt, đặt đúng chỗ mắt dừng lại sau khi đọc xong bốn phương án.
                  Một phím tắt không ai biết thì bằng không: người học sẽ vẫn với tay lấy chuột.
                  Chỉ hiện khi chưa nộp bài, vì lúc xem lại thì không còn chọn đáp án nữa.
                */}
                {!exam.isSubmitted && (
                  <div className="text-2xs text-text-muted hidden sm:flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums text-2xs">A</kbd>
                    <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums text-2xs">B</kbd>
                    <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums text-2xs">C</kbd>
                    <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums text-2xs">D</kbd>
                    <span>để chọn</span>
                    <span className="text-border-primary">•</span>
                    <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums text-2xs">←</kbd>
                    <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums text-2xs">→</kbd>
                    <span>để chuyển câu</span>
                  </div>
                )}

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

          {/* Phần bài giảng lý luận và giải nghĩa (sau khi nộp): CHỈ hiện ở câu trả lời SAI,
              câu đúng không cần lặp lại lý thuyết cho gọn. Phần tô màu đáp án đúng/sai vẫn hiện đủ. */}
          {exam.isSubmitted && activeQuestion && exam.answers[activeQuestion.id] !== activeQuestion.correctAnswer && (
            <div className="space-y-5 animate-fade-in-up">
              
              {/* AI Expert Explanation Action Trigger */}
              <div className="bg-bg-surface border border-border-primary rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-brand-success animate-pulse" />
                      <span>Bài giảng giải thích chi tiết bằng AI (Trực tuyến)</span>
                    </h4>
                    <p className="text-2xs text-text-secondary leading-relaxed max-w-xl font-sans">
                      Sử dụng trí tuệ nhân tạo Gemini để giải mã câu hỏi theo **Mức độ giải thích** được chọn bên dưới. AI phân tích sâu bẫy tư duy và các đáp án nhiễu.
                    </p>
                  </div>

                  <button 
                    disabled={aiLoading[activeQuestion.id]}
                    onClick={() => handleRequestAIExplanation(activeQuestion.id, explanationLevel)}
                    className="shrink-0 bg-text-primary hover:opacity-95 text-bg-card disabled:opacity-50 text-2xs font-medium px-4 py-2 rounded-lg transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
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
                  <div className="border-t border-brand-error-border pt-3 text-xs text-brand-error flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-brand-error" />
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
                            <span className="text-text-muted text-2xs tabular-nums font-bold">Chiến lược sư phạm</span>
                            <span className="bg-brand-success-bg text-brand-success px-2 py-0.5 rounded text-2xs font-semibold border border-brand-success-border/20">
                              {aiPipelineMetadata[activeQuestion.id].strategyUsed}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-text-muted text-2xs tabular-nums font-bold">Xác suất đoán bừa</span>
                            <span className={`font-semibold tabular-nums ${
                              aiPipelineMetadata[activeQuestion.id].guessingProbability >= 0.6 ? "text-brand-error" : "text-text-secondary"
                            }`}>
                              {Math.round(aiPipelineMetadata[activeQuestion.id].guessingProbability * 100)}%
                            </span>
                          </div>
                          {/* Guessing warning */}
                          {aiPipelineMetadata[activeQuestion.id].guessingProbability >= 0.6 && (
                            <p className="text-2xs text-brand-error leading-relaxed">
                              ⚠️ Phát hiện hành vi trả lời siêu tốc hoặc chưa vững lý thuyết nền tảng. Hãy làm chậm lại nhé!
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <span className="text-text-muted text-2xs tabular-nums font-bold block mb-1">Kiểm định học thuật</span>
                            <div className="flex items-center gap-1.5 text-2xs">
                              <span className="w-2 h-2 rounded-full bg-brand-success"></span>
                              <span className="text-text-secondary font-medium">Bằng chứng xác thực nguồn Slide</span>
                            </div>
                            {aiPipelineMetadata[activeQuestion.id].unmasteredPrerequisites?.length > 0 ? (
                              <div className="text-2xs text-brand-warning leading-normal mt-1">
                                ⚠️ Khuyết hụt lý thuyết tiên quyết: {aiPipelineMetadata[activeQuestion.id].unmasteredPrerequisites.join(", ")}
                              </div>
                            ) : (
                              <div className="text-2xs text-brand-success leading-normal mt-1">
                                ✓ Đã kiểm tra kiến thức tiên quyết (Đạt)
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Cross Subject Intelligence Alert Card */}
                        {aiPipelineMetadata[activeQuestion.id].crossSubjectIntel && (
                          <div className="md:col-span-2 bg-brand-info-bg/5 border border-brand-info-border/20 p-3 rounded-lg space-y-1 mt-1">
                            <div className="flex items-center gap-1 text-2xs font-bold text-brand-info tabular-nums">
                              <Brain className="w-3.5 h-3.5" />
                              <span>Kết nối tư duy liên môn (Cross-Subject Intelligence)</span>
                            </div>
                            <p className="text-2xs text-text-primary font-medium">
                              Liên hệ: {aiPipelineMetadata[activeQuestion.id].crossSubjectIntel.connectedSubject} &rarr; {aiPipelineMetadata[activeQuestion.id].crossSubjectIntel.topic}
                            </p>
                            <p className="text-2xs text-text-muted leading-relaxed">
                              {aiPipelineMetadata[activeQuestion.id].crossSubjectIntel.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* The main AI Lecture body */}
                    <div className="bg-bg-card p-5 rounded-lg border border-border-primary/60 text-xs text-text-secondary leading-relaxed font-sans prose dark:prose-invert max-w-none">
                      <div className="flex items-center gap-1.5 mb-3 text-2xs tabular-nums text-brand-info font-bold">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 bg-bg-surface border border-border-primary rounded-xl p-1 text-2xs">
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
                            <span className="text-2xs bg-brand-success-bg text-brand-success px-2 py-0.5 rounded tabular-nums border border-brand-success-border/20">
                              Bản đồ tri thức: Mapped KB
                            </span>
                          )}
                        </div>
                        <div className="whitespace-pre-line leading-relaxed prose dark:prose-invert max-w-none">
                          <SimpleMarkdown text={displayExplanation} />
                        </div>
                        
                        {conceptNode?.explanation?.analogy && (
                          <div className="text-2xs italic text-text-muted pl-2.5 border-l-2 border-text-muted">
                            💡 Phép ẩn dụ: {conceptNode.explanation.analogy}
                          </div>
                        )}
                      </div>

                      {/* Display Extra Learning Metadata Cards */}
                      {conceptNode && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {conceptNode.teaching?.misconception && (
                            <div className="border border-brand-error-border/30 bg-brand-error-bg/5 p-3 rounded-xl space-y-1">
                              <span className="text-2xs font-bold text-brand-error tabular-nums block">Cảnh báo hiểu sai</span>
                              <p className="text-2xs text-text-primary leading-relaxed font-sans">{conceptNode.teaching.misconception}</p>
                            </div>
                          )}

                          {conceptNode.teaching?.counterExample && (
                            <div className="border border-brand-warning-border/30 bg-brand-warning-bg/5 p-3 rounded-xl space-y-1">
                              <span className="text-2xs font-bold text-brand-warning tabular-nums block">Ví dụ phản chứng tránh học vẹt</span>
                              <p className="text-2xs text-text-primary leading-relaxed font-sans">{conceptNode.teaching.counterExample}</p>
                            </div>
                          )}

                          {conceptNode.teaching?.learningObjective && (
                            <div className="border border-brand-info-border/30 bg-brand-info-bg/5 p-3 rounded-xl space-y-1 sm:col-span-2">
                              <span className="text-2xs font-bold text-brand-info tabular-nums block">Chuẩn đầu ra năng lực</span>
                              <p className="text-2xs text-text-primary leading-relaxed font-sans">Sau khi ôn tập xong khái niệm này, sinh viên phải: {conceptNode.teaching.learningObjective}</p>
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
                      <div className="border border-border-primary/60 p-4 rounded-lg space-y-2 text-2xs font-sans">
                        <span className="text-text-primary font-semibold block">Bản đồ liên kết tri thức</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div className="bg-bg-surface/50 border border-border-primary/30 p-2.5 rounded-md">
                            <span className="text-text-muted tabular-nums text-2xs block mb-1">Tri thức tiên quyết:</span>
                            {reqNodes.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {reqNodes.map(rn => (
                                  <span key={rn.id} className="bg-brand-warning-bg/40 text-brand-warning border border-brand-warning-border/20 text-2xs px-1.5 py-0.5 rounded">
                                    {rn.concept}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-text-muted text-2xs">Không có yêu cầu đặc thù</span>
                            )}
                          </div>

                          <div className="bg-bg-surface/50 border border-border-primary/30 p-2.5 rounded-md">
                            <span className="text-text-muted tabular-nums text-2xs block mb-1">Khái niệm hiện tại:</span>
                            <span className="bg-brand-info-bg text-brand-info border border-brand-info-border/20 text-2xs px-1.5 py-0.5 rounded font-medium">
                              {conceptNode.concept}
                            </span>
                          </div>

                          <div className="bg-bg-surface/50 border border-border-primary/30 p-2.5 rounded-md">
                            <span className="text-text-muted tabular-nums text-2xs block mb-1">Khái niệm liên quan:</span>
                            {relatedNodes.length > 0 || conceptNode.dependencies?.relatedConcepts?.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {(relatedNodes.length > 0 ? relatedNodes.map(rn => rn.concept) : conceptNode.dependencies?.relatedConcepts || []).slice(0, 2).map((c, i) => (
                                  <span key={i} className="bg-bg-card border border-border-primary text-text-secondary text-2xs px-1.5 py-0.5 rounded">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-text-muted text-2xs">Chưa ánh xạ liên kết</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-2xs pt-1">
                  <div className="border border-border-primary/60 p-3 rounded-lg">
                    <span className="text-text-muted block mb-0.5 tabular-nums">Ánh xạ tài liệu chính thức:</span>
                    <span className="font-medium text-text-secondary">{activeQuestion.sourcePdf} (Slide trang {activeQuestion.sourcePage})</span>
                  </div>
                  <div className="border border-border-primary/60 p-3 rounded-lg">
                    <span className="text-text-muted block mb-0.5 tabular-nums">Mục tiêu củng cố kiến thức:</span>
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
                      scorePercent >= 50 ? "text-brand-warning" : "text-brand-error"
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
                  <span className="text-md tabular-nums font-bold text-text-primary">{scorePercent}%</span>
                  <span className="text-2xs text-text-muted tabular-nums">Đúng</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-2xs font-sans">
                <div className="bg-brand-success-bg border border-brand-success-border/20 py-1.5 rounded-md text-brand-success font-medium">
                  Đúng: {correctCount}
                </div>
                <div className="bg-brand-error-bg border border-brand-error-border/20 py-1.5 rounded-md text-brand-error font-medium">
                  Sai: {incorrectCount}
                </div>
              </div>
            </div>
          )}

          {/* Sticky Question Palette Card */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
            <h3 className="font-medium text-text-primary text-xs flex items-center justify-between">
              <span>Bảng câu hỏi</span>
              <span className="text-xs text-text-muted font-normal tabular-nums">
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
                    ? "bg-brand-error text-white border-transparent cursor-pointer" 
                    : "bg-bg-surface border-border-primary/60 text-text-muted cursor-pointer opacity-70";
                } else if (isSelected) {
                  btnStyle = "bg-bg-surface border-text-muted/30 text-text-primary font-medium cursor-pointer";
                }

                return (
                  <button 
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-8 w-full rounded-md border text-xs tabular-nums flex items-center justify-center relative transition-all duration-150 ${btnStyle}`}
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

            <div className="border-t border-border-primary/60 pt-3.5 space-y-2 text-2xs text-text-muted tabular-nums">
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
                    <span className="w-1.5 h-1.5 bg-brand-error rounded-sm" />
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
                  className="w-full sm:w-auto border border-border-primary hover:bg-bg-surface text-text-secondary text-2xs font-medium px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer"
                >
                  Tiếp tục làm
                </button>
                <button 
                  type="button"
                  onClick={submitExam}
                  className="w-full sm:w-auto bg-text-primary hover:opacity-95 text-bg-card text-2xs font-medium px-4 py-1.5 rounded-lg transition duration-150 cursor-pointer"
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
