/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Award, AlertTriangle, ShieldCheck, RefreshCw, Activity, Zap } from "lucide-react";
import { conceptMemoryService, ConceptMemoryProfile } from "../services/conceptMemoryService";
import { DongTrong } from "./EmptyState";
import { 
  studentEvolutionEngine, 
  EvolutionTimelineSnapshot, 
  StudentMilestone, 
  LearningPatternInsight, 
  EvolutionAuditEntry,
  JourneyStoryItem 
} from "../services/studentEvolutionEngine";
import { dbService } from "../services/db";

export default function LearningEvolutionView() {
  const [profiles, setProfiles] = useState<Record<string, ConceptMemoryProfile>>({});
  const [snapshots, setSnapshots] = useState<EvolutionTimelineSnapshot[]>([]);
  const [milestones, setMilestones] = useState<StudentMilestone[]>([]);
  const [insights, setInsights] = useState<LearningPatternInsight[]>([]);
  const [auditLog, setAuditLog] = useState<EvolutionAuditEntry[]>([]);
  const [journey, setJourney] = useState<JourneyStoryItem[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "concepts" | "forgetting" | "journey" | "milestones" | "patterns" | "audit">("timeline");

  const loadData = () => {
    const sId = dbService.getActiveSubjectId();
    const allProfiles = conceptMemoryService.getAllConceptProfiles(sId);
    const snaps = studentEvolutionEngine.getTimelineSnapshots(sId);
    const ms = studentEvolutionEngine.getMilestones(sId);
    const pats = studentEvolutionEngine.mineLearningPatterns(sId);
    const audit = studentEvolutionEngine.getAuditTrail(sId);
    const j = studentEvolutionEngine.generateLearningJourney(sId);

    setProfiles(allProfiles);
    setSnapshots(snaps);
    setMilestones(ms);
    setInsights(pats);
    setAuditLog(audit);
    setJourney(j);

    const conceptKeys = Object.keys(allProfiles);
    if (conceptKeys.length > 0 && !selectedConcept) {
      setSelectedConcept(conceptKeys[0]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const profileList: ConceptMemoryProfile[] = Object.values(profiles);
  const stableCount = profileList.filter(p => p.isStableMastered).length;
  const regressionCount = profileList.filter(p => p.isRegressionDetected).length;
  const inProgressCount = profileList.filter(p => !p.isStableMastered && !p.isRegressionDetected && p.timesStudied > 0).length;

  const currentSelectedProfile = selectedConcept ? profiles[selectedConcept] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      {/*
        TÊN ENGINE TIẾNG ANH ĐANG LÀM TIÊU ĐỀ CHO NGƯỜI HỌC ĐỌC.

        Tiêu đề của tab này là **"Long-Term Student Evolution & Memory Engine"**, tức tên nội bộ
        của một engine, in nguyên văn ở cỡ 20px đậm 700 làm tiêu đề mục. Bên dưới còn "Bản sao
        số" (dịch thẳng từ digital twin) và một ô ghi "Khái niệm **Stable**".

        Đây là ca nặng nhất của họ lỗi chuỗi tiếng Anh lọt ra giao diện, vì nó không nằm ở một
        nhãn phụ mà nằm ở chính TIÊU ĐỀ. Người học mở tab "Trí nhớ" ra và thứ đầu tiên đọc được
        là tên một lớp phần mềm.

        Ba lỗi khác cùng khối, cùng một gốc là viết cho lập trình viên đọc chứ không cho người
        học đọc:

        1. **Viết hoa giữa câu kiểu tiếng Anh**: "Đắc thụ Ổn định", "Cảnh báo Giảm sút", "Đang
           Phát triển", "Cột mốc Đạt được", "Cập nhật Tiến trình". Tiếng Việt không viết hoa
           giữa câu, và Khan cũng viết tiêu đề như câu bình thường.
        2. **"Milestones"** làm đơn vị đếm cho một con số.
        3. **Dùng thẳng bảng màu thô của Tailwind** thay cho token ngữ nghĩa của dự án: cả file
           có **40 chỗ** gọi các sắc độ nguyên bản kiểu emerald, indigo, amber, blue, red. Đây
           là lỗi hệ thống chứ không phải chuyện thẩm mỹ: nhóm kiểm **AF** chỉ quét được các tên
           `brand-*`, nên mọi chỗ đi vòng qua bộ token đều **lọt lưới**, và chế độ tối cũng
           không còn được bảo đảm vì các sắc độ ấy không có bản cho nền tối. Đã đổi hết 40 chỗ
           sang token ngữ nghĩa.

        Bốn thẻ số liệu gộp thành một dòng chữ theo đúng khuôn 2 ở AGENTS.md 4.9f.
      */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold text-text-primary font-sans">
            Trí nhớ và tiến trình dài hạn
          </h2>
          <p className="text-base text-text-secondary font-sans max-w-[40rem]">
            Theo dõi độ bền ghi nhớ và đường cong quên của từng khái niệm theo thời gian.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start shrink-0 flex items-center gap-2 px-4 h-10 text-sm font-bold border border-border-primary rounded bg-bg-card hover:bg-bg-surface transition cursor-pointer text-text-primary"
        >
          <RefreshCw className="w-4 h-4 text-text-muted shrink-0" />
          <span className="whitespace-nowrap">Cập nhật tiến trình</span>
        </button>
      </div>

      {/* Bốn con số viết thành một dòng, ngăn bằng vạch dọc như các màn khác */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-1 text-sm text-text-secondary font-sans border-y border-border-primary py-3">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 shrink-0 text-brand-success" />
          <span><strong className="text-text-primary">{stableCount}</strong> khái niệm đã vững</span>
        </span>
        <span className="flex items-center gap-1.5 sm:border-l sm:border-border-primary sm:pl-3.5 sm:ml-3.5">
          <Activity className="w-4 h-4 shrink-0 text-brand-info" />
          <span><strong className="text-text-primary">{inProgressCount}</strong> đang tiếp thu</span>
        </span>
        <span className="flex items-center gap-1.5 sm:border-l sm:border-border-primary sm:pl-3.5 sm:ml-3.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-text-muted" />
          <span><strong className="text-text-primary">{regressionCount}</strong> đang sụt, cần ôn lại</span>
        </span>
        <span className="flex items-center gap-1.5 sm:border-l sm:border-border-primary sm:pl-3.5 sm:ml-3.5">
          <Award className="w-4 h-4 shrink-0 text-text-muted" />
          <span><strong className="text-text-primary">{milestones.length}</strong> cột mốc đã đạt</span>
        </span>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border-primary pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "timeline"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Lịch sử tiến hóa
        </button>

        <button
          onClick={() => setActiveTab("concepts")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "concepts"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Hồ sơ khái niệm
        </button>

        <button
          onClick={() => setActiveTab("forgetting")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "forgetting"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Đường cong quên và độ ghi nhớ
        </button>

        <button
          onClick={() => setActiveTab("journey")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "journey"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Nhật ký hành trình
        </button>

        <button
          onClick={() => setActiveTab("milestones")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "milestones"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Cột mốc
        </button>

        <button
          onClick={() => setActiveTab("patterns")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "patterns"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Khai phá Phản xạ
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === "audit"
              ? "bg-bg-card border border-border-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          Nhật ký kiểm toán
        </button>
      </div>

      {/* Tab 1: Timeline */}
      {activeTab === "timeline" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary">
            <span>Diễn biến độ thạo qua từng lần ôn</span>
          </h3>

          {snapshots.length === 0 ? (
            <DongTrong>
              Chưa có mốc nào được ghi. Mỗi lượt bạn làm bài, hệ thống lưu lại một mốc để so sánh
              trí nhớ theo thời gian.
            </DongTrong>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snap) => (
                <div key={snap.id} className="p-4 bg-bg-surface border border-border-primary rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-primary">{snap.conceptName}</span>
                      {/*
                        Mã sự kiện của engine đang được in thẳng ra cho người học đọc: "STUDIED",
                        "REGRESSION_DETECTED", "STABLE_ACHIEVED"... Cùng họ lỗi với bốn chặng
                        "Weak / Learning / Recovered / Mastered" đã sửa ở màn Câu sai.

                        Bảng dịch đặt ngay tại chỗ hiển thị, có `?? snap.eventType` làm lối
                        thoát: engine thêm mã mới thì màn hình hiện mã đó chứ không hiện rỗng.
                      */}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        snap.eventType === "STABLE_ACHIEVED" ? "bg-brand-success-bg text-brand-success" :
                        snap.eventType === "REGRESSION_DETECTED" ? "bg-brand-error-bg text-brand-error" :
                        "bg-brand-info-bg text-brand-info"
                      }`}>
                        {({
                          STUDIED: "vừa ôn",
                          REGRESSION_DETECTED: "đang sụt",
                          RECOVERED: "đã gỡ lại",
                          MASTERED: "đã thạo",
                          FORGETTING_DECAY: "đang quên dần",
                          STABLE_ACHIEVED: "đã vững",
                        } as Record<string, string>)[snap.eventType] ?? snap.eventType}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">{snap.note}</p>
                    <span className="text-xs text-text-muted">{new Date(snap.timestamp).toLocaleString("vi-VN")}</span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-text-muted">Thông thạo</div>
                      <div className="text-base font-bold text-text-primary">{snap.mastery}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-muted">Độ ghi nhớ</div>
                      <div className="text-base font-bold text-brand-info">{Math.round(snap.retention * 100)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Concept Memory Digital Twin */}
      {activeTab === "concepts" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of Concepts */}
          <div className="bg-bg-card border border-border-primary rounded-xl p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-text-muted px-2 mb-2">Danh sách Khái niệm</h3>
            {profileList.length === 0 ? (
              <DongTrong>Chưa có khái niệm nào được theo dõi. Làm bài xong là các khái niệm bạn đã chạm sẽ hiện ở đây.</DongTrong>
            ) : (
              profileList.map((p) => (
                <button
                  key={p.conceptName}
                  onClick={() => setSelectedConcept(p.conceptName)}
                  className={`w-full text-left p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                    selectedConcept === p.conceptName
                      ? "bg-brand-info-bg border-brand-info/30 text-text-primary"
                      : "bg-bg-surface border-border-primary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm">{p.conceptName}</div>
                    <div className="text-xs text-text-muted">Ôn tập: {p.timesStudied} lần</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {p.isStableMastered && <ShieldCheck className="w-4 h-4 text-brand-success shrink-0" />}
                    {p.isRegressionDetected && <AlertTriangle className="w-4 h-4 text-brand-error shrink-0" />}
                    <span className="font-bold text-sm">{p.currentMastery}%</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Detailed Concept Profile */}
          <div className="lg:col-span-2 bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-6">
            {!currentSelectedProfile ? (
              <DongTrong>Chọn một khái niệm bên trái để xem chi tiết trí nhớ của khái niệm đó.</DongTrong>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border-primary pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{currentSelectedProfile.conceptName}</h3>
                    <p className="text-xs text-text-muted">ID: {currentSelectedProfile.conceptId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentSelectedProfile.isStableMastered && (
                      <span className="px-2.5 py-1 bg-brand-success-bg text-brand-success rounded text-xs font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4 shrink-0" /> Stable Mastered
                      </span>
                    )}
                    {currentSelectedProfile.isRegressionDetected && (
                      <span className="px-2.5 py-1 bg-brand-error-bg text-brand-error rounded text-xs font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> Regression Detected
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Đỉnh Tinh thông Lịch sử</span>
                    <div className="text-lg font-bold text-brand-success">{currentSelectedProfile.historicalPeak}%</div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Điểm Thấp nhất</span>
                    <div className="text-lg font-bold text-brand-warning">{currentSelectedProfile.historicalLowest}%</div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Độ ghi nhớ</span>
                    <div className="text-lg font-bold text-brand-info">{Math.round(currentSelectedProfile.retentionScore * 100)}%</div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Tỷ lệ Trả lời Đúng</span>
                    <div className="text-lg font-bold text-text-primary">
                      {currentSelectedProfile.timesStudied > 0 
                        ? Math.round((currentSelectedProfile.timesCorrect / currentSelectedProfile.timesStudied) * 100) 
                        : 0}%
                    </div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Thời gian suy nghĩ TB</span>
                    <div className="text-lg font-bold text-text-primary">{currentSelectedProfile.averageResponseTime} giây</div>
                  </div>

                  <div className="p-3 bg-bg-surface rounded-lg border border-border-primary">
                    <span className="text-xs text-text-muted">Phong cách Giảng dạy Đề xuất</span>
                    <div className="text-sm font-bold text-brand-info mt-1">{currentSelectedProfile.preferredTeachingStyle}</div>
                  </div>
                </div>

                {/* Explanation History / Teaching Memory */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-text-primary">Bộ nhớ giảng dạy</h4>
                  {currentSelectedProfile.explanationsHistory.length === 0 ? (
                    <DongTrong>Chưa có lần giải thích nào cho khái niệm này.</DongTrong>
                  ) : (
                    <div className="space-y-2">
                      {currentSelectedProfile.explanationsHistory.map((h, i) => (
                        <div key={i} className="p-2.5 bg-bg-surface border border-border-primary rounded flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-text-primary">{h.strategy}</span>
                            <span className="text-text-muted ml-2">({h.length})</span>
                          </div>
                          <span className={h.wasSuccessful ? "text-brand-success font-semibold" : "text-brand-error font-semibold"}>
                            {h.wasSuccessful ? "Thành công" : "Cần đổi chiến lược"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Forgetting Curve */}
      {activeTab === "forgetting" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-6">
          <h3 className="text-base font-semibold text-text-primary">
            <span>Mô hình Đường cong Quên Ebbinghaus & Lịch Ôn tập Thích ứng</span>
          </h3>

          <p className="text-sm text-text-secondary">
            AI tự động phân biệt giữa <strong>độ thông thạo</strong> (trình độ thu nạp) và <strong>độ ghi nhớ</strong> (mức độ dễ truy xuất thông tin hiện tại).
            Độ ghi nhớ sẽ suy giảm tự nhiên theo thời gian nếu không ôn lại ngắt quãng.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {profileList.map((p) => {
              const forgetCurve = conceptMemoryService.generateForgetCurve(p);
              return (
                <div key={p.conceptName} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary text-sm">{p.conceptName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      p.retentionScore >= 0.75 ? "bg-brand-success-bg text-brand-success" :
                      p.retentionScore >= 0.50 ? "bg-brand-warning-bg text-brand-warning" :
                      "bg-brand-error-bg text-brand-error"
                    }`}>
                      Độ ghi nhớ: {Math.round(p.retentionScore * 100)}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-text-muted mb-1">Dự báo duy trì trí nhớ:</div>
                    <div className="flex items-end gap-2 h-20 pt-2">
                      {forgetCurve.map((point, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <div 
                            className="w-full bg-brand-info/30 rounded-t hover:bg-brand-info transition-colors"
                            style={{ height: `${point.retention * 100}%` }}
                          />
                          <span className="text-2xs text-text-muted">+{point.daysAhead}d</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Learning Journey */}
      {activeTab === "journey" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary">
            <span>Nhật ký Tiến trình Học tập Tổng hợp</span>
          </h3>

          <div className="space-y-3">
            {journey.length === 0 ? (
              <DongTrong>Chưa đủ dữ liệu để dựng nhật ký hành trình. Cần thêm vài lượt làm bài.</DongTrong>
            ) : (
              journey.map((item, idx) => (
                <div key={idx} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary">{item.conceptName}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      item.status === "STABLE" ? "bg-brand-success-bg text-brand-success" :
                      item.status === "REGRESSED" ? "bg-brand-error-bg text-brand-error" :
                      "bg-brand-info-bg text-brand-info"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-text-secondary leading-relaxed">{item.narrativeText}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Milestones */}
      {activeTab === "milestones" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary">
            <span>Cột mốc Tiến bộ Học thuật</span>
          </h3>

          <div className="space-y-3">
            {milestones.length === 0 ? (
              <DongTrong>Chưa có cột mốc nào. Mốc được ghi khi một khái niệm chuyển sang mức thạo hơn.</DongTrong>
            ) : (
              milestones.map((ms) => (
                <div key={ms.id} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary">{ms.title}</span>
                    <span className="text-xs text-text-muted">{new Date(ms.timestamp).toLocaleDateString("vi-VN")}</span>
                  </div>
                  <p className="text-text-secondary">{ms.description}</p>
                  <p className="text-xs text-brand-success font-medium">Bằng chứng: {ms.evidence}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Learning Pattern Mining */}
      {activeTab === "patterns" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary">
            <span>Khai phá quy luật phản xạ học tập</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((ins, idx) => (
              <div key={idx} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-2 text-sm">
                <div className="font-bold text-text-primary flex items-center gap-2">
                  <Zap className="w-4 h-4 text-brand-warning shrink-0" />
                  <span>{ins.title}</span>
                </div>
                <p className="text-text-secondary">{ins.observation}</p>
                <p className="text-xs font-medium text-brand-info bg-brand-info-bg p-2 rounded">
                  Khuyến nghị: {ins.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 7: Explainability Audit Log */}
      {activeTab === "audit" && (
        <div className="bg-bg-card border border-border-primary rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-text-primary">
            <span>Nhật ký kiểm toán biến đổi mô hình người học</span>
          </h3>

          <div className="space-y-3">
            {auditLog.length === 0 ? (
              <DongTrong>Chưa có bản ghi nào.</DongTrong>
            ) : (
              auditLog.map((entry) => (
                <div key={entry.id} className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-2 text-sm">
                  <div className="flex items-center justify-between border-b border-border-primary pb-2">
                    <span className="font-bold text-text-primary">{entry.conceptName}</span>
                    <span className="text-xs text-text-muted">{new Date(entry.timestamp).toLocaleString("vi-VN")}</span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-text-muted">Lý do: </span>
                    <span className="text-text-secondary">{entry.reason}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span><strong>Trạng thái trước:</strong> {entry.previousState}</span>
                    <span><strong>Trạng thái mới:</strong> {entry.newState}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
