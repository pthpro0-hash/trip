-- 내 여행 스케치 · 고친 곳 이름 기억하기
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- schema.sql 을 먼저 실행해 두어야 한다. 여러 번 실행해도 안전하다.

-- ═══════════════════════════════════════════════
-- 지도 서비스가 지어 주는 곳 이름은 자주 틀린다. 사람이 한 번 고치면
-- 그 자리(좌표)와 이름을 적어 두고, 다음에 같은 자리 사진을 가져올 때
-- 그 이름을 먼저 붙인다. 같은 곳을 매번 다시 고치게 하지 않는다.
--
-- 한 자리에는 이름 하나. 가까운 자리를 다시 고치면 화면이 옛것을 지우고
-- 새로 적는다(lib/supabase/placeNames.ts).
-- ═══════════════════════════════════════════════

create table if not exists public.place_names (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  name       text        not null check (length(name) between 1 and 80),
  updated_at timestamptz not null default now()
);

create index if not exists place_names_user_idx on public.place_names (user_id);

alter table public.place_names enable row level security;

drop policy if exists "place_names_select_own" on public.place_names;
drop policy if exists "place_names_insert_own" on public.place_names;
drop policy if exists "place_names_update_own" on public.place_names;
drop policy if exists "place_names_delete_own" on public.place_names;

create policy "place_names_select_own" on public.place_names
  for select using (auth.uid() = user_id);
create policy "place_names_insert_own" on public.place_names
  for insert with check (auth.uid() = user_id);
create policy "place_names_update_own" on public.place_names
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "place_names_delete_own" on public.place_names
  for delete using (auth.uid() = user_id);

-- 같은 이름으로 다녀온 때를 모아 볼 때 이름으로 찾는다.
create index if not exists visits_user_place_idx on public.visits (user_id, place_name);
