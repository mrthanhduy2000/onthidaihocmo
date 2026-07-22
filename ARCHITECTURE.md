# Kiến trúc Hệ thống (ARCHITECTURE.md) - POLI-ECON AI v2.0

Tài liệu này mô tả chi tiết kiến trúc phần mềm, vai trò của từng thành phần, sự phụ thuộc (dependencies) giữa các module, và cách thức hoạt động của nền tảng học tập thích ứng POLI-ECON AI v2.0.

---

## 🏛 Sơ đồ Kiến trúc Tổng thể (ASCII Diagram)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT-SIDE (React App)                       │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                         User Interfaces                        │   │
│   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐ │   │
│   │  │  Dashboard   │ │ PracticeView │ │    AIHub     │ │ Stats  │ │   │
│   │  └──────────────┘ └──────────────┘ └──────────────┘ └────────┘ │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    │ (gọi hàm/đọc ghi)                 │
│                                    ▼                                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                         Services Layer                         │   │
│   │  ┌─────────────────────────────┐  ┌──────────────────────────┐ │   │
│   │  │   dbService (LocalStorage)  │  │   aiService (Frontend)   │ │   │
│   │  └─────────────────────────────┘  └─────────────┬────────────┘ │   │
│   └─────────────────────────────────────────────────│──────────────┘   │
└─────────────────────────────────────────────────────┼──────────────────┘
                                                      │ (HTTP Requests - fetch)
                                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         SERVER-SIDE (Express.js)                       │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                        Express Router                          │   │
│   │       POST /api/ai/explain           POST /api/ai/recommend    │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    │ (độc lập, bảo mật)                │
│                                    ▼                                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                        Gemini 3.5 Client                       │   │
│   │                 (Official @google/genai SDK)                   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Chi tiết vai trò của từng Thư mục & File

### 1. Thư mục Gốc (`/`)
- `server.ts`: Điểm khởi chạy backend Express. Nó đóng vai trò vừa là Web Server phục vụ các file tĩnh ở chế độ Production (bản build React) vừa là API Gateway kết nối an toàn với Google Gemini API.
- `package.json`: Quản lý các dependencies và quy định quy trình build/chạy hệ thống.
- `vite.config.ts`: Cấu hình của trình đóng gói Vite.

### 2. Thư mục `src/` (Mã nguồn Client)
- `main.tsx`: Điểm gắn kết (mount) React App vào thẻ DOM `#root` trong `index.html`.
- `index.css`: File CSS duy nhất chứa cấu hình Tailwind CSS 4.0 và các định nghĩa kiểu phông chữ toàn cục.
- `types.ts`: Chứa tất cả các định nghĩa kiểu dữ liệu (Interfaces/Types/Enums) toàn dự án. Giúp đảm bảo tính toàn vẹn của dữ liệu trong quá trình trao đổi giữa client, dbService và server.

### 3. Thư mục `src/data/` (Cơ sở dữ liệu tĩnh)
Do môn Kinh tế chính trị Mác - Lênin có khung kiến thức học thuật ổn định, dữ liệu giáo trình và câu hỏi được chuẩn hóa dưới dạng cấu trúc JSON tĩnh để tối ưu hóa hiệu năng tải:
- `chapters.ts`: Định nghĩa danh sách 6 chương học cốt lõi từ Chương 1 đến Chương 6.
- `topics.ts`: Chia nhỏ 6 chương thành 24 chủ đề (topics) chuyên biệt để AI và thuật toán Heuristics có thể chẩn đoán chính xác đến từng phạm trù.
- `questions.ts`: Chứa 60 câu hỏi trắc nghiệm chất lượng cao, có đầy đủ thuộc tính phân loại (chương, chủ đề, mức độ khó, thời gian ước tính, trang tài liệu gốc trong PDF, mục tiêu học tập, và lời giải thích ngoại tuyến mẫu).

### 4. Thư mục `src/services/` (Tầng nghiệp vụ & Lưu trữ)
- `time.ts` (`TimeService`):
  - Lớp quản lý thời gian trung tâm (Centralized Time Service), thay thế hoàn toàn cho `new Date()` và `Date.now()`.
  - Chuẩn hóa múi giờ học tập cố định `Asia/Ho_Chi_Minh` (UTC+7) trên toàn hệ thống.
  - Áp dụng cơ chế đồng hồ đơn điệu (Monotonic Clock) dựa trên `performance.now()` kết hợp đồng bộ hóa NTP trực tuyến (fallback về giờ hệ thống khi ngoại tuyến) và cơ chế bù trừ (offset compensation) được lưu trữ bền vững. Chống gian lận thời gian hệ thống và ngăn chặn xung đột/reset chuỗi Streak hay sai lệch bộ đếm giờ (Practice Timer).
- `db.ts` (`dbService`):
  - Chịu trách nhiệm trực tiếp tương tác với `localStorage`.
  - Quản lý việc lưu/tải dữ liệu cá nhân hóa (Settings, Bookmarks, Flags, ExamAttempts).
  - Chứa thuật toán `recomputeStatistics()` để tự động tính toán lại toàn bộ kết quả học tập sau mỗi lượt bài nộp, cập nhật chuỗi học tập hàng ngày (Streak) và xây dựng nhật ký câu hỏi sai.
- `ai.ts` (`aiService`):
  - Quản lý các logic liên quan đến trí tuệ nhân tạo.
  - Chứa thuật toán Heuristic nội bộ (`generateLocalRecommendation()`) để tự động phân tích lỗ hổng kiến thức ngoại tuyến và đề xuất hành động ôn tập.
  - Đóng vai trò là Client trung gian gọi đến các API của server `/api/ai/explain` và `/api/ai/recommend`.
  - Cung cấp hàm `generateExam()` để tạo đề thi theo các chế độ (Ngẫu nhiên, Theo Chương, Theo Chủ đề, Thích ứng, Đề Smart Exam cấu trúc vàng).

### 5. Thư mục `src/components/` (Tầng Giao diện)
- `App.tsx`:
  - Component điều hướng trung tâm (Router-state). Quản lý thanh điều hướng (Navbar) tinh gọn, thanh trạng thái Streak trực quan, và các tab nội dung.
- `Dashboard.tsx`:
  - Hiển thị tiến trình học tập tổng quan, lịch sử thi thử gần nhất.
  - Cung cấp bảng điều khiển trực quan để người dùng cấu hình sinh đề thi mới theo bất kỳ tiêu chí nào (Chương, Chủ đề, Độ khó, Câu sai, Đánh dấu, hay Đề thi thông minh Smart Exam).
- `PracticeView.tsx`:
  - Giao diện làm bài thi/luyện tập tập trung.
  - Hiển thị đồng hồ đếm ngược, danh sách câu hỏi dạng lưới giúp điều hướng nhanh, các phím chức năng Bookmark/Flag.
  - Hiển thị giao diện nộp bài sinh động và chế độ rà soát đáp án (Review Mode) tích hợp nút **Hỏi giải thích AI** trực quan tại từng câu hỏi.
- `AIHub.tsx`:
  - Giao diện chính của trung tâm trí tuệ nhân tạo.
  - Chứa nút quét chẩn đoán năng lực bằng AI (Gemini) kèm bảng phân tích gợi ý chi tiết lộ trình học tập bằng Markdown.
  - Chứa widget Chat với Trợ lý ảo Giáo viên AI 24/7 giúp giải đáp mọi thắc mắc lý luận một cách trực tiếp.
- `StatsView.tsx`:
  - Trung tâm báo cáo năng lực trực quan của người học.
  - Hiển thị các chỉ số cốt lõi dưới dạng thẻ (Hiệu suất, Năng lực rèn luyện, Cường độ học).
  - Biểu đồ phân tích tỷ lệ chính xác của từng chương và danh sách "Nhật ký câu sai" hỗ trợ lọc, tìm kiếm và mở rộng lời giải chi tiết tại chỗ.
- `SimpleMarkdown.tsx`:
  - Một bộ chuyển đổi văn bản Markdown sang HTML siêu nhẹ, an toàn, đảm bảo hiển thị định nghĩa danh sách, bảng biểu và trích dẫn lý thuyết từ Gemini luôn được hiển thị đẹp mắt, ngăn nắp.

---

## 🔗 Mối quan hệ và Sự phụ thuộc giữa các Module (Dependencies)

```text
   ┌──────────────────────────────────────────────┐
   │                  App.tsx                     │
   └───────┬──────────────┬──────────────┬────────┘
           │              │              │
           ▼              ▼              ▼
   ┌──────────────┐┌──────────────┐┌──────────────┐
   │  Dashboard   ││ PracticeView ││    AIHub     │
   └───────┬──────┘└──────┬───────┘└──────┬───────┘
           │              │              │
           └──────────────┼──────────────┘ (gọi dữ liệu/hàm)
                          ▼
                  ┌──────────────┐
                  │  StatsView   │
                  └──────┬───────┘
                         │ (sử dụng dịch vụ)
                         ▼
             ┌───────────────────────┐
             │ dbService & aiService │
             └───────────┬───────────┘
                         │ (đọc dữ liệu cấu trúc)
                         ▼
           ┌───────────────────────────┐
           │ questions/topics/chapters │
           └───────────────────────────┘
```

Mô hình thiết kế này phân rã hoàn toàn tầng Giao diện (Components) và tầng Dữ liệu/Nghiệp vụ (Services & Static Data). Nhờ đó, bất kỳ sự thay đổi nào về cách lưu trữ (như chuyển từ LocalStorage sang Firestore/SQL) hay nâng cấp mô hình AI (như chuyển sang Gemini 2.0 hay các tác vụ AI khác) đều chỉ cần chỉnh sửa trong tầng Services tương ứng mà không làm ảnh hưởng đến cấu trúc giao diện người dùng.
