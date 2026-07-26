# WORKSTATE.md, điểm kiểm tra sống của dự án

File này là **ảnh chụp trạng thái làm việc hiện tại**. Một AI mất sạch ngữ cảnh chỉ cần đọc file
này là tiếp tục được ngay, không phải dò lại từ đầu.

Đọc kèm: [AGENTS.md](AGENTS.md) cho bất biến kỹ thuật, [BANGIAO.md](BANGIAO.md) cho lịch sử
quyết định.

**Cập nhật lần cuối**: 27/07/2026, sau khi vá đường xác thực cho 4 cổng AI bằng phiên ẩn danh.

---

## Trạng thái tổng quát

| Mục | Giá trị |
|---|---|
| **Current Objective** | Mở lại 4 cổng AI trên bản chạy thật bằng phiên ẩn danh |
| **Current Milestone** | Vá đường xác thực AI, **XONG PHẦN MÃ NGUỒN**, chờ một thao tác của chủ dự án |
| **Current Phase** | Chờ chủ dự án bật Anonymous sign-ins trong Supabase |
| **Current Task** | Không còn việc mã nguồn nào cần làm cho hạng mục này |
| **Completed %** | Khoảng 90%. Phần còn lại là một công tắc AI không bấm thay được |
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
| Phép tự kiểm chứng | 50, đạt toàn bộ |
| Môn đang hoạt động | Hành vi khách hàng (`customer_behavior`) |
| Môn đã đóng | Kinh tế chính trị (`poli_econ`), đã thi xong, cố ý gỡ khỏi danh sách |

---

## Phạm vi dài hạn của dự án

Chủ dự án xác nhận ngày 27/07/2026: đây là **trung tâm luyện thi và học tập đa môn dùng lâu
dài**, sẽ còn nạp thêm nhiều môn và nhiều tài liệu khác. Hai môn hiện có chỉ là điểm khởi đầu,
không phải toàn bộ phạm vi. Tên thư mục là di sản của môn đầu tiên.

Đọc mục 3 trong [AGENTS.md](AGENTS.md) cho phần quy tắc kỹ thuật đi kèm (26 chỗ gắn cứng mã môn
học cần chuyển dần sang khai báo bằng dữ liệu).

Hai điều này đổi cách xếp mức ưu tiên, cần chủ dự án quyết chứ AI không tự quyết:

- **Rủi ro 1 nặng hơn vẻ ngoài của nó.** Chức năng sinh câu hỏi từ tài liệu chính là đường nạp
  môn mới, mà nó đang báo lỗi thẳng trên bản chạy thật. Với định hướng đa môn thì đây là thứ
  chặn đường, không phải một khiếm khuyết bên lề.
- **Nợ kỹ thuật gắn cứng mã môn học chưa được ghi thành một khoản riêng** vì trước nay dự án chỉ
  phục vụ một môn tại một thời điểm. Nay nó là nợ thật, chi phí trả tăng theo số môn được thêm.

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

| Service | Số ngưỡng cứng | Tình trạng |
|---|---|---|
| `productObservabilityService.ts` | 39 | **chưa rà** |
| `curriculumIntelligenceEngine.ts` | 18 | **chưa rà** |
| `examForecaster.ts` | 34 | đã rà phần lõi dự báo ngày 27/07/2026 |

Trong `examForecaster`, phần lõi dự báo đã sửa xong (xem BANGIAO.md). Còn các phần **ROI,
what-if, study debt, stress test chưa soi kỹ**, vẫn nhiều ngưỡng cứng.

### Nợ 3: Gói giao diện lớn

`index-*.js` khoảng 1.033 kB trước khi nén (243 kB sau nén gzip). Vite cảnh báo mỗi lần build.
Không ảnh hưởng đúng sai, chỉ ảnh hưởng tốc độ tải lần đầu.

---

## Known Risks

### Rủi ro 1: Bốn cổng AI trên bản chạy thật, đã vá phía mã nguồn, CHỜ MỘT CÔNG TẮC

Máy chủ vẫn bắt buộc token đăng nhập Supabase, trong khi giao diện đã gỡ đăng nhập nên không
gửi token. Hệ quả: "Nhờ gia sư AI phân tích sâu", "Hỏi AI", gợi ý AI đều **âm thầm** rơi về
chế độ ngoại tuyến; riêng chức năng sinh câu hỏi từ tài liệu báo lỗi thẳng.

**Ngày 27/07/2026 chủ dự án chọn hướng 1 (phiên ẩn danh) và phần mã nguồn đã làm xong**:
`ensureSession()` trong `src/services/supabaseClient.ts` tự tạo phiên ẩn danh để lấy token.

**Việc còn lại nằm ngoài tầm AI, chỉ chủ dự án làm được**: vào Supabase, mục Authentication,
phần Sign In / Providers, bật **Anonymous sign-ins**. Đo lúc 27/07/2026 công tắc **đang tắt**,
Supabase trả nguyên văn `Anonymous sign-ins are disabled`. Chừng nào chưa bật thì bản chạy thật
vẫn y như cũ: không AI, nhưng không vỡ.

Bật xong chạy `npm run check:prod` là biết ngay. Script nay kiểm hai lượt và **401 ở lượt không
token là đúng**, đừng nhầm thành hỏng.

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

**Chờ chủ dự án bật Anonymous sign-ins trong Supabase**, rồi chạy `npm run check:prod` để
nghiệm thu đường AI. Đây là việc dở dang duy nhất hiện nay, và nó **không nằm trong tầm sửa
của AI**, đừng tìm cách vá tiếp bằng mã.

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

**Có một khoản chưa nghiệm thu được**: đường AI có token trên bản chạy thật. `npm run check`
đạt cả 5 chặng, nhưng bộ kiểm cục bộ **về bản chất không chứng minh được** hạng mục này, vì máy
nhà không đặt biến Supabase nên cổng AI luôn xanh ở đây (đúng cơ chế Bẫy 1).

Bằng chứng duy nhất được chấp nhận là `npm run check:prod` báo đủ 4 cổng DAT ở lượt có token.
Chạy được ngay sau khi chủ dự án bật công tắc Supabase.

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
