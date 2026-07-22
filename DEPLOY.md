# Hướng dẫn triển khai lên Vercel + Supabase

App này gồm 3 phần: **frontend** (Vite, chạy tĩnh trên Vercel), **API AI** (các Serverless
Function trong thư mục `/api`, giữ key Gemini ở phía máy chủ), và **Supabase** (đăng nhập +
lưu/đồng bộ toàn bộ dữ liệu học tập). Mô hình phục vụ 1 người dùng.

---

## BƯỚC 0 — Bảo mật (làm trước tiên)

Key Gemini cũ từng bị đưa vào `.env.example` (file bị commit lên git) nên coi như **đã lộ**:
1. Vào Google AI Studio → thu hồi key cũ → tạo **key mới**.
2. KHÔNG bao giờ điền key thật vào `.env.example`. Key thật chỉ để trong `.env` (local, đã
   gitignore) và trong Environment Variables của Vercel.

---

## BƯỚC 1 — Tạo dự án Supabase

1. Vào https://supabase.com → **New project** (đặt tên tùy ý, chọn region gần VN như Singapore).
2. Mở **SQL Editor → New query**, dán toàn bộ nội dung file [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   (Tạo bảng `app_state` + bật Row Level Security để mỗi người chỉ đọc/ghi dữ liệu của mình.)
3. Vào **Authentication → Providers → Email**: bật **Email**, bật **Confirm email** (magic link).
4. Vào **Project Settings → API**, ghi lại 2 giá trị:
   - **Project URL** → dùng cho `SUPABASE_URL` và `VITE_SUPABASE_URL`.
   - **anon public key** → dùng cho `SUPABASE_ANON_KEY` và `VITE_SUPABASE_ANON_KEY`.

> Sau khi có domain Vercel (bước 3), quay lại **Authentication → URL Configuration**:
> - **Site URL**: `https://onthidaihocmo.vercel.app`
> - **Redirect URLs**: thêm `https://onthidaihocmo.vercel.app` (và `http://localhost:3000` để test local).

---

## BƯỚC 2 — Đưa code lên GitHub

Dự án chưa phải git repo. Trong thư mục dự án:

```bash
git init
git add .
git commit -m "Khởi tạo app ôn thi (Vercel + Supabase)"
# Tạo repo rỗng trên GitHub rồi:
git remote add origin https://github.com/<tai-khoan>/onthidaihocmo.git
git branch -M main
git push -u origin main
```

`.gitignore` đã chặn `.env` nên key thật không bị đẩy lên. Yên tâm.

---

## BƯỚC 3 — Deploy lên Vercel

1. Vào https://vercel.com → **Add New → Project** → chọn repo vừa push.
2. Vercel tự nhận framework **Vite** (đã có `vercel.json`). Không cần chỉnh Build/Output.
3. Mở **Environment Variables**, thêm **cả 5 biến** (cho môi trường Production):

   | Tên biến | Giá trị |
   |---|---|
   | `GEMINI_API_KEY` | key Gemini MỚI (bước 0) |
   | `SUPABASE_URL` | Project URL của Supabase |
   | `SUPABASE_ANON_KEY` | anon public key |
   | `VITE_SUPABASE_URL` | Project URL của Supabase (giống trên) |
   | `VITE_SUPABASE_ANON_KEY` | anon public key (giống trên) |

4. Bấm **Deploy**. Xong vào **Settings → Domains** đổi tên miền thành `onthidaihocmo.vercel.app`.
5. Quay lại Supabase làm phần **URL Configuration** ở cuối Bước 1 với domain này.

> Lưu ý: mỗi lần đổi Environment Variables trên Vercel phải **Redeploy** để có hiệu lực
> (vì các biến `VITE_` được nhúng vào frontend lúc build).

---

## BƯỚC 4 — Chạy thử ở máy (tùy chọn)

1. Copy `.env.example` thành `.env`, điền 5 biến thật (key Gemini + Supabase).
2. Chạy:
   ```bash
   npm install
   npm run dev
   ```
   Mở http://localhost:3000. Đăng nhập bằng email → bấm liên kết trong mail → vào app.

---

## Kiến trúc tóm tắt

- `/api/*.ts` — Serverless Function (Vercel tự chạy). Giữ key Gemini ở máy chủ, có kiểm tra
  đăng nhập (chặn người lạ xài API tốn quota).
- `server.ts` — CHỈ để chạy dev local (`npm run dev`), nạp lại chính các handler trong `/api`.
- `src/services/supabaseClient.ts` — kết nối Supabase phía client.
- `src/services/cloudSync.ts` — đồng bộ TOÀN BỘ trạng thái (mọi key `poly_econ*`, gồm cả
  ngân hàng câu hỏi AI) lên Supabase; kéo về khi mở app, tự đẩy lên khi có thay đổi.
- `src/main.tsx` — cổng khởi động: chưa cấu hình → hướng dẫn; chưa đăng nhập → màn login;
  đã đăng nhập → kéo dữ liệu về rồi mới nạp app.

## Cần biết

- **Đồng bộ**, không phải nhiều thiết bị chạy song song: nếu mở app trên 2 thiết bị cùng lúc,
  thiết bị lưu sau sẽ ghi đè. Với 1 người dùng dùng lần lượt thì không sao.
- Dữ liệu lưu dạng 1 dòng JSON trong bảng `app_state`. Muốn xem/sao lưu, vào Supabase →
  Table Editor → `app_state`.
