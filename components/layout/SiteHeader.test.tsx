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
  it("두 갈래를 늘 보여준다", async () => {
    await 머리띠("/");
    expect(screen.getByRole("link", { name: "둘러보기" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "내 스케치" })).toHaveAttribute("href", "/trips");
  });

  it.each([
    ["/", "둘러보기"],
    ["/spots/경복궁", "둘러보기"],
    ["/regions/강원권", "둘러보기"],
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
