/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  HelpCircle, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  Clock, 
  BookOpen, 
  BarChart3, 
  Zap, 
  FileText, 
  Sliders, 
  Target, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  ArrowUpRight, 
  Award, 
  Compass, 
  History, 
  Wrench, 
  CheckSquare, 
  AlertOctagon, 
  PieChart, 
  Brain, 
  Info,
  Check,
  RotateCcw,
  Sparkle
} from "lucide-react";
import { 
  productObservabilityService, 
  SystemHealthOverview, 
  DeadConceptItem, 
  OverusedConceptItem, 
  QuestionLifecycleItem, 
  DistractorHealthReport, 
  BlueprintPerformanceItem, 
  KnowledgeGapItem, 
  BloomHealthDistribution, 
  DifficultyDriftItem, 
  SubjectCompletenessReport, 
  AuthorRecommendation, 
  AcademicChangelogItem, 
  EvolutionHistorySnapshot, 
  TechnicalDebtItem, 
  ReleaseReadinessReport, 
  ContinuousImprovementTask,
  MaintenanceJobResult 
} from "../services/productObservabilityService";
import { dbService } from "../services/db";

export const LearningObservatoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"observatory" | "concept_health" | "pedagogy" | "author_center" | "evolution">("observatory");
  
  // Data state
  const [health, setHealth] = useState<SystemHealthOverview>(() => productObservabilityService.getSystemHealthOverview());
  const [deadConcepts, setDeadConcepts] = useState<DeadConceptItem[]>(() => productObservabilityService.getDeadConcepts());
  const [overusedConcepts, setOverusedConcepts] = useState<OverusedConceptItem[]>(() => productObservabilityService.getOverusedConcepts());
  const [lifecycleItems, setLifecycleItems] = useState<QuestionLifecycleItem[]>(() => productObservabilityService.getQuestionLifecycleItems());
  const [distractorReports, setDistractorReports] = useState<DistractorHealthReport[]>(() => productObservabilityService.getDistractorHealthReports());
  const [blueprintPerf, setBlueprintPerf] = useState<BlueprintPerformanceItem[]>(() => productObservabilityService.getBlueprintPerformance());
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGapItem[]>(() => productObservabilityService.getKnowledgeGaps());
  const [bloomHealth, setBloomHealth] = useState<BloomHealthDistribution>(() => productObservabilityService.getBloomDistributionHealth());
  const [difficultyDrifts, setDifficultyDrifts] = useState<DifficultyDriftItem[]>(() => productObservabilityService.getDifficultyDriftItems());
  const [completeness, setCompleteness] = useState<SubjectCompletenessReport>(() => productObservabilityService.getSubjectCompleteness());
  const [recommendations, setRecommendations] = useState<AuthorRecommendation[]>(() => productObservabilityService.getAuthorRecommendations());
  const [changelog, setChangelog] = useState<AcademicChangelogItem[]>(() => productObservabilityService.getAcademicChangelog());
  const [evolutionHistory, setEvolutionHistory] = useState<EvolutionHistorySnapshot[]>(() => productObservabilityService.getEvolutionHistory());
  const [techDebts, setTechDebts] = useState<TechnicalDebtItem[]>(() => productObservabilityService.getTechnicalDebtItems());
  const [readiness, setReadiness] = useState<ReleaseReadinessReport>(() => productObservabilityService.getReleaseReadinessReport());
  const [improvementQueue, setImprovementQueue] = useState<ContinuousImprovementTask[]>(() => productObservabilityService.getImprovementQueue());

  // Maintenance Job modal & execution state
  const [isExecutingJob, setIsExecutingJob] = useState(false);
  const [lastJobResult, setLastJobResult] = useState<MaintenanceJobResult | null>(null);
  const [expandedExplainabilityId, setExpandedExplainabilityId] = useState<string | null>(null);

  const refreshAllData = () => {
    setHealth(productObservabilityService.getSystemHealthOverview());
    setDeadConcepts(productObservabilityService.getDeadConcepts());
    setOverusedConcepts(productObservabilityService.getOverusedConcepts());
    setLifecycleItems(productObservabilityService.getQuestionLifecycleItems());
    setDistractorReports(productObservabilityService.getDistractorHealthReports());
    setBlueprintPerf(productObservabilityService.getBlueprintPerformance());
    setKnowledgeGaps(productObservabilityService.getKnowledgeGaps());
    setBloomHealth(productObservabilityService.getBloomDistributionHealth());
    setDifficultyDrifts(productObservabilityService.getDifficultyDriftItems());
    setCompleteness(productObservabilityService.getSubjectCompleteness());
    setRecommendations(productObservabilityService.getAuthorRecommendations());
    setChangelog([...productObservabilityService.getAcademicChangelog()]);
    setEvolutionHistory(productObservabilityService.getEvolutionHistory());
    setTechDebts(productObservabilityService.getTechnicalDebtItems());
    setReadiness(productObservabilityService.getReleaseReadinessReport());
    setImprovementQueue([...productObservabilityService.getImprovementQueue()]);
  };

  const handleRunJob = (jobType: "FULL_AUDIT" | "DUPLICATE_SCAN" | "COVERAGE_CHECK" | "HEALTH_REPORT") => {
    setIsExecutingJob(true);
    setTimeout(() => {
      const res = productObservabilityService.runAutomaticMaintenanceJob(jobType);
      setLastJobResult(res);
      setIsExecutingJob(false);
      refreshAllData();
    }, 600);
  };

  const toggleExplainability = (id: string) => {
    setExpandedExplainabilityId(prev => prev === id ? null : id);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Page Header Banner */}
      <div className="bg-gradient-to-br from-bg-card via-bg-surface to-bg-card border border-border-primary rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-brand-info/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-brand-info/10 text-brand-info border border-brand-info/20">
                PHASE NEXT — PRODUCT INTELLIGENCE
              </span>
              <span className="text-xs text-text-muted font-mono">
                {completeness.courseCode} ({completeness.courseName})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary flex items-center gap-3">
              <Activity className="w-7 h-7 text-brand-info" />
              <span>Observability & Self-Improving Platform</span>
            </h1>
            <p className="text-sm text-text-muted max-w-3xl leading-relaxed">
              Hệ thống Giám sát & Tự Tiến hóa chất lượng học thuật. Tự động kiểm toán độ phủ khái niệm, chỉ số lão hóa câu hỏi, hiệu quả phương án nhiễu, độ lệch khó thực tế và mức độ sẵn sàng phát hành.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-bg-surface/80 p-4 rounded-xl border border-border-primary/80 backdrop-blur-sm">
            <div className="text-center sm:text-right">
              <div className="text-xs text-text-muted font-medium uppercase tracking-wider">Điểm sức khỏe hệ thống</div>
              <div className="text-3xl font-black font-mono tracking-tight text-brand-info flex items-center justify-center sm:justify-end gap-1.5">
                <span>{health.systemHealthScore}</span>
                <span className="text-sm font-normal text-text-muted">/100</span>
              </div>
              <div className="text-[11px] font-medium text-brand-success flex items-center justify-center sm:justify-end gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Trạng thái: {health.status}</span>
              </div>
            </div>

            <button
              onClick={() => handleRunJob("FULL_AUDIT")}
              disabled={isExecutingJob}
              className="w-full sm:w-auto px-4 py-2.5 bg-brand-info text-white rounded-lg text-xs font-semibold hover:bg-brand-info/90 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isExecutingJob ? "animate-spin" : ""}`} />
              <span>{isExecutingJob ? "Đang kiểm toán..." : "Chạy kiểm toán tự động"}</span>
            </button>
          </div>
        </div>

        {/* High-Level Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-border-primary/60">
          <div className="bg-bg-surface/60 p-3 rounded-lg border border-border-primary/60">
            <div className="text-[11px] text-text-muted font-medium">Chất lượng Nội dung</div>
            <div className="text-lg font-bold font-mono text-text-primary mt-0.5">{health.contentQualityScore}%</div>
            <div className="text-[10px] text-text-muted">Cổng chất lượng đã đạt</div>
          </div>
          <div className="bg-bg-surface/60 p-3 rounded-lg border border-border-primary/60">
            <div className="text-[11px] text-text-muted font-medium">Độ phủ Khái niệm</div>
            <div className="text-lg font-bold font-mono text-text-primary mt-0.5">{health.coverageScore}%</div>
            <div className="text-[10px] text-text-muted">{deadConcepts.length} Dead Concepts</div>
          </div>
          <div className="bg-bg-surface/60 p-3 rounded-lg border border-border-primary/60">
            <div className="text-[11px] text-text-muted font-medium">Hiệu quả Phương án nhiễu</div>
            <div className="text-lg font-bold font-mono text-text-primary mt-0.5">{health.distractorHealthScore}%</div>
            <div className="text-[10px] text-text-muted">Hiệu quả phương án nhiễu</div>
          </div>
          <div className="bg-bg-surface/60 p-3 rounded-lg border border-border-primary/60">
            <div className="text-[11px] text-text-muted font-medium">Cân bằng Bloom</div>
            <div className="text-lg font-bold font-mono text-text-primary mt-0.5">{health.bloomBalanceScore}%</div>
            <div className="text-[10px] text-text-muted">{bloomHealth.lowerOrderOverload ? "Cần tăng Vận dụng" : "Cân bằng tốt"}</div>
          </div>
          <div className="bg-bg-surface/60 p-3 rounded-lg border border-border-primary/60">
            <div className="text-[11px] text-text-muted font-medium">Nợ Kỹ thuật Học thuật</div>
            <div className="text-lg font-bold font-mono text-brand-warning mt-0.5">{techDebts.length} Mục</div>
            <div className="text-[10px] text-text-muted">Cần hoàn thiện</div>
          </div>
          <div className="bg-bg-surface/60 p-3 rounded-lg border border-border-primary/60">
            <div className="text-[11px] text-text-muted font-medium">Sẵn sàng Phát hành</div>
            <div className="text-lg font-bold font-mono text-brand-info mt-0.5">{readiness.overallReadinessScore}%</div>
            <div className="text-[10px] text-text-muted">{readiness.isReady ? "Sẵn sàng thi" : "Đang kiểm duyệt"}</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-border-primary overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab("observatory")}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === "observatory"
              ? "border-brand-info text-brand-info bg-brand-info/5"
              : "border-transparent text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Bảng quan sát hệ thống</span>
        </button>

        <button
          onClick={() => setActiveTab("concept_health")}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === "concept_health"
              ? "border-brand-info text-brand-info bg-brand-info/5"
              : "border-transparent text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Sức khỏe Khái niệm & Câu hỏi</span>
          {(deadConcepts.length > 0 || overusedConcepts.length > 0) && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-warning/20 text-brand-warning font-mono">
              {deadConcepts.length + overusedConcepts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("pedagogy")}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === "pedagogy"
              ? "border-brand-info text-brand-info bg-brand-info/5"
              : "border-transparent text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Sư phạm, Bloom & Ma trận</span>
        </button>

        <button
          onClick={() => setActiveTab("author_center")}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === "author_center"
              ? "border-brand-info text-brand-info bg-brand-info/5"
              : "border-transparent text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Khu vực Tác giả & Nợ Kỹ thuật</span>
          {techDebts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-info/20 text-brand-info font-mono">
              {techDebts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("evolution")}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
            activeTab === "evolution"
              ? "border-brand-info text-brand-info bg-brand-info/5"
              : "border-transparent text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Tiến hóa & mức độ sẵn sàng phát hành</span>
        </button>
      </div>

      {/* TAB 1: OBSERVATORY DASHBOARD */}
      {activeTab === "observatory" && (
        <div className="space-y-6 fade-in">
          {/* Formula & Explainability Drawer */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-info" />
                <h3 className="text-sm font-bold text-text-primary">Công thức đánh giá sức khỏe hệ thống</h3>
              </div>
              <button 
                onClick={() => toggleExplainability("health_formula")}
                className="text-xs text-brand-info hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{expandedExplainabilityId === "health_formula" ? "Ẩn giải trình" : "Xem Giải trình Chi tiết"}</span>
              </button>
            </div>

            <div className="p-3 bg-bg-surface rounded-lg border border-border-primary font-mono text-xs text-text-primary overflow-x-auto">
              {health.formulaDetails}
            </div>

            {expandedExplainabilityId === "health_formula" && (
              <div className="p-4 bg-bg-surface/60 rounded-lg border border-border-primary/80 space-y-2 text-xs text-text-muted leading-relaxed fade-in">
                <p><strong>Giải trình Toán học Deterministic:</strong> Mọi chỉ số được tính toán 100% bằng thuật toán phân tích dữ liệu lịch sử và ma trận kiểm định, không phụ thuộc vào dự đoán AI ngẫu nhiên.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Chất lượng Nội dung (25%):</strong> Tỷ lệ câu hỏi vượt qua các Quality Gates kiểm định.</li>
                  <li><strong>Độ phủ Khái niệm (20%):</strong> Tỷ lệ khái niệm trong Khung CTĐT có ít nhất 2 câu hỏi mẫu.</li>
                  <li><strong>Hiệu quả Phương án nhiễu (15%):</strong> Tỷ lệ các lựa chọn nhiễu có tỷ lệ sinh viên chọn từ 5% - 40%.</li>
                  <li><strong>Cân bằng Bloom (15%):</strong> Mức độ tuân thủ ma trận phân bổ bậc nhận thức sư phạm.</li>
                  <li><strong>Độ lệch Khó thực tế (15%):</strong> Khoảng cách giữa độ khó thiết kế và tỷ lệ làm sai thực tế.</li>
                  <li><strong>Nợ Kỹ thuật (10%):</strong> Mức độ hoàn thiện bằng chứng giáo trình và giải thích chi tiết.</li>
                </ul>
              </div>
            )}
          </div>

          {/* Quick Maintenance Jobs Trigger Banner */}
          <div className="bg-gradient-to-r from-brand-info/10 via-bg-surface to-bg-card border border-brand-info/20 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-info" />
                <span>Tự động hóa Bảo trì & Quét Sức khỏe định kỳ</span>
              </h4>
              <p className="text-xs text-text-muted">Chạy các tiến trình kiểm tra không sử dụng AI để phát hiện trùng lặp, lỗ hổng kiến thức và câu hỏi quá hạn.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleRunJob("DUPLICATE_SCAN")}
                className="px-3 py-1.5 bg-bg-surface border border-border-primary hover:border-brand-info/40 rounded-lg text-xs font-medium text-text-primary transition flex items-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-brand-info" />
                <span>Quét Trùng Lặp</span>
              </button>
              <button
                onClick={() => handleRunJob("COVERAGE_CHECK")}
                className="px-3 py-1.5 bg-bg-surface border border-border-primary hover:border-brand-info/40 rounded-lg text-xs font-medium text-text-primary transition flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-brand-warning" />
                <span>Quét Độ Phủ</span>
              </button>
            </div>
          </div>

          {/* Job Result Toast Notification */}
          {lastJobResult && (
            <div className="bg-bg-card border border-brand-success/40 rounded-xl p-4 shadow-sm flex items-start gap-3 fade-in">
              <CheckCircle2 className="w-5 h-5 text-brand-success shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-text-primary flex items-center gap-2">
                  <span>{lastJobResult.jobName}: Hoàn tất</span>
                  <span className="font-mono text-text-muted">({lastJobResult.executedAt})</span>
                </div>
                <p className="text-text-muted">{lastJobResult.summary}</p>
                <ul className="list-disc pl-4 text-text-muted space-y-0.5 mt-1">
                  {lastJobResult.actionsTaken.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Grid of Key Sub-Dashboards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dead Concept Summary */}
            <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-primary/60 pb-3">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-brand-warning" />
                  <span>Phát hiện khái niệm chưa khai thác</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-brand-warning/10 text-brand-warning">
                  {deadConcepts.length} Khái niệm
                </span>
              </div>

              {deadConcepts.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted">
                  Tất cả các khái niệm trong khung CTĐT đều có đủ ngân hàng câu hỏi.
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {deadConcepts.slice(0, 4).map((dc, idx) => (
                    <div key={idx} className="p-3 bg-bg-surface rounded-lg border border-border-primary/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-primary">{dc.concept}</span>
                        <span className="text-[10px] font-mono font-semibold text-brand-warning bg-brand-warning/10 px-2 py-0.5 rounded">
                          {dc.questionCount} Câu hỏi (Rủi ro: {dc.exposureRisk})
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted">{dc.reason}</p>
                      <div className="text-[10px] font-mono text-brand-info bg-brand-info/5 p-2 rounded border border-brand-info/10">
                        {dc.explainability.formula}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloom Distribution Summary */}
            <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-primary/60 pb-3">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-brand-info" />
                  <span>Cân bằng Bậc nhận thức Bloom</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-brand-info/10 text-brand-info">
                  Điểm: {bloomHealth.healthScore}/100
                </span>
              </div>

              <div className="space-y-3">
                {bloomHealth.distribution.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-text-primary">
                      <span>{item.bloomLevel}</span>
                      <span className="font-mono text-text-muted">{item.currentCount} câu ({item.currentPct}% / Mục tiêu: {item.targetPct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden border border-border-primary/60">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          item.status === "OPTIMAL" ? "bg-brand-success" : item.status === "DEFICIT" ? "bg-brand-warning" : "bg-brand-info"
                        }`}
                        style={{ width: `${Math.min(100, item.currentPct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-text-muted p-2.5 bg-bg-surface rounded-lg border border-border-primary">
                {bloomHealth.explainability.rationale}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONCEPT & QUESTION HEALTH */}
      {activeTab === "concept_health" && (
        <div className="space-y-6 fade-in">
          {/* Dead Concepts Detailed View */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-brand-warning" />
                  <span>Khái niệm chưa khai thác</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Phát hiện các khái niệm kiến thức có ít hơn 2 câu hỏi trong ngân hàng dữ liệu.</p>
              </div>
              <span className="text-xs font-mono font-semibold px-3 py-1 bg-brand-warning/10 text-brand-warning rounded-full border border-brand-warning/20">
                {deadConcepts.length} Khái niệm cần bổ sung
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deadConcepts.map((dc, idx) => (
                <div key={idx} className="p-4 bg-bg-surface rounded-xl border border-border-primary space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-text-primary">{dc.concept}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-warning/15 text-brand-warning font-semibold">
                      Chapter {dc.chapterId}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted">{dc.reason}</p>

                  <div className="p-2.5 bg-bg-card rounded-lg border border-border-primary/80 space-y-1">
                    <div className="text-[10px] font-bold uppercase text-brand-info">Đề xuất Tác giả:</div>
                    <p className="text-xs text-text-primary font-medium">{dc.suggestedAction}</p>
                  </div>

                  <div className="text-[10px] font-mono text-text-muted bg-bg-surface/80 p-2 rounded border border-border-primary/60">
                    <div>{dc.explainability.formula}</div>
                    <div className="mt-0.5 text-brand-info">{dc.explainability.proof}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overused Concept Detector */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Layers className="w-5 h-5 text-brand-info" />
                  <span>Khái niệm bị lạm dụng</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Cảnh báo các khái niệm chiếm tỷ lệ câu hỏi vượt quá 20% dung lượng ngân hàng đề.</p>
              </div>
              <span className="text-xs font-mono font-semibold px-3 py-1 bg-brand-info/10 text-brand-info rounded-full border border-brand-info/20">
                {overusedConcepts.length} Khái niệm thiên vị
              </span>
            </div>

            {overusedConcepts.length === 0 ? (
              <div className="text-center py-6 text-xs text-text-muted">
                Ngân hàng câu hỏi phân bố cân bằng, không có khái niệm bị chiếm quá tỷ lệ thiên vị.
              </div>
            ) : (
              <div className="space-y-3">
                {overusedConcepts.map((oc, idx) => (
                  <div key={idx} className="p-4 bg-bg-surface rounded-xl border border-border-primary flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-primary">{oc.concept}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-warning/15 text-brand-warning font-semibold">
                          {oc.representationRatioPct}% Tỷ trọng
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">Chiếm {oc.questionCount}/{oc.totalQuestions} câu hỏi. Tỷ lệ dự kiến chuẩn: {oc.expectedRatioPct}%.</p>
                    </div>

                    <div className="text-[11px] font-mono text-brand-info bg-bg-card p-2.5 rounded-lg border border-border-primary max-w-md">
                      {oc.explainability.proof}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Distractor Health Analysis */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-brand-success" />
                  <span>Đánh giá phương án nhiễu</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Phân tích tần suất sinh viên chọn từng phương án A, B, C, D để phát hiện bẫy vô hiệu hoặc bẫy mơ hồ.</p>
              </div>
            </div>

            <div className="space-y-4">
              {distractorReports.slice(0, 3).map((report, idx) => (
                <div key={idx} className="p-4 bg-bg-surface rounded-xl border border-border-primary space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary">Câu hỏi #{report.questionId}: "{report.questionSnippet}"</span>
                    <span className="text-xs font-mono font-semibold text-brand-success bg-brand-success/10 px-2.5 py-0.5 rounded">
                      Hiệu quả bẫy: {report.overallEfficiencyPct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {report.optionsHealth.map((opt, oIdx) => (
                      <div key={oIdx} className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                        opt.isCorrect 
                          ? "bg-brand-success/5 border-brand-success/30" 
                          : opt.status === "DEAD_DISTRACTOR"
                          ? "bg-brand-warning/10 border-brand-warning/30"
                          : "bg-bg-card border-border-primary"
                      }`}>
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span className={opt.isCorrect ? "text-brand-success" : "text-text-primary"}>
                            [{opt.optionKey.toUpperCase()}] {opt.isCorrect ? "Đúng" : "Nhiễu"}
                          </span>
                          <span>{opt.selectionRatePct}% chọn</span>
                        </div>
                        <p className="text-[11px] text-text-muted truncate">{opt.text}</p>
                        <div className="text-[10px] text-text-muted italic pt-1 border-t border-border-primary/40">
                          {opt.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PEDAGOGY & ASSESSMENT ANALYTICS */}
      {activeTab === "pedagogy" && (
        <div className="space-y-6 fade-in">
          {/* Blueprint Performance Dashboard */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-brand-info" />
                  <span>Hiệu quả ma trận đề thi</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">So sánh tỷ lệ câu hỏi thực tế trong ngân hàng với mục tiêu phân bổ của khung thiết kế.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {blueprintPerf.map((bp, idx) => (
                <div key={idx} className="p-4 bg-bg-surface rounded-xl border border-border-primary space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary">{bp.blueprintType}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      bp.status === "BALANCED" ? "bg-brand-success/10 text-brand-success" : "bg-brand-warning/10 text-brand-warning"
                    }`}>
                      {bp.status} ({bp.alignmentScore}/100)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>Thực tế: {bp.actualCount} câu ({bp.actualDistributionPct}%)</span>
                    <span>Mục tiêu: {bp.targetDistributionPct}%</span>
                  </div>

                  <div className="w-full h-2 bg-bg-card rounded-full overflow-hidden border border-border-primary/60">
                    <div 
                      className="h-full bg-brand-info transition-all duration-500"
                      style={{ width: `${Math.min(100, bp.actualDistributionPct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Difficulty Drift Detection */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-warning" />
                  <span>Phát hiện sai lệch độ khó</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Cảnh báo khoảng cách giữa độ khó thiết kế sư phạm và tỷ lệ làm sai thực tế của sinh viên.</p>
              </div>
            </div>

            <div className="space-y-3">
              {difficultyDrifts.map((dd, idx) => (
                <div key={idx} className="p-3.5 bg-bg-surface rounded-xl border border-border-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 max-w-xl">
                    <div className="font-bold text-text-primary">Câu hỏi #{dd.questionId}: "{dd.questionSnippet}"</div>
                    <div className="text-text-muted">Khái niệm: {dd.concept}</div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-text-muted text-[10px]">Độ khó Thiết kế</div>
                      <div className="font-mono font-bold text-text-primary">{dd.designedDifficultyLabel}</div>
                    </div>

                    <div>
                      <div className="text-text-muted text-[10px]">Tỷ lệ Lỗi Thực tế</div>
                      <div className="font-mono font-bold text-brand-warning">{dd.actualErrorRatePct}% Sai</div>
                    </div>

                    <div className={`px-2.5 py-1 rounded font-mono font-bold text-[11px] ${
                      dd.driftType === "CALIBRATED" ? "bg-brand-success/10 text-brand-success" : "bg-brand-warning/10 text-brand-warning"
                    }`}>
                      Độ lệch: {dd.driftDeltaPct}% ({dd.driftType})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUTHOR CENTER & TECHNICAL DEBT */}
      {activeTab === "author_center" && (
        <div className="space-y-6 fade-in">
          {/* Author Recommendation Center */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Brain className="w-5 h-5 text-brand-info" />
                  <span>Trung tâm đề xuất dành cho tác giả học liệu</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Các hành động ưu tiên cao giúp tác giả nâng cao chất lượng đề thi và phủ kín khung CTĐT.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="p-4 bg-bg-surface rounded-xl border border-border-primary space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary">{rec.title}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      rec.priority === "URGENT" ? "bg-red-500/10 text-red-500" : "bg-brand-warning/10 text-brand-warning"
                    }`}>
                      {rec.priority}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted">{rec.description}</p>

                  <div className="text-[10px] font-mono text-brand-info bg-bg-card p-2 rounded border border-border-primary">
                    {rec.explainability}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Debt Dashboard */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-brand-warning" />
                  <span>Nợ kỹ thuật học thuật</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Danh sách các thiếu sót về dẫn nguồn giáo trình, lời giải chi tiết hoặc căn cứ học thuật.</p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-brand-warning/10 text-brand-warning rounded-full">
                {techDebts.length} Mục nợ cần khắc phục
              </span>
            </div>

            <div className="space-y-3">
              {techDebts.map((debt, idx) => (
                <div key={idx} className="p-3.5 bg-bg-surface rounded-xl border border-border-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-primary">Mục Nợ #{debt.id}: {debt.debtCategory}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-warning/10 text-brand-warning">
                        -{debt.debtPoints} điểm
                      </span>
                    </div>
                    <p className="text-text-muted">{debt.remediationPlan}</p>
                  </div>

                  <div className="text-[10px] font-mono text-text-muted bg-bg-card p-2 rounded border border-border-primary max-w-xs">
                    {debt.explainability.impact}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: EVOLUTION & RELEASE READINESS */}
      {activeTab === "evolution" && (
        <div className="space-y-6 fade-in">
          {/* Release Readiness Dashboard */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Award className="w-5 h-5 text-brand-info" />
                  <span>Đánh giá mức độ sẵn sàng phát hành</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Kiểm định các Quality Gates bắt buộc trước khi phê duyệt bộ đề thi chính thức.</p>
              </div>
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                readiness.isReady ? "bg-brand-success/10 text-brand-success" : "bg-brand-warning/10 text-brand-warning"
              }`}>
                {readiness.isReady ? "ĐÃ ĐẠT CHUẨN PHÁT HÀNH" : "CẦN HOÀN THIỆN THÊM"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {readiness.gates.map((gate, idx) => (
                <div key={idx} className="p-4 bg-bg-surface rounded-xl border border-border-primary space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary">{gate.name}</span>
                    {gate.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-brand-success" />
                    ) : (
                      <XCircle className="w-4 h-4 text-brand-warning" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted font-mono">
                    <span>Yêu cầu: {gate.required}</span>
                    <span className="font-bold text-text-primary">Thực tế: {gate.actual}</span>
                  </div>
                  <p className="text-[11px] text-text-muted pt-1 border-t border-border-primary/40">{gate.explainability}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Academic Changelog Audit Trail */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <History className="w-5 h-5 text-brand-info" />
                  <span>Nhật ký kiểm toán học thuật</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Lịch sử điều chỉnh nội dung, thực thi tiến trình tự động và kiểm định chất lượng.</p>
              </div>
            </div>

            <div className="space-y-3">
              {changelog.map((item, idx) => (
                <div key={idx} className="p-3 bg-bg-surface rounded-xl border border-border-primary flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-brand-info">[{item.type}]</span>
                      <span className="font-semibold text-text-primary">{item.author}</span>
                      <span className="text-text-muted font-mono text-[10px]">({item.timestamp})</span>
                    </div>
                    <p className="text-text-muted">{item.details}</p>
                  </div>

                  <div className="font-mono font-bold text-brand-success">
                    +{item.impactScoreDelta} điểm
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
