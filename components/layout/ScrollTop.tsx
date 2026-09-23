"use client";

/*
  맨 위로.

  여행 하나에 사진이 수십 장이라 상세가 길다. 다 보고 나서 위로 돌아가려면
  한참 쓸어 올려야 한다.

  내려간 뒤에만 나타나게 할 수도 있지만, 그러면 "있었다 없었다" 하는 것을
  눈으로 좇게 된다. 늘 같은 자리에 있는 편이 손이 기억한다.
*/
export function ScrollTop() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="맨 위로"
      className="fixed bottom-5 right-5 z-20 grid h-11 w-11 place-items-center rounded-full bg-surface text-[18px] text-text-muted shadow-lg ring-1 ring-line transition hover:bg-bg-subtle hover:text-text"
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
