import spotsData from "@/lib/data/spots.json";
import { distanceKm } from "@/lib/geo";
import { getSpotMedia } from "@/lib/media";
import type { MonthCell } from "@/lib/sketch";
import type { ShareSnapshot } from "@/lib/share";
import type { Spot } from "@/lib/types";

/*
  '예시 여행' — 사진을 고르기 전에 완성된 모습을 보여 주는 가짜 여행(app/example).

  로그인도 내 사진도 없이 "사진 → 여행으로 정리 → 지도와 한 장 카드"를 한 번에 보여 준다. 사진은 한국관광공사 여행 100선의 공개 사진을
  쓴다 — 새로 올려 둘 파일이 없고, 출처가 분명하다. 한 장 카드는 링크로 받은 한 장(components/share)이 그리는 것과 같은 카드라서,
  예시에서 본 모양이 곧 내가 만들게 될 모양이다.

  이것은 예시일 뿐 누구의 기록도 아니다 — 화면에도 그렇게 적는다.
*/

const SPOTS = spotsData as Spot[];

/** 예시의 해. 카드 머리에 "2026년"으로 그려진다. */
export const EXAMPLE_YEAR = 2026;

/** 들른 곳 — 여행 100선의 id 와, 그곳에서 찍은 것으로 보이는 때. 사진은 곳마다 두 장. */
const STOPS = [
  { spotId: "속초-관광수산시장", day: "09-13", from: "10:40", to: "11:35" },
  { spotId: "설악산-국립공원", day: "09-13", from: "13:20", to: "16:05" },
  { spotId: "정동심곡-바다부채길", day: "09-14", from: "09:30", to: "10:50" },
] as const;

const PHOTOS_PER_STOP = 2;

export interface ExamplePhoto {
  /** 한 장 카드가 사진을 찾는 이름. */
  file: string;
  url: string;
  /** "09-13 10:40" — 사진에서 읽히는 촬영 시각. */
  takenAt: string;
  placeName: string;
}

export interface ExampleVisit {
  placeName: string;
  /** "09-13 10:40~11:35 · 2장". */
  when: string;
  photos: number;
}

export interface Example {
  title: string;
  /** "2026년 9월 13일 ~ 14일". */
  span: string;
  photos: ExamplePhoto[];
  visits: ExampleVisit[];
  snapshot: ShareSnapshot;
  /** 한 장 카드가 그릴 사진 주소(파일 이름 → 주소). */
  photoUrls: Map<string, string>;
}

const spotOf = (id: string) => SPOTS.find((spot) => spot.id === id);

/** 만들 수 없는 곳(자료가 빠진 곳)은 건너뛴다 — 예시가 깨지느니 한 곳이 줄어드는 편이 낫다. */
export function buildExample(): Example | null {
  const stops = STOPS.flatMap((stop) => {
    const spot = spotOf(stop.spotId);
    const images = getSpotMedia(stop.spotId)?.images.slice(0, PHOTOS_PER_STOP) ?? [];
    return spot && images.length > 0 ? [{ ...stop, spot, images }] : [];
  });
  if (stops.length < 2) return null;

  const photos: ExamplePhoto[] = stops.flatMap((stop) =>
    stop.images.map((image, index) => ({
      file: `${stop.spotId}-${index}`,
      url: image.url,
      // 한 곳에서 찍은 두 장은 머문 동안의 앞뒤 시각.
      takenAt: `${stop.day} ${index === 0 ? stop.from : stop.to}`,
      placeName: stop.spot.name,
    })),
  );

  const visits: ExampleVisit[] = stops.map((stop) => ({
    placeName: stop.spot.name,
    when: `${stop.day} ${stop.from}~${stop.to} · ${stop.images.length}장`,
    photos: stop.images.length,
  }));

  let distance = 0;
  for (let i = 1; i < stops.length; i += 1) distance += distanceKm(stops[i - 1].spot, stops[i].spot);

  const months: MonthCell[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    tripCount: i + 1 === 9 ? 1 : 0,
    season: i + 1 === 9 ? "가을" : null,
  }));
  const top = stops[1];

  const snapshot: ShareSnapshot = {
    v: 1,
    year: EXAMPLE_YEAR,
    scope: "photos",
    card: "map",
    headline: "바다와 산을 걸은 1박 2일",
    stats: {
      tripCount: 1,
      placeCount: stops.length,
      photoCount: photos.length,
      distanceKm: Math.round(distance * 10) / 10,
      spanDays: 2,
      curatedCount: stops.length,
    },
    months,
    dots: stops.map((stop) => ({
      lat: stop.spot.lat,
      lng: stop.spot.lng,
      placeName: stop.spot.name,
      photoCount: stop.images.length,
      season: "가을",
      month: "2026-09",
      photo: `${stop.spotId}-0`,
    })),
    paths: [{ season: "가을", points: stops.map((stop) => ({ lat: stop.spot.lat, lng: stop.spot.lng })) }],
    story: {
      seasons: [{ season: "가을", trips: 1 }],
      seasonLine: null,
      distanceWords: null,
      sido: ["강원"],
      firstSido: null,
      topPlace: { placeName: top.spot.name, photoCount: top.images.length, photo: `${top.spotId}-0` },
      compare: null,
      photos: photos.map((photo) => photo.file),
    },
    files: [],
    cover: null,
  };

  return {
    title: `${stops[0].spot.name} 외 ${stops.length - 1}곳`,
    span: "2026년 9월 13일 ~ 14일",
    photos,
    visits,
    snapshot,
    photoUrls: new Map(photos.map((photo) => [photo.file, photo.url])),
  };
}
