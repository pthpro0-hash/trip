import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readStart } from "@/lib/start";
import { ADD_HREF, MAP_HREF, SKETCH_HREF, SPOTS_HREF } from "@/lib/nav";

let path = "/";
let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => path,
  useSearchParams: () => new URLSearchParams(search),
}));

const { BottomNav, BottomNavSpace } = await import("./BottomNav");

const bar = () => screen.queryByRole("navigation", { name: "하단 메뉴" });
const at = (pathname: string, query = "") => {
  path = pathname;
  search = query;
  return render(<BottomNav />);
};
const on = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

/*
  폰에서는 위 띠가 좁아 갈래를 접고, 아래에 고정 탭을 둔다. 엄지가 닿는 자리이고,
  화면마다 흩어져 있던 "사진 고르기 · 한장 요약 · 여행 목록" 단추를 한 곳에 모은다.
*/
describe("BottomNav", () => {
  beforeEach(() => {
    document.cookie = "start=; path=/; max-age=0";
    path = "/";
    search = "";
  });

  it("내 여행 · 한장 · 사진 고르기 · 여행 100선, 네 곳으로 간다", () => {
    at("/trips/abc");
    expect(screen.getByRole("link", { name: "내 여행" })).toHaveAttribute("href", MAP_HREF);
    expect(screen.getByRole("link", { name: "한장" })).toHaveAttribute("href", SKETCH_HREF);
    expect(screen.getByRole("link", { name: "사진 고르기" })).toHaveAttribute("href", ADD_HREF);
    expect(screen.getByRole("link", { name: "여행 100선" })).toHaveAttribute("href", SPOTS_HREF);
  });

  it("폰에서만 보인다 — 넓은 화면에는 위 띠가 있다", () => {
    at("/trips/abc");
    expect(bar()!.className).toContain("sm:hidden");
  });

  describe("켜진 곳", () => {
    it.each([
      ["/trips/abc", "", "내 여행"],
      ["/places", "", "내 여행"],
      ["/spots/경복궁", "", "여행 100선"],
      ["/regions/강원권", "", "여행 100선"],
      ["/course", "", "여행 100선"],
    ])("%s → %s", (pathname, query, expected) => {
      at(pathname, query);
      expect(on()).toEqual([expected]);
    });

    it("첫 화면은 주소의 갈래를 따른다", () => {
      at("/", "v=sketch");
      expect(on()).toEqual(["내 여행"]);
    });

    it("첫 화면에서 주소에 갈래가 없으면 지난번에 고른 것", () => {
      document.cookie = "start=sketch; path=/";
      at("/");
      expect(on()).toEqual(["내 여행"]);
    });

    it("고른 적이 없으면 여행 100선 — 서버가 여는 화면과 같다", () => {
      at("/");
      expect(on()).toEqual(["여행 100선"]);
    });

    it("사진 고르기는 '켜진 곳'이 아니라 하는 일이다", () => {
      at("/trips/new");
      expect(on()).toEqual(["내 여행"]);
    });

    it("어느 쪽도 아니면 아무것도 켜지 않는다", () => {
      at("/help");
      expect(on()).toEqual([]);
    });
  });

  describe("숨길 때", () => {
    it.each(["/sketch", "/login", "/auth/callback", "/s/abcdefghijklmnop", "/t/abcdefghijklmnop"])(
      "%s 에서는 없다",
      (pathname) => {
        at(pathname);
        expect(bar()).toBeNull();
      },
    );

    it("글을 쓰는 동안에는 숨는다 — 키보드 위로 떠올라 입력칸을 가리지 않게", () => {
      path = "/trips/abc";
      render(
        <>
          <input aria-label="검색" />
          <input type="checkbox" aria-label="체크" />
          <BottomNav />
        </>,
      );
      expect(bar()).not.toBeNull();

      fireEvent.focusIn(screen.getByLabelText("검색"));
      expect(bar()).toBeNull();

      fireEvent.focusOut(screen.getByLabelText("검색"));
      expect(bar()).not.toBeNull();
    });

    it("체크박스처럼 글을 쓰지 않는 칸은 숨기지 않는다", () => {
      path = "/trips/abc";
      render(
        <>
          <input type="checkbox" aria-label="체크" />
          <BottomNav />
        </>,
      );
      fireEvent.focusIn(screen.getByLabelText("체크"));
      expect(bar()).not.toBeNull();
    });
  });

  describe("눌렀을 때", () => {
    const press = (name: string) => {
      const link = screen.getByRole("link", { name });
      // 실제로 이동하지는 않는다.
      link.addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(link);
    };

    it("내 여행을 누르면 다음에도 내 여행으로 열리게 기억한다", () => {
      at("/spots/경복궁");
      press("내 여행");
      expect(readStart()).toBe("sketch");
    });

    it("여행 100선을 누르면 다음에도 100선으로 열리게 기억한다", () => {
      at("/trips/abc");
      press("여행 100선");
      expect(readStart()).toBe("spots");
    });

    it("한장과 사진 고르기는 갈래를 바꾸지 않는다", () => {
      document.cookie = "start=spots; path=/";
      at("/trips/abc");
      press("한장");
      press("사진 고르기");
      expect(readStart()).toBe("spots");
    });
  });
});

/*
  하단 탭이 화면 아래를 덮으므로 내용이 그 밑에 가리지 않게 자리를 비워 둔다. 탭을
  숨기는 화면은 그 자리를 도로 돌려준다 — 안 그러면 한장 요약 아래에 빈 띠가 남는다.
*/
describe("BottomNavSpace", () => {
  it("탭이 있는 화면에서는 폰에서 그 높이만큼 아래를 비운다", () => {
    path = "/trips/abc";
    const { container } = render(
      <BottomNavSpace>
        <p>내용</p>
      </BottomNavSpace>,
    );
    expect(screen.getByText("내용")).toBeTruthy();
    expect(container.firstElementChild!.className).toContain("max-sm:pb-[var(--bottom-nav-h)]");
  });

  it("탭이 없는 화면에서는 높이를 0 으로 돌려준다 — 그 안의 셈이 탭을 빼지 않게", () => {
    path = "/sketch";
    const { container } = render(
      <BottomNavSpace>
        <p>내용</p>
      </BottomNavSpace>,
    );
    expect(container.firstElementChild!.className).toContain("[--bottom-nav-h:0px]");
    expect(container.firstElementChild!.className).not.toContain("pb-");
  });
});
