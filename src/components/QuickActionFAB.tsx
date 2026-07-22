/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Plus, 
  Play, 
  RotateCcw, 
  Brain, 
  Layers, 
  Search, 
  Upload, 
  Bookmark, 
  X,
  Target
} from "lucide-react";

interface QuickActionFABProps {
  onNavigate: (view: string, actionParam?: any) => void;
  onOpenUpload: () => void;
  onOpenSearch: () => void;
}

export default function QuickActionFAB({ onNavigate, onOpenUpload, onOpenSearch }: QuickActionFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      label: "Ôn theo điểm yếu",
      icon: Play,
      color: "bg-brand-info text-bg-card",
      onClick: () => { onNavigate("practice", { type: "adaptive" }); setIsOpen(false); }
    },
    {
      label: "Sửa câu sai",
      icon: RotateCcw,
      color: "bg-brand-warning text-bg-card",
      onClick: () => { onNavigate("review"); setIsOpen(false); }
    },
    {
      label: "Kế hoạch điểm",
      icon: Target,
      color: "bg-brand-success text-bg-card",
      onClick: () => { onNavigate("forecast"); setIsOpen(false); }
    },
    {
      label: "Hỏi trợ lý AI",
      icon: Brain,
      color: "bg-text-primary text-bg-card",
      onClick: () => { onNavigate("ai_coach"); setIsOpen(false); }
    },
    {
      label: "Tra cứu khái niệm",
      icon: Search,
      color: "bg-bg-card border border-border-primary text-text-primary",
      onClick: () => { onOpenSearch(); setIsOpen(false); }
    },
    {
      label: "Thêm tài liệu",
      icon: Upload,
      color: "bg-bg-card border border-border-primary text-text-primary",
      onClick: () => { onOpenUpload(); setIsOpen(false); }
    }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* Quick Menu items */}
      {isOpen && (
        <div className="flex flex-col items-end gap-2 mb-2 animate-fade-in">
          {actions.map((act, idx) => {
            const Icon = act.icon;
            return (
              <button
                key={idx}
                onClick={act.onClick}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg hover:scale-105 transition cursor-pointer bg-bg-card border border-border-primary text-text-primary hover:border-brand-info/50"
              >
                <span>{act.label}</span>
                <div className={`p-1.5 rounded-lg ${act.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
          isOpen 
            ? "bg-bg-card border-2 border-border-primary text-text-primary rotate-45" 
            : "bg-text-primary text-bg-card hover:scale-110"
        }`}
        title="Mở thao tác nhanh"
      >
        <Plus className="w-6 h-6 transition-transform" />
      </button>
    </div>
  );
}
