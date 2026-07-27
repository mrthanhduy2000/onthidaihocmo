/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  TrendingUp, Award, AlertTriangle, ShieldCheck, Clock, Brain, 
  Sparkles, RefreshCw, Layers, Activity, Calendar, HelpCircle, ArrowUpRight, Zap
} from "lucide-react";
import { conceptMemoryService, ConceptMemoryProfile } from "../services/conceptMemoryService";
import { 
  studentEvolutionEngine, 
  EvolutionTimelineSnapshot, 
  StudentMilestone, 
  LearningPatternInsight, 
  EvolutionAuditEntry,
  JourneyStoryItem 
} from "../services/studentEvolutionEngine";
import { dbService } from "../services/db";

export default function LearningEvolutionView() {
  const [profiles, setProfiles] = useState<Record<string, ConceptMemoryProfile>>({});
  const [snapshots, setSnapshots] = useState<EvolutionTimelineSnapshot[]>([]);
  const [milestones, setMilestones] = useState<StudentMilestone[]>([]);
  const [insights, setInsights] = useState<LearningPatternInsight[]>([]);
  const [auditLog, setAuditLog] = useState<EvolutionAuditEntry[]>([]);
  const [journey, setJourney] = useState<JourneyStoryItem[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "concepts" | "forgetting" | "journey" | "milestones" | "patterns" | "audit">("timeline");

  const loadData = () => {
    const sId = dbService.getActiveSubjectId();
    const allProfiles = conceptMemoryService.getAllConceptProfiles(sId);
    const snaps = studentEvolutionEngine.getTimelineSnapshots(sId);
    const ms = studentEvolutionEngine.getMilestones(sId);
    const pats = studentEvolutionEngine.mineLearningPatterns(sId);
    const audit = studentEvolutionEngine.getAuditTrail(sId);
    const j = studentEvolutionEngine.generateLearningJourney(sId);

    setProfiles(allProfiles);
    setSnapshots(snaps);
    setMilestones(ms);
    setInsights(pats);
    setAuditLog(audit);
    setJourney(j);

    const conceptKeys = Object.keys(allProfiles);
    if (conceptKeys.length > 0 && !selectedConcept) {
      setSelectedConcept(conceptKeys[0]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const profileList: ConceptMemoryProfile[] = Object.values(profiles);
  const stableCount = profileList.filter(p => p.isStableMastered).length;
  const regressionCount = profileList.filter(p => p.isRegressionDetected).length;
  const inProgressCount = profileList.filter(p => !p.isStableMastered && !p.isRegressionDetected && p.timesStudied > 0).length;

  const currentSelectedProfile = selectedConcept ? profiles[selectedConcept] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-text-primary">
              Long-Term Student Evolution & Memory Engine
            </h2>
          </div>
          <p className="text-sm text-text-secondary">
            Bản sao số theo dõi tiến trình thay đổi kỹ năng, độ bền ghi nhớ & đường cong quên của người học theo thời gian.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-border-primary rounded-lg bg-bg-surface hover:bg-bg-hover transition cursor-pointer text-text-primary"
        >
          <RefreshCw className="w-4 h-4 text-text-muted" />
          <span>Cập nhật Tiến trình</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Đắc thụ Ổn định</span>
            <span className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-md">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{stableCount}</span>
            <span className="text-xs text-text-muted">Khái niệm Stable</span>
          </div>
          <p className="text-xs text-text-muted">Độ thông thạo ≥ 85%, qua nhiều phiên ôn & không bị bẫy</p>
        </div>

        <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cảnh báo Giảm sút</span>
            <span className="p-1.5 bg-red-500/10 text-red-600 rounded-md">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600">{regressionCount}</span>
            <span className="text-xs text-text-muted">Cần ưu tiên ôn tập</span>
          </div>
          <p className="text-xs text-text-muted">Phát hiện sụt giảm điểm tinh thông hoặc độ ghi nhớ &lt; 0.5</p>
        </div>

        <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Đang Phát triển</span>
            <span className="p-1.5 bg-blue-500/10 text-blue-600 rounded-md">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">{inProgressCount}</span>
            <span className="text-xs text-text-muted">Khái niệm đang tiếp thu</span>
          </div>
          <p className="text-xs text-text-muted">Đang liên tục nâng cao qua các tương tác</p>
        </div>

        <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cột mốc Đạt được</span>
            <span className="p-1.5 bg-amber-500/10 text-amber-600 rounded-md">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{milestones.length}</span>
            <span className="text-xs text-text-muted">Milestones</span>
          </div>
          <p className="text-xs text-text-muted">Ghi nhận bứt phá học tập tự động</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border-primary pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "timeline"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Lịch sử tiến hóa
        </button>

        <button
          onClick={() => setActiveTab("concepts")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "concepts"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Hồ sơ khái niệm
        </button>

        <button
          onClick={() => setActiveTab("forgetting")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "forgetting"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Đường cong quên & độ ghi nhớ
        </button>

        <button
          onClick={() => setActiveTab("journey")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "journey"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Nhật ký Hành trình
        </button>

        <button
          onClick={() => setActiveTab("milestones")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "milestones"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Cột mốc
        </button>

        <button
          onClick={() => setActiveTab("patterns")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "patterns"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Khai phá Phản xạ
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "audit"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Nhật ký kiểm toán
        </button>
      </div>

      {/* Tab 1: Timeline */}
      {activeTab === "timeline" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            <span>Tiến trình Biến đổi Tinh thông qua Tương tác</span>
          </h3>

          {snapshots.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm italic">
              Chưa có dữ liệu tiến hóa. Hãy thực hiện câu hỏi bài tập để ghi nhận snapshot đầu tiên.
            </div>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snap) => (
                <div key={snap.id} className="p-4 bg-bg-surface border border-border-primary rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-primary">{snap.conceptName}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        snap.eventType === "STABLE_ACHIEVED" ? "bg-emerald-500/10 text-emerald-600" :
                        snap.eventType === "REGRESSION_DETECTED" ? "bg-red-500/10 text-red-600" :
                        snap.eventType === "RECOVERED" ? "bg-blue-500/10 text-blue-600" :
                        "bg-indigo-500/10 text-indigo-600"
                      }`}>
                        {snap.eventType}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">{snap.note}</p>
                    <span className="text-xs text-text-muted">{new Date(snap.timestamp).toLocaleString("vi-VN")}</span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-text-muted">Thông thạo</div>
                      <div className="text-base font-bold text-text-primary">{snap.mastery}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-muted">Độ ghi nhớ</div>
                      <div className="text-base font-bold text-indigo-600">{Math.round(snap.retention * 100)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Concept Memory Digital Twin */}
      {activeTab === "concepts" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of Concepts */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider px-2 mb-2">Danh sách Khái niệm</h3>
            {profileList.length === 0 ? (
              <p className="text-sm text-text-muted p-2 italic">Chưa có khái niệm trong bộ nhớ.</p>
            ) : (
              profileList.map((p) => (
                <button
                  key={p.conceptName}
                  onClick={() => setSelectedConcept(p.conceptName)}
                  className={`w-full text-left p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                    selectedConcept === p.conceptName
                      ? "bg-indigo-500/10 border-indigo-500/30 text-text-primary"
                      : "bg-bg-surface border-border-primary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm">{p.conceptName}</div>
                    <div className="text-xs text-text-muted">Ôn tập: {p.timesStudied} lần</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {p.isStableMastered && <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                    {p.isRegressionDetected && <AlertTriangle className="w-4 h-4 text-red-600" />}
                    <span className="font-bold text-sm">{p.currentMastery}%</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Detailed Concept Profile */}
          <div className="lg:col-span-2 bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-6">
            {!currentSelectedProfile ? (
              <p className="text-sm text-text-muted italic">Chọn một khái niệm để xem bản sao số chi tiết.</p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border-primary pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{currentSelectedProfile.conceptName}</h3>
                    <p className="text-xs text-text-muted">ID: {currentSelectedProfile.conceptId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentSelectedProfile.isStableMastered && (
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded text-xs font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Stable Mastered
                      </span>
                    )}
                    {currentSelectedProfile.isRegressionDetected && (
                      <span className="px-2.5 py-1 bg-red-500/10 text-red-600 rounded text-xs font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Regression Detected
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Đỉnh Tinh thông Lịch sử</span>
                    <div className="text-lg font-bold text-emerald-600">{currentSelectedProfile.historicalPeak}%</div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Điểm Thấp nhất</span>
                    <div className="text-lg font-bold text-amber-600">{currentSelectedProfile.historicalLowest}%</div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Độ ghi nhớ</span>
                    <div className="text-lg font-bold text-indigo-600">{Math.round(currentSelectedProfile.retentionScore * 100)}%</div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Tỷ lệ Trả lời Đúng</span>
                    <div className="text-lg font-bold text-text-primary">
                      {currentSelectedProfile.timesStudied > 0 
                        ? Math.round((currentSelectedProfile.timesCorrect / currentSelectedProfile.timesStudied) * 100) 
                        : 0}%
                    </div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Thời gian suy nghĩ TB</span>
                    <div className="text-lg font-bold text-text-primary">{currentSelectedProfile.averageResponseTime} giây</div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Phong cách Giảng dạy Đề xuất</span>
                    <div className="text-sm font-bold text-indigo-600 mt-1">{currentSelectedProfile.preferredTeachingStyle}</div>
                  </div>
                </div>

                {/* Explanation History / Teaching Memory */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-text-primary">Bộ nhớ giảng dạy</h4>
                  {currentSelectedProfile.explanationsHistory.length === 0 ? (
                    <p className="text-xs text-text-muted italic">Chưa có lịch sử diễn giải cho khái niệm này.</p>
                  ) : (
                    <div className="space-y-2">
                      {currentSelectedProfile.explanationsHistory.map((h, i) => (
                        <div key={i} className="p-2.5 bg-bg-surface border border-border-primary rounded flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-text-primary">{h.strategy}</span>
                            <span className="text-text-muted ml-2">({h.length})</span>
                          </div>
                          <span className={h.wasSuccessful ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                            {h.wasSuccessful ? "Thành công" : "Cần đổi chiến lược"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Forgetting Curve */}
      {activeTab === "forgetting" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-6">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            <span>Mô hình Đường cong Quên Ebbinghaus & Lịch Ôn tập Thích ứng</span>
          </h3>

          <p className="text-sm text-text-secondary">
            AI tự động phân biệt giữa <strong>độ thông thạo</strong> (trình độ thu nạp) và <strong>độ ghi nhớ</strong> (mức độ dễ truy xuất thông tin hiện tại).
            Độ ghi nhớ sẽ suy giảm tự nhiên theo thời gian nếu không ôn lại ngắt quãng.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {profileList.map((p) => {
              const forgetCurve = conceptMemoryService.generateForgetCurve(p);
              return (
                <div key={p.conceptName} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary text-sm">{p.conceptName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      p.retentionScore >= 0.75 ? "bg-emerald-500/10 text-emerald-600" :
                      p.retentionScore >= 0.50 ? "bg-amber-500/10 text-amber-600" :
                      "bg-red-500/10 text-red-600"
                    }`}>
                      Độ ghi nhớ: {Math.round(p.retentionScore * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-text-muted mb-1">Dự báo duy trì trí nhớ:</div>
                    <div className="flex items-end gap-2 h-20 pt-2">
                      {forgetCurve.map((point, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <div 
                            className="w-full bg-indigo-500/30 rounded-t hover:bg-indigo-500 transition-colors"
                            style={{ height: `${point.retention * 100}%` }}
                          />
                          <span className="text-2xs text-text-muted">+{point.daysAhead}d</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Learning Journey */}
      {activeTab === "journey" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <span>Nhật ký Tiến trình Học tập Tổng hợp</span>
          </h3>

          <div className="space-y-3">
            {journey.length === 0 ? (
              <p className="text-sm text-text-muted italic">Chưa có đủ tương tác để tạo nhật ký hành trình.</p>
            ) : (
              journey.map((item, idx) => (
                <div key={idx} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary">{item.conceptName}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      item.status === "STABLE" ? "bg-emerald-500/10 text-emerald-600" :
                      item.status === "REGRESSED" ? "bg-red-500/10 text-red-600" :
                      "bg-indigo-500/10 text-indigo-600"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-text-secondary leading-relaxed">{item.narrativeText}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Milestones */}
      {activeTab === "milestones" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>Cột mốc Tiến bộ Học thuật</span>
          </h3>

          <div className="space-y-3">
            {milestones.length === 0 ? (
              <p className="text-sm text-text-muted italic">Chưa phát hiện cột mốc mới.</p>
            ) : (
              milestones.map((ms) => (
                <div key={ms.id} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary">{ms.title}</span>
                    <span className="text-xs text-text-muted">{new Date(ms.timestamp).toLocaleDateString("vi-VN")}</span>
                  </div>
                  <p className="text-text-secondary">{ms.description}</p>
                  <p className="text-xs text-emerald-600 font-medium">Bằng chứng: {ms.evidence}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Learning Pattern Mining */}
      {activeTab === "patterns" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            <span>Khai phá quy luật phản xạ học tập</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((ins, idx) => (
              <div key={idx} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-2 text-sm">
                <div className="font-bold text-text-primary flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>{ins.title}</span>
                </div>
                <p className="text-text-secondary">{ins.observation}</p>
                <p className="text-xs font-medium text-indigo-600 bg-indigo-500/10 p-2 rounded">
                  Khuyến nghị: {ins.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 7: Explainability Audit Log */}
      {activeTab === "audit" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span>Nhật ký kiểm toán biến đổi mô hình người học</span>
          </h3>

          <div className="space-y-3">
            {auditLog.length === 0 ? (
              <p className="text-sm text-text-muted italic">Chưa có bản ghi kiểm toán.</p>
            ) : (
              auditLog.map((entry) => (
                <div key={entry.id} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-2 text-sm">
                  <div className="flex items-center justify-between border-b border-border-primary pb-2">
                    <span className="font-bold text-text-primary">{entry.conceptName}</span>
                    <span className="text-xs text-text-muted">{new Date(entry.timestamp).toLocaleString("vi-VN")}</span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-text-muted uppercase">Lý do: </span>
                    <span className="text-text-secondary">{entry.reason}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span><strong>Trạng thái trước:</strong> {entry.previousState}</span>
                    <span><strong>Trạng thái mới:</strong> {entry.newState}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
