/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Play, Sparkles, Clock, TrendingUp, HelpCircle, ArrowRight, Sun, Sunset, Moon, Coffee, ShieldCheck } from "lucide-react";
import { NextBestAction } from "../services/nextBestAction";
import { dbService } from "../services/db";

interface HomeHeroProps {
  action: NextBestAction;
  onExecutePrimary: (action: NextBestAction["primaryAction"]) => void;
  onExecuteSecondary?: (action: NextBestAction["secondaryAction"]) => void;
}

export default function HomeHero({ action, onExecutePrimary, onExecuteSecondary }: HomeHeroProps) {
  const stats = dbService.getStatistics();
  const currentHour = new Date().getHours();

  // Study Rhythm Determination
  let timeOfRhythm: { label: string; icon: typeof Sun; strategy: string } = {
    label: "Nhịp học Buổi sáng",
    icon: Sun,
    strategy: "Ôn kiến thức cũ & kích hoạt trí nhớ"
  };

  if (currentHour >= 12 && currentHour < 18) {
    timeOfRhythm = {
      label: "Nhịp học Buổi chiều",
      icon: Sunset,
      strategy: "Luyện lỗi sai và vận dụng kiến thức"
    };
  } else if (currentHour >= 18 || currentHour < 5) {
    timeOfRhythm = {
      label: "Nhịp học Buổi tối",
      icon: Moon,
      strategy: "Thi thử & Rà soát tổng hợp"
    };
  }

  const RhythmIcon = timeOfRhythm.icon;

  // Calculated readiness metrics
  const totalSolved = stats.totalSolved || 0;
  const accuracy = totalSolved > 0 ? Math.round((stats.totalCorrect / totalSolved) * 100) : 0;
  const readiness = Math.min(98, Math.round(accuracy * 0.7 + Math.min(totalSolved / 50, 1) * 30));
  const daysLeft = 12; // Standard exam timeline benchmark
  const completionPercent = Math.min(100, Math.round((totalSolved / 60) * 100));

  // Verbal Confidence level
  let confidenceText = "Phần này vẫn còn dễ nhầm";
  if (readiness >= 80) {
    confidenceText = "Bạn đã rất sẵn sàng đi thi";
  } else if (readiness >= 65) {
    confidenceText = "Bạn đã khá chắc phần này";
  } else if (readiness >= 40) {
    confidenceText = "Đang tích lũy tiến độ tốt";
  }

  // High Fatigue / Break Recommendation Check
  const needsBreak = stats.totalTimeSpent && stats.totalTimeSpent >= 1800;

  return (
    <div className="relative overflow-hidden bg-bg-card border border-border-primary/80 rounded-2xl p-6 sm:p-8 shadow-sm transition hover:border-border-primary space-y-6">
      {/* Subtle background ambient highlight */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-info/5 rounded-full blur-3xl pointer-events-none" />

      {/* Break Recommendation Hero Banner if high fatigue */}
      {needsBreak ? (
        <div className="bg-brand-warning-bg/40 border border-brand-warning-border/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-warning/10 text-brand-warning flex items-center justify-center shrink-0">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-text-primary">Gợi ý nghỉ ngơi 5 phút</h3>
              <p className="text-2xs text-text-muted mt-0.5">
                Bạn đã học hơn 30 phút liên tục. Tạm nghỉ 5 phút giúp não bộ củng cố vết in ký ức tốt hơn.
              </p>
            </div>
          </div>
          <button
            onClick={() => onExecutePrimary(action.primaryAction)}
            className="px-3.5 py-1.5 bg-bg-surface hover:bg-bg-card border border-border-primary text-text-secondary text-xs rounded-lg font-medium transition shrink-0 cursor-pointer"
          >
            Nghỉ xong • Tiếp tục học
          </button>
        </div>
      ) : null}

      <div className="relative z-10 space-y-6">
        {/* Top Rhythm & Eyebrow Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-info/10 text-brand-info border border-brand-info/20 text-xs font-semibold rounded-full">
              <RhythmIcon className="w-3.5 h-3.5" />
              <span>{timeOfRhythm.label} • {timeOfRhythm.strategy}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-bg-surface text-text-muted border border-border-primary text-2xs font-mono rounded-full">
              <Clock className="w-3 h-3 text-brand-info" />
              <span>{action.estimatedTimeMinutes} phút</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-text-muted font-mono">
            <TrendingUp className="w-3.5 h-3.5 text-brand-success" />
            <span>{action.expectedBenefit}</span>
          </div>
        </div>

        {/* 1. Learning Momentum System Bar */}
        <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary">Tiến trình tới kỳ thi:</span>
              <span className="text-brand-warning font-bold">Còn {daysLeft} ngày</span>
            </div>
            <div className="flex items-center gap-3 text-2xs text-text-muted">
              <span>Đã hoàn thành: <strong className="text-text-primary">{completionPercent}%</strong></span>
              <span>•</span>
              <span>Sẵn sàng đi thi: <strong className="text-brand-success">{readiness}%</strong></span>
            </div>
          </div>

          {/* Visual Momentum Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-bg-card border border-border-primary/80 rounded-full h-2.5 overflow-hidden flex">
              <div 
                className="bg-brand-success h-full transition-all duration-300 rounded-full"
                style={{ width: `${readiness}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-2xs font-sans">
              <span className="text-text-muted font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-success" />
                <span>Độ tự tin: <strong className="text-text-primary font-medium">{confidenceText}</strong></span>
              </span>
            </div>
          </div>
        </div>

        {/* Main Title & Subtitle */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-display font-light text-text-primary tracking-tight">
            {action.title}
          </h1>
          <p className="text-sm text-text-muted leading-relaxed max-w-2xl">
            {action.subtitle}
          </p>
        </div>

        {/* Deterministic Reason Callout */}
        <div className="flex items-start gap-2.5 bg-bg-surface border border-border-primary/60 rounded-xl p-3 text-xs text-text-muted">
          <HelpCircle className="w-4 h-4 text-brand-info shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold text-text-primary">Vì sao nên làm mục này: </strong>
            <span>{action.reason}</span>
          </div>
        </div>

        {/* Single Primary Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-border-primary/60">
          <button
            onClick={() => onExecutePrimary(action.primaryAction)}
            className="w-full sm:w-auto px-7 py-3.5 bg-text-primary hover:opacity-95 text-bg-card font-semibold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 group cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current transition group-hover:scale-110" />
            <span>{action.primaryAction.label}</span>
            <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
          </button>

          {action.secondaryAction && onExecuteSecondary && (
            <button
              onClick={() => onExecuteSecondary(action.secondaryAction)}
              className="text-xs font-medium text-text-muted hover:text-text-primary transition underline underline-offset-4 decoration-border-primary hover:decoration-text-primary text-center sm:text-right"
            >
              {action.secondaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
