/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, Award, 
  TrendingUp, FileText, Layers, BarChart2, HelpCircle 
} from "lucide-react";
import { ExamQualityReport } from "../services/examQualityReport";
import QuestionQualityCard from "./QuestionQualityCard";

interface ExamQualityReportViewProps {
  report: ExamQualityReport;
  onBack?: () => void;
}

export default function ExamQualityReportView({ report, onBack }: ExamQualityReportViewProps) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-6 fade-in-up">
      {/* Top Banner */}
      <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-info" />
            <h2 className="text-xl font-display font-semibold text-text-primary">
              Báo cáo Kiểm định Chất lượng Đề thi
            </h2>
          </div>
          <p className="text-xs text-text-muted font-mono">
            Mã đề: {report.examId} • Tổng số: {report.totalQuestions} câu hỏi • Ngày tạo: {report.generatedAt.slice(0, 10)}
          </p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-bg-surface border border-border-primary text-text-primary text-xs font-medium rounded-xl hover:bg-bg-surface-hover transition self-start sm:self-auto cursor-pointer"
          >
            ← Quay lại
          </button>
        )}
      </div>

      {/* Key Metric Gauges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 space-y-1 text-center">
          <div className="text-[10px] font-mono uppercase text-text-muted">Chất lượng trung bình</div>
          <div className="text-2xl font-mono font-bold text-brand-info">{report.averageQualityScore}/100</div>
          <div className="text-[10px] text-text-muted">Điểm chuẩn học thuật</div>
        </div>

        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 space-y-1 text-center">
          <div className="text-[10px] font-mono uppercase text-text-muted">Độ tin cậy đề thi</div>
          <div className="text-2xl font-mono font-bold text-brand-success">{report.estimatedExamReliability}</div>
          <div className="text-[10px] text-text-muted">Chỉ số Cronbach's Alpha</div>
        </div>

        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 space-y-1 text-center">
          <div className="text-[10px] font-mono uppercase text-text-muted">Tỷ lệ qua Gate</div>
          <div className="text-2xl font-mono font-bold text-text-primary">{report.gatePassRatePct}%</div>
          <div className="text-[10px] text-text-muted">Không vi phạm tiêu chuẩn</div>
        </div>

        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 space-y-1 text-center">
          <div className="text-[10px] font-mono uppercase text-text-muted">Bao phủ Chương</div>
          <div className="text-2xl font-mono font-bold text-brand-warning">{report.chapterCoveragePct}%</div>
          <div className="text-[10px] text-text-muted">Ma trận kiến thức</div>
        </div>
      </div>

      {/* Risk Callouts & Actionable Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Academic Risks */}
        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary border-b border-border-primary/60 pb-2">
            <AlertTriangle className="w-4 h-4 text-brand-warning" />
            <span>Cảnh báo rủi ro chất lượng ({report.potentialRisks.length})</span>
          </div>

          {report.potentialRisks.length === 0 ? (
            <div className="p-4 text-center text-xs text-brand-success flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Không phát hiện rủi ro học thuật lớn nào.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {report.potentialRisks.map((risk, idx) => (
                <div key={idx} className="p-3 bg-bg-surface border border-border-primary/60 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between font-semibold text-text-primary">
                    <span>{risk.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      risk.level === "CRITICAL" ? "bg-brand-error/20 text-brand-error" : "bg-brand-warning/20 text-brand-warning"
                    }`}>
                      {risk.level}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">{risk.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actionable Recommendations */}
        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary border-b border-border-primary/60 pb-2">
            <Award className="w-4 h-4 text-brand-info" />
            <span>Khuyến nghị tối ưu đề thi</span>
          </div>

          <ul className="space-y-2 text-xs text-text-muted">
            {report.recommendations.map((rec, idx) => (
              <li key={idx} className="p-2.5 bg-bg-surface border border-border-primary/60 rounded-xl flex items-start gap-2">
                <span className="font-mono text-brand-info font-bold text-xs">{idx + 1}.</span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Distributions Breakdown Grid */}
      <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-4">
        <div className="text-xs font-semibold text-text-primary flex items-center gap-2 border-b border-border-primary/60 pb-2">
          <BarChart2 className="w-4 h-4 text-brand-info" />
          <span>Phân bổ Thang đo Bloom & Độ khó đề thi</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Bloom Distribution */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono text-text-muted uppercase">Thang đo Bloom</div>
            <div className="space-y-1.5">
              {Object.entries(report.bloomDistribution).map(([bloom, val]) => (
                <div key={bloom} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-primary font-medium">{bloom}</span>
                    <span className="font-mono text-text-muted">{val.count} câu ({val.percentage}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-brand-info rounded-full" style={{ width: `${val.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Difficulty Distribution */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono text-text-muted uppercase">Mức độ khó</div>
            <div className="space-y-1.5">
              {Object.entries(report.difficultyDistribution).map(([diff, val]) => (
                <div key={diff} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-primary font-medium">{diff}</span>
                    <span className="font-mono text-text-muted">{val.count} câu ({val.percentage}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-brand-warning rounded-full" style={{ width: `${val.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Question Quality Profiles */}
      {report.questionProfiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted">
            Hồ sơ kiểm định từng câu hỏi ({report.questionProfiles.length})
          </h3>
          <div className="space-y-3">
            {report.questionProfiles.map((prof) => (
              <QuestionQualityCard 
                key={prof.questionId} 
                question={prof as any} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
