/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Target, 
  TrendingUp, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  Zap, 
  RotateCcw, 
  Sliders, 
  CheckCircle2, 
  Sparkles, 
  Trash2, 
  Copy, 
  Play, 
  Info,
  CalendarDays,
  Layers,
  ArrowRight,
  ChevronRight,
  FileSpreadsheet
} from "lucide-react";
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
        <div>
          <div className="flex items-center gap-2 text-xs tabular-nums text-brand-info mb-1">
            <TrendingUp className="w-4 h-4 text-brand-info" />
            <span>Kế hoạch ôn thi và dự báo điểm</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-light text-text-primary tracking-tight">
            Kế hoạch đạt điểm mục tiêu
          </h1>
        </div>

        {/* Top Summary Chips */}
        <div className="flex items-center gap-3">
          <div className="bg-bg-card border border-border-primary/80 rounded-xl px-4 py-2 text-right">
            <span className="text-2xs tabular-nums text-text-muted block">Mục tiêu hiện tại</span>
            <span className="text-sm font-semibold text-text-primary">{goal.targetScore.toFixed(1)} điểm</span>
          </div>

          <div className="bg-bg-card border border-brand-info/30 rounded-xl px-4 py-2 text-right">
            <span className="text-2xs tabular-nums text-brand-info block">Dự báo kết quả</span>
            <span className="text-sm font-bold text-brand-info">{prediction.predictedScore.toFixed(1)} ± {prediction.confidenceMargin.toFixed(1)}</span>
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
                  ? "bg-text-primary text-bg-card shadow-sm font-semibold" 
                  : "bg-bg-surface hover:bg-bg-card text-text-muted hover:text-text-primary border border-border-primary/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
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
          {/* Main Forecast Hero Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Metric 1: Forecast Score Card */}
            <div className="bg-bg-card border border-border-primary rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs tabular-nums text-text-muted">Điểm dự báo</span>
                <span className={`px-2 py-0.5 text-2xs tabular-nums rounded-full border ${
                  prediction.confidenceLevel === "Cao" 
                    ? "bg-brand-success-bg text-brand-success border-brand-success/20" 
                    : "bg-brand-warning-bg text-brand-warning border-brand-warning/20"
                }`}>
                  Độ tin cậy: {prediction.confidenceLevel}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-display font-light text-text-primary">
                  {prediction.predictedScore.toFixed(1)}
                </span>
                <span className="text-sm tabular-nums text-text-muted">
                  ± {prediction.confidenceMargin.toFixed(1)}
                </span>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                Dựa trên dữ liệu học tập hiện tại, hệ thống dự báo khả năng đạt khoảng{" "}
                <strong className="text-text-primary font-medium">{prediction.predictedScore.toFixed(1)} ± {prediction.confidenceMargin.toFixed(1)}</strong>{" "}
                nếu duy trì kế hoạch học hiện tại.
              </p>
            </div>

            {/* Metric 2: Target & Gap Card */}
            <div className="bg-bg-card border border-border-primary rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs tabular-nums text-text-muted">Mục tiêu và khoảng cách</span>
                <span className="text-xs tabular-nums font-bold text-brand-warning">
                  Còn thiếu: -{prediction.gap.toFixed(1)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-2xs text-text-muted block">Mục tiêu</span>
                  <span className="text-2xl font-display font-medium text-text-primary">{prediction.targetScore.toFixed(1)}</span>
                </div>
                <div className="text-right">
                  <span className="text-2xs text-text-muted block">Sẵn sàng</span>
                  <span className="text-2xl font-display font-medium text-brand-success">{prediction.readinessPercentage}%</span>
                </div>
              </div>

              <div className="w-full bg-bg-surface border border-border-primary/80 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-brand-success h-full transition-all duration-300" 
                  style={{ width: `${prediction.readinessPercentage}%` }} 
                />
              </div>
            </div>

            {/* Metric 3: Risk Level Card */}
            <div className="bg-bg-card border border-border-primary rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs tabular-nums text-text-muted">Nguy cơ trượt mục tiêu</span>
                <span className={`px-2 py-0.5 text-2xs tabular-nums rounded-full ${
                  prediction.riskReport.level === "Thấp" 
                    ? "bg-brand-success-bg text-brand-success" 
                    : prediction.riskReport.level === "Trung bình"
                    ? "bg-brand-warning-bg text-brand-warning"
                    : "bg-brand-error-bg text-brand-error"
                }`}>
                  Mức nguy cơ: {prediction.riskReport.level}
                </span>
              </div>

              <ul className="space-y-1.5 pt-1">
                {prediction.riskReport.reasons.map((reason, idx) => (
                  <li key={idx} className="text-xs text-text-muted flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-brand-warning shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Target Gap Action Plan */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-info" />
              Hành động cụ thể dứt điểm khoảng cách (-{prediction.gap.toFixed(1)} điểm)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {prediction.gapActionPlan.map((action) => (
                <div key={action.id} className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-primary">{action.title}</span>
                    <span className="text-xs tabular-nums font-bold text-brand-success">+{action.impact.toFixed(1)} điểm</span>
                  </div>
                  <div className="flex items-center justify-between text-2xs text-text-muted">
                    <span>Thời lượng ước tính: ~{action.timeEstimateMinutes} phút</span>
                    <button
                      onClick={() => onStartExam(action.type === "debt" ? "incorrect" : action.type === "mock" ? "ai-smart" : "adaptive")}
                      className="text-brand-info font-medium hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Thực hiện</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Milestone Planner Timeline */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-brand-info" />
              Cột mốc lộ trình
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-1">
                <span className="text-2xs tabular-nums text-brand-info">Trong 3 ngày tới</span>
                <h4 className="text-xs font-semibold text-text-primary">Xử lý xong 100% Sổ tay câu sai</h4>
                <p className="text-2xs text-text-muted">Giúp xóa rủi ro mất điểm bẫy quen thuộc.</p>
              </div>

              <div className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-1">
                <span className="text-2xs tabular-nums text-brand-warning">Trong 7 ngày tới</span>
                <h4 className="text-xs font-semibold text-text-primary">Đạt độ thông thạo 80% toàn bộ các chương</h4>
                <p className="text-2xs text-text-muted">Bảo đảm kiến thức nền tảng trước khi làm đề.</p>
              </div>

              <div className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-1">
                <span className="text-2xs tabular-nums text-brand-success">Trong 10 ngày tới</span>
                <h4 className="text-xs font-semibold text-text-primary">Làm 2 đề thi thử Tự Thích ứng</h4>
                <p className="text-2xs text-text-muted">Tối ưu điểm số tiệm cận mốc mong muốn.</p>
              </div>
            </div>
          </div>

          {/* Thẻ lý giải quyết định của AI */}
          <div className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl text-xs space-y-2 tabular-nums">
            <div className="flex items-center gap-2 text-text-muted">
              <Info className="w-3.5 h-3.5 text-brand-info" />
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
            <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-info" />
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
            <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-info" />
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
              <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-info" />
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
            <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-info" />
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
                      className="px-3 py-1.5 bg-text-primary text-bg-card hover:opacity-90 font-semibold text-xs rounded-lg transition cursor-pointer"
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

      {/* TAB 4: STUDY DEBT */}
      {activeTab === "debt" && (
        <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border-primary pb-4">
            <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-brand-warning" />
              Sổ quản lý nợ học tập
            </h3>
            <span className="text-xs tabular-nums text-text-muted">
              {debtItems.filter(i => i.status === "pending").length} mục tồn đọng
            </span>
          </div>

          <div className="space-y-3">
            {debtItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted space-y-2 tabular-nums">
                <CheckCircle2 className="w-6 h-6 text-brand-success mx-auto" />
                <p>Không có nợ học tập tồn đọng! Bạn đã dứt điểm 100% câu sai.</p>
              </div>
            ) : (
              debtItems.map(item => (
                <div key={item.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.status === "resolved" 
                    ? "bg-bg-surface/40 border-border-primary/40 opacity-60" 
                    : "bg-bg-surface border-border-primary"
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary">{item.conceptName}</span>
                      <span className={`px-2 py-0.2 text-2xs tabular-nums rounded-full ${
                        item.priority === "Cao" ? "bg-brand-error-bg text-brand-error"
                          : item.priority === "Thấp" ? "bg-bg-card text-text-muted"
                          : "bg-brand-warning-bg text-brand-warning"
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                    <span className="text-2xs tabular-nums text-text-muted block">
                      Loại nợ: {item.debtType === "wrong_attempt" ? "Câu trả lời sai trong thi" : "Chưa hoàn thành chương"} • Lần sai: {item.wrongCount}
                    </span>
                  </div>

                  {item.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onStartExam("incorrect")}
                        className="px-3 py-1 bg-brand-warning text-bg-card font-semibold text-xs rounded-lg hover:opacity-90 transition cursor-pointer"
                      >
                        Sửa ngay
                      </button>
                      <button
                        onClick={() => handlePostponeDebt(item.id)}
                        className="px-3 py-1 bg-bg-card border border-border-primary text-text-muted text-xs rounded-lg hover:text-text-primary transition cursor-pointer"
                      >
                        Hoãn
                      </button>
                      <button
                        onClick={() => handleResolveDebt(item.id)}
                        className="px-3 py-1 bg-bg-card border border-border-primary text-brand-success text-xs rounded-lg hover:bg-brand-success-bg transition cursor-pointer"
                      >
                        Xong
                      </button>
                    </div>
                  )}

                  {item.status === "resolved" && (
                    <span className="text-xs tabular-nums text-brand-success font-semibold shrink-0">Đã giải quyết ✓</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: WHAT-IF SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-5 shadow-sm">
            <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-info" />
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
            <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-info" />
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
            <h3 className="text-xs tabular-nums text-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-info" />
              Quản lý lịch sử & phiên làm bài
            </h3>

            {sessions.length > 0 && (
              <button
                onClick={() => setShowClearHistoryConfirm(true)}
                className="px-3 py-1.5 bg-brand-error-bg text-brand-error hover:bg-brand-error-bg text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa toàn bộ lịch sử</span>
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted space-y-2 tabular-nums">
              <Info className="w-6 h-6 text-text-muted mx-auto" />
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
                      <Copy className="w-3 h-3" />
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
