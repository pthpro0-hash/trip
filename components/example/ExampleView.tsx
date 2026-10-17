import Image from "next/image";
import Link from "next/link";
import { AddPhotosLink } from "@/components/photo/AddPhotosLink";
import { SharedCard } from "@/components/share/SharedCard";
import type { Example } from "@/lib/example";
import { PHOTO_CREDIT } from "@/lib/media";
import { SPOTS_HREF } from "@/lib/nav";

/*
  예시 여행 — 사진을 고르기 전에 완성된 모습을 한 번에 본다.

  설명과 아이콘만으로는 결과를 상상하기 어렵다. 실제로 쓰는 것과 같은 카드를 예시 자료로 그려서 "사진 → 여행으로 정리 →
  지도와 한 장 카드" 세 걸음을 위에서 아래로 훑어 보게 한다. 로그인도 내 사진도 필요 없다(lib/example).
  예시라는 것, 내 기록이 아니라는 것은 맨 위에 분명히 적는다.
*/

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-bold text-on-accent">
          {number}
        </span>
        <h2 className="text-[19px] font-bold tracking-tight text-text">{title}</h2>
      </div>
      {children}
    </li>
  );
}

export function ExampleView({ example }: { example: Example }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 pb-16 pt-8">
      <header className="flex flex-col gap-2">
        <p className="w-fit rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent">예시</p>
        <h1 className="text-[28px] font-bold leading-snug tracking-tight text-text md:text-[34px]">
          사진만 고르면, 이렇게 돼요
        </h1>
        <p className="text-[15px] leading-relaxed text-text-muted">
          아래는 예시 여행이에요. 내 사진이나 기록이 아니에요. 로그인하지 않아도 끝까지 볼 수 있어요.
        </p>
      </header>

      <ol className="flex flex-col gap-10">
        <Step number={1} title="사진을 고르면">
          <ul className="grid grid-cols-3 gap-2">
            {example.photos.map((photo) => (
              <li key={photo.file} className="flex flex-col gap-1">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-bg-subtle">
                  <Image src={photo.url} alt={`${photo.placeName} 사진`} fill sizes="(max-width: 672px) 33vw, 220px" className="object-cover" />
                </div>
                <span className="text-[12px] text-text-faint">{photo.takenAt}</span>
              </li>
            ))}
          </ul>
          <p className="break-keep text-[14px] leading-relaxed text-text-muted">
            사진에 남아 있는 촬영 시각과 위치를 읽어요. 읽는 동안 사진은 이 기기 밖으로 나가지 않아요.
          </p>
        </Step>

        <Step number={2} title="날짜와 장소로 여행이 묶여요">
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
            <div>
              <p className="text-[17px] font-semibold tracking-tight text-text">{example.title}</p>
              <p className="mt-1.5 text-[13px] text-text-faint">
                {example.span} · 사진 {example.photos.length}장 · 방문 {example.visits.length}곳
              </p>
            </div>
            <ol className="flex flex-col gap-2 border-t border-line pt-3">
              {example.visits.map((visit, index) => (
                <li key={visit.placeName} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bg-subtle text-[12px] font-semibold text-text-muted">
                    {index + 1}
                  </span>
                  <p className="min-w-0 text-[14px] text-text">
                    <span className="font-medium">{visit.placeName}</span>
                    <span className="block text-[12px] text-text-faint">{visit.when}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <p className="break-keep text-[14px] leading-relaxed text-text-muted">
            언제, 어디서 찍었는지로 저절로 묶여요. 제목과 함께한 사람은 직접 고칠 수 있어요.
          </p>
        </Step>

        <Step number={3} title="지도와 한 장 카드로 남아요">
          <div className="overflow-hidden rounded-2xl ring-1 ring-line">
            <SharedCard snapshot={example.snapshot} photos={example.photoUrls} />
          </div>
          <p className="break-keep text-[14px] leading-relaxed text-text-muted">
            다녀온 길이 지도 위에 그려지고, 한 장 카드로 저장하거나 링크로 보낼 수 있어요.
          </p>
        </Step>
      </ol>

      <section className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[18px] font-bold tracking-tight text-text">내 사진으로 만들어 보세요</p>
        <p className="text-[15px] leading-relaxed text-text-muted">사진을 고르는 것부터 시작해요. 기록할 때 로그인해요.</p>
        <AddPhotosLink
          href="/trips/new"
          className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-[16px] font-semibold text-on-accent transition hover:bg-accent-hover sm:w-fit"
        >
          내 사진으로 만들어 보기
        </AddPhotosLink>
        <Link href={SPOTS_HREF} className="w-fit text-[14px] font-medium text-text-muted underline underline-offset-2 transition hover:text-text">
          가 볼 곳은 한국관광 100선에서 찾아요
        </Link>
      </section>

      <p className="text-[12px] text-text-faint">예시 사진 — {PHOTO_CREDIT}</p>
    </main>
  );
}
