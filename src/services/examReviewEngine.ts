/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExamSpecification, ExamReviewResult, Question } from "../types";

export const examReviewEngine = {
  /**
   * Reviews an entire ExamSpecification and assembled questions set to verify quality,
   * balance, non-redundancy, and cognitive pacing.
   */
  reviewExam(spec: ExamSpecification, questions: Question[]): ExamReviewResult {
    let overallScore = 100;
    const recommendations: string[] = [];

    // 1. Coverage Check
    const chapterCount = Object.keys(spec.coverage).length;
    let coverageStatus: "PASS" | "WARN" | "FAIL" = "PASS";
    let coverageDetails = `Độ bao phủ: Đã phân bổ qua ${chapterCount} chương.`;

    if (spec.examType === "mock" && chapterCount < 2) {
      coverageStatus = "WARN";
      coverageDetails = `Đề thi thử (Mock Exam) nên bao phủ ít nhất 2 chương (hiện tại: ${chapterCount} chương).`;
      overallScore -= 10;
      recommendations.push("Mở rộng độ bao phủ đề thi thử bằng cách chọn thêm câu hỏi từ các chương khác.");
    }

    // 2. Bloom Distribution Check
    let bloomStatus: "PASS" | "WARN" | "FAIL" = "PASS";
    const rememberPct = spec.bloomDistribution["Remember"]?.percentage || 0;
    const understandPct = spec.bloomDistribution["Understand"]?.percentage || 0;
    const analyzePct = spec.bloomDistribution["Analyze"]?.percentage || 0;
    const evaluatePct = spec.bloomDistribution["Evaluate"]?.percentage || 0;

    let bloomDetails = `Phân bổ Bloom: Remember (${rememberPct}%), Understand (${understandPct}%), Analyze (${analyzePct}%).`;

    if (rememberPct + understandPct > 85) {
      bloomStatus = "WARN";
      bloomDetails = `Quá nghiêng về mức Nhớ/Hiểu (${rememberPct + understandPct}%). Thiếu câu hỏi tư duy Vận dụng/Phân tích.`;
      overallScore -= 10;
      recommendations.push("Tăng tỷ lệ câu hỏi Vận dụng (Apply) và Phân tích (Analyze) để đánh giá năng lực tư duy bậc cao.");
    }

    // 3. Difficulty Balance Check
    let diffStatus: "PASS" | "WARN" | "FAIL" = "PASS";
    const easyPct = spec.difficultyDistribution["Easy"]?.percentage || 0;
    const hardPct = spec.difficultyDistribution["Hard"]?.percentage || 0;
    let diffDetails = `Độ khó: Dễ (${easyPct}%), Trung bình (${spec.difficultyDistribution["Medium"]?.percentage || 0}%), Khó (${hardPct}%).`;

    if (easyPct > 60) {
      diffStatus = "WARN";
      diffDetails = `Đề thi quá dễ (${easyPct}% Dễ). Tăng độ khó để phân loại học viên.`;
      overallScore -= 10;
      recommendations.push("Thay thế một số câu dễ bằng câu trung bình/khó.");
    } else if (hardPct > 60) {
      diffStatus = "WARN";
      diffDetails = `Đề thi quá khó (${hardPct}% Khó). Có thể gây áp lực tâm lý không cần thiết.`;
      overallScore -= 10;
      recommendations.push("Giảm số lượng câu khó liên tiếp để tạo nhịp thi cân bằng.");
    }

    // 4. Redundancy Check
    let redundancyStatus: "PASS" | "WARN" | "FAIL" = "PASS";
    const seenCombos = new Set<string>();
    let duplicateCount = 0;

    spec.questionSpecs.forEach(q => {
      const combo = `${q.concept}__${q.bloom}__${q.blueprint}`;
      if (seenCombos.has(combo)) {
        duplicateCount++;
      } else {
        seenCombos.add(combo);
      }
    });

    let redundancyDetails = duplicateCount === 0 
      ? "Không phát hiện câu trùng lặp cùng Khái niệm + Bloom + Blueprint."
      : `Phát hiện ${duplicateCount} câu kiểm tra trùng lặp cấu trúc.`;

    if (duplicateCount > 0) {
      redundancyStatus = "WARN";
      overallScore -= 15;
      recommendations.push(`Khắc phục ${duplicateCount} vị trí kiểm tra trùng lặp cấu trúc bằng cách đa dạng hóa dạng bài (Blueprint).`);
    }

    // 5. Concept Balance Check
    let conceptStatus: "PASS" | "WARN" | "FAIL" = "PASS";
    const conceptCounts: Record<string, number> = {};
    spec.questionSpecs.forEach(q => {
      conceptCounts[q.concept] = (conceptCounts[q.concept] || 0) + 1;
    });

    const maxConceptFreq = Math.max(...Object.values(conceptCounts), 0);
    let conceptDetails = `Cân bằng khái niệm: Tối đa ${maxConceptFreq} câu/khái niệm.`;

    if (maxConceptFreq > 3 && spec.questionCount >= 10) {
      conceptStatus = "WARN";
      conceptDetails = `Cảnh báo: Khái niệm lặp lại quá nhiều lần (${maxConceptFreq} câu).`;
      overallScore -= 10;
      recommendations.push("Phân bổ thêm các khái niệm phụ để đảm bảo tính bao quát.");
    }

    // 6. Exam Rhythm Check
    let rhythmStatus: "PASS" | "WARN" | "FAIL" = "PASS";
    let maxConsecutiveDiff = 1;
    let currConsecutiveDiff = 1;

    for (let i = 1; i < spec.questionSpecs.length; i++) {
      if (spec.questionSpecs[i].difficulty === spec.questionSpecs[i - 1].difficulty) {
        currConsecutiveDiff++;
        if (currConsecutiveDiff > maxConsecutiveDiff) maxConsecutiveDiff = currConsecutiveDiff;
      } else {
        currConsecutiveDiff = 1;
      }
    }

    let rhythmDetails = `Nhịp độ đề thi tốt. Tối đa ${maxConsecutiveDiff} câu liên tiếp cùng độ khó.`;
    if (maxConsecutiveDiff >= 5) {
      rhythmStatus = "WARN";
      rhythmDetails = `Có ${maxConsecutiveDiff} câu liên tiếp cùng độ khó. Thiếu sự xen kẽ nhịp độ.`;
      overallScore -= 10;
      recommendations.push("Xen kẽ các câu mức độ Dễ/Trung bình/Khó để tạo cảm giác tiến trình mượt mà.");
    }

    // 7. Expected Time Check
    const expectedTimeMinutes = spec.plannedTimeMinutes;
    let timeStatus: "PASS" | "WARN" | "FAIL" = "PASS";
    let timeDetails = `Thời gian dự kiến: ${expectedTimeMinutes} phút (~1.5 phút/câu). Phù hợp với chuẩn đánh giá.`;

    const passed = overallScore >= 70;

    return {
      passed,
      overallScore: Math.max(overallScore, 0),
      checks: {
        coverage: { status: coverageStatus, details: coverageDetails },
        bloom: { status: bloomStatus, details: bloomDetails },
        difficulty: { status: diffStatus, details: diffDetails },
        redundancy: { status: redundancyStatus, details: redundancyDetails },
        conceptBalance: { status: conceptStatus, details: conceptDetails },
        rhythm: { status: rhythmStatus, details: rhythmDetails },
        expectedTime: { status: timeStatus, details: timeDetails }
      },
      recommendations,
      reviewedAt: new Date().toISOString()
    };
  }
};
