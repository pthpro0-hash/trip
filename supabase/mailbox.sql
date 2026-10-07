-- 내 여행 스케치 · 가족 우편함
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
--
-- 먼저 할 일
--   1. Storage 에서 공개(Public) 버킷 `postcards` 를 만든다.
--   2. schema.sql 을 실행해 두었어야 한다(trips 표). 가족 공유(family.sql)는 있으면 함께 연결되고,
--      없어도 이 파일은 실행된다.
-- 여러 번 실행해도 안전하다.

-- ═══════════════════════════════════════════════
-- 여행을 기록한 사람(보내는 사람)이 부모님 같은 가족에게 "엽서"를 보낸다. 받는 사람은 앱도
-- 로그인도 없이 링크 하나로 엽서를 보고 답장한다.
--
--   우편함     집 한 곳당 하나(부모님 두 분은 한 우편함). 링크(token)로 열린다. 보내는 사람은 여럿.
--   엽서       보낸 순간 그대로 남는다 — 고쳐 쓰는 길이 없다. 사진은 한 번만 복사해 두고(postcards
--              버킷) 우편함끼리 같이 쓴다.
--   인사말     우편함마다 따로(postcard_deliveries.greeting). 호칭은 우편함에, 본문은 엽서에.
--
-- 받는 쪽은 로그인이 없다. 그래서 표는 모두 닫아 두고, 링크의 글자를 받아 그 우편함 것만 돌려주는
-- 함수(RPC)만 anon 에게 연다. 링크 공유(tripShare.sql)와 같은 방식이다.
--
-- 지울 때의 순서(앱이 지킨다): 엽서 사진 파일을 먼저 지우고 줄은 나중에. 줄이 먼저 사라지면 폴더의
-- 주인을 밝힐 길이 없어 사진이 공개 보관함에 영영 남는다.
-- ═══════════════════════════════════════════════

-- ── 우편함 ────────────────────────────────────────
create table if not exists public.mailboxes (
  id            uuid        primary key default gen_random_uuid(),
  owner_id      uuid        not null references auth.users (id) on delete cascade,
  name          text        not null check (length(name) between 1 and 40),
  -- 인사말 맨 앞에 붙는 부르는 말("엄마 아빠"). 비어 있으면 붙이지 않는다.
  greeting_name text        check (length(greeting_name) between 1 and 20),
  use_greeting  boolean     not null default true,
  tone          text        not null default 'casual' check (tone in ('casual', 'polite')),
  -- 받는 분 이름들("엄마", "아빠"). 받는 쪽 화면이 "누가 보시나요?"에 쓴다.
  members       text[]      not null default '{}' check (cardinality(members) <= 6),
  -- 링크에 들어가는 무작위 글자. 짐작해서 찾아올 수 없을 만큼 길다. 새로 만들면 옛 링크는 끊긴다.
  token         text        not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  -- 닫은 우편함은 받는 쪽에 아무것도 보이지 않고, 새 엽서도 보낼 수 없다.
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists mailboxes_owner_idx on public.mailboxes (owner_id);

-- 책장 설정(사진 수·크기·부모님 화면 글씨·답장 문구 …). 비어 있으면 앱이 권장값으로 읽는다(lib/mailboxSettings.ts).
-- 값의 모양은 앱이 칸마다 확인해 읽으므로 DB 는 "JSON 객체이고 작다"만 막는다. 고치는 것은 우편함의 주인만
-- (아래 mailboxes_update 정책). 이미 만들어 둔 표에도 더해진다.
alter table public.mailboxes add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.mailboxes drop constraint if exists mailboxes_settings_check;
alter table public.mailboxes add constraint mailboxes_settings_check
  check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) < 2000);

-- 이 우편함에 엽서를 보낼 수 있는 사람들. 우편함을 만든 사람이 'owner' 로 자동으로 들어간다.
create table if not exists public.mailbox_senders (
  mailbox_id uuid        not null references public.mailboxes (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  role       text        not null check (role in ('owner', 'sender')),
  created_at timestamptz not null default now(),
  primary key (mailbox_id, user_id)
);

create index if not exists mailbox_senders_user_idx on public.mailbox_senders (user_id);

-- 보내는 사람 초대. 주인이 만들고 수락하면 한 번 쓰이고 닫힌다(가족 공유 초대와 같은 방식).
create table if not exists public.mailbox_invites (
  token      text        primary key check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  mailbox_id uuid        not null references public.mailboxes (id) on delete cascade,
  created_by uuid        not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at    timestamptz,
  used_by    uuid        references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── 엽서 ──────────────────────────────────────────
-- 엽서 주소는 사진 폴더 이름이기도 하다. 사용자 id 가 드러나지 않는다.
create table if not exists public.postcard_ids (
  id text primary key
);

create table if not exists public.postcards (
  id          text        primary key check (id ~ '^[A-Za-z0-9_-]{16,64}$'),
  sender_id   uuid        not null references auth.users (id) on delete cascade,
  -- 여행을 지우면 이 여행으로 보낸 엽서도 함께 지워진다(사진 파일은 앱이 먼저 치운다).
  trip_id     uuid        not null references public.trips (id) on delete cascade,
  -- 받는 쪽에 보이는 보낸 사람의 이름("지민"). 이메일은 싣지 않는다.
  sender_name text        not null check (length(sender_name) between 1 and 20),
  -- 보낸 순간의 모습(제목·기간·곳·좌표 흐림·사진 파일). 메모와 함께한 사람은 싣지 않는다.
  snapshot    jsonb       not null check (octet_length(snapshot::text) < 200000),
  created_at  timestamptz not null default now()
);

create index if not exists postcards_sender_idx on public.postcards (sender_id, created_at desc);
create index if not exists postcards_trip_idx on public.postcards (trip_id);

-- 엽서에 복사해 둔 사진. 원본 사진이 지워지면 앱이 이 줄을 보고 복사본을 지운다.
-- (원본 사진 id 에는 외래 키를 걸지 않는다 — 걸면 원본이 지워질 때 줄이 먼저 사라져 파일 이름을 잃는다.)
create table if not exists public.postcard_photos (
  postcard_id     text    not null references public.postcards (id) on delete cascade,
  file            text    not null check (file ~ '^[A-Za-z0-9._-]{1,80}$'),
  source_photo_id uuid,
  position        integer not null default 0,
  primary key (postcard_id, file)
);

create index if not exists postcard_photos_source_idx on public.postcard_photos (source_photo_id);

-- 엽서를 어느 우편함에 넣었나. 우편함마다 다른 인사말(본문)이 여기 있다.
create table if not exists public.postcard_deliveries (
  postcard_id  text        not null references public.postcards (id) on delete cascade,
  mailbox_id   uuid        not null references public.mailboxes (id) on delete cascade,
  greeting     text        not null default '' check (length(greeting) <= 300),
  delivered_at timestamptz not null default now(),
  -- 받는 분이 처음 연 때. 보낸 사람이 "읽으셨어요"를 본다.
  opened_at    timestamptz,
  primary key (postcard_id, mailbox_id)
);

create index if not exists postcard_deliveries_mailbox_idx on public.postcard_deliveries (mailbox_id, delivered_at desc);

-- 받는 분의 답장. 함수(mailbox_reply)로만 쌓인다.
create table if not exists public.postcard_replies (
  id          uuid        primary key default gen_random_uuid(),
  postcard_id text        not null,
  mailbox_id  uuid        not null,
  who         text        not null check (length(who) between 1 and 10),
  reaction    text        not null check (length(reaction) between 1 and 30),
  created_at  timestamptz not null default now(),
  -- 보낸 사람이 봤으면 그 시각.
  seen_at     timestamptz,
  foreign key (postcard_id, mailbox_id)
    references public.postcard_deliveries (postcard_id, mailbox_id) on delete cascade
);

create index if not exists postcard_replies_postcard_idx on public.postcard_replies (postcard_id, created_at);

-- 받는 분의 하트. 함수(mailbox_heart)로만 켜고 끈다(누르면 켜지고 한 번 더 누르면 꺼진다).
-- file 은 하트를 단 사진의 파일 이름이고, 책 전체에 단 하트(우편함 설정이 '책마다')는 빈 글자다.
create table if not exists public.postcard_hearts (
  id          uuid        primary key default gen_random_uuid(),
  postcard_id text        not null,
  mailbox_id  uuid        not null,
  who         text        not null check (length(who) between 1 and 10),
  file        text        not null default '' check (file = '' or file ~ '^[A-Za-z0-9._-]{1,80}$'),
  created_at  timestamptz not null default now(),
  -- 보낸 사람이 봤으면 그 시각.
  seen_at     timestamptz,
  unique (postcard_id, mailbox_id, who, file),
  foreign key (postcard_id, mailbox_id)
    references public.postcard_deliveries (postcard_id, mailbox_id) on delete cascade
);

create index if not exists postcard_hearts_postcard_idx on public.postcard_hearts (postcard_id, created_at);

alter table public.mailboxes enable row level security;
alter table public.mailbox_senders enable row level security;
alter table public.mailbox_invites enable row level security;
alter table public.postcard_ids enable row level security;
alter table public.postcards enable row level security;
alter table public.postcard_photos enable row level security;
alter table public.postcard_deliveries enable row level security;
alter table public.postcard_replies enable row level security;
alter table public.postcard_hearts enable row level security;
-- postcard_ids 에는 정책을 두지 않는다 — 아무도 직접 읽거나 쓰지 못하고, 아래 트리거만 적는다.

-- 로그인하지 않은 사람(anon)은 표에 직접 닿지 못한다. 받는 쪽은 아래 함수(RPC)로만 읽는다.
-- 정책이 이미 막지만(anon 에게 연 정책이 없다) 한 겹 더 닫아 둔다.
revoke all on table
  public.mailboxes, public.mailbox_senders, public.mailbox_invites, public.postcard_ids,
  public.postcards, public.postcard_photos, public.postcard_deliveries, public.postcard_replies, public.postcard_hearts
from anon;

-- ═══════════════════════════════════════════════
-- 권한 확인 함수.
--
-- 정책이 mailbox_senders 를 직접 읽으면 그 표의 정책과 얽혀 서로를 부르는 재귀가 될 수 있다
-- (family.sql 의 family_can 과 같은 까닭). security definer 로 한 번에 읽어 그 고리를 끊는다.
-- 로그인한 사람(auth.uid()) 자신에 대해서만 답한다 — 남의 우편함을 캐묻는 데는 쓸 수 없다.
-- ═══════════════════════════════════════════════

create or replace function public.is_mailbox_sender(box uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mailbox_senders s
    where s.mailbox_id = box and s.user_id = auth.uid()
  );
$$;

-- 이 우편함에 지금 엽서를 보낼 수 있나(보내는 사람이고, 닫히지 않았다).
create or replace function public.can_send_to(box uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mailbox_senders s
    join public.mailboxes m on m.id = s.mailbox_id
    where s.mailbox_id = box and s.user_id = auth.uid() and m.closed_at is null
  );
$$;

revoke all on function public.is_mailbox_sender(uuid) from public;
revoke all on function public.can_send_to(uuid) from public;
grant execute on function public.is_mailbox_sender(uuid) to authenticated;
grant execute on function public.can_send_to(uuid) to authenticated;

-- ═══════════════════════════════════════════════
-- 한도와 고정 칸.
-- ═══════════════════════════════════════════════

-- 한 사람이 만들 수 있는 우편함은 3개(닫은 것은 세지 않는다).
create or replace function public.mailboxes_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.mailboxes where owner_id = new.owner_id and closed_at is null) >= 3 then
    raise exception 'mailboxes: 우편함은 3개까지 만들 수 있다';
  end if;
  return new;
end;
$$;

-- 한 우편함에 엽서를 보낼 수 있는 사람은 8명(주인 포함).
create or replace function public.mailbox_senders_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.mailbox_senders where mailbox_id = new.mailbox_id) >= 8 then
    raise exception 'mailbox_senders: 보내는 사람은 8명까지 들일 수 있다';
  end if;
  return new;
end;
$$;

-- 우편함을 만들면 만든 사람이 주인으로 보내는 사람에 적힌다.
create or replace function public.mailboxes_add_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mailbox_senders (mailbox_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

-- 우편함의 주인은 바꿀 수 없다. 닫은 우편함을 다시 열 때도 열린 것이 3개를 넘지 않아야 한다
-- (닫았다 열기로 한도를 피하지 못하게).
create or replace function public.mailboxes_keep()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'mailboxes: 우편함의 주인은 바꿀 수 없다';
  end if;
  if old.closed_at is not null and new.closed_at is null
     and (select count(*) from public.mailboxes where owner_id = new.owner_id and closed_at is null and id <> new.id) >= 3 then
    raise exception 'mailboxes: 우편함은 3개까지 열어 둘 수 있다';
  end if;
  return new;
end;
$$;

-- 엽서의 주소·보낸 사람·여행은 바꿀 수 없다(보낸 순간 그대로).
create or replace function public.postcards_keep()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.trip_id is distinct from old.trip_id then
    raise exception 'postcards: 엽서의 주소·보낸 사람·여행은 바꿀 수 없다';
  end if;
  return new;
end;
$$;

-- 쓴 엽서 주소는 장부에 적어 다시 쓰지 못한다. 지운 엽서의 주소로 남이 같은 폴더를 만들어
-- 이미 퍼진 링크에 자기 내용을 띄우는 일을 막는다(sketch_share_ids 와 같은 까닭).
create or replace function public.postcards_claim_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.postcard_ids (id) values (new.id);
  return new;
end;
$$;

-- 답장에서 고칠 수 있는 것은 "봤다"는 표시(seen_at) 하나뿐이다.
create or replace function public.postcard_replies_only_seen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.postcard_id is distinct from old.postcard_id
     or new.mailbox_id is distinct from old.mailbox_id
     or new.who is distinct from old.who
     or new.reaction is distinct from old.reaction
     or new.created_at is distinct from old.created_at then
    raise exception 'postcard_replies: 답장은 고칠 수 없고 seen_at 만 바꿀 수 있다';
  end if;
  return new;
end;
$$;

-- 하트에서 고칠 수 있는 것도 "봤다"는 표시(seen_at) 하나뿐이다.
create or replace function public.postcard_hearts_only_seen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.postcard_id is distinct from old.postcard_id
     or new.mailbox_id is distinct from old.mailbox_id
     or new.who is distinct from old.who
     or new.file is distinct from old.file
     or new.created_at is distinct from old.created_at then
    raise exception 'postcard_hearts: 하트는 고칠 수 없고 seen_at 만 바꿀 수 있다';
  end if;
  return new;
end;
$$;

revoke all on function public.postcard_hearts_only_seen() from public;
revoke all on function public.mailboxes_limit() from public;
revoke all on function public.mailbox_senders_limit() from public;
revoke all on function public.mailboxes_add_owner() from public;
revoke all on function public.mailboxes_keep() from public;
revoke all on function public.postcards_keep() from public;
revoke all on function public.postcards_claim_id() from public;
revoke all on function public.postcard_replies_only_seen() from public;

drop trigger if exists mailboxes_limit on public.mailboxes;
create trigger mailboxes_limit before insert on public.mailboxes
  for each row execute function public.mailboxes_limit();

drop trigger if exists mailboxes_add_owner on public.mailboxes;
create trigger mailboxes_add_owner after insert on public.mailboxes
  for each row execute function public.mailboxes_add_owner();

drop trigger if exists mailboxes_keep on public.mailboxes;
create trigger mailboxes_keep before update on public.mailboxes
  for each row execute function public.mailboxes_keep();

drop trigger if exists mailbox_senders_limit on public.mailbox_senders;
create trigger mailbox_senders_limit before insert on public.mailbox_senders
  for each row execute function public.mailbox_senders_limit();

drop trigger if exists postcards_claim_id on public.postcards;
create trigger postcards_claim_id before insert on public.postcards
  for each row execute function public.postcards_claim_id();

drop trigger if exists postcards_keep on public.postcards;
create trigger postcards_keep before update on public.postcards
  for each row execute function public.postcards_keep();

drop trigger if exists postcard_replies_only_seen on public.postcard_replies;
create trigger postcard_replies_only_seen before update on public.postcard_replies
  for each row execute function public.postcard_replies_only_seen();

drop trigger if exists postcard_hearts_only_seen on public.postcard_hearts;
create trigger postcard_hearts_only_seen before update on public.postcard_hearts
  for each row execute function public.postcard_hearts_only_seen();

-- ═══════════════════════════════════════════════
-- 보내는 사람 쪽 정책 — 로그인한 사람이 자기 것만.
-- ═══════════════════════════════════════════════

-- 우편함: 주인과 보내는 사람이 읽는다(링크 글자도 보인다 — 엽서 링크를 만들려면 필요하다). 고치고 닫는 것은 주인만.
drop policy if exists "mailboxes_select" on public.mailboxes;
drop policy if exists "mailboxes_insert" on public.mailboxes;
drop policy if exists "mailboxes_update" on public.mailboxes;
drop policy if exists "mailboxes_delete" on public.mailboxes;

create policy "mailboxes_select" on public.mailboxes
  for select using (auth.uid() = owner_id or public.is_mailbox_sender(id));
create policy "mailboxes_insert" on public.mailboxes
  for insert with check (auth.uid() = owner_id);
create policy "mailboxes_update" on public.mailboxes
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "mailboxes_delete" on public.mailboxes
  for delete using (auth.uid() = owner_id);

-- 보내는 사람: 같은 우편함 사람끼리 보고, 주인은 내보내고, 본인은 나갈 수 있다(주인 자신은 못 나간다).
-- 넣는 길은 없다 — 초대 수락 함수로만 들어온다.
drop policy if exists "mailbox_senders_select" on public.mailbox_senders;
drop policy if exists "mailbox_senders_delete" on public.mailbox_senders;

create policy "mailbox_senders_select" on public.mailbox_senders
  for select using (public.is_mailbox_sender(mailbox_id));
create policy "mailbox_senders_delete" on public.mailbox_senders
  for delete using (
    role <> 'owner'
    and (
      auth.uid() = user_id
      or exists (select 1 from public.mailboxes m where m.id = mailbox_id and m.owner_id = auth.uid())
    )
  );

-- 초대: 만들고 보고 거두는 것은 우편함 주인만.
drop policy if exists "mailbox_invites_select" on public.mailbox_invites;
drop policy if exists "mailbox_invites_insert" on public.mailbox_invites;
drop policy if exists "mailbox_invites_delete" on public.mailbox_invites;

create policy "mailbox_invites_select" on public.mailbox_invites
  for select using (auth.uid() = created_by);
create policy "mailbox_invites_insert" on public.mailbox_invites
  for insert with check (
    auth.uid() = created_by
    and used_at is null
    and used_by is null
    and exists (select 1 from public.mailboxes m where m.id = mailbox_id and m.owner_id = auth.uid())
  );
create policy "mailbox_invites_delete" on public.mailbox_invites
  for delete using (auth.uid() = created_by);

-- 초대 수락: 로그인한 사람이 링크의 글자를 넘기면 보내는 사람이 된다. 한 번만, 만료 전에만.
create or replace function public.accept_mailbox_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  invite public.mailbox_invites%rowtype;
begin
  if me is null then
    raise exception 'mailbox: 로그인이 필요하다';
  end if;

  select * into invite from public.mailbox_invites where token = invite_token for update;
  if not found then
    raise exception 'mailbox: 없는 초대다';
  end if;
  if invite.used_at is not null then
    raise exception 'mailbox: 이미 쓴 초대다';
  end if;
  if invite.expires_at <= now() then
    raise exception 'mailbox: 만료된 초대다';
  end if;
  if not exists (select 1 from public.mailboxes where id = invite.mailbox_id and closed_at is null) then
    raise exception 'mailbox: 닫힌 우편함이다';
  end if;

  insert into public.mailbox_senders (mailbox_id, user_id, role)
    values (invite.mailbox_id, me, 'sender')
    on conflict (mailbox_id, user_id) do nothing;

  update public.mailbox_invites set used_at = now(), used_by = me where token = invite_token;
  return invite.mailbox_id;
end;
$$;

revoke all on function public.accept_mailbox_invite(text) from public;
grant execute on function public.accept_mailbox_invite(text) to authenticated;

-- 엽서: 보낸 사람이 자기 것만 읽고 지운다. 고치는 길이 없다 — 보낸 순간 그대로.
-- 남의 여행으로는 만들 수 없게 여행의 주인도 함께 본다.
drop policy if exists "postcards_select_own" on public.postcards;
drop policy if exists "postcards_insert_own" on public.postcards;
drop policy if exists "postcards_delete_own" on public.postcards;

create policy "postcards_select_own" on public.postcards
  for select using (auth.uid() = sender_id);
create policy "postcards_insert_own" on public.postcards
  for insert with check (
    auth.uid() = sender_id
    and exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );
create policy "postcards_delete_own" on public.postcards
  for delete using (auth.uid() = sender_id);

-- 엽서에 복사한 사진 기록: 그 엽서를 보낸 사람만.
drop policy if exists "postcard_photos_select_own" on public.postcard_photos;
drop policy if exists "postcard_photos_insert_own" on public.postcard_photos;
drop policy if exists "postcard_photos_delete_own" on public.postcard_photos;

create policy "postcard_photos_select_own" on public.postcard_photos
  for select using (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  );
create policy "postcard_photos_insert_own" on public.postcard_photos
  for insert with check (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  );
create policy "postcard_photos_delete_own" on public.postcard_photos
  for delete using (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  );

-- 우편함에 넣기: 내 엽서를, 내가 보낼 수 있는 우편함에만. 거두는 것(지우기)은 엽서를 보낸 사람.
drop policy if exists "postcard_deliveries_select" on public.postcard_deliveries;
drop policy if exists "postcard_deliveries_insert" on public.postcard_deliveries;
drop policy if exists "postcard_deliveries_delete" on public.postcard_deliveries;

create policy "postcard_deliveries_select" on public.postcard_deliveries
  for select using (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  );
create policy "postcard_deliveries_insert" on public.postcard_deliveries
  for insert with check (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
    and public.can_send_to(mailbox_id)
  );
create policy "postcard_deliveries_delete" on public.postcard_deliveries
  for delete using (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  );

-- 답장: 보낸 사람이 자기 엽서의 답장을 읽고 "봤다"고 표시한다. 넣는 길은 없다(함수로만).
drop policy if exists "postcard_replies_select" on public.postcard_replies;
drop policy if exists "postcard_replies_update" on public.postcard_replies;

create policy "postcard_replies_select" on public.postcard_replies
  for select using (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  );
create policy "postcard_replies_update" on public.postcard_replies
  for update using (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  ) with check (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  );

-- 하트: 답장과 같다 — 보낸 사람이 자기 엽서의 하트를 읽고 "봤다"고 표시한다. 넣고 지우는 길은 없다(함수로만).
drop policy if exists "postcard_hearts_select" on public.postcard_hearts;
drop policy if exists "postcard_hearts_update" on public.postcard_hearts;

create policy "postcard_hearts_select" on public.postcard_hearts
  for select using (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  );
create policy "postcard_hearts_update" on public.postcard_hearts
  for update using (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  ) with check (
    exists (select 1 from public.postcards p where p.id = postcard_id and p.sender_id = auth.uid())
  );

-- ═══════════════════════════════════════════════
-- 받는 쪽(로그인 없음) — 링크를 정확히 아는 사람에게만, 그 우편함 것만.
--
-- 표는 닫혀 있다. 우편함 링크의 글자(box_token)를 받아 그 우편함에 든 것만 돌려주는 함수만 연다.
-- 닫힌 우편함이나 모르는 글자에는 아무것도(null) 주지 않는다. 보내는 사람의 이메일·id 는 내보내지 않는다
-- — 받는 사람에게 필요한 것은 보낸 사람의 이름(sender_name) 하나다.
-- ═══════════════════════════════════════════════

-- 우편함 첫 화면: 받은 엽서 목록(제목·기간·첫 사진·인사말·답장).
create or replace function public.mailbox_view(box_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', m.name,
    'tone', m.tone,
    'members', to_jsonb(m.members),
    -- 부모님 화면에 필요한 것만. 사진 수·크기·보관 권수는 보내는 쪽 일이라 내려가지 않는다.
    'settings', jsonb_build_object(
      'font', m.settings -> 'font',
      'heart', m.settings -> 'heart',
      'words', m.settings -> 'words',
      'past', m.settings -> 'past',
      'year', m.settings -> 'year'
    ),
    'postcards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'senderName', p.sender_name,
          'title', p.snapshot -> 'title',
          'startedOn', p.snapshot -> 'startedOn',
          'cover', p.snapshot -> 'files' -> 0,
          'photoCount', jsonb_array_length(p.snapshot -> 'files'),
          'endedOn', p.snapshot -> 'endedOn',
          -- 책꽂이의 올해 지도·작년 오늘에 쓰는 곳 목록. 스냅샷 통째가 아니라 곳마다 필요한 칸만 내린다.
          -- 보낸 사람의 브라우저가 적은 것이라 배열이 아니어도 목록 전체가 깨지지 않게 배열일 때만 푼다.
          'places', coalesce((
            select jsonb_agg(jsonb_build_object(
              'placeName', v -> 'placeName',
              'lat', v -> 'lat',
              'lng', v -> 'lng',
              'day', v -> 'day',
              'photoCount', case when jsonb_typeof(v -> 'photos') = 'array' then jsonb_array_length(v -> 'photos') else 0 end,
              'photo', case when jsonb_typeof(v -> 'photos') = 'array' then v -> 'photos' -> 0 else null end
            ))
            from jsonb_array_elements(
              case when jsonb_typeof(p.snapshot -> 'visits') = 'array' then p.snapshot -> 'visits' else '[]'::jsonb end
            ) as v
          ), '[]'::jsonb),
          'greeting', d.greeting,
          'sentAt', d.delivered_at,
          'openedAt', d.opened_at,
          'replies', coalesce((
            select jsonb_agg(
              jsonb_build_object('who', r.who, 'reaction', r.reaction, 'at', r.created_at)
              order by r.created_at
            )
            from public.postcard_replies r
            where r.postcard_id = p.id and r.mailbox_id = m.id
          ), '[]'::jsonb)
        )
        order by d.delivered_at desc
      )
      from public.postcard_deliveries d
      join public.postcards p on p.id = d.postcard_id
      where d.mailbox_id = m.id
    ), '[]'::jsonb)
  )
  from public.mailboxes m
  where m.token = box_token and m.closed_at is null;
$$;

-- 엽서 한 장. 읽기만 한다 — 열어 본 시각은 따로(mailbox_open) 적는다. 카카오톡 미리보기 같은 기계가
-- 링크를 읽어 가도 "읽으셨어요"가 찍히지 않게, 사람이 화면을 연 뒤에 화면이 따로 부른다.
create or replace function public.mailbox_postcard(box_token text, card_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  box public.mailboxes%rowtype;
  found_card jsonb;
begin
  select * into box from public.mailboxes where token = box_token and closed_at is null;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'senderName', p.sender_name,
    'snapshot', p.snapshot,
    'greeting', d.greeting,
    'sentAt', d.delivered_at,
    'mailbox', jsonb_build_object(
      'name', box.name,
      'tone', box.tone,
      'members', to_jsonb(box.members),
      'settings', jsonb_build_object(
        'font', box.settings -> 'font',
        'heart', box.settings -> 'heart',
        'words', box.settings -> 'words',
        'past', box.settings -> 'past',
        'year', box.settings -> 'year'
      )
    ),
    'replies', coalesce((
      select jsonb_agg(
        jsonb_build_object('who', r.who, 'reaction', r.reaction, 'at', r.created_at)
        order by r.created_at
      )
      from public.postcard_replies r
      where r.postcard_id = p.id and r.mailbox_id = box.id
    ), '[]'::jsonb),
    -- 이 우편함에서 누가 어느 사진(책 하트면 빈 글자)에 하트를 달았나.
    'hearts', coalesce((
      select jsonb_agg(jsonb_build_object('who', h.who, 'file', h.file) order by h.created_at)
      from public.postcard_hearts h
      where h.postcard_id = p.id and h.mailbox_id = box.id
    ), '[]'::jsonb)
  ) into found_card
  from public.postcard_deliveries d
  join public.postcards p on p.id = d.postcard_id
  where d.mailbox_id = box.id and d.postcard_id = card_id;

  return found_card;
end;
$$;

-- 엽서를 열어 봤다고 적는다(처음 열 때 한 번). 보낸 사람이 "읽으셨어요"를 본다.
create or replace function public.mailbox_open(box_token text, card_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  box_id uuid;
begin
  select id into box_id from public.mailboxes where token = box_token and closed_at is null;
  if box_id is null then
    return false;
  end if;

  update public.postcard_deliveries d
    set opened_at = coalesce(d.opened_at, now())
    where d.mailbox_id = box_id and d.postcard_id = card_id;
  return found;
end;
$$;

-- 답장 한 번. 짧게(30자까지), 너무 자주는 안 된다(한 엽서에 한 시간 20번까지).
create or replace function public.mailbox_reply(box_token text, card_id text, reply_who text, reply_reaction text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  box public.mailboxes%rowtype;
begin
  if length(coalesce(reply_who, '')) not between 1 and 10 then
    raise exception 'mailbox: 이름은 1~10자';
  end if;
  if length(coalesce(reply_reaction, '')) not between 1 and 30 then
    raise exception 'mailbox: 답장은 1~30자';
  end if;

  select * into box from public.mailboxes where token = box_token and closed_at is null;
  if not found then
    return false;
  end if;
  if not exists (
    select 1 from public.postcard_deliveries d where d.mailbox_id = box.id and d.postcard_id = card_id
  ) then
    return false;
  end if;
  if (
    select count(*) from public.postcard_replies r
    where r.postcard_id = card_id and r.mailbox_id = box.id and r.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'mailbox: 답장이 너무 잦다';
  end if;

  insert into public.postcard_replies (postcard_id, mailbox_id, who, reaction)
    values (card_id, box.id, reply_who, reply_reaction);
  return true;
end;
$$;

-- 하트 켜기·끄기. 이미 켠 것을 또 켜도, 없는 것을 끄려 해도 조용히 넘어간다(두 번 눌러도 탈이 없게).
-- 우편함 설정이 'book' 이면 책 전체(빈 글자)에만, 아니면 이 엽서에 든 사진에만 달 수 있다.
-- 한 엽서·한 우편함에 한 시간 60번까지, 모두 200개까지.
create or replace function public.mailbox_heart(box_token text, card_id text, heart_who text, heart_file text, heart_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  box public.mailboxes%rowtype;
  card public.postcards%rowtype;
  target text := coalesce(heart_file, '');
begin
  if length(coalesce(heart_who, '')) not between 1 and 10 then
    raise exception 'mailbox: 이름은 1~10자';
  end if;

  select * into box from public.mailboxes where token = box_token and closed_at is null;
  if not found then
    return false;
  end if;

  select p.* into card
    from public.postcards p
    join public.postcard_deliveries d on d.postcard_id = p.id
    where p.id = card_id and d.mailbox_id = box.id;
  if not found then
    return false;
  end if;

  if coalesce(box.settings ->> 'heart', 'photo') = 'book' then
    if target <> '' then
      raise exception 'mailbox: 하트 방식이 바뀌었다';
    end if;
  elsif target = '' or not (card.snapshot -> 'files' ? target) then
    raise exception 'mailbox: 하트 방식이 바뀌었다';
  end if;

  if coalesce(heart_on, true) then
    if (
      select count(*) from public.postcard_hearts h
      where h.postcard_id = card_id and h.mailbox_id = box.id and h.created_at > now() - interval '1 hour'
    ) >= 60 then
      raise exception 'mailbox: 하트가 너무 잦다';
    end if;
    if (
      select count(*) from public.postcard_hearts h where h.postcard_id = card_id and h.mailbox_id = box.id
    ) >= 200 then
      raise exception 'mailbox: 하트가 너무 잦다';
    end if;
    insert into public.postcard_hearts (postcard_id, mailbox_id, who, file)
      values (card_id, box.id, heart_who, target)
      on conflict (postcard_id, mailbox_id, who, file) do nothing;
  else
    delete from public.postcard_hearts h
      where h.postcard_id = card_id and h.mailbox_id = box.id and h.who = heart_who and h.file = target;
  end if;
  return true;
end;
$$;

revoke all on function public.mailbox_view(text) from public;
revoke all on function public.mailbox_postcard(text, text) from public;
revoke all on function public.mailbox_open(text, text) from public;
revoke all on function public.mailbox_reply(text, text, text, text) from public;
revoke all on function public.mailbox_heart(text, text, text, text, boolean) from public;
grant execute on function public.mailbox_view(text) to anon, authenticated;
grant execute on function public.mailbox_postcard(text, text) to anon, authenticated;
grant execute on function public.mailbox_open(text, text) to anon, authenticated;
grant execute on function public.mailbox_reply(text, text, text, text) to anon, authenticated;
grant execute on function public.mailbox_heart(text, text, text, text, boolean) to anon, authenticated;

-- ═══════════════════════════════════════════════
-- 사진 보관함(postcards 버킷, 공개)
--
--   postcards/<엽서 주소>/<파일>
--
-- 폴더 이름이 엽서 주소(길고 무작위)라 사용자 id 가 드러나지 않는다. 공개 버킷이라 주소를 아는 사람은
-- 읽는다(받는 분의 화면). 올리고 고치고 지우고 목록을 보는 것은 그 엽서를 보낸 사람만 한다.
-- 엽서 줄이 있어야 올릴 수 있다 — 줄 먼저, 사진은 나중(링크 공유와 같은 순서).
-- ═══════════════════════════════════════════════

drop policy if exists "postcards_files_list_own"   on storage.objects;
drop policy if exists "postcards_files_insert_own" on storage.objects;
drop policy if exists "postcards_files_update_own" on storage.objects;
drop policy if exists "postcards_files_delete_own" on storage.objects;

create policy "postcards_files_list_own" on storage.objects
  for select using (
    bucket_id = 'postcards'
    and (storage.foldername(name))[1] in (select id from public.postcards where sender_id = auth.uid())
  );

create policy "postcards_files_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'postcards'
    and (storage.foldername(name))[1] in (select id from public.postcards where sender_id = auth.uid())
  );

create policy "postcards_files_update_own" on storage.objects
  for update using (
    bucket_id = 'postcards'
    and (storage.foldername(name))[1] in (select id from public.postcards where sender_id = auth.uid())
  );

create policy "postcards_files_delete_own" on storage.objects
  for delete using (
    bucket_id = 'postcards'
    and (storage.foldername(name))[1] in (select id from public.postcards where sender_id = auth.uid())
  );

-- ═══════════════════════════════════════════════
-- 가족 공유와의 만남(family.sql 을 실행했을 때만).
--
-- 가족(추가도 가능)이 주인의 여행을 지울 때, 화면은 먼저 그 여행으로 보낸 엽서가 있는지 보고 있으면
-- 사진 복사본부터 치운 뒤에 지운다. 엽서 줄을 못 읽으면 "엽서 없음"으로 보고 지워 버려, 엽서 사진이
-- 공개 보관함에 남는다. 그래서 추가도 가능 가족에게는 엽서 줄을 읽게만 한다. 지우는 것은 보낸 사람만
-- 하므로 가족의 여행 지우기는 멈춘다 — 주인이 먼저 엽서를 거두어야 한다.
-- ═══════════════════════════════════════════════

do $$
begin
  if to_regclass('public.family_links') is not null then
    drop policy if exists "postcards_select_family" on public.postcards;
    create policy "postcards_select_family" on public.postcards
      for select using (public.family_can(sender_id, 'full'));

    drop policy if exists "postcard_photos_select_family" on public.postcard_photos;
    create policy "postcard_photos_select_family" on public.postcard_photos
      for select using (
        exists (
          select 1 from public.postcards p
          where p.id = postcard_id and public.family_can(p.sender_id, 'full')
        )
      );
  end if;
end $$;

-- 계정을 지울 때는 그 사람의 엽서 폴더도 지워야 한다(운영 메모). 줄 없이 남은 폴더는 이 검색으로 찾는다.
--
--   select distinct (storage.foldername(name))[1] as folder
--   from storage.objects
--   where bucket_id = 'postcards'
--     and (storage.foldername(name))[1] not in (select id from public.postcards);
