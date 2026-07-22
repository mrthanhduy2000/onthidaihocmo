import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { cloudSync } from './services/cloudSync';
import { ConfigNeededScreen, LoginScreen, SplashScreen } from './components/AuthScreens';

const root = createRoot(document.getElementById('root')!);
let booted = false;

function show(node: React.ReactNode) {
  root.render(
    <StrictMode>
      <ThemeProvider>{node}</ThemeProvider>
    </StrictMode>,
  );
}

async function boot() {
  // Chưa cấu hình Supabase -> hướng dẫn.
  if (!isSupabaseConfigured || !supabase) {
    show(<ConfigNeededScreen />);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();

  // Chưa đăng nhập -> màn đăng nhập.
  if (!session) {
    booted = false;
    show(<LoginScreen />);
    return;
  }

  // Đã đăng nhập & đã vào app -> không dựng lại (tránh mất trạng thái khi token tự làm mới).
  if (booted) return;

  // Đăng nhập rồi: kéo dữ liệu từ cloud TRƯỚC khi nạp App (để dbService đọc đúng dữ liệu),
  // rồi bật tự động đồng bộ.
  show(<SplashScreen />);
  await cloudSync.pull(session.user.id);
  cloudSync.startAutoPush(session.user.id);

  const { default: App } = await import('./App');
  booted = true;
  show(<App />);
}

// Đăng nhập/đăng xuất/làm mới token -> chạy lại bootstrap.
if (supabase) {
  supabase.auth.onAuthStateChange(() => { void boot(); });
}

void boot();
