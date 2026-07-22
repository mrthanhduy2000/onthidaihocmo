# Nợ kỹ thuật (TECH_DEBT.md) - POLI-ECON AI v2.0

Tài liệu này ghi chép một cách trung thực và khách quan toàn bộ các giới hạn kỹ thuật (Technical Debts) hiện tại của hệ thống POLI-ECON AI v2.0 nhằm hỗ trợ định hướng cải tiến, tái cấu trúc tối ưu cho đội ngũ phát triển trong tương lai.

---

## 1. Kiến trúc Quản lý Trạng thái (State Management)
- **Vấn đề**: Hiện tại ứng dụng chưa tích hợp các thư viện quản lý trạng thái tập trung (như Redux Toolkit, Zustand) hay sử dụng React Context API. Toàn bộ các trạng thái chính (Lịch sử làm bài, Thống kê, Cài đặt người dùng) đều được duy trì ở Component gốc `App.tsx` và phân phối xuống các Component con thông qua kỹ thuật truyền thuộc tính (Prop Drilling) hoặc thông qua các hàm callback sự kiện.
- **Ảnh hưởng**: Khi ứng dụng tiếp tục mở rộng quy mô với nhiều View hoặc tính năng tương tác phức tạp hơn, Prop Drilling sẽ làm tăng độ phức tạp của mã nguồn, gây khó khăn cho việc bảo trì và gỡ lỗi (debug).
- **Giải pháp đề xuất**: Tái cấu trúc bằng cách chuyển đổi trạng thái toàn cục sang **Zustand** hoặc **React Context** để mã nguồn tại `App.tsx` gọn gàng và dễ quản lý hơn.

---

## 2. Kích thước Component lớn (Monolithic Components)
- **Vấn đề**: Các component như `Dashboard.tsx`, `StatsView.tsx` hay `PracticeView.tsx` đang đảm nhận quá nhiều vai trò từ render giao diện, quản lý form cho đến tính toán định dạng số liệu tại chỗ. Kích thước file của các component này tương đối dài.
- **Ảnh hưởng**: Khó tái sử dụng mã nguồn. Việc chỉnh sửa một lỗi giao diện nhỏ có thể vô tình ảnh hưởng đến các logic tính toán nội bộ nằm chung trong tệp.
- **Giải pháp đề xuất**: Trích xuất (Extract) các UI nhỏ hơn ra thành những component độc lập (Ví dụ: `QuestionCard.tsx`, `ExamConfigForm.tsx`, `StreakBadge.tsx`, `MetricCard.tsx`).

---

## 3. Lưu trữ Dữ liệu Chưa được Mã hóa và Giới hạn Dung lượng
- **Vấn đề**: Dữ liệu lịch sử làm bài (`poly_econ_history`) và thống kê học tập được ghi lưu trực tiếp dưới dạng chuỗi JSON thô không mã hóa trong `LocalStorage`.
- **Ảnh hưởng**:
  - Người dùng có hiểu biết về CNTT có thể dễ dàng can thiệp vào `Developer Tools` của trình duyệt để sửa đổi kết quả thi thử hoặc tăng chỉ số Streak theo ý muốn.
  - `LocalStorage` có giới hạn dung lượng lưu trữ nghiêm ngặt (thường là khoảng 5MB tùy trình duyệt). Nếu học viên thực hiện hàng nghìn lượt thi thử, chuỗi lịch sử làm bài có thể vượt quá giới hạn này và gây ra lỗi tràn bộ nhớ.
- **Giải pháp đề xuất**:
  - Sử dụng giải pháp mã hóa nhẹ (như `crypto-js`) trước khi lưu trữ nếu cần tính bảo mật.
  - Chuyển đổi phương thức lưu trữ lịch sử làm bài sang **IndexedDB** (thông qua thư viện `localForage`) để mở rộng dung lượng lưu trữ lên hàng trăm MB và tăng hiệu năng truy vấn bất đồng bộ.

---

## 4. Thiếu Hệ thống Kiểm thử Tự động (Testing)
- **Vấn đề**: Toàn bộ dự án chưa có bất kỳ bộ kiểm thử tự động nào (Unit Test, Integration Test hay End-to-End Test). Mọi hoạt động kiểm thử hiện tại đều được thực hiện thủ công bởi QA hoặc các kỹ sư phát triển.
- **Ảnh hưởng**: Khi tiến hành bổ sung tính năng mới hoặc cập nhật các câu hỏi trong ngân hàng đề, rất khó để phát hiện xem các thay đổi đó có làm hỏng các logic tính toán tích lũy, streak hay xáo trộn đề thi thử hay không.
- **Giải pháp đề xuất**:
  - Thiết lập **Vitest** và **React Testing Library** để viết Unit Test cho các hàm lõi trong `dbService` (như `recomputeStatistics()`, logic tính Streak) và `aiService`.
  - Thiết lập **Playwright** để kiểm thử tự động luồng làm bài thi và nộp bài.

---

## 5. Thiếu Cơ chế Lưu trữ Đệm cho Phản hồi của AI (AI Caching)
- **Vấn đề**: Khi người dùng bấm nút "Hỏi giải thích AI" cho cùng một câu hỏi nhiều lần (hoặc ở các đề thi khác nhau), hệ thống vẫn gửi yêu cầu HTTP mới lên server và gọi lại API Gemini.
- **Ảnh hưởng**:
  - Gây lãng phí tài nguyên và làm tăng chi phí sử dụng API Gemini không cần thiết.
  - Tốc độ tải của người dùng bị ảnh hưởng do phải chờ mô hình AI sinh lại nội dung giải thích từ đầu.
- **Giải pháp đề xuất**:
  - Lưu trữ đệm (Cache) các văn bản giải thích của AI ngay trong một bảng thuộc `LocalStorage`/`IndexedDB` theo cấu trúc khóa-giá trị: `questionId_selectedAnswer -> explanationText`.
  - Trước khi gọi API, kiểm tra xem câu hỏi này đã từng được giải thích hay chưa, nếu có thì hiển thị ngay lập tức.
