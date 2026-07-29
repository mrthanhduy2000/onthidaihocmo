/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  BarChart3, Brain, Sparkles, TrendingUp, ShieldCheck, AlertTriangle, 
  CheckCircle2, Clock, Zap, BookOpen, Layers, Award, Target, RefreshCw
} from "lucide-react";
import { teachingAnalytics, TeachingAnalyticsReport } from "../services/teachingAnalytics";
import { DongTrong } from "./EmptyState";
import { studentModelService } from "../services/learnerModel";

export default function TeachingAnalyticsView() {
  const [report, setReport] = useState<TeachingAnalyticsReport | null>(null);
  const [studentModel, setStudentModel] = useState(studentModelService.getStudentModel());
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "strategies" | "concepts" | "audit">("overview");

  const loadData = () => {
    const r = teachingAnalytics.generateAnalyticsReport();
    setReport(r);
    setStudentModel(studentModelService.getStudentModel());
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!report) return null;

  const mem = studentModel.adaptiveMemory;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 bg-brand-info-bg text-brand-info rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-text-primary">
              Phân tích việc học và hiệu quả ôn tập
            </h2>
          </div>
          <p className="text-sm text-text-secondary">
            Theo dõi mức độ tiến bộ thực tế: khái niệm còn yếu, lỗi hay mắc và xu hướng làm bài của bạn.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-border-primary rounded-lg bg-bg-surface hover:bg-bg-hover transition cursor-pointer text-text-primary"
        >
          <RefreshCw className="w-4 h-4 text-text-muted" />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* Primary Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Hiệu quả Giảng dạy</span>
            <span className="p-1.5 bg-brand-success-bg text-brand-success rounded-md">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            {report.totalInteractions > 0 ? (
              <>
                <span className="text-2xl font-bold text-text-primary">{report.overallTeachingEffectiveness}%</span>
                <span className="text-xs font-medium text-brand-success bg-brand-success-bg px-1.5 py-0.5 rounded">
                  +{report.averageMasteryGrowth} điểm/câu
                </span>
              </>
            ) : (
              <span className="text-lg font-semibold text-text-muted">Chưa đủ dữ liệu</span>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {report.totalInteractions > 0
              ? `Đo trên ${report.totalInteractions} lượt trả lời, gồm cả câu bạn tự làm lẫn câu có gia sư AI giảng`
              : "Hãy làm vài câu hoặc hỏi gia sư AI để bảng này có căn cứ mà đo"}
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Tốc độ Học tập</span>
            <span className="p-1.5 bg-brand-info-bg text-brand-info rounded-md">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{report.learningVelocity}</span>
            <span className="text-xs text-text-muted">Thông thạo / phiên</span>
          </div>
          <p className="text-xs text-text-muted">Chỉ số gia tăng kiến thức qua các vòng lặp</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Mệt mỏi Nhận thức</span>
            <span className="p-1.5 bg-brand-warning-bg text-brand-warning rounded-md">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{mem.questionFatigue}/100</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${mem.questionFatigue > 60 ? "bg-brand-error-bg text-brand-error" : "bg-brand-success-bg text-brand-success"}`}>
              {mem.questionFatigue > 60 ? "Cần nghỉ" : "Bình thường"}
            </span>
          </div>
          <p className="text-xs text-text-muted">Mức độ căng thẳng nhận thức của học viên</p>
        </div>

        {/* Metric 4 */}
        <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Phong cách Ưu tiên</span>
            <span className="p-1.5 bg-brand-info-bg text-brand-info rounded-md">
              <Brain className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg font-bold text-text-primary truncate">
            {mem.preferredTeachingStyle || "Học thuật"}
          </div>
          <p className="text-xs text-text-muted">Tối ưu tự động bởi chính sách thích ứng</p>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-border-primary pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("overview")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "overview"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Tổng quan & Chính sách
        </button>

        <button
          onClick={() => setActiveSubTab("strategies")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "strategies"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Hiệu quả Phương pháp
        </button>

        <button
          onClick={() => setActiveSubTab("concepts")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "concepts"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Khái niệm & Hiểu sai
        </button>

        <button
          onClick={() => setActiveSubTab("audit")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "audit"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Nhật ký Kiểm toán Policy
        </button>
      </div>

      {/* Subtab 1: Overview & Policy */}
      {activeSubTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Adaptive Policy Panel */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Target className="w-5 h-5 text-brand-info" />
              <span>Chính sách giảng dạy tự động</span>
            </h3>

            <div className="space-y-3 divide-y divide-border-primary text-sm">
              <div className="pt-2 flex justify-between items-center">
                <span className="text-text-secondary">Phương pháp giảng dạy:</span>
                <span className="font-semibold text-text-primary px-2.5 py-1 bg-brand-info-bg text-brand-info rounded">
                  {mem.preferredTeachingStyle}
                </span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-text-secondary">Độ dài giải thích thích ứng:</span>
                <span className="font-medium text-text-primary capitalize">{mem.preferredExplanationLength}</span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-text-secondary">Mật độ ẩn dụ:</span>
                <span className="font-medium text-text-primary">{Math.round((mem.preferredAnalogyDensity || 0.5) * 100)}%</span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-text-secondary">Mật độ ví dụ:</span>
                <span className="font-medium text-text-primary">{Math.round((mem.preferredExampleDensity || 0.7) * 100)}%</span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-text-secondary">Tốc độ thang Bloom:</span>
                <span className="font-medium text-text-primary capitalize">{mem.preferredBloomSpeed}</span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-text-secondary">Đường cong độ khó:</span>
                <span className="font-medium text-text-primary capitalize">{mem.preferredDifficultyCurve}</span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-text-secondary">Mẫu thử lại khi sai:</span>
                <span className="font-medium text-text-primary capitalize">{mem.preferredRetryPattern}</span>
              </div>
            </div>
          </div>

          {/* Quick Performance Trends */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-success" />
              <span>Chỉ số Học thuật Chi tiết</span>
            </h3>

            <div className="space-y-4 text-sm">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-text-secondary">Độ tự tin trung bình:</span>
                  <span className="font-semibold text-text-primary">{Math.round(report.averageConfidence * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-brand-success rounded-full" style={{ width: `${report.averageConfidence * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-text-secondary">Tỷ lệ đoán mò:</span>
                  <span className="font-semibold text-text-primary">{report.averageGuessingRate}%</span>
                </div>
                <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-brand-warning rounded-full" style={{ width: `${Math.min(100, report.averageGuessingRate)}%` }} />
                </div>
              </div>

              <div className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
                  <span>Phương pháp hiệu quả nhất</span>
                </div>
                <div className={`text-sm font-bold ${report.mostEffectiveTeachingStyle === "Chưa đủ dữ liệu" ? "text-text-muted" : "text-brand-success"}`}>
                  {report.mostEffectiveTeachingStyle}
                </div>
                <p className="text-xs text-text-secondary">
                  {report.mostEffectiveTeachingStyle === "Chưa đủ dữ liệu"
                    ? "Chỉ so sánh được sau khi bạn nhờ gia sư AI giảng lại một số câu. Lượt tự làm bài không tính vào đây vì không có ai giảng."
                    : "Giúp học viên khắc phục lỗi sai và duy trì độ tinh thông cao nhất."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Strategies */}
      {activeSubTab === "strategies" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-info" />
            <span>So sánh Hiệu quả các Phương pháp Giảng dạy</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border-primary text-xs font-semibold text-text-muted">
                  <th className="py-3 px-3">Phương pháp</th>
                  <th className="py-3 px-3">Số lần tương tác</th>
                  <th className="py-3 px-3">Tỷ lệ thành công</th>
                  <th className="py-3 px-3">Điểm Tinh thông +</th>
                  <th className="py-3 px-3">Cải thiện phản xạ</th>
                  <th className="py-3 px-3">Phục hồi hiểu sai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {report.strategyStatsList.map((st) => (
                  <tr key={st.strategyName} className="hover:bg-bg-surface transition">
                    <td className="py-3 px-3 font-semibold text-text-primary">{st.strategyName}</td>
                    <td className="py-3 px-3 text-text-secondary">{st.totalInteractions}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${st.successRate >= 0.7 ? "bg-brand-success-bg text-brand-success" : "bg-brand-warning-bg text-brand-warning"}`}>
                        {Math.round(st.successRate * 100)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-text-primary font-medium">+{st.averageMasteryGain}</td>
                    <td className="py-3 px-3 text-text-secondary">{Math.round(st.averageTimeImprovement * 100)}%</td>
                    <td className="py-3 px-3 text-text-secondary">{Math.round(st.averageMisconceptionRecovery * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: Concepts */}
      {activeSubTab === "concepts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hardest Concepts */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-brand-warning" />
              <span>Khái niệm Thách thức Nhất</span>
            </h3>

            <div className="space-y-3">
              {report.hardestConcepts.length === 0 ? (
                <DongTrong>Chưa có đủ dữ liệu bài tập để phân tích. Làm thêm vài lượt là khối này có nội dung.</DongTrong>
              ) : (
                report.hardestConcepts.map((item, idx) => (
                  <div key={idx} className="p-3 bg-bg-surface border border-border-primary rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{item.conceptName}</div>
                      <div className="text-xs text-text-muted">{item.totalAttempts} lần làm bài</div>
                    </div>
                    <span className="px-2.5 py-1 bg-brand-error-bg text-brand-error rounded text-xs font-semibold">
                      Tỷ lệ sai: {item.failureRate}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Frequent Misconceptions */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-info" />
              <span>Bẫy Hiểu sai Phổ biến</span>
            </h3>

            <div className="space-y-3">
              {report.mostFrequentMisconceptions.length === 0 ? (
                <DongTrong>Chưa ghi nhận chỗ hiểu sai nào. Những khái niệm bạn hay nhầm sẽ hiện ở đây.</DongTrong>
              ) : (
                report.mostFrequentMisconceptions.map((item, idx) => (
                  <div key={idx} className="p-3 bg-bg-surface border border-border-primary rounded-lg flex items-center justify-between gap-3">
                    <div className="text-sm text-text-primary font-medium">{item.misconception}</div>
                    <span className="px-2 py-0.5 bg-brand-info-bg text-brand-info rounded text-xs font-semibold shrink-0">
                      {item.count} lần
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 4: Audit Log */}
      {activeSubTab === "audit" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-success" />
            <span>Nhật ký kiểm toán quyết định chính sách</span>
          </h3>

          <div className="space-y-3">
            {report.auditTrail.length === 0 ? (
              <DongTrong>Chưa có mục nào trong nhật ký.</DongTrong>
            ) : (
              report.auditTrail.map((entry) => (
                <div key={entry.id} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border-primary/60 pb-2">
                    <span className="font-bold text-text-primary">{entry.policyApplied}</span>
                    <span className="text-xs text-text-muted">{new Date(entry.timestamp).toLocaleString("vi-VN")}</span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-text-muted">Quyết định: </span>
                    <span className="text-text-primary font-medium">{entry.decision}</span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-text-muted">Lý do sư phạm: </span>
                    <span className="text-text-secondary">{entry.reason}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-text-muted pt-1">
                    <span><strong>Bằng chứng:</strong> {entry.evidenceUsed}</span>
                    <span><strong>Trigger:</strong> {entry.metricTriggered}</span>
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
