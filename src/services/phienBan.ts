/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/*
  PHIÊN BẢN BẢN DỰNG, đọc từ phía chạy.

  VÌ SAO CẦN. Đẩy lên `main` là deploy thật lên onthidaihocmo.vercel.app, nhưng từ trình duyệt thì
  không có cách nào biết ba điều: Vercel đã dựng xong bản mới chưa, trang đang mở có phải bản mới
  nhất không hay là bản cũ còn trong bộ nhớ đệm, và bản đang chạy có từ bao giờ. Ba câu hỏi ấy chỉ
  trả lời được nếu chính bản dựng mang theo dấu vết của nó.

  BẪY 2 TRONG AGENTS.md: tuyệt đối KHÔNG đọc qua `import.meta.env`. Các script chạy ngoài Vite (bộ
  tự kiểm chứng, `bank-audit`) sẽ nổ. Ở đây dùng biến do khâu dựng thay thẳng vào mã, và đọc qua
  `typeof` để khi KHÔNG có khâu dựng nào thay (chạy trong bộ kiểm) thì rơi về giá trị dự phòng thay
  vì ném lỗi tham chiếu.
*/

declare const __BAN_SHA__: string;
declare const __BAN_NGAY_COMMIT__: string;
declare const __BAN_THOI_DIEM_DUNG__: string;
declare const __BAN_TREN_VERCEL__: boolean;

/** Giá trị khi chạy ngoài mọi khâu dựng, ví dụ trong bộ tự kiểm chứng. Không bịa số. */
export const KHONG_RO = "khong-ro";

export interface ThongTinBanDung {
  /** Bảy ký tự đầu của mã commit. `khong-ro` khi không xác định được. */
  sha: string;
  /** Thời điểm commit, dạng ISO. Rỗng khi không xác định được. */
  ngayCommit: string;
  /** Thời điểm khâu dựng chạy, dạng ISO. */
  thoiDiemDung: string;
  /** Bản này được dựng trên Vercel hay trên máy nhà. */
  dungTrenVercel: boolean;
}

export const banDangChay: ThongTinBanDung = {
  sha: typeof __BAN_SHA__ !== "undefined" ? __BAN_SHA__ : KHONG_RO,
  ngayCommit: typeof __BAN_NGAY_COMMIT__ !== "undefined" ? __BAN_NGAY_COMMIT__ : "",
  thoiDiemDung: typeof __BAN_THOI_DIEM_DUNG__ !== "undefined" ? __BAN_THOI_DIEM_DUNG__ : "",
  dungTrenVercel: typeof __BAN_TREN_VERCEL__ !== "undefined" ? __BAN_TREN_VERCEL__ : false,
};

/** Ba trạng thái có thể có khi đối chiếu bản trình duyệt với bản máy chủ. */
export type TrangThaiDoiChieu = "dang-hoi" | "moi-nhat" | "co-ban-moi-hon" | "khong-hoi-duoc";

export interface KetQuaDoiChieu {
  trangThai: TrangThaiDoiChieu;
  banTrinhDuyet: ThongTinBanDung;
  /** Bản máy chủ đang phục vụ. `null` khi chưa hỏi được. */
  banMayChu: ThongTinBanDung | null;
  /** Vì sao không hỏi được. Rỗng khi hỏi được. */
  lyDoKhongHoi: string;
}

/**
 * Hỏi máy chủ đang phục vụ bản nào, rồi so với bản trình duyệt đang chạy.
 *
 * Ba kết luận có ý nghĩa khác nhau, và màn hình phải nói khác nhau:
 *
 *   `moi-nhat`         hai bên khớp, tức bản đang mở đúng là bản máy chủ phục vụ
 *   `co-ban-moi-hon`   máy chủ đã có bản khác, trang đang mở là bản cũ trong bộ nhớ đệm, phải tải lại
 *   `khong-hoi-duoc`   mất mạng hoặc chạy máy nhà không có cổng, KHÔNG được đọc thành "đã mới nhất"
 *
 * Cố ý KHÔNG tự tải lại trang: người học có thể đang làm dở một bài.
 */
export async function doiChieuVoiMayChu(): Promise<KetQuaDoiChieu> {
  const khung: KetQuaDoiChieu = {
    trangThai: "khong-hoi-duoc",
    banTrinhDuyet: banDangChay,
    banMayChu: null,
    lyDoKhongHoi: "",
  };
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return { ...khung, lyDoKhongHoi: `Cổng kiểm tra trả về ${res.status}.` };
    const data = await res.json();
    if (!data || typeof data.sha !== "string") {
      return { ...khung, lyDoKhongHoi: "Cổng kiểm tra không trả về thông tin phiên bản." };
    }
    const banMayChu: ThongTinBanDung = {
      sha: data.sha,
      ngayCommit: typeof data.ngayCommit === "string" ? data.ngayCommit : "",
      thoiDiemDung: typeof data.thoiDiemDung === "string" ? data.thoiDiemDung : "",
      dungTrenVercel: Boolean(data.dungTrenVercel),
    };
    return {
      ...khung,
      banMayChu,
      trangThai: banMayChu.sha === banDangChay.sha ? "moi-nhat" : "co-ban-moi-hon",
    };
  } catch {
    return { ...khung, lyDoKhongHoi: "Không gọi được cổng kiểm tra, có thể đang mất mạng." };
  }
}

/*
  CHẨN ĐOÁN VÌ SAO AI KHÔNG DÙNG ĐƯỢC.

  VÌ SAO CẦN. Khi bốn cổng AI chết, ứng dụng hỏng trong IM LẶNG: mỗi tính năng tự báo lỗi riêng
  ("chưa chấm được vì cổng AI không phản hồi", gia sư rơi về bản ngoại tuyến), nhưng không chỗ nào
  nói nguyên nhân chung là gì và gỡ thế nào. Người dùng chỉ còn cách chạy `npm run check:prod` từ
  cửa sổ dòng lệnh, tức phải rời khỏi ứng dụng để hỏi về chính ứng dụng.

  KHÔNG TỐN LƯỢT GỌI GEMINI NÀO. Cách chẩn đoán là kiểm hai điều kiện cần, không phải thử gọi
  thật: trình duyệt có lấy được phiên đăng nhập không, và máy chủ có khóa không. Thử gọi thật thì
  mỗi lần mở app là một lượt Gemini, và đó là cái giá không đáng cho một dòng chữ trạng thái.
*/

export type TrangThaiAI =
  | "dang-hoi"
  | "san-sang"
  | "chua-cau-hinh-dang-nhap"
  | "khong-lay-duoc-phien"
  | "may-chu-thieu-khoa"
  | "khong-hoi-duoc";

export interface ChanDoanAI {
  trangThai: TrangThaiAI;
  /** Câu viết cho người dùng đọc, nói rõ hỏng ở đâu. Rỗng khi sẵn sàng. */
  moTa: string;
  /** Việc cần làm để gỡ. Rỗng khi sẵn sàng hoặc khi chưa hỏi được. */
  cachGo: string;
}

/**
 * Chẩn đoán trạng thái AI bằng hai điều kiện cần, theo thứ tự từ gần người dùng ra xa.
 *
 * Thứ tự này quan trọng: hỏng ở bước đăng nhập thì chưa biết gì về khóa máy chủ, nên phải báo
 * đúng bước hỏng đầu tiên chứ không đoán tiếp.
 */
export async function chanDoanAI(): Promise<ChanDoanAI> {
  const { isSupabaseConfigured, ensureSession } = await import("./supabaseClient");

  if (!isSupabaseConfigured) {
    return {
      trangThai: "chua-cau-hinh-dang-nhap",
      moTa: "Chưa cấu hình đăng nhập nên không qua được cửa xác thực của các cổng AI.",
      cachGo: "Đặt VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY rồi deploy lại.",
    };
  }

  let coPhien = false;
  try {
    coPhien = Boolean((await ensureSession())?.access_token);
  } catch {
    coPhien = false;
  }
  if (!coPhien) {
    return {
      trangThai: "khong-lay-duoc-phien",
      moTa: "Không lấy được phiên đăng nhập, nên mọi cổng AI đều trả về 401.",
      cachGo: "Kiểm tra dự án Supabase còn sống không, và bật Anonymous sign-ins.",
    };
  }

  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) {
      return { trangThai: "khong-hoi-duoc", moTa: `Cổng kiểm tra trả về ${res.status}.`, cachGo: "" };
    }
    const data = await res.json();
    if (data?.coKhoaGemini === false) {
      return {
        trangThai: "may-chu-thieu-khoa",
        moTa: "Đăng nhập được nhưng máy chủ chưa có khóa Gemini.",
        cachGo: "Đặt GEMINI_API_KEY trong biến môi trường của Vercel rồi deploy lại.",
      };
    }
    return { trangThai: "san-sang", moTa: "", cachGo: "" };
  } catch {
    return { trangThai: "khong-hoi-duoc", moTa: "Không gọi được cổng kiểm tra.", cachGo: "" };
  }
}
