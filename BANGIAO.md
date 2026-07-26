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
6. **Push lên `main`, không hỏi.** Đàm ủy quyền thường trực từ 27/07/2026.

### Tự động push, và cái giá của nó

Từ 27/07/2026 Đàm bỏ luôn chốt hỏi trước khi push. Trước đó `git push` nằm ở mục "phải hỏi"
vì đẩy lên `main` là deploy thật lên onthidaihocmo.vercel.app.

Điều đó **không biến việc push thành vô hại**, nó chỉ chuyển toàn bộ gánh nặng sang
`npm run check`. Sau khi push không còn ai duyệt nữa. Vì vậy:

- Đỏ thì dừng, không có ngoại lệ nào cả.
- Đừng nới ngưỡng một phép kiểm cho nó xanh. Nếu tin là phép kiểm sai, hãy chứng minh bằng số
  đo rồi ghi lý do vào nhật ký bàn giao.
- Động tới xác thực, đăng nhập hay hàm serverless thì chạy `npm run check:prod` **sau khi
  push** và báo kết quả cho Đàm. Bẫy 1 là loại lỗi xanh ở máy cục bộ nhưng chết trên máy chủ,
  nay nó lên thẳng bản chạy thật.

### Việc KHÔNG được tự làm

- Xóa dữ liệu học của Đàm, đổi cấu hình Supabase hay Vercel, bật lại đăng nhập.

### Quy ước viết

Tiếng Việt thuần cho giao diện và chú thích, không chèn tiếng Anh vào câu, không dùng dấu gạch
ngang dài. Chú thích nên giải thích **vì sao**, nhất là chỗ đang vá một lỗi thật.

---

## Nhật ký bàn giao

Mục mới nhất ở trên cùng. Mỗi mục cần đủ: ngày, mã commit, đã làm gì, vì sao, kiểm chứng ra
sao, và còn nợ gì.

---

### 27/07/2026 — Gỡ mã môn học cắm cứng ở ba chỗ chỉ sai khi có từ hai môn trở lên

**Objective**: Đàm xác nhận đây là trung tâm luyện thi **đa môn** và sẽ còn nạp thêm nhiều môn.
Khoản nợ "gắn cứng mã môn học" vì thế chuyển từ chuyện dọn dẹp thành chuyện đúng sai.

**Đặc điểm chung của loại lỗi này**: chạy đúng y như thường với môn Hành vi khách hàng, và chỉ
sai khi có môn thứ hai. Nghĩa là nó nằm im cho tới đúng lúc Đàm cần nó nhất, và khi sai thì
không có dấu hiệu gì cả, chỉ là số liệu của môn khác.

| Chỗ | Hỏng thế nào |
|---|---|
| `evidenceCoverageAudit.auditSubject` | Mặc định cứng `"customer_behavior"`, mà cả **ba** nơi gọi trong `AcademicQualityDashboard` đều gọi không tham số. Đang mở môn nào cũng chấm điểm môn Hành vi khách hàng |
| `setConceptMasteryBothKeys` | Thoát sớm với mọi môn khác, nên bất biến 4.6 "một giá trị, hai khóa" chỉ đúng cho đúng một môn |
| `recomputeStatistics` nhánh dự phòng | Ghi độ thạo dưới một khóa duy nhất, lệch không gian khóa với đường ghi kia |

**Nói rõ để khỏi phóng đại**: bảng độ thạo của các môn khác **không rỗng**. Ban đầu tôi định
viết như vậy vào chú thích, đọc kỹ lại thì thấy `recomputeStatistics` có nhánh dự phòng ghi
theo nhãn `knowledgeMapping`. Vấn đề là hai đường ghi dùng hai không gian khóa khác nhau, chứ
không phải mất trắng dữ liệu.

**Vướng mắc kỹ thuật đáng ghi lại**: `db.ts` cần biết đồ thị tri thức của môn đang mở, nhưng
`kbService.ts` **đã** nhập `db.ts`. Nhập ngược lại là tạo vòng nhập, mà `db.ts` gọi
`loadSubject` ngay ở mức module, nên thứ tự nạp có thể rơi vào trường hợp `kbService` chưa khởi
tạo xong đã bị gọi, tức lỗi "Cannot access before initialization" ngay lúc mở ứng dụng. Đúng
loại lỗi mà build xanh không bắt được. Cách làm: `db.ts` mở một ô đăng ký, `kbService.ts` tự
cắm vào ở cuối file. Có phép kiểm canh việc đăng ký thật sự xảy ra, vì nếu không ai đăng ký thì
hàm rơi về hành vi cũ **một cách im lặng**.

**Một lỗi chỉ lộ ra khi mở màn hình thật**: sổ nợ học tập xếp nợ chương theo `1000 + số hiệu
chương`, mà danh sách xếp giảm dần, nên trên hồ sơ trắng màn hình dựng ngược: Chương 7 trên
cùng, Chương 1 dưới đáy. Chưa học gì thì phải bắt đầu từ chương đầu. Toàn bộ 87 phép kiểm lúc
đó đều xanh, không phép nào canh thứ tự này. Đã sửa thành `1000 - số hiệu chương` và thêm phép
kiểm. **Bài học**: chạy engine trong Node chứng minh được logic, nhưng có những thứ chỉ nhìn
màn hình mới thấy. Sau khi sửa thứ gì có màn hình, hãy mở `npm run dev` xem tận mắt.

**Kiểm chứng**: `npm run check` đạt cả 6 chặng, 88 phép kiểm. Thêm nhóm **L** (6 phép), trong
đó có một phép dựng hẳn một môn tự tạo giả rồi kiểm độ thạo có ghi đủ hai khóa không. Ngoài ra
đã mở `npm run dev` và soi tận mắt cả bốn tab của màn Kế hoạch học: ngân sách 11+23+11 = 45
phút đúng bằng ngân sách và ba tỷ lệ cộng lại 100%, mục Sổ tay hiện "Ưu tiên Thấp, +0.00 điểm,
sổ tay đang sạch", what-if hiện "chưa đo được chương nào yếu" thay cho "-0,8 điểm". Không lỗi
nào trên bảng điều khiển trình duyệt.

**Còn nợ**: `kbService.getDistractors`, `getBlueprints`, `getAdaptiveMetadata` vẫn trả mảng rỗng
cho mọi môn ngoài Hành vi khách hàng, vì chúng gắn với ba file dữ liệu chỉ có cho môn đó. Đây là
suy giảm êm, không phải khẳng định sai, nên để lại. Muốn dọn thì phải làm sổ đăng ký dữ liệu
theo môn, là việc lớn hơn hẳn.

---

### 27/07/2026 — Màn Kế hoạch học nói 7 con số không bám dữ liệu, và trường Bloom chết 292/292

**Objective**: tiếp tục danh sách "chưa rà" trong WORKSTATE. Hai hạng mục còn lại là phần
ROI/what-if/nợ học tập/kịch bản sức ép của `examForecaster`, và các ngưỡng cứng còn sót.

**Vấn đề tìm được**: bảy lỗi, tất cả đều đang hiển thị cho Đàm xem trên màn Kế hoạch học, và
tất cả đều thuộc cùng một họ: **trình bày hằng số viết tay như thể đó là kết quả đo được.**

| Lỗi | Đo được trước khi sửa |
|---|---|
| Kịch bản sức ép là hằng số | 4/5 kịch bản không đổi một ly giữa hồ sơ đầy và hồ sơ trắng |
| Hứa lợi ích cho việc không thể làm | Hồ sơ trắng vẫn được hứa "làm chủ chương khó nhất: +0,5 điểm" |
| Bảng ROI chép công thức rồi trôi lệch | Cùng một hoạt động: bảng ROI +0,55 điểm, bảng độ nhạy +0,33 điểm |
| Sổ tay rỗng vẫn hứa thêm điểm | +0,10 điểm cho việc chữa câu sai khi không còn câu sai nào |
| Kế hoạch chia phút vỡ ở ngân sách nhỏ | Xin 15 phút, nhận về 20 phút, ba tỷ lệ cộng lại 133% |
| Sổ nợ không hề xếp hạng | Điểm ưu tiên tính xong rồi vứt; 44/45 mục cùng nhãn "Cao" |
| Bộ mô phỏng neo sai chỗ | Neo cứng 45 phút và 14 ngày thay vì kế hoạch thật của Đàm |

**Phát hiện lớn nhất, ngoài dự kiến**: soát độ đầy của từng trường trong ngân hàng câu hỏi thì
thấy **`bloomLevel` rỗng ở 292/292 câu** (và `misconception` cũng rỗng 292/292). Sáu chỗ trong
mã nguồn đọc `bloomLevel`. Không chỗ nào báo lỗi, tất cả lặng lẽ rơi về mặc định:

- `examQualityReport` báo mọi đề thi 100% mức "Nhớ"
- `evidenceCoverageAudit` báo mọi khái niệm chỉ được kiểm ở mức "Nhớ"
- `curriculumIntelligenceEngine` cho cân bằng Bloom 0%/0%/0% trên mọi hồ sơ
- `contentQualityAssurance` cho điểm khớp Bloom cố định 75 với mọi câu
- `evidencePipeline` nói với gia sư AI rằng MỌI câu đều ở mức "Understand"

**Cách sửa**: trường `learningObjective` có đủ ở 292/292 câu và mở đầu bằng đúng động từ của
thang Bloom ("Nắm vững...", "Thấu hiểu...", "Phân loại...", "Ứng dụng..."). Đây là thông tin
đang nằm không. Thêm `suyRaMucBloom` trong `db.ts`, chạy ngay lúc nạp môn nên cả sáu chỗ đọc
đều nhận giá trị thật mà **không phải sửa một dòng nào ở sáu file kia**.

**Một cái bẫy đã sập ngay trong lúc làm, ghi lại để người sau khỏi vấp**: bản đầu tiên của bộ
suy luận chọn bậc Bloom CAO NHẤT tìm thấy trong câu. Đo ra thì "Phân tích ảnh hưởng của yếu tố
văn hóa ... nhằm thiết kế thông điệp" bị gán nhãn "Create", chỉ vì chữ "thiết kế" nằm ở cuối
câu. Mục tiêu học tập viết theo lối "động-từ-tư-duy + nội dung + mục đích nghiệp vụ", mà phần
mục đích nghiệp vụ cũng chứa động từ mạnh. Sửa thành lấy **động từ đứng đầu**. Số câu bị chấm
là lệch nhãn giảm từ 63/292 xuống 7/292, và 7 ca còn lại đều là lệch thật (câu gán "Khó" nhưng
mục tiêu chỉ đòi nhớ định nghĩa).

**Một sai lầm nữa của chính tôi, đã sửa**: lần đầu chia bậc ưu tiên sổ nợ, tôi chỉ dùng số lần
sai, kết quả là **45/45 mục đều rơi vào bậc "Thấp"**. Tôi vừa đổi một nhãn vô nghĩa lấy một
nhãn vô nghĩa khác. Nguyên nhân: hồ sơ thật gồm rất nhiều câu mới sai đúng một lần. Phải thêm
tín hiệu thứ hai độc lập là độ yếu của chương chứa câu đó. Sau khi thêm: 19 Cao / 23 Trung
bình / 3 Thấp.

**Phép kiểm cũ đạt mà không nói lên gì**: phép "Cân bằng Bloom không phải hằng số cứng" trong
nhóm I chạy trên hồ sơ vừa bị xóa sạch, nên luôn đo được 0%/0%/0%, mà 0/0/0 thì đương nhiên
khác 45/35/20. Đã viết lại: bắt buộc phải có lịch sử làm bài thật và tổng ba tỷ lệ phải xấp xỉ
100%.

**Nguyên tắc rút ra, đã ghi vào AGENTS.md**: trước khi tin một trường dữ liệu, hãy đếm xem nó
có bao nhiêu giá trị khác nhau trên toàn bộ dữ liệu thật. Trường rỗng và chỉ số hằng số đều
không kêu một tiếng nào, chúng chỉ lặng lẽ làm mọi kết luận phía sau thành vô nghĩa.

**Kiểm chứng**: `npm run check` đạt cả 6 chặng. Thêm nhóm kiểm **J** (12 phép, canh đúng bảy
lỗi trên) và nhóm **K** (5 phép, canh nhãn Bloom). Mỗi phép đều được thử ngược: sửa xong đo
lại bằng chính bản dò đã phát hiện ra lỗi.

**Còn nợ**: `misconception` vẫn rỗng 292/292, `contextWindowBuilder` vì thế luôn gửi cho AI một
câu cảnh báo chung chung. Không phải khẳng định sai nên để lại. 25 chỗ gắn cứng mã môn học vẫn
đợi. Gói giao diện vẫn khoảng 1 MB.

---

### 27/07/2026 — Rà soát toàn diện: 9 lỗi thật ở hai engine chưa từng được soi

**Objective**: Đàm yêu cầu "rà soát mọi thứ, fix toàn bộ, nâng cấp trí tuệ". Hai engine
`productObservabilityService` (1205 dòng) và `curriculumIntelligenceEngine` (390 dòng) nằm
trong danh sách "chưa rà" của WORKSTATE, và cả hai đều có màn hình thật trong ứng dụng.

**Cách làm**: đo bằng script chạy trên engine thật trước, không đọc lướt rồi đoán. Chính việc
bấm giờ và in số đã lôi ra những lỗi mà đọc mã không thấy.

**Chín lỗi đã sửa**:

| # | Lỗi | Hậu quả đo được |
|---|---|---|
| 1 | Hai hàm gọi vòng nhau vô hạn | Màn hình Đài quan sát **luôn tràn ngăn xếp** khi mở |
| 2 | Khớp khái niệm bằng so chuỗi tuyệt đối | 0/292 câu khớp, báo 16/16 khái niệm "chết", độ phủ 0% |
| 3 | Đọc trường ma `solvedQuestionIds` | Mọi chương luôn báo "chưa từng luyện tập", độ thạo luôn 0% |
| 4 | Khoản nợ Bloom khẳng định số chưa đo | Đẩy ra cho mọi người học có hơn 30 câu, bất kể thực tế |
| 5 | `studyBalance` trả hằng số 45/35/20 | Hiển thị như phân bố của chính người học |
| 6 | Đếm ngược kỳ thi ghi cứng trong giao diện | Màn Chương trình hiện 12 ngày, màn Bàn học hiện 14 ngày |
| 7 | Hàm so sánh không phản đối xứng khi xếp nợ | Vi phạm bất biến 4.7, thứ tự tùy thuật toán sắp xếp |
| 8 | Chuẩn hóa chuỗi lặp 85 nghìn lần | Một lượt quét ngân hàng mất 4,0 giây |
| 9 | `new Date()` thay vì `TimeService` | Lệch đồng hồ chung, kết quả không tái lập |

**Số đo trước và sau**:

| Hạng mục | Trước | Sau |
|---|---|---|
| Mở màn hình Đài quan sát | tràn ngăn xếp | 84/100, hiện đủ, không lỗi console |
| Khái niệm bị coi là chết | 16/16 | 0/16 |
| Độ phủ khái niệm | 0% | 100% |
| Quét chất lượng cả ngân hàng | 4,0 giây | 1,56 giây |
| Gọi lại chỉ số sức khỏe | không chạy được | 41 ms, cùng kết quả |

**Cách cắt vòng đệ quy**: tách `getCoreHealthScores` ra khỏi `getSystemHealthOverview`. Cổng
"sức khỏe hệ thống" trong báo cáo phát hành chấm bằng phần lõi; tự chấm bằng chính kết quả của
mình vốn dĩ vô nghĩa, nên tách ra vừa đúng logic vừa hết vòng.

**Bẫy 2 cắn lần thứ ba trong ngày**, lần này giết `npm run dev`: `aiProvider` nhập
`supabaseClient`, mà file đó đọc thẳng `import.meta.env`, thứ `tsx` không có. Lần này **vá tận
gốc** bằng optional chaining ngay trong `supabaseClient.ts`, nên mọi nơi nhập về sau đều an
toàn, không phải nhớ đặt `define` ở từng công cụ nữa.

**Bộ kiểm**: thêm nhóm **I** với 8 phép kiểm, tổng lên 63. Nhóm này canh đúng chín lỗi trên,
trong đó phép kiểm "chỉ số sức khỏe tính được" sẽ đỏ ngay nếu ai đó dựng lại vòng đệ quy.

**Bài học chung, ghi vào AGENTS.md mục 4.9**: không hiển thị con số chưa đo. Thiếu dữ liệu thì
hiện 0 hoặc không hiện, tuyệt đối không điền số cho đẹp bảng. Và khi đọc một trường trên
`Statistics`, phải kiểm nó có thật trong `types.ts` không; `(stats as any).x` là dấu hiệu điển
hình của trường ma.

**Còn nợ**: ngưỡng cứng thuần túy ở hai engine vẫn còn (39 và 18 chỗ), nhưng đó là chuyện tinh
chỉnh chứ không còn là sai sự thật. Lần quét chất lượng đầu tiên vẫn mất 1,56 giây do bản chất
so từng cặp câu hỏi; muốn nhanh hơn nữa phải đổi thuật toán dò trùng.

---

### 27/07/2026 — Tôi làm chết 3 cổng AI trên bản thật, và chặng kiểm số 6 ra đời từ đó

**Chuyện gì đã xảy ra**: ngay sau khi push lượt "đưa tầng suy luận về trình duyệt", tôi dò lại
bản deploy và thấy `chat`, `recommend`, `complete` đều trả **500**. `npm run check` khi đó xanh
cả 5 chặng, `vercel build` báo đóng gói thành công. Tức là toàn bộ hệ thống kiểm chứng nói
"ổn" trong khi bản thật đang chết.

**Nguyên nhân**: chính là Bẫy 2 đã ghi trong AGENTS.md. Thay đổi của tôi khiến `aiProvider.ts`
nhập `supabaseClient`, mà file đó đọc `import.meta.env`, thứ chỉ Vite mới có.
`scripts/build-vercel.mjs` lúc ấy **không** có `define: { "import.meta.env": "{}" }` như
`scripts/check.mjs` vẫn có. Gói hàm nổ ngay lúc nạp với
`Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')`.

Cổng `generate` sống sót đơn giản vì nó không nhập `aiOrchestrator`. Đó là may, không phải giỏi.

**Đã sửa**: thêm dòng `define` vào `build-vercel.mjs`, đồng bộ với `check.mjs`.

**Thêm chặng 6 vào `npm run check`: nạp thật từng gói hàm trong Node.** Đây mới là phần đáng
giá của mục này. Bài học rút ra: *"đóng gói thành công" không hề đảm bảo gói ấy nạp được*, mà
cả 5 chặng cũ đều chỉ dừng ở mức đóng gói. Chặng 6 nạp đúng cách Vercel nạp.

**Đã chứng minh chặng 6 bắt được lỗi thật**: gỡ tạm dòng `define` ra rồi chạy lại, chặng 6 báo
đỏ đúng ba hàm `chat`, `complete`, `recommend` kèm nguyên văn nguyên nhân, rồi khôi phục.

**Cảnh báo cho người sau**: đừng gỡ dòng `define` trong `build-vercel.mjs`, và đừng gỡ chặng 6.
Cả hai sinh ra từ một sự cố có thật đã đẩy lỗi lên bản người dùng đang chạy.

---

### 27/07/2026 — Đưa tầng suy luận về trình duyệt để môn tự tạo cũng dùng được AI

**Objective**: Đàm xác nhận sẽ **tự bấm thêm môn ngay trong ứng dụng**, không muốn mỗi lần thêm
môn lại phải nhờ dựng file trong mã nguồn rồi deploy. Mà môn tự tạo lưu câu hỏi trong
localStorage, máy chủ không bao giờ thấy, nên gia sư AI không chạy được.

**Đã làm**: bỏ hẳn kiểu "giao diện gửi id, máy chủ tự tra câu hỏi".

- Thêm `functions-src/ai/complete.ts`, cổng chuyển tiếp thuần túy tới Gemini.
- **Xóa hẳn `functions-src/ai/explain.ts`**. Để lại là còn hai nguồn sự thật cho cùng một việc.
- `src/services/ai.ts` chạy `EvidenceBasedPipeline` ngay tại trình duyệt.
- `aiProvider.ts`: `Gemini36FlashProvider.execute` tự phân biệt môi trường.
- `chat.ts` nhận thẳng `subjectId` thay vì dò chữ trong tên môn, vốn nhận nhầm mọi môn mới
  thành Kinh tế chính trị.
- `.claude/launch.json` sửa từ `vite --port 5199` (không có `/api`) sang `npm run dev`.

**Chỗ tôi đã sai, ghi lại để người sau khỏi vấp**: kế hoạch ban đầu dựa trên giả định rằng
`executePipeline` gọi AI qua tham số `aiEngineExecutor`, nên chỉ cần truyền một hàm khác là
chạy được ở trình duyệt. **Giả định đó sai.** Tham số ấy được khai báo nhưng pipeline không hề
gọi, nó gọi thẳng `aiProviderRegistry` ở bước 9. Tôi chỉ phát hiện khi chạy thử thật trên trình
duyệt và nhận `ReferenceError: process is not defined`, vì tầng provider đọc biến môi trường
vốn chỉ có trên máy chủ. Bài học: **đừng tin tên tham số, hãy dò đường đi thật của lời gọi.**

**Nghiệm thu, đây là phần đáng giá nhất**: `npm run check` xanh **không chứng minh được gì** cho
hạng mục này. Bằng chứng thật là chạy trên trình duyệt: dựng một môn tự tạo, làm một câu, bấm
"Nhờ gia sư AI phân tích sâu", và nhận về bài giảng AI đầy đủ dẫn đúng tài liệu lẫn khái niệm
của chính môn đó, không còn chuỗi `(Chế độ ngoại tuyến)`. Đúng đường mà bản cũ hỏng 100%.

**Bộ kiểm**: nhóm H thay ba phép kiểm đọc mã `explain.ts` bằng bất biến tổng quát hơn, **không
hàm serverless nào được nhập dữ liệu môn học**. Đã cố tình thêm một dòng nhập vi phạm vào
`chat.ts` để xác nhận bộ kiểm bắt được và chỉ đúng tên file, rồi khôi phục. Thêm phép kiểm chạy
thật dựng môn tự tạo giả lập rồi bắt pipeline giải thích. Tổng vẫn 55 phép, đạt toàn bộ.

**Còn nợ**: gói giao diện phình từ 526 kB lên 943 kB (phần App) vì pipeline nay nằm trong trình
duyệt. Không sai kết quả, chỉ chậm tải lần đầu, và làm Nợ 3 nặng thêm.

---

### 27/07/2026 — Cổng giải thích AI tra nhầm ngân hàng câu hỏi, hỏng 100% mà không ai biết

**Phát hiện thế nào**: sau khi mở được đường xác thực, `npm run check:prod` cho thấy hai cổng
lạ mắt: `/api/ai/generate` trả 400 và `/api/ai/explain` trả 500. Đáng lẽ có thể bỏ qua vì
"không phải 401 là đã qua cửa xác thực rồi", nhưng dò tiếp thì lòi ra lỗi nặng hơn nhiều.

**Bản chất lỗi**: `functions-src/ai/explain.ts` tra câu hỏi trong `src/data/questions`, tức
ngân hàng của môn Kinh tế chính trị **đã đóng** (60 câu, id 1 đến 60). Trong khi đó
`EvidenceBasedPipeline` ở ngay bước sau lại đọc `questionMap` của môn **đang học** (292 câu,
id 2001 đến 3279). **Hai dải id không giao nhau một id nào.**

Đo trực tiếp trên bản chạy thật, gọi thật với token:

| questionId | Kết quả | Vì sao |
|---|---|---|
| 1, 5, 60 | HTTP 500 | Qua được cửa tra cứu của handler, rồi chết trong pipeline vì questionMap không có id đó |
| 61, 100, 2012 | HTTP 404 | Handler không tìm thấy trong ngân hàng môn đã đóng |

Nghĩa là **"Nhờ gia sư AI phân tích sâu" chưa từng chạy một lần nào** với môn đang học. Nó luôn
ném lỗi, `ai.ts` bắt lỗi rồi trả lời giải ngoại tuyến. Người dùng thấy có nội dung hiện ra nên
tưởng AI đang chạy. Lỗi 401 trước đây che mất chuyện này: mọi thứ chết ở cửa xác thực nên không
ai đi xa đủ để thấy tầng sau cũng hỏng.

**Đã sửa**: handler tra qua `questionMap`, lấy mã môn qua `dbService.getActiveSubjectId()` thay
cho mẹo đoán cũ `q.chapterId <= 6 && q.topicId.startsWith("T")`. Dùng `questionMap` còn đúng bất
biến 4.1: thứ hiển thị cho người học phải là bản đã trộn phương án.

**Kiểm chứng**: tái hiện lỗi trong Node trước khi sửa (pipeline ném đúng câu
`Question ID 1 not found`), và xác nhận pipeline chạy trọn vẹn với id 2001 của môn đang học.

**Thêm nhóm kiểm H, 5 phép, tổng bộ kiểm lên 55**. Nhóm này canh loại lỗi mà bộ kiểm cũ **về
nguyên tắc không thấy được**, vì nó nằm ở chỗ hai nguồn dữ liệu lệch nhau chứ không nằm trong
engine. Có phép kiểm đọc thẳng mã nguồn `explain.ts` để chặn việc ai đó nhập lại ngân hàng cố
định.

**Bài học ghi vào AGENTS.md mục 4.8**: cổng phía máy chủ mà nhập cứng dữ liệu một môn là hỏng
ngay khi đổi môn. Với định hướng đa môn thì đây không phải lỗi lẻ, mà là một khuôn lỗi sẽ lặp
lại ở mọi cổng mới.

**Nghiệm thu trên bản deploy sau khi push** (không suy đoán từ mã nguồn): câu id 2001 và 3279
trả HTTP 200 với `offlineMode: false`, lời giải dài 2769 và 3297 ký tự, không chứa dấu hiệu
ngoại tuyến. Câu id 999 và 2050 trả 404 đúng, vì hai id đó thật sự không có trong ngân hàng.
Nói cho chính xác: chức năng này **từng chạy được** ở thời kỳ môn Kinh tế chính trị còn mở, vì
khi đó ngân hàng mà handler tra và ngân hàng mà pipeline đọc tình cờ là một. Nó chết đúng lúc
đổi sang môn Hành vi khách hàng, và không ai thấy vì lỗi 401 che mất. Đây là lần đầu nó chạy
được với môn đang học.

Đã kiểm luôn `/api/ai/generate` bằng một đoạn tài liệu thật: HTTP 200, sinh đúng 2 câu hỏi, mỗi
câu đủ 4 phương án, có đáp án, có giải thích, gán đúng chương 1 theo yêu cầu.

**Còn nợ**: `/api/ai/generate` trả 400 khi thiếu trường `text` là hành vi ĐÚNG, đã kiểm lại mã
nguồn, không phải lỗi. Nhưng còn một giới hạn thật chưa xử lý: máy chủ luôn nạp môn dựng sẵn
`customer_behavior`, nên các môn do Đàm tự nhập sau này (dữ liệu chỉ nằm trong localStorage của
trình duyệt) sẽ **không giải thích AI được**. Muốn chạy đúng cho môn tự nhập thì giao diện phải
gửi kèm nội dung câu hỏi thay vì chỉ gửi id. Đây là việc lớn, chưa làm, cần Đàm quyết.

---

### 27/07/2026 — Vá đường xác thực cho 4 cổng AI bằng phiên ẩn danh

**Objective**: mở lại 4 cổng `/api/ai/*` trên bản chạy thật, thứ đã chết 401 từ lượt gỡ đăng
nhập. Đàm xếp việc này lên trước mọi khoản nợ engine, lý do: với định hướng đa môn thì sinh câu
hỏi từ tài liệu là đường nạp môn mới, không phải tính năng phụ.

**Đàm chọn hướng 1 trong ba hướng ở Bẫy 1** (phiên ẩn danh), sau khi được trình bày cả cái giá
của hai hướng còn lại. Hướng 2 (bỏ chặn) bị loại vì phơi quota Gemini cho bất kỳ ai biết địa
chỉ; hướng 3 (mã bí mật) bị loại vì vẫn phải vào dashboard mà bảo vệ yếu hơn.

**Đã làm**:

- `src/services/supabaseClient.ts`: thêm `ensureSession()`, chưa có phiên thì tự đăng nhập ẩn
  danh. Gom lời gọi đồng thời vào một lượt bằng `sessionInFlight`; không gom thì màn hình vừa
  mở đã bắn vài lời gọi AI song song và **mỗi lời gọi tạo một người dùng ẩn danh riêng**.
- `src/services/ai.ts`: `apiHeaders()` dùng `ensureSession()` thay `getSession()`. Đây chính là
  chỗ hỏng gốc: không còn màn đăng nhập thì `getSession()` luôn rỗng, nên mọi lời gọi đi ra mà
  không có token.
- `src/main.tsx`: dựng sẵn phiên lúc mở app, **cố ý không chờ** để không làm chậm lúc khởi động.
- `scripts/prodcheck.mjs`: nay kiểm **hai lượt**, không token và có token ẩn danh.

**Cái bẫy đã tránh, người sau đừng gỡ**: `main.tsx` chỉ chạy đồng bộ đám mây khi
`!session.user.is_anonymous`. Trước đây điều kiện chỉ là "có phiên", mà sau thay đổi này thì
gần như luôn có phiên. Để nguyên điều kiện cũ là tự động bật lại đồng bộ đám mây bằng một danh
tính vô danh, trái ý Đàm đã nêu ở Rủi ro 2, và mỗi lần trình duyệt bị xóa dữ liệu lại sinh ra
một tài khoản mới mang theo lịch sử học.

**Vì sao phải sửa cả prodcheck**: sau thay đổi này, 401 ở lượt không token là **đúng**, là hàng
rào đang sống. Script cũ chỉ kiểm lượt không token rồi kết luận "máy chủ đang bắt buộc đăng
nhập, cần xử lý", tức là từ nay nó sẽ báo động giả mãi mãi. Lượt hai gọi thật vào Gemini nên
tốn chút quota, đó là cái giá để biết chắc thay vì suy đoán từ mã nguồn.

**Kiểm chứng**: `npm run check` đạt cả 5 chặng. `npm run check:prod` chạy thật, và **đây là
phần quan trọng nhất của mục này**: lượt không token trả 401 đúng như mong đợi, còn lượt có
token **thất bại** với lý do Supabase trả về nguyên văn `Anonymous sign-ins are disabled`.

**Còn nợ, và nợ này AI không trả được**: Đàm phải tự vào Supabase, mục Authentication, phần
Sign In / Providers, bật **Anonymous sign-ins**. Chừng nào chưa bật thì bản chạy thật y như cũ,
không AI nhưng cũng không vỡ. Bật xong chạy `npm run check:prod`, đủ 4 cổng DAT ở lượt có token
là xong. Đừng tìm cách vá tiếp bằng mã nguồn, không có đường nào khác ngoài công tắc đó.

---

### 27/07/2026 — Bỏ chốt hỏi trước khi push, chuyển sang tự động deploy

**Đã làm**: gỡ `Bash(git push:*)` khỏi mục `ask` sang mục `allow` trong `.claude/settings.json`,
rồi sửa đồng bộ CLAUDE.md, AGENTS.md mục 9 và phần nếp làm việc ở đầu file này.

**Vì sao**: Đàm yêu cầu trực tiếp trong phiên 27/07/2026, nói rõ là khẩn cấp và muốn từ nay
luôn tự động push. Đây là quyết định của chủ dự án, thay quy tắc cũ do chính các phiên trước
đặt ra.

**Hệ quả trần trụi, người sau phải hiểu**: mỗi commit từ nay là một lần deploy thẳng lên
onthidaihocmo.vercel.app, không qua ai duyệt. Trước đây quy trình có hai lớp chặn là bộ tự
kiểm chứng và con người; nay chỉ còn một. Cho nên `npm run check` đổi vai: từ chỗ là lưới an
toàn, nó thành **hàng phòng thủ duy nhất**. Ai nới ngưỡng một phép kiểm cho nó xanh là đang
tháo nốt lớp cuối cùng.

**Điểm yếu chưa vá của cơ chế này**: bộ kiểm chạy hoàn toàn ở máy cục bộ, mà máy cục bộ không
đặt biến Supabase nên các cổng AI **luôn chạy được ở đây kể cả khi chúng chết trên máy chủ**
(đúng cơ chế của Bẫy 1). Vậy nên với thay đổi động tới xác thực, đăng nhập hay hàm serverless,
`npm run check` xanh **không chứng minh được gì cả**, bắt buộc chạy thêm `npm run check:prod`
sau khi push.

**Kiểm chứng**: `npm run check` đạt cả 5 chặng. Lần push trước đó (`638cf60`, tài liệu phạm vi
đa môn) đã đẩy lên `main` thành công.

**Còn nợ**: chưa có cơ chế tự động chạy `check:prod` sau mỗi lần push, vẫn phải nhớ bằng tay.
Đây là chỗ dễ quên nhất trong nếp làm việc mới.

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
