-- 내 여행 스케치 · 여행 하나(상세 페이지)를 링크로 보여 주기
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- schema.sql 과 share.sql 을 먼저 실행해 두어야 한다. 여러 번 실행해도 안전하다.

-- ═══════════════════════════════════════════════
-- 보여 줄 여행 하나
--
-- 한 장 요약 링크(share.sql)와 같은 방식이다. 링크를 만들 때 그 순간의
-- 모습을 베껴 두고, 남이 보는 페이지는 그 베낀 것 한 줄만 읽는다. 여행
-- 기록 표에는 닿지 않으므로 다른 여행이나 다른 페이지는 볼 길이 없다.
--
-- 한 여행에 링크 하나. 다시 만들면 같은 링크의 내용만 새로 바뀐다.
-- 끊으면 줄이 지워지고, 다시 만들면 새 링크가 된다.
-- 여행을 지우면 줄도 함께 지워진다(on delete cascade). 링크 보관함의
-- 사진은 앱이 여행을 지울 때 함께 치운다.
-- ═══════════════════════════════════════════════

create table if not exists public.trip_shares (
  id         text        primary key check (id ~ '^[A-Za-z0-9_-]{16,64}$'),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  trip_id    uuid        not null references public.trips (id) on delete cascade,
  snapshot   jsonb       not null check (octet_length(snapshot::text) < 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trip_id)
);

alter table public.trip_shares drop constraint if exists trip_shares_snapshot_check;
alter table public.trip_shares add constraint trip_shares_snapshot_check check (octet_length(snapshot::text) < 1000000);

alter table public.trip_shares enable row level security;

drop policy if exists "trip_shares_select_own" on public.trip_shares;
drop policy if exists "trip_shares_insert_own" on public.trip_shares;
drop policy if exists "trip_shares_update_own" on public.trip_shares;
drop policy if exists "trip_shares_delete_own" on public.trip_shares;

create policy "trip_shares_select_own" on public.trip_shares
  for select using (auth.uid() = user_id);
-- 남의 여행으로 링크를 만들 수 없게 여행의 주인도 함께 본다.
create policy "trip_shares_insert_own" on public.trip_shares
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );
create policy "trip_shares_update_own" on public.trip_shares
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trip_shares_delete_own" on public.trip_shares
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════
-- 링크 주소는 한 번 쓰면 다시 쓰지 못한다
--
-- 한 장 요약 링크와 같은 장부(sketch_share_ids)를 쓴다. 두 종류의 링크가
-- 같은 주소를 나눠 갖는 일도, 끊은 주소가 되살아나는 일도 없다.
-- 주소를 적는 함수(sketch_shares_claim_id)는 share.sql 에서 이미 만들어 두었다.
-- ═══════════════════════════════════════════════

create or replace function public.trip_shares_keep_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.trip_id is distinct from old.trip_id then
    raise exception 'trip_shares: 링크 주소와 주인, 여행은 바꿀 수 없다';
  end if;
  return new;
end;
$$;

revoke all on function public.trip_shares_keep_id() from public;

drop trigger if exists trip_shares_claim_id on public.trip_shares;
create trigger trip_shares_claim_id
  before insert on public.trip_shares
  for each row execute function public.sketch_shares_claim_id();

drop trigger if exists trip_shares_keep_id on public.trip_shares;
create trigger trip_shares_keep_id
  before update on public.trip_shares
  for each row execute function public.trip_shares_keep_id();

-- ═══════════════════════════════════════════════
-- 남이 보는 길 — 링크를 정확히 아는 사람에게만 그 여행 하나.
--
-- 표는 닫아 두고, id 하나를 받아 그 한 줄만 돌려주는 함수만 연다.
-- ═══════════════════════════════════════════════

create or replace function public.shared_trip(share_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', id, 'snapshot', snapshot, 'updatedAt', updated_at)
  from public.trip_shares
  where id = share_id;
$$;

revoke all on function public.shared_trip(text) from public;
grant execute on function public.shared_trip(text) to anon, authenticated;

-- ═══════════════════════════════════════════════
-- 링크에 딸린 사진 — 한 장 요약 링크와 같은 보관함(shared-sketches)
--
--   shared-sketches/<링크 id>/<파일>
--
-- 폴더 이름이 링크 id 라 주소에 사용자 id 가 드러나지 않는다. 올리고 지우는
-- 것은 그 링크의 주인만 한다. 아래 정책은 share.sql 의 정책과 나란히 걸리며
-- (정책은 하나라도 맞으면 통과), 이 여행 링크의 폴더에만 해당한다.
-- 정책 안에서 storage.objects 를 다시 읽지 않는다(share.sql 의 주의 참고).
-- ═══════════════════════════════════════════════

drop policy if exists "shared_trips_read_own"   on storage.objects;
drop policy if exists "shared_trips_insert_own" on storage.objects;
drop policy if exists "shared_trips_update_own" on storage.objects;
drop policy if exists "shared_trips_delete_own" on storage.objects;

create policy "shared_trips_read_own" on storage.objects
  for select using (
    bucket_id = 'shared-sketches'
    and (storage.foldername(name))[1] in (select id from public.trip_shares where user_id = auth.uid())
  );

create policy "shared_trips_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'shared-sketches'
    and (storage.foldername(name))[1] in (select id from public.trip_shares where user_id = auth.uid())
  );

create policy "shared_trips_update_own" on storage.objects
  for update using (
    bucket_id = 'shared-sketches'
    and (storage.foldername(name))[1] in (select id from public.trip_shares where user_id = auth.uid())
  );

create policy "shared_trips_delete_own" on storage.objects
  for delete using (
    bucket_id = 'shared-sketches'
    and (storage.foldername(name))[1] in (select id from public.trip_shares where user_id = auth.uid())
  );

-- 계정을 지울 때는 그 사람의 링크 폴더도 지워야 한다. 줄 없이 남은 폴더는
-- share.sql 끝에 적어 둔 검색으로 찾는다. 그 검색은 한 장 요약 링크만
-- 기준으로 하므로, 여행 링크가 생긴 뒤에는 아래로 바꿔 쓴다.
--
--   select distinct (storage.foldername(name))[1] as folder
--   from storage.objects
--   where bucket_id = 'shared-sketches'
--     and (storage.foldername(name))[1] not in (select id from public.sketch_shares)
--     and (storage.foldername(name))[1] not in (select id from public.trip_shares);
