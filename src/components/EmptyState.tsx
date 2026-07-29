/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

/*
  TRẠNG THÁI RỖNG DÙNG CHUNG, DỰNG LẠI TỪ ĐẦU 29/07/2026.

  VÌ SAO PHẢI DỰNG LẠI CHỨ KHÔNG VÁ. Đo trên mã nguồn cùng ngày:

    32   nhánh `length === 0` rải trên 15 file
     1   chỗ dùng component này
     9   file dùng CHỮ NGHIÊNG cho trạng thái rỗng
     3   file dùng viền đứt kèm icon tròn

  Tức là mỗi màn tự viết một kiểu, và component dùng chung thì gần như không ai gọi. Bản cũ của
  chính nó cũng là mẫu đã bị loại ở mọi nơi khác: thẻ bo 16px có viền, icon lucide 24px đặt
  trong một ô bo tròn 48px, tiêu đề 16px, mô tả 12px.

  Hệ quả với người học: mở app lần đầu, mỗi màn nói "chưa có gì" bằng một giọng khác nhau, và
  không màn nào nói phải làm gì tiếp.

  BẢN ĐO TRÊN KHAN cho khối "chưa có gì" (trang khoá học, người chưa học):

    tiêu đề   20px/700, và là một CÂU MỆNH LỆNH nói việc cần làm
              ("Bắt đầu tăng cấp độ tích lũy kỹ năng...")
    mô tả     14px/400, cùng màu chữ chính
    nút       156x32px, bo 4px, chữ 14px
    khung     KHÔNG có. Không viền, không nền, không bóng, không icon tròn

  Điểm quan trọng nhất là tiêu đề: Khan không mô tả tình trạng ("Chưa có dữ liệu"), họ nói việc
  cần làm. Một màn rỗng là lúc người học cần chỉ dẫn nhất, mà mô tả tình trạng thì không chỉ
  dẫn gì cả.

  HAI CẤP, vì không phải chỗ rỗng nào cũng ngang nhau:

    `EmptyState`     cả một màn hoặc một khối lớn không có gì. Có tiêu đề, mô tả, nút.
    `DongTrong`      một dòng trong bảng hoặc danh sách nhỏ. Chỉ một câu chữ thường.

  Cấp hai tồn tại để chống đúng cái đã xảy ra: khi component dùng chung quá nặng cho chỗ nhỏ,
  người ta thôi dùng nó và tự viết một dòng `italic` tại chỗ.
*/

interface EmptyStateProps {
  /** Câu MỆNH LỆNH nói việc cần làm, không phải mô tả tình trạng. Hiện ở 20px/700. */
  title: string;
  /** Một tới hai câu giải thích khối này sẽ có gì sau khi người học bắt đầu. */
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Hình khối phẳng tự vẽ, chỉ dùng cho trạng thái rỗng của cả một màn. */
  illustration?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  illustration,
}: EmptyStateProps) {
  return (
    <div className="py-10 max-w-[42rem] space-y-3">
      {illustration && <div className="pb-2">{illustration}</div>}

      <h3 className="text-xl font-bold text-text-primary font-sans">{title}</h3>

      <p className="text-sm text-text-secondary font-sans leading-relaxed">{description}</p>

      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            onClick={onAction}
            className="px-4 h-9 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot text-sm rounded transition cursor-pointer"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Trạng thái rỗng cấp DÒNG, cho một bảng hoặc danh sách nhỏ nằm bên trong màn.
 *
 * Thay cho thói quen viết `<p className="text-sm text-text-muted italic">Chưa có...</p>` rải rác
 * ở 9 file. Chữ nghiêng bị bỏ vì tiếng Việt có dấu nghiêng rất khó đọc, và vì Khan không dùng
 * chữ nghiêng ở đâu trong giao diện của họ.
 */
export function DongTrong({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-4 text-sm text-text-secondary font-sans leading-relaxed">{children}</p>
  );
}
