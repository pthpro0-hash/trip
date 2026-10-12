-- 내 여행 스케치 · 빠진 곳 추천하기
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- schema.sql 을 먼저 실행해 두어야 한다. 여러 번 실행해도 안전하다.

-- ═══════════════════════════════════════════════
-- 이용자가 "이 곳이 목록에 있으면 좋겠어요" 하고 추천하면 표에 쌓이고, 관리자(사장님)가 /admin/suggestions 에서 반영 여부를
-- 정한다(반영 예정 · 이미 있음 · 이번엔 어려워요). 목록에 실제로 넣는 일은 개발로 한다 — 이 표는 추천과 결정의 기록이다.
--
-- 관리자는 app_admins 에 적힌 사람이다. 넣고 빼는 것은 SQL Editor 에서만 한다(아래 맨 끝 예시).
-- ═══════════════════════════════════════════════

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.app_admins enable row level security;

-- 본인이 관리자인지 알아보는 용도 — 본인 줄만 읽는다. 쓰기 정책은 두지 않는다(SQL Editor 에서만).
drop policy if exists "app_admins_select_own" on public.app_admins;
create policy "app_admins_select_own" on public.app_admins for select using (auth.uid() = user_id);

-- 정책 안에서 app_admins 를 조회해도 재귀하지 않도록 정의자 권한으로 둔다.
create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

create table if not exists public.spot_suggestions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(name) between 1 and 60),
  place      text check (place is null or length(place) <= 100),
  reason     text check (reason is null or length(reason) <= 200),
  status     text not null default 'new' check (status in ('new', 'planned', 'duplicate', 'declined')),
  admin_note text check (admin_note is null or length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spot_suggestions_user_idx on public.spot_suggestions (user_id, created_at desc);
create index if not exists spot_suggestions_status_idx on public.spot_suggestions (status, created_at desc);

alter table public.spot_suggestions enable row level security;

drop policy if exists "spot_suggestions_select_own" on public.spot_suggestions;
drop policy if exists "spot_suggestions_select_admin" on public.spot_suggestions;
drop policy if exists "spot_suggestions_insert_own" on public.spot_suggestions;
drop policy if exists "spot_suggestions_delete_own" on public.spot_suggestions;
drop policy if exists "spot_suggestions_update_admin" on public.spot_suggestions;

create policy "spot_suggestions_select_own" on public.spot_suggestions for select using (auth.uid() = user_id);
create policy "spot_suggestions_select_admin" on public.spot_suggestions for select using (public.is_app_admin());
-- 이용자는 '검토 중'으로만 낼 수 있고 관리자 메모는 못 단다.
create policy "spot_suggestions_insert_own" on public.spot_suggestions for insert
  with check (auth.uid() = user_id and status = 'new' and admin_note is null);
-- 이용자는 아직 검토 전인 자기 추천만 거둘 수 있다.
create policy "spot_suggestions_delete_own" on public.spot_suggestions for delete
  using (auth.uid() = user_id and status = 'new');
-- 상태와 메모를 바꾸는 것은 관리자뿐이다(이용자용 수정 정책은 없다).
create policy "spot_suggestions_update_admin" on public.spot_suggestions for update
  using (public.is_app_admin()) with check (public.is_app_admin());

-- 한 사람이 검토 전 추천을 다섯 건까지만 쌓아 둘 수 있다(장난 글로 표가 넘치지 않게).
create or replace function public.spot_suggestions_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.spot_suggestions where user_id = new.user_id and status = 'new') >= 5 then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists spot_suggestions_limit_trg on public.spot_suggestions;
create trigger spot_suggestions_limit_trg before insert on public.spot_suggestions
  for each row execute function public.spot_suggestions_limit();

-- 관리자 등록(한 번만, 본인 계정의 id 로):
--   Authentication → Users 에서 내 계정의 UID 를 복사해
--   insert into public.app_admins (user_id) values ('여기에-UID') on conflict do nothing;
