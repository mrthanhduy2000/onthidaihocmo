/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Clock, Bookmark, Flag, ChevronLeft, ChevronRight, Send, HelpCircle, Sparkles, BookOpen, Check, AlertTriangle, Play, Pause, Brain, CheckCircle2 } from "lucide-react";
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
      {/*
        ĐẦU PHIÊN: MỘT HÀNG DUY NHẤT Ở MỌI KHỔ, VÀ CÓ ĐƯỜNG KẺ NGĂN.

        Đo ngày 29/07/2026, khổ 375px:

        | | Khan Academy | Bản trước của dự án |
        |---|---|---|
        | Chrome trước khi tới câu hỏi | **73px** | **179px**, tức 22% chiều cao màn hình |
        | Cách xếp | tiêu đề bài một dòng, rồi một dòng tiến độ gọn | tiêu đề xuống dòng, **đồng hồ rơi hẳn xuống một hàng riêng** |
        | Ngăn cách với câu hỏi | có một đường kẻ | không có gì |

        Thủ phạm là `flex-col sm:flex-row`: dưới mốc 640px thì cụm tiêu đề và đồng hồ xếp
        chồng, nên đúng ở khổ nhỏ nhất, nơi mỗi điểm ảnh dọc đắt nhất, lại tốn thêm nguyên
        một hàng cho một con số đếm giờ.

        Nay một hàng ở mọi khổ: tiêu đề co lại được và cắt bằng dấu ba chấm nếu quá dài, đồng
        hồ giữ nguyên bề rộng. Thêm đường kẻ chân đúng như Khan, để phần điều khiển phiên tách
        hẳn khỏi phần nội dung học.
      */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border-primary">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onNavigateHome}
            className="p-2 border border-border-primary bg-bg-card rounded-lg hover:bg-bg-surface text-text-secondary transition duration-150 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
          </button>
          <div className="min-w-0">
            <h1 className="text-md font-medium font-display text-text-primary truncate">
              {exam.examType === "ai-smart" ? "Đề thi thử thông minh" :
               exam.examType === "adaptive" ? "Học tập thích ứng" :
               exam.examType === "chapter" ? `Luyện tập Chương ${exam.chapterId}` :
               exam.examType === "topic" ? `Luyện tập Chủ đề ${exam.topicId}` :
               exam.examType === "random" ? "Luyện tập Ngẫu nhiên" :
               exam.examType === "due" ? "Ôn khái niệm tới hạn" :
               exam.examType === "incorrect" ? "Làm lại câu từng sai" :
               exam.examType === "bookmark" ? "Ôn câu đã đánh dấu" :
               exam.examType === "difficulty" ? `Luyện tập mức ${exam.difficulty}` : "Luyện tập theo Thứ tự gốc"}
            </h1>
            <p className="text-2xs text-text-muted mt-0.5 font-sans truncate">
              {exam.isSubmitted ? "Xem lại đáp án và phân tích lý luận từ hệ thống AI" : `Phiên ôn luyện: ${examQuestions.length} câu hỏi lý thuyết`}
            </p>
          </div>
        </div>

        {/* Timer / Progress Widgets */}
        <div className="flex items-center gap-2.5 shrink-0">
          {!exam.isSubmitted && (
            <div className="bg-bg-surface border border-border-primary/80 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-muted shrink-0" />
              <span className="tabular-nums font-medium text-text-primary text-xs">
                {formatTimer()}
              </span>
              <button 
                onClick={() => setTimerActive(!timerActive)}
                className="text-text-muted hover:text-text-primary transition-colors ml-1 cursor-pointer"
                title={timerActive ? "Tạm dừng" : "Tiếp tục"}
              >
                {timerActive ? <Pause className="w-4 h-4.5 shrink-0" /> : <Play className="w-4 h-4.5 shrink-0" />}
              </button>
            </div>
          )}

          {/* Nút "Nộp bài" đã chuyển xuống thanh hành động đáy, xem chú thích tại đó. */}

          {exam.isSubmitted && (
            <div className="bg-brand-success-bg border border-brand-success-border px-3.5 py-1.5 rounded-lg text-brand-success font-medium text-xs">
              Kết quả: {exam.score} / {examQuestions.length} câu đúng
            </div>
          )}
        </div>
      </div>

      {/*
        TỔNG KẾT PHIÊN: MỘT CÂU, KHÔNG PHẢI BỐN Ô SỐ LIỆU.

        Hai việc trong một lượt sửa, và việc thứ hai nặng hơn việc thứ nhất nhiều.

        VIỆC THỨ NHẤT, TRÌNH BÀY. Khối này vốn là một thẻ bo 16px có viền, có đổ bóng, bên trong
        là bốn ô số liệu đóng khung riêng, mỗi ô lại có viền và bo góc của nó. Đúng khuôn bảng
        điều khiển: khi mọi mẩu dữ liệu đều được đóng khung thì không mẩu nào quan trọng hơn mẩu
        nào. Khan Academy viết tiến độ thành CÂU ở cỡ chữ thường, màu chữ thường, không thẻ,
        không huy hiệu, không số to. Nguyên tắc đã ghi trong NGONNGUTHIETKE.md: **nội dung là chủ
        thể, số liệu là chú thích của nội dung.**

        VIỆC THỨ HAI, BA TRONG BỐN Ô LÀ SỐ BỊA. Đọc kỹ mã cũ:

        | Ô | Công thức cũ | Vấn đề |
        |---|---|---|
        | Kết quả bài thi | `correctCount / tổng` | thật |
        | Khái niệm đã thông thạo | `Math.max(1, Math.floor(correctCount / 3))` | **đúng 0 câu vẫn khoe "+1 khái niệm"** |
        | Hiểu sai đã sửa | `incorrectCount > 0 ? "1 hiểu sai" : "0 bẫy sai"` | sai 1 câu hay sai 9 câu đều ra **"1 hiểu sai"** |
        | Độ ghi nhớ dự đoán | `71% → 71 + tỷ_lệ_đúng * 18` | mốc **71 viết cứng**, không đọc từ hồ sơ người học nào |

        Đây đúng họ lỗi mà bất biến 4.9 đặt ra để chặn: trình bày một hằng số viết tay như thể
        đó là kết quả đo được. Nó không báo lỗi biên dịch, không sai kiểu, chỉ lặng lẽ nói với
        người học một điều không có thật, ngay tại khoảnh khắc họ tin tưởng nhất là lúc vừa
        nộp bài.

        Không "sửa công thức" ở đây, vì tính đúng ba đại lượng ấy là việc của tầng engine chứ
        không phải của tầng trình bày. Việc đúng đắn ở tầng này là **thôi khẳng định thứ mình
        không biết**. Không mất chức năng nào: cả ba con số vốn chưa từng được engine nào tính,
        nên không có đường dữ liệu nào bị cắt.
      */}
      {exam.isSubmitted && (
        <div className="animate-fade-in space-y-5 pb-2 border-b border-border-primary">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-brand-success">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Phiên học hoàn tất</span>
              </div>
              <h2 className="text-2xl font-bold text-text-primary font-sans">
                Bạn làm đúng {correctCount} trên {examQuestions.length} câu.
              </h2>
              <p className="text-base text-text-secondary font-sans max-w-[40rem]">
                {incorrectCount === 0
                  ? "Trọn vẹn cả phiên. Cuộn xuống để đọc lại phần giải nghĩa của từng câu."
                  : `Còn ${incorrectCount} câu đáng xem lại. Phần giải nghĩa nằm ngay dưới đáp án đúng của từng câu.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                className="px-4 h-10 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot font-bold text-sm rounded transition flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span className="whitespace-nowrap">Làm thêm 10 câu mới</span>
              </button>

              <button
                onClick={onNavigateHome}
                className="px-4 h-10 border border-border-primary bg-bg-card hover:bg-bg-surface text-text-primary font-bold text-sm rounded transition cursor-pointer"
              >
                <span className="whitespace-nowrap">Kết thúc bài làm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Panel Grid */}
      <div className="space-y-8">
        {/* Cột duy nhất: vùng làm bài chiếm trọn bề rộng, đúng như trang bài tập của Khan */}
        <div className="space-y-5">
          
          {/*
            BỎ THẺ BỌC QUANH BÀI LÀM.

            Đo trên trang làm bài của Khan Academy ở cùng khổ 1280px: câu hỏi và các phương án
            **nằm thẳng trên nền trắng**, không có thẻ bao, không viền bao, không bo góc bao.
            Vùng làm bài được phân định bằng các đường kẻ 1px chứ không bằng một cái hộp.

            Trước đây toàn bộ bài làm nằm trong một thẻ bo 8px có viền. Hệ quả khi đặt cạnh
            Khan: bài làm trông như một tiện ích đặt trên trang, còn của Khan là chính trang đó.
            Đây là khác biệt cấu trúc lớn nhất giữa hai màn.

            Giữ `border-b` để vẫn còn ranh giới dưới cho thanh điều hướng câu.
          */}
          {activeQuestion && (
            <div className="bg-bg-card space-y-5 px-0 py-2">
              

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
                {/*
                  PHÍA TRÊN CÂU HỎI KHÔNG CÒN GÌ CẢ.

                  Cụm ba mẩu siêu dữ liệu (chủ đề, khái niệm, yêu cầu trước) đã chuyển xuống
                  khối "Nội dung liên quan" dưới bốn phương án, đúng chỗ Khan Academy đặt phần
                  ấy. Trên trang bài tập của họ, phía trên câu hỏi không có gì ngoài tiêu đề bài
                  và một đường kẻ.

                  Đây không chỉ là đổi chỗ cho giống. Biết trước "câu này kiểm tra khái niệm X"
                  là một gợi ý KHÔNG AI XIN, và nó tới đúng lúc người học đang phải tự nhớ ra
                  điều đó. Sau khi đã chốt đáp án thì cũng chính thông tin ấy trở thành thứ đáng
                  giá nhất: nó nói cần đi ôn lại phần nào. Không mẩu tin nào mất đi, chỉ đổi
                  thời điểm xuất hiện sang lúc nó dùng được.
                */}
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
                <h3 className="text-lg font-bold text-text-primary leading-snug font-sans">
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
              {/*
                DÒNG NHẮC HÀNH ĐỘNG.

                Khan Academy luôn đặt một dòng ngay dưới câu hỏi nói rõ người học phải làm gì:
                "Chọn 2 đáp án:", cỡ 18px đậm 700, cùng bậc với chính câu hỏi.

                Vì sao nó thuộc về trải nghiệm học chứ không phải trang trí: câu hỏi cho biết
                phải NGHĨ gì, dòng này cho biết phải LÀM gì. Thiếu nó thì người học phải tự suy
                ra luật chơi từ hình dạng các ô bấm. Với người mới hoặc người đang mệt sau vài
                tiếng học, một dòng chỉ dẫn rõ ràng cắt được đúng khoảng do dự đó.
              */}
              <p className="text-lg font-bold text-text-primary font-sans pt-1">
                Hãy chọn 1 đáp án:
              </p>

              {/*
                `key` gắn theo mã câu hỏi để React DỰNG LẠI bốn hàng khi sang câu khác thay vì
                dùng lại đúng bốn nút cũ.

                Bắt được lỗi này khi chụp màn hình ngay lúc chuyển câu: vòng xanh và ô chữ cái
                đỏ của câu VỪA XONG vẫn còn nằm trên các phương án của câu MỚI rồi mới nhạt dần.
                Nguyên nhân là quy tắc chuyển màu nền và màu viền 140ms đặt chung cho mọi thẻ:
                React giữ nguyên nút cũ và chỉ đổi lớp, nên trình duyệt chạy hiệu ứng chuyển màu
                giữa hai trạng thái của hai câu khác nhau.

                Với một ứng dụng học tập thì đây không phải lỗi thẩm mỹ: trong khoảnh khắc đó
                người học thấy phản hồi đúng sai gắn lên những phương án chưa hề đọc.
              */}
              <div key={activeQuestion.id} className="grid grid-cols-1 pt-1 divide-y divide-border-primary/70 border-y border-border-primary/70">
                {(() => {
                  // Trong chế độ gia sư, khi đã trả lời thì lộ đáp án đúng/sai ngay trên các phương án
                  // (không cần đợi nộp bài). Câu đã chốt khóa cũng luôn lộ + khóa. Chế độ thường chỉ lộ sau khi nộp.
                  const answeredThis = exam.answers[activeQuestion.id] !== undefined;
                  const committed = lockedIds.has(activeQuestion.id) || (isTutorMode && answeredThis);
                  const reveal = exam.isSubmitted || committed;
                  const locked = exam.isSubmitted || committed;
                  // Điều kiện y hệt hai bảng phản hồi cũ, chỉ đổi chỗ hiển thị chứ không đổi
                  // lúc nào được hiện.
                  const hienGiaiNghia = isTutorMode && !exam.isSubmitted && answeredThis;
                  return (["a", "b", "c", "d"] as const).map((key) => {
                  const optionText = activeQuestion.options[key];
                  const isSelected = exam.answers[activeQuestion.id] === key;
                  const isCorrect = activeQuestion.correctAnswer === key;
                  const isWrongSelection = isSelected && !isCorrect;

                  /*
                    TRẠNG THÁI ĐÃ TRẢ LỜI, DỰNG LẠI THEO ĐÚNG THỨ ĐO ĐƯỢC TRÊN KHAN ACADEMY.

                    Đo ngày 29/07/2026 trên một bài tập thật của họ, cố ý chọn sai trước rồi
                    chọn lại cho đúng để xem được cả hai trạng thái:

                    | Thành phần | Số đo trên Khan |
                    |---|---|
                    | Nền hàng đáp án đúng | **trong suốt**, không hề tô nền |
                    | Viền hàng đáp án đúng | vòng 2px màu `#0B7C18`, bo 8px |
                    | Ô chữ cái đáp án đúng | viên thuốc 50x32 tô đặc, bên trong là **dấu tích ĐI KÈM chữ cái** |
                    | Chữ nội dung đáp án đúng | tô luôn màu `#0B7C18` |
                    | Ô chữ cái lúc nghỉ | **hình TRÒN** 32x32, viền 2px `#5F6167`, rỗng ruột |
                    | Hàng đã chọn, chưa lộ | nền vẫn trong suốt, chữ và ô chữ cái chuyển xanh dương |

                    Hai điều chỉnh dưới đây đáng làm vì chúng sửa đúng hai chỗ đang làm ngược:

                    1. **Ô chữ cái phải TRÒN, không vuông.** Trên Khan hình dạng ô mang nghĩa:
                       tròn cho câu chọn một đáp án, vuông cho câu chọn nhiều đáp án, đúng quy
                       ước nút chọn của mọi hệ điều hành. Sản phẩm này luôn là chọn một, mà lại
                       vẽ ô vuông, tức đang phát tín hiệu "được chọn nhiều".

                    2. **Bỏ nền đi thì cởi trói được cho màu chữ.** Bất biến 4.9d cấm tô màu ngữ
                       nghĩa lên chữ nội dung, và lý do ghi lại là đo được 3,15:1 khi tô chữ
                       xanh lá lên NỀN xanh nhạt. Lý do ấy đúng với cái nền đó. Bỏ nền thì ràng
                       buộc cũng mất: `#157d3c` trên nền trắng đạt **5,21:1**, `#b91c1c` đạt
                       **6,47:1**, cả hai vượt ngưỡng 4,5:1 của WCAG AA. Nên nay theo được cách
                       của Khan mà không phải đánh đổi độ đọc được.
                  */
                  let voHang = "border-transparent";
                  let mauChu = "text-text-primary";
                  let oChuCai = "w-8 border-2 border-text-secondary text-text-secondary group-hover:border-text-primary group-hover:text-text-primary";

                  if (isSelected && !reveal) {
                    mauChu = "text-brand-info font-medium";
                    oChuCai = "w-8 bg-[color:var(--nut-chinh)] text-white border-2 border-transparent";
                  } else if (reveal) {
                    if (isCorrect) {
                      voHang = "border-brand-success";
                      mauChu = "text-brand-success font-medium";
                      oChuCai = "w-12 gap-1 bg-brand-success text-white border-2 border-transparent animate-danh-dau";
                    } else if (isWrongSelection) {
                      /*
                        KHÔNG khoanh vòng quanh phương án chọn sai.

                        Bản đầu của lượt này khoanh cả hai: vòng xanh quanh đáp án đúng và vòng
                        đỏ quanh phương án đã chọn. Nhìn trên bản chạy thật thì hai vòng nằm sát
                        nhau, cùng độ dày, cùng bo góc, nên chúng có **cùng sức nặng thị giác**
                        và mắt không biết nên nhìn cái nào trước.

                        Trên Khan chỉ có đúng MỘT vòng, và nó luôn quanh đáp án đúng. Vòng là
                        thứ chỉ chỗ cần nhìn, không phải thứ chấm điểm. Nên ở đây phương án chọn
                        sai chỉ giữ ô chữ cái và màu chữ, đủ để người học nhận ra mình đã chọn
                        gì mà không tranh chỗ với đáp án.
                      */
                      mauChu = "text-brand-error";
                      oChuCai = "w-8 bg-brand-error text-white border-2 border-transparent";
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
                      mauChu = "text-text-muted";
                      oChuCai = "w-8 border-2 border-border-primary text-text-muted";
                    }
                  }

                  /*
                    GIẢI NGHĨA GẮN THẲNG DƯỚI PHƯƠNG ÁN, KHÔNG CÒN LÀ MỘT BẢNG RIÊNG.

                    Khan đặt phần lý giải ngay bên dưới CHÍNH phương án mà nó nói tới, thụt vào
                    đúng mép chữ, cỡ 16px màu mờ, không hộp, không viền, không nền. Mắt vừa thấy
                    phương án nào đúng là đọc tiếp được ngay vì sao, không phải nhảy xuống một
                    khối khác rồi dò ngược lên xem khối đó đang nói về phương án nào.

                    Điều kiện hiện giữ y hệt hai bảng cũ nên không có trạng thái nào mới sinh ra
                    và cũng không có trạng thái nào mất đi.

                    Trên Khan MỌI phương án đều có một câu lý giải riêng. Dự án này không có dữ
                    liệu đó: ngân hàng câu hỏi chỉ có một trường `explanation` cho cả câu, còn
                    trường `misconception` của từng câu rỗng 292/292 (xem Nợ 2 trong WORKSTATE).
                    Nên chỉ gắn lý giải vào đúng phương án mà nó nói tới, và các phương án còn
                    lại để trống thay vì độn một câu chữ không dạy được gì.
                  */
                  const giaiNghia = hienGiaiNghia && isCorrect ? activeQuestion.explanation : null;

                  return (
                    <div key={key} className={`rounded-lg border-2 ${voHang}`}>
                      <button
                        onClick={() => handleSelectAnswer(key)}
                        disabled={locked}
                        className={`w-full text-left px-4 py-3.5 min-h-[52px] flex items-start gap-3.5 group ${locked ? "cursor-default" : "cursor-pointer hover:bg-bg-surface/60"} ${mauChu}`}
                      >
                        {/*
                          Ô CHỮ CÁI. Chính ô này gánh phần lớn tín hiệu trạng thái, nên hàng
                          đằng sau nó mới được phép để trống trơn. Khi đúng thì nó nở ra thành
                          viên thuốc chứa dấu tích ĐI KÈM chữ cái, đúng cách Khan làm: dấu tích
                          nói "đúng", chữ cái vẫn nói "phương án nào", không mất thông tin nào.

                          Không dùng `tabular-nums`: đây là MỘT ký tự, mà lợi ích duy nhất của
                          font đơn cách là xếp thẳng cột nhiều ký tự.
                        */}
                        <span className={`h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs transition ${oChuCai}`}>
                          {reveal && isCorrect && <Check className="w-4 h-4.5 shrink-0" strokeWidth={3} />}
                          {key.toUpperCase()}
                        </span>
                        {/*
                          Phương án trả lời là đoạn chữ người học phải SO SÁNH kỹ nhất để ra
                          quyết định, nhưng nó vốn là `text-xs`, tức 12px, nhỏ hơn câu hỏi tới
                          bốn điểm. Thứ bậc đọc bị đảo ngược: đọc câu hỏi ở cỡ lớn rồi phải hạ
                          mắt xuống cỡ nhỏ hơn để làm phần việc khó hơn. Nay 16px.
                        */}
                        <span className="text-base leading-relaxed font-sans pt-0.5">{optionText}</span>
                      </button>

                      {/*
                        Thụt vào 78px để chữ giải nghĩa thẳng cột với chính chữ của phương án nó
                        nói tới: 16px đệm hàng cộng 2px viền cộng 48px ô chữ cái cộng 14px khoảng
                        hở. Đo trên Khan ở khổ hẹp: họ giữ mép trái của lời lý giải trùng đúng
                        mép trái của nhãn phương án, chấp nhận dòng ngắn lại chứ không bỏ thụt
                        đầu dòng. Thẳng cột chính là thứ nói lên "đoạn này thuộc về phương án
                        kia".

                        Chú thích phải nằm NGOÀI ngoặc của biểu thức `&&`. Đây là lần thứ tư cái
                        bẫy này làm hỏng bản dựng: đặt một khối chú thích JSX làm phần tử đầu
                        tiên bên trong ngoặc thì thành hai biểu thức đứng cạnh nhau và trình
                        biên dịch báo thiếu dấu phẩy.
                      */}
                      {giaiNghia && (
                        <p className="animate-hien-len pl-[78px] pr-4 pb-4 text-sm leading-relaxed text-text-secondary font-sans max-w-[40rem]">
                          {giaiNghia}
                        </p>
                      )}
                    </div>
                  );
                });
                })()}
              </div>

              {/*
                KHỐI "NỘI DUNG LIÊN QUAN", ĐẶT DƯỚI BỐN PHƯƠNG ÁN.

                Đo trên trang bài tập của Khan Academy: ngay dưới danh sách đáp án là một khối
                mang đúng nhãn này, chữ **14px đậm 700 màu `#717378`**, không viết hoa, không
                viền, không nền; bên dưới là các mục nội dung dạy chính kỹ năng đang luyện.

                Ba mẩu ở đây là ba mẩu vốn nằm PHÍA TRÊN câu hỏi: chủ đề, khái niệm đang kiểm
                tra, và các khái niệm cần học trước. Không mẩu nào bị bỏ, không mẩu nào thêm
                vào; chúng chỉ chuyển xuống đúng chỗ Khan dành cho loại thông tin này, và cũng
                là chỗ chúng dùng được: sau khi chốt đáp án, đây chính là câu trả lời cho "vậy
                giờ đi ôn lại phần nào".
              */}
              {(() => {
                const activeSubjectId = dbService.getActiveSubjectId();
                const conceptNode = kbService.getConceptForQuestion(activeSubjectId, activeQuestion);
                const chuDe = topics.find(t => t.id === activeQuestion.topicId)?.title;
                const reqs = conceptNode?.dependencies?.requires || [];
                const reqNodes = reqs.length
                  ? kbService.getKnowledgeGraph(activeSubjectId).filter(g => reqs.includes(g.id))
                  : [];
                if (!chuDe && !conceptNode) return null;
                return (
                  <div className="pt-2 space-y-2.5">
                    <p className="text-sm font-bold text-text-muted font-sans">Nội dung liên quan</p>
                    <div className="space-y-2">
                      {chuDe && (
                        <p className="flex items-start gap-2.5 text-sm text-text-secondary font-sans">
                          <BookOpen className="w-5 h-5 shrink-0 text-text-muted" />
                          <span>Chủ đề: {chuDe}</span>
                        </p>
                      )}
                      {conceptNode && (
                        <p className="flex items-start gap-2.5 text-sm text-text-secondary font-sans">
                          <Brain className="w-5 h-5 shrink-0 text-brand-info" />
                          <span>Khái niệm đang kiểm tra: {conceptNode.concept}</span>
                        </p>
                      )}
                      {reqNodes.length > 0 && (
                        <p className="flex items-start gap-2.5 text-sm text-text-muted font-sans">
                          <HelpCircle className="w-5 h-5 shrink-0" />
                          <span>Cần nắm trước: {reqNodes.map(rn => rn.concept).join(", ")}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/*
                MỘT THẺ BÁO GỌN, THAY CHO HAI BẢNG LỒNG HỘP.

                Trước lượt này, mỗi trạng thái là một bảng lớn có viền, có nền tô màu ngữ nghĩa,
                bo 12px, bên trong lại có nhãn dẫn và MỘT HỘP NỮA bọc đoạn giải nghĩa, tức hộp
                trong hộp trong hộp. Riêng bảng trả lời sai còn chép lại nguyên văn đáp án đúng
                một lần nữa, dù ngay phía trên phương án ấy đã được khoanh xanh kèm dấu tích.

                Đo trên Khan cùng ngày: phản hồi của họ là **một thẻ 192x102**, nền trắng, viền
                1px, bo 4px, đổ bóng `0 4px 8px rgba(33,36,44,0.16)`, tiêu đề 20px đậm 700 để
                màu CHỮ THƯỜNG chứ không phải màu ngữ nghĩa, dòng dưới 16px thường. Thẻ nổi ở
                góc dưới bên phải, ngay cạnh nút hành động chính, và có nút đóng.

                Điều đáng học nhất không nằm ở kích thước mà ở tông giọng: **trạng thái sai của
                Khan không có màu đỏ ở bất cứ đâu**, chữ nghĩa là "Hãy thử lại lần nữa" chứ
                không phải một lời phán xét. Sai là một bước của việc học, không phải một sự cố.

                Giữ đúng tinh thần đó nhưng không bê nguyên câu "thử lại": luồng ở đây khóa đáp
                án ngay khi chọn nên không có lần thử thứ hai, vậy nên câu chữ chỉ dẫn mắt
                xuống chỗ đang có lời giải.
              */}
              {isTutorMode && !exam.isSubmitted && exam.answers[activeQuestion.id] !== undefined && (() => {
                const dung = exam.answers[activeQuestion.id] === activeQuestion.correctAnswer;
                return (
                  /*
                    Một hàng duy nhất, không phải hai khối xếp chồng.

                    Bản đầu của lượt này để thẻ báo trên một hàng riêng canh phải, và nhìn trên
                    bản chạy thật thì nó tạo ra **một dải trống chạy hết nửa trái màn hình**,
                    cao bằng cả thẻ. Khoảng trắng của Khan luôn là lề chứ không phải một ô rỗng
                    nằm giữa hai thứ có nội dung.

                    Nay hai thứ cùng xuất hiện sau khi trả lời chia nhau một hàng: bên trái là
                    "còn làm được gì nữa", bên phải là "vừa rồi thế nào".
                  */
                  <div className="flex flex-wrap items-start gap-4 pt-1">

                    {/*
                      Gia sư AI phân tích sâu. Giữ nguyên tính năng và giữ nguyên điều kiện chỉ
                      mời khi trả lời sai. Đổi cách trình bày: thụt vào đúng 62px cho thẳng cột
                      với đoạn giải nghĩa ngay trên nó, và lời mời chuyển thành một liên kết chữ
                      thay vì một cái nút có nền và viền riêng. Khan để mọi hành động phụ trong
                      trang bài tập ở dạng chữ xanh không khung, chỉ hành động chính mới có nền.
                    */}
                    {!dung && (
                      <div className="pr-4 space-y-2 flex-1 min-w-[16rem] max-w-[40rem]">
                        {aiExplanations[activeQuestion.id] ? (
                          <div className="animate-hien-len space-y-1.5">
                            <span className="text-text-muted text-sm flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-brand-info shrink-0" />
                              Gia sư AI phân tích sâu
                            </span>
                            <div className="text-text-secondary leading-relaxed text-sm">
                              <SimpleMarkdown text={aiExplanations[activeQuestion.id]} />
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRequestAIExplanation(activeQuestion.id)}
                            disabled={aiLoading[activeQuestion.id]}
                            className="text-brand-info text-sm font-bold flex items-center gap-1.5 cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-default"
                          >
                            <Sparkles className="w-4 h-4 shrink-0" />
                            <span>{aiLoading[activeQuestion.id] ? "Đang phân tích" : "Nhờ gia sư AI phân tích sâu"}</span>
                          </button>
                        )}
                        {aiError[activeQuestion.id] && (
                          <p className="text-sm text-brand-error">{aiError[activeQuestion.id]}</p>
                        )}
                      </div>
                    )}

                    {/* Thẻ báo, đẩy về phải cho sát nơi mắt sắp chạm tới thanh hành động */}
                    <div className="animate-hien-len ml-auto max-w-xs bg-bg-card border border-border-primary rounded shadow-lg p-5 flex items-start gap-3">
                      {dung && <CheckCircle2 className="w-6 h-6 text-brand-success shrink-0" />}
                      <div className="space-y-1">
                        <p className="text-xl font-bold text-text-primary leading-snug">
                          {dung ? "Chính xác!" : "Chưa chính xác."}
                        </p>
                        <p className="text-base text-text-secondary font-sans leading-snug">
                          {dung
                            ? "Giữ nhịp này nhé."
                            : "Đọc phần giải nghĩa ở đáp án đúng trước khi sang câu sau."}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/*
                THANH HÀNH ĐỘNG ĐÁY, thay cho cụm chrome cũ nằm TRÊN câu hỏi.

                Đối chiếu song song với trang bài tập của Khan Academy ở khổ 1280px: phía trên
                câu hỏi của họ **không có gì** ngoài tiêu đề bài và một đường kẻ. Mọi thứ phụ
                trợ đều nằm ở một thanh ghim dưới đáy vùng nội dung: nút biểu tượng phụ bên
                trái, chỉ báo tiến độ ở giữa, hành động chính bên phải.

                Sản phẩm này trước đó đặt **11 phần tử** phía trên câu hỏi: chip số câu, chip
                mức khó, mã ID, công tắc gia sư AI, nhãn gia sư, nút đánh dấu, nút báo lỗi, cùng
                hai dòng chủ đề và khái niệm. Người học mở màn ra là chạm vào một hàng công cụ
                trước khi chạm được vào câu hỏi.

                **Không xoá một chức năng nào**, chỉ dời chỗ: toàn bộ cụm ấy nay nằm ở thanh
                đáy này, đúng vị trí Khan đặt các nút phụ, tức đúng chỗ mắt dừng lại SAU khi đã
                đọc xong bốn phương án và cần quyết định làm gì tiếp.
              */}
              <div className="border-t border-border-primary/60 pt-4 mt-2 flex flex-wrap items-center justify-between gap-3">

                {/* Trái: các hành động phụ, đúng vị trí Khan đặt nút biểu tượng phụ */}
                <div className="flex items-center gap-2 order-2 sm:order-1">
                  {!exam.isSubmitted && (
                    <label
                      className="flex items-center gap-1.5 cursor-pointer select-none px-2 py-1.5 rounded-md hover:bg-bg-surface transition"
                      title="Giáo viên AI Coaching: giảng ngay sau khi chọn đáp án"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={isTutorMode}
                          onChange={(e) => { setIsTutorMode(e.target.checked); }}
                          className="sr-only"
                        />
                        <div className={`w-8 h-4 rounded-full transition duration-150 ${isTutorMode ? "bg-brand-success" : "bg-bg-surface border border-border-primary"}`}></div>
                        <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full shadow-md transition-transform duration-150 ${isTutorMode ? "transform translate-x-4 bg-white" : "bg-text-muted"}`}></div>
                      </div>
                      <Sparkles className="w-4 h-4 text-brand-success shrink-0" />
                      <span className="text-xs text-text-secondary hidden lg:inline whitespace-nowrap">Gia sư AI</span>
                      <span className="sr-only">Giáo viên AI Coaching</span>
                    </label>
                  )}

                  <button
                    onClick={() => toggleBookmark(activeQuestion.id)}
                    className={`p-2 rounded-md transition duration-150 cursor-pointer ${
                      activeBookmarked
                        ? "bg-brand-warning-bg text-brand-warning"
                        : "text-text-muted hover:bg-bg-surface hover:text-text-primary"
                    }`}
                    title="Đánh dấu câu hỏi trọng tâm"
                  >
                    <Bookmark className={`w-4 h-4 ${activeBookmarked ? "fill-current" : ""}`} />
                  </button>

                  <button
                    onClick={() => toggleFlag(activeQuestion.id)}
                    className={`p-2 rounded-md transition duration-150 cursor-pointer ${
                      activeFlagged
                        ? "bg-brand-warning-bg text-brand-warning"
                        : "text-text-muted hover:bg-bg-surface hover:text-text-primary"
                    }`}
                    title={`Đánh dấu câu nghi ngờ để rà soát lại (mã câu #${activeQuestion.id})`}
                  >
                    <Flag className={`w-4 h-4 ${activeFlagged ? "fill-current" : ""}`} />
                  </button>
                </div>

                {/* Giữa: vị trí trong phiên và mức khó, viết thành CÂU thay vì hai cái chip.
                    Khan viết tiến độ thành câu ("Hoàn thành 7 câu hỏi") chứ không đóng khung. */}
                {/*
                  TIẾN ĐỘ DẠNG CHẤM, THAY CHO LƯỚI SỐ Ở CỘT PHẢI.

                  Khan Academy thể hiện tiến độ trong một phiên bằng một hàng chấm nhỏ nằm ngay
                  thanh đáy, kèm một câu chữ ("Hoàn thành 7 câu hỏi"). Không có lưới số, không
                  có thẻ riêng, không có bảng chú giải.

                  Vì sao đây là quyết định về tâm lý học tập chứ không phải về chỗ đặt: một lưới
                  10 con số mời người học đếm xem còn bao nhiêu câu nữa. Một hàng chấm chỉ trả
                  lời "đang ở đâu" khi được hỏi tới. Trong lúc đang cân nhắc đáp án, câu hỏi
                  đáng được toàn bộ sự chú ý, còn tiến độ nên nằm ở nền.

                  **Giữ nguyên chức năng nhảy câu**: mỗi chấm vẫn là một nút bấm được, có nhãn
                  đọc màn hình mô tả đủ số câu và trạng thái, nên thông tin mà bảng chú giải cũ
                  mang theo không mất đi mà chuyển vào chính từng chấm.
                */}
                <div className="flex items-center gap-3 order-1 sm:order-2 w-full sm:w-auto justify-center">
                  <span className="text-xs text-text-muted tabular-nums whitespace-nowrap">
                    Câu {currentIdx + 1} trên {examQuestions.length}
                  </span>
                  <div className="flex items-center gap-1.5" role="group" aria-label="Chuyển nhanh tới câu bất kỳ">
                    {examQuestions.map((q, idx) => {
                      const daTraLoi = exam.answers[q.id] !== undefined;
                      const dangMo = currentIdx === idx;
                      const daDanhDau = exam.bookmarks?.includes(q.id) || dbStats.bookmarks.includes(q.id)
                        || exam.flags?.includes(q.id) || dbStats.flags.includes(q.id);
                      let kieu = "bg-border-primary hover:bg-text-muted";
                      let trangThai = "chưa trả lời";
                      if (exam.isSubmitted) {
                        const dung = exam.answers[q.id] === q.correctAnswer;
                        kieu = dung ? "bg-brand-success" : daTraLoi ? "bg-brand-error" : "bg-border-primary";
                        trangThai = dung ? "trả lời đúng" : daTraLoi ? "trả lời sai" : "bỏ trống";
                      } else if (daTraLoi) {
                        kieu = "bg-text-secondary hover:bg-text-primary";
                        trangThai = "đã trả lời";
                      }
                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentIdx(idx)}
                          aria-current={dangMo ? "true" : undefined}
                          title={`Câu ${idx + 1}: ${trangThai}${daDanhDau ? ", đã đánh dấu" : ""}`}
                          /*
                            Chấm đang mở KHÔNG được dùng lớp `bg-nut-chinh`: quy tắc ép đặc tả
                            nút chính trong index.css bắt theo chính lớp đó và sẽ áp
                            `min-height: 40px` cùng bo góc 4px, biến cái chấm 10px thành một ô
                            vuông 40px. Dùng thẳng biến màu để tránh trúng quy tắc ấy.
                          */
                          className={`rounded-full transition-all duration-150 cursor-pointer relative ${
                            dangMo ? "w-3 h-3 bg-[color:var(--nut-chinh)]" : `w-2 h-2 ${kieu}`
                          }`}
                        >
                          <span className="sr-only">Câu {idx + 1}, {trangThai}{daDanhDau ? ", đã đánh dấu" : ""}</span>
                          {daDanhDau && !dangMo && (
                            <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-warning" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Phải: điều hướng câu, đúng vị trí Khan đặt hành động chính */}
                <div className="flex items-center gap-2 order-3">
                  <button
                    onClick={handlePrev}
                    disabled={currentIdx === 0}
                    className="flex items-center gap-1 px-3 h-10 text-sm font-bold text-text-secondary rounded hover:bg-bg-surface transition disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Câu trước</span>
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIdx === examQuestions.length - 1}
                    className="flex items-center gap-1 px-4 h-10 text-sm font-bold border border-border-primary bg-bg-card hover:bg-bg-surface text-text-primary rounded transition disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                  >
                    <span className="whitespace-nowrap">Câu sau</span>
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </button>

                  {/*
                    NÚT NỘP BÀI CHUYỂN TỪ GÓC TRÊN PHẢI XUỐNG ĐÁY PHẢI.

                    Khan Academy đặt hành động chính của trang bài tập ("Kiểm tra kết quả") ở
                    **đáy bên phải**, ngay cạnh điều hướng câu. Sản phẩm này để "Nộp bài" ở góc
                    trên phải, cạnh nút thoát phiên.

                    Vì sao đây là quyết định về luồng thao tác: hành động chính phải nằm ở nơi
                    mắt KẾT THÚC, tức sau khi đã đọc câu hỏi và bốn phương án. Đặt nó ở đỉnh
                    màn là bắt người học đi ngược lên, và đặt nó sát nút thoát là để hai hành
                    động không thể hoàn tác nằm cạnh nhau.
                  */}
                  {!exam.isSubmitted && (
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      className="flex items-center gap-1.5 px-4 h-10 bg-nut-chinh hover:bg-nut-chinh-re-chuot text-white text-sm font-bold rounded transition cursor-pointer"
                    >
                      <Send className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">Nộp bài</span>
                    </button>
                  )}
                </div>
              </div>

              {/*
                NHẮC PHÍM TẮT, MỘT DÒNG RIÊNG DƯỚI THANH HÀNH ĐỘNG.

                Ở lượt trước tôi nhét dòng này vào giữa thanh đáy rồi đặt mốc hiện là `2xl`.
                Bộ tự kiểm chứng bắt được ngay: các mốc của Tailwind tính theo bề rộng CỬA SỔ,
                nên đặt `2xl` là ẩn nó ở gần như mọi khổ màn hình thật, tức xoá luôn phần dạy
                phím tắt. Một phím tắt không ai biết thì bằng không.

                Nay tách ra một dòng riêng, luôn hiện từ `sm` trở lên, chữ nhạt để không tranh
                chú ý với thanh hành động ngay trên nó.
              */}
              {!exam.isSubmitted && (
                <div className="hidden sm:flex items-center justify-center gap-1.5 text-2xs text-text-muted pt-1">
                  <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums">A</kbd>
                  <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums">B</kbd>
                  <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums">C</kbd>
                  <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums">D</kbd>
                  <span>để chọn</span>
                  <span aria-hidden="true">•</span>
                  <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums">←</kbd>
                  <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-primary rounded tabular-nums">→</kbd>
                  <span>để chuyển câu</span>
                </div>
              )}

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
                    <h4 className="text-xs font-medium text-text-primary">
                      <span>Bài giảng giải thích chi tiết bằng AI (Trực tuyến)</span>
                    </h4>
                    <p className="text-2xs text-text-secondary leading-relaxed max-w-xl font-sans">
                      Sử dụng trí tuệ nhân tạo Gemini để giải mã câu hỏi theo **Mức độ giải thích** được chọn bên dưới. AI phân tích sâu bẫy tư duy và các đáp án nhiễu.
                    </p>
                  </div>

                  <button 
                    disabled={aiLoading[activeQuestion.id]}
                    onClick={() => handleRequestAIExplanation(activeQuestion.id, explanationLevel)}
                    className="shrink-0 bg-nut-chinh hover:bg-nut-chinh-re-chuot text-white disabled:opacity-50 text-2xs font-medium px-4 py-2 rounded-lg transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
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
                    <AlertTriangle className="w-4 h-4 text-brand-error shrink-0" />
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
                              <Brain className="w-4 h-4 shrink-0" />
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
                    {/*
                      Đã gỡ `prose dark:prose-invert max-w-none` ngày 30/07/2026: plugin
                      `@tailwindcss/typography` KHÔNG có trong package.json, nên ba lớp này chưa
                      từng sinh ra một dòng CSS nào. Đo trên trình duyệt: dựng một thẻ mang lớp
                      `prose` rồi đọc lại kiểu tính toán, không khác gì thẻ trần.

                      Cùng khuôn với `brand-danger` chưa từng định nghĩa và `animate-fade-in-up`
                      chưa từng có token. Nội dung ở đây do `SimpleMarkdown` dựng nên vốn đã có
                      kiểu riêng, không mất gì khi gỡ.
                    */}
                    <div className="bg-bg-card p-5 rounded-lg border border-border-primary/60 text-xs text-text-secondary leading-relaxed font-sans">
                      <div className="flex items-center gap-1.5 mb-3 text-2xs tabular-nums text-brand-info font-bold">
                        <Sparkles className="w-4 h-4 shrink-0" />
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
                    <h4 className="text-xs font-medium text-text-primary">
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
                        {/* Gỡ `prose dark:prose-invert max-w-none`, xem lý do ở chú thích trên. */}
                        <div className="whitespace-pre-line leading-relaxed">
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
        <div className="space-y-5">
          
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

          {/*
            BỎ THẺ "BẢNG CÂU HỎI" Ở CỘT PHẢI.

            Chức năng nhảy tới câu bất kỳ đã chuyển thành hàng chấm tiến độ nằm trong thanh
            hành động đáy, xem chú thích tại đó. Mỗi chấm vẫn bấm được, vẫn phân biệt trạng
            thái, và nhãn đọc màn hình của nó mang theo đúng thông tin mà bảng chú giải cũ
            phải viết ra thành sáu dòng riêng.
          */}

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
                    <HelpCircle className="w-4 h-4 shrink-0" />
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
                  className="w-full sm:w-auto bg-nut-chinh hover:bg-nut-chinh-re-chuot text-white text-2xs font-medium px-4 py-1.5 rounded-lg transition duration-150 cursor-pointer"
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
            <Check className="w-4 h-4.5 shrink-0" />
          </div>
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
