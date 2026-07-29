/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CheckCircle2, RefreshCw, Brain, Sparkles, ArrowRight } from "lucide-react";
import { DailyLearningStoryData } from "../services/learningJourneyOrchestrator";

interface DailyLearningStoryProps {
  story: DailyLearningStoryData;
  onActionNextStep?: () => void;
}

export default function DailyLearningStory({ story, onActionNextStep }: DailyLearningStoryProps) {
  return (
    <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-6 space-y-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-border-primary/60 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-info shrink-0" />
          <h3 className="text-sm font-semibold text-text-primary">Tiến trình học hôm nay</h3>
        </div>
        <span className="text-xs tabular-nums text-text-muted">Hành trình ôn tập</span>
      </div>

      {/* Progress Story Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-success-bg text-brand-success flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-text-primary">{story.solvedCountToday} câu</div>
            <div className="text-2xs text-text-muted">Đã hoàn thành</div>
          </div>
        </div>

        <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-warning-bg text-brand-warning flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-text-primary">{story.misconceptionsFixedToday} lỗi</div>
            <div className="text-2xs text-text-muted">Khắc phục hiểu sai</div>
          </div>
        </div>

        <div className="bg-bg-surface border border-border-primary/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-info-bg text-brand-info flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-text-primary">{story.conceptsRetainedToday} khái niệm</div>
            <div className="text-2xs text-text-muted">Củng cố trí nhớ</div>
          </div>
        </div>
      </div>

      {/* Proposed Next Step Callout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-surface border border-border-primary/80 rounded-xl p-3.5 text-xs">
        <div className="space-y-0.5">
          <span className="text-2xs tabular-nums text-brand-info font-bold">Gợi ý vi bước tiếp theo</span>
          <div className="font-semibold text-text-primary">{story.proposedNextStep}</div>
        </div>

        {onActionNextStep && (
          <button
            onClick={onActionNextStep}
            className="px-4 py-2 bg-nut-chinh text-white font-medium text-xs rounded-lg hover:bg-nut-chinh-re-chuot transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <span>Thực hiện ngay ({story.remainingRecommendedTimeMinutes}p)</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
