import { describe, it, expect, vi, afterEach } from "vitest";
import { canShareLink, copiedNote, copyLink, shareCard } from "./shareLink";

/*
  엽서 링크를 보내는 두 길(공유창 · 링크 복사)은 엽서를 만든 직후와 다시 보낼 때 같은 말·같은 규칙을 쓴다.
*/

const setShare = (value: unknown) => Object.defineProperty(navigator, "share", { value, configurable: true });
const setClipboard = (value: unknown) => Object.defineProperty(navigator, "clipboard", { value, configurable: true });

afterEach(() => {
  setShare(undefined);
  setClipboard(undefined);
});

describe("canShareLink", () => {
  it("공유창이 있는 브라우저(폰)에서만 true", () => {
    setShare(undefined);
    expect(canShareLink()).toBe(false);
    setShare(async () => undefined);
    expect(canShareLink()).toBe(true);
  });
});

describe("shareCard", () => {
  it("‘○○이 보낸 여행 엽서’ 제목과 인사말·링크를 공유창에 넘긴다 — 이름 받침에 맞는 조사로", async () => {
    const share = vi.fn(async () => undefined);
    setShare(share);
    await shareCard({ senderName: "김지민", greeting: "엄마 아빠, 안녕", url: "https://x/m/T/p/P" });
    expect(share).toHaveBeenCalledWith({ title: "김지민이 보낸 여행 엽서", text: "엄마 아빠, 안녕", url: "https://x/m/T/p/P" });
    await shareCard({ senderName: "수아", greeting: "g", url: "u" });
    expect(share).toHaveBeenLastCalledWith(expect.objectContaining({ title: "수아가 보낸 여행 엽서" }));
  });

  it("보냈으면 shared", async () => {
    setShare(async () => undefined);
    expect(await shareCard({ senderName: "지민", greeting: "g", url: "u" })).toBe("shared");
  });

  it("공유창을 그냥 닫으면(AbortError) 오류로 번지지 않고 cancelled — 실패가 아니다", async () => {
    setShare(async () => {
      throw new DOMException("취소", "AbortError");
    });
    expect(await shareCard({ senderName: "지민", greeting: "g", url: "u" })).toBe("cancelled");
  });

  // 카카오톡 앱 안의 브라우저처럼 share 가 있다면서 거절하는 곳에서는 눌러도 아무 일이 없어 보인다 — 부르는 쪽이 다른 길을 내도록
  // 실패를 알린다.
  it("그 밖의 거절(NotAllowedError · TypeError 등)은 failed 로 알린다", async () => {
    setShare(async () => {
      throw new DOMException("막힘", "NotAllowedError");
    });
    expect(await shareCard({ senderName: "지민", greeting: "g", url: "u" })).toBe("failed");
    setShare(async () => {
      throw new TypeError("지원하지 않아요");
    });
    expect(await shareCard({ senderName: "지민", greeting: "g", url: "u" })).toBe("failed");
  });
});

describe("copyLink · copiedNote", () => {
  it("복사하면 true, 막히면 false", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });
    expect(await copyLink("https://x/y")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://x/y");
    setClipboard({
      writeText: async () => {
        throw new Error("막힘");
      },
    });
    expect(await copyLink("https://x/y")).toBe(false);
    setClipboard(undefined);
    expect(await copyLink("https://x/y")).toBe(false);
  });

  it("복사했으면 어디에 붙여 넣으면 되는지, 못 했으면 주소를 그대로 말해 준다", () => {
    expect(copiedNote(true, "우리 엄마 아빠", "https://x/y")).toBe("우리 엄마 아빠 링크를 복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
    expect(copiedNote(false, "우리 엄마 아빠", "https://x/y")).toBe("복사하지 못했어요. 이 주소를 직접 복사해 주세요: https://x/y");
  });
});
