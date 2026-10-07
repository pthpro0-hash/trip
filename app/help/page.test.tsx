import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/trip/StorageTidy", () => ({ StorageTidy: () => <p>보관함 정리 자리</p> }));
vi.mock("@/components/layout/ScrollTop", () => ({ ScrollTop: () => null }));
const { default: HelpPage } = await import("./page");

/*
  사진 보관함 정리는 예전에 여행 목록(/trips) 맨 아래에 있었다. 목록이 내 여행 화면의
  한 모습이 되면서 그 자리를 잃었고, 자주 쓸 일이 아니라 도움말의 "내 데이터"에 둔다.
  찾으러 온 사람은 목차부터 보므로 목차에도 있어야 한다.
*/
describe("HelpPage · 내 데이터", () => {
  it("보관함 정리가 도움말에 있다", () => {
    render(<HelpPage />);
    expect(screen.getByText("보관함 정리 자리")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: /내 데이터/ })).toBeTruthy();
  });

  it("목차에서 바로 간다", () => {
    render(<HelpPage />);
    const toc = screen.getByRole("navigation", { name: "목차" });
    const link = Array.from(toc.querySelectorAll("a")).find((a) => a.textContent?.includes("내 데이터"));
    expect(link).toHaveAttribute("href", "#data");
    expect(document.getElementById("data")).toBeTruthy();
  });
});

describe("HelpPage · 가족 공유", () => {
  it("계정과 보관 갈래에 가족 공유를 풀어 적었다 — 권한 셋과 한도까지", () => {
    render(<HelpPage />);
    expect(screen.getByText("가족과 내 여행 함께 보기")).toBeTruthy();
    expect(screen.getByText("가족의 여행 보기")).toBeTruthy();
    const section = document.getElementById("account")!;
    for (const word of ["보기만", "수정만", "추가도 가능", "8명", "7일", "해제"]) {
      expect(section.textContent).toContain(word);
    }
  });
});

describe("HelpPage · 가족 책장", () => {
  it("엽서 보내기·받는 법·지우면 어떻게 되는지를 계정과 보관 갈래에 풀어 적었다", () => {
    render(<HelpPage />);
    for (const title of ["부모님께 여행 엽서 보내기", "부모님이 엽서 받는 법", "엽서와 지우기"]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    const section = document.getElementById("account")!;
    for (const word of ["가족 책장", "책장 3개", "기본 20장까지", "책장 설정", "권장", "링크 하나", "로그인", "답장", "하트", "사진마다", "책마다", "책꽂이", "작년 오늘", "올해의 책", "부모님 화면 보기", "책장 지우기", "사진 줄이기", "사진까지 보관할 책", "가고 싶은 곳 보내기", "내 찜에 담기", "가고 싶은 곳 받기", "책으로 저장(PDF)", "PDF로 저장", "새로 만들기", "거두기", "함께 지워"]) {
      expect(section.textContent).toContain(word);
    }
  });
});

describe("HelpPage · 내 정보", () => {
  it("가족 공유·가족 책장·로그아웃이 '내 정보'에 있다고 알려 준다 — 옛 길(이름 칩 → 가족 공유)은 더 말하지 않는다", () => {
    render(<HelpPage />);
    const text = document.body.textContent ?? "";
    expect(text).toContain("내 여행 · 한장 · 사진 고르기 · 여행 100선 · 내 정보");
    expect(text).toContain("'내 정보'");
    expect(text).toContain("로그아웃");
    expect(text).not.toContain("위 띠의 내 이름을 누르면 '가족 공유'가 열려요");
    expect(text).not.toContain("위 띠의 이름 → 가족 공유 맨 아래");
  });
});
