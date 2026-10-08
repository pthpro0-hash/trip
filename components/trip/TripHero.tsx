/*
  여행 상세 맨 위의 대표 사진.

  전에는 글쓰기 칸(제목 · 부제 · 동행)으로 시작했다. 다녀온 여행을 열었는데 가장 먼저 보이는 것이 입력칸이면 "내 여행"이라는
  느낌이 안 든다. 대표 사진이 맨 위에 서면 어느 여행인지 곧바로 알아본다. 눌러서 크게 볼 수 있다(아래 사진들과 같은 창).

  사진 주소는 나중에 도착한다(서명 주소를 따로 받아 온다). 그동안은 같은 크기의 빈 자리를 둔다 — 도착하면서 아래
  내용이 밀리면 읽던 자리를 잃는다.
*/

/*
  폰에서는 가로로 넉넉한 16:10. 넓은 화면은 폭이 672px 까지 늘어 같은 비율이면 420px 가 넘는다 — 제목과 공유 단추가 첫 화면
  아래로 밀려난다. 넓은 화면에서는 더 납작한 21:9 로 줄인다.
*/
const FRAME = "block aspect-[16/10] w-full overflow-hidden rounded-2xl bg-bg-subtle ring-1 ring-line sm:aspect-[21/9]";

interface TripHeroProps {
  /** 대표 사진의 주소. 아직 받아 오는 중이면 null. */
  url: string | null;
  /** 크게 보는 창을 연다. */
  onOpen: () => void;
}

export function TripHero({ url, onOpen }: TripHeroProps) {
  if (!url) return <div aria-hidden="true" className={FRAME} />;

  return (
    <button type="button" onClick={onOpen} aria-label="대표 사진 크게 보기" className={`${FRAME} cursor-zoom-in`}>
      {/* 우리 보관함의 서명 주소라 그때그때 달라진다. next/image 로 미리 최적화할 수 없다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
    </button>
  );
}
