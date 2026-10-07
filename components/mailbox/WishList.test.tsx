import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { SentWish } from "@/lib/mailboxWishes";
import { readCollections, writeCollections } from "@/lib/collections";
import { WishList } from "./WishList";

const wish = (id: string, who: string, spot: string, over: Partial<SentWish> = {}): SentWish => ({
  id,
  mailboxId: "m1",
  who,
  spot,
  at: "2026-10-03T00:00:00Z",
  seen: true,
  ...over,
});

describe("WishList · 부모님이 가고 싶다고 보낸 곳", () => {
  beforeEach(() => writeCollections({ wishlist: [] }));

  it("누가 어느 곳을 골랐는지 보인다", () => {
    render(<WishList boxName="우리 엄마 아빠" wishes={[wish("w1", "엄마", "경복궁"), wish("w2", "아빠", "경주")]} fresh={new Set()} />);
    const list = screen.getByRole("list", { name: "우리 엄마 아빠 가고 싶은 곳" });
    expect(list).toHaveTextContent("엄마: 경복궁");
    expect(list).toHaveTextContent("아빠: 경주");
  });

  it("곳 보기 길은 그 곳의 상세로 간다", () => {
    render(<WishList boxName="우리 엄마 아빠" wishes={[wish("w1", "엄마", "경복궁")]} fresh={new Set()} />);
    expect(screen.getByRole("link", { name: "경복궁 곳 보기" })).toHaveAttribute("href", `/spots/${encodeURIComponent("경복궁")}`);
  });

  it("처음 본 것에는 '새' 표시가 붙는다 — 이번에 처음 본 것으로 넘겨받은 것만", () => {
    render(<WishList boxName="집" wishes={[wish("w1", "엄마", "경복궁"), wish("w2", "아빠", "경주")]} fresh={new Set(["w2"])} />);
    const items = within(screen.getByRole("list", { name: "집 가고 싶은 곳" })).getAllByRole("listitem");
    expect(items[0]).not.toHaveTextContent("새");
    expect(items[1]).toHaveTextContent("새");
  });

  it("[내 찜에 담기]를 누르면 내 찜 목록에 담기고 '찜했어요'로 바뀐다 — 다시 누르면 뺀다", () => {
    render(<WishList boxName="집" wishes={[wish("w1", "엄마", "경복궁")]} fresh={new Set()} />);
    const button = screen.getByRole("button", { name: "경복궁 내 찜에 담기" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(readCollections().wishlist).toEqual(["경복궁"]);
    const saved = screen.getByRole("button", { name: "경복궁 찜 빼기" });
    expect(saved.getAttribute("aria-pressed")).toBe("true");
    expect(saved).toHaveTextContent("찜했어요");
    fireEvent.click(saved);
    expect(readCollections().wishlist).toEqual([]);
  });

  it("이미 찜한 곳은 처음부터 '찜했어요'", () => {
    writeCollections({ wishlist: ["경복궁"] });
    render(<WishList boxName="집" wishes={[wish("w1", "엄마", "경복궁")]} fresh={new Set()} />);
    expect(screen.getByRole("button", { name: "경복궁 찜 빼기" })).toBeTruthy();
  });

  it("여행 100선에 없는 곳(옛 id)은 이름 그대로 보이고 곳 보기·찜은 없다", () => {
    render(<WishList boxName="집" wishes={[wish("w1", "엄마", "사라진곳")]} fresh={new Set()} />);
    expect(screen.getByRole("list", { name: "집 가고 싶은 곳" })).toHaveTextContent("엄마: 사라진곳");
    expect(screen.queryByRole("link", { name: /곳 보기/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /찜/ })).toBeNull();
  });

  it("받은 것이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<WishList boxName="집" wishes={[]} fresh={new Set()} />);
    expect(container.firstChild).toBeNull();
  });
});
