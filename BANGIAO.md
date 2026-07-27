# BANGIAO.md, sổ bàn giao giữa các phiên làm việc

Mỗi lần AI làm xong một việc và commit, phải ghi thêm MỘT mục vào phần "Nhật ký bàn giao" bên
dưới. Mục đích: một AI khác (hoặc chính Đàm sau vài tháng) mở file này ra là hiểu ngay dự án
vừa trải qua chuyện gì, đã sửa gì, vì sao sửa, và đang còn nợ những gì. Đọc lịch sử git thì
thấy được cái gì đổi, nhưng không thấy được **vì sao** và **cái gì đã thử rồi mà sai**.

Đọc kèm: [AGENTS.md](AGENTS.md) cho bản đồ mã nguồn và các bất biến không được phá.

---

## Nếp làm việc bắt buộc

### Tự động commit, không hỏi

Đàm đã ủy quyền thường trực từ 26/07/2026: **làm xong việc thì tự commit, không cần hỏi.**
Không phải hỏi lại mỗi lần. Quyền đã mở sẵn trong `.claude/settings.json`.

Trình tự bắt buộc mỗi lần commit:

1. Chạy `npm run check` và phải ĐẠT toàn bộ. **Tuyệt đối không commit khi đang đỏ.**
2. Soát `git status` xem có file rác lọt vào không (file tạm, file gỡ rối, bản dựng).
3. Commit với thông điệp nêu rõ **đã đổi gì và vì sao**, không chỉ liệt kê tên file.
4. Ghi một mục mới vào "Nhật ký bàn giao" ở cuối file này.
5. Nếu có thay đổi ảnh hưởng cách làm việc thì cập nhật luôn [CLAUDE.md](CLAUDE.md) và
   [AGENTS.md](AGENTS.md) cho khỏi mâu thuẫn.
6. **Push lên `main`, không hỏi.** Đàm ủy quyền thường trực từ 27/07/2026.

### Tự động push, và cái giá của nó

Từ 27/07/2026 Đàm bỏ luôn chốt hỏi trước khi push. Trước đó `git push` nằm ở mục "phải hỏi"
vì đẩy lên `main` là deploy thật lên onthidaihocmo.vercel.app.

Điều đó **không biến việc push thành vô hại**, nó chỉ chuyển toàn bộ gánh nặng sang
`npm run check`. Sau khi push không còn ai duyệt nữa. Vì vậy:

- Đỏ thì dừng, không có ngoại lệ nào cả.
- Đừng nới ngưỡng một phép kiểm cho nó xanh. Nếu tin là phép kiểm sai, hãy chứng minh bằng số
  đo rồi ghi lý do vào nhật ký bàn giao.
- Động tới xác thực, đăng nhập hay hàm serverless thì chạy `npm run check:prod` **sau khi
  push** và báo kết quả cho Đàm. Bẫy 1 là loại lỗi xanh ở máy cục bộ nhưng chết trên máy chủ,
  nay nó lên thẳng bản chạy thật.

### Việc KHÔNG được tự làm

- Xóa dữ liệu học của Đàm, đổi cấu hình Supabase hay Vercel, bật lại đăng nhập.

### Quy ước viết

Tiếng Việt thuần cho giao diện và chú thích, không chèn tiếng Anh vào câu, không dùng dấu gạch
ngang dài. Chú thích nên giải thích **vì sao**, nhất là chỗ đang vá một lỗi thật.

---

## Nhật ký bàn giao

Mục mới nhất ở trên cùng. Mỗi mục cần đủ: ngày, mã commit, đã làm gì, vì sao, kiểm chứng ra
sao, và còn nợ gì.

---

### 28/07/2026 — Gỡ chữ viết hoa khỏi 154 chỗ, dấu vết bảng điều khiển cuối cùng

**Đã làm**: gỡ `uppercase` khỏi toàn bộ 154 chỗ, kèm 78 chỗ `tracking-wider` đi cặp với nó.

**Vì sao**: chữ hoa không có hình bao từ. Chữ thường có phần nhô lên (l, h, t) và thụt xuống
(g, y, p) tạo ra một bóng dáng riêng cho từng từ, và mắt dùng chính bóng dáng đó để nhận từ mà
không cần đọc từng chữ cái. Viết hoa biến mọi từ thành một khối chữ nhật giống hệt nhau, xoá
sạch manh mối đó. Đây là lý do chữ hoa luôn đọc chậm hơn, và với sản phẩm để học nhiều giờ
liền thì 154 nhãn như vậy là một khoản thuế trả suốt buổi.

Đo trên Khan Academy: trong toàn bộ luồng học chỉ dùng chữ hoa ở **đúng một chỗ**, là dòng
đường dẫn "KHÓA HỌC: SỐ HỌC > CHƯƠNG 1" trong khung bên trái. Chữ hoa dùng thưa như vậy thì
còn là dấu hiệu phân loại; dùng 154 lần thì thành tiếng ồn.

**Một cái bẫy đã kiểm trước khi sửa**: gỡ class `uppercase` chỉ ăn thua nếu chữ gốc trong mã
nguồn vốn viết thường. Quét thì thấy có **5 chuỗi viết hoa sẵn ngay trong mã**, gỡ class không
chạm tới được. Bốn chuỗi đã đổi sang viết thường ("Tiến trình củng cố", "Bạn chọn", "Đúng là",
"Đánh giá tiến trình"). Chuỗi thứ năm là "ÔN THI ĐẠI HỌC MỞ", tức tên thương hiệu, **giữ
nguyên**: tên thương hiệu viết hoa là quy ước nhận diện chứ không phải nhãn để đọc.

**Kiểm chứng**: quét cả sáu màn, còn **0 phần tử** dùng chữ hoa, không màn nào vỡ hay tràn.
`npm run check` đạt toàn bộ 6 chặng.

**Một ghi chú tự sửa**: quy tắc `.uppercase { letter-spacing: 0.06em }` thêm ở vòng token nay
không còn phần tử nào dùng tới. Vẫn giữ lại làm hàng rào phòng khi sau này có ai thêm
`uppercase` vào đâu đó, để khỏi lặp lại lỗi giãn âm cũ. Đã cập nhật chú thích trong `index.css`
cho khớp thực tế.

---

### 28/07/2026 — Gỡ font đơn cách khỏi 371 chỗ, giữ nguyên chữ số thẳng cột

Vòng tiếp theo của đợt tái thiết kế theo Khan Academy. Đây là thứ tạo ra cảm giác "bảng điều
khiển quản trị" mà Đàm muốn bỏ.

**Không gỡ hàng loạt theo cảm tính, mà phân loại bằng số đo trước.** Chạy trên bản đang chạy
thật, duyệt cả sáu màn, lấy mọi phần tử có `font-family` chứa "mono" rồi phân loại nội dung
chữ của nó:

| Loại nội dung | Số chuỗi khác nhau | Đơn cách có đáng không |
|---|---|---|
| Chỉ có chữ số | **5** | Không, vì không chuỗi nào nằm trong cột số cần thẳng hàng |
| Chỉ có chữ tiếng Việt | **40** | Sai hoàn toàn |
| Lẫn lộn, kiểu "41 câu có sẵn • đã làm 0 câu" | **32** | Là câu văn, không phải cột số |

Tức trong 77 chuỗi, đúng **5 chuỗi** là số thuần, và cả 5 đều là giá trị đơn lẻ ("6", "7",
"0%") chứ không phải cột số xếp chồng. Lợi ích duy nhất có thật của font đơn cách là **chữ số
xếp thẳng cột**, mà ở đây không có chỗ nào cần đến nó.

Còn cái giá thì đo được: chuỗi "Chưa đủ dữ liệu" rộng **360px** trong JetBrains Mono so với
**297,6px** trong Inter ở cùng cỡ chữ, tức **rộng thêm 21%**. Trong bảng dày, 21% ấy phải trả
bằng chữ nhỏ hơn hoặc gãy dòng nhiều hơn. Cộng thêm bề rộng đều nhau xoá mất hình bao từ, vốn
là manh mối chính để mắt lướt nhanh.

**Cách sửa**: thay `font-mono` bằng `tabular-nums` ở cả 371 chỗ. Đây không phải xoá mà là đổi
sang thứ giữ đúng lợi ích và bỏ hết cái giá: `tabular-nums` bật `font-variant-numeric` nên chữ
số vẫn xếp thẳng cột, còn chữ cái thì về lại font tỷ lệ.

**Đã kiểm chứng là Inter thật sự làm được việc đó**, không phải tin lời tài liệu. Đo bề rộng
hai chuỗi sáu chữ số trên bản chạy thật:

| Chế độ | "111111" | "000000" | Thẳng cột |
|---|---|---|---|
| `normal` | 97,6px | 151,4px | không |
| `tabular-nums` | 155,6px | 155,6px | **có** |

**Kết quả đo lại sau khi sửa**: không còn phần tử nào trong ứng dụng dùng font đơn cách.

`npm run check` đạt toàn bộ 6 chặng.

**Lưu ý cho người sau**: `--font-mono` vẫn còn khai báo trong `index.css` và JetBrains Mono vẫn
còn trong dòng `@import` font. Chưa gỡ vì có thể sau này cần hiển thị mã hoặc dữ liệu thô thật
sự. Nếu chắc chắn không dùng nữa thì gỡ khỏi `@import` sẽ tiết kiệm được một lượt tải font.

---

### 28/07/2026 — Đặt sàn cỡ chữ ở 12px, gỡ 405 chỗ viết thẳng số

Vòng tiếp theo của đợt tái thiết kế theo Khan Academy.

**Đã làm**: gộp toàn bộ cỡ chữ dưới 12px về một token duy nhất `text-2xs` bằng 12px.

| Cỡ cũ | Số chỗ |
|---|---|
| `text-[8px]` | 7 |
| `text-[9px]` | 34 |
| `text-[10px]` | 245 |
| `text-[11px]` | 120 |
| **Tổng** | **406** |

**Vì sao**: đây là nguồn mỏi mắt lớn nhất còn lại của sản phẩm. Đo trên Khan Academy, cỡ nhỏ
nhất tồn tại trong toàn bộ sản phẩm là **12px**, và chỉ dùng cho chú thích kiểu thời lượng
video. Không có gì dưới 12px. Ở đây có tới **41 chỗ dùng 8px và 9px**, phần lớn là nhãn mục
trong bảng giảng giải của gia sư AI, tức đúng thứ người học phải đọc kỹ nhất sau mỗi câu sai.

Quan trọng không kém: chúng **viết thẳng số** nên vượt mặt tầng token, sửa thang chữ không
chạm tới được. Nay đặt tên token, muốn chỉnh thì sửa một dòng trong `index.css` thay vì đi lại
406 chỗ.

**Hai chỗ vỡ phát hiện khi kiểm chứng ở 375px**, đều do chữ to lên mà khung không nới:

1. Hàng chú giải biểu đồ ở màn Báo cáo: hàng rộng 293px chia cho bốn mục, mỗi mục còn 70px nên
   "Dưới 10 câu" gãy thành **ba dòng, mỗi dòng bốn ký tự**. Chữ gãy vụn như vậy còn khó đọc
   hơn cả chữ nhỏ. Sửa bằng `flex-wrap` cho cả hàng cộng `whitespace-nowrap` cho từng mục.
2. Chip trạng thái ở màn Hỏi AI: "Cần ôn chương trước" cũng gãy ba dòng vì nằm cùng hàng với
   tên chương mà không có gì chặn co lại. Sửa bằng `whitespace-nowrap shrink-0` cho chip và
   `min-w-0` cho tên chương, tức đảo lại thứ tự ưu tiên: tên chương cắt cụt, chip giữ nguyên.

**Kiểm chứng**: quét cả sáu màn (Bàn học, Luyện câu, Câu sai, Kế hoạch, Hỏi AI, Báo cáo) ở hai
bề rộng 1280px và 375px bằng Claude Browser, dò ba loại lỗi: tràn ngang cấp trang, phần tử
thoát khỏi khung cuộn, và chữ ngắn bị bóp xuống từ ba dòng trở lên. Kết quả sau khi sửa:
**không màn nào còn lỗi, và không còn chữ nào dưới 12px trên toàn ứng dụng.**

`npm run check` đạt toàn bộ 6 chặng.

**Còn nợ ngay sau việc này**: 371 chỗ `font-mono`. Xem màn Luyện câu, các nhãn "TRUNG TÂM RÈN
LUYỆN", "Phổ biến nhất", "Phủ 7/7 chương", "Quy mô đề", "25 câu / 40 câu / 50 câu" đều là
**từ tiếng Việt đặt trong font đơn cách**, vốn rộng thêm 21% và mất hình bao từ.

---

### 28/07/2026 — Phương án trả lời thành danh sách chữ, và một lỗi tương phản 1,85:1 lộ ra

Vòng tiếp theo của đợt tái thiết kế theo Khan Academy, xem mục ngay dưới cho phần đo gốc.

**Đã làm**: đổi bốn phương án trả lời ở màn luyện câu từ bốn cái thẻ đóng thành một danh sách
chữ ngăn nhau bằng đường kẻ 1px.

**Vì sao**: trước đó mỗi phương án là một thẻ có viền, có nền, bo góc, cách nhau 10px. Nghĩa
là ngay ở trạng thái nghỉ, tức lúc người học đang đọc để cân nhắc và cũng là lúc kéo dài nhất
của mỗi câu, mắt phải phân tích **năm khối đóng** riêng biệt: câu hỏi cộng bốn thẻ. Theo
nguyên lý khép kín của Gestalt, một hình bao kín được não đọc thành một vật thể, nên bốn vật
thể xếp dọc bắt mắt dừng lại và khởi động lại ở từng ranh giới thay vì trôi liền từ câu hỏi
xuống các phương án. Đo trên Khan Academy: hàng đáp án nền trong suốt, không viền, không đổ
bóng, ngăn nhau bằng đường kẻ 1px.

**KHÔNG bê nguyên mô hình Khan vào**, vì dự án này đã có một quyết định khác có căn cứ đo:
lượt trước đã cố ý dời tín hiệu đúng sai vào nền, viền, ô chữ cái và biểu tượng để giữ chữ nội
dung ở 18,04:1. Bỏ nền với viền là xoá mất hai trong bốn tín hiệu đó. Nên tách theo trạng
thái: **lúc nghỉ thì phẳng hoàn toàn như Khan** (trạng thái này không mang tin gì nên không
mất gì), **lúc đã chọn hoặc đã lộ đáp án thì giữ nguyên nền và viền**. Hệ quả phụ đáng giá:
vì mọi thứ xung quanh đã phẳng, hai hàng có màu ngữ nghĩa nay nổi bật hẳn lên.

**Lỗi tương phản phát hiện trong lúc làm.** Phương án KHÔNG được chọn, sau khi lộ đáp án, đang
dùng `opacity-40` chồng lên `text-text-muted`. Tính màu thật hiện trên nền trắng: 0,4 x
(107,107,117) cộng 0,6 x (255,255,255) ra xấp xỉ `#C4C4C8`, tức tương phản **1,85:1** so với
ngưỡng 4,5:1 của WCAG AA. Gần như không đọc được.

Đây không phải lỗi nhỏ. Sau khi biết mình sai, việc đọc lại ba phương án còn lại để hiểu vì
sao chúng sai **chính là phần học nhiều nhất của cả câu hỏi**. Làm mờ tới mức không đọc nổi là
cắt mất đúng phần đó. Khan Academy cho phương án không được chọn lùi về màu chữ mờ `#717378`,
vẫn 4,75:1, chứ không hạ độ đục. Đã bỏ `opacity`, dùng thẳng `text-text-muted`.

Đo lại trên bản chạy thật, cả bốn phương án sau khi lộ đáp án:

| Phương án | Trước | Sau |
|---|---|---|
| A, đã chọn nhưng sai | 17,26:1 | 17,26:1 |
| B, không chọn | **1,85:1** | **5,27:1** |
| C, đáp án đúng | 18,04:1 | 18,04:1 |
| D, không chọn | **1,85:1** | **5,27:1** |

**Ô chữ cái A/B/C/D**: bỏ `font-mono`. Đây là MỘT ký tự, mà lợi ích duy nhất của font đơn cách
là xếp thẳng cột nhiều ký tự; một ký tự thì không có gì để xếp cột, chỉ còn lại nét chữ khô và
rộng hơn. Đổi sang viền 2px rỗng ruột lúc nghỉ và tô đặc lúc được chọn, đúng cách Khan làm, vì
chính ô này gánh phần lớn tín hiệu trạng thái nên hàng phía sau nó mới được phép để trống.

Chiều cao hàng lên 60px (Khan là 64px), vượt chuẩn chạm 44 x 44 của Apple.

**Kiểm chứng**: `npm run check` đạt toàn bộ 6 chặng. Mọi số tương phản ở trên đo bằng Claude
Browser trên ứng dụng đang chạy, lấy màu nền thật bằng cách leo cây DOM tìm nền không trong
suốt gần nhất, không phải đọc từ mã nguồn.

---

### 28/07/2026 — Đo Khan Academy bằng trình duyệt rồi dựng lại tầng token, và sửa lỗi tràn ngang có sẵn

**Yêu cầu của Đàm**: tái thiết kế theo triết lý thiết kế của Khan Academy Web bản hiện đại.
Chỉ được đụng UX/UI, Design System, Component System, Presentation Layer. Không thêm tính
năng, không đổi luồng sản phẩm, không đổi kiến trúc thông tin, không đụng engine hay thuật
toán. **Bắt buộc dùng Claude Browser quan sát ứng dụng thật, không được chỉ đọc mã nguồn.**
Kèm một luật nghiêm: thay đổi nào chỉ làm đẹp mà không giúp đọc nhanh hơn, hiểu hơn, nhớ hơn,
học lâu hơn, giảm tải nhận thức hoặc tăng độ rõ thị giác thì **không triển khai**.

#### Phần 1: đã đo được gì trên vi.khanacademy.org

Không đọc bài viết về Khan Academy mà mở thẳng trang bằng Claude Browser rồi đọc
`getComputedStyle` của từng phần tử. Đi qua trang chủ, trang khoá học Số học, và quan trọng
nhất là **trang làm bài tập**, có chọn đáp án, nộp bài, xem cả trạng thái đúng lẫn sai.

Con số rút ra (font chữ trong ứng dụng học là **Lato**, không phải font ở trang tiếp thị):

| Vai trò | Cỡ / chiều cao dòng / độ đậm |
|---|---|
| Tiêu đề bài | 28 / 32 / 700 |
| Tiêu đề mục | 20 / 24 / 700 |
| **Câu hỏi** | **18 / 22 / 700** |
| Chữ thân, nút, liên kết | 16 / 20 hoặc 16 / 24 |
| Chữ phụ | 14 / 19,6 / 400 |
| Chú thích | 12 / 16 / 400 |

Chỉ dùng **hai** độ đậm: 400 và 700. Giãn chữ để `normal` ở gần như mọi chỗ.

Bảng màu bề mặt học: chữ chính `#21242C`, chữ phụ `#5F6167`, chữ mờ `#717378`, chữ tắt
`#B8B9BB`, đường kẻ `#DBDCDD`, xanh thương hiệu `#1865F2`, xanh đúng `#0B7C18`.

Ba phát hiện đáng giá nhất, đều trái với trực giác thông thường:

1. **Toàn bộ luồng học chỉ có ĐÚNG MỘT đổ bóng thật**, là `0 4px 8px rgba(33,36,44,0.16)` trên
   hộp phản hồi sau khi nộp câu. Thẻ nội dung không đổ bóng, chúng tách nhau bằng viền 1px.
2. **Hàng đáp án không phải thẻ.** Nền trong suốt, không viền, không đổ bóng, cao 64px, đệm
   16px. Ngăn cách nhau bằng một đường `::before` / `::after` cao 1px màu `#DBDCDD`. Lúc được
   chọn thì **nền vẫn trong suốt**, chỉ ô chữ cái A/B/C/D đổi từ viền rỗng sang tô đặc màu
   xanh, cộng thêm màu chữ của hàng chuyển sang `#1B50B3`.
3. **Trạng thái trả lời sai KHÔNG có màu đỏ ở bất cứ đâu.** Đáp án đã chọn giữ nguyên màu
   xanh, thông điệp là "Đáp án của bạn gần chính xác", nút đổi thành "Thử lại". Hộp thông báo
   sai dùng đúng cùng màu chữ và cùng đổ bóng với hộp thông báo đúng, chỉ khác chữ.

Điểm 3 trùng khớp với kết luận đợt trước của dự án này, xem mục ngay dưới.

Chuyển động: cả trang khoá học lẫn trang làm bài chỉ tồn tại **một** mốc `0.1s ease-in-out`,
riêng hàng đáp án `0.125s`. Không có gì dài hơn. Bo góc: 4px là mốc áp đảo (258 lần), 8px cho
vùng bấm của hàng đáp án. Khoảng cách: 16px áp đảo cả đệm lẫn khe.

#### Phần 2: đã sửa gì

**Chuyển động.** Quy tắc cũ phủ `transition` 200ms **có cả `color`** lên
`div, header, nav, main, footer, button, select, input`. Đo trên màn Bàn học đang chạy:
**94 trên 309 phần tử, tức 30% cả trang**, mang transition đang hoạt động. Cái giá không phải
hiệu năng mà là **độ trễ của phản hồi**: khoảnh khắc đáng giá nhất sản phẩm là lúc người học
bấm đáp án và biết mình đúng hay sai, tín hiệu đó truyền bằng màu chữ, mà màu chữ ấy đang mờ
dần trong 200ms thay vì hiện ngay. Đã tách: nền và viền vẫn chuyển 140ms cho việc đổi sáng
tối; màu chữ **không** còn chuyển trên phần tử bố cục; riêng phần tử bấm được trả lại 90ms.
Số phần tử làm mờ dần màu chữ: **94 xuống 35**, và 35 chỗ còn lại đúng là nút với liên kết.

**Độ nổi.** Kiểm kê thấy đang dùng **chín** mức đổ bóng (`shadow-sm` 115 lần, `shadow-` 12,
`xs` 8, `xl` 7, `md` 6, `2xl` 5, `2xs` 2, `lg` 1, `3xs` 1). Chín mức nghĩa là độ nổi không còn
mang thông tin, nên lúc hộp thoại thật mở đè lên trang người học không có tín hiệu nào để biết
phải xử lý cái nào trước. Đã ép cả chín token của Tailwind về **hai bậc thật**: `xs`/`sm`/`md`
trỏ chung một vệt phẳng, `lg`/`xl`/`2xl` trỏ chung một lớp nổi. Không phải sửa 155 chỗ gọi.
Đo lại trên trang: chỉ còn **đúng một** kiểu đổ bóng. Riêng `.workspace-card` trước đó đổ bóng
hai lớp ở độ mờ **1%**, tức không nhìn thấy được nhưng vẫn phải vẽ, đã bỏ.

**Nhãn viết hoa.** `body` đang đặt `letter-spacing: -0.011em`, chảy xuống làm các nhãn viết
hoa cỡ 10px nhận giãn chữ **âm 0,176px**. Chữ hoa vốn không có hình bao từ nên đã đọc chậm hơn
chữ thường; bó thêm là làm nặng đúng chỗ vốn yếu. Với tiếng Việt còn nặng hơn: ở 10px viết
hoa, Ế và Ề khác nhau đúng một nét nhỏ. Đã gỡ giãn âm khỏi `body` và cho `.uppercase` giãn
dương `0.06em`. Đo lại: **âm 0,176px thành dương 0,6px**, sửa một chỗ, ăn cho cả 154 chỗ dùng.

**Tôn trọng `prefers-reduced-motion`** (chuẩn WCAG 2.3.3), trước đó không có.

**Lỗi tràn ngang, có sẵn từ trước.** Ở bề rộng cửa sổ 864px, hàng trong header rộng 859px
nhưng ba cụm con đòi tổng **954px** (cụm logo 281 + thanh điều hướng 603 + cụm phải 70), nên
cụm phải bị đẩy tới toạ độ 978 và cả trang cuộn ngang được. Kèm theo, chữ "ÔN THI ĐẠI HỌC MỞ"
rơi xuống thành một **cột dọc 5 dòng** trong hộp rộng 41px.

Đã dùng `git stash` để đo trên bản gốc trước khi kết luận: bản gốc cũng tràn **928 so với
864** và logo cũng đã 5 dòng. Tức đây là lỗi có sẵn, không phải do đợt sửa giao diện gây ra,
tuy đợt sửa có làm nặng thêm 49px.

Gốc rễ: thanh điều hướng trên bật từ mốc `md` (768px) trong khi tự nó cần khoảng 825px. Đã
dời mốc chuyển giữa thanh trên và thanh đáy từ `md` lên **`lg` (1024px)**, và thêm
`whitespace-nowrap` cho chữ logo, cho chữ logo chỉ hiện từ `xl`. **Không mất điểm đến nào**,
vì hai thanh dựng từ đúng cùng một mảng `DIEM_DEN`: dưới 1024px điều hướng bằng thanh đáy,
từ 1024px trở lên bằng thanh trên. **Ba chỗ phải dời cùng lúc** nếu không sẽ hở một dải bề
rộng không có thanh nào: thanh trên, thanh đáy, và lớp đệm dưới của `main`.

Kiểm chứng lại bằng trình duyệt ở 375, 864, 1024, 1280: **không còn tràn ở bề rộng nào**. Ở
375px thanh đáy sáu nút, mỗi nút 63 x 52px, vượt chuẩn 44 x 44 của Apple lẫn 24 x 24 của WCAG.

#### Phần 3: đã CỐ Ý không làm

`--text-primary` hiện là `#111111`, cho tương phản 18,88:1; Khan Academy là 15,52:1. Đã định
hạ xuống `#1d1d20` cho dịu mắt và đã tính sẵn (16,82:1). **Không làm.** Lý do: cả hai đều vượt
xa ngưỡng cần, và bằng chứng về chuyện chói sáng khi đọc lâu chỉ mạnh với đen tuyệt đối `#000`
chứ không với `#111111` vốn đã lệch khỏi đen. Đây là thay đổi thuần thẩm mỹ, đúng loại mà luật
Đàm đặt ra bắt phải loại.

Cũng không đổi thang bo góc. Dự án đang dùng sáu mốc (`xl` 239 lần, `lg` 167, `2xl` 100,
`full` 99, `md` 26, `sm` 4) so với ba mốc của Khan, nhưng bo góc là tín hiệu yếu, sai lệch ở
đây không gây tốn kém nhận thức đo được.

**Một giả thuyết của tôi đã sai, ghi lại để người sau khỏi lặp**: tôi đã nghĩ JetBrains Mono
thiếu chữ tiếng Việt nên trình duyệt phải thay font giữa chừng. Đo bằng `document.fonts` và
so bề rộng chuỗi thì **sai**: font có tải và có render tiếng Việt bình thường. Nhưng phép đo
lại cho ra một lý do khác và mạnh hơn: chuỗi "Chưa đủ dữ liệu" rộng **357,4px** trong JetBrains
Mono so với **295px** trong Inter ở cùng cỡ 40px, tức **font đơn cách làm chữ Việt rộng thêm
21%**. Trong bảng dày ở cỡ 10 tới 13px, 21% ấy phải trả bằng chữ nhỏ hơn hoặc gãy dòng nhiều
hơn. Cộng thêm việc bề rộng đều nhau xoá mất hình bao từ, vốn là manh mối chính để mắt lướt
nhanh. Với **số** thì đơn cách đúng (các chữ số thẳng cột); với **từ tiếng Việt** thì sai cả
hai mặt. Dự án đang có 371 chỗ dùng `font-mono`, chưa xử lý, xem phần nợ.

#### Kiểm chứng

`npm run check` đạt toàn bộ 6 chặng. Mọi phép đo trước và sau đều lấy bằng Claude Browser trên
`http://localhost:3000` đang chạy thật, không phải suy từ mã nguồn.

#### Còn nợ

- **371 chỗ `font-mono`** và **154 chỗ `uppercase`**: đã sửa được phần giãn chữ, chưa chuyển
  các nhãn là **từ tiếng Việt** sang chữ thường không đơn cách. Giữ đơn cách cho **số**.
- **245 chỗ `text-[10px]` và 120 chỗ `text-[11px]`**: đây là cỡ chữ nhỏ nhất và là nguồn mỏi
  mắt lớn nhất còn lại. Chúng viết thẳng giá trị nên vượt mặt tầng token, phải sửa từng chỗ.
- **Hàng đáp án ở màn luyện câu vẫn là thẻ có viền và có nền.** Theo mô hình Khan thì nên là
  danh sách chữ ngăn nhau bằng đường kẻ 1px, để mắt đọc trôi từ câu hỏi xuống các phương án
  thay vì phải phân tích năm khối đóng. Đây là việc lớn tiếp theo và nên làm riêng một vòng.
- ~~Huy hiệu `+6% tuần này` viết cứng trong `PersonalWorkspaceView.tsx`.~~ **Ghi nhầm.** Rà lại
  mã nguồn thì nó đã được gỡ từ lượt trước, chú thích giải thích lý do vẫn nằm ngay tại chỗ cũ
  trong file. Tôi đã liệt kê nó dựa trên thông tin cũ mà không kiểm lại mã.

---

### 28/07/2026 — Rà màu ngữ nghĩa: đáp án sai vốn không hề có màu đỏ

**Commit**: một commit lớn, nhóm kiểm mới **AF**, tổng phép kiểm 191 lên **195**.

**Yêu cầu**: rà màu trong từng tính năng, kể cả khi chọn câu đúng câu sai, đọc lại logic rồi
chỉnh màu cho đúng và đồng bộ với chức năng.

#### Phát hiện nặng nhất: một lớp màu dùng 84 lần mà chưa từng được định nghĩa

`brand-danger` xuất hiện **84 lần trong 11 file**. Bộ token trong `index.css` chỉ có
`brand-error`. Tailwind sinh lớp tiện ích **từ token**; không có token thì không sinh lớp, mà
không có lớp thì trình duyệt lặng lẽ dùng màu kế thừa.

Đo trên bản chạy thật trước khi sửa:

| Lớp | Ra màu gì |
|---|---|
| `text-brand-danger` | `rgb(17,17,17)`, tức **đen như chữ thường** |
| `bg-brand-danger-bg` | `rgba(0,0,0,0)`, tức **trong suốt** |
| `text-brand-error` (đối chứng) | `rgb(220,38,38)`, đúng màu đỏ |

Hậu quả ở màn làm bài: **phương án người học chọn SAI hiện y hệt một phương án chưa ai đụng
tới.** Tín hiệu quan trọng nhất của cả một ứng dụng học tập bị mất trắng, mà không ai biết.

Loại lỗi này không báo lỗi biên dịch, không sai kiểu, không nổ ngoại lệ. Nó **chỉ lặng lẽ không
tô màu**. Cùng họ với "hằng số trá hình" đã gặp nhiều lần, chỉ khác là ở tầng CSS.

Đã đổi hết 84 chỗ về `brand-error`, giữ **một tên duy nhất** thay vì thêm bí danh.

#### Bộ quét bắt cả họ lỗi, không riêng một tên

Nhóm **AF** quét mọi lớp màu ngữ nghĩa đang dùng trong `src/components` rồi đối chiếu với token
trong `index.css`. **Ngay lần chạy đầu nó tìm ra thêm một ca tôi chưa hề thấy**:
`brand-warning-text` trong `ConceptMasteryMap.tsx`, làm dòng cảnh báo tiên quyết mất màu. Đây
là lý do phép kiểm tổng quát đáng giá hơn hẳn việc sửa đúng một tên.

#### Độ tương phản: cả bốn màu đều dưới chuẩn

Đo chính các cặp đang dùng thật (chữ màu trên nền cùng tông của nó):

| Cặp màu | Trước | Sau | Ngưỡng WCAG AA |
|---|---|---|---|
| Xanh lá, **đáp án đúng** | **3,15:1** | 4,79:1 | 4,5:1 |
| Cam, cảnh báo | 3,35:1 | 4,88:1 | 4,5:1 |
| Xanh dương, thông tin | 3,38:1 | 4,75:1 | 4,5:1 |
| Đỏ, đáp án sai | 4,41:1 | 5,91:1 | 4,5:1 |

Nặng nhất là xanh lá của **đáp án đúng**, mà đó lại là đoạn chữ người học nhìn nhiều nhất sau
mỗi câu. Đã hạ độ sáng mỗi màu xuống một bậc, **giữ nguyên tông** nên tính cách giao diện không
đổi.

#### Một quy ước mới về màu trong thẻ phương án

**Nội dung phương án giữ màu chữ thường, không tô theo màu ngữ nghĩa.** Tín hiệu đúng sai đã có
ở bốn chỗ khác: nền, viền, ô chữ cái và biểu tượng. Tô luôn đoạn chữ chỉ kéo tương phản xuống
đáy cho đúng thứ cần đọc kỹ nhất.

| | Trước | Sau |
|---|---|---|
| Chữ phương án ĐÚNG | 3,15:1 | **18,04:1** |
| Chữ phương án SAI | 4,41:1 | **17,26:1** |

Đo lại trên DOM thật sau khi sửa, không chỉ tính trên giấy.

#### Nghiệm thu

Cả 6 chặng xanh với 195 phép kiểm. Nhóm AF có 4 phép, đã thử phá từng cái: trả lại một lớp màu
không định nghĩa, xóa một màu khỏi chế độ tối, trả lại màu nhạt, tô lại chữ nội dung. Chế độ tối
kiểm riêng: đủ 12 màu, các biến 400 trên nền gần đen đều đúng chiều.

**Một sự cố nhỏ của tôi, giữ lại**: lúc thử phá tôi khôi phục file bằng `git checkout` rồi `cp`
từ một bản sao lưu cũ hơn, làm mất chính bản sửa vừa viết. Phát hiện nhờ soát lại `grep` từng
dấu vết thay vì tin là đã khôi phục đúng. **Sau mỗi lượt thử phá, phải kiểm lại bằng dấu vết cụ
thể chứ không tin vào thao tác khôi phục.**

---

### 28/07/2026 — Giảm chi phí thao tác trong buổi ôn dài, ba commit

**Commit**: `f1e3f7e` và hai commit kế. Nhóm kiểm mới **AE**, tổng phép kiểm 185 lên **191**.

**Yêu cầu**: không thêm tính năng, chỉ nâng chất lượng trải nghiệm của thứ đã có, đo trên bản
chạy thật, và chỉ giữ thay đổi nào giúp người học bắt đầu nhanh hơn, hiểu nhanh hơn, nhớ tốt
hơn hoặc tập trung lâu hơn.

#### Chỗ đáng sửa nhất không nằm ở các màn bảng biểu, mà ở màn làm bài

Ba lượt rà trước đều dừng ở các màn tổng quan. Nhưng người học ngồi 2 đến 4 tiếng trong màn
LÀM BÀI, nên mỗi thao tác thừa ở đó bị nhân lên hàng trăm lần.

**Đo được**: màn làm bài chỉ có `,` và `.` để chuyển câu, còn việc CHỌN ĐÁP ÁN bắt buộc dùng
chuột. Một đề 10 câu là 10 lần ngắm đúng một trong bốn ô rồi bấm, cộng 9 lần bấm "Câu sau".

Điểm mấu chốt: **mỗi phương án vốn ĐÃ hiện sẵn chữ cái A, B, C, D ngay trên màn hình.** Người
học nhìn thấy chữ A thì phản xạ đầu tiên là bấm phím A. Trước lượt này phím đó không làm gì cả,
tức giao diện tự hứa rồi tự thất hứa.

Nay `A/B/C/D` hoặc `1/2/3/4` chọn đáp án, mũi tên trái phải chuyển câu (giữ `,` và `.` cho ai đã
quen). Kèm một dòng nhắc phím tắt đặt ngay dưới bốn phương án, đúng chỗ mắt dừng lại; nó thay
cho dòng "Slide: tên file (Trang ...)" vốn ít giá trị mà lại chiếm đúng khoảng giữa hai nút.

Kiểm trên ứng dụng đang chạy: bấm `b` ghi đúng **một** đáp án, đúng câu đang hiện (id 3020),
không ghi trùng; `ArrowRight` chuyển đúng câu kế; bấm `d` trên câu đã chốt ở chế độ gia sư
**không** ghi đè, đúng bất biến 4.10.

#### Màn làm bài trên điện thoại

| Chỗ | Đo được trước (khung 375px) | Sau |
|---|---|---|
| Chip "Câu 3 / 10" | xuống **ba dòng** | một dòng |
| Chip "Mức Khó" | xuống hai dòng | một dòng |
| Nhãn "Giáo viên AI Coaching" | xuống **ba dòng** | chỉ còn biểu tượng, vẫn có nhãn cho trình đọc màn hình |
| Dòng chủ đề và khái niệm | chữ hoa giãn cách 10px kiểu mã máy, tô đậm, chiếm hai dòng **ngay trước câu hỏi** | chữ thường, màu nhạt, lùi về đúng vai trò ngữ cảnh |

Dòng ngữ cảnh là thứ ÍT quan trọng nhất trên thẻ nhưng lại được viết bằng dạng chữ KHÓ ĐỌC
NHẤT và đặt ở nơi mắt chạm đầu tiên. Nay câu hỏi mới là thứ dẫn dắt.

#### Một chỗ đo xong rồi KHÔNG sửa

Ban đầu tôi ước bề rộng dòng câu hỏi khoảng **86 ký tự**, tức vượt ngưỡng dễ đọc 45 đến 75, và
định thu hẹp cột. Nhưng khi đo tử tế bằng số hình chữ nhật dòng thay vì ước theo bề rộng chia
cỡ chữ, kết quả là **69 ký tự mỗi dòng**, cao dòng 1,63. Cả hai đều nằm gọn trong vùng tốt.

Ước sai vì tôi lấy 0,5em làm bề rộng ký tự trung bình, quá hẹp so với tiếng Việt có dấu. **Bài
học: đo bằng hình chữ nhật dòng thật, đừng ước từ bề rộng khối chia cỡ chữ.** Đã bỏ ý định sửa,
đúng nguyên tắc không triển khai thay đổi không mang lại lợi ích.

#### Copywriting

Bảng phản hồi sau mỗi câu vẫn dạy `,` và `.` trong khi dòng nhắc mới dạy mũi tên: hai chỗ trên
cùng một màn hình dạy hai bộ phím khác nhau. Đã đồng bộ về mũi tên; phím cũ vẫn chạy, chỉ thôi
quảng cáo.

#### Nghiệm thu

Cả 6 chặng xanh với 191 phép kiểm. Nhóm **AE** có 6 phép, đã thử phá từng cái.

**Bài học về chính bộ kiểm, lần thứ năm bắt được phép kiểm rỗng**: AE1 bản đầu viết là
`/theoChuCai/ && /theoSo/ && /chonDapAnRef\.current\(/`, tức chỉ soi ba cái TÊN có tồn tại
không. Khi thử phá bằng cách cắt phép tra bảng, ba cái tên vẫn còn nguyên nên phép kiểm **vẫn
xanh**. Quy tắc rút ra: **khớp cả biểu thức nối, không khớp riêng lẻ từng danh từ.**

---

### 28/07/2026 — Rà soát trải nghiệm trên trình duyệt thật, sáu commit

**Commit**: `0d57531`, `f55ef80`, `b0b32af`, `b2aefc0`, `0ed0cac`, `f270f6c`. Nhóm kiểm mới
**AD**, tổng phép kiểm 182 lên **185**.

**Yêu cầu**: tự mở trình duyệt, rà toàn bộ trải nghiệm trên bản chạy thật chứ không đọc mã, rồi
sửa thẳng vào mã theo triết lý Calm Academic Operating System.

#### Điều quan trọng nhất học được: bất biến 4.9 lâu nay chỉ được áp cho tầng engine

Ba lượt trước đã dọn sạch số bịa trong các engine. Nhưng **màn hình vẫn vẽ ra con số không có
thật** mà không phép kiểm nào chạm tới, vì mọi phép kiểm đều dừng ở tầng dịch vụ:

| Chỗ | Bản cũ | Sau |
|---|---|---|
| Nhật ký rèn luyện | `isDone = idx < studyStreak + 3` nên người **chưa làm câu nào** vẫn thấy ba ngày sáng màu; sắc độ lấy từ `idx % 4`, tức từ **vị trí ô** | đọc `dbService.getHistory()`, đậm nhạt theo số câu thật trong ngày |
| "+6% tuần này" | chuỗi **viết cứng**, hiện y hệt cho mọi người học mọi thời điểm | đã gỡ |
| Điểm dự kiến | hiện **5,0 ± 0,5** khi chưa làm câu nào, đó là mốc khởi động nguội | "Chưa đủ dữ liệu" |

Ba ngày sáng màu kia còn nằm ở **đầu** lưới, tức ba ngày xa nhất, ngược hẳn ý nghĩa chuỗi ngày
học. Không lỗi nào trong ba lỗi này lộ ra khi đọc mã dịch vụ.

**Bài học: bất biến 4.9 phải áp cho cả tầng hiển thị.** Nhóm kiểm **AD** nay canh ở mức mã nguồn.

#### Một sự cố thật của chính tôi, giữ lại để khỏi lặp

Tôi đã **commit và push trong khi bộ kiểm đang đỏ**. Nguyên nhân: lệnh nối chuỗi bằng `&&` và
`grep` chỉ bắt dòng tổng kết chặng chứ không bắt dòng từng phép kiểm, nên tôi không thấy màu đỏ.
Đây là vi phạm đúng quy tắc quan trọng nhất của dự án.

Truy ra thì đó là phép kiểm **AB6 chập chờn**, hỏng khoảng **1 trên 5 lượt**, và khi hỏng thì
hỏng nặng (chỉ số 71 so với ngưỡng 20). Nguồn chập chờn: kịch bản rút đề ngẫu nhiên rồi quyết
định đúng sai nhóm "Trung bình" bằng `id % 2`, tức đúng sai phụ thuộc **mã câu**, mà mã nào rơi
vào phần đầu hay cuối lại do bốc ngẫu nhiên.

**Lần thử đầu của tôi còn làm tệ hơn**: đổi sang xen kẽ theo thứ tự trong nhóm, nhưng bố cục số
câu Trung bình mỗi phần là 1/3/2 nên tỷ lệ đúng của chính nhóm đó thành 100%/33%/50% theo phần
đề, tức **tự tay tạo ra đúng cái nhiễu cần khử**. Phép kiểm chuyển từ chập chờn sang hỏng đều.

Bản cuối: bố cục 4/2/1, 2/2/3, 1/2/4; Dễ đúng hết, Khó sai hết, Trung bình đúng nửa đầu **của
chính phần đó**. Mỗi nhóm độ khó có tỷ lệ đúng y hệt nhau ở cả ba phần: 100%, 50%, 0%. Kết quả
giống hệt qua 5 lượt: đo ngây thơ tụt 42,9 điểm phần trăm, sau khi khử độ khó còn **0,0**.
**Không nới ngưỡng.** Phép kiểm nay còn mạnh hơn trước, vì bản cũ từng xanh một phần nhờ may.

#### Sửa trên giao diện

| Hạng mục | Đo được trước | Sau |
|---|---|---|
| Tràn ngang trên khung 375px | **122px**, một phần ba bề ngang nằm ngoài vùng nhìn, 44 phần tử vượt khung | **0** |
| Hai thanh điều hướng | máy tính **7 mục**, điện thoại **6 mục**, khác cả thứ tự lẫn nhãn | cùng một mảng `DIEM_DEN`, 6 mục khớp nhau |
| Nhãn điều hướng | xuống hai dòng ngay ở 1440px | không xuống dòng |
| Vòng tiêu điểm bàn phím | **9 file** dùng `focus:outline-none`, **0 chỗ** có `focus-visible` | một quy tắc dùng chung, đã soi thấy trên ảnh chụp |
| Bộ chọn môn | lặp **hai lần** cách nhau chưa tới trăm điểm ảnh | một, ở thanh đầu trang |
| Ba thẻ nhiệm vụ | ngang hàng nhau, ba nút xám như nhau | một nút đặc, hai nút nền |
| Sổ câu sai rỗng | "Sửa **0 câu**" kèm nút bấm được | "Sổ câu sai đang sạch", không nút |
| Nút cộng nổi | 4/6 mục trùng thanh điều hướng, 2 mục còn lại **bấm không mở gì** | đã gỡ |
| "Đặt lại tiến trình" | nằm ở góc tiêu đề màn Báo cáo, **ba lối vào** cho một việc xóa sạch | còn một lối trong Cài đặt, có xác nhận |

Bộ chọn giao diện Sáng/Tối chuyển vào Cài đặt: nó chiếm ba nút giữa vùng đắt nhất màn hình cho
một hành động vài tháng mới làm một lần, và chính nó gây tràn ngang. Thanh điều hướng điện thoại
chuyển xuống đáy cho vừa tầm ngón cái.

#### Còn nợ, cố ý chưa làm

- **Nhãn chữ hoa giãn cách kiểu bảng số liệu** vẫn còn ở nhiều màn (Báo cáo, khối "Liên kết kiến
  thức đang học", các bảng quan trắc). Đã sửa ở Bàn học và Luyện câu; phần còn lại là việc lặp
  lại cùng một khuôn, nên tách thành lượt riêng cho gọn.
- **Màn Báo cáo** vẫn dẫn dắt bằng ba con số cỡ lớn và vài câu động viên viết sẵn không đúng với
  người chưa làm bài. Chưa đụng.
- `QuickActionFAB.tsx` **chỉ thôi render**, file vẫn nằm trên đĩa. Dọn mã chết là quyết định của
  chủ dự án (Nợ 1).

#### Nghiệm thu

Cả 6 chặng xanh với 185 phép kiểm, chạy lại 5 lượt liên tiếp đều giống nhau. Ba phép kiểm mới
đều đã thử phá. Toàn bộ số đo trên đây lấy từ bản chạy thật trong trình duyệt, không phải suy
từ mã.

**Dữ liệu học của Đàm không bị đụng tới**: máy chủ xem thử chạy ở cổng 60177 trong khi dữ liệu
thật nằm ở cổng 3000, mà `localStorage` tách theo cổng, nên đó là hai kho hoàn toàn riêng.

---

### 28/07/2026 — Rà toàn bộ liên kết: nối lại những chỗ dữ liệu chảy rời nhau

**Yêu cầu của Đàm**: "Rà soát mọi thứ, liên kết toàn bộ thành phần với nhau, không để mọi thứ
rời rạc, tất cả mọi dữ liệu phải đồng bộ hóa với nhau. Nâng cao trí thông minh của nội tại
sản phẩm."

Bốn commit: `f4b3099`, `251572f`, `d64844d`, `832b921`. Số phép kiểm 152 lên **182**, thêm
năm nhóm mới **Y, Z, AA, AB, AC**.

#### Cách tìm việc, đáng giữ cho lượt sau

Không đi dò "chỗ nào bịa số" như ba lượt trước, mà hỏi một câu khác: **thành phần nào đang
nói chuyện với nhau bằng hai thứ tiếng?** Ba dấu hiệu dẫn tới cả bốn lỗi:

1. Một trường được ghi mà không ai đọc, hoặc ngược lại.
2. Hai kho cùng mô tả một thứ nhưng được nuôi từ hai đường khác nhau.
3. Một engine đã có sẵn logic đúng, nhưng nơi gọi lại tự viết tay bản rút gọn.

Dấu hiệu thứ ba là dấu hiệu đắt nhất và khó thấy nhất, vì mã vẫn chạy, kiểu vẫn đúng, màn
hình vẫn hiện số.

#### 1. Xóa tiến trình bỏ sót bảy kho dẫn xuất (`f4b3099`)

`clearAllHistory` chỉ xóa 4 khóa. Bấm "Làm mới tiến trình" thì màn Thống kê về 0 nhưng màn
Tiến hóa, bản đồ độ thạo và lịch ôn vẫn giữ nguyên người học cũ. `resetProgress` còn xóa ít
hơn nữa, trong khi thông báo trên màn Thống kê hứa "làm sạch toàn bộ tiến trình học tập".

Đã sửa bằng mẫu đăng ký trễ: mỗi service tự khai kho của mình. Xem bất biến **4.9d**.

**Số đo quan trọng nhất của cả lượt** nằm ở đây: sau khi việc dọn trở nên thật, sai lệch dự
báo nhảy từ 0,3 lên 0,4. Tôi đã **không** chấp nhận con số mà đi tách nguyên nhân: cất thay
đổi bằng `git stash` để lấy mốc nền, rồi bẻ riêng từng thay đổi. Kết quả: giữ nguyên công
thức độ tự tin cũ mà chỉ dọn kho cho đúng thì con số **đã là 0,4**. Tức 0,3 là số đo trên
trạng thái còn tồn dư của kịch bản trước, không phải chất lượng bị tụt. Đã ghi cảnh báo ngay
trong harness để người sau không "khôi phục" nhầm.

#### 2. Độ tự tin suy ngược từ đúng sai (`f4b3099`)

Cây cầu nối làm bài với tầng trí nhớ truyền `confidence = đúng ? 0,85 : 0,4`. Thay vào công
thức xếp loại hiệu chuẩn ra `diff = 0,4 - 0,55a`, nên nhãn "underconfident" đòi tỷ lệ đúng
trên 109%, tức **không bao giờ xuất hiện**, còn "overconfident" chỉ là cách gọi khác của
"đúng dưới 36,4%". Một chỉ số tự nhận đo mức tự tin nhưng thực chất đo lại chính cái nó đang
so sánh. Nay lấy từ `attempt.flags`, tức nút cờ nghi vấn người học tự bấm.

**Tôi tự bắt lỗi trong chính đoạn mới**: bản đầu trả 0,5 trung lập khi người học không bấm cờ
lần nào, nhưng vẫn đem 0,5 đó so với tỷ lệ đúng, nên hồ sơ đúng 90% bị dán nhãn "thiếu tự
tin" ở 13/15 khái niệm. Vẫn là bịa, chỉ đổi chiều. Đã thêm `confidenceSignalCount` và trạng
thái "chua-du-du-lieu" để im lặng không bị đọc thành tự tin.

#### 3. Cây cầu tự viết 15 hằng số thay vì gọi engine đã có (`251572f`)

`pedagogicalEvaluationEngine.evaluateInteraction` đã có sẵn logic tất định cho toàn bộ các
trường đó, nhưng hook nộp bài tự viết tay một bản rút gọn. Ba hệ quả đo được:

- lịch sử chấm sư phạm **rỗng 0 bản ghi** sau 5 đề đã nộp, nên màn Phân tích giảng dạy báo
  0 tương tác cho người vừa làm 100 câu. Sau khi nối: 100 bản ghi.
- **tên khái niệm khớp nhau ở 0/292 câu** giữa engine chấm (`question.concept`) và tầng trí
  nhớ (bộ tra chính thống). Hai bảng trên màn hình nói về hai tập tên rời nhau. Vi phạm bất
  biến 4.5. Sau khi sửa: 14 tên bên chấm, 14 bên trí nhớ, lệch 0.
- khoảng ôn lại cứng 48 hoặc 12 giờ chạy **song song và mâu thuẫn** với lịch ôn thật do độ
  bền trí nhớ quyết định. Đúng khuôn "hai đường cong quên" đã phải gộp trước đó.

Nhãn chiến lược cũ là `"STORY_METAPHOR"` cho mọi câu trong đề, tức khẳng định người học vừa
được dạy bằng phương pháp kể chuyện ẩn dụ trong khi họ chỉ bấm chọn một phương án. Nay là
`NHAN_TU_LAM_BAI` và **cố ý không cộng vào bảng hiệu quả chiến lược giảng dạy**, vì không có
ai giảng thì không có chiến lược nào để so.

**Cố ý KHÔNG làm, ghi lại vì suýt làm**: phân bổ thời gian từng câu theo `estimatedTime` cho
có phân hóa. Đo lại thì trường đó gần như không bám độ khó (trung bình 34,7s cho câu Dễ,
35,3s Trung bình, 35,2s Khó), nên chia theo nó chỉ tạo **phân hóa giả**. Giữ chia đều và ghi
rõ trong chú thích rằng đây là phân bổ chứ không phải đo.

#### 4. Mỏi mệt: một trường chết, một cái đếm chỉ tăng (`d64844d`)

`fatigueTrend` khai báo rồi không ai ghi cũng không ai đọc. `questionFatigue` cộng thêm 8 mỗi
lần hỏi gia sư AI và không bao giờ giảm, nên sau 13 lần là ghim 100 vĩnh viễn, còn người chỉ
làm bài thì mãi 0. Bốn nơi ra quyết định thật dựa vào nó, gồm luật giảm tải chưa từng chạy.

Nay đo từ vị trí câu trong đề, **khử độ khó** bằng cách so trong từng nhóm rồi mới gộp.

**Một phép kiểm của chính tôi đã chập chờn và phải viết lại.** Bản đầu đo xem bộ sinh đề có
dồn câu khó về cuối không: có lượt ra 1,907/1,957/1,821, có lượt ra 2,279/1,900/1,957. Tức bộ
sinh đề thật sự có lúc dồn câu khó về một đầu tùy trạng thái trước đó, nên việc khử độ khó là
bắt buộc chứ không phải phòng xa. Đã đổi sang phép kiểm dựng thẳng một hồ sơ mà đúng sai chỉ
phụ thuộc độ khó: cách đo ngây thơ thấy tụt 21 đến 31 điểm phần trăm, sau khi khử còn 0.

#### 5. Màn Bàn học hiện khái niệm của môn đã đóng (`832b921`)

Tìm ra **bằng mắt** khi mở `npm run dev` để nghiệm thu ba commit trên, sau khi 179 phép kiểm
đều xanh. Khối "Liên kết kiến thức đang học" gắn cứng bốn khái niệm của môn Kinh tế chính trị
đã đóng, kèm bốn ô số liệu viết sẵn, dưới nhãn "Tự tổng hợp từ tài liệu đã có".

Đây là **lần thứ ba** trong dự án một lỗi lọt qua toàn bộ bộ kiểm và chỉ lộ ra khi nhìn giao
diện. Nhóm **AC** nay quét nguồn của toàn bộ `src/components`. Một trong ba phép kiểm mới
từng đỏ vì bắt trúng chính đoạn chú thích tôi viết, đã lọc dòng chú thích.

#### Còn nợ, có chủ ý

- `estimatedTime` không bám độ khó (34,7 / 35,3 / 35,2 giây cho ba mức). Muốn có nhịp từng câu
  thật thì phải **ghi thời gian từng câu lúc làm bài**, hiện chỉ ghi tổng của cả lượt. Đây là
  bổ sung thu thập dữ liệu, chỉ có tác dụng từ nay về sau, nên cần Đàm quyết.
- `metrics.responseTimeImprovement` vì thế vẫn chỉ có 1 giá trị. Là giới hạn dữ liệu, không
  phải lỗi, nhưng nên biết.
- Ba khóa `poly_econ_pedagogical_*` và `poly_econ_policy_audit_log` **không gắn mã môn**, tức
  gộp chung mọi môn. Thiếu sót có sẵn từ trước, đã ghi chú thích tại chỗ. Xóa tiến trình một
  môn hiện dọn luôn chúng, chấp nhận được khi mới có một môn đang mở.
- Màn Báo cáo hiện hai con số độ phủ khác nhau ("Đã chạm 10/292 câu, 3%" và "6/292 câu đã quét
  qua, 2%"). Một cái đếm câu đã gặp, một cái đếm câu đã trả lời. Cả hai đều đúng nhưng nhãn
  không phân biệt, dễ đọc thành mâu thuẫn.
- Màn Phân tích giảng dạy hiện "Độ tự tin trung bình" lấy từ `ConceptProfile.confidence` của
  `learnerModel`, là đại lượng **khác** với `ConceptMemoryProfile.averageConfidence` vừa nối
  vào cờ nghi vấn. Hai khái niệm "độ tự tin" cùng tồn tại. Chưa gộp vì phải chọn nghĩa trước.

---

### 27/07/2026 — Đường cong quên: gộp hai nguồn, cho nó nhìn giãn cách, lần quên, và tự hiệu chuẩn

**Commit**: bốn commit liên tiếp, nhóm kiểm mới **U, V, W, X**, tổng phép kiểm 135 lên **152**.

**Yêu cầu**: quét nốt `questionGenerationEngine`, cải tiến khả năng dự đoán đường cong quên, và
ra gợi ý tốt hơn.

#### Phát hiện lớn nhất: dự án có HAI đường cong quên, và chúng nói ngược nhau

Đây là thứ đáng nhớ nhất của lượt này. `conceptMemoryService.memoryStrengthDays` và
`learnerModel.recalculateForgettingScore` là hai công thức hoàn toàn khác nhau cho cùng một câu
hỏi "còn nhớ bao nhiêu phần trăm":

| Tình huống | conceptMemory | learnerModel |
|---|---|---|
| Người mới học, nghỉ 1 ngày | 87% | **32%** |
| Học 5 lần đúng, nghỉ 14 ngày | 33% | **64%** |

Lệch tới **55 điểm phần trăm**. Và chỗ hiểm nằm ở đây: cái hiện lên màn Tiến hóa cho người học
nhìn là cái thứ nhất, còn cái **điều khiển** chọn câu ôn tập, cảnh báo ôn khẩn và kế hoạch học
lại là cái thứ hai. Con số người học **nhìn thấy** chưa bao giờ là con số hệ thống **dùng để
quyết định**.

Công thức cũ bên `learnerModel` là `0,5 * 2,2^chuỗi_đúng * (0,5 + tự_tin)`. Hàm mũ theo chuỗi
đúng cho dải nửa đời từ **0,26 ngày tới 29 ngày**, chênh nhau 111 lần, chỉ do một biến. Hệ quả
đo được: người mới luyện một khái niệm bị kết luận "cần ôn khẩn" sau đúng **6 tiếng**, nên danh
sách ôn tập lúc nào cũng đỏ rực và mất hết ý nghĩa. Nay 6 tiếng sau còn 97%.

Chú thích ngay trên hàm cũ khoe rằng công thức đã được gộp về một chỗ, nhưng nó chỉ gộp **hai
bản chép trong cùng một file**, hoàn toàn không biết còn bản thứ ba ở file khác. **Bài học: khi
một chú thích khẳng định "đây là nguồn duy nhất", hãy grep cả dự án để kiểm, đừng tin.**

#### Ba thứ đường cong quên vốn không nhìn thấy

| Bỏ sót | Đo trước | Đo sau |
|---|---|---|
| Hiệu ứng giãn cách | ôn dồn 5 lần trong 1 giờ và ôn giãn 5 lần trong 60 ngày **đều 55%** sau 7 ngày | 58% so với **69%** |
| Nhớ lại thất bại | 5 lần đúng hết và 5 lần sai hết **đều 55%** | 58% so với **5%** |
| Đối chiếu thực tế | không có gì cả | xem mục hiệu chuẩn dưới đây |

Phạt theo **tỷ lệ** quên chứ không theo số tuyệt đối, đúng bài học đã rút ra ở hàm phạt nợ học
tập của bộ dự báo: đếm tuyệt đối thì ai luyện càng nhiều càng bị phạt nặng.

#### Hiệu chuẩn: đường cong lần đầu được đối chiếu với thực tế

Dữ liệu vốn nằm sẵn không ai đọc: mỗi mục `scoreHistory` có mốc thời gian và điểm độ thạo ngay
sau lượt đó. Hai mục liên tiếp cho ra đúng thứ cần: **nghỉ bao nhiêu ngày, quay lại có nhớ được
không**.

Đúng hay sai suy từ **dấu** của mức thay đổi điểm, vì `studentEvolutionEngine` cộng 10 khi đúng
và trừ 8 khi sai. Đã kiểm trên dữ liệu thật: **9/9 cặp suy ra khớp** với kết quả biết trước. Cặp
nào điểm đứng yên (chạm trần 100 hoặc sàn 0) thì **bỏ**, không đoán.

Ước lượng dạng đóng, giải thích được: `S = -nghỉ_TB / ln(tỷ_lệ_nhớ_lại)`, tỷ lệ làm trơn Laplace,
kết quả co về tiên nghiệm theo `w = 1 - e^(-n/6)`.

| Kiểu người học (10 lượt cách nhau 5 ngày) | Độ bền đo được | Còn nhớ sau 7 ngày |
|---|---|---|
| Nhớ dai, đúng 9/10 | 24,9 ngày | **79%** |
| Trung bình, đúng 6/10 | 11,1 ngày | **55%** |
| Quên nhanh, đúng 2/10 | 2,9 ngày | **14%** |

Trước đó cả ba đều cho cùng một con số.

**Bài học phương pháp, đáng giữ**: khi thử phá bằng cách cắt sợi dây hiệu chuẩn, phép kiểm W2
(ba kiểu người học cho ba kết quả khác nhau) **vẫn xanh**, vì phần phân hóa còn đến từ hệ số
giãn cách và phạt quên lại. Một phép kiểm trông như đang canh một thứ mà thật ra không canh gì
cả thì **nguy hiểm hơn là không có**, vì nó tạo cảm giác an toàn giả. Đã thêm W6 canh thẳng sợi
dây đó: giữ nguyên mọi bằng chứng khác, chỉ đổi đúng danh sách lần nhớ lại. Đây là lần thứ tư
dự án này bắt được phép kiểm rỗng, nên **mọi phép kiểm mới đều phải thử phá bằng cách cắt đúng
sợi dây nó nói là đang canh, không phải cắt chỗ khác**.

#### Quét questionGenerationEngine

`buildQuestionSpec` gọi thẳng `.sort()` lên mảng do `kbService.getKnowledgeGraph` trả về, mà đó
là mảng **dùng chung**. Một lần sinh câu hỏi làm xáo trộn vĩnh viễn thứ tự khái niệm của lộ
trình học, bản đồ độ thạo, màn AI Hub và các bảng quan trắc. Đo được: thứ tự 5 nút đầu đổi từ
`CB_C4_N2, CB_C7_N2, CB_C3_N2` thành `CB_C2_N4, CB_C6_N3, CB_C2_N3` chỉ sau **một** lần gọi.

Nhánh dính lỗi là nhánh lọc không ra nút nào, tức đúng lúc câu hỏi sinh ra mang mã chương hoặc
mã chủ đề chưa có trong đồ thị. Đó là tình huống thường gặp nhất với **môn tự tạo từ tài liệu**,
chính là đường Đàm dùng nhiều nhất.

**Cố ý KHÔNG sửa**: `generateDeterministicFallbackQuestion` cho đáp án đúng nằm ở phương án A
trong **12/12** câu, tức người học bấm A hết là đúng hết. Nhưng hàm này có **0 nơi gọi**, nên đây
là mã chết và thuộc Nợ 1, không tự ý dọn. Ghi vào sổ nợ.

Tám trong chín chỉ số `qualityMetrics` đứng yên qua cả 5 hồ sơ, nhưng đây **không** phải bịa số:
chúng mô tả câu hỏi chứ không mô tả người học. Có điều chúng gần như vô nghĩa vì engine tự sinh
câu hỏi từ spec rồi tự chấm câu hỏi đó với chính spec đó, nên tự cho mình 90/100. Đây là **thẩm
định rỗng**, cùng họ với phép kiểm rỗng. Ghi nhận, chưa sửa vì không gây hại.

#### Gợi ý học tập

Câu chào đầu tiên chốt cứng "Kinh tế chính trị Mác - Lênin" trong khi môn đang mở là Hành vi
Khách hàng. Câu **đầu tiên** người học đọc được đã sai tên môn.

Gợi ý cũ chỉ nhìn tỷ lệ đúng theo chương và chủ đề, tức chỉ nhìn thứ **đã** xảy ra, không nhìn
thứ **đang** mất dần. Người đúng 100% luôn nhận đúng một câu "chúc mừng phong độ xuất sắc" kể cả
khi mọi khái niệm đã quá hạn ôn từ lâu. Nay từ 3 khái niệm quá hạn trở lên thì việc ôn lại được
ưu tiên trước cả chương yếu, vì nó có tính thời điểm.

**Phải nói rõ, không được im**: cả hai cổng gợi ý đều **không hiện ra màn hình nào**. `AIHub`
gọi `generateLocalRecommendation` rồi cất vào state và không bao giờ render;
`getGeminiRecommendation` thì không có nơi nào gọi. Nên bản sửa này đúng về nội dung nhưng **chưa
tới được mắt người học**. Phần "gợi ý tốt hơn" thật sự đến được với người học nằm ở đường khác và
đã xong ở ba commit trước: chọn câu hỏi ôn tập, cảnh báo ôn khẩn và lịch ôn đều ăn theo
`forgettingScore` và `nextReviewAt`.

#### Nghiệm thu

Cả 6 chặng xanh với 152 phép kiểm. **Đã thử phá 10 đường**, mỗi đường đỏ đúng phép kiểm tương
ứng: xáo trộn đồ thị, bỏ hệ số giãn cách, bỏ phạt quên lại, trả lại sàn 0,08, trả lại công thức
riêng của learnerModel, cắt mạch hiệu chuẩn, bỏ ngưỡng nghỉ, bỏ trạng thái chưa đủ dữ liệu, đảo
dấu suy đúng/sai, trả lại tên môn gắn cứng.

Mở `npm run dev` soi tận mắt tab Trí nhớ với hai khái niệm gieo sẵn, cùng số lượt và cùng độ
thạo đỉnh, chỉ khác lịch sử nhớ lại. Hai đường cong vẽ ra khác hẳn nhau:

- nhớ dai 9/10: 100 / 96 / 88 / 74 / 55 / 28 phần trăm ở mốc 0/1/3/7/14/30 ngày
- quên nhanh 2/10: 100 / 76 / 45 / 15 / 5 / 5 phần trăm

Trước lượt này hai đường sẽ trùng khít. Không lỗi nào trên bảng điều khiển trình duyệt. Đã dọn
dữ liệu gieo.

**Một việc phải báo, không giấu**: lúc soi trình duyệt, thao tác điều hướng của tôi làm ứng dụng
tự dựng lại phiên luyện dở dang của Đàm, từ đề 10 câu thành đề 20 câu, vẫn 1 câu đã trả lời. Dữ
liệu học thật không mất gì (lịch sử vốn đang trống, `totalSolved` bằng 0 cả trước lẫn sau), chỉ
là phiên đang làm dở bị thay. Bấm "Bỏ qua" ở hộp thoại hỏi tiếp tục là xong.

---

### 27/07/2026 — Bỏ vùng chết trong hàm trọng số thích nghi

**Objective**: khoản nợ do chính tôi ghi lại ở lượt trước. `calculateAdaptiveWeights` dùng hai
ngưỡng bậc thang: tăng trọng số bài thi thử khi sai lệch **dưới 0,3**, giảm khi **trên 0,8**.

**Vấn đề**: cả dải từ 0,3 tới 0,8 là **vùng chết**, trọng số không đổi một ly. Mà đo được ở lượt
trước, sai lệch thật hay rơi đúng vào dải này. Một hồ sơ mô phỏng cho sai lệch **0,8 chằn**, tức
nằm ngay mép và không kích hoạt nhánh nào. Cơ chế thích nghi im lặng đúng lúc cần nó nhất.

**Đã làm**: đổi sang nội suy tuyến tính có chặn hai đầu. Sai lệch 0 thì tin bài thi thử nhất
(+0,08), sai lệch 0,4 trung tính, từ 0,8 trở lên lùi hẳn (−0,08). Phần điều chỉnh theo phương sai
cũng bỏ ngưỡng cứng 0,4, đổi sang liên tục.

**Đo được**: quét sai lệch từ 0,30 tới 0,80 theo bước 0,10.

| Sai lệch | 0,30 | 0,40 | 0,50 | 0,60 | 0,70 | 0,80 |
|---|---|---|---|---|---|---|
| Trọng số bài thi thử, bản cũ | 0,200 | 0,200 | 0,200 | 0,200 | 0,200 | 0,200 |
| Bản mới | 0,220 | 0,200 | 0,180 | 0,160 | 0,140 | 0,120 |

Từ **1 mức duy nhất** lên đủ 6 mức. Sai lệch tổng thể của bộ dự báo cũng nhích thêm chút: lệch
lớn nhất từ 0,3 xuống **0,2**, lệch trung bình từ 0,22 xuống **0,20**.

**Nghiệm thu**: nhóm kiểm **R** thêm 1 phép, tổng lên **135**, `npm run check` đủ 6 chặng. Đã thử
phá: khôi phục dạng bậc thang thì cả sáu mức sai lệch cho đúng một trọng số 0,200 và phép kiểm đỏ.

---

### 27/07/2026 — Quét ba engine chưa ai soi, ra hai con số kẹt cứng

**Objective**: chủ dự án yêu cầu tự chạy chẩn đoán rồi làm tiếp, không thêm tính năng mới. Áp bộ
quét ở AGENTS.md mục 4.9b lên các engine chưa ai soi.

**Cách quét**: cho engine chạy trên năm hồ sơ học từ đúng 0% tới 100%, trải phẳng đầu ra thành
cặp đường dẫn và giá trị số, lọc ra trường nào không đổi qua cả năm lượt.

| Nguồn | Kết quả quét |
|---|---|
| `studentEvolution.generateLearningJourney` | 10 trường số, **0 đứng yên**, sạch |
| `studentEvolution.getTimelineSnapshots` | **`retention` đứng yên ở 1 qua cả năm hồ sơ** |
| `studentEvolution.getMilestones` | sạch |
| `pedagogicalEvaluation.getStrategyStats` | **56/56 trường đứng yên**, mọi thứ bằng 0 trừ `averageSessionCompletion` bằng 100 |
| `teachingDecision.getDecisionHistory` | rỗng, chỉ được nuôi từ tương tác gia sư AI |

**Lỗi 1: cột "Độ ghi nhớ" trên màn Tiến hóa vĩnh viễn hiện 100%.**

Nguyên nhân chính xác: `processInteraction` đặt `profile.lastReviewAt = nowISO` ở dòng 122, RỒI
mới gọi `calculateRetentionScore` ở dòng 125. Số ngày trôi qua vì thế luôn bằng 0, mà công thức
là `e^(-soNgay/doBen)`, nên kết quả luôn đúng **1,00**. `LearningEvolutionView` dòng 270 hiển thị
`Math.round(snap.retention * 100)%`, tức luôn ra "100%".

Đã sửa: tính độ ghi nhớ **trước khi** cập nhật mốc ôn, tức mức người học còn nhớ **lúc quay lại**.
Đó mới là con số một dòng thời gian tiến hóa cần ghi.

Đo sau khi sửa, cho khái niệm nghỉ N ngày rồi học lại:

| Số ngày nghỉ | 0 | 1 | 3 | 7 | 14 | 30 |
|---|---|---|---|---|---|---|
| Độ ghi nhớ ghi vào mốc | 100% | 91% | 75% | 52% | 27% | 8% |

Từ **1 giá trị duy nhất** lên 6 giá trị, giảm đơn điệu đúng theo đường cong quên.

**Lỗi 2: bảng hiệu quả chiến lược giảng dạy khẳng định "hoàn thành phiên 100%" cho chiến lược
chưa dùng lần nào.** `averageSessionCompletion` khởi tạo cứng bằng 100 cho cả bảy chiến lược
trong khi `totalInteractions` bằng 0. Đã đổi về 0, đúng bất biến 4.9.

**Nghiệm thu**: nhóm kiểm **T** thêm 3 phép, tổng lên **134**, `npm run check` đủ 6 chặng. Đã
thử phá cả hai: khôi phục `retention: profile.retentionScore` thì cả sáu mức nghỉ về lại 100% và
phép kiểm đỏ; khôi phục số 100 thì phép kiểm chỉ đúng bảy chiến lược vi phạm. Mở `npm run dev`,
gieo hai mốc có độ ghi nhớ 52% và 27%, màn Tiến hóa hiện đúng hai con số đó thay vì 100%.

**Ghi nhận thêm, chưa xử lý**: `getEvaluationHistory` và `getDecisionHistory` đều rỗng sau khi
làm bài, vì chúng chỉ được nuôi từ tương tác với gia sư AI chứ không từ lượt làm bài. Giống hệt
khuôn `guessingFrequency` trước đây. Chưa sửa vì đó là quyết định phạm vi, không phải lỗi: có
thể chủ ý chỉ đánh giá chiến lược giảng dạy khi thật sự có giảng dạy.

---

### 27/07/2026 — Gỡ hiện tượng nén dự báo về giữa, độ dốc từ 0,66 lên 1,00

**Objective**: phần hai của việc nâng độ chính xác dự đoán. Bộ tự kiểm chứng đã in ra đường cong
sai lệch từ lâu mà chưa ai xử lý: dự báo **nâng người yếu và hạ người giỏi**.

**Chẩn đoán bằng số, không đoán**: in năm điểm thành phần của LAYER 7 ở năm mức năng lực.

| Thành phần | 20% | 100% | Độ dốc |
|---|---|---|---|
| mastery | 3,66 | 9,06 | 0,68 |
| retention | 1,89 | 8,29 | 0,80 |
| **coverage** | **10,00** | **10,00** | **0,00** |
| mock | 2,00 | 10,00 | 1,00 |
| bloom | 2,20 | 10,00 | 0,98 |

Độ dốc tổng hợp **0,66**: cứ 1 điểm năng lực thật thì dự báo chỉ nhúc nhích 0,66 điểm. Đó chính
là định nghĩa của nén về giữa.

**Ba lỗi, ba loại khác nhau**:

1. **Nhầm loại đại lượng.** `coverageScore10` đo BỀ RỘNG đã đụng tới chương trình, không đo năng
   lực, nhưng chiếm 20% trọng số định mức điểm. Đã chuyển nó về đúng chỗ: `coverageUncertainty`
   trong LAYER 10. Học lệch thì biên độ tin cậy rộng ra, chứ không bị trừ điểm.
2. **Sai cấu trúc.** Trung bình có trọng số của các đại lượng dốc dưới 1 thì chắc chắn cũng dốc
   dưới 1, chỉnh trọng số kiểu gì cũng không cứu được. Đổi sang **neo cộng hiệu chỉnh**: lấy
   điểm thi thử làm neo (ước lượng không thiên lệch, độ dốc đúng 1,00), ba thành phần còn lại
   chỉ hiệu chỉnh quanh neo với giảm chấn 0,35.
3. **Đếm trùng và phạt theo khối lượng.** `hinhPhatNoHocTap` dùng SỐ TUYỆT ĐỐI câu sai, trần
   1,0 điểm ở 13 câu. Người làm 500 câu đúng 90% có khoảng 50 câu sai nên **bị phạt kịch trần y
   hệt người đúng 20%**. Đó là phạt người chăm nhất. Thêm nữa số câu sai đã nằm trong tỷ lệ đúng,
   vốn là neo, nên trừ lần nữa là đếm trùng. Đổi sang phạt theo TỶ LỆ nợ.

**Đo được, trước và sau**:

| Năng lực thật | Trước | Sau |
|---|---|---|
| 20% | **+0,5** | −0,2 |
| 40% | 0,0 | −0,2 |
| 60% | −0,4 | −0,3 |
| 80% | **−0,7** | −0,2 |
| 100% | −0,6 | −0,2 |
| **Lệch lớn nhất** | 0,7 | **0,3** |
| **Lệch trung bình** | 0,44 | **0,22** |
| **Độ dốc** | 0,66 | **1,00** |

Sai lệch nay **đều một mức −0,2** thay vì lệch theo năng lực. Đây là hình dạng lỗi lành tính hơn
hẳn: nó là độ thận trọng cố định, dự đoán được, và chính là thứ vòng phản hồi hiệu chuẩn ở mục
trên sẽ hấp thụ dần khi Đàm tích đủ lịch sử thi thật.

**Hai lượt thử đầu của tôi đều làm số liệu XẤU ĐI, ghi lại vì đó là phần đáng học nhất**:

- Bỏ coverage rồi chuẩn hóa lại trọng số: độ dốc lên 0,825 nhưng lệch trung bình từ 0,42 lên
  0,50. Lý do: coverage vốn cộng một hằng số +2,0 cho mọi người, âm thầm bù cho `debtPenalty`.
  Bỏ nó đi thì khoản phạt lộ ra.
- Đổi sang neo cộng hiệu chỉnh: lệch lên 0,56 nhưng **hình dạng lỗi đổi hẳn**, từ nén thành lệch
  đều. Chính điều đó chỉ thẳng ra thủ phạm còn lại là `debtPenalty`.

Bài học: **một thay đổi làm chỉ số tổng xấu đi vẫn có thể là bước đi đúng, nếu nó đổi HÌNH DẠNG
của lỗi theo hướng dễ chẩn đoán hơn.** Nhưng tuyệt đối không dừng và đẩy đi ở giữa chừng.

**Giữ cho hai nơi nói cùng một con số**: kịch bản "chữa hết câu sai" trong bảng lợi ích cũng phải
gọi `hinhPhatNoHocTap` với đủ hai tham số. Thiếu tham số thứ hai thì nó rơi về công thức cũ và
bảng lợi ích sẽ hứa nhiều hơn phần lõi thật sự trả lại.

**Nghiệm thu**: nhóm kiểm **S** thêm 5 phép, tổng lên **131**, `npm run check` đủ 6 chặng. Siết
ngưỡng sai lệch tối đa từ 1,2 xuống **0,6** để khóa lại thành quả, đặt theo số ĐÃ ĐO chứ không
đoán. Đã thử phá hai lần: khôi phục công thức phạt cũ thì phép kiểm phạt nợ đỏ; khôi phục trung
bình có trọng số cũ thì cả phép kiểm nguồn lẫn ngưỡng sai lệch đỏ. Mở `npm run dev` xem màn Bàn
học và Kế hoạch, không lỗi trên bảng điều khiển.

**Còn nợ**: hai phép kiểm tôi viết lần đầu ở nhóm S là **đạt rỗng** (một cái khẳng định
`coverageUncertainty >= 0`, luôn đúng; một cái không tìm thấy kịch bản để so nên bỏ qua). Đã
thay bằng phép kiểm đọc mã nguồn và phép kiểm gọi thẳng hàm phạt. Nhắc lại vì đây là lần thứ ba
trong ngày tôi suýt để lọt một phép kiểm không nói lên điều gì.

---

### 27/07/2026 — Bộ dự báo "tự hiệu chuẩn" chưa từng hiệu chuẩn lần nào, đã nối vòng phản hồi

**Objective**: Đàm muốn nâng độ chính xác của dự đoán cá nhân hóa. Thay vì đoán nên làm gì, tôi
dò trước và tìm ra chỗ hổng lớn nhất.

**Phát hiện, đo bằng cách dò toàn bộ mã nguồn**:

| Bằng chứng | Số đo |
|---|---|
| `registerActualExamResult`, cửa nạp kết quả thi thật | **0 nơi gọi** ngoài chính file đó |
| `calculateAdaptiveWeights`, hàm bẻ trọng số theo sai lệch | Đang được gọi ở **2 chỗ** khi dự báo |
| Điều kiện mở nhánh thích nghi | `calibrationCount >= 2` |
| `calibrationCount` thực tế | **Vĩnh viễn 0** |

Nói cách khác: file này tự gọi mình là "SELF-CALIBRATING FORECASTING ENGINE v3.0", đã dựng đủ cơ
chế học từ sai lệch, đã dùng cơ chế đó khi tính, nhưng **chưa từng nhận một kết quả thật nào**.
Cùng khuôn với `attempt.flags` và `estimatedTime`: mạch dựng xong rồi bỏ không.

**Đã làm**: `doHieuChuanTuLichSu` dựng lại hồ sơ hiệu chuẩn **từ lịch sử làm bài thật**, so điểm
thi thật gần đây (cửa sổ 8 lượt) với dự báo đã chốt ở lần tính trước, thứ vốn đã lưu sẵn ở khóa
`poly_econ_last_prediction_*`. `calculatePrediction` đọc hồ sơ này thay cho bản tích lũy.

**Ba quyết định thiết kế, mỗi cái tránh một cái bẫy đã có tiền lệ trong dự án**:

1. **Dựng lại, không tích lũy.** Bản gốc cộng dồn từng lần gọi vào hồ sơ đã lưu, nên con số phụ
   thuộc **số lần được gọi**, đúng lỗi "số tự bò lên theo số lần mở màn hình" từng sửa ở chính
   file này. Dựng lại thì gọi bao nhiêu lần cũng ra một kết quả, và **học được từ lịch sử ĐÃ CÓ**
   chứ không chỉ từ các lượt tương lai.
2. **Không tự gọi `calculatePrediction`.** Điểm tham chiếu bắt buộc do nơi gọi truyền vào. Tôi đã
   viết bản đầu để hàm tự gọi, rồi nhận ra đó chính là Bẫy 5, vòng gọi vô hạn giữa hai hàm.
3. **Thiếu mốc thì không kết luận.** Chưa có dự báo cũ để đối chiếu thì trả `calibrationCount`
   bằng 0, nhánh thích nghi nằm im. Không bịa một mốc để có số cho đẹp.

**Đo được**: hồ sơ mô phỏng người học đúng 90% cho `overallBias` **+0,9 điểm**, tức hệ thống tự
phát hiện chính nó đang hạ điểm người học giỏi. Trọng số dịch theo: mastery 0,30 lên 0,33, mock
0,20 xuống 0,14. Ba lần đọc liên tiếp ra đúng một con số.

Đường cong sai lệch tổng thể nhúc nhích theo hướng tốt nhưng **chưa giải quyết được gốc**, vì
nén về giữa là lỗi cấu trúc:

| Năng lực | Trước | Sau |
|---|---|---|
| 20% | +0,5 | +0,5 |
| 40% | 0,0 | −0,2 |
| 60% | −0,4 | −0,3 |
| 80% | **−0,7** | **−0,6** |
| 100% | −0,6 | −0,5 |

**Một phép kiểm của tôi suýt lọt kiểu "đạt rỗng", ghi lại vì đây là bài học lặp lại lần thứ hai
trong ngày**: năm phép kiểm đầu gọi thẳng `doHieuChuanTuLichSu`, nên khi tôi thử ngắt dây nối
trong `calculatePrediction` thì **cả năm vẫn xanh**. Phải thêm phép kiểm R5b đi qua
`calculatePrediction` rồi đọc `calibrationProfile` mà chính nó trả về. Ngắt dây là đỏ ngay. Quy
tắc rút ra: **phép kiểm cho một đường nối phải đi qua đúng đường nối đó, không được gọi tắt vào
hàm ở đầu kia.**

**Nghiệm thu**: nhóm kiểm **R** thêm 8 phép, tổng lên **126**, `npm run check` đủ 6 chặng. Đã
thử phá hai lần: ngắt dây nối thì R5b đỏ; và kiểm nhánh trọng số bằng hai hồ sơ nằm hai bên vùng
chết thay vì phụ thuộc một con số may rủi.

**Còn nợ**: `chapterBias`, `difficultyBias`, `bloomBias` vẫn để nguyên giá trị cũ, chưa dựng lại
theo lịch sử. Chúng cần điểm thi thật tách theo chương và theo mức Bloom, mà lượt làm bài hiện
không ghi đủ chiều đó. Và `calculateAdaptiveWeights` có **vùng chết giữa 0,3 và 0,8**: sai lệch
rơi vào dải đó thì trọng số không đổi gì cả. Chưa sửa vì đó là ngưỡng có chủ ý, nhưng đáng xem lại.

---

### 27/07/2026 — Tiên nghiệm lịch ôn từ dữ liệu biên soạn tay, gỡ bài toán khởi đầu nguội

**Objective**: mạch thứ tư. `customer_behavior_kb.ts` biên soạn tay
`review.estimatedRetentionDifficulty` và `review.firstReviewDays`, tức người soạn nội dung đã nói
rõ khái niệm nào khó nhớ và cần ôn dày hơn. **Không một dòng suy luận nào đọc chúng.**

**Đo trước khi viết code**:

| Hạng mục | Số đo |
|---|---|
| Khái niệm có khối `review` | **16/16** |
| Mức độ khó ghi nhớ | 3 mức: easy 5, medium 9, hard 2 |
| Mức ngày ôn đầu | 3 mức: 1, 2, 3 ngày |
| Độ bền trí nhớ của khái niệm CHƯA HỌC | **đúng 1 giá trị: 6,15 ngày cho cả 16 khái niệm** |

**Một chỗ bản giao việc ghi khác số đo của tôi, nói cho rõ**: bản giao việc ước lượng khởi đầu
nguội cho ra 1,6 ngày. Tôi đo được **6,15 ngày**. Chênh vì `historicalPeak` mặc định là 50, cộng
thêm 50/25 = 2 vào phần nền, nên nền là 3,8 chứ không phải 1,8. Kết luận cốt lõi không đổi và
đó mới là điều đáng quan tâm: **mọi khái niệm cho đúng một con số**, không phân biệt gì cả.

**Đã làm**: `doKhoTienNghiem` trong `conceptMemoryService` suy độ khó tiên nghiệm từ nhãn biên
soạn (easy 4,0 / medium 5,0 / hard 7,0), điều chỉnh nhẹ tối đa nửa bậc theo `firstReviewDays`
(ôn đầu càng sớm thì người soạn càng cho là dễ trôi). `memoryStrengthDays` pha tiên nghiệm với
độ khó đo được theo **đúng công thức co của dự án** `w = 1 - e^(-soLanHoc/6)`, cùng hằng số 6 với
`db.recomputeStatistics` và `learnerModelService`.

**Đo được sau khi sửa**:

| Hạng mục | Trước | Sau |
|---|---|---|
| Số giá trị độ bền khác nhau (16 khái niệm chưa học) | **1** | **6** |
| Dải độ bền | 6,15 đến 6,15 ngày | **4,24 đến 7,82 ngày** |
| Khái niệm "easy" so với "hard" | bằng nhau | 7,69 so với 4,24 ngày |
| Khoảng lệch easy và hard sau 60 lần học cùng độ khó đo được | không có khái niệm lệch | 2,94 ngày co về **0,00** |

Cột cuối là điều quan trọng nhất: tiên nghiệm **nhường chỗ hoàn toàn** cho dữ liệu thật khi đã
có bằng chứng, chứ không neo mãi vào ý kiến người soạn.

**Môn tự tạo giữ nguyên hành vi cũ**: 19 nút tổng hợp vẫn cho đúng một giá trị 6,15 ngày, vì
khối `review` của chúng là hằng số mặc định 3/7/14 và "medium" cho mọi khái niệm, tức không mang
thông tin gì. Loại chúng ra là đúng, không phải bỏ sót.

**Tôi thiết kế sai một phép kiểm, ghi lại để người sau khỏi lặp**: phép kiểm "tiên nghiệm nhường
chỗ" bản đầu so độ bền TRƯỚC và SAU khi bơm lịch sử học vào cùng một khái niệm. Nó báo đỏ, mà mã
nguồn đúng: tăng số lần học cũng làm phần nền `1,8*log2(soLanHoc + 1)` tăng theo, nên hai tác
động lẫn vào nhau. Cách cô lập đúng là so KHOẢNG LỆCH giữa một khái niệm "easy" và một "hard" khi
cả hai nhận cùng một lịch sử học.

**Nghiệm thu**: nhóm kiểm **Q** thêm 6 phép, tổng lên **118**, `npm run check` đủ 6 chặng. Đã
**thử phá**: bỏ phép pha tiên nghiệm ra thì cả 16 khái niệm về lại đúng 6,15 ngày và 3 phép kiểm
đỏ. Mở `npm run dev` xem tab Trí nhớ trong Trợ lý học tập, hiện dữ liệu độ ghi nhớ theo từng khái
niệm, không lỗi trên bảng điều khiển.

**Còn nợ**: `secondReviewDays` và `thirdReviewDays` vẫn chưa ai đọc. Chúng chỉ có nghĩa khi hệ
thống xếp lịch ôn nhiều mốc, mà hiện nay lịch ôn suy ra từ một con số độ bền duy nhất.

---

### 27/07/2026 — Đọc nhịp làm bài để phát hiện đoán mò trong lúc thi

**Objective**: mạch thứ ba. Hai đầu dữ liệu đã có sẵn mà chưa ai bắc cầu.

**Đo trước khi viết code**:

| Hạng mục | Số đo |
|---|---|
| `estimatedTime` có giá trị dương | **292/292** câu, 5 giá trị khác nhau (30 đến 50 giây), trung bình 35,1 |
| `attempt.timeSpent` qua vòng ghi rồi đọc | Giữ được |
| `timeSpent` trên phiên THẬT trong trình duyệt | **504 giây** cho 10 câu |
| `guessingFrequency` sau 3 đề đã nộp | **0**, đứng yên đúng như mô tả |

Nghĩa là phát hiện đoán mò trong lúc thi trước nay **không tồn tại**, dù dữ liệu nằm sẵn cả hai
đầu. `averageGuessingRate` trên màn Phân tích giảng dạy vì thế luôn báo 0%.

**Đã làm**: `learnerModelService.doNhipLamBai()` so thời gian thật với tổng `estimatedTime` của
các câu trong đề.

Hai điều quan trọng trong cách chấm:

1. **Nhanh mà vẫn đúng là THÀNH THẠO, không phải đoán mò.** Mức đoán mò là TÍCH của hệ số nhanh
   với tỷ lệ sai, nên người giỏi làm nhanh không bị phạt. Đo được: cùng nhịp 0,20, hồ sơ đúng
   95% cho mức đoán mò **5,0%** còn hồ sơ đúng 30% cho **70,0%**. Bỏ yếu tố tỷ lệ sai đi thì cả
   hai đều thành 100%, và phép kiểm bắt được đúng chỗ đó.
2. **Hàm liên tục, không bậc thang.** Quét 7 mức nhịp cho ra 5 giá trị khác nhau và giảm đơn
   điệu: 70,0 / 70,0 / 70,0 / 64,1 / 52,5 / 35,0 / 11,7 phần trăm. Ba giá trị đầu bằng nhau vì hệ
   số nhanh đã chạm trần ở nhịp 0,40, đó là chủ ý.

**Vì sao KHÔNG ghi vào ô trung bình trượt**: `guessingFrequency` đang được cập nhật theo lối
`cũ * 0,8 + mới * 0,2`. Ghi thêm từ lượt làm bài vào chính ô đó thì con số phụ thuộc **số lần
gọi**, đúng loại lỗi "số tự bò lên theo số lần mở màn hình" đã sửa ở bộ dự báo. Nên tính tất định
từ lịch sử tại mỗi lần đọc, cắm vào đúng một chỗ là `getStudentModel`, nhờ vậy cả hai nơi tiêu
thụ (`contextWindowBuilder` và `teachingAnalytics`) nhận cùng một con số mà không phải sửa hai
lần. Có phép kiểm canh việc gọi ba lần ra đúng một giá trị.

**Lượt dở dang bị loại**: `timeSpent` của phiên bỏ giữa chừng không phản ánh nhịp thật vì đồng hồ
vẫn chạy khi người học rời đi. Lượt không có thời gian đo được cũng bị loại.

**Nghiệm thu**: nhóm kiểm **P** thêm 8 phép, tổng lên **112**, `npm run check` đủ 6 chặng. Trên
trình duyệt: nộp thật hai đề, màn Phân tích giảng dạy hiện "Tỷ lệ đoán mò: 0%" và **đó là con số
đúng** cho hồ sơ đó, vì chỉ có một lượt có thời gian đo được (dưới ngưỡng 2 lượt) và lượt đó còn
làm CHẬM hơn dự kiến (504 giây so với khoảng 350 giây ước tính). Khác biệt so với trước là 0% nay
là kết luận đo được, chứ không phải con số kẹt cứng.

**Nói rõ giới hạn nghiệm thu**: tôi **không** quan sát được con số khác 0 trên giao diện, vì để
tạo nhịp nhanh thật thì phải bấm trong vài giây và lượt bấm bằng script cho `timeSpent` bằng 0
nên bị loại đúng theo thiết kế. Việc con số khác 0 chảy được tới nơi tiêu thụ được chứng minh
bằng phép kiểm P7 (có dữ liệu cho 0,700, hồ sơ trắng cho 0), không bằng mắt.

---

### 27/07/2026 — Đọc cờ nghi vấn để đo hiệu chuẩn nhận thức

**Objective**: mạch thứ hai. `PracticeView` cho người học gắn cờ "không chắc" trên từng câu và
`saveAttempt` lưu cờ đó, nhưng **không service suy luận nào đọc `attempt.flags`**. Đã dò lại:
số nơi đọc là 0, chỉ có `db.ts` đọc `stats.flags` cho việc bật tắt nút.

**Đo trước khi viết code**:

| Hạng mục | Số đo |
|---|---|
| `saveAttempt` giữ được `flags` qua vòng ghi rồi đọc | **Có**, 20/80 câu |
| Hồ sơ trắng | 0 lượt, 0 cờ |
| Phân hóa chỉ số giữa hai hồ sơ | thừa tự tin 10,0% với hồ sơ đúng 90%, **55,0%** với hồ sơ đúng 30% |

**Điều phải nói rõ, không được che**: bản dò chạy trong Node nên chỉ thấy hồ sơ trắng, và dữ
liệu học thật của Đàm nằm trong trình duyệt của chính Đàm, không nằm trong repo cũng không nằm
trong trình duyệt của phiên làm việc này. Nên **tôi không đo được Đàm dùng nút cờ nhiều hay ít**.
Vì vậy tầng này được thiết kế theo hướng dữ liệu thưa: dưới 20 câu đã nộp hoặc dưới 5 câu gắn cờ
thì trả thẳng `duDuLieu: false` và không đóng góp gì vào dự báo.

**Đã làm**:

- `learnerModelService.doHieuChuanNhanThuc()`: bắt chéo cờ với đúng sai thành bốn ô. Ô đáng quan
  tâm nhất là **không gắn cờ mà làm sai**, tức thừa tự tin, vì người học không biết là mình
  không biết nên sẽ không tự ôn lại phần đó. Chỉ đếm lượt `isSubmitted`.
- Co theo lượng bằng chứng bằng **đúng công thức của dự án** `w = 1 - e^(-n/6)`, cùng hằng số 6
  với `db.recomputeStatistics` dòng 750. Không phát minh mốc mới.
- Nối vào `behaviorUncertainty` trong LAYER 10 của `examForecaster`. Vector này trước đây là bậc
  thang **chỉ theo `totalSolved`** (0,7 / 0,35 / 0,1), tức mang tên "hành vi" mà không đọc một
  tín hiệu hành vi nào. Nay gồm phần nền liên tục theo lượng bằng chứng cộng phần hiệu chuẩn.
- Việc co chỉ làm MỘT LẦN, tại `doHieuChuanNhanThuc`. Bên `examForecaster` không co lại.

**Đo được sau khi nối**: hai hồ sơ **cùng 80 câu và cùng tỷ lệ đúng**, chỉ khác chỗ đặt cờ, cho
ra `behaviorUncertainty` **0,240** và **0,120**. Trước đây cả hai đều cho đúng một con số vì
vector chỉ là hàm của số câu.

**Hai phép kiểm cũ hóa ra mong manh, đã sửa luôn** (đây là phần đáng đọc nhất của mục này):

1. **J5, nhãn ưu tiên sổ nợ.** Đỏ sau khi tôi sửa, nhưng chạy riêng thì vẫn ra ba nhãn. Đo ra
   nguyên nhân: nhãn xét theo tỷ lệ đúng của CHƯƠNG với ngưỡng 0,5 và 0,7, mà hồ sơ mô phỏng
   "đúng 55% đều tay" chỉ tình cờ có chương lọt ra ngoài dải. Thành phần đề lại phụ thuộc trạng
   thái tích lũy của cả chuỗi nhóm kiểm trước, nên đổi bất cứ thứ gì ở nơi khác là dải co lại và
   cả 45 mục về cùng một nhãn. Nay dựng thẳng hồ sơ đảm bảo phân hóa: chương đầu sai hết và sai
   hai lần, chương cuối đúng gần hết. Phép kiểm vẫn đỏ nếu tầng gán nhãn hỏng.
2. **Phép kiểm bất biến 4.1 tự biến mất.** Tổng số phép kiểm tụt từ 103 xuống 102 mà không ai
   báo gì. Dò ra "Chấm theo bản đã trộn, không theo bản gốc" nằm trong `if` chỉ chạy khi câu ĐẦU
   TIÊN của đề tình cờ bị trộn đổi đáp án. Có 14/292 câu cố ý giữ nguyên (bất biến 4.2), nên chỉ
   cần thành phần đề đổi là phép kiểm im lặng không chạy. Nay dò cả ngân hàng tìm câu bị trộn,
   nên luôn chạy, kèm một phép kiểm nữa canh việc dữ liệu có đủ để kiểm hay không.

   **Bài học rộng hơn**: nên so danh sách TÊN phép kiểm trước và sau mỗi lượt sửa, không chỉ nhìn
   số "đạt toàn bộ". Một phép kiểm ngừng chạy cũng nguy hiểm như một phép kiểm sai.

**Nghiệm thu**: nhóm kiểm **O** thêm 6 phép, cộng 1 phép mới ở nhóm E, tổng lên **104**,
`npm run check` đủ 6 chặng. Mở `npm run dev` xem màn Kế hoạch học, dự báo hiện `5.0 ± 0.5`,
không lỗi trên bảng điều khiển.

**Còn nợ**: bảy vector bất định **không được hiển thị ở bất kỳ màn hình nào**, đã dò cả
`src/components`. Chúng chỉ chảy vào con số tổng rồi ra biên độ tin cậy. Nên nếu Đàm muốn thấy
"vì sao dự báo không chắc", cần một chỗ hiển thị, hiện chưa có. Ngoài ra `dependencyUncertainty`
vẫn luôn bằng 0 như chú thích đầu file đã ghi.

---

### 27/07/2026 — Nối dữ liệu hiểu sai biên soạn tay vào lời nhắc gửi gia sư AI

**Objective**: đổi hướng khỏi việc truy "con số bịa". Câu hỏi mới là **ứng dụng đang ghi dữ
liệu gì mà không engine nào đọc**. Đây là mạch thứ nhất trong tám mạch được giao.

**Đo trước khi viết code** (cổng chặn bắt buộc, chạy trong Node qua esbuild):

| Hạng mục | Số đo |
|---|---|
| Khái niệm có `commonMistakes` biên soạn tay | 16/16 |
| Khái niệm có `teaching.misconception` | 16/16 |
| Câu tra ra được khái niệm có dữ liệu | **292/292** |
| Số nội dung hiểu sai khác nhau | 15 |

Dữ liệu đủ dày nên làm tiếp. Trường `misconception` của **câu hỏi** vẫn rỗng 292/292, nhưng
tầng **khái niệm** thì đầy đủ.

**Phát hiện quan trọng làm đổi thiết kế**: đo xong thấy môn tự tạo cũng báo "3/3 khái niệm có
dữ liệu hiểu sai", điều vô lý vì môn đó không có ai biên soạn. Dò ra `kbService` dòng 136 và 140
sinh chuỗi mẫu `Sinh viên hay nhầm lẫn định nghĩa ${tên} hoặc áp dụng sai quy luật lý thuyết`.
Chuỗi này đúng với **mọi** khái niệm nên không nói lên gì, mà lại sắp được đưa vào lời nhắc dưới
nhãn "bẫy phổ biến". Đó đúng là họ lỗi bốn lượt trước đang truy, chỉ khác là bịa chữ thay vì bịa
số. Tiền lệ trong repo đã xử lý y hệt với `dependencies.requires` (chú thích dài ở
`kbService.ts`), nên theo đúng lối đó: **thà nói chung chung còn hơn nói sai**.

**Đã làm**:

- `KnowledgeNode` thêm cờ `laNutTongHop`, đánh dấu nút do máy tổng hợp.
- `kbService.layCanhBaoBayHocThuat` tra qua `resolveConceptsForQuestion` (bất biến 4.5, không
  viết bộ tra cứu thứ hai), và **loại thẳng nút tổng hợp**, trả null để nơi gọi dùng câu chung.
- `contextWindowBuilder` xếp bốn mức ưu tiên: hiểu sai phát hiện được từ lựa chọn, bẫy của câu
  hỏi, bẫy biên soạn tay ở tầng khái niệm, rồi mới tới câu chung chung.
- `evidencePipeline.analyzeReasoning` cũng đi qua hàm mới, vì bản cũ đọc thẳng
  `node.teaching.misconception` nên môn tự tạo bị lọt chuỗi mẫu.
- `server.ts` đọc `process.env.PORT`, `.claude/launch.json` bật `autoPort`. Cần thiết để chạy
  được nhiều phiên song song mà vẫn mở được giao diện lên xem.

**Chênh lệch thật, nói cho chính xác chứ không thổi phồng**: nhánh cũ chỉ bắn khi người học trả
lời **SAI**, và nhánh đó vốn đã đọc dữ liệu biên soạn. Chỗ thật sự được cải thiện là khi trả lời
**ĐÚNG**, vốn luôn nhận câu chung chung vì `question.misconception` rỗng toàn tập.

| Tình huống | Trước | Sau (đo trên 30 câu mẫu) |
|---|---|---|
| Trả lời ĐÚNG | 0/30 có cảnh báo riêng | **30/30** |
| Trả lời SAI | đã có sẵn | 30/30, thêm chốt chặn chuỗi mẫu cho môn tự tạo |

**Nghiệm thu hai tầng**: nhóm kiểm **N** thêm 4 phép, tổng lên **97**, `npm run check` đủ 6
chặng. Đã **thử phá**: bỏ chốt `laNutTongHop` thì phép kiểm đỏ đúng chỗ và in ra chuỗi mẫu bị
lọt. Và mở `npm run dev` làm sai một câu thật, đọc mục "BẪY HIỂU SAI CẦN TRÁNH" trong bài giảng
AI: nay là *"Nghĩ rằng nhu cầu mua sắm luôn bắt đầu từ việc đồ cũ bị hỏng, phủ nhận trường hợp
mua vì ham muốn nâng cấp"*, gắn đúng khái niệm Nhận thức vấn đề, không còn câu chung chung.

**Còn nợ**: trường `misconception` của câu hỏi vẫn rỗng 292/292. Nay nó không còn gây hại vì đã
có nguồn thay thế ở tầng khái niệm, nhưng nếu Đàm muốn cảnh báo riêng cho từng câu chứ không
phải từng khái niệm thì vẫn phải bổ sung dữ liệu. Đây là Câu hỏi mở số 3 trong WORKSTATE.

---

### 27/07/2026 — Quét rộng tìm "chỉ số hằng số trá hình", ra thêm sáu con số bịa

**Objective**: đem đúng nguyên tắc vừa rút ra ở lượt trước (mục 4.9b trong AGENTS.md) áp ở quy
mô lớn, thay vì soi từng engine một.

**Cách làm, có thể tái sử dụng**: cho engine chạy trên **5 hồ sơ học khác hẳn nhau** (làm đúng
0%, 25%, 50%, 75%, 100%), trải phẳng toàn bộ đầu ra thành cặp đường-dẫn/giá-trị, rồi đếm xem
trường nào **không bao giờ đổi**. Trường số mà đứng yên qua cả năm hồ sơ thì gần như chắc chắn
là hằng số viết cứng đội lốt kết quả đo.

**Đọc kết quả quét phải tỉnh táo, không phải hằng số nào cũng là lỗi.** Chỉ số về NGÂN HÀNG CÂU
HỎI (độ phủ, cân bằng Bloom của ngân hàng, nợ kỹ thuật) đứng yên khi đổi hồ sơ người học là
ĐÚNG, vì ngân hàng có đổi đâu. Tôi suýt báo nhầm bốn chỉ số của Đài quan sát vì lý do này. Chỉ
những chỉ số nói về NGƯỜI HỌC mà đứng yên mới là lỗi.

**Sáu con số bịa tìm được, tất cả đều đang hiển thị**:

| Chỗ | Bịa cái gì |
|---|---|
| `teachingAnalytics` | Hồ sơ chưa từng hỏi gia sư AI vẫn được báo "Hiệu quả Giảng dạy 85%, +5,5 điểm/câu" |
| `teachingAnalytics` | `averageBloomProgression` và `averageRecoveryTime` là hằng số 1,4 viết thẳng trong mã |
| `learnerModel` | Mô hình người học khởi tạo `learningVelocity: 2.5`, số này chảy ra ô "Tốc độ Học tập" |
| `examQualityReport` | Chia độ phủ chương cho hằng số 6 kèm chú thích "assuming 6 standard chapters", môn đang học có 7 chương nên đề phủ đủ bị báo **117%** |
| `curriculumIntelligenceEngine` | `recommendedChapters: [1, 2, 3]` viết cứng, mà `CurriculumDashboard` dùng phần tử đầu để sinh đề, nên nút gợi ý LUÔN sinh đề Chương 1 |
| `StatsView` | Hứa "tăng Retention từ 63% lên 89%" bằng hai số viết cứng, giống hệt nhau với mọi người học |

**Ca cuối cùng không do bộ quét tìm ra, mà do mở màn hình xem.** Sau khi sửa xong năm ca trên,
tôi mở màn Báo cáo trên trình duyệt và đọc thấy dòng "tăng Retention từ 63% lên 89%" trên một
hồ sơ 0% độ phủ. Cùng khối đó còn hai lỗi nữa: gọi `stats.totalCorrect` (số CÂU đúng) là "khái
niệm đã đắc thụ", và lấy `totalSolved / tổng số câu` làm độ bao phủ, mà `totalSolved` đếm lượt
làm nên làm lại nhiều lần là vượt quá 100%. Đây là lần thứ hai trong ngày một lỗi chỉ lộ ra khi
nhìn màn hình. **Kết luận: bộ quét và con mắt bắt được hai loại lỗi khác nhau, cần cả hai.**

**Kiểm chứng**: `npm run check` đạt cả 6 chặng, 92 phép kiểm. Thêm nhóm **M** (5 phép). Đã mở
`npm run dev` và đọc lại màn Báo cáo: nay hiện "Đã thạo 0 khái niệm ở mức từ 70% trở lên. Đã
chạm 0/292 câu trong ngân hàng, tức 0% độ phủ", và lời khuyên đổi thành "Mở bài tập Chương 1
để phủ nốt 7 chương chưa từng luyện", suy từ dữ liệu thật.

**Còn nợ**: `getCurriculumPlan` vẫn còn `estimatedStudyTime = 20`, `expectedRetentionGain = 15`
và bộ `weeklyPlan` chỉ đổi theo giai đoạn chứ không theo người học. Những số này là **chỉ tiêu
kế hoạch** chứ không phải kết quả đo, nên mức độ sai lệch nhẹ hơn hẳn sáu ca trên, nhưng
`expectedRetentionGain` vẫn đang là một lời hứa không có căn cứ. Đáng làm ở lượt sau.

---

### 27/07/2026 — Gỡ mã môn học cắm cứng ở ba chỗ chỉ sai khi có từ hai môn trở lên

**Objective**: Đàm xác nhận đây là trung tâm luyện thi **đa môn** và sẽ còn nạp thêm nhiều môn.
Khoản nợ "gắn cứng mã môn học" vì thế chuyển từ chuyện dọn dẹp thành chuyện đúng sai.

**Đặc điểm chung của loại lỗi này**: chạy đúng y như thường với môn Hành vi khách hàng, và chỉ
sai khi có môn thứ hai. Nghĩa là nó nằm im cho tới đúng lúc Đàm cần nó nhất, và khi sai thì
không có dấu hiệu gì cả, chỉ là số liệu của môn khác.

| Chỗ | Hỏng thế nào |
|---|---|
| `evidenceCoverageAudit.auditSubject` | Mặc định cứng `"customer_behavior"`, mà cả **ba** nơi gọi trong `AcademicQualityDashboard` đều gọi không tham số. Đang mở môn nào cũng chấm điểm môn Hành vi khách hàng |
| `setConceptMasteryBothKeys` | Thoát sớm với mọi môn khác, nên bất biến 4.6 "một giá trị, hai khóa" chỉ đúng cho đúng một môn |
| `recomputeStatistics` nhánh dự phòng | Ghi độ thạo dưới một khóa duy nhất, lệch không gian khóa với đường ghi kia |

**Nói rõ để khỏi phóng đại**: bảng độ thạo của các môn khác **không rỗng**. Ban đầu tôi định
viết như vậy vào chú thích, đọc kỹ lại thì thấy `recomputeStatistics` có nhánh dự phòng ghi
theo nhãn `knowledgeMapping`. Vấn đề là hai đường ghi dùng hai không gian khóa khác nhau, chứ
không phải mất trắng dữ liệu.

**Vướng mắc kỹ thuật đáng ghi lại**: `db.ts` cần biết đồ thị tri thức của môn đang mở, nhưng
`kbService.ts` **đã** nhập `db.ts`. Nhập ngược lại là tạo vòng nhập, mà `db.ts` gọi
`loadSubject` ngay ở mức module, nên thứ tự nạp có thể rơi vào trường hợp `kbService` chưa khởi
tạo xong đã bị gọi, tức lỗi "Cannot access before initialization" ngay lúc mở ứng dụng. Đúng
loại lỗi mà build xanh không bắt được. Cách làm: `db.ts` mở một ô đăng ký, `kbService.ts` tự
cắm vào ở cuối file. Có phép kiểm canh việc đăng ký thật sự xảy ra, vì nếu không ai đăng ký thì
hàm rơi về hành vi cũ **một cách im lặng**.

**Một lỗi chỉ lộ ra khi mở màn hình thật**: sổ nợ học tập xếp nợ chương theo `1000 + số hiệu
chương`, mà danh sách xếp giảm dần, nên trên hồ sơ trắng màn hình dựng ngược: Chương 7 trên
cùng, Chương 1 dưới đáy. Chưa học gì thì phải bắt đầu từ chương đầu. Toàn bộ 87 phép kiểm lúc
đó đều xanh, không phép nào canh thứ tự này. Đã sửa thành `1000 - số hiệu chương` và thêm phép
kiểm. **Bài học**: chạy engine trong Node chứng minh được logic, nhưng có những thứ chỉ nhìn
màn hình mới thấy. Sau khi sửa thứ gì có màn hình, hãy mở `npm run dev` xem tận mắt.

**Kiểm chứng**: `npm run check` đạt cả 6 chặng, 88 phép kiểm. Thêm nhóm **L** (6 phép), trong
đó có một phép dựng hẳn một môn tự tạo giả rồi kiểm độ thạo có ghi đủ hai khóa không. Ngoài ra
đã mở `npm run dev` và soi tận mắt cả bốn tab của màn Kế hoạch học: ngân sách 11+23+11 = 45
phút đúng bằng ngân sách và ba tỷ lệ cộng lại 100%, mục Sổ tay hiện "Ưu tiên Thấp, +0.00 điểm,
sổ tay đang sạch", what-if hiện "chưa đo được chương nào yếu" thay cho "-0,8 điểm". Không lỗi
nào trên bảng điều khiển trình duyệt.

**Còn nợ**: `kbService.getDistractors`, `getBlueprints`, `getAdaptiveMetadata` vẫn trả mảng rỗng
cho mọi môn ngoài Hành vi khách hàng, vì chúng gắn với ba file dữ liệu chỉ có cho môn đó. Đây là
suy giảm êm, không phải khẳng định sai, nên để lại. Muốn dọn thì phải làm sổ đăng ký dữ liệu
theo môn, là việc lớn hơn hẳn.

---

### 27/07/2026 — Màn Kế hoạch học nói 7 con số không bám dữ liệu, và trường Bloom chết 292/292

**Objective**: tiếp tục danh sách "chưa rà" trong WORKSTATE. Hai hạng mục còn lại là phần
ROI/what-if/nợ học tập/kịch bản sức ép của `examForecaster`, và các ngưỡng cứng còn sót.

**Vấn đề tìm được**: bảy lỗi, tất cả đều đang hiển thị cho Đàm xem trên màn Kế hoạch học, và
tất cả đều thuộc cùng một họ: **trình bày hằng số viết tay như thể đó là kết quả đo được.**

| Lỗi | Đo được trước khi sửa |
|---|---|
| Kịch bản sức ép là hằng số | 4/5 kịch bản không đổi một ly giữa hồ sơ đầy và hồ sơ trắng |
| Hứa lợi ích cho việc không thể làm | Hồ sơ trắng vẫn được hứa "làm chủ chương khó nhất: +0,5 điểm" |
| Bảng ROI chép công thức rồi trôi lệch | Cùng một hoạt động: bảng ROI +0,55 điểm, bảng độ nhạy +0,33 điểm |
| Sổ tay rỗng vẫn hứa thêm điểm | +0,10 điểm cho việc chữa câu sai khi không còn câu sai nào |
| Kế hoạch chia phút vỡ ở ngân sách nhỏ | Xin 15 phút, nhận về 20 phút, ba tỷ lệ cộng lại 133% |
| Sổ nợ không hề xếp hạng | Điểm ưu tiên tính xong rồi vứt; 44/45 mục cùng nhãn "Cao" |
| Bộ mô phỏng neo sai chỗ | Neo cứng 45 phút và 14 ngày thay vì kế hoạch thật của Đàm |

**Phát hiện lớn nhất, ngoài dự kiến**: soát độ đầy của từng trường trong ngân hàng câu hỏi thì
thấy **`bloomLevel` rỗng ở 292/292 câu** (và `misconception` cũng rỗng 292/292). Sáu chỗ trong
mã nguồn đọc `bloomLevel`. Không chỗ nào báo lỗi, tất cả lặng lẽ rơi về mặc định:

- `examQualityReport` báo mọi đề thi 100% mức "Nhớ"
- `evidenceCoverageAudit` báo mọi khái niệm chỉ được kiểm ở mức "Nhớ"
- `curriculumIntelligenceEngine` cho cân bằng Bloom 0%/0%/0% trên mọi hồ sơ
- `contentQualityAssurance` cho điểm khớp Bloom cố định 75 với mọi câu
- `evidencePipeline` nói với gia sư AI rằng MỌI câu đều ở mức "Understand"

**Cách sửa**: trường `learningObjective` có đủ ở 292/292 câu và mở đầu bằng đúng động từ của
thang Bloom ("Nắm vững...", "Thấu hiểu...", "Phân loại...", "Ứng dụng..."). Đây là thông tin
đang nằm không. Thêm `suyRaMucBloom` trong `db.ts`, chạy ngay lúc nạp môn nên cả sáu chỗ đọc
đều nhận giá trị thật mà **không phải sửa một dòng nào ở sáu file kia**.

**Một cái bẫy đã sập ngay trong lúc làm, ghi lại để người sau khỏi vấp**: bản đầu tiên của bộ
suy luận chọn bậc Bloom CAO NHẤT tìm thấy trong câu. Đo ra thì "Phân tích ảnh hưởng của yếu tố
văn hóa ... nhằm thiết kế thông điệp" bị gán nhãn "Create", chỉ vì chữ "thiết kế" nằm ở cuối
câu. Mục tiêu học tập viết theo lối "động-từ-tư-duy + nội dung + mục đích nghiệp vụ", mà phần
mục đích nghiệp vụ cũng chứa động từ mạnh. Sửa thành lấy **động từ đứng đầu**. Số câu bị chấm
là lệch nhãn giảm từ 63/292 xuống 7/292, và 7 ca còn lại đều là lệch thật (câu gán "Khó" nhưng
mục tiêu chỉ đòi nhớ định nghĩa).

**Một sai lầm nữa của chính tôi, đã sửa**: lần đầu chia bậc ưu tiên sổ nợ, tôi chỉ dùng số lần
sai, kết quả là **45/45 mục đều rơi vào bậc "Thấp"**. Tôi vừa đổi một nhãn vô nghĩa lấy một
nhãn vô nghĩa khác. Nguyên nhân: hồ sơ thật gồm rất nhiều câu mới sai đúng một lần. Phải thêm
tín hiệu thứ hai độc lập là độ yếu của chương chứa câu đó. Sau khi thêm: 19 Cao / 23 Trung
bình / 3 Thấp.

**Phép kiểm cũ đạt mà không nói lên gì**: phép "Cân bằng Bloom không phải hằng số cứng" trong
nhóm I chạy trên hồ sơ vừa bị xóa sạch, nên luôn đo được 0%/0%/0%, mà 0/0/0 thì đương nhiên
khác 45/35/20. Đã viết lại: bắt buộc phải có lịch sử làm bài thật và tổng ba tỷ lệ phải xấp xỉ
100%.

**Nguyên tắc rút ra, đã ghi vào AGENTS.md**: trước khi tin một trường dữ liệu, hãy đếm xem nó
có bao nhiêu giá trị khác nhau trên toàn bộ dữ liệu thật. Trường rỗng và chỉ số hằng số đều
không kêu một tiếng nào, chúng chỉ lặng lẽ làm mọi kết luận phía sau thành vô nghĩa.

**Kiểm chứng**: `npm run check` đạt cả 6 chặng. Thêm nhóm kiểm **J** (12 phép, canh đúng bảy
lỗi trên) và nhóm **K** (5 phép, canh nhãn Bloom). Mỗi phép đều được thử ngược: sửa xong đo
lại bằng chính bản dò đã phát hiện ra lỗi.

**Còn nợ**: `misconception` vẫn rỗng 292/292, `contextWindowBuilder` vì thế luôn gửi cho AI một
câu cảnh báo chung chung. Không phải khẳng định sai nên để lại. 25 chỗ gắn cứng mã môn học vẫn
đợi. Gói giao diện vẫn khoảng 1 MB.

---

### 27/07/2026 — Rà soát toàn diện: 9 lỗi thật ở hai engine chưa từng được soi

**Objective**: Đàm yêu cầu "rà soát mọi thứ, fix toàn bộ, nâng cấp trí tuệ". Hai engine
`productObservabilityService` (1205 dòng) và `curriculumIntelligenceEngine` (390 dòng) nằm
trong danh sách "chưa rà" của WORKSTATE, và cả hai đều có màn hình thật trong ứng dụng.

**Cách làm**: đo bằng script chạy trên engine thật trước, không đọc lướt rồi đoán. Chính việc
bấm giờ và in số đã lôi ra những lỗi mà đọc mã không thấy.

**Chín lỗi đã sửa**:

| # | Lỗi | Hậu quả đo được |
|---|---|---|
| 1 | Hai hàm gọi vòng nhau vô hạn | Màn hình Đài quan sát **luôn tràn ngăn xếp** khi mở |
| 2 | Khớp khái niệm bằng so chuỗi tuyệt đối | 0/292 câu khớp, báo 16/16 khái niệm "chết", độ phủ 0% |
| 3 | Đọc trường ma `solvedQuestionIds` | Mọi chương luôn báo "chưa từng luyện tập", độ thạo luôn 0% |
| 4 | Khoản nợ Bloom khẳng định số chưa đo | Đẩy ra cho mọi người học có hơn 30 câu, bất kể thực tế |
| 5 | `studyBalance` trả hằng số 45/35/20 | Hiển thị như phân bố của chính người học |
| 6 | Đếm ngược kỳ thi ghi cứng trong giao diện | Màn Chương trình hiện 12 ngày, màn Bàn học hiện 14 ngày |
| 7 | Hàm so sánh không phản đối xứng khi xếp nợ | Vi phạm bất biến 4.7, thứ tự tùy thuật toán sắp xếp |
| 8 | Chuẩn hóa chuỗi lặp 85 nghìn lần | Một lượt quét ngân hàng mất 4,0 giây |
| 9 | `new Date()` thay vì `TimeService` | Lệch đồng hồ chung, kết quả không tái lập |

**Số đo trước và sau**:

| Hạng mục | Trước | Sau |
|---|---|---|
| Mở màn hình Đài quan sát | tràn ngăn xếp | 84/100, hiện đủ, không lỗi console |
| Khái niệm bị coi là chết | 16/16 | 0/16 |
| Độ phủ khái niệm | 0% | 100% |
| Quét chất lượng cả ngân hàng | 4,0 giây | 1,56 giây |
| Gọi lại chỉ số sức khỏe | không chạy được | 41 ms, cùng kết quả |

**Cách cắt vòng đệ quy**: tách `getCoreHealthScores` ra khỏi `getSystemHealthOverview`. Cổng
"sức khỏe hệ thống" trong báo cáo phát hành chấm bằng phần lõi; tự chấm bằng chính kết quả của
mình vốn dĩ vô nghĩa, nên tách ra vừa đúng logic vừa hết vòng.

**Bẫy 2 cắn lần thứ ba trong ngày**, lần này giết `npm run dev`: `aiProvider` nhập
`supabaseClient`, mà file đó đọc thẳng `import.meta.env`, thứ `tsx` không có. Lần này **vá tận
gốc** bằng optional chaining ngay trong `supabaseClient.ts`, nên mọi nơi nhập về sau đều an
toàn, không phải nhớ đặt `define` ở từng công cụ nữa.

**Bộ kiểm**: thêm nhóm **I** với 8 phép kiểm, tổng lên 63. Nhóm này canh đúng chín lỗi trên,
trong đó phép kiểm "chỉ số sức khỏe tính được" sẽ đỏ ngay nếu ai đó dựng lại vòng đệ quy.

**Bài học chung, ghi vào AGENTS.md mục 4.9**: không hiển thị con số chưa đo. Thiếu dữ liệu thì
hiện 0 hoặc không hiện, tuyệt đối không điền số cho đẹp bảng. Và khi đọc một trường trên
`Statistics`, phải kiểm nó có thật trong `types.ts` không; `(stats as any).x` là dấu hiệu điển
hình của trường ma.

**Còn nợ**: ngưỡng cứng thuần túy ở hai engine vẫn còn (39 và 18 chỗ), nhưng đó là chuyện tinh
chỉnh chứ không còn là sai sự thật. Lần quét chất lượng đầu tiên vẫn mất 1,56 giây do bản chất
so từng cặp câu hỏi; muốn nhanh hơn nữa phải đổi thuật toán dò trùng.

---

### 27/07/2026 — Tôi làm chết 3 cổng AI trên bản thật, và chặng kiểm số 6 ra đời từ đó

**Chuyện gì đã xảy ra**: ngay sau khi push lượt "đưa tầng suy luận về trình duyệt", tôi dò lại
bản deploy và thấy `chat`, `recommend`, `complete` đều trả **500**. `npm run check` khi đó xanh
cả 5 chặng, `vercel build` báo đóng gói thành công. Tức là toàn bộ hệ thống kiểm chứng nói
"ổn" trong khi bản thật đang chết.

**Nguyên nhân**: chính là Bẫy 2 đã ghi trong AGENTS.md. Thay đổi của tôi khiến `aiProvider.ts`
nhập `supabaseClient`, mà file đó đọc `import.meta.env`, thứ chỉ Vite mới có.
`scripts/build-vercel.mjs` lúc ấy **không** có `define: { "import.meta.env": "{}" }` như
`scripts/check.mjs` vẫn có. Gói hàm nổ ngay lúc nạp với
`Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')`.

Cổng `generate` sống sót đơn giản vì nó không nhập `aiOrchestrator`. Đó là may, không phải giỏi.

**Đã sửa**: thêm dòng `define` vào `build-vercel.mjs`, đồng bộ với `check.mjs`.

**Thêm chặng 6 vào `npm run check`: nạp thật từng gói hàm trong Node.** Đây mới là phần đáng
giá của mục này. Bài học rút ra: *"đóng gói thành công" không hề đảm bảo gói ấy nạp được*, mà
cả 5 chặng cũ đều chỉ dừng ở mức đóng gói. Chặng 6 nạp đúng cách Vercel nạp.

**Đã chứng minh chặng 6 bắt được lỗi thật**: gỡ tạm dòng `define` ra rồi chạy lại, chặng 6 báo
đỏ đúng ba hàm `chat`, `complete`, `recommend` kèm nguyên văn nguyên nhân, rồi khôi phục.

**Cảnh báo cho người sau**: đừng gỡ dòng `define` trong `build-vercel.mjs`, và đừng gỡ chặng 6.
Cả hai sinh ra từ một sự cố có thật đã đẩy lỗi lên bản người dùng đang chạy.

---

### 27/07/2026 — Đưa tầng suy luận về trình duyệt để môn tự tạo cũng dùng được AI

**Objective**: Đàm xác nhận sẽ **tự bấm thêm môn ngay trong ứng dụng**, không muốn mỗi lần thêm
môn lại phải nhờ dựng file trong mã nguồn rồi deploy. Mà môn tự tạo lưu câu hỏi trong
localStorage, máy chủ không bao giờ thấy, nên gia sư AI không chạy được.

**Đã làm**: bỏ hẳn kiểu "giao diện gửi id, máy chủ tự tra câu hỏi".

- Thêm `functions-src/ai/complete.ts`, cổng chuyển tiếp thuần túy tới Gemini.
- **Xóa hẳn `functions-src/ai/explain.ts`**. Để lại là còn hai nguồn sự thật cho cùng một việc.
- `src/services/ai.ts` chạy `EvidenceBasedPipeline` ngay tại trình duyệt.
- `aiProvider.ts`: `Gemini36FlashProvider.execute` tự phân biệt môi trường.
- `chat.ts` nhận thẳng `subjectId` thay vì dò chữ trong tên môn, vốn nhận nhầm mọi môn mới
  thành Kinh tế chính trị.
- `.claude/launch.json` sửa từ `vite --port 5199` (không có `/api`) sang `npm run dev`.

**Chỗ tôi đã sai, ghi lại để người sau khỏi vấp**: kế hoạch ban đầu dựa trên giả định rằng
`executePipeline` gọi AI qua tham số `aiEngineExecutor`, nên chỉ cần truyền một hàm khác là
chạy được ở trình duyệt. **Giả định đó sai.** Tham số ấy được khai báo nhưng pipeline không hề
gọi, nó gọi thẳng `aiProviderRegistry` ở bước 9. Tôi chỉ phát hiện khi chạy thử thật trên trình
duyệt và nhận `ReferenceError: process is not defined`, vì tầng provider đọc biến môi trường
vốn chỉ có trên máy chủ. Bài học: **đừng tin tên tham số, hãy dò đường đi thật của lời gọi.**

**Nghiệm thu, đây là phần đáng giá nhất**: `npm run check` xanh **không chứng minh được gì** cho
hạng mục này. Bằng chứng thật là chạy trên trình duyệt: dựng một môn tự tạo, làm một câu, bấm
"Nhờ gia sư AI phân tích sâu", và nhận về bài giảng AI đầy đủ dẫn đúng tài liệu lẫn khái niệm
của chính môn đó, không còn chuỗi `(Chế độ ngoại tuyến)`. Đúng đường mà bản cũ hỏng 100%.

**Bộ kiểm**: nhóm H thay ba phép kiểm đọc mã `explain.ts` bằng bất biến tổng quát hơn, **không
hàm serverless nào được nhập dữ liệu môn học**. Đã cố tình thêm một dòng nhập vi phạm vào
`chat.ts` để xác nhận bộ kiểm bắt được và chỉ đúng tên file, rồi khôi phục. Thêm phép kiểm chạy
thật dựng môn tự tạo giả lập rồi bắt pipeline giải thích. Tổng vẫn 55 phép, đạt toàn bộ.

**Còn nợ**: gói giao diện phình từ 526 kB lên 943 kB (phần App) vì pipeline nay nằm trong trình
duyệt. Không sai kết quả, chỉ chậm tải lần đầu, và làm Nợ 3 nặng thêm.

---

### 27/07/2026 — Cổng giải thích AI tra nhầm ngân hàng câu hỏi, hỏng 100% mà không ai biết

**Phát hiện thế nào**: sau khi mở được đường xác thực, `npm run check:prod` cho thấy hai cổng
lạ mắt: `/api/ai/generate` trả 400 và `/api/ai/explain` trả 500. Đáng lẽ có thể bỏ qua vì
"không phải 401 là đã qua cửa xác thực rồi", nhưng dò tiếp thì lòi ra lỗi nặng hơn nhiều.

**Bản chất lỗi**: `functions-src/ai/explain.ts` tra câu hỏi trong `src/data/questions`, tức
ngân hàng của môn Kinh tế chính trị **đã đóng** (60 câu, id 1 đến 60). Trong khi đó
`EvidenceBasedPipeline` ở ngay bước sau lại đọc `questionMap` của môn **đang học** (292 câu,
id 2001 đến 3279). **Hai dải id không giao nhau một id nào.**

Đo trực tiếp trên bản chạy thật, gọi thật với token:

| questionId | Kết quả | Vì sao |
|---|---|---|
| 1, 5, 60 | HTTP 500 | Qua được cửa tra cứu của handler, rồi chết trong pipeline vì questionMap không có id đó |
| 61, 100, 2012 | HTTP 404 | Handler không tìm thấy trong ngân hàng môn đã đóng |

Nghĩa là **"Nhờ gia sư AI phân tích sâu" chưa từng chạy một lần nào** với môn đang học. Nó luôn
ném lỗi, `ai.ts` bắt lỗi rồi trả lời giải ngoại tuyến. Người dùng thấy có nội dung hiện ra nên
tưởng AI đang chạy. Lỗi 401 trước đây che mất chuyện này: mọi thứ chết ở cửa xác thực nên không
ai đi xa đủ để thấy tầng sau cũng hỏng.

**Đã sửa**: handler tra qua `questionMap`, lấy mã môn qua `dbService.getActiveSubjectId()` thay
cho mẹo đoán cũ `q.chapterId <= 6 && q.topicId.startsWith("T")`. Dùng `questionMap` còn đúng bất
biến 4.1: thứ hiển thị cho người học phải là bản đã trộn phương án.

**Kiểm chứng**: tái hiện lỗi trong Node trước khi sửa (pipeline ném đúng câu
`Question ID 1 not found`), và xác nhận pipeline chạy trọn vẹn với id 2001 của môn đang học.

**Thêm nhóm kiểm H, 5 phép, tổng bộ kiểm lên 55**. Nhóm này canh loại lỗi mà bộ kiểm cũ **về
nguyên tắc không thấy được**, vì nó nằm ở chỗ hai nguồn dữ liệu lệch nhau chứ không nằm trong
engine. Có phép kiểm đọc thẳng mã nguồn `explain.ts` để chặn việc ai đó nhập lại ngân hàng cố
định.

**Bài học ghi vào AGENTS.md mục 4.8**: cổng phía máy chủ mà nhập cứng dữ liệu một môn là hỏng
ngay khi đổi môn. Với định hướng đa môn thì đây không phải lỗi lẻ, mà là một khuôn lỗi sẽ lặp
lại ở mọi cổng mới.

**Nghiệm thu trên bản deploy sau khi push** (không suy đoán từ mã nguồn): câu id 2001 và 3279
trả HTTP 200 với `offlineMode: false`, lời giải dài 2769 và 3297 ký tự, không chứa dấu hiệu
ngoại tuyến. Câu id 999 và 2050 trả 404 đúng, vì hai id đó thật sự không có trong ngân hàng.
Nói cho chính xác: chức năng này **từng chạy được** ở thời kỳ môn Kinh tế chính trị còn mở, vì
khi đó ngân hàng mà handler tra và ngân hàng mà pipeline đọc tình cờ là một. Nó chết đúng lúc
đổi sang môn Hành vi khách hàng, và không ai thấy vì lỗi 401 che mất. Đây là lần đầu nó chạy
được với môn đang học.

Đã kiểm luôn `/api/ai/generate` bằng một đoạn tài liệu thật: HTTP 200, sinh đúng 2 câu hỏi, mỗi
câu đủ 4 phương án, có đáp án, có giải thích, gán đúng chương 1 theo yêu cầu.

**Còn nợ**: `/api/ai/generate` trả 400 khi thiếu trường `text` là hành vi ĐÚNG, đã kiểm lại mã
nguồn, không phải lỗi. Nhưng còn một giới hạn thật chưa xử lý: máy chủ luôn nạp môn dựng sẵn
`customer_behavior`, nên các môn do Đàm tự nhập sau này (dữ liệu chỉ nằm trong localStorage của
trình duyệt) sẽ **không giải thích AI được**. Muốn chạy đúng cho môn tự nhập thì giao diện phải
gửi kèm nội dung câu hỏi thay vì chỉ gửi id. Đây là việc lớn, chưa làm, cần Đàm quyết.

---

### 27/07/2026 — Vá đường xác thực cho 4 cổng AI bằng phiên ẩn danh

**Objective**: mở lại 4 cổng `/api/ai/*` trên bản chạy thật, thứ đã chết 401 từ lượt gỡ đăng
nhập. Đàm xếp việc này lên trước mọi khoản nợ engine, lý do: với định hướng đa môn thì sinh câu
hỏi từ tài liệu là đường nạp môn mới, không phải tính năng phụ.

**Đàm chọn hướng 1 trong ba hướng ở Bẫy 1** (phiên ẩn danh), sau khi được trình bày cả cái giá
của hai hướng còn lại. Hướng 2 (bỏ chặn) bị loại vì phơi quota Gemini cho bất kỳ ai biết địa
chỉ; hướng 3 (mã bí mật) bị loại vì vẫn phải vào dashboard mà bảo vệ yếu hơn.

**Đã làm**:

- `src/services/supabaseClient.ts`: thêm `ensureSession()`, chưa có phiên thì tự đăng nhập ẩn
  danh. Gom lời gọi đồng thời vào một lượt bằng `sessionInFlight`; không gom thì màn hình vừa
  mở đã bắn vài lời gọi AI song song và **mỗi lời gọi tạo một người dùng ẩn danh riêng**.
- `src/services/ai.ts`: `apiHeaders()` dùng `ensureSession()` thay `getSession()`. Đây chính là
  chỗ hỏng gốc: không còn màn đăng nhập thì `getSession()` luôn rỗng, nên mọi lời gọi đi ra mà
  không có token.
- `src/main.tsx`: dựng sẵn phiên lúc mở app, **cố ý không chờ** để không làm chậm lúc khởi động.
- `scripts/prodcheck.mjs`: nay kiểm **hai lượt**, không token và có token ẩn danh.

**Cái bẫy đã tránh, người sau đừng gỡ**: `main.tsx` chỉ chạy đồng bộ đám mây khi
`!session.user.is_anonymous`. Trước đây điều kiện chỉ là "có phiên", mà sau thay đổi này thì
gần như luôn có phiên. Để nguyên điều kiện cũ là tự động bật lại đồng bộ đám mây bằng một danh
tính vô danh, trái ý Đàm đã nêu ở Rủi ro 2, và mỗi lần trình duyệt bị xóa dữ liệu lại sinh ra
một tài khoản mới mang theo lịch sử học.

**Vì sao phải sửa cả prodcheck**: sau thay đổi này, 401 ở lượt không token là **đúng**, là hàng
rào đang sống. Script cũ chỉ kiểm lượt không token rồi kết luận "máy chủ đang bắt buộc đăng
nhập, cần xử lý", tức là từ nay nó sẽ báo động giả mãi mãi. Lượt hai gọi thật vào Gemini nên
tốn chút quota, đó là cái giá để biết chắc thay vì suy đoán từ mã nguồn.

**Kiểm chứng**: `npm run check` đạt cả 5 chặng. `npm run check:prod` chạy thật, và **đây là
phần quan trọng nhất của mục này**: lượt không token trả 401 đúng như mong đợi, còn lượt có
token **thất bại** với lý do Supabase trả về nguyên văn `Anonymous sign-ins are disabled`.

**Còn nợ, và nợ này AI không trả được**: Đàm phải tự vào Supabase, mục Authentication, phần
Sign In / Providers, bật **Anonymous sign-ins**. Chừng nào chưa bật thì bản chạy thật y như cũ,
không AI nhưng cũng không vỡ. Bật xong chạy `npm run check:prod`, đủ 4 cổng DAT ở lượt có token
là xong. Đừng tìm cách vá tiếp bằng mã nguồn, không có đường nào khác ngoài công tắc đó.

---

### 27/07/2026 — Bỏ chốt hỏi trước khi push, chuyển sang tự động deploy

**Đã làm**: gỡ `Bash(git push:*)` khỏi mục `ask` sang mục `allow` trong `.claude/settings.json`,
rồi sửa đồng bộ CLAUDE.md, AGENTS.md mục 9 và phần nếp làm việc ở đầu file này.

**Vì sao**: Đàm yêu cầu trực tiếp trong phiên 27/07/2026, nói rõ là khẩn cấp và muốn từ nay
luôn tự động push. Đây là quyết định của chủ dự án, thay quy tắc cũ do chính các phiên trước
đặt ra.

**Hệ quả trần trụi, người sau phải hiểu**: mỗi commit từ nay là một lần deploy thẳng lên
onthidaihocmo.vercel.app, không qua ai duyệt. Trước đây quy trình có hai lớp chặn là bộ tự
kiểm chứng và con người; nay chỉ còn một. Cho nên `npm run check` đổi vai: từ chỗ là lưới an
toàn, nó thành **hàng phòng thủ duy nhất**. Ai nới ngưỡng một phép kiểm cho nó xanh là đang
tháo nốt lớp cuối cùng.

**Điểm yếu chưa vá của cơ chế này**: bộ kiểm chạy hoàn toàn ở máy cục bộ, mà máy cục bộ không
đặt biến Supabase nên các cổng AI **luôn chạy được ở đây kể cả khi chúng chết trên máy chủ**
(đúng cơ chế của Bẫy 1). Vậy nên với thay đổi động tới xác thực, đăng nhập hay hàm serverless,
`npm run check` xanh **không chứng minh được gì cả**, bắt buộc chạy thêm `npm run check:prod`
sau khi push.

**Kiểm chứng**: `npm run check` đạt cả 5 chặng. Lần push trước đó (`638cf60`, tài liệu phạm vi
đa môn) đã đẩy lên `main` thành công.

**Còn nợ**: chưa có cơ chế tự động chạy `check:prod` sau mỗi lần push, vẫn phải nhớ bằng tay.
Đây là chỗ dễ quên nhất trong nếp làm việc mới.

---

### 27/07/2026 — Ghi nhận phạm vi dài hạn: đây là trung tâm luyện thi đa môn

**Đã làm**: chỉ sửa tài liệu, không đụng một dòng mã nào. Thêm phần "Phạm vi lâu dài" vào mục 3
của AGENTS.md và phần "Phạm vi dài hạn của dự án" vào WORKSTATE.md.

**Vì sao**: Đàm nói rõ trong phiên này rằng đây là **trung tâm luyện thi và học tập đa môn dùng
lâu dài**, sau này còn nạp thêm nhiều môn và nhiều tài liệu khác, không riêng hai môn hiện có.
Trước đó **không một file nào trong repo nói điều này**. Mọi tài liệu đều mô tả dự án như app
của một môn, nên AI đọc repo rất dễ kết luận sai rằng đây là công cụ dùng một lần cho một kỳ
thi rồi bỏ, rồi từ đó đề xuất những thứ tai hại kiểu gỡ bớt hạ tầng cho gọn.

**Số liệu đo được trong lúc rà** (ngày 27/07/2026, đếm trực tiếp trên mã nguồn): còn **26 chỗ
gắn cứng mã môn học** ngoài `src/data/`, chia ra `db.ts` 15, `kbService.ts` 6,
`evidencePipeline.ts` 2, `curriculumIntelligenceEngine.ts` 2, `evidenceCoverageAudit.ts` 1.
Cơ chế nhiều môn thì **đã có sẵn** (`activeSubjectId` cho phép thêm môn tự tạo), cái thiếu là
các nhánh `if` theo mã môn nằm rải rác. Hai môn còn chịu được, môn thứ ba thứ tư thì mỗi lần
thêm môn là một lần sửa mã ở 5 file.

**Nhận định đã ghi vào WORKSTATE, cần Đàm quyết chứ AI không tự quyết**: Rủi ro 1 (bốn cổng AI
trả 401 trên bản chạy thật) nặng hơn vẻ ngoài của nó. Chức năng sinh câu hỏi từ tài liệu chính
là đường nạp môn mới, mà nó đang báo lỗi thẳng. Với định hướng đa môn thì đây là thứ chặn
đường, đáng làm trước mấy khoản nợ engine đang xếp đầu danh sách "Next Major Step". Tôi **cố ý
không tự đảo thứ tự ưu tiên** trong WORKSTATE, chỉ ghi nhận lập luận.

**Kiểm chứng**: `npm run check` đạt cả 5 chặng. Vì không đụng mã nên đây chỉ là xác nhận không
làm hỏng gì, không phải bằng chứng cho nội dung tài liệu.

**Còn nợ**: nợ "gắn cứng mã môn học" chưa được ghi thành một khoản riêng trong mục Technical
Debt của WORKSTATE, mới chỉ nêu trong phần phạm vi. Chưa có phép tự kiểm chứng nào canh việc
thêm môn mới mà không phải sửa mã.

---

### 27/07/2026 — Nâng cấp bộ dự báo điểm thi

**Objective**: rà soát và nâng trí thông minh của `examForecaster.ts` (984 dòng), engine chưa
được đụng tới trong đợt tối ưu trước. Không thêm tính năng, giao diện, service hay engine nào.

**Problem** (đo trên engine thật, không suy đoán): bộ dự báo **hạ điểm người học một cách hệ
thống**, và mức hạ càng lớn khi người học càng giỏi.

| Tỷ lệ đúng thật | Dự báo cũ | Lệch |
|---|---|---|
| 20% | 1,4 | -0,6 |
| 60% | 4,5 | -1,5 |
| 80% | 6,0 | **-2,0** |
| 100% | 8,1 | -1,9 |

Ba khoản cắt chồng lên nhau trong công thức độ thạo ổn định:

1. **Trọng số chỉ cộng lại 0,80** (`mastery*0.50 + accuracy*0.30`), tạo khoản cắt 20% âm thầm.
2. **`consistencyFactor` luôn rơi về sàn 0,4**. Nó lọc câu hỏi bằng
   `q.concept === key || q.topicId === key`, nhưng `q.concept` là chuỗi tự do kiểu "Khái niệm
   hành vi khách hàng" còn `key` là "CB_C1_N1". Đo được **0 trên 277 giá trị khớp nhau**.
3. **`streakRetention` sàn 0,75**: người chưa có chuỗi ngày học nào bị cắt thẳng 25% năng lực,
   kể cả khi vừa làm đúng 95% số câu.

Kết quả: một người học **hoàn hảo** chỉ đạt **24/100** ở thành phần được đánh trọng số cao nhất.

Hai lỗi độc lập khác:

4. **Bảng tiên quyết là đồ trang trí**: `PREREQUISITE_MAP` viết cứng với khóa `GiaCanBang`,
   `PricingStrategy`, `ThiTruongDocQuyen`, tức khái niệm **kinh tế vi mô** còn sót từ môn khác.
   Đo được 0 khóa khớp. Cả tầng lan truyền phụ thuộc và vector `dependencyUncertainty` chưa
   từng chạy.
5. **Điểm dự báo tự tăng theo số lần mở màn hình**. Bộ lọc trơn trộn 35% giá trị mới với 65%
   giá trị đã lưu rồi **ghi đè giá trị đã lưu**. Trên một hồ sơ đứng yên, gọi 6 lần liên tiếp
   cho ra `3,8 → 5,1 → 6,0 → 6,6 → 7,0 → 7,2`. Con số phụ thuộc vào việc người dùng nhìn bao
   nhiêu lần, không phụ thuộc vào việc họ học được gì.

**Decision và Reason**:

- Trọng số đổi thành 0,65 và 0,35 để **cộng đúng bằng 1,0**.
- `consistencyFactor` **bỏ hẳn chứ không sửa**, vì việc cân theo lượng bằng chứng đã được làm
  đúng một lần tại nguồn trong `recomputeStatistics` (`w = 1 - e^(-n/6)`). Sửa nó thành ra co
  hai lần, đúng loại lỗi đã gặp ở `learningEngine` đợt trước.
- `streakRetention` giới hạn trong [0,95; 1,05]: chuỗi ngày học là tín hiệu thật nhưng yếu,
  được phép nhích nhẹ chứ không định đoạt kết quả.
- Bảng tiên quyết đọc thẳng `dependencies.requires` từ đồ thị tri thức, dùng dữ liệu đã có sẵn
  mà trước nay bỏ phí.
- Bộ lọc trơn **neo theo dấu vân tay dữ liệu**. Dữ liệu chưa đổi thì trả lại đúng giá trị cũ;
  chỉ khi người học làm thêm bài mới trộn một bước. Giữ nguyên tác dụng chống nhảy số.
- Khử trùng khóa độ thạo trước khi tính trung bình, vì bảng lưu mỗi khái niệm dưới hai khóa.

**Verification Result** (cùng kịch bản mô phỏng, OLD so với NEW):

| Tỷ lệ đúng | Lệch CŨ | Lệch MỚI |
|---|---|---|
| 20% | -0,6 | -0,3 |
| 40% | -1,2 | -0,6 |
| 60% | -1,5 | -0,7 |
| 80% | -2,0 | -0,7 |
| 100% | -1,9 | -0,5 |

Lệch trung bình giảm từ **1,44 xuống 0,56 điểm**, tức giảm 61%. Lệch không còn phình to theo
năng lực. Gọi 6 lần liên tiếp nay cho cùng một con số. Thêm 5 phép tự kiểm chứng, tổng 50/50.

**Backward Compatibility**: giữ nguyên chữ ký `calculatePrediction`, giữ nguyên kiểu
`ExamPrediction`. Khóa lưu trữ đổi từ chuỗi số sang JSON nhưng **có nhánh đọc định dạng cũ**,
không cần di trú dữ liệu.

**Architecture Impact**: `examForecaster` nay phụ thuộc thêm `kbService` (không tạo vòng lặp
import). Không đổi Product Flow, giao diện hay API.

**Technical Debt còn lại**: `productObservabilityService.ts` (39 ngưỡng cứng) và
`curriculumIntelligenceEngine.ts` (18) **chưa rà tới**. Trong `examForecaster` còn các phần ROI,
what-if, study debt chưa soi kỹ.

**Lessons Learned**: một giả thuyết của tôi sai giữa chừng. Tôi kết luận engine "tất định" sau
khi gọi ba lần liên tiếp thấy cùng kết quả, nhưng đó là vì đã đo tại điểm hội tụ. Chỉ khi đo
**sau một thay đổi trạng thái lớn** mới lộ ra hiện tượng trôi giá trị. Bài học: kiểm tính tái
lập phải đo ngay sau khi dữ liệu vừa đổi, không đo ở trạng thái đứng yên lâu ngày.

---

### 26/07/2026 — Khảo sát toàn dự án và lập WORKSTATE.md

**Mục tiêu**: khôi phục và ghi lại chính xác trạng thái dự án theo giao thức tiếp nối, để phiên
sau không phải dò lại từ đầu. Không sửa một dòng mã nguồn nào.

**Vấn đề**: dự án đã qua nhiều giai đoạn, tài liệu nhiều nhưng phần lớn lạc hậu, và không có
chỗ nào ghi "đang làm tới đâu". BANGIAO ghi lịch sử, AGENTS ghi quy tắc, nhưng thiếu ảnh chụp
trạng thái hiện tại.

**Quyết định**: tách vai trò ba file thay vì nhồi thêm vào file cũ. `WORKSTATE.md` giữ trạng
thái sống, `AGENTS.md` giữ quy tắc kỹ thuật, `BANGIAO.md` giữ lịch sử quyết định. Đã nối tham
chiếu chéo trong CLAUDE.md và AGENTS.md để AI sau không bỏ sót file mới.

**Đã khảo sát và ghi nhận** (không xử lý, đúng nguyên tắc không tự mở rộng phạm vi):

- **0 dấu vết TODO/FIXME/HACK/TEMP** trong toàn bộ mã nguồn, không có việc dở dang.
- **Khoảng 1.180 dòng mã chết**: 2 service mồ côi (`importPipeline`, `validation`), 3 component
  không được render (`AssessmentDesignDashboard`, `Dashboard2Widgets`, `DashboardClock`).
  Đã kiểm chứng bằng cách dò tham chiếu trên cả 100 file, không có nạp động.
- **8 engine trong `evidencePipeline.ts` (839 dòng) chưa bao giờ được đấu nối**, bên ngoài chỉ
  dùng đúng hai kiểu dữ liệu. Nhiều khả năng là một tầng kiến trúc dựng sẵn rồi bỏ dở.
- **Ngưỡng cứng còn dày** ở `examForecaster` (34) và `productObservabilityService` (39), cùng
  loại khiếm khuyết đã sửa ở các engine khác nhưng chưa rà tới.
- **Xác nhận không còn `Math.random` trong hàm so sánh** nào trên toàn dự án.

**Bài học phương pháp**: trong lúc khảo sát, phép tìm bằng shell cho ra kết quả sai hoàn toàn
do vấn đề dấu nháy trong zsh, suýt nữa ghi 46 service đều mồ côi vào tài liệu. Với những phép
đếm mà kết quả sẽ đi vào tài liệu, **hãy viết script Node đàng hoàng thay vì ghép lệnh shell**,
và luôn kiểm chứng ngược một vài trường hợp đã biết chắc trước khi tin con số.

**Kiểm chứng**: `npm run check` đạt toàn bộ 5 chặng.

---

### 26/07/2026 — `f58a0a2` — Tối ưu suy luận toàn bộ tầng engine

**Đã làm**: rà soát 46 service, tìm và sửa các khiếm khuyết thuật toán. Không thêm tính năng
nào, chỉ đổi công thức và cách suy luận.

**Phát hiện nặng nhất**: mô hình chấm thích ứng **chưa từng chạy thật một lần nào**. Đo được
0/292 câu hỏi tra ra được khái niệm, vì `learningEngine` đòi nhãn câu hỏi trùng tuyệt đối tên
khái niệm trong đồ thị, mà hai bên thuộc hai bộ từ vựng khác hẳn. Mọi câu đều rơi vào nhánh
dự phòng, nên độ thạo, đường cong quên, tiên quyết, Bloom đều được tính rồi vứt đi.

**Phát hiện nặng thứ hai**: bảng độ thành thạo có hai không gian khóa song song (mã khái niệm
và tên khái niệm) do hai nơi ghi khác nhau. Mỗi lần nộp bài, `recomputeStatistics` xóa sạch
rồi dựng lại theo khóa mã, thổi bay toàn bộ giá trị mô hình người học tích lũy. Thêm nữa,
khái niệm chưa làm câu nào bị chấm 0% (lẫn với học trượt) và mẫu số tính cả câu chưa gặp.

**Các sửa chính**:
- Hợp nhất 3 bộ tra cứu khái niệm thành 1 bộ có xếp hạng, kết quả 292/292 câu tra được.
- Độ thạo ghi đồng thời hai khóa qua `setConceptMasteryBothKeys`; chưa học là 50 chứ không
  phải 0; co theo bằng chứng `w = 1 - e^(-n/6)` và chỉ co đúng một lần tại nguồn.
- Bộ chấm ưu tiên: bỏ ngưỡng bậc thang sang hàm liên tục, gộp theo trung bình có trọng số
  thay vì cộng dồn theo số nhãn, cổng tiên quyết chỉ nhân một lần.
- Bỏ `Math.random` trong hàm so sánh của `sort` ở hai chỗ (vi phạm hợp đồng sắp xếp).
- Sửa chỉ số chuyển giao bị vô hiệu bởi `max(1, lowerAcc)` luôn bằng 1.
- Đo đà học bằng hồi quy thay vì hiệu hai đầu mút.
- Gộp công thức độ bền trí nhớ từng bị chép thành hai bản.
- Bỏ quan hệ tiên quyết bịa ra theo thứ tự duyệt Map trong `kbService`.

**Kiểm chứng**: thêm 17 phép tự kiểm chứng cho tầng suy luận, tổng 45/45 đạt. Chạy thật trên
trình duyệt, không lỗi console.

**Bài học cho người sau**: trong đợt này tôi kết luận sai hai lần, cả hai đều là **phép kiểm
sai chứ không phải mã nguồn sai**. Khi một phép kiểm báo đỏ, hãy nghi ngờ phép kiểm trước.
Đặc biệt cảnh giác với phép kiểm ĐẠT một cách rỗng: nếu dải biến thiên bằng 0 hoặc mọi giá
trị bằng nhau, nhiều khả năng nhánh đang đo không hề chạy.

**Còn nợ**: 4 cổng AI trên bản deploy vẫn trả 401 (xem "Bẫy 1" trong AGENTS.md). Đàm đã biết
và chọn chưa xử lý.

---

### 26/07/2026 — `e9b4300` — Bộ công cụ để AI khác vào sửa và tự kiểm chứng

**Đã làm**: dựng `npm run check` (5 chặng: rào bảo mật, kiểu dữ liệu, tự kiểm chứng, build
giao diện, build Vercel), `npm run check:prod` (kiểm bản đã deploy), và AGENTS.md.

**Vì sao**: Đàm thi xong, chuyển hướng sang việc để AI khác vào làm tiếp được mà không cần
hỏi. Tài liệu cũ trong repo viết cho môn Kinh tế chính trị đã đóng, số liệu sai hết, nên đã
gắn cảnh báo lạc hậu lên đầu 8 file.

**Điểm đáng giá**: bộ tự kiểm chứng nạp nguyên `db.ts` và `ai.ts` vào Node rồi sinh đề, chấm
điểm thật, không phải mô phỏng. Hai rào cản đã xử lý: `import.meta.env` thay bằng object rỗng
lúc đóng gói esbuild, còn localStorage thì `db.ts` tự giả lập sẵn.

**Đã chứng minh bộ kiểm bắt được lỗi thật** bằng cách cố tình phá một bất biến rồi khôi phục.

**Phát hiện kèm theo**: `npm run check:prod` cho thấy cả 4 cổng AI trên bản deploy trả 401.
Nguyên nhân: lượt trước gỡ đăng nhập ở giao diện nhưng serverless vẫn đòi token Supabase.
Máy cục bộ không đặt biến Supabase nên AI luôn chạy, che mất lỗi này.

---

### 26/07/2026 — `0f8d1a8` — Gỡ đăng nhập, đưa nút đề tổng hợp ra 2 chỗ, ôn random ưu tiên câu sai

**Đã làm**: gỡ màn đăng nhập ở frontend (app chạy chế độ dữ liệu cục bộ), đưa nút "Giải đề
ngẫu nhiên tổng hợp" ra Bàn học và Tổng quan, xếp đề ngẫu nhiên theo ưu tiên ôn tập.

**Hệ quả cần biết**: không còn đồng bộ đám mây, dữ liệu học nằm trong localStorage của đúng
một trình duyệt. Đàm đã chọn giữ cách sao lưu bấm tay trong Cài đặt, **đừng tự ý thêm đồng bộ
hay bật lại đăng nhập**.
