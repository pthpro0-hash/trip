-- 나만의 여행 스케치 · 서비스 내역 기록
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- 여러 번 실행해도 안전하다.

-- ═══════════════════════════════════════════════
-- 무엇이 일어났는지만 남긴다
--
-- 무엇을 남기지 않는지가 더 중요하다. 좌표도, 장소 이름도, 사진 파일명도,
-- 검색어도 남기지 않는다. 이 서비스가 다루는 것이 "언제 어디에 누구와
-- 있었는지" 라서, 그것을 기록에 옮겨 적으면 기록 자체가 위험해진다.
--
-- 남기는 것은 세어 본 수와 결과뿐이다 — 사진 몇 장을 읽었고, 몇 건이
-- 저장됐고, 몇 장이 올라갔고, 무엇이 실패했는지. 무엇이 고장 났는지
-- 알아내는 데는 이것으로 충분하다.
-- ═══════════════════════════════════════════════

create table if not exists public.service_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  -- 계정이 지워지면 누구였는지는 지워지고 일어난 일만 남는다.
  user_id uuid references auth.users (id) on delete set null,
  event   text not null,
  detail  jsonb not null default '{}'::jsonb
);

-- 지울 때도 볼 때도 시간순이다.
create index if not exists service_log_at_idx on public.service_log (at desc);

alter table public.service_log enable row level security;

/*
  정책을 하나도 만들지 않는다 = 아무도 직접 읽거나 쓰지 못한다.

  쓰기는 아래 함수로만 들어온다. 그래야 user_id 를 사용자가 지어내지
  못한다. 읽기는 대시보드(service role)로만 한다 — 브라우저에 나가 있는
  anon 키로 남의 내역을 읽을 수 있으면 안 된다.
*/

-- ═══════════════════════════════════════════════
-- 남기는 통로
-- ═══════════════════════════════════════════════

create or replace function public.log_event(
  p_event  text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 이름이 없거나 터무니없이 길면 조용히 버린다. 기록하려다 앱이
  -- 멈추는 일은 없어야 한다.
  if p_event is null or length(p_event) = 0 or length(p_event) > 40 then
    return;
  end if;

  -- 잡동사니를 실어 나르는 통로가 되지 않게 크기를 묶어 둔다.
  if p_detail is not null and length(p_detail::text) > 500 then
    p_detail := '{"dropped":"too_large"}'::jsonb;
  end if;

  insert into public.service_log (user_id, event, detail)
  values (auth.uid(), p_event, coalesce(p_detail, '{}'::jsonb));

  /*
    한 달이 지난 것은 지운다.

    쓸 때마다 한 번씩 훑는다. at 에 색인이 있어 지울 것이 없으면 값이
    거의 들지 않고, 무엇보다 pg_cron 같은 것을 켜 두지 않아도 저절로
    돌아간다. 따로 돌리는 청소부는 잊히기 마련이다.
  */
  delete from public.service_log where at < now() - interval '30 days';
end;
$$;

-- 로그인하지 않은 사람의 일도 남는다 (그때 user_id 는 비어 있다).
grant execute on function public.log_event(text, jsonb) to anon, authenticated;

-- ═══════════════════════════════════════════════
-- 볼 때 쓰는 것들 (대시보드 SQL Editor 에서)
-- ═══════════════════════════════════════════════

-- 최근에 무슨 일이 있었나
--   select at, event, detail from public.service_log order by at desc limit 100;

-- 날짜별로 무엇이 얼마나 일어났나
--   select date_trunc('day', at) as 날, event, count(*)
--   from public.service_log group by 1, 2 order by 1 desc, 3 desc;

-- 실패만 모아 보기
--   select * from public.service_log
--   where detail ? 'failed' and (detail->>'failed')::int > 0
--   order by at desc;

-- 가장 오래된 기록이 언제 것인지 (한 달을 넘기지 않아야 한다)
--   select min(at), max(at), count(*) from public.service_log;
