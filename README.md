# POLI-ECON AI v2.0 - Adaptive Learning Platform for Marxist-Leninist Political Economy

POLI-ECON AI v2.0 là một nền tảng học tập thích ứng (Adaptive Learning Platform) chuyên biệt dành cho môn Kinh tế chính trị Mác - Lênin cấp Đại học. Hệ thống tích hợp Trí tuệ Nhân tạo thông qua mô hình ngôn ngữ Gemini 3.5 để cung cấp dịch vụ chẩn đoán năng lực thích ứng thời gian thực, sinh đề thi thử thông minh (Smart Exam), và hỗ trợ học tập trực tiếp 24/7 (AI Tutor).

---

## 🎯 Mục tiêu dự án
- **Cá nhân hóa lộ trình học tập**: Chẩn đoán vùng khuyết kiến thức dựa trên lịch sử làm bài để đề xuất bài tập khắc phục trọng tâm.
- **Mô phỏng thi thực tế**: Cung cấp các chế độ thi thử ngẫu nhiên, thi thử theo chương/chủ đề và đặc biệt là đề thi chuẩn cấu trúc đại học (AI Smart Exam).
- **Hỗ trợ sư phạm trực tiếp**: Tự động giải thích chi tiết đáp án từng câu hỏi bằng AI Tutor chuyên sâu, giúp người học nắm vững bản chất lý thuyết chính trị học.
- **Hoạt động linh hoạt**: Hỗ trợ chế độ ngoại tuyến hoàn toàn (Local Heuristics/Offline) khi không có kết nối API Gemini.

---

## 🛠 Công nghệ sử dụng
- **Frontend**:
  - React 18+ (TypeScript)
  - Vite (Công cụ build và HMR)
  - Tailwind CSS (Thiết kế giao diện hiện đại, Responsive, nhất quán)
  - Lucide React (Bộ icon đồng điệu)
  - Framer Motion / Motion (Hiệu ứng mượt mà)
- **Backend (Server-side)**:
  - Node.js (Express)
  - TSX (Chạy trực tiếp TypeScript trong quá trình phát triển)
  - Esbuild (Bbundle server thành CJS để tối ưu hóa deploy)
- **AI Integration**:
  - `@google/genai` (SDK chính thức mới nhất của Google Gemini)
  - Mô hình **Gemini 3.5 Flash** (Độ chính xác cao, phản hồi nhanh, tối ưu chi phí)
- **Storage/State**:
  - LocalStorage (Lưu trữ lịch sử, thống kê học tập, bookmarks, flags, và cấu hình người dùng)

---

## 📂 Kiến trúc thư mục
```text
├── .env.example            # Bản mẫu cấu hình biến môi trường
├── .gitignore              # Danh sách các file bỏ qua khi git commit
├── package.json            # Quản lý script và dependency
├── tsconfig.json           # Cấu hình TypeScript compiler
├── vite.config.ts          # Cấu hình Vite
├── server.ts               # Điểm khởi chạy server Express & Proxy API Gemini
├── src/
│   ├── main.tsx            # Điểm khởi chạy React client
│   ├── App.tsx             # Component gốc quản lý layout và router
│   ├── index.css           # Cấu hình global styles & Tailwind CSS
│   ├── types.ts            # Định nghĩa toàn bộ kiểu dữ liệu (TypeScript Interfaces)
│   ├── components/         # Thư mục chứa các View và Component chính
│   │   ├── Dashboard.tsx   # Giao diện Trang chủ & Lựa chọn chế độ ôn tập
│   │   ├── PracticeView.tsx# Giao diện Luyện tập/Làm bài thi thử
│   │   ├── AIHub.tsx       # Trung tâm Chẩn đoán Thích ứng & Chat Tutor
│   │   ├── StatsView.tsx   # Báo cáo Phân tích Năng lực & Nhật ký Câu sai
│   │   └── SimpleMarkdown.tsx # Component parser Markdown tối giản cho AI
│   ├── data/               # Cơ sở dữ liệu tĩnh của hệ thống ôn tập
│   │   ├── chapters.ts     # Danh mục 6 Chương lý thuyết
│   │   ├── topics.ts       # Danh mục 24 Chủ đề nhỏ (Topics)
│   │   └── questions.ts    # Ngân hàng 60 câu hỏi chuẩn hóa
│   └── services/           # Các dịch vụ logic nghiệp vụ
│       ├── time.ts         # Quản lý thời gian trung tâm, múi giờ, Monotonic clock
│       ├── db.ts           # Quản lý LocalStorage, Streak, recomputeStatistics
│       └── ai.ts           # Giao tiếp API và Heuristics dự phòng của AI
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Cài đặt Dependencies
Chạy lệnh sau tại thư mục gốc để cài đặt tất cả các gói thư viện cần thiết:
```bash
npm install
```

### 2. Cấu hình biến môi trường
Tạo file `.env` tại thư mục gốc và cung cấp khóa API Gemini:
```env
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
```
*(Nếu không có `GEMINI_API_KEY`, ứng dụng sẽ tự động chuyển sang chế độ Heuristic ngoại tuyến mà không gây crash hệ thống).*

### 3. Chạy môi trường Phát triển (Development)
Sử dụng công cụ `tsx` để khởi chạy đồng thời backend Express và client-side Vite:
```bash
npm run dev
```
Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000`

### 4. Build sản phẩm (Production)
Lệnh build sẽ đồng thời biên dịch phần tĩnh Client qua Vite và gom cụm backend Express thành một file CommonJS duy nhất nằm tại `dist/server.cjs`:
```bash
npm run build
```

### 5. Chạy bản Build (Production Start)
Khởi chạy sản phẩm đã được biên dịch:
```bash
npm run start
```

---

## 📝 Hướng dẫn Thêm Câu hỏi & Chương mới

### Hướng dẫn Thêm Câu hỏi Mới
Để mở rộng ngân hàng câu hỏi, bạn hãy chỉnh sửa file `/src/data/questions.ts`. Mỗi câu hỏi phải tuân thủ chính xác kiểu dữ liệu `Question` trong `types.ts`:
```typescript
{
  id: 61, // ID duy nhất kế tiếp
  question: "Nội dung câu hỏi trắc nghiệm mới?",
  options: {
    a: "Phương án A",
    b: "Phương án B",
    c: "Phương án C",
    d: "Phương án D"
  },
  correctAnswer: "a", // 'a' | 'b' | 'c' | 'd'
  chapterId: 1, // Thuộc chương nào (1-6)
  topicId: "T1.1", // Thuộc chủ đề nào định nghĩa trong topics.ts
  difficulty: "Trung bình", // "Dễ" | "Trung bình" | "Khó" | "Rất khó"
  difficultyRating: 3, // Xếp hạng sao từ 1 đến 5
  explanation: "Lời giải thích dự phòng chi tiết khi không có kết nối AI.",
  sourcePdf: "FULL CHƯƠNG.pdf", // Tên slide bài giảng
  sourcePage: 15, // Trang slide tham chiếu
  knowledgeMapping: ["từ khóa 1", "từ khóa 2"],
  relatedQuestions: [1, 2], // Các ID câu hỏi liên quan để đề xuất thêm
  estimatedTime: 45, // Thời gian làm bài ước tính bằng giây
  questionType: "multiple-choice",
  learningObjective: "Mục tiêu bài học cụ thể cần đạt được"
}
```

### Kiểm duyệt & Nhập dữ liệu Tự động (Audit & Import Pipeline)
Hệ thống cung cấp sẵn hai bộ dịch vụ mạnh mẽ để kiểm soát chất lượng nội dung và hỗ trợ nhập câu hỏi tự động:

1. **Bộ kiểm duyệt chất lượng (Validation Engine)**:
   - Trước khi tích hợp dữ liệu mới, chạy hàm `auditQuestionsDatabase()` (định nghĩa tại `/src/services/validation.ts`) để quét toàn bộ ngân hàng câu hỏi.
   - Trình kiểm duyệt sẽ tự động phát hiện các lỗi nghiêm trọng (như trùng ID, sai liên kết chương - chủ đề, thiếu phương án, thiếu lời giải) và các cảnh báo (như trùng văn bản câu hỏi, độ dài lời giải quá ngắn).

2. **Đường truyền nhập dữ liệu (Import Pipeline)**:
   - Sử dụng hàm `importQuestions(rawItems)` (định nghĩa tại `/src/services/importPipeline.ts`) khi muốn nhập hàng loạt câu hỏi từ các nguồn ngoài (JSON, Excel, Web API).
   - Hàm sẽ tự động lọc bỏ các câu hỏi lỗi cấu trúc, tự gán giá trị hợp lý/mặc định cho các trường còn thiếu (như độ khó, thời gian ước tính, hoặc lời giải) và gán mã định danh chuẩn hóa (`questionCode`) dạng `POLI-CH[X]-Q[ID]`.

### Hướng dẫn Thêm Chương mới (Chapter)
1. Thêm chương mới vào mảng `chapters` trong `/src/data/chapters.ts`:
   ```typescript
   {
     id: 7,
     code: "CH7",
     title: "Tên chương mới",
     description: "Mô tả tóm tắt nội dung chương"
   }
   ```
2. Thêm các chủ đề (Topics) trực thuộc chương 7 vào `/src/data/topics.ts`:
   ```typescript
   {
     id: "T7.1",
     chapterId: 7,
     title: "Tên chủ đề 7.1",
     description: "Mô tả chủ đề"
   }
   ```
3. Thêm các câu hỏi có thuộc tính `chapterId: 7` và `topicId: "T7.1"` vào `/src/data/questions.ts`.
4. Cập nhật lại logic phân bổ đề thi thử thông minh (nếu cần thiết) trong `/src/services/ai.ts` tại hàm `generateExam` để cân bằng tỷ lệ chương mới.

---

## 🌐 Hướng dẫn Deploy lên Cloud Run
Ứng dụng được thiết kế tương thích hoàn hảo với Cloud Run dưới dạng ứng dụng Full-stack chứa Dockerfile:
1. Đảm bảo port lắng nghe là `3000` (như đã cấu hình trong `server.ts`).
2. Config biến môi trường `GEMINI_API_KEY` và `NODE_ENV=production` trực tiếp trên Container Settings của Google Cloud Console.
3. Chạy lệnh deploy thông qua gcloud CLI:
   ```bash
   gcloud run deploy poli-econ-ai --source . --port 3000 --allow-unauthenticated
   ```

---

## ⚠️ Những Lưu ý Quan trọng
1. **Bảo mật API Key**: Tuyệt đối không khai báo `GEMINI_API_KEY` với tiền tố `VITE_` vì sẽ làm lộ khóa bí mật lên trình duyệt client-side. Mọi truy vấn AI bắt buộc phải proxy qua server Express `/api/*`.
2. **Khởi chạy Thống kê**: Khi người dùng nộp bài thi, `dbService.saveAttempt` sẽ được gọi và kích hoạt ngay phương thức `recomputeStatistics()` để tính toán lại điểm số, streak, tỷ lệ chính xác từng chương/chủ đề và ghi nhận lại vào LocalStorage.
3. **Thiết kế Responsive**: Giao diện được thiết kế Desktop-First nhưng tối ưu hiển thị Mobile tinh tế nhờ hệ thống màu `zinc` và phông chữ đơn sắc, đảm bảo touch target nút bấm tối thiểu là 44px trên thiết bị di động.
4. **Hạ tầng quản lý thời gian trung tâm (TimeService)**: Ứng dụng tích hợp `TimeService` (tại `src/services/time.ts`) quản lý toàn bộ mốc thời gian, lịch sử, đếm giờ làm bài, và chuỗi streak. Cơ chế đồng hồ đơn điệu (Monotonic clock) dựa trên `performance.now()` kết hợp bù trừ sai lệch NTP đảm bảo hệ thống không bị crash, reset streak, hay sai bộ đếm giờ kể cả khi người học thay đổi múi giờ hoặc chỉnh lệch giờ thiết bị của họ. Tất cả ngày giờ hiển thị được chuẩn hóa theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7).
