# WORKSTATE.md, điểm kiểm tra sống của dự án

File này là **ảnh chụp trạng thái làm việc hiện tại**. Một AI mất sạch ngữ cảnh chỉ cần đọc file
này là tiếp tục được ngay, không phải dò lại từ đầu.

Đọc kèm: [AGENTS.md](AGENTS.md) cho bất biến kỹ thuật, [BANGIAO.md](BANGIAO.md) cho lịch sử
quyết định.

**Cập nhật lần cuối**: 27/07/2026, sau đợt rà soát toàn diện hai engine chưa từng được soi.

---

## Trạng thái tổng quát

| Mục | Giá trị |
|---|---|
| **Current Objective** | Không có việc đang làm dở |
| **Current Milestone** | Rà soát toàn diện và sửa 9 lỗi thật ở hai engine chưa từng được soi, **ĐÃ HOÀN THÀNH** |
| **Current Phase** | Rảnh, sẵn sàng nhận việc |
| **Current Task** | Không có |
| **Completed %** | 100%, đã kiểm chứng bằng lời gọi thật lên bản deploy |
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
| Phép tự kiểm chứng | 63, đạt toàn bộ |
| Môn đang hoạt động | Hành vi khách hàng (`customer_behavior`) |
| Môn đã đóng | Kinh tế chính trị (`poli_econ`), đã thi xong, cố ý gỡ khỏi danh sách |

---

## Phạm vi dài hạn của dự án

Chủ dự án xác nhận ngày 27/07/2026: đây là **trung tâm luyện thi và học tập đa môn dùng lâu
dài**, sẽ còn nạp thêm nhiều môn và nhiều tài liệu khác. Hai môn hiện có chỉ là điểm khởi đầu,
không phải toàn bộ phạm vi. Tên thư mục là di sản của môn đầu tiên.

Đọc mục 3 trong [AGENTS.md](AGENTS.md) cho phần quy tắc kỹ thuật đi kèm (26 chỗ gắn cứng mã môn
học cần chuyển dần sang khai báo bằng dữ liệu).

Trạng thái đường nạp môn mới, cập nhật 27/07/2026: **đã thông**. Sinh câu hỏi từ tài liệu chạy
được, và môn tự tạo trong ứng dụng cũng dùng được gia sư AI (AGENTS.md mục 4.8).

**Nợ gắn cứng mã môn học** vẫn còn và chi phí trả tăng theo số môn được thêm. Đây là khoản nợ
đáng dọn tiếp nếu Đàm bắt đầu nạp môn thứ ba.

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

Bổ sung 27/07/2026: tham số `aiEngineExecutor` của `EvidenceBasedPipeline.executePipeline` cũng
là mã chết. Pipeline khai báo nó nhưng **không bao giờ gọi**, thực tế gọi thẳng
`aiProviderRegistry` ở bước 9. Đã kiểm chứng bằng cách dò toàn bộ file. Nguy hiểm ở chỗ tên
tham số khiến người đọc tin rằng có thể thay đường gọi AI qua đó, và niềm tin đó đã làm hỏng
một lượt sửa (chi tiết trong BANGIAO.md).

Thêm 19 hàm và hằng được export nhưng không ai dùng, trong đó **8 engine nằm trong
`evidencePipeline.ts`** (`EvidenceRetrievalEngine`, `ReasoningEngine`, `TeachingStrategyEngine`,
`AIMemory2Engine`, `ConfidenceEngine`, `CitationEngine`, `GuessDetectionEngine`,
`EvidenceValidationEngine`). File này 839 dòng nhưng bên ngoài chỉ dùng đúng hai kiểu dữ liệu
`EvidenceSet` và `ReasoningContext`. Nhiều khả năng đây là cả một tầng kiến trúc được dựng
sẵn rồi chưa bao giờ đấu nối.

**Rủi ro nếu để nguyên**: người sau đọc code sẽ tưởng các engine này đang chạy và suy luận sai
về hành vi hệ thống. Đây là rủi ro hiểu nhầm, không phải rủi ro chạy sai.

### Nợ 2: Ngưỡng cứng ở các engine

| Service | Số ngưỡng cứng | Tình trạng |
|---|---|---|
| `productObservabilityService.ts` | 39 | **đã rà 27/07/2026**, sửa 3 lỗi nặng, ngưỡng cứng còn lại chưa đụng |
| `curriculumIntelligenceEngine.ts` | 18 | **đã rà 27/07/2026**, sửa 5 lỗi nặng, ngưỡng cứng còn lại chưa đụng |
| `examForecaster.ts` | 34 | đã rà phần lõi dự báo |

Cả hai engine trên nay có nhóm kiểm **I** canh. Phần ngưỡng cứng thuần túy (bậc nhảy, hằng số
ma thuật) vẫn còn, nhưng đó là chuyện tinh chỉnh chứ không còn là sai sự thật.

Trong `examForecaster`, phần lõi dự báo đã sửa xong. Còn các phần **ROI, what-if, study debt,
stress test chưa soi kỹ**, vẫn nhiều ngưỡng cứng.

### Nợ 3: Gói giao diện lớn

`index-*.js` khoảng 1.033 kB trước khi nén (243 kB sau nén gzip). Vite cảnh báo mỗi lần build.
Không ảnh hưởng đúng sai, chỉ ảnh hưởng tốc độ tải lần đầu.

---

## Known Risks

### ~~Rủi ro 1: Bốn cổng AI trên bản chạy thật trả 401~~ ĐÃ XỬ LÝ XONG 27/07/2026

Giữ lại phần ghi chép vì đây là bài học đắt nhất của dự án cho tới nay.

Có **hai lỗi chồng lên nhau**, và lỗi thứ nhất che mất lỗi thứ hai:

1. **Cửa xác thực**: máy chủ đòi token Supabase, giao diện đã gỡ đăng nhập nên không có token.
   Vá bằng `ensureSession()` (phiên ẩn danh) cộng với việc chủ dự án bật Anonymous sign-ins
   bên Supabase.
2. **Tra nhầm ngân hàng câu hỏi**: `/api/ai/explain` tra trong ngân hàng môn đã đóng
   (id 1 đến 60) còn pipeline đọc môn đang học (id 2001 đến 3279), hai dải không giao nhau nên
   **mọi** lời gọi đều hỏng. Xem AGENTS.md mục 4.8.

Chỉ sửa lỗi 1 rồi dừng lại là vẫn hỏng, mà nhìn bên ngoài **không thể phân biệt được**, vì giao
diện nuốt lỗi và hiện lời giải ngoại tuyến trông y như thật.

**Bằng chứng nghiệm thu** (gọi thật lên bản deploy, ngày 27/07/2026): câu id 2001 và 3279 trả
HTTP 200, `offlineMode: false`, lời giải dài 2769 và 3297 ký tự, không chứa dấu hiệu ngoại
tuyến. Lượt gọi không kèm token vẫn trả 401 đúng như thiết kế.

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

1. ~~Có bật lại AI trên bản chạy thật không, và theo hướng nào?~~ **Đã chốt 27/07/2026**: hướng
   phiên ẩn danh. Mã xong, chờ chủ dự án bật công tắc Anonymous sign-ins bên Supabase.
2. Có dọn khoảng 1.180 dòng mã chết không? Dọn thì gọn nhưng là thay đổi diện rộng.
3. Có rà tiếp `productObservabilityService` và `curriculumIntelligenceEngine` theo cùng cách
   đã làm với các engine khác không?

---

## Next Immediate Step

**Chờ yêu cầu mới.** Không tự khởi động việc gì.

Giới hạn "môn tự tạo không dùng được AI" đã được **xử lý xong 27/07/2026**, xem AGENTS.md mục
4.8. Đã chạy thử thật trên trình duyệt với một môn tự tạo và nhận được bài giảng AI đầy đủ.

Nếu được giao việc, theo đúng trình tự trong AGENTS.md mục 9: chạy `npm run check` phải đạt,
soát `git status`, commit nêu rõ đổi gì và vì sao, ghi mục mới vào BANGIAO.md, cập nhật file
WORKSTATE.md này.

## Next Major Step

Xếp theo mức đáng làm:

1. Rà `productObservabilityService.ts` (1205 dòng, 39 ngưỡng cứng), engine lớn nhất còn lại
2. Rà nốt phần ROI, what-if, study debt trong `examForecaster` (phần lõi dự báo đã xong)
3. Rà `curriculumIntelligenceEngine.ts` (390 dòng, 18 ngưỡng cứng)
4. Bật lại AI trên bản chạy thật
5. Dọn mã chết

---

## Verification Pending

Không có. Đường AI đã nghiệm thu bằng lời gọi thật lên bản deploy, không phải suy đoán từ mã
nguồn: 55/55 phép tự kiểm chứng đạt, `npm run check:prod` đủ 4 cổng đạt ở lượt có token, và
lời giải trả về có `offlineMode: false`.

Nhắc cho phiên sau: **bộ kiểm cục bộ không bao giờ chứng minh được hạng mục này**, vì máy nhà
không đặt biến Supabase nên cổng AI luôn xanh ở đây (đúng cơ chế Bẫy 1). Đụng vào xác thực hay
hàm serverless thì bắt buộc `npm run check:prod`.

## Expected Commit Scope

Chưa xác định, phụ thuộc việc được giao tiếp theo.

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

Bổ sung ngày 27/07/2026 cho bộ dự báo điểm thi:

- **Dự báo tái lập được**: gọi lại với cùng dữ liệu luôn trả về đúng con số cũ. Trước đó con số
  tự bò lên theo số lần mở màn hình (đo được 3,8 lên 7,2 trên hồ sơ đứng yên).
- **Hết hạ điểm hệ thống**: lệch trung bình so với năng lực thật giảm từ 1,44 xuống 0,56 điểm,
  và không còn phình to theo năng lực người học.
- **Tầng lan truyền phụ thuộc nay chạy thật**, đọc `dependencies.requires` từ đồ thị tri thức
  thay cho bảng cứng chứa khái niệm kinh tế vi mô của môn khác.
- Quy tắc chung rút ra: **cân theo lượng bằng chứng chỉ được làm đúng một lần tại nguồn**
  (`recomputeStatistics`). Mọi engine phía sau đọc thẳng giá trị đó, không co lại lần nữa.
