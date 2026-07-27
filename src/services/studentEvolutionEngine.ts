/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService, dangKyDonDuLieuSuyRa } from "./db";
import { TimeService } from "./time";
import { conceptMemoryService, ConceptMemoryProfile, ConceptMemoryUpdate } from "./conceptMemoryService";
import { studentModelService, doTuTinTuCoNghiVan, luotCoNhipNhanh } from "./learnerModel";
import { PedagogicalEvaluation, pedagogicalEvaluationEngine } from "./pedagogicalEvaluationEngine";
import { kbService } from "./kbService";

export interface EvolutionTimelineSnapshot {
  id: string;
  timestamp: string;
  conceptName: string;
  mastery: number;
  retention: number;
  eventType: "STUDIED" | "REGRESSION_DETECTED" | "RECOVERED" | "MASTERED" | "FORGETTING_DECAY" | "STABLE_ACHIEVED";
  changeDelta: number;
  note?: string;
}

export interface StudentMilestone {
  id: string;
  timestamp: string;
  conceptName: string;
  type: "CONCEPT_MASTERED" | "RECOVERED" | "FAST_LEARNER" | "PERSISTENT_MISCONCEPTION" | "LONG_TERM_STABLE" | "EXCELLENT_IMPROVEMENT";
  title: string;
  description: string;
  evidence: string;
}

export interface LearningPatternInsight {
  type: "time_of_day" | "teaching_style" | "speed_accuracy" | "fatigue_impact";
  title: string;
  observation: string;
  recommendation: string;
  confidence: number; // 0.0 to 1.0
}

export interface EvolutionAuditEntry {
  id: string;
  timestamp: string;
  conceptName: string;
  metricTriggered: string;
  previousState: string;
  newState: string;
  reason: string;
  evidenceUsed: string;
}

export interface JourneyStoryItem {
  conceptName: string;
  initialMastery: number;
  currentMastery: number;
  sessionsCount: number;
  status: "STABLE" | "IMPROVING" | "REGRESSED" | "NEEDS_REVIEW";
  narrativeText: string; // Structured text synthesized by code
}

const EVOLUTION_TIMELINE_KEY = "poly_econ_evolution_timeline_";
const MILESTONES_KEY = "poly_econ_student_milestones_";
const AUDIT_LOG_KEY = "poly_econ_evolution_audit_";

export const studentEvolutionEngine = {
  /**
   * Main entry point called after an interaction is evaluated by Evidence Pipeline.
   * Processes interaction, updates concept memory, detects regression, checks stable mastery,
   * generates milestones, and logs explainability audit trail.
   */
  processInteraction(params: {
    conceptName: string;
    update: ConceptMemoryUpdate;
    evaluation: PedagogicalEvaluation;
    subjectId?: string;
  }): {
    updatedProfile: ConceptMemoryProfile;
    snapshot: EvolutionTimelineSnapshot;
    milestone?: StudentMilestone;
    auditEntry: EvolutionAuditEntry;
  } {
    const sId = params.subjectId || dbService.getActiveSubjectId();
    const nowISO = TimeService.now().toISOString();
    const profiles = conceptMemoryService.getAllConceptProfiles(sId);
    let profile = profiles[params.conceptName] || conceptMemoryService.getConceptProfile(params.conceptName, sId);

    const prevMastery = profile.currentMastery;
    const prevRetention = profile.retentionScore;
    const prevStable = profile.isStableMastered;

    // Độ ghi nhớ LÚC QUAY LẠI HỌC, tính khi `lastReviewAt` vẫn còn là mốc của lần học trước.
    //
    // Vì sao phải tính ở đây: bên dưới, `lastReviewAt` được đặt thành thời điểm hiện tại rồi mới
    // gọi `calculateRetentionScore`, nên số ngày trôi qua luôn bằng 0 và kết quả luôn đúng
    // **1,00**. Bộ quét ngày 27/07/2026 bắt được: trường `retention` của mọi mốc thời gian đứng
    // yên ở 1 qua cả năm hồ sơ học từ đúng 0% tới 100%. Mà `LearningEvolutionView` lại hiển thị
    // nó thành phần trăm, nên cột "Độ ghi nhớ" trên màn Tiến hóa **vĩnh viễn hiện 100%**.
    //
    // Con số có ý nghĩa tại thời điểm này là: người học quay lại sau bao lâu thì còn nhớ được
    // bao nhiêu. Đó mới là thứ một dòng thời gian tiến hóa cần ghi.
    const doGhiNhoKhiQuayLai = conceptMemoryService.calculateRetentionScore(profile);

    // 1. Calculate new Mastery Score deterministically
    const performanceGain = params.update.wasCorrect ? 10 : -8;
    const confidenceModifier = (params.update.confidence - 0.5) * 5;
    const timeSpeedFactor = params.update.responseTimeSeconds < 10 && params.update.wasCorrect ? 3 : 0;
    
    let rawNewMastery = Math.max(0, Math.min(100, prevMastery + performanceGain + confidenceModifier + timeSpeedFactor));
    
    // Smooth transition
    const newMastery = Math.round(prevMastery * 0.4 + rawNewMastery * 0.6);

    // 2. Update basic statistics
    profile.timesStudied += 1;
    if (params.update.wasCorrect) {
      profile.timesCorrect += 1;
    } else {
      profile.timesWrong += 1;
    }

    profile.averageResponseTime = Math.round(
      (profile.averageResponseTime * (profile.timesStudied - 1) + params.update.responseTimeSeconds) / profile.timesStudied
    );

    profile.averageConfidence = Number(
      ((profile.averageConfidence * (profile.timesStudied - 1) + params.update.confidence) / profile.timesStudied).toFixed(2)
    );

    // Đếm riêng số lượt có tín hiệu tự khai THẬT. `conceptMemoryService` chỉ dám xếp loại
    // hiệu chuẩn khi con số này đủ lớn, xem `TOI_THIEU_TIN_HIEU_TU_TIN`.
    if (params.update.coTinHieuTuTin !== false) {
      profile.confidenceSignalCount = (profile.confidenceSignalCount || 0) + 1;
    }

    // Update Peak & Lowest
    profile.historicalPeak = Math.max(profile.historicalPeak, newMastery);
    profile.historicalLowest = Math.min(profile.historicalLowest, newMastery);
    profile.currentMastery = newMastery;
    profile.lastReviewAt = nowISO;

    // Calculate Retention
    profile.retentionScore = conceptMemoryService.calculateRetentionScore(profile);
    profile.estimatedForgetCurve = conceptMemoryService.generateForgetCurve(profile);

    // Update Misconceptions
    if (params.update.detectedMisconception) {
      profile.misconceptionHistory.unshift({
        misconception: params.update.detectedMisconception,
        timestamp: nowISO,
        resolved: false,
        questionId: params.update.questionId
      });
    } else if (params.update.wasCorrect && profile.misconceptionHistory.length > 0) {
      // Mark latest unresolved misconception as resolved
      const unresolved = profile.misconceptionHistory.find(m => !m.resolved);
      if (unresolved) unresolved.resolved = true;
    }

    // 3. Regression Detection
    let isRegression = false;
    if ((prevMastery - newMastery >= 15) || (profile.retentionScore < 0.50 && prevMastery >= 60)) {
      isRegression = true;
      profile.isRegressionDetected = true;
      profile.regressionCount += 1;
    } else if (params.update.wasCorrect && profile.isRegressionDetected && newMastery >= prevMastery) {
      profile.isRegressionDetected = false;
      profile.recoveryCount += 1;
    }

    // 4. Stable Mastery Check
    const activeMisconceptions = profile.misconceptionHistory.filter(m => !m.resolved).length;
    const isStable = newMastery >= 85 && profile.timesStudied >= 3 && activeMisconceptions === 0 && profile.retentionScore >= 0.75;
    profile.isStableMastered = isStable;

    // Update scoreHistory & bloomPerformance
    profile.scoreHistory = profile.scoreHistory || [];
    profile.scoreHistory.push({
      timestamp: nowISO,
      score: newMastery,
      bloomLevel: params.evaluation.bloomLevel || "Understand",
      timeSpent: params.update.responseTimeSeconds,
      confidence: params.update.confidence,
      questionId: params.update.questionId
    });

    const bloom = params.evaluation.bloomLevel || "Understand";
    profile.bloomPerformance = profile.bloomPerformance || {};
    const currentBloom = profile.bloomPerformance[bloom] || { attempts: 0, correct: 0, accuracy: 0 };
    const newAttempts = currentBloom.attempts + 1;
    const newCorrect = currentBloom.correct + (params.update.wasCorrect ? 1 : 0);
    profile.bloomPerformance[bloom] = {
      attempts: newAttempts,
      correct: newCorrect,
      accuracy: Number((newCorrect / newAttempts).toFixed(2))
    };

    // Recompute all 10 Learning Dynamics
    profile = conceptMemoryService.recomputeConceptDynamics(profile);

    // 5. Determine Event Type
    let eventType: EvolutionTimelineSnapshot["eventType"] = "STUDIED";
    if (isStable && !prevStable) {
      eventType = "STABLE_ACHIEVED";
    } else if (isRegression) {
      eventType = "REGRESSION_DETECTED";
    } else if (profile.recoveryCount > 0 && params.update.wasCorrect && prevMastery < 60 && newMastery >= 60) {
      eventType = "RECOVERED";
    } else if (newMastery >= 85) {
      eventType = "MASTERED";
    }

    // Save updated profile
    profiles[params.conceptName] = profile;
    conceptMemoryService.saveAllConceptProfiles(profiles, sId);

    // Sync back to studentModelService for global consistency
    studentModelService.updateConceptMastery(params.conceptName, newMastery);

    // Record teaching memory explanation attempt
    conceptMemoryService.recordExplanation(
      params.conceptName,
      params.update.teachingStrategy,
      params.update.explanationLength,
      params.update.wasCorrect,
      sId
    );

    // 6. Record Evolution Timeline Snapshot
    const snapshot: EvolutionTimelineSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowISO,
      conceptName: params.conceptName,
      mastery: newMastery,
      // Ghi độ ghi nhớ ĐO TRƯỚC khi cập nhật mốc ôn, xem chú thích ở đầu hàm. Dùng
      // `profile.retentionScore` ở đây là ghi lại đúng 1,00 mãi mãi.
      retention: doGhiNhoKhiQuayLai,
      eventType,
      changeDelta: newMastery - prevMastery,
      note: `Tương tác làm bài: ${params.update.wasCorrect ? "Đúng" : "Sai"}. Tinh thông ${prevMastery} -> ${newMastery}.`
    };
    this.addTimelineSnapshot(snapshot, sId);

    // 7. Check Milestone Generation
    let milestone: StudentMilestone | undefined = undefined;
    if (eventType === "STABLE_ACHIEVED") {
      milestone = {
        id: `ms_${Date.now()}`,
        timestamp: nowISO,
        conceptName: params.conceptName,
        type: "LONG_TERM_STABLE",
        title: "Đạt trạng thái Đắc thụ Ổn định",
        description: `Khái niệm "${params.conceptName}" đã đạt điểm tinh thông ${newMastery}% và giữ ổn định qua nhiều phiên học.`,
        evidence: `Mastery ${newMastery}%, ${profile.timesStudied} lượt ôn tập, 0 bẫy hiểu sai.`
      };
    } else if (eventType === "RECOVERED") {
      milestone = {
        id: `ms_${Date.now()}`,
        timestamp: nowISO,
        conceptName: params.conceptName,
        type: "RECOVERED",
        title: "Khôi phục Tinh thông Thành công",
        description: `Đã vượt qua bẫy hiểu sai và khôi phục điểm tinh thông cho khái niệm "${params.conceptName}".`,
        evidence: `Mastery tăng từ ${prevMastery}% lên ${newMastery}%.`
      };
    } else if (newMastery - prevMastery >= 25) {
      milestone = {
        id: `ms_${Date.now()}`,
        timestamp: nowISO,
        conceptName: params.conceptName,
        type: "FAST_LEARNER",
        title: "Tăng trưởng Tinh thông Bứt phá",
        description: `Tiếp thu cực nhanh khái niệm "${params.conceptName}" chỉ trong một phiên học.`,
        evidence: `Đạt +${newMastery - prevMastery} điểm tinh thông.`
      };
    }

    if (milestone) {
      this.addMilestone(milestone, sId);
    }

    // 8. Log Explainability Audit Entry
    const auditEntry: EvolutionAuditEntry = {
      id: `audit_evo_${Date.now()}`,
      timestamp: nowISO,
      conceptName: params.conceptName,
      metricTriggered: `Mastery & Retention (${prevMastery} -> ${newMastery})`,
      previousState: `Mastery: ${prevMastery}%, Retention: ${prevRetention}`,
      newState: `Mastery: ${newMastery}%, Retention: ${profile.retentionScore}, Stable: ${isStable}`,
      reason: params.update.wasCorrect
        ? "Trả lời chính xác, gia tăng tinh thông và khôi phục độ ghi nhớ."
        : `Phát hiện câu trả lời chưa đúng${params.update.detectedMisconception ? ` (${params.update.detectedMisconception})` : ""}, điều chỉnh tinh thông.`,
      evidenceUsed: `ResponseTime: ${params.update.responseTimeSeconds}s, Confidence: ${params.update.confidence}, Strategy: ${params.update.teachingStrategy}`
    };
    this.addAuditEntry(auditEntry, sId);

    return { updatedProfile: profile, snapshot, milestone, auditEntry };
  },

  /**
   * Appends timeline snapshot, keeping maximum 100 entries per subject to save space.
   */
  addTimelineSnapshot(snapshot: EvolutionTimelineSnapshot, subjectId?: string): void {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${EVOLUTION_TIMELINE_KEY}${sId}`;
    try {
      const raw = localStorage.getItem(key);
      const list: EvolutionTimelineSnapshot[] = raw ? JSON.parse(raw) : [];
      list.unshift(snapshot);
      // Keep only recent 100 snapshots
      const trimmed = list.slice(0, 100);
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch (e) {
      console.error("[studentEvolutionEngine] Error adding snapshot:", e);
    }
  },

  /**
   * Retrieves evolution timeline.
   */
  getTimelineSnapshots(subjectId?: string): EvolutionTimelineSnapshot[] {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${EVOLUTION_TIMELINE_KEY}${sId}`;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Stores milestone.
   */
  addMilestone(milestone: StudentMilestone, subjectId?: string): void {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${MILESTONES_KEY}${sId}`;
    try {
      const raw = localStorage.getItem(key);
      const list: StudentMilestone[] = raw ? JSON.parse(raw) : [];
      list.unshift(milestone);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 30)));
    } catch (e) {
      console.error("[studentEvolutionEngine] Error adding milestone:", e);
    }
  },

  /**
   * Retrieves milestones list.
   */
  getMilestones(subjectId?: string): StudentMilestone[] {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${MILESTONES_KEY}${sId}`;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Stores audit entry.
   */
  addAuditEntry(entry: EvolutionAuditEntry, subjectId?: string): void {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${AUDIT_LOG_KEY}${sId}`;
    try {
      const raw = localStorage.getItem(key);
      const list: EvolutionAuditEntry[] = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
    } catch (e) {
      console.error("[studentEvolutionEngine] Error adding audit entry:", e);
    }
  },

  /**
   * Retrieves audit trail.
   */
  getAuditTrail(subjectId?: string): EvolutionAuditEntry[] {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${AUDIT_LOG_KEY}${sId}`;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Synthesizes a structured Learning Journey story for display and AI context.
   * Deterministic narrative generated by code.
   */
  generateLearningJourney(subjectId?: string): JourneyStoryItem[] {
    const profiles = conceptMemoryService.getAllConceptProfiles(subjectId);
    const items: JourneyStoryItem[] = [];

    Object.values(profiles).forEach(p => {
      if (p.timesStudied === 0) return;

      let status: JourneyStoryItem["status"] = "IMPROVING";
      if (p.isStableMastered) status = "STABLE";
      else if (p.isRegressionDetected) status = "REGRESSED";
      else if (p.currentMastery < 50) status = "NEEDS_REVIEW";

      let narrativeText = "";
      if (p.isStableMastered) {
        narrativeText = `Khái niệm "${p.conceptName}" đạt trạng thái tinh thông ổn định (${p.currentMastery}%). Đã qua ${p.timesStudied} lượt ôn tập và không còn bẫy hiểu sai.`;
      } else if (p.isRegressionDetected) {
        narrativeText = `Phát hiện giảm sút tinh thông hoặc độ ghi nhớ cho "${p.conceptName}" (Hiện tại: ${p.currentMastery}%). Cần ưu tiên ôn tập theo đường cong quên.`;
      } else if (p.recoveryCount > 0) {
        narrativeText = `Đã khôi phục thành công điểm tinh thông cho "${p.conceptName}" từ mức thấp nhất ${p.historicalLowest}% lên ${p.currentMastery}%.`;
      } else {
        narrativeText = `Đang tiếp thu khái niệm "${p.conceptName}" (Điểm hiện tại: ${p.currentMastery}% qua ${p.timesStudied} phiên học).`;
      }

      items.push({
        conceptName: p.conceptName,
        initialMastery: p.historicalLowest,
        currentMastery: p.currentMastery,
        sessionsCount: p.timesStudied,
        status,
        narrativeText
      });
    });

    return items;
  },

  /**
   * Mines real learning patterns from study data.
   */
  mineLearningPatterns(subjectId?: string): LearningPatternInsight[] {
    const sId = subjectId || dbService.getActiveSubjectId();
    const snapshots = this.getTimelineSnapshots(sId);
    const profiles = conceptMemoryService.getAllConceptProfiles(sId);
    const insights: LearningPatternInsight[] = [];

    // Pattern 1: Time of day analysis
    let morningCorrect = 0, morningTotal = 0;
    let eveningCorrect = 0, eveningTotal = 0;

    snapshots.forEach(s => {
      const hour = new Date(s.timestamp).getHours();
      const isPos = s.changeDelta > 0;
      if (hour >= 6 && hour < 12) {
        morningTotal++;
        if (isPos) morningCorrect++;
      } else if (hour >= 18 && hour < 24) {
        eveningTotal++;
        if (isPos) eveningCorrect++;
      }
    });

    if (morningTotal >= 3 && eveningTotal >= 3) {
      const mAcc = morningCorrect / morningTotal;
      const eAcc = eveningCorrect / eveningTotal;
      if (Math.abs(mAcc - eAcc) >= 0.15) {
        const betterTime = mAcc > eAcc ? "buổi sáng (6h-12h)" : "buổi tối (18h-24h)";
        insights.push({
          type: "time_of_day",
          title: "Khung thời gian tiếp thu tối ưu",
          observation: `Tỷ lệ làm đúng vào ${betterTime} đạt ${Math.round((mAcc > eAcc ? mAcc : eAcc) * 100)}%, cao hơn rõ rệt so với khung giờ còn lại.`,
          recommendation: `Nên sắp xếp các bài học khái niệm khó vào ${betterTime} để đạt hiệu quả tối đa.`,
          confidence: 0.85
        });
      }
    }

    // Pattern 2: Teaching style effectiveness
    let bestStyle = "Academic";
    let maxSuccessRate = 0;
    const styleCounts: Record<string, { total: number; success: number }> = {};

    Object.values(profiles).forEach(p => {
      p.explanationsHistory.forEach(h => {
        if (!styleCounts[h.strategy]) styleCounts[h.strategy] = { total: 0, success: 0 };
        styleCounts[h.strategy].total++;
        if (h.wasSuccessful) styleCounts[h.strategy].success++;
      });
    });

    Object.entries(styleCounts).forEach(([style, val]) => {
      if (val.total >= 3) {
        const rate = val.success / val.total;
        if (rate > maxSuccessRate) {
          maxSuccessRate = rate;
          bestStyle = style;
        }
      }
    });

    if (maxSuccessRate > 0) {
      insights.push({
        type: "teaching_style",
        title: "Phương pháp giảng dạy phản hồi tốt nhất",
        observation: `Phương pháp "${bestStyle}" mang lại tỷ lệ tiếp thu đúng lên tới ${Math.round(maxSuccessRate * 100)}%.`,
        recommendation: `Adaptive Engine sẽ ưu tiên xuất ra diễn giải theo phong cách ${bestStyle}.`,
        confidence: 0.90
      });
    }

    // Default insight if data is sparse
    if (insights.length === 0) {
      insights.push({
        type: "speed_accuracy",
        title: "Tối ưu hóa Phản xạ Học tập",
        observation: "Dữ liệu tương tác đang được thu thập liên tục để trích xuất quy luật tư duy riêng biệt.",
        recommendation: "Tiếp tục hoàn thành thêm các câu hỏi ôn tập để kích hoạt AI Pattern Mining.",
        confidence: 0.70
      });
    }

    return insights;
  }
};

/**
 * Nhãn dành riêng cho lượt NGƯỜI HỌC TỰ LÀM BÀI, không có ai giảng.
 *
 * Bản cũ dán nhãn `"STORY_METAPHOR"` cho mọi câu trả lời trong đề thi, tức khẳng định rằng
 * người học vừa được dạy bằng phương pháp kể chuyện ẩn dụ, trong khi thực tế họ chỉ bấm chọn
 * một phương án. Nhãn đó chảy vào bảng hiệu quả chiến lược và vào phân bố phong cách giảng
 * dạy trên màn Phân tích giảng dạy.
 */
export const NHAN_TU_LAM_BAI = "Tự làm bài";

// Đồng bộ hồ sơ tiến hóa và trí nhớ khái niệm mỗi khi người học nộp một đề.
//
// VÌ SAO VIẾT LẠI (27/07/2026). Đây là CÂY CẦU DUY NHẤT nối "làm bài" với toàn bộ tầng trí
// nhớ, nhưng nó tự viết tay một bản đánh giá sư phạm gồm 15 trường hằng số (hiệu quả 0,9 hoặc
// 0,3, mức tăng độ thạo 10 hoặc -8, khoảng ôn lại 48 hoặc 12 giờ, cả 9 chỉ số con đều là số
// cứng 0,8 và 0,85 và 0,4 và 0,1), trong khi `pedagogicalEvaluationEngine.evaluateInteraction`
// ĐÃ CÓ SẴN toàn bộ logic tính đúng những trường đó một cách tất định.
//
// Hai hệ quả đo được:
//   - `getEvaluationHistory` rỗng 0 bản ghi sau 5 đề đã nộp, vì bản viết tay không đi qua
//     engine nên không được lưu. Màn Phân tích giảng dạy báo 0 tương tác cho một người vừa
//     làm 100 câu.
//   - `recommendedReviewInterval` cứng 48 hoặc 12 giờ, chạy song song và mâu thuẫn với lịch
//     ôn thật do `conceptMemoryService` tính từ độ bền trí nhớ. Hai lịch ôn cho cùng một
//     khái niệm, đúng khuôn "hai đường cong quên" đã phải gộp trước đó.
dbService.addOnSubmit((attempt) => {
  if (!attempt || !attempt.answers) return;
  const activeSubjectId = dbService.getActiveSubjectId();
  const answers = attempt.answers;
  const questionMap = dbService.getQuestionMap();
  const totalAns = Object.keys(answers).length;
  if (totalAns === 0) return;

  // Thời gian mỗi câu là PHÂN BỔ ĐỀU, không phải đo được. Ứng dụng chỉ ghi tổng thời gian của
  // cả lượt, không ghi thời gian từng câu. Đã cân nhắc phân bổ theo `estimatedTime` cho có
  // phân hóa, nhưng đo lại thì trường đó gần như KHÔNG bám độ khó (trung bình 34,7s cho câu
  // Dễ, 35,3s cho Trung bình, 35,2s cho Khó), nên chia theo nó chỉ tạo phân hóa giả.
  const timeSpentPerQ = Math.max(5, Math.round((attempt.timeSpent || 0) / Math.max(1, totalAns)));

  // Nhịp của CHÍNH lượt này so với tổng thời gian ước tính của các câu trong đề. Dùng lại
  // đúng ngưỡng của `doNhipLamBai` để cả dự án chỉ có một định nghĩa "làm nhanh bất thường".
  const lamVoiVang = luotCoNhipNhanh(attempt);

  const studentModel = studentModelService.getStudentModel();

  Object.entries(answers).forEach(([qIdStr, answer]) => {
    const qId = parseInt(qIdStr);
    const q = questionMap.get(qId);
    if (!q) return;

    const isCorrect = q.correctAnswer === answer;
    const conceptNode = kbService.getConceptForQuestion(activeSubjectId, q);
    const conceptName = conceptNode ? conceptNode.concept : (q.knowledgeMapping?.[0] || q.concept || "Khái niệm môn học");
    // Độ tự tin lấy từ nút cờ nghi vấn người học tự bấm, KHÔNG suy ngược từ đúng sai.
    // Lý do và cách chọn ba mức nằm ở `doTuTinTuCoNghiVan` trong learnerModel.ts.
    const doTuTin = doTuTinTuCoNghiVan(attempt.flags, qId);
    const coTinHieuTuTin = (attempt.flags || []).length > 0;

    // Bẫy hiểu sai lấy từ tầng KHÁI NIỆM biên soạn tay. Bản cũ nhét nguyên văn `q.explanation`
    // vào đây, nghĩa là cả đoạn lời giải bị ghi lại thành "điều người học hiểu sai", rồi hiện
    // nguyên như vậy trên màn Tiến hóa và trong bảng lỗi hay mắc.
    const bayHieuSai = isCorrect
      ? undefined
      : (kbService.layCanhBaoBayHocThuat(activeSubjectId, q) || undefined);

    const danhGia = pedagogicalEvaluationEngine.evaluateInteraction({
      // Engine không đọc hai trường này (đã dò: `learningPlan` và `teachingDecision` được rút
      // ra rồi bỏ không), nhưng chữ ký vẫn đòi nên truyền bản tối thiểu, không bịa nội dung.
      learningPlan: { bloom: q.bloomLevel || "Understand" } as any,
      teachingDecision: { actionType: NHAN_TU_LAM_BAI } as any,
      studentModel,
      question: q,
      studentAnswer: String(answer),
      correctAnswer: q.correctAnswer,
      responseTimeSeconds: timeSpentPerQ,
      retryCount: 0,
      confidence: doTuTin,
      guessDetection: lamVoiVang,
      evidenceCoverage: 1,
      teachingStrategy: NHAN_TU_LAM_BAI,
      bloomLevel: q.bloomLevel || "Understand",
      misconceptionType: bayHieuSai,
      conceptName,
      // Không có ai giảng thì không được ghi vào bảng hiệu quả chiến lược giảng dạy.
      capNhatBangChienLuoc: false
    });

    studentEvolutionEngine.processInteraction({
      conceptName,
      subjectId: activeSubjectId,
      update: {
        wasCorrect: isCorrect,
        confidence: doTuTin,
        coTinHieuTuTin,
        responseTimeSeconds: timeSpentPerQ,
        teachingStrategy: NHAN_TU_LAM_BAI,
        explanationLength: "balanced",
        detectedMisconception: bayHieuSai,
        questionId: qId
      },
      evaluation: danhGia
    });

    // Bảng "lỗi hay mắc" trên màn Phân tích giảng dạy đọc `studentModel.misconceptionHistory`,
    // mà kho đó trước nay CHỈ được nuôi từ tương tác với gia sư AI (`evidencePipeline`). Người
    // học làm sai 100 câu trong đề thi vẫn thấy bảng rỗng. Nay ghi luôn từ lượt làm bài.
    if (bayHieuSai) {
      studentModelService.logMisconception(conceptName, bayHieuSai, qId);
    }
  });
});

// Dòng thời gian tiến hóa, nhật ký và các mốc đều suy ra từ lịch sử làm bài, nên xóa tiến
// trình thì phải dọn cùng. Xem chú thích ở `dangKyDonDuLieuSuyRa` trong db.ts.
dangKyDonDuLieuSuyRa("studentEvolution", (subjectId) => {
  localStorage.removeItem(`${EVOLUTION_TIMELINE_KEY}${subjectId}`);
  localStorage.removeItem(`${MILESTONES_KEY}${subjectId}`);
  localStorage.removeItem(`${AUDIT_LOG_KEY}${subjectId}`);
});
