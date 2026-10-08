import type { Metadata } from "next";
import Link from "next/link";
import { CHAPTERS } from "@/lib/help";
import { ScrollTop } from "@/components/layout/ScrollTop";
import { StorageTidy } from "@/components/trip/StorageTidy";

export const metadata: Metadata = {
  title: "도움말",
  description:
    "사진으로 여행 기록 만들기, 내 여행 지도, 이번 여행 코스 짜기, 여행 100선 사용법을 안내합니다.",
  alternates: { canonical: "/help" },
};

/*
  다 적어 둔 곳.

  "그게 어디 있더라" 싶을 때 와서 찾는 곳이 여기라, 갈래를 다 펴 놓고
  위에 목차를 둔다.

  글은 세 층이다. 갈래마다 한 줄 요약이 먼저 보이고, 그 밑에 항목의 목록(제목 + 한 줄 요약),
  항목을 눌러야 자세한 설명이 펼쳐진다. 한꺼번에 다 펼쳐 두면 길어서 찾는 사람이 놓친다.
*/
export default function HelpPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pb-16 pt-8">
      <header>
        <h1 className="text-[32px] font-bold tracking-tight text-text md:text-[40px]">도움말</h1>
        <p className="mt-1 text-[16px] leading-relaxed text-text-muted">
          사진만 고르면 다녀온 길이 한 장의 그림이 됩니다. 어디를 눌러 무엇이 되는지 적어
          두었어요.
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-text-faint">항목을 누르면 자세한 설명이 펼쳐져요.</p>
      </header>

      {/* 찾으러 온 사람은 목차부터 본다. */}
      <nav aria-label="목차" className="flex flex-wrap gap-2">
        {CHAPTERS.map((chapter) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            className="rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
          >
            <span aria-hidden="true">{chapter.icon}</span> {chapter.title}
          </a>
        ))}
        <a
          href="#data"
          className="rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
        >
          <span aria-hidden="true">🗂️</span> 내 데이터
        </a>
      </nav>

      {CHAPTERS.map((chapter) => (
        <section
          key={chapter.id}
          id={chapter.id}
          /* 위 띠가 붙박이라, 목차로 건너뛰면 제목이 그 밑에 가린다. */
          className="scroll-mt-20 flex flex-col gap-3 rounded-2xl bg-surface p-6 ring-1 ring-line"
        >
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-text">
              <span aria-hidden="true">{chapter.icon}</span> {chapter.title}
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-text-muted">{chapter.blurb}</p>
          </div>

          {/* 목록: 제목과 한 줄 요약. 눌러야 자세한 설명(detail)이 펼쳐진다. */}
          <ol className="flex flex-col gap-1.5">
            {chapter.steps.map((step, index) => (
              <li key={step.title}>
                <details className="group rounded-xl open:bg-bg-subtle">
                  <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-bg-subtle [&::-webkit-details-marker]:hidden">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-text">{step.title}</span>
                      <span className="mt-0.5 block text-[14px] leading-snug text-text-muted">{step.summary}</span>
                    </span>
                    <span aria-hidden="true" className="mt-0.5 shrink-0 text-[18px] text-text-faint transition group-open:rotate-90">
                      ›
                    </span>
                  </summary>
                  <p className="px-2 pb-3 pl-[2.75rem] text-[14px] leading-relaxed text-text-muted">{step.detail}</p>
                </details>
              </li>
            ))}
          </ol>

          <Link
            href={chapter.href}
            className="self-start rounded-full bg-bg-subtle px-4 py-2 text-[13px] font-medium text-accent transition hover:bg-accent-soft"
          >
            {chapter.hrefLabel} →
          </Link>
        </section>
      ))}

      {/*
        사진 보관함 정리. 예전에는 여행 목록 맨 아래에 있었다. 목록이 내 여행 화면의 한
        모습이 되면서 자리를 잃었고, 자주 쓸 일이 아니라 여기에 둔다.
      */}
      <section id="data" className="scroll-mt-20">
        <h2 className="text-[22px] font-bold tracking-tight text-text">
          <span aria-hidden="true">🗂️</span> 내 데이터
        </h2>
        <p className="mt-1 text-[15px] leading-relaxed text-text-muted">
          계정에 쌓인 사진이 얼마나 자리를 쓰는지 보고, 쓰지 않는 파일을 정리해요.
        </p>
        <StorageTidy />
      </section>

      <p className="text-[14px] leading-relaxed text-text-faint">
        찾으시는 것이 없으면{" "}
        <Link href="/terms" className="font-medium text-accent hover:text-accent-hover">
          이용약관
        </Link>
        과{" "}
        <Link href="/privacy" className="font-medium text-accent hover:text-accent-hover">
          개인정보 처리방침
        </Link>
        도 확인하실 수 있어요.
      </p>

      <ScrollTop />
    </main>
  );
}
