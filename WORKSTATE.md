# WORKSTATE.md, điểm kiểm tra sống của dự án

File này là **ảnh chụp trạng thái làm việc hiện tại**. Một AI mất sạch ngữ cảnh chỉ cần đọc file
này là tiếp tục được ngay, không phải dò lại từ đầu.

Đọc kèm: [AGENTS.md](AGENTS.md) cho bất biến kỹ thuật, [BANGIAO.md](BANGIAO.md) cho lịch sử
quyết định.

**Cập nhật lần cuối**: 27/07/2026, sau ba lượt rà liên tiếp về cùng một họ lỗi.

---

## Trạng thái tổng quát

| Mục | Giá trị |
|---|---|
| **Current Objective** | Không có việc đang làm dở |
| **Current Milestone** | Truy quét "con số bịa" trên toàn ứng dụng, **ĐÃ HOÀN THÀNH** ba lượt |
| **Current Phase** | Rảnh, sẵn sàng nhận việc |
| **Completed %** | 100% phạm vi đã nhận, kiểm chứng cả trong Node lẫn trên trình duyệt |
| **Git** | `main` khớp `origin/main`, cây làm việc sạch |
| **Bản đang chạy thật** | Đã triển khai qua ba lượt push: `282a408`, `ab0a041`, `7a83a8d` |

**Safe Resume Point**: bất kỳ lúc nào. Không có việc dở dang, không có nhánh phụ.

---

## Ba lượt vừa xong nói về cùng MỘT họ lỗi

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
| Phép tự kiểm chứng | **92**, chia 13 nhóm A đến M, đạt toàn bộ |
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
| Ngân hàng câu hỏi | Trường `misconception` rỗng **292/292** câu, nên `contextWindowBuilder` luôn gửi cho gia sư AI một câu cảnh báo chung chung |
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
3. Trường `misconception` rỗng toàn tập: có muốn bổ sung dữ liệu thật, hay chấp nhận gia sư AI
   dùng câu cảnh báo chung?

---

## Next Immediate Step

**Chờ yêu cầu mới.** Không tự khởi động việc gì.

Nếu được giao việc, theo đúng trình tự trong AGENTS.md mục 9: chạy `npm run check` phải đạt,
soát `git status`, commit nêu rõ đổi gì và vì sao, ghi mục mới vào BANGIAO.md, cập nhật file
WORKSTATE.md này, rồi push.

## Next Major Step

Xếp theo mức đáng làm:

1. **Quét tiếp họ lỗi "con số bịa"** ở các engine chưa soi: `studentEvolutionEngine` (565 dòng),
   `questionGenerationEngine` (718 dòng), `pedagogicalEvaluationEngine` (344 dòng),
   `teachingDecisionEngine` (222 dòng). Dùng đúng bộ quét ở AGENTS.md mục 4.9b, và nhớ mở màn
   hình tương ứng ra xem.
2. Bổ sung dữ liệu cho trường `misconception` (Nợ 2)
3. Tách gói giao diện để giảm 1,0 MB (Nợ 3, đọc cảnh báo trước khi làm)
4. Dọn mã chết (Nợ 1)

---

## Verification Pending

Không có. Ba lượt vừa rồi đều nghiệm thu hai tầng: `npm run check` đủ 6 chặng với 92 phép kiểm,
**và** mở `npm run dev` soi tận mắt các màn hình bị đụng tới (Kế hoạch học đủ bốn tab, Báo cáo),
không lỗi nào trên bảng điều khiển trình duyệt.
