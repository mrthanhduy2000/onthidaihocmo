/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdaptiveMemory, studentModelService, StudentModel } from "./learnerModel";
import { PedagogicalEvaluation, pedagogicalEvaluationEngine } from "./pedagogicalEvaluationEngine";
import { dangKyDonDuLieuSuyRa, dbService } from "./db";

export interface PolicyAuditEntry {
  id: string;
  timestamp: string;
  decision: string;
  reason: string;
  evidenceUsed: string;
  metricTriggered: string;
  policyApplied: string;
}

export interface AdaptivePolicyResult {
  auditEntry: PolicyAuditEntry;
  updatedAdaptiveMemory: AdaptiveMemory;
}

// Gắn mã môn từ 13/08/2026. Nhật ký chọn phong cách dạy của môn này không được lẫn sang môn khác,
// vì chính nó là đầu vào để chọn phong cách dạy cho lượt sau.
const POLICY_AUDIT_LOG_KEY = () => `poly_econ_policy_audit_log_${dbService.getActiveSubjectId()}`;
const MAX_AUDIT_LOGS = 50;

export const adaptiveTeachingPolicy = {
  /**
   * Dynamically evaluates teaching effectiveness and updates future teaching policy rules in AdaptiveMemory.
   * All policy adjustments are 100% deterministic and auditable.
   */
  evaluateAndUpdatePolicy(
    studentModel: StudentModel,
    latestEvaluation: PedagogicalEvaluation
  ): AdaptivePolicyResult {
    const memory = { ...studentModel.adaptiveMemory };
    const strategyStats = pedagogicalEvaluationEngine.getStrategyStats();
    
    let decision = "Duy trì chính sách giảng dạy hiện tại.";
    let reason = "Chỉ số học tập của học viên đạt trạng thái ổn định.";
    let evidenceUsed = `Độ tinh thông: ${studentModel.conceptMastery[latestEvaluation.conceptName] || 50}%, Hiệu quả: ${Math.round(latestEvaluation.effectivenessScore * 100)}%`;
    let metricTriggered = "Metrics trong ngưỡng tiêu chuẩn.";
    let policyApplied = "Policy Standard Maintainance";

    // 1. Consecutive Failure Rule
    const currentStyle = latestEvaluation.teachingStrategy;
    const failures = (memory.consecutiveFailures?.[currentStyle] || 0) + (latestEvaluation.teachingWorked ? 0 : 1);
    memory.consecutiveFailures = { ...memory.consecutiveFailures, [currentStyle]: latestEvaluation.teachingWorked ? 0 : failures };

    if (failures >= 3 && currentStyle === "Expert") {
      memory.preferredTeachingStyle = "Academic";
      decision = "Giảm ưu tiên phương pháp Expert; chuyển sang phong cách Academic chuẩn hóa.";
      reason = "Phương pháp Expert thất bại trong 3 phiên liên tiếp. Cần định dạng giải thích cấu trúc rõ ràng hơn.";
      metricTriggered = `3 consecutive failures in ${currentStyle}`;
      policyApplied = "Policy Rule #1: Expert Failure Fallback to Academic";
    }

    // 2. High Retention / Strategy Optimization Rule
    let bestStrategy = memory.preferredTeachingStyle;
    let maxSuccessRate = 0;
    Object.entries(strategyStats).forEach(([name, stats]) => {
      if (stats.totalInteractions >= 3 && stats.successRate > maxSuccessRate) {
        maxSuccessRate = stats.successRate;
        bestStrategy = name as any;
      }
    });

    if (bestStrategy !== memory.preferredTeachingStyle && maxSuccessRate >= 0.75) {
      memory.preferredTeachingStyle = bestStrategy;
      decision = `Tối ưu hóa phong cách giảng dạy ưu tiên thành "${bestStrategy}".`;
      reason = `Dữ liệu thực nghiệm cho thấy phong cách ${bestStrategy} đạt tỷ lệ thành công cao nhất (${Math.round(maxSuccessRate * 100)}%).`;
      metricTriggered = `Top Strategy Success Rate (${Math.round(maxSuccessRate * 100)}%)`;
      policyApplied = "Policy Rule #2: Maximize High Retention Strategy";
    }

    // 3. Question Fatigue & Cognitive Load Rule
    if (memory.questionFatigue > 60 || latestEvaluation.metrics.cognitiveLoad > 0.85) {
      memory.preferredExplanationLength = "short";
      memory.preferredExampleDensity = 0.4;
      memory.preferredDifficultyCurve = "gentle";
      decision = "Thu gọn độ dài giải thích và hạ nhịp độ câu hỏi để giảm tải nhận thức.";
      reason = `Phát hiện mệt mỏi nhận thức (Chỉ số mệt mỏi: ${memory.questionFatigue}%, Cognitive Load: ${Math.round(latestEvaluation.metrics.cognitiveLoad * 100)}%).`;
      metricTriggered = "High Cognitive Load / Fatigue Alert";
      policyApplied = "Policy Rule #3: Dynamic Fatigue & Load Mitigation";
    } else if (memory.questionFatigue < 20 && latestEvaluation.effectivenessScore > 0.85) {
      memory.preferredExplanationLength = "deep";
      memory.preferredExampleDensity = 0.8;
      memory.preferredBloomSpeed = "accelerated";
      decision = "Mở rộng độ sâu phân tích và tăng cường mật độ ví dụ thực tiễn.";
      reason = "Học viên sung sức và đạt hiệu quả học tập cao. Sẵn sàng cho phân tích chuyên sâu.";
      metricTriggered = "Optimal Cognitive Energy & High Performance";
      policyApplied = "Policy Rule #4: Accelerated Deep Learning";
    }

    // 4. Update Strategy Performance Dictionary
    const prevPerf = memory.strategyPerformance[currentStyle] || { attempts: 0, successes: 0, avgMasteryGain: 0, avgConfidenceGain: 0 };
    const newAttempts = prevPerf.attempts + 1;
    const newSuccesses = prevPerf.successes + (latestEvaluation.teachingWorked ? 1 : 0);
    memory.strategyPerformance[currentStyle] = {
      attempts: newAttempts,
      successes: newSuccesses,
      avgMasteryGain: parseFloat(((prevPerf.avgMasteryGain * prevPerf.attempts + latestEvaluation.masteryImprovement) / newAttempts).toFixed(2)),
      avgConfidenceGain: parseFloat(((prevPerf.avgConfidenceGain * prevPerf.attempts + latestEvaluation.confidenceDelta) / newAttempts).toFixed(3))
    };

    // Save updated Adaptive Memory
    studentModelService.saveAdaptiveMemory(memory);

    // Create Audit Entry for Explainability
    const auditEntry: PolicyAuditEntry = {
      id: `policy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      decision,
      reason,
      evidenceUsed,
      metricTriggered,
      policyApplied
    };

    this.saveAuditEntry(auditEntry);

    return {
      auditEntry,
      updatedAdaptiveMemory: memory
    };
  },

  getAuditLog(): PolicyAuditEntry[] {
    const raw = localStorage.getItem(POLICY_AUDIT_LOG_KEY());
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  },

  saveAuditEntry(entry: PolicyAuditEntry): void {
    const logs = this.getAuditLog();
    logs.unshift(entry);
    if (logs.length > MAX_AUDIT_LOGS) {
      logs.pop();
    }
    localStorage.setItem(POLICY_AUDIT_LOG_KEY(), JSON.stringify(logs));
  }
};

// Nhật ký điều chỉnh chính sách giảng dạy cũng suy ra từ lịch sử học, nên phải dọn cùng.
// LƯU Ý: khóa này KHÔNG gắn mã môn, tức nó gộp chung mọi môn. Đây là thiếu sót có sẵn từ
// trước, ghi lại ở đây để người sau biết mà tách khi cần.
dangKyDonDuLieuSuyRa("policyAudit", () => {
  localStorage.removeItem(POLICY_AUDIT_LOG_KEY());
});
