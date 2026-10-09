// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { TripPostcardLine } from "./supabase/postcards";
import { unseenReactions } from "./tripPostcards";

const line = (over: Partial<TripPostcardLine> = {}): TripPostcardLine => ({
  mailboxId: "m1",
  name: "우리 엄마 아빠",
  greetingName: "엄마 아빠",
  opened: true,
  postcardId: "P".repeat(43),
  senderName: "지민",
  greeting: "엄마 아빠, 안녕",
  token: "T".repeat(43),
  replies: [],
  hearts: [],
  ...over,
});

describe("unseenReactions · 아직 못 본 답장·하트", () => {
  it("반응이 없으면 비어 있다", () => {
    expect(unseenReactions([])).toEqual({ replies: [], hearts: [] });
    expect(unseenReactions([line()])).toEqual({ replies: [], hearts: [] });
  });

  it("봤다고 적히지 않은 것만 모은다 — 받는 곳이 여럿이어도 한꺼번에", () => {
    const lines = [
      line({
        replies: [
          { id: "r1", mailboxId: "m1", who: "엄마", reaction: "좋구나", at: "2026-10-06T00:00:00Z", seen: true },
          { id: "r2", mailboxId: "m1", who: "아빠", reaction: "잘 다녀왔니", at: "2026-10-06T01:00:00Z", seen: false },
        ],
        hearts: [{ id: "h1", mailboxId: "m1", who: "엄마", file: "a.webp", seen: false }],
      }),
      line({
        mailboxId: "m2",
        replies: [{ id: "r3", mailboxId: "m2", who: "장모님", reaction: "고맙다", at: "2026-10-07T00:00:00Z", seen: false }],
        hearts: [{ id: "h2", mailboxId: "m2", who: "장모님", file: "", seen: true }],
      }),
    ];
    expect(unseenReactions(lines)).toEqual({ replies: ["r2", "r3"], hearts: ["h1"] });
  });
});
