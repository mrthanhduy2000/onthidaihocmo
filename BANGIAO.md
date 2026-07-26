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
Đây là lần đầu tiên chức năng gia sư AI chạy thật trên bản deploy.

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
