# Nhật ký thay đổi (CHANGELOG.md) - POLI-ECON AI v2.0

Tất cả các thay đổi đáng chú ý đối với dự án này sẽ được ghi lại trong tài liệu này. Dự án đã trải qua các chu kỳ phát triển nghiêm ngặt để đạt đến phiên bản ổn định cao nhất.

---

## [1.0.0] - Stable Release (Phiên bản ổn định cao nhất)
*Phiên bản bàn giao chính thức, đạt độ hoàn thiện tuyệt đối.*

### Thay đổi:
- **Tối ưu hóa Giao diện (UI/UX Design Polish)**: 
  - Chuyển đổi toàn bộ bảng màu nền tảng sang gam màu `zinc` tối giản sang trọng kết hợp sắc xanh `indigo` làm điểm nhấn.
  - Tích hợp phông chữ hiển thị hiện đại "Space Grotesk" kết hợp với phông đơn sắc "JetBrains Mono" tạo trải nghiệm học tập chuẩn học thuật, giảm mỏi mắt khi đọc lâu.
  - Thiết kế touch target rộng rãi (tối thiểu 44px) hỗ trợ di động tuyệt vời.
  - Đảm bảo tính nhất quán của Dark Mode trên toàn bộ các view và component.
- **Tách biệt Module (Modularity)**: 
  - Chia nhỏ các giao diện thành những file riêng biệt bao gồm `Dashboard.tsx`, `PracticeView.tsx`, `AIHub.tsx`, `StatsView.tsx`, và `SimpleMarkdown.tsx` tránh tình trạng nghẽn token khi sinh mã.
- **Tối ưu Hiệu năng**:
  - Biên dịch toàn bộ phần server-side TypeScript thành một tệp đóng gói tự chứa duy nhất `dist/server.cjs` thông qua esbuild giúp tăng tốc khởi động ứng dụng và giảm I/O đĩa.
  - Hủy bỏ hoàn toàn kết nối HMR trong môi trường container để tránh tình trạng nhấp nháy giao diện khi lưu vết trung gian.

---

## [0.9.0] - Refactor & Performance Tuning
*Chu kỳ tối ưu hóa chất lượng mã nguồn và tăng cường độ tin cậy.*

### Thay đổi:
- **Tái cấu trúc Quản lý Thống kê**: 
  - Chuẩn hóa cơ chế tính toán lại số liệu `recomputeStatistics` trong `dbService`, đảm bảo quét toàn bộ lịch sử thi đã nộp để đồng bộ hóa dữ liệu tuyệt đối chính xác thay vì tính cộng dồn dễ gây sai lệch.
- **Chế độ Ngoại tuyến Dự phòng hoàn hảo**:
  - Bổ sung cơ chế Heuristic nội bộ tự động kích hoạt khi API Gemini bị lỗi hoặc thiếu key cấu hình, giúp người dùng luôn nhận được kết quả phân tích học tập chính xác dựa trên ngưỡng điểm học tập thực tế.
  - Tích hợp sẵn trường dữ liệu `explanation` tĩnh trong từng câu hỏi để hiển thị lời giải ngay lập tức nếu máy chủ mất kết nối Internet.

---

## [0.8.0] - AI Hub Integration
*Tích hợp Trí tuệ nhân tạo làm nòng cốt trợ lý.*

### Thay đổi:
- **Chẩn đoán năng lực Thích ứng (AI Diagnostics)**:
  - Tích hợp mô hình Gemini 3.5 Flash để tự động đọc cấu hình thống kê chi tiết của học viên và trả về bản nhận xét bằng định dạng Markdown rành mạch kèm theo hành động bài tập cụ thể.
- **AI Tutor 24/7**:
  - Xây dựng widget chat trực tiếp với Trợ lý ảo Giáo viên môn Kinh tế chính trị.
  - AI được hướng dẫn đóng vai một giảng viên đại học, rành mạch, ngôn từ khoa học chuẩn mực sư phạm để trả lời mọi thắc mắc lý thuyết bất kỳ lúc nào.
- **Sinh đề thích ứng (Adaptive Test Generation)**:
  - Cho phép người dùng tạo ngay đề luyện tập dựa trên gợi ý sửa sai của AI chỉ bằng 1 lượt click chuột.

---

## [0.5.0] - Dashboard & Practice View Development
*Xây dựng cấu trúc cốt lõi cho các hoạt động thi thử.*

### Thay đổi:
- **Bảng điều khiển học tập (Dashboard)**:
  - Hiển thị tiến trình hoàn thành tổng quan, chuỗi ngày học liên tục (Streak), tỷ lệ làm bài đúng trung bình.
  - Cung cấp form cấu hình sinh đề thi đa dạng theo ý muốn.
- **Trình thi thử (PracticeView)**:
  - Giao diện làm bài tập trung hỗ trợ đánh dấu (Bookmark), treo cờ câu hỏi khó (Flag), đồng hồ đếm ngược trực quan.
  - Hỗ trợ xem lại bài làm chi tiết (Review Mode) ngay sau khi nộp bài.

---

## [0.1.0] - HTML Prototype
*Khởi tạo ý tưởng và cấu trúc hóa cơ sở dữ liệu.*

### Thay đổi:
- Khởi dựng dự án React 18+ với cấu hình TypeScript và Tailwind CSS.
- Số hóa và chuẩn hóa 6 Chương lý thuyết cùng 24 chủ đề nhỏ cốt lõi từ sách giáo trình Đại học.
- Xây dựng ngân hàng đề mẫu thử nghiệm gồm 60 câu hỏi lý thuyết trắc nghiệm đa lựa chọn có tính khoa học cao.
