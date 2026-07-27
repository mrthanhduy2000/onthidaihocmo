/**
 * Các màn hình cổng xác thực: chưa cấu hình Supabase, đăng nhập (magic link), và màn chờ.
 */
import React, { useState } from "react";
import { GraduationCap, Mail, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "../services/supabaseClient";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-app text-text-primary flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-bg-card border border-border-primary rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-text-primary flex items-center justify-center text-bg-card">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-medium text-sm tracking-wide">ÔN THI ĐẠI HỌC MỞ</div>
            <div className="text-2xs text-text-muted">Hệ thống luyện thi cá nhân</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SplashScreen() {
  return (
    <Shell>
      <div className="flex items-center gap-3 text-sm text-text-muted py-4">
        <Loader2 className="w-4 h-4 animate-spin text-brand-info" />
        Đang tải dữ liệu học tập của bạn...
      </div>
    </Shell>
  );
}

export function ConfigNeededScreen() {
  return (
    <Shell>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-brand-warning text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          Chưa cấu hình Supabase
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Ứng dụng cần biến môi trường <strong>VITE_SUPABASE_URL</strong> và{" "}
          <strong>VITE_SUPABASE_ANON_KEY</strong> để lưu trữ dữ liệu và đăng nhập.
          Hãy điền chúng vào file <code>.env</code> (chạy máy) hoặc trong phần Environment
          Variables trên Vercel, rồi tải lại trang.
        </p>
      </div>
    </Shell>
  );
}

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !supabase) return;
    setStatus("sending");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message || "Không gửi được liên kết đăng nhập.");
    } else {
      setStatus("sent");
    }
  };

  if (status === "sent") {
    return (
      <Shell>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-brand-success text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Đã gửi liên kết đăng nhập
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Mở email <strong>{email}</strong> và bấm vào liên kết để đăng nhập. Bạn có thể
            đóng tab này sau khi bấm liên kết.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="text-xs text-brand-info hover:underline"
          >
            Gửi lại / đổi email
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={sendLink} className="space-y-3">
        <p className="text-xs text-text-muted leading-relaxed">
          Đăng nhập bằng email để lưu và đồng bộ dữ liệu học tập của bạn. Hệ thống sẽ gửi một
          liên kết đăng nhập tới email (không cần mật khẩu).
        </p>
        <div>
          <label className="text-2xs text-text-muted block mb-1">Email của bạn</label>
          <div className="flex items-center gap-2 bg-bg-surface border border-border-primary rounded-xl px-3">
            <Mail className="w-4 h-4 text-text-muted shrink-0" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@email.com"
              className="w-full bg-transparent py-2.5 text-sm text-text-primary focus:outline-none"
            />
          </div>
        </div>
        {status === "error" && (
          <div className="text-2xs text-brand-error flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {errorMsg}
          </div>
        )}
        <button
          type="submit"
          disabled={status === "sending" || !email.trim()}
          className="w-full py-2.5 bg-text-primary text-bg-card font-semibold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {status === "sending" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...
            </>
          ) : (
            "Gửi liên kết đăng nhập"
          )}
        </button>
      </form>
    </Shell>
  );
}
