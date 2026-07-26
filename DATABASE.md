> **CẢNH BÁO: TÀI LIỆU ĐÃ LẠC HẬU (viết 21/07/2026).**
> File này mô tả phiên bản cũ dành cho môn Kinh tế chính trị Mác Lênin, môn đó nay ĐÃ ĐÓNG.
> Số liệu bên dưới (số câu hỏi, số chương, phiên bản thư viện, luồng đăng nhập) không còn đúng.
> Hiện trạng đúng nằm ở [AGENTS.md](AGENTS.md). Khi mâu thuẫn, tin AGENTS.md và tin mã nguồn.

# Định nghĩa cấu trúc dữ liệu (DATABASE.md) - POLI-ECON AI v2.0

Ứng dụng POLI-ECON AI v2.0 sử dụng cấu trúc dữ liệu kiểu tĩnh (Static JSON) phục vụ cho ngân hàng đề và sử dụng cơ chế lưu trữ cục bộ `LocalStorage` phía Client để lưu vết tiến trình người dùng.

Dưới đây là mô tả chi tiết của từng lược đồ thực thể (Entity Schemas) và kiểu dữ liệu tương ứng trong hệ thống.

---

## 1. Chapter (Chương lý thuyết)
Mô tả danh mục chương lý thuyết của giáo trình Kinh tế chính trị Mác - Lênin.

- **Vị trí định nghĩa**: `src/types.ts` -> Interface `Chapter`
- **File lưu trữ dữ liệu gốc**: `src/data/chapters.ts`

| Tên trường (Field) | Kiểu dữ liệu | Ý nghĩa / Ví dụ |
| :--- | :--- | :--- |
| `id` | `number` | ID định danh duy nhất của chương (từ 1 đến 6) |
| `code` | `string` | Mã chương viết tắt (Ví dụ: `"CH1"`, `"CH2"`) |
| `title` | `string` | Tiêu đề chính của chương (Ví dụ: `"Hàng hóa, thị trường và vai trò của các chủ thể..."`) |
| `description` | `string` | Tóm tắt các chủ đề lý thuyết chính nằm trong chương này |

---

## 2. Topic (Chủ đề học tập chi tiết)
Phân rã nhỏ từng chương học thành các đơn vị chủ đề nhỏ hơn giúp AI chẩn đoán chính xác lỗ hổng kiến thức.

- **Vị trí định nghĩa**: `src/types.ts` -> Interface `Topic`
- **File lưu trữ dữ liệu gốc**: `src/data/topics.ts`

| Tên trường (Field) | Kiểu dữ liệu | Ý nghĩa / Ví dụ |
| :--- | :--- | :--- |
| `id` | `string` | ID định danh duy nhất của chủ đề (Ví dụ: `"T1.1"`, `"T3.2"`) |
| `chapterId` | `number` | ID liên kết với chương chủ quản (Ví dụ: `1`) |
| `title` | `string` | Tên chủ đề chi tiết (Ví dụ: `"Nguồn gốc và bản chất của tiền tệ"`) |
| `description` | `string` | Mô tả các khái niệm cốt lõi nằm trong chủ đề |

---

## 3. Question (Câu hỏi trắc nghiệm)
Mô tả chi tiết thông tin của một câu hỏi trắc nghiệm khách quan 4 lựa chọn trong ngân hàng đề.

- **Vị trí định nghĩa**: `src/types.ts` -> Interface `Question`
- **File lưu trữ dữ liệu gốc**: `src/data/questions.ts`

| Tên trường (Field) | Kiểu dữ liệu | Ý nghĩa / Ví dụ |
| :--- | :--- | :--- |
| `id` | `number` | ID định danh duy nhất của câu hỏi (Ví dụ: `12`) |
| `question` | `string` | Nội dung văn bản câu hỏi trắc nghiệm |
| `options` | `object` | Đối tượng chứa 4 phương án trả lời `{ a: string, b: string, c: string, d: string }` |
| `correctAnswer` | `"a" \| "b" \| "c" \| "d"` | Phương án trả lời chính xác duy nhất |
| `chapterId` | `number` | ID chương liên đới |
| `topicId` | `string` | ID chủ đề liên đới |
| `difficulty` | `DifficultyLevel` | Phân loại độ khó: `"Dễ"` \| `"Trung bình"` \| `"Khó"` \| `"Rất khó"` |
| `difficultyRating`| `number` | Số sao đánh giá độ khó từ 1 đến 5 |
| `explanation` | `string` | Lời giải chi tiết mẫu chuẩn hóa để hiển thị ngoại tuyến |
| `sourcePdf` | `string` | Tên slide bài giảng hoặc sách giáo trình tham chiếu |
| `sourcePage` | `number \| string` | Số trang cụ thể trong tài liệu tham chiếu chứa lý thuyết của câu hỏi này |
| `knowledgeMapping`| `string[]` | Mảng các thẻ từ khóa kiến thức chính (Ví dụ: `["Hàng hóa", "Giá trị sử dụng"]`) |
| `relatedQuestions`| `number[]` | Mảng danh sách các ID câu hỏi liên quan để gợi ý học viên luyện thêm |
| `estimatedTime` | `number` | Thời gian làm bài ước tính bằng giây (Ví dụ: `45`) |
| `questionType` | `"multiple-choice"` | Loại câu hỏi (mặc định là trắc nghiệm 4 lựa chọn) |
| `learningObjective`| `string` | Chuẩn đầu ra/Mục tiêu bài học cần đạt được tương ứng |
| `questionCode` | `string` (optional) | Mã định danh chuẩn hóa hệ thống (Ví dụ: `"POLI-CH1-Q001"`) |
| `createdAt` | `string` (optional, ISO format) | Thời gian tạo lập câu hỏi ban đầu |
| `updatedAt` | `string` (optional, ISO format) | Thời gian cập nhật nội dung gần nhất |
| `version` | `number` (optional) | Phiên bản sửa đổi của câu hỏi (Ví dụ: `1`) |
| `tags` | `string[]` (optional) | Danh sách các nhãn phụ hoặc từ khóa mở rộng phục vụ tìm kiếm thông minh |

---

## 4. ExamAttempt (Lượt bài làm thi thử)
Lưu vết thông tin chi tiết một lần làm bài thi hoặc ôn tập của người học.

- **Vị trí định nghĩa**: `src/types.ts` -> Interface `ExamAttempt`
- **Khóa lưu trữ LocalStorage**: `poly_econ_history`

| Tên trường (Field) | Kiểu dữ liệu | Ý nghĩa / Ví dụ |
| :--- | :--- | :--- |
| `id` | `string` | ID định danh duy nhất của lượt làm bài (Ví dụ: `"exam-random-1690000000000"`) |
| `examType` | `string` | Phân loại chế độ thi: `"sequential"` \| `"random"` \| `"ai-smart"` \| `"chapter"` \| `"topic"` \| `"difficulty"` \| `"incorrect"` \| `"bookmark"` \| `"adaptive"` |
| `chapterId` | `number` (optional) | ID chương lọc đề thi (nếu thi theo chương) |
| `topicId` | `string` (optional) | ID chủ đề lọc đề thi (nếu thi theo chủ đề) |
| `difficulty` | `DifficultyLevel` (opt) | Lọc độ khó làm bài |
| `startTime` | `string` (ISO format) | Thời điểm người dùng bắt đầu mở đề |
| `endTime` | `string` (ISO format) | Thời điểm nộp bài (trống nếu chưa nộp) |
| `questions` | `number[]` | Mảng danh sách các ID câu hỏi trong đề theo đúng thứ tự xáo trộn |
| `answers` | `Record<number, string>`| Bản đồ lưu câu trả lời: `{ [questionId]: "a" \| "b" \| "c" \| "d" }` |
| `bookmarks` | `number[]` | Các ID câu hỏi được đánh dấu sao trong lượt thi này |
| `flags` | `number[]` | Các ID câu hỏi bị treo cờ chú ý trong lượt thi này |
| `isSubmitted` | `boolean` | Trạng thái nộp bài thi (`true` nếu đã nộp và chấm điểm thành công) |
| `score` | `number` | Điểm số (Số câu trả lời đúng, Ví dụ: `15`) |
| `timeSpent` | `number` | Tổng thời gian làm bài thực tế tính bằng giây |

---

## 5. Statistics (Thống kê năng lực tích lũy)
Lưu vết toàn bộ tiến trình học tập của học viên, phục vụ trực tiếp cho AI phân tích chẩn đoán.

- **Vị trí định nghĩa**: `src/types.ts` -> Interface `Statistics`
- **Khóa lưu trữ LocalStorage**: `poly_econ_statistics`

| Tên trường (Field) | Kiểu dữ liệu | Ý nghĩa / Ví dụ |
| :--- | :--- | :--- |
| `totalSolved` | `number` | Tổng số câu hỏi độc lập người dùng đã từng giải |
| `totalCorrect` | `number` | Tổng số câu hỏi người dùng đã từng trả lời chính xác ít nhất một lần |
| `totalTimeSpent` | `number` | Tổng thời gian tập trung tích lũy trên hệ thống tính bằng giây |
| `studyStreak` | `number` | Số ngày học liên tiếp không ngắt quãng |
| `lastStudyDate` | `string` (ISO format) | Thời gian thực hiện phiên học tập gần nhất |
| `accuracyByChapter`| `Record<number, { correct, total }>` | Bản đồ lưu trữ số câu đúng / số câu giải cho từng Chương (từ chương 1 đến 6) |
| `accuracyByTopic` | `Record<string, { correct, total }>` | Bản đồ lưu trữ số câu đúng / số câu giải cho từng Chủ đề nhỏ (Ví dụ: `{"T1.1": {correct: 3, total: 5}}`) |
| `incorrectQuestionHistory`| `Record<number, number>` | Nhật ký đếm số lần trả lời sai của từng câu hỏi: `{ [questionId]: wrongAttemptsCount }` |
| `bookmarks` | `number[]` | Mảng ID tất cả câu hỏi được đánh dấu sao toàn cục |
| `flags` | `number[]` | Mảng ID tất cả câu hỏi bị gắn cờ toàn cục |

---

## 6. UserSettings (Cài đặt người dùng)
Cấu hình giao diện và tùy chọn tiện ích của người học.

- **Vị trí định nghĩa**: `src/types.ts` -> Interface `UserSettings`
- **Khóa lưu trữ LocalStorage**: `poly_econ_settings`

| Tên trường (Field) | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `theme` | `"light" \| "dark"` | Giao diện hiển thị (Sáng hoặc Tối) |
| `fontSize` | `"sm" \| "base" \| "lg" \| "xl"` | Kích thước phông chữ hiển thị của câu hỏi và nội dung |
| `enableAnimations` | `boolean` | Cho phép chạy hiệu ứng chuyển trang mượt mà |
| `enableTimer` | `boolean` | Hiển thị đồng hồ đếm ngược khi làm bài |
| `enableSound` | `boolean` | Cho phép phát âm thanh thông báo sinh động |
| `autoSaveProgress` | `boolean` | Tự động đồng bộ câu trả lời vào bộ nhớ sau mỗi lần nhấp chuột |

---

## 7. Quy trình Kiểm duyệt & Mở rộng Dữ liệu (Database Scaling & Audit Engine)

Để hệ thống vận hành mượt mà khi ngân hàng đề mở rộng từ vài chục câu lên **hàng nghìn hoặc hàng chục nghìn câu**, hệ thống tích hợp sẵn các bộ dịch vụ chuẩn hóa dữ liệu sau:

### 7.1. Bộ chỉ mục hiệu năng cao O(1)
- **Cơ chế**: Toàn bộ mảng dữ liệu tĩnh (`questions`, `topics`, `chapters`) được chuyển đổi thành cấu trúc `Map` tìm kiếm nhanh khi khởi chạy ứng dụng (Xem `questionMap`, `topicMap`, `chapterMap` tại `src/services/db.ts`).
- **Hiệu quả**: Loại bỏ hoàn toàn thuật toán quét tuyến tính $O(N)$ trong các vòng lặp lịch sử hoặc ôn tập của ứng dụng, đảm bảo thời gian tra cứu và tính toán thống kê phản hồi tức thì với độ trễ $O(1)$.

### 7.2. Lớp kiểm duyệt chất lượng dữ liệu (Validation Engine)
- **Vị trí**: `src/services/validation.ts` -> Hàm `auditQuestionsDatabase()`
- **Quy tắc kiểm tra**:
  - Không trùng lặp ID hoặc nội dung câu hỏi.
  - Các khóa ngoại chương (`chapterId`) và chủ đề (`topicId`) phải tồn tại hợp lệ.
  - Ràng buộc cấu trúc cha-con (chủ đề con phải thuộc về chương cha tương ứng).
  - Phương án trả lời và lời giải chi tiết phải đầy đủ nội dung, không trùng lặp các lựa chọn a, b, c, d.

### 7.3. Đường truyền tích hợp dữ liệu tự động (Import Pipeline)
- **Vị trí**: `src/services/importPipeline.ts` -> Hàm `importQuestions()`
- **Tính năng**: Cho phép nhà phát triển hoặc quản trị viên nhập dữ liệu mới từ bên ngoài vào (như file JSON, CSV, hoặc copy từ Excel) mà không cần chỉnh sửa bất kỳ dòng mã logic nào:
  - Tự động chuẩn hóa kiểu dữ liệu.
  - Tự động sửa chữa, gán các giá trị mặc định cho độ khó, thời gian ước tính, hoặc lời giải nếu bị thiếu sót.
  - Tự động sản xuất mã định danh tham chiếu chuẩn hóa (`questionCode`) dạng `POLI-CH[X]-Q[ID]`.
  - Báo cáo kết quả import chi tiết (báo cáo số câu thành công, số câu bị bỏ qua do lỗi cấu trúc kèm thông điệp giải thích cụ thể).
