import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';
import { ensureSession, supabase } from './services/supabaseClient';
import { cloudSync } from './services/cloudSync';
import { SplashScreen } from './components/AuthScreens';

const root = createRoot(document.getElementById('root')!);
let booted = false;

function show(node: React.ReactNode) {
  root.render(
    <StrictMode>
      <ThemeProvider>{node}</ThemeProvider>
    </StrictMode>,
  );
}

async function loadApp() {
  if (booted) return;
  const { default: App } = await import('./App');
  booted = true;
  show(<App />);
}

// Không còn màn đăng nhập ở frontend: app luôn chạy ở chế độ dữ liệu cục bộ (localStorage).
// Nếu trình duyệt vẫn còn phiên Supabase cũ (token chưa hết hạn) thì tận dụng để đồng bộ đám mây,
// còn không thì chạy hoàn toàn local, không bắt đăng nhập.
async function boot() {
  if (booted) return;
  try {
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      // CHỈ đồng bộ đám mây với phiên đăng nhập THẬT. Phiên ẩn danh sinh ra để qua cửa xác thực
      // của các cổng AI, không phải danh tính của Đàm; đồng bộ theo nó sẽ đẩy lịch sử học lên
      // một tài khoản vô danh mới toanh mỗi khi trình duyệt bị xóa dữ liệu.
      if (session && !session.user.is_anonymous) {
        show(<SplashScreen />);
        await cloudSync.pull(session.user.id);
        cloudSync.startAutoPush(session.user.id);
      }
    }
  } catch {
    // Bỏ qua mọi lỗi đồng bộ đám mây; vẫn nạp app ở chế độ cục bộ.
  }

  // Dựng sẵn phiên ẩn danh để cổng AI có token. Cố tình KHÔNG chờ: đây là lời gọi mạng, chờ nó
  // là làm chậm lúc mở app. Nếu người dùng bấm tính năng AI trước khi xong thì `apiHeaders`
  // trong ai.ts chờ đúng lượt đăng nhập này, không tạo thêm phiên thứ hai.
  void ensureSession();

  await loadApp();
}

void boot();
