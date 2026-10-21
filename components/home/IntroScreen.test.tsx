import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { IntroScreen } from "./IntroScreen";
import { readIntroSeen } from "@/lib/intro";

/*
  이 기기에서 처음 온 로그인 전 사람에게 한 번 뜨는 전체 화면 소개. 약속 한 줄·특징 셋·시작하기·예시·건너뛰기가 있고,
  뜨면 환영 팝업이 이번 방문에 겹치지 않게 적어 둔다.
*/

const PHOTOS = ["https://tong.visitkorea.or.kr/a.jpg", "https://tong.visitkorea.or.kr/b.jpg", "https://tong.visitkorea.or.kr/c.jpg"];

const setReferrer = (value: string) => Object.defineProperty(document, "referrer", { value, configurable: true });
const 소개 = () => screen.findByRole("dialog", { name: /사진만 고르면/ });

describe("IntroScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.cookie = "sb-test-auth-token=; path=/; max-age=0";
    setReferrer("");
    document.body.style.overflow = "";
  });

  it("처음 온 사람에게 뜬다 — 약속 한 줄과 설명 한 줄", async () => {
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

  it("시작하기는 사진 고르기로, 예시 먼저 보기는 /example 로 간다", async () => {
    render(<IntroScreen photos={PHOTOS} />);
    const dialog = await 소개();
    expect(within(dialog).getByRole("link", { name: "시작하기" })).toHaveAttribute("href", "/trips/new");
    expect(within(dialog).getByRole("link", { name: "예시 여행 먼저 보기" })).toHaveAttribute("href", "/example");
  });

  it("뜨는 순간 이 기기에서 봤다고 적고, 이번 방문의 환영 팝업은 건너뛰게 한다", async () => {
    render(<IntroScreen photos={PHOTOS} />);
    await 소개();
    expect(readIntroSeen()).toBe(true);
    expect(window.sessionStorage.getItem("welcome:shown")).toBe("1");
  });

  it("건너뛰기와 Esc 로 닫히고, 뒤 화면의 스크롤을 되돌린다", async () => {
    const { unmount } = render(<IntroScreen photos={PHOTOS} />);
    await 소개();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    unmount();

    render(<IntroScreen photos={PHOTOS} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Esc 로도 닫힌다", async () => {
    window.localStorage.clear();
    render(<IntroScreen photos={PHOTOS} />);
    await 소개();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("이미 본 기기에는 안 뜬다", async () => {
    window.localStorage.setItem("intro:seen", "1");
    render(<IntroScreen photos={PHOTOS} />);
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("검색에서 바로 넘어온 사람에게는 안 뜨고, 봤다고도 적지 않는다", async () => {
    setReferrer("https://www.google.com/search?q=속초");
    render(<IntroScreen photos={PHOTOS} />);
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readIntroSeen()).toBe(false);
  });

  it("로그인한 사람(세션 쿠키가 있다)에게는 안 뜬다", async () => {
    document.cookie = "sb-test-auth-token=abc; path=/";
    render(<IntroScreen photos={PHOTOS} />);
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
