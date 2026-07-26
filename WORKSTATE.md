# WORKSTATE.md, điểm kiểm tra sống của dự án

File này là **ảnh chụp trạng thái làm việc hiện tại**. Một AI mất sạch ngữ cảnh chỉ cần đọc file
này là tiếp tục được ngay, không phải dò lại từ đầu.

Đọc kèm: [AGENTS.md](AGENTS.md) cho bất biến kỹ thuật, [BANGIAO.md](BANGIAO.md) cho lịch sử
quyết định.

**Cập nhật lần cuối**: 26/07/2026, sau khi khảo sát lại toàn bộ dự án theo giao thức khôi phục.

---

## Trạng thái tổng quát

| Mục | Giá trị |
|---|---|
| **Current Objective** | Không có việc đang làm dở. Dự án ở trạng thái ổn định, chờ yêu cầu mới. |
| **Current Milestone** | Tối ưu trí thông minh nội tại của tầng engine, **ĐÃ HOÀN THÀNH** |
| **Current Phase** | Rảnh, sẵn sàng nhận việc |
| **Current Task** | Không có |
| **Completed %** | 100% cho cột mốc gần nhất |
| **Git** | `main` khớp `origin/main`, cây làm việc sạch, không file nào chờ |
| **Bản đang chạy thật** | Đã triển khai, website phục vụ đúng mã nguồn mới nhất |

**Safe Resume Point**: bất kỳ lúc nào. Không có việc dở dang, không có file sửa nửa chừng,
không có nhánh phụ. Bắt đầu việc mới không cần dọn dẹp gì trước.

---

## Số liệu đã kiểm chứng bằng cách đọc code

Đo trực tiếp ngày 26/07/2026, không lấy từ tài liệu:

| Hạng mục | Số liệu thật |
|---|---|
| Câu hỏi trong ngân hàng | 292 |
| Chương | 7 |
| Chủ đề | 22 |
| Component | 30 file |
| Service | 46 file |
| Tổng dòng TypeScript | khoảng 37.400 |
| Phép tự kiểm chứng | 45, đạt toàn bộ |
| Môn đang hoạt động | Hành vi khách hàng (`customer_behavior`) |
| Môn đã đóng | Kinh tế chính trị (`poli_econ`), đã thi xong, cố ý gỡ khỏi danh sách |

---

## Bản đồ mức độ tin cậy của tài liệu

**Chỉ tin 5 file này**, chúng phản ánh đúng hiện trạng:

- `AGENTS.md`, `CLAUDE.md`, `BANGIAO.md`, `WORKSTATE.md` (file này), `DEPLOY.md`

**Không tin 8 file này**, chúng viết cho môn Kinh tế chính trị đã đóng, số liệu sai hết (còn ghi
60 câu hỏi, 6 chương, React 18, Gemini 3.5). Mỗi file đã gắn cảnh báo ở dòng đầu:

- `README.md`, `ARCHITECTURE.md`, `DATA_FLOW.md`, `DATABASE.md`, `TECH_DEBT.md`,
  `TEST_PLAN.md`, `ROADMAP.md`, `CHANGELOG.md`

Khi tài liệu mâu thuẫn với code thì **code thắng**. Cập nhật tài liệu, không lùi code.

---

## Technical Debt

Ghi nhận qua khảo sát, **cố ý chưa xử lý** vì nằm ngoài phạm vi yêu cầu. Không tự ý dọn nếu
chưa được giao.

### Nợ 1: Mã chết, khoảng 1.180 dòng không nơi nào dùng tới

Đã kiểm chứng bằng cách dò tham chiếu trên toàn bộ 100 file, không có tham chiếu động nào.

| Loại | File | Dòng |
|---|---|---|
| Service mồ côi | `src/services/importPipeline.ts` | 187 |
| Service mồ côi | `src/services/validation.ts` | 232 |
| Component không được render | `src/components/AssessmentDesignDashboard.tsx` | 321 |
| Component không được render | `src/components/Dashboard2Widgets.tsx` | 382 |
| Component không được render | `src/components/DashboardClock.tsx` | 61 |

Thêm 19 hàm và hằng được export nhưng không ai dùng, trong đó **8 engine nằm trong
`evidencePipeline.ts`** (`EvidenceRetrievalEngine`, `ReasoningEngine`, `TeachingStrategyEngine`,
`AIMemory2Engine`, `ConfidenceEngine`, `CitationEngine`, `GuessDetectionEngine`,
`EvidenceValidationEngine`). File này 839 dòng nhưng bên ngoài chỉ dùng đúng hai kiểu dữ liệu
`EvidenceSet` và `ReasoningContext`. Nhiều khả năng đây là cả một tầng kiến trúc được dựng
sẵn rồi chưa bao giờ đấu nối.

**Rủi ro nếu để nguyên**: người sau đọc code sẽ tưởng các engine này đang chạy và suy luận sai
về hành vi hệ thống. Đây là rủi ro hiểu nhầm, không phải rủi ro chạy sai.

### Nợ 2: Ngưỡng cứng còn dày ở hai engine chưa rà tới

Đợt tối ưu vừa rồi chỉ đụng tới `learningEngine`, `conceptMemoryService`,
`assessmentDesignEngine`, `kbService`, `db`. Hai engine sau vẫn còn nhiều ngưỡng cứng, cùng
loại khiếm khuyết đã sửa ở nơi khác (bậc nhảy, hằng số ma thuật, chấm tuyến tính):

| Service | Số ngưỡng cứng đếm được |
|---|---|
| `productObservabilityService.ts` | 39 |
| `examForecaster.ts` | 34 |
| `curriculumIntelligenceEngine.ts` | 18 |

`examForecaster.ts` (984 dòng) là chỗ đáng rà nhất vì nó dự báo điểm thi và có phần hiệu chỉnh
sai lệch, đúng loại nơi mà ngưỡng cứng gây kết luận không ổn định.

### Nợ 3: Gói giao diện lớn

`index-*.js` khoảng 1.033 kB trước khi nén (243 kB sau nén gzip). Vite cảnh báo mỗi lần build.
Không ảnh hưởng đúng sai, chỉ ảnh hưởng tốc độ tải lần đầu.

---

## Known Risks

### Rủi ro 1: Bốn cổng AI trên bản chạy thật đang trả lỗi 401

Máy chủ vẫn bắt buộc token đăng nhập Supabase, trong khi giao diện đã gỡ đăng nhập nên không
gửi token. Hệ quả: "Nhờ gia sư AI phân tích sâu", "Hỏi AI", gợi ý AI đều **âm thầm** rơi về
chế độ ngoại tuyến; riêng chức năng sinh câu hỏi từ tài liệu báo lỗi thẳng.

Chủ dự án **đã biết và chọn chưa xử lý**. Ba hướng khắc phục nằm ở mục "Bẫy 1" trong AGENTS.md.
Kiểm tra lại bất cứ lúc nào bằng `npm run check:prod`.

### Rủi ro 2: Dữ liệu học chỉ nằm trên một trình duyệt

Không còn đồng bộ đám mây. Xóa dữ liệu duyệt web là mất sạch lịch sử học. Có nút sao lưu thủ
công trong Cài đặt. Chủ dự án **đã chọn giữ cách bấm tay**, đừng tự ý thêm đồng bộ hay bật lại
đăng nhập.

---

## Blocked Issues

Không có. Không việc nào đang bị chặn bởi yếu tố ngoài tầm kiểm soát.

---

## Open Questions

Cần chủ dự án quyết, **không được tự quyết thay**:

1. Có bật lại AI trên bản chạy thật không, và theo hướng nào trong ba hướng đã nêu?
2. Có dọn khoảng 1.180 dòng mã chết không? Dọn thì gọn nhưng là thay đổi diện rộng.
3. Có rà tiếp `examForecaster` và `productObservabilityService` theo cùng cách đã làm với các
   engine khác không?

---

## Next Immediate Step

**Chờ yêu cầu mới.** Không tự khởi động việc gì.

Nếu được giao việc, theo đúng trình tự trong AGENTS.md mục 9: chạy `npm run check` phải đạt,
soát `git status`, commit nêu rõ đổi gì và vì sao, ghi mục mới vào BANGIAO.md, cập nhật file
WORKSTATE.md này.

## Next Major Step

Ba việc ở mục Open Questions, xếp theo mức đáng làm:

1. Rà tiếp `examForecaster.ts`, giá trị cao nhất vì nó dự báo điểm thi và đang nhiều ngưỡng cứng
2. Bật lại AI trên bản chạy thật
3. Dọn mã chết

---

## Verification Pending

Không có. Cột mốc gần nhất đã nghiệm thu đủ 5 chặng, chạy thử trực tiếp trên trình duyệt và
xác nhận bản triển khai thật đang phục vụ đúng mã nguồn mới.

## Expected Commit Scope

Lần commit tiếp theo dự kiến chỉ gồm file `WORKSTATE.md` này. Không đụng vào mã nguồn.

---

## Architecture Impact của cột mốc vừa xong

Tóm tắt để không phải đọc lại toàn bộ BANGIAO:

- Tra cứu khái niệm nay có **đúng một nguồn** là `kbService.resolveConceptsForQuestion`.
  Trước đó ba bản tra cứu khác nhau cùng tồn tại và cả ba đều sai theo kiểu riêng.
- Độ thành thạo khái niệm ghi **cùng một giá trị dưới hai khóa** qua
  `setConceptMasteryBothKeys`, trước đó hai nguồn ghi lệch khóa nhau.
- Mọi thành phần chấm ưu tiên là **hàm liên tục**, không còn ngưỡng bậc thang.
- Xếp hạng **tất định**, không còn `Math.random` trong hàm so sánh. Đã kiểm lại toàn bộ mã
  nguồn, hiện không còn chỗ nào vi phạm.
- Không phá tương thích ngược: không đổi chữ ký hàm công khai, không đổi cấu trúc lưu trữ,
  không cần di trú dữ liệu.
