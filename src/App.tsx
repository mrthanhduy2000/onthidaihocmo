/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Play, RotateCcw, BarChart3, Brain,
  GraduationCap, Flame, Award, Target,
  FolderKanban, Command, Settings as SettingsIcon
} from "lucide-react";
import Dashboard from "./components/Dashboard";
import PracticeCenterView from "./components/PracticeCenterView";
import ReviewNotebookView from "./components/ReviewNotebookView";
import StatsView from "./components/StatsView";
import AIHub from "./components/AIHub";
import AcademicQualityDashboard from "./components/AcademicQualityDashboard";
import CurriculumDashboard from "./components/CurriculumDashboard";
import LearningPlannerDashboard from "./components/LearningPlannerDashboard";
import PersonalWorkspaceView from "./components/PersonalWorkspaceView";
import { LearningObservatoryView } from "./components/LearningObservatoryView";
import SessionRecoveryBanner from "./components/SessionRecoveryBanner";
import GlobalCommandPalette from "./components/GlobalCommandPalette";
import QuickActionFAB from "./components/QuickActionFAB";
import ProductSettingsModal from "./components/ProductSettingsModal";
import { dbService } from "./services/db";
import { workspaceService } from "./services/workspaceService";
import { ExamAttempt, UserSettings } from "./types";
import { aiService } from "./services/ai";

/**
 * Các điểm đến chính, khai báo MỘT LẦN rồi dùng cho cả thanh trên máy tính lẫn thanh dưới trên
 * điện thoại.
 *
 * Vì sao phải gộp: trước 28/07/2026 hai thanh được viết tay riêng biệt và đã trôi ra khác nhau,
 * đo được trên bản chạy thật: máy tính có 7 mục, điện thoại có 6 mục, khác cả thứ tự lẫn nhãn
 * ("Câu sai" bên này thành "Sổ câu sai" bên kia). Người học đổi thiết bị là phải học lại đường
 * đi, còn ứng dụng thì tự mâu thuẫn với chính nó.
 *
 * Mục "Tổng quan" đã rút khỏi thanh vì trùng vai trò với "Bàn học"; nó vẫn mở được từ ô Tìm
 * nhanh, đúng cách các màn công cụ quản trị đang làm.
 */
const DIEM_DEN = [
  { view: "workspace", nhan: "Bàn học", Icon: FolderKanban },
  { view: "practice", nhan: "Luyện câu", Icon: Play },
  { view: "review", nhan: "Câu sai", Icon: RotateCcw },
  { view: "forecast", nhan: "Kế hoạch", Icon: Target },
  { view: "ai_coach", nhan: "Hỏi AI", Icon: Brain },
  { view: "progress", nhan: "Báo cáo", Icon: BarChart3 },
] as const;

export default function App() {
  const [currentView, setCurrentView] = useState<"workspace" | "home" | "practice" | "review" | "progress" | "ai_coach" | "quality_dashboard" | "curriculum" | "forecast" | "observatory">("workspace");
  const [activeExam, setActiveExam] = useState<ExamAttempt | null>(null);
  const [stats, setStats] = useState(dbService.getStatistics());
  const [activeSubjectId, setActiveSubjectId] = useState(dbService.getActiveSubjectId());

  // Modals & Banners state
  const [unfinishedSession, setUnfinishedSession] = useState<ExamAttempt | null>(() => workspaceService.getUnfinishedSession());
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load latest statistics when switching views
  useEffect(() => {
    setStats(dbService.getStatistics());
    setUnfinishedSession(workspaceService.getUnfinishedSession());
  }, [currentView, activeSubjectId]);

  useEffect(() => {
    const handleExamSubmitted = () => {
      setStats(dbService.getStatistics());
      setUnfinishedSession(null);
    };
    window.addEventListener("poly_econ_exam_submitted", handleExamSubmitted);
    return () => window.removeEventListener("poly_econ_exam_submitted", handleExamSubmitted);
  }, []);

  const handleSubjectChange = (subjectId: string) => {
    dbService.setActiveSubjectId(subjectId);
    setActiveSubjectId(subjectId);
    setStats(dbService.getStatistics());
  };

  const handleStartExam = (exam: ExamAttempt) => {
    setActiveExam(exam);
    setCurrentView("practice");
    // Chỉ lưu vào PHIÊN chưa hoàn thành khi bắt đầu; KHÔNG ghi vào lịch sử.
    // Lịch sử chỉ nhận bài đã nộp (khi submit), tránh để lại "bài dở" treo mãi.
    workspaceService.saveUnfinishedSession(exam);
  };

  const handleResumeSession = (session: ExamAttempt) => {
    setActiveExam(session);
    setCurrentView("practice");
  };

  const handleDiscardSession = () => {
    workspaceService.clearUnfinishedSession();
    setUnfinishedSession(null);
  };

  const handleNavigateHome = () => {
    setActiveExam(null);
    setCurrentView("workspace");
  };

  const isDeepFocus = activeExam !== null && !activeExam.isSubmitted;

  return (
    <div className="min-h-screen bg-bg-app text-text-primary font-sans transition-colors duration-200">
      
      {/* Top compact system-like high-density header - hidden during Deep Focus Mode */}
      {!isDeepFocus && (
        <header className="sticky top-0 z-40 bg-bg-card/90 backdrop-blur-md border-b border-border-primary/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
            
            {/* Logo & Subject Selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 cursor-pointer" onClick={handleNavigateHome}>
                <div className="w-7 h-7 rounded-lg bg-text-primary flex items-center justify-center text-bg-card shadow-sm transition hover:opacity-95">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="font-display font-medium text-xs tracking-wider text-text-primary hidden sm:inline-block">
                  ÔN THI ĐẠI HỌC MỞ
                </span>
              </div>
              
              <div className="h-4 w-[1px] bg-border-primary/80" />
              
              <select
                value={activeSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="bg-bg-surface hover:bg-bg-surface-hover text-text-primary border border-border-primary rounded-md px-2 py-1 text-[11px] font-sans font-medium cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-text-primary/10 max-w-[130px] sm:max-w-[220px] truncate"
              >
                {dbService.getSubjects().map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

          {/* Thanh điều hướng chính, dựng từ DIEM_DEN nên luôn khớp với thanh dưới trên điện thoại. */}
          <nav className="hidden md:flex items-center gap-1">
            {DIEM_DEN.map(({ view, nhan, Icon }) => {
              const dangMo = currentView === view;
              return (
                <button
                  key={view}
                  onClick={() => { setActiveExam(null); setCurrentView(view as any); }}
                  aria-current={dangMo ? "page" : undefined}
                  className={`px-3 py-1.5 text-xs rounded-md transition flex items-center gap-1.5 whitespace-nowrap ${
                    dangMo
                      ? "bg-bg-surface text-text-primary border border-border-primary font-semibold"
                      : "text-text-muted hover:text-text-primary hover:bg-bg-surface/50 font-medium border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{nhan}</span>
                </button>
              );
            })}
            {/* Các màn công cụ quản trị (khung chương trình, kiểm tra học liệu, nhật ký hệ thống)
                và màn Tổng quan mở được qua ô Tìm nhanh (Ctrl + K). */}
          </nav>

          {/* Cụm phải: chỉ giữ thứ dùng thường xuyên.
              Bộ chọn giao diện Sáng/Tối/Hệ thống đã chuyển vào Cài đặt: nó chiếm ba nút ngay
              giữa thanh trên cùng cho một hành động vài tháng mới làm một lần, và chính nó là
              thủ phạm làm trang TRÀN NGANG 122px trên khung 375px.
              Chuỗi ngày và tỷ lệ đúng chỉ hiện khi ĐÃ CÓ dữ liệu: hiện "0 ngày, 0%" cho người
              mới mở ứng dụng vừa là nhiễu vừa là lời chào nản lòng. */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="px-2 py-1 bg-bg-surface border border-border-primary hover:border-brand-info/40 rounded-md text-[11px] font-mono text-text-muted hover:text-text-primary flex items-center gap-1 transition cursor-pointer"
              title="Mở tìm nhanh (Ctrl + K)"
            >
              <Command className="w-3 h-3 text-brand-info" />
              <span className="hidden lg:inline">Tìm nhanh</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 bg-bg-surface border border-border-primary hover:border-brand-info/40 rounded-md text-text-muted hover:text-text-primary transition cursor-pointer"
              title="Cài đặt, giao diện và sao lưu"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>

            {(stats.studyStreak > 0 || stats.totalSolved > 0) && (
              <>
                <div className="h-4 w-[1px] bg-border-primary/85 hidden lg:block" />
                <div className="hidden lg:flex items-center gap-3 text-xs">
                  {stats.studyStreak > 0 && (
                    <div className="flex items-center gap-1 text-brand-warning font-medium" title="Chuỗi ngày học tập">
                      <Flame className="w-3.5 h-3.5 fill-current" />
                      <span>{stats.studyStreak} ngày</span>
                    </div>
                  )}
                  {stats.totalSolved > 0 && (
                    <div className="flex items-center gap-1 text-brand-success font-medium" title="Tỷ lệ làm đúng">
                      <Award className="w-3.5 h-3.5" />
                      <span>{Math.round((stats.totalCorrect / stats.totalSolved) * 100)}%</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </header>
      )}

      {/* Thanh điều hướng trên điện thoại. Nằm ở ĐÁY màn hình cho vừa tầm ngón cái, và dựng
          từ cùng một DIEM_DEN với thanh trên máy tính nên không thể trôi ra khác nhau nữa.
          Bản cũ dán nó ngay dưới header, ăn mất hai dải cố định ở đỉnh màn hình. */}
      {!isDeepFocus && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg-card/95 backdrop-blur-md border-t border-border-primary pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-stretch justify-around">
            {DIEM_DEN.map(({ view, nhan, Icon }) => {
              const dangMo = currentView === view;
              return (
                <button
                  key={view}
                  onClick={() => { setActiveExam(null); setCurrentView(view as any); }}
                  aria-current={dangMo ? "page" : undefined}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition ${
                    dangMo ? "text-brand-info font-semibold" : "text-text-muted"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] leading-none whitespace-nowrap">{nhan}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Main workspace */}
      <main className="min-h-[calc(100vh-3rem)] pb-20 md:pb-0">
        {/* Session Recovery Banner */}
        {!isDeepFocus && unfinishedSession && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <SessionRecoveryBanner
              session={unfinishedSession}
              onResume={handleResumeSession}
              onDiscard={handleDiscardSession}
            />
          </div>
        )}

        {currentView === "workspace" && (
          <PersonalWorkspaceView
            key={activeSubjectId}
            onStartExam={(type, param) => {
              if (param) {
                handleStartExam(param);
              } else {
                const exam = aiService.generateExam({ type: type as any, count: 10 });
                handleStartExam(exam);
              }
            }}
            onNavigateView={(view) => setCurrentView(view as any)}
          />
        )}

        {currentView === "home" && (
          <Dashboard 
            key={activeSubjectId}
            onStartExam={handleStartExam} 
            onNavigate={(view: any) => setCurrentView(view === "ai" ? "ai_coach" : view === "stats" ? "progress" : view)} 
            onSubjectChange={handleSubjectChange}
          />
        )}
        {currentView === "practice" && (
          <PracticeCenterView 
            key={activeSubjectId}
            activeExam={activeExam}
            onStartExam={handleStartExam} 
            onNavigateHome={handleNavigateHome} 
          />
        )}
        {currentView === "review" && (
          <ReviewNotebookView 
            key={activeSubjectId}
            onStartExam={handleStartExam}
          />
        )}
        {currentView === "progress" && (
          <StatsView key={activeSubjectId} />
        )}
        {currentView === "forecast" && (
          <LearningPlannerDashboard 
            key={activeSubjectId}
            onStartExam={(type, param) => {
              if (param) {
                handleStartExam(param);
              } else {
                const exam = aiService.generateExam({ type: type as any, count: 10 });
                handleStartExam(exam);
              }
            }}
            onNavigateHome={handleNavigateHome}
          />
        )}
        {currentView === "ai_coach" && (
          <AIHub 
            key={activeSubjectId}
            onStartExam={handleStartExam} 
          />
        )}
        {currentView === "quality_dashboard" && (
          <AcademicQualityDashboard key={activeSubjectId} />
        )}
        {currentView === "curriculum" && (
          <CurriculumDashboard 
            key={activeSubjectId}
            onStartExam={handleStartExam}
            onNavigate={(view) => setCurrentView(view as any)}
          />
        )}
        {currentView === "observatory" && (
          <LearningObservatoryView key={activeSubjectId} />
        )}
      </main>

      {/* Floating Quick Action Button (+) */}
      {!isDeepFocus && (
        <QuickActionFAB
          onNavigate={(view, param) => {
            if (param) {
              const exam = aiService.generateExam({ type: param.type || "adaptive", count: 10 });
              handleStartExam(exam);
            } else {
              setCurrentView(view as any);
            }
          }}
          onOpenUpload={() => setCurrentView("workspace")}
          onOpenSearch={() => setCurrentView("workspace")}
        />
      )}

      {/* Global Command Palette Modal (Ctrl + K) */}
      <GlobalCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(view, param) => {
          if (param) {
            const exam = aiService.generateExam({ type: param.type || "adaptive", count: 10 });
            handleStartExam(exam);
          } else {
            setCurrentView(view as any);
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSearch={() => setCurrentView("workspace")}
      />

      {/* Product Settings & Backup Modal */}
      <ProductSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRefreshData={() => {
          setStats(dbService.getStatistics());
        }}
      />

      {/* Footer */}
      {!isDeepFocus && (
        <footer className="border-t border-border-primary bg-bg-card py-4 text-center">
          <p className="text-xs text-text-muted tracking-wide font-sans">
            Trợ lý ôn thi • {dbService.getActiveSubjectName()}
          </p>
        </footer>
      )}

    </div>
  );
}
