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

import health from "./api/health";
import generate from "./api/ai/generate";
import explain from "./api/ai/explain";
import chat from "./api/ai/chat";
import recommend from "./api/ai/recommend";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "4mb" }));

// Mount các serverless handler (chữ ký (req, res) tương thích Express).
app.get("/api/health", health);
app.post("/api/ai/generate", generate);
app.post("/api/ai/explain", explain);
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
