import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { MailboxItem } from "@/lib/supabase/mailbox";
import { RECOMMENDED } from "@/lib/mailboxSettings";
import { SentDone } from "./SentDone";

/*
  엽서를 만든 뒤. 할 일은 하나 — 링크를 보내는 것. 책장마다 "카카오톡 등으로 보내기"(폰의 공유창)와 "링크 복사"가 있고,
  "부모님이 열어 보시면 여행 상세에서 알려 드려요"라고 다음 일을 말해 준다(여행 상세에 열어 봤는지가 나온다).
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
const CARD = "P".repeat(43);
const linkOf = (token: string) => `${window.location.origin}/m/${token}/p/${CARD}`;

function done(boxes = [{ box: 엄마아빠, greeting: "엄마 아빠, 바다 보고 왔어요!" }]) {
  const onClose = vi.fn();
  render(<SentDone postcardId={CARD} senderName="김지민" boxes={boxes} onClose={onClose} />);
  return { onClose };
}

const setShare = (value: unknown) => Object.defineProperty(navigator, "share", { value, configurable: true });
const setClipboard = (value: unknown) => Object.defineProperty(navigator, "clipboard", { value, configurable: true });

afterEach(() => {
  setShare(undefined);
  setClipboard(undefined);
});

describe("SentDone", () => {
  it("엽서를 만들었다고 알리고, 이제 링크를 보내라고 안내한다", () => {
    done();
    expect(screen.getByRole("heading", { name: "엽서를 만들었어요" })).toBeTruthy();
    expect(screen.getByText(/링크를 보내 주세요/)).toBeTruthy();
    expect(screen.getByText(/로그인 없이/)).toBeTruthy();
  });

  it("엽서는 지금 모습으로 남고, 여행을 지우면 함께 지워진다는 것을 말해 둔다", () => {
    done();
    expect(screen.getByText(/지금 모습으로 남고/)).toBeTruthy();
    expect(screen.getByText(/이 여행을 지우면 엽서도 함께 지워져요/)).toBeTruthy();
  });

  describe("열어 보셨는지는 여행 상세에서", () => {
    it("책장이 하나면 그 분들이 열어 보시면 알려 준다고 말한다", () => {
      done();
      expect(screen.getByText(/엄마 아빠가 열어 보시면 여행 상세에서 알려 드려요/)).toBeTruthy();
    });

    it("받침이 있는 이름에는 ‘이’가 붙는다", () => {
      done([{ box: 장모님, greeting: "장모님, 안녕" }]);
      expect(screen.getByText(/장모님이 열어 보시면 여행 상세에서 알려 드려요/)).toBeTruthy();
    });

    it("책장이 여럿이면 받는 분들", () => {
      done([
        { box: 엄마아빠, greeting: "엄마 아빠, 안녕" },
        { box: 장모님, greeting: "장모님, 안녕" },
      ]);
      expect(screen.getByText(/받는 분들이 열어 보시면 여행 상세에서 알려 드려요/)).toBeTruthy();
    });

    it("부르는 말이 없는 책장이면 받는 분", () => {
      done([{ box: box({ greetingName: null, useGreeting: false }), greeting: "안녕" }]);
      expect(screen.getByText(/받는 분이 열어 보시면 여행 상세에서 알려 드려요/)).toBeTruthy();
    });
  });

  it("책장마다 이름과 보낸 글이 보인다", () => {
    done([
      { box: 엄마아빠, greeting: "엄마 아빠, 안녕" },
      { box: 장모님, greeting: "장모님, 건강하시죠?" },
    ]);
    const second = screen.getByText("장인 장모님 책장").closest("li")!;
    expect(within(second).getByText(/“장모님, 건강하시죠\?”/)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  describe("공유", () => {
    it("폰의 공유창을 열 수 있으면 [카카오톡 등으로 보내기] — 그 책장 링크와 글을 넘긴다", async () => {
      const share = vi.fn(async () => undefined);
      setShare(share);
      done([
        { box: 엄마아빠, greeting: "엄마 아빠, 안녕" },
        { box: 장모님, greeting: "장모님, 안녕" },
      ]);
      const second = screen.getByText("장인 장모님 책장").closest("li")!;
      fireEvent.click(within(second).getByRole("button", { name: "카카오톡 등으로 보내기" }));
      await waitFor(() =>
        expect(share).toHaveBeenCalledWith({ title: "김지민이 보낸 여행 엽서", text: "장모님, 안녕", url: linkOf("U".repeat(43)) }),
      );
    });

    it("공유창이 없는 브라우저에는 링크 복사만 있다", () => {
      setShare(undefined);
      done();
      expect(screen.queryByRole("button", { name: "카카오톡 등으로 보내기" })).toBeNull();
      expect(screen.getByRole("button", { name: "링크 복사" })).toBeTruthy();
    });

    it("공유창을 그냥 닫아도 아무 일이 없다", async () => {
      const share = vi.fn(async () => {
        throw new DOMException("취소", "AbortError");
      });
      setShare(share);
      done();
      fireEvent.click(screen.getByRole("button", { name: "카카오톡 등으로 보내기" }));
      await waitFor(() => expect(share).toHaveBeenCalled());
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("링크 복사", () => {
    it("그 책장 링크를 복사하고, 어디에 붙여 넣으면 되는지 말해 준다", async () => {
      const writeText = vi.fn(async () => undefined);
      setClipboard({ writeText });
      done([
        { box: 엄마아빠, greeting: "엄마 아빠, 안녕" },
        { box: 장모님, greeting: "장모님, 안녕" },
      ]);
      const first = screen.getByText("우리 엄마 아빠").closest("li")!;
      fireEvent.click(within(first).getByRole("button", { name: "링크 복사" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(linkOf("T".repeat(43))));
      expect(await screen.findByRole("status")).toHaveTextContent("우리 엄마 아빠 링크를 복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
    });

    it("복사하지 못하면 주소를 보여 줘 손으로 복사하게 한다", async () => {
      setClipboard({
        writeText: async () => {
          throw new Error("막힘");
        },
      });
      done();
      fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
      const note = await screen.findByRole("status");
      expect(note).toHaveTextContent("복사하지 못했어요");
      expect(note).toHaveTextContent(linkOf("T".repeat(43)));
    });
  });

  it("[닫기]는 창을 닫는다", () => {
    const { onClose } = done();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
