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
      
      {/*
        THANH ĐIỀU HƯỚNG NỀN SẪM, đổi ngày 28/07/2026 theo bản đặc tả Khan Academy.
        Ẩn trong chế độ tập trung sâu.

        Trước đó thanh này nền trắng mờ, cao 48px, tách khỏi nội dung bằng một đường kẻ 1px.
        Cả thanh lẫn trang đều trắng nên mắt phải tự dò ranh giới giữa vùng công cụ và vùng
        bài học. Nay là một dải sẫm cao 60px chạy hết bề ngang: ranh giới ấy được đọc xong
        trong một lần liếc, và vùng nội dung sáng nằm gọn trong khung sẫm giúp mắt neo lại
        đúng chỗ cần đọc suốt buổi.

        Đo trên Khan: nền `#0b2149`, cao 62px. Ở đây dùng sắc navy khác trong cùng họ (xem
        `--nav-nen` trong index.css), không lấy đúng mã màu của họ.

        HAI CÁI BẪY ĐÃ VẤP KHI VIẾT ĐÚNG CHÚ THÍCH NÀY, ghi lại cho người sau:

        1. Chú thích phải nằm NGOÀI biểu thức điều kiện bọc thẻ header. Đặt một khối chú thích
           JSX ngay bên trong dấu ngoặc của một biểu thức logic là lỗi cú pháp, vì chỗ đó chỉ
           nhận đúng MỘT biểu thức.
        2. Trong RUỘT chú thích JSX, tuyệt đối không viết cặp dấu sao kèm gạch chéo, vì chính
           nó đóng khối chú thích ngay giữa chừng và phần còn lại rơi ra ngoài thành mã.
      */}
      {!isDeepFocus && (
        <header className="sticky top-0 z-40 bg-nav-nen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[60px] flex items-center justify-between">

            {/* Logo & Subject Selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 cursor-pointer" onClick={handleNavigateHome}>
                <div className="w-7 h-7 rounded-md bg-nav-chu/95 flex items-center justify-center text-nav-nen transition hover:bg-nav-chu">
                  <GraduationCap className="w-4 h-4 shrink-0" />
                </div>
                {/* `whitespace-nowrap`: không có nó, khi hộp bị bó hẹp chữ này rơi xuống thành
                    một CỘT DỌC 5 dòng cao hơn cả thanh header. Hiện từ mốc `xl` trở lên vì
                    dưới mức đó chỗ trống phải nhường cho thanh điều hướng, xem chú thích ở
                    thanh đó. Biểu tượng mũ tốt nghiệp vẫn đứng đó làm lối về trang chủ. */}
                {/* Hiện từ mốc `2xl` chứ không phải `xl`: sau khi thanh điều hướng đổi sang
                    chữ 14px và ô cao 36px cho khớp Khan, ba cụm trong thanh đòi 1192px trên
                    khung 1200px, chỉ dư 8px, nên nhãn "Tìm nhanh" bị gãy đôi. Chữ logo là thứ
                    ít giá trị nhất trong ba cụm nên nó nhường chỗ. */}
                <span className="font-display font-semibold text-sm tracking-wide text-nav-chu hidden 2xl:inline-block whitespace-nowrap">
                  ÔN THI ĐẠI HỌC MỞ
                </span>
              </div>

              <div className="h-5 w-[1px] bg-nav-vach" />

              <select
                value={activeSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="bg-nav-re-chuot hover:bg-nav-dang-mo text-nav-chu border border-nav-vach rounded-md px-2.5 py-1.5 text-xs font-sans font-medium cursor-pointer transition focus:outline-none max-w-[130px] sm:max-w-[220px] truncate"
              >
                {dbService.getSubjects().map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

          {/*
            Thanh điều hướng chính, dựng từ DIEM_DEN nên luôn khớp với thanh dưới trên điện thoại.

            MỐC CHUYỂN DỜI TỪ `md` (768px) LÊN `lg` (1024px), ngày 28/07/2026.

            Đo trên bản chạy thật ở bề rộng cửa sổ 864px: hàng trong header rộng 859px nhưng ba
            cụm con của nó đòi tổng cộng **954px** (cụm logo 281 + thanh này 603 + cụm phải 70).
            Thừa 95px, nên cụm phải bị đẩy tới toạ độ 978 và **cả trang tràn ngang**, cuộn được
            sang phải. Lỗi này có sẵn từ trước, không phải do đợt sửa giao diện: đo trên bản
            gốc chưa đụng gì cũng đã tràn 928px so với 864px.

            Gốc rễ: thanh này bật từ 768px trong khi tự nó cần khoảng 825px mới đủ chỗ.

            Dời mốc lên `lg` KHÔNG làm mất điểm đến nào, vì thanh dưới đáy màn hình dựng từ
            đúng cùng một mảng DIEM_DEN và nay nhận luôn khoảng 768 tới 1024. Dưới 1024px người
            học điều hướng bằng thanh đáy, từ 1024px trở lên bằng thanh này. Ba chỗ phải dời
            cùng lúc nếu không sẽ hở: thanh này, thanh đáy, và lớp đệm dưới của `main`.
          */}
          <nav className="hidden lg:flex items-center gap-1">
            {DIEM_DEN.map(({ view, nhan, Icon }) => {
              const dangMo = currentView === view;
              return (
                <button
                  key={view}
                  onClick={() => { setActiveExam(null); setCurrentView(view as any); }}
                  aria-current={dangMo ? "page" : undefined}
                  className={`px-3 h-9 text-sm rounded-md transition flex items-center gap-2 whitespace-nowrap ${
                    dangMo
                      ? "bg-nav-dang-mo text-nav-chu font-bold"
                      : "text-nav-chu-mo hover:text-nav-chu hover:bg-nav-re-chuot font-medium"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
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
              className="px-2.5 h-9 bg-nav-re-chuot border border-nav-vach hover:bg-nav-dang-mo rounded-md text-xs tabular-nums text-nav-chu-mo hover:text-nav-chu flex items-center gap-1.5 transition cursor-pointer"
              title="Mở tìm nhanh (Ctrl + K)"
            >
              <Command className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">Tìm nhanh</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-9 h-9 bg-nav-re-chuot border border-nav-vach hover:bg-nav-dang-mo rounded-md text-nav-chu-mo hover:text-nav-chu transition cursor-pointer flex items-center justify-center"
              title="Cài đặt, giao diện và sao lưu"
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
            </button>

            {(stats.studyStreak > 0 || stats.totalSolved > 0) && (
              <>
                <div className="h-5 w-[1px] bg-nav-vach hidden lg:block" />
                {/* Trên nền sẫm, màu ngữ nghĩa cam và xanh lá của chế độ sáng không còn đủ
                    tương phản, nên hai chỉ số này dùng luôn màu chữ của thanh. Ý nghĩa vẫn nằm
                    ở biểu tượng ngọn lửa và huy hiệu. */}
                <div className="hidden lg:flex items-center gap-3 text-xs text-nav-chu">
                  {stats.studyStreak > 0 && (
                    <div className="flex items-center gap-1.5 font-semibold" title="Chuỗi ngày học tập">
                      <Flame className="w-4 h-4 fill-current shrink-0" />
                      <span className="tabular-nums">{stats.studyStreak} ngày</span>
                    </div>
                  )}
                  {stats.totalSolved > 0 && (
                    <div className="flex items-center gap-1.5 font-semibold" title="Tỷ lệ làm đúng">
                      <Award className="w-4 h-4 shrink-0" />
                      <span className="tabular-nums">{Math.round((stats.totalCorrect / stats.totalSolved) * 100)}%</span>
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
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-bg-card/95 backdrop-blur-md border-t border-border-primary pb-[env(safe-area-inset-bottom)]">
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
                  <span className="text-2xs leading-none whitespace-nowrap">{nhan}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Main workspace */}
      <main className="min-h-[calc(100vh-3rem)] pb-20 lg:pb-0">
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

      {/*
        Nút cộng nổi đã gỡ ngày 28/07/2026.

        Sáu mục của nó thì bốn mục trùng y hệt thanh điều hướng (Ôn theo điểm yếu, Sửa câu sai,
        Kế hoạch điểm, Hỏi trợ lý AI), tức thêm một lớp thao tác để tới đúng chỗ đã ở sẵn cách
        một lần bấm. Hai mục còn lại, "Tra cứu khái niệm" và "Thêm tài liệu", gọi hai hàm mà
        App chỉ cài là `setCurrentView("workspace")`, nên bấm vào chỉ chuyển trang chứ KHÔNG mở
        ô tra cứu hay hộp thêm tài liệu nào cả. Cả hai việc đó đã có nút thật, chạy thật, ngay
        trên màn Bàn học.

        Nó còn là một khối nổi che mất nội dung ở góc phải dưới trên mọi màn hình.
      */}

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
