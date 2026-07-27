/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { studentModelService, StudentModel } from "./learnerModel";
import { pedagogicalEvaluationEngine, PedagogicalEvaluation, StrategyStats } from "./pedagogicalEvaluationEngine";
import { adaptiveTeachingPolicy, PolicyAuditEntry } from "./adaptiveTeachingPolicy";

export interface TeachingAnalyticsReport {
  /**
   * Số lượt gia sư AI đã chấm. Bằng 0 nghĩa là **CHƯA CÓ DỮ LIỆU NÀO**, và khi đó mọi chỉ số
   * bên dưới đều bằng 0 chứ không phải "kết quả đo được thấp". Màn hình phải nói rõ điều này,
   * đừng vẽ số 0 ra như một thành tích kém.
   *
   * Trường này thêm ngày 27/07/2026, khi phát hiện báo cáo trả về hiệu quả giảng dạy 85% và
   * mức tăng thông thạo +5,5 điểm/câu cho một hồ sơ chưa từng hỏi gia sư AI lần nào.
   */
  totalInteractions: number;
  overallTeachingEffectiveness: number; // 0.0 to 100.0 %
  averageMasteryGrowth: number; // e.g. +6.2 points
  averageBloomProgression: number; // e.g. 1.4 levels
  mostEffectiveTeachingStyle: string;
  leastEffectiveTeachingStyle: string;
  hardestConcepts: { conceptName: string; failureRate: number; totalAttempts: number }[];
  weakestConcepts: { conceptName: string; mastery: number }[];
  averageRecoveryTime: number; // average attempts to recover
  mostFrequentMisconceptions: { misconception: string; count: number }[];
  averageGuessingRate: number; // 0.0 to 100.0 %
  averageConfidence: number; // 0.0 to 1.0
  learningVelocity: number; // mastery change per session
  teachingEfficiency: number; // score per minute
  conceptRecoveryRanking: { conceptName: string; recoveryRate: number }[];
  prerequisiteFailureRanking: { conceptName: string; failureCount: number }[];
  styleDistribution: Record<string, number>;
  strategyStatsList: StrategyStats[];
  auditTrail: PolicyAuditEntry[];
  recentEvaluations: PedagogicalEvaluation[];
}

export const teachingAnalytics = {
  /**
   * Generates comprehensive, deterministic statistics on teaching effectiveness and pedagogical outcomes.
   */
  generateAnalyticsReport(): TeachingAnalyticsReport {
    const studentModel = studentModelService.getStudentModel();
    const evalHistory = pedagogicalEvaluationEngine.getEvaluationHistory();
    const strategyStatsMap = pedagogicalEvaluationEngine.getStrategyStats();
    const auditTrail = adaptiveTeachingPolicy.getAuditLog();

    // 1. Overall Teaching Effectiveness & Metrics
    let totalScoreSum = 0;
    let totalInteractions = evalHistory.length;
    let totalMasteryGainSum = 0;
    let totalMisconceptionsCount = 0;
    let totalResolvedMisconceptions = 0;

    evalHistory.forEach(ev => {
      totalScoreSum += ev.effectivenessScore;
      totalMasteryGainSum += ev.masteryImprovement;
      if (ev.metrics.misconceptionRecovery > 0) {
        totalMisconceptionsCount++;
        if (ev.misconceptionResolved) {
          totalResolvedMisconceptions++;
        }
      }
    });

    // Chưa có lượt tương tác nào thì trả 0, KHÔNG bịa (bất biến 4.9). Bản cũ trả 85,0 và 5,5,
    // nghĩa là màn hình Phân tích giảng dạy khoe "Hiệu quả Giảng dạy 85%, +5,5 điểm/câu" cho
    // một hồ sơ chưa từng hỏi gia sư AI lần nào. Con số đó không đến từ bất kỳ phép đo nào.
    const overallTeachingEffectiveness = totalInteractions > 0
      ? parseFloat(((totalScoreSum / totalInteractions) * 100).toFixed(1))
      : 0;

    const averageMasteryGrowth = totalInteractions > 0
      ? parseFloat((totalMasteryGainSum / totalInteractions).toFixed(1))
      : 0;

    // 2. Strategy Effectiveness Analysis
    //
    // Chưa có chiến lược nào được dùng thì phải nói thẳng, KHÔNG được trả về một cái tên.
    // Bản cũ khởi tạo sẵn "Academic" và "Expert", nên màn hình khoe "Phương pháp hiệu quả
    // nhất: Academic" kèm câu "giúp học viên khắc phục lỗi sai và duy trì độ tinh thông cao
    // nhất" cho một người chưa từng hỏi gia sư AI lần nào. Đúng bất biến 4.9.
    //
    // Lưu ý: lượt TỰ LÀM BÀI cố ý không được cộng vào bảng này (xem `capNhatBangChienLuoc`),
    // vì không có ai giảng thì không có chiến lược giảng dạy nào để so.
    const strategyStatsList = Object.values(strategyStatsMap);
    const CHUA_DU = "Chưa đủ dữ liệu";
    let mostEffectiveStyle = CHUA_DU;
    let maxSuccessRate = -1;
    let leastEffectiveStyle = CHUA_DU;
    let minSuccessRate = 101;

    strategyStatsList.forEach(s => {
      if (s.totalInteractions > 0) {
        if (s.successRate > maxSuccessRate) {
          maxSuccessRate = s.successRate;
          mostEffectiveStyle = s.strategyName;
        }
        if (s.successRate < minSuccessRate) {
          minSuccessRate = s.successRate;
          leastEffectiveStyle = s.strategyName;
        }
      }
    });

    // 3. Style Distribution
    const styleDistribution: Record<string, number> = {};
    evalHistory.forEach(ev => {
      const style = ev.teachingStrategy || "Academic";
      styleDistribution[style] = (styleDistribution[style] || 0) + 1;
    });

    // 4. Weakest & Hardest Concepts
    const weakestConcepts = Object.entries(studentModel.conceptMastery)
      .map(([conceptName, mastery]) => ({ conceptName, mastery }))
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 5);

    const conceptFailures: Record<string, { failed: number; total: number }> = {};
    evalHistory.forEach(ev => {
      const c = ev.conceptName;
      if (!conceptFailures[c]) conceptFailures[c] = { failed: 0, total: 0 };
      conceptFailures[c].total++;
      if (!ev.teachingWorked) conceptFailures[c].failed++;
    });

    const hardestConcepts = Object.entries(conceptFailures)
      .map(([conceptName, data]) => ({
        conceptName,
        failureRate: parseFloat(((data.failed / data.total) * 100).toFixed(1)),
        totalAttempts: data.total
      }))
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, 5);

    // 5. Most Frequent Misconceptions
    const misconceptionCounts: Record<string, number> = {};
    Object.values(studentModel.misconceptionHistory).forEach(history => {
      history.forEach(item => {
        if (item.misconception) {
          misconceptionCounts[item.misconception] = (misconceptionCounts[item.misconception] || 0) + 1;
        }
      });
    });

    const mostFrequentMisconceptions = Object.entries(misconceptionCounts)
      .map(([misconception, count]) => ({ misconception, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 6. Concept Recovery Ranking
    const conceptRecoveryRanking = Object.entries(conceptFailures)
      .map(([conceptName, data]) => {
        const resolvedCount = evalHistory.filter(e => e.conceptName === conceptName && e.misconceptionResolved).length;
        const recoveryRate = data.failed > 0 ? parseFloat(((resolvedCount / data.failed) * 100).toFixed(1)) : 100;
        return { conceptName, recoveryRate };
      })
      .sort((a, b) => b.recoveryRate - a.recoveryRate);

    // 7. Prerequisite Failure Ranking
    const prerequisiteFailures: Record<string, number> = {};
    evalHistory.forEach(ev => {
      if (ev.needsPrerequisiteReview) {
        prerequisiteFailures[ev.conceptName] = (prerequisiteFailures[ev.conceptName] || 0) + 1;
      }
    });

    const prerequisiteFailureRanking = Object.entries(prerequisiteFailures)
      .map(([conceptName, failureCount]) => ({ conceptName, failureCount }))
      .sort((a, b) => b.failureCount - a.failureCount);

    // 8. Guessing Rate & Confidence
    const averageGuessingRate = parseFloat((studentModel.adaptiveMemory.guessingFrequency * 100).toFixed(1));
    const allConfidenceVals = Object.values(studentModel.confidenceHistory).flat();
    const averageConfidence = allConfidenceVals.length > 0
      ? parseFloat((allConfidenceVals.reduce((a, b) => a + b, 0) / allConfidenceVals.length).toFixed(2))
      : 0;

    const learningVelocity = parseFloat((studentModel.adaptiveMemory.learningVelocity || 0).toFixed(1));

    // Ba con số dưới đây trước kia là hằng số viết thẳng trong mã (1,4 và 1,4), hiển thị như
    // thể đo được từ quá trình học của người dùng. Nay tính từ chính lịch sử chấm của gia sư,
    // và bằng 0 khi chưa có lượt nào.
    //
    // Số lượt cần để gỡ một khái niệm: đếm lượt cho tới khi khái niệm đó lần đầu được chấm đạt.
    const lanTheoKhaiNiem = new Map<string, number>();
    const daGoXong = new Set<string>();
    const soLuotDeGo: number[] = [];
    [...evalHistory].reverse().forEach(ev => {
      const ten = ev.conceptName;
      const dem = (lanTheoKhaiNiem.get(ten) || 0) + 1;
      lanTheoKhaiNiem.set(ten, dem);
      if ((ev.teachingWorked || ev.misconceptionResolved) && !daGoXong.has(ten)) {
        soLuotDeGo.push(dem);
        daGoXong.add(ten);
      }
    });
    const averageRecoveryTime = soLuotDeGo.length > 0
      ? parseFloat((soLuotDeGo.reduce((a, b) => a + b, 0) / soLuotDeGo.length).toFixed(1))
      : 0;

    // Bước tiến trên thang Bloom: chênh lệch bậc giữa lượt đầu và lượt cuối của mỗi khái niệm.
    const BAC: Record<string, number> = { Remember: 1, Understand: 2, Apply: 3, Analyze: 4, Evaluate: 5, Create: 6 };
    const dauCuoi = new Map<string, { dau: number; cuoi: number }>();
    [...evalHistory].reverse().forEach(ev => {
      const b = BAC[String(ev.bloomLevel)] || 0;
      if (b === 0) return;
      const cu = dauCuoi.get(ev.conceptName);
      if (!cu) dauCuoi.set(ev.conceptName, { dau: b, cuoi: b });
      else cu.cuoi = b;
    });
    const buocBloom = [...dauCuoi.values()].map(v => v.cuoi - v.dau);
    const averageBloomProgression = buocBloom.length > 0
      ? parseFloat((buocBloom.reduce((a, b) => a + b, 0) / buocBloom.length).toFixed(1))
      : 0;

    const teachingEfficiency = parseFloat((overallTeachingEffectiveness / 1.2).toFixed(1));

    return {
      totalInteractions,
      overallTeachingEffectiveness,
      averageMasteryGrowth,
      averageBloomProgression,
      mostEffectiveTeachingStyle: mostEffectiveStyle,
      leastEffectiveTeachingStyle: leastEffectiveStyle,
      hardestConcepts,
      weakestConcepts,
      averageRecoveryTime,
      mostFrequentMisconceptions,
      averageGuessingRate,
      averageConfidence,
      learningVelocity,
      teachingEfficiency,
      conceptRecoveryRanking,
      prerequisiteFailureRanking,
      styleDistribution,
      strategyStatsList,
      auditTrail,
      recentEvaluations: evalHistory.slice(0, 10)
    };
  }
};
