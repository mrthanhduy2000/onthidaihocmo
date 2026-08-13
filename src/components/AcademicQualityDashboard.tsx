/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ShieldCheck, BarChart2, BookOpen, AlertTriangle, Search, RefreshCw, UserCheck, FileText, Sparkles } from "lucide-react";
import { evidenceCoverageAuditService, SubjectHealthOverview, CoverageMatrixEntry } from "../services/evidenceCoverageAudit";
import { questions, dbService } from "../services/db";
import { Question } from "../types";
import QuestionQualityCard from "./QuestionQualityCard";
import ExamQualityReportView from "./ExamQualityReportView";
import { examQualityReportService, ExamQualityReport } from "../services/examQualityReport";

type TabType = "health" | "matrix" | "audits" | "exam_report" | "review_queue";

export default function AcademicQualityDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("health");
  const [auditData, setAuditData] = useState(() => evidenceCoverageAuditService.auditSubject());
  const [questionPool, setQuestionPool] = useState<Question[]>(questions);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<string>("ALL");
  const [generatedReport, setGeneratedReport] = useState<ExamQualityReport | null>(null);

  useEffect(() => {
    const fresh = evidenceCoverageAuditService.auditSubject();
    setAuditData(fresh);
    setQuestionPool(questions);
  }, []);

  const { healthOverview, conceptDetails, coverageMatrix } = auditData;

  const handleGenerateExamReport = () => {
    const report = examQualityReportService.generateReport(questionPool.slice(0, 15), "EXAM-DEMO-AUDIT");
    setGeneratedReport(report);
  };

  const filteredQuestions = questionPool.filter(q => {
    if (searchQuery) {
      const matchText = q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (q.concept || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchText) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 py-8 fade-in-up">
      {/* Header Banner */}
      <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-brand-info shrink-0" />
            <h1 className="text-2xl font-display font-light text-text-primary tracking-tight">
              Academic Quality Assurance & Validation System
            </h1>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Hệ thống kiểm định chất lượng học thuật, kiểm tra căn cứ tài liệu, phát hiện trùng lặp & quản lý phê duyệt cho ngân hàng đề thi.
          </p>
        </div>

        <button
          onClick={() => setAuditData(evidenceCoverageAuditService.auditSubject())}
          className="px-4 py-2 bg-bg-surface hover:bg-bg-surface-hover border border-border-primary text-text-primary text-xs font-medium rounded-xl transition flex items-center gap-2 self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-brand-info shrink-0" />
          <span>Tải lại kiểm định</span>
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border-primary/60 pb-3">
        <button
          onClick={() => setActiveTab("health")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
            activeTab === "health" 
              ? "bg-nut-chinh text-white shadow-sm" 
              : "bg-bg-card text-text-muted hover:text-text-primary border border-border-primary"
          }`}
        >
          <BarChart2 className="w-4 h-4 shrink-0" />
          <span>Sức khỏe Ngân hàng đề</span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
            activeTab === "matrix" 
              ? "bg-nut-chinh text-white shadow-sm" 
              : "bg-bg-card text-text-muted hover:text-text-primary border border-border-primary"
          }`}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>Ma trận bao phủ</span>
        </button>

        <button
          onClick={() => setActiveTab("audits")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
            activeTab === "audits" 
              ? "bg-nut-chinh text-white shadow-sm" 
              : "bg-bg-card text-text-muted hover:text-text-primary border border-border-primary"
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Kiểm định từng câu hỏi ({questionPool.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("exam_report")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
            activeTab === "exam_report" 
              ? "bg-nut-chinh text-white shadow-sm" 
              : "bg-bg-card text-text-muted hover:text-text-primary border border-border-primary"
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Báo cáo đề thi</span>
        </button>

        <button
          onClick={() => setActiveTab("review_queue")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
            activeTab === "review_queue" 
              ? "bg-nut-chinh text-white shadow-sm" 
              : "bg-bg-card text-text-muted hover:text-text-primary border border-border-primary"
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>Hàng chờ phê duyệt</span>
        </button>
      </div>

      {/* TAB 1: SUBJECT HEALTH DASHBOARD */}
      {activeTab === "health" && (
        <div className="space-y-6 fade-in-up">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 text-center space-y-1">
              <div className="text-2xs tabular-nums text-text-muted">Độ bao phủ Kiến thức</div>
              <div className="text-2xl tabular-nums font-bold text-brand-success">{healthOverview.coveragePct}%</div>
              <div className="text-2xs text-text-muted">{healthOverview.totalConcepts} khái niệm trọng tâm</div>
            </div>

            <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 text-center space-y-1">
              <div className="text-2xs tabular-nums text-text-muted">Tổng số câu hỏi</div>
              <div className="text-2xl tabular-nums font-bold text-brand-info">{healthOverview.totalQuestions}</div>
              <div className="text-2xs text-text-muted">Ngân hàng hoạt động</div>
            </div>

            <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 text-center space-y-1">
              <div className="text-2xs tabular-nums text-text-muted">Chất lượng trung bình</div>
              <div className="text-2xl tabular-nums font-bold text-text-primary">{healthOverview.averageQualityScore}/100</div>
              <div className="text-2xs text-text-muted">Đạt tiêu chuẩn học thuật</div>
            </div>

            <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 text-center space-y-1">
              <div className="text-2xs tabular-nums text-text-muted">Câu hỏi trùng lặp</div>
              <div className="text-2xl tabular-nums font-bold text-brand-warning">{healthOverview.duplicateQuestionCount}</div>
              <div className="text-2xs text-text-muted">Đã phát hiện</div>
            </div>
          </div>

          {/* Missing Concepts Warning */}
          {healthOverview.missingConcepts.length > 0 && (
            <div className="bg-brand-warning-bg border border-brand-warning/30 rounded-2xl p-5 space-y-2">
              <div className="text-xs font-bold text-brand-warning flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Khái niệm chưa được khai thác câu hỏi ({healthOverview.missingConcepts.length}):</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {healthOverview.missingConcepts.map((c, i) => (
                  <span key={i} className="px-2.5 py-1 bg-bg-card border border-brand-warning/30 text-text-primary rounded-lg">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Concept Coverage Status Grid */}
          <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-3">
            <div className="text-xs font-semibold text-text-primary flex items-center justify-between border-b border-border-primary/60 pb-2">
              <span>Trạng thái kiểm định khái niệm ({conceptDetails.length})</span>
              <span className="text-2xs tabular-nums text-text-muted">Chương 1 - 6</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {conceptDetails.map((cd) => (
                <div key={cd.conceptId} className="p-3 bg-bg-surface border border-border-primary/60 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-text-primary">
                    <span className="truncate max-w-[180px]">{cd.conceptName}</span>
                    <span className={`px-2 py-0.5 rounded text-2xs tabular-nums font-bold ${
                      cd.coverageStatus === "FULL" ? "bg-brand-success-bg text-brand-success" :
                      cd.coverageStatus === "PARTIAL" ? "bg-brand-warning-bg text-brand-warning" :
                      "bg-brand-error-bg text-brand-error"
                    }`}>
                      {cd.coverageStatus === "FULL" ? "Phủ đủ" : cd.coverageStatus === "PARTIAL" ? "Phủ một phần" : "Chưa phủ"}
                    </span>
                  </div>

                  <div className="text-2xs text-text-muted flex justify-between tabular-nums">
                    <span>{cd.questionCount} câu hỏi</span>
                    <span>Chương {cd.chapterId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KNOWLEDGE COVERAGE MATRIX */}
      {activeTab === "matrix" && (
        <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-4 fade-in-up">
          <div className="text-xs font-semibold text-text-primary flex items-center justify-between border-b border-border-primary/60 pb-3">
            <span>Ma trận phủ tri thức (Khái niệm → Dẫn chứng → Ma trận đề → Cấp độ Bloom → Câu hỏi)</span>
            <span className="text-2xs tabular-nums text-text-muted">{coverageMatrix.length} Khái niệm</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-primary text-text-muted tabular-nums text-2xs">
                  <th className="py-2.5 px-3">Chương</th>
                  <th className="py-2.5 px-3">Khái niệm</th>
                  <th className="py-2.5 px-3">Căn cứ giáo trình</th>
                  <th className="py-2.5 px-3">Thang Bloom</th>
                  <th className="py-2.5 px-3">Số câu hỏi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary/40 text-text-primary">
                {coverageMatrix.map((row, idx) => (
                  <tr key={idx} className="hover:bg-bg-surface transition">
                    <td className="py-3 px-3 tabular-nums text-brand-info">Chương {row.chapterId}</td>
                    <td className="py-3 px-3 font-medium">{row.concept}</td>
                    <td className="py-3 px-3 text-text-muted text-2xs max-w-xs truncate">{row.evidenceSnippet}</td>
                    <td className="py-3 px-3 tabular-nums text-2xs">
                      {row.bloomLevelsUsed.length > 0 ? row.bloomLevelsUsed.join(", ") : "Chưa có"}
                    </td>
                    <td className="py-3 px-3 tabular-nums font-bold">{row.questionCount} câu</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QUESTION AUDITS & GATE STATUS */}
      {activeTab === "audits" && (
        <div className="space-y-4 fade-in-up">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm câu hỏi hoặc khái niệm cần kiểm định..."
              className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border-primary/80 rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-info"
            />
          </div>

          {/* Questions Quality Cards */}
          <div className="space-y-3">
            {filteredQuestions.map((q) => (
              <QuestionQualityCard 
                key={q.id} 
                question={q} 
                pool={questionPool} 
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: EXAM QUALITY REPORT GENERATOR */}
      {activeTab === "exam_report" && (
        <div className="space-y-6 fade-in-up">
          {!generatedReport ? (
            <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-8 text-center space-y-4 max-w-xl mx-auto">
              <FileText className="w-6 h-6 text-brand-info mx-auto shrink-0" />
              <div className="space-y-1">
                <h3 className="text-base font-display font-medium text-text-primary">
                  Tạo báo cáo kiểm định đề thi
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Đánh giá ma trận Bloom, độ phủ chương, chỉ số tin cậy Cronbach's Alpha và cảnh báo rủi ro học thuật cho đề thi 15 câu chọn lọc.
                </p>
              </div>

              <button
                onClick={handleGenerateExamReport}
                className="px-6 py-3 bg-nut-chinh text-white font-semibold text-xs rounded-xl hover:bg-nut-chinh-re-chuot transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Tạo báo cáo kiểm định đề thi ngay</span>
              </button>
            </div>
          ) : (
            <ExamQualityReportView 
              report={generatedReport} 
              onBack={() => setGeneratedReport(null)} 
            />
          )}
        </div>
      )}

      {/* TAB 5: HUMAN REVIEW QUEUE */}
      {activeTab === "review_queue" && (
        <div className="space-y-4 fade-in-up">
          <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-4 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-text-primary">Hàng chờ Phê duyệt Giảng viên</span>
            <div className="flex items-center gap-2">
              {["ALL", "PENDING", "APPROVED", "NEEDS_REVISION", "REJECTED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setReviewFilter(status)}
                  className={`px-3 py-1 rounded-lg text-xs tabular-nums font-medium transition cursor-pointer ${
                    reviewFilter === status 
                      ? "bg-nut-chinh text-white" 
                      : "bg-bg-surface text-text-muted border border-border-primary"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {questionPool.map((q) => (
              <QuestionQualityCard 
                key={q.id} 
                question={q} 
                pool={questionPool} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
