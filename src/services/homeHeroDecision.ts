/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService } from "./db";
import { workspaceService } from "./workspaceService";
import { learnerModelService } from "./learnerModel";
import { NextBestAction } from "./nextBestAction";

export const homeHeroDecisionEngine = {
  /**
   * Deterministically evaluates the learner's state through cross-engine multi-attribute
   * utility arbitration and state hysteresis to decide the SINGLE primary Next Best Action.
   */
  decideNextBestAction(): NextBestAction {
    const stats = dbService.getStatistics();
    const attempts = dbService.getHistory();
    // Bài đang làm dở đọc từ phiên chưa hoàn thành (đã có kiểm tra bỏ qua bài đã nộp),
    // KHÔNG quét lịch sử nữa vì lịch sử chỉ còn chứa bài đã nộp.
    const unsubmitted = workspaceService.getUnfinishedSession();

    // Rule 1: Priority #1 - Hard Constraint: Continue an unsubmitted active exam.
    // Chỉ nhắc tiếp tục khi CÒN câu chưa trả lời; nếu đã trả lời hết thì coi như xong, không nhắc.
    if (unsubmitted) {
      const answeredCount = Object.keys(unsubmitted.answers || {}).length;
      const totalCount = unsubmitted.questions.length;
      const remainingCount = totalCount - answeredCount;
      const estMinutes = Math.max(Math.ceil(remainingCount * 1.2), 2);
      if (remainingCount > 0) {

      return {
        type: "continue-exam",
        title: "Tiếp tục phiên học đang dở",
        subtitle: `Đã hoàn thành ${answeredCount}/${totalCount} câu • Còn khoảng ${estMinutes} phút`,
        estimatedTimeMinutes: estMinutes,
        expectedBenefit: "Duy trì mạch tư duy & hoàn tất điểm đánh giá phiên",
        reason: "Hệ thống kiểm soát hệ thống: Bài thi đang làm dở kích hoạt ràng buộc cứng khôi phục phiên.",
        confidence: 98,
        primaryAction: {
          label: "Tiếp tục bài đang làm",
          examType: "continue",
          unsubmittedExamId: unsubmitted.id
        },
        secondaryAction: {
          label: "Xem trung tâm luyện tập",
          actionType: "practice-center"
        }
      };
      }
    }

    // -------------------------------------------------------------
    // DETERMINISTIC CROSS-ENGINE MULTI-ATTRIBUTE ARBITRATION
    // -------------------------------------------------------------
    const incorrectIds = Object.keys(stats.incorrectQuestionHistory || {});
    const debtCount = incorrectIds.length;
    
    // Find weak chapter
    const weakChapterEntry = Object.entries(stats.accuracyByChapter || {}).find(([_, data]) => {
      if (data.total < 3) return false;
      return (data.correct / data.total) < 0.6;
    });

    // Calculate candidate action utilities
    const uRetention = debtCount >= 3 
      ? 0.45 * Math.min(1.0, debtCount / 10) + 0.35 * (debtCount >= 6 ? 0.9 : 0.6) + 0.20 * 0.8
      : 0;

    const uWeakChapter = weakChapterEntry
      ? 0.40 * (1.0 - (weakChapterEntry[1].correct / Math.max(1, weakChapterEntry[1].total))) + 0.35 * 0.7 + 0.25 * 0.6
      : 0;

    const uDailyAdaptive = (stats.totalSolved < 50 || attempts.length < 5)
      ? 0.50 * (1.0 - stats.totalSolved / 50) + 0.30 * 0.8 + 0.20 * 0.7
      : 0.30;

    const uMockExam = (stats.totalSolved >= 30 && debtCount < 5)
      ? 0.45 * 0.85 + 0.35 * 0.80 + 0.20 * 0.75
      : 0.15;

    // Apply Hysteresis Buffer to prevent strategy oscillation
    const storageKey = "poly_econ_last_hero_action_type";
    const lastActionType = localStorage.getItem(storageKey);
    const hysteresisBonus = 0.08;

    let adjRetention = uRetention + (lastActionType === "retention-revision" ? hysteresisBonus : 0);
    let adjWeakChapter = uWeakChapter + (lastActionType === "chapter-strengthen" ? hysteresisBonus : 0);
    let adjAdaptive = uDailyAdaptive + (lastActionType === "daily-adaptive" ? hysteresisBonus : 0);
    let adjMock = uMockExam + (lastActionType === "mock-exam" ? hysteresisBonus : 0);

    let selectedType = "daily-adaptive";
    let maxUtility = adjAdaptive;

    if (adjRetention > maxUtility) {
      maxUtility = adjRetention;
      selectedType = "retention-revision";
    }
    if (adjWeakChapter > maxUtility) {
      maxUtility = adjWeakChapter;
      selectedType = "chapter-strengthen";
    }
    if (adjMock > maxUtility) {
      maxUtility = adjMock;
      selectedType = "mock-exam";
    }

    localStorage.setItem(storageKey, selectedType);

    // Render winning decision based on deterministic arbitration
    if (selectedType === "retention-revision" && debtCount >= 3) {
      const count = Math.min(debtCount, 10);
      return {
        type: "retention-revision",
        title: "Ôn tập củng cố điểm hổng",
        subtitle: `Sửa ${count} câu làm sai & khôi phục độ bền ghi nhớ`,
        estimatedTimeMinutes: Math.ceil(count * 1.2),
        expectedBenefit: "Tăng khả năng ghi nhớ từ 65% lên 90%",
        reason: `Trọng tài hệ thống (Arbitration Utility: ${(adjRetention).toFixed(2)}): ${debtCount} bẫy câu sai cần triệt phá ưu tiên hàng đầu.`,
        confidence: 94,
        primaryAction: {
          label: `Bắt đầu ôn ${count} câu`,
          examType: "incorrect",
          count
        },
        secondaryAction: {
          label: "Mở Sổ tay ôn tập",
          actionType: "review-notebook"
        }
      };
    }

    if (selectedType === "chapter-strengthen" && weakChapterEntry) {
      const chId = Number(weakChapterEntry[0]);
      return {
        type: "chapter-strengthen",
        title: `Củng cố trọng tâm Chương ${chId}`,
        subtitle: `Tập trung 10 câu thích ứng thuộc Chương ${chId}`,
        estimatedTimeMinutes: 10,
        expectedBenefit: "Nâng tỷ lệ chính xác chương yếu lên trên 80%",
        reason: `Trọng tài hệ thống (Arbitration Utility: ${(adjWeakChapter).toFixed(2)}): Tỷ lệ làm đúng Chương ${chId} ở mức thấp.`,
        confidence: 90,
        primaryAction: {
          label: `Bắt đầu ôn Chương ${chId}`,
          examType: "chapter",
          chapterId: chId,
          count: 10
        },
        secondaryAction: {
          label: "Xem phân tích chi tiết",
          actionType: "analytics"
        }
      };
    }

    if (selectedType === "mock-exam") {
      return {
        type: "mock-exam",
        title: "Thi thử mô phỏng đề thật",
        subtitle: "20 câu chuẩn cấu trúc đề thi chính thức với phân bổ Bloom chuẩn",
        estimatedTimeMinutes: 20,
        expectedBenefit: "Đo lường điểm số dự kiến & luyện tập phản xạ áp lực thời gian",
        reason: `Trọng tài hệ thống (Arbitration Utility: ${(adjMock).toFixed(2)}): Năng lực ổn định, sẵn sàng kiểm tra áp lực tổng hợp.`,
        confidence: 88,
        primaryAction: {
          label: "Bắt đầu đề thi thử 20 câu",
          examType: "ai-smart",
          count: 20
        },
        secondaryAction: {
          label: "Xem tiến trình học tập",
          actionType: "analytics"
        }
      };
    }

    // Default: Daily Adaptive Learning
    return {
      type: "daily-adaptive",
      title: "Luyện tập thích ứng hôm nay",
      subtitle: "Thuật toán tự động chọn câu hỏi vừa sức theo nhịp tư duy",
      estimatedTimeMinutes: 10,
      expectedBenefit: "Mở rộng độ bao phủ chương & tối ưu hóa lộ trình cá nhân",
      reason: `Trọng tài hệ thống (Arbitration Utility: ${(adjAdaptive).toFixed(2)}): Duy trì nhịp học thích ứng mở rộng độ bao phủ syllabus.`,
      confidence: 92,
      primaryAction: {
        label: "Bắt đầu bài thi thích ứng (10 câu)",
        examType: "adaptive",
        count: 10
      },
      secondaryAction: {
        label: "Đến Trung tâm luyện tập",
        actionType: "practice-center"
      }
    };
  }
};

