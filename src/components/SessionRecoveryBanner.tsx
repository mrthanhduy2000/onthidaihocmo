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

/**
 * Tên tiếng Việt của từng kiểu bài, để KHÔNG in mã chế độ ra màn hình.
 *
 * `session.examType` là mã nội bộ ("adaptive", "ai-smart", "chapter"...). Bản cũ in thẳng nó
 * vào câu tiếng Việt và còn tô đậm, nên người học đọc được nguyên văn "Hệ thống đã lưu trạng
 * thái bài thi **adaptive** của bạn". Cùng đúng họ lỗi với "Long-Term Student Evolution &
 * Memory Engine" đã dịch ở màn Trí nhớ: tên nội bộ của mã nguồn lọt ra tầng trình bày.
 *
 * types.ts khai báo 10 mã, nhưng thực tế các nơi gọi còn dùng thêm "mock-exam", "smart-exam",
 * "daily-adaptive", "retention-revision", "debt"... nên bản đồ này KHÔNG thể đầy đủ. Vì vậy
 * chỗ dùng bên dưới có dự phòng: mã lạ thì bỏ hẳn mệnh đề tên bài, chứ không in mã ra. Thà
 * thiếu một cụm chữ còn hơn hiện chữ của máy.
 */
const TEN_KIEU_BAI: Record<string, string> = {
  sequential: "làm tuần tự",
  random: "ngẫu nhiên tổng hợp",
  "ai-smart": "thi thử",
  "smart-exam": "thi thử",
  "mock-exam": "thi thử",
  mock: "thi thử",
  chapter: "theo chương",
  "chapter-strengthen": "củng cố chương",
  topic: "theo chủ đề",
  difficulty: "theo độ khó",
  incorrect: "ôn câu sai",
  debt: "ôn câu sai",
  bookmark: "câu đã đánh dấu",
  adaptive: "ôn theo điểm yếu",
  "daily-adaptive": "ôn theo điểm yếu",
  "retention-revision": "ôn lại cho nhớ lâu",
  mastery: "kiểm tra độ thạo",
  custom: "tự chọn",
};

export default function SessionRecoveryBanner({ session, onResume, onDiscard }: SessionRecoveryBannerProps) {
  const answeredCount = Object.keys(session.answers || {}).length;
  const totalCount = session.questions?.length || 0;
  const tenKieuBai = TEN_KIEU_BAI[session.examType];

  /*
    DỰNG LẠI THEO BẢN ĐO BANNER CỦA KHAN ACADEMY, 29/07/2026.

      nền          rgb(237,243,254), xanh rất nhạt
      viền TRÁI    6px đặc màu nút chính
      các cạnh kia 0
      bo góc       4px, không phải 16px
      đổ bóng      none
      chữ          14px/400, màu chữ thường

    Bản cũ: bo 16px, viền đủ bốn cạnh, có đổ bóng, tiêu đề 13px và mô tả 12px. Hệ quả đo được
    trên bản chạy thật: tiêu đề của việc quan trọng nhất trên màn (một bài đang làm dở) là chữ
    NHỎ NHẤT màn, 13px, trong khi hàng thứ cấp ngay bên dưới là 16px. Trật tự thông tin bị lộn
    ngược, và bốn cạnh viền cộng đổ bóng làm nó nặng hơn cả khối việc chính.

    Giọng văn cũng đổi. "Phát hiện phiên thi chưa hoàn thành" và "Hệ thống đã lưu trạng thái"
    là giọng hệ thống tự thuật về chính nó. Người học chỉ cần biết: còn một bài dở, dở tới đâu,
    và có làm tiếp không.
  */
  return (
    <div className="bg-brand-info-bg border-l-[6px] border-brand-info rounded-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
      <div className="flex items-start gap-3 min-w-0">
        <AlertCircle className="w-5 h-5 text-brand-info shrink-0 mt-0.5" />
        <div>
          <h4 className="text-base font-bold text-text-primary font-sans">Bạn còn một bài đang làm dở</h4>
          <p className="text-sm text-text-secondary leading-relaxed pt-0.5">
            {tenKieuBai ? `Bài ${tenKieuBai}, ` : ""}
            đã làm <strong className="text-text-primary tabular-nums">{answeredCount}</strong> trên{" "}
            <strong className="text-text-primary tabular-nums">{totalCount}</strong> câu.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          onClick={onDiscard}
          className="px-4 h-9 bg-bg-card border border-border-primary hover:border-text-muted text-text-primary text-sm rounded transition cursor-pointer flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Bỏ qua</span>
        </button>
        <button
          onClick={() => onResume(session)}
          className="px-4 h-9 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot text-sm rounded transition cursor-pointer flex items-center gap-1.5"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Làm tiếp</span>
        </button>
      </div>
    </div>
  );
}
