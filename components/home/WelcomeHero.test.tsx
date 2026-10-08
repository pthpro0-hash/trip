import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WelcomeHero } from "./WelcomeHero";

/*
  처음 온 사람이 첫 화면에서 가장 먼저 보는 것. 이 서비스가 무엇을 해 주는지를 약속 한 줄과 예시 한 장으로
  말하고, 누를 것은 단추 하나다. 안내 창 둘이 하던 말을 대신한다.
*/
describe("WelcomeHero", () => {
  it("약속 한 줄이 제목이다 — 사진만 고르면 여행이 정리된다", () => {
    render(<WelcomeHero who="guest" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("사진만 고르면, 여행이 정리돼요");
  });

  it("제목은 h2 다 — 검색에 걸리는 말 '한국관광 100선'(h1)이 첫 화면의 큰 제목 자리를 지킨다", () => {
    render(<WelcomeHero who="guest" />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("무엇이 되는지를 한 줄로 풀어 준다", () => {
    render(<WelcomeHero who="guest" />);
    expect(screen.getByText("날짜와 장소로 묶고, 지도와 한 장짜리 카드로 만들어 드려요.")).toBeTruthy();
  });

  it("누를 단추는 하나 — '사진 고르기'가 로그인 없이 바로 사진 고르는 화면으로 간다", () => {
    render(<WelcomeHero who="guest" />);
    expect(screen.getByRole("link", { name: "사진 고르기" })).toHaveAttribute("href", "/trips/new");
    expect(screen.queryByRole("link", { name: /로그인/ })).toBeNull();
  });

  describe("안심 한 줄", () => {
    it("고르는 동안 사진이 기기 밖으로 나가지 않는다고 말한다", () => {
      render(<WelcomeHero who="guest" />);
      expect(screen.getByText(/고르는 동안 사진은 이 기기 밖으로 나가지 않아요/)).toBeTruthy();
    });

    it("'올라가지 않아요'라고 하지 않는다 — 기록할 때 사진을 올릴 수 있다", () => {
      const { container } = render(<WelcomeHero who="guest" />);
      expect(container.textContent).not.toContain("올라가지 않아요");
    });

    it("로그인 전에는 기록으로 남길 때 로그인한다고 미리 알린다", () => {
      render(<WelcomeHero who="guest" />);
      expect(screen.getByText("기록으로 남길 때 로그인해요")).toBeTruthy();
    });

    it("이미 로그인한 사람에게는 로그인 이야기를 하지 않는다", () => {
      render(<WelcomeHero who="empty" />);
      expect(screen.queryByText(/로그인/)).toBeNull();
      expect(screen.getByText(/고르는 동안 사진은 이 기기 밖으로 나가지 않아요/)).toBeTruthy();
    });
  });

  describe("예시 카드", () => {
    it("결과를 먼저 보여 준다 — 그림 하나, 읽어 주는 글과 '예시' 표시가 있다", () => {
      render(<WelcomeHero who="guest" />);
      const image = screen.getByRole("img", { name: /한 장 카드/ });
      expect(image).toHaveAttribute("src", "/hero-sample.webp");
      expect(screen.getByText("예시")).toBeTruthy();
    });

    it("그림 크기를 미리 알려 자리를 잡아 둔다 — 늦게 떠도 아래가 밀리지 않게", () => {
      render(<WelcomeHero who="guest" />);
      const image = screen.getByRole("img", { name: /한 장 카드/ });
      expect(Number(image.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(image.getAttribute("height"))).toBeGreaterThan(Number(image.getAttribute("width")));
    });

    it("첫 화면 맨 위의 그림이라 늦게 불러오지 않는다", () => {
      render(<WelcomeHero who="guest" />);
      expect(screen.getByRole("img", { name: /한 장 카드/ })).not.toHaveAttribute("loading", "lazy");
    });
  });

  it("아래 여행 100선으로 이어지는 길이 있다 — 그 구획으로 내려간다", () => {
    render(<WelcomeHero who="guest" />);
    expect(screen.getByText("어디 갈지 고민이면")).toBeTruthy();
    expect(screen.getByRole("link", { name: /여행 100선 둘러보기/ })).toHaveAttribute("href", "#spots");
  });

  it("다른 안내 창을 띄우지 않는다 — 그냥 화면의 한 부분이다", () => {
    render(<WelcomeHero who="guest" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
