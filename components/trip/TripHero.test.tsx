import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TripHero } from "./TripHero";

/*
  여행 상세는 글쓰기 칸(제목 · 부제 · 동행)으로 시작했다. 다녀온 여행을 열었는데 가장 먼저 보이는 것이 입력칸이면
  "내 여행"이라는 느낌이 안 든다. 대표 사진이 맨 위에 서면 어느 여행인지 곧바로 알아본다.
*/
describe("TripHero", () => {
  it("대표 사진을 크게 보인다 — 사진은 장식이 아니라 눌러서 크게 보는 단추다", () => {
    const { container } = render(<TripHero url="https://예시/a.webp" onOpen={() => undefined} />);
    expect(screen.getByRole("button", { name: "대표 사진 크게 보기" })).toBeTruthy();
    const image = container.querySelector("img")!;
    expect(image).toHaveAttribute("src", "https://예시/a.webp");
    expect(image).toHaveAttribute("alt", "");
  });

  it("누르면 크게 보는 창을 열라고 알린다", () => {
    const onOpen = vi.fn();
    render(<TripHero url="https://예시/a.webp" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "대표 사진 크게 보기" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("사진 주소를 아직 받아 오는 중이면 같은 크기의 빈 자리 — 나중에 채워져도 아래가 밀리지 않게", () => {
    const { container } = render(<TripHero url={null} onOpen={() => undefined} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toContain("aspect-[16/10]");
    expect(box).toHaveAttribute("aria-hidden", "true");
  });

  it("넓은 화면에서는 더 납작하다 — 제목과 공유 단추가 첫 화면 아래로 밀려나지 않게", () => {
    const { container } = render(<TripHero url="https://예시/a.webp" onOpen={() => undefined} />);
    expect((container.firstElementChild as HTMLElement).className).toContain("sm:aspect-[21/9]");
  });

  it("사진이 있을 때와 없을 때 같은 크기다", () => {
    const size = ["aspect-[16/10]", "sm:aspect-[21/9]", "w-full", "rounded-2xl"];
    const loaded = render(<TripHero url="https://예시/a.webp" onOpen={() => undefined} />);
    const loadedClass = (loaded.container.firstElementChild as HTMLElement).className;
    loaded.unmount();
    const waiting = render(<TripHero url={null} onOpen={() => undefined} />);
    const waitingClass = (waiting.container.firstElementChild as HTMLElement).className;
    for (const name of size) {
      expect(loadedClass).toContain(name);
      expect(waitingClass).toContain(name);
    }
  });
});
