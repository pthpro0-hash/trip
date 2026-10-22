-- 내 여행 스케치 · 속도용 색인
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다. 여러 번 실행해도 안전하다(schema.sql 에도 같은 것이 들어 있다).
--
-- 사진 표(trip_photos)는 방문(visit_id)으로만 찾을 수 있었다. 그런데 지도 핀·대표 사진·사진 장수(보관 한도)·관리자 회원 목록은
-- 모두 "이 사람의 사진"으로 찾는다 — 색인이 없어 그때마다 모든 사람의 사진 전체를 처음부터 훑었다. 사진이 쌓일수록 느려진다.

-- 이 사람의 사진(줄 번호 순서로 나눠 읽는다 — lib/supabase/photos 의 visitCovers 등). 장수를 셀 때도 이것을 쓴다.
create index if not exists trip_photos_user_idx on public.trip_photos (user_id, id);

-- 이 사람의 여행마다 대표 사진(fetchTrips 의 대표 사진 읽기). 대표 사진은 여행마다 한 장뿐이라 그것만 담는다.
create index if not exists trip_photos_user_cover_idx on public.trip_photos (user_id) where is_cover;
