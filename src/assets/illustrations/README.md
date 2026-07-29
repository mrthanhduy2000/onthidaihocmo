# Bộ minh họa AI Learning OS

10 ảnh do Đàm tạo bằng GPT Image theo prompt trong Illustration Master Plan. Đọc
[manifest.json](manifest.json) trước khi ghép bất kỳ ảnh nào vào component — mỗi ảnh có `status`:

- **`approved`**: đã đối chiếu khớp với một `EmptyState` có thật trong mã nguồn, ghép được ngay.
- **`needs-review`**: vị trí đề xuất đi ngược một quyết định thiết kế đã đo trực tiếp trên Khan
  Academy và chốt trước đó (ghi trong `AGENTS.md`/`WORKSTATE.md` của dự án). **Phải hỏi lại Đàm
  theo đúng câu hỏi ở field `askDamAbout` trước khi ghép**, không tự quyết dù ảnh đã có sẵn.

## Cấu trúc thư mục

- `source/` — ảnh gốc xuất từ GPT Image, giữ nguyên độ phân giải, chỉ dùng để tái xuất lại sau này
  nếu cần đổi kích thước hoặc phong cách.
- `*.png` (ngay thư mục này) — bản đã nén để dùng thật trong web, resize còn tối đa 900px chiều
  rộng bằng `sips -Z 900`. Vẫn khá nặng (100-400KB/ảnh) vì `sips` không nén palette PNG được sâu
  như `pngquant`; nếu cần nhẹ hơn nữa, chạy qua tinypng.com hoặc cài `pngquant` trước khi ghép vào
  bản build.

## Trước khi ghép ảnh vào component

1. Đọc `manifest.json`, chỉ ghép thẳng các ảnh `status: "approved"` (hiện là IL-02, IL-03).
2. Với ảnh `needs-review`, hỏi Đàm đúng câu ở `askDamAbout` trước, không tự đoán ý.
3. `EmptyState.tsx` hiện chưa có prop nhận ảnh — cần thêm (ví dụ prop `illustration?: string`),
   đặt phía trên tiêu đề, cao khoảng 120-140px, đúng nguyên tắc "chữ là chủ thể, ảnh là phụ" ở
   AGENTS.md mục 4.9g/4.9h.
4. Sau khi ghép, cập nhật `status` trong manifest thành `"wired"` và ghi một dòng vào
   WORKSTATE.md/BANGIAO.md như mọi vòng làm việc khác của dự án.
