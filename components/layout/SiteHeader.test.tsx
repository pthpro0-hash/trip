import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AccountChip", () => ({ AccountChip: () => null }));

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

async function 머리띠(at: string) {
  path = at;
  vi.resetModules();
  const { SiteHeader } = await import("./SiteHeader");
  return render(<SiteHeader />);
}

/** 지금 켜져 있는 갈래의 이름. */
const 켜진곳 = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

describe("SiteHeader", () => {
  it("세 갈래를 보여주고, 갈래는 주소에 적힌다", async () => {
    await 머리띠("/trips/abc");
    expect(screen.getByRole("link", { name: "내 여행" })).toHaveAttribute("href", "/?v=sketch");
    expect(screen.getByRole("link", { name: "한장" })).toHaveAttribute("href", "/sketch");
    expect(screen.getByRole("link", { name: "여행 100선" })).toHaveAttribute("href", "/?v=spots");
  });

  /*
    사진을 넣는 것은 이 서비스의 가장 큰 일이다. 어느 화면에서도 같은 자리에 같은
    말로 있어야 한다. 폰에서는 하단 탭의 가운데 단추가 그 일을 한다.
  */
  it("사진 고르기가 위 띠에 늘 있다 — 첫 화면에서도, 넓은 화면에서만", async () => {
    await 머리띠("/");
    const add = screen.getByRole("link", { name: "+ 사진 고르기" });
    expect(add).toHaveAttribute("href", "/trips/new");
    expect(add.className).toContain("hidden");
    expect(add.className).toContain("sm:inline-flex");
  });

  // 갈래는 어느 화면에서든 위 띠에 보인다 — 첫 화면에서도. 길을 잃으면 맨 위를 본다.
  it("첫 화면에서도 위 띠에 갈래가 보인다", async () => {
    await 머리띠("/");
    expect(screen.getByRole("link", { name: "내 여행" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "여행 100선" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "도움말" })).toBeTruthy();
  });

  it.each([
    ["/spots/경복궁", "여행 100선"],
    ["/regions/강원권", "여행 100선"],
    ["/course", "여행 100선"],
    ["/trips/abc", "내 여행"],
    ["/trips/new", "내 여행"],
    ["/places", "내 여행"],
    ["/sketch", "한장"],
  ])("%s 에서는 '%s' 가 켜진다", async (at, expected) => {
    await 머리띠(at);
    expect(켜진곳()).toEqual([expected]);
  });

  describe("폰에서", () => {
    it.each(["/", "/trips/abc", "/sketch", "/s/abc"])("%s 에서도 위 띠의 갈래를 접지 않는다", async (at) => {
      await 머리띠(at);
      expect(screen.getByRole("navigation", { name: "주요 메뉴" }).className).not.toContain("max-sm:hidden");
      expect(screen.getByRole("link", { name: "내 여행" }).className).not.toContain("max-sm:hidden");
      expect(screen.getByRole("link", { name: "여행 100선" }).className).not.toContain("max-sm:hidden");
    });

    it("'한장'만 폰의 위 띠에서 접는다 — 375px 에 셋이 들어가지 않는다", async () => {
      await 머리띠("/trips/abc");
      expect(screen.getByRole("link", { name: "한장" }).className).toContain("max-sm:hidden");
    });
  });

  it("가족 우편함의 받는 쪽(/m/…)에는 위 띠가 없다 — 부모님에게는 엽서와 답장 단추뿐", async () => {
    const { container } = await 머리띠("/m/abc/p/def");
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("link", { name: "내 여행" })).toBeNull();
  });

  it("보내는 쪽(/mailboxes)에는 평소처럼 있다", async () => {
    await 머리띠("/mailboxes");
    expect(screen.getByRole("link", { name: "내 여행" })).toBeTruthy();
  });

  it("어느 쪽도 아닌 곳에서는 아무것도 켜지 않는다", async () => {
    await 머리띠("/privacy");
    expect(켜진곳()).toEqual([]);
  });
});
