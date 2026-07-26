/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService } from "./db";
import { kbService, KnowledgeNode } from "./kbService";
import { learnerModelService, ConceptProfile } from "./learnerModel";
import { Question, ExamAttempt, DifficultyLevel } from "../types";
import { TimeService } from "./time";

export interface LearningRoadmapStep {
  id: string;
  conceptName: string;
  status: "locked" | "available" | "mastered";
  chapter: number;
  reason: string;
  actionRecommendation: string;
}

export interface LearningRoadmap {
  subjectName: string;
  overallProgress: number;
  steps: LearningRoadmapStep[];
}

export interface CoachDiagnostic {
  conceptName: string;
  definition: string;
  misconceptionDetected: string;
  miniLesson: string;
  analogy: string;
  memoryHook: string;
  followUpQuiz: {
    question: string;
    options: { key: string; text: string; isCorrect: boolean }[];
  };
}

/** Thứ tự nấc thang nhận thức Bloom, dùng để đo khoảng cách giữa hai nấc. */
const BLOOM_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

function bloomIndex(level?: string): number {
  const i = BLOOM_ORDER.indexOf(String(level || "understand").toLowerCase());
  return i < 0 ? 1 : i;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export const learningEngine = {
  /**
   * Bộ chấm ưu tiên câu hỏi (Adaptive Question Chooser).
   *
   * THIẾT KẾ: mọi thành phần đều là hàm LIÊN TỤC nhận giá trị trong [0, 1], rồi tổ hợp
   * tuyến tính theo bộ trọng số cộng lại bằng 1, cuối cùng nhân đúng MỘT cổng tiên quyết.
   *
   *     Uu tien = ( 0,30*Thieu + 0,25*Quen + 0,15*QuaHan + 0,10*ThieuTuTin
   *               + 0,10*QuanTrong + 0,10*HopBloom ) * CongTienQuyet + 0,50*TungSai
   *
   * Ba khác biệt cốt lõi so với bản cũ, mỗi khác biệt sửa một khiếm khuyết đo được:
   *
   * 1. KHÔNG CÒN NGƯỠNG BẬC THANG. Bản cũ cộng +3,5 khi thành thạo dưới 40 và trừ 2,0 khi
   *    trên 85, còn khoảng giữa không có gì; hai câu ở mức 41 và 84 bị đối xử y hệt nhau,
   *    trong khi 39 và 41 lại lệch nhau 3,5 điểm. Tương tự với mốc trí nhớ 0,6: chênh lệch
   *    0,002 gây đảo 4,4 điểm. Nay dùng hàm liên tục nên thứ hạng không nhảy đột ngột.
   *
   * 2. GỘP THEO TRUNG BÌNH, KHÔNG CỘNG DỒN. Bản cũ cộng điểm cho TỪNG khái niệm gắn với câu
   *    hỏi, nên câu gắn 3 nhãn tự động được ưu tiên hơn câu gắn 1 nhãn dù người học yếu như
   *    nhau. Đó là thiên lệch theo số nhãn, không phải theo nhu cầu học. Nay lấy trung bình.
   *
   * 3. CỔNG TIÊN QUYẾT CHỈ NHÂN MỘT LẦN. Bản cũ nhân 0,15 cho mỗi khái niệm tiên quyết chưa
   *    đạt, nên câu có 3 khái niệm bị nhân 0,003 và biến mất khỏi mọi đề. Nay lấy cổng chặt
   *    nhất rồi nhân đúng một lần, và cổng cũng liên tục theo độ thạo của kiến thức nền.
   *
   * Toàn bộ đều tất định: cùng dữ liệu học thì cùng thứ hạng, không gọi Math.random.
   */
  scoreQuestions(pool: Question[]): { q: Question; score: number; reasons: string[] }[] {
    const stats = dbService.getStatistics();
    const activeSubjectId = dbService.getActiveSubjectId();
    const graph = kbService.getKnowledgeGraph(activeSubjectId);

    const now = TimeService.now().getTime();

    // Map graph nodes for rapid lookup
    const nodeMap = new Map<string, KnowledgeNode>();
    graph.forEach(node => {
      nodeMap.set(node.concept.toLowerCase(), node);
      nodeMap.set(node.id.toLowerCase(), node);
    });

    // Chuẩn hóa độ quan trọng theo thang lớn nhất của chính đồ thị đang dùng. Bản cũ nhân
    // thẳng importance * 0,4, nên một đồ thị chấm importance theo thang 1..10 sẽ áp đảo mọi
    // thành phần khác, còn thang 1..3 thì gần như vô hiệu. Chuẩn hóa xong, ý nghĩa của
    // "quan trọng nhất trong môn" là như nhau ở mọi bộ dữ liệu.
    const maxImportance = graph.reduce((m, n) => Math.max(m, n.importance || 0), 0) || 1;

    // Đọc hồ sơ khái niệm MỘT LẦN. Bản cũ gọi getOrCreateProfile trong vòng lặp, mà hàm đó
    // ghi lại localStorage mỗi lần gọi, nên chấm điểm cho 292 câu kéo theo hàng trăm lượt
    // tuần tự hóa JSON toàn bộ hồ sơ. Chấm điểm là thao tác ĐỌC, không được ghi.
    const profileCache = new Map<string, ReturnType<typeof learnerModelService.getOrCreateProfile>>();
    const profileOf = (conceptName: string) => {
      const key = conceptName.toLowerCase();
      let p = profileCache.get(key);
      if (!p) {
        p = learnerModelService.getOrCreateProfile(conceptName);
        profileCache.set(key, p);
      }
      return p;
    };

    // Độ thạo đọc thẳng từ thống kê, KHÔNG co thêm lần nữa. Việc co theo lượng bằng chứng
    // đã được thực hiện đúng một lần tại nguồn (dbService.recomputeStatistics), nên co lại ở
    // đây sẽ là co hai lần: tín hiệu bị nén phẳng về quanh 50 và độ thạo gần như mất tác dụng
    // lên thứ hạng. Đọc theo TÊN khái niệm trước rồi mới tới mã, và dùng `??` chứ không dùng
    // `||` vì 0 là một giá trị hợp lệ chứ không phải "thiếu dữ liệu".
    const masteryOf = (node: KnowledgeNode): number => {
      return stats.conceptMastery?.[node.concept] ?? stats.conceptMastery?.[node.id] ?? 50;
    };

    return pool.map(q => {
      const reasons: string[] = [];

      // Câu hỏi từng làm sai: hàm bão hòa thay cho cộng tuyến tính không chặn trên.
      // Bản cũ cộng 1,5 điểm cho mỗi lần sai, nên một câu sai 10 lần được +15 và nhấn chìm
      // toàn bộ tín hiệu còn lại. Thực tế sai lần thứ 10 không cấp bách gấp 10 lần thứ nhất.
      const wrongCount = stats.incorrectQuestionHistory[q.id] || 0;
      const wrongSignal = 1 - Math.exp(-wrongCount / 2); // 1 lần: 0,39; 3 lần: 0,78; 6 lần: 0,95
      if (wrongCount > 0) {
        reasons.push(`Từng làm sai ${wrongCount} lần (+${(0.5 * wrongSignal).toFixed(2)})`);
      }

      // Tra khái niệm bằng bộ tra cứu có xếp hạng dùng chung (chủ đề + chương + từ vựng).
      // Bản cũ đòi nhãn câu hỏi trùng TUYỆT ĐỐI tên khái niệm, đo được 0/292 câu tra ra
      // kết quả, nghĩa là mọi thành phần suy luận bên dưới chưa từng được kích hoạt.
      const resolved = kbService.resolveConceptsForQuestion(activeSubjectId, q, 3);
      const matchedNodes = resolved.map(r => r.node);
      const affinityOf = new Map(resolved.map(r => [r.node.id, r.affinity]));

      if (matchedNodes.length === 0) {
        // Không tra được khái niệm: chỉ còn bằng chứng ở mức câu hỏi. Đặt nền 0,5 để những
        // câu này không bị loại hẳn khỏi đề, nhưng cũng không vượt mặt câu có bằng chứng rõ.
        const score = 0.5 + 0.5 * wrongSignal;
        return { q, score, reasons };
      }

      // Gộp các thành phần theo TRUNG BÌNH CÓ TRỌNG SỐ trên những khái niệm gắn với câu hỏi,
      // trọng số chính là độ gần gũi. Khái niệm chỉ liên quan mờ nhạt thì góp tiếng nói nhỏ,
      // thay vì được tính ngang hàng với khái niệm trùng khớp chủ đề.
      let sumNeed = 0, sumForget = 0, sumOverdue = 0, sumConf = 0, sumImp = 0, sumBloom = 0;
      let weightTotal = 0;
      let prereqGate = 1.0; // cổng chặt nhất, chỉ nhân một lần ở cuối
      let gateReason = "";

      matchedNodes.forEach(node => {
        const profile = profileOf(node.concept);
        const w = affinityOf.get(node.id) ?? 0.2;
        weightTotal += w;

        // 1. Mức thiếu hụt kiến thức, liên tục theo độ thạo đã cân bằng chứng.
        const mastery = masteryOf(node);
        sumNeed += w * clamp01(1 - mastery / 100);

        // 2. Mức quên, liên tục. forgettingScore = 1 nghĩa là còn nhớ nguyên.
        sumForget += w * clamp01(1 - (profile.forgettingScore ?? 1));

        // 3. Quá hạn ôn tập: dốc tuyến tính bão hòa sau 7 ngày, thay cho bậc nhảy +3,0.
        //    Quá hạn 1 ngày và quá hạn 30 ngày trước đây được coi là như nhau.
        if (profile.nextReviewAt) {
          const overdueDays = (now - new Date(profile.nextReviewAt).getTime()) / 86400000;
          sumOverdue += w * clamp01(overdueDays / 7);
        }

        // 4. Thiếu tự tin, liên tục thay cho ngưỡng cứng 0,4.
        sumConf += w * clamp01(1 - (profile.confidence ?? 0.5));

        // 5. Độ quan trọng của khái niệm, đã chuẩn hóa về [0, 1].
        sumImp += w * clamp01((node.importance || 0) / maxImportance);

        // 6. Độ hợp nấc thang Bloom: khoảng cách CÓ CẤP ĐỘ thay cho đúng/sai nhị phân.
        //    Bản cũ hoặc cộng 2,0 khi khớp tuyệt đối, hoặc nhân 0,8 khi lệch, nên lệch một
        //    nấc bị phạt ngang lệch bốn nấc, trái với cách dạy thực tế là nâng dần từng nấc.
        const dist = Math.abs(bloomIndex(q.bloomLevel) - bloomIndex(profile.difficultyPreference));
        sumBloom += w * clamp01(1 - dist / 5);

        // 7. Cổng tiên quyết liên tục: kiến thức nền càng yếu thì càng chặn mạnh, nhưng
        //    không bao giờ chặn tuyệt đối để người học vẫn có đường chạm tới khái niệm.
        const requires = node.dependencies?.requires || [];
        requires.forEach(reqNameOrId => {
          const reqNode = nodeMap.get(String(reqNameOrId).toLowerCase());
          if (!reqNode) return;

          // KHÔNG chặn câu hỏi bằng chính khái niệm mà nó đang dạy. Một câu hỏi có thể gắn
          // với nhiều khái niệm, trong đó khái niệm này lại là nền tảng của khái niệm kia.
          // Nếu vẫn áp cổng thì càng yếu nền tảng, câu hỏi rèn đúng nền tảng đó lại càng bị
          // đẩy ra xa, tức là chặn người học khỏi đúng thứ họ cần luyện. Đây là kiểu suy
          // luận ngược với cách một giảng viên xử lý: thấy hổng nền thì cho làm bài về nền.
          if (matchedNodes.some(m => m.id === reqNode.id)) return;
          const reqMastery = masteryOf(reqNode);
          // reqMastery 0 cho cổng 0,15; 70 trở lên cho cổng 1,0; ở giữa nội suy tuyến tính.
          const gate = 0.15 + 0.85 * clamp01(reqMastery / 70);
          if (gate < prereqGate) {
            prereqGate = gate;
            gateReason = `Nền tảng "${reqNode.concept}" mới đạt ${Math.round(reqMastery)}% (cổng x${gate.toFixed(2)})`;
          }
        });
      });

      const wt = weightTotal > 0 ? weightTotal : 1;
      const need = sumNeed / wt;
      const forget = sumForget / wt;
      const overdue = sumOverdue / wt;
      const confGap = sumConf / wt;
      const importance = sumImp / wt;
      const bloomFit = sumBloom / wt;

      const base =
        0.30 * need +
        0.25 * forget +
        0.15 * overdue +
        0.10 * confGap +
        0.10 * importance +
        0.10 * bloomFit;

      const score = Math.max(0.01, base * prereqGate + 0.5 * wrongSignal);

      if (need > 0.5) reasons.push(`Khái niệm còn yếu (${Math.round(need * 100)}% thiếu hụt)`);
      if (forget > 0.4) reasons.push(`Đang quên dần (còn nhớ ${Math.round((1 - forget) * 100)}%)`);
      if (overdue > 0.2) reasons.push(`Quá hạn ôn tập`);
      if (importance > 0.7) reasons.push(`Khái niệm trọng tâm của môn`);
      if (gateReason) reasons.push(gateReason);

      return { q, score, reasons };
    });
  },

  /**
   * Generates a fully adaptive exam attempt using scored weight distribution.
   */
  generateAdaptiveExam(count: number = 10): ExamAttempt {
    // Bản cũ dựng nguồn câu hỏi bằng biểu thức luôn cho ra mảng RỖNG:
    //   [...(overview.lastExam?.questions === undefined ? [] : []), ...((dbService as any).questions || [])]
    // Nhánh điều kiện trả về mảng rỗng ở cả hai chiều, còn dbService không hề có thuộc tính
    // `questions`, nên hàm này luôn sinh ra đề 0 câu. Nay lấy đúng ngân hàng câu hỏi.
    const pool = dbService.getQuestions();
    const scored = this.scoreQuestions(pool);

    // Sắp xếp bằng hàm so sánh THUẦN TÚY. Bản cũ rút Math.random ngay trong hàm so sánh nên
    // vi phạm hợp đồng sắp xếp (so cùng một cặp hai lần có thể ra hai kết quả ngược nhau).
    // Nhiễu nay được rút một lần cho mỗi câu và nhân vào điểm, giữ được tín hiệu ưu tiên.
    const sorted = scored
      .map(s => ({ s, key: s.score * (0.85 + 0.3 * ((Math.imul(s.q.id, 2654435761) >>> 8) / 16777216)) }))
      .sort((a, b) => (b.key - a.key) || (a.s.q.id - b.s.q.id))
      .map(x => x.s);

    const selectedQs = sorted.slice(0, count).map(s => s.q);

    return {
      id: `exam-adaptive-${TimeService.nowTimestamp()}`,
      examType: "adaptive",
      startTime: TimeService.now().toISOString(),
      questions: selectedQs.map(q => q.id),
      answers: {},
      bookmarks: [],
      flags: [],
      isSubmitted: false,
      score: 0,
      timeSpent: 0
    };
  },

  /**
   * Generates a customized topological Learning Roadmap for the student.
   * Leverages Knowledge Graph dependencies and student Mastery levels.
   */
  generateLearningRoadmap(): LearningRoadmap {
    const activeSubjectId = dbService.getActiveSubjectId();
    const subjectName = dbService.getActiveSubjectName();
    const stats = dbService.getStatistics();
    const graph = kbService.getKnowledgeGraph(activeSubjectId);

    const nodeMap = new Map<string, KnowledgeNode>();
    graph.forEach(node => {
      nodeMap.set(node.concept.toLowerCase(), node);
      nodeMap.set(node.id.toLowerCase(), node);
    });

    const steps: LearningRoadmapStep[] = [];

    graph.forEach(node => {
      const profile = learnerModelService.getOrCreateProfile(node.concept);
      const mastery = stats.conceptMastery?.[node.concept] ?? stats.conceptMastery?.[node.id] ?? 50;

      let status: LearningRoadmapStep["status"] = "available";
      let reason = "Khái niệm đã mở khóa, sẵn sàng luyện tập.";
      let actionRecommendation = `Luyện đề thích ứng để tăng độ thành thạo và nấc thang Bloom.`;

      if (mastery >= 75) {
        status = "mastered";
        reason = `Đã tinh thông khái niệm này (Độ thạo: ${mastery}%).`;
        actionRecommendation = `Duy trì tần suất ôn tập Spaced Repetition định kỳ.`;
      } else {
        // Check prerequisites
        let blockedBy: string[] = [];
        if (node.dependencies && node.dependencies.requires) {
          node.dependencies.requires.forEach(reqNameOrId => {
            const reqNode = nodeMap.get(reqNameOrId.toLowerCase());
            if (reqNode) {
              const reqMastery = stats.conceptMastery?.[reqNode.concept] ?? stats.conceptMastery?.[reqNode.id] ?? 50;
              if (reqMastery < 50) {
                blockedBy.push(reqNode.concept);
              }
            }
          });
        }

        if (blockedBy.length > 0) {
          status = "locked";
          reason = `Bị khóa do chưa làm chủ kiến thức nền tảng: ${blockedBy.join(", ")}.`;
          actionRecommendation = `Hãy tập trung học và làm đúng các câu hỏi về "${blockedBy[0]}" trước để mở khóa.`;
        } else {
          // Available and unmastered
          if (profile.attemptsCount === 0) {
            reason = "Khái niệm mới hoàn toàn chưa học.";
            actionRecommendation = "Mở AI Hub, thảo luận lý thuyết hoặc khởi chạy Đề thích ứng ngay.";
          } else {
            reason = `Đang trong tiến trình học (Độ thạo: ${mastery}%, Tự tin: ${Math.round(profile.confidence * 100)}%).`;
            actionRecommendation = "Ôn tập các bẫy hiểu sai phổ biến (misconception) và luyện thêm 5 câu.";
          }
        }
      }

      steps.push({
        id: node.id,
        conceptName: node.concept,
        status,
        chapter: node.chapter || 1,
        reason,
        actionRecommendation
      });
    });

    // Calculate completion rate based on mastered steps
    const masteredCount = steps.filter(s => s.status === "mastered").length;
    const overallProgress = steps.length > 0 ? Math.round((masteredCount / steps.length) * 100) : 0;

    return {
      subjectName,
      overallProgress,
      steps: steps.sort((a, b) => a.chapter - b.chapter)
    };
  },

  /**
   * Wrong Answer Coach Diagnostic Generator
   * Extracts tutoring context, misconceptions, mini lessons, analogies, and quizzes without requiring AI calls!
   */
  getWrongAnswerCoachDiagnostics(question: Question): CoachDiagnostic | null {
    const activeSubjectId = dbService.getActiveSubjectId();
    const conceptNode = kbService.getConceptForQuestion(activeSubjectId, question);
    if (!conceptNode) return null;

    const quizOptions = kbService.getCoachingOptions(conceptNode);

    return {
      conceptName: conceptNode.concept,
      definition: conceptNode.definition,
      misconceptionDetected: question.misconception || conceptNode.teaching?.misconception || "Nhầm lẫn bản chất khái niệm.",
      miniLesson: conceptNode.coaching?.miniLesson || conceptNode.explanation?.simpleExplanation || "Xem bối cảnh lý thuyết.",
      analogy: conceptNode.explanation?.analogy || "Liên tưởng trực quan sinh động.",
      memoryHook: conceptNode.teaching?.memoryHook || `Ghi nhớ gắn liền với Chương ${conceptNode.chapter}.`,
      followUpQuiz: quizOptions
    };
  },

  /**
   * Forecasts learner's score if they take a university exam today vs in 3 days.
   * Utilizes forgetting curves, mastery, and confidence distribution.
   */
  calculateLearningForecast(): { scoreToday: number; scoreThreeDays: number; velocity: number } {
    const stats = dbService.getStatistics();
    const profiles = learnerModelService.getConceptProfiles();
    
    let totalScore = 0;
    let count = 0;

    let totalScoreInThreeDays = 0;

    // We can average accuracy over chapters, but concept-profile level prediction is much richer
    const profileList = Object.values(profiles);
    if (profileList.length === 0) {
      // Return default baseline prediction based on solved questions
      const accuracy = stats.totalSolved > 0 ? stats.totalCorrect / stats.totalSolved : 0.6;
      const today = Math.round(accuracy * 100);
      return {
        scoreToday: today,
        scoreThreeDays: Math.max(30, Math.round(today - 4)), // default memory decay if inactive
        velocity: 0
      };
    }

    let sumVelocity = 0;

    profileList.forEach(p => {
      // Today: Score prediction is a mixture of base concept mastery and confidence
      const pMastery = stats.conceptMastery?.[p.conceptId] || stats.conceptMastery?.[p.conceptName] || 50;
      const conceptScoreToday = (pMastery * 0.7) + (p.confidence * 100 * 0.3);
      totalScore += conceptScoreToday;
      count++;

      // In Three Days: Score decays according to predicted forgetting score decay
      // Let's compute retention after 3 days
      const lastStudied = p.lastStudiedAt ? new Date(p.lastStudiedAt).getTime() : TimeService.now().getTime();
      const threeDaysFromNow = TimeService.now().getTime() + (3 * 24 * 60 * 60 * 1000);
      const elapsedDays = (threeDaysFromNow - lastStudied) / (1000 * 60 * 60 * 24);

      const halfLife = 0.5 * Math.pow(2.2, Math.min(6, p.streak)) * (0.5 + p.confidence);
      const retentionInThreeDays = Math.max(0.01, Math.min(1.0, Math.exp(-elapsedDays / halfLife)));

      const conceptScoreInThreeDays = (conceptScoreToday * 0.5) + (retentionInThreeDays * 100 * 0.5);
      totalScoreInThreeDays += conceptScoreInThreeDays;

      sumVelocity += p.learningVelocity || 0;
    });

    const scoreToday = Math.round(totalScore / count);
    const scoreThreeDays = Math.round(totalScoreInThreeDays / count);
    const avgVelocity = parseFloat((sumVelocity / count).toFixed(3));

    return {
      scoreToday: Math.min(100, Math.max(10, scoreToday)),
      scoreThreeDays: Math.min(100, Math.max(10, scoreThreeDays)),
      velocity: avgVelocity
    };
  }
};
