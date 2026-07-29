/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Target, TrendingUp, Clock, AlertTriangle, Sliders, CheckCircle2, Trash2, Copy, Info, Layers } from "lucide-react";
import { dbService } from "../services/db";
import { examForecaster } from "../services/examForecaster";
import { SubjectGoal, ExamPrediction, StudyDebtItem, ExamAttempt } from "../types";
import { TimeService } from "../services/time";

interface LearningPlannerDashboardProps {
  key?: string;
  onStartExam: (type: string, param?: any) => void;
  onNavigateHome: () => void;
}

export default function LearningPlannerDashboard({ onStartExam, onNavigateHome }: LearningPlannerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"forecast" | "goals" | "budget" | "debt" | "simulator" | "sessions">("forecast");

  // Subject Goal State
  const activeSubjectId = dbService.getActiveSubjectId();
  const [goal, setGoal] = useState<SubjectGoal>(() => dbService.getSubjectGoal(activeSubjectId));

  // Prediction State
  const [prediction, setPrediction] = useState<ExamPrediction>(() => examForecaster.calculatePrediction(activeSubjectId));

  // Study Debt State
  const [debtItems, setDebtItems] = useState<StudyDebtItem[]>(() => examForecaster.getStudyDebtItems());

  // Sessions State
  // Chỉ hiển thị các bài ĐÃ NỘP trong lịch sử phiên làm bài.
  const [sessions, setSessions] = useState<ExamAttempt[]>(() => dbService.getHistory().filter(a => a.isSubmitted));
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState<boolean>(false);

  // Simulator State
  const [simMinutes, setSimMinutes] = useState<number>(goal.dailyStudyMinutes || 45);
  const [simDays, setSimDays] = useState<number>(prediction.metricsBreakdown.remainingDays || 14);

  /*
    CHƯA TRẢ LỜI CÂU NÀO THÌ CHƯA CÓ GÌ ĐỂ DỰ BÁO.

    Cờ này khác hẳn `chuaDuTinCay` đã dùng từ lượt 9. `chuaDuTinCay` là
    `confidenceLevel !== "Cao"`, tức vẫn đúng cho một người đã làm 200 câu mà độ tin cậy mới ở
    mức Trung bình. Còn đây là ranh giới cứng: **không có một mẩu bằng chứng nào**.

    Vì sao cần phân biệt. Mở ứng dụng bằng hồ sơ trắng ngày 29/07/2026, màn Kế hoạch hiện ra
    cho một người CHƯA TRẢ LỜI CÂU NÀO:

      "Dự báo kết quả 5.0 ± 0.5"          chip viền xanh, góc trên phải, chỗ nổi nhất màn
      "Tạm tính khoảng 5.0 ± 0.5 điểm."   20px đậm
      "Độ tin cậy còn thấp"               ngay bên dưới, tức màn hình TỰ CÃI chính nó
      "Mức sẵn sàng 59%"                  kèm thanh xanh lá đầy 59%
      "+0.3 điểm", "+0.3 điểm", "+0.4"    ba lời hứa tăng điểm tô xanh lá

    Con số 5.0 là điểm nền của bộ dự báo khi chưa có bằng chứng, không phải phép đo. In nó ở cỡ
    lớn nhất màn rồi ghi chú bên dưới rằng nó chưa đáng tin là cách trình bày tự mâu thuẫn: mắt
    đọc con số trước, đọc lời cảnh báo sau.

    Nặng hơn nữa, 59% MÂU THUẪN với màn Bàn học vốn ghi "Nắm chắc kiến thức 0%" cho cùng người
    ấy. Truy ra thì hai bên đo hai thứ khác nhau: `readinessPercentage` là
    `predictedScore / targetScore` (5.0/8.5), tức tỷ lệ giữa hai ĐIỂM SỐ, không phải mức nắm
    kiến thức. Đây là lần thứ tư dự án gặp khuôn "hai đại lượng khác nhau mang cùng một tên"
    (trước đó: độ phủ ở màn Báo cáo, hoàn thành ở màn Tổng quan, và độ tự tin giữa hai kho).
    Sửa ở tầng trình bày là đủ và đúng chỗ: gọi đúng tên thứ nó đang đo.

    KHÔNG đụng một phép tính nào của bộ dự báo. Engine vẫn tính y như cũ và vẫn tự khai độ tin
    cậy y như cũ; chỉ có tầng trình bày thôi khẳng định thứ nó không biết.
  */
  const chuaCoBaiLam = dbService.getStatistics().totalSolved === 0;

  // Re-calculate when goal updates or active subject changes
  useEffect(() => {
    const updatedGoal = dbService.getSubjectGoal(activeSubjectId);
    setGoal(updatedGoal);
    setPrediction(examForecaster.calculatePrediction(activeSubjectId));
    setDebtItems(examForecaster.getStudyDebtItems());
    setSessions(dbService.getHistory().filter(a => a.isSubmitted));
  }, [activeSubjectId]);

  const handleGoalSave = (newGoal: Partial<SubjectGoal>) => {
    const updated = { ...goal, ...newGoal, updatedAt: TimeService.now().toISOString() };
    setGoal(updated);
    dbService.saveSubjectGoal(updated);
    setPrediction(examForecaster.calculatePrediction(activeSubjectId));
  };

  const handleResolveDebt = (id: string) => {
    setDebtItems(prev => prev.map(item => item.id === id ? { ...item, status: "resolved" } : item));
  };

  const handlePostponeDebt = (id: string) => {
    setDebtItems(prev => prev.map(item => item.id === id ? { ...item, status: "postponed" } : item));
  };

  const handleDeleteSession = (attemptId: string) => {
    dbService.deleteHistoryAttempt(attemptId);
    setSessions(dbService.getHistory().filter(a => a.isSubmitted));
    setPrediction(examForecaster.calculatePrediction(activeSubjectId));
    setSessionToDelete(null);
  };

  const handleDuplicateSession = (attemptId: string) => {
    const dup = dbService.duplicateAttempt(attemptId);
    if (dup) {
      setSessions(dbService.getHistory().filter(a => a.isSubmitted));
      onStartExam(dup.examType, dup);
    }
  };

  const handleClearAllHistory = () => {
    dbService.clearAllHistory();
    setSessions([]);
    setPrediction(examForecaster.calculatePrediction(activeSubjectId));
    setShowClearHistoryConfirm(false);
  };

  const simulatedScore = examForecaster.simulateDeadlineOutcome(simMinutes, simDays);
  const roiActivities = examForecaster.getStudyActivitiesROI();
  const dailyBudgetPlan = examForecaster.getDailyBudgetPlan(goal.dailyStudyMinutes || 45);
  const whatIfs = examForecaster.getWhatIfScenarios();

  const subjectsList = dbService.getSubjects();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-primary pb-5">
        {/*
          Một tiêu đề, không phải hai.

          Bản cũ có một dòng nhãn màu xanh dương "Kế hoạch ôn thi và dự báo điểm" nằm ngay trên
          tiêu đề "Kế hoạch đạt điểm mục tiêu". Hai dòng nói cùng một việc, và dòng trên còn
          mang màu của liên kết nên mời người ta bấm vào chỗ không bấm được. Cùng lỗi đã sửa ở
          màn Báo cáo cùng ngày.

          Nay một tiêu đề, và dòng dưới nói việc màn này làm được cho người học.
        */}
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold font-sans text-text-primary">
            Kế hoạch đạt điểm mục tiêu
          </h1>
          <p className="text-base text-text-secondary font-sans max-w-[40rem]">
            Dự báo điểm theo dữ liệu học hiện tại, và những việc cần làm để rút ngắn khoảng cách.
          </p>
        </div>

        {/*
          Chip dự báo là chỗ NỔI NHẤT màn: viền xanh, chữ xanh đậm, góc trên phải. Với hồ sơ
          trắng nó in "5.0 ± 0.5", tức khẳng định mạnh nhất trên màn lại là con số ít căn cứ
          nhất. Nay khi chưa có bài làm thì nói thẳng là chưa dự báo được, và bỏ luôn viền màu
          để nó thôi đòi sự chú ý.
        */}
        <div className="flex items-center gap-3">
          <div className="bg-bg-card border border-border-primary/80 rounded-xl px-4 py-2 text-right">
            <span className="text-2xs tabular-nums text-text-muted block">Mục tiêu hiện tại</span>
            <span className="text-sm font-semibold text-text-primary">{goal.targetScore.toFixed(1)} điểm</span>
          </div>

          <div className={`bg-bg-card border rounded-xl px-4 py-2 text-right ${chuaCoBaiLam ? "border-border-primary/80" : "border-brand-info/30"}`}>
            <span className={`text-2xs tabular-nums block ${chuaCoBaiLam ? "text-text-muted" : "text-brand-info"}`}>Dự báo kết quả</span>
            <span className={`text-sm font-bold ${chuaCoBaiLam ? "text-text-muted" : "text-brand-info"}`}>
              {chuaCoBaiLam
                ? "Chưa đủ dữ liệu"
                : `${prediction.predictedScore.toFixed(1)} ± ${prediction.confidenceMargin.toFixed(1)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-border-primary/60 no-scrollbar">
        {[
          { key: "forecast", label: "Dự báo và khoảng cách", icon: TrendingUp },
          { key: "goals", label: "Mục tiêu & Đặt lịch thi", icon: Target },
          { key: "budget", label: "Thời gian mỗi ngày", icon: Clock },
          { key: "debt", label: "Phần cần sửa", icon: AlertTriangle, count: debtItems.filter(i => i.status === "pending").length },
          { key: "simulator", label: "Thử các kịch bản", icon: Sliders },
          { key: "sessions", label: "Phiên học", icon: Layers, count: sessions.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
                isActive 
                  ? "bg-nut-chinh text-white shadow-sm font-semibold" 
                  : "bg-bg-surface hover:bg-bg-card text-text-muted hover:text-text-primary border border-border-primary/60"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 text-2xs rounded-full tabular-nums font-bold ${
                  isActive ? "bg-bg-card text-text-primary" : "bg-brand-warning-bg text-brand-warning"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: FORECAST & GAP ANALYSIS */}
      {activeTab === "forecast" && (
        <div className="space-y-6">
          {/*
            BA THẺ BÁO ĐỘNG ĐỔI THÀNH BA CÂU.

            VẤN ĐỀ NẶNG NHẤT KHÔNG PHẢI CÁCH BÀY, MÀ LÀ CHÍNH MÀN NÀY TỰ MÂU THUẪN.

            Đo trên bản chạy thật với một hồ sơ mới trả lời 7 trên 292 câu, màn hình nói cùng
            lúc hai điều ngược nhau:

              "Độ tin cậy: **Cần thêm dữ liệu**"        <- hệ thống tự nhận là chưa biết
              "Nguy cơ trượt mục tiêu, mức Trung bình"  <- rồi phát cảnh báo dựa trên chính
              "Còn thiếu: **-5.5**" tô cam                  con số vừa nhận là chưa đủ căn cứ
              "cần được **bù đắp khẩn cấp**"

            Một dự báo tự khai là chưa đủ dữ liệu thì không được đóng khung bằng chữ đậm màu
            cảnh báo và từ "khẩn cấp". Đây đúng điều luật của dự án cấm: không đóng khung con số
            chưa chắc chắn bằng màu sắc mang tính khẳng định.

            BA ĐIỀU SỬA, KHÔNG ĐỘNG VÀO MỘT PHÉP TÍNH NÀO:

            1. **Mức độ nhấn bám theo độ tin cậy.** Khi bộ dự báo còn ghi "Cần thêm dữ liệu" thì
               cả khối trình bày ở dạng tạm tính, và phần lý do đổi tên thành "Chỗ cần chú ý"
               thay vì "Nguy cơ trượt mục tiêu". Con số vẫn hiện đủ, chỉ thôi hò hét.
            2. **Bỏ dấu trừ khỏi khoảng cách.** "-5.5" là cùng một sự thật với "còn 5,5 điểm
               nữa", nhưng một bên là điểm âm còn một bên là quãng đường. Khan không bao giờ
               trình bày tiến độ bằng số âm.
            3. **Bỏ tam giác cảnh báo** trên từng dòng lý do. Ba tam giác vàng xếp dọc biến một
               danh sách việc cần làm thành một bảng sự cố.

            Cách bày theo đúng ngôn ngữ đã dùng ở màn Bàn học và Báo cáo: câu dẫn, số nằm trong
            câu, vạch dọc ngăn thay cho thẻ đóng khung.
          */}
          {(() => {
            const chuaDuTinCay = prediction.confidenceLevel !== "Cao";

            /*
              Chưa có một câu nào thì màn này không dự báo, mà MỜI BẮT ĐẦU.

              Theo bản đo trên Khan cho người chưa học: tiêu đề khối là một câu mệnh lệnh
              20px/700 nói việc cần làm, mô tả 14px/400, và không đóng khung gì cả. Con số nào
              có thật thì vẫn hiện (mục tiêu, số ngày), con số nào là điểm nền của engine thì
              không hiện.
            */
            if (chuaCoBaiLam) {
              return (
                <div className="space-y-3 max-w-[46rem]">
                  <h3 className="text-sm font-bold text-text-muted font-sans">Điểm dự báo</h3>
                  <p className="text-xl font-bold text-text-primary font-sans leading-snug">
                    Chưa dự báo được, vì bạn chưa trả lời câu nào.
                  </p>
                  <p className="text-sm text-text-secondary font-sans leading-relaxed">
                    Mục tiêu của bạn là {prediction.targetScore.toFixed(1)} điểm, còn{" "}
                    {prediction.metricsBreakdown.remainingDays} ngày nữa tới kỳ thi. Làm xong lượt
                    ôn đầu tiên là màn này bắt đầu ước lượng được điểm, và mọi việc cần làm bên
                    dưới sẽ tính theo đúng chỗ bạn còn yếu.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => onStartExam("adaptive")}
                      className="px-4 h-9 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot text-sm rounded transition cursor-pointer"
                    >
                      Bắt đầu lượt đầu tiên
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0">

                {/* Điểm dự báo */}
                <div className="space-y-3 md:pr-6">
                  <h3 className="text-sm font-bold text-text-muted font-sans">Điểm dự báo</h3>
                  <p className="text-xl font-bold text-text-primary font-sans leading-snug">
                    {chuaDuTinCay ? "Tạm tính khoảng " : "Dự báo khoảng "}
                    {prediction.predictedScore.toFixed(1)} ± {prediction.confidenceMargin.toFixed(1)} điểm.
                  </p>
                  <p className="text-sm text-text-secondary font-sans">
                    {chuaDuTinCay
                      ? `Độ tin cậy còn thấp (${prediction.confidenceLevel}). Làm thêm bài để con số này bám sát thực tế hơn.`
                      : "Tính trên dữ liệu học tập hiện tại, nếu bạn giữ nhịp học như bây giờ."}
                  </p>
                </div>

                {/* Mục tiêu và quãng đường còn lại */}
                <div className="space-y-3 md:px-6 md:border-l md:border-border-primary">
                  <h3 className="text-sm font-bold text-text-muted font-sans">Mục tiêu</h3>
                  <p className="text-xl font-bold text-text-primary font-sans leading-snug">
                    Còn {prediction.gap.toFixed(1)} điểm nữa là tới {prediction.targetScore.toFixed(1)}.
                  </p>
                  {/*
                    NHÃN CŨ GỌI SAI TÊN ĐẠI LƯỢNG. `readinessPercentage` là
                    `predictedScore / targetScore`, tức điểm dự báo đang bằng bao nhiêu phần trăm
                    MỤC TIÊU, chứ không phải mức nắm kiến thức. Gọi nó là "mức sẵn sàng" khiến nó
                    mâu thuẫn với "Nắm chắc kiến thức 0%" ở màn Bàn học, dù cả hai đều đúng theo
                    định nghĩa riêng. Nay nói thẳng ra nó đo gì.
                  */}
                  <p className="text-sm text-text-secondary font-sans">
                    Điểm dự báo đang bằng {prediction.readinessPercentage}% mục tiêu.
                  </p>
                  <div className="w-full bg-bg-surface rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand-success h-full transition-all duration-300"
                      style={{ width: `${prediction.readinessPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Chỗ cần chú ý */}
                <div className="space-y-3 md:pl-6 md:border-l md:border-border-primary">
                  <h3 className="text-sm font-bold text-text-muted font-sans">
                    {chuaDuTinCay ? "Chỗ cần chú ý" : `Nguy cơ trượt mục tiêu: mức ${prediction.riskReport.level}`}
                  </h3>
                  <ul className="space-y-2">
                    {prediction.riskReport.reasons.map((reason, idx) => (
                      <li key={idx} className="text-base text-text-secondary font-sans leading-snug">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}

          {/*
            DANH SÁCH VIỆC CẦN LÀM, DỰNG LẠI THÀNH HÀNG.

            Bản cũ là lưới `md:grid-cols-2`, mỗi việc một thẻ có nền riêng và viền riêng, nằm
            trong một thẻ lớn cũng có nền và viền. Đây là danh sách việc, tức đúng khuôn
            AGENTS.md 4.9g mục 3: danh sách nội dung là HÀNG chứ không phải THẺ.

            Con số "+0.3 điểm" cũng chỉ hiện khi đã có bằng chứng. Với hồ sơ trắng, `impact` được
            suy ra từ khoảng cách tới mục tiêu, mà khoảng cách ấy lại tính từ điểm nền 5.0 chứ
            không từ bài làm nào. Hứa "+0.3 điểm" cho một người chưa trả lời câu nào là khẳng
            định thứ mình không biết, và tô nó màu xanh lá làm lời hứa nghe chắc hơn nữa. Việc
            vẫn hiện đủ, thời lượng vẫn hiện đủ, chỉ thôi hứa con số.
          */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-text-primary font-sans">
              {chuaCoBaiLam
                ? "Việc nên làm trước"
                : `Việc cần làm để đi hết ${prediction.gap.toFixed(1)} điểm còn lại`}
            </h3>

            <div className="grid grid-cols-1 divide-y divide-border-primary/70 border-y border-border-primary/70">
              {prediction.gapActionPlan.map((action) => (
                <div key={action.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-text-primary font-sans">{action.title}</h4>
                    <p className="text-sm text-text-secondary font-sans pt-0.5">
                      Khoảng {action.timeEstimateMinutes} phút
                      {chuaCoBaiLam ? "" : `, ước tính thêm ${action.impact.toFixed(1)} điểm`}
                    </p>
                  </div>
                  <button
                    onClick={() => onStartExam(action.type === "debt" ? "incorrect" : action.type === "mock" ? "ai-smart" : "adaptive")}
                    className="shrink-0 px-4 h-9 bg-bg-surface border border-border-primary hover:border-text-muted text-text-primary text-sm rounded transition cursor-pointer"
                  >
                    Làm ngay
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/*
            CỘT MỐC LỘ TRÌNH.

            Ba thẻ cũ mang ba màu nhãn khác nhau (xanh dương, cam, xanh lá) cho ba mốc thời gian.
            Màu không mang nghĩa nào cả: mốc 7 ngày không "cảnh báo" hơn mốc 3 ngày. Đó là màu
            trang trí đội lốt màu ngữ nghĩa, và nó làm hỏng quy ước màu của phần còn lại.

            Mốc đầu tiên còn nói sai với người mới: "Xử lý xong 100% Sổ tay câu sai" trong khi sổ
            câu sai đang trống. Nay mốc ấy đổi theo trạng thái thật của sổ.
          */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-text-primary font-sans">Cột mốc lộ trình</h3>

            <div className="grid grid-cols-1 divide-y divide-border-primary/70 border-y border-border-primary/70">
              {[
                {
                  moc: "Trong 3 ngày tới",
                  viec: chuaCoBaiLam ? "Làm xong lượt ôn đầu tiên" : "Làm lại hết các câu trong sổ câu sai",
                  vi: chuaCoBaiLam
                    ? "Đây là mốc mở khoá mọi dự báo và gợi ý của màn này."
                    : "Xoá rủi ro mất điểm ở đúng những bẫy bạn từng mắc.",
                },
                {
                  moc: "Trong 7 ngày tới",
                  viec: "Đạt độ thạo 80% ở toàn bộ các chương",
                  vi: "Chắc phần nền trước khi chuyển sang luyện đề.",
                },
                {
                  moc: "Trong 10 ngày tới",
                  viec: "Làm 2 đề thi thử",
                  vi: "Tập nhịp làm bài và đo lại mức sẵn sàng sát ngày thi.",
                },
              ].map(m => (
                <div key={m.moc} className="py-4 flex flex-col sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="text-sm text-text-muted font-sans sm:w-40 sm:shrink-0">{m.moc}</span>
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-text-primary font-sans">{m.viec}</h4>
                    <p className="text-sm text-text-secondary font-sans pt-0.5">{m.vi}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thẻ lý giải quyết định của AI */}
          <div className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl text-xs space-y-2 tabular-nums">
            <div className="flex items-center gap-2 text-text-muted">
              <Info className="w-4 h-4 text-brand-info shrink-0" />
              <span className="font-semibold text-text-primary">Vì sao AI đề xuất như vậy</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-2xs text-text-muted">
              <div>• <strong>Quyết định:</strong> {prediction.explainability.decision}</div>
              <div>• <strong>Lý do:</strong> {prediction.explainability.reason}</div>
              <div>• <strong>Dẫn chứng:</strong> {prediction.explainability.evidence}</div>
              <div>• <strong>Chính sách:</strong> {prediction.explainability.policy}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GOALS & TIMELINE */}
      {activeTab === "goals" && (
        <div className="space-y-6">
          {/* Goal Editor Form */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-5 shadow-sm">
            <h3 className="text-xs tabular-nums text-text-primary">
Thiết lập Mục tiêu & Ngày thi ({dbService.getActiveSubjectName()})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Target Score */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted block">Điểm mong muốn</label>
                <select
                  value={goal.targetScore}
                  onChange={(e) => handleGoalSave({ targetScore: Number(e.target.value) })}
                  className="w-full bg-bg-surface border border-border-primary rounded-xl px-3 py-2 text-xs font-semibold text-text-primary cursor-pointer focus:outline-none"
                >
                  {[7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0].map(s => (
                    <option key={s} value={s}>{s.toFixed(1)} điểm</option>
                  ))}
                </select>
              </div>

              {/* Exam Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted block">Ngày thi dự kiến</label>
                <input
                  type="date"
                  value={goal.examDate}
                  onChange={(e) => handleGoalSave({ examDate: e.target.value })}
                  className="w-full bg-bg-surface border border-border-primary rounded-xl px-3 py-2 text-xs tabular-nums text-text-primary cursor-pointer focus:outline-none"
                />
              </div>

              {/* Daily Minutes */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted block">Thời lượng học mỗi ngày</label>
                <select
                  value={goal.dailyStudyMinutes}
                  onChange={(e) => handleGoalSave({ dailyStudyMinutes: Number(e.target.value) })}
                  className="w-full bg-bg-surface border border-border-primary rounded-xl px-3 py-2 text-xs font-semibold text-text-primary cursor-pointer focus:outline-none"
                >
                  {[30, 45, 60, 90, 120].map(m => (
                    <option key={m} value={m}>{m} phút/ngày</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted block">Mức ưu tiên môn học</label>
                <select
                  value={goal.priority}
                  onChange={(e) => handleGoalSave({ priority: e.target.value as any })}
                  className="w-full bg-bg-surface border border-border-primary rounded-xl px-3 py-2 text-xs font-semibold text-text-primary cursor-pointer focus:outline-none"
                >
                  <option value="High">Ưu tiên Cao</option>
                  <option value="Medium">Ưu tiên Trung bình</option>
                  <option value="Low">Ưu tiên Thấp</option>
                </select>
              </div>
            </div>
          </div>

          {/* Multiple Subjects Planning Overview */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs tabular-nums text-text-primary">
Tổng quan lịch thi đa môn học
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjectsList.map(sub => {
                const subGoal = dbService.getSubjectGoal(sub.id);
                const subPrediction = examForecaster.calculatePrediction(sub.id);
                const isCurrent = sub.id === activeSubjectId;

                return (
                  <div 
                    key={sub.id}
                    className={`p-4 rounded-xl border transition space-y-3 ${
                      isCurrent 
                        ? "bg-bg-surface border-brand-info/50 shadow-sm" 
                        : "bg-bg-card border-border-primary/80 hover:border-border-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary">{sub.name}</span>
                        {isCurrent && (
                          <span className="px-2 py-0.2 text-2xs bg-brand-info-bg text-brand-info tabular-nums rounded-full">Đang chọn</span>
                        )}
                      </div>
                      <span className="text-xs tabular-nums text-brand-warning font-bold">
                        Còn {subPrediction.metricsBreakdown.remainingDays} ngày
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs tabular-nums bg-bg-card/80 p-2.5 rounded-lg border border-border-primary/60">
                      <div>
                        <span className="text-2xs text-text-muted block">Mục tiêu</span>
                        <strong className="text-text-primary">{subGoal.targetScore.toFixed(1)}</strong>
                      </div>
                      <div>
                        <span className="text-2xs text-text-muted block">Dự báo</span>
                        <strong className="text-brand-info">{subPrediction.predictedScore.toFixed(1)}</strong>
                      </div>
                      <div>
                        <span className="text-2xs text-text-muted block">Sẵn sàng</span>
                        <strong className="text-brand-success">{subPrediction.readinessPercentage}%</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DAILY BUDGET & ROI */}
      {activeTab === "budget" && (
        <div className="space-y-6">
          {/* Daily Budget Distribution */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs tabular-nums text-text-primary">
Phân bổ Ngân sách Học hàng ngày ({dailyBudgetPlan.totalMinutes} phút/ngày)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {dailyBudgetPlan.allocation.map(item => (
                <div key={item.key} className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-text-primary">
                    <span>{item.label}</span>
                    <span className="tabular-nums font-bold text-brand-info">{item.minutes} phút</span>
                  </div>
                  <div className="w-full bg-bg-card border border-border-primary/60 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-brand-info h-full" style={{ width: `${item.ratio}%` }} />
                  </div>
                  <span className="text-2xs tabular-nums text-text-muted block text-right">{item.ratio}% ngân sách</span>
                </div>
              ))}
            </div>
          </div>

          {/* Study ROI Dashboard Table */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs tabular-nums text-text-primary">
Việc học nào đáng làm trước
            </h3>

            <div className="space-y-3">
              {roiActivities.map((act) => (
                <div key={act.id} className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">{act.title}</span>
                      <span className={`px-2 py-0.2 text-2xs tabular-nums rounded-full ${
                        act.priority === "Rất cao" ? "bg-brand-success-bg text-brand-success"
                          : act.priority === "Thấp" ? "bg-bg-card text-text-muted"
                          : "bg-brand-info-bg text-brand-info"
                      }`}>
                        Ưu tiên {act.priority}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">{act.reason}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right tabular-nums">
                      <span className="text-2xs text-text-muted block">Tăng điểm dự báo</span>
                      <span className="text-sm font-bold text-brand-success">+{act.forecastPointGain.toFixed(2)} điểm</span>
                    </div>
                    <button
                      onClick={() => onStartExam(act.type === "wrong_notebook" ? "incorrect" : "adaptive")}
                      className="px-3 py-1.5 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot font-semibold text-xs rounded-lg transition cursor-pointer"
                    >
                      Bắt đầu
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/*
        TAB 4: HAI LOẠI KHÁC HẲN NHAU ĐANG BỊ TRỘN VÀO MỘT DANH SÁCH.

        Đo trên hồ sơ trắng ngày 29/07/2026: tab này hiện **7 mục, cả 7 đều đeo chip ĐỎ "Cao"**,
        và cả 7 đều ghi "Lần sai: 0". Truy ra thì chúng là 7 CHƯƠNG CHƯA HỌC, không phải 7 câu
        làm sai. Người vừa mở ứng dụng lần đầu nhìn thấy bảy tín hiệu lỗi đỏ cho việc họ chưa
        kịp bắt đầu.

        Đây đúng khuôn đã sửa ở màn Câu sai lượt 6: thang tiến độ tô ĐỎ đúng chặng người học vừa
        gỡ được. Chưa tới thì để trống, không tô màu báo lỗi vào lộ trình học.

        `debtType` phân biệt sẵn hai loại (`unlearned_chapter` và `wrong_attempt`) nhưng tầng
        trình bày cũ gộp chúng làm một, cùng gọi là "nợ", cùng thang ưu tiên, cùng bảng màu.
        Nay tách: chương chưa học là **việc phía trước** (không màu cảnh báo, không đếm lần sai),
        câu làm sai mới là **việc cần sửa**.

        Giữ nguyên toàn bộ chức năng: ba nút Sửa ngay, Hoãn, Xong vẫn còn đủ ở mọi mục.
      */}
      {activeTab === "debt" && (() => {
        const dsCho = debtItems.filter(i => i.status === "pending");
        const soChuaHoc = dsCho.filter(i => i.debtType !== "wrong_attempt").length;
        const soLamSai = dsCho.length - soChuaHoc;
        return (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-text-primary font-sans">Phần cần sửa</h3>
            <p className="text-sm text-text-secondary font-sans">
              {dsCho.length === 0
                ? "Không còn mục nào đang chờ."
                : [
                    soLamSai > 0 ? `${soLamSai} câu từng làm sai` : "",
                    soChuaHoc > 0 ? `${soChuaHoc} chương chưa làm bài nào` : "",
                  ].filter(Boolean).join(", ") + "."}
            </p>
          </div>

          <div className="grid grid-cols-1 divide-y divide-border-primary/70 border-y border-border-primary/70">
            {debtItems.length === 0 ? (
              /*
                Trạng thái rỗng ở đây có HAI nghĩa hoàn toàn khác nhau, và bản cũ chỉ nói một:
                "Bạn đã dứt điểm 100% câu sai" đúng với người đã học xong, nhưng sai với người
                chưa bắt đầu. Cùng lỗi với "Sổ câu sai đang sạch" đã sửa ở màn Bàn học.
              */
              <div className="py-8">
                {chuaCoBaiLam ? (
                  <p className="text-sm text-text-secondary font-sans">
                    Chưa có gì ở đây. Sau lượt ôn đầu tiên, những câu bạn làm sai và những chương
                    chưa đụng tới sẽ được liệt kê tại đây.
                  </p>
                ) : (
                  <p className="text-sm text-text-secondary font-sans flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-success shrink-0" />
                    Không còn mục nào cần sửa. Bạn đã làm lại hết các câu từng sai.
                  </p>
                )}
              </div>
            ) : (
              debtItems.map(item => {
                const laChuaHoc = item.debtType !== "wrong_attempt";
                return (
                <div key={item.id} className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.status === "resolved" ? "opacity-60" : ""
                }`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-text-primary font-sans">{item.conceptName}</span>
                      {/*
                        Chỉ câu TỪNG LÀM SAI mới đeo mức ưu tiên có màu. Chương chưa học không
                        phải lỗi của ai, nên không mang màu cảnh báo.
                      */}
                      {!laChuaHoc && (
                        <span className={`px-2 py-0.2 text-2xs tabular-nums rounded-full shrink-0 ${
                          item.priority === "Cao" ? "bg-brand-error-bg text-brand-error"
                            : item.priority === "Thấp" ? "bg-bg-card text-text-muted"
                            : "bg-brand-warning-bg text-brand-warning"
                        }`}>
                          {item.priority}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-text-secondary font-sans block pt-0.5">
                      {/* "Lần sai: 0" là dòng vô nghĩa, chỉ nói số lần sai khi đã từng sai. */}
                      {laChuaHoc
                        ? "Chương này bạn chưa làm bài nào."
                        : `Đã sai ${item.wrongCount} lần trong lúc luyện.`}
                    </span>
                  </div>

                  {item.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      {/*
                        Nút chính đổi CHỮ theo loại: chương chưa học thì "Học ngay", câu từng sai
                        mới là "Sửa ngay". Và bỏ nền cam khỏi nút: màu cảnh báo trên nút chính
                        của một danh sách bảy mục biến cả tab thành bảng sự cố.
                      */}
                      <button
                        onClick={() => onStartExam(laChuaHoc ? "adaptive" : "incorrect")}
                        className="px-4 h-9 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot text-sm rounded transition cursor-pointer"
                      >
                        {laChuaHoc ? "Học ngay" : "Sửa ngay"}
                      </button>
                      <button
                        onClick={() => handlePostponeDebt(item.id)}
                        className="px-4 h-9 bg-bg-surface border border-border-primary text-text-secondary hover:text-text-primary text-sm rounded transition cursor-pointer"
                      >
                        Hoãn
                      </button>
                      <button
                        onClick={() => handleResolveDebt(item.id)}
                        className="px-4 h-9 bg-bg-surface border border-border-primary text-text-secondary hover:text-text-primary text-sm rounded transition cursor-pointer"
                      >
                        Xong
                      </button>
                    </div>
                  )}

                  {item.status === "resolved" && (
                    <span className="text-sm text-brand-success shrink-0 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Đã xong
                    </span>
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>
        );
      })()}

      {/* TAB 5: WHAT-IF SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-5 shadow-sm">
            <h3 className="text-xs tabular-nums text-text-primary">
Mô phỏng thay đổi lịch thi & thời lượng học
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Thời lượng học mỗi ngày:</span>
                  <span className="tabular-nums font-bold text-brand-info">{simMinutes} phút</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="180"
                  step="15"
                  value={simMinutes}
                  onChange={(e) => setSimMinutes(Number(e.target.value))}
                  className="w-full cursor-pointer accent-brand-info"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Số ngày còn lại:</span>
                  <span className="tabular-nums font-bold text-brand-warning">{simDays} ngày</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={simDays}
                  onChange={(e) => setSimDays(Number(e.target.value))}
                  className="w-full cursor-pointer accent-brand-warning"
                />
              </div>
            </div>

            <div className="bg-bg-surface border border-border-primary rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-2xs tabular-nums text-text-muted block">Kết quả mô phỏng</span>
                <span className="text-xs font-medium text-text-primary">Nếu học {simMinutes} phút/ngày trong {simDays} ngày</span>
              </div>
              <div className="text-right">
                <span className="text-2xs tabular-nums text-brand-info block">Điểm dự báo mô phỏng</span>
                <span className="text-2xl font-display font-bold text-brand-info">{simulatedScore.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* What-if Cards */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs tabular-nums text-text-primary">
Kịch bản giả định
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {whatIfs.map((sc, idx) => (
                <div key={idx} className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-2">
                  <span className="text-xs font-medium text-text-primary block">{sc.title}</span>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs tabular-nums font-bold ${sc.type === "positive" ? "text-brand-success" : "text-brand-error"}`}>
                      {sc.impactText}
                    </span>
                    <span className="text-sm font-display font-bold text-text-primary">
                      &rarr; {sc.projectedScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SESSIONS MANAGEMENT */}
      {activeTab === "sessions" && (
        <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border-primary pb-4">
            <h3 className="text-xs tabular-nums text-text-primary">
Quản lý lịch sử & phiên làm bài
            </h3>

            {sessions.length > 0 && (
              <button
                onClick={() => setShowClearHistoryConfirm(true)}
                className="px-3 py-1.5 bg-brand-error-bg text-brand-error hover:bg-brand-error-bg text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Xóa toàn bộ lịch sử</span>
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted space-y-2 tabular-nums">
              <Info className="w-6 h-6 text-text-muted mx-auto shrink-0" />
              <p>Chưa có phiên làm bài nào được lưu.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((sess) => (
                <div key={sess.id} className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        Bài thi {sess.examType} ({sess.score}/{sess.questions?.length || 0} câu đúng)
                      </span>
                      <span className="text-2xs tabular-nums text-text-muted">
                        • {TimeService.formatDate(sess.startTime)}
                      </span>
                    </div>
                    <span className="text-2xs tabular-nums text-text-muted block">
                      Thời gian làm bài: {Math.round(sess.timeSpent / 60)} phút
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDuplicateSession(sess.id)}
                      className="px-3 py-1.5 bg-bg-card border border-border-primary text-text-primary text-xs rounded-lg hover:bg-bg-surface transition cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-4 h-4.5 shrink-0" />
                      <span>Thi lại</span>
                    </button>
                    <button
                      onClick={() => setSessionToDelete(sess.id)}
                      className="px-3 py-1.5 bg-bg-card border border-border-primary text-brand-error text-xs rounded-lg hover:bg-brand-error-bg transition cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delete Modal Confirmation */}
          {sessionToDelete && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-bg-card border border-border-primary rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
                <h4 className="text-sm font-semibold text-text-primary">Xác nhận xóa phiên học</h4>
                <p className="text-xs text-text-muted">Bạn có chắc chắn muốn xóa phiên học này không? Hành động này không thể hoàn tác.</p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setSessionToDelete(null)}
                    className="px-3 py-1.5 bg-bg-surface border border-border-primary text-xs rounded-lg cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => handleDeleteSession(sessionToDelete)}
                    className="px-3 py-1.5 bg-brand-error text-bg-card text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Clear All History Modal Confirmation */}
          {showClearHistoryConfirm && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-bg-card border border-border-primary rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
                <h4 className="text-sm font-semibold text-text-primary">Xóa toàn bộ lịch sử thi?</h4>
                <p className="text-xs text-text-muted">Tất cả dữ liệu điểm thi và tiến trình thi thử sẽ bị xóa sạch.</p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowClearHistoryConfirm(false)}
                    className="px-3 py-1.5 bg-bg-surface border border-border-primary text-xs rounded-lg cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleClearAllHistory}
                    className="px-3 py-1.5 bg-brand-error text-bg-card text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
