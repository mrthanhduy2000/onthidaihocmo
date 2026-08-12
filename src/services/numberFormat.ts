/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/*
  ĐỊNH DẠNG SỐ THEO CÁCH VIẾT TIẾNG VIỆT.

  Vì sao cần file này: dự án đang dùng HAI quy ước ngay trong cùng một màn hình.

    "1.234 ký tự"   <- đúng, qua toLocaleString("vi-VN")
    "5.0 điểm"      <- SAI, qua toFixed(1), đó là dấu thập phân kiểu tiếng Anh

  Tiếng Việt dùng DẤU PHẨY làm dấu thập phân và dấu chấm làm dấu phân nhóm nghìn, ngược hẳn
  tiếng Anh. Nên "5.0 điểm" với người Việt đọc ra là năm nghìn điểm, còn "8.5" trong câu
  "mục tiêu 8.5 điểm" thì vừa sai quy ước vừa làm sản phẩm đọc như bản dịch máy.

  Đo ngày 30/07/2026: 23 chỗ gọi `toFixed()` trong tầng trình bày, cộng 7 chuỗi hiển thị nằm
  trong tầng dịch vụ, tất cả đều in dấu chấm vào giữa câu tiếng Việt.

  CẨN THẬN, đừng thay nhầm: `parseFloat(x.toFixed(2))` và `Number(x.toFixed(2))` KHÔNG phải
  định dạng hiển thị mà là PHÉP LÀM TRÒN, kết quả chảy tiếp vào phép tính khác. Có 5 chỗ như
  vậy trong `src/services` và chúng phải giữ nguyên. Phép kiểm `AH1` canh đúng ranh giới này.
*/

/**
 * Số thập phân viết theo kiểu Việt: `soThapPhan(5)` ra `"5,0"`, `soThapPhan(1234.5)` ra
 * `"1.234,5"`.
 *
 * Luôn hiện đủ số chữ số đã yêu cầu, kể cả khi phần lẻ bằng 0, để các con số cùng một cột
 * thẳng hàng nhau. Đây đúng là hành vi của `toFixed()` mà nó đang thay thế, chỉ khác dấu.
 *
 * @param gia_tri Số cần viết ra. Nhận cả `null`/`undefined` vì nhiều trường dữ liệu là tuỳ chọn.
 * @param soChuSo Số chữ số sau dấu phẩy, mặc định 1 vì phần lớn chỗ dùng là điểm thi.
 */
export function soThapPhan(gia_tri: number | null | undefined, soChuSo: number = 1): string {
  if (gia_tri === null || gia_tri === undefined || !Number.isFinite(gia_tri)) {
    return (0).toLocaleString("vi-VN", {
      minimumFractionDigits: soChuSo,
      maximumFractionDigits: soChuSo,
    });
  }
  return gia_tri.toLocaleString("vi-VN", {
    minimumFractionDigits: soChuSo,
    maximumFractionDigits: soChuSo,
  });
}
