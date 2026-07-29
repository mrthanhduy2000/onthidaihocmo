/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Calendar, Clock, ChevronRight, TrendingUp, Target, Eye, EyeOff, Shuffle } from "lucide-react";
import { dbService, chapters } from "../services/db";
import { aiService } from "../services/ai";
import { workspaceService } from "../services/workspaceService";
import { TimeService } from "../services/time";
import { learningJourneyOrchestrator, DailyLearningStoryData, SimplifiedDashboardState } from "../services/learningJourneyOrchestrator";
import { NextBestAction } from "../services/nextBestAction";
import HomeHero from "./HomeHero";
import DailyLearningStory from "./DailyLearningStory";
import ContinueLearningCard from "./ContinueLearningCard";
import EmptyState from "./EmptyState";
import { DashboardOverview, Statistics, ExamAttempt, DifficultyLevel } from "../types";

interface DashboardProps {
  key?: any;
  onStartExam: (exam: ExamAttempt) => void;
  onNavigate: (view: "dashboard" | "practice" | "review" | "progress" | "ai_coach" | "settings") => void;
  onSubjectChange?: (subjectId: string) => void;
}

export default function Dashboard({ onStartExam, onNavigate }: DashboardProps) {
  const [overview, setOverview] = useState<DashboardOverview>(dbService.getDashboardOverview());
  const [stats, setStats] = useState<Statistics>(dbService.getStatistics());
  const [nextAction, setNextAction] = useState<NextBestAction>(learningJourneyOrchestrator.getNextBestAction());
  const [story, setStory] = useState<DailyLearningStoryData>(learningJourneyOrchestrator.getDailyLearningStory());
  const [simplified, setSimplified] = useState<SimplifiedDashboardState>(learningJourneyOrchestrator.getSimplifiedDashboardState());
  const [recentAttempts, setRecentAttempts] = useState<ExamAttempt[]>([]);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  useEffect(() => {
    setOverview(dbService.getDashboardOverview());
    const currentStats = dbService.getStatistics();
    setStats(currentStats);

    const history = dbService.getHistory();
    const sortedHistory = [...history].sort((a, b) => 
      TimeService.parseToDate(b.startTime).getTime() - TimeService.parseToDate(a.startTime).getTime()
    );
    setRecentAttempts(sortedHistory.slice(0, 4));

    setNextAction(learningJourneyOrchestrator.getNextBestAction());
    setStory(learningJourneyOrchestrator.getDailyLearningStory());
    setSimplified(learningJourneyOrchestrator.getSimplifiedDashboardState());
  }, []);

  // Bài đang làm dở lấy từ phiên chưa hoàn thành (đã kiểm tra bỏ qua bài đã nộp),
  // và chỉ tính là "dở" khi còn câu chưa trả lời.
  const pendingSession = workspaceService.getUnfinishedSession();
  const unfinishedExam = pendingSession
    && Object.keys(pendingSession.answers || {}).length < (pendingSession.questions?.length || 0)
    ? pendingSession
    : null;

  const handleExecutePrimary = (primary: NextBestAction["primaryAction"]) => {
    if (primary.examType === "continue" && unfinishedExam) {
      onStartExam(unfinishedExam);
      return;
    }

    let exam: ExamAttempt;
    if (primary.examType === "chapter" && primary.chapterId) {
      exam = aiService.generateExam({ type: "chapter", chapterId: primary.chapterId, count: primary.count || 10 });
    } else if (primary.examType === "incorrect") {
      exam = aiService.generateExam({ type: "incorrect", count: primary.count || 8 });
    } else if (primary.examType === "ai-smart") {
      exam = aiService.generateExam({ type: "ai-smart", count: primary.count || 20 });
    } else {
      exam = aiService.generateExam({ type: "adaptive", count: primary.count || 10 });
    }
    onStartExam(exam);
  };

  const handleExecuteSecondary = (sec?: NextBestAction["secondaryAction"]) => {
    if (!sec) return;
    if (sec.actionType === "review-notebook") onNavigate("review");
    else if (sec.actionType === "analytics") onNavigate("progress");
    else if (sec.actionType === "practice-center") onNavigate("practice");
  };

  const handleStartComprehensive = () => {
    const exam = aiService.generateExam({ type: "random", count: 20 });
    onStartExam(exam);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 py-8 fade-in-up">
      {/* 5 CORE QUESTIONS SIMPLIFIED BAR */}
      <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-info-bg text-brand-info flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <div className="text-2xs tabular-nums text-text-muted">1. Thời gian tới kỳ thi</div>
            <div className="text-sm font-semibold text-text-primary">
              {simplified.timeToExamText}
            </div>
          </div>
        </div>

        <div className="h-8 w-[1px] bg-border-primary/60 hidden sm:block" />

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-success-bg text-brand-success flex items-center justify-center font-bold">
            <Target className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <div className="text-2xs tabular-nums text-text-muted">2. Việc nên làm ngay</div>
            <div className="text-sm font-semibold text-text-primary">
              {simplified.todayGoalText}
            </div>
          </div>
        </div>

        <div className="h-8 w-[1px] bg-border-primary/60 hidden lg:block" />

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-warning-bg text-brand-warning flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <div className="text-2xs tabular-nums text-text-muted">3. Tiến độ hiện tại</div>
            <div className="text-sm font-semibold text-text-primary">
              {simplified.progressSummary}
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVE UNFINISHED SESSION CARD IF ANY */}
      {unfinishedExam && (
        <ContinueLearningCard 
          exam={unfinishedExam} 
          onContinue={(examId) => onStartExam(unfinishedExam)} 
        />
      )}

      {/* GIẢI ĐỀ NGẪU NHIÊN TỔNG HỢP (ôn tập thông minh để nhớ lâu) */}
      <button
        onClick={handleStartComprehensive}
        className="w-full bg-gradient-to-r from-brand-info/10 to-bg-card border border-brand-info/30 hover:border-brand-info rounded-2xl p-5 flex items-center justify-between gap-4 transition cursor-pointer text-left group"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-info-bg text-brand-info flex items-center justify-center shrink-0">
            <Shuffle className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <h3 className="text-base font-medium text-text-primary">Giải đề ngẫu nhiên tổng hợp</h3>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              20 câu trải rộng mọi chương, ưu tiên ôn lại câu từng sai để nhớ lâu hơn (lặp lại giãn cách + xen kẽ chương).
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-brand-info flex items-center gap-1 shrink-0">
          Bắt đầu
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
        </span>
      </button>

      {/* SINGLE HERO DECISION CARD */}
      <HomeHero
        action={nextAction}
        onExecutePrimary={handleExecutePrimary}
        onExecuteSecondary={handleExecuteSecondary}
      />

      {/* DAILY LEARNING STORY */}
      <DailyLearningStory 
        story={story} 
        onActionNextStep={() => handleExecutePrimary(nextAction.primaryAction)} 
      />

      {/* PROGRESSIVE DISCLOSURE TOGGLE FOR SECONDARY DETAILS */}
      <div className="flex items-center justify-between pt-2 border-t border-border-primary/60">
        <h2 className="text-xs tabular-nums text-text-muted">
Tùy chọn ôn tập thêm
        </h2>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-3 py-1.5 bg-bg-surface hover:bg-bg-surface-hover border border-border-primary text-text-muted hover:text-text-primary text-xs font-medium rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
        >
          {showAdvanced ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
          <span>{showAdvanced ? "Ẩn phần mở rộng" : "Xem phần mở rộng"}</span>
        </button>
      </div>

      {/* SECONDARY UTILITIES (PROGRESSIVELY DISCLOSED) */}
      {showAdvanced && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in-up">
          {/* Quick Chapter Selector */}
          <div className="lg:col-span-2 bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-3">
            <div className="text-xs font-semibold text-text-primary flex items-center justify-between">
              <span>Ôn theo chương</span>
              <span className="text-2xs tabular-nums text-text-muted">6 chương trọng tâm</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {chapters.slice(0, 6).map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    const exam = aiService.generateExam({ type: "chapter", chapterId: ch.id, count: 10 });
                    onStartExam(exam);
                  }}
                  className="p-3 bg-bg-surface hover:bg-bg-surface-hover border border-border-primary/60 rounded-xl text-left transition flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="text-2xs tabular-nums text-brand-info font-bold">Chương {ch.id}</div>
                    <div className="text-xs font-medium text-text-primary truncate max-w-[200px]">{ch.title}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Recent Attempts History */}
          <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-3">
            <div className="text-xs font-semibold text-text-primary flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-muted shrink-0" />
                Lịch sử làm bài
              </span>
              <button 
                onClick={() => onNavigate("progress")}
                className="text-2xs text-brand-info hover:underline tabular-nums cursor-pointer"
              >
                Tất cả
              </button>
            </div>

            {recentAttempts.length === 0 ? (
              <EmptyState
                title="Làm bài đầu tiên để có thống kê"
                description="Mỗi lượt bạn nộp sẽ hiện ở đây kèm điểm và ngày làm, để nhìn lại nhịp học theo thời gian."
              />
            ) : (
              <div className="space-y-2">
                {recentAttempts.map((att) => {
                  const percent = Math.round((att.score / (att.questions.length || 1)) * 100);
                  return (
                    <div key={att.id} className="p-2.5 bg-bg-surface rounded-xl border border-border-primary/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium text-text-primary">
                          {att.examType === "ai-smart" ? "Thi thử" : att.examType === "adaptive" ? "Thích ứng" : "Chương " + (att.chapterId || "")}
                        </div>
                        <div className="text-2xs text-text-muted tabular-nums">{att.startTime.slice(0, 10)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`tabular-nums font-semibold ${percent >= 80 ? "text-brand-success" : "text-brand-warning"}`}>
                          {att.score}/{att.questions.length} ({percent}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
