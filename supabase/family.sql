-- 내 여행 스케치 · 가족 공유
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- schema.sql · storage.sql · placeNames.sql 을 먼저 실행해 두어야 한다.
-- 여러 번 실행해도 안전하다.

-- ═══════════════════════════════════════════════
-- 내 기록에 가족을 들인다.
--
-- 링크 공유(share.sql)는 베낀 한 장을 보여 주는 것이라 표에 닿지 않는다. 가족은
-- 다르다 — 내 여행 표 자체를 같이 읽고(권한에 따라) 고치고 더하고 지운다.
-- 그래서 규칙은 화면이 아니라 여기, DB 에 둔다. 화면에서 단추를 숨기는 것은
-- 친절일 뿐이고, 막는 것은 아래 정책이다.
--
-- 권한 (낮은 것부터, 높은 것은 낮은 것을 모두 포함한다)
--   view  보기만
--   edit  수정만 — 고칠 수 있다. 더하거나 지울 수는 없다.
--   full  추가도 가능 — 여행·사진을 더하고 지운다(삭제 포함).
--
-- 가족이 더한 것은 주인의 자료로 쌓인다(user_id 가 곧 주인). 누가 올렸는지는 적지
-- 않는다.
-- ═══════════════════════════════════════════════

-- 연결된 가족. (주인, 가족) 한 쌍에 한 줄.
create table if not exists public.family_links (
  owner_id   uuid        not null references auth.users (id) on delete cascade,
  member_id  uuid        not null references auth.users (id) on delete cascade,
  role       text        not null check (role in ('view', 'edit', 'full')),
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  check (owner_id <> member_id)
);

create index if not exists family_links_member_idx on public.family_links (member_id);

-- 초대. 주인이 권한을 골라 만들고, 가족이 링크를 열어 수락하면 한 번 쓰이고 닫힌다.
create table if not exists public.family_invites (
  -- 링크에 들어가는 무작위 글자. 짐작해서 찾아올 수 없을 만큼 길다.
  token      text        primary key check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  owner_id   uuid        not null references auth.users (id) on delete cascade,
  role       text        not null check (role in ('view', 'edit', 'full')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  -- 수락된 초대. 비어 있으면 아직 쓸 수 있다.
  used_at    timestamptz,
  used_by    uuid        references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists family_invites_owner_idx on public.family_invites (owner_id);

alter table public.family_links enable row level security;
alter table public.family_invites enable row level security;

-- ── 연결 ──────────────────────────────────────────
-- 주인과 가족 둘 다 자기 연결을 본다. 권한은 주인만 바꾼다. 끊는 것은 둘 다 할 수
-- 있다(주인은 해제, 가족은 나가기). 넣는 길은 없다 — 아래 accept_family_invite 로만
-- 연결된다. 그래야 "내가 너를 내 가족으로 정했다"를 남이 멋대로 적지 못한다.
drop policy if exists "family_links_select" on public.family_links;
drop policy if exists "family_links_update" on public.family_links;
drop policy if exists "family_links_delete" on public.family_links;

create policy "family_links_select" on public.family_links
  for select using (auth.uid() = owner_id or auth.uid() = member_id);
create policy "family_links_update" on public.family_links
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "family_links_delete" on public.family_links
  for delete using (auth.uid() = owner_id or auth.uid() = member_id);

-- ── 초대 ──────────────────────────────────────────
-- 만들고 보고 취소하는 것은 주인만. 수락하는 사람은 표를 읽지 않고 함수를 부른다.
drop policy if exists "family_invites_select_own" on public.family_invites;
drop policy if exists "family_invites_insert_own" on public.family_invites;
drop policy if exists "family_invites_delete_own" on public.family_invites;

create policy "family_invites_select_own" on public.family_invites
  for select using (auth.uid() = owner_id);
create policy "family_invites_insert_own" on public.family_invites
  for insert with check (auth.uid() = owner_id and used_at is null and used_by is null);
create policy "family_invites_delete_own" on public.family_invites
  for delete using (auth.uid() = owner_id);

-- ═══════════════════════════════════════════════
-- 가족은 한 사람에게 8명까지.
-- ═══════════════════════════════════════════════

create or replace function public.family_links_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.family_links where owner_id = new.owner_id) >= 8 then
    raise exception 'family_links: 가족은 8명까지 들일 수 있다';
  end if;
  return new;
end;
$$;

revoke all on function public.family_links_limit() from public;

drop trigger if exists family_links_limit on public.family_links;
create trigger family_links_limit
  before insert on public.family_links
  for each row execute function public.family_links_limit();

-- ═══════════════════════════════════════════════
-- 권한 확인 — "이 주인의 자료에, 지금 로그인한 사람이 이 일을 할 수 있나".
--
-- 정책이 family_links 를 직접 읽으면 그 표의 정책과 얽혀 서로를 부르는 재귀가 될 수
-- 있다. security definer 로 한 번에 읽어 그 고리를 끊는다. 이 함수는 로그인한 사람
-- (auth.uid()) 이 자기에게 준 권한만 알려 준다 — 남의 연결을 캐묻는 데는 쓸 수 없다.
--
-- need 는 'view' < 'edit' < 'full'. 주인 본인은 늘 true.
-- ═══════════════════════════════════════════════

create or replace function public.family_can(owner uuid, need text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    auth.uid() = owner
    or exists (
      select 1
      from public.family_links l
      where l.owner_id = owner
        and l.member_id = auth.uid()
        and (case l.role when 'view' then 1 when 'edit' then 2 when 'full' then 3 else 0 end)
          >= (case need when 'view' then 1 when 'edit' then 2 when 'full' then 3 else 99 end)
    )
  );
$$;

revoke all on function public.family_can(uuid, text) from public;
grant execute on function public.family_can(uuid, text) to authenticated;

-- 보관함 폴더 이름(문자)에서 주인을 읽는다. uuid 가 아니면 오류 대신 false —
-- 이상한 이름의 폴더가 정책 평가를 터뜨리지 않게 한다.
create or replace function public.family_can_folder(folder text, need text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  begin
    owner := folder::uuid;
  exception when others then
    return false;
  end;
  return public.family_can(owner, need);
end;
$$;

revoke all on function public.family_can_folder(text, text) from public;
grant execute on function public.family_can_folder(text, text) to authenticated;

-- ═══════════════════════════════════════════════
-- 초대 수락.
--
-- 로그인한 사람이 링크의 글자를 넘기면: 쓸 수 있는 초대인지(없는 것·만료·이미 쓴 것
-- 거절), 자기 자신의 초대가 아닌지 보고, 연결을 만들고 초대를 닫는다. 이미 연결된
-- 사이면 권한만 새 초대의 것으로 바꾼다(수락이 곧 갱신). 돌려주는 것은 주인의 id.
-- ═══════════════════════════════════════════════

create or replace function public.accept_family_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  invite public.family_invites%rowtype;
begin
  if me is null then
    raise exception 'family: 로그인이 필요하다';
  end if;

  select * into invite from public.family_invites where token = invite_token for update;
  if not found then
    raise exception 'family: 없는 초대다';
  end if;
  if invite.used_at is not null then
    raise exception 'family: 이미 쓴 초대다';
  end if;
  if invite.expires_at <= now() then
    raise exception 'family: 만료된 초대다';
  end if;
  if invite.owner_id = me then
    raise exception 'family: 내 초대는 내가 수락할 수 없다';
  end if;

  if exists (select 1 from public.family_links where owner_id = invite.owner_id and member_id = me) then
    update public.family_links set role = invite.role
      where owner_id = invite.owner_id and member_id = me;
  else
    insert into public.family_links (owner_id, member_id, role)
      values (invite.owner_id, me, invite.role);
  end if;

  update public.family_invites set used_at = now(), used_by = me where token = invite_token;
  return invite.owner_id;
end;
$$;

revoke all on function public.accept_family_invite(text) from public;
grant execute on function public.accept_family_invite(text) to authenticated;

-- ═══════════════════════════════════════════════
-- 가족 목록 화면용 — 누구와 연결되어 있나(이메일 포함).
--
-- 이메일은 auth.users 에 있어 일반 정책으로는 읽지 못한다. 연결된 사이의 상대
-- 이메일만 돌려준다: 내가 주인이면 가족들의 것, 내가 가족이면 나에게 열어 준 주인의
-- 것. 그 밖의 계정은 알 수 없다.
--
--   direction 'owned'  내가 들인 가족    (other = 가족)
--   direction 'shared' 나에게 열어 준 사람 (other = 주인)
-- ═══════════════════════════════════════════════

create or replace function public.family_circle()
returns table (direction text, other_id uuid, other_email text, role text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  select 'owned'::text, l.member_id, u.email::text, l.role, l.created_at
  from public.family_links l
  join auth.users u on u.id = l.member_id
  where l.owner_id = auth.uid()
  union all
  select 'shared'::text, l.owner_id, u.email::text, l.role, l.created_at
  from public.family_links l
  join auth.users u on u.id = l.owner_id
  where l.member_id = auth.uid()
  order by 5;
$$;

revoke all on function public.family_circle() from public;
grant execute on function public.family_circle() to authenticated;

-- ═══════════════════════════════════════════════
-- 여행 자료의 정책.
--
-- 기존 "…_own" 정책(schema.sql)은 그대로 둔다 — 정책은 하나라도 허락하면 통과하므로,
-- 아래 "…_family" 정책이 더해지면 "내 것이거나, 가족 권한이 닿는 것"이 된다. family_can 은
-- 주인 본인에게도 true 라 겹치지만 해롭지 않다.
--
-- 더하는 행도 user_id 는 그 주인의 것이어야 한다(with check). 그래야 가족이 올린 것이
-- 주인의 자료로 쌓이고, 가족 자신의 계정으로 새어 들어가지 않는다.
-- ═══════════════════════════════════════════════

drop policy if exists "trips_select_family" on public.trips;
drop policy if exists "trips_insert_family" on public.trips;
drop policy if exists "trips_update_family" on public.trips;
drop policy if exists "trips_delete_family" on public.trips;

create policy "trips_select_family" on public.trips
  for select using (public.family_can(user_id, 'view'));
create policy "trips_insert_family" on public.trips
  for insert with check (public.family_can(user_id, 'full'));
create policy "trips_update_family" on public.trips
  for update using (public.family_can(user_id, 'edit'))
  with check (public.family_can(user_id, 'edit'));
create policy "trips_delete_family" on public.trips
  for delete using (public.family_can(user_id, 'full'));

drop policy if exists "visits_select_family" on public.visits;
drop policy if exists "visits_insert_family" on public.visits;
drop policy if exists "visits_update_family" on public.visits;
drop policy if exists "visits_delete_family" on public.visits;

create policy "visits_select_family" on public.visits
  for select using (public.family_can(user_id, 'view'));
create policy "visits_insert_family" on public.visits
  for insert with check (public.family_can(user_id, 'full'));
create policy "visits_update_family" on public.visits
  for update using (public.family_can(user_id, 'edit'))
  with check (public.family_can(user_id, 'edit'));
create policy "visits_delete_family" on public.visits
  for delete using (public.family_can(user_id, 'full'));

drop policy if exists "trip_photos_select_family" on public.trip_photos;
drop policy if exists "trip_photos_insert_family" on public.trip_photos;
drop policy if exists "trip_photos_update_family" on public.trip_photos;
drop policy if exists "trip_photos_delete_family" on public.trip_photos;

create policy "trip_photos_select_family" on public.trip_photos
  for select using (public.family_can(user_id, 'view'));
create policy "trip_photos_insert_family" on public.trip_photos
  for insert with check (public.family_can(user_id, 'full'));
create policy "trip_photos_update_family" on public.trip_photos
  for update using (public.family_can(user_id, 'edit'))
  with check (public.family_can(user_id, 'edit'));
create policy "trip_photos_delete_family" on public.trip_photos
  for delete using (public.family_can(user_id, 'full'));

-- 그해의 한 줄·고친 곳 이름은 "수정"이다. 처음 적는 것도, 비워서 지우는 것도 새로 더하는
-- 여행이 아니라 있는 것을 다듬는 일이라 edit 이면 된다.

drop policy if exists "sketch_years_select_family" on public.sketch_years;
drop policy if exists "sketch_years_insert_family" on public.sketch_years;
drop policy if exists "sketch_years_update_family" on public.sketch_years;
drop policy if exists "sketch_years_delete_family" on public.sketch_years;

create policy "sketch_years_select_family" on public.sketch_years
  for select using (public.family_can(user_id, 'view'));
create policy "sketch_years_insert_family" on public.sketch_years
  for insert with check (public.family_can(user_id, 'edit'));
create policy "sketch_years_update_family" on public.sketch_years
  for update using (public.family_can(user_id, 'edit'))
  with check (public.family_can(user_id, 'edit'));
create policy "sketch_years_delete_family" on public.sketch_years
  for delete using (public.family_can(user_id, 'edit'));

drop policy if exists "place_names_select_family" on public.place_names;
drop policy if exists "place_names_insert_family" on public.place_names;
drop policy if exists "place_names_update_family" on public.place_names;
drop policy if exists "place_names_delete_family" on public.place_names;

create policy "place_names_select_family" on public.place_names
  for select using (public.family_can(user_id, 'view'));
create policy "place_names_insert_family" on public.place_names
  for insert with check (public.family_can(user_id, 'edit'));
create policy "place_names_update_family" on public.place_names
  for update using (public.family_can(user_id, 'edit'))
  with check (public.family_can(user_id, 'edit'));
create policy "place_names_delete_family" on public.place_names
  for delete using (public.family_can(user_id, 'edit'));

-- ═══════════════════════════════════════════════
-- 주인 칸(user_id)은 바꿀 수 없다.
--
-- 수정 권한이 있는 가족이 고치기(update)로 user_id 를 자기 것으로 바꾸면, with check
-- 가 새 값(자기 자신)에 대해서도 참이라 통과해 버린다 — 여행 한 건을 통째로 자기
-- 계정으로 옮겨 갈 수 있다. 주인 칸은 어느 쪽 권한으로도 바뀌지 않게 막는다.
-- ═══════════════════════════════════════════════

create or replace function public.keep_row_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception '%: 주인은 바꿀 수 없다', tg_table_name;
  end if;
  return new;
end;
$$;

revoke all on function public.keep_row_owner() from public;

drop trigger if exists keep_row_owner on public.trips;
create trigger keep_row_owner before update on public.trips
  for each row execute function public.keep_row_owner();
drop trigger if exists keep_row_owner on public.visits;
create trigger keep_row_owner before update on public.visits
  for each row execute function public.keep_row_owner();
drop trigger if exists keep_row_owner on public.trip_photos;
create trigger keep_row_owner before update on public.trip_photos
  for each row execute function public.keep_row_owner();
drop trigger if exists keep_row_owner on public.sketch_years;
create trigger keep_row_owner before update on public.sketch_years
  for each row execute function public.keep_row_owner();
drop trigger if exists keep_row_owner on public.place_names;
create trigger keep_row_owner before update on public.place_names
  for each row execute function public.keep_row_owner();

-- ═══════════════════════════════════════════════
-- 사진 보관함(storage.sql 의 폴더 규칙을 가족에게 넓힌다).
--
--   trip-photos/<주인 id>/<방문 id>/<사진 id>.webp
--
-- 맨 앞 칸이 주인의 id 라, 그 주인이 이 사람에게 준 권한으로 읽고 올리고 지운다.
-- 읽기는 보기, 올리기·덮어쓰기·지우기는 추가도 가능. (사진 다시 줄이기 같은 덮어쓰기는
-- 파일을 새로 올리는 일이라 같은 권한이다.)
-- ═══════════════════════════════════════════════

drop policy if exists "photo_files_read_family"   on storage.objects;
drop policy if exists "photo_files_insert_family" on storage.objects;
drop policy if exists "photo_files_update_family" on storage.objects;
drop policy if exists "photo_files_delete_family" on storage.objects;

create policy "photo_files_read_family" on storage.objects
  for select using (
    bucket_id = 'trip-photos'
    and public.family_can_folder((storage.foldername(name))[1], 'view')
  );

create policy "photo_files_insert_family" on storage.objects
  for insert with check (
    bucket_id = 'trip-photos'
    and public.family_can_folder((storage.foldername(name))[1], 'full')
  );

create policy "photo_files_update_family" on storage.objects
  for update using (
    bucket_id = 'trip-photos'
    and public.family_can_folder((storage.foldername(name))[1], 'full')
  );

create policy "photo_files_delete_family" on storage.objects
  for delete using (
    bucket_id = 'trip-photos'
    and public.family_can_folder((storage.foldername(name))[1], 'full')
  );
