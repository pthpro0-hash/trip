import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { MailboxItem } from "@/lib/supabase/mailbox";
import { RECOMMENDED } from "@/lib/mailboxSettings";
import { greetingsFor } from "@/lib/mailbox";
import { ShelfList } from "./ShelfList";

/*
  책장이 하나뿐인 대부분의 경우에 "받을 책장" 목록과 책장마다의 인사말 칸은 군더더기다. 접어 둔다 — 책장이 하나면
  "인사말 고치기", 둘 이상이면 "받는 곳 바꾸기". 펼치면 예전 그대로 책장마다 체크 · 인사말 · 추천 문구가 있다.
*/

const box = (over: Partial<MailboxItem>): MailboxItem => ({
  id: "m1",
  ownerId: "me",
  name: "우리 엄마 아빠",
  greetingName: "엄마 아빠",
  useGreeting: true,
  tone: "casual",
  members: ["엄마", "아빠"],
  token: "T".repeat(43),
  closed: false,
  settings: RECOMMENDED,
  senderCount: 1,
  ...over,
});

const 엄마아빠 = box({ id: "m1" });
const 장모님 = box({ id: "m2", name: "장인 장모님 책장", greetingName: "장모님", tone: "polite", token: "U".repeat(43) });

function list(
  options: {
    boxes?: MailboxItem[];
    selected?: string[];
    body?: string;
    overrides?: Record<string, string>;
  } & Partial<ComponentProps<typeof ShelfList>> = {},
) {
  const { boxes = [엄마아빠, 장모님], selected, body = "바다 보고 왔어요!", overrides = {}, ...rest } = options;
  const selectedIds = new Set(selected ?? boxes.map((entry) => entry.id));
  const rows = greetingsFor(body, boxes.filter((entry) => selectedIds.has(entry.id)), overrides);
  const fns = { onToggle: vi.fn(), onEdit: vi.fn(), onReset: vi.fn(), onSuggest: vi.fn() };
  const view = render(<ShelfList boxes={boxes} selectedIds={selectedIds} rows={rows} {...fns} {...rest} />);
  return { ...view, ...fns };
}

const toggle = () => screen.getByRole("button", { name: /바꾸기|고치기|접기/ });

describe("ShelfList · 책장이 하나일 때", () => {
  it("접혀 있다 — 인사말 고치기", () => {
    list({ boxes: [엄마아빠] });
    expect(toggle()).toHaveTextContent("고치기");
    expect(screen.getByText("인사말")).toBeTruthy();
    expect(screen.queryByLabelText("우리 엄마 아빠 인사말")).toBeNull();
  });

  it("펼치면 인사말 칸이 있고, 책장을 고르는 체크는 없다 — 고를 것이 하나뿐이다", () => {
    list({ boxes: [엄마아빠] });
    fireEvent.click(toggle());
    expect((screen.getByLabelText("우리 엄마 아빠 인사말") as HTMLTextAreaElement).value).toBe("바다 보고 왔어요!");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("ShelfList · 책장이 여럿일 때", () => {
  it("접힌 머리에 받는 곳 이름이 나온다", () => {
    list();
    expect(screen.getByText("받는 곳")).toBeTruthy();
    expect(screen.getByText("우리 엄마 아빠, 장인 장모님 책장")).toBeTruthy();
    expect(toggle()).toHaveTextContent("바꾸기");
  });

  it("체크를 푼 책장은 머리에서 빠진다", () => {
    list({ selected: ["m1"] });
    expect(screen.getByText("우리 엄마 아빠")).toBeTruthy();
    expect(screen.queryByText(/장인 장모님 책장/)).toBeNull();
  });

  it("펼치면 책장마다 체크가 있고, 누르면 알린다", () => {
    const { onToggle } = list();
    fireEvent.click(toggle());
    expect(screen.getByRole("checkbox", { name: /우리 엄마 아빠/ })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /장인 장모님 책장/ }));
    expect(onToggle).toHaveBeenCalledWith("m2");
  });

  it("말투를 책장 옆에 적는다", () => {
    list();
    fireEvent.click(toggle());
    expect(screen.getByText("편하게")).toBeTruthy();
    expect(screen.getByText("존댓말")).toBeTruthy();
  });

  it("체크를 푼 책장에는 인사말 칸이 없다", () => {
    list({ selected: ["m1"] });
    fireEvent.click(toggle());
    expect(screen.getByLabelText("우리 엄마 아빠 인사말")).toBeTruthy();
    expect(screen.queryByLabelText("장인 장모님 책장 인사말")).toBeNull();
  });
});

describe("ShelfList · 인사말", () => {
  it("책장마다 호칭만 다르게 복사된다 — 받는 분께 보이는 글", () => {
    list();
    fireEvent.click(toggle());
    expect(screen.getByText(/“엄마 아빠, 바다 보고 왔어요!”/)).toBeTruthy();
    expect(screen.getByText(/“장모님, 바다 보고 왔어요!”/)).toBeTruthy();
    expect(screen.getAllByText("자동으로 채웠어요")).toHaveLength(2);
  });

  it("호칭을 붙이지 않는 책장은 그렇게 말한다", () => {
    list({ boxes: [box({ id: "m1", useGreeting: false })] });
    fireEvent.click(toggle());
    expect(screen.getByText("호칭 없이 보내요")).toBeTruthy();
  });

  it("앞에 붙는 호칭을 알려 준다 — 이름 받침에 맞는 조사로", () => {
    list({ boxes: [엄마아빠, 장모님] });
    fireEvent.click(toggle());
    expect(screen.getByText("앞에 ‘엄마 아빠’가 붙어요")).toBeTruthy();
    expect(screen.getByText("앞에 ‘장모님’이 붙어요")).toBeTruthy();
  });

  it("직접 고치면 알리고, 고친 것은 그렇게 표시되며 원래대로 되돌릴 수 있다", () => {
    const { onEdit, onReset } = list({ overrides: { m2: "건강하시죠? 바다에 다녀왔습니다." } });
    fireEvent.click(toggle());
    expect(screen.getByText("직접 고쳤어요")).toBeTruthy();
    expect(screen.getByText(/“장모님, 건강하시죠\? 바다에 다녀왔습니다\.”/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("장인 장모님 책장 인사말"), { target: { value: "다른 말" } });
    expect(onEdit).toHaveBeenCalledWith("m2", "다른 말");

    fireEvent.click(screen.getByRole("button", { name: "원래대로" }));
    expect(onReset).toHaveBeenCalledWith("m2");
  });

  it("고치지 않은 책장에는 원래대로가 없다", () => {
    list();
    fireEvent.click(toggle());
    expect(screen.queryByRole("button", { name: "원래대로" })).toBeNull();
  });

  it("말투에 맞는 추천 문구를 누르면 덧붙이라고 알린다", () => {
    const { onSuggest } = list();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name: "건강하시죠?" }));
    expect(onSuggest).toHaveBeenCalledWith("m2", "건강하시죠?", "바다 보고 왔어요!");
    fireEvent.click(screen.getByRole("button", { name: "보고 싶어요" }));
    expect(onSuggest).toHaveBeenCalledWith("m1", "보고 싶어요", "바다 보고 왔어요!");
  });
});
