import Link from "next/link";
import { tripShareTitle, type TripSnapshot } from "@/lib/tripShare";
import { publicFileUrl } from "@/lib/supabase/shares";
import { CourseMap } from "@/components/course/CourseMap";
import { SharedTripGallery, type GalleryVisit } from "./SharedTripGallery";

/*
  링크로 받은 여행 하나의 본문.

  로그인하지 않은 사람이 연다. 링크를 만들 때 베껴 둔 것(스냅샷)만 그리고,
  이 여행 말고 어디로도 이어지지 않는다 — 내 기록으로 가는 길도, 다른 여행으로
  가는 길도 없다. 마지막 안내만 서비스 첫 화면으로 간다.
  사진은 링크 보관함의 공개 주소로 건다. 여행 사진 보관함에는 닿지 않는다.
*/

interface SharedTripViewProps {
  id: string;
  snapshot: TripSnapshot;
}

const dayLabel = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;

export function SharedTripView({ id, snapshot }: SharedTripViewProps) {
  const visits: GalleryVisit[] = snapshot.visits.map((visit) => ({
    placeName: visit.placeName,
    dong: visit.dong,
    dayLabel: dayLabel(visit.day),
    urls: visit.photos.map((file) => publicFileUrl(id, file)),
  }));
  const stops = snapshot.visits.map((visit) => ({ lat: visit.lat, lng: visit.lng, name: visit.placeName }));
  const span =
    snapshot.startedOn === snapshot.endedOn
      ? dayLabel(snapshot.startedOn)
      : `${dayLabel(snapshot.startedOn)} ~ ${dayLabel(snapshot.endedOn)}`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <header className="flex flex-col gap-1">
        <p className="text-[14px] font-semibold text-text-faint">
          {snapshot.startedOn.slice(0, 4)}년 · {span}
        </p>
        <h1 className="text-[28px] font-bold leading-snug tracking-tight text-text md:text-[32px]">
          {tripShareTitle(snapshot)}
        </h1>
        {snapshot.subtitle && <p className="text-[16px] text-text-muted">{snapshot.subtitle}</p>}
      </header>

      {stops.length > 0 && (
        <div className="h-[320px] overflow-hidden rounded-2xl ring-1 ring-line">
          <CourseMap spots={stops} />
        </div>
      )}

      <SharedTripGallery visits={visits} />

      <section className="mt-2 flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[18px] font-bold tracking-tight text-text">나도 여행을 한 장으로</p>
        <p className="text-[15px] leading-relaxed text-text-muted">
          여행 사진만 고르면, 다녀온 곳이 지도 위에 저절로 그려지고 이런 기록이 남아요.
        </p>
        <Link
          href="/?v=sketch"
          className="self-start rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          내 여행 스케치 시작하기
        </Link>
      </section>
    </main>
  );
}
