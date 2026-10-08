import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let remembered: string | undefined;
let cookieNames: string[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "start" && remembered ? { value: remembered } : undefined),
    getAll: () => cookieNames.map((name) => ({ name, value: "x" })),
  }),
}));

const sketchProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
const spotsProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));
vi.mock("@/components/hub/SketchHub", () => ({
  SketchHub: (props: Record<string, unknown>) => {
    sketchProps.current = props;
    return <p>지도 허브</p>;
  },
}));
vi.mock("@/components/home/SpotsHome", () => ({
  SpotsHome: (props: Record<string, unknown>) => {
    spotsProps.current = props;
    return <p>여행 100선 홈</p>;
  },
}));
vi.mock("@/components/home/StartSwitch", () => ({ StartSwitch: () => null }));
const { default: HomePage } = await import("./page");

const open = async (params: Record<string, string>) => render(await HomePage({ searchParams: Promise.resolve(params) }));

/*
  내 여행은 지도와 목록 두 모습이다. 어느 모습으로 열지는 주소(?view=)가 정한다 —
  링크를 건네받거나 새로 고쳐도 같은 모습이어야 한다.
*/
describe("HomePage · 내 여행의 모습", () => {
  beforeEach(() => {
    remembered = undefined;
    cookieNames = [];
    sketchProps.current = null;
    spotsProps.current = null;
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

  it("지난번에 내 여행을 골랐으면 주소에 갈래가 없어도 내 여행 — 로그인했을 수 있을 때", async () => {
    remembered = "sketch";
    cookieNames = ["start", "sb-abcdefgh-auth-token"];
    await open({});
    expect(screen.getByText("지도 허브")).toBeTruthy();
  });

  /*
    로그인하지 않은 사람에게 내 여행은 보여 줄 것이 없는 빈 지도다 — 지도가 화면을 다 차지하고 안내는 작은 시트
    하나뿐이다. 지난번에 내 여행을 골랐어도(로그아웃, 세션 만료) 로그인한 사람일 수 없으면 여행 100선 쪽(환영 영역
    이 맨 위에 있다)을 연다. 탭을 눌러 주소에 갈래가 적혔으면 그것을 따른다.
  */
  it("로그인 쿠키가 없으면 지난번에 골랐던 내 여행을 따르지 않고 여행 100선(환영 영역)을 연다", async () => {
    remembered = "sketch";
    cookieNames = ["start"];
    await open({});
    expect(screen.getByText("여행 100선 홈")).toBeTruthy();
    expect(sketchProps.current).toBeNull();
  });

  it("로그인 전이어도 주소에 v=sketch 가 있으면(탭을 눌렀으면) 내 여행을 연다", async () => {
    remembered = "sketch";
    cookieNames = ["start"];
    await open({ v: "sketch" });
    expect(screen.getByText("지도 허브")).toBeTruthy();
  });

  it("여행 100선이 열릴 때는 내 여행의 모습을 따지지 않는다", async () => {
    await open({ v: "spots", view: "list" });
    expect(screen.getByText("여행 100선 홈")).toBeTruthy();
    expect(sketchProps.current).toBeNull();
  });
});

/*
  첫 화면 맨 위(환영 영역 또는 내 여행 한 줄)가 번쩍이거나 아래를 밀지 않게, 서버가 로그인 쿠키가 있는지만
  보고 첫 그림을 정한다. 검색엔진처럼 쿠키가 없으면 환영 영역이 처음부터 보인다.
*/
describe("HomePage · 로그인 쿠키를 보고 첫 그림을 정한다", () => {
  beforeEach(() => {
    remembered = undefined;
    cookieNames = [];
    spotsProps.current = null;
  });

  it("쿠키가 하나도 없으면 로그인한 사람일 수 없다", async () => {
    await open({});
    expect(spotsProps.current?.maybeSignedIn).toBe(false);
  });

  it("로그인 세션 쿠키가 있으면 로그인한 사람일 수 있다", async () => {
    cookieNames = ["sb-abcdefgh-auth-token"];
    await open({});
    expect(spotsProps.current?.maybeSignedIn).toBe(true);
  });

  it("갈래를 기억하는 쿠키(start)만으로는 로그인했다고 보지 않는다", async () => {
    remembered = "spots";
    cookieNames = ["start"];
    await open({});
    expect(spotsProps.current?.maybeSignedIn).toBe(false);
  });

  it("안내 창(SketchInvite)은 더 두지 않는다", async () => {
    const { container } = await open({});
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });
});
