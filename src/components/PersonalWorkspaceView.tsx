/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  FolderKanban, 
  Play, 
  RotateCcw, 
  Target, 
  Brain, 
  Clock, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Plus, 
  FileText, 
  Layers, 
  Sparkles, 
  Archive, 
  TrendingUp, 
  Info, 
  GitCommit, 
  Sliders, 
  HelpCircle,
  BookOpen,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Check,
  Share2,
  ListFilter,
  Shuffle,
  X
} from "lucide-react";
import { dbService, chapters, questions, topicMap } from "../services/db";
import { kbService } from "../services/kbService";
import { aiService } from "../services/ai";
import { workspaceService } from "../services/workspaceService";
import { examForecaster } from "../services/examForecaster";
import { 
  LearningResource, 
  KnowledgeHealthItem, 
  KnowledgeVersion, 
  LearningLogEntry, 
  StudySnapshot,
  ResourceType 
} from "../types";
import { TimeService } from "../services/time";

interface PersonalWorkspaceViewProps {
  key?: string;
  onStartExam: (type: string, param?: any) => void;
  onNavigateView: (view: string) => void;
}

export default function PersonalWorkspaceView({ onStartExam, onNavigateView }: PersonalWorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<"workspace" | "resources" | "health" | "timeline" | "snapshots" | "subjects" | "admin_health">("workspace");
  
  const activeSubId = dbService.getActiveSubjectId();
  const subjects = dbService.getSubjects();
  const activeSubject = subjects.find(s => s.id === activeSubId) || subjects[0];

  const [goal, setGoal] = useState(() => dbService.getSubjectGoal(activeSubId));
  const [prediction, setPrediction] = useState(() => examForecaster.calculatePrediction(activeSubId));
  const [resources, setResources] = useState<LearningResource[]>(() => workspaceService.getResources(activeSubId));
  const [healthItems, setHealthItems] = useState<KnowledgeHealthItem[]>(() => workspaceService.getKnowledgeHealth());
  const [versions, setVersions] = useState<KnowledgeVersion[]>(() => workspaceService.getKnowledgeVersions());
  const [timeline, setTimeline] = useState<LearningLogEntry[]>(() => workspaceService.getLearningTimeline());
  const [snapshots, setSnapshots] = useState<StudySnapshot[]>(() => workspaceService.getStudySnapshots());
  
  // Archiving
  const [archivedIds, setArchivedIds] = useState<string[]>(() => workspaceService.getArchivedSubjectIds());

  // Smart Search Modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Smart Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedResourceType, setSelectedResourceType] = useState<ResourceType>("giáo trình");
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importStep, setImportStep] = useState<string>("Sẵn sàng");
  const [isImporting, setIsImporting] = useState(false);
  // Tạo câu hỏi bằng AI từ nội dung dán vào
  const [materialText, setMaterialText] = useState("");
  const [genCount, setGenCount] = useState<number>(10);
  // 0 = để AI tự phân loại chương; > 0 = ép toàn bộ câu về đúng chương này.
  const [genChapterId, setGenChapterId] = useState<number>(0);
  const [importError, setImportError] = useState<string>("");
  const [successCount, setSuccessCount] = useState<number>(0);
  const [successNote, setSuccessNote] = useState<string>("");

  // Add Resource Modal
  const [newResTitle, setNewResTitle] = useState("");

  // Snapshot Slider
  const [selectedSnapshotIdx, setSelectedSnapshotIdx] = useState(snapshots.length - 1);

  // Liên kết kiến thức đang học.
  //
  // VÌ SAO VIẾT LẠI (28/07/2026). Cả khối này vốn là hằng số viết tay nhưng lại dán nhãn "Tự
  // tổng hợp từ tài liệu đã có". Danh sách khái niệm gắn cứng bốn tên của môn KINH TẾ CHÍNH
  // TRỊ **đã đóng** ("Hàng hóa & Giá trị", "Giá trị Thặng dư", "Tích lũy Tư bản", "Cạnh tranh
  // Độc quyền"), nên người học môn Hành vi khách hàng mở màn Bàn học ra là thấy khái niệm của
  // môn khác. Bốn ô số liệu bên dưới cũng cứng: "Slide CH2 (Trang 14)", "Chương 2 (Mục 2.1)",
  // "12 câu trong Ngân hàng", "1 câu cần sửa", không đổi dù chọn khái niệm nào.
  //
  // Theo cách phân loại ở AGENTS.md mục 3, đây là loại "trả về dữ liệu của môn SAI", tức phải
  // sửa ngay chứ không được ghi nợ.
  const doThiKhaiNiem = React.useMemo(
    () => kbService.getKnowledgeGraph(activeSubId).slice(0, 4),
    [activeSubId]
  );
  const [selectedConceptForGraph, setSelectedConceptForGraph] = useState<string | null>(null);
  const nutDangChon = doThiKhaiNiem.find(n => n.concept === selectedConceptForGraph) || doThiKhaiNiem[0] || null;

  // Số câu trong ngân hàng và số câu đang nằm trong sổ tay câu sai, ĐẾM THẬT theo bộ tra
  // khái niệm chính thống chứ không phải hai con số viết sẵn.
  const soLieuKhaiNiem = React.useMemo(() => {
    if (!nutDangChon) return { soCau: 0, soCauSai: 0 };
    const soSai = dbService.getStatistics().incorrectQuestionHistory || {};
    let soCau = 0;
    let soCauSai = 0;
    for (const q of questions) {
      const nut = kbService.getConceptForQuestion(activeSubId, q);
      if (!nut || nut.concept !== nutDangChon.concept) continue;
      soCau++;
      if ((soSai as any)[q.id]) soCauSai++;
    }
    return { soCau, soCauSai };
  }, [activeSubId, nutDangChon, prediction]);

  useEffect(() => {
    setGoal(dbService.getSubjectGoal(activeSubId));
    setPrediction(examForecaster.calculatePrediction(activeSubId));
    setResources(workspaceService.getResources(activeSubId));
    setHealthItems(workspaceService.getKnowledgeHealth());
    setTimeline(workspaceService.getLearningTimeline());
    setSnapshots(workspaceService.getStudySnapshots());
  }, [activeSubId]);

  const handleSubjectSwitch = (subId: string) => {
    dbService.setActiveSubjectId(subId);
    window.location.reload();
  };

  const handleToggleArchive = (subId: string) => {
    workspaceService.toggleSubjectArchive(subId);
    setArchivedIds(workspaceService.getArchivedSubjectIds());
  };

  const handleAddResourceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResTitle.trim()) return;
    workspaceService.addResource({
      title: newResTitle,
      type: selectedResourceType,
      status: "available",
      conceptCount: 15,
      fileSize: "3.5 MB"
    }, activeSubId);
    setResources(workspaceService.getResources(activeSubId));
    setNewResTitle("");
    setShowImportModal(false);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setIsImporting(false);
    setImportProgress(0);
    setImportError("");
    setSuccessCount(0);
    setSuccessNote("");
    setMaterialText("");
    setNewResTitle("");
  };

  // Nếu chỉ muốn ghi nhận tài liệu (không dán nội dung) thì lưu metadata như cũ.
  const handleSaveResourceOnly = () => {
    if (!newResTitle.trim()) return;
    handleAddResourceSubmit({ preventDefault: () => {} } as any);
  };

  // Gọi AI tạo câu hỏi thật từ nội dung dán vào, rồi lưu vào ngân hàng câu hỏi.
  const handleGenerateFromMaterial = async () => {
    const text = materialText.trim();
    if (!text) {
      handleSaveResourceOnly();
      return;
    }
    setImportError("");
    setSuccessCount(0);
    setSuccessNote("");
    setIsImporting(true);
    setImportProgress(5);
    setImportStep("Đang chuẩn bị tài liệu...");

    try {
      const title = newResTitle.trim() || "Tài liệu AI tạo sinh";
      const result = await aiService.generateQuestionBankFromText(
        text,
        genCount,
        title,
        (batchDone, totalBatches, accumulated) => {
          const pct = totalBatches > 0 ? Math.round((batchDone / totalBatches) * 100) : 0;
          setImportProgress(Math.max(5, Math.min(99, pct)));
          setImportStep(
            batchDone >= totalBatches
              ? "Đang lưu vào ngân hàng câu hỏi..."
              : `AI đang soạn lượt ${batchDone + 1}/${totalBatches} (đã có ${accumulated} câu)...`
          );
        },
        genChapterId || undefined
      );

      // Ghi nhận tài liệu nguồn với số câu thực tế đã tạo.
      workspaceService.addResource({
        title,
        type: selectedResourceType,
        status: "available",
        conceptCount: result.added,
        fileSize: `${text.length.toLocaleString("vi-VN")} ký tự`
      }, activeSubId);
      setResources(workspaceService.getResources(activeSubId));

      // Cập nhật lại dữ liệu phụ thuộc ngân hàng câu hỏi.
      setPrediction(examForecaster.calculatePrediction(activeSubId));
      setHealthItems(workspaceService.getKnowledgeHealth());

      // Ghi chú khi tạo được ít hơn mục tiêu (do tài liệu ngắn) hoặc có câu trùng bị bỏ.
      const notes: string[] = [];
      if (genChapterId) {
        const chTitle = chapters.find(c => c.id === genChapterId)?.title || `Chương ${genChapterId}`;
        notes.push(`Tất cả câu đã gán vào Chương ${genChapterId} (${chTitle}).`);
      }
      if (result.added < result.requested) {
        notes.push(`Mới đạt ${result.added}/${result.requested} câu; dán thêm nội dung dài hơn để tạo nhiều câu hơn.`);
      }
      if (result.duplicatesSkipped > 0) {
        notes.push(`Đã bỏ ${result.duplicatesSkipped} câu trùng lặp.`);
      }
      if (result.failedBatches > 0) {
        notes.push(`Có ${result.failedBatches} lượt gọi AI lỗi (đã bỏ qua); bấm "Tạo tiếp" để bổ sung nếu cần.`);
      }
      setSuccessNote(notes.join(" "));

      setImportProgress(100);
      setImportStep(`Đã tạo ${result.added} câu hỏi qua ${result.batches} lượt`);
      setSuccessCount(result.added);
      setIsImporting(false);
    } catch (e: any) {
      setIsImporting(false);
      setImportProgress(0);
      setImportError(e?.message || "Có lỗi khi tạo câu hỏi. Vui lòng thử lại.");
    }
  };

  // Search Results
  const searchResults = searchQuery.trim() 
    ? dbService.getQuestions().filter(q => 
        q.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        q.learningObjective?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.concept?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const remainingDays = prediction.metricsBreakdown.remainingDays;
  /** Đã có bài làm nào chưa. Nhiều con số chỉ có nghĩa khi đã có bài, xem chỗ dùng bên dưới. */
  const daCoBaiLam = dbService.getStatistics().totalSolved > 0;
  const coCauSai = prediction.metricsBreakdown.studyDebtCount > 0;
  /** Ngày thi theo lối viết Việt Nam. Bản cũ in thẳng chuỗi ISO kiểu 2026-08-11 ra cho người học. */
  const ngayThiTiengViet = (() => {
    const [nam, thang, ngay] = String(goal.examDate || "").split("-");
    return ngay && thang && nam ? `${ngay}/${thang}/${nam}` : String(goal.examDate || "");
  })();
  const isArchived = archivedIds.includes(activeSubId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
      
      {/* Subject Desktop Header Banner */}
      <div className="bg-bg-card border border-border-primary/90 rounded-2xl p-6 shadow-sm space-y-5 relative overflow-hidden">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            {/*
              Tiêu đề dẫn dắt bằng CỠ CHỮ chứ không bằng nhãn chữ hoa giãn cách.

              Bản cũ đặt bộ chọn môn ở đây với cỡ chữ của tiêu đề trang, nên nó vừa là tiêu đề
              vừa là điều khiển, mà thanh đầu trang đã có sẵn một bộ chọn môn y hệt cách đó
              chưa tới trăm điểm ảnh. Hai bộ chọn giống nhau trên cùng một màn hình buộc người
              học phải tự hỏi chúng có khác nhau không. Nay giữ MỘT bộ chọn ở thanh đầu trang,
              còn ở đây tên môn chỉ còn là ngữ cảnh.
            */}
            <h1 className="text-xl sm:text-2xl font-display font-semibold text-text-primary flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-brand-info shrink-0" />
              Bàn học hôm nay
            </h1>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-text-muted">{dbService.getActiveSubjectName()}</span>
              {isArchived && (
                <span className="px-2 py-0.5 text-[10px] bg-text-muted/20 text-text-muted rounded-full">
                  Đã lưu trữ
                </span>
              )}
              <button
                onClick={() => handleToggleArchive(activeSubId)}
                className="p-1.5 bg-bg-surface border border-border-primary hover:bg-bg-card rounded-lg text-text-muted hover:text-text-primary transition cursor-pointer"
                title={isArchived ? "Mở lại môn học" : "Lưu trữ môn học"}
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-text-muted max-w-xl pt-1">
              Tập trung vào việc cần làm tiếp theo, tài liệu đang học và các câu cần sửa.
            </p>
          </div>

          {/* Desktop Right Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowSearchModal(true)}
              className="px-3.5 py-2 bg-bg-surface border border-border-primary/80 hover:border-brand-info/50 text-text-primary text-xs font-medium rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5 text-brand-info" />
              <span>Tra cứu</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2 bg-bg-surface border border-border-primary/80 hover:border-brand-info/50 text-text-primary text-xs font-medium rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5 text-brand-info" />
              <span>Thêm tài liệu</span>
            </button>

            {/* Main Primary Action Button (Continue Learning) */}
            <button
              onClick={() => onStartExam("adaptive")}
              className="px-5 py-2.5 bg-text-primary text-bg-card hover:opacity-90 font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Bắt đầu ôn</span>
            </button>
          </div>
        </div>

        {/* Progress & Countdown Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-border-primary/60">
          <div className="bg-bg-surface p-3 rounded-xl border border-border-primary/60">
            <span className="text-[10px] text-text-muted block">Còn tới kỳ thi</span>
            <div className="flex items-center gap-2 pt-0.5">
              <Clock className="w-4 h-4 text-brand-warning shrink-0" />
              <span className="text-sm font-semibold text-brand-warning">Còn {remainingDays} ngày</span>
              <span className="text-[10px] text-text-muted">{ngayThiTiengViet}</span>
            </div>
          </div>

          {/*
            Bỏ chuỗi "+6% tuần này". Nó là chữ VIẾT CỨNG, hiện y hệt nhau cho mọi người học và
            mọi thời điểm, kể cả người chưa làm câu nào; tức là khẳng định một mức tiến bộ chưa
            hề đo. Đúng khuôn lỗi ở bất biến 4.9. Không thay bằng số khác vì lượt làm bài hiện
            không ghi mốc theo tuần, nên chưa có gì để đo cho tử tế.
          */}
          <div className="bg-bg-surface p-3 rounded-xl border border-border-primary/60">
            <span className="text-[10px] text-text-muted block">Nắm chắc kiến thức</span>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-sm font-display font-semibold text-text-primary">{prediction.metricsBreakdown.masteryScore}%</span>
            </div>
          </div>

          {/*
            Điểm dự kiến chỉ có nghĩa khi đã có bài làm. Chưa làm câu nào thì bộ dự báo trả về
            đúng mốc khởi động nguội 5,0, và hiện nó ra kèm biên độ trông y như một phép đo thật.
          */}
          <div className="bg-bg-surface p-3 rounded-xl border border-border-primary/60">
            <span className="text-[10px] text-text-muted block">Điểm dự kiến</span>
            <div className="flex items-center justify-between pt-0.5">
              {daCoBaiLam ? (
                <span className="text-sm font-display font-bold text-brand-info">{prediction.predictedScore.toFixed(1)} ± {prediction.confidenceMargin.toFixed(1)}</span>
              ) : (
                <span className="text-sm text-text-muted">Chưa đủ dữ liệu</span>
              )}
              <span className="text-[10px] text-text-muted">Mục tiêu: {goal.targetScore.toFixed(1)}</span>
            </div>
          </div>

          <div className="bg-bg-surface p-3 rounded-xl border border-border-primary/60">
            <span className="text-[10px] text-text-muted block">Câu cần sửa</span>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-sm font-semibold text-brand-warning">{prediction.metricsBreakdown.studyDebtCount} câu</span>
              <button 
                onClick={() => onNavigateView("review")}
                className="text-[10px] font-medium text-brand-info hover:underline cursor-pointer"
              >
                Sửa ngay &rarr;
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Main Workspace Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-border-primary/60 no-scrollbar">
        {[
          { key: "workspace", label: "Hôm nay", icon: FolderKanban },
          { key: "resources", label: "Tài liệu", icon: BookOpen, count: resources.length },
          { key: "health", label: "Kiến thức cần bổ sung", icon: ShieldCheck },
          { key: "timeline", label: "Nhật ký học", icon: GitCommit },
          { key: "subjects", label: "Môn học", icon: Layers }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
                isActive 
                  ? "bg-text-primary text-bg-card shadow-sm font-semibold" 
                  : "bg-bg-surface hover:bg-bg-card text-text-muted hover:text-text-primary border border-border-primary/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full font-mono bg-bg-card text-text-muted">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DESKTOP & TODAY */}
      {activeTab === "workspace" && (
        <div className="space-y-6">
          {/* Today's Checklist Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/*
              MỘT việc chính, hai việc phụ.

              Bản cũ dựng ba thẻ "Nhiệm vụ 1, 2, 3" hoàn toàn ngang hàng nhau: cùng khung, cùng
              cỡ chữ, cùng một kiểu nút xám. Người học phải tự đọc hết cả ba rồi tự xếp hạng, tức
              là bị đẩy lại đúng phần việc mà một gia sư phải làm thay. Nay việc nên làm trước
              mang nút đặc, hai việc còn lại lùi về nền.

              Thẻ câu sai còn một lỗi trạng thái rỗng: khi sổ câu sai trống, bản cũ vẫn hiện
              "Sửa 0 câu trong Sổ câu sai" kèm một nút bấm được, tức mời người học đi làm một
              việc không tồn tại.
            */}
            <div className={`rounded-2xl p-5 space-y-3 shadow-sm border ${coCauSai ? "bg-bg-card border-border-primary" : "bg-bg-card border-border-primary"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Nên làm trước</span>
                <CheckCircle2 className="w-4 h-4 text-brand-success" />
              </div>
              <h4 className="text-sm font-semibold text-text-primary">Ôn 15 câu theo điểm yếu</h4>
              <p className="text-xs text-text-muted">Tập trung vào phần dễ quên và các câu từng làm sai.</p>
              <button
                onClick={() => onStartExam("adaptive")}
                className="w-full py-2 bg-text-primary text-bg-card hover:opacity-90 text-xs rounded-lg transition font-semibold cursor-pointer"
              >
                Ôn ngay
              </button>
            </div>

            <div className="bg-bg-card border border-border-primary rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Sổ câu sai</span>
                {coCauSai
                  ? <AlertTriangle className="w-4 h-4 text-brand-warning" />
                  : <CheckCircle2 className="w-4 h-4 text-brand-success" />}
              </div>
              <h4 className="text-sm font-semibold text-text-primary">
                {coCauSai
                  ? `Sửa ${prediction.metricsBreakdown.studyDebtCount} câu đang nợ`
                  : "Sổ câu sai đang sạch"}
              </h4>
              <p className="text-xs text-text-muted">
                {coCauSai
                  ? "Hiểu lại lỗi cũ trước khi học thêm phần mới."
                  : "Chưa có câu nào cần sửa lại. Làm thêm bài để hệ thống tìm điểm yếu."}
              </p>
              {coCauSai && (
                <button
                  onClick={() => onNavigateView("review")}
                  className="w-full py-2 bg-bg-surface border border-border-primary hover:border-brand-warning/40 text-text-primary text-xs rounded-lg transition font-medium cursor-pointer"
                >
                  Mở câu sai
                </button>
              )}
            </div>

            <div className="bg-bg-card border border-border-primary rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Tự kiểm tra</span>
                <Clock className="w-4 h-4 text-brand-info" />
              </div>
              <h4 className="text-sm font-semibold text-text-primary">Làm một bài thi thử ngắn</h4>
              <p className="text-xs text-text-muted">Tự kiểm tra mức sẵn sàng trước kỳ thi.</p>
              <button
                onClick={() => onStartExam("ai-smart")}
                className="w-full py-2 bg-bg-surface border border-border-primary hover:border-brand-info/40 text-text-primary text-xs rounded-lg transition font-medium cursor-pointer"
              >
                Thi thử
              </button>
            </div>

          </div>

          {/* Giải đề ngẫu nhiên tổng hợp (ôn tập thông minh để nhớ lâu) */}
          <button
            onClick={() => onStartExam("random", aiService.generateExam({ type: "random", count: 20 }))}
            className="w-full bg-gradient-to-r from-brand-info/10 to-bg-card border border-brand-info/30 hover:border-brand-info rounded-2xl p-5 flex items-center justify-between gap-4 transition cursor-pointer text-left group shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-info/15 text-brand-info flex items-center justify-center shrink-0">
                <Shuffle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">Giải đề ngẫu nhiên tổng hợp</h4>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  20 câu trải rộng mọi chương, ưu tiên ôn lại câu từng sai để nhớ lâu hơn (lặp lại giãn cách + xen kẽ chương).
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-brand-info flex items-center gap-1 shrink-0">
              Bắt đầu
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>

          {/* Resource Relation Graph Preview */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-info" />
              Liên kết kiến thức đang học
            </h3>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-xs text-text-muted shrink-0">Chọn khái niệm:</span>
              {doThiKhaiNiem.length === 0 ? (
                <span className="text-xs text-text-muted">Môn này chưa có khái niệm nào để liên kết.</span>
              ) : doThiKhaiNiem.map(nut => (
                <button
                  key={nut.id}
                  onClick={() => setSelectedConceptForGraph(nut.concept)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    nutDangChon?.concept === nut.concept
                      ? "bg-text-primary text-bg-card font-semibold"
                      : "bg-bg-surface text-text-muted hover:text-text-primary border border-border-primary/60"
                  }`}
                >
                  {nut.concept}
                </button>
              ))}
            </div>

            <div className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-brand-info">
                <span>Nguồn học liên quan tới: <strong>{nutDangChon?.concept || "chưa có khái niệm"}</strong></span>
                <span className="text-text-muted font-normal">Đếm thật từ đồ thị tri thức và ngân hàng câu hỏi</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
                <div className="p-3 bg-bg-card border border-border-primary rounded-lg space-y-1">
                  <span className="text-[10px] text-text-muted uppercase block">Khái niệm</span>
                  <span className="font-semibold text-text-primary">{nutDangChon?.concept || "—"}</span>
                </div>
                <div className="p-3 bg-bg-card border border-border-primary rounded-lg space-y-1">
                  <span className="text-[10px] text-text-muted uppercase block">Chuyên đề</span>
                  {/* `node.topic` giữ MÃ chuyên đề (ví dụ CB_T1.1), tra sang tên cho người đọc. */}
                  <span className="font-semibold text-brand-info">
                    {nutDangChon ? (topicMap.get(nutDangChon.topic)?.title || nutDangChon.topic) : "—"}
                  </span>
                </div>
                <div className="p-3 bg-bg-card border border-border-primary rounded-lg space-y-1">
                  <span className="text-[10px] text-text-muted uppercase block">Nguồn tài liệu</span>
                  <span className="font-semibold text-brand-info">
                    {nutDangChon ? `${nutDangChon.source || "Chưa ghi nguồn"}${nutDangChon.page ? ` (${nutDangChon.page})` : ""}` : "—"}
                  </span>
                </div>
                <div className="p-3 bg-bg-card border border-border-primary rounded-lg space-y-1">
                  <span className="text-[10px] text-text-muted uppercase block">Câu hỏi tương ứng</span>
                  <span className="font-semibold text-text-primary">{soLieuKhaiNiem.soCau} câu trong Ngân hàng</span>
                </div>
                <div className="p-3 bg-bg-card border border-border-primary rounded-lg space-y-1">
                  <span className="text-[10px] text-text-muted uppercase block">Sổ tay Câu sai</span>
                  <span className={`font-semibold ${soLieuKhaiNiem.soCauSai > 0 ? "text-brand-warning" : "text-text-muted"}`}>
                    {soLieuKhaiNiem.soCauSai} câu cần sửa
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESOURCE CENTER */}
      {activeTab === "resources" && (
        <div className="space-y-6">
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-info" />
                  Tài liệu môn học
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Lưu giáo trình, slide, đề cũ, flashcard và ghi chú để app ôn đúng nguồn.
                </p>
              </div>

              <button
                onClick={() => setShowImportModal(true)}
                className="px-3.5 py-2 bg-text-primary text-bg-card font-semibold text-xs rounded-xl hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm tài nguyên</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.map((res) => (
                <div 
                  key={res.id}
                  className={`p-4 rounded-xl border transition space-y-3 ${
                    res.status === "available"
                      ? "bg-bg-surface border-border-primary hover:border-brand-info/40"
                      : "bg-bg-surface/50 border-dashed border-border-primary opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded-full bg-bg-card border border-border-primary text-text-muted">
                      {res.type}
                    </span>
                    <span className={`px-2 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                      res.status === "available" ? "bg-brand-success/10 text-brand-success" : "bg-brand-warning/10 text-brand-warning"
                    }`}>
                      {res.status === "available" ? "Đã có ✓" : "Còn thiếu"}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-text-primary leading-snug">{res.title}</h4>

                  <div className="flex items-center justify-between text-[11px] font-mono text-text-muted border-t border-border-primary/60 pt-2">
                    <span>{res.conceptCount} khái niệm</span>
                    <span>{res.fileSize || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: KNOWLEDGE HEALTH & VERSIONING */}
      {activeTab === "health" && (
        <div className="space-y-6">
          {/* Health Audit Checklist */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-success" />
              Kiến thức cần bổ sung
            </h3>

            <div className="space-y-3">
              {healthItems.map((item) => (
                <div key={item.chapterId} className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">{item.chapterTitle}</span>
                    <span className="text-xs font-mono font-bold text-brand-info">{item.coveragePercentage}% độ phủ</span>
                  </div>

                  <div className="w-full bg-bg-card border border-border-primary/60 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-brand-info h-full" style={{ width: `${item.coveragePercentage}%` }} />
                  </div>

                  {item.missingConcepts.length > 0 ? (
                    <div className="text-[11px] font-mono text-brand-warning flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Thiếu khái niệm: {item.missingConcepts.join(", ")}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-mono text-brand-success block">Đã phủ 100% khái niệm trọng tâm ✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Version History Git-like log */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-brand-info" />
              Lịch sử cập nhật tài liệu
            </h3>

            <div className="space-y-3">
              {versions.map((ver) => (
                <div key={ver.version} className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-brand-info">{ver.version} ({ver.date})</span>
                    <span className="text-brand-success">Độ phủ: {ver.coveragePercentage}%</span>
                  </div>
                  <p className="text-text-primary font-sans">{ver.description}</p>
                  <div className="flex items-center gap-4 text-[11px] text-text-muted pt-1 border-t border-border-primary/60">
                    <span>+ {ver.addedConceptsCount} khái niệm mới</span>
                    <span>- {ver.removedDuplicatesCount} khái niệm trùng lặp</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LEARNING TIMELINE */}
      {activeTab === "timeline" && (
        <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-brand-info" />
            Nhật ký học tập
          </h3>

          <div className="space-y-4 relative pl-4 border-l border-border-primary/80">
            {timeline.map((item) => (
              <div key={item.id} className="relative space-y-1">
                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-brand-info border-2 border-bg-card" />
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-text-muted">{item.date}</span>
                  <span className="px-2 py-0.2 bg-brand-info/10 text-brand-info rounded-full font-bold">{item.type}</span>
                </div>
                <h4 className="text-xs font-semibold text-text-primary">{item.title}</h4>
                <p className="text-xs text-text-muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: STUDY SNAPSHOTS */}
      {activeTab === "snapshots" && (
        <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-5 shadow-sm">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand-info" />
            Các mốc tiến bộ
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-text-muted">Chọn mốc thời gian:</span>
              <span className="font-bold text-brand-info">{snapshots[selectedSnapshotIdx].weekLabel} ({snapshots[selectedSnapshotIdx].date})</span>
            </div>

            <input
              type="range"
              min="0"
              max={snapshots.length - 1}
              value={selectedSnapshotIdx}
              onChange={(e) => setSelectedSnapshotIdx(Number(e.target.value))}
              className="w-full cursor-pointer accent-brand-info"
            />
          </div>

          <div className="p-5 bg-bg-surface border border-border-primary rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Mức nắm chắc</span>
              <span className="text-xl font-bold text-brand-success">{snapshots[selectedSnapshotIdx].masteryPct}%</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Điểm dự báo</span>
              <span className="text-xl font-bold text-brand-info">{snapshots[selectedSnapshotIdx].forecastScore.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Sổ câu sai</span>
              <span className="text-xl font-bold text-brand-warning">{snapshots[selectedSnapshotIdx].debtCount} câu</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Đã giải tổng cộng</span>
              <span className="text-xl font-bold text-text-primary">{snapshots[selectedSnapshotIdx].solvedQuestions} câu</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: MULTI-SUBJECT COMMAND CENTER */}
      {activeTab === "subjects" && (
        <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-info" />
            Danh sách môn học
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subjects.map(sub => {
              const subGoal = dbService.getSubjectGoal(sub.id);
              const subPrediction = examForecaster.calculatePrediction(sub.id);
              const isCurrent = sub.id === activeSubId;

              return (
                <div 
                  key={sub.id} 
                  className={`p-4 rounded-xl border space-y-3 ${
                    isCurrent ? "bg-bg-surface border-brand-info/50 shadow-sm" : "bg-bg-card border-border-primary"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-text-primary">{sub.name}</h4>
                    <span className="text-[10px] font-mono text-brand-warning font-bold">
                      Còn {subPrediction.metricsBreakdown.remainingDays} ngày
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-text-muted">
                      <span>Dự báo hiện tại:</span>
                      <strong className="text-brand-info">{subPrediction.predictedScore.toFixed(1)}</strong>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>Điểm mục tiêu:</span>
                      <strong className="text-text-primary">{subGoal.targetScore.toFixed(1)}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSubjectSwitch(sub.id)}
                    className="w-full py-1.5 bg-bg-surface border border-border-primary hover:border-brand-info/40 text-text-primary text-xs rounded-lg font-medium transition cursor-pointer"
                  >
                    Chuyển sang môn này
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 7: SUBJECT HEALTH DASHBOARD (ADMIN) */}
      {activeTab === "admin_health" && (
        <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-info" />
            Báo cáo chất lượng học liệu
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono bg-bg-surface p-4 rounded-xl border border-border-primary/80">
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Độ phủ kiến thức</span>
              <span className="text-2xl font-bold text-brand-success">98%</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Tỷ lệ trùng lặp</span>
              <span className="text-2xl font-bold text-brand-info">1.2%</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Tổng số câu hỏi</span>
              <span className="text-2xl font-bold text-text-primary">{dbService.getQuestions().length}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Cân bằng mức độ</span>
              <span className="text-2xl font-bold text-brand-success">Tốt</span>
            </div>
          </div>
        </div>
      )}

      {/* SMART SEARCH MODAL */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-fade-in">
          <div className="bg-bg-card border border-border-primary rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden space-y-0">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-primary bg-bg-surface">
              <Search className="w-4 h-4 text-brand-info shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tra cứu Khái niệm, Giáo trình, Câu hỏi..."
                className="w-full bg-transparent text-xs font-medium text-text-primary focus:outline-none placeholder:text-text-muted"
              />
              <button onClick={() => setShowSearchModal(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-4 space-y-2">
              {!searchQuery.trim() ? (
                <div className="p-6 text-center text-xs text-text-muted font-mono">
                  Gõ từ khóa để tra cứu khái niệm hoặc câu hỏi.
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted font-mono">
                  Không tìm thấy khái niệm hoặc câu hỏi nào chứa "{searchQuery}"
                </div>
              ) : (
                searchResults.slice(0, 5).map((q) => (
                  <div key={q.id} className="p-3 bg-bg-surface border border-border-primary rounded-xl space-y-1">
                    <span className="text-[10px] font-mono text-brand-info uppercase">{q.concept || `Câu #${q.id}`}</span>
                    <p className="text-xs font-medium text-text-primary">{q.question}</p>
                    <span className="text-[10px] text-text-muted font-mono block">Nguồn: {q.sourcePdf}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SMART IMPORT PIPELINE MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-bg-card border border-border-primary rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-primary pb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-text-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-info" />
                Tạo câu hỏi bằng AI từ tài liệu
              </h3>
              <button onClick={closeImportModal} className="text-text-muted hover:text-text-primary cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {successCount > 0 ? (
              /* Trạng thái thành công */
              <div className="space-y-4 py-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-brand-success/10 text-brand-success flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text-primary">Đã tạo {successCount} câu hỏi mới</p>
                  <p className="text-xs text-text-muted">
                    Câu hỏi đã được thêm vào ngân hàng môn <strong>{activeSubject?.name}</strong>. Bạn có thể luyện tập hoặc giải đề theo chương ngay.
                  </p>
                  {successNote && (
                    <p className="text-[11px] text-brand-warning pt-1">{successNote}</p>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => { setSuccessCount(0); setMaterialText(""); setImportProgress(0); setImportStep("Sẵn sàng"); }}
                    className="px-3.5 py-1.5 bg-bg-surface border border-border-primary text-xs rounded-xl cursor-pointer"
                  >
                    Tạo tiếp
                  </button>
                  <button
                    onClick={closeImportModal}
                    className="px-4 py-1.5 bg-text-primary text-bg-card font-semibold text-xs rounded-xl hover:opacity-90 cursor-pointer"
                  >
                    Xong
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-text-muted block mb-1">Tên tài liệu (dùng làm nguồn của câu hỏi)</label>
                    <input
                      type="text"
                      value={newResTitle}
                      onChange={(e) => setNewResTitle(e.target.value)}
                      placeholder="Ví dụ: Giáo trình Chương 3 - Giá trị thặng dư"
                      className="w-full bg-bg-surface border border-border-primary rounded-xl px-3 py-2 text-text-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-text-muted block mb-1">Phân loại tài liệu</label>
                    <select
                      value={selectedResourceType}
                      onChange={(e) => setSelectedResourceType(e.target.value as any)}
                      className="w-full bg-bg-surface border border-border-primary rounded-xl px-3 py-2 text-text-primary cursor-pointer focus:outline-none"
                    >
                      <option value="giáo trình">Giáo trình</option>
                      <option value="slide">Slide bài giảng</option>
                      <option value="đề cũ">Đề thi cũ</option>
                      <option value="flashcard">Flashcard</option>
                      <option value="ghi chú">Ghi chú cá nhân</option>
                      <option value="mindmap">Sơ đồ tư duy</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-text-muted block mb-1">Gán câu hỏi vào chương</label>
                    <select
                      value={genChapterId}
                      onChange={(e) => setGenChapterId(Number(e.target.value))}
                      className="w-full bg-bg-surface border border-border-primary rounded-xl px-3 py-2 text-text-primary cursor-pointer focus:outline-none"
                    >
                      <option value={0}>Để AI tự phân loại theo nội dung</option>
                      {chapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          Chương {ch.id} - {ch.title}
                        </option>
                      ))}
                    </select>
                    <div className="text-[10px] text-text-muted mt-1">
                      {genChapterId > 0
                        ? "Toàn bộ câu tạo ra sẽ được ép vào đúng chương này, phục vụ luyện đề theo chương."
                        : "Nên chọn chương nếu bạn đang dán tài liệu của riêng một chương."}
                    </div>
                  </div>

                  <div>
                    <label className="text-text-muted block mb-1">
                      Dán nội dung tài liệu (AI sẽ đọc và soạn câu hỏi từ đây)
                    </label>
                    <textarea
                      value={materialText}
                      onChange={(e) => setMaterialText(e.target.value)}
                      rows={7}
                      placeholder="Dán nội dung bài giảng, tóm tắt chương, ghi chú... AI sẽ dựa hoàn toàn vào nội dung này để tạo câu hỏi."
                      className="w-full bg-bg-surface border border-border-primary rounded-xl px-3 py-2 text-text-primary focus:outline-none resize-y leading-relaxed"
                    />
                    <div className="text-[10px] text-text-muted mt-1 font-mono">
                      {materialText.trim().length.toLocaleString("vi-VN")} ký tự
                      {materialText.trim().length > 0 && materialText.trim().length < 200 && (
                        <span className="text-brand-warning"> • nên dán ít nhất vài đoạn để câu hỏi chất lượng hơn</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-text-muted block mb-1">Số câu hỏi muốn tạo</label>
                    <div className="flex items-center gap-1.5">
                      {[5, 10, 20, 40].map((n) => (
                        <button
                          key={n}
                          onClick={() => setGenCount(n)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                            genCount === n
                              ? "bg-brand-info/10 text-brand-info border-brand-info/40"
                              : "bg-bg-surface text-text-muted border-border-primary hover:text-text-primary"
                          }`}
                        >
                          {n} câu
                        </button>
                      ))}
                    </div>
                    {genCount > 8 && (
                      <div className="text-[10px] text-text-muted mt-1 font-mono">
                        Tài liệu sẽ được chia nhỏ và gọi AI nhiều lượt tự động.
                      </div>
                    )}
                  </div>

                  {/* Thanh tiến trình khi đang gọi AI */}
                  {isImporting && (
                    <div className="p-3 bg-bg-surface border border-border-primary rounded-xl space-y-2 font-mono">
                      <div className="flex justify-between text-[10px] text-brand-info">
                        <span>{importStep}</span>
                        <span>{importProgress}%</span>
                      </div>
                      <div className="w-full bg-bg-card border border-border-primary rounded-full h-1.5 overflow-hidden">
                        <div className="bg-brand-info h-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Báo lỗi */}
                  {importError && (
                    <div className="p-3 bg-brand-error-bg border border-brand-error-border/40 rounded-xl text-[11px] text-brand-error flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <span className="text-[10px] text-text-muted">
                    {materialText.trim() ? "AI sẽ tạo câu hỏi từ nội dung trên." : "Không dán nội dung thì chỉ lưu tên tài liệu."}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={closeImportModal}
                      className="px-3.5 py-1.5 bg-bg-surface border border-border-primary text-xs rounded-xl cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      disabled={isImporting || !newResTitle.trim()}
                      onClick={handleGenerateFromMaterial}
                      className="px-4 py-1.5 bg-text-primary text-bg-card font-semibold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                    >
                      {isImporting ? (
                        "Đang tạo..."
                      ) : materialText.trim() ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Tạo {genCount} câu hỏi
                        </>
                      ) : (
                        "Chỉ lưu tài liệu"
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
