import { describe, it, expect, vi, beforeEach } from "vitest";
import { LIST_HREF } from "@/lib/nav";

const redirect = vi.hoisted(() =>
  vi.fn<(to: string) => never>(() => {
    // next/navigation 의 redirect 는 던져서 그리기를 멈춘다.
    throw new Error("NEXT_REDIRECT");
  }),
);
vi.mock("next/navigation", () => ({ redirect }));
const { default: TripsPage } = await import("./page");

/*
  /trips 는 예전에 따로 선 목록 화면이었다. 지금 목록은 내 여행 화면의 한 모습이다
  (/?v=sketch&view=list). 북마크나 옛 링크로 들어온 사람을 그리로 넘긴다 — 이 화면이
  남아 있으면 "내 스케치"가 두 화면에 붙던 혼란이 되살아난다.
*/
describe("/trips · 옛 주소", () => {
  beforeEach(() => {
    // 화살표로 그대로 돌려주면 vitest 가 그것을 뒷정리 함수로 불러 버린다.
    redirect.mockClear();
  });

  it("내 여행 목록 모습으로 넘긴다", () => {
    expect(() => TripsPage()).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(LIST_HREF);
  });

  it("넘기는 곳은 내 여행 한 화면의 view=list 다", () => {
    expect(LIST_HREF).toBe("/?v=sketch&view=list");
  });
});
