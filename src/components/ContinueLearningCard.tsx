/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Play, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { ExamAttempt } from "../types";

interface ContinueLearningCardProps {
  exam: ExamAttempt;
  onContinue: (examId: string) => void;
}

/* Nhãn tiếng Việt cho các loại phiên luyện tập của engine. Chỉ là lớp dịch khi hiển thị. */
/*
  Bảng này phải phủ HẾT mọi giá trị khai trong `ExamAttempt["examType"]`, vì dòng dưới in thẳng mã
  nội bộ khi tra không ra. Đo được ngày 13/08/2026: loại `due` thêm ở Giai đoạn 3 không có nhãn,
  nên người học đang đọc được chữ "due" nguyên văn trên thẻ tiếp tục học. Phép kiểm AO6 canh cả họ
  này để loại thêm sau không lặp lại.
*/
const NHAN_LOAI_PHIEN: Record<string, string> = {
  sequential: "thứ tự gốc",
  random: "ngẫu nhiên",
  adaptive: "thích ứng",
  "ai-smart": "thi thử",
  chapter: "theo chương",
  topic: "theo chủ đề",
  difficulty: "theo độ khó",
  incorrect: "ôn câu sai",
  bookmark: "câu đã đánh dấu",
  custom: "tự chọn",
  due: "ôn khái niệm tới hạn",
  recall: "nhớ lại chủ động",
  mock: "thi thử",
};

export default function ContinueLearningCard({ exam, onContinue }: ContinueLearningCardProps) {
  const answeredCount = Object.keys(exam.answers || {}).length;
  const totalCount = exam.questions.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const remainingCount = totalCount - answeredCount;
  const estMinutes = Math.max(Math.ceil(remainingCount * 1.2), 2);

  return (
    <div className="bg-bg-card border border-brand-info/40 rounded-2xl p-5 shadow-sm space-y-4 hover:border-brand-info/60 transition">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tabular-nums text-brand-info font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Phiên học đang diễn ra • Học tiếp</span>
        </div>
        <span className="text-xs tabular-nums text-text-muted flex items-center gap-1">
          <Clock className="w-4 h-4 shrink-0" />
          <span>Còn ~{estMinutes} phút</span>
        </span>
      </div>

      <div className="space-y-2">
        {/*
          `.toUpperCase()` trên giá trị liệt kê của engine in ra "ADAPTIVE" / "AI-SMART" ngay
          trong tiêu đề thẻ. Dịch khi hiển thị, có nhánh dự phòng giữ giá trị gốc nếu engine
          thêm loại đề mới.
        */}
        <h3 className="text-lg font-display font-light text-text-primary">
          Tiếp tục phiên luyện tập ({NHAN_LOAI_PHIEN[exam.examType] ?? exam.examType})
        </h3>
        <p className="text-xs text-text-muted">
          Bạn đã trả lời <strong className="text-text-primary tabular-nums">{answeredCount}/{totalCount} câu</strong> ({progressPct}% tiến độ). Dữ liệu đã được lưu tự động.
        </p>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-bg-surface border border-border-primary/60 rounded-full overflow-hidden">
          <div 
            className="h-full bg-brand-info rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="pt-1 flex justify-end">
        <button
          onClick={() => onContinue(exam.id)}
          className="px-5 py-2.5 bg-brand-info text-white font-medium text-xs rounded-xl shadow-sm hover:opacity-95 transition flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current shrink-0" />
          <span>Tiếp tục làm bài ({answeredCount}/{totalCount})</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}
