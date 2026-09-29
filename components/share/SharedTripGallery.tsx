"use client";

import { useState } from "react";
import { PhotoViewer } from "@/components/trip/PhotoViewer";

/*
  링크로 받은 여행의 곳별 사진.

  사진은 링크 보관함의 공개 주소라 주소를 받아 올 것이 없다. 크게 볼 때는
  여행 전체를 한 줄로 이어 넘긴다(TripDetail 과 같다).
*/

export interface GalleryVisit {
  placeName: string;
  dong: string | null;
  /** "9월 13일". */
  dayLabel: string;
  urls: string[];
}

export function SharedTripGallery({ visits }: { visits: GalleryVisit[] }) {
  const reel = visits.flatMap((visit) => visit.urls);
  const [viewing, setViewing] = useState<number | null>(null);

  const move = (step: number) => {
    if (viewing === null || reel.length === 0) return;
    setViewing((viewing + step + reel.length) % reel.length);
  };

  let offset = 0;
  return (
    <>
      <ol className="flex flex-col gap-6">
        {visits.map((visit, index) => {
          const start = offset;
          offset += visit.urls.length;
          return (
            <li key={index} className="flex flex-col gap-2">
              <div>
                <h2 className="text-[18px] font-bold tracking-tight text-text">{visit.placeName}</h2>
                <p className="text-[13px] text-text-faint">
                  {[visit.dayLabel, visit.dong].filter(Boolean).join(" · ")}
                </p>
              </div>
              {visit.urls.length > 0 && (
                <ul className="grid grid-cols-3 gap-1.5">
                  {visit.urls.map((url, photoIndex) => (
                    <li key={url}>
                      <button
                        type="button"
                        onClick={() => setViewing(start + photoIndex)}
                        aria-label={`${visit.placeName} 사진 ${photoIndex + 1} 크게 보기`}
                        className="block aspect-square w-full overflow-hidden rounded-xl bg-bg-subtle"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      {viewing !== null && reel[viewing] && (
        <PhotoViewer
          url={reel[viewing]}
          index={viewing + 1}
          total={reel.length}
          onClose={() => setViewing(null)}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
        />
      )}
    </>
  );
}
