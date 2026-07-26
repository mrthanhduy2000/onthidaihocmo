# BANGIAO.md, sổ bàn giao giữa các phiên làm việc

Mỗi lần AI làm xong một việc và commit, phải ghi thêm MỘT mục vào phần "Nhật ký bàn giao" bên
dưới. Mục đích: một AI khác (hoặc chính Đàm sau vài tháng) mở file này ra là hiểu ngay dự án
vừa trải qua chuyện gì, đã sửa gì, vì sao sửa, và đang còn nợ những gì. Đọc lịch sử git thì
thấy được cái gì đổi, nhưng không thấy được **vì sao** và **cái gì đã thử rồi mà sai**.

Đọc kèm: [AGENTS.md](AGENTS.md) cho bản đồ mã nguồn và các bất biến không được phá.

---

## Nếp làm việc bắt buộc

### Tự động commit, không hỏi

Đàm đã ủy quyền thường trực từ 26/07/2026: **làm xong việc thì tự commit, không cần hỏi.**
Không phải hỏi lại mỗi lần. Quyền đã mở sẵn trong `.claude/settings.json`.

Trình tự bắt buộc mỗi lần commit:

1. Chạy `npm run check` và phải ĐẠT toàn bộ. **Tuyệt đối không commit khi đang đỏ.**
2. Soát `git status` xem có file rác lọt vào không (file tạm, file gỡ rối, bản dựng).
3. Commit với thông điệp nêu rõ **đã đổi gì và vì sao**, không chỉ liệt kê tên file.
4. Ghi một mục mới vào "Nhật ký bàn giao" ở cuối file này.
5. Nếu có thay đổi ảnh hưởng cách làm việc thì cập nhật luôn [CLAUDE.md](CLAUDE.md) và
   [AGENTS.md](AGENTS.md) cho khỏi mâu thuẫn.

### Việc KHÔNG được tự làm

- **`git push`**: đẩy lên `main` là kích hoạt deploy thật lên onthidaihocmo.vercel.app, tức là
  đổi bản đang chạy. Phải hỏi Đàm. Quyền này để ở chế độ hỏi trong `.claude/settings.json`.
- Xóa dữ liệu học của Đàm, đổi cấu hình Supabase hay Vercel, bật lại đăng nhập.

### Quy ước viết

Tiếng Việt thuần cho giao diện và chú thích, không chèn tiếng Anh vào câu, không dùng dấu gạch
ngang dài. Chú thích nên giải thích **vì sao**, nhất là chỗ đang vá một lỗi thật.

---

## Nhật ký bàn giao

Mục mới nhất ở trên cùng. Mỗi mục cần đủ: ngày, mã commit, đã làm gì, vì sao, kiểm chứng ra
sao, và còn nợ gì.

---

### 26/07/2026 — Khảo sát toàn dự án và lập WORKSTATE.md

**Mục tiêu**: khôi phục và ghi lại chính xác trạng thái dự án theo giao thức tiếp nối, để phiên
sau không phải dò lại từ đầu. Không sửa một dòng mã nguồn nào.

**Vấn đề**: dự án đã qua nhiều giai đoạn, tài liệu nhiều nhưng phần lớn lạc hậu, và không có
chỗ nào ghi "đang làm tới đâu". BANGIAO ghi lịch sử, AGENTS ghi quy tắc, nhưng thiếu ảnh chụp
trạng thái hiện tại.

**Quyết định**: tách vai trò ba file thay vì nhồi thêm vào file cũ. `WORKSTATE.md` giữ trạng
thái sống, `AGENTS.md` giữ quy tắc kỹ thuật, `BANGIAO.md` giữ lịch sử quyết định. Đã nối tham
chiếu chéo trong CLAUDE.md và AGENTS.md để AI sau không bỏ sót file mới.

**Đã khảo sát và ghi nhận** (không xử lý, đúng nguyên tắc không tự mở rộng phạm vi):

- **0 dấu vết TODO/FIXME/HACK/TEMP** trong toàn bộ mã nguồn, không có việc dở dang.
- **Khoảng 1.180 dòng mã chết**: 2 service mồ côi (`importPipeline`, `validation`), 3 component
  không được render (`AssessmentDesignDashboard`, `Dashboard2Widgets`, `DashboardClock`).
  Đã kiểm chứng bằng cách dò tham chiếu trên cả 100 file, không có nạp động.
- **8 engine trong `evidencePipeline.ts` (839 dòng) chưa bao giờ được đấu nối**, bên ngoài chỉ
  dùng đúng hai kiểu dữ liệu. Nhiều khả năng là một tầng kiến trúc dựng sẵn rồi bỏ dở.
- **Ngưỡng cứng còn dày** ở `examForecaster` (34) và `productObservabilityService` (39), cùng
  loại khiếm khuyết đã sửa ở các engine khác nhưng chưa rà tới.
- **Xác nhận không còn `Math.random` trong hàm so sánh** nào trên toàn dự án.

**Bài học phương pháp**: trong lúc khảo sát, phép tìm bằng shell cho ra kết quả sai hoàn toàn
do vấn đề dấu nháy trong zsh, suýt nữa ghi 46 service đều mồ côi vào tài liệu. Với những phép
đếm mà kết quả sẽ đi vào tài liệu, **hãy viết script Node đàng hoàng thay vì ghép lệnh shell**,
và luôn kiểm chứng ngược một vài trường hợp đã biết chắc trước khi tin con số.

**Kiểm chứng**: `npm run check` đạt toàn bộ 5 chặng.

---

### 26/07/2026 — `f58a0a2` — Tối ưu suy luận toàn bộ tầng engine

**Đã làm**: rà soát 46 service, tìm và sửa các khiếm khuyết thuật toán. Không thêm tính năng
nào, chỉ đổi công thức và cách suy luận.

**Phát hiện nặng nhất**: mô hình chấm thích ứng **chưa từng chạy thật một lần nào**. Đo được
0/292 câu hỏi tra ra được khái niệm, vì `learningEngine` đòi nhãn câu hỏi trùng tuyệt đối tên
khái niệm trong đồ thị, mà hai bên thuộc hai bộ từ vựng khác hẳn. Mọi câu đều rơi vào nhánh
dự phòng, nên độ thạo, đường cong quên, tiên quyết, Bloom đều được tính rồi vứt đi.

**Phát hiện nặng thứ hai**: bảng độ thành thạo có hai không gian khóa song song (mã khái niệm
và tên khái niệm) do hai nơi ghi khác nhau. Mỗi lần nộp bài, `recomputeStatistics` xóa sạch
rồi dựng lại theo khóa mã, thổi bay toàn bộ giá trị mô hình người học tích lũy. Thêm nữa,
khái niệm chưa làm câu nào bị chấm 0% (lẫn với học trượt) và mẫu số tính cả câu chưa gặp.

**Các sửa chính**:
- Hợp nhất 3 bộ tra cứu khái niệm thành 1 bộ có xếp hạng, kết quả 292/292 câu tra được.
- Độ thạo ghi đồng thời hai khóa qua `setConceptMasteryBothKeys`; chưa học là 50 chứ không
  phải 0; co theo bằng chứng `w = 1 - e^(-n/6)` và chỉ co đúng một lần tại nguồn.
- Bộ chấm ưu tiên: bỏ ngưỡng bậc thang sang hàm liên tục, gộp theo trung bình có trọng số
  thay vì cộng dồn theo số nhãn, cổng tiên quyết chỉ nhân một lần.
- Bỏ `Math.random` trong hàm so sánh của `sort` ở hai chỗ (vi phạm hợp đồng sắp xếp).
- Sửa chỉ số chuyển giao bị vô hiệu bởi `max(1, lowerAcc)` luôn bằng 1.
- Đo đà học bằng hồi quy thay vì hiệu hai đầu mút.
- Gộp công thức độ bền trí nhớ từng bị chép thành hai bản.
- Bỏ quan hệ tiên quyết bịa ra theo thứ tự duyệt Map trong `kbService`.

**Kiểm chứng**: thêm 17 phép tự kiểm chứng cho tầng suy luận, tổng 45/45 đạt. Chạy thật trên
trình duyệt, không lỗi console.

**Bài học cho người sau**: trong đợt này tôi kết luận sai hai lần, cả hai đều là **phép kiểm
sai chứ không phải mã nguồn sai**. Khi một phép kiểm báo đỏ, hãy nghi ngờ phép kiểm trước.
Đặc biệt cảnh giác với phép kiểm ĐẠT một cách rỗng: nếu dải biến thiên bằng 0 hoặc mọi giá
trị bằng nhau, nhiều khả năng nhánh đang đo không hề chạy.

**Còn nợ**: 4 cổng AI trên bản deploy vẫn trả 401 (xem "Bẫy 1" trong AGENTS.md). Đàm đã biết
và chọn chưa xử lý.

---

### 26/07/2026 — `e9b4300` — Bộ công cụ để AI khác vào sửa và tự kiểm chứng

**Đã làm**: dựng `npm run check` (5 chặng: rào bảo mật, kiểu dữ liệu, tự kiểm chứng, build
giao diện, build Vercel), `npm run check:prod` (kiểm bản đã deploy), và AGENTS.md.

**Vì sao**: Đàm thi xong, chuyển hướng sang việc để AI khác vào làm tiếp được mà không cần
hỏi. Tài liệu cũ trong repo viết cho môn Kinh tế chính trị đã đóng, số liệu sai hết, nên đã
gắn cảnh báo lạc hậu lên đầu 8 file.

**Điểm đáng giá**: bộ tự kiểm chứng nạp nguyên `db.ts` và `ai.ts` vào Node rồi sinh đề, chấm
điểm thật, không phải mô phỏng. Hai rào cản đã xử lý: `import.meta.env` thay bằng object rỗng
lúc đóng gói esbuild, còn localStorage thì `db.ts` tự giả lập sẵn.

**Đã chứng minh bộ kiểm bắt được lỗi thật** bằng cách cố tình phá một bất biến rồi khôi phục.

**Phát hiện kèm theo**: `npm run check:prod` cho thấy cả 4 cổng AI trên bản deploy trả 401.
Nguyên nhân: lượt trước gỡ đăng nhập ở giao diện nhưng serverless vẫn đòi token Supabase.
Máy cục bộ không đặt biến Supabase nên AI luôn chạy, che mất lỗi này.

---

### 26/07/2026 — `0f8d1a8` — Gỡ đăng nhập, đưa nút đề tổng hợp ra 2 chỗ, ôn random ưu tiên câu sai

**Đã làm**: gỡ màn đăng nhập ở frontend (app chạy chế độ dữ liệu cục bộ), đưa nút "Giải đề
ngẫu nhiên tổng hợp" ra Bàn học và Tổng quan, xếp đề ngẫu nhiên theo ưu tiên ôn tập.

**Hệ quả cần biết**: không còn đồng bộ đám mây, dữ liệu học nằm trong localStorage của đúng
một trình duyệt. Đàm đã chọn giữ cách sao lưu bấm tay trong Cài đặt, **đừng tự ý thêm đồng bộ
hay bật lại đăng nhập**.
