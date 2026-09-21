-- 여행세상 · 개인화 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- 여러 번 실행해도 안전하다.

-- ─────────────────────────────────────────────
-- 가고 싶은 곳
-- 순서가 없고 얼마든지 쌓인다.
-- ─────────────────────────────────────────────
create table if not exists public.wishlist (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  spot_id  text        not null,
  added_at timestamptz not null default now(),
  primary key (user_id, spot_id)
);

-- ─────────────────────────────────────────────
-- 이번 여행
-- 순서가 전부다. position 으로 다닐 차례를 담는다.
-- ─────────────────────────────────────────────
create table if not exists public.trip_plan (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  spot_id  text        not null,
  position integer     not null,
  added_at timestamptz not null default now(),
  primary key (user_id, spot_id)
);

create index if not exists trip_plan_order_idx on public.trip_plan (user_id, position);

-- ─────────────────────────────────────────────
-- 행 수준 보안
--
-- 이게 없으면 anon 키를 가진 누구나 남의 목록을 읽는다. anon 키는
-- 브라우저에 그대로 노출되므로, 실제 보호는 전적으로 여기에 달려 있다.
-- ─────────────────────────────────────────────
alter table public.wishlist  enable row level security;
alter table public.trip_plan enable row level security;

drop policy if exists "wishlist_select_own" on public.wishlist;
drop policy if exists "wishlist_insert_own" on public.wishlist;
drop policy if exists "wishlist_delete_own" on public.wishlist;

create policy "wishlist_select_own" on public.wishlist
  for select using (auth.uid() = user_id);
create policy "wishlist_insert_own" on public.wishlist
  for insert with check (auth.uid() = user_id);
create policy "wishlist_delete_own" on public.wishlist
  for delete using (auth.uid() = user_id);

drop policy if exists "trip_plan_select_own" on public.trip_plan;
drop policy if exists "trip_plan_insert_own" on public.trip_plan;
drop policy if exists "trip_plan_update_own" on public.trip_plan;
drop policy if exists "trip_plan_delete_own" on public.trip_plan;

create policy "trip_plan_select_own" on public.trip_plan
  for select using (auth.uid() = user_id);
create policy "trip_plan_insert_own" on public.trip_plan
  for insert with check (auth.uid() = user_id);
create policy "trip_plan_update_own" on public.trip_plan
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trip_plan_delete_own" on public.trip_plan
  for delete using (auth.uid() = user_id);

-- 계정을 지우면 담아둔 것도 함께 사라진다 (위 references 의 on delete cascade).
