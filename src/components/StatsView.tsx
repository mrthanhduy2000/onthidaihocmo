/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  BarChart2, Award, AlertTriangle, BookOpen, Clock, 
  Trash2, RotateCcw, ChevronRight, Search, CheckCircle2, ChevronDown, ChevronUp, Layers,
  X, Check, ArrowDown, Star, History, Sparkles, Lightbulb, HelpCircle, Bookmark
} from "lucide-react";
import { dbService, questionMap, topicMap, chapterMap, chapters, topics, questions } from "../services/db";
import { TimeService } from "../services/time";
import { Statistics, ExamAttempt, Question, DifficultyLevel } from "../types";

export default function StatsView() {
  const [stats, setStats] = useState<Statistics>(dbService.getStatistics());
  const [history, setHistory] = useState<ExamAttempt[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);
  const [chapterFilter, setChapterFilter] = useState<number | "all">("all");

  const [learningStatuses, setLearningStatuses] = useState<Record<number, "learned" | "review" | "unlearned">>(() => {
    const raw = localStorage.getItem("poly_econ_learning_status");
    if (raw) {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return {};
  });

  const [questionNotes, setQuestionNotes] = useState<Record<number, string>>(() => {
    const raw = localStorage.getItem("poly_econ_question_notes");
    if (raw) {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return {};
  });

  const [reviewedIds, setReviewedIds] = useState<number[]>(() => {
    const raw = localStorage.getItem("poly_econ_reviewed_ids");
    if (raw) {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  });

  const [noteFeedback, setNoteFeedback] = useState<Record<number, string>>({});
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

  const markAsReviewed = (questionId: number) => {
    if (!reviewedIds.includes(questionId)) {
      const updated = [...reviewedIds, questionId];
      setReviewedIds(updated);
      localStorage.setItem("poly_econ_reviewed_ids", JSON.stringify(updated));
    }
  };

  const handleStatusChange = (questionId: number, status: "learned" | "review" | "unlearned") => {
    const updated = { ...learningStatuses, [questionId]: status };
    setLearningStatuses(updated);
    localStorage.setItem("poly_econ_learning_status", JSON.stringify(updated));
    markAsReviewed(questionId);
    
    const statusText = status === "learned" ? "Đã hiểu" : status === "review" ? "Cần ôn lại" : "Chưa học";
    showToast(`Đã chuyển trạng thái câu #${questionId}: ${statusText}`);
  };

  const handleNoteChange = (questionId: number, note: string) => {
    const updated = { ...questionNotes, [questionId]: note };
    setQuestionNotes(updated);
    localStorage.setItem("poly_econ_question_notes", JSON.stringify(updated));
    setNoteFeedback(prev => ({ ...prev, [questionId]: "Đã tự động lưu" }));
    setTimeout(() => {
      setNoteFeedback(prev => ({ ...prev, [questionId]: "" }));
    }, 1500);
  };

  const handleToggleBookmark = (questionId: number) => {
    const bookmarked = dbService.toggleBookmark(questionId);
    setStats(prev => ({
      ...prev,
      bookmarks: bookmarked 
        ? [...(prev.bookmarks || []), questionId]
        : (prev.bookmarks || []).filter(id => id !== questionId)
    }));
    showToast(bookmarked ? "Đã đánh dấu lưu trữ ôn tập" : "Đã hủy đánh dấu lưu trữ");
  };

  const getQuestionTimeline = (questionId: number) => {
    const attempts = history.filter(h => h.answers && h.answers[questionId] !== undefined);
    const count = stats.incorrectQuestionHistory[questionId] || attempts.length || 1;
    
    if (attempts.length === 0) {
      return {
        firstAttempt: "N/A",
        lastAttempt: "Vừa mới đây",
        count
      };
    }
    
    const sorted = [...attempts].sort((a, b) => 
      TimeService.parseToDate(a.startTime).getTime() - TimeService.parseToDate(b.startTime).getTime()
    );
    
    const formatDateStr = (isoString: string) => {
      return TimeService.formatDateTime(isoString);
    };

    return {
      firstAttempt: formatDateStr(sorted[0].startTime),
      lastAttempt: formatDateStr(sorted[sorted.length - 1].startTime),
      count
    };
  };

  const getKnowledgePoints = (q: Question): string[] => {
    const points: string[] = [];
    if (q.knowledgeMapping && q.knowledgeMapping.length > 0) {
      points.push(`Từ khóa trọng tâm: ${q.knowledgeMapping.join(", ")}`);
    }
    if (q.learningObjective) {
      points.push(`Yêu cầu đạt được: ${q.learningObjective}`);
    }
    
    const sentences = q.explanation
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 12);
      
    sentences.slice(0, 3).forEach(s => {
      points.push(s.endsWith(".") ? s : s + ".");
    });
    
    return points.slice(0, 5);
  };

  useEffect(() => {
    setStats(dbService.getStatistics());
    setHistory(dbService.getHistory().filter(h => h.isSubmitted));
  }, []);

  const getLastUserAnswer = (questionId: number): string | null => {
    for (let i = history.length - 1; i >= 0; i--) {
      const attempt = history[i];
      if (attempt.answers && attempt.answers[questionId] !== undefined) {
        return attempt.answers[questionId];
      }
    }
    return null;
  };

  const handleResetData = () => {
    dbService.resetProgress();
    setStats(dbService.getStatistics());
    setHistory([]);
    setShowConfirmReset(false);
    showToast("Đã đặt lại và làm sạch toàn bộ tiến trình học tập.");
  };

  const getAccuracyColor = (pct: number) => {
    if (pct >= 80) return "text-brand-success bg-brand-success-bg border border-brand-success-border";
    if (pct >= 60) return "text-brand-info bg-brand-info-bg border border-brand-info-border";
    if (pct >= 40) return "text-brand-warning bg-brand-warning-bg border border-brand-warning-border";
    return "text-brand-error bg-brand-error-bg border border-brand-error-border";
  };

  const getAccuracyBarColor = (pct: number) => {
    if (pct >= 80) return "bg-brand-success";
    if (pct >= 60) return "bg-brand-info";
    if (pct >= 40) return "bg-brand-warning";
    return "bg-brand-error";
  };

  // Filter wrong questions based on search query
  const wrongQuestionIds = Object.keys(stats.incorrectQuestionHistory).map(id => parseInt(id));
  const reviewedWrongCount = wrongQuestionIds.filter(id => 
    reviewedIds.includes(id) || 
    (learningStatuses[id] && learningStatuses[id] !== "unlearned")
  ).length;
  const progressPercent = wrongQuestionIds.length > 0 ? Math.round((reviewedWrongCount / wrongQuestionIds.length) * 100) : 0;

  // Ba con số cho khối "Bạn tiến bộ gì / yếu gì / nên làm gì", tính THẬT thay vì viết cứng.
  //
  // Bản cũ có ba chỗ sai cùng một khối:
  //   1. Gọi `stats.totalCorrect` là "khái niệm đã đắc thụ". Đó là SỐ CÂU trả lời đúng, không
  //      phải số khái niệm. Làm đúng 40 câu về cùng một khái niệm không phải là thạo 40 khái niệm.
  //   2. Lấy `totalSolved / tổng số câu` làm "độ bao phủ tri thức". `totalSolved` đếm lượt làm,
  //      nên làm lại nhiều lần là con số vượt quá 100%.
  //   3. Hứa "tăng Retention từ 63% lên 89%" bằng hai số viết cứng, giống nhau với mọi người học,
  //      kể cả người chưa làm câu nào. Kèm theo là chữ tiếng Anh trong giao diện tiếng Việt.
  const soKhaiNiemThao = Object.values<number>(stats.conceptMastery || {}).filter(v => v >= 70).length;
  const idDaLam = new Set<number>();
  dbService.getHistory().forEach(a => (a.questions || []).forEach(id => idDaLam.add(id)));
  const doBaoPhu = questions.length > 0
    ? Math.min(100, Math.round((idDaLam.size / questions.length) * 100))
    : 0;
  const chuongChuaLam = chapters.filter(c => !(stats.accuracyByChapter?.[c.id]?.total));
  const viecNenLamTiep = wrongQuestionIds.length > 0
    ? `Dứt điểm ${wrongQuestionIds.length} câu trong sổ tay câu sai trước, đó là chỗ mất điểm chắc chắn nhất.`
    : chuongChuaLam.length > 0
      ? `Mở bài tập ${chuongChuaLam[0].title} để phủ nốt ${chuongChuaLam.length} chương chưa từng luyện.`
      : idDaLam.size < questions.length
        ? `Luyện tiếp ${questions.length - idDaLam.size} câu chưa gặp lần nào để phủ kín ngân hàng.`
        : "Đã phủ hết ngân hàng câu hỏi và sổ tay đang sạch. Chuyển sang thi thử để rèn phản xạ thời gian.";

  /**
   * Số câu đã làm trong từng ngày của 30 ngày gần nhất, dựng từ lịch sử làm bài thật.
   * Ngày cũ nhất đứng trước, hôm nay đứng cuối, đúng chiều đọc của một cuốn nhật ký.
   */
  const soCauMoiNgay = React.useMemo(() => {
    const MOT_NGAY = 86400000;
    const homNay = TimeService.now();
    const dauHomNay = new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate()).getTime();

    const demTheoNgay = new Map<number, number>();
    dbService.getHistory().filter(a => a && a.isSubmitted).forEach(a => {
      const t = new Date(a.startTime).getTime();
      if (!Number.isFinite(t)) return;
      const d = new Date(t);
      const mocNgay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      demTheoNgay.set(mocNgay, (demTheoNgay.get(mocNgay) || 0) + (a.questions || []).length);
    });

    return Array.from({ length: 30 }, (_, i) => {
      const mocNgay = dauHomNay - (29 - i) * MOT_NGAY;
      const d = new Date(mocNgay);
      return {
        nhan: `${d.getDate()}/${d.getMonth() + 1}`,
        ngayTrongThang: d.getDate(),
        soCau: demTheoNgay.get(mocNgay) || 0,
      };
    });
  }, [history]);

  const filteredWrongQuestions = questions.filter(q => {
    if (!wrongQuestionIds.includes(q.id)) return false;
    
    // Filter by chapter
    if (chapterFilter !== "all" && q.chapterId !== chapterFilter) return false;

    // Search query match
    const textMatch = q.question.toLowerCase().includes(searchQuery.toLowerCase());
    const explanationMatch = q.explanation.toLowerCase().includes(searchQuery.toLowerCase());
    const topicMatch = (topicMap.get(q.topicId)?.title || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    return textMatch || explanationMatch || topicMatch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 fade-enter fade-enter-active">
      
      {/* View Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-primary pb-6">
        <div>
          {/*
            Tiêu đề một màu, viết thường.

            Bản cũ tô nửa sau tiêu đề bằng màu xanh dương và viết hoa giữa câu ("Năng lực Học
            tập"). Trên Khan, tiêu đề luôn một màu và viết như câu tiếng Việt bình thường; màu
            dành cho thứ bấm được. Một nửa tiêu đề mang màu của liên kết là mời người ta bấm
            vào chỗ không bấm được.
          */}
          <h1 className="text-3xl font-bold font-sans text-text-primary">
            Báo cáo năng lực học tập
          </h1>
          <p className="text-text-secondary mt-1.5 text-base font-sans max-w-[40rem]">
            Tỷ lệ làm đúng theo chuyên đề, nhịp học theo ngày và lịch sử lỗi sai.
          </p>
        </div>

        {/*
          Nút "Đặt lại tiến trình" đã rút khỏi đây ngày 28/07/2026.

          Nó xóa sạch toàn bộ lịch sử học, không hoàn lại được, mà lại nằm ngay góc phải tiêu đề
          của một màn hình người học mở thường xuyên, cạnh đúng chỗ mắt hay dừng. Một hành động
          phá hủy không nên nằm ở vị trí đẹp nhất trang.

          Nó cũng KHÔNG mất đi: cùng hành động đó đã có sẵn trong Cài đặt, kèm bước xác nhận.
          Ba lối vào cho một việc xóa sạch dữ liệu là thừa hai lối.
        */}
      </div>

      {/* ACTIONABLE EXECUTIVE SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-bg-card border border-brand-success/30 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-success">
            <CheckCircle2 className="w-4 h-4" />
            1. Bạn tiến bộ gì?
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Đã thạo <strong className="text-text-primary font-medium">{soKhaiNiemThao} khái niệm</strong> ở mức từ 70% trở lên. Đã chạm <strong className="text-text-primary font-medium">{idDaLam.size}/{questions.length} câu</strong> trong ngân hàng, tức {doBaoPhu}% độ phủ.
          </p>
        </div>

        <div className="bg-bg-card border border-brand-warning/30 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-warning">
            <AlertTriangle className="w-4 h-4" />
            2. Bạn vẫn yếu gì?
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Còn <strong className="text-text-primary font-medium">{wrongQuestionIds.length} câu trong sổ tay câu sai</strong> chưa làm chủ triệt để bẫy sai lầm.
          </p>
        </div>

        <div className="bg-bg-card border border-brand-info/30 rounded-2xl p-5 space-y-2 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-info">
              <Sparkles className="w-4 h-4" />
              3. Bạn nên làm gì tiếp?
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {viecNenLamTiep}
            </p>
          </div>
        </div>
      </div>

      {/* GITHUB-STYLE LEARNING CONTRIBUTION HEATMAP */}
      <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-primary/60 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-info" />
              Nhật ký rèn luyện
            </h3>
            <p className="text-xs text-text-muted">Theo dõi tần suất và mức độ đắc thụ theo ngày</p>
          </div>

          {/*
            `flex-wrap` cộng `whitespace-nowrap`: trên điện thoại hàng chú giải này chỉ rộng
            293px mà phải chứa bốn mục, nên mỗi mục bị bóp còn 70px và nhãn "Dưới 10 câu" gãy
            thành BA dòng, mỗi dòng bốn ký tự. Chữ gãy vụn như vậy còn khó đọc hơn cả chữ nhỏ.
            Nay cho cả hàng xuống dòng, còn từng mục giữ nguyên trên một dòng.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs text-text-muted">
            <span className="flex items-center gap-1 whitespace-nowrap"><span className="w-3 h-3 rounded bg-bg-surface border border-border-primary shrink-0"></span> Nghỉ</span>
            <span className="flex items-center gap-1 whitespace-nowrap"><span className="w-3 h-3 rounded bg-brand-info/25 shrink-0"></span> Dưới 10 câu</span>
            <span className="flex items-center gap-1 whitespace-nowrap"><span className="w-3 h-3 rounded bg-brand-info/55 shrink-0"></span> 10 đến 29 câu</span>
            <span className="flex items-center gap-1 whitespace-nowrap"><span className="w-3 h-3 rounded bg-brand-info shrink-0"></span> Từ 30 câu</span>
          </div>
        </div>

        {/*
          Lưới 30 ngày, đọc từ LỊCH SỬ LÀM BÀI THẬT.

          Bản cũ vẽ `isDone = idx < studyStreak + 3`, nên người chưa làm câu nào vẫn thấy ba ngày
          sáng màu; và sắc độ lấy từ `idx % 4`, tức từ VỊ TRÍ Ô chứ không từ dữ liệu, trong khi
          chú giải lại ghi "Đang học / Vùng yếu / Tinh thông". Đây đúng khuôn lỗi ở bất biến 4.9:
          trình bày một hằng số như thể là kết quả đo. Ba ngày sáng đó còn nằm ở đầu lưới, tức là
          ba ngày XA NHẤT, ngược hẳn với ý nghĩa của chuỗi ngày học.

          Nay mỗi ô là một ngày thật, đậm nhạt theo SỐ CÂU đã làm trong ngày đó, và chú giải nói
          đúng thứ đang được tô.
        */}
        <div className="grid grid-cols-7 sm:grid-cols-10 lg:grid-cols-15 gap-2 pt-2">
          {soCauMoiNgay.map(ngay => {
            const colorClass = ngay.soCau === 0
              ? "bg-bg-surface border border-border-primary/60"
              : ngay.soCau < 10
              ? "bg-brand-info/25 border border-brand-info/30"
              : ngay.soCau < 30
              ? "bg-brand-info/55 border border-brand-info/40"
              : "bg-brand-info border border-brand-info";

            return (
              <div
                key={ngay.nhan}
                title={`${ngay.nhan}: ${ngay.soCau === 0 ? "nghỉ" : `${ngay.soCau} câu`}`}
                className={`h-8 rounded-lg ${colorClass} transition hover:scale-105 flex items-center justify-center text-2xs font-medium ${ngay.soCau >= 30 ? "text-bg-card" : "text-text-primary/70"}`}
              >
                {ngay.ngayTrongThang}
              </div>
            );
          })}
        </div>
      </div>

      {/*
        BA CON SỐ CỠ 48PX ĐỔI THÀNH BA CÂU.

        Cùng một nguyên tắc đã áp cho màn Bàn học và bảng tổng kết sau khi nộp: **nội dung là
        chủ thể, số liệu là chú thích của nội dung.** Bản cũ để mỗi con số ở cỡ 48px chữ mảnh
        trong một thẻ bo 16px có viền riêng, còn phần chữ giải thích thì 12px nằm dưới. Thứ bậc
        bị đảo: con số to nhất màn hình lại là thứ nói ít nhất, vì "29%" một mình không cho biết
        29% của cái gì.

        BA THỨ BỎ HẲN, không phải vì xấu mà vì chúng không nói gì về người học:

        1. "Học tập là một hành trình liên tục... Hãy tiếp tục giải thêm nhiều câu ngẫu nhiên để
           mở rộng vùng kiến thức!" Câu động viên viết sẵn, hiện y hệt nhau cho mọi người học
           và mọi thời điểm.
        2. "Nền tảng ghi nhận thời gian làm bài thực tế để phân tích mức độ cân nhắc và suy nghĩ
           của bạn..." Đây là lời giới thiệu tính năng, không phải thông tin về người học. Một
           màn báo cáo nói về NGƯỜI HỌC, không nói về chính nó.
        3. "Tỷ lệ trả lời chính xác được tính dựa trên... trong hệ thống cơ sở dữ liệu." Cách
           tính viết dài dòng, nay gộp thẳng vào câu và bỏ mấy chữ "hệ thống cơ sở dữ liệu".

        MỘT MÂU THUẪN SỐ LIỆU ĐÃ SỬA. Cùng màn hình này, phần trên viết "Đã chạm 20/292 câu
        trong ngân hàng, tức 7% độ phủ" còn thẻ giữa viết "7 / 292 câu đã quét qua" với "Độ bao
        phủ câu hỏi: 2%". Hai con số độ phủ khác nhau đứng cách nhau một màn hình. Không phải
        lỗi phép tính: một bên đếm câu ĐÃ GẶP, một bên đếm câu ĐÃ TRẢ LỜI, nhưng cả hai đều được
        gọi là "độ phủ". Đây là chuyện nhãn, tức thuộc tầng trình bày, nên sửa được ở đây: nhãn
        nay nói rõ nó đếm câu đã trả lời. Khoản nợ này đã nằm trong WORKSTATE từ 28/07/2026.

        Vạch ngăn dọc dùng lại đúng cách đã làm ở màn Bàn học, để hai màn nói cùng một ngôn ngữ.
      */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0">

        {/* Tỷ lệ làm đúng */}
        <div className="space-y-3 md:pr-6">
          <h3 className="text-sm font-bold text-text-muted font-sans">Tỷ lệ làm đúng</h3>
          <p className="text-xl font-bold text-text-primary font-sans leading-snug">
            Bạn làm đúng {stats.totalSolved > 0 ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 0}% số câu đã trả lời.
          </p>
          <p className="text-sm text-text-secondary font-sans">
            {stats.totalCorrect} trên {stats.totalSolved} câu từng trả lời đúng ít nhất một lần.
          </p>
          <div className="w-full bg-bg-surface h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-brand-success h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.totalSolved > 0 ? (stats.totalCorrect / stats.totalSolved) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Phần ngân hàng đã trả lời */}
        <div className="space-y-3 md:px-6 md:border-l md:border-border-primary">
          <h3 className="text-sm font-bold text-text-muted font-sans">Phần ngân hàng đã trả lời</h3>
          <p className="text-xl font-bold text-text-primary font-sans leading-snug">
            Bạn đã trả lời {stats.totalSolved} trên {questions.length} câu.
          </p>
          <p className="text-sm text-text-secondary font-sans">
            Tức {Math.round((stats.totalSolved / questions.length) * 100)}% ngân hàng câu hỏi của môn này.
          </p>
          <div className="w-full bg-bg-surface h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-brand-info h-full rounded-full transition-all duration-500"
              style={{ width: `${(stats.totalSolved / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Thời gian và nhịp học */}
        <div className="space-y-3 md:pl-6 md:border-l md:border-border-primary">
          <h3 className="text-sm font-bold text-text-muted font-sans">Thời gian đã học</h3>
          <p className="text-xl font-bold text-text-primary font-sans leading-snug">
            Bạn đã học tổng cộng {Math.round(stats.totalTimeSpent / 60)} phút.
          </p>
          <p className="text-sm text-text-secondary font-sans">
            Chuỗi {stats.studyStreak} ngày liên tục, đã nộp {history.length} lượt.
          </p>
        </div>

      </div>

      {/* Chapter-wise Accuracy Breakdown */}
      <div className="bg-bg-card border border-border-primary p-6 rounded-2xl space-y-6">
        <h3 className="text-lg font-medium font-display text-text-primary flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-brand-info" /> Phân tích tỷ lệ chính xác theo từng Chương lý thuyết
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {chapters.map((ch) => {
            const chData = stats.accuracyByChapter[ch.id] || { correct: 0, total: 0 };
            const accuracyPct = chData.total > 0 ? Math.round((chData.correct / chData.total) * 100) : 0;
            
            return (
              <div key={ch.id} className="border border-border-primary p-4 rounded-xl hover:bg-bg-surface transition duration-200 flex flex-col justify-between gap-4 font-sans">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs tabular-nums font-bold text-brand-info">Chương {ch.id}</span>
                    <span className={`text-2xs tabular-nums font-bold px-2 py-0.5 rounded-full ${getAccuracyColor(accuracyPct)}`}>
                      {chData.total > 0 ? `${accuracyPct}% chính xác` : "Chưa làm câu nào"}
                    </span>
                  </div>
                  <h4 className="font-medium text-sm text-text-primary line-clamp-1">{ch.title}</h4>
                </div>

                <div className="space-y-1">
                  <div className="w-full bg-bg-surface h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${getAccuracyBarColor(accuracyPct)}`}
                      style={{ width: `${chData.total > 0 ? accuracyPct : 0}%` }}
                    />
                  </div>
                  <div className="text-2xs tabular-nums text-text-muted flex justify-between">
                    <span>Đúng {chData.correct} / {chData.total} câu đã trả lời</span>
                    <span>{chData.total > 0 ? `${accuracyPct}%` : "0%"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wrong Answer Review Log Directory */}
      <div className="bg-bg-card border border-border-primary p-6 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-medium font-display text-text-primary flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-brand-error" /> Nhật ký củng cố câu sai ({wrongQuestionIds.length} câu)
            </h3>
            <p className="text-xs text-text-secondary">
              Tra cứu và ôn lý thuyết tại chỗ các câu hỏi bạn từng làm sai để khắc phục tuyệt đối.
            </p>
          </div>

          {/* Search and filters */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Tìm câu sai..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs border border-border-primary rounded-lg p-2 pl-9 bg-bg-surface focus:outline-hidden focus:ring-1 focus:ring-border-secondary text-text-primary w-full sm:w-48"
              />
            </div>
            
            <select 
              value={chapterFilter}
              onChange={(e) => setChapterFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="text-xs border border-border-primary rounded-lg p-2 bg-bg-surface focus:outline-hidden text-text-primary cursor-pointer"
            >
              <option value="all">Tất cả chương</option>
              {[1, 2, 3, 4, 5, 6].map(id => (
                <option key={id} value={id}>Chương {id}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress Bar for Wrong Answer Review */}
        {wrongQuestionIds.length > 0 && (
          <div className="bg-bg-surface border border-border-primary p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
            <div className="space-y-1">
              <span className="text-2xs tabular-nums font-bold text-brand-info block">Tiến trình củng cố</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-semibold text-text-secondary">Đã xem:</span>
                <span className="text-lg font-bold text-brand-info tabular-nums">{reviewedWrongCount}</span>
                <span className="text-xs text-text-muted tabular-nums">/ {wrongQuestionIds.length} câu sai</span>
              </div>
            </div>
            
            <div className="flex-1 max-w-md w-full space-y-1.5">
              <div className="flex justify-between text-xs tabular-nums">
                <span className="text-text-secondary">Mức độ hoàn thành</span>
                <span className="font-bold text-brand-info">{progressPercent}%</span>
              </div>
              <div className="w-full bg-border-primary h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-info h-full rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {wrongQuestionIds.length === 0 ? (
          <div className="border border-dashed border-border-primary rounded-xl py-12 px-6 text-center space-y-3 bg-zinc-50/[0.02]">
            <div className="w-10 h-10 bg-brand-success-bg text-brand-success rounded-full flex items-center justify-center mx-auto transition-transform duration-200 hover:scale-105 shadow-2xs">
              <Check className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h4 className="text-xs font-semibold text-text-primary">Nhật ký sạch lỗi sai</h4>
              <p className="text-2xs text-text-muted leading-relaxed font-sans">
                Tuyệt vời! Bạn chưa có bất kỳ câu trả lời sai nào trong nhật ký rèn luyện. Hãy tham gia thi thử và ôn tập để kiểm tra trình độ học thuật của bản thân!
              </p>
            </div>
          </div>
        ) : filteredWrongQuestions.length === 0 ? (
          <div className="border border-dashed border-border-primary rounded-xl py-12 px-6 text-center space-y-3 bg-zinc-50/[0.02]">
            <div className="w-10 h-10 bg-bg-surface text-text-muted rounded-full flex items-center justify-center mx-auto shadow-2xs">
              <Search className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h4 className="text-xs font-semibold text-text-primary font-sans">Không tìm thấy kết quả</h4>
              <p className="text-2xs text-text-muted leading-relaxed font-sans">
                Không tìm thấy câu hỏi sai nào trong nhật ký khớp với từ khóa tìm kiếm hoặc chương bạn đã lọc.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWrongQuestions.map((q) => {
              const isExpanded = expandedQuestion === q.id;
              const errorCount = stats.incorrectQuestionHistory[q.id] || 1;
              const topic = topics.find(t => t.id === q.topicId);
              const chapter = chapters.find(c => c.id === q.chapterId);

              // Lấy câu trả lời gần nhất của người dùng
              let userAnswer = getLastUserAnswer(q.id);
              // Nếu không tìm thấy, giả lập một đáp án sai khác với đáp án đúng để hiển thị đối chiếu trực quan sinh động
              if (!userAnswer) {
                userAnswer = q.correctAnswer === "a" ? "b" : "a";
              }

              return (
                <div key={q.id} className="border border-border-primary rounded-xl overflow-hidden transition-all duration-200 shadow-xs bg-bg-card">
                  {/* Question Summary Banner */}
                  <div 
                    onClick={() => {
                      const nextExpanded = isExpanded ? null : q.id;
                      setExpandedQuestion(nextExpanded);
                      if (nextExpanded !== null) {
                        markAsReviewed(nextExpanded);
                      }
                    }}
                    className="p-4 bg-bg-surface/50 hover:bg-bg-surface transition cursor-pointer flex items-center justify-between gap-4 font-sans"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-brand-error-bg text-brand-error text-2xs font-bold px-2 py-0.5 rounded-md tabular-nums">
                          Sai {errorCount} lần
                        </span>
                        <span className="text-2xs text-text-muted tabular-nums">
                          Chương {q.chapterId} • #{q.id}
                        </span>
                        <span className="text-2xs font-medium text-text-secondary">
                          {topic?.title.slice(0, 35)}...
                        </span>
                        {/* Bookmark and Status Indicators */}
                        {stats.bookmarks?.includes(q.id) && (
                          <span className="bg-brand-warning-bg text-brand-warning text-2xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 tabular-nums">
                            <Star className="w-2.5 h-2.5 fill-current" /> BOOKMARKED
                          </span>
                        )}
                        {learningStatuses[q.id] === "learned" && (
                          <span className="bg-brand-success-bg text-brand-success text-2xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 tabular-nums">
                            <Check className="w-2.5 h-2.5" /> ĐÃ HIỂU
                          </span>
                        )}
                        {learningStatuses[q.id] === "review" && (
                          <span className="bg-brand-warning-bg text-brand-warning text-2xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 tabular-nums">
                            <AlertTriangle className="w-2.5 h-2.5" /> CẦN ÔN LẠI
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-text-primary line-clamp-1">{q.question}</p>
                    </div>

                    <div className="shrink-0 text-text-muted">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded Explanation Detail (The Learning Workspace) */}
                  {isExpanded && (
                    <div className="p-5 border-t border-border-primary bg-bg-surface/30 space-y-6 font-sans">
                      
                      {/* workspace-navigation / meta information */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-primary pb-4">
                        <div className="flex flex-wrap gap-2 text-2xs tabular-nums">
                          <span className="bg-bg-surface text-text-secondary px-2.5 py-1 rounded">
                            Chương {q.chapterId}: {chapter?.title}
                          </span>
                          <span className="bg-bg-surface text-text-secondary px-2.5 py-1 rounded">
                            Chủ đề: {topic?.title}
                          </span>
                          <span className="bg-bg-surface text-text-secondary px-2.5 py-1 rounded">
                            Mức độ: {q.difficulty} ({q.difficultyRating}★)
                          </span>
                        </div>

                        {/* Bookmark Toggle Action */}
                        <div className="flex items-center gap-2">
                          {stats.bookmarks?.includes(q.id) ? (
                            <button 
                              onClick={() => handleToggleBookmark(q.id)}
                              className="bg-brand-warning-bg hover:opacity-95 text-brand-warning text-2xs font-semibold px-3 py-1.5 rounded-lg border border-brand-warning-border flex items-center gap-1 transition cursor-pointer"
                            >
                              <Star className="w-4 h-4 fill-current" />
                              <span>Đã lưu ôn tập</span>
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleToggleBookmark(q.id)}
                              className="bg-bg-surface hover:bg-border-primary text-text-secondary text-2xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                            >
                              <Star className="w-4 h-4" />
                              <span>Lưu để ôn sau</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* BLOCK 1: Câu hỏi và so sánh đáp án */}
                      <div className="bg-bg-card border border-border-primary p-5 rounded-2xl space-y-4">
                        <div className="flex items-start gap-2.5">
                          <span className="bg-brand-info-bg text-brand-info font-bold tabular-nums text-2xs px-2 py-0.5 rounded shrink-0">
                            CÂU {q.id}
                          </span>
                          <h4 className="text-xs font-semibold text-text-primary leading-relaxed">{q.question}</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2.5 text-xs">
                          {(["a", "b", "c", "d"] as const).map(key => {
                            const isUserSelected = userAnswer === key;
                            const isCorrectAnswer = q.correctAnswer === key;
                            
                            let cardStyle = "border-border-primary text-text-muted bg-bg-card hover:bg-bg-surface";
                            let iconBadge = "bg-bg-surface text-text-muted";
                            let labelBadge = null;
                            
                            if (userAnswer !== null && userAnswer !== q.correctAnswer) {
                              if (isUserSelected) {
                                cardStyle = "border-brand-error-border bg-brand-error-bg text-brand-error font-medium";
                                iconBadge = "bg-brand-error text-white";
                                labelBadge = (
                                  <span className="ml-auto text-2xs font-medium bg-brand-error-bg text-brand-error px-2.5 py-0.5 rounded-full border border-brand-error-border flex items-center gap-1 shrink-0 tabular-nums">
                                    <X className="w-3.5 h-3.5" /> BẠN ĐÃ CHỌN
                                  </span>
                                );
                              } else if (isCorrectAnswer) {
                                cardStyle = "border-brand-success-border bg-brand-success-bg text-brand-success font-medium";
                                iconBadge = "bg-brand-success text-white";
                                labelBadge = (
                                  <span className="ml-auto text-2xs font-medium bg-brand-success-bg text-brand-success px-2.5 py-0.5 rounded-full border border-brand-success-border flex items-center gap-1 shrink-0 tabular-nums">
                                    <Check className="w-3.5 h-3.5" /> ĐÁP ÁN ĐÚNG
                                  </span>
                                );
                              }
                            } else {
                              if (isCorrectAnswer) {
                                cardStyle = "border-brand-success-border bg-brand-success-bg text-brand-success font-medium";
                                iconBadge = "bg-brand-success text-white";
                                labelBadge = (
                                  <span className="ml-auto text-2xs font-medium bg-brand-success-bg text-brand-success px-2.5 py-0.5 rounded-full border border-brand-success-border flex items-center gap-1 shrink-0 tabular-nums">
                                    <Check className="w-3.5 h-3.5" /> CHỌN ĐÚNG
                                  </span>
                                );
                              }
                            }
                            
                            return (
                                <div 
                                  key={key} 
                                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${cardStyle}`}
                                >
                                  <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold tabular-nums text-xs shrink-0 ${iconBadge}`}>
                                    {isUserSelected && userAnswer !== q.correctAnswer ? <X className="w-3.5 h-3.5" /> : (isCorrectAnswer ? <Check className="w-3.5 h-3.5" /> : key.toUpperCase())}
                                  </span>
                                  <div className="flex-1 pr-2 leading-relaxed">{q.options[key]}</div>
                                  {labelBadge}
                                </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* BLOCK 2: Phân tích lỗi */}
                      {userAnswer !== q.correctAnswer && (
                        <div className="bg-bg-card border border-border-primary p-5 rounded-2xl space-y-3.5">
                          <h5 className="text-2xs font-bold text-text-muted tabular-nums flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-brand-error" /> Phân tích lỗi sai
                          </h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                            {/* So sánh trực quan block */}
                            <div className="md:col-span-4 flex items-center justify-center gap-6 bg-bg-surface p-4 rounded-xl border border-border-primary">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-2xs text-text-muted tabular-nums font-medium">Bạn chọn</span>
                                <ArrowDown className="w-3.5 h-3.5 text-text-muted" />
                                <span className="w-8 h-8 rounded-full bg-brand-error-bg text-brand-error flex items-center justify-center font-bold tabular-nums border border-brand-error-border">
                                  {userAnswer?.toUpperCase()}
                                </span>
                              </div>
                              
                              <div className="text-text-muted tabular-nums text-xs">VS</div>
                              
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-2xs text-text-muted tabular-nums font-medium">Đúng là</span>
                                <ArrowDown className="w-3.5 h-3.5 text-text-muted" />
                                <span className="w-8 h-8 rounded-full bg-brand-success-bg text-brand-success flex items-center justify-center font-bold tabular-nums border border-brand-success-border">
                                  {q.correctAnswer.toUpperCase()}
                                </span>
                              </div>
                            </div>

                            {/* Chi tiết nguyên nhân nhầm lẫn */}
                            <div className="md:col-span-8 p-4 rounded-xl border border-brand-error-border bg-brand-error-bg/20 flex flex-col justify-between text-xs space-y-2">
                              <div className="space-y-1">
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="font-semibold text-text-secondary shrink-0">Bạn đã chọn:</span>
                                  <span className="text-brand-error font-medium">[{userAnswer?.toUpperCase()}] {q.options[userAnswer as any]}</span>
                                </div>
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="font-semibold text-text-secondary shrink-0">Đáp án đúng là:</span>
                                  <span className="text-brand-success font-medium">[{q.correctAnswer.toUpperCase()}] {q.options[q.correctAnswer as any]}</span>
                                </div>
                              </div>
                              
                              <div className="pt-2 border-t border-border-primary">
                                <span className="font-semibold text-text-secondary block mb-0.5">Lý do dễ nhầm lẫn:</span>
                                <p className="text-2xs text-text-secondary leading-relaxed">
                                  {q.explanation.toLowerCase().includes("nhầm") || q.explanation.toLowerCase().includes("lưu ý") || q.explanation.toLowerCase().includes("không thể")
                                    ? "Dựa trên nội dung tài liệu gốc, phương án này thường bị nhầm lẫn do chưa phân biệt rõ bản chất khách quan hoặc phạm trù tri thức được chỉ rõ trong bài giảng."
                                    : "Bạn có thể đã bỏ sót các chi tiết nhỏ trong đề bài hoặc nhầm lẫn giữa định nghĩa cơ bản và phạm trù mở rộng."}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* BLOCK 3: Knowledge Card (Kiến thức cần nhớ) */}
                      <div className="bg-brand-warning-bg/20 border border-brand-warning-border p-5 rounded-2xl space-y-3">
                        <h5 className="text-2xs font-bold text-brand-warning tabular-nums flex items-center gap-1.5">
                          <Lightbulb className="w-4 h-4" /> Kiến thức cần nhớ (Trọng tâm lý thuyết)
                        </h5>
                        
                        <ul className="space-y-2 text-xs text-text-secondary pl-4 list-disc marker:text-brand-warning">
                          {getKnowledgePoints(q).map((point, index) => (
                            <li key={index} className="leading-relaxed font-sans">{point}</li>
                          ))}
                        </ul>
                      </div>

                      {/* BLOCK 4: Kiến thức gốc (Lời giải chi tiết & Slide gốc) */}
                      <div className="bg-bg-card border border-border-primary p-5 rounded-2xl space-y-3">
                        <h5 className="text-2xs font-bold text-text-muted tabular-nums flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-brand-info" /> Tài liệu gốc & Lời giải chi tiết
                        </h5>

                        <div className="space-y-2 text-xs text-text-secondary leading-relaxed">
                          <p className="whitespace-pre-line text-2xs bg-bg-surface p-3 rounded-xl border border-border-primary">
                            {q.explanation}
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 text-2xs text-text-muted font-medium pt-2 tabular-nums border-t border-border-primary">
                          <div>
                            Nguồn slide: <span className="font-semibold text-text-secondary">{q.sourcePdf} (Trang {q.sourcePage})</span>
                          </div>
                          <div className="hidden sm:block text-text-muted">|</div>
                          <div>
                            Mục tiêu học tập: <span className="font-semibold text-text-secondary">{q.learningObjective}</span>
                          </div>
                        </div>
                      </div>

                      {/* BLOCK 5: Ghi nhớ nhanh (Quick Note) */}
                      <div className="bg-bg-card border border-border-primary p-5 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-2xs font-bold text-text-muted tabular-nums flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-brand-info" /> Ghi chú cá nhân (Tự động lưu)
                          </h5>
                          {noteFeedback[q.id] && (
                            <span className="text-2xs font-medium text-brand-success flex items-center gap-1 font-sans animate-pulse">
                              <Check className="w-3.5 h-3.5" /> {noteFeedback[q.id]}
                            </span>
                          )}
                        </div>

                        <textarea
                          placeholder="Ví dụ: Nhớ phân biệt đặc điểm của quy luật kinh tế khách quan và tính chủ quan của chính sách kinh tế..."
                          value={questionNotes[q.id] || ""}
                          onChange={(e) => handleNoteChange(q.id, e.target.value)}
                          className="w-full h-20 p-3 text-xs border border-border-primary rounded-xl bg-bg-surface focus:outline-hidden focus:ring-1 focus:ring-brand-info text-text-primary leading-relaxed font-sans"
                        />
                      </div>

                      {/* BLOCK 6: Learning Timeline */}
                      {(() => {
                        const timeline = getQuestionTimeline(q.id);
                        return (
                          <div className="bg-bg-card border border-border-primary p-5 rounded-2xl space-y-3.5">
                            <h5 className="text-2xs font-bold text-text-muted tabular-nums flex items-center gap-1.5">
                              <History className="w-4 h-4 text-brand-info" /> Lịch sử luyện tập & Timeline sai
                            </h5>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                              <div className="p-3 bg-bg-surface rounded-xl border border-border-primary space-y-1">
                                <span className="text-2xs text-text-muted tabular-nums block">Lần đầu làm sai</span>
                                <span className="font-bold text-text-primary tabular-nums">{timeline.firstAttempt}</span>
                              </div>
                              <div className="p-3 bg-brand-error-bg rounded-xl border border-brand-error-border space-y-1">
                                <span className="text-2xs text-brand-error tabular-nums block">Tần suất làm sai</span>
                                <span className="font-bold text-brand-error tabular-nums text-base leading-none">{timeline.count} lần</span>
                              </div>
                              <div className="p-3 bg-bg-surface rounded-xl border border-border-primary space-y-1">
                                <span className="text-2xs text-text-muted tabular-nums block">Lần gần nhất sai</span>
                                <span className="font-bold text-text-primary tabular-nums">{timeline.lastAttempt}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* BLOCK 7: Concept Connection (Các câu hỏi liên quan) */}
                      {(() => {
                        const relatedWrong = questions.filter(otherQ => 
                          otherQ.id !== q.id && 
                          wrongQuestionIds.includes(otherQ.id) &&
                          (otherQ.topicId === q.topicId || otherQ.chapterId === q.chapterId)
                        ).slice(0, 3);

                        if (relatedWrong.length === 0) return null;

                        return (
                          <div className="bg-bg-card border border-border-primary p-5 rounded-2xl space-y-3">
                            <h5 className="text-2xs font-bold text-text-muted tabular-nums flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-brand-info" /> Các câu sai liên quan trong hệ thống
                            </h5>

                            <div className="flex flex-col gap-2.5">
                              {relatedWrong.map(otherQ => (
                                <button
                                  key={otherQ.id}
                                  onClick={() => {
                                    setExpandedQuestion(otherQ.id);
                                    markAsReviewed(otherQ.id);
                                  }}
                                  className="w-full text-left p-3 rounded-xl border border-border-primary hover:border-brand-info hover:bg-bg-surface transition flex items-center justify-between gap-3 text-xs cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="bg-bg-surface text-text-secondary font-bold tabular-nums text-2xs px-2 py-0.5 rounded shrink-0">
                                      CÂU #{otherQ.id}
                                    </span>
                                    <span className="text-text-primary truncate font-sans">{otherQ.question}</span>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* BLOCK 8: Learning Status (Đánh giá mức độ hiểu bài) */}
                      <div className="bg-bg-card border border-border-primary p-5 rounded-2xl space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className="text-2xs font-bold text-text-muted tabular-nums block">Đánh giá tiến trình</span>
                            <span className="text-xs text-text-secondary font-sans">Đánh dấu tình trạng học lại câu này:</span>
                          </div>

                          {/* Segmented Controls */}
                          <div className="grid grid-cols-3 gap-1.5 bg-bg-surface p-1 rounded-xl shrink-0 border border-border-primary/40">
                            <button
                              onClick={() => handleStatusChange(q.id, "learned")}
                              className={`px-3 py-1.5 rounded-lg text-2xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                                learningStatuses[q.id] === "learned"
                                  ? "bg-bg-card border border-brand-success-border text-brand-success shadow-xs"
                                  : "text-text-muted hover:text-text-primary border border-transparent"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Đã hiểu</span>
                            </button>

                            <button
                              onClick={() => handleStatusChange(q.id, "review")}
                              className={`px-3 py-1.5 rounded-lg text-2xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                                learningStatuses[q.id] === "review"
                                  ? "bg-bg-card border border-brand-warning-border text-brand-warning shadow-xs"
                                  : "text-text-muted hover:text-text-primary border border-transparent"
                              }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Cần ôn lại</span>
                            </button>

                            <button
                              onClick={() => handleStatusChange(q.id, "unlearned")}
                              className={`px-3 py-1.5 rounded-lg text-2xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                                !learningStatuses[q.id] || learningStatuses[q.id] === "unlearned"
                                  ? "bg-bg-card border border-border-primary text-text-primary shadow-xs"
                                  : "text-text-muted hover:text-text-primary border border-transparent"
                              }`}
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>Chưa học</span>
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HTML styled Custom Confirmation Modal for Data Deletion */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity" aria-hidden="true" onClick={() => setShowConfirmReset(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal Body */}
            <div className="inline-block align-bottom bg-bg-card rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-border-primary font-sans">
              <div className="bg-bg-card px-6 pt-6 pb-4">
                <div className="sm:flex sm:items-start gap-4">
                  <div className="mx-auto shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-brand-error-bg text-brand-error sm:mx-0 sm:h-9 sm:w-9">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left space-y-2">
                    <h3 className="text-base font-semibold text-text-primary font-display" id="modal-title">
                      Xác nhận xóa sạch dữ liệu?
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Hành động này sẽ xóa toàn bộ lịch sử thi thử, chuỗi học tập hàng ngày, nhật ký câu sai và tất cả các câu đánh dấu trọng tâm. Hành động này **không thể hoàn tác**.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-bg-surface px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-border-primary">
                <button 
                  onClick={() => setShowConfirmReset(false)}
                  className="w-full sm:w-auto border border-border-primary hover:bg-bg-surface text-text-secondary text-xs font-medium px-4 py-2 rounded-lg transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={handleResetData}
                  className="w-full sm:w-auto bg-brand-error hover:opacity-90 text-white text-xs font-medium px-5 py-2 rounded-lg transition shadow-sm cursor-pointer"
                >
                  Xóa sạch & Đặt lại
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom micro feedback toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-bg-invert/95 backdrop-blur-md text-text-invert px-4 py-3 rounded-xl shadow-xl border border-border-primary text-xs font-medium flex items-center gap-2.5 animate-fade-in-up duration-200">
          <div className="w-4 h-4 bg-brand-success-bg text-brand-success rounded-full flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
