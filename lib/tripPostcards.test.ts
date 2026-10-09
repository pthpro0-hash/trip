// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { TripPostcardLine } from "./supabase/postcards";
import { groupReplies, unseenReactions } from "./tripPostcards";

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

describe("groupReplies · 같은 말을 여러 번 눌러도 한 줄", () => {
  const reply = (id: string, who: string, reaction: string, seen = true) => ({
    id,
    mailboxId: "m1",
    who,
    reaction,
    at: "2026-10-06T00:00:00Z",
    seen,
  });

  it("답장이 없으면 비어 있다", () => {
    expect(groupReplies([])).toEqual([]);
  });

  it("같은 사람이 같은 말을 여러 번 보내면 한 덩어리 — 몇 번인지와 id 들을 쥔다", () => {
    const groups = groupReplies([
      reply("r1", "엄마", "좋구나"),
      reply("r2", "엄마", "좋구나"),
      reply("r3", "엄마", "좋구나", false),
      reply("r4", "엄마", "좋구나"),
    ]);
    expect(groups).toEqual([{ who: "엄마", reaction: "좋구나", count: 4, ids: ["r1", "r2", "r3", "r4"] }]);
  });

  it("사람이 다르거나 말이 다르면 따로 — 처음 나온 차례를 지킨다", () => {
    const groups = groupReplies([
      reply("r1", "엄마", "좋구나"),
      reply("r2", "아빠", "좋구나"),
      reply("r3", "엄마", "잘 다녀왔니"),
      reply("r4", "아빠", "좋구나"),
    ]);
    expect(groups.map((group) => `${group.who}:${group.reaction}:${group.count}`)).toEqual([
      "엄마:좋구나:1",
      "아빠:좋구나:2",
      "엄마:잘 다녀왔니:1",
    ]);
  });
});
