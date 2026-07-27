# WORKSTATE.md, điểm kiểm tra sống của dự án

File này là **ảnh chụp trạng thái làm việc hiện tại**. Một AI mất sạch ngữ cảnh chỉ cần đọc file
này là tiếp tục được ngay, không phải dò lại từ đầu.

Đọc kèm: [AGENTS.md](AGENTS.md) cho bất biến kỹ thuật, [BANGIAO.md](BANGIAO.md) cho lịch sử
quyết định.

**Cập nhật lần cuối**: 27/07/2026, sau lượt nâng độ chính xác dự báo.

---

## Trạng thái tổng quát

| Mục | Giá trị |
|---|---|
| **Current Objective** | Không có việc đang làm dở |
| **Current Milestone** | Nâng độ chính xác dự báo, **ĐÃ HOÀN THÀNH** cả hai phần |
| **Current Phase** | Dừng ở ranh giới commit sạch |
| **Completed %** | 100% phần đã nhận làm, kiểm chứng cả trong Node lẫn trên trình duyệt |
| **Git** | `main` khớp `origin/main`, cây làm việc sạch |
| **Bản đang chạy thật** | Sáu lượt push gần nhất: `1cb3787`, `c409520`, `9d6eb3a`, `ade2809`, `bf02448`, `068c769` |

**Safe Resume Point**: bất kỳ lúc nào. Không có việc dở dang, không có nhánh phụ.

---

## Lượt mới nhất: nâng độ chính xác dự báo

Chủ dự án yêu cầu nâng độ chính xác của dự đoán cá nhân hóa. Dò trước rồi mới đề xuất, và tìm ra
hai thứ, mỗi thứ một commit.

**1. Bộ dự báo tự xưng "tự hiệu chuẩn" chưa từng hiệu chuẩn lần nào** (nhóm kiểm **R**).
`registerActualExamResult` có **0 nơi gọi**, nên `calibrationCount` vĩnh viễn bằng 0, mà nhánh
thích nghi lại yêu cầu `>= 2`. Đã dựng `doHieuChuanTuLichSu` tính lại tất định từ lịch sử thật.
Đo được: hồ sơ đúng 90% cho sai lệch **+0,9 điểm**, tức hệ thống tự phát hiện nó đang hạ điểm.

**2. Nén dự báo về giữa** (nhóm kiểm **S**). Đây là phần đáng giá hơn:

| Năng lực thật | Trước | Sau |
|---|---|---|
| 20% | **+0,5** | −0,2 |
| 80% | **−0,7** | −0,2 |
| 100% | −0,6 | −0,2 |
| Lệch lớn nhất | 0,7 | **0,3** |
| Lệch trung bình | 0,44 | **0,22** |
| **Độ dốc** | **0,66** | **1,00** |

Ba nguyên nhân, ba loại lỗi khác nhau: độ phủ chương trình bị gộp vào phần định mức điểm dù độ
dốc bằng 0 (nhầm loại đại lượng), trung bình có trọng số của các đại lượng dốc dưới 1 (sai cấu
trúc, đã đổi sang **neo cộng hiệu chỉnh**), và phạt nợ theo số tuyệt đối nên người luyện nhiều bị
phạt kịch trần (đếm trùng với tỷ lệ đúng).

**Bài học phương pháp, đáng giữ**: hai lượt thử đầu đều làm chỉ số tổng **xấu đi** (0,42 rồi
0,50 rồi 0,56) nhưng đổi **hình dạng** của lỗi từ nén thành lệch đều, và chính điều đó chỉ ra thủ
phạm còn lại. Một thay đổi làm chỉ số xấu đi vẫn có thể là bước đúng, miễn là **không dừng và đẩy
đi ở giữa chừng**.

---

## Lượt trước đó: nối mạch dữ liệu bị bỏ không

Ba lượt trước hỏi "chỗ nào đang bịa số". Lượt này hỏi câu khác: **ứng dụng đang ghi dữ liệu gì mà
không engine nào đọc?** Bốn mạch đã nối, mỗi mạch một commit riêng:

| Mạch | Dữ liệu vốn nằm không | Trước | Sau |
|---|---|---|---|
| Cảnh báo bẫy hiểu sai (nhóm **N**) | `commonMistakes` và `teaching.misconception`, 16/16 khái niệm | Khi trả lời ĐÚNG, 0/30 câu mẫu có cảnh báo riêng | **30/30**, 15 nội dung khác nhau |
| Cờ nghi vấn (nhóm **O**) | `attempt.flags`, 0 nơi đọc | `behaviorUncertainty` chỉ là hàm của số câu đã làm | Cùng 80 câu cùng tỷ lệ đúng: **0,240 so với 0,120** tùy chỗ đặt cờ |
| Nhịp làm bài (nhóm **P**) | `estimatedTime` 292/292 câu, `attempt.timeSpent` | `guessingFrequency` luôn bằng 0 | Nhanh mà đúng **5,0%**, nhanh mà sai **70,0%** |
| Tiên nghiệm lịch ôn (nhóm **Q**) | `estimatedRetentionDifficulty`, `firstReviewDays` | Mọi khái niệm chưa học đều **6,15 ngày** | **6 giá trị**, dải 4,24 đến 7,82 ngày |

**Nguyên tắc đã dùng, giữ cho lượt sau:**

1. **Đo độ dày dữ liệu TRƯỚC khi viết code.** Dữ liệu rỗng thì dừng và ghi lại, không xây tầng
   suy luận trên hư không. Cả bốn mạch đều đo trước, và mạch nào cũng có số đo trong BANGIAO.
2. **Thiếu dữ liệu thì trả "chưa đủ dữ liệu", không trả một con số cho đẹp.** Ba tầng mới đều có
   cờ `duDuLieu` và có phép kiểm canh đúng trạng thái đó.
3. **Chỉ một cách co theo lượng bằng chứng trong cả dự án**: `w = 1 - e^(-n/6)`. Cùng hằng số 6 ở
   `db.recomputeStatistics`, `learnerModelService` và `conceptMemoryService`.
4. **Chuỗi mẫu sinh tự động KHÔNG phải kiến thức.** Nút tổng hợp của môn tự tạo có đủ trường chữ
   nhưng chỉ là mẫu ghép tên khái niệm, nên bị loại khỏi mọi chỗ dùng làm bằng chứng học thuật.
   Cờ nhận dạng là `laNutTongHop`.

**Hai bài học về chính bộ kiểm, đáng đọc:**

- **Một phép kiểm ngừng chạy cũng nguy hiểm như một phép kiểm sai.** Tổng số từng tụt từ 103 xuống
  102 mà không ai báo gì, vì phép kiểm bất biến 4.1 nằm trong `if` chỉ đúng khi câu đầu tiên của
  đề tình cờ bị trộn đổi đáp án. Nên **so danh sách TÊN phép kiểm trước và sau mỗi lượt sửa**.
- **Phép kiểm dựa vào trạng thái tích lũy của cả chuỗi nhóm trước là mong manh.** J5 từng đỏ chỉ
  vì thành phần đề đổi. Nay nó dựng thẳng hồ sơ đảm bảo phân hóa.

---

## Ba lượt trước đó nói về cùng MỘT họ lỗi

Đáng đọc kỹ, vì đây là họ lỗi phổ biến nhất trong dự án này và gần như chắc chắn còn chỗ chưa
tìm ra: **trình bày một hằng số viết tay như thể đó là kết quả đo được.**

Loại này không bao giờ báo lỗi, không sai kiểu dữ liệu, không nổ ngoại lệ. Nó chỉ lặng lẽ làm
mọi kết luận phía sau thành vô nghĩa, trong khi màn hình trông vẫn hoàn toàn bình thường.

| Lượt | Tìm ra | Nhóm kiểm canh |
|---|---|---|
| 1. Màn Kế hoạch học | 7 con số bịa, và trường `bloomLevel` rỗng 292/292 câu | **J**, **K** |
| 2. Gắn cứng mã môn học | 3 chỗ cho ra số liệu của môn khác khi có từ hai môn | **L** |
| 3. Quét rộng toàn ứng dụng | 6 con số bịa nữa ở 5 file khác nhau | **M** |

**Hai công cụ để tìm tiếp, cả hai đều cần:**

1. **Bộ quét bằng số**: cho engine chạy trên 5 hồ sơ học khác hẳn nhau (đúng 0%, 25%, 50%, 75%,
   100%), trải phẳng đầu ra, lọc ra trường **số** nào không đổi qua cả 5 lượt. Cách viết cụ thể
   nằm ở AGENTS.md mục 4.9b.
2. **Mở màn hình ra xem**: trong cùng một ngày, **hai** lỗi lọt qua toàn bộ 90+ phép kiểm và chỉ
   lộ ra khi nhìn giao diện thật (sổ nợ xếp chương ngược từ 7 về 1, và dòng "tăng Retention từ
   63% lên 89%" nằm cứng trong `StatsView`). Chạy `npm run dev` rồi đọc bằng mắt.

---

## Số liệu đã kiểm chứng bằng cách đọc code

| Hạng mục | Số liệu thật |
|---|---|
| Câu hỏi trong ngân hàng | 292 |
| Chương | 7 |
| Chủ đề | 22 |
| Component | 30 file |
| Service | 46 file |
| Phép tự kiểm chứng | **131**, chia 19 nhóm A đến S, đạt toàn bộ |
| Môn đang hoạt động | Hành vi khách hàng (`customer_behavior`) |
| Môn đã đóng | Kinh tế chính trị (`poli_econ`), đã thi xong, cố ý gỡ khỏi danh sách |

---

## Phạm vi dài hạn của dự án

Chủ dự án xác nhận ngày 27/07/2026: đây là **trung tâm luyện thi và học tập đa môn dùng lâu
dài**, sẽ còn nạp thêm nhiều môn và nhiều tài liệu khác. Tên thư mục là di sản của môn đầu tiên.

Ba chỗ gắn cứng mã môn **nguy hiểm nhất đã xử lý** (xem AGENTS.md mục 3). Cách phân loại khi
gặp chỗ gắn cứng mới: hỏi xem với môn khác nó *trả về ít hơn* hay *trả về của môn sai*. Loại
thứ nhất ghi nợ được, loại thứ hai phải sửa ngay.

Đường nạp môn mới đã thông: sinh câu hỏi từ tài liệu chạy được, môn tự tạo dùng được gia sư AI
(AGENTS.md mục 4.8), và nay độ thạo khái niệm ghi đủ hai khóa cho mọi môn (nhóm kiểm **L**).

---

## Bản đồ mức độ tin cậy của tài liệu

**Chỉ tin 5 file này**: `AGENTS.md`, `CLAUDE.md`, `BANGIAO.md`, `WORKSTATE.md` (file này),
`DEPLOY.md`.

**Không tin 8 file này**, chúng viết cho môn Kinh tế chính trị đã đóng, số liệu sai hết:
`README.md`, `ARCHITECTURE.md`, `DATA_FLOW.md`, `DATABASE.md`, `TECH_DEBT.md`, `TEST_PLAN.md`,
`ROADMAP.md`, `CHANGELOG.md`. Mỗi file đã gắn cảnh báo ở dòng đầu.

Khi tài liệu mâu thuẫn với code thì **code thắng**. Cập nhật tài liệu, không lùi code.

---

## Technical Debt

Ghi nhận qua khảo sát, **cố ý chưa xử lý**. Không tự ý dọn nếu chưa được giao.

### Nợ 1: Mã chết, khoảng 1.180 dòng không nơi nào dùng tới

| Loại | File | Dòng |
|---|---|---|
| Service mồ côi | `src/services/importPipeline.ts` | 187 |
| Service mồ côi | `src/services/validation.ts` | 232 |
| Component không được render | `src/components/AssessmentDesignDashboard.tsx` | 321 |
| Component không được render | `src/components/Dashboard2Widgets.tsx` | 382 |
| Component không được render | `src/components/DashboardClock.tsx` | 61 |

Thêm 19 hàm và hằng được export nhưng không ai dùng, trong đó **8 engine nằm trong
`evidencePipeline.ts`**. File này 839 dòng nhưng bên ngoài chỉ dùng đúng hai kiểu dữ liệu. Nhiều
khả năng đây là cả một tầng kiến trúc dựng sẵn rồi chưa bao giờ đấu nối. Tham số
`aiEngineExecutor` của `executePipeline` cũng là mã chết và **đã từng làm hỏng một lượt sửa** vì
tên của nó khiến người đọc tin là có thể thay đường gọi AI qua đó.

**Rủi ro nếu để nguyên**: người sau đọc code sẽ tưởng các engine này đang chạy. Đây là rủi ro
hiểu nhầm, không phải rủi ro chạy sai.

### Nợ 2: Con số chưa bám dữ liệu còn sót

| Chỗ | Còn gì |
|---|---|
| `getCurriculumPlan` | `estimatedStudyTime = 20` và `expectedRetentionGain = 15`, `weeklyPlan` chỉ đổi theo giai đoạn chứ không theo người học |
| Ngân hàng câu hỏi | Trường `misconception` rỗng **292/292** câu. Từ 27/07/2026 **không còn gây hại**: đã có nguồn thay thế ở tầng khái niệm (nhóm kiểm **N**). Chỉ còn thiếu nếu muốn cảnh báo riêng cho TỪNG CÂU thay vì từng khái niệm |
| Khối `review` biên soạn tay | `secondReviewDays` và `thirdReviewDays` vẫn chưa ai đọc. Chúng chỉ có nghĩa khi xếp lịch ôn nhiều mốc, mà hiện lịch ôn suy từ một con số độ bền duy nhất |
| `productObservabilityService` | 39 ngưỡng cứng, đã rà và sửa 3 lỗi nặng, phần ngưỡng thuần túy chưa đụng |
| `curriculumIntelligenceEngine` | 18 ngưỡng cứng, đã rà và sửa 5 lỗi nặng cộng 1 lỗi ở lượt 3 |

Mức độ nhẹ hơn hẳn những ca đã sửa: đây là **chỉ tiêu kế hoạch** hoặc **suy giảm êm**, không
phải khẳng định sai về người học. Riêng `expectedRetentionGain` vẫn là một lời hứa không căn cứ,
nhưng hiện **không hiển thị ở đâu cả**, nên chưa gây hại.

### Nợ 3: Gói giao diện lớn

`index-*.js` khoảng **1,0 MB** trước khi nén. Vite cảnh báo mỗi lần build. Không ảnh hưởng đúng
sai, chỉ ảnh hưởng tốc độ tải lần đầu.

Hướng xử lý gợi ý: tách theo màn hình bằng `React.lazy` cho các dashboard nặng. **Cần cẩn thận**,
vì nó đổi hành vi dựng giao diện (phải có ranh giới `Suspense`), và hỏng kiểu này thì ra màn hình
trắng chứ không ra lỗi build. Làm thành một lượt riêng, đừng ghép vào lượt sửa logic.

---

## Known Risks

### Rủi ro 1: Dữ liệu học chỉ nằm trên một trình duyệt

Không còn đồng bộ đám mây. Xóa dữ liệu duyệt web là mất sạch lịch sử học. Có nút sao lưu thủ
công trong Cài đặt. Chủ dự án **đã chọn giữ cách bấm tay**, đừng tự ý thêm đồng bộ hay bật lại
đăng nhập.

### Bài học đắt nhất, giữ lại để khỏi lặp

Bốn cổng AI từng trả 401 trên bản chạy thật trong khi mọi phép kiểm cục bộ đều xanh. Có **hai
lỗi chồng lên nhau**, và lỗi thứ nhất che mất lỗi thứ hai. Đã xử lý xong 27/07/2026.

Nhắc lại cho phiên sau: **bộ kiểm cục bộ không bao giờ chứng minh được hạng mục xác thực**, vì
máy nhà không đặt biến Supabase nên cổng AI luôn xanh ở đây. Đụng vào xác thực hay hàm
serverless thì bắt buộc `npm run check:prod`.

---

## Blocked Issues

Không có.

---

## Open Questions

Cần chủ dự án quyết, **không được tự quyết thay**:

1. Có dọn khoảng 1.180 dòng mã chết không? Dọn thì gọn nhưng là thay đổi diện rộng.
2. Có tách gói giao diện theo màn hình để giảm 1,0 MB không? Xem cảnh báo ở Nợ 3.
3. Trường `misconception` của **từng câu hỏi** vẫn rỗng 292/292. Từ 27/07/2026 gia sư AI đã có
   cảnh báo bẫy riêng lấy từ tầng KHÁI NIỆM, nên câu hỏi này bớt gấp. Chỉ còn đáng làm nếu chủ dự
   án muốn cảnh báo riêng cho từng câu chứ không phải từng khái niệm.
4. Có muốn hiển thị bảy vector bất định của bộ dự báo không? Hiện chúng **không xuất hiện ở màn
   hình nào**, chỉ chảy vào con số tổng rồi ra biên độ tin cậy. Nếu chủ dự án muốn biết "vì sao dự
   báo không chắc" thì cần một chỗ hiển thị.

---

## Next Immediate Step

**Chờ yêu cầu mới.** Không tự khởi động việc gì.

Nếu được giao việc, theo đúng trình tự trong AGENTS.md mục 9: chạy `npm run check` phải đạt,
soát `git status`, commit nêu rõ đổi gì và vì sao, ghi mục mới vào BANGIAO.md, cập nhật file
WORKSTATE.md này, rồi push.

## Next Major Step

**Hai việc mới sinh ra từ lượt nâng độ chính xác dự báo, nên làm trước:**

0a. **Ba loại sai lệch theo lát cắt vẫn chưa dựng lại**: `chapterBias`, `difficultyBias`,
    `bloomBias` trong hồ sơ hiệu chuẩn vẫn giữ giá trị cũ. Chúng cần điểm thi thật tách theo
    chương và theo mức Bloom, mà lượt làm bài hiện **không ghi đủ chiều đó**. Muốn làm thì phải
    bổ sung dữ liệu lúc chấm trước.

0b. **`calculateAdaptiveWeights` có vùng chết giữa 0,3 và 0,8**: sai lệch rơi vào dải đó thì
    trọng số không đổi gì cả. Đó là ngưỡng có chủ ý nhưng đáng xem lại, vì phần lớn sai lệch thật
    sẽ nằm đúng trong dải này. Nên thay bằng hàm liên tục.

**Bốn nhiệm vụ còn lại trong danh sách tám đã giao**, xếp theo đúng thứ tự chủ dự án đề nghị.
Cả bốn đều đã được xác minh là mạch dữ liệu có thật, nhưng **vẫn phải đo độ dày trước khi viết
code**, đúng như bốn mạch vừa làm.

1. **Hiệu ứng vị trí câu trong đề, tức đường cong mỏi mệt.** `attempt.questions` là mảng CÓ THỨ
   TỰ, `answers` tra theo id, nên tỷ lệ đúng theo vị trí tính được ngay. Nối vào `fatigueTrend`
   đã có trong `learnerModel`. **Cẩn thận**: phải khử ảnh hưởng của độ khó theo vị trí trước, nếu
   không sẽ nhầm độ khó thành mỏi mệt.
2. **Khung giờ học hiệu quả.** `attempt.startTime` là chuỗi ISO đầy đủ trên mọi lượt. Gom theo
   khung rộng (sáng, chiều, tối, khuya) chứ đừng chia 24 ô, và phải nói rõ số lượt làm căn cứ.
3. **Rà `studentEvolutionEngine`** (565 dòng, chưa ai soi, có màn hình `LearningEvolutionView`).
   Dùng bộ quét ở AGENTS.md mục 4.9b. Ba engine chưa soi còn lại không có màn hình riêng nên để
   sau: `questionGenerationEngine` (718 dòng), `pedagogicalEvaluationEngine` (344),
   `teachingDecisionEngine` (222).
4. **Trường `examReviewResult`** được ghi vào mọi lượt ở `ai.ts` nhưng **không nơi nào đọc**. Đọc
   xem nó chứa gì rồi quyết: nối vào đâu đó, hoặc ghi vào sổ nợ là mã chết.

Tin tốt đã kiểm chứng, khỏi mất công dò lại: **8 khóa localStorage được ghi thì cả 8 đều có nơi
đọc.** Không có dữ liệu lưu trữ chết ở tầng đó.

Sau đó mới tới các khoản nợ cũ:

5. Tách gói giao diện để giảm 1,0 MB (Nợ 3, đọc cảnh báo trước khi làm)
6. Dọn mã chết (Nợ 1)

---

## Verification Pending

Không có. Bốn commit vừa rồi đều nghiệm thu hai tầng: `npm run check` đủ 6 chặng với **118** phép
kiểm, **và** mở `npm run dev` soi tận mắt màn hình bị đụng tới (bài giảng gia sư AI, Kế hoạch học,
Phân tích giảng dạy, tab Trí nhớ), không lỗi nào trên bảng điều khiển trình duyệt.

**Một giới hạn nghiệm thu phải nói rõ**: với nhiệm vụ nhịp làm bài, tôi **không** quan sát được
con số khác 0 trên giao diện. Lý do là để tạo nhịp nhanh thật thì phải bấm trong vài giây, mà lượt
bấm bằng script cho `timeSpent` bằng 0 nên bị loại đúng theo thiết kế. Việc con số khác 0 chảy tới
nơi tiêu thụ được chứng minh bằng phép kiểm P7, không bằng mắt.

Ngoài ra dữ liệu học thật của chủ dự án nằm trong trình duyệt của chính chủ dự án, không nằm trong
repo. Nên **không đo được chủ dự án dùng nút cờ nghi vấn nhiều hay ít**. Ba tầng mới vì thế đều
thiết kế theo hướng dữ liệu thưa: thiếu thì trả "chưa đủ dữ liệu" chứ không đoán.
