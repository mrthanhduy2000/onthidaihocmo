/**
 * THÔNG TIN BẢN DỰNG, nguồn DUY NHẤT cho cả gói giao diện lẫn hàm serverless.
 *
 * Vì sao phải dùng chung: màn hình so phiên bản của trình duyệt với phiên bản máy chủ trả về để
 * biết Vercel đã dựng xong chưa và trình duyệt có đang giữ bản cũ trong bộ nhớ đệm không. Hai nơi
 * tự lấy thông tin theo hai cách thì hai con số ấy có thể lệch vì lý do không liên quan gì tới
 * việc deploy, và phép so trở thành vô nghĩa.
 *
 * Chạy lúc DỰNG, không chạy lúc người dùng mở trang, nên được phép gọi git và đọc biến môi trường.
 */
import { execSync } from "node:child_process";

/** Chạy một lệnh git, thất bại thì trả chuỗi rỗng chứ không làm hỏng cả lượt dựng. */
function git(lenh) {
  try {
    return execSync(lenh, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

export function layThongTinBan() {
  // Trên Vercel thì biến môi trường là nguồn chắc chắn nhất: bản sao git ở đó là bản sao nông và
  // có lúc không có đủ lịch sử. Máy nhà thì không có biến này nên rơi về hỏi git.
  const shaDay = process.env.VERCEL_GIT_COMMIT_SHA || git("git rev-parse HEAD");
  const sha = shaDay ? shaDay.slice(0, 7) : "khong-ro";

  // Ngày commit: không có biến môi trường tương ứng trên Vercel nên chỉ hỏi git được. Thiếu thì để
  // rỗng và màn hình phải nói là chưa rõ, tuyệt đối không thay bằng thời điểm dựng cho có số.
  const ngayCommit = git("git show -s --format=%cI HEAD");

  return {
    sha,
    ngayCommit,
    thoiDiemDung: new Date().toISOString(),
    /** `true` khi đang dựng trên Vercel, dùng để phân biệt bản chạy thật với bản chạy máy nhà. */
    dungTrenVercel: Boolean(process.env.VERCEL),
  };
}

/** Đóng gói thành cặp `define` cho esbuild và Vite. Một chỗ đặt tên biến, cả hai nơi dùng lại. */
export function dinhNghiaPhienBan() {
  const ban = layThongTinBan();
  return {
    __BAN_SHA__: JSON.stringify(ban.sha),
    __BAN_NGAY_COMMIT__: JSON.stringify(ban.ngayCommit),
    __BAN_THOI_DIEM_DUNG__: JSON.stringify(ban.thoiDiemDung),
    __BAN_TREN_VERCEL__: JSON.stringify(ban.dungTrenVercel),
  };
}
