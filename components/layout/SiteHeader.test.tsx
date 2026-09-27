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
  it("두 갈래를 보여주고, 갈래는 주소에 적힌다", async () => {
    await 머리띠("/trips");
    expect(screen.getByRole("link", { name: "내 스케치" })).toHaveAttribute("href", "/?v=sketch");
    expect(screen.getByRole("link", { name: "여행 100선" })).toHaveAttribute("href", "/?v=spots");
  });

  /*
    첫 화면에는 큰 갈래가 화면 한가운데 따로 있다. 위 띠에도 두면 같은
    단추가 두 벌이 된다.
  */
  it("첫 화면에서는 위 띠의 갈래를 접는다", async () => {
    await 머리띠("/");
    expect(screen.queryByRole("link", { name: "내 스케치" })).toBeNull();
    expect(screen.queryByRole("link", { name: "여행 100선" })).toBeNull();
    // 도움말과 처음으로 가는 길은 남는다.
    expect(screen.getByRole("link", { name: "도움말" })).toBeTruthy();
  });

  it.each([
    ["/spots/경복궁", "여행 100선"],
    ["/regions/강원권", "여행 100선"],
    ["/course", "여행 100선"],
    ["/trips", "내 스케치"],
    ["/trips/new", "내 스케치"],
    ["/sketch", "내 스케치"],
  ])("%s 에서는 '%s' 가 켜진다", async (at, expected) => {
    await 머리띠(at);
    expect(켜진곳()).toEqual([expected]);
  });

  it("어느 쪽도 아닌 곳에서는 아무것도 켜지 않는다", async () => {
    await 머리띠("/privacy");
    expect(켜진곳()).toEqual([]);
  });
});
