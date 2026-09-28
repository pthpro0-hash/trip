-- 나만의 여행 스케치 · 한 장으로 보기를 링크로 보여 주기
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- schema.sql 을 먼저 실행해 두어야 한다. 여러 번 실행해도 안전하다.

-- ═══════════════════════════════════════════════
-- 보여 줄 한 장
--
-- 링크를 만들 때 그 순간의 모습을 **베껴** 둔다. 남이 보는 페이지는 이
-- 베낀 것만 읽고, 여행 기록 표에는 닿지 않는다. 그래서 "지도만"을 고르면
-- 사진 경로는 베낀 것에 아예 들어가지 않는다 — 화면에서 가리는 것이
-- 아니라 처음부터 없다.
--
-- 한 해에 링크 하나. 다시 만들면 같은 링크의 내용만 새로 바뀐다.
-- 끊으면 줄이 지워지고, 다시 만들면 새 링크가 된다 — 끊은 링크는
-- 되살아나지 않는다.
-- ═══════════════════════════════════════════════

create table if not exists public.sketch_shares (
  -- 링크에 들어가는 무작위 글자. 짐작해서 찾아올 수 없을 만큼 길다.
  id         text        primary key check (id ~ '^[A-Za-z0-9_-]{16,64}$'),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  -- 0 은 "전체"(모든 해를 한 장에).
  year       integer     not null check (year = 0 or year between 1900 and 2100),
  scope      text        not null check (scope in ('photos', 'map', 'sido')),
  -- 한 해를 베낀 것이라 크지 않다. 터무니없이 큰 것은 받지 않는다.
  snapshot   jsonb       not null check (octet_length(snapshot::text) < 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year)
);

-- 표가 이미 있을 때도 아래 검사가 걸리게 다시 건다(create table if not
-- exists 는 있는 표를 건드리지 않는다).
alter table public.sketch_shares drop constraint if exists sketch_shares_year_check;
alter table public.sketch_shares add constraint sketch_shares_year_check check (year = 0 or year between 1900 and 2100);
alter table public.sketch_shares drop constraint if exists sketch_shares_snapshot_check;
alter table public.sketch_shares add constraint sketch_shares_snapshot_check check (octet_length(snapshot::text) < 1000000);

alter table public.sketch_shares enable row level security;

drop policy if exists "sketch_shares_select_own" on public.sketch_shares;
drop policy if exists "sketch_shares_insert_own" on public.sketch_shares;
drop policy if exists "sketch_shares_update_own" on public.sketch_shares;
drop policy if exists "sketch_shares_delete_own" on public.sketch_shares;

create policy "sketch_shares_select_own" on public.sketch_shares
  for select using (auth.uid() = user_id);
create policy "sketch_shares_insert_own" on public.sketch_shares
  for insert with check (auth.uid() = user_id);
create policy "sketch_shares_update_own" on public.sketch_shares
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sketch_shares_delete_own" on public.sketch_shares
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════
-- 링크 주소는 바뀌지 않고, 한 번 쓴 주소는 다시 쓰지 못한다.
--
-- 주소가 바뀌면: 보관함 정책은 주소(폴더 이름)로 주인을 가리므로, 예전
--   주소 폴더의 사진을 주인도 지우지 못한 채 공개로 남는다.
-- 끊은 주소를 다시 쓸 수 있으면: 링크를 받아 둔 누군가가 같은 주소로 줄을
--   만들어, 단톡방에 이미 퍼진 그 링크에 자기 내용을 띄울 수 있다.
--
-- 쓴 주소는 따로 적어 둔다. 줄을 지워도(끊기·계정 삭제) 여기는 남는다.
-- 주소 말고는 아무것도 적지 않는다.
-- ═══════════════════════════════════════════════

create table if not exists public.sketch_share_ids (
  id text primary key
);

-- 정책을 두지 않는다 — 아무도 직접 읽거나 쓰지 못하고, 아래 트리거만 적는다.
alter table public.sketch_share_ids enable row level security;

create or replace function public.sketch_shares_claim_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 이미 쓴 주소면 여기서 막힌다(기본 키 중복).
  insert into public.sketch_share_ids (id) values (new.id);
  return new;
end;
$$;

create or replace function public.sketch_shares_keep_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.year is distinct from old.year then
    raise exception 'sketch_shares: 링크 주소와 주인, 해는 바꿀 수 없다';
  end if;
  return new;
end;
$$;

revoke all on function public.sketch_shares_claim_id() from public;
revoke all on function public.sketch_shares_keep_id() from public;

drop trigger if exists sketch_shares_claim_id on public.sketch_shares;
create trigger sketch_shares_claim_id
  before insert on public.sketch_shares
  for each row execute function public.sketch_shares_claim_id();

drop trigger if exists sketch_shares_keep_id on public.sketch_shares;
create trigger sketch_shares_keep_id
  before update on public.sketch_shares
  for each row execute function public.sketch_shares_keep_id();

-- 트리거보다 먼저 만들어진 링크도 쓴 주소로 적어 둔다.
insert into public.sketch_share_ids (id)
select id from public.sketch_shares
on conflict do nothing;

-- ═══════════════════════════════════════════════
-- 남이 보는 길 — 링크를 정확히 아는 사람에게만 한 장.
--
-- 표에 "누구나 읽기"를 열면, 브라우저에 그대로 드러나는 anon 키로 남들이
-- 만든 링크를 통째로 훑어 갈 수 있다. 링크로만 보여 준다는 약속이 깨진다.
-- 그래서 표는 닫아 두고, id 하나를 받아 그 한 줄만 돌려주는 함수만 연다.
-- ═══════════════════════════════════════════════

create or replace function public.shared_sketch(share_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', id, 'snapshot', snapshot, 'updatedAt', updated_at)
  from public.sketch_shares
  where id = share_id;
$$;

revoke all on function public.shared_sketch(text) from public;
grant execute on function public.shared_sketch(text) to anon, authenticated;

-- ═══════════════════════════════════════════════
-- 링크에 딸린 사진과 미리보기 그림
--
-- 여행 사진 보관함(trip-photos)은 비공개라, 남에게 보여 줄 사진은 여기로
-- 베껴 둔다. 이 보관함은 주소를 아는 사람이면 누구나 볼 수 있다.
--
--   shared-sketches/<링크 id>/<파일>
--
-- 폴더 이름이 링크 id 라 주소에 사용자 id 가 드러나지 않는다. 올리고
-- 지우는 것은 그 링크의 주인만 한다. 목록 보기는 주인에게만 열어 둔다 —
-- 남은 파일 이름을 알아야만 볼 수 있다.
-- ═══════════════════════════════════════════════

-- 그림만, 한 장에 3MB 까지. 누구나 보는 곳이라 아무 파일이나 올려 두는
-- 창고가 되지 않게 막는다(사진 한 장은 목록 판이라 수백 KB 다).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-sketches', 'shared-sketches', true, 3145728, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shared_sketches_read_own"   on storage.objects;
drop policy if exists "shared_sketches_insert_own" on storage.objects;
drop policy if exists "shared_sketches_update_own" on storage.objects;
drop policy if exists "shared_sketches_delete_own" on storage.objects;

create policy "shared_sketches_read_own" on storage.objects
  for select using (
    bucket_id = 'shared-sketches'
    and (storage.foldername(name))[1] in (select id from public.sketch_shares where user_id = auth.uid())
  );

-- 주의: 이 정책 안에서 storage.objects 를 다시 읽으면(파일 수 세기 등)
-- "infinite recursion detected in policy" 로 막힌다. storage.objects 의
-- 넣기 정책은 버킷과 상관없이 함께 검사되므로, 여행 사진 올리기까지 전부
-- 멈춘다. 파일 수에 끝을 두려면 security definer 함수로 세야 하고, 실제로
-- 올려 보며 확인한 뒤에 넣는다.
create policy "shared_sketches_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'shared-sketches'
    and (storage.foldername(name))[1] in (select id from public.sketch_shares where user_id = auth.uid())
  );

create policy "shared_sketches_update_own" on storage.objects
  for update using (
    bucket_id = 'shared-sketches'
    and (storage.foldername(name))[1] in (select id from public.sketch_shares where user_id = auth.uid())
  );

create policy "shared_sketches_delete_own" on storage.objects
  for delete using (
    bucket_id = 'shared-sketches'
    and (storage.foldername(name))[1] in (select id from public.sketch_shares where user_id = auth.uid())
  );

-- 계정을 지우면 링크도 함께 사라진다(위 references 의 on delete cascade).
-- 다만 보관함의 파일은 줄이 지워진다고 따라 지워지지 않는다 — 링크를
-- 끊을 때는 화면이 폴더를 비우고 줄을 지운다.
--
-- 계정을 지울 때는 그 사람의 링크 폴더도 지워야 한다(개인정보 처리방침의
-- "탈퇴 시 지체 없이 파기"). 줄 없이 남은 폴더는 아래로 찾아, 대시보드
-- Storage → shared-sketches 에서 그 폴더를 지운다.
--
--   select distinct (storage.foldername(name))[1] as folder
--   from storage.objects
--   where bucket_id = 'shared-sketches'
--     and (storage.foldername(name))[1] not in (select id from public.sketch_shares);
