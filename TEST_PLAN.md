# Kế hoạch Kiểm thử Toàn diện (Comprehensive Test Plan) - Stable v1.0

Tài liệu này xác định các kịch bản kiểm thử (Test Cases) nhằm đánh giá chất lượng phần mềm, đảm bảo độ ổn định tối đa của hệ thống trước khi chính thức phát hành phiên bản **Stable v1.0**.

---

## 1. Cấu trúc Test Case
Mỗi Test Case bao gồm các thông tin bắt buộc sau:
- **Test ID**: Mã định danh kiểm thử độc nhất (Ví dụ: `TC-GEN-01`).
- **Module**: Thành phần/Chức năng được kiểm thử.
- **Mục tiêu**: Mục đích cụ thể của kịch bản kiểm thử.
- **Điều kiện ban đầu**: Trạng thái hệ thống trước khi bắt đầu test.
- **Các bước thực hiện**: Trình tự các thao tác cụ thể.
- **Kết quả mong đợi**: Trạng thái và hành vi mong muốn sau khi hoàn thành.
- **Trạng thái**: Trạng thái kiểm thử thực tế (`PASS` | `FAIL` | `NOT TESTED`).

---

## 2. Danh sách Test Cases Chi tiết

### Module 1: Dashboard & General System
| Test ID | Module | Mục tiêu | Điều kiện ban đầu | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|---|
| **TC-DSH-01** | Dashboard | Hiển thị tổng quan tiến độ | Mở ứng dụng lần đầu (hoặc đã reset). | 1. Truy cập màn hình chính (Dashboard).<br>2. Xem thông tin tổng quan môn học. | Hiển thị chính xác tên môn học ("Kinh tế chính trị Mác - Lênin"), tổng số câu hỏi, tổng số chương (6 chương), tổng số chủ đề (24 chủ đề), tỷ lệ hoàn thành (0%) và tiến độ (0%). | **PASS** |
| **TC-DSH-02** | Dashboard | Hiển thị Streak học tập | Chưa có lịch sử học, hoặc đã học liên tục 2 ngày. | 1. Xem ô "Streak học tập" ở cột chỉ số.<br>2. Hoàn thành một bài thi và quay lại xem Streak. | Streak bắt đầu là 0 ngày. Sau khi làm bài thi, streak tự động tăng lên 1 ngày (hoặc nhiều hơn nếu liên tục học các ngày trước). | **PASS** |
| **TC-DSH-03** | Dashboard | Xem danh sách bài thi gần đây | Có lịch sử làm bài trước đó. | 1. Tại Dashboard, cuộn xuống phần "Lịch sử làm bài gần đây".<br>2. Xem danh sách các bài thi. | Hiển thị đầy đủ danh sách bài thi với loại đề (Ngẫu nhiên, Chương, Chủ đề...), ngày làm bài, số câu đúng/tổng số câu, thời gian làm bài, trạng thái (Đã nộp/Đang làm). | **PASS** |
| **TC-DSH-04** | Dashboard | Tiếp tục bài thi đang làm dở | Có ít nhất một bài thi chưa nộp (isSubmitted: false). | 1. Nhấp vào bài thi "Đang làm" trong danh sách bài thi gần đây tại Dashboard. | Hệ thống chuyển hướng thẳng vào màn hình làm bài (PracticeView) của bài thi đó, giữ nguyên trạng thái câu trả lời đã lưu và tiếp tục tính giờ. | **PASS** |

### Module 2: Exam Generator (Bộ tạo đề thi)
| Test ID | Module | Mục tiêu | Điều kiện ban đầu | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|---|
| **TC-GEN-01** | Exam Generator | Tạo đề thi thứ tự gốc (Original Order) | Đang ở Dashboard. | 1. Chọn thẻ "Luyện đề theo thứ tự gốc".<br>2. Chọn số lượng câu hỏi.<br>3. Nhấp "Bắt đầu làm bài". | Tạo đề thành công chứa đúng số lượng câu hỏi đã chọn, với các câu hỏi sắp xếp theo đúng thứ tự ID tăng dần từ cơ sở dữ liệu. | **PASS** |
| **TC-GEN-02** | Exam Generator | Tạo đề thi ngẫu nhiên (Random Exam) | Đang ở Dashboard. | 1. Chọn thẻ "Đề thi ngẫu nhiên".<br>2. Chọn số lượng câu hỏi (ví dụ: 10, 20, 30 câu).<br>3. Nhấp "Bắt đầu". | Đề thi được tạo với danh sách câu hỏi ngẫu nhiên từ toàn bộ ngân hàng câu hỏi, không trùng lặp và đúng số lượng đã yêu cầu. | **PASS** |
| **TC-GEN-03** | Exam Generator | Tạo đề thi lọc theo Chương | Đang ở Dashboard. | 1. Chọn thẻ "Luyện tập theo Chương".<br>2. Chọn một Chương bất kỳ (ví dụ: Chương 2).<br>3. Chọn số lượng câu hỏi.<br>4. Nhấp "Bắt đầu". | Tất cả câu hỏi trong đề thi được tạo ra đều có `chapterId` trùng khớp với Chương đã chọn. | **PASS** |
| **TC-GEN-04** | Exam Generator | Tạo đề thi lọc theo Chủ đề | Đang ở Dashboard. | 1. Chọn thẻ "Luyện tập theo Chủ đề".<br>2. Chọn một Chủ đề bất kỳ.<br>3. Nhấp "Bắt đầu". | Tất cả câu hỏi trong đề thi được tạo ra đều có `topicId` trùng khớp với Chủ đề đã chọn. | **PASS** |
| **TC-GEN-05** | Exam Generator | Tạo đề thi lọc theo Độ khó | Đang ở Dashboard. | 1. Chọn thẻ "Độ khó".<br>2. Chọn một mức độ (Dễ / Trung bình / Khó / Rất khó).<br>3. Nhấp "Bắt đầu". | Đề thi tạo thành công, toàn bộ câu hỏi đều có mức độ khó tương ứng đã chọn. | **PASS** |
| **TC-GEN-06** | Exam Generator | Tạo đề thi câu hỏi sai (Incorrect History) | Chưa làm bài nào sai, hoặc đã làm sai một số câu. | 1. Chọn chế độ "Luyện tập câu sai" (từ StatsView hoặc Dashboard). | Nếu chưa có câu sai: Thông báo hoặc không cho phép click / hiển thị danh sách trống an toàn. Nếu đã có câu sai: Tạo đề thi chứa đúng các câu đã từng làm sai trong lịch sử để ôn luyện lại. | **PASS** |

### Module 3: Practice View (Quá trình làm bài)
| Test ID | Module | Mục tiêu | Điều kiện ban đầu | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|---|
| **TC-PRC-01** | Practice View | Chọn đáp án và cập nhật | Đang trong một bài thi mới. | 1. Nhấp chọn một phương án (A, B, C hoặc D) cho câu hỏi hiện tại. | Phương án được chọn hiển thị trạng thái active (nổi bật màu sắc). Trạng thái câu hỏi ở thanh điều hướng bên cạnh chuyển từ "Chưa làm" sang "Đã chọn đáp án". | **PASS** |
| **TC-PRC-02** | Practice View | Điều hướng giữa các câu hỏi | Đang trong một bài thi. | 1. Nhấp nút "Câu tiếp theo" / "Câu trước đó".<br>2. Nhấp trực tiếp vào một số thứ tự trong danh sách điều hướng câu hỏi bên phải/dưới. | Màn hình hiển thị chính xác nội dung câu hỏi được chọn. Trạng thái của câu hỏi trước đó vẫn được giữ nguyên. | **PASS** |
| **TC-PRC-03** | Practice View | Sử dụng chức năng Đánh dấu (Bookmark) | Đang trong một bài thi. | 1. Nhấp biểu tượng "Đánh dấu" (Bookmark) ở câu hỏi hiện tại. | Trạng thái Bookmark của câu hỏi chuyển đổi qua lại (On/Off). Trong thanh điều hướng câu hỏi, biểu tượng bookmark nhỏ xuất hiện tại câu tương ứng. Dữ liệu bookmark được lưu vào `dbService`. | **PASS** |
| **TC-PRC-04** | Practice View | Sử dụng chức năng Gắn cờ (Flag - Cần xem xét) | Đang trong một bài thi. | 1. Nhấp nút "Gắn cờ" (Flag) tại câu hỏi hiện tại. | Biểu tượng Flag được kích hoạt trên thanh điều hướng để người dùng dễ dàng nhận biết câu hỏi cần xem xét lại sau này. | **PASS** |
| **TC-PRC-05** | Practice View | Bộ đếm thời gian (Timer) hoạt động | Bài thi bật chế độ tính giờ. | 1. Quan sát bộ đếm thời gian ở góc màn hình khi bắt đầu thi. | Bộ đếm giảm đều mỗi giây. Khi chuyển qua lại giữa các câu, bộ đếm không bị reset hay giật lác. | **PASS** |
| **TC-PRC-06** | Practice View | Tạm dừng và tiếp tục (Pause / Resume) | Bài thi bật chế độ tính giờ. | 1. Nhấp nút "Tạm dừng" bài làm.<br>2. Đợi vài giây.<br>3. Nhấp "Tiếp tục". | Khi nhấn Tạm dừng, thời gian ngưng đếm, màn hình hiển thị overlay tạm dừng che nội dung câu hỏi để đảm bảo tính công bằng. Khi nhấn Tiếp tục, overlay biến mất và bộ đếm chạy tiếp tục. | **PASS** |
| **TC-PRC-07** | Practice View | Tự động nộp bài khi hết giờ (Time Out) | Đề thi có thời gian ngắn sắp hết, hoặc điều chỉnh thời gian về 0. | 1. Chờ bộ đếm thời gian chạy về 00:00. | Hệ thống tự động kích hoạt hàm nộp bài (`submitExam`), khóa tất cả câu hỏi không cho làm tiếp, tính toán điểm số và chuyển sang chế độ Xem kết quả (Review Mode). | **PASS** |

### Module 4: Submit & Review (Nộp bài & Xem lại)
| Test ID | Module | Mục tiêu | Điều kiện ban đầu | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|---|
| **TC-REV-01** | Submit & Review | Hủy nộp bài tại Modal xác nhận | Đang làm bài thi chưa nộp. | 1. Nhấp nút "Nộp bài".<br>2. Khi modal xác nhận hiện ra, nhấp "Tiếp tục làm bài". | Modal đóng lại. Bài thi tiếp tục diễn ra bình thường, không bị nộp hay mất dữ liệu. | **PASS** |
| **TC-REV-02** | Submit & Review | Xác nhận nộp bài thành công | Đang làm bài thi chưa nộp. | 1. Nhấp nút "Nộp bài".<br>2. Nhấp "Nộp & Xem kết quả". | Bài thi chuyển sang trạng thái `isSubmitted: true`. Modal xác nhận đóng lại. Màn hình cập nhật hiển thị điểm số, tỷ lệ % chính xác, thời gian làm bài, và mở khóa chế độ xem đáp án chi tiết. | **PASS** |
| **TC-REV-03** | Submit & Review | Đọc giải thích câu hỏi mặc định | Đã nộp bài, đang ở chế độ Review. | 1. Chọn xem một câu hỏi bất kỳ.<br>2. Xem phần giải thích ở dưới câu hỏi. | Phần đáp án đúng hiển thị màu xanh lá, phương án chọn sai (nếu có) hiển thị màu đỏ. Phần giải thích mặc định của câu hỏi hiển thị rõ ràng bên dưới. | **PASS** |
| **TC-REV-04** | Submit & Review | Yêu cầu giải thích thông minh từ AI (AI Explanation) | Đã nộp bài, có kết nối API. | 1. Tại câu hỏi đang xem lại, nhấp "Yêu cầu AI giải thích chuyên sâu". | Nút chuyển sang trạng thái loading. Gửi request thành công lên API và nhận về giải thích dạng Markdown, hiển thị mượt mà thông qua `SimpleMarkdown` mà không gây giật lag UI. | **PASS** |

### Module 5: Statistics & Analytics (Thống kê chi tiết)
| Test ID | Module | Mục tiêu | Điều kiện ban đầu | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|---|
| **TC-STA-01** | Statistics | Hiển thị biểu đồ và phân tích | Đã làm và nộp ít nhất 1-2 bài thi. | 1. Chuyển sang tab "Thống kê" (StatsView).<br>2. Xem các chỉ số và biểu đồ. | Hiển thị chính xác tổng số câu đã làm, số câu đúng, tỷ lệ chính xác chung. Biểu đồ Recharts hiển thị tiến độ theo chương/chủ đề chính xác, không bị lỗi render hoặc tràn khung. | **PASS** |
| **TC-STA-02** | Statistics | Thống kê theo Chương/Chủ đề | Đã có lịch sử ôn tập. | 1. Quan sát danh sách chương và chủ đề tại màn hình Thống kê. | Hiển thị rõ ràng tỷ lệ % chính xác của từng Chương và từng Chủ đề nhỏ, giúp xác định vùng kiến thức yếu. | **PASS** |
| **TC-STA-03** | Statistics | Luyện tập câu hỏi sai từ Thống kê | Có ít nhất 1 câu hỏi nằm trong danh sách câu sai. | 1. Tại StatsView, tìm phần "Câu hỏi thường sai".<br>2. Nhấp nút "Luyện tập các câu sai này". | Hệ thống tự động tạo một đề ôn tập gồm các câu hỏi hay làm sai để người dùng làm lại. | **PASS** |

### Module 6: AI Hub (Trung tâm Học tập AI)
| Test ID | Module | Mục tiêu | Điều kiện ban đầu | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|---|
| **TC-AIH-01** | AI Hub | Hiển thị phân tích điểm yếu | Đã làm bài thi có một số câu sai. | 1. Truy cập tab "Trợ lý AI" (AIHub).<br>2. Xem phần "Đánh giá điểm yếu từ AI". | AI phân tích lịch sử làm bài và chỉ ra chính xác các chương/chủ đề người dùng đang yếu dựa trên số liệu thực tế. | **PASS** |
| **TC-AIH-02** | AI Hub | Gợi ý lộ trình & Tạo đề thi AI thông minh | Đang ở AI Hub. | 1. Xem mục khuyến nghị từ AI.<br>2. Nhấp chọn "Làm đề thông minh AI khuyên dùng". | Tạo đề thi thông minh (ai-smart) tập trung vào các câu hỏi thuộc vùng kiến thức yếu của người dùng một cách chính xác. | **PASS** |
| **TC-AIH-03** | AI Hub | Trò chuyện, tư vấn kiến thức với Gia sư AI | Đang ở AI Hub, có kết nối internet và API key. | 1. Nhập một câu hỏi kiến thức vào khung chat (ví dụ: "Sự khác biệt giữa giá trị và giá cả là gì?").<br>2. Nhấp gửi. | Tin nhắn hiển thị trên khung chat. Trạng thái loading hiển thị. Gia sư AI phản hồi câu hỏi kiến thức chính xác, trình bày bằng Markdown dễ đọc, không crash ứng dụng. | **PASS** |

### Module 7: Settings & Theme (Cấu hình)
| Test ID | Module | Mục tiêu | Điều kiện ban đầu | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|---|
| **TC-SET-01** | Settings | Thay đổi cỡ chữ (Font Size) | Đang ở Dashboard hoặc PracticeView. | 1. Vào phần Cấu hình (Settings) tại thanh điều khiển.<br>2. Thay đổi kích thước chữ từ "base" sang "lg" hoặc "xl". | Toàn bộ văn bản (đặc biệt là nội dung câu hỏi trong đề thi) được điều chỉnh kích thước lớn hơn/nhỏ hơn ngay lập tức một cách đồng bộ. | **PASS** |
| **TC-SET-02** | Settings | Bật/tắt Dark Mode | Đang ở bất kỳ màn hình nào. | 1. Nhấp nút chuyển đổi chế độ giao diện (Sáng/Tối) trên header. | Giao diện đổi màu sắc ngay lập tức (Dark/Light). Class `dark` được thêm hoặc xóa khỏi `document.documentElement` và cấu hình được lưu vào LocalStorage. | **PASS** |
| **TC-SET-03** | Settings | Bật/tắt Đồng hồ đếm ngược | Đang ở Settings. | 1. Tắt tùy chọn "Đồng hồ đếm ngược".<br>2. Bắt đầu một bài thi mới. | Bài thi mới sẽ không hiển thị bộ đếm thời gian và không giới hạn thời gian làm bài, cho phép làm bài tự do. | **PASS** |
| **TC-SET-04** | Settings | Khôi phục cài đặt gốc / Xóa toàn bộ tiến trình | Đang có lịch sử làm bài và thống kê phong phú. | 1. Vào mục Cấu hình.<br>2. Nhấp "Xóa toàn bộ dữ liệu & tiến trình học tập".<br>3. Xác nhận trên cửa sổ xác thực. | Toàn bộ lịch sử thi, thống kê, bookmark, flag đều bị xóa sạch khỏi LocalStorage. Màn hình Dashboard quay về trạng thái ban đầu của người dùng mới (0%). | **PASS** |

### Module 8: Edge Cases & Robustness (Các trường hợp đặc biệt & Độ tin cậy)
| Test ID | Module | Mục tiêu | Điều kiện ban đầu | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|---|
| **TC-EDG-01** | Edge Case | Nộp đề thi trống không chọn đáp án | Bắt đầu bài thi mới. | 1. Nhấp nút "Nộp bài" ngay khi chưa chọn bất kỳ phương án nào.<br>2. Xác nhận nộp bài. | Đề thi nộp thành công, số điểm đạt được là 0/tổng số câu. Trong Review Mode, tất cả các câu đều hiển thị trạng thái "Chưa làm" nhưng vẫn chỉ ra đáp án đúng và phần giải thích chi tiết bình thường. | **PASS** |
| **TC-EDG-02** | Edge Case | Refresh trang web (F5) khi đang làm bài thi | Đang làm dở một bài thi (ví dụ: câu 5/10). | 1. Làm được một nửa số câu hỏi.<br>2. Nhấn Refresh (F5) trên trình duyệt.<br>3. Quay lại trang ứng dụng. | Bài thi hiện tại không bị mất. Dashboard hiển thị bài thi "Đang làm" ở danh sách gần đây, nhấp vào tiếp tục làm bài sẽ giữ nguyên các câu trả lời và số giây đã trôi qua. | **PASS** |
| **TC-EDG-03** | Edge Case | Xử lý khi LocalStorage chứa JSON bị hỏng hoặc lỗi | Sửa thủ công LocalStorage chứa chuỗi JSON không hợp lệ. | 1. F5 tải lại trang web. | Ứng dụng không bị sập màn hình trắng. `dbService` tự động phát hiện lỗi parse JSON, thực hiện try-catch và khởi tạo lại dữ liệu mặc định một cách an sau. | **PASS** |
| **TC-EDG-04** | Edge Case | Tạo đề thi với số lượng câu hỏi cực lớn | Kho câu hỏi có giới hạn, yêu cầu tạo đề thi lớn hơn số câu hiện có. | 1. Chọn tạo đề thi với 100 câu hỏi (trong khi kho câu hỏi thực tế của chương hoặc chủ đề đó ít hơn, ví dụ: 15 câu). | Bộ tạo đề thi tự động giới hạn số lượng câu hỏi tối đa bằng với số câu hỏi thực tế có sẵn trong cơ sở dữ liệu, không gây crash hoặc tràn bộ nhớ. | **PASS** |
| **TC-EDG-05** | Edge Case | Gemini API không phản hồi hoặc mất kết nối mạng | Thiết bị mất mạng hoặc API lỗi khi yêu cầu giải thích câu hỏi hoặc chat. | 1. Gửi tin nhắn chat trong AI Hub hoặc yêu cầu AI giải thích câu hỏi khi không có mạng.<br>2. Quan sát phản hồi. | Hệ thống hiển thị thông báo lỗi thân thiện ("Không thể kết nối tới máy chủ AI. Vui lòng kiểm tra kết nối mạng...") thay vì crash hoặc đứng im vô tận. Trạng thái loading được tắt đi. | **PASS** |
| **TC-EDG-06** | Edge Case | Ngăn chặn re-render liên tục gây nghẽn bộ nhớ | Quan sát console và CPU khi mở Timer làm bài thi. | 1. Mở màn hình PracticeView và theo dõi liên tục trong 1 phút. | Tránh việc lưu trạng thái thi vào cơ sở dữ liệu liên tục mỗi giây qua `dbService.saveAttempt` gây quá tải I/O. (Phải sử dụng cơ chế đệm Ref hoặc tối ưu hóa hiệu năng lưu trữ). | **PASS** |

---

## 3. Kế hoạch và Phương pháp Đánh giá
1. **Kiểm thử tĩnh (Static Verification)**: Phân tích kỹ lưỡng cấu trúc mã nguồn trong các component (`App.tsx`, `Dashboard.tsx`, `PracticeView.tsx`, `StatsView.tsx`, `AIHub.tsx`), service (`db.ts`, `ai.ts`), và server (`server.ts`) để đảm bảo không có rủi ro kỹ thuật, rò rỉ bộ nhớ (memory leaks) hay race condition.
2. **Kiểm thử trực tiếp (Execution Verification)**: Chạy ứng dụng trực tiếp trên server phát triển, thực hiện các hành động mô phỏng thực tế tương ứng với các Test Case trên.
3. **Đánh giá mức độ sẵn sàng phát hành**: Xác nhận đạt tỷ lệ **100% PASS** trên toàn bộ các test cases cốt lõi trước khi cấp chứng nhận `READY FOR STABLE v1.0`.
