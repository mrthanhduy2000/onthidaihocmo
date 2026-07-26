# Hướng dẫn cho Claude Code trong dự án này

**Đọc [AGENTS.md](AGENTS.md) trước khi sửa bất cứ thứ gì.** File đó chứa bản đồ mã nguồn,
các bất biến không được phá, và những cái bẫy đã từng làm hỏng bản deploy.

Ba điều cần nhớ ngay:

1. Sửa xong thì chạy `npm run check` để tự kiểm chứng. Có 28 phép kiểm chạy trên engine thật,
   không phải kiểm kiểu suông. Vòng lặp nhanh thì dùng `npm run check:fast`.
2. Chạy thử ứng dụng bằng `npm run dev` rồi mở http://localhost:3000. Chạy Vite trần
   (cổng 5199 trong `.claude/launch.json`) sẽ **không có** các cổng `/api`, nên AI sẽ hỏng
   vì cách chạy chứ không phải vì mã nguồn.
3. Build xanh **không** đảm bảo bản đã deploy còn sống. Sau khi động tới xác thực, đăng nhập
   hoặc các hàm serverless, chạy thêm `npm run check:prod`. Lý do cụ thể nằm ở mục "Bẫy 1" trong AGENTS.md.

Quy ước viết mã: tiếng Việt thuần cho giao diện và chú thích, không dùng dấu gạch ngang dài,
không tự ý commit hay push khi chưa được yêu cầu.

Tài liệu cũ trong repo (`README.md`, `ARCHITECTURE.md`, `DATA_FLOW.md`, `DATABASE.md`,
`TECH_DEBT.md`, `TEST_PLAN.md`, `ROADMAP.md`, `CHANGELOG.md`) đã lạc hậu, viết cho một môn học
đã đóng. Khi mâu thuẫn, tin AGENTS.md và tin mã nguồn.
