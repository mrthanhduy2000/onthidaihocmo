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
