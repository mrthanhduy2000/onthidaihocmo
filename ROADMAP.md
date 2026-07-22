# Lộ trình phát triển (ROADMAP.md) - POLI-ECON AI v2.0

Tài liệu này vạch ra hướng phát triển và nâng cấp hệ thống POLI-ECON AI trong tương lai, được phân chia theo từng giai đoạn rõ ràng và khả thi nhằm gia tăng trải nghiệm học tập và mở rộng quy mô hệ thống.

---

## 🚀 Giai đoạn 1: Version 1.1 - Tối ưu hóa Trải nghiệm Cá nhân hóa & Ngoại tuyến
*Mục tiêu: Hoàn thiện sâu các tính năng hiện tại, tăng độ bền bỉ của hệ thống và tiết kiệm chi phí vận hành AI.*

### 📋 Các nhiệm vụ ưu tiên:
1. **Bộ đệm Lời giải AI (AI Explanation Cache)**:
   - Phát triển hệ thống cache cục bộ để lưu trữ các bài giải thích của Gemini. Nếu học viên hỏi lại câu hỏi đã giải thích, ứng dụng sẽ tải ngay lập tức từ bộ nhớ đệm, nâng tốc độ phản hồi từ 5 giây xuống dưới 0.1 giây và giảm tới 60% chi phí cuộc gọi API.
2. **Nâng cấp Lưu trữ với IndexedDB**:
   - Thay thế `LocalStorage` bằng `IndexedDB` cho tệp lịch sử bài thi (`poly_econ_history`) để khắc phục triệt để giới hạn dung lượng 5MB của trình duyệt, hỗ trợ lưu trữ không giới hạn số lượt thi thử.
3. **Mở rộng Ngân hàng Đề (Question Bank Expansion)**:
   - Bổ sung thêm câu hỏi mới để nâng tổng số câu hỏi từ 60 lên 200 câu, tăng tính đa dạng cho thuật toán sinh đề AI Smart Exam.
4. **Cải tiến Trình phát âm thanh (Sound FX Enhancement)**:
   - Thêm hiệu ứng âm thanh tích cực (âm thanh chúc mừng khi làm đúng, âm thanh nhẹ nhàng khuyến khích khi làm sai) để gia tăng yếu tố trò chơi hóa (Gamification).

---

## 🚀 Giai đoạn 2: Version 1.2 - Nâng cấp Khảo thí & Công cụ Phân tích chuyên sâu
*Mục tiêu: Đưa ra các báo cáo trực quan sinh động hơn và bổ sung hệ thống hỗ trợ ôn tập chủ động.*

### 📋 Các nhiệm vụ ưu tiên:
1. **Hệ thống ôn tập ngắt quãng (Spaced Repetition System - SRS)**:
   - Áp dụng thuật toán SuperMemo-2 đối với "Nhật ký câu sai". Hệ thống sẽ tự động nhắc nhở học viên ôn lại các câu làm sai sau 1 ngày, 3 ngày, 7 ngày để chuyển hóa kiến thức từ trí nhớ ngắn hạn sang trí nhớ dài hạn.
2. **Biểu đồ trực quan hóa dữ liệu bằng D3/Recharts**:
   - Tích hợp biểu đồ Recharts tại **StatsView** để mô tả:
     - Xu hướng thay đổi điểm số qua từng lượt thi (Line Chart).
     - Biểu đồ phân bổ thời gian trung bình cho mỗi câu hỏi theo độ khó để cảnh báo học viên về lỗi quản lý thời gian.
3. **Chế độ Luyện đề Flashcard**:
   - Chuyển đổi các định nghĩa khái niệm lý luận chính trị (như Giá trị thặng dư, Tích lũy tư bản) thành dạng Flashcard tương tác giúp học tập nhanh các thuật ngữ chính xác.

---

## 🚀 Giai đoạn 3: Version 2.0 - Chuyển đổi sang Nền tảng Đa người dùng & Đồng bộ Đám mây
*Mục tiêu: Phát triển POLI-ECON từ một công cụ cá nhân (Single-user Client-side) thành một nền tảng trực tuyến đa người dùng toàn diện (SaaS Platform).*

### 📋 Các nhiệm vụ ưu tiên:
1. **Hệ thống Tài khoản & Đồng bộ đám mây (Cloud Sync)**:
   - Tích hợp **Firebase Authentication** (hoặc OAuth Google) cho phép người học đăng nhập đồng bộ tiến trình học tập, chuỗi Streak và câu hỏi đánh dấu giữa mọi thiết bị (máy tính, điện thoại, tablet).
   - Đồng bộ dữ liệu lịch sử bài làm lên cơ sở dữ liệu đám mây đám mây bảo mật (**Firestore**).
2. **Tính năng Thi đấu Học thuật (PVP Battle Room)**:
   - Sử dụng **WebSockets** để tạo phòng thi thử trực tiếp theo thời gian thực (Real-time Multiplayer). Nhóm bạn học có thể cùng tham gia giải một bộ đề 15 câu và hiển thị bảng xếp hạng điểm số trực tiếp.
3. **Trung tâm Quản trị viên (Admin Dashboard)**:
   - Xây dựng giao diện Web cho giảng viên quản lý, biên soạn câu hỏi, theo dõi bảng thống kê phân tích các phần kiến thức chung mà đa số học viên trong lớp học thường trả lời sai để điều chỉnh bài giảng lý thuyết trực tiếp.
