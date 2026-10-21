-- 내 여행 스케치 · 회원 등급(사진 보관 한도) · 등업 신청 · 관리자
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- schema.sql · family.sql · spotSuggest.sql 을 먼저 실행해 두어야 한다. 여러 번 실행해도 안전하다.
--
-- 이 파일 하나만 실행하면 된다 — 관리자 "이 계정 보기"(보기 전용)에 필요한 family_can 도 아래에서 다시 정의한다(family.sql 과 같은 것).

-- ═══════════════════════════════════════════════
-- 등급
--
--   1등급 무제한 · 2등급 2,000장 · 3등급 1,000장 · 4등급 500장(기본)
--
-- 세는 것은 내 여행에 보관한 사진(trip_photos)의 장수다. 가족이 내 여행에 더한 사진도 여행 주인의 장수로 센다(그 줄의
-- user_id 가 주인이다). 엽서·가족 사진첩으로 보낸 사진(postcards 보관함의 복사본)과 공유용 한 장(shared-sketches)은 세지 않는다.
-- 여행별 한도는 없다. 사진 없이 남기는 기록은 한도와 상관없다.
--
-- 등급 줄이 없는 사람은 4등급이다(새로 가입한 사람). 등급을 바꾸는 것은 관리자 함수(admin_set_grade)와 등업 승인뿐이다.
-- ═══════════════════════════════════════════════

-- 관리자 표와 확인 함수는 spotSuggest.sql 에 있다. 이 파일만 먼저 실행돼도 돌도록 같은 것을 한 번 더 둔다.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.app_admins enable row level security;
drop policy if exists "app_admins_select_own" on public.app_admins;
create policy "app_admins_select_own" on public.app_admins for select using (auth.uid() = user_id);

create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- 관리자는 누구의 여행이든 '보기'만 할 수 있다(관리자 페이지의 "이 계정 보기"). family.sql 의 것과 똑같이 둔다 — 어느 파일을
-- 나중에 실행해도 같은 함수가 남는다.
create or replace function public.family_can(owner uuid, need text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if auth.uid() = owner then
    return true;
  end if;
  if exists (
    select 1
    from public.family_links l
    where l.owner_id = owner
      and l.member_id = auth.uid()
      and (case l.role when 'view' then 1 when 'edit' then 2 when 'full' then 3 else 0 end)
        >= (case need when 'view' then 1 when 'edit' then 2 when 'full' then 3 else 99 end)
  ) then
    return true;
  end if;
  if need = 'view' and to_regclass('public.app_admins') is not null then
    if exists (select 1 from public.app_admins a where a.user_id = auth.uid()) then
      return true;
    end if;
  end if;
  return false;
end;
$$;

create table if not exists public.member_grades (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  grade      smallint    not null check (grade between 1 and 4),
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users (id) on delete set null
);

alter table public.member_grades enable row level security;

-- 자기 등급만 읽는다. 쓰기 정책은 두지 않는다 — 관리자 함수와 등업 승인만 바꾼다.
drop policy if exists "member_grades_select_own" on public.member_grades;
create policy "member_grades_select_own" on public.member_grades for select using (auth.uid() = user_id);

/** 등급의 보관 한도. null 은 무제한. */
create or replace function public.grade_limit(g integer)
returns integer
language sql
immutable
as $$
  select case g when 1 then null when 2 then 2000 when 3 then 1000 else 500 end;
$$;

-- 그 사람의 등급. 줄이 없으면 4(기본). 남의 등급을 캐묻는 데 쓰이지 않게 바깥에는 열지 않는다(아래 함수들이 안에서만 쓴다).
create or replace function public.grade_of(uid uuid)
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select grade from public.member_grades where user_id = uid), 4)::smallint;
$$;

revoke all on function public.grade_of(uuid) from public;
-- Supabase 는 새 함수를 anon·authenticated 에게도 따로 열어 준다. 남의 등급을 캐묻지 못하게 그쪽도 닫는다.
revoke all on function public.grade_of(uuid) from anon, authenticated;

-- ═══════════════════════════════════════════════
-- 보관 한도와 사용량.
--
-- 화면은 이것으로 "사진 보관 312 / 500장"을 그리고, 올리기 전에 남은 자리를 센다. owner 를 비우면 나, 주면 그 사람 —
-- 가족 여행에 사진을 더하는 사람은 여행 주인의 자리를 봐야 한다. 볼 권한(family_can view)이 없으면 null.
-- ═══════════════════════════════════════════════

create or replace function public.photo_quota(owner uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(owner, auth.uid());
  g smallint;
  used integer;
begin
  if auth.uid() is null or not public.family_can(target, 'view') then
    return null;
  end if;
  g := public.grade_of(target);
  select count(*) into used from public.trip_photos where user_id = target;
  return json_build_object('grade', g, 'limit', public.grade_limit(g), 'used', used);
end;
$$;

revoke all on function public.photo_quota(uuid) from public;
grant execute on function public.photo_quota(uuid) to authenticated;

-- ═══════════════════════════════════════════════
-- 한도를 지키는 것은 DB 다. 화면에서만 막으면 우회된다.
--
-- 사진 줄을 넣기 직전에 주인의 장수를 센다. 여러 장을 나란히 올려도 넘지 않도록 주인마다 잠금을 잡고 센다(잠금은 그 줄을 넣는
-- 거래가 끝날 때 풀린다). 넘으면 'photo_quota' 로 거절한다 — 올리는 쪽(lib/supabase/photos)이 이 말을 보고 "자리가 없어 못 올림"
-- 으로 센다.
-- ═══════════════════════════════════════════════

create or replace function public.trip_photos_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer;
  used integer;
begin
  lim := public.grade_limit(public.grade_of(new.user_id));
  if lim is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('trip_photos_quota:' || new.user_id::text));
  select count(*) into used from public.trip_photos where user_id = new.user_id;
  if used >= lim then
    raise exception 'photo_quota' using errcode = 'P0001', hint = format('limit %s', lim);
  end if;
  return new;
end;
$$;

revoke all on function public.trip_photos_quota() from public;
revoke all on function public.trip_photos_quota() from anon, authenticated;

drop trigger if exists trip_photos_quota on public.trip_photos;
create trigger trip_photos_quota before insert on public.trip_photos
  for each row execute function public.trip_photos_quota();

-- ═══════════════════════════════════════════════
-- 등업 신청.
--
-- 지금보다 높은 등급(숫자가 작은 쪽)만 신청한다. 한 사람에게 검토 전 신청은 하나뿐 — 검토가 끝나야 다시 낸다.
-- 신청은 request_grade 로만 넣는다(표에 직접 쓰는 정책이 없다). 결정은 관리자가 admin_decide_request 로 한다.
-- ═══════════════════════════════════════════════

create table if not exists public.grade_requests (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  from_grade smallint    not null check (from_grade between 1 and 4),
  to_grade   smallint    not null check (to_grade between 1 and 3),
  message    text        check (message is null or length(message) <= 300),
  status     text        not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  admin_note text        check (admin_note is null or length(admin_note) <= 300),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid        references auth.users (id) on delete set null
);

create unique index if not exists grade_requests_one_pending on public.grade_requests (user_id) where status = 'pending';
create index if not exists grade_requests_user_idx on public.grade_requests (user_id, created_at desc);

alter table public.grade_requests enable row level security;

drop policy if exists "grade_requests_select_own" on public.grade_requests;
create policy "grade_requests_select_own" on public.grade_requests for select using (auth.uid() = user_id);

/** 'ok' · 'login'(로그인 전) · 'invalid'(지금보다 높은 등급이 아니거나 글이 길다) · 'pending'(검토 전 신청이 이미 있다). */
create or replace function public.request_grade(to_grade integer, message text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  current_grade smallint;
  body text := nullif(btrim(coalesce(message, '')), '');
begin
  if me is null then
    return 'login';
  end if;
  current_grade := public.grade_of(me);
  if to_grade is null or to_grade < 1 or to_grade >= current_grade or (body is not null and length(body) > 300) then
    return 'invalid';
  end if;
  if exists (select 1 from public.grade_requests r where r.user_id = me and r.status = 'pending') then
    return 'pending';
  end if;
  insert into public.grade_requests (user_id, from_grade, to_grade, message)
  values (me, current_grade, to_grade, body);
  return 'ok';
end;
$$;

revoke all on function public.request_grade(integer, text) from public;
grant execute on function public.request_grade(integer, text) to authenticated;

/** 검토 전 신청을 거둔다. 거둘 것이 없으면 false. */
create or replace function public.cancel_grade_request()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  delete from public.grade_requests where user_id = auth.uid() and status = 'pending';
  return found;
end;
$$;

revoke all on function public.cancel_grade_request() from public;
grant execute on function public.cancel_grade_request() to authenticated;

-- ═══════════════════════════════════════════════
-- 관리자 기록.
--
-- 등급을 바꾸거나 신청을 결정하거나 남의 계정을 "보기"로 연 일은 누가·언제·누구에게 했는지 남긴다. 표에는 정책이 없어
-- 화면에서 직접 읽고 쓸 수 없다 — 아래 함수들만 넣는다. 들여다볼 때는 SQL Editor 에서 읽는다.
-- ═══════════════════════════════════════════════

create table if not exists public.admin_audit (
  id         bigint      generated always as identity primary key,
  admin_id   uuid        references auth.users (id) on delete set null,
  action     text        not null check (action in ('set_grade', 'decide_request', 'view_account')),
  target_id  uuid        references auth.users (id) on delete set null,
  detail     jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit enable row level security;

create or replace function public.admin_log(action text, target uuid, detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if action not in ('view_account') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  insert into public.admin_audit (admin_id, action, target_id, detail) values (auth.uid(), action, target, coalesce(detail, '{}'::jsonb));
end;
$$;

revoke all on function public.admin_log(text, uuid, jsonb) from public;
grant execute on function public.admin_log(text, uuid, jsonb) to authenticated;

-- ═══════════════════════════════════════════════
-- 관리자 — 회원 목록.
--
-- 이메일은 auth.users 에 있어 일반 정책으로는 읽지 못한다. 관리자 확인을 안에서 하고 정의자 권한으로 읽는다.
-- q 는 이메일 일부, sort 는 'recent'(최근 가입) 또는 'photos'(사진 많은 순). 한 번에 최대 200줄.
-- ═══════════════════════════════════════════════

create or replace function public.admin_members(q text default null, sort text default 'recent', lim integer default 50, off integer default 0)
returns table (
  user_id         uuid,
  email           text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  grade           smallint,
  photo_count     bigint,
  trip_count      bigint,
  pending_to      smallint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
#variable_conflict use_column
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
  with base as (
    select
      u.id as uid,
      u.email::text as mail,
      u.created_at as joined,
      u.last_sign_in_at as seen,
      public.grade_of(u.id) as g,
      (select count(*) from public.trip_photos p where p.user_id = u.id) as photos,
      (select count(*) from public.trips t where t.user_id = u.id) as trips,
      (select r.to_grade from public.grade_requests r where r.user_id = u.id and r.status = 'pending' limit 1) as asked
    from auth.users u
    where coalesce(btrim(q), '') = '' or u.email ilike '%' || btrim(q) || '%'
  )
  select uid, mail, joined, seen, g, photos, trips, asked
  from base
  order by case when sort = 'photos' then photos end desc nulls last, joined desc
  limit least(greatest(coalesce(lim, 50), 1), 200)
  offset greatest(coalesce(off, 0), 0);
end;
$$;

revoke all on function public.admin_members(text, text, integer, integer) from public;
grant execute on function public.admin_members(text, text, integer, integer) to authenticated;

/** 등급을 바꾼다. 검토 전 신청이 이 등급 이상을 바란 것이면 승인으로 닫는다. */
create or replace function public.admin_set_grade(target uuid, g integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before_grade smallint;
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if g is null or g < 1 or g > 4 then
    raise exception 'invalid_grade' using errcode = '22023';
  end if;
  before_grade := public.grade_of(target);
  insert into public.member_grades (user_id, grade, updated_at, updated_by)
  values (target, g, now(), auth.uid())
  on conflict (user_id) do update set grade = excluded.grade, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  update public.grade_requests
    set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where user_id = target and status = 'pending' and to_grade >= g;
  insert into public.admin_audit (admin_id, action, target_id, detail)
  values (auth.uid(), 'set_grade', target, jsonb_build_object('from', before_grade, 'to', g));
end;
$$;

revoke all on function public.admin_set_grade(uuid, integer) from public;
grant execute on function public.admin_set_grade(uuid, integer) to authenticated;

-- ═══════════════════════════════════════════════
-- 관리자 — 등업 신청 목록과 결정.
--
-- 검토 전 신청 전부와, 최근에 결정한 것 30개. 신청한 사람의 이메일과 지금 등급·사진 장수를 함께 준다.
-- ═══════════════════════════════════════════════

create or replace function public.admin_grade_requests()
returns table (
  id          uuid,
  user_id     uuid,
  email       text,
  from_grade  smallint,
  to_grade    smallint,
  grade_now   smallint,
  photo_count bigint,
  message     text,
  status      text,
  admin_note  text,
  created_at  timestamptz,
  decided_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
#variable_conflict use_column
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
  (
    select r.id, r.user_id, u.email::text, r.from_grade, r.to_grade, public.grade_of(r.user_id),
      (select count(*) from public.trip_photos p where p.user_id = r.user_id),
      r.message, r.status, r.admin_note, r.created_at, r.decided_at
    from public.grade_requests r
    left join auth.users u on u.id = r.user_id
    where r.status = 'pending'
    order by r.created_at
  )
  union all
  (
    select r.id, r.user_id, u.email::text, r.from_grade, r.to_grade, public.grade_of(r.user_id),
      (select count(*) from public.trip_photos p where p.user_id = r.user_id),
      r.message, r.status, r.admin_note, r.created_at, r.decided_at
    from public.grade_requests r
    left join auth.users u on u.id = r.user_id
    where r.status <> 'pending'
    order by r.decided_at desc nulls last
    limit 30
  );
end;
$$;

revoke all on function public.admin_grade_requests() from public;
grant execute on function public.admin_grade_requests() to authenticated;

/** 신청을 승인하거나 거절한다. 승인하면 그 등급으로 바꾼다. 이미 결정된 신청이면 false. */
create or replace function public.admin_decide_request(request uuid, approve boolean, note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  row_found public.grade_requests%rowtype;
  memo text := nullif(btrim(coalesce(note, '')), '');
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if memo is not null and length(memo) > 300 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  select * into row_found from public.grade_requests where id = request and status = 'pending' for update;
  if not found then
    return false;
  end if;
  update public.grade_requests
    set status = case when approve then 'approved' else 'declined' end,
        admin_note = memo,
        decided_at = now(),
        decided_by = auth.uid()
    where id = request;
  if approve then
    insert into public.member_grades (user_id, grade, updated_at, updated_by)
    values (row_found.user_id, row_found.to_grade, now(), auth.uid())
    on conflict (user_id) do update set grade = excluded.grade, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;
  insert into public.admin_audit (admin_id, action, target_id, detail)
  values (auth.uid(), 'decide_request', row_found.user_id,
    jsonb_build_object('request', request, 'approve', approve, 'from', row_found.from_grade, 'to', row_found.to_grade));
  return true;
end;
$$;

revoke all on function public.admin_decide_request(uuid, boolean, text) from public;
grant execute on function public.admin_decide_request(uuid, boolean, text) to authenticated;

-- ═══════════════════════════════════════════════
-- 처음 한 번 — 공개 전에 가입해 있던 계정은 모두 1등급(무제한)으로 둔다.
--
-- 날짜를 못 박아 둔다: 이 파일을 나중에 다시 실행해도, 그 사이 새로 가입한 사람이 1등급이 되지 않는다. 이미 등급이 있는
-- 사람은 건드리지 않는다(on conflict do nothing).
-- ═══════════════════════════════════════════════

insert into public.member_grades (user_id, grade)
select id, 1 from auth.users where created_at < timestamptz '2026-10-23 00:00:00+09'
on conflict (user_id) do nothing;

-- 관리자를 더하거나 뺄 때(SQL Editor 에서만):
--   insert into public.app_admins (user_id) values ('여기에-UID') on conflict do nothing;
--   delete from public.app_admins where user_id = '여기에-UID';
-- 등급을 손으로 바꿀 때는 관리자 페이지(/admin)를 쓴다. 기록이 남는다.
