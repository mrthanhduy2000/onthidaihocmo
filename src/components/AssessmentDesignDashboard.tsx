/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Sliders, Layers, CheckCircle2, AlertTriangle, Clock, 
  Brain, Play, ShieldCheck, FileCheck, Sparkles, RefreshCw, ChevronRight, Info
} from "lucide-react";
import { assessmentDesignEngine } from "../services/assessmentDesignEngine";
import { examReviewEngine } from "../services/examReviewEngine";
import { aiService } from "../services/ai";
import { ExamSpecification, ExamReviewResult, ExamAttempt } from "../types";
import { chapters } from "../services/db";

interface AssessmentDesignDashboardProps {
  onStartExam: (exam: ExamAttempt) => void;
}

export default function AssessmentDesignDashboard({ onStartExam }: AssessmentDesignDashboardProps) {
  const [selectedType, setSelectedType] = useState<"adaptive" | "mock" | "revision" | "chapter">("adaptive");
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [questionCount, setQuestionCount] = useState<number>(15);

  // Generate specification deterministically
  const spec: ExamSpecification = assessmentDesignEngine.designExam({
    examType: selectedType,
    questionCount,
    chapterId: selectedType === "chapter" ? selectedChapter : undefined
  });

  // Perform whole-exam review
  const reviewResult: ExamReviewResult = examReviewEngine.reviewExam(spec, []);

  const handleLaunchExam = () => {
    const exam = aiService.generateExam({
      type: selectedType === "mock" ? "ai-smart" : selectedType as any,
      chapterId: selectedType === "chapter" ? selectedChapter : undefined,
      count: questionCount
    });
    onStartExam(exam);
  };

  return (
    <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-6 space-y-8 shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-primary/60 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs tabular-nums uppercase tracking-wider text-brand-info">
            <Sliders className="w-4 h-4" />
            Assessment Design Engine • Bàn thiết kế Đề thi
          </div>
          <h2 className="text-xl font-display font-light text-text-primary mt-1">
            Cấu trúc Đề thi & Blueprint trước khi khởi tạo
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Thiết kế 100% Deterministic • Phân bổ tỷ lệ Bloom, Độ khó, Coverage & Kiểm tra tính trùng lặp trước khi sinh câu chữ.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleLaunchExam}
          className="px-6 py-3 bg-text-primary hover:opacity-95 text-bg-card font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-2 shrink-0"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Khởi tạo & Bắt đầu bài thi ({spec.questionCount} câu)</span>
        </button>
      </div>

      {/* Assembly Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-bg-surface p-2 rounded-xl border border-border-primary/60 text-xs">
        <button
          onClick={() => setSelectedType("adaptive")}
          className={`p-3 rounded-lg text-left transition font-medium flex flex-col gap-1 ${
            selectedType === "adaptive" ? "bg-bg-card text-text-primary border border-border-primary shadow-sm" : "text-text-muted hover:text-text-primary"
          }`}
        >
          <span className="font-bold flex items-center gap-1.5 text-brand-info">
            <Brain className="w-3.5 h-3.5" /> Adaptive Exam
          </span>
          <span className="text-2xs text-text-muted">Định hướng lỗ hổng kiến thức & trí nhớ</span>
        </button>

        <button
          onClick={() => setSelectedType("mock")}
          className={`p-3 rounded-lg text-left transition font-medium flex flex-col gap-1 ${
            selectedType === "mock" ? "bg-bg-card text-text-primary border border-border-primary shadow-sm" : "text-text-muted hover:text-text-primary"
          }`}
        >
          <span className="font-bold flex items-center gap-1.5 text-text-primary">
            <ShieldCheck className="w-3.5 h-3.5" /> Mock Exam
          </span>
          <span className="text-2xs text-text-muted">Mô phỏng chuẩn cấu trúc kỳ thi thật</span>
        </button>

        <button
          onClick={() => setSelectedType("revision")}
          className={`p-3 rounded-lg text-left transition font-medium flex flex-col gap-1 ${
            selectedType === "revision" ? "bg-bg-card text-text-primary border border-border-primary shadow-sm" : "text-text-muted hover:text-text-primary"
          }`}
        >
          <span className="font-bold flex items-center gap-1.5 text-brand-warning">
            <RefreshCw className="w-3.5 h-3.5" /> Revision Exam
          </span>
          <span className="text-2xs text-text-muted">Ưu tiên câu từng sai & điểm chưa thông thạo</span>
        </button>

        <button
          onClick={() => setSelectedType("chapter")}
          className={`p-3 rounded-lg text-left transition font-medium flex flex-col gap-1 ${
            selectedType === "chapter" ? "bg-bg-card text-text-primary border border-border-primary shadow-sm" : "text-text-muted hover:text-text-primary"
          }`}
        >
          <span className="font-bold flex items-center gap-1.5 text-brand-success">
            <Layers className="w-3.5 h-3.5" /> Chapter Focus
          </span>
          <span className="text-2xs text-text-muted">Chuyên sâu 100% vào 1 chương chọn lọc</span>
        </button>
      </div>

      {/* Chapter Selection if Chapter Exam */}
      {selectedType === "chapter" && (
        <div className="flex items-center gap-3 bg-bg-surface p-3 rounded-xl border border-border-primary/60 text-xs">
          <span className="font-medium text-text-primary">Chọn chương mục tiêu:</span>
          <select
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(Number(e.target.value))}
            className="bg-bg-card text-text-primary border border-border-primary rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            {chapters.map(c => (
              <option key={c.id} value={c.id}>Chương {c.id}: {c.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Exam Review Audit Bar */}
      <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border-primary/40 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <FileCheck className="w-4 h-4 text-brand-success" />
            <span>Báo cáo kiểm định đề thi</span>
            <span className={`px-2 py-0.5 rounded text-2xs tabular-nums font-bold ${
              reviewResult.passed ? "bg-brand-success/10 text-brand-success border border-brand-success/20" : "bg-brand-warning/10 text-brand-warning border border-brand-warning/20"
            }`}>
              Điểm: {reviewResult.overallScore}/100 ({reviewResult.passed ? "ĐẠT" : "CẢNH BÁO"})
            </span>
          </div>

          <div className="text-2xs tabular-nums text-text-muted">
            Thời gian dự kiến: <strong className="text-text-primary">{spec.plannedTimeMinutes} phút</strong>
          </div>
        </div>

        {/* Check Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {Object.entries(reviewResult.checks).map(([key, check]) => {
            const isPass = check.status === "PASS";
            return (
              <div 
                key={key} 
                title={check.details}
                className={`p-2 rounded-lg border text-center transition ${
                  isPass ? "bg-brand-success/5 border-brand-success/20 text-brand-success" : "bg-brand-warning/5 border-brand-warning/20 text-brand-warning"
                }`}
              >
                <div className="text-2xs tabular-nums uppercase text-text-muted">{key}</div>
                <div className="text-xs font-bold mt-0.5 flex items-center justify-center gap-1">
                  {isPass ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  <span>{check.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribution Planners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bloom Distribution */}
        <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-text-primary flex items-center justify-between">
            <span>Thang đo Bloom</span>
            <span className="tabular-nums text-2xs text-text-muted">Mục tiêu: 30-30-20-15-5</span>
          </h4>

          <div className="space-y-2 text-xs">
            {Object.entries(spec.bloomDistribution).map(([bloom, data]) => (
              <div key={bloom} className="space-y-1">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-text-muted">{bloom}</span>
                  <span className="tabular-nums font-medium text-text-primary">{data.count} câu ({data.percentage}%)</span>
                </div>
                <div className="w-full h-1.5 bg-bg-card rounded-full overflow-hidden">
                  <div className="h-full bg-brand-info rounded-full" style={{ width: `${data.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-text-primary flex items-center justify-between">
            <span>Phân bổ Độ khó</span>
            <span className="tabular-nums text-2xs text-text-muted">Mục tiêu: 25-50-25</span>
          </h4>

          <div className="space-y-2 text-xs">
            {Object.entries(spec.difficultyDistribution).map(([diff, data]) => (
              <div key={diff} className="space-y-1">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-text-muted">{diff}</span>
                  <span className="tabular-nums font-medium text-text-primary">{data.count} câu ({data.percentage}%)</span>
                </div>
                <div className="w-full h-1.5 bg-bg-card rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      diff === "Easy" ? "bg-brand-success" : diff === "Medium" ? "bg-brand-warning" : "bg-brand-error"
                    }`} 
                    style={{ width: `${data.percentage}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Blueprint Types Mix */}
        <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-text-primary flex items-center justify-between">
            <span>Cơ cấu dạng bài</span>
            <span className="tabular-nums text-2xs text-text-muted">Đa dạng hóa 100%</span>
          </h4>

          <div className="space-y-2 text-xs">
            {Object.entries(spec.blueprintDistribution).map(([bp, data]) => (
              <div key={bp} className="space-y-1">
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-text-muted truncate max-w-[150px]">{bp}</span>
                  <span className="tabular-nums font-medium text-text-primary">{data.count} câu ({data.percentage}%)</span>
                </div>
                <div className="w-full h-1.5 bg-bg-card rounded-full overflow-hidden">
                  <div className="h-full bg-text-primary/70 rounded-full" style={{ width: `${data.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exam Rhythm & Pacing Track */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-text-primary flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-info" />
          <span>Sơ đồ Pacing & Cognitive Load Rhythm Sequence</span>
        </h4>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {spec.questionSpecs.map((q, idx) => (
            <div 
              key={idx} 
              className="shrink-0 p-2.5 bg-bg-surface border border-border-primary/60 rounded-xl text-center space-y-1 min-w-[110px]"
            >
              <div className="text-2xs tabular-nums text-brand-info font-bold">Câu {q.questionIndex}</div>
              <div className="text-xs font-semibold text-text-primary">{q.difficulty}</div>
              <div className="text-2xs tabular-nums text-text-muted">{q.bloom}</div>
              <div className="text-2xs text-text-primary/80 truncate">{q.blueprint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Question Specifications Table */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold text-text-primary flex items-center justify-between">
          <span>Danh sách Question Specifications ({spec.questionSpecs.length} chỉ tiêu)</span>
          <span className="text-2xs text-text-muted">Sinh bởi bộ thiết kế đề thi</span>
        </h4>

        <div className="overflow-x-auto border border-border-primary/60 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg-surface text-text-muted tabular-nums uppercase text-2xs border-b border-border-primary/60">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Khái niệm</th>
                <th className="p-3">Bloom</th>
                <th className="p-3">Độ khó</th>
                <th className="p-3">Dạng bài</th>
                <th className="p-3">Chương</th>
                <th className="p-3">Lý do chọn chỉ tiêu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary/40">
              {spec.questionSpecs.map((q) => (
                <tr key={q.questionIndex} className="hover:bg-bg-surface/50 transition">
                  <td className="p-3 tabular-nums font-bold text-brand-info">{q.questionIndex}</td>
                  <td className="p-3 font-medium text-text-primary">{q.concept}</td>
                  <td className="p-3 tabular-nums text-text-muted">{q.bloom}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-2xs tabular-nums font-bold ${
                      q.difficulty === "Dễ" ? "bg-brand-success/10 text-brand-success" : q.difficulty === "Trung bình" ? "bg-brand-warning/10 text-brand-warning" : "bg-brand-error/10 text-brand-error"
                    }`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="p-3 text-text-muted">{q.blueprint}</td>
                  <td className="p-3 tabular-nums text-text-muted">Chương {q.chapterId}</td>
                  <td className="p-3 text-text-muted text-2xs">{q.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
