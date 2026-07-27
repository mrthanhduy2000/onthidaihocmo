# Hướng dẫn cho Claude Code trong dự án này

**Đọc [WORKSTATE.md](WORKSTATE.md) trước tiên** để biết dự án đang dở việc gì, rồi đọc
[AGENTS.md](AGENTS.md) để nắm bản đồ mã nguồn, các bất biến không được phá, và những cái bẫy
đã từng làm hỏng bản deploy.

Ba file nói ba việc khác nhau, đừng nhầm:
- `WORKSTATE.md`: đang làm tới đâu, còn nợ gì, bước tiếp theo là gì
- `AGENTS.md`: quy tắc kỹ thuật, bất biến, bẫy
- `BANGIAO.md`: lịch sử quyết định, vì sao từng chọn như vậy

Ba điều cần nhớ ngay:

1. Sửa xong thì chạy `npm run check` để tự kiểm chứng. Có 152 phép kiểm chạy trên engine thật,
   không phải kiểm kiểu suông. Vòng lặp nhanh thì dùng `npm run check:fast`.
2. Chạy thử ứng dụng bằng `npm run dev` rồi mở http://localhost:3000. Đừng chạy Vite trần,
   nó **không có** các cổng `/api` nên AI sẽ hỏng vì cách chạy chứ không phải vì mã nguồn.
   `.claude/launch.json` đã trỏ sẵn vào lệnh đúng.
3. Build xanh **không** đảm bảo bản đã deploy còn sống. Sau khi động tới xác thực, đăng nhập
   hoặc các hàm serverless, chạy thêm `npm run check:prod`. Lý do cụ thể nằm ở mục "Bẫy 1" trong AGENTS.md.

## Tự động commit (ủy quyền thường trực từ 26/07/2026)

**Làm xong việc thì TỰ COMMIT, không hỏi lại Đàm.** Quyền đã mở sẵn trong
`.claude/settings.json`. Trình tự bắt buộc:

1. Chạy `npm run check`, phải ĐẠT toàn bộ. Không bao giờ commit khi đang đỏ.
2. Soát `git status` để không có file rác lọt vào.
3. Commit với thông điệp nêu rõ **đổi gì và vì sao**.
4. Ghi một mục mới vào [BANGIAO.md](BANGIAO.md) để AI sau hiểu được bối cảnh.

5. **Push luôn lên `main`, không hỏi** (Đàm ủy quyền thường trực từ 27/07/2026, thay quy tắc
   cũ vốn bắt phải hỏi).

**Cảnh báo đi kèm quyền push:** đẩy lên `main` là deploy thật lên onthidaihocmo.vercel.app,
đổi ngay bản Đàm đang dùng. Không còn chốt chặn nào của con người sau bước này, nên chặng
`npm run check` ở bước 1 là hàng phòng thủ duy nhất. Đỏ mà vẫn commit thì đồng nghĩa đẩy lỗi
thẳng lên bản chạy thật. Riêng khi vừa động tới xác thực, đăng nhập hoặc hàm serverless, chạy
thêm `npm run check:prod` **sau khi push** rồi báo kết quả cho Đàm, vì loại lỗi đó chỉ hiện ra
trên máy chủ.

Quy ước viết mã: tiếng Việt thuần cho giao diện và chú thích, không dùng dấu gạch ngang dài.

Tài liệu cũ trong repo (`README.md`, `ARCHITECTURE.md`, `DATA_FLOW.md`, `DATABASE.md`,
`TECH_DEBT.md`, `TEST_PLAN.md`, `ROADMAP.md`, `CHANGELOG.md`) đã lạc hậu, viết cho một môn học
đã đóng. Khi mâu thuẫn, tin AGENTS.md và tin mã nguồn.
