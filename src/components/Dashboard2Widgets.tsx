/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Lock, CheckCircle2, Play, Sparkles, TrendingUp, Zap, 
  Database, Cpu, Coins, Clock, AlertTriangle, Eye, Calendar,
  BarChart3, RefreshCw
} from "lucide-react";
import { learningEngine, LearningRoadmap, LearningRoadmapStep } from "../services/learningEngine";
import { learnerModelService, AIOrchestratorStats } from "../services/learnerModel";
import { dbService, questions } from "../services/db";
import { kbService } from "../services/kbService";
import { ExamAttempt } from "../types";

interface Dashboard2WidgetsProps {
  onStartExam: (exam: ExamAttempt) => void;
}

export default function Dashboard2Widgets({ onStartExam }: Dashboard2WidgetsProps) {
  const [roadmap, setRoadmap] = useState<LearningRoadmap>(learningEngine.generateLearningRoadmap());
  const [telemetry, setTelemetry] = useState<AIOrchestratorStats>(learnerModelService.getOrchestratorStats());
  const [selectedStep, setSelectedStep] = useState<LearningRoadmapStep | null>(null);
  
  // Stats for the forecast
  const stats = dbService.getStatistics();
  const totalSolved = stats.totalSolved;
  const totalCorrect = stats.totalCorrect;
  const mastery = stats.conceptMastery || {};
  
  useEffect(() => {
    // Keep widgets state synced
    setRoadmap(learningEngine.generateLearningRoadmap());
    setTelemetry(learnerModelService.getOrchestratorStats());
  }, [totalSolved, totalCorrect]);

  const handleRefresh = () => {
    setRoadmap(learningEngine.generateLearningRoadmap());
    setTelemetry(learnerModelService.getOrchestratorStats());
  };

  const handlePracticeStep = (step: LearningRoadmapStep) => {
    const activeSubjectId = dbService.getActiveSubjectId();
    const graph = kbService.getKnowledgeGraph(activeSubjectId);
    const node = graph.find(g => g.id === step.id);
    if (!node) return;

    // Collect all questions containing this concept tag or topic
    let conceptQs = questions.filter(q => 
      q.topicId === node.topic || 
      q.knowledgeMapping?.some(tag => node.concept.toLowerCase().includes(tag.toLowerCase()) || tag.toLowerCase().includes(node.concept.toLowerCase()))
    );

    if (conceptQs.length === 0) {
      conceptQs = questions.filter(q => q.chapterId === node.chapter).slice(0, 5);
    }

    const qIds = conceptQs.map(q => q.id);

    const exam: ExamAttempt = {
      id: `step-${step.id}-${Date.now()}`,
      startTime: new Date().toISOString(),
      isSubmitted: false,
      score: 0,
      answers: {},
      questions: qIds,
      timeSpent: 0,
      bookmarks: [],
      flags: [],
      examType: "adaptive",
      chapterId: node.chapter,
      topicId: node.topic
    };

    dbService.saveAttempt(exam);
    onStartExam(exam);
  };

  // 1. Calculations for the Learning Forecast Engine
  const calculateForecast = () => {
    const totalConcepts = roadmap.steps.length;
    if (totalConcepts === 0) return { velocity: 0, etaDays: 0, decayRate: 0, status: "Dữ liệu trống" };

    const masteredCount = roadmap.steps.filter(s => s.status === "mastered").length;
    const inProgressCount = roadmap.steps.filter(s => s.status === "available" && (mastery[s.id] || 0) > 0).length;

    // Learn velocity: average concepts mastered per completed session
    const totalAttempts = dbService.getHistory().filter(h => h.isSubmitted).length;
    
    // Average velocity heuristic
    let velocity = totalAttempts > 0 ? parseFloat((masteredCount / totalAttempts).toFixed(2)) : 0.25;
    if (velocity === 0) velocity = 0.25; // fallback baseline

    const remainingToMaster = totalConcepts - masteredCount;
    const etaDays = Math.max(1, Math.ceil(remainingToMaster / (velocity * 1.2))); // adjust for spaced repetition curves

    // Forgetting Curve Factor average
    let sumForgetting = 0;
    roadmap.steps.forEach(step => {
      const profile = learnerModelService.getOrCreateProfile(step.conceptName);
      sumForgetting += profile.forgettingScore;
    });
    const avgRetention = totalConcepts > 0 ? parseFloat((sumForgetting / totalConcepts).toFixed(2)) : 0.85;
    const decayRate = parseFloat(((1.0 - avgRetention) * 100).toFixed(1));

    let status = "Tiến độ ổn định";
    if (decayRate > 25) status = "Cảnh báo suy giảm nhớ";
    else if (masteredCount / totalConcepts > 0.8) status = "Sẵn sàng thi cử";

    return {
      velocity,
      etaDays,
      avgRetention,
      decayRate,
      status
    };
  };

  const forecast = calculateForecast();

  return (
    <div className="space-y-6" id="dashboard-learning-path-widgets">
      
      {/* Visual Roadmap & Concept Heatmap (Grid Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive Visual Roadmap (2 cols) */}
        <div className="lg:col-span-2 bg-bg-card border border-border-primary rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium font-display text-text-primary flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-success" /> 
                <span>Bản đồ lộ trình học tập trực quan</span>
              </h3>
              <button 
                onClick={handleRefresh}
                className="p-1 hover:bg-bg-surface rounded text-text-muted hover:text-text-primary transition"
                title="Làm mới lộ trình"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed font-sans">
              Lộ trình được sắp xếp theo cấu trúc sơ đồ cây tri thức. Hãy chinh phục từng nấc thang để mở khóa bài học tiếp theo.
            </p>
          </div>

          {/* Interactive Graph Timeline / Flow */}
          <div className="py-2">
            {roadmap.steps.length === 0 ? (
              <div className="text-center py-6 text-xs text-text-muted">
                Chưa có dữ liệu lộ trình.
              </div>
            ) : (
              <div className="flex flex-col space-y-2 max-h-[290px] overflow-y-auto pr-2 custom-scrollbar">
                {roadmap.steps.map((step, idx) => {
                  const score = mastery[step.id] ?? (mastery[step.conceptName] ?? 0);
                  const isSelected = selectedStep?.id === step.id;
                  
                  return (
                    <div 
                      key={step.id}
                      onClick={() => setSelectedStep(isSelected ? null : step)}
                      className={`group flex items-center justify-between p-3 rounded-lg border text-xs transition duration-150 cursor-pointer ${
                        step.status === "mastered" 
                          ? "bg-brand-success-bg/10 border-brand-success-border/30 hover:border-brand-success-border/50" 
                          : step.status === "locked"
                          ? "bg-bg-surface/30 border-border-primary/40 opacity-70 hover:opacity-100" 
                          : "bg-bg-card border-border-primary hover:border-text-muted/40"
                      } ${isSelected ? "ring-1 ring-text-primary" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center shrink-0">
                          {step.status === "mastered" ? (
                            <CheckCircle2 className="w-4 h-4 text-brand-success" />
                          ) : step.status === "locked" ? (
                            <Lock className="w-4 h-4 text-text-muted" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-brand-info flex items-center justify-center animate-pulse">
                              <div className="w-1.5 h-1.5 rounded-full bg-brand-info"></div>
                            </div>
                          )}
                          <span className="text-[8px] font-mono font-bold text-text-muted mt-0.5">CH{step.chapter}</span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">ID: {step.id}</span>
                          <span className="font-semibold text-text-primary leading-tight font-sans line-clamp-1">{step.conceptName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                          step.status === "mastered" ? "bg-brand-success-bg text-brand-success" :
                          step.status === "locked" ? "bg-bg-surface text-text-muted" :
                          "bg-brand-info-bg text-brand-info"
                        }`}>
                          {score}%
                        </span>
                        
                        {step.status !== "locked" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePracticeStep(step);
                            }}
                            className="p-1 rounded bg-bg-surface hover:bg-border-primary border border-border-primary/60 transition group-hover:scale-105"
                            title="Luyện tập khái niệm"
                          >
                            <Play className="w-3 h-3 text-text-secondary fill-current" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Concept Diagnostic Box */}
          {selectedStep ? (
            <div className="mt-2 bg-bg-surface/60 border border-border-primary p-3 rounded-lg text-xs space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-text-primary text-[11px]">{selectedStep.conceptName}</span>
                <span className="text-[9px] font-mono text-text-muted uppercase">Chương {selectedStep.chapter}</span>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed font-sans">{selectedStep.reason}</p>
              <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-border-primary/50 text-[10px]">
                <span className="text-text-muted">Gợi ý: <span className="text-text-primary italic">{selectedStep.actionRecommendation}</span></span>
                {selectedStep.status !== "locked" && (
                  <button 
                    onClick={() => handlePracticeStep(selectedStep)}
                    className="shrink-0 text-brand-info hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Luyện ngay</span>
                    <Play className="w-2.5 h-2.5 fill-current" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-2 bg-bg-surface/30 border border-dashed border-border-primary/60 rounded-lg text-[10px] text-text-muted">
              Nhấn vào bất kỳ hộp khái niệm nào ở trên để xem chẩn đoán & hành động cụ thể từ AI Tutor
            </div>
          )}
        </div>

        {/* 2. Concept Heatmap (1 col) */}
        <div className="bg-bg-card border border-border-primary rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-medium font-display text-text-primary flex items-center gap-2">
              <Eye className="w-4 h-4 text-brand-info" />
              <span>Bản đồ nhiệt tri thức</span>
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed font-sans">
              Mỗi ô vuông đại diện cho 1 khái niệm cốt lõi. Màu đậm biểu thị độ thông thạo xuất sắc.
            </p>
          </div>

          {/* Grid Map of Squares */}
          <div className="py-2 flex flex-wrap gap-1.5 justify-center">
            {roadmap.steps.map((step, idx) => {
              const score = mastery[step.id] ?? (mastery[step.conceptName] ?? 0);
              let colorClass = "bg-bg-surface hover:ring-2 hover:ring-border-primary";
              if (score >= 90) colorClass = "bg-brand-success border border-brand-success-border/20 hover:scale-110";
              else if (score >= 60) colorClass = "bg-brand-info border border-brand-info-border/20 hover:scale-110";
              else if (score > 0) colorClass = "bg-brand-warning border border-brand-warning-border/20 hover:scale-110";

              return (
                <div 
                  key={step.id}
                  className={`w-7 h-7 rounded-md cursor-pointer flex items-center justify-center text-[8px] font-mono font-bold transition duration-150 ${colorClass}`}
                  title={`${step.conceptName}: ${score}% thông thạo`}
                  onClick={() => setSelectedStep(step)}
                >
                  {score > 0 ? `${score}` : ""}
                </div>
              );
            })}
          </div>

          {/* Color Key Guide */}
          <div className="grid grid-cols-4 gap-1 text-[8px] font-mono text-text-muted text-center pt-2 border-t border-border-primary/50">
            <div><span className="w-2 h-2 rounded bg-bg-surface inline-block mr-1"></span>0% chưa học</div>
            <div><span className="w-2 h-2 rounded bg-brand-warning inline-block mr-1"></span>&lt;60% còn yếu</div>
            <div><span className="w-2 h-2 rounded bg-brand-info inline-block mr-1"></span>≥60% đạt chuẩn</div>
            <div><span className="w-2 h-2 rounded bg-brand-success inline-block mr-1"></span>≥90% tinh thông</div>
          </div>
        </div>

      </div>

      {/* Learning Forecast & AI Telemetry Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 3. Learning Forecast Widget */}
        <div className="bg-bg-card border border-border-primary rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-medium font-display text-text-primary flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-info" />
              <span>Dự báo tiến trình học</span>
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed font-sans">
              Phân tích tốc độ làm đề kết hợp đường cong lãng quên để dự tính chu kỳ ôn tập chuẩn xác.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-1">
            <div className="bg-bg-surface p-3 rounded-lg border border-border-primary/50 text-center space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-mono block">Tốc độ hoàn thiện</span>
              <span className="text-lg font-bold text-text-primary font-display">{forecast.velocity} <span className="text-[10px] font-normal text-text-muted">concepts/đề</span></span>
            </div>

            <div className="bg-bg-surface p-3 rounded-lg border border-border-primary/50 text-center space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-text-muted font-mono block">Hao hụt trí nhớ</span>
              <span className="text-lg font-bold text-brand-warning font-display">{forecast.decayRate}% <span className="text-[10px] font-normal text-text-muted">suy giảm/ngày</span></span>
            </div>
          </div>

          <div className="bg-bg-surface/50 border border-border-primary p-3 rounded-lg flex items-center justify-between text-xs font-sans">
            <div className="space-y-0.5">
              <span className="text-text-muted block text-[10px]">Thời gian dự báo hoàn thành môn học:</span>
              <span className="font-semibold text-text-primary">Khoảng {forecast.etaDays} ngày tiếp theo</span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-1 rounded font-bold uppercase ${
              forecast.decayRate > 20 ? "bg-brand-error-bg text-brand-error" : "bg-brand-success-bg text-brand-success"
            }`}>
              {forecast.status}
            </span>
          </div>
        </div>

        {/* 4. AI Telemetry Monitor Widget */}
        <div className="bg-bg-card border border-border-primary rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-medium font-display text-text-primary flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-success" />
              <span>Giám sát bộ điều phối AI</span>
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed font-sans">
              Thống kê lưu lượng cuộc gọi, ngân sách tài nguyên và tính năng bảo mật ngoại tuyến (offline fallback rate).
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 py-1 text-center">
            <div className="bg-bg-surface p-2.5 rounded-lg border border-border-primary/50">
              <span className="text-[8px] uppercase tracking-wider text-text-muted font-mono block">Số cuộc gọi API</span>
              <span className="text-md font-bold text-text-primary font-display flex items-center justify-center gap-1 mt-0.5">
                <Database className="w-3.5 h-3.5 text-text-muted" /> {telemetry.apiCallsCount}
              </span>
            </div>

            <div className="bg-bg-surface p-2.5 rounded-lg border border-border-primary/50">
              <span className="text-[8px] uppercase tracking-wider text-text-muted font-mono block">Chi phí ước tính</span>
              <span className="text-md font-bold text-brand-success font-display flex items-center justify-center gap-0.5 mt-0.5">
                <Coins className="w-3.5 h-3.5 text-brand-success" /> ${telemetry.estimatedCostUsd.toFixed(4)}
              </span>
            </div>

            <div className="bg-bg-surface p-2.5 rounded-lg border border-border-primary/50">
              <span className="text-[8px] uppercase tracking-wider text-text-muted font-mono block">Tỷ lệ dùng chế độ ngoại tuyến</span>
              <span className="text-md font-bold text-text-primary font-display flex items-center justify-center gap-1 mt-0.5">
                <RefreshCw className="w-3.5 h-3.5 text-text-muted" /> {telemetry.fallbackOfflineCount > 0 ? `${Math.round((telemetry.fallbackOfflineCount / Math.max(1, telemetry.apiCallsCount + telemetry.fallbackOfflineCount)) * 100)}%` : "0%"}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] text-text-muted border-t border-border-primary/50 pt-2 font-mono">
            <span>Tỷ lệ trúng bộ nhớ đệm: {telemetry.apiCallsCount > 0 ? `${Math.round((telemetry.cacheHitCount / telemetry.apiCallsCount) * 100)}%` : "100% (cục bộ)"}</span>
            <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-text-muted" /> Gemini Pro (ngữ cảnh thông minh)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
