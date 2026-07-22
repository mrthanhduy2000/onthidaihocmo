/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Play, RotateCcw, BarChart3, Brain, 
  Sun, Moon, Monitor, GraduationCap, Flame, Award, Target,
  FolderKanban, Command, Settings as SettingsIcon, Search, LogOut
} from "lucide-react";
import { supabase } from "./services/supabaseClient";
import { cloudSync } from "./services/cloudSync";
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
import { useTheme } from "./context/ThemeContext";
import { ExamAttempt, UserSettings } from "./types";
import { aiService } from "./services/ai";

export default function App() {
  const [currentView, setCurrentView] = useState<"workspace" | "home" | "practice" | "review" | "progress" | "ai_coach" | "quality_dashboard" | "curriculum" | "forecast" | "observatory">("workspace");
  const [activeExam, setActiveExam] = useState<ExamAttempt | null>(null);
  const [stats, setStats] = useState(dbService.getStatistics());
  const [activeSubjectId, setActiveSubjectId] = useState(dbService.getActiveSubjectId());
  const { theme, setTheme } = useTheme();

  // Modals & Banners state
  const [unfinishedSession, setUnfinishedSession] = useState<ExamAttempt | null>(() => workspaceService.getUnfinishedSession());
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSearchInWorkspace, setShowSearchInWorkspace] = useState(false);

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

          {/* Journey-First Navigation Menu */}
          <nav className="hidden md:flex items-center gap-1">
            <button 
              onClick={() => { setActiveExam(null); setCurrentView("workspace"); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                currentView === "workspace"
                  ? "bg-bg-surface text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary font-semibold" 
                  : "text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 text-brand-info" />
              <span>Bàn học</span>
            </button>

            <button 
              onClick={() => { setActiveExam(null); setCurrentView("home"); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                currentView === "home"
                  ? "bg-bg-surface text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary" 
                  : "text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Tổng quan</span>
            </button>

            <button 
              onClick={() => { setActiveExam(null); setCurrentView("practice"); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                currentView === "practice"
                  ? "bg-bg-surface text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary" 
                  : "text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Luyện câu</span>
            </button>

            <button 
              onClick={() => { setActiveExam(null); setCurrentView("review"); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                currentView === "review"
                  ? "bg-bg-surface text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary" 
                  : "text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-brand-warning" />
              <span>Câu sai</span>
            </button>

            <button 
              onClick={() => { setActiveExam(null); setCurrentView("forecast"); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                currentView === "forecast"
                  ? "bg-bg-surface text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary" 
                  : "text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
              }`}
            >
              <Target className="w-3.5 h-3.5 text-brand-info" />
              <span>Kế hoạch</span>
            </button>

            <button 
              onClick={() => { setActiveExam(null); setCurrentView("ai_coach"); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                currentView === "ai_coach"
                  ? "bg-bg-surface text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary" 
                  : "text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-brand-info" />
              <span>Hỏi AI</span>
            </button>

            <button
              onClick={() => { setActiveExam(null); setCurrentView("progress"); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                currentView === "progress"
                  ? "bg-bg-surface text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] border border-border-primary"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-surface/50"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-brand-info" />
              <span>Báo cáo</span>
            </button>
            {/* Các màn công cụ quản trị (khung chương trình, kiểm tra học liệu, nhật ký hệ thống)
                đã được ẩn khỏi thanh điều hướng người học cho gọn; vẫn mở được qua ô Tìm nhanh (Ctrl + K). */}
          </nav>

          {/* Quick stats & Theme & Command Palette trigger */}
          <div className="flex items-center gap-3">
            {/* Ctrl + K Command Palette Button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="px-2 py-1 bg-bg-surface border border-border-primary hover:border-brand-info/40 rounded-md text-[11px] font-mono text-text-muted hover:text-text-primary flex items-center gap-1 transition cursor-pointer"
              title="Mở tìm nhanh (Ctrl + K)"
            >
              <Command className="w-3 h-3 text-brand-info" />
              <span className="hidden sm:inline">Tìm nhanh</span>
            </button>

            {/* Settings Modal Trigger Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 bg-bg-surface border border-border-primary hover:border-brand-info/40 rounded-md text-text-muted hover:text-text-primary transition cursor-pointer"
              title="Cài đặt và sao lưu"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>

            {/* Sign-out Button */}
            {supabase && (
              <button
                onClick={async () => {
                  await cloudSync.push();
                  await supabase.auth.signOut();
                }}
                className="p-1.5 bg-bg-surface border border-border-primary hover:border-brand-danger/40 rounded-md text-text-muted hover:text-brand-danger transition cursor-pointer"
                title="Đăng xuất (đã lưu dữ liệu lên đám mây)"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="h-4 w-[1px] bg-border-primary/85 hidden sm:block" />
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-brand-warning font-medium font-mono" title="Chuỗi ngày học tập">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>{stats.studyStreak} ngày</span>
              </div>
              <div className="h-4 w-[1px] bg-border-primary/85" />
              <div className="flex items-center gap-1 text-brand-success font-medium font-mono" title="Tỷ lệ làm đúng">
                <Award className="w-3.5 h-3.5" />
                <span>{stats.totalSolved > 0 ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 0}%</span>
              </div>
            </div>

            <div className="h-4 w-[1px] bg-border-primary/85" />

            {/* Segmented Theme Control */}
            <div id="theme-segmented-control" className="flex items-center gap-0.5 bg-bg-surface p-0.5 rounded-lg border border-border-primary/60">
              <button
                onClick={() => setTheme("light")}
                className={`p-1.5 rounded transition-all ${
                  theme === "light"
                    ? "bg-bg-card text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] font-medium"
                    : "text-text-muted hover:text-text-primary"
                }`}
                title="Giao diện Sáng"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-1.5 rounded transition-all ${
                  theme === "dark"
                    ? "bg-bg-card text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] font-medium"
                    : "text-text-muted hover:text-text-primary"
                }`}
                title="Giao diện Tối"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`p-1.5 rounded transition-all ${
                  theme === "system"
                    ? "bg-bg-card text-text-primary shadow-[0_1px_1px_rgba(0,0,0,0.03)] font-medium"
                    : "text-text-muted hover:text-text-primary"
                }`}
                title="Theo hệ thống"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </header>
      )}

      {/* Mobile navigation tab bar - hidden during Deep Focus Mode */}
      {!isDeepFocus && (
        <div className="md:hidden sticky top-12 z-30 bg-bg-card border-b border-border-primary h-10 flex items-center justify-around px-2">
          <button 
            onClick={handleNavigateHome}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded font-medium ${
              currentView === "workspace" ? "text-brand-info bg-brand-info-bg" : "text-text-muted"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Bàn học</span>
          </button>
          <button 
            onClick={() => { setActiveExam(null); setCurrentView("practice"); }}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded font-medium ${
              currentView === "practice" ? "text-brand-info bg-brand-info-bg" : "text-text-muted"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Luyện câu</span>
          </button>
          <button 
            onClick={() => { setActiveExam(null); setCurrentView("review"); }}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded font-medium ${
              currentView === "review" ? "text-brand-warning bg-brand-warning-bg" : "text-text-muted"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sổ câu sai</span>
          </button>
          <button 
            onClick={() => { setActiveExam(null); setCurrentView("progress"); }}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded font-medium ${
              currentView === "progress" ? "text-brand-info bg-brand-info-bg" : "text-text-muted"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Báo cáo</span>
          </button>
          <button 
            onClick={() => { setActiveExam(null); setCurrentView("forecast"); }}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded font-medium ${
              currentView === "forecast" ? "text-brand-info bg-brand-info-bg" : "text-text-muted"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Kế hoạch</span>
          </button>
          <button 
            onClick={() => { setActiveExam(null); setCurrentView("ai_coach"); }}
            className={`flex items-center gap-1 text-xs py-1 px-2 rounded font-medium ${
              currentView === "ai_coach" ? "text-brand-info bg-brand-info-bg" : "text-text-muted"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Hỏi AI</span>
          </button>
        </div>
      )}

      {/* Main workspace */}
      <main className="min-h-[calc(100vh-3rem)]">
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
