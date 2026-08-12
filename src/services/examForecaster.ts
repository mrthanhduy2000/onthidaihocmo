/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService, questions, chapters, topics } from "./db";
import { kbService, KnowledgeNode } from "./kbService";
import { learnerModelService } from "./learnerModel";

/** Số câu tối thiểu của một lượt thì mới coi là bằng chứng đủ nặng để hiệu chuẩn dự báo. */
const SO_CAU_TOI_THIEU_MOT_LUOT = 5;
/** Số lượt đã nộp tối thiểu mới dám kết luận về sai lệch. Khớp ngưỡng của nhánh thích nghi. */
const SO_LUOT_TOI_THIEU_HIEU_CHUAN = 2;
/** Cửa sổ lượt gần đây dùng để đo. Năng lực đổi theo thời gian nên không lấy toàn bộ lịch sử. */
const CUA_SO_HIEU_CHUAN = 8;
import { 
  SubjectGoal, 
  ExamPrediction, 
  StudyActivityROI, 
  StudyDebtItem, 
  ForecastCalibrationProfile,
  SensitivityItem,
  UncertaintyDecomposition,
  StressTestReport
} from "../types";
import { TimeService } from "./time";
import { soThapPhan } from "./numberFormat";

/**
 * PHASE NEXT — SELF-CALIBRATING FORECASTING ENGINE v3.0 (Deterministic Optimization Layer)
 * 
 * 1. Self-Calibration Layer (Bias tracking per chapter, difficulty, bloom, examType)
 * 2. Adaptive Weight Auto Optimization (Evidence-based weights without ML)
 * 3. Local Sensitivity Analysis (Marginal point gain & opportunity cost)
 * 4. Diminishing Return Model v2 (Non-linear exponential/logarithmic decay)
 * 5. Confidence Stability Index (Narrow vs Wide margin based on variance)
 * 6. Uncertainty Decomposition (7 distinct uncertainty vectors)
 * 7. Dependency Propagation (Prerequisite weakness decay downstream)
 * 8. Opportunity Cost Engine (Point loss if activities skipped)
 * 9. Deadline Pressure Curve (Stage-aware non-linear deadline curve)
 * 10. Transparent Explanation Engine (Detailed multi-factor audit)
 * 11. Forecast Stress Test (Deterministic scenario simulations)
 * 12. Complete Backward Compatibility & Zero External Dependencies
 */

// Prerequisite Knowledge Graph mapping (Concept Prerequisite Relationships)
/**
 * Quan hệ tiên quyết giữa các khái niệm, LẤY TỪ ĐỒ THỊ TRI THỨC THẬT của môn đang học.
 *
 * Trước đây chỗ này là một bảng cứng viết tay với các khóa "GiaCanBang", "PricingStrategy",
 * "ThiTruongDocQuyen"... tức là khái niệm KINH TẾ VI MÔ còn sót lại từ một môn khác. Môn đang
 * chạy là Hành vi khách hàng, khóa độ thạo có dạng "CB_C1_N1" hoặc "Hành vi khách hàng
 * (Consumer Behavior)". Đo thực tế: 0 khóa nào khớp bảng đó. Hệ quả là toàn bộ tầng "lan
 * truyền phụ thuộc" của bộ dự báo chưa từng kích hoạt một lần nào, và biến
 * dependencyUncertainty luôn bằng 0 nên một trong bảy vector bất định là đồ trang trí.
 *
 * Nay đọc thẳng `dependencies.requires` có sẵn trong đồ thị tri thức. Trả về bảng tra cứu
 * chấp nhận cả mã lẫn tên khái niệm, vì bảng độ thạo lưu cả hai khóa cho cùng một giá trị.
 */
function buildPrerequisiteMap(subjectId: string): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const graph = kbService.getKnowledgeGraph(subjectId);
  const byKey = new Map<string, KnowledgeNode>();
  graph.forEach(n => {
    byKey.set(n.id.toLowerCase(), n);
    byKey.set(n.concept.toLowerCase(), n);
  });
  graph.forEach(node => {
    const reqs = (node.dependencies?.requires || [])
      .map(r => byKey.get(String(r).toLowerCase()))
      .filter((n): n is KnowledgeNode => !!n)
      .map(n => n.concept);
    if (reqs.length === 0) return;
    map[node.id] = reqs;
    map[node.concept] = reqs;
  });
  return map;
}

// Ánh xạ tên giai đoạn ôn tập (khóa nội bộ tiếng Anh) sang nhãn hiển thị tiếng Việt cho người học.
const STAGE_LABEL_VN: Record<string, string> = {
  "Foundation": "Xây nền",
  "Memory Refresh": "Ôn nhớ nhanh",
  "Error Review": "Sửa lỗi sai",
  "Mock Exam": "Thi thử",
  "Adaptive Practice": "Luyện thích ứng",
  "Coverage": "Phủ kiến thức"
};
const stageLabelVN = (key: string): string => STAGE_LABEL_VN[key] || key;

// ===========================================================================
// CÔNG THỨC DÙNG CHUNG
//
// Các bảng mô phỏng phía dưới (kịch bản sức ép, ROI, what-if) trước đây tự chép lại công thức
// của phần lõi dự báo, và những bản chép đó đã trôi lệch khỏi bản gốc. Đo thực tế ngày
// 27/07/2026: cùng một hoạt động "Luyện tập tự thích ứng" được bảng ROI hứa +0,55 điểm trong
// khi bảng độ nhạy của chính bản dự báo tính ra +0,33 điểm, hai con số hiện cạnh nhau trên
// cùng một màn hình. Nay mỗi công thức chỉ tồn tại ĐÚNG MỘT BẢN ở đây, mọi nơi đọc từ đó.
// ===========================================================================

/** Hình phạt điểm do câu sai chưa chữa. Phần lõi dự báo TRỪ THẲNG số này khỏi điểm. */
function hinhPhatNoHocTap(soCauNo: number, tongCauDaLam = 0): number {
  // Phạt theo TỶ LỆ nợ, không theo số tuyệt đối.
  //
  // Vì sao đổi (đo ngày 27/07/2026): bản cũ là `min(1,0; soCauNo/12 * 0,9)`, tức chỉ cần 13 câu
  // sai chưa ôn lại là chạm trần phạt 1,0 điểm. Người học chăm làm 500 câu với 90% đúng vẫn có
  // khoảng 50 câu sai, nên **bị phạt kịch trần y hệt người đúng 20%**. Đó là phạt theo khối
  // lượng luyện tập chứ không theo chất lượng, và nó trừng phạt đúng người chăm nhất.
  //
  // Thêm nữa, số câu sai ĐÃ được phản ánh trong tỷ lệ đúng, vốn là neo của điểm dự báo. Trừ
  // thêm một lần nữa theo số tuyệt đối là đếm trùng cùng một bằng chứng.
  //
  // Chưa biết tổng số câu đã làm thì giữ nguyên cách cũ để không đổi hành vi ở nơi gọi khác.
  const no = Math.max(0, soCauNo);
  if (tongCauDaLam <= 0) return Math.min(1.0, (no / 12) * 0.9);

  const tyLeNo = Math.min(1, no / tongCauDaLam);
  return Math.min(1.0, tyLeNo * 0.9);
}

/**
 * Hệ số chuỗi ngày học đều. Là tín hiệu THẬT nhưng YẾU, chỉ được nhích nhẹ trong [0,95; 1,05]
 * chứ không định đoạt kết quả.
 */
function heSoChuoiNgay(chuoiNgay: number): number {
  return Math.min(1.05, 0.95 + Math.min(10, Math.max(0, chuoiNgay)) * 0.01);
}

/**
 * Bốn mức lợi ích ước tính khi bỏ thêm 30 phút vào từng loại hoạt động, theo đường lợi ích
 * biên giảm dần. Càng ít việc còn tồn thì thêm giờ càng ít tác dụng, đúng như thực tế.
 */
function tinhLoiIch30Phut(dl: {
  soCauNo: number;
  doPhuKhaiNiem: number;
  diemThiThuTrungBinh: number;
  chuoiNgay: number;
}) {
  return {
    // Sổ tay RỖNG thì lợi ích bằng 0. Bản cũ trả về 0,10 nên màn hình vẫn hứa thêm điểm cho
    // một việc không thể làm (không còn câu sai nào để chữa).
    soTayCauSai: dl.soCauNo > 0
      ? Math.round((0.50 * (1 - Math.exp(-0.12 * Math.min(15, dl.soCauNo)))) * 100) / 100
      : 0,
    luyenThichUng: Math.round((0.35 * (1 - Math.exp(-0.03 * Math.max(0, 100 - dl.doPhuKhaiNiem)))) * 100) / 100,
    thiThu: Math.round((0.40 * (1 - Math.exp(-0.25 * Math.max(0, 10 - dl.diemThiThuTrungBinh)))) * 100) / 100,
    onNgatQuang: Math.round((0.25 * (1 - Math.exp(-0.10 * Math.max(0, 14 - dl.chuoiNgay)))) * 100) / 100
  };
}

/**
 * Lợi ích khi lặp lại cùng một hoạt động nhiều lượt 30 phút. Mỗi lượt sau chỉ còn một nửa
 * hiệu suất lượt trước, nên tổng không bao giờ vượt quá gấp đôi lượt đầu.
 * 1 lượt trả về đúng g, 2 lượt trả về 1,5g, vô hạn lượt tiệm cận 2g.
 */
function loiIchNhieuLuot(loiIchMotLuot: number, soLuot: number): number {
  if (soLuot <= 0 || loiIchMotLuot <= 0) return 0;
  return Math.round(loiIchMotLuot * (2 - Math.pow(0.5, soLuot - 1)) * 100) / 100;
}

/**
 * Đạo hàm của điểm dự báo theo tỷ lệ làm đúng tổng thể, suy thẳng từ cách phần lõi cộng điểm.
 * Tỷ lệ đúng có mặt trong ba thành phần: Bloom (hệ số 11), ghi nhớ (hệ số 8) và phần bằng
 * chứng chung của độ thạo (hệ số 3,5 nhân hệ số chuỗi ngày). Nhờ số này, câu hỏi "chữa hết
 * câu sai của chương yếu nhất thì được thêm mấy điểm" trả lời được bằng phép tính chứ không
 * phải bằng một hằng số viết tay.
 */
function doNhayTheoTyLeDung(
  trongSo: { bloomWeight: number; retentionWeight: number; masteryWeight: number },
  heSoChuoi: number
): number {
  return 11 * trongSo.bloomWeight + 8 * trongSo.retentionWeight + 3.5 * heSoChuoi * trongSo.masteryWeight;
}

/** Làm tròn về một chữ số thập phân, dùng thống nhất cho mọi con số hiển thị. */
function tron1(x: number): number {
  return Math.round(x * 10) / 10;
}

export const examForecaster = {
  /**
   * Phơi hàm phạt nợ ra để bộ tự kiểm chứng kiểm được trực tiếp. Không dùng trong luồng chạy
   * thật, phần lõi gọi thẳng `hinhPhatNoHocTap`.
   */
  hinhPhatNoHocTapCongKhai(soCauNo: number, tongCauDaLam = 0): number {
    return hinhPhatNoHocTap(soCauNo, tongCauDaLam);
  },

  /**
   * Retrieves or initializes the persistent Forecast Calibration Profile for a subject.
   */
  getCalibrationProfile(subjectId?: string): ForecastCalibrationProfile {
    const activeSub = subjectId || dbService.getActiveSubjectId();
    const storageKey = `poly_econ_forecast_calibration_${activeSub}`;
    const raw = localStorage.getItem(storageKey);

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return {
            subjectId: activeSub,
            overallBias: parsed.overallBias || 0,
            chapterBias: parsed.chapterBias || {},
            difficultyBias: parsed.difficultyBias || {},
            bloomBias: parsed.bloomBias || {},
            examTypeBias: parsed.examTypeBias || {},
            predictionVariance: parsed.predictionVariance || 0.15,
            calibrationCount: parsed.calibrationCount || 0,
            calibrationHistory: Array.isArray(parsed.calibrationHistory) ? parsed.calibrationHistory : []
          };
        }
      } catch (e) {
        console.warn("Error parsing calibration profile, resetting:", e);
      }
    }

    return {
      subjectId: activeSub,
      overallBias: 0,
      chapterBias: {},
      difficultyBias: {},
      bloomBias: {},
      examTypeBias: {},
      predictionVariance: 0.15,
      calibrationCount: 0,
      calibrationHistory: []
    };
  },

  /**
   * Saves calibration profile to localStorage.
   */
  saveCalibrationProfile(profile: ForecastCalibrationProfile): void {
    const storageKey = `poly_econ_forecast_calibration_${profile.subjectId}`;
    localStorage.setItem(storageKey, JSON.stringify(profile));
  },

  /**
   * Self-Calibration Method: Registers actual exam outcome to auto-calibrate system bias.
   */
  registerActualExamResult(params: {
    subjectId?: string;
    actualScore: number; // 0 - 10
    predictedScoreAtTime: number; // 0 - 10
    examType?: string;
    chapterId?: number;
    difficulty?: string;
    bloomLevel?: string;
  }): ForecastCalibrationProfile {
    const profile = this.getCalibrationProfile(params.subjectId);
    const bias = Math.round((params.actualScore - params.predictedScoreAtTime) * 100) / 100;
    
    const count = profile.calibrationCount;
    const newCount = count + 1;

    // Incremental Mean Bias calculation
    const newOverallBias = Math.round(((profile.overallBias * count + bias) / newCount) * 100) / 100;

    // Update specific chapter bias
    const chapterBias = { ...profile.chapterBias };
    if (params.chapterId !== undefined) {
      const prev = chapterBias[params.chapterId] || 0;
      chapterBias[params.chapterId] = Math.round(((prev * count + bias) / newCount) * 100) / 100;
    }

    // Update difficulty bias
    const difficultyBias = { ...profile.difficultyBias };
    if (params.difficulty) {
      const prev = difficultyBias[params.difficulty] || 0;
      difficultyBias[params.difficulty] = Math.round(((prev * count + bias) / newCount) * 100) / 100;
    }

    // Update bloom bias
    const bloomBias = { ...profile.bloomBias };
    if (params.bloomLevel) {
      const prev = bloomBias[params.bloomLevel] || 0;
      bloomBias[params.bloomLevel] = Math.round(((prev * count + bias) / newCount) * 100) / 100;
    }

    // Update examType bias
    const examTypeBias = { ...profile.examTypeBias };
    if (params.examType) {
      const prev = examTypeBias[params.examType] || 0;
      examTypeBias[params.examType] = Math.round(((prev * count + bias) / newCount) * 100) / 100;
    }

    // Variance update
    const history = [...profile.calibrationHistory, {
      timestamp: TimeService.now().toISOString(),
      predictedScore: params.predictedScoreAtTime,
      actualScore: params.actualScore,
      bias,
      examType: params.examType || "mock"
    }];

    const meanBias = newOverallBias;
    const sqDiffSum = history.reduce((sum, item) => sum + Math.pow(item.bias - meanBias, 2), 0);
    const newVariance = Math.round((sqDiffSum / history.length) * 1000) / 1000;

    const updatedProfile: ForecastCalibrationProfile = {
      ...profile,
      overallBias: newOverallBias,
      chapterBias,
      difficultyBias,
      bloomBias,
      examTypeBias,
      predictionVariance: newVariance,
      calibrationCount: newCount,
      calibrationHistory: history.slice(-20) // Keep last 20 snapshots
    };

    this.saveCalibrationProfile(updatedProfile);
    return updatedProfile;
  },

  /**
   * Dựng lại hồ sơ hiệu chuẩn TỪ LỊCH SỬ LÀM BÀI THẬT, tất định, không tích lũy.
   *
   * Vì sao cần: file này tự gọi mình là "SELF-CALIBRATING FORECASTING ENGINE v3.0", có sẵn
   * `registerActualExamResult` để nạp kết quả thi thật, và `calculateAdaptiveWeights` đã được
   * dùng ở hai chỗ trong lúc dự báo. Nhưng dò toàn bộ mã nguồn ngày 27/07/2026:
   * `registerActualExamResult` có **0 nơi gọi**. Nên `calibrationCount` vĩnh viễn bằng 0, mà
   * nhánh thích nghi trong `calculateAdaptiveWeights` lại yêu cầu `>= 2`. Tức là **toàn bộ cơ
   * chế tự hiệu chuẩn chưa từng chạy một lần nào**, dù cả hai đầu dữ liệu đã nằm sẵn.
   *
   * Vì sao DỰNG LẠI chứ không tích lũy: bản gốc cộng dồn từng lần gọi vào hồ sơ đã lưu. Cách đó
   * làm con số phụ thuộc **số lần được gọi**, đúng loại lỗi "số tự bò lên theo số lần mở màn
   * hình" đã sửa ở chính file này, và cũng là lý do phải tránh trung bình trượt ở
   * `guessingFrequency`. Dựng lại từ lịch sử thì gọi bao nhiêu lần cũng ra một kết quả, và
   * quan trọng hơn: nó học được từ lịch sử ĐÃ CÓ, chứ không phải chỉ từ các lượt tương lai.
   *
   * Cách đo sai lệch: so điểm thi thật gần đây (quy về thang 10) với **điểm dự báo đã chốt ở
   * lần tính trước**, thứ đang lưu sẵn ở khóa `poly_econ_last_prediction_*`. Dương nghĩa là
   * người học làm tốt hơn dự báo, tức bộ dự báo đang hạ điểm họ.
   *
   * **Điểm tham chiếu BẮT BUỘC do nơi gọi truyền vào, hàm này tuyệt đối không tự gọi
   * `calculatePrediction`.** Gọi như vậy tạo vòng vô hạn giữa hai hàm, đúng Bẫy 5 trong
   * AGENTS.md, thứ từng làm tràn ngăn xếp mỗi lần mở màn Đài quan sát.
   *
   * Thiếu dữ liệu thì trả hồ sơ mặc định với `calibrationCount` bằng 0, để nhánh thích nghi
   * không kích hoạt. Không đoán.
   */
  doHieuChuanTuLichSu(subjectId: string, duBaoThamChieu: number | null): ForecastCalibrationProfile {
    const activeSub = subjectId || dbService.getActiveSubjectId();
    const macDinh = this.getCalibrationProfile(activeSub);

    const luotHopLe = dbService.getHistory()
      .filter(a => a.isSubmitted && (a.questions || []).length >= SO_CAU_TOI_THIEU_MOT_LUOT);

    // Không có điểm tham chiếu thì không so được với cái gì cả, và bịa một mốc là điều cấm.
    if (duBaoThamChieu === null || luotHopLe.length < SO_LUOT_TOI_THIEU_HIEU_CHUAN) {
      return { ...macDinh, calibrationCount: 0, calibrationHistory: [] };
    }

    // Chỉ lấy cửa sổ gần đây: năng lực người học thay đổi theo thời gian, lượt thi từ hai tháng
    // trước không nói lên độ chính xác của dự báo hôm nay.
    const cuaSo = luotHopLe.slice(-CUA_SO_HIEU_CHUAN);
    const duBao = duBaoThamChieu;

    const diemTheoLuot = cuaSo.map(a => (a.score / Math.max(1, (a.questions || []).length)) * 10);
    const trungBinhThat = diemTheoLuot.reduce((s, v) => s + v, 0) / diemTheoLuot.length;

    const overallBias = Math.round((trungBinhThat - duBao) * 100) / 100;

    // Phương sai của chính điểm thi thật, dùng làm chỉ báo hồ sơ ổn định tới đâu.
    const phuongSai = diemTheoLuot.reduce((s, v) => s + Math.pow(v - trungBinhThat, 2), 0) / diemTheoLuot.length;

    const examTypeBias: Record<string, number> = {};
    const nhomTheoLoai = new Map<string, number[]>();
    cuaSo.forEach((a, i) => {
      const loai = a.examType || "unknown";
      if (!nhomTheoLoai.has(loai)) nhomTheoLoai.set(loai, []);
      nhomTheoLoai.get(loai)!.push(diemTheoLuot[i]);
    });
    nhomTheoLoai.forEach((ds, loai) => {
      const tb = ds.reduce((s, v) => s + v, 0) / ds.length;
      examTypeBias[loai] = Math.round((tb - duBao) * 100) / 100;
    });

    return {
      subjectId: activeSub,
      overallBias,
      chapterBias: macDinh.chapterBias,
      difficultyBias: macDinh.difficultyBias,
      bloomBias: macDinh.bloomBias,
      examTypeBias,
      predictionVariance: Math.round(Math.min(2, phuongSai) * 1000) / 1000,
      calibrationCount: cuaSo.length,
      calibrationHistory: cuaSo.map((a, i) => ({
        timestamp: a.endTime || a.startTime,
        predictedScore: duBao,
        actualScore: Math.round(diemTheoLuot[i] * 100) / 100,
        bias: Math.round((diemTheoLuot[i] - duBao) * 100) / 100,
        examType: a.examType || "unknown",
      })),
    };
  },

  /**
   * Deterministically calculates adaptive component weights based on historical evidence.
   */
  calculateAdaptiveWeights(profile: ForecastCalibrationProfile) {
    let masteryWeight = 0.30;
    let retentionWeight = 0.20;
    let coverageWeight = 0.20;
    let mockWeight = 0.20;
    let bloomWeight = 0.10;

    if (profile.calibrationCount >= 2) {
      // Trọng số điều chỉnh theo hàm LIÊN TỤC, không dùng ngưỡng bậc thang.
      //
      // Bản cũ có hai ngưỡng cứng, tăng trọng số khi sai lệch dưới 0,3 và giảm khi trên 0,8, nên
      // **cả dải từ 0,3 tới 0,8 là vùng chết**: sai lệch nằm trong đó thì trọng số không đổi một
      // ly. Mà đo được ngày 27/07/2026 thì sai lệch thật hay rơi đúng vào dải này (một hồ sơ mô
      // phỏng cho 0,8 chằn, tức nằm ngay mép và không kích hoạt nhánh nào). Nói cách khác cơ chế
      // thích nghi im lặng đúng lúc cần nó nhất.
      //
      // Nay dùng nội suy tuyến tính, chặn hai đầu: sai lệch 0 thì tin bài thi thử nhất
      // (+0,08), sai lệch 0,4 thì trung tính, từ 0,8 trở lên thì lùi hẳn (-0,08). Mọi giá trị ở
      // giữa đều cho một mức điều chỉnh riêng.
      const mockBias = Math.abs(profile.examTypeBias["mock"] || profile.overallBias);
      const BIEN_SAI_LECH = 0.8;
      const mucTinBaiThiThu = 1 - 2 * Math.min(1, mockBias / BIEN_SAI_LECH); // +1 xuống -1
      const dieuChinhMock = 0.08 * mucTinBaiThiThu;

      mockWeight += dieuChinhMock;
      masteryWeight -= dieuChinhMock / 2;
      coverageWeight -= dieuChinhMock / 2;

      // Phương sai càng lớn thì càng phải dựa vào trí nhớ như tấm đệm an toàn. Cũng liên tục,
      // thay cho ngưỡng cứng 0,4 vốn nhảy một bậc rồi thôi.
      const BIEN_PHUONG_SAI = 0.4;
      const dieuChinhPhuongSai = 0.05 * Math.min(1, Math.max(0, profile.predictionVariance) / BIEN_PHUONG_SAI);
      retentionWeight += dieuChinhPhuongSai;
      bloomWeight -= dieuChinhPhuongSai;
    }

    // Normalize weights to strictly sum to 1.0
    const total = masteryWeight + retentionWeight + coverageWeight + mockWeight + bloomWeight;
    return {
      masteryWeight: Math.round((masteryWeight / total) * 100) / 100,
      retentionWeight: Math.round((retentionWeight / total) * 100) / 100,
      coverageWeight: Math.round((coverageWeight / total) * 100) / 100,
      mockWeight: Math.round((mockWeight / total) * 100) / 100,
      bloomWeight: Math.round((bloomWeight / total) * 100) / 100,
      debtWeight: 0.10 // Separate penalty weight
    };
  },

  /**
   * Deterministic Exam Outcome Predictor v3.0
   */
  calculatePrediction(subjectId?: string): ExamPrediction {
    const activeSub = subjectId || dbService.getActiveSubjectId();
    const stats = dbService.getStatistics();
    const history = dbService.getHistory();
    const goal = dbService.getSubjectGoal(activeSub);

    // Hồ sơ hiệu chuẩn dựng lại từ lịch sử thật, không đọc bản tích lũy đã lưu.
    //
    // Điểm tham chiếu là dự báo ĐÃ CHỐT ở lần tính trước, lấy từ `poly_econ_last_prediction_*`.
    // So nó với điểm thi thật gần đây cho ra sai lệch có hướng. Chưa có dự báo cũ thì truyền
    // null, và tầng hiệu chuẩn tự trả `calibrationCount` bằng 0 nên nhánh thích nghi nằm im.
    //
    // Đọc ở đây, TRƯỚC khi tính trọng số, vì trọng số phụ thuộc hồ sơ hiệu chuẩn. Và tuyệt đối
    // không gọi ngược `calculatePrediction` từ trong tầng hiệu chuẩn, xem Bẫy 5 trong AGENTS.md.
    let duBaoThamChieu: number | null = null;
    try {
      const raw = localStorage.getItem(`poly_econ_last_prediction_${activeSub}`);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved.value === "number") duBaoThamChieu = saved.value;
        else {
          const so = parseFloat(raw);
          if (!isNaN(so)) duBaoThamChieu = so;
        }
      }
    } catch {
      duBaoThamChieu = null;
    }

    const profile = this.doHieuChuanTuLichSu(activeSub, duBaoThamChieu);

    const totalSolved = stats.totalSolved || 0;
    const totalCorrect = stats.totalCorrect || 0;
    const overallAccuracy = totalSolved > 0 ? (totalCorrect / totalSolved) : 0;
    const mockAttempts = history.filter(h => h.isSubmitted && h.questions && h.questions.length >= 5);

    // -------------------------------------------------------------
    // LAYER 1: Dependency Propagation & Stable Mastery
    // -------------------------------------------------------------
    const conceptMasteries = stats.conceptMastery || {};
    const prerequisiteMap = buildPrerequisiteMap(activeSub);

    // Bảng độ thạo lưu CÙNG MỘT giá trị dưới hai khóa (mã và tên khái niệm), nên duyệt thẳng
    // Object.keys sẽ đếm mỗi khái niệm hai lần. Gom về danh sách khái niệm duy nhất trước.
    const graphNodes = kbService.getKnowledgeGraph(activeSub);
    const uniqueConcepts: Array<{ key: string; mastery: number }> = [];
    const seenConcept = new Set<string>();
    graphNodes.forEach(n => {
      if (seenConcept.has(n.id)) return;
      seenConcept.add(n.id);
      const m = conceptMasteries[n.concept] ?? conceptMasteries[n.id];
      if (m === undefined) return;
      uniqueConcepts.push({ key: n.concept, mastery: m });
    });
    // Môn không có đồ thị tri thức: quay về duyệt khóa thô, vẫn khử trùng theo giá trị khóa.
    if (uniqueConcepts.length === 0) {
      Object.keys(conceptMasteries).forEach(k => uniqueConcepts.push({ key: k, mastery: conceptMasteries[k] || 0 }));
    }

    const totalConcepts = Math.max(1, uniqueConcepts.length);

    // Chuỗi ngày học đều là tín hiệu THẬT nhưng YẾU, chỉ được phép nhích nhẹ chứ không định
    // đoạt kết quả. Bản cũ dùng (0,75 + streak*0,05) nên người chưa có chuỗi ngày nào bị cắt
    // thẳng 25% năng lực, dù họ có thể vừa làm đúng 95% số câu. Nay giới hạn trong [0,95; 1,05].
    const streakModifier = heSoChuoiNgay(stats.studyStreak || 0);

    let sumStableMastery = 0;
    let totalDependencyPenalty = 0;

    uniqueConcepts.forEach(({ key, mastery: rawVal }) => {
      // Lan truyền phụ thuộc: nền tảng yếu thì làm giảm độ tin cậy của khái niệm xây trên nó.
      const prereqs = prerequisiteMap[key] || [];
      let prereqDecayMultiplier = 1.0;
      prereqs.forEach(prereqKey => {
        const prereqMastery = conceptMasteries[prereqKey] ?? 50;
        if (prereqMastery < 70) {
          const deficit = (70 - prereqMastery) / 70;
          prereqDecayMultiplier *= (1.0 - 0.20 * deficit);
        }
      });

      if (prereqDecayMultiplier < 1.0) {
        totalDependencyPenalty += (1.0 - prereqDecayMultiplier);
      }

      const effectiveMastery = rawVal * prereqDecayMultiplier;

      // Tổ hợp hai nguồn bằng chứng, TRỌNG SỐ CỘNG LẠI ĐÚNG BẰNG 1,0.
      //
      // Bản cũ dùng 0,50 và 0,30, cộng lại chỉ 0,80, tạo ra khoản cắt 20% âm thầm mà không ai
      // chủ ý. Kèm theo đó là hệ số consistencyFactor tính từ
      // `questions.filter(q => q.concept === key || q.topicId === key)`, nhưng `q.concept` là
      // chuỗi tự do kiểu "Khái niệm hành vi khách hàng" còn `key` là "CB_C1_N1", đo thực tế
      // 0 trên 277 giá trị khớp nhau, nên hệ số đó LUÔN rơi về sàn 0,4. Ba khoản cắt chồng
      // nhau khiến một người học hoàn hảo chỉ đạt 24/100 ở thành phần quan trọng nhất, tức
      // dự báo bị kéo xuống một cách hệ thống.
      //
      // Hệ số consistencyFactor nay được BỎ HẲN chứ không sửa: việc cân theo lượng bằng chứng
      // đã được làm đúng một lần tại nguồn trong dbService.recomputeStatistics
      // (w = 1 - e^(-n/6)). Cân lần nữa ở đây là co hai lần, đúng loại lỗi đã gặp ở
      // learningEngine.
      const stableConceptScore = (effectiveMastery * 0.65 + overallAccuracy * 100 * 0.35) * streakModifier;
      sumStableMastery += stableConceptScore;
    });

    const averageStableMastery = uniqueConcepts.length > 0
      ? Math.round(sumStableMastery / totalConcepts)
      : Math.round(overallAccuracy * 100);

    const avgDependencyDecay = totalConcepts > 0 ? Math.round((totalDependencyPenalty / totalConcepts) * 100) / 100 : 0;

    // -------------------------------------------------------------
    // LAYER 2: Non-Linear Learning Velocity & Acceleration
    // -------------------------------------------------------------
    const streak = Math.max(1, stats.studyStreak || 1);
    const currentVelocity = Math.round((totalSolved / streak) * 10) / 10;
    
    let acceleration = 0;
    if (history.length >= 4) {
      const recent4 = history.slice(-4);
      const prev4 = history.slice(-8, -4);
      const accRecent = recent4.reduce((s, h) => s + (h.score / Math.max(1, h.questions.length)), 0) / recent4.length;
      const accPrev = prev4.length > 0 ? prev4.reduce((s, h) => s + (h.score / Math.max(1, h.questions.length)), 0) / prev4.length : accRecent;
      acceleration = Math.round((accRecent - accPrev) * 100) / 100;
    }

    // -------------------------------------------------------------
    // LAYER 3: Syllabus & Chapter Coverage
    // -------------------------------------------------------------
    const attemptedChapters = Object.keys(stats.accuracyByChapter || {}).filter(cId => {
      const acc = stats.accuracyByChapter[Number(cId)];
      return acc && acc.total > 0;
    }).length;
    const totalChapCount = Math.max(1, chapters.length);
    const chapterCoverage = Math.round((attemptedChapters / totalChapCount) * 100);

    // Đếm trên danh sách khái niệm ĐÃ KHỬ TRÙNG. Bản cũ duyệt thẳng khóa của bảng độ thạo,
    // mà bảng đó lưu mỗi khái niệm dưới hai khóa, nên mẫu số bị nhân đôi.
    const masteredConceptsCount = uniqueConcepts.filter(c => c.mastery >= 70).length;
    const conceptCoverage = Math.round((masteredConceptsCount / totalConcepts) * 100);

    // -------------------------------------------------------------
    // LAYER 4: Mock Exam Score Breakdown
    // -------------------------------------------------------------
    let mockExamAverage = 0;
    if (mockAttempts.length > 0) {
      const recentMocks = mockAttempts.slice(-5);
      const totalScorePct = recentMocks.reduce((sum, m) => sum + (m.score / Math.max(1, m.questions.length)), 0);
      mockExamAverage = (totalScorePct / recentMocks.length) * 10;
    } else {
      mockExamAverage = overallAccuracy * 10;
    }

    // -------------------------------------------------------------
    // LAYER 5: Study Debt Penalty
    // -------------------------------------------------------------
    const studyDebtCount = Object.keys(stats.incorrectQuestionHistory || {}).length;
    const debtPenalty = hinhPhatNoHocTap(studyDebtCount, totalSolved);

    // -------------------------------------------------------------
    // LAYER 6: Deadline Proximity & Non-Linear Pressure Curve Stage
    // -------------------------------------------------------------
    let remainingDays = 14;
    if (goal.examDate) {
      const todayIso = TimeService.today();
      const diff = TimeService.daysBetween(todayIso, goal.examDate);
      remainingDays = Math.max(1, diff);
    }

    // Deadline Pressure Curve Mapping
    let pressureCurveStage = "Giai đoạn xây nền (còn trên 60 ngày)";
    let stageLabel = "Foundation";
    if (remainingDays <= 2) {
      pressureCurveStage = "Giai đoạn ôn nhớ nhanh (còn 1-2 ngày)";
      stageLabel = "Memory Refresh";
    } else if (remainingDays <= 6) {
      pressureCurveStage = "Giai đoạn sửa lỗi sai (còn 3-6 ngày)";
      stageLabel = "Error Review";
    } else if (remainingDays <= 13) {
      pressureCurveStage = "Giai đoạn thi thử (còn 7-13 ngày)";
      stageLabel = "Mock Exam";
    } else if (remainingDays <= 29) {
      pressureCurveStage = "Giai đoạn luyện thích ứng (còn 14-29 ngày)";
      stageLabel = "Adaptive Practice";
    } else if (remainingDays <= 59) {
      pressureCurveStage = "Giai đoạn phủ kiến thức (còn 30-59 ngày)";
      stageLabel = "Coverage";
    }

    const urgencyIndex = Math.round(
      ((goal.targetScore - 5.0) * (100 - conceptCoverage) * Math.max(1, studyDebtCount)) / Math.pow(remainingDays, 1.2)
    );

    // -------------------------------------------------------------
    // LAYER 7: Evidence-Based Adaptive Weighting
    // -------------------------------------------------------------
    const weights = this.calculateAdaptiveWeights(profile);

    const coverageScore10 = (chapterCoverage * 0.5 + conceptCoverage * 0.5) / 10;
    const masteryScore10 = averageStableMastery / 10;
    const mockScore10 = mockExamAverage;
    const bloomScore10 = Math.min(10, overallAccuracy * 11);
    const retentionScore10 = Math.min(10, (streak / 7) * 2 + overallAccuracy * 8);

    // Điểm nền KHÔNG gộp độ phủ vào.
    //
    // Vì sao (đo ngày 27/07/2026, in năm điểm thành phần ở năm mức năng lực): `coverageScore10`
    // bằng **10,00 ở cả năm mức**, từ người đúng 20% tới người đúng 100%. Nó đo BỀ RỘNG đã đụng
    // tới chương trình, không đo NĂNG LỰC, nên gộp nó vào phần định mức điểm là nhầm loại đại
    // lượng. Hậu quả đo được: độ dốc của điểm nền chỉ còn **0,66** thay vì 1,0, tức cứ 1 điểm
    // năng lực thật thì dự báo chỉ nhúc nhích 0,66 điểm. Đó chính là hiện tượng nén về giữa,
    // khiến người giỏi bị hạ tới 1,1 điểm.
    //
    // Độ phủ vẫn được dùng, nhưng ở đúng chỗ của nó: `coverageUncertainty` trong LAYER 10, tức
    // nó làm dự báo KÉM CHẮC CHẮN hơn chứ không kéo mức điểm xuống. Học lệch thì biên độ rộng
    // ra, không phải bị trừ điểm.
    //
    // Cấu trúc NEO cộng HIỆU CHỈNH, thay cho trung bình có trọng số của năm thành phần.
    //
    // Vì sao đổi cấu trúc chứ không chỉ chỉnh trọng số: độ dốc đo được của từng thành phần khi
    // năng lực thật đi từ 20% lên 100% lần lượt là mastery 0,68, retention 0,80, mock 1,00,
    // bloom 0,98, còn coverage đúng **0,00**. Trung bình có trọng số của các đại lượng dốc dưới
    // 1 thì chắc chắn cũng dốc dưới 1, nên dự báo luôn bị nén về giữa dù chỉnh trọng số kiểu gì.
    // Đo được độ dốc tổng hợp cũ là 0,66, tức mỗi 1 điểm năng lực thật chỉ đổi 0,66 điểm dự báo.
    //
    // Cách sửa: lấy điểm thi thử làm NEO, vì đó là ước lượng không thiên lệch của điểm thi (độ
    // dốc đúng 1,00). Ba thành phần còn lại chỉ được HIỆU CHỈNH quanh neo, có giảm chấn, nên
    // chúng vẫn góp tiếng nói mà không kéo tụt độ dốc.
    //
    // Chưa có bài thi thử nào thì neo bằng chính tỷ lệ đúng tổng thể, cũng là ước lượng không
    // thiên lệch, chứ không rơi về trung bình có trọng số cũ.
    const GIAM_CHAN_HIEU_CHINH = 0.35;
    const neo = mockAttempts.length > 0 ? mockScore10 : overallAccuracy * 10;

    const tongTrongSoPhu = weights.masteryWeight + weights.retentionWeight + weights.bloomWeight;
    const diemPhu = tongTrongSoPhu > 0
      ? (
          (masteryScore10 * weights.masteryWeight) +
          (retentionScore10 * weights.retentionWeight) +
          (bloomScore10 * weights.bloomWeight)
        ) / tongTrongSoPhu
      : neo;

    let baseAccumulatedScore = totalSolved > 0
      ? neo + GIAM_CHAN_HIEU_CHINH * (diemPhu - neo)
      : 5.0;

    // Non-linear Acceleration Growth S-Curve
    const roomToGrow = 10.0 - baseAccumulatedScore;
    const velocityBoost = (acceleration * 0.4) * (roomToGrow / 10.0);
    
    let rawPredicted = baseAccumulatedScore + velocityBoost - debtPenalty;

    // -------------------------------------------------------------
    // LAYER 8: Self-Calibration Profile Bias Adjustment
    // -------------------------------------------------------------
    let calibrationOffset = 0;
    if (profile.calibrationCount > 0) {
      const confidenceScale = Math.min(1.0, profile.calibrationCount / 4);
      calibrationOffset = Math.round(profile.overallBias * confidenceScale * 100) / 100;
    } else if (mockAttempts.length >= 2) {
      const recentMocks = mockAttempts.slice(-3);
      const actualAvg = recentMocks.reduce((s, m) => s + (m.score / Math.max(1, m.questions.length)) * 10, 0) / recentMocks.length;
      calibrationOffset = Math.round((actualAvg - rawPredicted) * 0.3 * 100) / 100;
    }

    rawPredicted += calibrationOffset;

    if (totalSolved === 0) {
      rawPredicted = 5.0;
    }

    const boundedPredicted = Math.min(10.0, Math.max(1.0, Math.round(rawPredicted * 10) / 10));

    // -------------------------------------------------------------
    // LAYER 9: Forecast Smoothing & EMA Filter
    // -------------------------------------------------------------
    // Làm trơn NEO THEO DỮ LIỆU, không neo theo số lần gọi hàm.
    //
    // LỖI CỦA BẢN CŨ: mỗi lần gọi đều lấy giá trị đã lưu, trộn 35% giá trị mới với 65% giá trị
    // cũ, RỒI GHI ĐÈ giá trị đã lưu. Nghĩa là chỉ cần mở lại màn hình nhiều lần là con số tự
    // bò dần lên, dù người học không làm thêm câu nào. Đo thực tế trên một hồ sơ đứng yên:
    // gọi 6 lần liên tiếp cho ra 3,8 rồi 5,1 rồi 6,0 rồi 6,6 rồi 7,0 rồi 7,2. Điểm dự báo phụ
    // thuộc vào SỐ LẦN NGƯỜI DÙNG NHÌN chứ không phụ thuộc vào việc họ học được gì. Điều này
    // vừa phá tính tái lập, vừa khiến con số hiển thị sai lệch theo hướng lạc quan giả tạo.
    //
    // CÁCH SỬA: lưu kèm một dấu vân tay của dữ liệu học. Chỉ khi dấu vân tay ĐỔI, tức là người
    // học thật sự làm thêm bài, mới trộn một bước làm trơn. Gọi lại với cùng dữ liệu luôn trả
    // về đúng con số cũ. Vẫn giữ nguyên tác dụng chống nhảy số giữa các phiên học.
    const storageKey = `poly_econ_last_prediction_${activeSub}`;
    const fingerprint = `${totalSolved}:${totalCorrect}:${history.length}:${goal.targetScore}`;
    let smoothedPrediction = boundedPredicted;

    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved === "object" && typeof saved.value === "number") {
        if (saved.fingerprint === fingerprint) {
          // Dữ liệu chưa đổi: trả lại đúng giá trị đã chốt, không trộn thêm lần nào nữa.
          smoothedPrediction = saved.value;
        } else if (totalSolved > 0) {
          smoothedPrediction = Math.round((0.35 * boundedPredicted + 0.65 * saved.value) * 10) / 10;
        }
      } else if (raw && totalSolved > 0) {
        // Tương thích ngược với định dạng cũ (chỉ là một con số dạng chuỗi).
        const prevVal = parseFloat(raw);
        if (!isNaN(prevVal)) {
          smoothedPrediction = Math.round((0.35 * boundedPredicted + 0.65 * prevVal) * 10) / 10;
        }
      }
    } catch {
      smoothedPrediction = boundedPredicted;
    }

    localStorage.setItem(storageKey, JSON.stringify({ value: smoothedPrediction, fingerprint }));

    const finalPredictedScore = Math.min(10.0, Math.max(1.0, smoothedPrediction));

    // -------------------------------------------------------------
    // LAYER 10: Uncertainty Decomposition (7 Vectors)
    // -------------------------------------------------------------
    const gap = Math.max(0, Math.round((goal.targetScore - finalPredictedScore) * 10) / 10);

    const knowledgeUncertainty = Math.min(1.0, Math.max(0, gap / Math.max(1, goal.targetScore)));
    const retentionUncertainty = Math.min(1.0, Math.max(0, (14 - streak) / 14));
    const coverageUncertainty = Math.min(1.0, Math.max(0, (100 - chapterCoverage) / 100));
    const timeUncertainty = Math.min(1.0, remainingDays <= 3 && (finalPredictedScore / goal.targetScore) < 0.8 ? 0.85 : remainingDays <= 7 ? 0.45 : 0.15);
    // Bất định về HÀNH VI học tập.
    //
    // Phần nền: càng ít câu đã làm thì càng khó tin vào dự báo. Bản cũ dùng bậc thang
    // 0,7 / 0,35 / 0,1 theo `totalSolved`, tức nhảy đột ngột ở mốc 20 và 50 câu. Thay bằng hàm
    // liên tục dùng đúng công thức co theo lượng bằng chứng của dự án: nhiều bằng chứng thì nền
    // bất định tiến về 0,1.
    const wSoCau = 1 - Math.exp(-totalSolved / 25);
    const netBatDinhNen = 0.7 - 0.6 * wSoCau;

    // Phần hành vi thật: đọc cờ nghi vấn người học tự bật để đo hiệu chuẩn nhận thức. Ô "không
    // gắn cờ mà làm sai" là thừa tự tin, thứ khiến người học không tự ôn lại phần mình hổng, nên
    // nó làm dự báo đáng ngờ hơn. Trước 27/07/2026 KHÔNG service nào đọc `attempt.flags`, nên
    // vector này chỉ là hàm của số câu đã làm, không nói gì về hành vi.
    //
    // Chưa đủ dữ liệu thì `thuaTuTinDaCo` bằng 0 và vector rơi về đúng phần nền, không bịa thêm.
    // Việc co theo lượng bằng chứng đã làm MỘT LẦN trong `doHieuChuanNhanThuc`, ở đây không co
    // lại lần nữa (bài học "cân theo lượng bằng chứng chỉ được làm đúng một lần tại nguồn").
    const hieuChuan = learnerModelService.doHieuChuanNhanThuc();
    const behaviorUncertainty = Math.min(1.0, Math.max(0, netBatDinhNen + hieuChuan.thuaTuTinDaCo * 0.4));
    const dependencyUncertainty = Math.min(1.0, avgDependencyDecay * 2);
    const bloomUncertainty = overallAccuracy < 0.65 ? 0.5 : 0.15;

    const aggregateUncertainty = (
      knowledgeUncertainty * 0.20 +
      retentionUncertainty * 0.15 +
      coverageUncertainty * 0.20 +
      timeUncertainty * 0.15 +
      behaviorUncertainty * 0.10 +
      dependencyUncertainty * 0.10 +
      bloomUncertainty * 0.10
    );

    const overallConfidencePct = Math.min(98, Math.max(45, Math.round((1.0 - aggregateUncertainty) * 100)));

    // Confidence Stability Index
    const predictionVariance = profile.predictionVariance || 0.15;
    const stabilityIndex = Math.min(100, Math.max(10, Math.round(100 - (predictionVariance * 120 + (100 - overallConfidencePct) * 0.4))));

    // Dynamic Confidence Margin based on Stability Index
    let rawMargin = 0.30;
    if (stabilityIndex >= 80 && totalSolved >= 30) {
      rawMargin = 0.15 + (100 - stabilityIndex) * 0.005; // Narrow range: e.g. ±0.15
    } else if (stabilityIndex < 50 || totalSolved < 15) {
      rawMargin = 0.55 + (50 - stabilityIndex) * 0.008; // Wide range: e.g. ±0.65
    } else {
      rawMargin = 0.30;
    }
    const confidenceMargin = Math.min(1.2, Math.max(0.1, Math.round(rawMargin * 10) / 10));

    let confidenceLevel: "Cao" | "Trung bình" | "Cần thêm dữ liệu" = "Cần thêm dữ liệu";
    if (totalSolved >= 35 && stabilityIndex >= 70 && confidenceMargin <= 0.25) {
      confidenceLevel = "Cao";
    } else if (totalSolved >= 12) {
      confidenceLevel = "Trung bình";
    }

    const readinessPercentage = Math.min(100, Math.max(0, Math.round((finalPredictedScore / goal.targetScore) * 100)));

    // -------------------------------------------------------------
    // LAYER 11: Local Sensitivity Analysis & Opportunity Cost Engine
    // -------------------------------------------------------------
    // Diminishing returns curve calculation for activities
    const loiIch30 = tinhLoiIch30Phut({
      soCauNo: studyDebtCount,
      doPhuKhaiNiem: conceptCoverage,
      diemThiThuTrungBinh: mockExamAverage,
      chuoiNgay: streak
    });
    const wrong30Gain = loiIch30.soTayCauSai;
    const practice30Gain = loiIch30.luyenThichUng;
    const mock30Gain = loiIch30.thiThu;
    const review30Gain = loiIch30.onNgatQuang;

    const sensitivityAnalysis: SensitivityItem[] = [
      {
        activityKey: "wrong_notebook",
        activityLabel: "Sửa câu sai trong Sổ tay",
        additional30MinGain: wrong30Gain,
        elasticityIndex: Math.round((wrong30Gain / 0.3) * 100) / 100,
        diminishingPhase: studyDebtCount > 15 ? "HIGH_GAIN" : studyDebtCount > 5 ? "MODERATE_GAIN" : "SATURATED",
        opportunityCostIfSkipped: Math.round(-wrong30Gain * 0.9 * 100) / 100
      },
      {
        activityKey: "adaptive_practice",
        activityLabel: "Luyện tập tự thích ứng",
        additional30MinGain: practice30Gain,
        elasticityIndex: Math.round((practice30Gain / 0.3) * 100) / 100,
        diminishingPhase: conceptCoverage < 70 ? "HIGH_GAIN" : "MODERATE_GAIN",
        opportunityCostIfSkipped: Math.round(-practice30Gain * 0.8 * 100) / 100
      },
      {
        activityKey: "mock_exam",
        activityLabel: "Thi thử & Mô phỏng Áp lực",
        additional30MinGain: mock30Gain,
        elasticityIndex: Math.round((mock30Gain / 0.3) * 100) / 100,
        diminishingPhase: mockExamAverage < 7.5 ? "HIGH_GAIN" : "MODERATE_GAIN",
        opportunityCostIfSkipped: Math.round(-mock30Gain * 0.85 * 100) / 100
      },
      {
        activityKey: "spaced_review",
        activityLabel: "Ôn tập ngắt quãng",
        additional30MinGain: review30Gain,
        elasticityIndex: Math.round((review30Gain / 0.3) * 100) / 100,
        diminishingPhase: streak < 5 ? "HIGH_GAIN" : "SATURATED",
        opportunityCostIfSkipped: Math.round(-review30Gain * 0.95 * 100) / 100
      }
    ];

    // -------------------------------------------------------------
    // LAYER 12: Action Plan & Multidimensional Risk Report
    // -------------------------------------------------------------
    const gapActionPlan = [];

    if (studyDebtCount > 0) {
      gapActionPlan.push({
        id: "gap_debt",
        // Chuỗi HIỂN THỊ. Bản cũ "Xử lý N bẫy câu sai tồn đọng (Sổ tay câu sai)" nhắc "câu sai"
        // hai lần trong một dòng, và cụm trong ngoặc chỉ lặp lại tên màn mà người học vừa bấm
        // sang. "Bẫy" và "tồn đọng" cũng là chữ của người làm hệ thống.
        title: `Làm lại ${studyDebtCount} câu từng sai`,
        type: "debt" as const,
        impact: wrong30Gain,
        timeEstimateMinutes: Math.min(45, studyDebtCount * 3),
        completed: false,
        unlockedConceptsCount: studyDebtCount
      });
    }

    if (chapterCoverage < 100) {
      const missingChap = chapters.find(c => !stats.accuracyByChapter?.[c.id]?.total);
      const chapName = missingChap ? missingChap.title : "các chương chưa làm bài";
      gapActionPlan.push({
        id: "gap_chapter",
        // "Phủ bài tập củng cố X" là ngôn ngữ thống kê độ phủ, không phải việc người học hình
      // dung được. Họ chỉ cần biết: luyện chương nào.
      title: `Luyện ${chapName}`,
        type: "chapter" as const,
        impact: practice30Gain,
        timeEstimateMinutes: 30,
        completed: false,
        unlockedConceptsCount: 3
      });
    }

    gapActionPlan.push({
      id: "gap_mastery",
      // "Độ thông thạo ổn định tổng hợp" là tên nội bộ của một chỉ số ghép. Nói bằng tiếng
      // thường thì đó là mức nắm chắc kiến thức tính trên toàn bộ khái niệm đã học.
      title: "Đưa mức nắm chắc kiến thức lên trên 80%",
      type: "mastery" as const,
      impact: 0.3,
      timeEstimateMinutes: 40,
      completed: averageStableMastery >= 80,
      unlockedConceptsCount: 5
    });

    gapActionPlan.push({
      id: "gap_mock",
      // Chuỗi HIỂN THỊ, không phải khoá logic. Bản cũ ra "Luyện 2 đề Thi thử Tự Thích ứng
      // (Luyện thích ứng)": vừa viết hoa giữa câu kiểu tiếng Anh, vừa lặp lại chính nghĩa của
      // vế trước trong ngoặc, vì `stageLabelVN` cũng trả về "Luyện thích ứng". Nay nói một lần.
      title: `Luyện 2 đề thi thử, giai đoạn ${stageLabelVN(stageLabel).toLowerCase()}`,
      type: "mock" as const,
      impact: mock30Gain,
      timeEstimateMinutes: 50,
      completed: mockAttempts.length >= 3,
      unlockedConceptsCount: 4
    });

    const riskReasons: string[] = [];
    const mitigations: string[] = [];

    if (gap > 1.0) {
      /*
        Chỉ đổi CHỮ, không đổi ngưỡng và không đổi phép tính.

        Bản cũ: "Khoảng cách điểm mục tiêu (-5.5 điểm) cần được bù đắp khẩn cấp." Hai chỗ sai
        về cách nói, cùng nằm trong một câu:

        1. Dấu trừ. "-5.5" và "còn 5,5 điểm nữa" là cùng một sự thật, nhưng một bên là điểm âm
           còn một bên là quãng đường. Tiến độ học không bao giờ nên trình bày bằng số âm.
        2. "Khẩn cấp". Câu này hiện ra ngay cạnh dòng "Độ tin cậy: Cần thêm dữ liệu", tức hệ
           thống vừa tự nhận là chưa đủ căn cứ rồi lại phát cảnh báo khẩn dựa trên chính con số
           ấy. Với một hồ sơ mới trả lời 7 trên 292 câu thì đó là lời hù dọa không có cơ sở.
      */
      riskReasons.push(`Còn ${gap} điểm nữa mới tới mục tiêu, cần bù dần bằng lịch học đều.`);
      mitigations.push(`Tăng thời lượng học hàng ngày từ ${goal.dailyStudyMinutes || 45} lên ${Math.min(120, (goal.dailyStudyMinutes || 45) + 30)} phút/ngày.`);
    }
    if (studyDebtCount >= 5) {
      // Cùng lý do như câu trên: chỉ đổi CHỮ, giữ nguyên ngưỡng và phép tính. "Triệt phá" là
      // từ của chuyện đánh trận, không phải của chuyện học. Sổ câu sai là chỗ để làm lại.
      riskReasons.push(`Còn ${studyDebtCount} câu trong sổ câu sai chưa làm lại.`);
      mitigations.push("Ưu tiên dọn sạch Sổ tay câu sai trước khi làm đề thi thử mới.");
    }
    if (remainingDays <= 5 && readinessPercentage < 75) {
      riskReasons.push(`Cận kề ngày thi (${remainingDays} ngày) trong khi độ sẵn sàng đạt ${readinessPercentage}%.`);
      mitigations.push(`Tập trung giai đoạn ${stageLabelVN(stageLabel)} làm đề thi thử tự thích ứng để gia tăng phản xạ.`);
    }
    if (coverageUncertainty > 0.3) {
      riskReasons.push(`Đề cương mới phủ ${chapterCoverage}%, còn hổng ${100 - chapterCoverage}% nội dung.`);
      mitigations.push("Làm các bài trắc nghiệm củng cố của chương chưa thực hành.");
    }
    if (avgDependencyDecay > 0.1) {
      riskReasons.push(`Khái niệm nền tảng bị suy giảm kéo theo hiệu ứng lan truyền suy thoái kiến thức.`);
      mitigations.push("Ôn lại khái niệm tiên quyết để khôi phục chuỗi kiến thức liên hoàn.");
    }

    let riskLevel: "Thấp" | "Trung bình" | "Cao" = "Thấp";
    if (aggregateUncertainty >= 0.50 || riskReasons.length >= 3) {
      riskLevel = "Cao";
    } else if (aggregateUncertainty >= 0.28 || riskReasons.length >= 1) {
      riskLevel = "Trung bình";
    }

    // -------------------------------------------------------------
    // LAYER 13: Detailed Multi-Factor Explanation Engine
    // -------------------------------------------------------------
    const majorPositives = [];
    if (overallAccuracy >= 0.7) majorPositives.push(`Độ chính xác tổng quan cao (${Math.round(overallAccuracy * 100)}%)`);
    if (chapterCoverage >= 80) majorPositives.push(`Độ phủ chương rộng (${chapterCoverage}%)`);
    if (mockAttempts.length >= 2) majorPositives.push(`Đã thi thử ${mockAttempts.length} đề`);
    if (profile.calibrationCount > 0) majorPositives.push(`Hệ thống tự hiệu chỉnh từ ${profile.calibrationCount} lần thi thực tế (Bias ${profile.overallBias > 0 ? '+' : ''}${profile.overallBias})`);

    const majorNegatives = [];
    if (studyDebtCount > 0) majorNegatives.push(`${studyDebtCount} câu sai tồn đọng trong Sổ tay`);
    if (chapterCoverage < 70) majorNegatives.push(`Chưa phủ ${100 - chapterCoverage}% syllabus môn học`);
    if (avgDependencyDecay > 0.05) majorNegatives.push(`Suy thoái kiến thức lan truyền từ khái niệm tiên quyết`);
    if (gap > 1.0) majorNegatives.push(`Còn cách điểm mục tiêu -${gap} điểm`);

    // Run internal Stress Test Report
    const stressTestReport = this.runForecastStressTest(activeSub, finalPredictedScore);

    return {
      subjectId: activeSub,
      predictedScore: finalPredictedScore,
      confidenceMargin,
      confidenceLevel,
      targetScore: goal.targetScore,
      gap,
      readinessPercentage,
      metricsBreakdown: {
        masteryScore: averageStableMastery,
        chapterCoverage,
        conceptCoverage,
        bloomDistributionScore: Math.min(100, Math.round(overallAccuracy * 110)),
        learningVelocity: currentVelocity,
        retentionRate: Math.min(95, Math.max(50, Math.round(overallAccuracy * 100 + 10))),
        wrongQuestionRate: Math.round((1 - overallAccuracy) * 100),
        mockExamAverage: Math.round(mockExamAverage * 10) / 10,
        studyDebtCount,
        remainingDays,
        stableMastery: averageStableMastery,
        learningAcceleration: acceleration,
        urgencyIndex,
        stageLabel
      },
      gapActionPlan,
      riskReport: {
        level: riskLevel,
        reasons: riskReasons.length > 0 ? riskReasons : ["Chưa phát hiện rủi ro lớn, tiến độ học tập ổn định."],
        mitigations: mitigations.length > 0 ? mitigations : ["Duy trì nhịp học hiện tại để giữ vững kết quả."],
        multidimensionalRisk: {
          knowledgeRisk: Math.round(knowledgeUncertainty * 100) / 100,
          retentionRisk: Math.round(retentionUncertainty * 100) / 100,
          timeRisk: Math.round(timeUncertainty * 100) / 100,
          coverageRisk: Math.round(coverageUncertainty * 100) / 100,
          bloomRisk: Math.round(bloomUncertainty * 100) / 100,
          consistencyRisk: Math.round(behaviorUncertainty * 100) / 100,
          fatigueRisk: Math.round(dependencyUncertainty * 100) / 100
        }
      },
      explainability: {
        decision: `Dự báo kết quả ${soThapPhan(finalPredictedScore, 1)} ± ${soThapPhan(confidenceMargin, 1)} (Mục tiêu: ${soThapPhan(goal.targetScore, 1)})`,
        reason: `Mô hình tự hiệu chỉnh: trọng số thích ứng [Thông thạo ${soThapPhan((weights.masteryWeight * 100), 0)}%, Thi thử ${soThapPhan((weights.mockWeight * 100), 0)}%, Độ phủ ${soThapPhan((weights.coverageWeight * 100), 0)}%]. Hiệu chỉnh sai lệch: ${calibrationOffset > 0 ? '+' : ''}${soThapPhan(calibrationOffset, 2)}. ${pressureCurveStage}.`,
        evidence: `Dữ liệu: ${totalSolved} câu đã giải, ${history.length} phiên thi, ${profile.calibrationCount} lần tự hiệu chỉnh, chỉ số ổn định ${stabilityIndex}/100.`,
        policy: "Thuật toán tất định v3.0 • Tự hiệu chỉnh • Tự tối ưu trọng số • Lan truyền phụ thuộc • Hiệu suất giảm dần phi tuyến.",
        timestamp: TimeService.now().toISOString(),
        majorPositives,
        majorNegatives,
        uncertaintySource: coverageUncertainty > 0.3 ? "Độ phủ chương chưa hoàn tất 100%" : studyDebtCount > 5 ? "Tồn đọng câu sai trong Sổ tay" : "Cần tích lũy thêm dữ liệu thi thực tế",
        nextAction: gapActionPlan[0]?.title || "Tiếp tục làm bài tập tự thích ứng"
      },
      calibration: {
        rawPrediction: boundedPredicted,
        calibrationOffset,
        smoothedPrediction: finalPredictedScore,
        historicalErrorAvg: Math.abs(calibrationOffset)
      },
      calibrationProfile: profile,
      sensitivityAnalysis,
      uncertaintyDecomposition: {
        knowledgeUncertainty: Math.round(knowledgeUncertainty * 100) / 100,
        retentionUncertainty: Math.round(retentionUncertainty * 100) / 100,
        coverageUncertainty: Math.round(coverageUncertainty * 100) / 100,
        timeUncertainty: Math.round(timeUncertainty * 100) / 100,
        behaviorUncertainty: Math.round(behaviorUncertainty * 100) / 100,
        dependencyUncertainty: Math.round(dependencyUncertainty * 100) / 100,
        bloomUncertainty: Math.round(bloomUncertainty * 100) / 100,
        overallConfidencePct,
        stabilityIndex
      },
      stressTestReport,
      pressureCurveStage,
      adaptiveWeights: weights
    };
  },

  /**
   * Năm kịch bản sức ép, mỗi kịch bản là một phép đo trên chính mô hình dự báo.
   *
   * CẢNH BÁO CHO NGƯỜI SỬA SAU: hàm này ĐƯỢC GỌI TỪ BÊN TRONG `calculatePrediction`. Tuyệt
   * đối không gọi ngược `this.calculatePrediction()` ở đây, sẽ thành hai hàm gọi vòng nhau vô
   * hạn. Mọi dữ liệu cần thiết phải lấy thẳng từ `dbService` hoặc từ tham số truyền vào.
   *
   * LỖI CỦA BẢN CŨ: bốn trên năm kịch bản là HẰNG SỐ VIẾT TAY (-0,25 / +0,45 / +0,35 / +0,50),
   * không hề đọc dữ liệu người học. Đo thực tế ngày 27/07/2026: xóa sạch lịch sử để về hồ sơ
   * trắng rồi chạy lại, bốn con số đó không đổi một ly. Nghĩa là màn hình hứa "làm chủ chương
   * khó nhất được thêm 0,5 điểm" ngay cả với người chưa làm câu nào (chưa có chương nào được
   * đo là khó), và hứa y hệt với người đã thạo tất cả các chương (không còn gì để làm chủ).
   * Đây đúng loại lỗi "khẳng định điều chưa đo" đã gặp ở phần cân bằng Bloom.
   *
   * CÁCH SỬA: mỗi mức chênh lệch nay suy ra từ một đại lượng mô hình thật sự có tính, và bằng
   * 0 khi kịch bản không thể xảy ra.
   */
  runForecastStressTest(subjectId?: string, baselinePredictedScore?: number): StressTestReport {
    const activeSub = subjectId || dbService.getActiveSubjectId();
    const stats = dbService.getStatistics();
    const baseline = typeof baselinePredictedScore === "number" ? baselinePredictedScore : 5.0;

    const soCauNo = Object.keys(stats.incorrectQuestionHistory || {}).length;
    const chuoiNgay = stats.studyStreak || 0;
    const daLam = stats.totalSolved || 0;
    const daDung = stats.totalCorrect || 0;
    const tyLeDung = daLam > 0 ? daDung / daLam : 0;
    const trongSo = this.calculateAdaptiveWeights(this.getCalibrationProfile(activeSub));

    // Độ phủ khái niệm và điểm thi thử: lấy đúng cách phần lõi lấy, nhưng KHÔNG gọi lại phần lõi.
    const nutDoThi = kbService.getKnowledgeGraph(activeSub);
    const doThao = stats.conceptMastery || {};
    const khaiNiemDuyNhat: number[] = [];
    const daGap = new Set<string>();
    nutDoThi.forEach(n => {
      if (daGap.has(n.id)) return;
      daGap.add(n.id);
      const m = doThao[n.concept] ?? doThao[n.id];
      if (m !== undefined) khaiNiemDuyNhat.push(m);
    });
    if (khaiNiemDuyNhat.length === 0) Object.values(doThao).forEach(v => khaiNiemDuyNhat.push(v || 0));
    const doPhuKhaiNiem = khaiNiemDuyNhat.length > 0
      ? Math.round((khaiNiemDuyNhat.filter(m => m >= 70).length / khaiNiemDuyNhat.length) * 100)
      : 0;

    const lichSu = dbService.getHistory().filter(h => h.isSubmitted && h.questions && h.questions.length >= 5);
    const diemThiThu = lichSu.length > 0
      ? (lichSu.slice(-5).reduce((s, m) => s + (m.score / Math.max(1, m.questions.length)), 0) / Math.min(5, lichSu.length)) * 10
      : tyLeDung * 10;

    const loiIch30 = tinhLoiIch30Phut({
      soCauNo,
      doPhuKhaiNiem,
      diemThiThuTrungBinh: diemThiThu,
      chuoiNgay
    });

    // --- Kịch bản 1: nghỉ 2 ngày. Suy từ đúng hai chỗ chuỗi ngày có mặt trong công thức điểm:
    // thành phần ghi nhớ (chuoiNgay / 7 * 2) và hệ số chuỗi ngày nhân vào độ thạo.
    // Chuỗi đang bằng 0 thì không có gì để mất, nên mức phạt bằng 0 chứ không phải -0,25.
    const ngayMat = Math.min(2, chuoiNgay);
    const giamGhiNho = (ngayMat / 7) * 2 * trongSo.retentionWeight;
    const heSoCu = heSoChuoiNgay(chuoiNgay);
    const heSoMoi = heSoChuoiNgay(chuoiNgay - ngayMat);
    // Dựng lại thành phần độ thạo theo đúng công thức phần lõi, có bỏ qua khoản suy giảm do
    // khái niệm tiên quyết (khoản đó chỉ làm con số nhỏ đi, nên bỏ qua là ước lượng THẬN TRỌNG,
    // không thổi phồng mức phạt).
    const doThaoTrungBinh = khaiNiemDuyNhat.length > 0
      ? khaiNiemDuyNhat.reduce((s, v) => s + v, 0) / khaiNiemDuyNhat.length
      : tyLeDung * 100;
    const diemDoThao10 = ((doThaoTrungBinh * 0.65 + tyLeDung * 100 * 0.35) * heSoCu) / 10;
    const giamDoThao = diemDoThao10 * (1 - heSoMoi / Math.max(0.01, heSoCu)) * trongSo.masteryWeight;
    const chenhNghi = -tron1(giamGhiNho + giamDoThao);

    // --- Kịch bản 2: thêm 60 phút mỗi ngày, tức hai lượt 30 phút dồn vào việc đáng làm nhất
    // hiện tại. Mọi việc đều bão hòa thì mức tăng tự về 0.
    const loiIchTotNhat = Math.max(loiIch30.soTayCauSai, loiIch30.luyenThichUng, loiIch30.thiThu, loiIch30.onNgatQuang);
    const chenhThem60 = tron1(loiIchNhieuLuot(loiIchTotNhat, 2));

    // --- Kịch bản 3: chữa hết câu sai. Đây là con số CHÍNH XÁC chứ không phải ước lượng: phần
    // lõi trừ thẳng `hinhPhatNoHocTap(soCauNo, tongCauDaLam)` khỏi điểm, nên chữa hết nợ lấy lại
    // đúng ngần đó.
    //
    // BẮT BUỘC truyền cả `daLam` giống hệt phần lõi. Thiếu tham số thứ hai thì hàm rơi về công
    // thức cũ theo số tuyệt đối, và bảng lợi ích sẽ hứa nhiều hơn thứ phần lõi thật sự trả lại.
    // Hai nơi nói hai con số khác nhau cho cùng một việc là lỗi đã từng xảy ra trong file này.
    const chenhChuaNo = tron1(hinhPhatNoHocTap(soCauNo, daLam));

    // --- Kịch bản 4: làm 2 đề thi thử, tức hai lượt của hoạt động thi thử.
    const chenhThiThu = tron1(loiIchNhieuLuot(loiIch30.thiThu, 2));

    // --- Kịch bản 5: làm chủ chương yếu nhất. Chữa hết câu sai của chương đó làm tỷ lệ đúng
    // tổng thể nhích lên, mà tỷ lệ đúng có mặt trong ba thành phần điểm. Chưa chương nào có
    // dữ liệu, hoặc mọi chương đã đúng hết, thì mức tăng bằng 0.
    let soCauSaiChuongYeu = 0;
    let tenChuongYeu = "";
    chapters.forEach(c => {
      const acc = stats.accuracyByChapter?.[c.id];
      if (!acc || acc.total === 0) return;
      const sai = Math.max(0, acc.total - acc.correct);
      if (sai > soCauSaiChuongYeu) {
        soCauSaiChuongYeu = sai;
        tenChuongYeu = c.title;
      }
    });
    const chenhChuongYeu = daLam > 0
      ? tron1((soCauSaiChuongYeu / daLam) * doNhayTheoTyLeDung(trongSo, heSoCu))
      : 0;

    const dung = (x: number) => Math.min(10.0, Math.max(1.0, tron1(baseline + x)));

    const scenarios = [
      {
        id: "stress_rest",
        scenarioName: "Nghỉ học 2 ngày liên tiếp",
        projectedScore: dung(chenhNghi),
        deltaFromBaseline: chenhNghi,
        description: chuoiNgay > 0
          ? `Mất ${ngayMat} ngày trong chuỗi học đều đang có (${chuoiNgay} ngày).`
          : "Chưa có chuỗi ngày học đều nào để mất, nên nghỉ thêm không làm sụt thêm điểm."
      },
      {
        id: "stress_add_60m",
        scenarioName: "Tăng 60 phút học mỗi ngày",
        projectedScore: dung(chenhThem60),
        deltaFromBaseline: chenhThem60,
        description: chenhThem60 > 0
          ? "Hai lượt 30 phút dồn vào việc đang có lợi ích biên cao nhất, lượt sau giảm nửa hiệu suất."
          : "Mọi hoạt động đều đã bão hòa, thêm giờ gần như không đổi được điểm."
      },
      {
        id: "stress_resolve_debt",
        scenarioName: "Giải quyết 100% câu sai Sổ tay",
        projectedScore: dung(chenhChuaNo),
        deltaFromBaseline: chenhChuaNo,
        description: soCauNo > 0
          ? `Lấy lại đúng khoản điểm đang bị trừ vì ${soCauNo} câu sai chưa chữa.`
          : "Sổ tay đang sạch, không còn khoản trừ nào để lấy lại."
      },
      {
        id: "stress_mock_exams",
        scenarioName: "Hoàn thành 2 đề thi thử mô phỏng",
        projectedScore: dung(chenhThiThu),
        deltaFromBaseline: chenhThiThu,
        description: chenhThiThu > 0
          ? `Điểm thi thử trung bình đang ${tron1(diemThiThu)}, còn khoảng trống để cải thiện.`
          : "Điểm thi thử đã gần kịch trần, làm thêm đề gần như không đổi được dự báo."
      },
      {
        id: "stress_master_hardest",
        scenarioName: tenChuongYeu ? `Làm chủ 100% chương yếu nhất (${tenChuongYeu})` : "Làm chủ 100% chương yếu nhất",
        projectedScore: dung(chenhChuongYeu),
        deltaFromBaseline: chenhChuongYeu,
        description: soCauSaiChuongYeu > 0
          ? `Chữa hết ${soCauSaiChuongYeu} câu sai của chương này, tỷ lệ làm đúng tổng thể tăng theo.`
          : "Chưa có chương nào bị đo là yếu, nên chưa tính được mức tăng."
      }
    ];

    // Ba kết luận dưới đây trước kia là chuỗi viết sẵn chọn theo ngưỡng số câu nợ. Nay xếp hạng
    // thẳng trên chính các mức chênh lệch vừa tính, nên chúng luôn khớp với bảng phía trên.
    const congViec = [
      { ten: "Giải quyết toàn bộ câu sai trong Sổ tay", loi: chenhChuaNo, phut: Math.max(10, soCauNo * 3) },
      { ten: "Tăng thời lượng học thêm 60 phút mỗi ngày", loi: chenhThem60, phut: 60 },
      { ten: "Làm 2 đề thi thử mô phỏng", loi: chenhThiThu, phut: 100 },
      { ten: tenChuongYeu ? `Làm chủ chương yếu nhất (${tenChuongYeu})` : "Làm chủ chương yếu nhất", loi: chenhChuongYeu, phut: 90 }
    ];
    // Xếp hạng TẤT ĐỊNH: hòa lợi ích thì so tên, không phụ thuộc thứ tự mảng đầu vào.
    const theoHieuSuat = [...congViec].sort((a, b) =>
      (b.loi / b.phut) - (a.loi / a.phut) || a.ten.localeCompare(b.ten, "vi")
    );
    const theoLoiIch = [...congViec].sort((a, b) => b.loi - a.loi || a.ten.localeCompare(b.ten, "vi"));

    return {
      mostSensitiveVariable: theoLoiIch[0].loi > 0
        ? theoLoiIch[0].ten
        : "Chưa đủ dữ liệu để xác định biến nhạy nhất",
      mostEfficientAction: theoHieuSuat[0].loi > 0
        ? theoHieuSuat[0].ten
        : "Chưa đủ dữ liệu để xếp hạng hiệu suất",
      leastEfficientAction: theoHieuSuat[theoHieuSuat.length - 1].ten,
      criticalBottleneck: theoLoiIch[0].loi > 0
        ? `${theoLoiIch[0].ten} (chiếm ${Math.round((theoLoiIch[0].loi / Math.max(0.01, theoLoiIch.reduce((s, c) => s + Math.max(0, c.loi), 0))) * 100)}% tổng dư địa cải thiện)`
        : "Chưa đo được điểm nghẽn nào",
      scenarios
    };
  },

  /**
   * Deadline Pressure Curve Adaptive Daily Study Budget Planner
   */
  getDailyBudgetPlan(budgetMinutes: number) {
    const stats = dbService.getStatistics();
    const debtCount = Object.keys(stats.incorrectQuestionHistory || {}).length;
    const prediction = this.calculatePrediction();
    const stage = prediction.metricsBreakdown.stageLabel || "Foundation";

    let reviewRatio = 0.25;
    let practiceRatio = 0.50;
    let mockRatio = 0.25;

    // Deadline Pressure Curve allocation rules
    if (stage === "Memory Refresh") { // 1-2 days
      reviewRatio = 0.60;
      practiceRatio = 0.25;
      mockRatio = 0.15;
    } else if (stage === "Error Review") { // 3-6 days
      reviewRatio = debtCount > 0 ? 0.55 : 0.40;
      practiceRatio = 0.25;
      mockRatio = 0.20;
    } else if (stage === "Mock Exam") { // 7-13 days
      reviewRatio = 0.20;
      practiceRatio = 0.30;
      mockRatio = 0.50;
    } else if (stage === "Adaptive Practice") { // 14-29 days
      reviewRatio = 0.25;
      practiceRatio = 0.50;
      mockRatio = 0.25;
    } else { // Foundation / Coverage (30d+)
      reviewRatio = debtCount > 0 ? 0.30 : 0.15;
      practiceRatio = 0.60;
      mockRatio = 0.25 - (reviewRatio - 0.15);
    }

    // Chuẩn hóa cho ba tỷ lệ cộng lại đúng bằng 1. Nhánh "sửa lỗi sai" khi sổ tay sạch cộng lại
    // chỉ 0,85, phần thiếu trước đây rơi âm thầm hết vào ô thi thử vì ô đó lấy phần dư. Nghĩa là
    // biến `mockRatio` được gán ở cả năm nhánh nhưng KHÔNG NƠI NÀO ĐỌC, người sửa sau nhìn vào
    // tưởng nó đang điều khiển tỷ lệ.
    const tongTyLe = reviewRatio + practiceRatio + mockRatio;
    const tyLe = [reviewRatio / tongTyLe, practiceRatio / tongTyLe, mockRatio / tongTyLe];

    // Chia phút theo phương pháp phần dư lớn nhất, để tổng ba ô luôn khớp ĐÚNG ngân sách.
    //
    // LỖI CỦA BẢN CŨ: ba sàn cứng (5, 10, 5 phút) được áp riêng lẻ rồi mới cộng lại, nên ngân
    // sách nhỏ bị vỡ. Đo thực tế: xin kế hoạch cho 15 phút thì nhận về 5+10+5 = 20 phút, và ba
    // tỷ lệ hiển thị cộng lại 133%. Nay sàn chỉ được áp khi ngân sách đủ chỗ cho cả ba.
    const tongSan = 20; // 5 + 10 + 5
    const san = budgetMinutes >= tongSan ? [5, 10, 5] : [0, 0, 0];
    const conLai = budgetMinutes - san.reduce((s, v) => s + v, 0);
    const tho = tyLe.map(t => conLai * t);
    const phut = tho.map(Math.floor);
    let du = conLai - phut.reduce((s, v) => s + v, 0);
    // Phát phần dư cho ô có phần lẻ lớn nhất; hòa thì ưu tiên ô đứng trước, nên kết quả tất định.
    const thuTuDu = tho
      .map((v, i) => ({ i, le: v - Math.floor(v) }))
      .sort((a, b) => b.le - a.le || a.i - b.i);
    for (const { i } of thuTuDu) {
      if (du <= 0) break;
      phut[i] += 1;
      du -= 1;
    }
    const [reviewMinutes, practiceMinutes, mockMinutes] = phut.map((v, i) => v + san[i]);

    // Ba tỷ lệ hiển thị cũng phải cộng lại đúng 100, dùng lại đúng phương pháp phần dư lớn nhất.
    // Làm tròn từng ô riêng lẻ cho ra 99% hoặc 101%, người đọc bảng sẽ thấy nó không khớp.
    const soPhut = [reviewMinutes, practiceMinutes, mockMinutes];
    const thoTyLe = soPhut.map(p => (budgetMinutes > 0 ? (p / budgetMinutes) * 100 : 0));
    const tyLeHien = thoTyLe.map(Math.floor);
    let duTyLe = (budgetMinutes > 0 ? 100 : 0) - tyLeHien.reduce((s, v) => s + v, 0);
    const thuTuTyLe = thoTyLe
      .map((v, i) => ({ i, le: v - Math.floor(v) }))
      .sort((a, b) => b.le - a.le || a.i - b.i);
    for (const { i } of thuTuTyLe) {
      if (duTyLe <= 0) break;
      tyLeHien[i] += 1;
      duTyLe -= 1;
    }

    return {
      totalMinutes: budgetMinutes,
      stage,
      pressureCurveStage: prediction.pressureCurveStage,
      allocation: [
        { key: "review", label: `Ôn tập Sổ tay & ôn lại ngắt quãng (${stageLabelVN(stage)})`, minutes: reviewMinutes, ratio: tyLeHien[0] },
        { key: "adaptive", label: "Luyện tập tự thích ứng", minutes: practiceMinutes, ratio: tyLeHien[1] },
        { key: "mock", label: `Thi thử & mô phỏng giai đoạn ${stageLabelVN(stage)}`, minutes: mockMinutes, ratio: tyLeHien[2] }
      ]
    };
  },

  /**
   * Marginal ROI Calculator with Diminishing Returns Model v2
   */
  /**
   * Bảng lợi ích trên thời gian bỏ ra.
   *
   * LỖI CỦA BẢN CŨ: hàm này tự chép lại công thức thay vì đọc bảng độ nhạy mà chính bản dự báo
   * đã tính. Bản chép đã trôi lệch: cùng hoạt động "Luyện tập tự thích ứng", bảng này dùng
   * `0,35 + (100 - độ phủ) * 0,002` cho ra +0,55 điểm, còn bảng độ nhạy dùng
   * `0,35 * (1 - e^(-0,03 * (100 - độ phủ)))` cho ra +0,33 điểm. Hai con số cùng nói về một
   * việc, cùng hiện trên màn Kế hoạch học. Ngoài ra mục Sổ tay hứa +0,10 điểm ngay cả khi sổ
   * tay rỗng, tức mời người học làm một việc không tồn tại.
   *
   * CÁCH SỬA: đọc thẳng `sensitivityAnalysis` của bản dự báo. Một công thức, một nguồn.
   */
  getStudyActivitiesROI(): StudyActivityROI[] {
    const stats = dbService.getStatistics();
    const debtCount = Object.keys(stats.incorrectQuestionHistory || {}).length;
    const prediction = this.calculatePrediction();
    const stage = prediction.metricsBreakdown.stageLabel || "Foundation";
    const doNhay = prediction.sensitivityAnalysis || [];
    const layLoiIch = (khoa: string) => doNhay.find(s => s.activityKey === khoa)?.additional30MinGain ?? 0;

    // Thời lượng ghi trên thẻ là thời lượng THẬT của hoạt động, còn bảng độ nhạy tính theo lượt
    // 30 phút, nên phải quy đổi bằng đúng quy tắc lợi ích biên giảm dần dùng chung.
    const quyDoi = (loiIch30: number, phut: number) => loiIchNhieuLuot(loiIch30, phut / 30);

    const wrongGain = quyDoi(layLoiIch("wrong_notebook"), 25);
    const adaptiveGain = quyDoi(layLoiIch("adaptive_practice"), 30);
    const mockGain = quyDoi(layLoiIch("mock_exam"), 50);

    const tinhRoi = (loiIch: number, phut: number) => Math.round((loiIch / phut * 10) * 100) / 100;

    // Mức ưu tiên xếp theo CHÍNH lợi ích trên thời gian vừa tính, không theo chuỗi viết sẵn.
    const mocRoi = [tinhRoi(wrongGain, 25), tinhRoi(adaptiveGain, 30), tinhRoi(mockGain, 50)];
    const roiCaoNhat = Math.max(...mocRoi);
    const xepMuc = (roi: number): StudyActivityROI["priority"] => {
      if (roi <= 0) return "Thấp";
      if (roi >= roiCaoNhat * 0.9) return "Rất cao";
      if (roi >= roiCaoNhat * 0.5) return "Cao";
      return "Trung bình";
    };

    const activities: StudyActivityROI[] = [
      {
        id: "roi_wrong_notebook",
        title: "Sửa câu sai trong Sổ tay",
        type: "wrong_notebook",
        durationMinutes: 25,
        forecastPointGain: wrongGain,
        roiValue: tinhRoi(wrongGain, 25),
        priority: xepMuc(tinhRoi(wrongGain, 25)),
        reason: debtCount > 0
          ? `Xử lý ${debtCount} câu đang sai. Lợi ích biên giảm dần khi sổ tay vơi đi.`
          : "Sổ tay đang sạch, việc này hiện không còn dư địa tăng điểm."
      },
      {
        id: "roi_adaptive_practice",
        title: "Luyện tập tự thích ứng",
        type: "adaptive_practice",
        durationMinutes: 30,
        forecastPointGain: adaptiveGain,
        roiValue: tinhRoi(adaptiveGain, 30),
        priority: xepMuc(tinhRoi(adaptiveGain, 30)),
        reason: `Độ phủ khái niệm đang ${prediction.metricsBreakdown.conceptCoverage}%, phần chưa phủ là dư địa của hoạt động này.`
      },
      {
        id: "roi_mock_exam",
        title: `Làm bài Thi thử mô phỏng (giai đoạn ${stageLabelVN(stage)})`,
        type: "mock_exam",
        durationMinutes: 50,
        forecastPointGain: mockGain,
        roiValue: tinhRoi(mockGain, 50),
        priority: xepMuc(tinhRoi(mockGain, 50)),
        reason: `Điểm thi thử trung bình đang ${prediction.metricsBreakdown.mockExamAverage}, khoảng cách tới kịch trần là dư địa.`
      }
    ];

    // Hòa ROI thì so mã hoạt động, để thứ tự không đổi giữa hai lần gọi (bất biến 4.7).
    return activities.sort((a, b) => b.roiValue - a.roiValue || a.id.localeCompare(b.id));
  },

  /**
   * Mô phỏng kết quả theo thời lượng học và số ngày còn lại.
   *
   * LỖI CỦA BẢN CŨ: điểm neo "không đổi gì" bị cắm cứng ở 45 phút và 14 ngày, chứ không phải
   * kế hoạch thật của người học. Màn Kế hoạch học đặt sẵn hai thanh trượt đúng bằng kế hoạch
   * hiện tại, nên khi Đàm để 60 phút/ngày hoặc ngày thi cách 30 ngày, màn hình mở ra đã hiện
   * ngay hai con số khác nhau cho cùng một hiện trạng: ô dự báo nói một đằng, ô mô phỏng
   * "chưa kéo thanh nào" nói một nẻo. Trùng nhau chỉ khi kế hoạch tình cờ đúng 45 và 14.
   *
   * CÁCH SỬA: neo vào chính kế hoạch hiện tại. Kéo thanh về đúng chỗ cũ phải trả lại đúng con
   * số dự báo, không sai một ly.
   */
  simulateDeadlineOutcome(dailyMinutes: number, daysRemaining: number): number {
    const prediction = this.calculatePrediction();
    const currentPredicted = prediction.predictedScore;
    const goal = dbService.getSubjectGoal();

    const neoPhut = goal.dailyStudyMinutes || 45;
    const neoNgay = prediction.metricsBreakdown.remainingDays || 14;

    const lechPhut = dailyMinutes - neoPhut;
    const lechNgay = daysRemaining - neoNgay;

    // Thêm giờ có ích nhưng lợi ích biên giảm dần, và mức trần lấy từ đúng hoạt động đang có
    // dư địa cao nhất theo bảng độ nhạy, chứ không phải hằng số 0,35.
    const doNhay = prediction.sensitivityAnalysis || [];
    const tranMoiLuot = Math.max(0.05, ...doNhay.map(s => s.additional30MinGain || 0));
    const anhHuongPhut = lechPhut >= 0
      ? loiIchNhieuLuot(tranMoiLuot, lechPhut / 30)
      : -loiIchNhieuLuot(tranMoiLuot, -lechPhut / 30);

    // Thêm ngày cũng cho thêm dư địa, nhưng KHÔNG tuyến tính vô hạn như bản cũ (bản cũ cộng
    // 0,25 điểm cho mỗi tuần, nên chỉ cần dời ngày thi ra xa là điểm dự báo tự tăng mãi).
    const anhHuongNgay = lechNgay >= 0
      ? loiIchNhieuLuot(tranMoiLuot, lechNgay / 7)
      : -loiIchNhieuLuot(tranMoiLuot, -lechNgay / 7);

    const moPhong = currentPredicted + anhHuongPhut + anhHuongNgay;
    return Math.min(10.0, Math.max(1.0, tron1(moPhong)));
  },

  /**
   * Ba tình huống giả định. Cả ba nay đều lấy số từ bản dự báo, kể cả tình huống tiêu cực vốn
   * bị cắm cứng "-0,8 điểm" bất kể người học đang ở đâu.
   */
  getWhatIfScenarios() {
    const prediction = this.calculatePrediction();
    const current = prediction.predictedScore;
    const sensitivity = prediction.sensitivityAnalysis || [];

    const wrongItem = sensitivity.find(s => s.activityKey === "wrong_notebook");
    const practiceItem = sensitivity.find(s => s.activityKey === "adaptive_practice");

    const loiSoTay = wrongItem?.additional30MinGain ?? 0;
    const loiLuyenTap = practiceItem?.additional30MinGain ?? 0;

    // Mức mất khi bỏ chương yếu nhất: lấy đúng kịch bản "làm chủ chương yếu nhất" trong bảng
    // kịch bản sức ép, đảo dấu. Nhờ vậy hai bảng luôn nói cùng một con số, và khi chưa có
    // chương nào bị đo là yếu thì mức mất bằng 0 chứ không phải -0,8.
    const kichBanChuong = (prediction.stressTestReport?.scenarios || [])
      .find(s => s.id === "stress_master_hardest");
    const mucMatChuong = tron1(Math.abs(kichBanChuong?.deltaFromBaseline ?? 0));

    return [
      {
        title: "Nếu học thêm 30 phút Sổ tay câu sai",
        impactText: loiSoTay > 0 ? `+${loiSoTay} điểm` : "không đổi (sổ tay đang sạch)",
        projectedScore: Math.min(10, tron1(current + loiSoTay)),
        type: loiSoTay > 0 ? "positive" : "neutral"
      },
      {
        title: "Nếu học thêm 30 phút Luyện tập Tự thích ứng",
        impactText: loiLuyenTap > 0 ? `+${loiLuyenTap} điểm` : "không đổi (đã phủ hết khái niệm)",
        projectedScore: Math.min(10, tron1(current + loiLuyenTap)),
        type: loiLuyenTap > 0 ? "positive" : "neutral"
      },
      {
        title: "Nếu bỏ qua không ôn tập chương yếu nhất",
        impactText: mucMatChuong > 0 ? `-${mucMatChuong} điểm` : "chưa đo được chương nào yếu",
        projectedScore: Math.max(1, tron1(current - mucMatChuong)),
        type: mucMatChuong > 0 ? "negative" : "neutral"
      }
    ];
  },

  /**
   * Sổ nợ học tập, xếp theo mức đáng xử lý trước.
   *
   * HAI LỖI CỦA BẢN CŨ, đo thực tế ngày 27/07/2026 trên hồ sơ 45 mục nợ:
   *
   * 1. KHÔNG HỀ XẾP HẠNG. Tên hàm và chú thích nói "prioritized", điểm ưu tiên có được tính,
   *    nhưng tính xong thì VỨT ĐI, danh sách trả về theo thứ tự khóa của bảng lịch sử. Câu sai
   *    ba lần có thể nằm tận cuối, dưới hàng chục câu mới sai một lần.
   * 2. NHÃN KHÔNG PHÂN LOẠI ĐƯỢC GÌ. Công thức cũ cộng `soCauLienQuan * 0,2`, mà số câu cùng
   *    chủ đề thường khoảng 13, tức mọi mục đều được cộng sẵn khoảng 2,6 điểm trước khi xét
   *    ngưỡng 3,0. Kết quả đo được: 44 trên 45 mục cùng mang nhãn "Cao". Một thang đo mà mọi
   *    thứ đều rơi vào một bậc thì không nói lên điều gì.
   *
   * CÁCH SỬA: chuẩn hóa số câu liên quan về [0; 1] để nó không lấn át số lần sai, xếp hạng
   * thật, và chia ba bậc theo số lần sai (tín hiệu mạnh nhất về việc hiểu sai hệ thống).
   */
  getStudyDebtItems(): StudyDebtItem[] {
    const stats = dbService.getStatistics();
    const wrongHist = stats.incorrectQuestionHistory || {};

    // Đếm trước một lượt, thay vì quét lại toàn bộ ngân hàng cho từng mục nợ.
    const demTheoChuDe = new Map<string, number>();
    const demTheoKhaiNiem = new Map<string, number>();
    questions.forEach(q => {
      if (q.topicId) demTheoChuDe.set(q.topicId, (demTheoChuDe.get(q.topicId) || 0) + 1);
      if (q.concept) demTheoKhaiNiem.set(q.concept, (demTheoKhaiNiem.get(q.concept) || 0) + 1);
    });
    const theoId = new Map(questions.map(q => [q.id, q]));

    type MucNo = { item: StudyDebtItem; diem: number };
    const dsNo: MucNo[] = [];

    Object.entries(wrongHist).forEach(([qIdStr, wrongCount]) => {
      const qId = Number(qIdStr);
      const q = theoId.get(qId);
      if (!q) return;
      const soLanSai = Number(wrongCount) || 0;

      const soLienQuan = Math.max(
        demTheoChuDe.get(q.topicId) || 0,
        q.concept ? (demTheoKhaiNiem.get(q.concept) || 0) : 0
      );
      const lienQuanChuanHoa = questions.length > 0 ? Math.min(1, soLienQuan / questions.length * 10) : 0;

      // Tín hiệu thứ hai, độc lập với số lần sai: câu này nằm trong chương đang vững hay chương
      // đang yếu. Cần có tín hiệu này vì phần lớn hồ sơ thật đều gồm rất nhiều câu MỚI SAI ĐÚNG
      // MỘT LẦN, nên nếu chỉ nhìn số lần sai thì cả sổ nợ rơi vào cùng một bậc.
      const accChuong = stats.accuracyByChapter?.[q.chapterId];
      const tyLeDungChuong = accChuong && accChuong.total > 0 ? accChuong.correct / accChuong.total : 0.5;
      const doYeuChuong = 1 - tyLeDungChuong;

      // Sai nhiều lần là tín hiệu mạnh nhất, độ yếu của chương là tín hiệu phụ, số câu liên
      // quan chỉ là gia trọng nhỏ. Cả ba đều bị chặn trên nên không thành phần nào lấn át.
      const diem = soLanSai * 1.5 + doYeuChuong * 1.0 + lienQuanChuanHoa * 0.5;

      const mucUuTien: StudyDebtItem["priority"] =
        soLanSai >= 2 || tyLeDungChuong < 0.5 ? "Cao"
          : tyLeDungChuong < 0.7 ? "Trung bình"
          : "Thấp";

      dsNo.push({
        diem,
        item: {
          id: `debt_q_${qId}`,
          questionId: qId,
          conceptName: q.concept || q.learningObjective || `Câu hỏi #${qId}`,
          chapterId: q.chapterId,
          topicId: q.topicId,
          debtType: "wrong_attempt",
          priority: mucUuTien,
          wrongCount: soLanSai,
          status: "pending"
        }
      });
    });

    chapters.forEach(c => {
      const acc = stats.accuracyByChapter?.[c.id];
      if (acc && acc.total > 0) return;
      // Mã chủ đề phải là mã CÓ THẬT của chương. Bản cũ bịa ra `T{id}.1` theo quy ước đặt tên,
      // đúng loại lỗi đã gặp ở đồ thị tri thức (khái niệm tiên quyết bịa ra không tồn tại).
      const chuDeDau = topics.find(t => t.chapterId === c.id);
      dsNo.push({
        // Cả một chương chưa làm bài nào là khoản nợ lớn hơn mọi câu sai lẻ, nên đặt trên đầu.
        // TRỪ số hiệu chương chứ không cộng: danh sách xếp giảm dần, mà chương chưa học thì
        // phải học từ chương đầu trở đi. Bản đầu cộng vào nên màn hình dựng ngược, Chương 7
        // nằm trên cùng còn Chương 1 rơi xuống đáy.
        diem: 1000 - c.id,
        item: {
          id: `debt_chap_${c.id}`,
          // Bản cũ ghi "Chưa bao phủ bài tập X", vừa là cách nói của người làm hệ thống, vừa
          // nhét TRẠNG THÁI vào chỗ đáng lẽ chỉ là TÊN. Với loại `wrong_attempt` thì trường này
          // giữ tên khái niệm thuần, nên loại chương cũng phải giữ tên chương thuần cho nhất
          // quán; trạng thái để tầng trình bày nói, đúng chỗ của nó.
          conceptName: c.title,
          chapterId: c.id,
          topicId: chuDeDau ? chuDeDau.id : "",
          debtType: "unlearned_chapter",
          priority: "Cao",
          wrongCount: 0,
          status: "pending"
        }
      });
    });

    // Hòa điểm thì so mã mục, nên hai lần gọi luôn cho ra đúng một thứ tự (bất biến 4.7).
    dsNo.sort((a, b) => b.diem - a.diem || a.item.id.localeCompare(b.item.id));
    return dsNo.map(n => n.item);
  }
};
