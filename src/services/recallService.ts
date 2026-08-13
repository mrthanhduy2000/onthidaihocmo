/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RecallPrompt, RecallAttempt } from "../types";
import { KnowledgeNode } from "../data/customer_behavior_kb";
import { kbService } from "./kbService";
import { dbService } from "./db";
import { goiCongAI } from "./ai";
import { TimeService } from "./time";

/*
  NHỚ LẠI CHỦ ĐỘNG, tầng dịch vụ.

  VÌ SAO CÓ CHẾ ĐỘ NÀY. Chọn một trong bốn phương án là dạng luyện trí nhớ YẾU NHẤT: người học chỉ
  cần NHẬN RA đáp án đúng khi nhìn thấy nó, và ba phương án nhiễu luôn thu hẹp không gian tìm kiếm
  giúp. Viết ra câu trả lời từ đầu óc trống là dạng MẠNH NHẤT, vì nó bắt đúng thao tác mà phòng thi
  sẽ đòi.

  ĐÂY CŨNG LÀ CHỖ SẢN PHẨM NÀY VƯỢT ĐƯỢC ANKI, chứ không phải ở thuật toán xếp lịch. Anki hỏi người
  học "bạn tự thấy nhớ tới mức nào" rồi tin câu trả lời ấy: bốn nút Again / Hard / Good / Easy đều
  do chính người học tự chấm mình. Vấn đề là người học không đánh giá được mình, và sai lệch luôn
  nghiêng về phía lạc quan (đọc xong đáp án thấy quen nên bấm Good, trong khi tự viết ra thì không
  viết nổi). Ở đây bài chấm đọc CHÍNH CÂU CHỮ người học viết ra, đối chiếu với các ý bắt buộc lấy
  từ nút tri thức biên soạn tay, nên bằng chứng đưa vào đường cong quên là bằng chứng đo được chứ
  không phải lời tự khai.

  MỘT LƯỢT GỌI AI CHO MỘT KHÁI NIỆM, không hơn. Câu hỏi mở được dựng TẤT ĐỊNH ngay trong trình
  duyệt từ nút tri thức, không tốn lượt gọi nào: nút đã có định nghĩa, ý chi tiết, bẫy hiểu sai và
  mẹo nhớ do người soạn viết tay. Nhờ AI viết lại câu hỏi chỉ đổi một bản gốc chắc chắn lấy một bản
  bấp bênh, lại làm câu hỏi nhảy múa mỗi lần mở màn hình.
*/

/** Số ý tối đa đưa vào thước chấm. Nhiều hơn thì một câu trả lời ngắn luôn bị chấm là thiếu. */
const SO_Y_TOI_DA = 4;

/**
 * Tách một đoạn văn xuôi thành các ý rời.
 *
 * Nút tri thức viết ở dạng đoạn văn chứ không phải danh sách gạch đầu dòng, nên phải cắt. Cắt theo
 * dấu chấm câu, bỏ mẩu quá ngắn (dưới 12 ký tự thường là phần đuôi của một câu bị cắt nhầm chứ
 * không phải một ý).
 */
function tachY(doanVan: string): string[] {
  return String(doanVan || "")
    .split(/(?<=[.;])\s+/)
    .map(s => s.trim().replace(/[.;]$/, "").trim())
    .filter(s => s.length >= 12);
}

/**
 * Dựng câu hỏi mở từ một nút tri thức. Tất định: cùng một nút luôn cho cùng một câu hỏi.
 *
 * Câu hỏi bám vào `type` của nút vì hỏi "hãy trình bày" cho một nút phân loại và cho một nút quy
 * trình là hai đòi hỏi khác nhau, và người học cần biết mình đang được đòi cái gì.
 */
export function taoCauHoiNhoLai(node: KnowledgeNode): RecallPrompt {
  const ten = node.concept;
  const cauHoiTheoLoai: Record<string, string> = {
    Definition: `Không nhìn tài liệu, hãy viết ra định nghĩa của "${ten}" bằng lời của bạn, và nêu các thành phần cấu thành nó.`,
    Process: `Không nhìn tài liệu, hãy mô tả các bước của "${ten}" theo đúng thứ tự, và nói rõ mỗi bước làm gì.`,
    Model: `Không nhìn tài liệu, hãy trình bày mô hình "${ten}": nó gồm những thành phần nào và các thành phần đó liên hệ với nhau ra sao.`,
    Classification: `Không nhìn tài liệu, hãy liệt kê các loại trong "${ten}" và nêu điểm phân biệt giữa chúng.`,
    Comparison: `Không nhìn tài liệu, hãy nêu các điểm khác nhau cốt lõi trong "${ten}".`,
    Rule: `Không nhìn tài liệu, hãy phát biểu quy tắc "${ten}" và nói rõ nó áp dụng trong trường hợp nào.`,
    Exception: `Không nhìn tài liệu, hãy nêu "${ten}" là ngoại lệ của điều gì và vì sao nó là ngoại lệ.`,
  };

  // Thước chấm ghép từ định nghĩa và phần ý chi tiết, vì định nghĩa một mình thường chỉ cho một ý.
  const y = [...tachY(node.definition), ...tachY(node.details || "")].slice(0, SO_Y_TOI_DA);

  return {
    conceptName: ten,
    prompt: cauHoiTheoLoai[node.type] || cauHoiTheoLoai.Definition,
    expectedPoints: y,
    sourceEvidence: node.page ? `${node.source}, ${node.page}` : node.source,
    misconceptionToWatch: node.teaching?.misconception || node.commonMistakes || "",
  };
}

/**
 * Lấy các câu hỏi nhớ lại cho một danh sách tên khái niệm, theo đúng thứ tự truyền vào.
 *
 * Bỏ qua khái niệm không tra được nút, và bỏ qua NÚT TỔNG HỢP: nút sinh tự động có đủ trường chữ
 * nhưng toàn bộ là chuỗi mẫu ghép tên khái niệm vào, nên chấm bài dựa vào nó là chấm theo một
 * thước không có nội dung. Đây chính là ranh giới `laNutTongHop` đã chốt: xếp lịch ôn thì dùng
 * được, làm bằng chứng học thuật thì không.
 */
export function layCauHoiNhoLaiTheoKhaiNiem(tenKhaiNiem: string[]): RecallPrompt[] {
  const subjectId = dbService.getActiveSubjectId();
  const doThi = kbService.getKnowledgeGraph(subjectId);
  const ra: RecallPrompt[] = [];
  tenKhaiNiem.forEach(ten => {
    const node = doThi.find(n => n.concept === ten);
    if (!node || node.laNutTongHop) return;
    const cauHoi = taoCauHoiNhoLai(node);
    // Nút không rút được ý nào thì không có thước để chấm, đừng hỏi rồi chấm bừa.
    if (cauHoi.expectedPoints.length === 0) return;
    ra.push(cauHoi);
  });
  return ra;
}

/** Dạng đầu ra ràng buộc cho Gemini. Không có trường nào để tùy chọn. */
const DANG_KET_QUA_CHAM = {
  type: "object",
  properties: {
    yDaNeuDuoc: { type: "array", items: { type: "string" } },
    yConThieu: { type: "array", items: { type: "string" } },
    roiVaoBayHieuSai: { type: "boolean" },
    dat: { type: "boolean" },
  },
  required: ["yDaNeuDuoc", "yConThieu", "roiVaoBayHieuSai", "dat"],
};

/**
 * Kiểm tra NGHIÊM NGẶT thứ mô hình trả về.
 *
 * VÌ SAO KHÔNG DÙNG `outputValidationService` như bản kế hoạch ghi: hàm đó TỰ ĐIỀN giá trị bịa khi
 * thiếu trường (`"Khái niệm X theo giáo trình chuẩn."`, `"Ví dụ thực tế về X..."`). Nó được viết
 * cho phần giải thích câu hỏi, nơi một câu chữ chung chung còn đỡ hơn màn hình trống. Ở đây thì
 * ngược hẳn: điền bừa nghĩa là người học nhận một kết quả chấm trông như thật trong khi mô hình
 * chưa hề chấm. Thà nói "chưa chấm được".
 *
 * Trả về `null` khi không dùng được, kèm lý do.
 */
export function docKetQuaCham(raw: string): { dat: boolean; hit: string[]; thieu: string[]; bay: boolean } | null {
  let parsed: any = null;
  try {
    parsed = JSON.parse(String(raw).replace(/```json/g, "").replace(/```/g, "").trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (typeof parsed.dat !== "boolean") return null;
  if (typeof parsed.roiVaoBayHieuSai !== "boolean") return null;
  if (!Array.isArray(parsed.yDaNeuDuoc) || !Array.isArray(parsed.yConThieu)) return null;
  const chuoiSach = (m: any[]) => m.filter(x => typeof x === "string" && x.trim().length > 0).map(x => x.trim());
  return {
    dat: parsed.dat,
    hit: chuoiSach(parsed.yDaNeuDuoc),
    thieu: chuoiSach(parsed.yConThieu),
    bay: parsed.roiVaoBayHieuSai,
  };
}

/** Số ký tự tối thiểu để coi là một câu trả lời chứ không phải một cú bấm cho xong. */
export const DO_DAI_TOI_THIEU = 15;

/**
 * Chấm một câu trả lời nhớ lại.
 *
 * KHÔNG BAO GIỜ dựng điểm giả. Mọi đường thất bại đều trả `duDuLieu: false` kèm lý do đọc được.
 */
export async function chamCauTraLoi(
  cauHoi: RecallPrompt,
  answerText: string,
  thoiGianGiay: number
): Promise<RecallAttempt> {
  const khung: RecallAttempt = {
    conceptName: cauHoi.conceptName,
    answerText,
    gradedAt: TimeService.now().toISOString(),
    passed: null,
    hitPoints: [],
    missingPoints: [],
    misconceptionHit: null,
    duDuLieu: false,
    lyDoChuaCham: "",
    thoiGianGiay: Math.max(0, Math.round(thoiGianGiay)),
  };

  const daGo = String(answerText || "").trim();
  if (daGo.length < DO_DAI_TOI_THIEU) {
    return { ...khung, lyDoChuaCham: "Câu trả lời quá ngắn để chấm. Hãy viết ra những gì bạn nhớ được, dù chưa đầy đủ." };
  }

  const lyDoNhac = cauHoi.misconceptionToWatch
    ? `\n\nBẪY HIỂU SAI CẦN CANH (do người soạn ghi sẵn cho khái niệm này):\n${cauHoi.misconceptionToWatch}`
    : "\n\nKhái niệm này không có bẫy hiểu sai ghi sẵn. Luôn trả `roiVaoBayHieuSai` là false.";

  const loiNhac = `Bạn đang chấm một bài NHỚ LẠI CHỦ ĐỘNG của sinh viên môn "${dbService.getActiveSubjectName()}".

KHÁI NIỆM: ${cauHoi.conceptName}

CÁC Ý BẮT BUỘC (thước chấm, trích từ tài liệu ${cauHoi.sourceEvidence}):
${cauHoi.expectedPoints.map((y, i) => `${i + 1}. ${y}`).join("\n")}
${lyDoNhac}

CÂU TRẢ LỜI CỦA SINH VIÊN, nguyên văn:
"""
${daGo}
"""

YÊU CẦU CHẤM:
1. Với TỪNG ý bắt buộc ở trên, xét xem sinh viên có nêu được ý đó không. Nêu bằng lời khác mà đúng bản chất thì TÍNH LÀ ĐƯỢC. Chỉ chép lại từ khóa mà không thể hiện hiểu thì KHÔNG tính.
2. Đưa các ý nêu được vào \`yDaNeuDuoc\`, các ý còn thiếu vào \`yConThieu\`. Chép NGUYÊN VĂN ý bắt buộc, đừng viết lại.
3. \`roiVaoBayHieuSai\` là true chỉ khi câu trả lời thể hiện đúng cái hiểu sai đã nêu ở trên, không phải khi nó chỉ thiếu ý.
4. \`dat\` là true khi sinh viên nêu được từ một nửa số ý trở lên VÀ không rơi vào bẫy hiểu sai.
5. Chấm theo đúng những gì sinh viên VIẾT RA, không suy diễn giúp họ phần họ không viết.
6. Trả về đúng dạng JSON đã ràng buộc, không thêm chữ nào ngoài JSON.`;

  let raw = "";
  try {
    raw = await goiCongAI(loiNhac, "RecallGrading", dbService.getActiveSubjectName(), {
      responseMimeType: "application/json",
      responseSchema: DANG_KET_QUA_CHAM,
    });
  } catch {
    return { ...khung, lyDoChuaCham: "Chưa chấm được vì cổng AI không phản hồi. Câu trả lời của bạn vẫn được giữ, thử chấm lại sau." };
  }

  const ketQua = docKetQuaCham(raw);
  if (!ketQua) {
    return { ...khung, lyDoChuaCham: "Chưa chấm được vì kết quả trả về không đúng dạng. Không ghi điểm nào cho lượt này." };
  }

  /*
    CHỐT CHẶN CUỐI: mô hình có thể trả về JSON hợp lệ nhưng nội dung mâu thuẫn, ví dụ liệt kê một
    ý vừa vào `yDaNeuDuoc` vừa vào `yConThieu`, hoặc tổng số ý không khớp thước chấm. Dạng đầu ra
    ràng buộc được HÌNH THỨC chứ không ràng buộc được sự nhất quán, nên phải tự kiểm.
  */
  const tongY = ketQua.hit.length + ketQua.thieu.length;
  const trungNhau = ketQua.hit.some(h => ketQua.thieu.includes(h));
  if (trungNhau || tongY === 0 || tongY > cauHoi.expectedPoints.length) {
    return { ...khung, lyDoChuaCham: "Chưa chấm được vì kết quả trả về tự mâu thuẫn. Không ghi điểm nào cho lượt này." };
  }

  return {
    ...khung,
    passed: ketQua.dat,
    hitPoints: ketQua.hit,
    missingPoints: ketQua.thieu,
    misconceptionHit: cauHoi.misconceptionToWatch ? ketQua.bay : false,
    duDuLieu: true,
  };
}
