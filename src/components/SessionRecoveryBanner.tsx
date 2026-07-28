/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Play, RotateCcw, AlertCircle, X } from "lucide-react";
import { ExamAttempt } from "../types";

interface SessionRecoveryBannerProps {
  session: ExamAttempt;
  onResume: (session: ExamAttempt) => void;
  onDiscard: () => void;
}

export default function SessionRecoveryBanner({ session, onResume, onDiscard }: SessionRecoveryBannerProps) {
  const answeredCount = Object.keys(session.answers || {}).length;
  const totalCount = session.questions?.length || 0;

  return (
    <div className="bg-brand-info-bg border border-brand-info/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-brand-info-bg text-brand-info rounded-xl shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          {/* Cho phép xuống dòng giữa tiêu đề và chip, nhưng KHÔNG cho vỡ chữ bên trong chip.
              Trên khung 375px chip "1/10 câu đã làm" từng vỡ làm hai dòng và đè lên tiêu đề. */}
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-semibold text-text-primary">Phát hiện phiên thi chưa hoàn thành</h4>
            <span className="px-2 py-0.5 text-2xs bg-brand-info text-bg-card font-semibold rounded-full whitespace-nowrap">
              {answeredCount}/{totalCount} câu đã làm
            </span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Hệ thống đã lưu trạng thái bài thi <strong className="text-text-primary">{session.examType}</strong> của bạn. Bạn có muốn tiếp tục làm bài không?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          onClick={onDiscard}
          className="px-3 py-1.5 bg-bg-surface border border-border-primary/80 hover:bg-bg-card text-text-muted hover:text-text-primary text-xs font-medium rounded-xl transition cursor-pointer flex items-center gap-1"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Bỏ qua</span>
        </button>
        <button
          onClick={() => onResume(session)}
          className="px-4 py-1.5 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Tiếp tục làm bài</span>
        </button>
      </div>
    </div>
  );
}
