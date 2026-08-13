/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Search, LayoutDashboard, Play, RotateCcw, Target, Brain, BookOpen, Layers, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { learnerModelService } from "../services/learnerModel";

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string, actionParam?: any) => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
}

export default function GlobalCommandPalette({ 
  isOpen, 
  onClose, 
  onNavigate, 
  onOpenSettings,
  onOpenSearch
}: GlobalCommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /**
   * Hàng đợi ôn hôm nay, đọc để biết có mục nào đáng đưa vào ô tìm nhanh không.
   *
   * Chỉ hiện khi thật sự có khái niệm tới hạn. Một mục "Ôn 0 khái niệm tới hạn" vừa vô dụng vừa
   * làm người học tưởng hệ thống đang giục.
   */
  const hangDoiOn = learnerModelService.layKhaiNiemToiHan();

  const commands = [
    ...(hangDoiOn.danhSach.length > 0 ? [{
      id: "cmd_on_toi_han",
      category: "Luyện tập",
      title: `Ôn ${hangDoiOn.danhSach.length} khái niệm tới hạn${hangDoiOn.xepTheoNgayThi ? " (xếp theo lợi cho ngày thi)" : ""}`,
      icon: Play,
      action: () => { onNavigate("practice", { type: "due" }); onClose(); }
    }] : []),
    {
      id: "cmd_practice_adaptive",
      category: "Luyện tập",
      title: "Ôn theo điểm yếu",
      icon: Play,
      action: () => { onNavigate("practice", { type: "adaptive" }); onClose(); }
    },
    {
      id: "cmd_review_notebook",
      category: "Sổ tay ôn tập",
      title: "Mở sổ câu sai",
      icon: RotateCcw,
      action: () => { onNavigate("review"); onClose(); }
    },
    {
      // Màn Tổng quan đã rút khỏi thanh điều hướng vì trùng vai trò với Bàn học, nên phải có
      // đường vào ở đây. Rút khỏi thanh mà quên mở lối khác là làm mất hẳn một màn hình.
      id: "cmd_home_overview",
      category: "Tổng quan",
      title: "Mở màn Tổng quan",
      icon: LayoutDashboard,
      action: () => { onNavigate("home"); onClose(); }
    },
    {
      id: "cmd_forecast",
      category: "Dự báo & Kế hoạch",
      title: "Xem kế hoạch đạt điểm mục tiêu",
      icon: Target,
      action: () => { onNavigate("forecast"); onClose(); }
    },
    {
      id: "cmd_ai_coach",
      category: "Trợ lý AI",
      title: "Hỏi trợ lý học tập",
      icon: Brain,
      action: () => { onNavigate("ai_coach"); onClose(); }
    },
    {
      id: "cmd_search_kb",
      category: "Tra cứu",
      title: "Tìm khái niệm hoặc câu hỏi",
      icon: Search,
      action: () => { onOpenSearch(); onClose(); }
    },
    {
      id: "cmd_mock_exam",
      category: "Thi thử",
      title: "Tạo bài thi thử",
      icon: Layers,
      action: () => { onNavigate("practice", { type: "ai-smart" }); onClose(); }
    },
    {
      id: "cmd_observatory",
      category: "Công cụ hệ thống",
      title: "Xem nhật ký chất lượng hệ thống",
      icon: Sparkles,
      action: () => { onNavigate("observatory"); onClose(); }
    },
    {
      id: "cmd_quality_dashboard",
      category: "Công cụ",
      title: "Xem và sửa câu hỏi có vấn đề",
      icon: Sparkles,
      action: () => { onNavigate("quality_dashboard"); onClose(); }
    },
    {
      id: "cmd_recall_session",
      category: "Ôn tập",
      title: "Ôn bằng cách viết lại (nhớ lại chủ động)",
      icon: BookOpen,
      action: () => { onNavigate("recall_session"); onClose(); }
    },
    {
      id: "cmd_curriculum",
      category: "Chương trình",
      title: "Xem Ma trận Đề thi & Khung Chương trình",
      icon: BookOpen,
      action: () => { onNavigate("curriculum"); onClose(); }
    },
    {
      id: "cmd_settings",
      category: "Cài đặt và sao lưu",
      title: "Mở cài đặt, lịch thi và sao lưu dữ liệu",
      icon: SettingsIcon,
      action: () => { onOpenSettings(); onClose(); }
    }
  ];

  const filtered = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase()) || 
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-fade-in">
      <div className="bg-bg-card border border-border-primary rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden space-y-0">
        
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-primary bg-bg-surface">
          <Search className="w-4 h-4 text-brand-info shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gõ việc cần làm, ví dụ: ôn, câu sai, thi thử..."
            className="w-full bg-transparent text-xs font-medium text-text-primary focus:outline-none placeholder:text-text-muted"
          />
          <span className="px-1.5 py-0.5 bg-bg-card border border-border-primary rounded text-2xs tabular-nums text-text-muted shrink-0">
            ESC
          </span>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 divide-y divide-border-primary/40">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted tabular-nums">
              Không tìm thấy lệnh nào phù hợp với "{query}"
            </div>
          ) : (
            filtered.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className="w-full p-2.5 rounded-xl hover:bg-bg-surface flex items-center justify-between text-left transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-bg-surface border border-border-primary group-hover:border-brand-info/40 rounded-lg text-text-muted group-hover:text-brand-info transition">
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <div>
                      <span className="text-2xs tabular-nums text-text-muted block">{cmd.category}</span>
                      <span className="text-xs font-semibold text-text-primary group-hover:text-brand-info transition">{cmd.title}</span>
                    </div>
                  </div>
                  <span className="text-2xs tabular-nums text-text-muted group-hover:text-text-primary transition">
                    Enter &rarr;
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Palette Footer */}
        <div className="p-3 bg-bg-surface border-t border-border-primary flex items-center justify-between text-2xs tabular-nums text-text-muted">
          <span>Chọn nhanh việc muốn làm</span>
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-bg-card border border-border-primary rounded">Ctrl + K</span>
            <span>để mở/đóng</span>
          </div>
        </div>

      </div>
    </div>
  );
}
