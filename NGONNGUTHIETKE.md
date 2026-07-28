# Ngôn ngữ thiết kế của AI Learning OS

Tài liệu này rút ra từ việc đo trực tiếp Khan Academy bằng trình duyệt, không phải đọc tài liệu
về nó. Mọi con số trong đây đều lấy từ `getComputedStyle` trên trang thật ngày 28/07/2026.

Mục đích: **lấy cảm hứng, không sao chép.** Không dùng mã màu, hình minh hoạ, biểu tượng hay
bất kỳ tài sản nào của Khan Academy.

Đọc kèm: [AGENTS.md](AGENTS.md) cho bất biến kỹ thuật, [BANGIAO.md](BANGIAO.md) cho lịch sử.

---

## Tầng 1: Triết lý sản phẩm

### Vì sao Khan Academy trông đáng tin

Không phải vì đẹp. Vì **nó tự kiềm chế**. Đếm trên trang khoá học: **không một đổ bóng nào**,
**một mốc chuyển động duy nhất** (0,1s), **ba mốc bo góc** (4px, 8px, viên thuốc), **hai độ
đậm chữ** (400 và 700). Một hệ thống ít lựa chọn tới mức đó chỉ có thể là kết quả của việc đã
quyết định xong, và người đọc cảm nhận được sự đã-quyết-định-xong đó.

Ngược lại, một giao diện có chín mức đổ bóng và sáu mốc bo góc thì mỗi màn là một lần thương
lượng lại. Người dùng không nói ra được điều đó, nhưng họ cảm thấy nó.

### Vì sao người học ít mỏi mắt

Ba cơ chế đo được:

1. **Không có gì nhấp nháy hay trôi.** Một mốc 0,1s cho toàn bộ vỏ ứng dụng. Nội dung xuất hiện
   là xuất hiện, không trượt vào.
2. **Cỡ chữ nhỏ nhất là 12px**, và chỉ dùng cho chú thích kiểu thời lượng video.
3. **Cột đọc hẹp**: câu hỏi rộng 592px trên khung 1280px. Phần còn lại là khoảng trắng.

### Vì sao nó không giống SaaS, không giống Dashboard

Đây là phát hiện sâu nhất, và **nó không phải chuyện CSS**.

Khan trình bày nội dung như **một tài liệu có cấu trúc**. Trang khoá học là: tiêu đề chương,
rồi hai cột danh sách bài, mỗi bài là **một dòng chữ 14px màu mờ `#717378` kèm một biểu tượng
24px, không viền, không nền, không bo góc, cao đúng 24px**.

Tiến độ được viết thành **câu**: "Tinh thông chương: 0%", cỡ 14px, đậm 400, màu chữ thường.
Không phải thẻ chỉ số. Không phải huy hiệu màu. Không phải số to.

Bảng điều khiển thì làm ngược lại: mỗi con số một cái thẻ, mỗi thẻ một cái viền, mỗi viền một
cái bóng. Khi mọi mẩu dữ liệu đều được đóng khung thì không mẩu nào quan trọng hơn mẩu nào, và
màn hình biến thành bảng theo dõi thay vì chỗ để đọc.

**Nguyên tắc rút ra: nội dung là chủ thể, số liệu là chú thích của nội dung.**

### Vì sao người học muốn học tiếp

Trạng thái sai của Khan **không có màu đỏ ở bất cứ đâu**. Đáp án đã chọn giữ nguyên màu xanh,
thông điệp là "Đáp án của bạn gần chính xác", nút đổi thành "Thử lại". Hộp thông báo sai dùng
**đúng cùng màu chữ và cùng đổ bóng** với hộp thông báo đúng, chỉ khác chữ.

Nguyên tắc: **sai không phải là sự kiện tiêu cực, nó là một bước của việc học.**

---

## Tầng 2: Ngôn ngữ thương hiệu

| Đặc điểm | Khan Academy | Áp dụng cho AI Learning OS |
|---|---|---|
| Sắc thái | Học thuật nhưng thân thiện, không nghiêm nghị | Giữ nguyên tinh thần |
| Neo nhận diện | Dải điều hướng navy rất sẫm chạy hết bề ngang | Dải sẫm, sắc navy **khác** |
| Hành động chính | Xanh dương, không bao giờ đen | Xanh dương sâu hơn một bậc |
| Thành tựu | Vương miện, ngôi sao, tia chớp, dạng khối đặc | Tự vẽ, không mượn hình của họ |
| Giọng chữ | Câu hoàn chỉnh, không phải nhãn cụt | Giữ nguyên |

**Chống chỉ định**: không mascot, không hoạt hình, không hình minh hoạ trẻ con. Người học ở đây
là sinh viên đại học và người đi làm.

---

## Tầng 3: Ngôn ngữ thiết kế

### Chữ

Đo trên Khan (font trong ứng dụng học là Lato):

| Vai trò | Cỡ / dòng / đậm | Tỷ lệ dòng |
|---|---|---|
| Tiêu đề trang | 36 / 40 / 700 | 1,11 |
| Tiêu đề mục lớn | 28 / 32 / 700 | 1,14 |
| Tiêu đề mục | 20 / 24 / 700 | 1,20 |
| Câu hỏi | 18 / 22 / 700 | 1,22 |
| Thân, nút, liên kết | 16 / 20 hoặc 16 / 24 | 1,25 tới 1,50 |
| Chữ phụ | 14 / 19,6 / 400 | 1,40 |
| Nhãn phân loại | 12 / 16 / **700 viết hoa** | 1,33 |

**Hai quy tắc chữ, cả hai đều ngược trực giác:**

1. **Chỉ dùng hai độ đậm: 400 và 700.** Không có 500, không có 600. Thứ bậc do cỡ chữ gánh,
   độ đậm chỉ để phân biệt "chữ để đọc" với "chữ để bấm hoặc để nhận diện".
2. **Tiêu đề càng lớn thì tỷ lệ dòng càng chặt.** 36px dùng 1,11; 14px dùng 1,40. Ngược với
   thói quen đặt một tỷ lệ dòng chung cho mọi cỡ.

Giãn chữ để `normal` ở gần như mọi chỗ, kể cả nhãn viết hoa.

> **Ghi chú tự đính chính.** Ở một vòng trước tôi đã gỡ toàn bộ 154 chỗ viết hoa với lý do chữ
> hoa không có hình bao từ nên đọc chậm hơn. Lý do ấy đúng, nhưng tôi đã đi xa hơn bản đặc tả:
> Khan **có** dùng chữ hoa, cho đúng một vai trò là nhãn phân loại, ở 12px đậm 700 và giãn chữ
> bình thường. Trường hợp tôi gỡ là 10px với giãn chữ **âm**, tệ hơn hẳn. Nếu sau này cần nhãn
> phân loại thì dùng đúng công thức 12px/700/hoa/giãn bình thường, đừng quay lại 10px.

### Khoảng trắng và nhịp

- Khung nội dung tối đa **1200px**.
- Cột đọc câu hỏi **592px**, tức chưa tới một nửa khung.
- Đệm thẻ **16px** hoặc **24px**, không có giá trị nào khác.
- Khe giữa các phần tử: **16px** áp đảo; danh sách dày dùng **4px** và **8px**.

### Phân tầng bề mặt

Chỉ có ba tầng, và **không tầng nào dùng đổ bóng**:

1. Nền trang: trắng.
2. Thẻ nội dung: trắng, tách ra bằng **một đường viền 1px** màu xám rất nhạt.
3. Mảng được nhấn: nền pha sắc rất nhạt cùng tông với màu ngữ nghĩa của nó.

Đổ bóng chỉ tồn tại đúng một chỗ trong cả luồng học: hộp phản hồi sau khi nộp câu,
`0 4px 8px rgba(33,36,44,0.16)`. Nhờ vậy bóng luôn có nghĩa là "cái này đè lên trang".

### Chuyển động

Một mốc `0,1s ease-in-out` cho toàn bộ vỏ ứng dụng, `0,125s` cho hàng đáp án. Không có hiệu ứng
nảy, không có chuyển động khi nội dung xuất hiện, không có gì dài hơn.

---

## Tầng 4: Ngôn ngữ thành phần

### Nút

Một đặc tả duy nhất: cao **40px**, bo **4px**, đệm ngang **16px**, chữ **16px đậm 700**. Nút
phụ cùng kích thước nhưng nền trắng, viền 1px. Không có biến thể nào khác.

### Thẻ

Bo **8px**, viền **1px**, nền trắng, **không đổ bóng**, đệm 16 hoặc 24px.

Quan trọng hơn kích thước: **thẻ bọc cả một MỤC, không bọc từng dòng.** Thẻ chương của Khan
chứa nguyên hai cột danh sách bài bên trong. Từng bài không có thẻ riêng.

### Hàng nội dung trong danh sách

Cao **24px**, đệm **0**, không nền, không viền, không bo góc. Biểu tượng **24px** cách chữ
**8px**. Chữ **14px đậm 400 màu mờ `#717378`**.

Nghĩa là hàng nội dung **nhạt hơn** tiêu đề mục chứa nó. Danh sách không tranh chú ý với cấu
trúc bao quanh nó.

### Mục điều hướng trong khung bên

Cao **70px**, đệm **16px**. Bên trong hai dòng:
- Nhãn phân loại: 12px, đậm 700, viết hoa, màu chữ chính.
- Tiêu đề: 16px, đậm **400**, màu chữ chính.

Mục đang mở: nền pha xanh rất nhạt, vạch trái **6px** màu xanh thương hiệu, tiêu đề chuyển sang
đậm 700 và màu xanh sẫm.

### Ô chữ cái đáp án

Hình vuông bo **4px**, lúc nghỉ là **viền 2px rỗng ruột**, lúc được chọn thì **tô đặc** và chữ
đổi sang trắng. Chính ô này gánh phần lớn tín hiệu trạng thái, nên hàng phía sau nó mới được
phép để trống trơn.

---

## Tầng 5: Ngôn ngữ tương tác

| Trạng thái | Cách Khan làm |
|---|---|
| Rê chuột | Đổi nền rất nhẹ, 0,1s. Không nhấc lên, không đổ bóng. |
| Tiêu điểm bàn phím | Vòng viền 2px màu thương hiệu, **có sẵn dạng trong suốt** để lúc hiện ra bố cục không xê dịch. |
| Đang bấm | Đổi màu nền sang bậc sẫm hơn, không dùng `opacity`. |
| Vô hiệu | Chữ và viền lùi về xám nhạt, giữ nguyên hình dạng. |
| Trả lời đúng | Ô chữ cái tô xanh lá kèm dấu tích, chữ chuyển xanh lá, **các phương án còn lại lùi về màu mờ chứ không biến mất**. |
| Trả lời sai | **Không đỏ.** Nút đổi thành "Thử lại". |

**Nguyên tắc `opacity`**: không bao giờ dùng `opacity` để thể hiện trạng thái của chữ. Nó kéo
tương phản xuống theo. Đổi màu thay vì đổi độ đục.

---

## Tầng 6: Ngôn ngữ hình minh hoạ

Đo trực tiếp tệp SVG minh hoạ của Khan:

| Chỉ số | Giá trị |
|---|---|
| Số đường dẫn trong một hình | **6** |
| Có nét viền | **không**, chỉ có mảng tô |
| Tỷ lệ lệnh cong trên tổng lệnh | **77%** |
| Số màu | 6 |

Tức là: **mảng phẳng, bo cong mạnh, không viền, rất ít chi tiết.** Cộng thêm các dấu nhấn hình
học rải rác (dấu sao nhiều cánh, dấu nhân, vòng tròn rỗng, hình thoi rỗng) ở các sắc ấm và
lạnh xen kẽ.

### Biểu tượng, và đây là khác biệt lớn nhất chưa xử lý

| | Khan Academy | AI Learning OS hiện tại |
|---|---|---|
| Kiểu | `fill` đặc, `stroke: none` | `fill: none`, `stroke` 2px |
| Khung | 24×24 và 16×16 | phần lớn 14×14 |
| Đầu nét, khớp nối | không có nét | bo tròn |
| Số đường dẫn mỗi biểu tượng | **1** | nhiều |

Biểu tượng tô đặc ở 24px đọc ra **ký hiệu trong sách giáo khoa**. Biểu tượng viền nét mảnh ở
14px đọc ra **chrome của bảng điều khiển**. Đây là thứ mắt nhận ra trước cả màu sắc.

Bộ biểu tượng đang dùng là `lucide-react`, vốn chỉ có dạng viền nét. Không đổi bộ được nếu
không thêm phụ thuộc, nên hướng khả thi là **nâng cỡ và nâng độ dày nét** để biểu tượng đặc lại
và ngang hàng với chữ, thay vì mảnh hơn chữ.

---

## Những gì CỐ Ý không lấy từ Khan Academy

1. **Khung điều hướng bên trái.** Khan có cột trái 405px liệt kê chương của khoá học. Thêm nó
   là đổi kiến trúc thông tin, mà Đàm cấm. Đây là lý do hạng mục Bố cục và Điều hướng sẽ không
   bao giờ đạt 100%.
2. **Mã màu.** Không dùng `#0b2149`, `#1865F2`, `#0B7C18` hay bất kỳ mã nào của họ.
3. **Hình minh hoạ và biểu tượng.** Không tải, không phái sinh.
4. **Cấu trúc khoá học theo chương và kỹ năng.** Sản phẩm này tổ chức theo môn thi, không theo
   khoá học.
