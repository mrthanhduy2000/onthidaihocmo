> **CẢNH BÁO: TÀI LIỆU ĐÃ LẠC HẬU (viết 21/07/2026).**
> File này mô tả phiên bản cũ dành cho môn Kinh tế chính trị Mác Lênin, môn đó nay ĐÃ ĐÓNG.
> Số liệu bên dưới (số câu hỏi, số chương, phiên bản thư viện, luồng đăng nhập) không còn đúng.
> Hiện trạng đúng nằm ở [AGENTS.md](AGENTS.md). Khi mâu thuẫn, tin AGENTS.md và tin mã nguồn.

# Luồng dữ liệu hệ thống (DATA_FLOW.md) - POLI-ECON AI v2.0

Tài liệu này mô tả chi tiết cách thức dữ liệu di chuyển, được xử lý, lưu trữ và đồng bộ hóa giữa các thành phần khác nhau trong ứng dụng POLI-ECON AI v2.0.

---

## 1. Nguồn Dữ liệu Câu hỏi và Giáo trình
1. Khi ứng dụng khởi chạy lần đầu hoặc khi một View được tải, danh mục chương học (`chapters.ts`), chủ đề học tập (`topics.ts`) và bộ ngân hàng câu hỏi gốc (`questions.ts`) được import trực tiếp vào bộ nhớ RAM của Client.
2. Các file này đóng vai trò là "Sự thật duy nhất" (Single Source of Truth) đối với cấu trúc lý thuyết và ngân hàng câu hỏi.

---

## 2. Luồng Sinh đề thi và Khởi tạo Luyện tập
Khi người dùng bấm nút tạo đề thi hoặc ôn tập trên **Dashboard** hoặc từ đề xuất của **AI Hub**:

```text
[Người dùng chọn Chế độ & bấm "Bắt đầu"]
                  │
                  ▼
         [Dashboard/AIHub] ───► Gọi `aiService.generateExam(config)`
                                                 │
                                                 ▼
                             [Lọc Ngân hàng câu hỏi gốc (questions.ts)]
                             - Theo Chương (chapterId)
                             - Theo Chủ đề (topicId)
                             - Theo Độ khó (difficulty)
                             - Theo Lịch sử Câu sai (incorrectQuestionHistory)
                             - Theo Câu đánh dấu (bookmarks)
                                                 │
                                                 ▼
                             [Trường hợp đặc biệt: AI Smart Exam]
                             - Trích lọc theo tỷ lệ vàng phân bổ chương:
                               15% CH1, 20% CH2, 25% CH3, 15% CH4, 15% CH5, 10% CH6.
                             - Cân bằng độ khó: Dễ, Trung bình, Khó, Rất khó.
                             - Áp dụng hàm xáo trộn ngẫu nhiên.
                                                 │
                                                 ▼
                             [Trường hợp đặc biệt: Ôn tập Thích ứng (Adaptive)]
                             - Tính điểm trọng số (weight) dựa trên lỗ hổng:
                               Yếu chương (+3), yếu chủ đề (+4), sai nhiều (+5).
                             - Sắp xếp thứ tự ưu tiên câu hỏi theo trọng số giảm dần.
                                                 │
                                                 ▼
                             [Khởi tạo Object `ExamAttempt`]
                             - Gán `id` ngẫu nhiên độc nhất bằng `TimeService.nowTimestamp()`.
                             - Trích mảng câu hỏi `questions: number[]` (mảng ID).
                             - Gán trạng thái `isSubmitted: false` và `answers: {}`.
                                                 │
                                                 ▼
                             [Lưu tạm đề thi đang làm vào LocalStorage]
                             - Gọi `dbService.saveAttempt(attempt)`
                                                 │
                                                 ▼
                             [Chuyển hướng View] ───► Sang `PracticeView` với ID đề tương ứng.
```

---

## 3. Luồng Làm bài, Chấm điểm và Nộp bài
Trong quá trình người dùng làm bài tại giao diện **PracticeView**:

1. **Ghi nhận phương án trả lời**:
   - Mỗi lần người dùng chọn một phương án (A, B, C, D) cho một câu hỏi, giao diện sẽ cập nhật state `answers[questionId] = selection`.
   - Nếu cài đặt `autoSaveProgress` được bật, hệ thống sẽ ngay lập tức gọi `dbService.saveAttempt(attempt)` để ghi nhận câu trả lời vào LocalStorage nhằm phòng ngừa sự cố mất điện hoặc tải lại trang giữa chừng.
2. **Đánh dấu & Treo cờ**:
   - Người dùng bấm nút Bookmark/Flag để đánh dấu câu hỏi.
   - Hệ thống chuyển tiếp yêu cầu đến `dbService.toggleBookmark(questionId)` hoặc `dbService.toggleFlag(questionId)` để ghi nhận ngay lập tức vào mảng lưu trữ cấu trúc thống kê cá nhân.
3. **Tính toán Kết quả và Chấm điểm**:
   Khi người dùng bấm nút **Nộp bài**:
   - Hệ thống khóa quyền thay đổi câu trả lời.
   - Thiết lập `endTime` bằng `TimeService.now().toISOString()`.
   - So sánh mảng câu trả lời người dùng `answers` với đáp án đúng `correctAnswer` của từng câu hỏi tương ứng trong ngân hàng câu hỏi gốc:
     $$\text{Score} = \sum (\text{answers}[q.id] == q.correctAnswer ? 1 : 0)$$
   - Đánh dấu trạng thái đề thi `isSubmitted: true`.
   - Gọi lệnh lưu trữ chính thức: `dbService.saveAttempt(attempt)`.

---

## 4. Luồng Tính toán lại Thống kê và Đồng bộ hóa Dashboard & Stats
Ngay sau khi `dbService.saveAttempt()` ghi nhận một bài thi đã nộp thành công (`isSubmitted: true`):

```text
[Lưu bài thi thành công] ───► Gọi `dbService.recomputeStatistics()`
                                           │
                                           ▼
                    [Quét lại toàn bộ lịch sử thi thử đã nộp từ LocalStorage]
                                           │
                                           ▼
                 [Khởi tạo lại cấu trúc Thống kê trắng chuẩn (initStatsStructure)]
                                           │
                                           ├─► Tính tổng thời gian làm bài (totalTimeSpent)
                                           ├─► Ghi nhận ngày làm bài để tính chuỗi Streak liên tục
                                           │
                                           ▼
                 [Duyệt qua từng câu hỏi trong mỗi đề thi trong lịch sử]
                 ├── Nếu trả lời ĐÚNG:
                 │   ├── Đưa ID câu hỏi vào Set `totalCorrectSet` (Đúng ít nhất một lần)
                 │   ├── Tăng biến đếm đúng cho Chương (accuracyByChapter) và Chủ đề (accuracyByTopic)
                 │   └── Đưa ID câu hỏi vào Set `totalSolvedSet` (Đã giải)
                 │
                 └── Nếu trả lời SAI:
                     ├── Tăng số lần sai trong bảng lịch sử câu sai (incorrectQuestionHistory[qId]++)
                     ├── Tăng biến đếm tổng câu giải cho Chương và Chủ đề tương ứng
                     └── Đưa ID câu hỏi vào Set `totalSolvedSet` (Đã giải)
                                           │
                                           ▼
                     [Ghi đè Object Statistics mới nhất vào LocalStorage]
                                           │
                                           ▼
           [Đồng bộ hóa dữ liệu hiển thị tức thì trên toàn bộ ứng dụng]
           ├── [Dashboard]: Cập nhật tỷ lệ hoàn thành (completionRate) & tiến trình chung (progress).
           └── [StatsView]: Vẽ lại biểu đồ tỷ lệ chính xác từng chương & Nhật ký câu sai.
```

---

## 5. Luồng Dữ liệu AI Diagnostics & Explainer
Khi người dùng tương tác với các tính năng Trí tuệ nhân tạo (AI):

### A. Luồng Chẩn đoán Thích ứng (AI Diagnostics Recommendation)
1. Tại **AI Hub**, người dùng nhấn nút **Quét chẩn đoán bằng AI**.
2. Ứng dụng lấy dữ liệu thống kê hiện tại thông qua `dbService.getStatistics()` (gồm tỷ lệ chính xác chi tiết của từng chương/chủ đề và lịch sử làm bài).
3. **Yêu cầu kết nối mạng**:
   - **Chế độ Trực tuyến (Online)**: Gửi request `POST /api/ai/recommend` kèm body JSON thống kê lên server Express. Server Express sẽ cấu hình Prompt chi tiết và gọi API Gemini 3.5 Flash để chẩn đoán. Gemini trả về file JSON định dạng nghiêm ngặt chứa: mảng chương yếu, mảng chủ đề yếu, bài nhận xét Markdown sâu sắc, và đề xuất hành động bài tập cụ thể.
   - **Chế độ Dự phòng ngoại tuyến (Offline Heuristics Fallback)**: Nếu kết nối API lỗi hoặc thiếu API key, hệ thống sẽ kích hoạt hàm `aiService.generateLocalRecommendation()` để phân tích nhanh theo thuật toán ngưỡng sai sót (chương < 70% chính xác, chủ đề < 65% chính xác) nhằm đưa ra kết quả phân tích chất lượng cao cục bộ.

### B. Luồng Hỏi giải thích AI từng câu hỏi (AI Explainer)
1. Tại giao diện xem lại bài thi, người học nhấn nút **Hỏi giải thích AI** tại một câu hỏi bất kỳ.
2. Hệ thống gửi mã ID câu hỏi và câu trả lời mà người học đã chọn (`selectedAnswer`) lên API `/api/ai/explain`.
3. Server lấy chi tiết câu hỏi gốc từ `questions.ts` tương ứng với ID để làm bối cảnh gốc, sau đó dựng Prompt chi tiết và gửi lên mô hình Gemini 3.5 Flash.
4. Gemini sẽ đóng vai giảng viên chuyên ngành, thực hiện phân tích 4 bước chuẩn sư phạm và trả về văn bản Markdown.
5. Nếu mất mạng, hệ thống tự động trích xuất thuộc tính `explanation` tĩnh có sẵn trong câu hỏi gốc kèm theo chỉ dẫn slide tài liệu học tập để người dùng tự đối chiếu tức thì mà không bị gián đoạn.

---

## 6. Luồng Quản lý và Đồng bộ hóa Thời gian Trung tâm (Centralized Time Flow)
Hệ thống loại bỏ hoàn toàn việc gọi trực tiếp `new Date()` hoặc `Date.now()`, tập trung luồng xử lý thời gian qua lớp `TimeService`:

1. **Khởi tạo và Đồng bộ hóa Monotonic Clock**:
   - Khi ứng dụng khởi chạy, `TimeService` kích hoạt cơ chế lấy mốc giờ thực qua NTP (gọi API giờ thế giới trực tuyến).
   - Nếu thành công, mốc giờ này được lưu trữ và tính toán độ lệch (offset compensation) so với đồng hồ cục bộ của hệ điều hành. Độ lệch được lưu vào `localStorage`.
   - Nếu ngoại tuyến, hệ thống tự động rơi về giờ hệ thống (fallback) nhưng vẫn bảo lưu độ lệch đã biết trước đó.
   - Kể từ lúc này, mọi phép tính thời gian trôi qua đều dựa trên `performance.now()` - một bộ đếm đơn điệu (monotonic) không bị ảnh hưởng bởi việc người dùng chỉnh sửa đồng hồ Windows/macOS hay đổi múi giờ.

2. **Xử lý Múi giờ chuẩn (Asia/Ho_Chi_Minh)**:
   - Toàn bộ dữ liệu hiển thị (Đồng hồ Dashboard, Streak học tập, thời gian làm bài thi, thời gian cập nhật AI chẩn đoán) đều được định dạng theo chuẩn múi giờ `Asia/Ho_Chi_Minh` (UTC+7) bất kể múi giờ thực tế của thiết bị đầu cuối là gì.
   - Các hàm định dạng `formatDate()`, `formatDateTime()`, `formatTime()` của `TimeService` tự động áp dụng `Intl.DateTimeFormat` chuẩn hóa này để duy trì tính nhất quán tuyệt đối.

