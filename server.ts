/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Máy chủ Express CHỈ DÙNG CHO PHÁT TRIỂN CỤC BỘ (npm run dev).
 * Trên Vercel, mỗi endpoint chạy như một Serverless Function trong thư mục /api.
 * Ở đây ta nạp lại chính các handler đó để dev local dùng chung một nguồn logic.
 */
import express from "express";
import path from "path";
import dotenv from "dotenv";
import { layThongTinBan } from "./scripts/phien-ban-build.mjs";

import health from "./functions-src/health";
import generate from "./functions-src/ai/generate";
import complete from "./functions-src/ai/complete";
import chat from "./functions-src/ai/chat";
import recommend from "./functions-src/ai/recommend";

dotenv.config();

/*
  Bơm thông tin bản dựng vào biến môi trường cho đường chạy DEV.

  `tsx` không có phép thay lúc dựng như esbuild và Vite, nên `functions-src/health.ts` chạy ở đây
  sẽ không thấy các biến `__BAN_*__`. Không đặt sẵn thì cổng báo "khong-ro" còn gói giao diện báo
  mã thật, và màn hình sẽ báo động giả "máy chủ đã có bản mới hơn" suốt buổi phát triển.

  Lấy từ ĐÚNG nguồn `layThongTinBan` mà Vite và `build-vercel` dùng, không tự hỏi git lần nữa.
*/
const banDung = layThongTinBan();
process.env.BAN_SHA = banDung.sha;
process.env.BAN_NGAY_COMMIT = banDung.ngayCommit;
process.env.BAN_THOI_DIEM_DUNG = banDung.thoiDiemDung;

const app = express();
// Cổng lấy từ biến môi trường để chạy được nhiều phiên song song. Không đặt biến thì vẫn là
// 3000 như cũ, nên mọi tài liệu và thói quen cũ không đổi.
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "4mb" }));

// Mount các serverless handler (chữ ký (req, res) tương thích Express).
app.get("/api/health", health);
app.post("/api/ai/generate", generate);
app.post("/api/ai/complete", complete);
app.post("/api/ai/chat", chat);
app.post("/api/ai/recommend", recommend);

// Phục vụ frontend (dev: Vite middleware; prod-local: dist tĩnh).
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
