import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {dinhNghiaPhienBan} from './scripts/phien-ban-build.mjs';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    /*
      Bơm thông tin bản dựng vào gói giao diện. Dùng chung `dinhNghiaPhienBan` với
      `scripts/build-vercel.mjs`, để phiên bản trình duyệt báo và phiên bản máy chủ báo luôn đến
      từ MỘT nguồn. Hai nguồn thì phép so "máy chủ đã có bản mới hơn chưa" mất hết ý nghĩa.
    */
    define: dinhNghiaPhienBan(),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
