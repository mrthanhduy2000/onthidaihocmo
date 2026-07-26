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

### 27/07/2026 — Ghi nhận phạm vi dài hạn: đây là trung tâm luyện thi đa môn

**Đã làm**: chỉ sửa tài liệu, không đụng một dòng mã nào. Thêm phần "Phạm vi lâu dài" vào mục 3
của AGENTS.md và phần "Phạm vi dài hạn của dự án" vào WORKSTATE.md.

**Vì sao**: Đàm nói rõ trong phiên này rằng đây là **trung tâm luyện thi và học tập đa môn dùng
lâu dài**, sau này còn nạp thêm nhiều môn và nhiều tài liệu khác, không riêng hai môn hiện có.
Trước đó **không một file nào trong repo nói điều này**. Mọi tài liệu đều mô tả dự án như app
của một môn, nên AI đọc repo rất dễ kết luận sai rằng đây là công cụ dùng một lần cho một kỳ
thi rồi bỏ, rồi từ đó đề xuất những thứ tai hại kiểu gỡ bớt hạ tầng cho gọn.

**Số liệu đo được trong lúc rà** (ngày 27/07/2026, đếm trực tiếp trên mã nguồn): còn **26 chỗ
gắn cứng mã môn học** ngoài `src/data/`, chia ra `db.ts` 15, `kbService.ts` 6,
`evidencePipeline.ts` 2, `curriculumIntelligenceEngine.ts` 2, `evidenceCoverageAudit.ts` 1.
Cơ chế nhiều môn thì **đã có sẵn** (`activeSubjectId` cho phép thêm môn tự tạo), cái thiếu là
các nhánh `if` theo mã môn nằm rải rác. Hai môn còn chịu được, môn thứ ba thứ tư thì mỗi lần
thêm môn là một lần sửa mã ở 5 file.

**Nhận định đã ghi vào WORKSTATE, cần Đàm quyết chứ AI không tự quyết**: Rủi ro 1 (bốn cổng AI
trả 401 trên bản chạy thật) nặng hơn vẻ ngoài của nó. Chức năng sinh câu hỏi từ tài liệu chính
là đường nạp môn mới, mà nó đang báo lỗi thẳng. Với định hướng đa môn thì đây là thứ chặn
đường, đáng làm trước mấy khoản nợ engine đang xếp đầu danh sách "Next Major Step". Tôi **cố ý
không tự đảo thứ tự ưu tiên** trong WORKSTATE, chỉ ghi nhận lập luận.

**Kiểm chứng**: `npm run check` đạt cả 5 chặng. Vì không đụng mã nên đây chỉ là xác nhận không
làm hỏng gì, không phải bằng chứng cho nội dung tài liệu.

**Còn nợ**: nợ "gắn cứng mã môn học" chưa được ghi thành một khoản riêng trong mục Technical
Debt của WORKSTATE, mới chỉ nêu trong phần phạm vi. Chưa có phép tự kiểm chứng nào canh việc
thêm môn mới mà không phải sửa mã.

---

### 27/07/2026 — Nâng cấp bộ dự báo điểm thi

**Objective**: rà soát và nâng trí thông minh của `examForecaster.ts` (984 dòng), engine chưa
được đụng tới trong đợt tối ưu trước. Không thêm tính năng, giao diện, service hay engine nào.

**Problem** (đo trên engine thật, không suy đoán): bộ dự báo **hạ điểm người học một cách hệ
thống**, và mức hạ càng lớn khi người học càng giỏi.

| Tỷ lệ đúng thật | Dự báo cũ | Lệch |
|---|---|---|
| 20% | 1,4 | -0,6 |
| 60% | 4,5 | -1,5 |
| 80% | 6,0 | **-2,0** |
| 100% | 8,1 | -1,9 |

Ba khoản cắt chồng lên nhau trong công thức độ thạo ổn định:

1. **Trọng số chỉ cộng lại 0,80** (`mastery*0.50 + accuracy*0.30`), tạo khoản cắt 20% âm thầm.
2. **`consistencyFactor` luôn rơi về sàn 0,4**. Nó lọc câu hỏi bằng
   `q.concept === key || q.topicId === key`, nhưng `q.concept` là chuỗi tự do kiểu "Khái niệm
   hành vi khách hàng" còn `key` là "CB_C1_N1". Đo được **0 trên 277 giá trị khớp nhau**.
3. **`streakRetention` sàn 0,75**: người chưa có chuỗi ngày học nào bị cắt thẳng 25% năng lực,
   kể cả khi vừa làm đúng 95% số câu.

Kết quả: một người học **hoàn hảo** chỉ đạt **24/100** ở thành phần được đánh trọng số cao nhất.

Hai lỗi độc lập khác:

4. **Bảng tiên quyết là đồ trang trí**: `PREREQUISITE_MAP` viết cứng với khóa `GiaCanBang`,
   `PricingStrategy`, `ThiTruongDocQuyen`, tức khái niệm **kinh tế vi mô** còn sót từ môn khác.
   Đo được 0 khóa khớp. Cả tầng lan truyền phụ thuộc và vector `dependencyUncertainty` chưa
   từng chạy.
5. **Điểm dự báo tự tăng theo số lần mở màn hình**. Bộ lọc trơn trộn 35% giá trị mới với 65%
   giá trị đã lưu rồi **ghi đè giá trị đã lưu**. Trên một hồ sơ đứng yên, gọi 6 lần liên tiếp
   cho ra `3,8 → 5,1 → 6,0 → 6,6 → 7,0 → 7,2`. Con số phụ thuộc vào việc người dùng nhìn bao
   nhiêu lần, không phụ thuộc vào việc họ học được gì.

**Decision và Reason**:

- Trọng số đổi thành 0,65 và 0,35 để **cộng đúng bằng 1,0**.
- `consistencyFactor` **bỏ hẳn chứ không sửa**, vì việc cân theo lượng bằng chứng đã được làm
  đúng một lần tại nguồn trong `recomputeStatistics` (`w = 1 - e^(-n/6)`). Sửa nó thành ra co
  hai lần, đúng loại lỗi đã gặp ở `learningEngine` đợt trước.
- `streakRetention` giới hạn trong [0,95; 1,05]: chuỗi ngày học là tín hiệu thật nhưng yếu,
  được phép nhích nhẹ chứ không định đoạt kết quả.
- Bảng tiên quyết đọc thẳng `dependencies.requires` từ đồ thị tri thức, dùng dữ liệu đã có sẵn
  mà trước nay bỏ phí.
- Bộ lọc trơn **neo theo dấu vân tay dữ liệu**. Dữ liệu chưa đổi thì trả lại đúng giá trị cũ;
  chỉ khi người học làm thêm bài mới trộn một bước. Giữ nguyên tác dụng chống nhảy số.
- Khử trùng khóa độ thạo trước khi tính trung bình, vì bảng lưu mỗi khái niệm dưới hai khóa.

**Verification Result** (cùng kịch bản mô phỏng, OLD so với NEW):

| Tỷ lệ đúng | Lệch CŨ | Lệch MỚI |
|---|---|---|
| 20% | -0,6 | -0,3 |
| 40% | -1,2 | -0,6 |
| 60% | -1,5 | -0,7 |
| 80% | -2,0 | -0,7 |
| 100% | -1,9 | -0,5 |

Lệch trung bình giảm từ **1,44 xuống 0,56 điểm**, tức giảm 61%. Lệch không còn phình to theo
năng lực. Gọi 6 lần liên tiếp nay cho cùng một con số. Thêm 5 phép tự kiểm chứng, tổng 50/50.

**Backward Compatibility**: giữ nguyên chữ ký `calculatePrediction`, giữ nguyên kiểu
`ExamPrediction`. Khóa lưu trữ đổi từ chuỗi số sang JSON nhưng **có nhánh đọc định dạng cũ**,
không cần di trú dữ liệu.

**Architecture Impact**: `examForecaster` nay phụ thuộc thêm `kbService` (không tạo vòng lặp
import). Không đổi Product Flow, giao diện hay API.

**Technical Debt còn lại**: `productObservabilityService.ts` (39 ngưỡng cứng) và
`curriculumIntelligenceEngine.ts` (18) **chưa rà tới**. Trong `examForecaster` còn các phần ROI,
what-if, study debt chưa soi kỹ.

**Lessons Learned**: một giả thuyết của tôi sai giữa chừng. Tôi kết luận engine "tất định" sau
khi gọi ba lần liên tiếp thấy cùng kết quả, nhưng đó là vì đã đo tại điểm hội tụ. Chỉ khi đo
**sau một thay đổi trạng thái lớn** mới lộ ra hiện tượng trôi giá trị. Bài học: kiểm tính tái
lập phải đo ngay sau khi dữ liệu vừa đổi, không đo ở trạng thái đứng yên lâu ngày.

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
