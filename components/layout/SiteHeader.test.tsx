import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/auth/AccountChip", () => ({ AccountChip: () => null }));
vi.mock("@/components/mailbox/MailboxBell", () => ({ MailboxBell: () => <span data-testid="bell" /> }));

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
    expect(screen.getByRole("link", { name: "한장 요약" })).toHaveAttribute("href", "/sketch");
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

  /*
    부모님께 엽서를 보내는 가족 사진첩은 아래 탭의 "내 정보" 안에 있어서 찾기 어려웠다. 위 띠에 바로가기를 둔다.
    도움말은 물음표 대신 "Help" 라고 적는다.
  */
  describe("가족 사진첩 바로가기 · Help", () => {
    it("가족 사진첩 링크가 위 띠에 있다 — 첫 화면에서도", async () => {
      await 머리띠("/");
      expect(screen.getByRole("link", { name: "가족 사진첩" })).toHaveAttribute("href", "/mailboxes");
    });

    it.each(["/", "/trips/abc", "/spots/경복궁", "/me", "/sketch"])("%s — 아래 탭이 있는 화면에서는 폰에서도 보인다", async (at) => {
      await 머리띠(at);
      const link = screen.getByRole("link", { name: "가족 사진첩" });
      expect(link.className).toContain("inline-flex");
      expect(link.className).not.toContain("hidden");
    });

    it.each(["/trips/new", "/login"])("%s — 아래 탭이 없어 폭이 빠듯한 폰에서는 접고, 넓은 화면에서는 보인다", async (at) => {
      await 머리띠(at);
      const link = screen.getByRole("link", { name: "가족 사진첩" });
      expect(link.className).toContain("hidden");
      expect(link.className).toContain("sm:inline-flex");
    });

    it("가족 사진첩 화면에서는 그 링크가 켜져 있다 — 하위 화면에서도", async () => {
      await 머리띠("/mailboxes");
      expect(켜진곳()).toEqual(["가족 사진첩"]);
      screen.getByRole("link", { name: "가족 사진첩" });
    });

    it("다른 화면에서는 켜지지 않는다 — 이름만 닮은 주소도", async () => {
      await 머리띠("/mailboxesx");
      expect(켜진곳()).not.toContain("가족 사진첩");
    });

    it("도움말은 물음표가 아니라 'Help' 라고 적고, 스크린리더에는 도움말로 읽힌다", async () => {
      await 머리띠("/");
      const help = screen.getByRole("link", { name: "도움말" });
      expect(help).toHaveAttribute("href", "/help");
      expect(help.textContent).toBe("Help");
      expect(help.textContent).not.toContain("?");
    });

    it("도움말 화면에서는 Help 가 켜져 있다", async () => {
      await 머리띠("/help");
      expect(켜진곳()).toEqual(["Help"]);
    });
  });

  it.each([
    ["/spots/경복궁", "여행 100선"],
    ["/regions/강원권", "여행 100선"],
    ["/trips/abc", "내 여행"],
    ["/trips/new", "내 여행"],
    ["/sketch", "한장 요약"],
  ])("%s 에서는 '%s' 가 켜진다", async (at, expected) => {
    await 머리띠(at);
    expect(켜진곳()).toEqual([expected]);
  });

  /*
    폰에는 아래 탭이 있다. 위 띠와 아래 탭이 같은 말("내 여행 · 여행 100선")을 되풀이하면 화면이 어수선하고, 위 띠에는
    서비스 이름이 들어갈 자리도 없었다. 아래 탭이 있는 화면에서는 위 띠의 갈래를 접고 이름을 보인다. 아래 탭이 없는
    화면(한장 요약, 링크로 받은 화면, 로그인)에서는 위 띠의 갈래가 유일한 길이라 그대로 둔다.
  */
  describe("폰에서", () => {
    it.each(["/", "/trips/abc", "/spots/경복궁", "/me"])(
      "%s — 아래 탭이 있으니 위 띠의 갈래는 접는다",
      async (at) => {
        await 머리띠(at);
        expect(screen.getByRole("navigation", { name: "주요 메뉴" }).className).toContain("max-sm:hidden");
      },
    );

    it.each(["/trips/new", "/s/abc", "/t/abc", "/login"])(
      "%s — 아래 탭이 없으니 위 띠의 갈래를 접지 않는다",
      async (at) => {
        await 머리띠(at);
        expect(screen.getByRole("navigation", { name: "주요 메뉴" }).className).not.toContain("max-sm:hidden");
        expect(screen.getByRole("link", { name: "내 여행" }).className).not.toContain("max-sm:hidden");
        expect(screen.getByRole("link", { name: "여행 100선" }).className).not.toContain("max-sm:hidden");
      },
    );

    it("아래 탭이 없는 화면에서도 '한장 요약' 갈래는 폰의 위 띠에서 접는다 — 375px 에 셋이 들어가지 않는다", async () => {
      await 머리띠("/login");
      expect(screen.getByRole("link", { name: "한장 요약" }).className).toContain("max-sm:hidden");
    });

    it("아래 탭이 있는 화면에서는 서비스 이름이 위 띠에 글자로 보인다", async () => {
      await 머리띠("/trips/abc");
      const name = screen.getAllByText("내 여행 스케치").find((node) => !node.className.includes("sr-only"))!;
      expect(name.className).not.toContain("hidden");
    });

    it("아래 탭이 없는 화면에서는 이름을 폰에서 접는다 — 갈래와 계정 칩이 들어가야 한다", async () => {
      await 머리띠("/trips/new");
      const name = screen.getAllByText("내 여행 스케치").find((node) => !node.className.includes("sr-only"))!;
      expect(name.className).toContain("hidden");
      expect(name.className).toContain("sm:inline");
    });
  });

  it("가족 사진첩의 받는 쪽(/m/…)에는 위 띠가 없다 — 부모님에게는 엽서와 답장 단추뿐", async () => {
    const { container } = await 머리띠("/m/abc/p/def");
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("link", { name: "내 여행" })).toBeNull();
  });

  it("새 답장 알림 자리가 위 띠에 있다 — 알림이 없으면 스스로 비어 있다", async () => {
    await 머리띠("/trips/abc");
    expect(screen.getByTestId("bell")).toBeTruthy();
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
