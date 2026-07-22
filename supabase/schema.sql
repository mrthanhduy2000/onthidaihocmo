-- ============================================================
--  Lược đồ Supabase cho app Ôn thi (mô hình 1 người dùng, đồng bộ toàn bộ trạng thái)
--  Chạy file này trong Supabase Dashboard > SQL Editor > New query > Run.
-- ============================================================

-- Bảng lưu toàn bộ trạng thái học tập của mỗi người dùng dưới dạng JSON.
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Bật Row Level Security: mỗi người chỉ đọc/ghi được đúng dòng của mình.
alter table public.app_state enable row level security;

-- Xóa policy cũ nếu chạy lại (để idempotent).
drop policy if exists "app_state_select_own" on public.app_state;
drop policy if exists "app_state_insert_own" on public.app_state;
drop policy if exists "app_state_update_own" on public.app_state;

create policy "app_state_select_own"
  on public.app_state for select
  using (auth.uid() = user_id);

create policy "app_state_insert_own"
  on public.app_state for insert
  with check (auth.uid() = user_id);

create policy "app_state_update_own"
  on public.app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
