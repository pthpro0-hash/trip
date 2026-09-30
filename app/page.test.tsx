import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let remembered: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "start" && remembered ? { value: remembered } : undefined) }),
}));

const sketchProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
vi.mock("@/components/hub/SketchHub", () => ({
  SketchHub: (props: Record<string, unknown>) => {
    sketchProps.current = props;
    return <p>지도 허브</p>;
  },
}));
vi.mock("@/components/home/SpotsHome", () => ({ SpotsHome: () => <p>여행 100선 홈</p> }));
vi.mock("@/components/home/StartSwitch", () => ({ StartSwitch: () => null }));
vi.mock("@/components/help/SketchInvite", () => ({ SketchInvite: () => null }));
const { default: HomePage } = await import("./page");

const open = async (params: Record<string, string>) => render(await HomePage({ searchParams: Promise.resolve(params) }));

/*
  내 여행은 지도와 목록 두 모습이다. 어느 모습으로 열지는 주소(?view=)가 정한다 —
  링크를 건네받거나 새로 고쳐도 같은 모습이어야 한다.
*/
describe("HomePage · 내 여행의 모습", () => {
  beforeEach(() => {
    remembered = undefined;
    sketchProps.current = null;
  });

  it("주소에 view 가 없으면 지도", async () => {
    await open({ v: "sketch" });
    expect(screen.getByText("지도 허브")).toBeTruthy();
    expect(sketchProps.current?.initialView).toBe("map");
  });

  it("view=list 면 목록 모습으로 연다", async () => {
    await open({ v: "sketch", view: "list" });
    expect(sketchProps.current?.initialView).toBe("list");
  });

  it("엉뚱한 view 는 지도", async () => {
    await open({ v: "sketch", view: "해킹" });
    expect(sketchProps.current?.initialView).toBe("map");
  });

  it("보던 해(?y=)도 함께 넘긴다", async () => {
    await open({ v: "sketch", y: "2025" });
    expect(sketchProps.current?.initialYear).toBe("2025");
  });

  it("지난번에 내 여행을 골랐으면 주소에 갈래가 없어도 내 여행", async () => {
    remembered = "sketch";
    await open({});
    expect(screen.getByText("지도 허브")).toBeTruthy();
  });

  it("여행 100선이 열릴 때는 내 여행의 모습을 따지지 않는다", async () => {
    await open({ v: "spots", view: "list" });
    expect(screen.getByText("여행 100선 홈")).toBeTruthy();
    expect(sketchProps.current).toBeNull();
  });
});
