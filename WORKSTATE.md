# WORKSTATE.md, điểm kiểm tra sống của dự án

File này là **ảnh chụp trạng thái làm việc hiện tại**. Một AI mất sạch ngữ cảnh chỉ cần đọc file
này là tiếp tục được ngay, không phải dò lại từ đầu.

Đọc kèm: [AGENTS.md](AGENTS.md) cho bất biến kỹ thuật, [BANGIAO.md](BANGIAO.md) cho lịch sử
quyết định.

**Cập nhật lần cuối**: 30/08/2026, có **lịch ôn từng ngày tới ngày thi**, thứ Anki không làm được.

---

## Trạng thái tổng quát

| Mục | Giá trị |
|---|---|
| **Current Objective** | Đợt 8 giai đoạn ĐÃ XONG. Còn nợ: thuật sĩ nạp môn (chờ AI sống lại) |
| **Current Milestone** | Lịch ôn từng ngày, và khái niệm ôn hoài vẫn sai được chỉ sang cách học khác |
| **Current Phase** | Cả 8 giai đoạn XONG. Việc chặn đường: Supabase chết nên AI 401 |
| **Completed %** | 9 trên 9 khối việc |
| **Git** | `main` khớp `origin/main`, cây làm việc sạch |
| **Bộ kiểm** | **298/298 đạt**, đủ 6 chặng |

**Safe Resume Point**: bất kỳ lúc nào. Không có việc dở dang, không có nhánh phụ.

### HAI VIỆC CHỈ ĐÀM LÀM ĐƯỢC, không AI nào thay được

**1. Soát tay tối thiểu 20 câu ngẫu nhiên trong [rebalance-report.md](rebalance-report.md).**
133 câu vừa được AI viết lại ba phương án nhiễu và viết lại lời giải. Máy đã chặn được: lệch độ
dài, hai phương án trùng nhau, lời giải gọi nhầm nhãn phương án, và phương án nhiễu hoá thành
đúng (thẩm định ngược). Máy **không** chặn được: phương án nhiễu sai một cách vô lý tới mức loại
được ngay mà không cần học bài, hoặc lời giải đúng hình thức nhưng lệch nội dung giáo trình.
Rủi ro thật là nội dung sai, không phải định dạng sai.

**2. Bản deploy thật đang MẤT TOÀN BỘ tính năng AI.** Đo ngày 12/08/2026, ba bằng chứng độc lập:

- gói entry đã deploy `index-RvdNTB7h.js` không chứa địa chỉ supabase nào và **0 chuỗi JWT**, tức
  `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` **không được đặt lúc Vercel dựng bản**
- địa chỉ Supabase trong `.env` máy nhà **không phân giải được DNS** (ENOTFOUND), trong khi
  `supabase.co` phân giải bình thường, nên nhiều khả năng dự án Supabase đã bị xoá hoặc tạm dừng
- cả 4 cổng `/api/ai/*` trả 401 khi gọi không token

Hệ quả: `isSupabaseConfigured` false, `supabase` null, `ensureSession()` trả null, không có token,
**mọi tính năng AI âm thầm rơi về chế độ ngoại tuyến mà không báo gì cho người dùng**. Giao diện
vẫn chạy bình thường vì ứng dụng vốn cục bộ trước, nên nhìn màn hình không thấy gì bất thường.

Cần làm: dựng lại dự án Supabase, bật Anonymous sign-ins, đặt hai biến môi trường trong Vercel,
deploy lại. Đụng tài khoản và khoá bí mật nên AI không làm thay được.

**Lưu ý cho AI sau**: `npm run check:prod` KHÔNG tự kết luận được chuyện này, nó chỉ báo "chưa xác
minh được đường có token". Muốn biết chắc thì tải gói entry đã deploy về rồi tìm chuỗi
`https://<mã>.supabase.co` và chuỗi JWT `eyJ...` trong đó.

---

## Đợt đang chạy: kế hoạch 8 giai đoạn, Đàm duyệt ngày 12/08/2026

Kế hoạch đầy đủ nằm ở `~/.claude/plans/h-y-t-o-plan-chi-eager-moore.md`. Tóm tắt để AI sau khỏi
phải mở file ngoài repo:

| GĐ | Việc | Nhóm kiểm | Trạng thái |
|---|---|---|---|
| 0 | Dọn bàn, dựng thước đo ngân hàng | không | **XONG 12/08** |
| 1 | Khử thiên lệch độ dài ngân hàng câu hỏi | `AJ` (7) | **XONG 12/08** |
| 2 | Đường báo câu hỏi sai, cho `REJECTED` có hiệu lực | `AK` | **tiếp theo** |
| 3 | Hàng đợi ôn hôm nay, xếp theo lợi ích cho ngày thi | `AL` (9) | **XONG 13/08** |
| 4 | Bỏ số bịa ở tầng mục tiêu (ngày thi, điểm mục tiêu) | `AM` (5) | **XONG 13/08** |
| 5 | Ghi thời gian từng câu | `AN` | chưa |
| 6 | Chế độ nhớ lại chủ động, chạy song song trắc nghiệm | `AO` | chưa |
| 7 | Nạp môn mới trong một buổi tối | `AP` | chưa |
| 8 | Tách gói giao diện, dọn mã chết | `AQ` | chưa |

**Vì sao Giai đoạn 4 nên đẩy lên sớm**: bất biến 4.9i vừa thêm ngày 30/07 chấm ưu tiên ôn theo
**mức nhớ vào ngày thi**, trọng số 0,15. Yếu tố đó đọc `goal.examDate`, mà `getSubjectGoal` đang
**bịa ngày thi bằng hôm nay cộng 14 ngày** khi Đàm chưa đặt. Trước 30/07 đây chỉ là lỗi hiển thị;
từ 30/07 nó đã thành lỗi **điều khiển việc chọn câu**.

Bốn quyết định Đàm đã chốt, đừng tự đổi:

1. Làm cả 8 giai đoạn.
2. Sửa câu lệch bằng cách **AI viết lại 3 phương án nhiễu**, không rút gọn đáp án đúng.
3. Chế độ nhớ lại **chạy song song** trắc nghiệm, người học tự chọn.
4. **KHÔNG** cài lên điện thoại, **KHÔNG** đồng bộ đa thiết bị. Giữ nguyên quyết định cũ.

---

## Lượt mới nhất: thước đo ngân hàng câu hỏi, và cái bẫy sống sót qua 227 phép kiểm

Công cụ mới `scripts/bank-audit.mjs`, chạy `node scripts/bank-audit.mjs`. Không sửa gì, chỉ in
bảng số. Chạy nó trước và sau mọi lượt đụng vào dữ liệu câu hỏi.

### Mốc nền đo ngày 12/08/2026

| Ngân hàng | Số câu | Đáp án đúng DÀI NHẤT | Điểm nếu luôn chọn dài nhất | Vượt ngưỡng 0,10 |
|---|---|---|---|---|
| Hành vi khách hàng, biên soạn tay | 12 | **75,0%** | **7,5/10** | 6 |
| Hành vi khách hàng, AI sinh | 280 | **62,9%** | **6,3/10** | 134 |
| Kinh tế chính trị, môn đã đóng | 60 | 50,0% | 5,0/10 | ngoài phạm vi |
| **Môn đang mở, cộng lại** | **292** | **63,4%** | **6,3/10** | **140** |

Ngẫu nhiên là 25%. Chọn phương án dài nhất mà **không đọc câu hỏi** được **6,3 trên 10 điểm**.

**Vì sao lọt qua 227 phép kiểm**: `optionShuffle` trộn tất định để xoá thiên lệch **vị trí**, và
chú thích đầu file nói rõ mục đích ấy, nên người đọc mã tin rằng thiên lệch đã được lo xong.
Nhưng **trộn vị trí không đụng gì tới độ dài**. Lần thứ bảy bắt được khuôn *lách qua hệ thống mà
không có gì kêu lên*, và là lần đầu khuôn ấy nằm trong **dữ liệu** chứ không nằm trong mã.

### Ba kết luận cũ bị lượt đo này chứng minh là SAI

1. **`bloomLevel` rỗng 280/280 không phải lỗi.** `loadSubject` gọi `suyRaMucBloom` điền lúc nạp
   môn: 237/280 câu suy từ `learningObjective`, 43 câu lùi về độ khó, ra 6 bậc thật. Bảng chấm ưu
   tiên **không** thiếu tiêu chí nào. Đừng đi điền `bloomLevel` vào file dữ liệu.
2. **`estimatedTime` chỉ phẳng ở ngân hàng AI sinh** (35,0 giây cả ba mức). Hai ngân hàng biên
   soạn tay CÓ bám độ khó (30,0 / 41,7 / 50,0 và 30,8 / 38,8 / 45,4). Con số "34,7 / 35,3 / 35,2"
   ghi ở mục cũ bên dưới là trung bình trộn lẫn hai loại nên che mất sự thật này.
3. **Đồ thị tri thức có 16 nút, không phải 18.**

### Một chỗ kế hoạch tự mâu thuẫn, bắt được TRƯỚC khi viết mã

Ngưỡng "lệch quá 20% thì viết lại" nghe hợp lý nhưng chỉ đưa tỷ lệ dài nhất về 41,1%, trong khi
phép kiểm đi kèm đòi 20 tới 35%. Đã chốt ngưỡng **0,10**, viết lại **140 câu**, dự phóng còn
**27,4%**. Bài học: *một ngưỡng nghe hợp lý vẫn phải chiếu vào mục tiêu cuối trước khi tin nó.*

---

## Lượt mới nhất: lịch ôn bám NGÀY THI, chỗ sản phẩm này vượt được Anki

Đàm yêu cầu trí tuệ ngang hoặc hơn Anki. Đo trước, rồi mới sửa.

### Dự án đang ở đâu so với Anki

| | Anki SM-2 (mặc định tới 2023) | Anki FSRS (hiện nay) | Dự án này |
|---|---|---|---|
| Đường cong quên | không có, chỉ nhân hệ số dễ | luỹ thừa `(1+F·t/S)^D` | **hàm mũ `e^(-t/S)`** |
| Tự hiệu chuẩn từ dữ liệu người học | không | có, tối ưu 17+ tham số | **có**, `w = 1 - e^(-n/6)` |
| Biết ngày thi | **không** | **không** | có, nhưng **chưa dùng để xếp lịch** |

Phần hiệu chuẩn của dự án đã vượt SM-2. Khoảng cách thật nằm ở chỗ khác.

### Lỗ hổng: sáu yếu tố chấm ưu tiên đều chỉ nhìn HIỆN TẠI

Ba khái niệm **đều vừa học hôm nay**, kỳ thi còn 14 ngày:

| độ bền S | nhớ bây giờ | nhớ ngày thi |
|---|---|---|
| 27,3 ngày | 100% | 60% |
| 7,9 ngày | 100% | 17% |
| 1,5 ngày | 100% | **5%** |

Cả ba chấm **như nhau**, dù tới ngày thi lệch 55 điểm phần trăm. Khái niệm mong manh vừa học
xong trông hoàn toàn khoẻ mạnh, trong khi nó bay sạch trước khi dùng tới.

Đây đúng là chỗ Anki **không thể** làm: Anki xếp lịch cho trí nhớ vô thời hạn vì nó không biết
ngày thi. Người ôn thi chỉ cần nhớ cao nhất vào đúng một ngày.

### Đã làm

Thêm `mucNhoVaoNgayThi` (gọi lại đúng đường cong duy nhất, không viết công thức mới), cất `S`
lên hồ sơ, và thêm yếu tố thứ bảy vào bảng chấm với trọng số 0,15. Chưa có ngày thi thì trọng
số lùi về **đúng bộ cũ**, không đổi hành vi.

Kiểm chứng qua engine thật: cùng một hồ sơ, kỳ thi còn 60 ngày chấm **0,2943**, còn 1 ngày chấm
**0,1897**.

### Cái bẫy đã mắc, đáng nhớ nhất lượt này

**Bốn phép kiểm đầu đều xanh trong khi yếu tố mới không đổi được thứ hạng nào.** Chúng chỉ canh
phần toán và phần nối dây. Phải có phép kiểm đi qua `scoreQuestions` thật mới lộ.

Và phép kiểm đầu cuối bản đầu **cũng sai**: nó ghi thẳng `S` vào hồ sơ, nhưng `getOrCreateProfile`
gọi `recalculateForgettingScore` ở **mỗi lần đọc** nên giá trị bị tính đè ngay, cho ra hai điểm
bằng nhau tuyệt đối trông y như yếu tố mới bị vô hiệu. Cách cô lập đúng: giữ nguyên hồ sơ, chỉ
đổi ngày thi.

Bộ kiểm 222 lên **227**, nhóm mới **AI**, cả năm đã thử phá và đều bắt được.

### Còn lại để vượt Anki xa hơn

- **Đường cong luỹ thừa thay cho hàm mũ.** FSRS đổi vì hàm mũ tắt quá nhanh ở đuôi dài: cùng
  một mốc, hàm mũ nói còn 1,8% thì luỹ thừa nói còn 71,8%. Hệ quả thật: hệ thống tưởng người học
  đã quên thứ họ vẫn nhớ, rồi bắt ôn lại thừa. Đây là thay đổi lớn, chạm mọi thứ, nên cần một
  lượt riêng.
- **Bốn mức trả lời thay cho đúng/sai.** Anki có Again/Hard/Good/Easy. Dự án đã có sẵn **cờ nghi
  vấn**, ghép với đúng/sai là thành bốn mức mà không cần thu thập thêm dữ liệu.
- **Ngưỡng ôn lại 60% đang viết cứng** (`-ln(0.6)·S`). Anki mặc định 90%. Ở mức 60% thì khoảng
  40% số lần ôn là không nhớ ra, cao hơn hẳn mức Anki nhắm tới.

---

## Lượt trước: rà chế độ tối lần đầu, và một hồi quy do chính tôi gây ra

Lượt trước thêm `@custom-variant dark`, tức **mọi lớp `dark:` bắt đầu chạy lần đầu**. Chế độ tối
chưa từng được rà vì suốt hai mươi lượt mọi phép đo tương phản đều chạy ở chế độ sáng.

### Nút quan trọng nhất sản phẩm rớt chuẩn ở chế độ tối

| bậc | màu cũ | với chữ trắng | |
|---|---|---|---|
| cơ bản | `#3b7ae4` | **4,13:1** | RỚT |
| rê chuột | `#4d86e8` | **3,56:1** | RỚT |
| bấm | `#2f6ed6` | 4,86:1 | đạt |

Bộ cũ còn sai **hướng**: rê chuột SÁNG lên trong khi bấm tối đi, ngược bản sáng.

### Rồi bản sửa của tôi đẻ ra lỗi ngược chiều

Làm tối nút xong thì phép kiểm xanh, nhưng **đo lại trên trình duyệt** thấy 16 tên khái niệm ở
màn Hỏi AI rớt xuống 4,02:1. Gốc rễ: **một token gánh hai vai trò kéo ngược nhau**.

| | cần | `#3b7ae4` | `#2f6ed6` |
|---|---|---|---|
| nền nút, chữ trắng đè lên | ≥4,5 với trắng | **4,13 RỚT** | 4,86 đạt |
| màu chữ liên kết trên nền tối | ≥4,5 với nền | 4,74 đạt | **4,02 RỚT** |

Sửa đúng là **tách vai trò**: `nut-chinh` chỉ làm nền nút, 5 chỗ dùng làm màu chữ chuyển sang
`brand-info` (sáng 5,35:1, tối 7,69:1). `AH4b` canh không cho tái phạm.

### Hai lớp chết, lần thứ sáu cùng khuôn

`prose`/`dark:prose-invert` dùng 2 chỗ nhưng **plugin typography không hề được cài**. Bốn lớp
`zinc` ở thanh cuộn sót lại vì `AF3b` cố ý chỉ quét `src/components`.

### MỘT PHÉP ĐO CỦA TÔI SAI, suýt thành bốn phát hiện giả

Hàm đo tương phản bản đầu tô sẵn nền `#000` trước khi tô màu cần đo, nên **màu trong suốt bị đọc
thành đen đục**. Chế độ sáng hiện ra "20 chỗ rớt chuẩn" gồm cả thanh điều hướng ở 1,36:1. Sửa
lại thì **0 chỗ rớt**. Một phép đo nữa cũng hỏng: `window.innerWidth` trả 0 nên mọi màn báo tràn
ngang. Đã bỏ cả hai, không báo thành phát hiện.

**Bài học**: phép đo sai không cho ra "không có kết quả", nó cho ra **kết quả sai trông rất
giống thật**. Cả hai lần đều lộ nhờ một con số vô lý (nền `#000000` trên trang trắng, khung 0px).

Bộ kiểm 218 lên **222** (`AH4`, `AH4b`, `AH5`, `AH6`), cả bốn đã thử phá và bắt được.

---

## Lượt trước: số viết kiểu Việt, font thừa, và ĐÍNH CHÍNH nhãn ảnh tôi gắn sai

### Dấu thập phân, 46 chỗ

| | Trước | Sau |
|---|---|---|
| Số thập phân hiển thị | `toFixed(1)` ra **"5.0 điểm"** | `soThapPhan()` ra **"5,0 điểm"** |
| Số nguyên, ngày tháng | đã đúng từ trước qua `toLocaleString("vi-VN")` | giữ nguyên |

Chỗ hiểm: hai quy ước **sống chung trên cùng một màn hình** suốt hai mươi lượt, "1.234 ký tự"
đúng ngay cạnh "5.0 điểm" sai.

**Ranh giới suýt thay nhầm**: `parseFloat(x.toFixed(2))` là phép **LÀM TRÒN** chứ không phải
định dạng, có **8 chỗ** như vậy. Tìm thay hàng loạt sẽ âm thầm đổi giá trị tính toán mà biên
dịch vẫn xanh. `AH1` chỉ bắt `.toFixed(` **không** nằm trong `parseFloat(`/`Number(`.

### Font tải về mà không ai dùng

Đợt 28/07 thay 371 chỗ dùng font đơn cách bằng `tabular-nums` nhưng **chỉ đổi chỗ DÙNG**, dòng
`@import` vẫn tải JetBrains Mono mọi lần mở trang. Đo lại sau khi gỡ: còn đúng 1 yêu cầu font.
Lần thứ **năm** bắt được khuôn "lách qua hệ thống mà không có gì kêu lên".

### ĐÍNH CHÍNH: hai ảnh đang chạy thật đều không đạt

Lượt trước tôi gắn `approved` cho IL-02 và IL-03 **theo mức khớp ngữ nghĩa với vị trí trong mã,
chưa từng mở ảnh ra xem**. Lượt này đo:

| | IL-03 (màn Tổng quan) | IL-02 (bản đồ tri thức) |
|---|---|---|
| Đo được | **CAM 73%**, **0%** điểm ảnh đủ đậm làm nét | ~15 vật thể, ở cỡ thật mỗi vật **~12px** |
| Vấn đề | cam là màu **cảnh báo** của bộ token; 66% quá nhạt nên lóa trên nền tối | **không đọc được**; có chữ "A+" và một cái **cúp** ở trạng thái RỖNG |
| Đổi cỡ cứu được? | không, lỗi ngữ nghĩa màu | không, phải cao 256px mới đọc được, lúc đó lấn át chữ |

Cả 10 ảnh đều **3.000 tới 21.000 màu riêng biệt** (vector phẳng thật dưới ~50 màu).

**Chưa gỡ ảnh nào**, vì đó là quyết định của Đàm. Số đo đã ghi vào `manifest.json` mục `doDuoc`.

**Cần Đàm quyết**: giữ nguyên, hay tạo lại IL-02 với ảnh đơn giản hơn nhiều (3 tới 5 vật thể,
không cúp không chữ), hay gỡ hẳn.

Bộ kiểm 215 lên **218**, nhóm mới **AH**, cả ba đã thử phá và đều bắt được.

---

## Lượt trước: ghép 2 ảnh minh hoạ, và một lỗi chế độ tối có sẵn từ trước

Đàm giao bộ **10 ảnh GPT Image** kèm `manifest.json` phân loại sẵn: 2 ảnh `approved`, 7 ảnh
`needs-review` phải hỏi lại vì vị trí đề xuất đi ngược một quyết định đã đo trên Khan.

**Đã ghép**: IL-02 vào `ConceptMasteryMap` (môn chưa có tài liệu), IL-03 vào `Dashboard` (chưa có
lượt bài nào). Prop `illustration` của `EmptyState` đổi từ `React.ReactNode` sang **đường dẫn
ảnh**, ràng buộc đặt trong chính component: cao **128px**, `w-auto` giữ tỷ lệ, `loading="lazy"`,
`alt=""` kèm `aria-hidden` vì ảnh thuần trang trí.

### PHÁT HIỆN QUAN TRỌNG NHẤT, và không liên quan tới ảnh

**Biến thể `dark:` chưa từng chạy.** Tailwind v4 dịch `dark:x` thành
`@media (prefers-color-scheme: dark)`, tức bám **hệ điều hành**. Nhưng dự án bật chế độ tối bằng
`classList.add("dark")`, tức bằng **công tắc trong app**. Hai vế sai ngược chiều:

- bật công tắc tối, hệ điều hành sáng → nền tối nhưng **không lớp `dark:` nào chạy**
- hệ điều hành tối, app để sáng → **mọi lớp `dark:` chạy** trên giao diện sáng

Lỗi **có sẵn từ trước**: `dark:bg-zinc-800` ở thanh cuộn chưa từng chạy lần nào.

Lần thứ **tư** bắt được khuôn *lách qua hệ thống mà không có gì kêu lên*, và là lần khó thấy
nhất: **lớp không viết sai, CSS sinh ra hợp lệ**, chỉ gắn vào điều kiện không bao giờ khớp.

Sửa bằng một dòng: `@custom-variant dark (&:where(.dark, .dark *));`

Bộ kiểm 213 lên **215**: `AG10`, `AG11`. Cả hai đã thử phá và đều bắt.

**Ghi nhận, không sửa**: hai ảnh có nhiều vùng trong suốt trên/dưới nên phần vẽ thật chỉ khoảng
80px trong khung 128px. Sửa được bằng cắt biên ảnh nguồn, nhưng đó là sửa tài sản không phải sửa
mã, để Đàm quyết.

**Còn 7 ảnh `needs-review`, đã hỏi Đàm, chưa ghép ảnh nào trong số đó.**

---

## Lượt trước: ĐÍNH CHÍNH một dòng sai trong chính bản đánh giá

Bản đánh giá ở lượt 17 xếp "Loading State" mức **Lớn** với lý do "0 skeleton". **Sai.**

Tôi đo bằng `grep "skeleton|isLoading|loading"`, nên trượt hết những chỗ đặt tên khác:

| Chỗ chờ thật | Tên biến | Cách trình bày |
|---|---|---|
| `PracticeView` chờ gia sư AI | `aiLoading` | **skeleton ba thanh** |
| `ChapterQuestionGeneratorModal` | `isBusy` | **thanh tiến độ có %** |
| `PersonalWorkspaceView` nhập tài liệu | `isImporting` | thanh tiến độ có % |

Ứng dụng **đã có đủ ba loại trạng thái chờ, mỗi loại đúng chỗ**. Và "0 skeleton" còn không phải
điều đáng mong muốn: Khan cũng không dùng skeleton.

**Lần thứ hai trong đợt kết luận từ grep thay vì đọc.** Bài học bổ sung: *đếm bằng grep một
khái niệm mà không biết trước dự án đặt tên nó là gì thì con số thu được vô nghĩa.* Muốn đếm
khái niệm thì bắt đầu từ chỗ nó buộc phải xuất hiện, ở đây là mọi hàm có `await`.

Đã sửa hai dòng bảng trong cả hai file, vì AI sau đọc bản đánh giá ấy sẽ đi xây skeleton cho
những chỗ đã có sẵn.

---

## Lượt trước: thang cỡ biểu tượng, và một lỗi chỉ trình duyệt mới thấy

| | Trước | Sau |
|---|---|---|
| Số cỡ biểu tượng | **7** (8/10/12/14/16/20/24px) | **3** (16/20/24px) |
| Chỗ dùng dưới 16px | **29** | **0** |
| Biểu tượng bị bóp méo trên bản chạy thật | **1** | **0** |

**Bốn lỗi trong một khối 20 dòng ở `StatsView`**, đều nằm trong nhánh CÓ ĐIỀU KIỆN nên mọi lượt
quét bằng mắt trước đây không gặp: "BOOKMARKED" tiếng Anh viết hoa, "ĐÃ HIỂU"/"CẦN ÔN LẠI" viết
hoa toàn bộ, biểu tượng 10px, và `slice(0, 35)` cắt chữ giữa từ. **Nhánh có điều kiện là chỗ
trốn của lỗi giao diện.**

**Một lỗi CHỈ TRÌNH DUYỆT MỚI THẤY**: sau khi chuẩn hoá, đo lại ra 5 biểu tượng **13x16**, tức
méo. Mã nguồn không lộ gì, cả 5 đều khai `w-4 h-4` đúng chuẩn; nguyên nhân là nằm trong `flex`
mà thiếu `shrink-0`. Đã thêm `shrink-0` cho **225 biểu tượng**. Đo lại: 118 biểu tượng trên năm
màn, tất cả đúng 16x16, ở cả 1280px lẫn 375px.

Lần thứ ba một lỗi giao diện chỉ lộ khi mở trình duyệt. **Áp khuôn xong phải mở màn hình ra nhìn.**

Bộ kiểm 212 lên **213**, `AG9`.

---

## Lượt trước: iconography, 62 tiêu đề đeo biểu tượng trong khi Khan có 0

| Đo trên trang khoá học Khan | Giá trị |
|---|---|
| Tiêu đề `h1..h4` | **102** |
| Tiêu đề có biểu tượng | **0** |
| Thẻ SVG cả trang | 599, trong đó **596 đúng cỡ 24x24** |

Dự án: **62 tiêu đề đeo biểu tượng trên 16 file**, và `Sparkles` là biểu tượng mặc định cho
tiêu đề mục ở 24 chỗ. Khi MỌI tiêu đề đều đeo biểu tượng và phần lớn đeo CÙNG MỘT hình thì
biểu tượng thôi mang thông tin, chỉ còn lấy chỗ của chính chữ tiêu đề.

Đã gỡ 62 biểu tượng và 151 import lucide không còn ai dùng trên 23 file. Biểu tượng mang nghĩa
(trong nút, điều hướng, trạng thái có điều kiện) giữ nguyên.

Bộ kiểm 211 lên **212**, `AG8`.

**Sự cố khi thử phá, lặp lần thứ hai**: bản phá chèn `<Award />` mà `Award` vừa bị gỡ khỏi
import, nên **tsc đỏ và chặng tự kiểm chứng không bao giờ chạy**. Suýt kết luận phép kiểm rỗng.
**Thử phá phải tạo ra bản build biên dịch được** (bài học từ lượt 12).

---

## Lượt trước: hệ thống trạng thái rỗng, dựng lại EmptyState từ đầu

### Bản đánh giá khoảng cách còn lại, xếp theo tác động tới việc học

| Mảng | Đo được | Mức |
|---|---|---|
| **Component Composition** | **32 nhánh rỗng** trên 15 file, `EmptyState` gọi đúng **1 chỗ** | **Lớn nhất** |
| ~~Loading State~~ | ~~**0 skeleton**~~ **SỐ ĐO SAI, xem đính chính ở lượt 20** | ~~Lớn~~ Nhỏ |
| **Iconography** | **74 icon**; `AlertTriangle` 26 lần, `Sparkles` 24 lần | Lớn, CHƯA làm |
| Illustration | 2/30 file có SVG tự vẽ | Vừa, CHƯA làm |
| Motion | 208/290 `all 0s`, **ngang Khan** (297/~300) | Nhỏ, đã sạch |

Motion đo rồi kết luận **không cần đụng**. Ghi lại để lượt sau khỏi "thêm hoạt ảnh cho sinh động".

### Đã làm lượt này

`EmptyState` dựng lại tách **hai cấp**, và đó là mấu chốt để nó được dùng thật: bản cũ quá nặng
cho chỗ nhỏ nên người ta thôi dùng và tự viết `italic` tại chỗ.

- `EmptyState` cho cả màn: tiêu đề 20px/700 là **câu mệnh lệnh nói việc cần làm**, không khung.
- `DongTrong` cho một dòng trong bảng: một câu chữ thường.

Mười nhánh đã chuyển. Ba ca nói SAI đã sửa, nặng nhất là **nhánh `catch` của AIHub nói "Hệ
thống đang xử lý"** khi lời gọi đã thất bại, và `ConceptMasteryMap` hứa "AI đang phân tích tài
liệu" khi không có tiến trình nào chạy.

Bộ kiểm 210 lên **211**, `AG7`. Bản đầu của nó **tự báo đỏ chính nó** vì quét cả chú thích đang
trích lại câu cũ; đã sửa để bỏ chú thích trước khi quét.

---

## Lượt trước: màn Báo cáo, hai khuôn trình bày trên cùng một màn

**Phát hiện gốc**: màn này dùng HAI khuôn khác nhau cho cùng một loại nội dung. Ba thẻ viền màu
ở đầu màn, ba khối chữ ngăn vạch dọc cách đó vài trăm điểm ảnh. Lượt 8 dựng phần dưới nhưng
không chạm phần trên, nên hai khuôn cùng tồn tại suốt tám lượt vì mỗi lượt chỉ nhìn một khối.

| Hạng mục | Trước | Sau |
|---|---|---|
| Ba khối dẫn đầu màn | ba thẻ viền màu, đánh số "1. 2. 3." | ba khối chữ ngăn vạch dọc |
| Viền thẻ đầu | **xanh lá** quanh "Đã thạo **0** khái niệm" | không viền |
| Thời gian đã học | "tổng cộng **0 phút**" (thật ra 9 giây) | "chưa tới một phút" |
| Bảy chương | lưới thẻ, tên bị cắt | hàng, tên đầy đủ |
| Chip chương chưa làm | "Chưa làm câu nào" mang **màu ĐỎ** | bỏ chip, nói thành câu |
| Thanh chương 2 câu (50%) | tô **CAM** như kết quả kém | màu trung tính |

Hai lỗi màu cùng họ nhưng ngược chiều: một bên tô đỏ cho chương chưa bắt đầu, một bên tô cam
cho mẫu quá nhỏ. **Chữ nói một đằng màu nói một nẻo, và màu thắng vì mắt đọc màu trước.**

Ngưỡng bằng chứng dùng lại **hằng số 6** đã có sẵn của dự án, không bịa số mới.

Bộ kiểm 209 lên **210**, `AG6`, đã thử phá và bắt được.

**Không làm được**: định đo lại Khan lần nữa nhưng gặp bot-detection ("Client Challenge").
Không vượt qua, dùng bản đo đã lấy trước đó trong cùng phiên.

---

## Lượt trước: màn Kế hoạch, dự báo điểm cho người chưa trả lời câu nào

Ca nặng nhất của cả đợt. Màn này dựng nguyên một kế hoạch chi tiết, có con số tới một chữ số
thập phân, cho một người **chưa trả lời một câu**.

| Hiện trên màn với hồ sơ trắng | Vấn đề |
|---|---|
| "Dự báo kết quả **5.0 ± 0.5**" | chip viền xanh, chỗ NỔI NHẤT màn |
| "Độ tin cậy còn thấp" ngay dưới | màn hình **tự cãi chính nó** |
| "Mức sẵn sàng **59%**" | mâu thuẫn với "Nắm chắc kiến thức **0%**" ở màn Bàn học |
| "**+0.3 điểm**" x3 | hứa tăng điểm khi chưa có căn cứ |
| **7 chip ĐỎ "Cao"** | thật ra là 7 CHƯƠNG CHƯA HỌC, đều ghi "Lần sai: 0" |

Truy ra: **59% là `predictedScore / targetScore`**, tức tỷ lệ giữa hai ĐIỂM SỐ chứ không phải
mức nắm kiến thức. Lần thứ tư gặp khuôn "hai đại lượng khác nhau mang cùng một tên".

Cờ mới `chuaCoBaiLam` (`totalSolved === 0`), khác `chuaDuTinCay` có từ lượt 9 vốn quá rộng nên
lượt ấy sửa được cảnh báo mà không chạm tới chip đầu trang, thanh 59% và ba con số "+0.3 điểm".

Năm chuỗi giọng kỹ sư đã dịch trong `examForecaster`, chỉ đổi CHỮ không đụng ngưỡng.

Bộ kiểm 207 lên **209**. `AG4`, `AG5`, cả hai đã thử phá và đều bắt được.

**Một sự việc cần biết**: kho `localStorage` của `localhost:3000` trong phiên này từ 12 khóa
(`totalSolved: 7`) rút còn 3 khóa (`totalSolved: 0`). **Chưa truy được nguyên nhân.** Đây là
dữ liệu dev cục bộ, không phải bản chạy thật.

---

## Lượt trước: màn Bàn học nhìn bằng con mắt người CHƯA bắt đầu

**Mở ra một lượt rà hoàn toàn mới.** Mười ba lượt trước đều dùng hồ sơ đã có dữ liệu, nên chưa
lượt nào từng thấy nhánh trạng thái rỗng, mà đó lại là màn hình người học gặp ở giây đầu tiên.

**Công cụ để lại**: rà trạng thái rỗng bằng cách mở `http://127.0.0.1:3000` thay vì
`http://localhost:3000`. Khác origin nên `localStorage` tách biệt, hồ sơ thật vẫn nguyên.
**Đừng xóa `localStorage`.**

| Khu vực | Trước | Sau |
|---|---|---|
| Việc cần làm | **ba thẻ ngang hàng** | một việc chính 20px + ba hàng |
| Banner phiên dở dang | bo 16px, viền bốn cạnh, có bóng, tiêu đề **13px** | vạch trái 6px, bo 4px, không bóng, 16px/700 |
| Liên kết kiến thức | **lưới 5 thẻ**, ba tầng hộp lồng | danh sách định nghĩa `dl/dt/dd` |
| Tên tài liệu | vỡ **7 dòng** | **1 dòng** |

Bốn lỗi nội dung: nhãn "Ôn **15** câu" trong khi engine sinh **10** câu; dấu tích xanh gắn cứng
báo "đã xong" cho người vừa mở app; "Sổ câu sai đang sạch" khen thứ chưa xảy ra; và
`{session.examType}` in nguyên văn **"adaptive"** vào giữa câu tiếng Việt.

**Đo Khan xong rồi quyết định KHÔNG thêm celebration animation**: chỉ thị cho phép, nhưng bản
đo nói Khan có **đúng 1 phần tử** mang `animation` khi trả lời đúng, và đó là spinner. Khan
không ăn mừng ở mức câu hỏi. Thêm confetti là đi ngược sản phẩm thật.

Bộ kiểm 204 lên **207**, nhóm mới **AG**, cả ba đã thử phá và đều bắt được.

---

## Lượt trước: hai màn cuối, Công cụ hệ thống và hộp thoại Cài đặt

Hết danh sách màn. **Tám màn cùng hộp thoại Cài đặt đã rà xong.**

Màn Công cụ hệ thống: một cặp ngoặc rỗng "()" hiện ngay cạnh tiêu đề (vẽ `{courseCode}
({courseName})` mà môn đang mở không có cả hai trường); câu dẫn mô tả chính hệ thống thay vì nói
người dùng thấy gì; chín nhãn viết hoa giữa câu kiểu tiếng Anh.

Hộp thoại Cài đặt: bỏ viết hoa giữa câu, nâng tiêu đề hộp thoại 15px lên 20px, tiêu đề mục 13px
lên 16px, nhãn ô nhập 12px lên 15px.

**Một chỗ tôi sửa quá tay rồi tự hoàn nguyên.** Luật "cùng một đại lượng thì cùng một thang đo"
rút ra ở lượt trước, tôi áp tiếp cho điểm sức khỏe hệ thống (`91/100` sang `91%`). Soi lại thì
sai: ngay bên dưới là công thức kết thúc bằng "= 91/100", nên đổi đầu trang mà để công thức
nguyên là chính màn này tự mâu thuẫn. Mức sẵn sàng là đại lượng DÙNG CHUNG nhiều màn nên phải
cùng thang; điểm sức khỏe là chỉ số nội bộ chỉ có ở màn này và có công thức đi kèm. **Nhất quán
TRONG màn quan trọng hơn nhất quán với màn khác khi đại lượng vốn không dùng chung.**

Bài học: một khuôn rút ra từ vài ca đúng vẫn có thể sai ở ca thứ n. Áp khuôn xong phải mở màn
hình ra nhìn.

---

## Lượt trước: màn Chương trình, bản đồ chương dựng lại thành hàng

Màn thứ tám. Áp lại đúng ba khuôn đã ghi ở AGENTS.md 4.9f, không phải nghĩ mới.

| Hạng mục | Trước | Sau |
|---|---|---|
| Dòng dẫn dưới tiêu đề | "**Lớp** hoạch định chiến lược học tập toàn diện..." | câu nói việc người học cần làm |
| Bốn thẻ số liệu | mỗi số một thẻ có nền và viền | một dòng chữ ngăn bằng vạch dọc |
| Thang mức sẵn sàng | **21/100** | **21%** |
| Bản đồ chương | lưới thẻ, mã "CH1" tô nền làm neo, tên chương bị `line-clamp-1` cắt cụt | hàng, tên đầy đủ |

"Lớp hoạch định" là chữ của kiến trúc phần mềm, và cả câu mô tả BẢN THÂN MÀN HÌNH. Mã "CH1" là
thứ nổi nhất trong mỗi thẻ trong khi TÊN chương mới là thứ cần đọc mà lại bị cắt cụt. Mức sẵn
sàng dùng thang trên 100 ở màn này nhưng là phần trăm ở mọi màn khác.

---

## Lượt trước: màn Tổng quan, và hai chỗ tôi kết luận SAI ở lượt trước

**Đính chính**: lượt 8 tôi ghi rằng bốn chuỗi `Trọng tài hệ thống (Arbitration Utility: 0.42)`
nằm trong mã chết. **Cả hai vế đều sai**: `Dashboard.tsx` chính là màn Tổng quan, được App.tsx
nhập ở dòng 12 (tôi grep `from "./Dashboard"` trong khi đường dẫn thật là
`from "./components/Dashboard"`); và chuỗi ấy CÓ hiện ra màn hình, do `HomeHero.tsx` render chứ
không phải `Dashboard.tsx`. Bài học: **grep không thấy không có nghĩa là không có.**

Ba lỗi thật trên màn Tổng quan:

1. **Lý do gợi ý viết bằng tiếng Anh nội bộ kèm số gỡ lỗi**: `Trọng tài hệ thống (Arbitration
   Utility: 0.88): ... độ bao phủ syllabus.` Đã viết lại cả bốn lý do bằng tiếng Việt.
2. **Hai con số đếm ngược khác nhau trên cùng màn**: 14 ngày so với 12 ngày, do
   `const daysLeft = 12` viết cứng. Nay suy từ ngày thi đã đặt; chưa đặt thì hiện "Chưa đặt
   ngày thi" chứ không bịa.
3. **Phần trăm hoàn thành tính trên ngân hàng của MÔN KHÁC**: mẫu số **60** là số câu môn đã
   đóng, môn đang mở có **292**. Sai gấp gần năm lần, và sẽ tiếp tục sai với mọi môn nạp sau.
   Loại này nguy hiểm hơn hằng số viết tay: nó im lặng đúng cho đúng một môn.

Hai phép kiểm mới AE10, AE11. Bộ kiểm 202 lên **204**.

---

## Lượt trước: bốn tab còn lại của màn Hỏi AI, và một lỗ hổng của chính bộ kiểm

Làm cạn màn Hỏi AI trước khi rời. Tab **Trí nhớ** lộ ra ca nặng nhất của cả đợt: tiêu đề mục là
**"Long-Term Student Evolution & Memory Engine"**, tức tên nội bộ của một engine in nguyên văn ở
20px đậm 700. Kèm "Bản sao số", ô "Khái niệm **Stable**", đơn vị đếm **"Milestones"**, và mỗi
mục lịch sử đeo huy hiệu **"STUDIED"** in hoa. Đã dịch hết sang tiếng Việt.

**PHÁT HIỆN QUAN TRỌNG NHẤT: bộ kiểm đang có một lỗ hổng cả họ.** Nhóm AF đối chiếu mọi lớp
`*-brand-*` với token, nên bắt được tên màu KHÔNG CÓ định nghĩa. Nhưng nó mù với chỗ **không
thèm dùng tên màu của dự án**: viết thẳng `text-emerald-600`, `bg-red-500/10` thì Tailwind sinh
lớp bình thường và mọi phép kiểm đều xanh. Đếm được **72 chỗ** trên 5 file.

Hai hậu quả thật: chế độ tối mất bảo đảm (các sắc độ nguyên bản không có bản cho nền tối), và
ngưỡng tương phản 4,5:1 không ai đo. Đã đổi hết 72 chỗ sang token, thêm phép kiểm **AF3b** quét
cả 22 họ màu của Tailwind. Bộ kiểm 201 lên **202**.

Lần thứ ba trong hai ngày bắt được cùng một khuôn: `brand-danger` chưa từng định nghĩa,
`animate-fade-in-up` chưa từng có token, nay là màu đi vòng qua bộ token. **Điểm chung: lách qua
hệ thống mà không có gì kêu lên.**

---

## Lượt trước: màn Hỏi AI, danh sách khái niệm dựng lại thành HÀNG thay vì THẺ

Màn thứ sáu. Đo lại trực tiếp **trang khoá học** của Khan trước khi sửa.

| Thành phần | Khan | Bản cũ của ta |
|---|---|---|
| Mỗi kỹ năng | một HÀNG cao 24px, chữ 14px/400 màu liên kết, **nền trong suốt, viền 0, bo góc 0** | thẻ nền xám có viền, bên trong còn một cái nút có viền riêng |
| Tiêu đề nhóm bài | 24px đậm 700 | 13px, nhẹ hơn cả thẻ bên dưới nó |
| Định nghĩa | không hiện | bị `line-clamp` cắt GIỮA TỪ ("...sản phẩm, dịch...") |

Bốn tầng khung cho một danh sách khái niệm. Nay: cả hàng là chỗ bấm (chức năng giữ nguyên), bỏ
cắt chữ, tên khái niệm đứng trước con số, tên chương lên 20px đậm.

**Tiêu đề đôi, lần thứ BA trong đợt.** Vì lặp tới ba lần nên đã ghi hẳn thành bất biến
**AGENTS.md 4.9f**: bốn khuôn trình bày rút ra từ cả đợt, kèm quy tắc không cắt chữ giữa từ.

---

## Lượt trước: màn Kế hoạch, màn hình đang tự mâu thuẫn với chính nó

Màn thứ năm. Vấn đề nặng nhất không phải cách bày mà là **màn hình nói cùng lúc hai điều ngược
nhau**, với hồ sơ mới trả lời 7 trên 292 câu:

| Dòng hiện trên màn | Ý nghĩa |
|---|---|
| "Độ tin cậy: **Cần thêm dữ liệu**" | hệ thống tự nhận là **chưa biết** |
| "Nguy cơ trượt mục tiêu, mức Trung bình" | rồi phát cảnh báo |
| "Còn thiếu: **-5.5**" tô cam đậm | dựa trên chính con số vừa nhận là chưa đủ căn cứ |
| "cần được **bù đắp khẩn cấp**" | kèm hai tam giác cảnh báo |

Đúng điều luật Đàm đặt ra: không đóng khung con số chưa chắc chắn bằng màu sắc mang tính khẳng
định. Đã sửa: mức độ nhấn bám theo độ tin cậy, bỏ dấu trừ, bỏ tam giác cảnh báo, bỏ tiêu đề đôi.
Hai chuỗi mẫu trong service đổi CHỮ (bỏ "khẩn cấp", bỏ "triệt phá"), giữ nguyên ngưỡng và phép
tính.

**Tìm ra nhưng KHÔNG sửa**: `homeHeroDecision.ts` có bốn chuỗi `Trọng tài hệ thống (Arbitration
Utility: 0.42): ...`, tiếng Anh nội bộ kèm số gỡ lỗi. Nhưng nó chảy vào `Dashboard.tsx` vốn
**không được import ở đâu cả**, tức mã chết thuộc Nợ 1, không lộ ra màn hình nào.

---

## Lượt trước: màn Báo cáo, ba con số 48px thành ba câu

Màn thứ tư của đợt.

| Hạng mục | Trước | Sau |
|---|---|---|
| Ba khối dẫn dắt | ba con số **48px chữ mảnh**, mỗi số một thẻ có viền | ba câu 20px, con số nằm trong câu |
| Độ phủ ngân hàng | **hai con số khác nhau cùng gọi là "độ phủ"** (20/292 tức 7%, và 7/292 tức 2%) | nhãn phân biệt rõ "đã chạm" với "đã trả lời" |
| Câu động viên viết sẵn | có, hiện y hệt cho mọi người học | bỏ |
| Đoạn giới thiệu tính năng | có ("Nền tảng ghi nhận thời gian...") | bỏ, màn báo cáo nói về NGƯỜI HỌC chứ không nói về chính nó |
| Tiêu đề | nửa sau tô xanh dương, viết hoa giữa câu | một màu, viết như câu tiếng Việt |

Mâu thuẫn độ phủ là khoản nợ đã ghi trong file này từ 28/07/2026, nay xong. Không đụng phép
tính nào: một bên đếm câu đã gặp, một bên đếm câu đã trả lời, chỉ có nhãn là sai.

**Còn nợ**: dòng "Đã chạm 20/292 câu, tức 7% độ phủ" ở khối trên vẫn dùng chữ "độ phủ" cho
nghĩa "đã gặp". Không còn mâu thuẫn nhưng viết rõ hơn được.

---

## Lượt trước: màn Câu sai, thang tiến độ đang tô ĐỎ đúng chặng vừa gỡ được

Màn thứ ba của đợt. Bốn lỗi, hai trong số đó không phải chuyện thẩm mỹ:

1. **Bốn chữ tiếng Anh lọt ra giao diện**: bốn chặng in nguyên văn "Weak", "Learning",
   "Recovered", "Mastered". Đợt dọn chuỗi tiếng Anh trước không quét tới màn này.
2. **Màu nói ngược**: chặng đã qua tô xanh lá, chặng đang đứng tô ĐỎ. Nên một câu đã gỡ được
   hiện ra "Weak" xanh, "Learning" xanh, "Recovered" ĐỎ. Hai chặng yếu nhất được tô thành công,
   chặng vừa gỡ được thì tô thành màu báo lỗi. Nay: chặng đạt tới thì tô, chặng chưa tới để
   trống, không màu báo lỗi trong lộ trình học. Nhãn: Còn yếu, Đang ôn, Đã gỡ, Nắm chắc.
3. **Chip chương in trùng tiền tố**: "Chương 1: Chương 1: Khái quát về hành vi khách hàng".
4. **Đầu màn ba dòng nói cùng một việc**, nút chính màu cam. Nay một tiêu đề, một câu, nút xanh.

**Hình minh hoạ đầu tiên của dự án**: trạng thái rỗng nay có một hình khối phẳng tự vẽ (cuốn sổ
mở với dòng kẻ trống), đúng bản đặc tả phong cách đã chốt, không mascot không hoạt hình.

Ba phép kiểm mới, bộ kiểm 198 lên **201**.

---

## Lượt trước: màn Bàn học, bốn ô số liệu thành một dòng chữ

Màn thứ hai của đợt, sau bốn lượt trên màn Luyện câu. **Lần đầu áp nguyên tắc đã ghi trong
NGONNGUTHIETKE.md mà chưa từng dùng ở đâu**: nội dung là chủ thể, số liệu là chú thích của nội
dung.

| | Khan | Trước | Sau |
|---|---|---|---|
| Cách trình bày tiến độ | một CÂU 14px đậm 400 | **bốn thẻ**, mỗi thẻ một nền, một viền, một bo góc | một dòng chữ, số tô đậm |
| Chiều cao khối ở 375px | | khoảng 240px | **124px** |
| Ngăn cách các mẩu | | viền hộp | vạch trái mảnh, chỉ bật từ mốc `sm` |

Giữ đủ bốn mẩu tin và liên kết "Sửa ngay". Bỏ màu cam trên số ngày còn lại: trên Khan màu không
mang trạng thái trong chữ nội dung, và một vệt cam thường trực thì sau một ngày là mắt thôi thấy.

**Còn nợ**: `toFixed(1)` cho dấu chấm thập phân kiểu tiếng Anh ("3.0" thay vì "3,0"), rải rác
nhiều chỗ nên phải làm một lượt riêng.

---

## Lượt trước: trạng thái ĐÃ TRẢ LỜI của màn Luyện câu

Dựng lại theo bản đo trực tiếp trên một bài tập thật của Khan Academy, cố ý chọn sai trước rồi
chọn lại cho đúng để xem cả hai trạng thái. Chi tiết đầy đủ trong [BANGIAO.md](BANGIAO.md),
mục 29/07/2026.

| Hạng mục | Trước | Sau |
|---|---|---|
| Lời giải nghĩa | một bảng riêng, **hộp trong hộp trong hộp** | nằm ngay dưới phương án đúng, thẳng cột với nhãn |
| Bảng trả lời sai | **chép lại nguyên văn đáp án đúng lần thứ hai** | không lặp, đáp án đúng đã được khoanh ở trên |
| Ô chữ cái | vuông 24x24 bo 4px, tức tín hiệu "chọn nhiều đáp án" | **tròn 32x32**, đúng quy ước chọn một |
| Dấu tích của đáp án đúng | rời ra ở mép phải hàng | nằm trong ô chữ cái, **đi kèm chữ cái** |
| Nền hàng đáp án | tô màu ngữ nghĩa | **trong suốt**, tín hiệu chuyển sang vòng khoanh và màu chữ |
| Tương phản chữ đáp án đúng | 3,15:1 khi tô trên nền cùng tông | **5,21:1** trên nền trong suốt |
| Tương phản chữ đáp án sai | 4,41:1 | **6,47:1** |
| Số vòng khoanh trên màn | 2 (cả phương án chọn sai) | **1**, luôn ở đáp án đúng |
| Lớp hoạt ảnh chết | `animate-fade-in-up` 7 chỗ, `animate-fade-in` 3 chỗ, **không lớp nào chạy** | 0, đã có token |
| Màu câu trước tan lên câu mới | có, khi chuyển câu | không, `key` theo mã câu buộc dựng lại hàng |
| Số phép kiểm | 195 | **197** |

**Một bất biến đã được sửa lại, đọc trước khi đụng vào màu hàng đáp án**: AGENTS.md 4.9d trước
đây ghi "nội dung phương án không tô theo màu ngữ nghĩa". Câu đó cấm nhầm thứ. Thủ phạm của con
số 3,15:1 là **cặp nền tô cộng chữ tô cùng tông**, không phải màu chữ. Bỏ nền đi là cả hai màu
đều vượt chuẩn AA. Quy ước đúng: nền trong suốt thì được tô chữ.

Lượt 2 cùng ngày: **phía trên câu hỏi nay không còn gì cả**. Cụm ba mẩu siêu dữ liệu (chủ đề,
khái niệm đang kiểm tra, yêu cầu trước) chuyển xuống khối **"Nội dung liên quan"** dưới bốn
phương án, đúng chỗ Khan đặt phần ấy. Không mẩu nào mất đi, chỉ đổi thời điểm xuất hiện sang
lúc dùng được: biết trước "câu này kiểm tra khái niệm X" là gợi ý không ai xin, còn biết sau
khi chốt đáp án thì đó là câu trả lời cho "giờ đi ôn lại phần nào".

Lượt 3 cùng ngày: đầu phiên gộp về **một hàng ở mọi khổ** kèm đường kẻ chân như Khan. Ở 375px,
chrome trước khi tới câu hỏi từ **179px xuống 130px** (Khan: 73px). Thủ phạm là
`flex-col sm:flex-row`: dưới 640px thì đồng hồ đếm ngược rơi hẳn xuống một hàng riêng, đúng ở
khổ nhỏ nhất nơi mỗi điểm ảnh dọc đắt nhất. Phần còn chênh so với Khan là ba chức năng thật mà
trang của họ không có: nút quay lại, phụ đề phiên, đồng hồ.

Lượt 4 cùng ngày: thẻ tổng kết sau khi nộp đổi thành **một câu**, và lộ ra **ba trong bốn ô là
số bịa**.

| Ô cũ | Công thức cũ | Vấn đề |
|---|---|---|
| Kết quả bài thi | `correctCount / tổng` | thật, giữ lại |
| Khái niệm đã thông thạo | `Math.max(1, Math.floor(correctCount / 3))` | **đúng 0 câu vẫn khoe "+1 khái niệm"** |
| Hiểu sai đã sửa | chuỗi `"1 hiểu sai"` viết cứng | sai 1 câu hay 9 câu đều như nhau |
| Độ ghi nhớ dự đoán | `71% → 71 + tỷ_lệ_đúng*18` | mốc 71 viết cứng |

Đúng họ lỗi mà bất biến 4.9 sinh ra để chặn, nhưng **ba lượt quét trước đều dừng ở tầng service**
nên không lượt nào chạm tới tầng trình bày. Không sửa công thức (tính đúng ba đại lượng ấy là
việc của engine, lượt này bị cấm đụng) mà **thôi khẳng định thứ mình không biết**. Không đường
dữ liệu nào bị cắt vì chưa engine nào từng tính chúng. Nhóm kiểm mới **AE7** canh cả ba.

Muốn có ba con số ấy thật thì phải xây ở **tầng engine** trước, xem Open Question mới ở cuối.

---

## Đợt trước: tái thiết kế giao diện theo Khan Academy

Yêu cầu của Đàm: chỉ được đụng UX/UI, Design System, Component System, Presentation Layer.
Không thêm tính năng, không đổi luồng sản phẩm, không đổi kiến trúc thông tin, không đụng
engine hay thuật toán. Bắt buộc dùng Claude Browser quan sát ứng dụng thật. Kèm luật: thay đổi
nào chỉ làm đẹp mà không giúp đọc nhanh hơn, hiểu hơn, nhớ hơn, học lâu hơn, giảm tải nhận
thức hoặc tăng độ rõ thị giác thì không triển khai.

Đã đo trực tiếp `vi.khanacademy.org` bằng trình duyệt (trang chủ, trang khoá học, trang làm bài
có nộp và xem cả trạng thái đúng lẫn sai) rồi rút token thật, thay vì đọc tài liệu về nó.
Chi tiết đầy đủ nằm trong [BANGIAO.md](BANGIAO.md), năm mục ngày 28/07/2026.

| Hạng mục | Trước | Sau |
|---|---|---|
| Phần tử làm mờ dần **màu chữ** khi phản hồi đúng sai | 94 trên 309, tức 30% cả trang | **35**, chỉ phần tử bấm được |
| Số mức đổ bóng | **9** | **2** |
| Giãn chữ nhãn viết hoa 10px | **âm 0,176px** | không còn nhãn viết hoa nào |
| Trang tràn ngang ở bề rộng 864px | **có**, 928px so với 864px | **không**, ở mọi bề rộng |
| Chỗ dùng cỡ chữ dưới 12px | **406** | **0** |
| Chỗ dùng font đơn cách | **371** | **0**, thay bằng `tabular-nums` |
| Chỗ dùng chữ viết hoa | **154** | **0**, trừ tên thương hiệu |
| Tương phản phương án không chọn sau khi lộ đáp án | **1,85:1**, rớt AA | **5,27:1**, đạt AA |
| Bốn phương án là bốn thẻ đóng lúc đang suy nghĩ | có | danh sách chữ ngăn bằng đường kẻ |
| Chỗ dựng nền bằng độ mờ (tương phản không đoán trước được) | **134** | **5**, chỉ còn biểu đồ nhiệt |
| Chỗ rớt tương phản trên 10 màn | **15** | **0** |
| Chuỗi tiếng Anh lọt ra giao diện | nhiều, gồm 2 tiêu đề màn cỡ 30px | **0** |
| Số màn đã rà | 6 | **10** |

**Đã cố ý KHÔNG làm**, để người sau khỏi làm lại. Cả ba đều thuần thẩm mỹ, đúng loại mà luật
Đàm đặt ra bắt phải loại. Lý do chi tiết trong BANGIAO.md:

1. Hạ `--text-primary` từ `#111111` (18,88:1) xuống cho dịu mắt.
2. Đổi thang bo góc từ sáu mốc về ba mốc.
3. Chuẩn hoá thang khoảng cách. Đo được **57 trên 112 giá trị đệm nằm ngoài** thang
   4/8/12/16/24/32/48 của Khan, tức 51%, nghe như lỗi lớn. Nhưng các giá trị lệch là 2, 6, 10,
   14, 20, đúng các nấc `.5` của Tailwind, tức một thang 2px mạch lạc chứ không phải số ngẫu
   nhiên. Chênh 20 so với 24 mắt không phân biệt được.

**Còn nợ của đợt này**:

- Thẻ câu hỏi ở màn luyện câu còn **139px chrome nằm phía trên câu hỏi**, gồm 11 phần tử trong
  đó 3 bấm được (chip số câu, chip mức khó, mã ID, công tắc gia sư, nhãn gia sư, nút đánh dấu,
  nút báo lỗi, dòng chủ đề, dòng khái niệm). Khan Academy không có gì phía trên câu hỏi. Đã đo
  nhưng **chưa sửa**: phần lớn các phần tử này là tính năng thật, mà Đàm cấm gỡ tính năng, nên
  việc còn lại là giảm sức nặng thị giác chứ không phải bỏ bớt. Cần bàn với Đàm trước.
- `--font-mono` và JetBrains Mono vẫn còn trong `index.css` dù không còn chỗ nào dùng. Gỡ khỏi
  dòng `@import` sẽ tiết kiệm một lượt tải font.
- Chưa rà màn **Cài đặt và sao lưu** (là hộp thoại, không vào được bằng cách quét màn thường).

**Công cụ để lại cho người sau**: cách đo màu đúng trong dự án này là **vẽ chuỗi màu lên canvas
1x1 rồi đọc ngược điểm ảnh**, vì Tailwind v4 xuất màu ra `oklab` khi có pha trộn độ mờ và mọi
cách đọc bằng biểu thức chính quy đều sai âm thầm. Còn muốn dò chuỗi tiếng Anh thì phải duyệt
**nút văn bản** bằng `TreeWalker` chứ không duyệt phần tử, và phải bắt cả mẫu `[A-Z]{4,}` nằm
lẫn giữa câu tiếng Việt. Chi tiết trong BANGIAO.md.

---

## Lượt cũ hơn: rà màu ngữ nghĩa, đáp án sai vốn không hề có màu đỏ

`brand-danger` được dùng **84 lần trong 11 file** mà **chưa từng được định nghĩa**; bộ token chỉ
có `brand-error`. Đo được `text-brand-danger` ra `rgb(17,17,17)` tức đen như chữ thường, và
`bg-brand-danger-bg` ra `rgba(0,0,0,0)` tức trong suốt.

**Hậu quả: phương án chọn SAI hiện y hệt phương án chưa ai đụng tới.** Tín hiệu quan trọng nhất
của một ứng dụng học tập mất trắng. Không báo lỗi biên dịch, không sai kiểu, chỉ lặng lẽ không
tô màu.

| Hạng mục | Trước | Sau |
|---|---|---|
| Lớp màu không có token | `brand-danger` (84 chỗ), `brand-warning-text` (1 chỗ) | 0, nhóm **AF** canh |
| Tương phản xanh lá, đáp án đúng | **3,15:1** | 4,79:1 |
| Tương phản cam / xanh dương / đỏ | 3,35 / 3,38 / 4,41 | 4,88 / 4,75 / 5,91 |
| Chữ nội dung phương án ĐÚNG | 3,15:1 | **18,04:1** |
| Chữ nội dung phương án SAI | 4,41:1 | **17,26:1** |

Quy ước mới: **nội dung phương án không tô theo màu ngữ nghĩa**, tín hiệu đúng sai để ở nền,
viền, ô chữ cái và biểu tượng. Xem AGENTS.md mục 4.9d.

**Bộ quét tổng quát đáng giá hơn sửa một tên**: nó tìm ra `brand-warning-text` ngay lần chạy đầu,
một ca tôi hoàn toàn chưa thấy.

---

## Lượt trước: giảm chi phí thao tác trong buổi ôn dài

Yêu cầu: không thêm tính năng, chỉ nâng chất lượng thứ đã có, đo trên bản chạy thật, và chỉ giữ
thay đổi nào giúp người học bắt đầu nhanh hơn, hiểu nhanh hơn, nhớ tốt hơn hoặc tập trung lâu
hơn. Ba commit, nhóm kiểm mới **AE**.

### Chỗ đáng sửa nhất nằm ở màn LÀM BÀI, không phải các màn bảng biểu

Ba lượt rà trước đều dừng ở màn tổng quan. Nhưng người học ngồi 2 đến 4 tiếng trong màn làm bài,
nên mỗi thao tác thừa ở đó bị nhân lên hàng trăm lần.

| Hạng mục | Trước | Sau |
|---|---|---|
| Chọn đáp án | **bắt buộc dùng chuột**, dù mỗi phương án đã hiện sẵn chữ A/B/C/D | phím `A/B/C/D` hoặc `1/2/3/4` |
| Chuyển câu | chỉ `,` và `.`, khó đoán | thêm mũi tên trái phải |
| Nhắc phím tắt | không có | một dòng ngay dưới bốn phương án |
| Chip "Câu 3 / 10" trên khung 375px | xuống **ba dòng** | một dòng |
| Nhãn "Giáo viên AI Coaching" | xuống **ba dòng** | chỉ biểu tượng, vẫn có nhãn cho trình đọc màn hình |
| Dòng chủ đề, khái niệm | chữ hoa giãn cách kiểu mã máy, tô đậm, **đặt trên câu hỏi** | chữ thường màu nhạt, câu hỏi dẫn dắt |

### Một chỗ đo xong rồi KHÔNG sửa

Tôi ước bề rộng dòng câu hỏi khoảng 86 ký tự và định thu hẹp cột. Đo tử tế bằng số hình chữ nhật
dòng thì ra **69 ký tự mỗi dòng**, cao dòng 1,63, cả hai nằm gọn trong vùng dễ đọc. Ước sai vì
lấy 0,5em làm bề rộng ký tự trung bình, quá hẹp so với tiếng Việt có dấu. Đã bỏ ý định sửa.

**Bài học: đo bằng hình chữ nhật dòng thật, đừng ước từ bề rộng khối chia cỡ chữ.**

---

## Lượt trước: rà soát trải nghiệm trên trình duyệt thật

Yêu cầu: tự mở trình duyệt, rà toàn bộ trải nghiệm trên bản chạy thật chứ không đọc mã, rồi sửa
thẳng vào mã theo triết lý Calm Academic Operating System. Sáu commit, nhóm kiểm mới **AD**.

### Phát hiện quan trọng nhất: bất biến 4.9 lâu nay chỉ được áp cho tầng engine

Ba lượt trước đã dọn sạch số bịa trong các engine, nhưng **màn hình vẫn vẽ ra con số không có
thật**, vì mọi phép kiểm đều dừng ở tầng dịch vụ. Nhật ký rèn luyện tô ba ngày đã học cho người
**chưa làm câu nào**, sắc độ lấy từ `idx % 4` tức từ vị trí ô; "+6% tuần này" là chuỗi viết cứng;
điểm dự kiến hiện 5,0 khi chưa có bài nào. Nhóm kiểm **AD** nay canh ở mức mã nguồn.

### Số đo trước và sau, lấy từ bản chạy thật

| Hạng mục | Trước | Sau |
|---|---|---|
| Tràn ngang trên khung 375px | **122px**, 44 phần tử vượt khung | **0** |
| Hai thanh điều hướng | máy tính 7 mục, điện thoại 6 mục, khác thứ tự lẫn nhãn | cùng một mảng `DIEM_DEN` |
| Vòng tiêu điểm bàn phím | 9 file tắt outline, **0 chỗ** có `focus-visible` | một quy tắc dùng chung |
| Bộ chọn môn | lặp hai lần trên cùng màn hình | một |
| Nút cộng nổi | 4/6 mục trùng thanh điều hướng, 2 mục bấm không mở gì | đã gỡ |
| "Đặt lại tiến trình" | ba lối vào, một nằm ở góc tiêu đề màn Báo cáo | một, trong Cài đặt |

### Một sự cố thật của chính tôi, giữ lại để khỏi lặp

Tôi đã **commit và push khi bộ kiểm đang đỏ**, do lệnh nối chuỗi bằng `&&` và `grep` chỉ bắt dòng
tổng kết chặng. Truy ra là phép kiểm **AB6 chập chờn 1 trên 5 lượt**. Kịch bản của nó rút đề ngẫu
nhiên rồi quyết định đúng sai bằng `id % 2`, nên đúng sai phụ thuộc mã câu mà mã nào rơi vào phần
nào lại do bốc thăm. Đã dựng lại tất định, **không nới ngưỡng**, kết quả từ 10 đến 21 tùy lượt nay
xuống đúng **0,0** mọi lượt.

**Khi chạy `npm run check` trong lệnh nối chuỗi, phải bắt cả dòng `  HONG` của từng phép kiểm,
không chỉ dòng tổng kết chặng.**

### Còn nợ, cố ý chưa làm

Nhãn chữ hoa giãn cách kiểu bảng số liệu vẫn còn ở màn Báo cáo, khối "Liên kết kiến thức đang
học" và các bảng quan trắc; màn Báo cáo vẫn dẫn dắt bằng ba con số cỡ lớn và vài câu động viên
viết sẵn không đúng với người chưa làm bài. `QuickActionFAB.tsx` chỉ thôi render, file vẫn nằm
trên đĩa vì dọn mã chết là quyết định của chủ dự án.

---

## Lượt trước: rà toàn bộ liên kết giữa các thành phần

Yêu cầu: liên kết toàn bộ thành phần với nhau, không để rời rạc, mọi dữ liệu phải đồng bộ.
Bốn commit, năm nhóm kiểm mới **Y, Z, AA, AB, AC**. Số phép kiểm 152 lên **182**.

### Cách tìm việc của lượt này, khác hẳn ba lượt trước

Ba lượt trước hỏi "chỗ nào đang bịa số". Lượt này hỏi: **thành phần nào đang nói chuyện với
nhau bằng hai thứ tiếng?** Ba dấu hiệu dẫn tới cả năm lỗi:

1. Một trường được ghi mà không ai đọc, hoặc ngược lại.
2. Hai kho cùng mô tả một thứ nhưng được nuôi từ hai đường khác nhau.
3. **Một engine đã có sẵn logic đúng, nhưng nơi gọi lại tự viết tay bản rút gọn.**

Dấu hiệu thứ ba đắt nhất và khó thấy nhất: mã vẫn chạy, kiểu vẫn đúng, màn hình vẫn hiện số.

### Năm hạng mục

| Hạng mục | Trước | Sau |
|---|---|---|
| Xóa tiến trình (nhóm **Y**) | bỏ sót **7 kho dẫn xuất**, màn Thống kê về 0 nhưng màn Tiến hóa giữ nguyên người học cũ | dọn hết, `resetProgress` ủy quyền cho một đường duy nhất |
| Hiệu chuẩn nhận thức (nhóm **Z**) | nhãn "thiếu tự tin" **không bao giờ xuất hiện được**, "thừa tự tin" chỉ là cách gọi khác của "đúng dưới 36,4%" | đủ 4 trạng thái, bám cờ nghi vấn thật |
| Lịch sử chấm sư phạm (nhóm **AA**) | **0 bản ghi** sau 5 đề đã nộp | 100 bản ghi, màn Phân tích giảng dạy thấy được số câu đã làm |
| Tên khái niệm hai kho (nhóm **AA**) | khớp nhau **0/292 câu** | 14 tên bên chấm, 14 bên trí nhớ, lệch 0 |
| Khoảng ôn lại (nhóm **AA**) | cứng 48 hoặc 12 giờ, mâu thuẫn với lịch ôn thật | 4 giá trị do engine tính |
| Mỏi mệt (nhóm **AB**) | `fatigueTrend` chết hẳn, `questionFatigue` ghim 100 sau 13 lần hỏi AI | 100/100 khi càng cuối càng sai, 0 khi càng cuối càng đúng |
| Màn Bàn học (nhóm **AC**) | 4 khái niệm gắn cứng của **môn đã đóng** cùng 4 ô số liệu viết sẵn | đếm thật từ đồ thị tri thức của môn đang mở |

### Ba bài học đáng giữ

1. **Một phép đo chạy sau một lần reset không sạch thì không đo cái mình tưởng.** Sai lệch dự
   báo nhảy 0,3 lên 0,4 sau khi việc dọn kho trở nên thật. Đã tách nguyên nhân bằng `git stash`
   lấy mốc nền rồi bẻ riêng từng thay đổi: giữ công thức cũ mà chỉ dọn kho cho đúng thì **đã là
   0,4**. Con số 0,3 là số đo sai. Đã ghi cảnh báo trong harness.
2. **Sửa một chỗ bịa có thể đẻ ra chỗ bịa mới ở chiều ngược lại.** Mức trung lập 0,5 cho người
   không bấm cờ vẫn bị đem so với tỷ lệ đúng, nên hồ sơ 90% đúng bị dán nhãn "thiếu tự tin" ở
   13/15 khái niệm. Im lặng không phải bằng chứng.
3. **Phép kiểm chập chờn còn tệ hơn không có phép kiểm.** Bản đầu của AB6 đo tính chất của bộ
   sinh đề nên lúc xanh lúc đỏ. Đã đổi sang đo đúng thứ cần đo: dựng hồ sơ mà đúng sai chỉ phụ
   thuộc độ khó, rồi kiểm rằng chỉ số mỏi mệt **không** bị lừa.

### Cố ý chưa xử lý, đã ghi nhận

- **Ứng dụng không ghi thời gian TỪNG CÂU**, chỉ ghi tổng của cả lượt. Nên `averageResponseTime`
  theo khái niệm là phân bổ đều chứ không phải đo, và `metrics.responseTimeImprovement` chỉ có
  một giá trị. Đã cân nhắc phân bổ theo `estimatedTime` nhưng đo lại thì trường đó **không bám
  độ khó** (34,7 / 35,3 / 35,2 giây cho Dễ / Trung bình / Khó), nên chia theo nó chỉ tạo phân
  hóa giả. Muốn có nhịp từng câu thật thì phải bổ sung thu thập dữ liệu, xem Open Question 7.
- Ba khóa `poly_econ_pedagogical_*` và `poly_econ_policy_audit_log` **không gắn mã môn**.
- Màn Báo cáo hiện hai con số độ phủ khác nhau (10/292 và 6/292), một đếm câu đã gặp một đếm
  câu đã trả lời, nhãn không phân biệt.
- Hai khái niệm "độ tự tin" cùng tồn tại: `ConceptProfile.confidence` của `learnerModel` và
  `ConceptMemoryProfile.averageConfidence` vừa nối vào cờ nghi vấn. Chưa gộp vì phải chọn nghĩa.

---

## Lượt cũ hơn: đường cong quên và gợi ý học tập

Yêu cầu: quét nốt `questionGenerationEngine`, cải tiến dự đoán đường cong quên, ra gợi ý tốt hơn.
Bốn hạng mục, bốn commit, nhóm kiểm mới **U, V, W, X**.

### Phát hiện lớn nhất: dự án có HAI đường cong quên nói ngược nhau

`conceptMemoryService.memoryStrengthDays` và `learnerModel.recalculateForgettingScore` là hai
công thức khác hẳn nhau cho cùng một câu hỏi "còn nhớ bao nhiêu phần trăm", lệch tới **55 điểm
phần trăm**. Chỗ hiểm: cái hiện lên màn Tiến hóa cho người học nhìn là cái thứ nhất, còn cái
**điều khiển** chọn câu ôn tập, cảnh báo ôn khẩn và kế hoạch học lại là cái thứ hai.

Công thức cũ bên `learnerModel` là `0,5 * 2,2^chuỗi_đúng`, cho dải nửa đời **0,26 tới 29 ngày**,
chênh 111 lần chỉ do một biến. Người mới luyện một khái niệm bị coi là "cần ôn khẩn" sau đúng
**6 tiếng**. Nay 6 tiếng sau còn 97%. Sau khi gộp, hai đường lệch nhau **1 điểm** khi cùng bằng
chứng, và **4 điểm** trên lịch sử học thật (phần dư đến từ hai kho hồ sơ ghi lượng bằng chứng
khác nhau, không phải từ công thức).

### Bốn hạng mục

| Hạng mục | Trước | Sau |
|---|---|---|
| Xáo trộn đồ thị tri thức (nhóm **U**) | một lần sinh câu hỏi đảo lộn thứ tự khái niệm của lộ trình học và bản đồ độ thạo | giữ nguyên |
| Hiệu ứng giãn cách (nhóm **V**) | ôn dồn 1 giờ và ôn giãn 60 ngày **đều 55%** | 58% so với **69%** |
| Nhớ lại thất bại (nhóm **V**) | đúng hết và sai hết **đều 55%** | 58% so với **5%** |
| Hai mức sàn 0,05 và 0,08 (nhóm **V**) | đường vẽ ra lệch điểm chấm từ mốc 14 ngày | khớp cả 6 mốc |
| Hiệu chuẩn từ dữ liệu thật (nhóm **W**) | đường cong chưa từng đối chiếu với lần nhớ lại nào | ba kiểu người học cho **79 / 55 / 14** phần trăm |
| Gợi ý gắn cứng tên môn (nhóm **X**) | chào bằng tên môn **đã đóng** | tên môn đang mở |
| Gợi ý bỏ quên lịch ôn (nhóm **X**) | đúng 100% luôn được khen dù kiến thức trôi hết | ưu tiên ôn lại khi có từ 3 khái niệm quá hạn |

### Hai bài học đáng giữ

1. **Chú thích tự nhận "đây là nguồn duy nhất" không đáng tin.** Chú thích trên
   `memoryStrengthDays` khoe đã gộp công thức về một chỗ, nhưng nó chỉ gộp hai bản chép **trong
   cùng một file** và hoàn toàn không biết còn bản thứ ba ở file khác. Gặp câu tương tự thì grep
   cả dự án để kiểm.
2. **Thử phá phải cắt đúng sợi dây phép kiểm nói là đang canh.** Khi cắt mạch hiệu chuẩn, phép
   kiểm W2 vẫn xanh vì phần phân hóa còn đến từ hệ số giãn cách. Đây là lần thứ tư dự án bắt được
   phép kiểm rỗng.

### Cố ý chưa xử lý, đã ghi nhận

- **Cả hai cổng gợi ý đều không hiện ra màn hình nào.** `AIHub` gọi `generateLocalRecommendation`
  rồi cất vào state và không render; `getGeminiRecommendation` không có nơi nào gọi. Cần chủ dự
  án quyết có hiện phần chữ này ra không, xem Open Question 5.
- **`generateDeterministicFallbackQuestion` cho đáp án đúng ở phương án A trong 12/12 câu**, tức
  bấm A hết là đúng hết. Nhưng hàm có 0 nơi gọi nên là mã chết, thuộc Nợ 1, không tự ý dọn.
- **Thẩm định rỗng trong `verifyAndScoreQuestion`**: engine tự sinh câu hỏi từ spec rồi tự chấm
  câu đó với chính spec đó, nên tự cho mình 90/100. Không gây hại vì chỉ là siêu dữ liệu.
- **Nhãn "Độ ghi nhớ" trên tab Trí nhớ đọc giá trị đã lưu**, tức ảnh chụp lúc học lần cuối, trong
  khi đường cong ngay dưới nó lại vẽ theo thời điểm hiện tại. Hai con số cạnh nhau nói hai thời
  điểm khác nhau. Sửa được nhưng phải quyết nhãn đó **nên mang nghĩa gì** trước, nên để chủ dự án
  chọn.

---

## Lượt trước: tự chẩn đoán rồi nâng cấp cái đã có

Chủ dự án yêu cầu **không thêm tính năng**, chỉ nâng cấp thứ đã có, và tự chạy chẩn đoán. Áp bộ
quét ở AGENTS.md mục 4.9b lên ba engine chưa ai soi. Ba hạng mục, ba commit riêng.

| Chỗ sửa | Trước | Sau |
|---|---|---|
| Cột "Độ ghi nhớ" màn Tiến hóa (nhóm **T**) | **luôn 100%**, mọi hồ sơ | Nghỉ 0/1/3/7/14/30 ngày cho 100/91/75/52/27/8 phần trăm |
| Bảng hiệu quả chiến lược (nhóm **T**) | `averageSessionCompletion` cứng **100** cho 7 chiến lược chưa dùng lần nào | 0, đúng bất biến 4.9 |
| Vùng chết hàm trọng số (nhóm **R**) | Sai lệch 0,30 đến 0,80 cho **đúng 1 mức** trọng số | Đủ **6 mức**, giảm đơn điệu |

**Vì sao đáng làm**: cả ba đều là số hiển thị cho người học hoặc điều khiển quyết định thật, mà
không một phép kiểm nào chạm tới. Bộ quét tìm ra chúng trong một lượt chạy.

**Kết quả kèm theo**: sai lệch dự báo lớn nhất giảm tiếp từ 0,3 xuống **0,2**, trung bình từ 0,22
xuống **0,20**.

**Chưa xử lý, ghi nhận có chủ ý**: `getEvaluationHistory` và `getDecisionHistory` đều rỗng sau khi
làm bài, vì chỉ được nuôi từ tương tác với gia sư AI. Giống khuôn `guessingFrequency` cũ, nhưng
đây có thể là quyết định phạm vi chứ không phải lỗi: chỉ đánh giá chiến lược giảng dạy khi thật sự
có giảng dạy. Cần chủ dự án xác nhận trước khi đụng vào.

---

## Lượt trước: nâng độ chính xác dự báo

Chủ dự án yêu cầu nâng độ chính xác của dự đoán cá nhân hóa. Dò trước rồi mới đề xuất, và tìm ra
hai thứ, mỗi thứ một commit.

**1. Bộ dự báo tự xưng "tự hiệu chuẩn" chưa từng hiệu chuẩn lần nào** (nhóm kiểm **R**).
`registerActualExamResult` có **0 nơi gọi**, nên `calibrationCount` vĩnh viễn bằng 0, mà nhánh
thích nghi lại yêu cầu `>= 2`. Đã dựng `doHieuChuanTuLichSu` tính lại tất định từ lịch sử thật.
Đo được: hồ sơ đúng 90% cho sai lệch **+0,9 điểm**, tức hệ thống tự phát hiện nó đang hạ điểm.

**2. Nén dự báo về giữa** (nhóm kiểm **S**). Đây là phần đáng giá hơn:

| Năng lực thật | Trước | Sau |
|---|---|---|
| 20% | **+0,5** | −0,2 |
| 80% | **−0,7** | −0,2 |
| 100% | −0,6 | −0,2 |
| Lệch lớn nhất | 0,7 | **0,3** |
| Lệch trung bình | 0,44 | **0,22** |
| **Độ dốc** | **0,66** | **1,00** |

Ba nguyên nhân, ba loại lỗi khác nhau: độ phủ chương trình bị gộp vào phần định mức điểm dù độ
dốc bằng 0 (nhầm loại đại lượng), trung bình có trọng số của các đại lượng dốc dưới 1 (sai cấu
trúc, đã đổi sang **neo cộng hiệu chỉnh**), và phạt nợ theo số tuyệt đối nên người luyện nhiều bị
phạt kịch trần (đếm trùng với tỷ lệ đúng).

**Bài học phương pháp, đáng giữ**: hai lượt thử đầu đều làm chỉ số tổng **xấu đi** (0,42 rồi
0,50 rồi 0,56) nhưng đổi **hình dạng** của lỗi từ nén thành lệch đều, và chính điều đó chỉ ra thủ
phạm còn lại. Một thay đổi làm chỉ số xấu đi vẫn có thể là bước đúng, miễn là **không dừng và đẩy
đi ở giữa chừng**.

---

## Lượt trước đó: nối mạch dữ liệu bị bỏ không

Ba lượt trước hỏi "chỗ nào đang bịa số". Lượt này hỏi câu khác: **ứng dụng đang ghi dữ liệu gì mà
không engine nào đọc?** Bốn mạch đã nối, mỗi mạch một commit riêng:

| Mạch | Dữ liệu vốn nằm không | Trước | Sau |
|---|---|---|---|
| Cảnh báo bẫy hiểu sai (nhóm **N**) | `commonMistakes` và `teaching.misconception`, 16/16 khái niệm | Khi trả lời ĐÚNG, 0/30 câu mẫu có cảnh báo riêng | **30/30**, 15 nội dung khác nhau |
| Cờ nghi vấn (nhóm **O**) | `attempt.flags`, 0 nơi đọc | `behaviorUncertainty` chỉ là hàm của số câu đã làm | Cùng 80 câu cùng tỷ lệ đúng: **0,240 so với 0,120** tùy chỗ đặt cờ |
| Nhịp làm bài (nhóm **P**) | `estimatedTime` 292/292 câu, `attempt.timeSpent` | `guessingFrequency` luôn bằng 0 | Nhanh mà đúng **5,0%**, nhanh mà sai **70,0%** |
| Tiên nghiệm lịch ôn (nhóm **Q**) | `estimatedRetentionDifficulty`, `firstReviewDays` | Mọi khái niệm chưa học đều **6,15 ngày** | **6 giá trị**, dải 4,24 đến 7,82 ngày |

**Nguyên tắc đã dùng, giữ cho lượt sau:**

1. **Đo độ dày dữ liệu TRƯỚC khi viết code.** Dữ liệu rỗng thì dừng và ghi lại, không xây tầng
   suy luận trên hư không. Cả bốn mạch đều đo trước, và mạch nào cũng có số đo trong BANGIAO.
2. **Thiếu dữ liệu thì trả "chưa đủ dữ liệu", không trả một con số cho đẹp.** Ba tầng mới đều có
   cờ `duDuLieu` và có phép kiểm canh đúng trạng thái đó.
3. **Chỉ một cách co theo lượng bằng chứng trong cả dự án**: `w = 1 - e^(-n/6)`. Cùng hằng số 6 ở
   `db.recomputeStatistics`, `learnerModelService` và `conceptMemoryService`.
4. **Chuỗi mẫu sinh tự động KHÔNG phải kiến thức.** Nút tổng hợp của môn tự tạo có đủ trường chữ
   nhưng chỉ là mẫu ghép tên khái niệm, nên bị loại khỏi mọi chỗ dùng làm bằng chứng học thuật.
   Cờ nhận dạng là `laNutTongHop`.

**Hai bài học về chính bộ kiểm, đáng đọc:**

- **Một phép kiểm ngừng chạy cũng nguy hiểm như một phép kiểm sai.** Tổng số từng tụt từ 103 xuống
  102 mà không ai báo gì, vì phép kiểm bất biến 4.1 nằm trong `if` chỉ đúng khi câu đầu tiên của
  đề tình cờ bị trộn đổi đáp án. Nên **so danh sách TÊN phép kiểm trước và sau mỗi lượt sửa**.
- **Phép kiểm dựa vào trạng thái tích lũy của cả chuỗi nhóm trước là mong manh.** J5 từng đỏ chỉ
  vì thành phần đề đổi. Nay nó dựng thẳng hồ sơ đảm bảo phân hóa.

---

## Ba lượt trước đó nói về cùng MỘT họ lỗi

Đáng đọc kỹ, vì đây là họ lỗi phổ biến nhất trong dự án này và gần như chắc chắn còn chỗ chưa
tìm ra: **trình bày một hằng số viết tay như thể đó là kết quả đo được.**

Loại này không bao giờ báo lỗi, không sai kiểu dữ liệu, không nổ ngoại lệ. Nó chỉ lặng lẽ làm
mọi kết luận phía sau thành vô nghĩa, trong khi màn hình trông vẫn hoàn toàn bình thường.

| Lượt | Tìm ra | Nhóm kiểm canh |
|---|---|---|
| 1. Màn Kế hoạch học | 7 con số bịa, và trường `bloomLevel` rỗng 292/292 câu | **J**, **K** |
| 2. Gắn cứng mã môn học | 3 chỗ cho ra số liệu của môn khác khi có từ hai môn | **L** |
| 3. Quét rộng toàn ứng dụng | 6 con số bịa nữa ở 5 file khác nhau | **M** |

**Hai công cụ để tìm tiếp, cả hai đều cần:**

1. **Bộ quét bằng số**: cho engine chạy trên 5 hồ sơ học khác hẳn nhau (đúng 0%, 25%, 50%, 75%,
   100%), trải phẳng đầu ra, lọc ra trường **số** nào không đổi qua cả 5 lượt. Cách viết cụ thể
   nằm ở AGENTS.md mục 4.9b.
2. **Mở màn hình ra xem**: trong cùng một ngày, **hai** lỗi lọt qua toàn bộ 90+ phép kiểm và chỉ
   lộ ra khi nhìn giao diện thật (sổ nợ xếp chương ngược từ 7 về 1, và dòng "tăng Retention từ
   63% lên 89%" nằm cứng trong `StatsView`). Chạy `npm run dev` rồi đọc bằng mắt.

---

## Số liệu đã kiểm chứng bằng cách đọc code

| Hạng mục | Số liệu thật |
|---|---|
| Câu hỏi trong ngân hàng | 292 |
| Chương | 7 |
| Chủ đề | 22 |
| Component | 30 file |
| Service | 46 file |
| Phép tự kiểm chứng | **215**, chia 33 nhóm A đến AG, đạt toàn bộ |
| Môn đang hoạt động | Hành vi khách hàng (`customer_behavior`) |
| Môn đã đóng | Kinh tế chính trị (`poli_econ`), đã thi xong, cố ý gỡ khỏi danh sách |

---

## Phạm vi dài hạn của dự án

Chủ dự án xác nhận ngày 27/07/2026: đây là **trung tâm luyện thi và học tập đa môn dùng lâu
dài**, sẽ còn nạp thêm nhiều môn và nhiều tài liệu khác. Tên thư mục là di sản của môn đầu tiên.

Ba chỗ gắn cứng mã môn **nguy hiểm nhất đã xử lý** (xem AGENTS.md mục 3). Cách phân loại khi
gặp chỗ gắn cứng mới: hỏi xem với môn khác nó *trả về ít hơn* hay *trả về của môn sai*. Loại
thứ nhất ghi nợ được, loại thứ hai phải sửa ngay.

Đường nạp môn mới đã thông: sinh câu hỏi từ tài liệu chạy được, môn tự tạo dùng được gia sư AI
(AGENTS.md mục 4.8), và nay độ thạo khái niệm ghi đủ hai khóa cho mọi môn (nhóm kiểm **L**).

---

## Bản đồ mức độ tin cậy của tài liệu

**Chỉ tin 5 file này**: `AGENTS.md`, `CLAUDE.md`, `BANGIAO.md`, `WORKSTATE.md` (file này),
`DEPLOY.md`.

**Không tin 8 file này**, chúng viết cho môn Kinh tế chính trị đã đóng, số liệu sai hết:
`README.md`, `ARCHITECTURE.md`, `DATA_FLOW.md`, `DATABASE.md`, `TECH_DEBT.md`, `TEST_PLAN.md`,
`ROADMAP.md`, `CHANGELOG.md`. Mỗi file đã gắn cảnh báo ở dòng đầu.

Khi tài liệu mâu thuẫn với code thì **code thắng**. Cập nhật tài liệu, không lùi code.

---

## Technical Debt

Ghi nhận qua khảo sát, **cố ý chưa xử lý**. Không tự ý dọn nếu chưa được giao.

### Nợ 1: Mã chết. ĐÃ XONG 13/08/2026

Gỡ 6 file, 1.263 dòng: `importPipeline.ts`, `validation.ts`, `Dashboard2Widgets.tsx`,
`DashboardClock.tsx`, `QuickActionFAB.tsx`, `AssessmentDesignDashboard.tsx`. Phép kiểm **AQ3** giữ
cho nợ này không tái phát, và nó quét cả `scripts/` lẫn `functions-src/` chứ không chỉ `src/`, vì
`aiOrchestrator.ts` không có nơi nhập nào trong `src/` nhưng là đường chạy thật của hàm serverless
`recommend.ts`.

### Nợ 2: Con số chưa bám dữ liệu. ĐÃ XỬ PHẦN GÂY HẠI 30/08/2026

**Đã sửa**: `getCurriculumPlan` từng gán `estimatedStudyTime` bằng 35 hoặc 20 tuỳ giai đoạn và
`expectedRetentionGain` bằng 15 cho mọi người học mọi lúc. Con số phút được in thẳng lên màn
Chương trình, nên người có 2 khái niệm tới hạn và người có 14 khái niệm cùng đọc "khoảng 20 phút".
Nay cả hai suy từ việc thật của hôm nay: số khái niệm tới hạn nhân số câu mỗi khái niệm nhân nhịp
đo được của chính người học, và tổng lợi ích của đúng các khái niệm ấy tính theo mức nhớ vào ngày
thi. Chưa đặt ngày thi thì phần mức nhớ trả `null`. Nhóm kiểm **AU** canh cả ba vế.

**Còn lại, đều là loại không khẳng định sai về người học**:

| Chỗ | Còn gì |
|---|---|
| Ngân hàng câu hỏi | Trường `misconception` rỗng 292/292 câu. Từ 27/07/2026 không còn gây hại: đã có nguồn thay thế ở tầng khái niệm (nhóm kiểm **N**). Chỉ thiếu nếu muốn cảnh báo riêng cho TỪNG CÂU thay vì từng khái niệm |
| Khối `review` biên soạn tay | `secondReviewDays` và `thirdReviewDays` vẫn chưa ai đọc. Chúng chỉ có nghĩa khi xếp lịch ôn nhiều mốc, mà lịch hiện suy từ một con số độ bền duy nhất |
| `productObservabilityService` | 39 ngưỡng cứng, đã rà và sửa 3 lỗi nặng, phần ngưỡng thuần túy chưa đụng |
| `curriculumIntelligenceEngine` | 18 ngưỡng cứng, đã rà và sửa 5 lỗi nặng cộng 1 lỗi ở lượt 3 |

### Nợ 3: Gói giao diện lớn. ĐÃ XONG 13/08/2026

Gói mã từ 973 KB xuống **374 KB**: nạp muộn năm màn nặng, và bỏ bộ SDK Gemini khỏi bản trình duyệt
(nó chỉ được dùng ở nhánh chạy trên Node). Gói còn lại 1.081 KB **không phải mã** mà là ngân hàng
câu hỏi, và đã quyết định cố ý không đụng: đưa nó xuống đòi nạp dữ liệu môn học bất đồng bộ, tức
thay đổi kiến trúc sâu đổi lấy chút thời gian tải trên một máy chạy cục bộ. **AQ2** đặt ngưỡng cho
gói mã và miễn trừ gói dữ liệu bằng cách nhận diện theo nội dung.

### Nợ 4: Bốn cổng AI đang chết trên bản chạy thật

**Đây là món nợ duy nhất còn chặn đường, và nó cần Đàm.** `wuzqqsjkoifhuuirimyj.supabase.co` trả
**NXDOMAIN**, tức dự án Supabase không còn tồn tại, trong khi `onthidaihocmo.vercel.app` phân giải
bình thường và trả HTTP 200. Hệ quả: gia sư AI, sinh câu hỏi, và phần chấm bài nhớ lại đều không
dùng được trên bản thật.

Cách gỡ: tạo dự án Supabase mới, bật Anonymous sign-ins, đặt `VITE_SUPABASE_URL` và
`VITE_SUPABASE_ANON_KEY` trong Vercel, deploy lại, rồi chạy `npm run check:prod`.

Từ 30/08/2026 chân trang tự chẩn đoán và nói ra hỏng ở đâu, nên không cần chạy `check:prod` mới
biết. Ba nguyên nhân được phân biệt riêng vì ba cách gỡ nằm ở ba chỗ khác nhau.

## Known Risks

### Rủi ro 1: Dữ liệu học chỉ nằm trên một trình duyệt

Không còn đồng bộ đám mây. Xóa dữ liệu duyệt web là mất sạch lịch sử học. Có nút sao lưu thủ
công trong Cài đặt. Chủ dự án **đã chọn giữ cách bấm tay**, đừng tự ý thêm đồng bộ hay bật lại
đăng nhập.

### Bài học đắt nhất, giữ lại để khỏi lặp

Bốn cổng AI từng trả 401 trên bản chạy thật trong khi mọi phép kiểm cục bộ đều xanh. Có **hai
lỗi chồng lên nhau**, và lỗi thứ nhất che mất lỗi thứ hai. Đã xử lý xong 27/07/2026.

Nhắc lại cho phiên sau: **bộ kiểm cục bộ không bao giờ chứng minh được hạng mục xác thực**, vì
máy nhà không đặt biến Supabase nên cổng AI luôn xanh ở đây. Đụng vào xác thực hay hàm
serverless thì bắt buộc `npm run check:prod`.

---

## Blocked Issues

Không có.

---

## Open Questions

Cần chủ dự án quyết, **không được tự quyết thay**:

1. Có dọn khoảng 1.180 dòng mã chết không? Dọn thì gọn nhưng là thay đổi diện rộng.
2. Có tách gói giao diện theo màn hình để giảm 1,0 MB không? Xem cảnh báo ở Nợ 3.
3. Trường `misconception` của **từng câu hỏi** vẫn rỗng 292/292. Từ 27/07/2026 gia sư AI đã có
   cảnh báo bẫy riêng lấy từ tầng KHÁI NIỆM, nên câu hỏi này bớt gấp. Chỉ còn đáng làm nếu chủ dự
   án muốn cảnh báo riêng cho từng câu chứ không phải từng khái niệm.
4. Có muốn hiển thị bảy vector bất định của bộ dự báo không? Hiện chúng **không xuất hiện ở màn
   hình nào**, chỉ chảy vào con số tổng rồi ra biên độ tin cậy. Nếu chủ dự án muốn biết "vì sao dự
   báo không chắc" thì cần một chỗ hiển thị.
5. **Có hiện phần chữ gợi ý học tập ra màn hình không?** `AIHub` đã gọi
   `generateLocalRecommendation` và cất kết quả vào state nhưng **không render**, còn
   `getGeminiRecommendation` thì không nơi nào gọi. Nội dung đã đúng và đã bám lịch ôn từ
   27/07/2026, chỉ thiếu chỗ hiển thị. Đây là thêm phần giao diện nên không tự làm.
6. **Nhãn "Độ ghi nhớ" trên tab Trí nhớ nên mang nghĩa gì?** Hiện nó đọc giá trị đã lưu, tức ảnh
   chụp lúc học lần cuối, trong khi đường cong ngay bên dưới lại vẽ theo thời điểm hiện tại. Hai
   con số cạnh nhau nói hai thời điểm khác nhau. Sửa dễ, nhưng phải chọn nghĩa trước: "lúc quay
   lại lần trước còn nhớ bao nhiêu" hay "ngay bây giờ còn nhớ bao nhiêu".
7. **Có ghi thời gian TỪNG CÂU khi làm bài không?** Hiện chỉ ghi tổng thời gian của cả lượt, nên
   mọi chỉ số về nhịp ở mức khái niệm đều là phân bổ đều chứ không phải đo. Ghi được thì mở ra
   nhịp thật từng câu, phát hiện đoán mò chính xác hơn, và `averageResponseTime` có nghĩa. Nhưng
   đây là **thêm việc thu thập dữ liệu**, chỉ có tác dụng từ lúc bật trở đi, không hồi tố được.
9. **Có xây thật ba đại lượng của bảng tổng kết sau khi nộp không?** Ngày 29/07/2026 đã gỡ ba ô
   "Khái niệm đã thông thạo", "Hiểu sai đã sửa", "Độ ghi nhớ dự đoán" khỏi màn làm bài vì cả ba
   là số bịa viết thẳng trong tầng trình bày (chi tiết trong BANGIAO.md). Dữ liệu để tính thật
   thì **có sẵn**: tầng trí nhớ khái niệm biết độ thạo trước và sau phiên, cảnh báo bẫy hiểu sai
   đã nối từ 27/07/2026, và đường cong quên cho ra độ ghi nhớ theo thời điểm. Nhưng đây là việc
   của **tầng engine**, phải chọn định nghĩa cho từng đại lượng trước khi tính, nên không tự làm.

8. **Hai khái niệm "độ tự tin" nên gộp làm một hay giữ riêng?** `ConceptProfile.confidence` của
   `learnerModel` là một đại lượng, `ConceptMemoryProfile.averageConfidence` vừa nối vào cờ nghi
   vấn là đại lượng khác, và màn Phân tích giảng dạy đang hiện cái thứ nhất. Cùng một chữ, hai
   nghĩa. Phải chọn nghĩa trước rồi mới gộp được.

---

## Next Immediate Step

**Chờ yêu cầu mới.** Không tự khởi động việc gì.

Nếu được giao việc, theo đúng trình tự trong AGENTS.md mục 9: chạy `npm run check` phải đạt,
soát `git status`, commit nêu rõ đổi gì và vì sao, ghi mục mới vào BANGIAO.md, cập nhật file
WORKSTATE.md này, rồi push.

## Next Major Step

**Hai việc mới sinh ra từ lượt nâng độ chính xác dự báo, nên làm trước:**

0a. **Ba loại sai lệch theo lát cắt vẫn chưa dựng lại**: `chapterBias`, `difficultyBias`,
    `bloomBias` trong hồ sơ hiệu chuẩn vẫn giữ giá trị cũ. Chúng cần điểm thi thật tách theo
    chương và theo mức Bloom, mà lượt làm bài hiện **không ghi đủ chiều đó**. Muốn làm thì phải
    bổ sung dữ liệu lúc chấm trước.

0b. ~~Vùng chết trong `calculateAdaptiveWeights`~~ **ĐÃ XỬ LÝ 27/07/2026**: đổi sang nội suy
    tuyến tính, sai lệch 0,30 đến 0,80 nay cho đủ sáu mức trọng số khác nhau.

**Bốn nhiệm vụ còn lại trong danh sách tám đã giao**, xếp theo đúng thứ tự chủ dự án đề nghị.
Cả bốn đều đã được xác minh là mạch dữ liệu có thật, nhưng **vẫn phải đo độ dày trước khi viết
code**, đúng như bốn mạch vừa làm.

1. ~~Hiệu ứng vị trí câu trong đề, tức đường cong mỏi mệt~~ **ĐÃ XONG 28/07/2026**, nhóm kiểm
   **AB**. Việc khử độ khó hóa ra là bắt buộc thật: bộ sinh đề có lúc dồn câu khó về một đầu,
   đo được chênh lệch tới 0,38 trên thang 1 tới 3 giữa các phần đề.
2. **Khung giờ học hiệu quả.** `attempt.startTime` là chuỗi ISO đầy đủ trên mọi lượt. Gom theo
   khung rộng (sáng, chiều, tối, khuya) chứ đừng chia 24 ô, và phải nói rõ số lượt làm căn cứ.
   Đây là nhiệm vụ **còn lại đáng làm nhất** trong danh sách này.
3. ~~Rà `studentEvolutionEngine` và ba engine chưa soi~~ **ĐÃ XONG 27/07/2026**. Cả bốn engine
   (`studentEvolutionEngine`, `pedagogicalEvaluationEngine`, `teachingDecisionEngine`,
   `questionGenerationEngine`) đều đã cho chạy qua bộ quét ở AGENTS.md mục 4.9b.
4. **Trường `examReviewResult`** được ghi vào mọi lượt ở `ai.ts` nhưng **không nơi nào đọc**. Đọc
   xem nó chứa gì rồi quyết: nối vào đâu đó, hoặc ghi vào sổ nợ là mã chết.

Tin tốt đã kiểm chứng, khỏi mất công dò lại: **8 khóa localStorage được ghi thì cả 8 đều có nơi
đọc.** Không có dữ liệu lưu trữ chết ở tầng đó.

Thêm hai việc mới sinh ra từ lượt rà liên kết 28/07/2026:

7. **Gộp hai khái niệm "độ tự tin"**, xem Open Question 8. Phải chọn nghĩa trước.
8. **Nhãn độ phủ trên màn Báo cáo** hiện hai con số khác nhau mà không phân biệt (câu đã gặp so
   với câu đã trả lời). Sửa nhãn là đủ, không phải sửa phép tính.

Sau đó mới tới các khoản nợ cũ:

5. Tách gói giao diện để giảm 1,0 MB (Nợ 3, đọc cảnh báo trước khi làm)
6. Dọn mã chết (Nợ 1)

---

## Verification Pending

Không có. Bốn commit của lượt 28/07/2026 đều nghiệm thu hai tầng: `npm run check` đủ 6 chặng với
**182** phép kiểm, **và** mở `npm run dev` làm một lượt thi thật rồi soi tận mắt.

Quan sát được trên trình duyệt thật, sau khi làm và nộp một đề:
- lịch sử chấm sư phạm có **6 bản ghi**, trước đó là 0
- ô "Phương pháp hiệu quả nhất" hiện **"Chưa đủ dữ liệu"** kèm giải thích, trước đó hiện
  "Academic" kèm câu khẳng định nó giúp duy trì độ tinh thông cao nhất
- khối "Liên kết kiến thức" hiện đúng khái niệm của môn đang mở, chuyên đề đọc được, nguồn tài
  liệu thật, 20 câu trong ngân hàng, 0 câu cần sửa
- nút cờ nghi vấn ghi đúng vào `attempt.flags` và chảy tới tầng trí nhớ

**Chính lượt soi bằng mắt này tìm ra lỗi thứ năm** (màn Bàn học hiện khái niệm của môn đã đóng),
thứ mà 179 phép kiểm đều bỏ qua. Lần thứ ba trong dự án. Đừng bỏ bước này.

**Ba giới hạn nghiệm thu phải nói rõ:**

1. Chỉ số **mỏi mệt** không quan sát được khác 0 trên giao diện, vì cần tối thiểu 30 câu trong
   các đề dài từ 9 câu, mà lượt soi chỉ làm 1 đề 10 câu. Màn hình hiện 0 là **đúng thiết kế**
   cho lượng dữ liệu đó. Việc con số khác 0 chảy tới nơi tiêu thụ được chứng minh bằng phép
   kiểm AB5, không bằng mắt.
2. Nhịp làm bài cũng vậy, xem giới hạn đã ghi ở lượt trước.
3. Dữ liệu học thật của chủ dự án nằm trong trình duyệt của chính chủ dự án, không nằm trong
   repo. Nên **không đo được chủ dự án dùng nút cờ nghi vấn nhiều hay ít**. Mọi tầng mới vì thế
   đều thiết kế theo hướng dữ liệu thưa: thiếu thì trả "chưa đủ dữ liệu" chứ không đoán.
