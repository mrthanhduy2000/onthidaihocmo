/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, BookOpen, UserCheck, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Question } from "../types";
import { contentQualityAssurance, QuestionQualityProfile, HumanReviewStatus } from "../services/contentQualityAssurance";

interface QuestionQualityCardProps {
  key?: any;
  question: Question;
  pool?: Question[];
  onReviewUpdated?: (questionId: number, review: HumanReviewStatus) => void;
}

export default function QuestionQualityCard({ question, pool = [], onReviewUpdated }: QuestionQualityCardProps) {
  const [profile, setProfile] = useState<QuestionQualityProfile>(() => 
    contentQualityAssurance.auditQuestion(question, pool)
  );
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [reviewerNotes, setReviewerNotes] = useState<string>(profile.humanReview.reviewerNotes || "");
  const [showNotesInput, setShowNotesInput] = useState<boolean>(false);

  const handleReviewAction = (status: "APPROVED" | "NEEDS_REVISION" | "REJECTED") => {
    const updated = contentQualityAssurance.updateHumanReview(question.id, status, reviewerNotes);
    setProfile(prev => ({ ...prev, humanReview: updated }));
    if (onReviewUpdated) onReviewUpdated(question.id, updated);
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-brand-success bg-brand-success-bg border-brand-success/30";
    if (score >= 70) return "text-brand-warning bg-brand-warning-bg border-brand-warning/30";
    return "text-brand-error bg-brand-error-bg border-brand-error/30";
  };

  return (
    <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-5 space-y-4 shadow-sm hover:border-border-primary transition">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-primary/60 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs tabular-nums font-bold text-brand-info bg-brand-info-bg border border-brand-info/20 px-2.5 py-0.5 rounded-full">
            #{question.id}
          </span>

          <span className="text-xs font-medium text-text-primary truncate max-w-xs sm:max-w-md">
            Chương {question.chapterId} • {question.concept || "Chưa gán khái niệm"}
          </span>

          <span className="text-2xs tabular-nums text-text-muted bg-bg-surface px-2 py-0.5 rounded border border-border-primary">
            {question.bloomLevel || "Remember"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quality Gate Badge */}
          {profile.gatePassed ? (
            <span className="inline-flex items-center gap-1 text-2xs tabular-nums font-bold text-brand-success bg-brand-success-bg border border-brand-success/30 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gate PASSED</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-2xs tabular-nums font-bold text-brand-error bg-brand-error-bg border border-brand-error/30 px-2.5 py-1 rounded-full">
              <XCircle className="w-4 h-4" />
              <span>Gate FAILED ({profile.gateViolations.length})</span>
            </span>
          )}

          {/* Overall Quality Score */}
          <div className={`px-3 py-1 rounded-full border text-xs tabular-nums font-bold ${getScoreColor(profile.metrics.overallScore)}`}>
            Score: {profile.metrics.overallScore}/100
          </div>
        </div>
      </div>

      {/* Question Text Preview */}
      <div className="space-y-2">
        <p className="text-xs sm:text-sm font-medium text-text-primary leading-relaxed">
          {question.question}
        </p>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {Object.entries(question.options || {}).map(([key, val]) => {
            const isCorrect = key.toLowerCase() === question.correctAnswer.toLowerCase();
            return (
              <div 
                key={key} 
                className={`p-2 rounded-lg border ${isCorrect ? "bg-brand-success-bg border-brand-success/40 text-brand-success font-medium" : "bg-bg-surface border-border-primary/60 text-text-muted"}`}
              >
                <span className="tabular-nums font-bold mr-1.5">{key}:</span>
                <span>{val}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gate Violations Warning if any */}
      {profile.gateViolations.length > 0 && (
        <div className="bg-brand-error-bg border border-brand-error/30 rounded-xl p-3 space-y-1 text-xs text-brand-error">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Vi phạm tiêu chuẩn Quality Gate:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-2xs pl-1">
            {profile.gateViolations.map((v, idx) => (
              <li key={idx}><strong>[{v.gate}]:</strong> {v.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Expand/Collapse Toggle */}
      <div className="flex items-center justify-between pt-1 border-t border-border-primary/60 text-xs">
        <div className="flex items-center gap-2">
          {/* Human Review Status Pill */}
          <span className={`px-2.5 py-0.5 rounded-full text-2xs tabular-nums font-bold ${
            profile.humanReview.status === "APPROVED" ? "bg-brand-success-bg text-brand-success border border-brand-success/30" :
            profile.humanReview.status === "NEEDS_REVISION" ? "bg-brand-warning-bg text-brand-warning border border-brand-warning/30" :
            profile.humanReview.status === "REJECTED" ? "bg-brand-error-bg text-brand-error border border-brand-error/30" :
            "bg-bg-surface text-text-muted border border-border-primary"
          }`}>
            Giảng viên: {profile.humanReview.status}
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-muted hover:text-text-primary text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
        >
          <span>{isExpanded ? "Thu gọn chi tiết kiểm định" : "Xem chi tiết kiểm định & Lời giải"}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Detailed Audit Panel */}
      {isExpanded && (
        <div className="pt-3 space-y-4 border-t border-border-primary/60 text-xs fade-in-up">
          {/* Detailed Metric Radar Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 bg-bg-surface border border-border-primary/60 rounded-xl">
              <div className="text-2xs tabular-nums text-text-muted">Đúng khái niệm</div>
              <div className="text-sm tabular-nums font-bold text-text-primary">{profile.metrics.conceptCorrectness}%</div>
            </div>
            <div className="p-2.5 bg-bg-surface border border-border-primary/60 rounded-xl">
              <div className="text-2xs tabular-nums text-text-muted">Độ căn cứ</div>
              <div className="text-sm tabular-nums font-bold text-text-primary">{profile.metrics.evidenceCompleteness}%</div>
            </div>
            <div className="p-2.5 bg-bg-surface border border-border-primary/60 rounded-xl">
              <div className="text-2xs tabular-nums text-text-muted">Tính duy nhất đáp án</div>
              <div className="text-sm tabular-nums font-bold text-text-primary">{profile.metrics.answerUniqueness}%</div>
            </div>
            <div className="p-2.5 bg-bg-surface border border-border-primary/60 rounded-xl">
              <div className="text-2xs tabular-nums text-text-muted">Kiểm định lời giải</div>
              <div className="text-sm tabular-nums font-bold text-text-primary">{profile.explanationAudit.score}%</div>
            </div>
          </div>

          {/* Explanation Audit & Citations */}
          <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-3.5 space-y-2">
            <div className="font-semibold text-text-primary flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-brand-info" />
                Kiểm định lời giải & Dẫn nguồn
              </span>
              <span className="text-2xs tabular-nums text-text-muted">
                {question.sourcePdf} • Trang {question.sourcePage}
              </span>
            </div>
            <p className="text-text-muted leading-relaxed italic text-2xs">
              "{question.explanation}"
            </p>

            {profile.explanationAudit.feedback.length > 0 && (
              <div className="pt-1 text-2xs text-brand-warning space-y-0.5">
                <div className="font-bold">Góp ý cải thiện lời giải:</div>
                {profile.explanationAudit.feedback.map((f, i) => (
                  <div key={i}>• {f}</div>
                ))}
              </div>
            )}
          </div>

          {/* Versioning Metadata */}
          <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-2xs tabular-nums text-text-muted">
            <span>Ver: {profile.versionInfo.questionVersion}</span>
            <span>Generator: {profile.versionInfo.generatorVersion}</span>
            <span>KB: {profile.versionInfo.knowledgeBaseVersion}</span>
            <span>Policy: {profile.versionInfo.policyVersion}</span>
          </div>

          {/* Human Review Action Controls */}
          <div className="bg-bg-surface border border-border-primary/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-brand-info" />
                Phê duyệt chất lượng
              </span>
              <button 
                onClick={() => setShowNotesInput(!showNotesInput)}
                className="text-2xs text-brand-info hover:underline flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{showNotesInput ? "Ẩn ghi chú" : "Thêm ghi chú giảng viên"}</span>
              </button>
            </div>

            {showNotesInput && (
              <textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Nhập ghi chú biên tập hoặc lý do yêu cầu sửa đổi..."
                className="w-full h-16 p-2 bg-bg-card border border-border-primary rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-info"
              />
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => handleReviewAction("APPROVED")}
                className="px-3.5 py-1.5 bg-brand-success text-white font-medium text-xs rounded-lg hover:opacity-90 transition flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Phê duyệt</span>
              </button>

              <button
                onClick={() => handleReviewAction("NEEDS_REVISION")}
                className="px-3.5 py-1.5 bg-brand-warning text-bg-app font-medium text-xs rounded-lg hover:opacity-90 transition flex items-center gap-1 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Yêu cầu chỉnh sửa</span>
              </button>

              <button
                onClick={() => handleReviewAction("REJECTED")}
                className="px-3.5 py-1.5 bg-brand-error text-white font-medium text-xs rounded-lg hover:opacity-90 transition flex items-center gap-1 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Từ chối</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
