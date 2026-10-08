"use client";

import { useEffect, useRef, useState } from "react";
import { inSequence } from "@/lib/photo/preview";
import { previewFromFile } from "@/lib/photo/resize";

/*
  여행 카드의 작은 그림.

  고른 사진은 아직 어디에도 올라가지 않았다 — 기기 안의 원본 파일뿐이다. 칸마다 작은 판을 구워 붙이는데,
  사진이 수백 장이어도 폰이 버티도록 두 가지를 지킨다.
    1. 화면 가까이 온 카드의 것만 펼친다(IntersectionObserver). 열 번째 카드의 사진은 거기까지 내려가야 펼친다.
    2. 한 번에 하나씩 펼친다(inSequence). 12MP 사진 하나가 펼쳐지면 50MB 가까이 쓴다.
  브라우저가 못 여는 형식(크롬의 HEIC 같은 것)은 칸을 비워 둔다 — 알아보는 데에는 나머지 사진과 제목이 있다.

  칸은 그림이 오기 전에도 같은 자리에 있어서, 나중에 채워져도 카드가 밀리지 않는다.

  칸에 붙일 사진은 처음 받은 것으로 정한다. 부르는 쪽은 다시 그릴 때마다(제목을 한 글자 칠 때마다) 같은 사진으로
  새 배열을 건네는데, 새 배열이 왔다고 그림을 지우고 다시 구우면 한 글자마다 그림이 깜빡이고 폰이 같은 사진을
  계속 다시 펼친다. 사진이 정말 바뀌면(나누기 · 합치기) 부르는 쪽이 key 를 바꿔 새로 시작한다.
*/
export function TripThumbs({ files: given }: { files: File[] }) {
  const [files] = useState(given);
  const box = useRef<HTMLDivElement>(null);
  const [urls, setUrls] = useState<(string | null)[]>(() => files.map(() => null));

  useEffect(() => {
    const node = box.current;
    if (!node) return;

    let alive = true;
    const made: string[] = [];
    let observer: IntersectionObserver | undefined;

    const load = async () => {
      for (const [index, file] of files.entries()) {
        if (!alive) return;
        try {
          const blob = await inSequence(async () => {
            // 줄을 서는 동안 카드가 사라졌으면 펼치지 않는다.
            if (!alive) throw new Error("gone");
            return previewFromFile(file, file.name);
          });
          if (!alive) return;
          const url = URL.createObjectURL(blob);
          made.push(url);
          setUrls((now) => now.map((old, at) => (at === index ? url : old)));
        } catch {
          // 열지 못하는 형식이거나 사라졌다. 칸을 비워 둔다.
        }
      }
    };

    // 화면 가까이 오는 것을 알 수 없는 곳이면 바로 시작한다.
    if (typeof IntersectionObserver === "undefined") {
      void load();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          void load();
        },
        { rootMargin: "300px 0px" },
      );
      observer.observe(node);
    }

    return () => {
      alive = false;
      observer?.disconnect();
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div ref={box} aria-hidden="true" className="flex gap-1.5">
      {files.map((file, index) => (
        <span
          key={`${file.name}:${index}`}
          data-tile
          className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bg-subtle ring-1 ring-line"
        >
          {urls[index] && (
            // 이 기기 안에서 만든 임시 주소라 최적화할 것이 없다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[index]!} alt="" className="h-full w-full object-cover" />
          )}
        </span>
      ))}
    </div>
  );
}
