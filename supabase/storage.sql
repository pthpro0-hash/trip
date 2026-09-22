-- 나만의 여행 스케치 · 사진 보관함 접근 정책
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.
-- 앞서 Storage 에서 trip-photos 버킷을 비공개(Public 꺼짐)로 만들어 두어야 한다.
--
-- 여러 번 실행해도 안전하다.

-- ═══════════════════════════════════════════════
-- 사진은 사용자 폴더 안에만 둔다.
--
--   trip-photos/<사용자 id>/<방문 id>/<사진 id>.webp
--
-- 맨 앞 칸이 사용자 id 라, "폴더 이름이 곧 내 id 인 것만" 이라는 한 줄로
-- 남의 사진에 닿지 못하게 막을 수 있다. 버킷이 비공개여도 정책이 없으면
-- 아무도 올리지 못하고, 정책이 헐거우면 URL 을 아는 사람이 다 본다.
-- ═══════════════════════════════════════════════

drop policy if exists "trip_photos_read_own"   on storage.objects;
drop policy if exists "trip_photos_insert_own" on storage.objects;
drop policy if exists "trip_photos_update_own" on storage.objects;
drop policy if exists "trip_photos_delete_own" on storage.objects;

create policy "trip_photos_read_own" on storage.objects
  for select using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "trip_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "trip_photos_update_own" on storage.objects
  for update using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "trip_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
