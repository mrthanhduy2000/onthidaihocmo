/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Compass, Calendar, Target, CheckCircle2, AlertTriangle, Lock, Play, BookOpen, Info } from "lucide-react";
import { 
  curriculumIntelligenceEngine, 
  CurriculumPlan, 
  CurriculumStage 
} from "../services/curriculumIntelligenceEngine";
import { aiService } from "../services/ai";
import { dbService } from "../services/db";
import { DongTrong } from "./EmptyState";
import { ExamAttempt } from "../types";

interface CurriculumDashboardProps {
  key?: any;
  onStartExam: (exam: ExamAttempt) => void;
  onNavigate: (view: any) => void;
}

export default function CurriculumDashboard({ onStartExam, onNavigate }: CurriculumDashboardProps) {
  const [plan, setPlan] = useState<CurriculumPlan>(() => curriculumIntelligenceEngine.getCurriculumPlan());

  useEffect(() => {
    setPlan(curriculumIntelligenceEngine.getCurriculumPlan());
  }, []);

  /*
    NHÃN TIẾNG VIỆT CHO GIÁ TRỊ CỦA ENGINE.

    `plan.currentStage` và `debt.priority` là các giá trị liệt kê của engine, viết bằng tiếng
    Anh in hoa ("FOUNDATION", "HIGH"). Trước ngày 28/07/2026 chúng được in THẲNG ra màn hình,
    nên người học đang ôn thi bằng tiếng Việt lại đọc thấy "Giai đoạn: FOUNDATION".

    Hai bảng dưới đây chỉ là lớp DỊCH KHI HIỂN THỊ. Không đụng gì tới engine, không đổi dữ
    liệu, không đổi kiểu: giá trị bên trong vẫn nguyên "FOUNDATION", chỉ khác chỗ vẽ ra màn
    hình. Có nhánh dự phòng trả về chính giá trị gốc, nên nếu engine thêm giai đoạn mới thì
    màn hình vẫn chạy chứ không vỡ.
  */
  const NHAN_GIAI_DOAN: Record<CurriculumStage, string> = {
    FOUNDATION: "Xây nền",
    UNDERSTANDING: "Hiểu bài",
    APPLICATION: "Vận dụng",
    CONSOLIDATION: "Củng cố",
    EXAM_PREPARATION: "Ôn thi",
    FINAL_REVIEW: "Rà lần cuối",
    MASTERY: "Nắm chắc",
  };

  const NHAN_UU_TIEN: Record<string, string> = {
    HIGH: "Cần làm sớm",
    MEDIUM: "Vừa phải",
    LOW: "Thong thả",
  };

  const NHAN_LOAI_DE: Record<string, string> = {
    chapter: "theo chương",
    mock: "thi thử",
    incorrect: "ôn câu sai",
  };

  const getStageBadgeColor = (stage: CurriculumStage) => {
    switch (stage) {
      case "FOUNDATION": return "bg-brand-info-bg text-brand-info border-brand-info/30";
      case "UNDERSTANDING": return "bg-brand-info-bg text-brand-info border-brand-info/40";
      case "APPLICATION": return "bg-brand-warning-bg text-brand-warning border-brand-warning/30";
      case "CONSOLIDATION": return "bg-brand-warning-bg text-brand-warning border-brand-warning/40";
      case "EXAM_PREPARATION": return "bg-brand-error-bg text-brand-error border-brand-error/30";
      case "FINAL_REVIEW": return "bg-brand-error-bg text-brand-error border-brand-error/40";
      case "MASTERY": return "bg-brand-success-bg text-brand-success border-brand-success/30";
      default: return "bg-bg-surface text-text-muted border-border-primary";
    }
  };

  const handleStartRecommendedPractice = () => {
    let exam: ExamAttempt;
    if (plan.recommendedExamType === "incorrect") {
      exam = aiService.generateExam({ type: "incorrect" });
    } else if (plan.recommendedExamType === "mock") {
      exam = aiService.generateExam({ type: "ai-smart", count: 25 });
    } else if (plan.recommendedExamType === "chapter") {
      exam = aiService.generateExam({ type: "chapter", chapterId: plan.recommendedChapters[0] || 1, count: 10 });
    } else {
      exam = aiService.generateExam({ type: "adaptive", count: 15 });
    }
    onStartExam(exam);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 py-8 fade-in-up">
      {/* Top Banner: Course Director Strategy Overview */}
      <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-primary/60 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Compass className="w-6 h-6 text-brand-info" />
              <h1 className="text-2xl font-display font-light text-text-primary tracking-tight">
                {/* Trước 28/07/2026 là "Curriculum Intelligence & Learning Strategy". */}
                Khung chương trình và chiến lược ôn tập
              </h1>
            </div>
            {/*
              Bản cũ: "Lớp hoạch định chiến lược học tập toàn diện. Điều phối lộ trình, phân bổ
              thời gian & nâng cao mức sẵn sàng thi."

              "Lớp" ở đây là chữ của kiến trúc phần mềm (một tầng trong hệ thống), không phải
              chữ người học dùng. Cả câu mô tả BẢN THÂN MÀN HÌNH đang làm gì, y hệt câu "Nền
              tảng ghi nhận thời gian làm bài thực tế..." đã gỡ ở màn Báo cáo. Một màn kế hoạch
              nói về việc người học cần làm, không nói về chính nó.
            */}
            <p className="text-base text-text-secondary font-sans max-w-[40rem]">
              Nên học chương nào trước, mỗi ngày bao nhiêu, và còn bao xa mới tới mục tiêu.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <span className={`px-3 py-1.5 rounded-full border text-xs tabular-nums font-bold ${getStageBadgeColor(plan.currentStage)}`}>
              Giai đoạn: {NHAN_GIAI_DOAN[plan.currentStage] ?? plan.currentStage}
            </span>
          </div>
        </div>

        {/*
          BỐN THẺ SỐ LIỆU ĐỔI THÀNH MỘT DÒNG CHỮ, theo đúng khuôn 2 ở AGENTS.md 4.9f. Đây là màn
          thứ năm áp cùng khuôn ấy, nên bốn màn Bàn học, Báo cáo, Kế hoạch, Trí nhớ và màn này
          nay đọc lên cùng một giọng.

          Kèm hai chỗ sửa chữ:
          - **"21/100"** đổi thành phần trăm. Cả ứng dụng đo mức sẵn sàng bằng phần trăm, riêng
            màn này dùng thang trên 100 nên người học phải đổi đơn vị trong đầu để so với các
            màn khác. Cùng một đại lượng thì phải cùng một thang đo.
          - **"14 Ngày"** viết hoa chữ Ngày giữa câu, kiểu tiếng Anh. Tiếng Việt không viết hoa
            giữa câu.

          Nhiệm vụ hôm nay tách riêng thành một câu vì nó là VIỆC CẦN LÀM chứ không phải một
          con số đo được, và trước đó nó bị `truncate` cắt cụt giữa chừng trong một cái thẻ hẹp.
        */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-1 text-sm text-text-secondary font-sans">
          <span>
            Mức sẵn sàng <strong className="text-text-primary">{plan.readinessScore}%</strong>
          </span>
          <span className="sm:border-l sm:border-border-primary sm:pl-3.5 sm:ml-3.5">
            Độ thông thạo <strong className="text-text-primary">{plan.masteryScore}%</strong>
          </span>
          <span className="sm:border-l sm:border-border-primary sm:pl-3.5 sm:ml-3.5">
            Còn <strong className="text-text-primary">{plan.examDaysRemaining} ngày</strong> tới kỳ thi
          </span>
        </div>

        <p className="text-xl font-bold text-text-primary font-sans leading-snug max-w-[42rem]">
          Hôm nay: {plan.todayGoal}
          <span className="block text-base font-normal text-text-secondary pt-1">
            Dự kiến khoảng {plan.estimatedStudyTime} phút.
          </span>
        </p>

        {/* Strategic Hero Action Callout */}
        <div className="bg-gradient-to-r from-brand-info/10 via-bg-surface to-bg-surface border border-brand-info/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-text-primary flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-info" />
              <span>Khuyến nghị chiến lược tiếp theo:</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {plan.transitionReason}
            </p>
          </div>

          <button
            onClick={handleStartRecommendedPractice}
            className="px-5 py-2.5 bg-nut-chinh hover:bg-nut-chinh-re-chuot text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            {/* `.toUpperCase()` trên giá trị liệt kê của engine in ra "CHAPTER" / "MOCK" /
                "INCORRECT" ngay trên nút bấm chính của màn. Dịch khi hiển thị. */}
            <span>Thực hiện nhiệm vụ ({NHAN_LOAI_DE[plan.recommendedExamType] ?? plan.recommendedExamType})</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: LEARNING MAP (CHAPTER STATUSES) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs tabular-nums text-text-muted">
Bản đồ tiến trình học phần
          </h2>
          <span className="text-sm text-text-muted">{plan.chapterStatuses.length} chương</span>
        </div>

        {/*
          BẢN ĐỒ CHƯƠNG DỰNG LẠI THÀNH HÀNG, theo khuôn 3 ở AGENTS.md 4.9f và theo đúng bản đo
          trang khoá học của Khan (mỗi mục là một hàng, không thẻ, không nền, không bo góc).

          Ba lỗi của bản cũ:

          1. **Mã chương "CH1" làm neo thị giác.** Nó là thứ đầu tiên và nổi nhất trong mỗi thẻ,
             tô nền xanh, trong khi TÊN chương mới là thứ người học cần đọc. Khan không bao giờ
             hiện mã nội bộ; họ hiện tên bài.
          2. **`line-clamp-1` cắt tên chương cụt.** Tên dài như "Chương 2: Yếu tố môi trường ảnh
             hưởng đến hành vi khách hàng" bị cắt giữa chừng, mà đó lại là thông tin chính.
          3. **Nền tô theo trạng thái.** Chương yếu tô nền cam, chương xong tô nền xanh, nên cả
             lưới thành một bảng màu. Trạng thái nay nói bằng CHỮ ngay cạnh tên chương, còn nền
             để trắng cho dễ đọc.

          Giữ nguyên đủ bốn trạng thái và thanh tiến độ.
        */}
        <div className="divide-y divide-border-primary/70 border-y border-border-primary/70">
          {plan.chapterStatuses.map((ch) => {
            const trangThai =
              ch.status === "COMPLETED" ? { chu: "Đã xong", mau: "text-brand-success", Icon: CheckCircle2 } :
              ch.status === "WEAK" ? { chu: "Cần củng cố", mau: "text-text-secondary", Icon: AlertTriangle } :
              ch.status === "LOCKED" ? { chu: "Chưa mở", mau: "text-text-muted", Icon: Lock } :
              { chu: "Sẵn sàng học", mau: "text-text-secondary", Icon: BookOpen };
            const TrangThaiIcon = trangThai.Icon;

            return (
              <div key={ch.chapterId} className={`py-3.5 space-y-2 ${ch.status === "LOCKED" ? "text-text-muted" : ""}`}>
                <div className="flex items-start gap-3">
                  <TrangThaiIcon className={`w-5 h-5 mt-0.5 shrink-0 ${trangThai.mau}`} />
                  <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <span className="text-base font-medium text-text-primary">{ch.title}</span>
                    <span className={`text-sm ${trangThai.mau}`}>{trangThai.chu}</span>
                    <span className="text-sm text-text-muted">thông thạo {ch.masteryScore}%</span>
                  </div>
                </div>

                <div className="ml-8 w-full max-w-[32rem] h-1.5 bg-bg-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ch.masteryScore >= 80 ? "bg-brand-success" : "bg-brand-info"}`}
                    style={{ width: `${ch.masteryScore}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: WEEKLY STRATEGY PLANNER */}
      <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border-primary/60 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-info" />
            <h3 className="text-xs font-bold text-text-primary">
              Kế hoạch rèn luyện 7 ngày
            </h3>
          </div>
          <span className="text-2xs tabular-nums text-text-muted">Mục tiêu tuần: {plan.weeklyGoal}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
          {plan.weeklyPlan.map((item, idx) => (
            <div key={idx} className="p-3 bg-bg-surface border border-border-primary/60 rounded-xl space-y-2 text-xs flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-2xs tabular-nums font-bold text-brand-info">
                  <span>{item.dayTitle}</span>
                  <span>{item.estimatedMinutes} phút</span>
                </div>
                <div className="font-medium text-text-primary leading-tight text-2xs line-clamp-2">{item.focus}</div>
              </div>

              <div className="pt-2 border-t border-border-primary/40 space-y-1 text-2xs text-text-muted">
                <div className="flex justify-between">
                  <span>Mục tiêu:</span>
                  <span className="tabular-nums text-brand-success">{item.targetMastery}%</span>
                </div>
                <div className="text-2xs italic text-text-muted line-clamp-2">{item.suggestedActivity}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: STUDY DEBT & WARNINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Study Debt List */}
        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border-primary/60 pb-2">
            <span className="text-xs font-bold text-text-primary flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-brand-warning" />
              Tồn đọng học tập ({plan.studyDebt.length})
            </span>
          </div>

          {plan.studyDebt.length === 0 ? (
            /*
              "Tiến trình hoàn hảo!" là lời khen dành cho người đã học xong, nhưng nó cũng hiện
              ra với người CHƯA LÀM CÂU NÀO, vì cả hai trường hợp đều cho danh sách rỗng. Cùng
              lỗi với "Sổ câu sai đang sạch" đã sửa ở màn Bàn học lượt 14.

              Dùng lại đúng cờ mà màn Bàn học và màn Kế hoạch đang dùng (`totalSolved > 0`) chứ
              không nghĩ ra một cách kiểm tra riêng cho màn này. Bản đầu tôi viết
              `plan.completedChapters`, một trường KHÔNG tồn tại trên `CurriculumPlan`, và tsc
              không bắt được vì chỗ đó nằm trong nhánh JSX. Lần thứ hai mắc đúng lỗi đoán tên
              API trong đợt này, xem thêm ca `dbService.getExamGoal().targetDate` ở lượt 12.
            */
            <DongTrong>
              {dbService.getStatistics().totalSolved > 0
                ? "Không còn phần nào tồn đọng. Bạn đã dọn hết những chỗ từng bỏ dở."
                : "Chưa có phần nào tồn đọng, vì bạn chưa làm câu nào. Những chỗ bỏ dở sẽ được liệt kê ở đây."}
            </DongTrong>
          ) : (
            <div className="space-y-2.5">
              {plan.studyDebt.map((debt, idx) => (
                <div key={idx} className="p-3 bg-bg-surface border border-border-primary/60 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between font-semibold text-text-primary">
                    <span>{debt.concept}</span>
                    <span className={`px-2 py-0.5 rounded text-2xs tabular-nums font-bold ${
                      debt.priority === "HIGH" ? "bg-brand-error-bg text-brand-error" : "bg-brand-warning-bg text-brand-warning"
                    }`}>
                      {NHAN_UU_TIEN[debt.priority] ?? debt.priority}
                    </span>
                  </div>
                  <p className="text-2xs text-text-muted leading-relaxed">{debt.reason}</p>
                  <div className="pt-1 text-2xs font-medium text-brand-info">{debt.suggestedAction}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Explainability & Transition Log */}
        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border-primary/60 pb-2">
            <span className="text-xs font-bold text-text-primary flex items-center gap-2">
              <Info className="w-4 h-4 text-brand-info" />
              Giải trình quyết định chiến lược
            </span>
          </div>

          <div className="space-y-2 text-xs text-text-muted">
            <div className="p-2.5 bg-bg-surface border border-border-primary/60 rounded-xl space-y-1">
              <div className="font-semibold text-text-primary">{plan.explainability.decision}</div>
              <p className="text-2xs leading-relaxed">{plan.explainability.reason}</p>
            </div>

            <div className="p-2.5 bg-bg-surface border border-border-primary/60 rounded-xl space-y-1 text-2xs tabular-nums">
              <div><strong>Bằng chứng:</strong> {plan.explainability.evidence}</div>
              <div><strong>Chỉ số:</strong> {plan.explainability.metrics}</div>
              <div><strong>Chính sách:</strong> {plan.explainability.policy}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
