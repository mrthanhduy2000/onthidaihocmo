/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, Download, Upload, Moon, Sun, Monitor, CheckCircle2, RotateCcw, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { workspaceService } from "../services/workspaceService";
import { dbService } from "../services/db";
import { AppSettings, SubjectGoal } from "../types";
import { useTheme } from "../context/ThemeContext";
import { soThapPhan } from "../services/numberFormat";

interface ProductSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

export default function ProductSettingsModal({ isOpen, onClose, onRefreshData }: ProductSettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(() => workspaceService.getSettings());
  const { theme, setTheme } = useTheme();
  const activeSubId = dbService.getActiveSubjectId();
  const [goal, setGoal] = useState<SubjectGoal>(() => dbService.getSubjectGoal(activeSubId));
  
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleResetProgress = () => {
    dbService.clearAllHistory();
    workspaceService.clearUnfinishedSession();
    setConfirmReset(false);
    setResetDone(true);
    onRefreshData();
    setTimeout(() => setResetDone(false), 3000);
  };

  if (!isOpen) return null;

  const handleToggleSetting = (key: keyof AppSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    workspaceService.saveSettings(updated);
  };

  const handleGoalUpdate = (field: keyof SubjectGoal, val: any) => {
    const updatedGoal = { ...goal, [field]: val };
    setGoal(updatedGoal);
    dbService.saveSubjectGoal(updatedGoal);
    onRefreshData();
  };

  const handleExportJSON = () => {
    const jsonStr = workspaceService.exportBackupData();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poly_econ_learning_backup_${activeSubId}_2026.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = workspaceService.importBackupData(content);
      if (success) {
        setImportStatus("Khôi phục dữ liệu thành công!");
        onRefreshData();
      } else {
        setImportStatus("Tệp sao lưu không đúng cấu trúc!");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-bg-card border border-border-primary rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between bg-bg-surface">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-brand-info shrink-0" />
            <h3 className="text-xl font-bold text-text-primary font-sans">Cài đặt và dữ liệu học tập</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card transition cursor-pointer"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Content Tabs Body */}
        <div className="p-6 space-y-6 overflow-y-auto">

          {/* Giao diện Sáng / Tối / Theo hệ thống.
              Trước 28/07/2026 ba nút này nằm cố định trên thanh đầu trang, chiếm chỗ giữa vùng
              đắt nhất của màn hình cho một hành động vài tháng mới làm một lần, và trên khung
              375px chúng bị đẩy tràn ra ngoài. Đây mới là chỗ đúng của chúng. */}
          <div className="space-y-3">
            <h4 className="text-base font-bold text-text-primary font-sans">
Giao diện
            </h4>
            <div className="flex items-center gap-2 bg-bg-surface p-3 border border-border-primary/80 rounded-xl">
              {([
                { gia: "light", nhan: "Sáng", Icon: Sun },
                { gia: "dark", nhan: "Tối", Icon: Moon },
                { gia: "system", nhan: "Theo hệ thống", Icon: Monitor },
              ] as const).map(({ gia, nhan, Icon }) => (
                <button
                  key={gia}
                  onClick={() => setTheme(gia)}
                  aria-pressed={theme === gia}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs transition cursor-pointer border ${
                    theme === gia
                      ? "bg-bg-card text-text-primary border-border-primary font-semibold"
                      : "text-text-muted hover:text-text-primary border-transparent"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{nhan}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 1: Study Goal & Exam Config */}
          <div className="space-y-3">
            <h4 className="text-base font-bold text-text-primary font-sans">
Mục tiêu môn học hiện tại ({dbService.getActiveSubjectName()})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-bg-surface p-4 border border-border-primary/80 rounded-xl">
              <div>
                <label className="text-sm text-text-secondary block mb-1">Điểm mong muốn</label>
                {/* Có mục "Chưa đặt" và nó là mục đang chọn khi chưa đặt, xem lý do ở
                    `LearningPlannerDashboard` cùng chỗ này. */}
                <select
                  value={goal.targetScore ?? ""}
                  onChange={(e) => handleGoalUpdate("targetScore", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full bg-bg-card border border-border-primary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary"
                >
                  <option value="">Chưa đặt</option>
                  {[7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0].map(s => (
                    <option key={s} value={s}>{soThapPhan(s, 1)} điểm</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-text-secondary block mb-1">Ngày thi chính thức</label>
                <input
                  type="date"
                  value={goal.examDate ?? ""}
                  onChange={(e) => handleGoalUpdate("examDate", e.target.value || null)}
                  className="w-full bg-bg-card border border-border-primary rounded-lg px-2.5 py-1.5 text-xs tabular-nums text-text-primary"
                />
              </div>

              <div>
                <label className="text-sm text-text-secondary block mb-1">Phút học mỗi ngày</label>
                <select
                  value={goal.dailyStudyMinutes}
                  onChange={(e) => handleGoalUpdate("dailyStudyMinutes", Number(e.target.value))}
                  className="w-full bg-bg-card border border-border-primary rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary"
                >
                  {[30, 45, 60, 90, 120].map(m => (
                    <option key={m} value={m}>{m} phút/ngày</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Product Preferences */}
          <div className="space-y-3">
            <h4 className="text-base font-bold text-text-primary font-sans">
Tùy chọn trải nghiệm
            </h4>

            <div className="space-y-2">
              {[
                { key: "keyboardShortcuts", label: "Phím tắt tìm nhanh (Ctrl + K)", desc: "Mở thanh điều hướng nhanh bằng bàn phím." },
                { key: "autoSaveSession", label: "Tự động khôi phục phiên học", desc: "Lưu tạm bài thi khi bị gián đoạn tab hoặc mạng." },
                { key: "animations", label: "Hiệu ứng chuyển cảnh", desc: "Giúp thao tác có phản hồi trực quan hơn." }
              ].map(item => (
                <div key={item.key} className="p-3 bg-bg-surface border border-border-primary/80 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-text-primary block">{item.label}</span>
                    <span className="text-2xs text-text-muted">{item.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!settings[item.key as keyof AppSettings]}
                    onChange={() => handleToggleSetting(item.key as keyof AppSettings)}
                    className="w-4 h-4 cursor-pointer accent-brand-info"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Backup & Restore */}
          <div className="space-y-3">
            <h4 className="text-base font-bold text-text-primary font-sans">
Sao lưu và khôi phục dữ liệu
            </h4>

            <div className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-3">
              <p className="text-xs text-text-muted leading-relaxed">
                Xuất toàn bộ tiến trình học tập, Sổ tay câu sai, Lịch sử làm bài và Điểm dự báo ra định dạng JSON để sao lưu hoặc chuyển đổi thiết bị.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportJSON}
                  className="px-4 py-2 bg-nut-chinh text-white font-semibold text-xs rounded-xl hover:bg-nut-chinh-re-chuot transition cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Xuất tệp sao lưu</span>
                </button>

                <label className="px-4 py-2 bg-bg-card border border-border-primary hover:border-brand-info/50 text-text-primary font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-brand-info shrink-0" />
                  <span>Khôi phục từ JSON</span>
                  <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                </label>
              </div>

              {importStatus && (
                <div className="p-2.5 bg-brand-success-bg border border-brand-success/20 rounded-lg text-xs tabular-nums text-brand-success flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Làm mới tiến trình học */}
          <div className="space-y-3">
            <h4 className="text-base font-bold text-text-primary font-sans">
Làm mới tiến trình học
            </h4>

            <div className="p-4 bg-bg-surface border border-brand-warning/30 rounded-xl space-y-3">
              <p className="text-xs text-text-muted leading-relaxed">
                Xóa toàn bộ lịch sử làm bài, thống kê và phiên chưa hoàn thành của môn{" "}
                <strong className="text-text-primary">{dbService.getActiveSubjectName()}</strong> để bắt đầu lại từ đầu.
                Ngân hàng câu hỏi (kể cả câu AI đã tạo) vẫn được giữ nguyên. Hãy dùng khi số liệu bị lệch do dữ liệu cũ.
              </p>

              {resetDone ? (
                <div className="p-2.5 bg-brand-success-bg border border-brand-success/20 rounded-lg text-xs tabular-nums text-brand-success flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Đã làm mới tiến trình. Số liệu đã về 0.</span>
                </div>
              ) : confirmReset ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-brand-warning font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Chắc chắn xóa? Không thể hoàn tác.
                  </span>
                  <button
                    onClick={handleResetProgress}
                    className="px-3.5 py-1.5 bg-brand-error text-white text-xs font-semibold rounded-xl hover:opacity-90 transition cursor-pointer"
                  >
                    Xóa và làm mới
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-3.5 py-1.5 bg-bg-card border border-border-primary text-xs rounded-xl cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="px-4 py-2 bg-bg-card border border-brand-warning/40 text-brand-warning font-semibold text-xs rounded-xl hover:bg-brand-warning-bg transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>Làm mới tiến trình môn này</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border-primary bg-bg-surface flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-nut-chinh text-white text-xs font-semibold rounded-xl hover:bg-nut-chinh-re-chuot transition cursor-pointer"
          >
            Đóng cài đặt
          </button>
        </div>

      </div>
    </div>
  );
}
