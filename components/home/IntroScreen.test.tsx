import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { IntroScreen } from "./IntroScreen";
import { resetIntroShownForTest } from "@/lib/intro";

/*
  로그인 전 사람에게 방문마다 한 번 뜨는 전체 화면 소개. 약속 한 줄·특징 셋·시작하기·예시·건너뛰기가 있다.
  닫으면 뒤의 여행 100선이 그대로 보인다.
*/

const PHOTOS = ["https://tong.visitkorea.or.kr/a.jpg", "https://tong.visitkorea.or.kr/b.jpg", "https://tong.visitkorea.or.kr/c.jpg"];

const setReferrer = (value: string) => Object.defineProperty(document, "referrer", { value, configurable: true });
const 소개 = () => screen.findByRole("dialog", { name: /사진만 고르면/ });

describe("IntroScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetIntroShownForTest();
    document.cookie = "sb-test-auth-token=; path=/; max-age=0";
    setReferrer("");
    document.body.style.overflow = "";
  });

  it("로그인 전이면 뜬다 — 약속 한 줄과 설명 한 줄", async () => {
    render(<IntroScreen photos={PHOTOS} />);
    const dialog = await 소개();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent("사진만 고르면, 내 여행이 한 장이 돼요");
    expect(within(dialog).getByText("날짜와 장소로 저절로 정리해 드려요")).toBeTruthy();
  });

  it("특징 셋과 사진 출처가 있다", async () => {
    render(<IntroScreen photos={PHOTOS} />);
    const dialog = await 소개();
    const items = within(within(dialog).getByRole("list", { name: "특징" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "사진은 이 기기 안에서 읽어요",
      "다녀온 길이 지도 위에 그려져요",
      "부모님께는 링크 하나로 보여 드려요",
    ]);
    expect(within(dialog).getByText("사진: 한국관광공사")).toBeTruthy();
  });

  it("시작하기는 소개를 닫아 뒤의 여행 100선을 보이고, 예시 먼저 보기는 /example 로 간다", async () => {
    render(<IntroScreen photos={PHOTOS} />);
    const dialog = await 소개();
    expect(within(dialog).getByRole("link", { name: "예시 여행 먼저 보기" })).toHaveAttribute("href", "/example");
    fireEvent.click(within(dialog).getByRole("button", { name: "시작하기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("건너뛰기로 닫히고, 같은 방문에서 첫 화면에 돌아와도 다시 안 뜬다", async () => {
    const { unmount } = render(<IntroScreen photos={PHOTOS} />);
    await 소개();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();

    render(<IntroScreen photos={PHOTOS} />);
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("새 방문(저장소가 비었다)이면 다시 뜬다 — 이 기기에서 봤어도 상관없다", async () => {
    window.localStorage.setItem("intro:seen", "1");
    render(<IntroScreen photos={PHOTOS} />);
    expect(await 소개()).toBeTruthy();
  });

  it("검색에서 바로 넘어온 사람에게도 뜬다 — 로그인 전이면 무조건", async () => {
    setReferrer("https://www.google.com/search?q=속초");
    render(<IntroScreen photos={PHOTOS} />);
    expect(await 소개()).toBeTruthy();
  });

  it("Esc 로도 닫힌다", async () => {
    render(<IntroScreen photos={PHOTOS} />);
    await 소개();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("로그인한 사람(세션 쿠키가 있다)에게는 안 뜬다", async () => {
    document.cookie = "sb-test-auth-token=abc; path=/";
    render(<IntroScreen photos={PHOTOS} />);
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
