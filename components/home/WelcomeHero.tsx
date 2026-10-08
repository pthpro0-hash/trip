import Image from "next/image";
import Link from "next/link";

/*
  처음 온 사람에게 이 서비스가 무엇을 해 주는지를 말한다. 첫 화면 맨 위.

  예전에는 이 말을 네 군데에서 서로 다르게 했다 — 큰 제목("한국관광 100선"), 사용법 안내 창, "내 여행" 안내
  창, 본문 카드. 이제 이 한 곳이 한다: 약속 한 줄, 결과를 보여 주는 예시 한 장, 누를 단추 하나.

  예시 그림(public/hero-sample.webp)은 지도형 카드(SketchCard)를 예시 데이터로 한 번 그려 그림 파일로 둔 것이다.
  예시 데이터: 2026년, 다섯 번의 여행(서울·경주·강릉·제주·여수), 사진 463장 — 실제 누군가의 기록이 아니다.
  카드의 모양이 바뀌면 다시 만든다. 그림 파일이라 시도 경계 데이터(60KB)를 첫 화면에 새로 싣지 않는다.

  제목은 h2 다. 이 화면이 검색에 걸리는 까닭은 "한국관광 100선"이라 그 소제목(h1)이 아래 구획에서 큰 제목 자리를
  지킨다(SpotsHome).

  안심 한 줄은 정확해야 한다: 고르는 동안(읽는 동안)은 사진이 기기 밖으로 나가지 않지만, 기록할 때 사진도 함께
  올리기를 고르면 올라간다. "올라가지 않아요"라고 하면 틀린 약속이 된다.
*/

/** guest 는 로그인 전, empty 는 로그인했지만 아직 여행이 하나도 없는 사람. */
export type WelcomeWho = "guest" | "empty";

function Lock() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mt-px h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function WelcomeHero({ who }: { who: WelcomeWho }) {
  return (
    <section aria-labelledby="welcome-title" className="flex flex-col sm:rounded-3xl sm:bg-bg-subtle sm:p-10">
      {/*
        폰: 위 줄에 글(왼쪽)과 예시(오른쪽 작게), 아래 줄에 단추가 폭을 다 쓴다. 넓은 화면: 글과 단추가 왼쪽에 쌓이고
        예시가 오른쪽에 크게 선다. 이름 붙인 칸(grid-area)으로 순서는 그대로 두고 자리만 바꾼다.
      */}
      <div className="grid grid-cols-[minmax(0,1fr)_112px] items-start gap-x-3 gap-y-4 [grid-template-areas:'text_figure'_'cta_cta'] sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-x-10 sm:gap-y-6 sm:[grid-template-areas:'text_figure'_'cta_figure']">
        <div className="[grid-area:text] sm:self-end">
          <h2
            id="welcome-title"
            className="text-[24px] font-bold leading-[1.3] tracking-tight text-text sm:text-[40px] sm:leading-[1.25]"
          >
            사진만 고르면,{" "}
            <br />
            여행이 정리돼요
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-text-muted sm:mt-3 sm:text-[17px]">
            날짜와 장소로 묶고, 지도와 한 장짜리 카드로 만들어 드려요.
          </p>
        </div>

        <figure className="flex flex-col items-center gap-1 [grid-area:figure] sm:self-center">
          {/* 그림 파일이라 최적화 서비스를 거치지 않는다. 크기를 적어 두어 자리가 먼저 잡힌다. */}
          <Image
            src="/hero-sample.webp"
            width={320}
            height={471}
            unoptimized
            loading="eager"
            alt="한 해의 여행이 지도와 숫자로 정리된 한 장 카드의 예시"
            className="h-auto w-full rounded-xl ring-1 ring-line"
          />
          <figcaption className="text-[11px] text-text-faint">예시</figcaption>
        </figure>

        <div className="flex flex-col gap-3 [grid-area:cta] sm:self-start">
          <Link
            href="/trips/new"
            className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-[16px] font-semibold text-on-accent transition hover:bg-accent-hover sm:w-auto sm:self-start sm:px-10"
          >
            사진 고르기
          </Link>
          <div className="flex items-start gap-1.5 text-[13px] leading-snug text-text-muted">
            <Lock />
            <p>
              고르는 동안 사진은 이 기기 밖으로 나가지 않아요
              {who === "guest" && (
                <>
                  <br />
                  <span className="text-text-faint">기록으로 남길 때 로그인해요</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-[14px] sm:mt-8 sm:pt-5">
        <span className="text-text-muted">어디 갈지 고민이면</span>
        <a href="#spots" className="shrink-0 font-medium text-accent transition hover:text-accent-hover">
          여행 100선 둘러보기 ›
        </a>
      </div>
    </section>
  );
}
