-- 나만의 여행 스케치 · 개인화 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- 여러 번 실행해도 안전하다.

-- ═══════════════════════════════════════════════
-- 담아두는 것
-- ═══════════════════════════════════════════════

-- 가고 싶은 곳 — 순서가 없고 얼마든지 쌓인다.
create table if not exists public.wishlist (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  spot_id  text        not null,
  added_at timestamptz not null default now(),
  primary key (user_id, spot_id)
);

-- 이번 여행 — 순서가 전부다.
create table if not exists public.trip_plan (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  spot_id  text        not null,
  position integer     not null,
  added_at timestamptz not null default now(),
  primary key (user_id, spot_id)
);

create index if not exists trip_plan_order_idx on public.trip_plan (user_id, position);

-- ═══════════════════════════════════════════════
-- 다녀온 것
--
-- 시각을 timestamptz 가 아니라 timestamp 로 둔다.
-- 사진의 EXIF 시각에는 타임존이 없다 — "2026년 9월 13일 오전 9시 21분"이라는
-- 벽시계 값일 뿐이다. timestamptz 로 넣으면 서버 타임존에 따라 해석되어
-- 오전 사진이 전날로 밀린다. 0단계에서 실제로 겪은 버그라 여기서 막아 둔다.
-- ═══════════════════════════════════════════════

create table if not exists public.trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  started_on date not null,
  ended_on   date not null,
  -- 제목을 짓는 것이 곧 "이것들이 한 덩어리"라고 정하는 일이다.
  -- 비워 두면 화면에서 장소로 지어 보여준다.
  title      text,
  -- 부제. 비워 두면 화면이 장소 요약("화진포해변 외 2곳")을 대신 보여준다.
  -- 제목을 사람이 고치면 원래 이름이던 그 요약이 이 자리로 내려온다.
  subtitle   text,
  companions text,                       -- 누구와 갔는지. 자유롭게 적는다.
  note       text,                       -- 그날의 특이사항
  created_at timestamptz not null default now()
);

create index if not exists trips_user_date_idx on public.trips (user_id, started_on desc);

create table if not exists public.visits (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  -- RLS 규칙에서 조인하지 않으려고 사용자도 함께 둔다.
  user_id     uuid not null references auth.users (id) on delete cascade,
  position    integer not null,
  place_name  text not null,
  spot_id     text,                      -- 한국관광 100선 중 하나면 그 id
  lat         double precision not null,
  lng         double precision not null,
  dong        text,                      -- 행정동. 장소 이름이 없을 때의 버팀목.
  started_at  timestamp not null,        -- 벽시계 시각 (위 설명 참고)
  ended_at    timestamp not null,
  photo_count integer not null default 0,
  note        text
);

create index if not exists visits_trip_idx on public.visits (trip_id, position);

create table if not exists public.trip_photos (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references public.visits (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  taken_at     timestamp not null,       -- 벽시계 시각
  lat          double precision,
  lng          double precision,
  is_cover     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists trip_photos_visit_idx on public.trip_photos (visit_id);

-- ═══════════════════════════════════════════════
-- 그해의 한 줄
--
-- 스케치 맨 위에 적히는 문장은 센 값에서 지어 낸다 —
-- "열세 번 길을 나선 해". 쓸 만하지만 그 사람이 기억하는 말은 따로 있다.
-- "민수랑 처음 바다 본 해" 같은 것.
--
-- 자동은 제안, 확정은 사람. 이 서비스가 제목에도 부제에도 장소 이름에도
-- 지켜 온 규칙인데 정작 가장 크게 적히는 이 줄만 못 고치고 있었다.
--
-- 해마다 한 줄이라 여행에 매달 수 없어 따로 둔다. 비우면 지운다 —
-- 그러면 화면이 다시 지어 낸 말로 돌아간다.
-- ═══════════════════════════════════════════════

create table if not exists public.sketch_years (
  user_id  uuid    not null references auth.users (id) on delete cascade,
  year     integer not null,
  headline text    not null,
  primary key (user_id, year)
);

-- ═══════════════════════════════════════════════
-- 행 수준 보안
--
-- anon 키는 브라우저에 그대로 노출된다. 실제 보호는 전적으로 여기에 달려 있다.
-- 이게 없으면 누구나 남의 여행 기록과 사진 목록을 읽는다.
-- ═══════════════════════════════════════════════

alter table public.wishlist    enable row level security;
alter table public.trip_plan   enable row level security;
alter table public.trips       enable row level security;
alter table public.visits      enable row level security;
alter table public.trip_photos enable row level security;
alter table public.sketch_years enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['wishlist', 'trip_plan', 'trips', 'visits', 'trip_photos', 'sketch_years'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);

    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      t || '_delete_own', t);
  end loop;
end $$;

-- 계정을 지우면 담아둔 것도 여행 기록도 사진도 함께 사라진다
-- (위 references 의 on delete cascade).

-- 이미 만들어 둔 표에 제목·부제 칸을 더한다.
alter table public.trips add column if not exists title    text;
alter table public.trips add column if not exists subtitle text;
