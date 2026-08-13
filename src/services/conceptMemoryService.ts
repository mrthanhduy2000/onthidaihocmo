/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService, dangKyDonDuLieuSuyRa } from "./db";
import { kbService } from "./kbService";
import { TimeService } from "./time";

export interface ConceptMemoryProfile {
  conceptId: string;
  conceptName: string;
  currentMastery: number; // 0 - 100
  historicalPeak: number; // 0 - 100
  historicalLowest: number; // 0 - 100
  timesStudied: number;
  timesCorrect: number;
  timesWrong: number;
  averageResponseTime: number; // in seconds
  averageConfidence: number; // 0.0 - 1.0
  confidenceTrend: "rising" | "stable" | "falling";
  retentionScore: number; // 0.0 - 1.0 (decayed memory accessibility)
  difficultyScore: number; // 1.0 - 10.0
  misconceptionHistory: Array<{
    misconception: string;
    timestamp: string;
    resolved: boolean;
    questionId?: number;
  }>;
  preferredTeachingStyle: "Academic" | "Business" | "Analogy" | "Socratic" | "Simple" | "Real-world";
  preferredExplanationLength: "short" | "medium" | "deep";
  lastReviewAt?: string; // ISO string
  nextReviewAt?: string; // ISO string
  estimatedForgetCurve: Array<{ daysAhead: number; retention: number }>;
  learningVelocity: number; // points change per session
  recoveryCount: number; // number of times recovered from low mastery / regression
  regressionCount: number; // number of times mastery or retention dropped significantly
  isStableMastered: boolean; // mastery >= 85, >= 3 spaced sessions, 0 active misconceptions
  isRegressionDetected: boolean;
  explanationsHistory: Array<{
    timestamp: string;
    strategy: string;
    length: string;
    wasSuccessful: boolean;
  }>;

  // PHASE NEXT — LEARNING DYNAMICS ENGINE FIELDS
  shortTermMomentum?: number; // slope of last 3 attempts
  mediumTermMomentum?: number; // slope of last 7 attempts
  longTermMomentum?: number; // slope of last 15 attempts
  momentumTrend?: "accelerating" | "improving" | "plateau" | "regression";
  rollingVariance?: number; // variance across recent practice scores
  stabilityScore?: number; // 0.0 to 1.0 (consistency)
  averageRepairAttempts?: number; // avg repair attempts to resolve a misconception
  repairLatencySeconds?: number; // avg time to repair misconception
  relapseFrequency?: number; // count of relapses after resolution
  permanentRecoveryRate?: number; // 0.0 to 1.0
  evidenceStrength?: number; // 0.0 to 1.0 based on count, variety, time, bloom
  fragilityScore?: number; // 0.0 to 1.0 (robustness indicator)
  bloomPerformance?: Record<string, { attempts: number; correct: number; accuracy: number }>;
  transferQualityScore?: number; // 0.0 to 1.0 (cross-Bloom transfer)
  maturityStage?: "New" | "Emerging" | "Developing" | "Stable" | "Mature" | "Automatic";
  learningGainPerMinute?: number;
  learningGainPerQuestion?: number;
  learningGainPerSession?: number;
  efficiencyScore?: number; // 0.0 to 10.0
  persistentErrorPenalty?: number; // multiplier >= 1.0
  calibrationState?: "overconfident" | "underconfident" | "calibrated" | "chua-du-du-lieu";
  calibrationScore?: number; // 0.0 to 1.0
  /**
   * Số lượt có TÍN HIỆU TỰ KHAI thật về mức chắc chắn, tức người học có bấm nút cờ nghi vấn
   * trong lượt làm bài đó. Lượt không có tín hiệu nào vẫn được ghi nhận độ tự tin trung lập
   * 0,5, nhưng KHÔNG được tính là bằng chứng, nếu không thì "im lặng" bị đọc thành "tự tin".
   */
  confidenceSignalCount?: number;
  scoreHistory?: Array<{
    timestamp: string;
    score: number;
    bloomLevel?: string;
    timeSpent?: number;
    confidence?: number;
    questionId?: number;
  }>;
}

export interface ConceptMemoryUpdate {
  wasCorrect: boolean;
  responseTimeSeconds: number;
  confidence: number; // 0.0 to 1.0
  /**
   * `confidence` ở trên có phải tín hiệu ĐO ĐƯỢC hay chỉ là giá trị trung lập thay thế.
   * Bỏ trống được hiểu là có tín hiệu, để đường gọi cũ từ gia sư AI không đổi hành vi.
   */
  coTinHieuTuTin?: boolean;
  detectedMisconception?: string;
  teachingStrategy: string;
  explanationLength: string;
  questionId?: number;
}

const STORAGE_PREFIX = "poly_econ_concept_memory_";

/**
 * Số lượt tối thiểu CÓ tín hiệu tự khai mới dám xếp loại hiệu chuẩn cho một khái niệm.
 * Đặt bằng 3 vì dưới mức đó một lần bấm cờ lỡ tay đã đủ lật ngược nhãn.
 */
const TOI_THIEU_TIN_HIEU_TU_TIN = 3;

/**
 * Mốc bằng chứng cho phép co. Dùng CÙNG hằng số 6 với `db.recomputeStatistics` và
 * `learnerModelService`, để cả dự án chỉ có một cách co theo lượng bằng chứng.
 */
const MOC_BANG_CHUNG_CO = 6;

/**
 * Độ khó ghi nhớ TIÊN NGHIỆM, suy từ dữ liệu người soạn nội dung viết tay trong đồ thị tri thức.
 *
 * Vì sao cần: `customer_behavior_kb.ts` có `review.estimatedRetentionDifficulty` và
 * `review.firstReviewDays` cho **16/16** khái niệm, với ba mức độ khó (easy 5, medium 9, hard 2)
 * và ba mức ngày ôn đầu (1, 2, 3). Người soạn đã nói rõ khái niệm nào khó nhớ. Nhưng **không một
 * dòng suy luận nào đọc chúng**: `firstReviewDays` chỉ xuất hiện ở chỗ `kbService` GHI giá trị
 * mặc định cho nút tổng hợp, còn `estimatedRetentionDifficulty` chỉ được đọc một lần trong
 * `evidencePipeline`, mà phần lớn file đó là mã chết.
 *
 * Hệ quả đo được ngày 27/07/2026: khái niệm chưa học câu nào có `timesStudied` bằng 0 và
 * `difficultyScore` mặc định 5,0, nên độ bền trí nhớ ra đúng **6,15 ngày cho MỌI khái niệm**,
 * không phân biệt gì cả. Đây là bài toán khởi đầu nguội, mà lời giải nằm sẵn trong dữ liệu.
 *
 * Trả về null khi không có dữ liệu biên soạn, để nơi gọi giữ nguyên hành vi cũ. Nút TỔNG HỢP tự
 * động cũng bị loại, vì `review` của chúng là hằng số mặc định 3/7/14 và "medium" cho mọi khái
 * niệm, tức không mang thông tin gì.
 */
export function doKhoTienNghiem(conceptName: string): number | null {
  const subjectId = dbService.getActiveSubjectId();
  const node = kbService.getKnowledgeGraph(subjectId).find(n => n.concept === conceptName);
  if (!node || node.laNutTongHop || !node.review) return null;

  const theoNhan: Record<string, number> = { easy: 4.0, medium: 5.0, hard: 7.0 };
  const nen = theoNhan[String(node.review.estimatedRetentionDifficulty || "").toLowerCase()];
  if (nen === undefined) return null;

  // Ngày ôn đầu càng sớm thì người soạn càng cho rằng khái niệm dễ trôi. Chỉ dùng làm điều chỉnh
  // nhẹ quanh mức nền, tối đa nửa bậc, để nhãn độ khó vẫn là tín hiệu chính.
  const ngayDau = typeof node.review.firstReviewDays === "number" ? node.review.firstReviewDays : 2;
  const dieuChinh = Math.max(-0.5, Math.min(0.5, (2 - ngayDau) * 0.25));

  return Math.max(1, Math.min(10, nen + dieuChinh));
}

/**
 * Sàn của mọi phép tính độ ghi nhớ. Không ai còn nhớ 0% tuyệt đối, và quan trọng hơn: hai hàm
 * dùng hai sàn khác nhau thì đường cong vẽ ra màn hình sẽ mâu thuẫn với điểm số dùng xếp lịch
 * ôn. Đo ngày 27/07/2026: `generateForgetCurve` chốt sàn 0,05 còn `calculateRetentionScore`
 * chốt 0,08, nên từ mốc 14 ngày trở đi hai hàm lệch nhau 3 điểm phần trăm dù chú thích ngay
 * trên chúng khẳng định là "dùng chung đúng công thức".
 */
const SAN_GHI_NHO = 0.05;

/**
 * Bằng chứng đầu vào để tính độ bền trí nhớ. Cố ý KHÔNG nhận nguyên hồ sơ, mà nhận đúng những
 * đại lượng công thức thật sự cần, để hai kiểu hồ sơ khác nhau của dự án cùng dùng được một
 * công thức duy nhất.
 */
export interface BangChungTriNho {
  /** Số lần nhớ lại THÀNH CÔNG. Chỉ lần nhớ lại đúng mới bồi thêm độ bền. */
  soLanNhoLaiDung: number;
  /** Số lần nhớ lại THẤT BẠI. */
  soLanNhoLaiSai: number;
  /** Đỉnh cao độ thạo từng đạt, thang 0 đến 100. */
  dinhCaoDoThao: number;
  /** Độ khó ghi nhớ của khái niệm, thang 1 đến 10. */
  doKhoKhaiNiem: number;
  /** Số lần đã phục hồi sau khi tụt. */
  soLanPhucHoi?: number;
  /** Số lần tụt lùi đáng kể. */
  soLanTuiLui?: number;
  /** Đã đạt trạng thái thạo ổn định chưa. */
  daVungOnDinh?: boolean;
  /** Các mốc thời gian đã học, dạng chuỗi ISO. Dùng để đo hiệu ứng giãn cách. */
  mocHocISO?: string[];
  /** Các lần nhớ lại thật sau một quãng nghỉ, dùng để HIỆU CHUẨN công thức. */
  capNhoLai?: CapNhoLai[];
}

/** Một lần thử nhớ lại thật: nghỉ bấy nhiêu ngày rồi quay lại, có nhớ được không. */
export interface CapNhoLai {
  soNgayNghi: number;
  nhoDuoc: boolean;
}

/**
 * Quãng nghỉ tối thiểu để một lần làm bài được coi là PHÉP THỬ TRÍ NHỚ. Hai câu cách nhau vài
 * giây trong cùng một buổi không kiểm tra trí nhớ dài hạn, chúng chỉ đo sự chú ý.
 */
const NGUONG_NGHI_NGAY = 0.5;

/** Số cặp tối thiểu để dám ước lượng. Dưới mức này thì trả "chưa đủ dữ liệu", không đoán. */
const TOI_THIEU_CAP_NHO_LAI = 3;

export interface KetQuaHieuChuanTriNho {
  duDuLieu: boolean;
  soCap: number;
  doBenNgay: number | null;
  tyLeNhoLai: number | null;
  soNgayNghiTrungBinh: number | null;
}

/**
 * Rút các lần thử nhớ lại thật ra khỏi lịch sử điểm của một khái niệm.
 *
 * Dữ liệu vốn nằm sẵn không ai đọc: mỗi mục `scoreHistory` có mốc thời gian và điểm độ thạo
 * ngay sau lượt đó. Hai mục liên tiếp cho ra đúng thứ cần để hiệu chuẩn đường cong quên: nghỉ
 * bao nhiêu ngày, rồi quay lại có nhớ được không.
 *
 * Đúng hay sai suy từ DẤU của mức thay đổi điểm, vì `studentEvolutionEngine` cộng 10 khi đúng
 * và trừ 8 khi sai, cộng thêm điều chỉnh tự tin tối đa 2,5. Nên trả lời đúng luôn làm điểm
 * TĂNG, trả lời sai luôn làm điểm GIẢM. Trường hợp duy nhất nhập nhằng là điểm đứng yên do
 * chạm trần 100 hoặc chạm sàn 0; những cặp đó bị BỎ chứ không đoán, vì đoán sai một cặp ở đây
 * làm lệch cả đường cong.
 */
export function rutCapNhoLai(lichSu: Array<{ timestamp: string; score: number }> | undefined): CapNhoLai[] {
  const ds = lichSu || [];
  const ra: CapNhoLai[] = [];
  for (let i = 1; i < ds.length; i++) {
    const truoc = new Date(ds[i - 1].timestamp).getTime();
    const sau = new Date(ds[i].timestamp).getTime();
    if (!Number.isFinite(truoc) || !Number.isFinite(sau)) continue;
    const soNgayNghi = (sau - truoc) / 86400000;
    if (soNgayNghi < NGUONG_NGHI_NGAY) continue;
    const delta = ds[i].score - ds[i - 1].score;
    if (delta === 0) continue; // nhập nhằng, bỏ
    ra.push({ soNgayNghi, nhoDuoc: delta > 0 });
  }
  return ra;
}

/**
 * ĐỘ BỀN TRÍ NHỚ ĐO ĐƯỢC từ chính người học, thay vì suy ra từ công thức.
 *
 * Vì sao cần: cho tới 27/07/2026, đường cong quên của dự án chưa từng được đối chiếu với một
 * lần nhớ lại thật nào. Nó dự đoán "sau 7 ngày còn nhớ 58%" rồi không bao giờ hỏi lại xem
 * người học có thật sự nhớ không. Đây đúng là kiểu vòng hở đã sửa cho bộ dự báo điểm thi.
 *
 * Cách ước lượng, cố ý chọn dạng đóng và giải thích được thay vì dò số:
 *
 *     R(t) = e^(-t/S)  =>  S = -ngayNghiTrungBinh / ln(tyLeNhoLai)
 *
 * `tyLeNhoLai` làm trơn Laplace (cộng 1 lần nhớ được và 2 lượt) đúng theo lối đã dùng ở
 * `transferQualityScore`, để vài quan sát đầu không đẩy ra kết luận cực đoan và để tỷ lệ không
 * bao giờ chạm 0 hay 1 làm logarit nổ.
 *
 * NÓI RÕ GIỚI HẠN: lấy trung bình quãng nghỉ rồi mới nghịch đảo logarit là ước lượng bậc một,
 * không phải hợp lý cực đại. Nó lệch nhẹ khi các quãng nghỉ chênh nhau rất xa. Chấp nhận được
 * vì kết quả còn bị co về phía tiên nghiệm theo `w = 1 - e^(-n/6)`, nên vài cặp đầu chỉ hiệu
 * chỉnh nhẹ chứ không lật ngược công thức.
 */
export function doBenTriNhoDoDuoc(cap: CapNhoLai[]): KetQuaHieuChuanTriNho {
  const ds = cap || [];
  if (ds.length < TOI_THIEU_CAP_NHO_LAI) {
    return { duDuLieu: false, soCap: ds.length, doBenNgay: null, tyLeNhoLai: null, soNgayNghiTrungBinh: null };
  }

  const soNho = ds.filter(c => c.nhoDuoc).length;
  const tyLeNhoLai = (soNho + 1) / (ds.length + 2);
  const soNgayNghiTrungBinh = ds.reduce((s, c) => s + c.soNgayNghi, 0) / ds.length;

  const doBenNgay = Math.max(0.25, Math.min(180, -soNgayNghiTrungBinh / Math.log(tyLeNhoLai)));

  return {
    duDuLieu: true,
    soCap: ds.length,
    doBenNgay: Number(doBenNgay.toFixed(2)),
    tyLeNhoLai: Number(tyLeNhoLai.toFixed(3)),
    soNgayNghiTrungBinh: Number(soNgayNghiTrungBinh.toFixed(2)),
  };
}

/**
 * ĐỘ BỀN TRÍ NHỚ của một khái niệm, tính bằng ngày. Đây là NGUỒN DUY NHẤT của công thức này
 * trong toàn dự án, kể cả cho `learnerModel`.
 *
 *     R(t) = e^(-t/S)
 *     S = nen * heSoGianCach * phatQuenLai * heSoPhucHoi * phatTuiLui * heSoDoKho * thuongOnDinh
 *     nen = max(1, 1,8*log2(soLanNhoLaiDung + 1) + dinhCaoDoThao/25)
 *
 * Ba điều bản trước bỏ sót, cả ba đều đo được ngày 27/07/2026:
 *
 * 1. **Hiệu ứng giãn cách bị bỏ qua hoàn toàn.** Ôn dồn 5 lần trong một giờ và ôn giãn 5 lần
 *    trong 60 ngày đều cho đúng 55% sau 7 ngày. Đây là hiệu ứng vững chắc nhất của cả ngành
 *    nghiên cứu trí nhớ, mà dữ liệu để đo nó (`scoreHistory` và `reviewHistory` đều có mốc thời
 *    gian) thì nằm sẵn không ai đọc. Nay đếm số NGÀY LỊCH khác nhau đã học.
 *
 * 2. **Nhớ lại thất bại vô hình.** Học 5 lần đúng hết và học 5 lần sai hết đều cho 55%. Nay
 *    phần nền chỉ lớn lên theo số lần nhớ lại ĐÚNG, cộng thêm phạt theo TỶ LỆ quên. Cố ý dùng
 *    tỷ lệ chứ không dùng số tuyệt đối, đúng bài học đã rút ra ở hàm phạt nợ học tập của bộ dự
 *    báo: đếm tuyệt đối thì ai luyện càng nhiều càng bị phạt nặng.
 *
 * 3. **Không có gì để hiệu chuẩn.** Xem `doBenTriNhoDoDuoc` bên dưới.
 *
 * Thiếu dữ liệu thì mọi hệ số mới đều trả về 1,0, tức giữ nguyên hành vi cũ, không đoán bừa.
 */
export function doBenTriNhoNgay(bc: BangChungTriNho): number {
  const soDung = Math.max(0, bc.soLanNhoLaiDung || 0);
  const soSai = Math.max(0, bc.soLanNhoLaiSai || 0);
  const tongLuot = soDung + soSai;

  const nen = Math.max(1.0, Math.log2(soDung + 1) * 1.8 + Math.max(0, bc.dinhCaoDoThao) / 25);

  // Hiệu ứng giãn cách. Đếm số NGÀY LỊCH khác nhau chứ không đếm số lượt, vì 5 lượt trong cùng
  // một buổi học chỉ là một lần gặp lại kiến thức. Bão hòa ở 5 ngày khác nhau, thưởng tối đa
  // 1,5 lần: cố ý dè dặt hơn nhiều so với mức các nghiên cứu đo được, để nếu có sai thì sai về
  // phía nhắc ôn sớm chứ không phải phía để người học quên mất.
  const ngayKhacNhau = new Set(
    (bc.mocHocISO || [])
      .map(s => {
        const t = new Date(s).getTime();
        return Number.isFinite(t) ? Math.floor(t / 86400000) : null;
      })
      .filter((v): v is number => v !== null)
  ).size;
  const heSoGianCach = 1 + 0.5 * Math.max(0, Math.min(1, (ngayKhacNhau - 1) / 4));

  // Phạt theo TỶ LỆ nhớ lại thất bại, không theo số tuyệt đối.
  const tyLeQuen = tongLuot > 0 ? soSai / tongLuot : 0;
  const phatQuenLai = 1 / (1 + 1.5 * tyLeQuen);

  const heSoPhucHoi = 1.0 + 0.35 * Math.min(5, bc.soLanPhucHoi || 0);
  const phatTuiLui = 1.0 / (1.0 + 0.40 * Math.min(5, bc.soLanTuiLui || 0));
  const heSoDoKho = Math.max(0.6, 8.0 / Math.max(4.0, bc.doKhoKhaiNiem || 5.0));
  const thuongOnDinh = bc.daVungOnDinh ? 2.2 : 1.0;

  const tienNghiem = nen * heSoGianCach * phatQuenLai * heSoPhucHoi * phatTuiLui * heSoDoKho * thuongOnDinh;

  // HIỆU CHUẨN bằng chính lịch sử nhớ lại của người học. Toàn bộ phần trên vẫn chỉ là công thức
  // suy ra; đây là chỗ duy nhất đường cong được đối chiếu với việc người học có thật sự nhớ hay
  // không. Co về tiên nghiệm theo đúng một cách co duy nhất của dự án `w = 1 - e^(-n/6)`: chưa
  // có cặp nào thì w bằng 0 nên giữ nguyên công thức, càng nhiều lần nhớ lại thật thì số đo càng
  // lấn át. Thiếu dữ liệu thì `duDuLieu` bằng false và không có gì thay đổi.
  const doDuoc = doBenTriNhoDoDuoc(bc.capNhoLai || []);
  if (!doDuoc.duDuLieu || doDuoc.doBenNgay === null) return tienNghiem;

  const w = 1 - Math.exp(-doDuoc.soCap / MOC_BANG_CHUNG_CO);
  return tienNghiem * (1 - w) + doDuoc.doBenNgay * w;
}

/** Quy độ bền ra tỷ lệ còn nhớ sau `soNgay` ngày. Một chỗ duy nhất áp sàn. */
export function conNhoSauNgay(doBenNgay: number, soNgay: number): number {
  const S = Math.max(0.05, doBenNgay);
  return Math.max(SAN_GHI_NHO, Math.exp(-Math.max(0, soNgay) / S));
}

/**
 * MỨC CÒN NHỚ DỰ BÁO VÀO NGÀY THI, thứ mà một ứng dụng luyện thi phải tối ưu.
 *
 * VÌ SAO CẦN, và vì sao đây là chỗ sản phẩm này làm được thứ Anki không làm được.
 *
 * Anki xếp lịch cho trí nhớ VÔ THỜI HẠN: nó giả định người học muốn nhớ mãi mãi, nên giữ một
 * mức nhớ mục tiêu cố định rồi nới dần khoảng cách. Đúng cho người học ngoại ngữ, nhưng sai
 * mục tiêu cho người ôn thi, vì người ôn thi chỉ cần nhớ CAO NHẤT VÀO ĐÚNG MỘT NGÀY.
 *
 * Hệ quả đo được ngày 30/07/2026, ba khái niệm ĐỀU VỪA HỌC HÔM NAY với kỳ thi còn 14 ngày:
 *
 *     khái niệm                        S(ngày)   nhớ BÂY GIỜ   nhớ NGÀY THI
 *     dễ, đã ôn giãn cách nhiều lần      27,3        100%           60%
 *     trung bình                          7,9        100%           17%
 *     khó, hay quên                       1,5        100%            5%
 *
 * Cả ba đều 100% ở hiện tại, nên yếu tố "mức quên" trong bảng chấm ưu tiên chấm chúng NHƯ NHAU,
 * dù tới ngày thi chúng lệch nhau 55 điểm phần trăm. Một khái niệm mong manh vừa học xong trông
 * hoàn toàn khoẻ mạnh dưới con mắt của hệ thống cũ, trong khi nó sẽ bay sạch trước khi thi.
 *
 * KHÔNG viết đường cong mới ở đây, đúng bất biến 4.9c: hàm này chỉ gọi lại `conNhoSauNgay` với
 * một mốc thời gian khác. Đổi công thức quên ở một chỗ thì cả hai đường vẫn đi cùng nhau.
 *
 * @param doBenNgay  độ bền, lấy từ `doBenTriNhoNgay`
 * @param soNgayToiKyThi  số ngày từ HÔM NAY tới ngày thi
 * @param soNgayDaNghi  số ngày từ lần học cuối tới HÔM NAY, mặc định 0 khi vừa học xong
 * @returns tỷ lệ còn nhớ dự báo vào ngày thi, hoặc `null` khi CHƯA ĐẶT ngày thi
 */
export function mucNhoVaoNgayThi(
  doBenNgay: number,
  soNgayToiKyThi: number | null | undefined,
  soNgayDaNghi: number = 0
): number | null {
  // Chưa đặt ngày thi thì KHÔNG đoán. Trả null để nơi gọi giữ nguyên hành vi cũ, đúng nếp
  // "thiếu dữ liệu thì không suy diễn" của dự án.
  if (soNgayToiKyThi === null || soNgayToiKyThi === undefined || !Number.isFinite(soNgayToiKyThi)) {
    return null;
  }
  const tongNgay = Math.max(0, soNgayDaNghi) + Math.max(0, soNgayToiKyThi);
  return conNhoSauNgay(doBenNgay, tongNgay);
}

/**
 * LỢI ÍCH CỦA VIỆC ÔN KHÁI NIỆM NÀY HÔM NAY, đo bằng mức nhớ tăng thêm VÀO NGÀY THI.
 *
 * ĐÂY LÀ CHỖ SẢN PHẨM NÀY LÀM ĐƯỢC THỨ ANKI KHÔNG LÀM ĐƯỢC, và khác hẳn với
 * `mucNhoVaoNgayThi` vốn chỉ trả lời "tới ngày thi còn nhớ bao nhiêu". Hàm này trả lời câu hỏi
 * thật sự cần cho việc xếp lịch: **ôn thẻ này hôm nay thì được thêm bao nhiêu vào ngày thi.**
 *
 * ANKI XẾP LỊCH CHO TRÍ NHỚ VÔ THỜI HẠN. Cả SM-2 lẫn FSRS đều chọn thẻ theo một quy tắc duy
 * nhất: mức nhớ dự báo HÔM NAY đã tụt xuống dưới mức mong muốn hay chưa (FSRS mặc định 0,90).
 * Không có khái niệm hạn chót trong mô hình. Với người ôn thi thì mục tiêu khác hẳn: nhớ CAO
 * NHẤT VÀO ĐÚNG MỘT NGÀY, và mọi thứ sau ngày đó không tính điểm.
 *
 * BA CA CHO THẤY HAI CÁCH XẾP KHÁC NHAU RA SAO. Lấy chính công thức của dự án, S là độ bền tính
 * theo ngày:
 *
 *     ca 1  S = 27,3 ngày, thi còn 5 ngày
 *           không ôn: 83%   ôn hôm nay: 93%   lợi ích +10 điểm phần trăm
 *
 *     ca 2  S = 1,5 ngày, thi còn 30 ngày
 *           không ôn: 0%    ôn hôm nay: 0%    lợi ích gần bằng 0
 *           Ôn hôm nay gần như VÔ ÍCH cho ngày thi: dù có đẩy độ bền lên 2,5 ngày thì 30 ngày
 *           sau vẫn quên sạch. Anki vẫn bắt ôn, và người học vẫn sẽ quên. Việc đúng phải làm là
 *           ĐỂ DÀNH khái niệm này tới gần ngày thi.
 *
 *     ca 3  S = 1,5 ngày, thi còn 3 ngày, tức đúng khái niệm ở ca 2 nhưng sát ngày thi
 *           không ôn: 14%   ôn hôm nay: 30%   lợi ích +16 điểm phần trăm, cao nhất bảng
 *
 * Cùng một khái niệm, cùng một trạng thái trí nhớ, mà thứ tự ưu tiên LẬT NGƯỢC hoàn toàn chỉ vì
 * ngày thi xa hay gần. Không cách xếp nào chỉ nhìn trạng thái hiện tại làm được điều đó.
 *
 * KHÔNG viết đường cong mới ở đây (bất biến 4.9c). Hàm này chỉ gọi lại `doBenTriNhoNgay` và
 * `conNhoSauNgay` với hai bộ bằng chứng khác nhau.
 *
 * @returns `null` khi CHƯA ĐẶT ngày thi. Nơi gọi phải lùi về cách xếp theo mức quá hạn và nói rõ
 *          là đang lùi, chứ không được lặng lẽ coi lợi ích bằng 0.
 */
export function loiIchOnHomNay(
  bangChung: BangChungTriNho,
  soNgayToiKyThi: number | null | undefined,
  soNgayDaNghi: number = 0
): number | null {
  if (soNgayToiKyThi === null || soNgayToiKyThi === undefined || !Number.isFinite(soNgayToiKyThi)) {
    return null;
  }
  const doBenHienTai = doBenTriNhoNgay(bangChung);
  const nhoNeuKhongOn = conNhoSauNgay(doBenHienTai, Math.max(0, soNgayDaNghi) + Math.max(0, soNgayToiKyThi));

  /*
    ĐỘ GẮNG SỨC KHI NHỚ LẠI, và vì sao một lượt ôn không phải lúc nào cũng đáng một lượt.

    ĐO ĐƯỢC NGÀY 13/08/2026, trên bản chạy thật: ôn xong 6 khái niệm, quay lại Bàn học thì hàng
    đợi vẫn liệt kê đúng 6 khái niệm ấy, vẫn hứa "ôn hôm nay nâng thêm 25 điểm phần trăm". Ôn lại
    lần nữa ngay lập tức vẫn được hứa y như vậy. Tức hàng đợi mời người học ôn dồn vô hạn.

    Nguyên nhân nằm ở chỗ tinh vi. `doBenTriNhoNgay` CÓ khử ôn dồn ở hệ số giãn cách, vì hệ số ấy
    đếm số NGÀY LỊCH khác nhau nên lượt thứ hai trong cùng ngày không cộng thêm gì. Nhưng phần nền
    `1,8·log2(soLanNhoLaiDung + 1)` thì vẫn cộng nguyên một lượt, bất kể lượt đó cách lượt trước
    mười phút hay mười ngày. Một nửa công thức khử ôn dồn, nửa kia vẫn thưởng cho nó.

    CÁCH SỬA, và vì sao sửa ở đây chứ không sửa công thức độ bền. Bất biến 4.9c: cả dự án chỉ có
    MỘT công thức độ bền trí nhớ, và `doBenTriNhoNgay` là hàm thuần của bằng chứng, nó không được
    biết "lần ôn trước cách đây bao lâu". Phán đoán về giãn cách thuộc về chỗ RA QUYẾT ĐỊNH xếp
    lịch, tức chính hàm này.

    Vì vậy lượt ôn giả định không còn được tính tròn 1, mà tính theo mức đã quên tại thời điểm ôn:

        doGangSucNhoLai = 1 - R(lúc này)

    Vừa ôn xong thì R gần 1, gắng sức gần 0, lợi ích gần 0: đúng hiệu ứng giãn cách. Để lâu tới
    lúc R tụt còn 0,3 thì gắng sức 0,7, gần trọn một lượt. Đây cũng là chiều mà FSRS dùng cho hệ
    số tăng độ bền của nó, chỉ khác là ở đây viết ra dạng đơn giản nhất đọc được.

    Tính chất bắt buộc phải giữ: ôn lại NGAY LẬP TỨC cho lợi ích gần bằng 0. Nhóm kiểm AO canh nó.
  */
  const nhoLucNay = conNhoSauNgay(doBenHienTai, Math.max(0, soNgayDaNghi));
  const doGangSucNhoLai = Math.max(0, Math.min(1, 1 - nhoLucNay));

  // Ôn hôm nay tức là thêm một lần nhớ lại đúng vào hôm nay, nên vừa bồi độ bền vừa đặt lại đồng
  // hồ nghỉ về 0. Cộng luôn mốc học của hôm nay để hiệu ứng giãn cách tính đúng: ôn thêm một lần
  // trong CÙNG một ngày đã học thì không được cộng thêm ngày giãn cách nào.
  const bangChungSauKhiOn: BangChungTriNho = {
    ...bangChung,
    soLanNhoLaiDung: (bangChung.soLanNhoLaiDung || 0) + doGangSucNhoLai,
    mocHocISO: [...(bangChung.mocHocISO || []), TimeService.now().toISOString()],
  };
  const doBenSauKhiOn = doBenTriNhoNgay(bangChungSauKhiOn);
  const nhoNeuOn = conNhoSauNgay(doBenSauKhiOn, Math.max(0, soNgayToiKyThi));

  // Bồi độ bền không bao giờ làm mức nhớ ngày thi TỤT, nên lợi ích âm chỉ có thể là nhiễu số học.
  return Math.max(0, nhoNeuOn - nhoNeuKhongOn);
}

/**
 * Độ bền trí nhớ cho một hồ sơ khái niệm. Gói lại việc rút bằng chứng từ hồ sơ.
 *
 * Trước đây công thức bị chép làm hai bản giống hệt nhau ở calculateRetentionScore và
 * generateForgetCurve. Hai bản chép tay như vậy chắc chắn sẽ lệch nhau khi ai đó chỉ sửa một
 * chỗ, và khi đó đường cong quên vẽ ra màn hình sẽ mâu thuẫn với điểm trí nhớ dùng để xếp
 * lịch ôn. Nay cả hai đều gọi hàm này.
 *
 * `heSoDoKho` không đọc thẳng `difficultyScore` mà pha với tiên nghiệm biên soạn tay, xem
 * `doKhoTienNghiem` ở trên.
 */
/**
 * Rút bằng chứng trí nhớ từ một hồ sơ khái niệm.
 *
 * Tách ra khỏi `memoryStrengthDays` để `loiIchOnHomNay` dùng lại được đúng bộ bằng chứng ấy. Nếu
 * để hai nơi tự dựng bằng chứng riêng thì đó là bản chép thứ hai, và dự án đã có tiền lệ hai bản
 * chép của cùng một đường cong lệch nhau 55 điểm phần trăm.
 */
export function rutBangChungTriNho(profile: ConceptMemoryProfile): BangChungTriNho {
  // Độ khó dùng để chấm: pha giữa TIÊN NGHIỆM biên soạn tay và số ĐO ĐƯỢC từ lịch sử học, theo
  // đúng công thức co của dự án `w = 1 - e^(-n/6)`. Chưa học lần nào thì w bằng 0 nên tin hoàn
  // toàn vào tiên nghiệm; học nhiều rồi thì tiên nghiệm nhường chỗ cho dữ liệu thật.
  const doKhoDoDuoc = profile.difficultyScore || 5.0;
  const tienNghiem = doKhoTienNghiem(profile.conceptName);
  const w = 1 - Math.exp(-Math.max(0, profile.timesStudied) / MOC_BANG_CHUNG_CO);
  const doKhoHieuDung = tienNghiem === null
    ? doKhoDoDuoc
    : tienNghiem * (1 - w) + doKhoDoDuoc * w;

  // Hồ sơ cũ có thể chưa tách được đúng và sai (cả hai cùng 0 trong khi đã học vài lần). Khi đó
  // coi như nhớ lại đúng hết, tức giữ nguyên hành vi trước ngày 27/07/2026, không suy diễn thêm.
  const daTachDungSai = (profile.timesCorrect || 0) + (profile.timesWrong || 0) > 0;
  const soDung = daTachDungSai ? profile.timesCorrect : Math.max(0, profile.timesStudied);
  const soSai = daTachDungSai ? profile.timesWrong : 0;

  return {
    soLanNhoLaiDung: soDung,
    soLanNhoLaiSai: soSai,
    dinhCaoDoThao: profile.historicalPeak,
    doKhoKhaiNiem: doKhoHieuDung,
    soLanPhucHoi: profile.recoveryCount,
    soLanTuiLui: profile.regressionCount,
    daVungOnDinh: profile.isStableMastered,
    mocHocISO: (profile.scoreHistory || []).map(h => h.timestamp),
    capNhoLai: rutCapNhoLai(profile.scoreHistory),
  };
}

function memoryStrengthDays(profile: ConceptMemoryProfile): number {
  return doBenTriNhoNgay(rutBangChungTriNho(profile));
}

/**
 * Độ dốc hồi quy tuyến tính bình phương tối thiểu của một dãy điểm, đơn vị: điểm mỗi lần làm.
 *
 * Vì sao cần: bản cũ đo đà học bằng hiệu hai đầu mút (điểm cuối trừ điểm đầu) và bỏ qua mọi
 * điểm ở giữa. Dãy 50, 90, 52 và dãy 50, 51, 52 đều cho ra cùng một con số là 2, dù dãy đầu
 * đang dao động dữ dội còn dãy sau tiến đều. Chỉ cần một lần trả lời may rủi ở đúng đầu hoặc
 * cuối cửa sổ là kết luận "đang tiến bộ" hay "đang tụt" bị lật ngược. Hồi quy dùng toàn bộ
 * số liệu nên bền với nhiễu hơn hẳn, và vẫn hoàn toàn tất định.
 */
function leastSquaresSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (values[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

export const conceptMemoryService = {
  /**
   * Retrieves all Concept Memory Profiles for a given subject.
   */
  getAllConceptProfiles(subjectId?: string): Record<string, ConceptMemoryProfile> {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${STORAGE_PREFIX}${sId}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      console.error("[conceptMemoryService] Error loading concept profiles:", e);
      return {};
    }
  },

  /**
   * Saves all Concept Memory Profiles for a given subject.
   */
  saveAllConceptProfiles(profiles: Record<string, ConceptMemoryProfile>, subjectId?: string): void {
    const sId = subjectId || dbService.getActiveSubjectId();
    const key = `${STORAGE_PREFIX}${sId}`;
    try {
      localStorage.setItem(key, JSON.stringify(profiles));
    } catch (e) {
      console.error("[conceptMemoryService] Error saving concept profiles:", e);
    }
  },

  /**
   * Retrieves or initializes a single ConceptMemoryProfile for a concept.
   */
  getConceptProfile(conceptName: string, subjectId?: string): ConceptMemoryProfile {
    const profiles = this.getAllConceptProfiles(subjectId);
    if (profiles[conceptName]) {
      return this.recomputeConceptDynamics(profiles[conceptName]);
    }

    // Default initialization
    const newProfile: ConceptMemoryProfile = {
      conceptId: `concept_${conceptName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      conceptName,
      currentMastery: 50,
      historicalPeak: 50,
      historicalLowest: 50,
      timesStudied: 0,
      timesCorrect: 0,
      timesWrong: 0,
      averageResponseTime: 15,
      averageConfidence: 0.5,
      confidenceTrend: "stable",
      retentionScore: 1.0,
      difficultyScore: 5.0,
      misconceptionHistory: [],
      preferredTeachingStyle: "Academic",
      preferredExplanationLength: "medium",
      estimatedForgetCurve: [
        { daysAhead: 0, retention: 1.0 },
        { daysAhead: 1, retention: 0.85 },
        { daysAhead: 3, retention: 0.70 },
        { daysAhead: 7, retention: 0.55 },
        { daysAhead: 14, retention: 0.40 },
        { daysAhead: 30, retention: 0.25 }
      ],
      learningVelocity: 0,
      recoveryCount: 0,
      regressionCount: 0,
      isStableMastered: false,
      isRegressionDetected: false,
      explanationsHistory: [],
      scoreHistory: []
    };

    return this.recomputeConceptDynamics(newProfile);
  },

  /**
   * PHASE NEXT — LEARNING DYNAMICS ENGINE v4.0
   * Recomputes all 10 temporal behavior intelligence dynamics for a concept profile:
   * 1. Learning Momentum (short, medium, long term slopes & trend)
   * 2. Learning Stability (rolling variance & consistency score)
   * 3. Recovery Efficiency (repair attempts, latency, relapse rate, recovery)
   * 4. Knowledge Fragility (evidence strength vs raw mastery)
   * 5. Knowledge Transfer Quality (cross-Bloom cognitive transfer)
   * 6. Concept Maturity Lifecycle (New -> Emerging -> Developing -> Stable -> Mature -> Automatic)
   * 7. Learning Efficiency (gain per min/q/session)
   * 8. Persistent Error Dynamics (structural misconception penalty)
   * 9. Confidence Calibration (overconfidence / underconfidence / calibrated)
   * 10. Dynamic Student Evolution parameters
   */
  recomputeConceptDynamics(profile: ConceptMemoryProfile): ConceptMemoryProfile {
    const history = profile.scoreHistory || [];
    const N = profile.timesStudied || 0;

    // 1. Đà học, đo bằng độ dốc hồi quy trên toàn cửa sổ (điểm mỗi lần làm).
    //    Cả ba mốc ngắn/vừa/dài nay cùng một đơn vị nên so sánh được với nhau, khác bản cũ
    //    trong đó đà ngắn hạn là HIỆU hai đầu mút còn đà trung hạn lại là hiệu CHIA cho số
    //    bước; so hai đại lượng khác đơn vị với nhau (dòng "shortTerm > mediumTerm + 1,5")
    //    là phép so sai bản chất, khiến nhãn "đang tăng tốc" bật lên gần như tùy tiện.
    const shortTermMomentum = Number(leastSquaresSlope(history.slice(-3).map(h => h.score)).toFixed(2));
    const mediumTermMomentum = Number(leastSquaresSlope(history.slice(-7).map(h => h.score)).toFixed(2));
    const longTermMomentum = Number(leastSquaresSlope(history.slice(-15).map(h => h.score)).toFixed(2));

    // Ngưỡng phân loại xu hướng lấy theo ĐỘ NHIỄU của chính người học, không phải hằng số cứng.
    // Bản cũ chốt cứng 1,0 và -2,0 điểm. Với người có kết quả dao động mạnh thì hai mốc đó
    // bị vượt liên tục nên hệ thống lúc nào cũng hô "tiến bộ" rồi "tụt lùi"; với người rất
    // ổn định thì không bao giờ chạm tới nên lúc nào cũng báo "đi ngang". Nay ngưỡng tỉ lệ
    // với độ lệch chuẩn gần đây, tức là "đáng kể" được hiểu theo thước đo của từng người.
    const recentScores = history.slice(-10).map(h => h.score);
    let sd = 0;
    if (recentScores.length >= 2) {
      const m = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      sd = Math.sqrt(recentScores.reduce((a, b) => a + (b - m) * (b - m), 0) / (recentScores.length - 1));
    }
    const noiseBand = Math.max(0.8, 0.35 * sd); // sàn 0,8 để dữ liệu quá ít không tạo nhãn ảo

    let momentumTrend: ConceptMemoryProfile["momentumTrend"] = "plateau";
    if (shortTermMomentum < -noiseBand) {
      momentumTrend = "regression";
    } else if (shortTermMomentum > noiseBand && shortTermMomentum > mediumTermMomentum + noiseBand) {
      momentumTrend = "accelerating";
    } else if (shortTermMomentum > noiseBand) {
      momentumTrend = "improving";
    } else {
      momentumTrend = "plateau";
    }

    // 2. Learning Stability (Rolling Variance)
    const scores = history.slice(-10).map(h => h.score);
    let variance = 0;
    if (scores.length >= 2) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (scores.length - 1);
    }
    const rollingVariance = Number(variance.toFixed(2));
    const stabilityScore = Number((100 / (100 + rollingVariance)).toFixed(2));

    // 3. Recovery Efficiency
    const misconceptions = profile.misconceptionHistory || [];
    const resolvedCount = misconceptions.filter(m => m.resolved).length;
    const totalMisconceptions = misconceptions.length;
    const averageRepairAttempts = Number((totalMisconceptions > 0 ? totalMisconceptions / Math.max(1, resolvedCount) : 1.0).toFixed(2));
    const relapseFrequency = profile.regressionCount || 0;
    const permanentRecoveryRate = totalMisconceptions > 0 ? Number((resolvedCount / totalMisconceptions).toFixed(2)) : 1.0;
    const repairLatencySeconds = Number((profile.averageResponseTime * averageRepairAttempts).toFixed(1));

    // 4. Knowledge Fragility (Evidence Strength)
    const obsWeight = 1.0 - Math.exp(-N / 6.0);
    const uniqueQuestions = new Set(history.map(h => h.questionId).filter(Boolean)).size;
    const questionVariety = Math.min(1.0, uniqueQuestions / Math.max(1, Math.min(10, N)));
    const bloomPerf = profile.bloomPerformance || {};
    const bloomDiversity = Math.min(1.0, Object.keys(bloomPerf).length / 5.0);
    const evidenceStrength = Number((0.4 * obsWeight + 0.3 * questionVariety + 0.3 * bloomDiversity).toFixed(2));
    const fragilityScore = Number(Math.max(0, 1.0 - (evidenceStrength * (profile.currentMastery / 100))).toFixed(2));

    // 5. Chất lượng chuyển giao kiến thức giữa các nấc Bloom.
    //
    // LỖI CỦA BẢN CŨ: công thức là min(1, higherAcc / max(1, lowerAcc)). Nhưng lowerAcc là tỷ
    // lệ đúng nên luôn nằm trong [0, 1], khiến max(1, lowerAcc) LUÔN BẰNG 1. Phép chia bị vô
    // hiệu, và chỉ số "chuyển giao" thực chất chỉ còn là độ chính xác ở nấc cao, không hề so
    // với nấc thấp như tên gọi và như ý đồ thiết kế. Người học đúng 90% ở nấc nhớ mà chỉ 60%
    // ở nấc vận dụng (chuyển giao KÉM) lại được chấm 0,60, ngang với người đúng 60% ở cả hai
    // nấc (chuyển giao TỐT). Hai tình huống sư phạm trái ngược nhau bị gộp thành một điểm số.
    //
    // BẢN MỚI: gộp theo tổng số lượt thay vì trung bình cộng các tỷ lệ, để một nấc chỉ làm 1
    // câu không nặng ngang nấc đã làm 20 câu. Sau đó lấy tỷ số có làm trơn Laplace và quy về
    // [0, 1] quanh mốc 1,0 (giữ nguyên phong độ khi lên nấc cao = 0,5 điểm chuyển giao).
    const sumBloom = (keys: string[]) => keys.reduce(
      (acc, k) => ({
        attempts: acc.attempts + (bloomPerf[k]?.attempts || 0),
        correct: acc.correct + (bloomPerf[k]?.correct || 0)
      }),
      { attempts: 0, correct: 0 }
    );
    const low = sumBloom(["Remember", "Understand"]);
    const high = sumBloom(["Apply", "Analyze", "Evaluate", "Create"]);

    let transferQualityScore: number;
    if (low.attempts > 0 && high.attempts > 0) {
      // Làm trơn Laplace: cộng 1 thành công và 2 lượt vào mỗi bên, tránh chia cho 0 và tránh
      // kết luận cực đoan khi mới chỉ có một vài quan sát.
      const lowAcc = (low.correct + 1) / (low.attempts + 2);
      const highAcc = (high.correct + 1) / (high.attempts + 2);
      const ratio = highAcc / lowAcc; // > 1: lên nấc cao vẫn vững; < 1: tụt khi phải vận dụng
      transferQualityScore = Number(Math.max(0, Math.min(1, ratio / 2)).toFixed(2));
    } else {
      // Chưa đủ bằng chứng ở cả hai phía thì giữ mốc trung tính, không suy đoán.
      transferQualityScore = N >= 3 ? 0.5 : 0.5;
    }

    // 6. Concept Maturity Lifecycle
    let maturityStage: ConceptMemoryProfile["maturityStage"] = "New";
    if (N <= 1) {
      maturityStage = "New";
    } else if (N <= 3 || profile.currentMastery < 60) {
      maturityStage = "Emerging";
    } else if (profile.currentMastery < 75 || stabilityScore < 0.60) {
      maturityStage = "Developing";
    } else if (profile.currentMastery >= 90 && (profile.retentionScore || 1) >= 0.90 && fragilityScore <= 0.20 && transferQualityScore >= 0.80 && profile.averageResponseTime <= 12 && N >= 10) {
      maturityStage = "Automatic";
    } else if (profile.currentMastery >= 85 && (profile.retentionScore || 1) >= 0.80 && fragilityScore <= 0.35 && transferQualityScore >= 0.60 && N >= 6) {
      maturityStage = "Mature";
    } else {
      maturityStage = "Stable";
    }

    // 7. Learning Efficiency
    const totalGain = Math.max(0, profile.currentMastery - profile.historicalLowest);
    const learningGainPerQuestion = Number((totalGain / Math.max(1, N)).toFixed(2));
    const learningGainPerMinute = Number((totalGain / Math.max(1, (N * profile.averageResponseTime) / 60)).toFixed(2));
    const learningGainPerSession = Number((totalGain / Math.max(1, profile.recoveryCount + 1)).toFixed(2));
    const efficiencyScore = Number(Math.min(10, Math.max(0.5, learningGainPerQuestion * 0.6 + learningGainPerMinute * 0.4)).toFixed(2));

    // 8. Persistent Error Dynamics
    const unresolvedCount = misconceptions.filter(m => !m.resolved).length;
    const persistentErrorPenalty = Number((1.0 + 0.4 * unresolvedCount + 0.5 * relapseFrequency).toFixed(2));

    // 9. Confidence Calibration
    //
    // Chỉ được kết luận khi có TÍN HIỆU TỰ KHAI thật. Người học không bấm nút cờ nghi vấn lần
    // nào thì `averageConfidence` bằng 0,5 trung lập, và đem 0,5 đó so với tỷ lệ đúng 0,9 sẽ ra
    // chênh lệch -0,4, tức bị dán nhãn "thiếu tự tin" cho một người chưa hề nói gì về mức chắc
    // chắn của mình. Đó vẫn là bịa, chỉ đổi chiều. Đo được trước khi chặn: hồ sơ đúng 90% không
    // gắn cờ cho **13/15 khái niệm mang nhãn underconfident**.
    const soTinHieuTuTin = profile.confidenceSignalCount || 0;
    const objectiveAccuracy = N > 0 ? profile.timesCorrect / N : 0.5;
    const diff = profile.averageConfidence - objectiveAccuracy;
    let calibrationState: ConceptMemoryProfile["calibrationState"];
    if (soTinHieuTuTin < TOI_THIEU_TIN_HIEU_TU_TIN) calibrationState = "chua-du-du-lieu";
    else if (diff > 0.20) calibrationState = "overconfident";
    else if (diff < -0.20) calibrationState = "underconfident";
    else calibrationState = "calibrated";
    const calibrationScore = soTinHieuTuTin < TOI_THIEU_TIN_HIEU_TU_TIN
      ? 0
      : Number((1.0 - Math.min(1.0, Math.abs(diff))).toFixed(2));

    return {
      ...profile,
      shortTermMomentum,
      mediumTermMomentum,
      longTermMomentum,
      momentumTrend,
      rollingVariance,
      stabilityScore,
      averageRepairAttempts,
      repairLatencySeconds,
      relapseFrequency,
      permanentRecoveryRate,
      evidenceStrength,
      fragilityScore,
      bloomPerformance: bloomPerf,
      transferQualityScore,
      maturityStage,
      learningGainPerMinute,
      learningGainPerQuestion,
      learningGainPerSession,
      efficiencyScore,
      persistentErrorPenalty,
      calibrationState,
      calibrationScore,
      scoreHistory: history
    };
  },

  /**
   * Calculates forgetting curve & retention score based on time elapsed since last review.
   * Context-Aware Memory Decay v3.0:
   * S = S_base * recoveryFactor * regressionPenalty * difficultyFactor * stableBonus
   * Re-recovered concepts decay slower; repeatedly forgotten concepts decay faster.
   */
  calculateRetentionScore(profile: ConceptMemoryProfile): number {
    if (!profile.lastReviewAt) return 1.0;
    const now = TimeService.now();
    const last = new Date(profile.lastReviewAt);
    const diffMs = now.getTime() - last.getTime();
    const daysElapsed = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

    // Dùng chung công thức độ bền trí nhớ VÀ chung một mức sàn, không chép lại (xem
    // memoryStrengthDays và conNhoSauNgay ở đầu file).
    return Number(conNhoSauNgay(memoryStrengthDays(profile), daysElapsed).toFixed(2));
  },

  /**
   * Bayesian-like Confidence Accumulation (without black-box Bayesian inference).
   * Distinguishes high-confidence 80% (50 observations) from low-confidence 80% (3 observations).
   * w = 1 - e^(-N / 8)
   */
  calculateBayesianMastery(profile: ConceptMemoryProfile): {
    effectiveMastery: number;
    observationConfidence: number; // 0 - 100%
    observationCount: number;
  } {
    const N = profile.timesStudied || 0;
    const confidenceWeight = 1.0 - Math.exp(-N / 8.0); // Smooth non-linear saturation
    const prior = 50.0; // Neutral prior
    const effectiveMastery = Math.round((confidenceWeight * profile.currentMastery) + ((1.0 - confidenceWeight) * prior));

    return {
      effectiveMastery,
      observationConfidence: Math.round(confidenceWeight * 100),
      observationCount: N
    };
  },

  /**
   * Generates projected future forgetting curve points for visualization.
   */
  generateForgetCurve(profile: ConceptMemoryProfile): Array<{ daysAhead: number; retention: number }> {
    // Dùng chung đúng công thức với calculateRetentionScore, nên đường cong vẽ ra màn hình
    // luôn khớp với điểm trí nhớ dùng để xếp lịch ôn tập.
    const memoryStrength = memoryStrengthDays(profile);
    const days = [0, 1, 3, 7, 14, 30];
    return days.map(d => ({
      daysAhead: d,
      retention: Number(conNhoSauNgay(memoryStrength, d).toFixed(2))
    }));
  },

  /**
   * Records a teaching explanation history attempt for teaching memory rotation.
   * Ensures AI does not repeat verbatim explanations if previous ones failed.
   */
  recordExplanation(
    conceptName: string,
    strategy: string,
    length: string,
    wasSuccessful: boolean,
    subjectId?: string
  ): void {
    const profiles = this.getAllConceptProfiles(subjectId);
    const profile = profiles[conceptName] || this.getConceptProfile(conceptName, subjectId);

    const now = TimeService.now().toISOString();
    profile.explanationsHistory.unshift({
      timestamp: now,
      strategy,
      length,
      wasSuccessful
    });

    // Keep history compact (max 20)
    if (profile.explanationsHistory.length > 20) {
      profile.explanationsHistory = profile.explanationsHistory.slice(0, 20);
    }

    // Auto-update preferred teaching style if a strategy works well
    if (wasSuccessful) {
      profile.preferredTeachingStyle = strategy as any;
    }

    profiles[conceptName] = profile;
    this.saveAllConceptProfiles(profiles, subjectId);
  },

  /**
   * Rotates teaching strategy if previous attempts with current strategy failed.
   */
  getRotatedTeachingStrategy(conceptName: string, defaultStrategy: string, subjectId?: string): string {
    const profile = this.getConceptProfile(conceptName, subjectId);
    const history = profile.explanationsHistory;

    if (history.length === 0) return defaultStrategy;

    // Check last 2 attempts for this concept
    const recentFailed = history.slice(0, 2).filter(h => !h.wasSuccessful);
    if (recentFailed.length >= 2) {
      const styles: Array<"Academic" | "Business" | "Analogy" | "Socratic" | "Real-world" | "Simple"> = [
        "Academic", "Business", "Analogy", "Socratic", "Real-world", "Simple"
      ];
      const usedStyles = new Set(recentFailed.map(r => r.strategy));
      const unused = styles.find(s => !usedStyles.has(s));
      return unused || "Analogy";
    }

    return profile.preferredTeachingStyle || defaultStrategy;
  }
};

// Dọn kho hồ sơ trí nhớ dài hạn khi người học xóa tiến trình.
dangKyDonDuLieuSuyRa("conceptMemory", (subjectId) => {
  localStorage.removeItem(`${STORAGE_PREFIX}${subjectId}`);
});
