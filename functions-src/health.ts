/*
  Kiểm tra máy chủ còn sống, VÀ cho biết máy chủ đang phục vụ bản dựng nào.

  Phần phiên bản do khâu dựng bơm vào qua `dinhNghiaPhienBan`, đúng bộ tên biến mà gói giao diện
  dùng. Nhờ vậy trình duyệt so được bản mình đang chạy với bản máy chủ phục vụ, và trả lời được ba
  câu hỏi mà trước đây không có cách nào biết: Vercel đã dựng xong chưa, trang đang mở có phải bản
  mới nhất không, và bản này có từ bao giờ.

  Cổng này KHÔNG đòi đăng nhập, cố ý: nó không đụng tới dữ liệu môn học và không gọi Gemini, nên
  không có gì để lộ, mà lại là thứ cần dùng được ngay cả khi phần xác thực đang hỏng.

  HAI ĐƯỜNG CHẠY, HAI CÁCH LẤY. Trên Vercel, `esbuild` thay thẳng các biến `__BAN_*__` vào mã. Ở
  máy nhà, `npm run dev` chạy file này qua `tsx` nên KHÔNG có phép thay nào, và nếu chỉ đọc biến
  bơm sẵn thì cổng sẽ báo "khong-ro" trong khi gói giao diện (do Vite dựng, có phép thay) báo mã
  thật. Hai bên lệch nhau vì lý do chẳng liên quan gì tới việc deploy, và màn hình sẽ báo động giả
  "máy chủ đã có bản mới hơn" suốt buổi. Vì vậy đường dev đọc tiếp từ biến môi trường mà
  `server.ts` đặt lúc khởi động, lấy từ ĐÚNG một nguồn `layThongTinBan`.
*/

declare const __BAN_SHA__: string;
declare const __BAN_NGAY_COMMIT__: string;
declare const __BAN_THOI_DIEM_DUNG__: string;
declare const __BAN_TREN_VERCEL__: boolean;

export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: "ok",
    time: new Date().toISOString(),
    sha: typeof __BAN_SHA__ !== "undefined" ? __BAN_SHA__ : (process.env.BAN_SHA || "khong-ro"),
    ngayCommit: typeof __BAN_NGAY_COMMIT__ !== "undefined" ? __BAN_NGAY_COMMIT__ : (process.env.BAN_NGAY_COMMIT || ""),
    thoiDiemDung: typeof __BAN_THOI_DIEM_DUNG__ !== "undefined" ? __BAN_THOI_DIEM_DUNG__ : (process.env.BAN_THOI_DIEM_DUNG || ""),
    dungTrenVercel: typeof __BAN_TREN_VERCEL__ !== "undefined" ? __BAN_TREN_VERCEL__ : false,
  });
}
