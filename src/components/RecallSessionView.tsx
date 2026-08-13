/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, X, AlertTriangle, Info } from "lucide-react";
import { ExamAttempt, RecallAttempt, RecallPrompt } from "../types";
import { layCauHoiNhoLaiTheoKhaiNiem, chamCauTraLoi, DO_DAI_TOI_THIEU } from "../services/recallService";
import { learnerModelService } from "../services/learnerModel";
import { kbService } from "../services/kbService";
import { dbService } from "../services/db";
import { TimeService } from "../services/time";

/*
  NHỚ LẠI CHỦ ĐỘNG, màn hình.

  THỨ TỰ TRÊN MÀN LÀ MẤU CHỐT, không phải chi tiết trang trí:
    1. câu hỏi mở và ô nhập
    2. người học gõ, bấm nộp
    3. kết quả chấm: đạt hay chưa, ý đã nêu, ý còn thiếu, bẫy hiểu sai
    4. CUỐI CÙNG mới hiện định nghĩa chuẩn từ nút tri thức

  Hiện định nghĩa chuẩn trước khi chấm là phá hỏng toàn bộ giá trị của nhớ lại: người học đọc xong
  sẽ thấy quen, tưởng mình nhớ, và cái họ luyện được chỉ còn là đọc hiểu. Vì vậy `expectedPoints`
  và định nghĩa chuẩn KHÔNG được nằm trong phần dựng màn của giai đoạn chưa nộp, dù có ẩn bằng CSS.
  Phép kiểm AO1 canh đúng điều này ở mức nguồn.

  Đặt thành component riêng thay vì nhồi vào `PracticeView` (1.626 dòng). Trần tự đặt: 600 dòng.
*/

interface RecallSessionProps {
  key?: any;
  /** Tên khái niệm cần ôn, theo đúng thứ tự hàng đợi đã xếp. Rỗng thì tự lấy hàng đợi hôm nay. */
  tenKhaiNiem?: string[];
  onNavigateHome: () => void;
}

type TrangThai = "dang-go" | "dang-cham" | "da-cham";

export default function RecallSessionView({ tenKhaiNiem, onNavigateHome }: RecallSessionProps) {
  const danhSachCauHoi: RecallPrompt[] = useMemo(() => {
    const ten = tenKhaiNiem && tenKhaiNiem.length > 0
      ? tenKhaiNiem
      : learnerModelService.layKhaiNiemToiHan().danhSach.map(m => m.tenKhaiNiem);
    return layCauHoiNhoLaiTheoKhaiNiem(ten);
  }, [tenKhaiNiem]);

  const [viTri, setViTri] = useState<number>(0);
  const [baiViet, setBaiViet] = useState<string>("");
  const [trangThai, setTrangThai] = useState<TrangThai>("dang-go");
  const [ketQua, setKetQua] = useState<RecallAttempt | null>(null);
  const [daLam, setDaLam] = useState<RecallAttempt[]>([]);
  const [khongDongY, setKhongDongY] = useState<boolean>(false);

  const mocBatDauRef = useRef<number>(Date.now());
  const batDauPhienRef = useRef<string>(TimeService.now().toISOString());

  const cauHoi = danhSachCauHoi[viTri];
  const con = danhSachCauHoi.length - viTri;

  // Mỗi câu bắt đầu lại đồng hồ riêng. Không dùng cổng tab ẩn như màn trắc nghiệm vì ở đây người
  // học đang GÕ, và một lần chuyển tab để tra cứu chính là hành vi cần biết chứ không phải nhiễu.
  useEffect(() => {
    mocBatDauRef.current = Date.now();
    setBaiViet("");
    setKetQua(null);
    setKhongDongY(false);
    setTrangThai("dang-go");
  }, [viTri]);

  /** Nút tri thức của câu đang làm, CHỈ đọc sau khi đã chấm. */
  const nutTriThuc = useMemo(() => {
    if (!cauHoi || trangThai !== "da-cham") return null;
    const doThi = kbService.getKnowledgeGraph(dbService.getActiveSubjectId());
    return doThi.find(n => n.concept === cauHoi.conceptName) || null;
  }, [cauHoi, trangThai]);

  const nopBai = async () => {
    if (!cauHoi || trangThai !== "dang-go") return;
    setTrangThai("dang-cham");
    const giay = (Date.now() - mocBatDauRef.current) / 1000;
    const kq = await chamCauTraLoi(cauHoi, baiViet, giay);
    setKetQua(kq);
    setTrangThai("da-cham");
  };

  /*
    Ghi vào tầng trí nhớ qua ĐÚNG cây cầu duy nhất `dbService.saveAttempt` với `isSubmitted: true`,
    thứ kích hoạt `addOnSubmit` (bất biến 4.9e). Không mở kho riêng, không gọi thẳng
    `conceptMemoryService`.

    Lượt người học bấm "tôi không đồng ý với cách chấm" bị LOẠI khỏi bản ghi. Nếu vẫn ghi thì một
    lần AI chấm sai sẽ đẩy đường cong quên của một khái niệm đi sai hướng, mà người học đã nói
    thẳng là nó sai. Đây là chốt chặn cuối, sau `duDuLieu`.
  */
  const ketThucPhien = (danhSach: RecallAttempt[]) => {
    const dungDuoc = danhSach.filter(r => r.duDuLieu);
    const tongGiay = danhSach.reduce((s, r) => s + (r.thoiGianGiay || 0), 0);
    const banGhi: ExamAttempt = {
      id: `recall_${Date.now()}`,
      examType: "recall",
      startTime: batDauPhienRef.current,
      endTime: TimeService.now().toISOString(),
      questions: [],
      answers: {},
      bookmarks: [],
      flags: [],
      isSubmitted: true,
      score: dungDuoc.filter(r => r.passed).length,
      timeSpent: Math.round(tongGiay),
      recallAttempts: danhSach,
    };
    dbService.saveAttempt(banGhi);
    onNavigateHome();
  };

  const sangCauSau = () => {
    if (!ketQua) return;
    // Không đồng ý với cách chấm thì giữ nguyên văn bài viết nhưng hạ cờ `duDuLieu`, để nó không
    // chảy vào tầng trí nhớ mà vẫn còn dấu vết để về sau đối chiếu được cách chấm.
    const ghiLai: RecallAttempt = khongDongY
      ? { ...ketQua, duDuLieu: false, lyDoChuaCham: "Người học không đồng ý với cách chấm, đã loại khỏi bằng chứng trí nhớ." }
      : ketQua;
    const moi = [...daLam, ghiLai];
    setDaLam(moi);
    if (viTri + 1 >= danhSachCauHoi.length) {
      ketThucPhien(moi);
      return;
    }
    setViTri(viTri + 1);
  };

  if (danhSachCauHoi.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <button onClick={onNavigateHome} className="text-sm text-text-secondary hover:text-text-primary flex items-center gap-1.5 cursor-pointer">
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Quay lại Bàn học</span>
        </button>
        <h1 className="text-xl font-bold text-text-primary font-sans">Chưa có khái niệm nào để viết lại</h1>
        <p className="text-sm text-text-secondary leading-relaxed max-w-[42rem]">
          Chế độ này hỏi thẳng vào đồ thị tri thức của môn, nên nó cần khái niệm đã tới hạn ôn và
          khái niệm đó phải có nội dung do người soạn viết tay. Làm vài đề trắc nghiệm trước để hệ
          thống có căn cứ xếp lịch, rồi quay lại đây.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button onClick={onNavigateHome} className="text-sm text-text-secondary hover:text-text-primary flex items-center gap-1.5 cursor-pointer">
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Quay lại Bàn học</span>
        </button>
        <span className="text-xs text-text-muted tabular-nums">
          Khái niệm {viTri + 1} trên {danhSachCauHoi.length}
        </span>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-semibold text-text-muted">Nhớ lại chủ động</span>
        <h1 className="text-xl font-bold text-text-primary font-sans">{cauHoi.conceptName}</h1>
        <p className="text-sm text-text-secondary leading-relaxed max-w-[42rem] pt-0.5">
          {cauHoi.prompt}
        </p>
      </div>

      {/*
        GIAI ĐOẠN CHƯA NỘP. Trong nhánh này tuyệt đối không có `expectedPoints`, không có định
        nghĩa chuẩn, không có gợi ý nội dung. Chỉ có câu hỏi và ô trống.
      */}
      {trangThai !== "da-cham" && (
        <div className="space-y-3">
          <textarea
            value={baiViet}
            onChange={e => setBaiViet(e.target.value)}
            disabled={trangThai === "dang-cham"}
            rows={9}
            placeholder="Viết ra những gì bạn nhớ được. Chưa đầy đủ cũng viết, phần thiếu chính là thứ cần biết."
            className="w-full bg-bg-surface border border-border-primary rounded p-3.5 text-sm text-text-primary leading-relaxed placeholder:text-text-muted focus:outline-none focus:border-brand-info resize-y"
          />
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-text-muted tabular-nums">
              {baiViet.trim().length} ký tự
              {baiViet.trim().length < DO_DAI_TOI_THIEU && ", cần ít nhất " + DO_DAI_TOI_THIEU}
            </span>
            <button
              onClick={nopBai}
              disabled={trangThai === "dang-cham" || baiViet.trim().length < DO_DAI_TOI_THIEU}
              className="px-4 h-9 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot disabled:opacity-40 disabled:cursor-not-allowed text-sm rounded transition cursor-pointer"
            >
              {trangThai === "dang-cham" ? "Đang chấm" : "Nộp bài viết"}
            </button>
          </div>

          {/* Trạng thái chờ dùng lại khuôn skeleton ba thanh của màn làm bài, không phát minh dạng thứ tư. */}
          {trangThai === "dang-cham" && (
            <div className="space-y-2.5 py-4 border-t border-border-primary/60 animate-pulse">
              <div className="h-3 bg-bg-surface rounded w-3/4" />
              <div className="h-3 bg-bg-surface rounded w-full" />
              <div className="h-3 bg-bg-surface rounded w-2/3" />
            </div>
          )}
        </div>
      )}

      {trangThai === "da-cham" && ketQua && (
        <div className="space-y-6">
          {/* Bài viết của chính người học, để đối chiếu với phần chấm ngay bên dưới. */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-text-muted">Bạn đã viết</span>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap border-l-2 border-border-primary pl-3">
              {ketQua.answerText}
            </p>
          </div>

          {!ketQua.duDuLieu ? (
            /*
              CHƯA CHẤM ĐƯỢC, khác hẳn CHẤM RA CHƯA ĐẠT. Không hiện điểm, không hiện ý thiếu, không
              hiện định nghĩa chuẩn: chưa chấm được thì cũng chưa biết người học thiếu gì, mà lộ
              định nghĩa lúc này là đốt luôn cơ hội thử lại.
            */
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-brand-info shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-text-primary font-sans">Chưa chấm được</h2>
                  <p className="text-sm text-text-secondary leading-relaxed max-w-[42rem]">
                    {ketQua.lyDoChuaCham} Lượt này không được ghi vào hồ sơ trí nhớ, vì chưa chấm được
                    không có nghĩa là bạn không nhớ.
                  </p>
                </div>
              </div>
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={() => { setKetQua(null); setTrangThai("dang-go"); }}
                  className="px-4 h-9 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot text-sm rounded transition cursor-pointer"
                >
                  Chấm lại
                </button>
                <button
                  onClick={sangCauSau}
                  className="px-4 h-9 bg-bg-card border border-border-primary hover:border-text-muted text-text-primary text-sm rounded transition cursor-pointer"
                >
                  {con <= 1 ? "Kết thúc phiên" : "Bỏ qua, sang khái niệm sau"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                {ketQua.passed
                  ? <Check className="w-5 h-5 text-brand-success shrink-0 mt-0.5" />
                  : <X className="w-5 h-5 text-brand-error shrink-0 mt-0.5" />}
                <h2 className="text-base font-bold text-text-primary font-sans">
                  {ketQua.passed
                    ? `Đạt, nêu được ${ketQua.hitPoints.length} trên ${ketQua.hitPoints.length + ketQua.missingPoints.length} ý`
                    : `Chưa đạt, nêu được ${ketQua.hitPoints.length} trên ${ketQua.hitPoints.length + ketQua.missingPoints.length} ý`}
                </h2>
              </div>

              {ketQua.misconceptionHit && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-brand-warning shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <span className="text-sm font-semibold text-text-primary block">Bạn đang rơi vào một hiểu sai đã được ghi trước</span>
                    <p className="text-sm text-text-secondary leading-relaxed max-w-[42rem]">
                      {cauHoi.misconceptionToWatch}
                    </p>
                  </div>
                </div>
              )}

              {/* Hàng chứ không phải thẻ, đúng khuôn trình bày 4.9g. */}
              {ketQua.hitPoints.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-text-muted">Bạn đã nêu được</span>
                  <div className="grid grid-cols-1 divide-y divide-border-primary/70 border-y border-border-primary/70">
                    {ketQua.hitPoints.map((y, i) => (
                      <div key={i} className="py-2.5 flex items-start gap-2">
                        <Check className="w-4 h-4 text-brand-success shrink-0 mt-0.5" />
                        <span className="text-sm text-text-secondary leading-relaxed">{y}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ketQua.missingPoints.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-text-muted">Còn thiếu</span>
                  <div className="grid grid-cols-1 divide-y divide-border-primary/70 border-y border-border-primary/70">
                    {ketQua.missingPoints.map((y, i) => (
                      <div key={i} className="py-2.5 flex items-start gap-2">
                        <X className="w-4 h-4 text-brand-error shrink-0 mt-0.5" />
                        <span className="text-sm text-text-secondary leading-relaxed">{y}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CUỐI CÙNG mới tới định nghĩa chuẩn. */}
              {nutTriThuc && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-text-muted">Định nghĩa chuẩn theo tài liệu</span>
                  <p className="text-sm text-text-secondary leading-relaxed max-w-[42rem]">{nutTriThuc.definition}</p>
                  {nutTriThuc.teaching?.memoryHook && (
                    <p className="text-sm text-text-secondary leading-relaxed pt-1">
                      Mẹo nhớ: {nutTriThuc.teaching.memoryHook}
                    </p>
                  )}
                  <p className="text-xs text-text-muted pt-1">Nguồn: {cauHoi.sourceEvidence}</p>
                </div>
              )}

              <div className="pt-1 space-y-3 border-t border-border-primary/70">
                <label className="flex items-start gap-2 pt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={khongDongY}
                    onChange={e => setKhongDongY(e.target.checked)}
                    className="mt-0.5 cursor-pointer"
                  />
                  <span className="text-sm text-text-secondary leading-relaxed">
                    Tôi không đồng ý với cách chấm này. Đừng ghi nó vào hồ sơ trí nhớ của tôi.
                  </span>
                </label>
                <button
                  onClick={sangCauSau}
                  className="px-4 h-9 bg-nut-chinh text-white hover:bg-nut-chinh-re-chuot text-sm rounded transition cursor-pointer"
                >
                  {con <= 1 ? "Kết thúc phiên" : `Khái niệm tiếp theo, còn ${con - 1}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
