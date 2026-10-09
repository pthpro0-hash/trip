import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { TripPostcardLine } from "@/lib/supabase/postcards";
import { TripPostcardStatus } from "./TripPostcardStatus";

/*
  엽서를 보내고 나면 궁금한 것은 하나다 — 부모님이 열어 보셨나, 뭐라고 하셨나. 예전에는 ‘내 정보 → 가족 책장’의 보낸 엽서
  목록을 열어야 알 수 있었다. 여행 상세의 공유 줄 아래에 받는 곳마다 한 줄(열어 보셨는지)과 그 아래에 부모님의 답장·하트를
  보여 주고, 아직 안 열어 보셨으면 같은 링크를 다시 보낼 수 있다.
*/

const CARD = "P".repeat(43);
const line = (over: Partial<TripPostcardLine> = {}): TripPostcardLine => ({
  mailboxId: "m1",
  name: "우리 엄마 아빠",
  greetingName: "엄마 아빠",
  opened: false,
  postcardId: CARD,
  senderName: "김지민",
  greeting: "엄마 아빠, 바다 보고 왔어요",
  token: "T".repeat(43),
  replies: [],
  hearts: [],
  ...over,
});
const reply = (id: string, who: string, reaction: string, seen = true) => ({
  id,
  mailboxId: "m1",
  who,
  reaction,
  at: "2026-10-06T00:00:00Z",
  seen,
});
const heart = (id: string, who: string, file: string, seen = true) => ({ id, mailboxId: "m1", who, file, seen });
const linkOf = (token = "T".repeat(43)) => `${window.location.origin}/m/${token}/p/${CARD}`;

const setShare = (value: unknown) => Object.defineProperty(navigator, "share", { value, configurable: true });
const setClipboard = (value: unknown) => Object.defineProperty(navigator, "clipboard", { value, configurable: true });

afterEach(() => {
  setShare(undefined);
  setClipboard(undefined);
});

describe("TripPostcardStatus · 열어 보셨는지", () => {
  it("보낸 엽서가 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<TripPostcardStatus lines={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("아직 안 열어 보셨으면 그렇게 말한다", () => {
    render(<TripPostcardStatus lines={[line()]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("엄마 아빠께 엽서를 보냈어요 · 아직 안 열어 보셨어요");
  });

  it("열어 보셨으면 열어 보셨다고 말한다", () => {
    render(<TripPostcardStatus lines={[line({ opened: true })]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("엄마 아빠께 엽서를 보냈어요 · 열어 보셨어요 ✓");
    expect(screen.queryByText(/아직 안 열어/)).toBeNull();
  });

  it("체크 표시는 소리 내어 읽지 않는다 — ‘열어 보셨어요’가 이미 말하고 있다", () => {
    const { container } = render(<TripPostcardStatus lines={[line({ opened: true })]} />);
    const mark = [...container.querySelectorAll("[aria-hidden=true]")].find((node) => node.textContent === "✓");
    expect(mark).toBeTruthy();
  });

  it("부르는 말이 없는 책장은 책장 이름으로 말한다 — 따옴표로 묶어 어떤 이름에도 ‘에’가 자연스럽게", () => {
    render(<TripPostcardStatus lines={[line({ greetingName: null, name: "장인 장모님 책장" })]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("‘장인 장모님 책장’에 엽서를 보냈어요 · 아직 안 열어 보셨어요");
  });

  it("받는 곳이 여럿이면 한 곳에 한 줄씩", () => {
    render(
      <TripPostcardStatus
        lines={[line({ opened: true }), line({ mailboxId: "m2", greetingName: "장모님", name: "장인 장모님 책장" })]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("엄마 아빠께 엽서를 보냈어요 · 열어 보셨어요 ✓");
    expect(items[1]).toHaveTextContent("장모님께 엽서를 보냈어요 · 아직 안 열어 보셨어요");
  });

  it("목록에 이름이 있다 — 화면 낭독기가 ‘보낸 엽서’라고 알린다", () => {
    render(<TripPostcardStatus lines={[line()]} />);
    expect(screen.getByRole("list", { name: "보낸 엽서" })).toBeTruthy();
  });
});

describe("TripPostcardStatus · 부모님의 답장과 하트", () => {
  it("답장은 그 받는 곳 줄 아래에 ‘엄마가 ‘좋구나’ 하셨어요’로 붙는다", () => {
    render(
      <TripPostcardStatus lines={[line({ opened: true, replies: [reply("r1", "엄마", "좋구나"), reply("r2", "장모님", "고맙다")] })]} />,
    );
    const item = screen.getByRole("listitem");
    expect(within(item).getByText("엄마가 ‘좋구나’ 하셨어요")).toBeTruthy();
    // 받침이 있는 이름은 ‘이’
    expect(within(item).getByText("장모님이 ‘고맙다’ 하셨어요")).toBeTruthy();
  });

  it("하트는 사람마다 한 줄 — 사진 몇 장에, 책에는 ‘이 여행에’, 둘 다면 함께", () => {
    render(
      <TripPostcardStatus
        lines={[
          line({
            opened: true,
            hearts: [
              heart("h1", "엄마", "a.webp"),
              heart("h2", "엄마", "b.webp"),
              heart("h3", "엄마", "c.webp"),
              heart("h4", "아빠", ""),
              heart("h5", "장모님", ""),
              heart("h6", "장모님", "a.webp"),
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByText("엄마가 사진 3장에 하트를 눌렀어요")).toBeTruthy();
    expect(screen.getByText("아빠가 이 여행에 하트를 눌렀어요")).toBeTruthy();
    expect(screen.getByText("장모님이 이 여행과 사진 1장에 하트를 눌렀어요")).toBeTruthy();
  });

  it("이번에 처음 본 답장·하트에만 ‘새 답장’·‘새 하트’ 표시가 붙는다", () => {
    render(
      <TripPostcardStatus
        lines={[
          line({
            opened: true,
            replies: [reply("r1", "엄마", "좋구나"), reply("r2", "아빠", "잘 다녀왔니", false)],
            hearts: [heart("h1", "엄마", "a.webp"), heart("h2", "아빠", "b.webp", false)],
          }),
        ]}
        fresh={new Set(["r2", "h2"])}
      />,
    );
    // 이미 본(fresh 에 없는) 반응에는 표시가 없다.
    expect(screen.getAllByText("새 답장")).toHaveLength(1);
    expect(screen.getAllByText("새 하트")).toHaveLength(1);
    const newReply = screen.getByText("아빠가 ‘잘 다녀왔니’ 하셨어요").parentElement!;
    expect(within(newReply).getByText("새 답장")).toBeTruthy();
    const oldReply = screen.getByText("엄마가 ‘좋구나’ 하셨어요").parentElement!;
    expect(within(oldReply).queryByText("새 답장")).toBeNull();
  });

  // 받는 쪽 답장 단추는 눌러도 잠기지 않아서, 보내졌는지 못 미더운 부모님이 서너 번 누르시면 똑같은 줄이 쌓였다.
  it("같은 사람이 같은 말을 여러 번 보내셨으면 한 줄로 묶고 몇 번인지 말한다 — ‘새 답장’도 한 번만", () => {
    render(
      <TripPostcardStatus
        lines={[
          line({
            opened: true,
            replies: [
              reply("r1", "엄마", "좋구나"),
              reply("r2", "엄마", "좋구나", false),
              reply("r3", "엄마", "좋구나", false),
              reply("r4", "아빠", "좋구나"),
            ],
          }),
        ]}
        fresh={new Set(["r2", "r3"])}
      />,
    );
    expect(screen.getByText("엄마가 ‘좋구나’ 하셨어요 · 3번")).toBeTruthy();
    expect(screen.getByText("아빠가 ‘좋구나’ 하셨어요")).toBeTruthy();
    expect(screen.getAllByText(/하셨어요/)).toHaveLength(2);
    expect(screen.getAllByText("새 답장")).toHaveLength(1);
  });

  // 이 줄은 가장 최근에 보낸 엽서 기준이라, 아직 안 열어 보셨는데 반응이 보인다면 앞서 보낸 엽서에 남기신 것이다.
  it("아직 안 열어 보셨는데 반응이 있으면 지난 엽서의 반응이라고 밝힌다 — 위 줄과 모순처럼 보이지 않게", () => {
    render(<TripPostcardStatus lines={[line({ opened: false, replies: [reply("r1", "엄마", "좋구나")] })]} />);
    expect(screen.getByText("지난 엽서에 남기신 반응이에요")).toBeTruthy();
  });

  it("열어 보셨으면 그런 말을 붙이지 않는다", () => {
    render(<TripPostcardStatus lines={[line({ opened: true, replies: [reply("r1", "엄마", "좋구나")] })]} />);
    expect(screen.queryByText(/지난 엽서/)).toBeNull();
  });

  it("반응이 없으면 반응 줄도 없다", () => {
    render(<TripPostcardStatus lines={[line({ opened: true })]} />);
    expect(screen.queryByText(/하셨어요/)).toBeNull();
    expect(screen.queryByText(/하트를 눌렀어요/)).toBeNull();
  });

  it("반응은 열어 보셨다는 줄 안에 들어 있다 — 받는 곳이 여럿이어도 섞이지 않는다", () => {
    render(
      <TripPostcardStatus
        lines={[
          line({ opened: true, replies: [reply("r1", "엄마", "좋구나")] }),
          line({ mailboxId: "m2", greetingName: "장모님", name: "장인 장모님 책장", opened: true, replies: [{ ...reply("r2", "장모님", "고맙다"), mailboxId: "m2" }] }),
        ]}
      />,
    );
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).getByText("엄마가 ‘좋구나’ 하셨어요")).toBeTruthy();
    expect(within(first).queryByText(/고맙다/)).toBeNull();
    expect(within(second).getByText("장모님이 ‘고맙다’ 하셨어요")).toBeTruthy();
  });
});

describe("TripPostcardStatus · 다시 보내기", () => {
  it("열어 보셨으면 다시 보낼 필요가 없다 — 단추가 없다", () => {
    setShare(async () => undefined);
    render(<TripPostcardStatus lines={[line({ opened: true })]} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("안 열어 보셨으면 [다시 보내기] — 폰의 공유창으로 같은 엽서 링크와 인사말을 보낸다", async () => {
    const share = vi.fn(async () => undefined);
    setShare(share);
    render(<TripPostcardStatus lines={[line()]} />);
    fireEvent.click(screen.getByRole("button", { name: "엄마 아빠께 엽서 다시 보내기" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({ title: "김지민이 보낸 여행 엽서", text: "엄마 아빠, 바다 보고 왔어요", url: linkOf() }),
    );
    expect(screen.getByRole("button", { name: "엄마 아빠께 엽서 다시 보내기" })).toHaveTextContent("다시 보내기");
  });

  it("받는 곳이 여럿이면 단추 이름이 어느 곳인지 말한다 — 링크는 그 책장의 것", async () => {
    const share = vi.fn(async () => undefined);
    setShare(share);
    render(
      <TripPostcardStatus
        lines={[line(), line({ mailboxId: "m2", greetingName: "장모님", name: "장인 장모님 책장", token: "U".repeat(43), greeting: "장모님, 안녕" })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "장모님께 엽서 다시 보내기" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: linkOf("U".repeat(43)), text: "장모님, 안녕" })));
  });

  // 카카오톡 앱 안의 브라우저처럼 share 가 있다면서 거절하는 곳에서는 눌러도 아무 일이 없어 보였다.
  it("공유창이 열리지 못하면(거절) 링크 복사로 이어 간다 — 눌러도 아무 일이 없는 단추가 되지 않게", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("막힘", "NotAllowedError");
    });
    const writeText = vi.fn(async () => undefined);
    setShare(share);
    setClipboard({ writeText });
    render(<TripPostcardStatus lines={[line()]} />);
    fireEvent.click(screen.getByRole("button", { name: "엄마 아빠께 엽서 다시 보내기" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(linkOf()));
    expect(await screen.findByRole("status")).toHaveTextContent("우리 엄마 아빠 링크를 복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
  });

  it("공유창이 열리지 못하고 복사까지 막혀도 주소를 보여 준다", async () => {
    setShare(async () => {
      throw new TypeError("지원하지 않아요");
    });
    setClipboard(undefined);
    render(<TripPostcardStatus lines={[line()]} />);
    fireEvent.click(screen.getByRole("button", { name: /다시 보내기/ }));
    const note = await screen.findByRole("status");
    expect(note).toHaveTextContent("복사하지 못했어요");
    expect(note).toHaveTextContent(linkOf());
  });

  it("공유창을 그냥 닫으면 복사로 넘어가지 않는다 — 닫은 것은 끝이다", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });
    setShare(async () => {
      throw new DOMException("취소", "AbortError");
    });
    render(<TripPostcardStatus lines={[line()]} />);
    fireEvent.click(screen.getByRole("button", { name: /다시 보내기/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /다시 보내기/ })).toBeEnabled());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("공유창을 닫아도 아무 일이 없다", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("취소", "AbortError");
    });
    setShare(share);
    render(<TripPostcardStatus lines={[line()]} />);
    fireEvent.click(screen.getByRole("button", { name: /다시 보내기/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("공유창이 없는 브라우저(컴퓨터)에서는 [링크 복사] — 복사했다고 알려 준다", async () => {
    setShare(undefined);
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });
    render(<TripPostcardStatus lines={[line()]} />);
    fireEvent.click(screen.getByRole("button", { name: "엄마 아빠께 엽서 링크 복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(linkOf()));
    expect(await screen.findByRole("status")).toHaveTextContent("우리 엄마 아빠 링크를 복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
  });

  it("복사하지 못하면 주소를 보여 줘 손으로 복사하게 한다", async () => {
    setShare(undefined);
    setClipboard({
      writeText: async () => {
        throw new Error("막힘");
      },
    });
    render(<TripPostcardStatus lines={[line()]} />);
    fireEvent.click(screen.getByRole("button", { name: /링크 복사/ }));
    const note = await screen.findByRole("status");
    expect(note).toHaveTextContent("복사하지 못했어요");
    expect(note).toHaveTextContent(linkOf());
  });
});
