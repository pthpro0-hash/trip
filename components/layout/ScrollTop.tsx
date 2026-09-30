"use client";

/*
  맨 위로.

  여행 하나에 사진이 수십 장이라 상세가 길다. 다 보고 나서 위로 돌아가려면
  한참 쓸어 올려야 한다.

  내려간 뒤에만 나타나게 할 수도 있지만, 그러면 "있었다 없었다" 하는 것을
  눈으로 좇게 된다. 늘 같은 자리에 있는 편이 손이 기억한다.
*/
/**
 * @param raised 이미 떠 있는 단추가 아래 구석에 있을 때 한 칸 올려 둔다.
 *   둘러보기에는 "사진 고르기"가 같은 자리에 있어 겹친다(폰에는 그 단추가 없다).
 *
 * 폰에서는 하단 탭이 아래를 덮으므로 그 높이(--bottom-nav-h)만큼 올린다. 넓은
 * 화면에서는 그 값이 0 이라 예전 자리(아래 20px)와 같다.
 */
export function ScrollTop({ raised = false }: { raised?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="맨 위로"
      className={`fixed right-5 z-20 grid h-11 w-11 place-items-center rounded-full bg-surface text-[18px] text-text-muted shadow-lg ring-1 ring-line transition hover:bg-bg-subtle hover:text-text ${
        raised
          ? "bottom-[calc(1.25rem+var(--bottom-nav-h,0px))] sm:bottom-[76px]"
          : "bottom-[calc(1.25rem+var(--bottom-nav-h,0px))]"
      }`}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
