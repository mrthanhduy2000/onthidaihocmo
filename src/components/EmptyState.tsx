/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CheckCircle2, Inbox, Bookmark, Sparkles, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  type?: "no-incorrect" | "no-data" | "no-bookmarks" | "generic";
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  type = "generic",
  title,
  description,
  actionLabel,
  onAction
}: EmptyStateProps) {
  let defaultTitle = "Chưa có dữ liệu";
  let defaultDescription = "Hãy hoàn thành bài luyện tập để hệ thống ghi nhận.";
  let Icon = Inbox;

  if (type === "no-incorrect") {
    defaultTitle = "Bạn chưa có câu làm sai nào!";
    defaultDescription = "Tuyệt vời! Tất cả các câu bạn đã làm đều chính xác hoặc đã được củng cố hoàn toàn.";
    Icon = CheckCircle2;
  } else if (type === "no-data") {
    defaultTitle = "Bắt đầu hành trình học tập của bạn";
    defaultDescription = "Hãy hoàn thành phiên học đầu tiên để hệ thống kích hoạt Sơ đồ tri thức & Trí nhớ cá nhân.";
    Icon = Sparkles;
  } else if (type === "no-bookmarks") {
    defaultTitle = "Chưa có câu hỏi được đánh dấu";
    defaultDescription = "Trong lúc làm bài, bấm biểu tượng Đánh dấu để lưu lại những câu cần xem lại sau.";
    Icon = Bookmark;
  }

  const finalTitle = title || defaultTitle;
  const finalDescription = description || defaultDescription;

  return (
    <div className="bg-bg-card border border-border-primary/80 rounded-2xl p-8 text-center space-y-4 max-w-lg mx-auto my-6">
      <div className="w-12 h-12 rounded-2xl bg-bg-surface border border-border-primary flex items-center justify-center mx-auto text-text-muted">
        <Icon className="w-6 h-6 text-brand-info" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-display font-medium text-text-primary">
          {finalTitle}
        </h3>
        <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
          {finalDescription}
        </p>
      </div>

      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            onClick={onAction}
            className="px-5 py-2.5 bg-text-primary text-bg-card font-medium text-xs rounded-xl hover:opacity-95 transition inline-flex items-center gap-2 cursor-pointer"
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
