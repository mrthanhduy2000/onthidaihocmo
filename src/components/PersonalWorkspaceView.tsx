/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { FolderKanban, Play, Clock, Upload, CheckCircle2, AlertTriangle, Search, Plus, Layers, Sparkles, Archive, GitCommit, BookOpen, ShieldCheck, X } from "lucide-react";
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
            <h1 className="text-xl sm:text-2xl font-display font-semibold text-text-primary">
Bàn học hôm nay
            </h1>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-text-muted">{dbService.getActiveSubjectName()}</span>
              {isArchived && (
                <span className="px-2 py-0.5 text-2xs bg-text-muted/20 text-text-muted rounded-full">
                  Đã lưu trữ
                </span>
              )}
              <button
                onClick={() => handleToggleArchive(activeSubId)}
                className="p-1.5 bg-bg-surface border border-border-primary hover:bg-bg-card rounded-lg text-text-muted hover:text-text-primary transition cursor-pointer"
                title={isArchived ? "Mở lại môn học" : "Lưu trữ môn học"}
              >
                <Archive className="w-4 h-4" />
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
              <Search className="w-4 h-4 text-brand-info" />
              <span>Tra cứu</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2 bg-bg-surface border border-border-primary/80 hover:border-brand-info/50 text-text-primary text-xs font-medium rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-4 h-4 text-brand-info" />
              <span>Thêm tài liệu</span>
            </button>

            {/* Main Primary Action Button (Continue Learning) */}
            <button
              onClick={() => onStartExam("adaptive")}
              className="px-5 py-2.5 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Bắt đầu ôn</span>
            </button>
          </div>
        </div>

        {/*
          BỐN Ô SỐ LIỆU ĐÓNG KHUNG ĐỔI THÀNH MỘT DÒNG CHỮ.

          Đây là lần đầu áp nguyên tắc đã ghi trong NGONNGUTHIETKE.md từ lượt reverse engineer
          mà chưa từng dùng ở đâu: **nội dung là chủ thể, số liệu là chú thích của nội dung.**

          Đo trên Khan Academy: tiến độ của họ được viết thành CÂU, ví dụ "Tinh thông chương:
          0%", cỡ 14px, đậm 400, màu chữ thường. Không thẻ, không viền, không bo góc, không số
          cỡ lớn, không huy hiệu màu.

          Bản cũ ở đây làm ngược hẳn: bốn con số, mỗi con số một cái thẻ, mỗi thẻ một cái nền,
          một cái viền và một cái bo góc riêng. Khi mọi mẩu dữ liệu đều được đóng khung thì
          không mẩu nào quan trọng hơn mẩu nào, và màn hình biến thành bảng theo dõi thay vì
          chỗ để đọc. Đúng cái làm nó trông như một dashboard React chứ không như một chỗ học.

          Giữ nguyên đủ bốn mẩu tin và cả liên kết "Sửa ngay", chỉ đổi cách trình bày.

          Một điều bỏ đi có chủ ý: **màu cam trên số ngày còn lại**. Trên Khan, màu không bao
          giờ mang trạng thái trong chữ nội dung; nó dành cho thứ bấm được và cho đúng sai. Một
          vệt cam nằm thường trực trên màn hình thì sau đúng một ngày là mắt thôi thấy nó, nên
          nó không còn báo được điều gì mà chỉ còn làm nhiễu. Số ngày nay tô đậm thay vì tô màu.
        */}
        {/*
          Vạch ngăn dựng bằng viền trái và CHỈ bật từ mốc `sm` trở lên.

          Bản đầu của lượt này dùng dấu chấm giữa các mẩu. Nhìn trên khung 375px thì bốn mẩu
          xuống bốn dòng và mỗi dấu chấm bị kẹt lại ở CUỐI dòng, trông như một dấu đầu dòng đặt
          nhầm chỗ. Vạch trái thì tự biến mất khi các mẩu không còn nằm cùng hàng.
        */}
        <div className="pt-3 border-t border-border-primary/60 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-1 text-sm text-text-secondary font-sans">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 shrink-0 text-text-muted" />
            <span>Còn <strong className="text-text-primary">{remainingDays} ngày</strong> tới kỳ thi {ngayThiTiengViet}</span>
          </span>

          {/*
            Bỏ chuỗi "+6% tuần này". Nó là chữ VIẾT CỨNG, hiện y hệt nhau cho mọi người học và
            mọi thời điểm, kể cả người chưa làm câu nào; tức là khẳng định một mức tiến bộ chưa
            hề đo. Đúng khuôn lỗi ở bất biến 4.9. Không thay bằng số khác vì lượt làm bài hiện
            không ghi mốc theo tuần, nên chưa có gì để đo cho tử tế.
          */}
          <span className="sm:border-l sm:border-border-primary sm:pl-3.5 sm:ml-3.5">
            Nắm chắc kiến thức <strong className="text-text-primary">{prediction.metricsBreakdown.masteryScore}%</strong>
          </span>

          {/*
            Điểm dự kiến chỉ có nghĩa khi đã có bài làm. Chưa làm câu nào thì bộ dự báo trả về
            đúng mốc khởi động nguội 5,0, và hiện nó ra kèm biên độ trông y như một phép đo thật.
          */}
          <span className="sm:border-l sm:border-border-primary sm:pl-3.5 sm:ml-3.5">
            Điểm dự kiến{" "}
            {daCoBaiLam ? (
              <strong className="text-text-primary">{prediction.predictedScore.toFixed(1)} ± {prediction.confidenceMargin.toFixed(1)}</strong>
            ) : (
              <span className="text-text-muted">Chưa đủ dữ liệu</span>
            )}
            , mục tiêu {goal.targetScore.toFixed(1)}
          </span>

          <span className="flex items-center gap-2 sm:border-l sm:border-border-primary sm:pl-3.5 sm:ml-3.5">
            <span><strong className="text-text-primary">{prediction.metricsBreakdown.studyDebtCount} câu</strong> cần sửa</span>
            {prediction.metricsBreakdown.studyDebtCount > 0 && (
              <button
                onClick={() => onNavigateView("review")}
                className="text-[color:var(--nut-chinh)] font-bold hover:underline cursor-pointer whitespace-nowrap"
              >
                Sửa ngay &rarr;
              </button>
            )}
          </span>
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
                  ? "bg-nut-chinh text-white shadow-sm font-semibold" 
                  : "bg-bg-surface hover:bg-bg-card text-text-muted hover:text-text-primary border border-border-primary/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.2 text-2xs rounded-full tabular-nums bg-bg-card text-text-muted">
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
          {/*
            VIỆC NÊN LÀM TIẾP THEO, DỰNG LẠI TỪ ĐẦU THEO BẢN ĐO TRÊN KHAN ACADEMY.

            Đo ngày 29/07/2026 trên trang khoá học Khan, khối "việc tiếp theo" của một người
            CHƯA HỌC GÌ:

              khung bao      nền trong suốt, viền 0, bo góc 0, không đổ bóng, padding 0
              tiêu đề        20px/700, và là một CÂU MỆNH LỆNH: "Bắt đầu tăng cấp độ tích lũy..."
              mô tả          14px/400, cùng màu chữ chính
              số 0           28px/700, ĐÚNG màu chữ thường, không làm mờ, không tô cảnh báo
              nút            156x32px, nền #1865F2, chữ 14px/400 trắng, bo 4px
              số nút         ĐÚNG MỘT

            Bản cũ ở đây dựng BA THẺ ngang hàng, dù chú thích của chính nó tự nhận là "một việc
            chính, hai việc phụ". Ba khung giống nhau, ba tiêu đề 14px giống nhau, ba nút cùng
            chiều rộng. Người học vẫn phải tự xếp hạng, tức vẫn bị đẩy lại phần việc mà một gia
            sư phải làm thay. Nay: việc chính là một khối mở không khung, hai việc còn lại là
            HÀNG ngăn bằng đường kẻ, đúng khuôn AGENTS.md 4.9f.

            BA LỖI NỘI DUNG ĐÃ SỬA CÙNG LÚC, không lỗi nào là chuyện thẩm mỹ:

            1. "Ôn 15 câu theo điểm yếu" HỨA SAI. Nút gọi `onStartExam("adaptive")` không kèm
               tham số, nên App.tsx dòng 309 sinh `count: 10`. Mở bản chạy thật bấm thử thì đầu
               phiên ghi "Phiên ôn luyện: 10 câu hỏi lý thuyết". Lệch 50%. Cùng họ với
               `daysLeft = 12` đã gỡ ở lượt trước: một con số viết tay trong nhãn, đứng cạnh một
               con số thật do engine sinh, và không có gì bắt chúng phải khớp nhau. Sửa bằng cách
               BỎ con số khỏi nhãn chứ không viết lại thành 10: nhãn không phải nơi giữ nguồn sự
               thật, và phiên bài đã tự nói đúng số câu ngay khi mở.

            2. DẤU TÍCH XANH GẮN CỨNG trên thẻ việc chính. `CheckCircle2` màu brand-success,
               không phụ thuộc trạng thái nào, tức thuần trang trí. Nhưng nó là biểu tượng "đã
               xong", nên với người vừa mở ứng dụng lần đầu, màn hình báo việc đầu tiên của họ
               đã hoàn thành. Đã gỡ.

            3. "Sổ câu sai đang sạch" KHEN THỨ CHƯA XẢY RA. Sổ trống vì chưa làm câu nào, không
               phải vì làm đúng hết. Khen sai người thì lời khen thật sau này mất giá, đó là cái
               giá thật chứ không phải chuyện chữ nghĩa. Nay tách đôi bằng cờ `daCoBaiLam` vốn
               đã có sẵn: chưa làm bài thì nói trung tính và KHÔNG có tích xanh; làm rồi mà sổ
               sạch thì mới khen, lúc đó lời khen đúng.
          */}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-text-muted">Nên làm trước</span>
            <h3 className="text-xl font-bold text-text-primary font-sans">
              {daCoBaiLam ? "Ôn theo điểm yếu" : "Bắt đầu bằng một lượt ôn ngắn"}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed max-w-[42rem] pt-0.5">
              {daCoBaiLam
                ? "Tập trung vào phần dễ quên và các câu từng làm sai."
                : "Hệ thống chưa biết bạn yếu ở đâu. Làm xong lượt đầu là nó có căn cứ để chọn câu cho bạn."}
            </p>
            <div className="pt-3">
              <button
                onClick={() => onStartExam("adaptive")}
                className="px-4 h-9 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot text-sm rounded transition cursor-pointer"
              >
                {daCoBaiLam ? "Ôn ngay" : "Bắt đầu"}
              </button>
            </div>
          </div>

          {/* Hai việc còn lại: HÀNG chứ không phải thẻ. Cùng khuôn với mọi danh sách khác. */}
          <div className="grid grid-cols-1 divide-y divide-border-primary/70 border-y border-border-primary/70">
            <div className="py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-text-primary font-sans">
                    {coCauSai
                      ? `Sửa ${prediction.metricsBreakdown.studyDebtCount} câu đang nợ`
                      : daCoBaiLam
                        ? "Sổ câu sai đang sạch"
                        : "Chưa có câu sai nào"}
                  </h4>
                  {/* Chỉ tô tín hiệu khi tín hiệu có nghĩa. Chưa làm bài thì không có gì để mừng. */}
                  {coCauSai && <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0" />}
                  {!coCauSai && daCoBaiLam && <CheckCircle2 className="w-4 h-4 text-brand-success shrink-0" />}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed pt-0.5">
                  {coCauSai
                    ? "Hiểu lại lỗi cũ trước khi học thêm phần mới."
                    : daCoBaiLam
                      ? "Chưa có câu nào cần sửa lại. Làm thêm bài để hệ thống tìm điểm yếu."
                      : "Sổ này tự ghi lại những câu bạn làm sai, để ôn lại đúng chỗ hay quên."}
                </p>
              </div>
              {coCauSai && (
                <button
                  onClick={() => onNavigateView("review")}
                  className="shrink-0 px-4 h-9 bg-bg-surface border border-border-primary hover:border-text-muted text-text-primary text-sm rounded transition cursor-pointer"
                >
                  Mở câu sai
                </button>
              )}
            </div>

            <div className="py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h4 className="text-base font-bold text-text-primary font-sans">Làm một bài thi thử ngắn</h4>
                <p className="text-sm text-text-secondary leading-relaxed pt-0.5">
                  Tự kiểm tra mức sẵn sàng trước kỳ thi.
                </p>
              </div>
              <button
                onClick={() => onStartExam("ai-smart")}
                className="shrink-0 px-4 h-9 bg-bg-surface border border-border-primary hover:border-text-muted text-text-primary text-sm rounded transition cursor-pointer"
              >
                Thi thử
              </button>
            </div>

            {/*
              Hành động phụ THỨ BA, nên nằm cùng danh sách với hai cái trên.

              Bản cũ để riêng nó thành một thẻ nền chuyển sắc, viền xanh, bo 16px, có đổ bóng và
              một ô biểu tượng 40px, tức nặng hơn hẳn hai hành động cùng hạng ngay bên trên và
              nặng ngang khối việc chính. Sức nặng thị giác đang nói sai thứ tự ưu tiên.

              Câu mô tả cũng bỏ phần "(lặp lại giãn cách + xen kẽ chương)". Đó là tên hai kỹ
              thuật trong khoa học nhận thức, đúng về chuyên môn nhưng là ngôn ngữ của người làm
              hệ thống. Vế trước câu đã nói đủ ích lợi cho người học: trải rộng mọi chương và ưu
              tiên câu từng sai.
            */}
            <div className="py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h4 className="text-base font-bold text-text-primary font-sans">Giải đề ngẫu nhiên tổng hợp</h4>
                <p className="text-sm text-text-secondary leading-relaxed pt-0.5">
                  20 câu trải rộng mọi chương, ưu tiên ôn lại câu từng sai để nhớ lâu hơn.
                </p>
              </div>
              <button
                onClick={() => onStartExam("random", aiService.generateExam({ type: "random", count: 20 }))}
                className="shrink-0 px-4 h-9 bg-bg-surface border border-border-primary hover:border-text-muted text-text-primary text-sm rounded transition cursor-pointer"
              >
                Bắt đầu
              </button>
            </div>
          </div>

          {/*
            NĂM MẨU TIN VỀ MỘT KHÁI NIỆM, KHÔNG PHẢI NĂM MỤC NGANG HÀNG.

            Bản cũ dựng chúng thành lưới `sm:grid-cols-5`, tức năm thẻ ngang hàng nhau, mỗi thẻ
            có nền riêng, viền riêng, bo góc riêng. Nhưng năm mẩu ấy là **thuộc tính của cùng
            một khái niệm** (nó tên gì, thuộc chuyên đề nào, lấy từ nguồn nào, có bao nhiêu câu,
            đang nợ mấy câu). Lưới ngang hàng là sai cấu trúc ngay từ gốc, và cái giá phải trả
            đo được trên bản chạy thật ở bề rộng 691px: mỗi cột còn khoảng 180px, nên tên tài
            liệu "Giáo trình Lê Phúc Loan & Nguyễn Thị Bích Trâm (2022), Đề thi mẫu (Câu 17)"
            vỡ xuống BẢY DÒNG, mỗi dòng hai ba chữ. Không ai đọc kiểu đó.

            Đúng cấu trúc là danh sách định nghĩa: nhãn rồi giá trị, xếp dọc. Dùng luôn thẻ
            `dl/dt/dd` cho đúng ngữ nghĩa, nên trình đọc màn hình cũng đọc ra được quan hệ
            nhãn với giá trị thay vì đọc thành năm khối chữ rời.

            Đồng thời gỡ BA TẦNG HỘP LỒNG NHAU cho năm mẩu chữ (khối ngoài bo 16px có bóng, khối
            trong nền xám có viền, rồi năm thẻ mỗi thẻ một viền), đúng khuôn "hộp trong hộp
            trong hộp" đã gỡ ở màn Luyện câu.

            Và bỏ dòng "Đếm thật từ đồ thị tri thức và ngân hàng câu hỏi". Đó là câu hệ thống tự
            trấn an về cách nó lấy số, không phải điều người học cần đọc. Cùng loại với "Hệ
            thống Giám sát & Tự Tiến hóa..." đã gỡ ở màn Công cụ.
          */}
          <div className="pt-2 space-y-4">
            <h3 className="text-xl font-bold text-text-primary font-sans">Liên kết kiến thức đang học</h3>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-sm text-text-muted shrink-0">Chọn khái niệm:</span>
              {doThiKhaiNiem.length === 0 ? (
                <span className="text-sm text-text-muted">Môn này chưa có khái niệm nào để liên kết.</span>
              ) : doThiKhaiNiem.map(nut => (
                <button
                  key={nut.id}
                  onClick={() => setSelectedConceptForGraph(nut.concept)}
                  className={`px-3 h-8 rounded text-sm transition cursor-pointer whitespace-nowrap shrink-0 ${
                    nutDangChon?.concept === nut.concept
                      ? "bg-nut-chinh text-white"
                      : "bg-bg-surface text-text-secondary hover:text-text-primary border border-border-primary"
                  }`}
                >
                  {nut.concept}
                </button>
              ))}
            </div>

            <dl className="grid grid-cols-1 divide-y divide-border-primary/70 border-y border-border-primary/70 text-sm">
              {[
                {
                  nhan: "Khái niệm",
                  tri: nutDangChon?.concept || "—",
                },
                {
                  // `node.topic` giữ MÃ chuyên đề (ví dụ CB_T1.1), tra sang tên cho người đọc.
                  nhan: "Chuyên đề",
                  tri: nutDangChon ? (topicMap.get(nutDangChon.topic)?.title || nutDangChon.topic) : "—",
                },
                {
                  nhan: "Nguồn tài liệu",
                  tri: nutDangChon
                    ? `${nutDangChon.source || "Chưa ghi nguồn"}${nutDangChon.page ? ` (${nutDangChon.page})` : ""}`
                    : "—",
                },
                {
                  nhan: "Câu hỏi trong ngân hàng",
                  tri: `${soLieuKhaiNiem.soCau} câu`,
                },
                {
                  nhan: "Đang nợ trong sổ câu sai",
                  tri: `${soLieuKhaiNiem.soCauSai} câu`,
                  // Chỉ tô cảnh báo khi thật sự có nợ. Số 0 là số bình thường, không phải tin xấu.
                  toCanhBao: soLieuKhaiNiem.soCauSai > 0,
                },
              ].map(muc => (
                <div key={muc.nhan} className="py-3 flex flex-col sm:flex-row sm:items-baseline sm:gap-4">
                  <dt className="text-text-muted sm:w-56 sm:shrink-0">{muc.nhan}</dt>
                  <dd className={`font-medium ${muc.toCanhBao ? "text-brand-warning" : "text-text-primary"}`}>
                    {muc.tri}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* TAB 2: RESOURCE CENTER */}
      {activeTab === "resources" && (
        <div className="space-y-6">
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border-primary pb-4">
              <div>
                <h3 className="text-xs tabular-nums text-text-primary">
Tài liệu môn học
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Lưu giáo trình, slide, đề cũ, flashcard và ghi chú để app ôn đúng nguồn.
                </p>
              </div>

              <button
                onClick={() => setShowImportModal(true)}
                className="px-3.5 py-2 bg-nut-chinh text-white font-semibold text-xs rounded-xl hover:bg-nut-chinh-re-chuot transition cursor-pointer flex items-center gap-1.5"
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
                    <span className="px-2 py-0.5 text-2xs tabular-nums rounded-full bg-bg-card border border-border-primary text-text-muted">
                      {res.type}
                    </span>
                    <span className={`px-2 py-0.2 text-2xs tabular-nums rounded-full font-bold ${
                      res.status === "available" ? "bg-brand-success-bg text-brand-success" : "bg-brand-warning-bg text-brand-warning"
                    }`}>
                      {res.status === "available" ? "Đã có ✓" : "Còn thiếu"}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-text-primary leading-snug">{res.title}</h4>

                  <div className="flex items-center justify-between text-2xs tabular-nums text-text-muted border-t border-border-primary/60 pt-2">
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
            <h3 className="text-xs tabular-nums text-text-primary">
Kiến thức cần bổ sung
            </h3>

            <div className="space-y-3">
              {healthItems.map((item) => (
                <div key={item.chapterId} className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">{item.chapterTitle}</span>
                    <span className="text-xs tabular-nums font-bold text-brand-info">{item.coveragePercentage}% độ phủ</span>
                  </div>

                  <div className="w-full bg-bg-card border border-border-primary/60 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-brand-info h-full" style={{ width: `${item.coveragePercentage}%` }} />
                  </div>

                  {item.missingConcepts.length > 0 ? (
                    <div className="text-2xs tabular-nums text-brand-warning flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Thiếu khái niệm: {item.missingConcepts.join(", ")}</span>
                    </div>
                  ) : (
                    <span className="text-2xs tabular-nums text-brand-success block">Đã phủ 100% khái niệm trọng tâm ✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Version History Git-like log */}
          <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs tabular-nums text-text-primary">
Lịch sử cập nhật tài liệu
            </h3>

            <div className="space-y-3">
              {versions.map((ver) => (
                <div key={ver.version} className="p-4 bg-bg-surface border border-border-primary/80 rounded-xl space-y-2 tabular-nums text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-brand-info">{ver.version} ({ver.date})</span>
                    <span className="text-brand-success">Độ phủ: {ver.coveragePercentage}%</span>
                  </div>
                  <p className="text-text-primary font-sans">{ver.description}</p>
                  <div className="flex items-center gap-4 text-2xs text-text-muted pt-1 border-t border-border-primary/60">
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
          <h3 className="text-xs tabular-nums text-text-primary">
Nhật ký học tập
          </h3>

          <div className="space-y-4 relative pl-4 border-l border-border-primary/80">
            {timeline.map((item) => (
              <div key={item.id} className="relative space-y-1">
                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-brand-info border-2 border-bg-card" />
                <div className="flex items-center gap-2 text-xs tabular-nums">
                  <span className="text-text-muted">{item.date}</span>
                  <span className="px-2 py-0.2 bg-brand-info-bg text-brand-info rounded-full font-bold">{item.type}</span>
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
          <h3 className="text-xs tabular-nums text-text-primary">
Các mốc tiến bộ
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs tabular-nums">
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

          <div className="p-5 bg-bg-surface border border-border-primary rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-center tabular-nums">
            <div>
              <span className="text-2xs text-text-muted block">Mức nắm chắc</span>
              <span className="text-xl font-bold text-brand-success">{snapshots[selectedSnapshotIdx].masteryPct}%</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Điểm dự báo</span>
              <span className="text-xl font-bold text-brand-info">{snapshots[selectedSnapshotIdx].forecastScore.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Sổ câu sai</span>
              <span className="text-xl font-bold text-brand-warning">{snapshots[selectedSnapshotIdx].debtCount} câu</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Đã giải tổng cộng</span>
              <span className="text-xl font-bold text-text-primary">{snapshots[selectedSnapshotIdx].solvedQuestions} câu</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: MULTI-SUBJECT COMMAND CENTER */}
      {activeTab === "subjects" && (
        <div className="bg-bg-card border border-border-primary rounded-2xl p-6 space-y-4 shadow-sm">
          <h3 className="text-xs tabular-nums text-text-primary">
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
                    <span className="text-2xs tabular-nums text-brand-warning font-bold">
                      Còn {subPrediction.metricsBreakdown.remainingDays} ngày
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs tabular-nums">
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
          <h3 className="text-xs tabular-nums text-text-primary">
Báo cáo chất lượng học liệu
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center tabular-nums bg-bg-surface p-4 rounded-xl border border-border-primary/80">
            <div>
              <span className="text-2xs text-text-muted block">Độ phủ kiến thức</span>
              <span className="text-2xl font-bold text-brand-success">98%</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Tỷ lệ trùng lặp</span>
              <span className="text-2xl font-bold text-brand-info">1.2%</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Tổng số câu hỏi</span>
              <span className="text-2xl font-bold text-text-primary">{dbService.getQuestions().length}</span>
            </div>
            <div>
              <span className="text-2xs text-text-muted block">Cân bằng mức độ</span>
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
                <div className="p-6 text-center text-xs text-text-muted tabular-nums">
                  Gõ từ khóa để tra cứu khái niệm hoặc câu hỏi.
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted tabular-nums">
                  Không tìm thấy khái niệm hoặc câu hỏi nào chứa "{searchQuery}"
                </div>
              ) : (
                searchResults.slice(0, 5).map((q) => (
                  <div key={q.id} className="p-3 bg-bg-surface border border-border-primary rounded-xl space-y-1">
                    <span className="text-2xs tabular-nums text-brand-info">{q.concept || `Câu #${q.id}`}</span>
                    <p className="text-xs font-medium text-text-primary">{q.question}</p>
                    <span className="text-2xs text-text-muted tabular-nums block">Nguồn: {q.sourcePdf}</span>
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
              <h3 className="text-xs tabular-nums text-text-primary">
Tạo câu hỏi bằng AI từ tài liệu
              </h3>
              <button onClick={closeImportModal} className="text-text-muted hover:text-text-primary cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {successCount > 0 ? (
              /* Trạng thái thành công */
              <div className="space-y-4 py-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-brand-success-bg text-brand-success flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text-primary">Đã tạo {successCount} câu hỏi mới</p>
                  <p className="text-xs text-text-muted">
                    Câu hỏi đã được thêm vào ngân hàng môn <strong>{activeSubject?.name}</strong>. Bạn có thể luyện tập hoặc giải đề theo chương ngay.
                  </p>
                  {successNote && (
                    <p className="text-2xs text-brand-warning pt-1">{successNote}</p>
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
                    className="px-4 py-1.5 bg-nut-chinh text-white font-semibold text-xs rounded-xl hover:bg-nut-chinh-re-chuot cursor-pointer"
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
                    <div className="text-2xs text-text-muted mt-1">
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
                    <div className="text-2xs text-text-muted mt-1 tabular-nums">
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
                              ? "bg-brand-info-bg text-brand-info border-brand-info/40"
                              : "bg-bg-surface text-text-muted border-border-primary hover:text-text-primary"
                          }`}
                        >
                          {n} câu
                        </button>
                      ))}
                    </div>
                    {genCount > 8 && (
                      <div className="text-2xs text-text-muted mt-1 tabular-nums">
                        Tài liệu sẽ được chia nhỏ và gọi AI nhiều lượt tự động.
                      </div>
                    )}
                  </div>

                  {/* Thanh tiến trình khi đang gọi AI */}
                  {isImporting && (
                    <div className="p-3 bg-bg-surface border border-border-primary rounded-xl space-y-2 tabular-nums">
                      <div className="flex justify-between text-2xs text-brand-info">
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
                    <div className="p-3 bg-brand-error-bg border border-brand-error-border/40 rounded-xl text-2xs text-brand-error flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <span className="text-2xs text-text-muted">
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
                      className="px-4 py-1.5 bg-nut-chinh text-white font-semibold text-xs rounded-xl hover:bg-nut-chinh-re-chuot disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                    >
                      {isImporting ? (
                        "Đang tạo..."
                      ) : materialText.trim() ? (
                        <>
                          <Sparkles className="w-4 h-4" />
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
