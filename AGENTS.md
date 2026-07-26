# AGENTS.md, quy tắc kỹ thuật của dự án

Tài liệu dành cho AI (hoặc lập trình viên) mới vào dự án. Mục tiêu: sửa được và **tự kiểm chứng được**
mà không cần hỏi chủ dự án, không cần đăng nhập, không cần khóa API.

**Trước file này, hãy đọc [WORKSTATE.md](WORKSTATE.md)** để biết dự án đang dở việc gì và bước
tiếp theo là gì. File AGENTS.md chỉ nói quy tắc kỹ thuật, không nói trạng thái công việc.

Mọi con số trong file này đều đo bằng `npm run check` tại thời điểm 26/07/2026, không phải ước lượng.

---

## 1. Một lệnh để biết mình có làm hỏng gì không

```bash
npm run check
```

Chạy 6 chặng, hỏng chặng nào dừng ngay tại đó:

| Chặng | Nội dung | Thời gian |
|---|---|---|
| 1 | Rào bảo mật, quét khóa bí mật lọt vào file đã commit | vài giây |
| 2 | `tsc --noEmit`, kiểm tra kiểu dữ liệu | khoảng 10 giây |
| 3 | **63 phép tự kiểm chứng chạy trên engine thật** | vài giây |
| 4 | `vite build` | khoảng 10 giây |
| 5 | `node scripts/build-vercel.mjs`, đóng gói bản triển khai | khoảng 10 giây |
| 6 | **Nạp thật từng gói hàm serverless trong Node** | vài giây |

Chặng 6 là bài học phải trả giá: "đóng gói thành công" **không** có nghĩa gói ấy nạp được. Ngày
27/07/2026 ba cổng AI chết 500 trên bản thật trong khi cả 5 chặng đầu đều xanh, vì gói nổ ngay
lúc nạp. Chặng 6 nạp đúng cách Vercel nạp nên bắt được loại lỗi đó tại máy.

Các lệnh khác:

```bash
npm run check:fast
```

```bash
npm run check:prod
```

`check:fast` bỏ hai chặng build, hợp cho vòng lặp sửa mã. `check:prod` gọi thẳng bản đã deploy
để phát hiện loại lỗi chỉ xuất hiện trên máy chủ thật (xem mục Bẫy số 1).

Chặng 3 là phần đáng giá nhất: nó **nạp nguyên `src/services/db.ts` và `src/services/ai.ts` vào Node**
rồi sinh đề, chấm điểm, kiểm tra thật. Không phải mô phỏng, không phải kiểm kiểu suông.
Mã nguồn ở `scripts/selftest/harness.ts`, thêm phép kiểm mới rất dễ (xem mục 7).

---

## 2. Chạy ứng dụng

```bash
npm run dev
```

Mở http://localhost:3000. Lệnh này chạy Express (`server.ts`) vừa phục vụ giao diện qua Vite
vừa gắn các API AI, nên **AI hoạt động đầy đủ ở máy cục bộ**.

`.claude/launch.json` nay trỏ đúng vào lệnh này (cổng 3000). Trước 27/07/2026 nó cấu hình
`vite --port 5199`, chỉ phục vụ giao diện và **không có `/api`**, nên ai chạy theo cấu hình đó
sẽ thấy mọi lời gọi AI hỏng và tưởng lỗi nằm ở mã nguồn. Đã sửa, đừng đổi ngược lại.

Ứng dụng **không có màn hình đăng nhập**. Mở lên là dùng được ngay, dữ liệu nằm trong localStorage.

---

## 3. Ứng dụng này thực sự là gì

Ứng dụng luyện thi trắc nghiệm cho một người dùng duy nhất (chủ dự án).

**Phạm vi lâu dài, chủ dự án xác nhận ngày 27/07/2026:** đây là **trung tâm luyện thi và học
tập đa môn**, không phải công cụ dùng một lần cho một kỳ thi. Chủ dự án sẽ còn nạp thêm nhiều
môn và nhiều tài liệu khác trong tương lai. Hệ quả bắt buộc với người sửa mã:

- **Đừng suy ra phạm vi dự án từ tên thư mục.** Tên "luyện thi kinh tế chính trị" là di sản của
  môn đầu tiên, không phải giới hạn của sản phẩm.
- Khi thiết kế, ưu tiên phương án **thêm môn mới mà không phải sửa mã**. Giải pháp nhanh gắn
  cứng cho môn đang mở sẽ phải trả giá ở môn thứ ba, thứ tư.
- Hiện còn **26 chỗ gắn cứng mã môn học** ngoài `src/data/` (`db.ts` 15, `kbService.ts` 6,
  `evidencePipeline.ts` 2, `curriculumIntelligenceEngine.ts` 2, `evidenceCoverageAudit.ts` 1).
  Hai môn thì còn chịu được, nhưng mỗi lần đụng vào các chỗ đó là một cơ hội chuyển dần sang
  khai báo môn bằng dữ liệu. Đo ngày 27/07/2026.
- **Đừng đề xuất gỡ bỏ hay thu hẹp hạ tầng chỉ vì "môn này thi xong rồi".** Đường nhập tài liệu
  và sinh câu hỏi từ tài liệu là chức năng cốt lõi lâu dài, không phải phụ trợ.

- Môn đang hoạt động: **Hành vi khách hàng**, 292 câu hỏi, 7 chương, 22 chủ đề.
- Môn Kinh tế chính trị Mác Lênin **đã đóng vì đã thi xong**. Dữ liệu còn trong `src/data/questions.ts`
  nhưng bị gỡ khỏi danh sách chọn tại `dbService.getSubjects()` ([db.ts:179](src/services/db.ts:179)),
  và mọi trạng thái cũ trỏ vào môn này bị tự chuyển về Hành vi khách hàng ([db.ts:48](src/services/db.ts:48)).
  **Đừng "sửa" hai chỗ đó, đó là chủ ý.**
- Tên thư mục và tên trong tài liệu cũ vẫn là "kinh tế chính trị". Đó là di sản, không phản ánh hiện trạng.

Kiến trúc: React 19 + TypeScript + Vite + Tailwind 4, triển khai trên Vercel qua Build Output API.
Các hàm serverless nằm ở `functions-src/` (không phải `/api`, để Vercel khỏi tự build sai),
được `scripts/build-vercel.mjs` đóng gói thành file CommonJS tự chứa.

Quy mô: 30 component, 46 service. Phần lớn logic nặng nằm ở tầng service.

---

## 4. Bất biến KHÔNG được phá

Đây là các quy tắc đã từng bị vi phạm và gây lỗi thật. Bộ tự kiểm chứng canh gác từng cái.

### 4.1. `questionMap` là bản đã trộn, `questions` là bản gốc

`src/services/db.ts` nạp câu hỏi rồi ghi vào `questionMap` **bản đã trộn thứ tự phương án**
([db.ts:170](src/services/db.ts:170)), còn mảng `questions` giữ nguyên bản gốc.

- **Mọi việc hiển thị và chấm điểm phải đọc từ `questionMap`.** Chấm theo mảng `questions` sẽ ra sai đáp án.
- Việc trộn là **tất định theo id câu hỏi** (`src/services/optionShuffle.ts`), nên lịch sử làm bài cũ
  vẫn chấm đúng sau khi tải lại trang. Đừng thay bằng `Math.random()`.
- Lý do phải trộn, đo được: ngân hàng gốc lệch rất nặng, đáp án **B chiếm 156/292 câu (53%)**
  còn **D chỉ 8 câu (2,7%)**. Học viên đoán mò chọn B là trúng nửa số câu. Sau khi trộn,
  bốn vị trí về mức 68 đến 85 câu.

### 4.2. `optionShuffle` cố tình bỏ qua một số câu

Trộn phương án đồng nghĩa phải viết lại các chữ cái trong lời giải thích ("phương án b sai vì...").
Nhưng lời giải còn chứa chữ cái KHÔNG phải mã phương án: "C.Mác", "thương hiệu A, B, C", "ký hiệu là c".
Viết lại bừa sẽ làm hỏng nội dung học thuật.

Nên `findOptionLetterIndices` chỉ trộn khi phân loại được **toàn bộ** chữ cái đứng lẻ trong lời giải.
Còn một chữ cái không phân loại nổi thì **trả câu hỏi về nguyên trạng**. Hiện có **14/292 câu** rơi vào
diện giữ nguyên. Đó là an toàn có chủ ý, không phải lỗi.

### 4.3. Ràng buộc đề không được rò rỉ

Đề theo chương chỉ được chứa câu của chương đó, đề theo mức độ chỉ chứa câu đúng mức độ đó.
Khi lọc ra rỗng thì **không được** lấy bù từ toàn bộ ngân hàng, nếu không đề sẽ dán nhãn sai.
Danh sách loại đề bị ràng buộc nằm trong biến `constrainedTypes` ở `src/services/ai.ts`.

### 4.4. Hai cơ chế ôn tập đang cùng chạy, đừng gỡ nhầm cái nào

Với đề `type: "random"` (nút "Giải đề ngẫu nhiên tổng hợp"):

1. **Ưu tiên ôn tập**: xếp câu TỪNG SAI trước, rồi câu CHƯA LÀM, rồi câu ĐÃ ĐÚNG.
2. **Chống lặp**: danh sách 80 câu vừa ra gần đây (`poly_econ_recent_served_*` trong
   `src/services/workspaceService.ts`) bị đẩy xuống cuối.

Đo được: ngay sau khi đánh dấu sai, **7,0/7 câu sai quay lại** trong đề 20 câu, tức cơ chế ưu tiên
chạy đúng. Khi làm liên tục nhiều đề thì con số này tụt xuống, và **đó là đúng chủ ý**: danh sách 80 câu
giãn cách chúng ra khoảng 4 đề rồi mới cho gặp lại, đúng tinh thần lặp lại giãn cách.

Nếu ai đó thấy "câu sai không quay lại ngay" rồi tưởng là lỗi và gỡ cơ chế chống lặp, người đó vừa
phá một tính năng đang chạy đúng. Bộ tự kiểm chứng in cả hai con số để tránh hiểu nhầm này.

### 4.5. Một bộ tra cứu khái niệm duy nhất

`kbService.resolveConceptsForQuestion` là nơi DUY NHẤT quy câu hỏi về khái niệm trong đồ thị
tri thức. Nó chấm độ gần gũi bằng chủ đề (0,50) cộng chương (0,20) cộng tương đồng từ vựng
Jaccard (0,30), rồi xếp hạng và cắt ngưỡng 0,20.

Trước đây có ba bản tra cứu khác nhau và cả ba đều sai theo kiểu riêng: bản khớp tuyệt đối
trong `learningEngine` cho 0/292 câu, bản dùng `includes` trong `kbService` khớp bừa, bản
trong `db.recomputeStatistics` khớp hai chiều làm nhòe mọi khái niệm vào nhau. **Đừng viết
bản thứ tư.** Cần logic khác thì sửa hàm này và chạy lại `npm run check`.

### 4.5b. Tầng quan sát cũng phải đi qua bộ tra cứu đó

Ngày 27/07/2026 phát hiện `productObservabilityService` tự khớp khái niệm bằng
`q.concept === node.concept`. Đo được: **0 trên 292 câu khớp**, dù 280 câu có điền trường
`concept`. Hệ quả là bảng điều khiển báo **16/16 khái niệm đã chết** và độ phủ khái niệm luôn
**0%**, tức toàn bộ màn hình nói sai sự thật một cách trơn tru.

Nay mọi phép đếm câu theo khái niệm ở file đó đi qua hàm `demCauTheoKhaiNiem`, và hàm này gọi
`kbService.resolveConceptsForQuestion`. Sau khi sửa: 0/16 khái niệm chết, độ phủ 100%.

Đây là **bản tra cứu thứ tư** bị phát hiện. Ba bản trước đã nêu ở mục 4.5. Nếu thấy ở đâu đó
một phép so khái niệm tự chế, gần như chắc chắn nó sai.

### 4.6. Độ thành thạo khái niệm: một giá trị, hai khóa

Bảng `stats.conceptMastery` lưu mỗi khái niệm dưới CẢ HAI khóa (mã `CB_C1_N1` và tên đầy đủ)
với cùng một giá trị. Mọi chỗ ghi phải đi qua `setConceptMasteryBothKeys` trong `db.ts`.
Nếu chỉ ghi một khóa, nơi đọc sẽ lấy trúng con số cũ của khóa kia và mô hình học sai lệch âm
thầm. Bộ tự kiểm chứng canh bất biến này.

Quy ước giá trị: **50 nghĩa là chưa có căn cứ**, không phải học kém. Khái niệm chưa làm câu
nào phải là 50, và độ thạo được co về 50 theo lượng bằng chứng
(`w = 1 - e^(-soCauDaLam/6)`), nên đúng 3/3 câu cho khoảng 73 chứ không phải 100. Việc co này
chỉ được làm ĐÚNG MỘT LẦN tại nguồn; co thêm ở nơi đọc sẽ nén phẳng tín hiệu.

### 4.7. Xếp hạng phải tất định

Không bao giờ gọi `Math.random()` bên trong hàm so sánh của `sort`. Hàm so sánh phải phản
đối xứng và bắc cầu; rút ngẫu nhiên trong lúc so vi phạm cả hai, làm kết quả tùy tiện và
không tái lập được. Muốn có biến thiên thì rút nhiễu MỘT lần cho mỗi phần tử (xem `jitter01`
và `adaptiveSeed` trong `ai.ts`), rồi sắp xếp bằng hàm thuần túy có mốc phân giải hòa theo id.

### 4.8. Máy chủ KHÔNG giữ dữ liệu môn học, tầng suy luận chạy ở trình duyệt

Đây là bất biến quan trọng nhất cho định hướng đa môn. Hai lần sửa trong ngày 27/07/2026 mới
đi tới nó.

**Lần một** phát hiện `functions-src/ai/explain.ts` nhập thẳng `src/data/questions`, tức ngân
hàng của môn **đã đóng**. Đo được: môn đang học có id **2001 đến 3279**, ngân hàng cũ có id
**1 đến 60**, hai dải **không giao nhau một id nào**, nên "Nhờ gia sư AI phân tích sâu" trả 404
với **mọi** câu hỏi thật.

**Lần hai** nhận ra vá như vậy vẫn chưa đủ: môn do người dùng tự tạo trong ứng dụng lưu câu hỏi
ở `localStorage` (`poly_econ_custom_questions_<id>`), máy chủ **không bao giờ** thấy được. Nên
cổng `explain` đã bị **xóa hẳn**. Kiến trúc hiện tại:

| Chạy ở đâu | Làm gì |
|---|---|
| Trình duyệt | Chạy trọn `EvidenceBasedPipeline`, nơi duy nhất biết môn nào đang mở |
| Máy chủ | Chỉ còn `/api/ai/complete`, nhận lời nhắc rồi chuyển tiếp cho Gemini |

`Gemini36FlashProvider.execute` ([aiProvider.ts](src/services/aiProvider.ts)) tự phân biệt môi
trường: ở Node thì đọc `process.env.GEMINI_API_KEY` gọi thẳng Gemini, ở trình duyệt thì gọi
`/api/ai/complete`. **Phép đọc `process.env` phải nằm hẳn trong nhánh Node**, để ngoài là ném
`ReferenceError: process is not defined` ngay khi mở trang.

Ba điều cấm:

1. **Đừng nhập dữ liệu môn học vào bất kỳ hàm serverless nào.** Nhóm kiểm **H** quét toàn bộ
   `functions-src/` và bắt được vi phạm, đã thử phá để xác nhận.
2. **Đừng dựng lại cổng tra câu hỏi theo id trên máy chủ.** Đó chính là kiến trúc vừa gỡ bỏ.
3. **Đừng cho giao diện gửi chỉ dẫn hệ thống lên.** `complete.ts` tự ghép
   `AUTHORITATIVE_KNOWLEDGE_SYSTEM_INSTRUCTION`, đây là rào an toàn nội dung duy nhất còn lại
   sau khi lời nhắc chuyển sang do giao diện dựng.

Cạm bẫy đã ghi nhận: tham số `aiEngineExecutor` của `executePipeline` là **mã chết**, pipeline
không hề gọi nó mà gọi thẳng `aiProviderRegistry` ở bước 9. Đừng tin vào tên tham số, hãy dò
đường đi thật.

### 4.9. Không hiển thị con số chưa đo

Ngày 27/07/2026 tìm thấy bốn chỗ nói với người học một con số chưa từng được tính:

| Chỗ | Bịa cái gì |
|---|---|
| `curriculumIntelligenceEngine` khoản nợ Bloom | Khẳng định "tỷ lệ Vận dụng chưa đạt 30%" mà không hề đo, đẩy ra cho mọi người học có hơn 30 câu |
| `curriculumIntelligenceEngine.studyBalance` | Trả về cứng 45/35/20 phần trăm như thể đó là phân bố của chính người học |
| `CurriculumDashboard` đếm ngược kỳ thi | Ghi cứng "12 Ngày" trong giao diện, trong khi Bàn học hiện 14 ngày từ ngày thi thật |
| `detectStudyDebt` nợ theo chương | Đọc `stats.solvedQuestionIds`, trường KHÔNG tồn tại, nên luôn báo mọi chương "chưa từng luyện tập" |

Quy tắc: **thiếu dữ liệu thì hiện 0, hiện "chưa đủ dữ liệu", hoặc không hiện gì cả.** Tuyệt đối
không điền số cho đẹp bảng. Nhóm kiểm **I** canh bốn chỗ này.

Kèm theo: khi đọc một trường trên `Statistics`, hãy kiểm tra nó có thật trong `src/types.ts`
không. `(stats as any).tenTruong` là dấu hiệu điển hình của trường ma.

### 4.10. Khóa câu đã trả lời ở chế độ gia sư

`PracticeView.tsx` giữ `lockedIds`: câu đã trả lời trong chế độ gia sư bị khóa vĩnh viễn,
kể cả khi người dùng tắt công tắc gia sư. Không có nó thì có thể xem đáp án đúng rồi tắt công tắc,
chọn lại và tự thổi phồng điểm.

---

## 5. Bẫy đã biết

### Bẫy 1 (quan trọng nhất): build xanh không có nghĩa bản deploy còn sống

Máy chủ bắt buộc token đăng nhập Supabase khi có biến môi trường `SUPABASE_URL` và `SUPABASE_ANON_KEY`,
nhưng **tự động cho qua khi không có hai biến đó** ([functions-src/_lib/auth.ts:14](functions-src/_lib/auth.ts:14)).

Hệ quả trần trụi:

- Máy cục bộ thường không đặt hai biến này, nên AI **luôn chạy được**.
- Trên Vercel hai biến này có, mà giao diện thì đã gỡ đăng nhập, nên **không gửi token** và mọi cổng AI trả **401**.

**Cập nhật 27/07/2026: đã vá bằng phiên ẩn danh, nhưng cần một công tắc phía Supabase.**

Chủ dự án chọn hướng 1 trong ba hướng bên dưới. `src/services/supabaseClient.ts` nay có
`ensureSession()`: chưa có phiên thì tự đăng nhập ẩn danh để lấy token, người dùng không phải
nhập gì. `ai.ts` gọi hàm này thay cho `getSession()`, `main.tsx` dựng sẵn phiên lúc mở app.

**Điều kiện bắt buộc, chưa xong thì vá vô nghĩa**: bật "Anonymous sign-ins" trong Supabase
(Authentication, mục Sign In / Providers). Chưa bật thì Supabase trả thẳng
`Anonymous sign-ins are disabled`, `ensureSession()` trả null và ứng dụng chạy ngoại tuyến
đúng như trước, không vỡ nhưng cũng không có AI. Đo lúc 27/07/2026: công tắc **đang tắt**.

Hai điều người sau phải nhớ:

- **Phiên ẩn danh KHÔNG được dùng làm danh tính đồng bộ đám mây.** `main.tsx` chặn bằng
  `!session.user.is_anonymous`. Bỏ chốt đó là đẩy lịch sử học lên một tài khoản vô danh mới
  mỗi lần trình duyệt bị xóa dữ liệu.
- **401 khi gọi không kèm token là ĐÚNG, không phải hỏng.** `npm run check:prod` nay chạy hai
  lượt: không token phải 401 (hàng rào còn sống), có token ẩn danh phải khác 401 (ứng dụng
  dùng được). Chỉ nhìn lượt đầu rồi kết luận là sai lầm đã từng mắc.

Trạng thái đo ngày 26/07/2026 trên https://onthidaihocmo.vercel.app: cả 4 cổng `/api/ai/*` đều trả 401.
Giao diện **không báo lỗi**, nó âm thầm rơi về chế độ ngoại tuyến:

| Tính năng | Biểu hiện khi bị 401 |
|---|---|
| Nhờ gia sư AI phân tích sâu | Trả lời giải có sẵn trong dữ liệu, không phải AI |
| Hỏi đáp AI | Một câu trả lời mẫu cố định |
| Gợi ý học tập | Rơi về công thức tính cục bộ |
| Sinh câu hỏi từ tài liệu | Báo lỗi thẳng "Bạn cần đăng nhập" |

Muốn AI sống lại trên bản deploy, chọn một trong ba hướng:

1. **Bật đăng nhập ẩn danh Supabase** rồi cho `src/main.tsx` tự tạo phiên ẩn danh. Không cần màn đăng nhập,
   quota vẫn được bảo vệ. Đây là hướng sạch nhất.
2. **Xóa `SUPABASE_URL` và `SUPABASE_ANON_KEY` khỏi Vercel** để `requireUser` cho qua. Nhanh nhất,
   nhưng cổng AI thành công khai, ai biết địa chỉ cũng tiêu được quota Gemini.
3. **Thêm mã bí mật dùng chung** giữa giao diện và máy chủ. Chỉ chặn được người vô tình,
   ai đọc mã nguồn bundle vẫn moi ra được.

Luôn chạy `npm run check:prod` sau khi động vào xác thực hoặc đăng nhập.

### Bẫy 2: `import.meta.env` làm chết mọi script chạy ngoài Vite

`src/services/supabaseClient.ts` đọc `import.meta.env`, thứ chỉ Vite mới có. Vì vậy `tsx some-script.ts`
sẽ nổ ngay khi lỡ import gián tiếp tới nó (`ai.ts` có import).

Cách xử lý: đóng gói bằng esbuild với `define: { "import.meta.env": "{}" }`. Cách này có trong
`scripts/check.mjs` **và** `scripts/build-vercel.mjs`. Cứ theo đó cho mọi script chạy engine
ngoài trình duyệt.

**Bẫy này đã cắn BA LẦN trong đúng một ngày (27/07/2026), đọc kỹ.** `build-vercel.mjs` khi đó
**chưa** có dòng `define`. Chỉ cần một thay đổi khiến `aiProvider.ts` nhập gián tiếp tới
`supabaseClient` là ba hàm `chat`, `recommend`, `complete` nổ ngay lúc nạp và trả 500 trên bản
thật, trong khi `npm run check` vẫn xanh toàn bộ và `vercel build` vẫn báo đóng gói thành công.
Lần thứ ba nó giết luôn `npm run dev`, vì `tsx` cũng không có `import.meta.env`.

**Đã vá tận gốc**: `src/services/supabaseClient.ts` nay đọc qua
`const bienMoiTruong = (import.meta as any)?.env ?? {}`. Nhờ vậy file này an toàn ở mọi môi
trường và mọi nơi nhập về sau không phải nhớ đặt `define` nữa.

Ba thứ đừng gỡ: dòng `define` trong `build-vercel.mjs`, chặng 6, và optional chaining trong
`supabaseClient.ts`. Cả ba sinh ra từ cùng một sự cố có thật.

### Bẫy 3: localStorage ngoài trình duyệt

`db.ts` tự gắn localStorage giả lập khi không thấy trình duyệt ([db.ts:6](src/services/db.ts:6)),
nên engine chạy được trong Node. Đừng gỡ đoạn đó, bộ tự kiểm chứng dựa vào nó.

### Bẫy 4: dữ liệu chỉ nằm trên một trình duyệt

Không còn đăng nhập nên không còn đồng bộ đám mây. Toàn bộ lịch sử học nằm trong localStorage của đúng
một trình duyệt, tiền tố khóa là `poly_econ_*`. Xóa dữ liệu duyệt web là mất sạch.
Có nút sao lưu thủ công trong Cài đặt (`src/components/ProductSettingsModal.tsx`). Chủ dự án đã chọn
giữ cách bấm tay, **đừng tự ý thêm đồng bộ hay đăng nhập trở lại nếu không được yêu cầu**.

### Bẫy 5: hai hàm gọi vòng nhau, build vẫn xanh, màn hình vẫn chết

`productObservabilityService.getSystemHealthOverview` từng gọi `getReleaseReadinessReport`, còn
hàm đó gọi ngược lại `getSystemHealthOverview`. Vòng gọi vô hạn, nên **mọi lần mở màn hình Đài
quan sát đều tràn ngăn xếp**. Không chặng kiểm nào bắt được: kiểu dữ liệu đúng, build đúng, và
bộ tự kiểm chứng khi đó không hề gọi tới engine này.

Cách đã dùng để cắt vòng: tách phần lõi ra thành `getCoreHealthScores`, hàm không phụ thuộc vào
mức sẵn sàng phát hành. Bên nào cần chấm sức khỏe thì gọi phần lõi.

Bài học chung: **một engine không có phép kiểm nào chạm tới thì coi như chưa từng được chạy.**
Trước khi tin một engine còn sống, hãy gọi thử nó trong `harness.ts`.

### Bẫy 6: không bao giờ đặt khóa thật vào `.env.example`

File đó bị commit. Đã từng lộ một khóa Gemini theo đúng cách này. Chặng 1 của `npm run check`
canh mẫu khóa Google AI, JWT Supabase và khóa OpenAI trong mọi file đã commit.

---

## 6. Tài liệu cũ trong repo KHÔNG đáng tin

Các file sau viết ngày 21/07/2026 cho phiên bản môn Kinh tế chính trị và **đã lạc hậu nặng**:
`README.md`, `ARCHITECTURE.md`, `DATA_FLOW.md`, `DATABASE.md`, `TECH_DEBT.md`, `TEST_PLAN.md`,
`ROADMAP.md`, `CHANGELOG.md`.

Chúng còn ghi 60 câu hỏi, 6 chương, React 18, Gemini 3.5, và mô tả một môn học đã đóng.
Mỗi file đã được gắn cảnh báo ở đầu. Khi có mâu thuẫn, **tin file AGENTS.md này và tin mã nguồn**,
đừng tin tài liệu cũ. `DEPLOY.md` mới hơn và cơ bản còn đúng, trừ phần đăng nhập đã bị gỡ.

---

## 7. Thêm phép kiểm mới

Mở `scripts/selftest/harness.ts`, dùng đúng hai hàm có sẵn:

```ts
check("Mô tả điều kiện bắt buộc", dieuKienDung, "chi tiết kèm số liệu");
info("Số liệu chỉ để tham khảo, không làm hỏng bộ kiểm");
```

Nguyên tắc:

- Một phép kiểm phải **hỏng được**. Nếu không nghĩ ra cách nó hỏng thì nó vô dụng.
- Không phụ thuộc mạng, không phụ thuộc dữ liệu riêng trên máy chủ dự án.
- Đặt ngưỡng theo hành vi **đã đo**, đừng đoán. Đo trước, đặt ngưỡng sau.
- Nếu một phép kiểm hỏng, hãy nghi ngờ phép kiểm trước khi nghi ngờ mã nguồn.
  Trong đợt viết file này, phép kiểm đầu tiên về "ưu tiên câu sai" báo hỏng, hóa ra ngưỡng đặt sai
  chứ mã nguồn đúng.

---

## 8. Quy ước khi viết mã trong repo này

- **Toàn bộ giao diện và chú thích mã dùng tiếng Việt.** Không chèn tiếng Anh vào câu tiếng Việt.
- **Không dùng dấu gạch ngang dài** trong văn bản hiển thị cho người dùng.
- Chú thích nên giải thích **vì sao**, nhất là chỗ trông có vẻ thừa nhưng đang vá một lỗi thật.
  Mã nguồn hiện tại theo phong cách đó, hãy giữ nguyên.

## 9. Commit và bàn giao

**Làm xong việc thì TỰ COMMIT, không hỏi.** Chủ dự án đã ủy quyền thường trực từ 26/07/2026;
quyền mở sẵn trong `.claude/settings.json`. Bắt buộc theo đúng thứ tự:

1. `npm run check` phải ĐẠT toàn bộ. Không bao giờ commit khi đang đỏ.
2. Soát `git status`, không để file rác hay file gỡ rối lọt vào.
3. Thông điệp commit nêu rõ **đổi gì và vì sao**, không chỉ liệt kê tên file.
4. Ghi một mục mới vào [BANGIAO.md](BANGIAO.md). Đây là bước dễ quên nhất và cũng là bước
   giúp phiên sau hiểu được bối cảnh mà lịch sử git không nói ra.
5. Nếu thay đổi động tới nếp làm việc thì cập nhật luôn file này và `CLAUDE.md`, đừng để
   ba file hướng dẫn nói ba kiểu khác nhau.

6. **`git push` lên `main` cũng tự làm, không hỏi.** Chủ dự án ủy quyền thường trực từ
   27/07/2026, thay quy tắc cũ vốn bắt phải hỏi. Quyền đã mở trong `.claude/settings.json`.

**Cảnh báo đi kèm quyền push:** đẩy lên `main` là deploy thật lên onthidaihocmo.vercel.app,
tức đổi ngay bản người dùng đang chạy. Sau bước này **không còn chốt chặn nào của con người**,
nên chặng `npm run check` ở bước 1 là hàng phòng thủ duy nhất. Đừng bao giờ nới lỏng nó, đừng
bỏ qua một phép kiểm đang đỏ vì "chắc là phép kiểm sai".

Sau khi push mà thay đổi có động tới xác thực, đăng nhập hoặc hàm serverless, **bắt buộc chạy
`npm run check:prod`** rồi báo kết quả cho chủ dự án. Đây chính là loại lỗi mà Bẫy 1 mô tả:
build xanh ở máy cục bộ nhưng chết trên máy chủ, và giờ nó lên thẳng bản chạy thật không qua
ai duyệt.
