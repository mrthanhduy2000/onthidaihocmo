/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Compass, Calendar, Target, Clock, Award, CheckCircle2, 
  AlertTriangle, Lock, ArrowRight, Play, BookOpen, ShieldCheck, 
  TrendingUp, Layers, HelpCircle, ChevronRight, Info 
} from "lucide-react";
import { 
  curriculumIntelligenceEngine, 
  CurriculumPlan, 
  CurriculumStage 
} from "../services/curriculumIntelligenceEngine";
import { aiService } from "../services/ai";
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

  const getStageBadgeColor = (stage: CurriculumStage) => {
    switch (stage) {
      case "FOUNDATION": return "bg-brand-info/15 text-brand-info border-brand-info/30";
      case "UNDERSTANDING": return "bg-brand-info/20 text-brand-info border-brand-info/40";
      case "APPLICATION": return "bg-brand-warning/15 text-brand-warning border-brand-warning/30";
      case "CONSOLIDATION": return "bg-brand-warning/20 text-brand-warning border-brand-warning/40";
      case "EXAM_PREPARATION": return "bg-brand-error/15 text-brand-error border-brand-error/30";
      case "FINAL_REVIEW": return "bg-brand-error/20 text-brand-error border-brand-error/40";
      case "MASTERY": return "bg-brand-success/15 text-brand-success border-brand-success/30";
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
                Curriculum Intelligence & Learning Strategy
              </h1>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              Lớp hoạch định chiến lược học tập toàn diện. Điều phối lộ trình, phân bổ thời gian & nâng cao mức sẵn sàng thi.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <span className={`px-3 py-1.5 rounded-full border text-xs tabular-nums font-bold ${getStageBadgeColor(plan.currentStage)}`}>
              Giai đoạn: {plan.currentStage}
            </span>
          </div>
        </div>

        {/* 4 Core Strategy Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-3.5 space-y-1">
            <div className="text-2xs tabular-nums text-text-muted">Sẵn sàng thi</div>
            <div className="text-2xl tabular-nums font-bold text-brand-info">{plan.readinessScore}/100</div>
            <div className="text-2xs text-text-muted">Chỉ số tự tin làm bài</div>
          </div>

          <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-3.5 space-y-1">
            <div className="text-2xs tabular-nums text-text-muted">Độ thông thạo</div>
            <div className="text-2xl tabular-nums font-bold text-brand-success">{plan.masteryScore}%</div>
            <div className="text-2xs text-text-muted">Tỷ lệ chính xác tổng thể</div>
          </div>

          <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-3.5 space-y-1">
            <div className="text-2xs tabular-nums text-text-muted">Nhiệm vụ hôm nay</div>
            <div className="text-xs font-semibold text-text-primary truncate">{plan.todayGoal}</div>
            <div className="text-2xs tabular-nums text-brand-info">{plan.estimatedStudyTime} phút dự kiến</div>
          </div>

          <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-3.5 space-y-1">
            <div className="text-2xs tabular-nums text-text-muted">Đếm ngược kỳ thi</div>
            <div className="text-2xl tabular-nums font-bold text-brand-warning">{plan.examDaysRemaining} Ngày</div>
            <div className="text-2xs text-text-muted">Tính từ ngày thi trong mục tiêu môn học</div>
          </div>
        </div>

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
            className="px-5 py-2.5 bg-text-primary hover:opacity-95 text-bg-card font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Thực hiện nhiệm vụ ({plan.recommendedExamType.toUpperCase()})</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: LEARNING MAP (CHAPTER STATUSES) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs tabular-nums text-text-muted flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-info" />
            Bản đồ tiến trình học phần
          </h2>
          <span className="text-2xs tabular-nums text-text-muted">7 Chương trọng tâm</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plan.chapterStatuses.map((ch) => (
            <div 
              key={ch.chapterId} 
              className={`p-4 rounded-xl border transition space-y-2 ${
                ch.status === "COMPLETED" ? "bg-brand-success/5 border-brand-success/40" :
                ch.status === "WEAK" ? "bg-brand-warning/5 border-brand-warning/40" :
                ch.status === "LOCKED" ? "bg-bg-surface/50 border-border-primary/40 opacity-60" :
                "bg-bg-card border-border-primary/80 hover:border-brand-info/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xs tabular-nums font-bold text-brand-info bg-brand-info/10 px-2 py-0.5 rounded">
                  {ch.code}
                </span>

                {ch.status === "COMPLETED" && (
                  <span className="inline-flex items-center gap-1 text-2xs tabular-nums font-bold text-brand-success">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Hoàn thành</span>
                  </span>
                )}
                {ch.status === "WEAK" && (
                  <span className="inline-flex items-center gap-1 text-2xs tabular-nums font-bold text-brand-warning">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Cần củng cố</span>
                  </span>
                )}
                {ch.status === "LOCKED" && (
                  <span className="inline-flex items-center gap-1 text-2xs tabular-nums text-text-muted">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Chưa mở</span>
                  </span>
                )}
                {ch.status === "READY" && (
                  <span className="inline-flex items-center gap-1 text-2xs tabular-nums text-brand-info">
                    <span>Sẵn sàng học</span>
                  </span>
                )}
              </div>

              <div className="font-semibold text-xs text-text-primary line-clamp-1">{ch.title}</div>

              <div className="space-y-1">
                <div className="flex justify-between text-2xs tabular-nums text-text-muted">
                  <span>Thông thạo</span>
                  <span>{ch.masteryScore}%</span>
                </div>
                <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${ch.masteryScore >= 80 ? "bg-brand-success" : "bg-brand-info"}`} 
                    style={{ width: `${ch.masteryScore}%` }} 
                  />
                </div>
              </div>
            </div>
          ))}
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
            <div className="p-4 text-center text-xs text-brand-success flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Không có tồn đọng học tập. Tiến trình hoàn hảo!</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {plan.studyDebt.map((debt, idx) => (
                <div key={idx} className="p-3 bg-bg-surface border border-border-primary/60 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between font-semibold text-text-primary">
                    <span>{debt.concept}</span>
                    <span className={`px-2 py-0.5 rounded text-2xs tabular-nums font-bold ${
                      debt.priority === "HIGH" ? "bg-brand-error/20 text-brand-error" : "bg-brand-warning/20 text-brand-warning"
                    }`}>
                      {debt.priority}
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
