/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

if (typeof globalThis !== "undefined" && typeof (globalThis as any).localStorage === "undefined") {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
}

import { dbService, setConceptMasteryBothKeys, questionMap, dangKyDonDuLieuSuyRa } from "./db";
import { kbService, KnowledgeNode } from "./kbService";
import { conceptMemoryService, conNhoSauNgay, doBenTriNhoNgay, doKhoTienNghiem, loiIchOnHomNay, mucNhoVaoNgayThi, rutBangChungTriNho, rutCapNhoLai } from "./conceptMemoryService";
import { TimeService } from "./time";
import { soThapPhan } from "./numberFormat";

export interface ConceptProfile {
  conceptId: string;
  conceptName: string;
  attemptsCount: number;
  correctCount: number;
  incorrectCount: number;
  lastStudiedAt?: string;
  avgTimeSpent: number; // in seconds
  confidence: number; // 0.0 to 1.0
  forgettingScore: number; // 0.0 to 1.0 (1.0 = fully retained, 0.0 = forgotten)
  reviewHistory: string[]; // ISO timestamps
  difficultyPreference: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
  streak: number;
  isBookmarked: boolean;
  isFlagged: boolean;
  learningVelocity: number; // average score slope
  nextReviewAt?: string; // ISO timestamp
  /**
   * Độ bền trí nhớ tính bằng NGÀY, chính là `S` trong `R(t) = e^(-t/S)`.
   *
   * Vì sao phải lưu chứ không tính lại ở nơi cần: `forgettingScore` chỉ nói mức nhớ TẠI THỜI
   * ĐIỂM tính, nên từ nó không chiếu tới được một mốc khác trong tương lai. Muốn hỏi "tới ngày
   * thi thì còn nhớ bao nhiêu" thì bắt buộc phải có `S`.
   *
   * Vẫn đúng bất biến 4.9c: giá trị này do `doBenTriNhoNgay` sinh ra, đây chỉ là chỗ CẤT nó
   * lại, không phải một công thức thứ hai.
   */
  doBenTriNhoNgay?: number;
}

/** Một khái niệm trong hàng đợi ôn hôm nay. */
export interface MucOnTap {
  tenKhaiNiem: string;
  /** Âm nghĩa là chưa tới hạn. */
  soNgayQuaHan: number;
  /** Mức còn nhớ ngay lúc này, thang 0 đến 1. */
  mucConNho: number;
  /** Độ bền `S` tính bằng ngày. */
  doBenNgay: number;
  /** Mức nhớ dự báo vào ngày thi nếu KHÔNG ôn. `null` khi chưa đặt ngày thi. */
  mucNhoNgayThi: number | null;
  /** Mức nhớ ngày thi tăng thêm nếu ôn hôm nay. `null` khi chưa đặt ngày thi. */
  loiIchNeuOnHomNay: number | null;
  /** Câu giải thích vì sao mục này nằm ở đây, viết cho người học đọc. */
  lyDo: string;
}

/** Kết quả xếp hàng đợi ôn hôm nay. */
export interface HangDoiOnTap {
  /**
   * `true` khi đang xếp theo lợi ích cho ngày thi, `false` khi lùi về xếp theo mức quá hạn kiểu
   * Anki vì chưa đặt ngày thi. Màn hình BẮT BUỘC đọc cờ này trước khi chọn câu chữ, vì hai chế
   * độ trả lời hai câu hỏi khác nhau.
   */
  xepTheoNgayThi: boolean;
  soNgayToiKyThi: number | null;
  danhSach: MucOnTap[];
  /** Số khái niệm đáng ôn nhưng bị cắt vì không đủ quỹ thời gian hôm nay. */
  soBiCatDoHetGio: number;
  /** Tới hạn theo lối cũ nhưng ôn hôm nay không giúp gì cho ngày thi, nên hoãn lại. */
  hoanLai: MucOnTap[];
  phutMoiNgay: number;
  /** Nhịp đã dùng để quy đổi thời gian, giây mỗi câu. */
  giayMoiCauDaDung: number;
}

/**
 * Số câu dành cho mỗi khái niệm trong một lượt ôn. Dùng chung giữa phép cắt theo quỹ thời gian ở
 * `layKhaiNiemToiHan` và phép rút câu của loại đề "due"; đặt hai con số khác nhau thì hàng đợi
 * hứa một đằng còn đề sinh ra một nẻo.
 */
export const SO_CAU_MOI_KHAI_NIEM = 3;

export interface AdaptiveMemory {
  preferredExplanationStyle: "academic" | "simplified" | "intuitive" | "visual";
  preferredAnalogy: "business" | "daily_life" | "technology" | "sports";
  readingSpeedWpm: number;
  averageThinkingTimeSeconds: number;
  typicalMistakes: string[];
  guessingFrequency: number; // 0 to 1
  reviewCompliance: number; // 0 to 1
  socraticSuccessRate: number; // 0 to 1
  questionFatigue: number; // 0 to 100

  // Extended Continuous Learning Properties
  preferredTeachingStyle: "Simple" | "Academic" | "Expert" | "Business" | "Real-world" | "Analogy" | "Socratic";
  preferredExplanationLength: "short" | "medium" | "deep";
  preferredAnalogyDensity: number; // 0.0 to 1.0
  preferredExampleDensity: number; // 0.0 to 1.0
  preferredBloomSpeed: "cautious" | "balanced" | "accelerated";
  preferredDifficultyCurve: "gentle" | "steep" | "adaptive";
  preferredRetryPattern: "immediate_hint" | "socratic_prompt" | "prerequisite_remedial";
  preferredSessionLength: number;
  preferredQuestionStyle: "concept_focused" | "case_study" | "analytical";
  learningVelocity: number;
  fatigueTrend: number;
  engagementTrend: "increasing" | "stable" | "declining";
  strategyPerformance: Record<string, { attempts: number; successes: number; avgMasteryGain: number; avgConfidenceGain: number }>;
  consecutiveFailures: Record<string, number>;
}

export interface StudentModel {
  subjectId: string;
  conceptMastery: Record<string, number>; // conceptName -> mastery level (0-100)
  chapterMastery: Record<number, number>; // chapterId -> mastery level (0-100)
  bloomLevel: Record<string, string>; // conceptName -> Current Bloom Level
  misconceptionHistory: Record<string, { misconception: string; timestamp: string; questionId: number }[]>; // conceptName -> misconceptions history
  confidenceHistory: Record<string, number[]>; // conceptName -> confidence scores history
  forgettingScore: Record<string, number>; // conceptName -> forgetting score (0.0 to 1.0)
  lastStudiedAt: Record<string, string>; // conceptName -> last studied ISO string
  learningVelocity: Record<string, number>; // conceptName -> learning velocity (rate of mastery change)
  adaptiveMemory: AdaptiveMemory;
}

export interface AIOrchestratorStats {
  apiCallsCount: number;
  totalTokensCount: number;
  estimatedCostUsd: number;
  cacheHitCount: number;
  responseTimeMsList: number[];
  fallbackOfflineCount: number;
  errorCount: number;
}

const ORCHESTRATOR_STATS_KEY = "poly_econ_orchestrator_stats";

export const studentModelService = {
  /**
   * Constructs and returns the complete StudentModel (Digital Twin) for the active subject.
   */
  getStudentModel(): StudentModel {
    const activeSubjectId = dbService.getActiveSubjectId();
    const profiles = learnerModelService.getConceptProfiles();
    const stats = dbService.getStatistics();

    const conceptMastery: Record<string, number> = {};
    const chapterMastery: Record<number, number> = {};
    const bloomLevel: Record<string, string> = {};
    const misconceptionHistory: Record<string, { misconception: string; timestamp: string; questionId: number }[]> = {};
    const confidenceHistory: Record<string, number[]> = {};
    const forgettingScore: Record<string, number> = {};
    const lastStudiedAt: Record<string, string> = {};
    const learningVelocity: Record<string, number> = {};

    // Load extra histories from localStorage
    const extraHistoriesKey = `poly_econ_student_model_extras_${activeSubjectId}`;
    let extras: {
      misconceptionHistory: Record<string, { misconception: string; timestamp: string; questionId: number }[]>;
      confidenceHistory: Record<string, number[]>;
    } = { misconceptionHistory: {}, confidenceHistory: {} };

    const rawExtras = localStorage.getItem(extraHistoriesKey);
    if (rawExtras) {
      try {
        extras = JSON.parse(rawExtras);
      } catch {
        // use default
      }
    }

    // Map profiles into StudentModel fields
    Object.entries(profiles).forEach(([conceptName, p]) => {
      const updatedP = learnerModelService.recalculateForgettingScore(p);
      const mastery = stats.conceptMastery?.[p.conceptId] || stats.conceptMastery?.[p.conceptName] || 50;
      
      conceptMastery[conceptName] = mastery;
      bloomLevel[conceptName] = updatedP.difficultyPreference;
      forgettingScore[conceptName] = updatedP.forgettingScore;
      if (updatedP.lastStudiedAt) {
        lastStudiedAt[conceptName] = updatedP.lastStudiedAt;
      }
      learningVelocity[conceptName] = updatedP.learningVelocity;

      misconceptionHistory[conceptName] = extras.misconceptionHistory[conceptName] || [];
      confidenceHistory[conceptName] = extras.confidenceHistory[conceptName] || [updatedP.confidence];
    });

    // Populate chapter mastery from stats
    Object.entries(stats.accuracyByChapter || {}).forEach(([chIdStr, data]: any) => {
      const chId = parseInt(chIdStr);
      if (data.total > 0) {
        chapterMastery[chId] = Math.round((data.correct / data.total) * 100);
      } else {
        chapterMastery[chId] = 0;
      }
    });

    const adaptiveMemory = this.getAdaptiveMemory();

    // Tỷ lệ đoán mò: ưu tiên con số ĐO ĐƯỢC từ nhịp làm bài thật, chỉ khi đủ dữ liệu.
    //
    // Vì sao phải nối ở đây thay vì ghi vào bộ nhớ: giá trị lưu trong `adaptiveMemory` được cập
    // nhật theo lối trung bình trượt `cũ * 0,8 + mới * 0,2`, mà chỉ cập nhật từ tương tác với
    // gia sư AI. Đo được: sau 3 đề đã nộp nó vẫn bằng **0**, nên `averageGuessingRate` trên màn
    // Phân tích giảng dạy luôn báo 0%. Nếu ghi thêm từ lượt làm bài vào chính ô trung bình trượt
    // đó thì con số sẽ phụ thuộc số lần gọi, đúng loại lỗi "số tự bò lên theo số lần mở màn
    // hình" đã sửa ở bộ dự báo. Nên tính tất định từ lịch sử tại mỗi lần đọc.
    const nhip = learnerModelService.doNhipLamBai();
    if (nhip.duDuLieu) {
      adaptiveMemory.guessingFrequency = nhip.tyLeDoanMo;
    }

    // Mỏi mệt: cùng lý do và cùng lối làm như trên. `questionFatigue` cũ chỉ cộng thêm 8 mỗi
    // lần hỏi gia sư AI và không bao giờ giảm, còn `fatigueTrend` thì không nơi nào ghi.
    const moiMoi = learnerModelService.doMoiMoiTheoViTri();
    if (moiMoi.duDuLieu) {
      adaptiveMemory.questionFatigue = moiMoi.chiSoMoiMoi;
      // Giữ nguyên dấu: dương nghĩa là làm càng về cuối càng sai nhiều.
      adaptiveMemory.fatigueTrend = Math.round(moiMoi.mucTutDaCo * 1000) / 1000;
    }

    return {
      subjectId: activeSubjectId,
      conceptMastery,
      chapterMastery,
      bloomLevel,
      misconceptionHistory,
      confidenceHistory,
      forgettingScore,
      lastStudiedAt,
      learningVelocity,
      adaptiveMemory
    };
  },

  getAdaptiveMemory(): AdaptiveMemory {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_adaptive_memory_${activeSubjectId}`;
    const defaults: AdaptiveMemory = {
      preferredExplanationStyle: "academic",
      preferredAnalogy: "business",
      readingSpeedWpm: 250,
      averageThinkingTimeSeconds: 15,
      typicalMistakes: [],
      guessingFrequency: 0.0,
      reviewCompliance: 1.0,
      socraticSuccessRate: 0.8,
      questionFatigue: 0,

      preferredTeachingStyle: "Academic",
      preferredExplanationLength: "medium",
      preferredAnalogyDensity: 0.5,
      preferredExampleDensity: 0.7,
      preferredBloomSpeed: "balanced",
      preferredDifficultyCurve: "adaptive",
      preferredRetryPattern: "socratic_prompt",
      preferredSessionLength: 10,
      preferredQuestionStyle: "concept_focused",
      // Tốc độ học của một hồ sơ CHƯA HỌC GÌ phải là 0, không phải 2,5. Bản cũ đặt 2,5, và con
      // số đó chảy thẳng ra màn hình Phân tích giảng dạy ở ô "Tốc độ Học tập" như thể đã đo
      // được. Các trường sở thích phía trên là mặc định về HÀNH VI DẠY (chọn kiểu giải thích
      // nào khi chưa biết gì về người học), khác hẳn về bản chất với một chỉ số đo lường.
      learningVelocity: 0,
      fatigueTrend: 0,
      engagementTrend: "stable",
      strategyPerformance: {},
      consecutiveFailures: {}
    };

    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      } catch {
        // use default
      }
    }
    return defaults;
  },

  saveAdaptiveMemory(memory: AdaptiveMemory): void {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_adaptive_memory_${activeSubjectId}`;
    localStorage.setItem(key, JSON.stringify(memory));
  },

  updateAdaptiveMemory(params: {
    timeSpent: number;
    wordCount: number;
    isCorrect: boolean;
    isGuessLikely: boolean;
    misconception?: string;
  }): void {
    const memory = this.getAdaptiveMemory();
    
    // 1. Reading Speed (words per minute), limit to sensible bounds
    if (params.timeSpent > 2 && params.wordCount > 5) {
      const currentSpeed = (params.wordCount / (params.timeSpent / 60));
      if (currentSpeed > 50 && currentSpeed < 1000) {
        memory.readingSpeedWpm = Math.round(memory.readingSpeedWpm * 0.8 + currentSpeed * 0.2);
      }
    }

    // 2. Average Thinking Time
    memory.averageThinkingTimeSeconds = Math.round(memory.averageThinkingTimeSeconds * 0.7 + params.timeSpent * 0.3);

    // 3. Guessing Frequency
    const guessWeight = params.isGuessLikely ? 1 : 0;
    memory.guessingFrequency = parseFloat((memory.guessingFrequency * 0.8 + guessWeight * 0.2).toFixed(3));

    // 4. Typical Mistakes
    if (params.misconception && !memory.typicalMistakes.includes(params.misconception)) {
      memory.typicalMistakes.push(params.misconception);
      if (memory.typicalMistakes.length > 10) {
        memory.typicalMistakes.shift();
      }
    }

    // 5. Question Fatigue
    //
    // KHÔNG cộng dồn nữa (28/07/2026). Cách cũ `questionFatigue + 8` chỉ tăng, không bao giờ
    // giảm, nên sau 13 lần hỏi gia sư AI là ghim ở 100 vĩnh viễn dù người học vừa ngủ dậy.
    // Nay chỉ số này được TÍNH LẠI tất định từ vị trí câu trong đề mỗi lần đọc, xem
    // `doMoiMoiTheoViTri`. Ghi thêm ở đây sẽ tạo nguồn thứ hai nói ngược lại nguồn kia.

    // 6. Dynamic Explanation Style / Analogy adjustment based on performance
    if (params.isCorrect) {
      if (memory.questionFatigue > 60) {
        memory.preferredExplanationStyle = "visual";
      } else {
        memory.preferredExplanationStyle = "academic";
      }
    } else {
      memory.preferredExplanationStyle = "simplified";
      memory.preferredAnalogy = "daily_life";
    }

    this.saveAdaptiveMemory(memory);
  },

  saveStudentModelExtraHistories(
    misconceptionHistory: Record<string, { misconception: string; timestamp: string; questionId: number }[]>,
    confidenceHistory: Record<string, number[]>
  ): void {
    const activeSubjectId = dbService.getActiveSubjectId();
    const extraHistoriesKey = `poly_econ_student_model_extras_${activeSubjectId}`;
    localStorage.setItem(extraHistoriesKey, JSON.stringify({ misconceptionHistory, confidenceHistory }));
  },

  logMisconception(conceptName: string, misconception: string, questionId: number): void {
    const model = this.getStudentModel();
    const history = model.misconceptionHistory[conceptName] || [];
    history.push({
      misconception,
      timestamp: TimeService.now().toISOString(),
      questionId
    });
    model.misconceptionHistory[conceptName] = history.slice(-10); // Keep last 10
    this.saveStudentModelExtraHistories(model.misconceptionHistory, model.confidenceHistory);
  },

  logConfidenceValue(conceptName: string, confidence: number): void {
    const model = this.getStudentModel();
    const history = model.confidenceHistory[conceptName] || [];
    history.push(confidence);
    model.confidenceHistory[conceptName] = history.slice(-20); // Keep last 20
    this.saveStudentModelExtraHistories(model.misconceptionHistory, model.confidenceHistory);
  },

  updateConceptMastery(conceptName: string, mastery: number): void {
    const stats = dbService.getStatistics();
    if (!stats.conceptMastery) {
      stats.conceptMastery = {};
    }
    // Ghi đồng thời khóa mã và khóa tên để hai nguồn cập nhật độ thạo không bao giờ lệch
    // nhau (xem chú thích tại setConceptMasteryBothKeys trong db.ts).
    setConceptMasteryBothKeys(stats, conceptName, mastery);
    dbService.saveStatistics(stats);
  }
};

/** Kết quả đo hiệu chuẩn nhận thức, tức mức khớp giữa "tự thấy chắc" và "làm đúng thật". */
export interface HieuChuanNhanThuc {
  /** Đủ dữ liệu để kết luận hay chưa. Chưa đủ thì mọi con số bên dưới KHÔNG được dùng. */
  duDuLieu: boolean;
  /** Số câu đã xét, chỉ tính lượt đã nộp. */
  soCauXet: number;
  /** Số câu người học có gắn cờ nghi vấn. */
  soCauGanCo: number;
  /** Bốn ô bắt chéo giữa "có gắn cờ" và "làm đúng". */
  o: {
    coCoLamDung: number;
    coCoLamSai: number;
    khongCoLamSai: number;
    khongCoLamDung: number;
  };
  /** Tỷ lệ ô thừa tự tin (không gắn cờ mà làm sai) trên tổng số câu xét, thang 0 đến 1. */
  tyLeThuaTuTin: number;
  /** Trọng số bằng chứng w = 1 - e^(-n/k), thang 0 đến 1. */
  trongSoBangChung: number;
  /** Tỷ lệ thừa tự tin đã co về 0 theo lượng bằng chứng. Đây là con số dùng được. */
  thuaTuTinDaCo: number;
  giaiTrinh: string;
}

/**
 * Mốc bằng chứng cho phép co. Dùng CÙNG hằng số 6 với `db.recomputeStatistics` (dòng 750,
 * `w = 1 - e^(-answered/6)`) để cả dự án chỉ có đúng một cách co theo lượng bằng chứng.
 * Đừng phát minh mốc mới.
 */
const MOC_BANG_CHUNG_CO = 6;

/** Số câu tối thiểu mới dám kết luận. Dưới mức này thì trả về "chưa đủ dữ liệu". */
const TOI_THIEU_CAU_XET = 20;
/** Số câu gắn cờ tối thiểu. Không có cờ nào thì không thể nói gì về hiệu chuẩn. */
const TOI_THIEU_CAU_GAN_CO = 5;

/**
 * Mức tự tin của người học trên MỘT câu, suy từ nút cờ nghi vấn họ tự bấm khi làm bài.
 *
 * VÌ SAO CẦN HÀM NÀY (27/07/2026). Cây cầu duy nhất nối "làm bài" với tầng trí nhớ khái niệm
 * là hook nộp bài trong `studentEvolutionEngine`, và nó vốn truyền `confidence = đúng ? 0,85 :
 * 0,4`. Tức độ tự tin được SUY NGƯỢC từ kết quả đúng sai, chứ không phải đo từ người học.
 *
 * Hậu quả đo được: `conceptMemoryService` lấy chính con số đó so lại với tỷ lệ đúng để xếp
 * loại hiệu chuẩn. Thay `averageConfidence ≈ 0,4 + 0,45a` vào `diff = averageConfidence - a`
 * ra `diff = 0,4 - 0,55a`, nên `diff < -0,20` đòi `a > 1,09`, một điều không thể xảy ra:
 * nhãn **"underconfident" vĩnh viễn không bao giờ xuất hiện**, còn "overconfident" chỉ là cách
 * gọi khác của "tỷ lệ đúng dưới 36,4%". Chỉ số tự nhận đo mức tự tin nhưng thực chất đo lại
 * đúng cái nó đang so sánh, tức một vòng luẩn quẩn.
 *
 * Trong khi đó tín hiệu THẬT đã nằm sẵn: `attempt.flags` là danh sách câu người học tự đánh
 * dấu "chưa chắc" ngay lúc làm bài. Đây là dữ liệu tự khai, thứ đắt nhất trong đo lường học
 * tập, và trước lượt này không tầng nào ở mức khái niệm đọc tới.
 *
 * Ba mức trả về được chọn để rơi đúng vào các ngưỡng `pedagogicalEvaluationEngine` đang dùng
 * sẵn (`confidence > 0,7` là chắc, `confidence < 0,4` là không chắc), không phải số tự đặt:
 *   - có gắn cờ            -> 0,25, nằm dưới ngưỡng "không chắc"
 *   - không gắn cờ         -> 0,80, nằm trên ngưỡng "chắc"
 *   - cả lượt không cờ nào -> 0,50, nằm giữa hai ngưỡng, tức KHÔNG kết luận gì
 *
 * Mức giữa quan trọng không kém hai mức kia: người học không bấm nút cờ lần nào thì "không
 * gắn cờ" không phải bằng chứng của sự tự tin, nó chỉ là im lặng. Đọc im lặng thành tự tin
 * chính là kiểu bịa mà bất biến 4.9 cấm.
 */
export function doTuTinTuCoNghiVan(coNghiVanCuaLuot: number[] | undefined, questionId: number): number {
  const co = coNghiVanCuaLuot || [];
  if (co.length === 0) return 0.5;
  return co.includes(questionId) ? 0.25 : 0.8;
}

/** Kết quả đo hiệu ứng mỏi mệt theo vị trí câu trong đề. */
export interface MoiMoiTheoViTri {
  duDuLieu: boolean;
  /** Số câu được xét, chỉ tính lượt đã nộp và đề đủ dài. */
  soCauXet: number;
  /** Số lượt được xét. */
  soLuotXet: number;
  /** Tỷ lệ đúng ở một phần ba ĐẦU đề, thang 0 đến 1. */
  tyLeDungDauDe: number;
  /** Tỷ lệ đúng ở một phần ba CUỐI đề, thang 0 đến 1. */
  tyLeDungCuoiDe: number;
  /** Mức tụt đã KHỬ ảnh hưởng độ khó, dương nghĩa là làm càng về sau càng sai nhiều. */
  mucTut: number;
  /** Mức tụt sau khi co theo lượng bằng chứng. Đây là con số dùng được. */
  mucTutDaCo: number;
  /** Quy về thang 0 đến 100 để hợp với các nơi tiêu thụ sẵn có. */
  chiSoMoiMoi: number;
  giaiTrinh: string;
}

/** Số câu tối thiểu mới dám kết luận về mỏi mệt. */
const TOI_THIEU_CAU_MOI_MOI = 30;
/** Đề ngắn hơn mức này thì chia ba không còn nghĩa, bỏ qua. */
const DO_DAI_DE_TOI_THIEU = 9;
/**
 * Mức tụt tỷ lệ đúng ứng với chỉ số mỏi mệt kịch trần 100.
 *
 * Đây là QUY ƯỚC THANG ĐO, không phải một phép đo. Phần đo được là `mucTut`, còn hằng số này
 * chỉ trả lời câu hỏi "tụt bao nhiêu thì gọi là mỏi hết cỡ". Chọn 0,30 vì các nơi tiêu thụ sẵn
 * có đang lấy mốc báo động ở 60 trên 100, tương ứng mức tụt 18 điểm phần trăm giữa đầu và cuối
 * đề, một mức đã đủ lớn để thấy bằng mắt trên bảng kết quả. Đổi hằng số này thì phải đổi cả
 * các mốc bên `adaptiveTeachingPolicy`, `teachingDecisionEngine` và `learningPlanner`.
 */
const MUC_TUT_KICH_TRAN = 0.30;

/**
 * Một lượt làm bài có nhanh bất thường không, so với tổng thời gian ước tính của chính các câu
 * trong đề đó.
 *
 * Dùng lại ĐÚNG ngưỡng `NHIP_NHANH_TOI_DA` của `doNhipLamBai` để cả dự án chỉ có một định
 * nghĩa "làm nhanh bất thường". Đừng đặt ngưỡng thứ hai ở chỗ khác.
 *
 * Trả về `false` khi thiếu dữ liệu (không có thời gian thật, hoặc không có mốc ước tính), tức
 * mặc định KHÔNG kết tội người học đoán mò.
 */
export function luotCoNhipNhanh(luot: { questions?: number[]; timeSpent?: number }): boolean {
  const dsCau = luot.questions || [];
  if (dsCau.length === 0 || !luot.timeSpent || luot.timeSpent <= 0) return false;
  const chuan = mocNhipChuan(dsCau);
  if (chuan <= 0) return false;
  return luot.timeSpent / chuan <= NHIP_NHANH_TOI_DA;
}

/** Số câu tối thiểu của chính người học mới dám lấy nhịp của họ làm mốc. */
const TOI_THIEU_CAU_LAY_NHIP_RIENG = 20;

/**
 * MỐC THỜI GIAN CHUẨN cho một danh sách câu, giây, dùng để hỏi "lượt NÀY có nhanh bất thường
 * không". Ưu tiên nhịp THẬT của chính người học, chỉ lùi về `estimatedTime` khi chưa đủ bằng chứng.
 *
 * CHỈ DÙNG CHO PHÉP SO TỪNG LƯỢT, đừng mang sang phép đo gộp. Bản đầu của lượt 13/08/2026 đã thay
 * luôn mốc trong `doNhipLamBai`, và phép kiểm P6 đỏ ngay: khi mốc chính là trung vị của chính người
 * học thì tổng thời gian thật chia tổng mốc luôn xấp xỉ 1 **theo định nghĩa**, nên mức đoán mò gộp
 * không bao giờ khác 0 được nữa. Một chỉ số bị làm cho không thể khác 0 thì tệ hơn một chỉ số thô,
 * vì nó im lặng đúng lúc cần lên tiếng. Đây là họ lỗi "phép kiểm rỗng" mang sang tầng số đo.
 *
 * Ranh giới đúng: câu hỏi "lượt này có nhanh bất thường không" là câu hỏi SO VỚI CHÍNH NGƯỜI ẤY,
 * nên mốc riêng là đúng. Câu hỏi "người này nhìn chung có làm ẩu không" cần một mốc NGOÀI người
 * học, nên `doNhipLamBai` phải giữ `estimatedTime` dù nó thô.
 *
 * VÌ SAO ĐỔI (đo ngày 12/08/2026). `estimatedTime` bằng đúng **35,0 giây cho cả ba mức khó** trên
 * 280 câu của ngân hàng AI sinh, tức nó là một HẰNG SỐ đội lốt số đo. Hai ngân hàng biên soạn tay
 * thì có bám độ khó (30,0 / 41,7 / 50,0 giây), nên con số "34,7 / 35,3 / 35,2" từng ghi trong
 * WORKSTATE là trung bình của hai loại trộn lẫn và che mất sự thật này.
 *
 * Hệ quả với phần phát hiện đoán mò: so thời gian thật với một hằng số nhân số câu thì chỉ đo
 * được TỐC ĐỘ TUYỆT ĐỐI, không phân biệt nổi người làm nhanh vì thạo với người làm nhanh vì câu
 * dễ. Nhịp riêng của người học không có nhược điểm ấy, vì nó tự mang theo tốc độ nền của chính họ.
 *
 * Ngưỡng 20 câu là mức đã dùng cho các mạch dữ liệu khác của dự án. Dưới mức đó thì nhịp riêng
 * còn nhiễu hơn cả một hằng số, nên vẫn lùi về `estimatedTime` và nói rõ trong phần giải trình.
 *
 * Giai đoạn 5 sẽ thay hẳn bằng thời gian ĐO TỪNG CÂU. Khi đó hàm này chỉ còn là đường lùi.
 */
export function mocNhipChuan(dsCau: number[]): number {
  const nhipRieng = nhipRiengMoiCau();
  if (nhipRieng !== null) return nhipRieng * dsCau.length;
  return dsCau.reduce((s, id) => s + (questionMap.get(id)?.estimatedTime || 0), 0);
}

/**
 * Trung vị số giây mỗi câu của chính người học, hoặc `null` khi chưa đủ 20 câu.
 *
 * Dùng TRUNG VỊ chứ không dùng trung bình: một lượt bị bỏ dở với đồng hồ chạy suốt sẽ kéo trung
 * bình lên hàng nghìn giây một câu, còn trung vị thì không nhúc nhích.
 *
 * Bất biến 4.9f: tính lại tất định tại mỗi lần đọc, không cộng dồn vào ô nhớ.
 */
export function nhipRiengMoiCau(): number | null {
  const lichSu = dbService.getHistory().filter(a => a.isSubmitted);
  const mauNhip: number[] = [];
  let tongCau = 0;
  for (const luot of lichSu) {
    const soCau = (luot.questions || []).length;
    if (soCau === 0) continue;

    // Ưu tiên số ĐO TỪNG CÂU khi có (từ 13/08/2026). Mỗi câu là một mẫu riêng, nên trung vị bám
    // sát nhịp thật hơn hẳn so với trung vị của các nhịp trung bình theo lượt.
    const doDuoc = Object.values(luot.answerTimings || {}).filter(v => typeof v === "number" && v > 0);
    if (doDuoc.length > 0) {
      mauNhip.push(...doDuoc);
      tongCau += doDuoc.length;
      continue;
    }

    // Bản ghi cũ chỉ có tổng thời gian: một mẫu cho cả lượt.
    if (!luot.timeSpent || luot.timeSpent <= 0) continue;
    mauNhip.push(luot.timeSpent / soCau);
    tongCau += soCau;
  }
  if (tongCau < TOI_THIEU_CAU_LAY_NHIP_RIENG || mauNhip.length === 0) return null;
  const daSap = mauNhip.slice().sort((a, b) => a - b);
  const giua = Math.floor(daSap.length / 2);
  return daSap.length % 2 === 1 ? daSap[giua] : (daSap[giua - 1] + daSap[giua]) / 2;
}

/** Kết quả đo nhịp làm bài và mức đoán mò suy ra từ đó. */
export interface NhipLamBai {
  duDuLieu: boolean;
  /** Số lượt đã nộp được xét. */
  soLuotXet: number;
  /** Tổng thời gian thật, giây. */
  tongThoiGianThat: number;
  /** Tổng thời gian ước tính theo `estimatedTime` của các câu trong đề, giây. */
  tongThoiGianChuan: number;
  /** Thời gian thật chia thời gian chuẩn. Dưới 1 là làm nhanh hơn dự kiến. */
  tyLeNhip: number;
  /** Tỷ lệ đúng trên các lượt được xét, thang 0 đến 1. */
  tyLeDung: number;
  /** Mức đoán mò, thang 0 đến 1. Cao chỉ khi VỪA nhanh bất thường VỪA sai nhiều. */
  tyLeDoanMo: number;
  giaiTrinh: string;
}

/**
 * Ngưỡng mềm cho phần "nhanh": nhịp bằng 1 trở lên thì hệ số nhanh bằng 0, nhịp bằng
 * `NHIP_NHANH_TOI_DA` trở xuống thì bằng 1, ở giữa nội suy tuyến tính.
 * Đây là hàm LIÊN TỤC, không phải bậc thang. Đặt theo số đo: `estimatedTime` trung bình 35,1
 * giây một câu, nên làm dưới 40% thời lượng dự kiến là dấu hiệu đáng nghi.
 */
const NHIP_NHANH_TOI_DA = 0.40;
/** Số lượt đã nộp tối thiểu mới dám kết luận về nhịp. */
const TOI_THIEU_LUOT_NHIP = 2;

export const learnerModelService = {
  /**
   * Đo nhịp làm bài và suy ra mức đoán mò.
   *
   * Vì sao đáng làm: hai đầu dữ liệu đã có sẵn mà chưa ai bắc cầu.
   *   - Đầu chuẩn: `estimatedTime` có ở **292/292** câu, 5 giá trị khác nhau từ 30 đến 50 giây,
   *     trung bình 35,1 giây. Nhưng nó chỉ được dùng lúc nhập liệu và sinh câu, chưa từng được
   *     so với thực tế.
   *   - Đầu thực tế: `attempt.timeSpent` được `PracticeView` đếm thật từng giây rồi ghi vào lượt
   *     làm bài. Đo trong trình duyệt: một phiên 10 câu ghi được 448 giây.
   *
   * Và `adaptiveMemory.guessingFrequency` đo được **luôn bằng 0** sau 3 đề đã nộp, vì nó chỉ
   * được cập nhật từ tương tác với gia sư AI, không từ lượt làm bài. Nói cách khác, phát hiện
   * đoán mò trong lúc thi hiện KHÔNG TỒN TẠI dù dữ liệu đã nằm sẵn.
   *
   * Hai điều quan trọng trong cách chấm:
   *
   * 1. **Nhanh mà vẫn đúng là THÀNH THẠO, không phải đoán mò.** Nên mức đoán mò là TÍCH của hệ
   *    số nhanh với tỷ lệ sai. Chỉ nhìn tốc độ thì sẽ phạt oan người giỏi, đúng loại lỗi "hạ
   *    điểm hệ thống" đã sửa ở bộ dự báo.
   * 2. **Bỏ lượt dở dang.** `timeSpent` của phiên bị bỏ giữa chừng không phản ánh nhịp thật, vì
   *    đồng hồ vẫn chạy khi người học rời đi. Chỉ xét `isSubmitted`.
   */
  /**
   * Hiệu ứng mỏi mệt: người học làm càng về cuối đề thì càng sai nhiều hay không.
   *
   * VÌ SAO CẦN (28/07/2026). `attempt.questions` là mảng CÓ THỨ TỰ và `answers` tra theo id,
   * nên tỷ lệ đúng theo vị trí tính được ngay, nhưng không nơi nào tính. Cùng lúc:
   *   - `adaptiveMemory.fatigueTrend` được khai báo, khởi tạo 0, và KHÔNG nơi nào ghi cũng
   *     không nơi nào đọc. Một trường chết hoàn toàn.
   *   - `adaptiveMemory.questionFatigue` chỉ được cộng thêm 8 mỗi lần hỏi gia sư AI và không
   *     bao giờ giảm, nên sau 13 lần hỏi là ghim ở 100 vĩnh viễn, còn người chỉ làm bài thì
   *     mãi ở 0. Bốn nơi đang ra quyết định thật dựa trên con số đó: luật giảm tải của
   *     `adaptiveTeachingPolicy` (mốc 60), `teachingDecisionEngine` (mốc 75),
   *     `learningPlanner` (mốc 70) và ô "Cần nghỉ" trên màn Phân tích giảng dạy.
   *
   * KHỬ ẢNH HƯỞNG ĐỘ KHÓ. Nếu chỉ so tỷ lệ đúng đầu đề với cuối đề thì sẽ nhầm độ khó thành
   * mỏi mệt. Đã đo trên 40 đề sinh ngẫu nhiên: độ khó trung bình theo ba phần đề là 1,932 và
   * 1,971 và 1,864 trên thang 1 tới 3, tức lệch tối đa 0,107. Nhỏ nhưng khác 0, nên vẫn so
   * TRONG TỪNG NHÓM ĐỘ KHÓ rồi mới gộp lại, thay vì so thẳng.
   *
   * Tính tất định tại mỗi lần đọc, không ghi vào ô trung bình trượt, cùng lý do đã nêu ở
   * `guessingFrequency`: ghi vào đó thì con số phụ thuộc số lần mở màn hình.
   */
  doMoiMoiTheoViTri(): MoiMoiTheoViTri {
    const lichSu = dbService.getHistory().filter(a => a.isSubmitted);

    // Đếm theo (nhóm độ khó, phần đầu hay phần cuối đề).
    const dau = new Map<string, { dung: number; tong: number }>();
    const cuoi = new Map<string, { dung: number; tong: number }>();
    let soCauXet = 0;
    let soLuotXet = 0;
    let dungDauTho = 0, tongDauTho = 0, dungCuoiTho = 0, tongCuoiTho = 0;

    for (const luot of lichSu) {
      const dsCau = luot.questions || [];
      if (dsCau.length < DO_DAI_DE_TOI_THIEU) continue;
      soLuotXet++;
      const nguong = dsCau.length / 3;
      dsCau.forEach((id, i) => {
        const q = questionMap.get(id);
        if (!q) return;
        const traLoi = luot.answers?.[id];
        if (traLoi === undefined) return;
        const dungCau = traLoi === q.correctAnswer;
        const nhom = String(q.difficulty || "Trung bình");
        soCauXet++;
        if (i < nguong) {
          const o = dau.get(nhom) || { dung: 0, tong: 0 };
          o.dung += dungCau ? 1 : 0; o.tong++; dau.set(nhom, o);
          dungDauTho += dungCau ? 1 : 0; tongDauTho++;
        } else if (i >= dsCau.length - nguong) {
          const o = cuoi.get(nhom) || { dung: 0, tong: 0 };
          o.dung += dungCau ? 1 : 0; o.tong++; cuoi.set(nhom, o);
          dungCuoiTho += dungCau ? 1 : 0; tongCuoiTho++;
        }
      });
    }

    // Gộp các nhóm độ khó, cân theo số câu MỎNG NHẤT của mỗi nhóm để một nhóm chỉ có vài câu
    // không kéo lệch kết quả.
    let tuSo = 0, mauSo = 0;
    for (const [nhom, oDau] of dau) {
      const oCuoi = cuoi.get(nhom);
      if (!oCuoi || oDau.tong === 0 || oCuoi.tong === 0) continue;
      const canNang = Math.min(oDau.tong, oCuoi.tong);
      tuSo += (oDau.dung / oDau.tong - oCuoi.dung / oCuoi.tong) * canNang;
      mauSo += canNang;
    }

    const duDuLieu = soCauXet >= TOI_THIEU_CAU_MOI_MOI && mauSo > 0;
    const mucTut = mauSo > 0 ? tuSo / mauSo : 0;
    const trongSo = 1 - Math.exp(-soCauXet / MOC_BANG_CHUNG_CO);
    const mucTutDaCo = duDuLieu ? mucTut * trongSo : 0;
    const chiSoMoiMoi = duDuLieu
      ? Math.round(Math.min(100, Math.max(0, mucTutDaCo / MUC_TUT_KICH_TRAN) * 100))
      : 0;

    const tyLeDungDauDe = tongDauTho > 0 ? dungDauTho / tongDauTho : 0;
    const tyLeDungCuoiDe = tongCuoiTho > 0 ? dungCuoiTho / tongCuoiTho : 0;

    const giaiTrinh = duDuLieu
      ? `Xét ${soLuotXet} lượt và ${soCauXet} câu. Tỷ lệ đúng ${soThapPhan((tyLeDungDauDe * 100), 1)}% ở đầu đề so với ${soThapPhan((tyLeDungCuoiDe * 100), 1)}% ở cuối đề. Sau khi so trong từng nhóm độ khó rồi gộp lại, mức tụt là ${soThapPhan((mucTut * 100), 1)} điểm phần trăm, co theo lượng bằng chứng (w = ${soThapPhan(trongSo, 3)}) còn ${soThapPhan((mucTutDaCo * 100), 1)}, tức chỉ số mỏi mệt ${chiSoMoiMoi}/100.`
      : `Chưa đủ dữ liệu: cần tối thiểu ${TOI_THIEU_CAU_MOI_MOI} câu trong các đề dài từ ${DO_DAI_DE_TOI_THIEU} câu trở lên, hiện có ${soCauXet} câu qua ${soLuotXet} lượt.`;

    return { duDuLieu, soCauXet, soLuotXet, tyLeDungDauDe, tyLeDungCuoiDe, mucTut, mucTutDaCo, chiSoMoiMoi, giaiTrinh };
  },

  doNhipLamBai(): NhipLamBai {
    const lichSu = dbService.getHistory().filter(a => a.isSubmitted);

    let tongThat = 0;
    let tongChuan = 0;
    let soDung = 0;
    let soCau = 0;
    let soLuotXet = 0;

    for (const luot of lichSu) {
      const dsCau = luot.questions || [];
      if (dsCau.length === 0) continue;
      // CỐ Ý dùng `estimatedTime` chứ không dùng `mocNhipChuan`: phép đo gộp cần một mốc NGOÀI
      // người học, xem chú thích dài ở `mocNhipChuan`.
      const chuan = dsCau.reduce((s, id) => s + (questionMap.get(id)?.estimatedTime || 0), 0);
      // Không có mốc chuẩn thì không so được, bỏ lượt đó thay vì gán bừa một con số.
      if (chuan <= 0 || !luot.timeSpent || luot.timeSpent <= 0) continue;

      soLuotXet++;
      tongThat += luot.timeSpent;
      tongChuan += chuan;
      for (const id of dsCau) {
        const q = questionMap.get(id);
        if (!q) continue;
        soCau++;
        if (luot.answers?.[id] === q.correctAnswer) soDung++;
      }
    }

    const duDuLieu = soLuotXet >= TOI_THIEU_LUOT_NHIP && soCau > 0;
    const tyLeNhip = tongChuan > 0 ? tongThat / tongChuan : 1;
    const tyLeDung = soCau > 0 ? soDung / soCau : 0;

    // Hệ số nhanh, liên tục trong khoảng 0 đến 1.
    const heSoNhanh = Math.min(1, Math.max(0, (1 - tyLeNhip) / (1 - NHIP_NHANH_TOI_DA)));
    const tyLeSai = 1 - tyLeDung;
    const trongSo = 1 - Math.exp(-soCau / MOC_BANG_CHUNG_CO);
    const tyLeDoanMo = duDuLieu
      ? Math.min(1, Math.max(0, heSoNhanh * tyLeSai * trongSo))
      : 0;

    const giaiTrinh = duDuLieu
      ? `Xét ${soLuotXet} lượt đã nộp: ${tongThat}s thật so với ${tongChuan}s theo ước tính của ngân hàng câu hỏi, tỷ lệ nhịp ${soThapPhan(tyLeNhip, 2)}. Tỷ lệ đúng ${soThapPhan((tyLeDung * 100), 1)}%. Hệ số nhanh ${soThapPhan(heSoNhanh, 2)} nhân tỷ lệ sai ${soThapPhan(tyLeSai, 2)} cho mức đoán mò ${soThapPhan((tyLeDoanMo * 100), 1)}%.`
      : `Chưa đủ dữ liệu: cần tối thiểu ${TOI_THIEU_LUOT_NHIP} lượt đã nộp có cả thời gian thật và mốc ước tính, hiện có ${soLuotXet}.`;

    return {
      duDuLieu,
      soLuotXet,
      tongThoiGianThat: tongThat,
      tongThoiGianChuan: tongChuan,
      tyLeNhip,
      tyLeDung,
      tyLeDoanMo,
      giaiTrinh,
    };
  },

  /**
   * Đo hiệu chuẩn nhận thức từ cờ nghi vấn mà chính người học tự bật trên từng câu.
   *
   * Vì sao đáng làm: `PracticeView` cho người học gắn cờ "không chắc" và `saveAttempt` lưu cờ đó
   * vào từng lượt làm bài, nhưng **không một service suy luận nào đọc `attempt.flags`**. Đây là
   * tín hiệu người học TỰ KHAI về mức chắc chắn, thứ đắt nhất trong đo lường giáo dục, vì bắt
   * chéo nó với đúng sai cho ra bốn ô có ý nghĩa rất khác nhau:
   *
   *   - gắn cờ mà làm ĐÚNG   : thiếu tự tin, biết mà không tin mình biết.
   *   - gắn cờ và làm SAI    : lỗ hổng đã tự nhận ra, dễ chữa nhất.
   *   - KHÔNG cờ mà làm SAI  : **thừa tự tin**, ô nguy hiểm nhất, vì người học không biết là
   *                            mình không biết nên sẽ không bao giờ tự ôn lại phần đó.
   *   - KHÔNG cờ và làm ĐÚNG : đã vững thật.
   *
   * Chỉ đếm lượt đã nộp (`isSubmitted`), vì phiên bỏ giữa chừng không phản ánh ý định thật.
   *
   * Thiếu dữ liệu thì trả `duDuLieu: false` chứ không trả một con số cho đẹp, đúng bất biến 4.9.
   */
  doHieuChuanNhanThuc(): HieuChuanNhanThuc {
    const lichSu = dbService.getHistory().filter(a => a.isSubmitted);

    let coCoLamDung = 0, coCoLamSai = 0, khongCoLamSai = 0, khongCoLamDung = 0;
    let soCauGanCo = 0;

    for (const luot of lichSu) {
      const co = new Set(luot.flags || []);
      for (const id of luot.questions || []) {
        const q = questionMap.get(id);
        if (!q) continue;
        const dung = luot.answers?.[id] === q.correctAnswer;
        if (co.has(id)) {
          soCauGanCo++;
          if (dung) coCoLamDung++; else coCoLamSai++;
        } else {
          if (dung) khongCoLamDung++; else khongCoLamSai++;
        }
      }
    }

    const soCauXet = coCoLamDung + coCoLamSai + khongCoLamSai + khongCoLamDung;
    const duDuLieu = soCauXet >= TOI_THIEU_CAU_XET && soCauGanCo >= TOI_THIEU_CAU_GAN_CO;

    const tyLeThuaTuTin = soCauXet > 0 ? khongCoLamSai / soCauXet : 0;
    const trongSoBangChung = 1 - Math.exp(-soCauXet / MOC_BANG_CHUNG_CO);
    const thuaTuTinDaCo = duDuLieu ? tyLeThuaTuTin * trongSoBangChung : 0;

    const giaiTrinh = duDuLieu
      ? `Xét ${soCauXet} câu đã nộp, ${soCauGanCo} câu được gắn cờ nghi vấn. Thừa tự tin ${soThapPhan((tyLeThuaTuTin * 100), 1)}%, sau khi co theo lượng bằng chứng (w = ${soThapPhan(trongSoBangChung, 3)}) còn ${soThapPhan((thuaTuTinDaCo * 100), 1)}%.`
      : `Chưa đủ dữ liệu: cần tối thiểu ${TOI_THIEU_CAU_XET} câu đã nộp và ${TOI_THIEU_CAU_GAN_CO} câu gắn cờ, hiện có ${soCauXet} câu và ${soCauGanCo} cờ.`;

    return {
      duDuLieu,
      soCauXet,
      soCauGanCo,
      o: { coCoLamDung, coCoLamSai, khongCoLamSai, khongCoLamDung },
      tyLeThuaTuTin,
      trongSoBangChung,
      thuaTuTinDaCo,
      giaiTrinh,
    };
  },

  /**
   * Retrieves the detailed concept profiles for the active subject.
   */
  getConceptProfiles(): Record<string, ConceptProfile> {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_concept_profiles_${activeSubjectId}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  /**
   * Saves the concept profiles.
   */
  saveConceptProfiles(profiles: Record<string, ConceptProfile>): void {
    const activeSubjectId = dbService.getActiveSubjectId();
    const key = `poly_econ_concept_profiles_${activeSubjectId}`;
    localStorage.setItem(key, JSON.stringify(profiles));
  },

  /**
   * Returns or initializes the profile for a specific concept.
   */
  getOrCreateProfile(conceptName: string): ConceptProfile {
    const profiles = this.getConceptProfiles();
    if (profiles[conceptName]) {
      // Re-calculate forgetting score on retrieval to ensure real-time decay
      const updatedProfile = this.recalculateForgettingScore(profiles[conceptName]);
      profiles[conceptName] = updatedProfile;
      this.saveConceptProfiles(profiles);
      return updatedProfile;
    }

    const newProfile: ConceptProfile = {
      conceptId: conceptName.replace(/\s+/g, "_").toLowerCase(),
      conceptName,
      attemptsCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      avgTimeSpent: 0,
      confidence: 0.1, // starts with a baseline confidence
      forgettingScore: 1.0,
      reviewHistory: [],
      difficultyPreference: "Understand",
      streak: 0,
      isBookmarked: false,
      isFlagged: false,
      learningVelocity: 0,
      nextReviewAt: TimeService.now().toISOString()
    };
    profiles[conceptName] = newProfile;
    this.saveConceptProfiles(profiles);
    return newProfile;
  },

  /**
   * Mức còn nhớ của một khái niệm và thời điểm tới hạn ôn lại.
   *
   * VÌ SAO VIẾT LẠI (27/07/2026). Dự án đang có HAI đường cong quên hoàn toàn khác nhau cho
   * cùng một câu hỏi "còn nhớ bao nhiêu phần trăm", và chúng nói hai điều trái ngược:
   *
   *   người mới học, nghỉ 1 ngày   -> conceptMemoryService nói 87%, hàm này nói 32%
   *   học 5 lần đúng, nghỉ 14 ngày -> conceptMemoryService nói 33%, hàm này nói 64%
   *
   * Lệch tới 55 điểm phần trăm. Cái hiện lên màn Tiến hóa là cái thứ nhất, còn cái ĐIỀU KHIỂN
   * việc chọn câu hỏi ôn tập, cảnh báo ôn khẩn và kế hoạch học lại là cái thứ hai, tức bản
   * cũ của chính hàm này.
   *
   * Bản cũ lấy nửa đời trí nhớ bằng `0,5 * 2,2^chuỗi_đúng * (0,5 + tự_tin)`. Ba chỗ hỏng:
   *
   *   1. Hàm mũ theo chuỗi đúng cho dải 0,26 ngày tới 29 ngày, tức chênh nhau 111 lần, chỉ do
   *      một biến duy nhất. Người mới luyện một khái niệm bị kết luận là "cần ôn khẩn cấp"
   *      sau đúng 6 TIẾNG, nên danh sách ôn tập lúc nào cũng đỏ rực và mất hết ý nghĩa.
   *   2. Chuỗi đúng bị đứt là mất sạch, dù đã luyện khái niệm đó 50 lần. Toàn bộ khối lượng
   *      luyện tập không hề vào công thức.
   *   3. Không có mốc thời gian nào của các lần ôn trước, nên hiệu ứng giãn cách vô hình,
   *      dù `reviewHistory` lưu sẵn 20 mốc gần nhất mà không ai đọc.
   *
   * Nay gọi thẳng `doBenTriNhoNgay`, đúng một nguồn công thức cho cả dự án.
   */
  /**
   * HÀNG ĐỢI ÔN HÔM NAY, xếp theo LỢI ÍCH CHO NGÀY THI chứ không theo mức quá hạn.
   *
   * VÌ SAO CÓ HÀM NÀY. `nextReviewAt` được tính lại tươi ở mỗi lần đọc từ 27/07/2026 và đang
   * được dùng thật ở hai chỗ (chấm ưu tiên câu hỏi, và lời nhắc gửi gia sư AI), nhưng `grep` toàn
   * bộ `src/components` cho 0 kết quả: KHÔNG màn hình nào hiện nó ra. Toàn bộ giá trị của giãn
   * cách lặp lại nằm ở chỗ nó bảo người học hôm nay làm gì, mà đúng phần đó chưa dựng.
   *
   * VÌ SAO XẾP THEO LỢI ÍCH CHỨ KHÔNG THEO MỨC QUÁ HẠN, và đây là điểm khác Anki.
   *
   * Anki, cả SM-2 lẫn FSRS, chọn thẻ bằng một câu hỏi duy nhất: mức nhớ HÔM NAY đã tụt dưới mức
   * mong muốn chưa. Cách ấy đúng cho người muốn nhớ mãi mãi. Người ôn thi thì chỉ cần nhớ cao
   * nhất vào ĐÚNG MỘT NGÀY, nên câu hỏi đúng phải là: ôn thẻ này hôm nay thì NGÀY THI được thêm
   * bao nhiêu. Xem ba ca đối chiếu trong chú thích `loiIchOnHomNay`.
   *
   * BA ĐIỀU HÀM NÀY LÀM MÀ ANKI KHÔNG LÀM:
   *
   * 1. **Bỏ qua khái niệm ôn hôm nay cũng vô ích.** Khái niệm quá mong manh mà ngày thi còn xa
   *    thì ôn hôm nay không kéo nổi mức nhớ ngày thi lên, vì nó sẽ quên lại trước khi tới ngày.
   *    Việc đúng là để dành nó tới gần ngày thi. Anki vẫn bắt ôn, và người học vẫn sẽ quên.
   * 2. **Cắt hàng đợi theo QUỸ THỜI GIAN thật của người học**, không cắt theo số thẻ. Anki cắt
   *    theo số thẻ mỗi ngày, một con số người dùng phải tự đoán. Ở đây quỹ thời gian là
   *    `dailyStudyMinutes` người học đã đặt, còn tốc độ là nhịp ĐO ĐƯỢC của chính họ
   *    (`nhipRiengMoiCau`), nên phần bị cắt là phần thật sự không kịp làm.
   * 3. **Nói ra vì sao mỗi khái niệm nằm trong danh sách.** Trường `lyDo` đi kèm từng mục.
   *
   * KHI CHƯA ĐẶT NGÀY THI thì không có gì để tối ưu tới, nên lùi về đúng cách của Anki: xếp theo
   * mức quá hạn. `xepTheoNgayThi` báo rõ đang ở chế độ nào, đừng để màn hình nói nhầm.
   *
   * Bất biến 4.9c: không tính lại đường cong quên ở đây, chỉ đọc kết quả của công thức duy nhất.
   * Bất biến 4.5: tên khái niệm là tên của đồ thị tri thức, không phải `question.concept`.
   * Bất biến 4.7: sắp xếp TẤT ĐỊNH, hoà thì so tên.
   */
  layKhaiNiemToiHan(gioiHanPhut?: number): HangDoiOnTap {
    const profiles = this.getConceptProfiles();
    const bayGio = TimeService.now().getTime();

    let soNgayToiKyThi: number | null = null;
    const ngayThi = dbService.getSubjectGoal()?.examDate;
    if (ngayThi) {
      const cach = TimeService.daysBetween(TimeService.today(), ngayThi);
      if (Number.isFinite(cach)) soNgayToiKyThi = Math.max(0, cach);
    }

    const hoSoTriNho = conceptMemoryService.getAllConceptProfiles();
    const tatCa: MucOnTap[] = [];

    for (const ten of Object.keys(profiles)) {
      // Bắt buộc tính lại: `getConceptProfiles` trả về bản đã lưu, chưa chạy đường cong quên.
      const hoSo = this.recalculateForgettingScore(profiles[ten]);
      if (!hoSo.lastStudiedAt || !hoSo.nextReviewAt) continue;

      const soNgayDaNghi = Math.max(0, (bayGio - new Date(hoSo.lastStudiedAt).getTime()) / 86400000);
      const soNgayQuaHan = (bayGio - new Date(hoSo.nextReviewAt).getTime()) / 86400000;
      const doBenNgay = hoSo.doBenTriNhoNgay ?? 1;

      const banGocTriNho = hoSoTriNho[ten];
      const bangChung = banGocTriNho
        ? rutBangChungTriNho(banGocTriNho)
        : {
          soLanNhoLaiDung: hoSo.correctCount,
          soLanNhoLaiSai: hoSo.incorrectCount,
          dinhCaoDoThao: 50,
          doKhoKhaiNiem: 5.0,
          mocHocISO: hoSo.reviewHistory,
        };

      const loiIch = loiIchOnHomNay(bangChung, soNgayToiKyThi, soNgayDaNghi);
      const nhoNgayThi = mucNhoVaoNgayThi(doBenNgay, soNgayToiKyThi, soNgayDaNghi);

      tatCa.push({
        tenKhaiNiem: ten,
        soNgayQuaHan: parseFloat(soNgayQuaHan.toFixed(2)),
        mucConNho: hoSo.forgettingScore,
        doBenNgay,
        mucNhoNgayThi: nhoNgayThi,
        loiIchNeuOnHomNay: loiIch,
        lyDo: "",
      });
    }

    const xepTheoNgayThi = soNgayToiKyThi !== null;

    // NGƯỠNG LỢI ÍCH ĐÁNG BỎ CÔNG, tính bằng điểm phần trăm mức nhớ ngày thi.
    //
    // Đặt 1 điểm phần trăm, cố ý rất thấp. Nó không phải để lọc bớt cho gọn mà chỉ để loại đúng
    // nhóm "ôn hôm nay coi như không thay đổi gì cho ngày thi", tức nhóm mà Anki bắt ôn một cách
    // lãng phí. Đặt cao hơn sẽ bắt đầu cắt cả những khái niệm đáng ôn, và lúc ấy phải đo lại chứ
    // đừng đoán.
    const NGUONG_LOI_ICH = 0.01;

    const toiHan = tatCa.filter(m => {
      if (!xepTheoNgayThi) return m.soNgayQuaHan >= 0;
      // Có ngày thi thì tiêu chí là lợi ích, không phải hạn. Một khái niệm chưa tới hạn nhưng ôn
      // vào là được nhiều cho ngày thi thì vẫn đáng làm, và ngược lại.
      return (m.loiIchNeuOnHomNay ?? 0) >= NGUONG_LOI_ICH;
    });

    toiHan.sort((a, b) => {
      if (xepTheoNgayThi) {
        const chenh = (b.loiIchNeuOnHomNay ?? 0) - (a.loiIchNeuOnHomNay ?? 0);
        if (Math.abs(chenh) > 1e-9) return chenh;
      }
      const chenhHan = b.soNgayQuaHan - a.soNgayQuaHan;
      if (Math.abs(chenhHan) > 1e-9) return chenhHan;
      return a.tenKhaiNiem.localeCompare(b.tenKhaiNiem, "vi");
    });

    for (const m of toiHan) {
      if (xepTheoNgayThi && m.loiIchNeuOnHomNay !== null) {
        m.lyDo = `Ôn hôm nay nâng mức nhớ ngày thi thêm ${Math.round(m.loiIchNeuOnHomNay * 100)} điểm phần trăm`;
      } else if (m.soNgayQuaHan >= 1) {
        m.lyDo = `Quá hạn ôn ${Math.round(m.soNgayQuaHan)} ngày`;
      } else {
        m.lyDo = "Vừa tới hạn ôn hôm nay";
      }
    }

    // Nhóm bị hoãn: tới hạn theo lối cũ nhưng ôn hôm nay không giúp gì được cho ngày thi.
    const hoanLai = xepTheoNgayThi
      ? tatCa
        .filter(m => m.soNgayQuaHan >= 0 && (m.loiIchNeuOnHomNay ?? 0) < NGUONG_LOI_ICH)
        .sort((a, b) => b.soNgayQuaHan - a.soNgayQuaHan || a.tenKhaiNiem.localeCompare(b.tenKhaiNiem, "vi"))
      : [];
    for (const m of hoanLai) {
      m.lyDo = "Ôn hôm nay gần như không nâng được mức nhớ vào ngày thi, nên để gần ngày thi hơn";
    }

    // Cắt theo quỹ thời gian. Nhịp lấy từ chính người học khi đã đủ dữ liệu, không đủ thì lùi về
    // ước tính của ngân hàng câu hỏi. `SO_CAU_MOI_KHAI_NIEM` là số câu một lượt ôn dành cho mỗi
    // khái niệm, khớp với cách `generateExam` rút câu cho loại đề "due".
    const phutMoiNgay = gioiHanPhut ?? dbService.getSubjectGoal()?.dailyStudyMinutes ?? 45;
    const giayMoiCau = nhipRiengMoiCau() ?? 35;
    const soCauLamDuoc = Math.max(1, Math.floor((phutMoiNgay * 60) / Math.max(1, giayMoiCau)));
    const soKhaiNiemVua = Math.max(1, Math.floor(soCauLamDuoc / SO_CAU_MOI_KHAI_NIEM));

    return {
      xepTheoNgayThi,
      soNgayToiKyThi,
      danhSach: toiHan.slice(0, soKhaiNiemVua),
      soBiCatDoHetGio: Math.max(0, toiHan.length - soKhaiNiemVua),
      hoanLai,
      phutMoiNgay,
      giayMoiCauDaDung: giayMoiCau,
    };
  },

  recalculateForgettingScore(profile: ConceptProfile): ConceptProfile {
    if (!profile.lastStudiedAt) return { ...profile, forgettingScore: 1.0 };

    const lastStudied = new Date(profile.lastStudiedAt).getTime();
    const now = TimeService.now().getTime();
    const elapsedDays = (now - lastStudied) / (1000 * 60 * 60 * 24);

    // Đỉnh cao độ thạo: hồ sơ này không lưu đỉnh riêng, nên lấy độ thạo hiện tại trong thống kê
    // làm thay. Không có thì dùng 50, đúng mốc trung tính mà `conceptMemoryService` dùng cho
    // khái niệm chưa học, chứ không bịa một con số đẹp hơn.
    const mastery = dbService.getStatistics().conceptMastery || {};
    const dinhCaoDoThao = mastery[profile.conceptName] ?? mastery[profile.conceptId] ?? 50;

    // Độ khó khái niệm lấy từ tiên nghiệm biên soạn tay nếu có, giống hệt đường bên
    // `conceptMemoryService`, để hai bên không thể lệch nhau vì lý do độ khó.
    const doKhoKhaiNiem = doKhoTienNghiem(profile.conceptName) ?? 5.0;

    // Lịch sử nhớ lại thật nằm ở hồ sơ trí nhớ khái niệm, vì chỉ bên đó mới ghi ĐIỂM sau mỗi
    // lượt (`reviewHistory` của hồ sơ này chỉ có mốc thời gian, không suy ra được đúng hay sai).
    // Đọc chung một nguồn để hai đường cong không thể lệch nhau vì lý do hiệu chuẩn.
    const hoSoTriNho = conceptMemoryService.getAllConceptProfiles()[profile.conceptName];

    const doBenNgay = doBenTriNhoNgay({
      soLanNhoLaiDung: profile.correctCount,
      soLanNhoLaiSai: profile.incorrectCount,
      dinhCaoDoThao,
      doKhoKhaiNiem,
      mocHocISO: profile.reviewHistory,
      capNhoLai: rutCapNhoLai(hoSoTriNho?.scoreHistory),
    });

    const forgettingScore = Math.min(1.0, conNhoSauNgay(doBenNgay, elapsedDays));

    // Tới hạn ôn khi mức còn nhớ tụt xuống 60%.
    const nextReviewDays = -Math.log(0.6) * doBenNgay;
    const nextReviewTime = lastStudied + nextReviewDays * (1000 * 60 * 60 * 24);

    return {
      ...profile,
      forgettingScore: parseFloat(forgettingScore.toFixed(3)),
      nextReviewAt: new Date(nextReviewTime).toISOString(),
      // Cất lại S để nơi khác chiếu được mức nhớ tới một mốc tương lai, xem chú thích ở kiểu.
      doBenTriNhoNgay: parseFloat(doBenNgay.toFixed(3))
    };
  },

  /**
   * Dynamically updates the concept profiles based on exam attempts.
   */
  logConceptAttempt(conceptName: string, isCorrect: boolean, timeSpent: number): ConceptProfile {
    const profile = this.getOrCreateProfile(conceptName);
    const nowIso = TimeService.now().toISOString();

    // 1. Update counters
    const newAttempts = profile.attemptsCount + 1;
    const newCorrect = isCorrect ? profile.correctCount + 1 : profile.correctCount;
    const newIncorrect = !isCorrect ? profile.incorrectCount + 1 : profile.incorrectCount;

    // 2. Average time spent moving average
    const newAvgTimeSpent = parseFloat(
      ((profile.avgTimeSpent * profile.attemptsCount + timeSpent) / newAttempts).toFixed(1)
    );

    // 3. Streak
    const newStreak = isCorrect ? profile.streak + 1 : 0;

    // 4. Learning Velocity (accuracy change trend)
    const oldAccuracy = profile.attemptsCount > 0 ? profile.correctCount / profile.attemptsCount : 0.5;
    const newAccuracy = newCorrect / newAttempts;
    const velocity = parseFloat((newAccuracy - oldAccuracy).toFixed(3));

    // 5. Confidence logic: goes up with correct, down with incorrect
    let confidence = profile.confidence;
    if (isCorrect) {
      confidence = Math.min(1.0, confidence + 0.15 * (1.0 - confidence));
    } else {
      confidence = Math.max(0.0, confidence - 0.25 * confidence);
    }

    // 6. Dynamic Difficulty progression
    // Bloom Levels: Remember -> Understand -> Apply -> Analyze -> Evaluate -> Create
    const bloomLevels: ConceptProfile["difficultyPreference"][] = [
      "Remember",
      "Understand",
      "Apply",
      "Analyze",
      "Evaluate",
      "Create"
    ];
    let currentIndex = bloomLevels.indexOf(profile.difficultyPreference);
    if (currentIndex === -1) currentIndex = 1;

    let nextDifficulty = profile.difficultyPreference;
    if (isCorrect && newStreak >= 3 && currentIndex < bloomLevels.length - 1) {
      nextDifficulty = bloomLevels[currentIndex + 1];
    } else if (!isCorrect && currentIndex > 0) {
      nextDifficulty = bloomLevels[currentIndex - 1];
    }

    // 7. Update history
    const updatedHistory = [...profile.reviewHistory, nowIso].slice(-20); // Keep last 20 reviews

    const updatedProfile: ConceptProfile = {
      ...profile,
      attemptsCount: newAttempts,
      correctCount: newCorrect,
      incorrectCount: newIncorrect,
      lastStudiedAt: nowIso,
      avgTimeSpent: newAvgTimeSpent,
      streak: newStreak,
      confidence: parseFloat(confidence.toFixed(3)),
      learningVelocity: velocity,
      difficultyPreference: nextDifficulty,
      reviewHistory: updatedHistory,
      isBookmarked: profile.isBookmarked,
      isFlagged: profile.isFlagged
    };

    const finalProfile = this.recalculateForgettingScore(updatedProfile);
    
    // Log confidence value trend to Digital Twin
    studentModelService.logConfidenceValue(conceptName, finalProfile.confidence);

    const profiles = this.getConceptProfiles();
    profiles[conceptName] = finalProfile;
    this.saveConceptProfiles(profiles);

    // Update the dbService conceptMastery as well for compatibility
    dbService.boostConceptMastery(conceptName, isCorrect ? 15 : -10);

    return finalProfile;
  },

  /**
   * Manually sets concept confidence, e.g. after a mini lesson or quiz in coach
   */
  adjustConfidence(conceptName: string, delta: number): void {
    const profile = this.getOrCreateProfile(conceptName);
    profile.confidence = Math.max(0.0, Math.min(1.0, parseFloat((profile.confidence + delta).toFixed(3))));
    
    // Log confidence value trend to Digital Twin
    studentModelService.logConfidenceValue(conceptName, profile.confidence);

    const profiles = this.getConceptProfiles();
    profiles[conceptName] = this.recalculateForgettingScore(profile);
    this.saveConceptProfiles(profiles);
  },

  /**
   * Bookmarks/Unbookmarks a concept
   */
  toggleConceptBookmark(conceptName: string): boolean {
    const profile = this.getOrCreateProfile(conceptName);
    const newState = !profile.isBookmarked;
    profile.isBookmarked = newState;

    const profiles = this.getConceptProfiles();
    profiles[conceptName] = profile;
    this.saveConceptProfiles(profiles);
    return newState;
  },

  /**
   * Flags/Unflags a concept
   */
  toggleConceptFlag(conceptName: string): boolean {
    const profile = this.getOrCreateProfile(conceptName);
    const newState = !profile.isFlagged;
    profile.isFlagged = newState;

    const profiles = this.getConceptProfiles();
    profiles[conceptName] = profile;
    this.saveConceptProfiles(profiles);
    return newState;
  },

  /**
   * Orchestrator Stats / AI Telemetry persistence
   */
  getOrchestratorStats(): AIOrchestratorStats {
    const raw = localStorage.getItem(ORCHESTRATOR_STATS_KEY);
    if (!raw) {
      return {
        apiCallsCount: 0,
        totalTokensCount: 0,
        estimatedCostUsd: 0.0,
        cacheHitCount: 0,
        responseTimeMsList: [],
        fallbackOfflineCount: 0,
        errorCount: 0
      };
    }
    try {
      return JSON.parse(raw);
    } catch {
      return {
        apiCallsCount: 0,
        totalTokensCount: 0,
        estimatedCostUsd: 0.0,
        cacheHitCount: 0,
        responseTimeMsList: [],
        fallbackOfflineCount: 0,
        errorCount: 0
      };
    }
  },

  saveOrchestratorStats(stats: AIOrchestratorStats): void {
    localStorage.setItem(ORCHESTRATOR_STATS_KEY, JSON.stringify(stats));
  },

  logAiCall(tokens: number, cost: number, responseTimeMs: number, cacheHit: boolean = false): void {
    const stats = this.getOrchestratorStats();
    stats.apiCallsCount += 1;
    stats.totalTokensCount += tokens;
    stats.estimatedCostUsd = parseFloat((stats.estimatedCostUsd + cost).toFixed(5));
    if (cacheHit) stats.cacheHitCount += 1;
    
    const times = stats.responseTimeMsList || [];
    times.push(responseTimeMs);
    stats.responseTimeMsList = times.slice(-100); // keep last 100
    
    this.saveOrchestratorStats(stats);
  },

  logAiOfflineFallback(): void {
    const stats = this.getOrchestratorStats();
    stats.fallbackOfflineCount += 1;
    this.saveOrchestratorStats(stats);
  },

  logAiError(): void {
    const stats = this.getOrchestratorStats();
    stats.errorCount += 1;
    this.saveOrchestratorStats(stats);
  }
};

// Auto-synchronize learner profile concept metrics with student answer submissions
dbService.addOnSubmit((attempt) => {
  const activeSubjectId = dbService.getActiveSubjectId();
  const answers = attempt.answers || {};
  const questionMap = dbService.getQuestionMap();
  const timeSpentPerQ = Math.round((attempt.timeSpent || 0) / Math.max(1, Object.keys(answers).length)) || 15;
  
  Object.entries(answers).forEach(([qIdStr, answer]) => {
    const qId = parseInt(qIdStr);
    const q = questionMap.get(qId);
    if (!q) return;
    const isCorrect = q.correctAnswer === answer;
    const conceptNode = kbService.getConceptForQuestion(activeSubjectId, q);
    if (conceptNode) {
      learnerModelService.logConceptAttempt(conceptNode.concept, isCorrect, timeSpentPerQ);
    }
  });
});

// Dọn các kho dẫn xuất do file này sở hữu khi người học xóa tiến trình.
// Xem chú thích ở `dangKyDonDuLieuSuyRa` trong db.ts để biết vì sao phải làm.
dangKyDonDuLieuSuyRa("learnerModel", (subjectId) => {
  localStorage.removeItem(`poly_econ_concept_profiles_${subjectId}`);
  localStorage.removeItem(`poly_econ_student_model_extras_${subjectId}`);
  localStorage.removeItem(`poly_econ_adaptive_memory_${subjectId}`);
});
