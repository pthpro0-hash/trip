// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RECOMMENDED } from "@/lib/mailboxSettings";
import {
  fetchMailboxPostcard,
  fetchMailboxView,
  markPostcardOpened,
  postcardFileUrl,
  replyToPostcard,
  toggleHeart,
} from "./mailboxPublic";

/*
  받는 쪽(로그인 없음)이 읽는 것. 내려받은 것은 보낸 사람의 브라우저가 적은 것이라 모양을 확인하고,
  모르는 모양은 그리지 않는다. 링크가 틀렸거나 우편함이 닫혔으면 null — 화면은 "열리지 않는 링크"를 보인다.
*/

const TOKEN = "T".repeat(43);
const CARD = "P".repeat(43);

const snapshot = {
  v: 1,
  title: "강릉 바다",
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  visits: [{ placeName: "안목해변", lat: 37.77, lng: 128.95, day: "2026-09-13", photos: ["a.webp"] }],
  files: ["a.webp"],
};

function fake(rpc: Record<string, { data?: unknown; error?: { message: string } | null }>) {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    rpc: async (name: string, args?: unknown) => {
      calls.push({ name, args });
      return rpc[name] ?? { data: null, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("postcardFileUrl", () => {
  it("공개 보관함의 주소 — 파일 이름은 한 칸으로 묶는다", () => {
    const url = postcardFileUrl("pid", "a.webp");
    expect(url).toMatch(/\/storage\/v1\/object\/public\/postcards\/pid\/a\.webp$/);
    expect(postcardFileUrl("pid", "../x")).toContain("pid/..%2Fx");
  });
});

describe("fetchMailboxView", () => {
  const view = {
    name: "우리 엄마 아빠",
    tone: "casual",
    members: ["엄마", "아빠"],
    postcards: [
      {
        id: CARD,
        senderName: "지민",
        title: "강릉 바다",
        startedOn: "2026-09-13",
        cover: "a.webp",
        greeting: "엄마 아빠, 바다 보고 왔어요",
        sentAt: "2026-10-02T00:00:00Z",
        openedAt: null,
        replies: [{ who: "엄마", reaction: "좋구나", at: "2026-10-03T00:00:00Z" }],
      },
    ],
  };

  it("우편함과 받은 엽서 목록을 읽을 수 있는 모양으로", async () => {
    const { client, calls } = fake({ mailbox_view: { data: view } });
    const result = await fetchMailboxView(client, TOKEN);
    expect(calls[0]).toEqual({ name: "mailbox_view", args: { box_token: TOKEN } });
    expect(result?.members).toEqual(["엄마", "아빠"]);
    expect(result?.postcards[0]).toMatchObject({ id: CARD, senderName: "지민", title: "강릉 바다", cover: "a.webp", opened: false });
    expect(result?.postcards[0].replies).toEqual([{ who: "엄마", reaction: "좋구나" }]);
  });

  it("열어 본 시각이 있으면 opened", async () => {
    const { client } = fake({ mailbox_view: { data: { ...view, postcards: [{ ...view.postcards[0], openedAt: "2026-10-02T01:00:00Z" }] } } });
    expect((await fetchMailboxView(client, TOKEN))?.postcards[0].opened).toBe(true);
  });

  it("모르는 링크·닫힌 우편함(null)은 null", async () => {
    expect(await fetchMailboxView(fake({ mailbox_view: { data: null } }).client, TOKEN)).toBeNull();
  });

  it("모양이 틀린 링크 글자는 묻지도 않는다", async () => {
    const { client, calls } = fake({});
    expect(await fetchMailboxView(client, "짧음")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("오류가 나도 null — 열리지 않는 링크로 보인다", async () => {
    expect(await fetchMailboxView(fake({ mailbox_view: { error: { message: "x" } } }).client, TOKEN)).toBeNull();
  });

  it("엉뚱한 모양(받는 분이 문자열 아님 등)은 거른 채 읽는다", async () => {
    const { client } = fake({ mailbox_view: { data: { ...view, members: ["엄마", 3, null], postcards: [{ nope: 1 }, view.postcards[0]] } } });
    const result = await fetchMailboxView(client, TOKEN);
    expect(result?.members).toEqual(["엄마"]);
    expect(result?.postcards).toHaveLength(1);
  });
});

describe("받는 쪽 설정 · 사진 수", () => {
  const base = { name: "우리 엄마 아빠", tone: "casual", members: ["엄마"], postcards: [] };

  it("설정이 없으면 권장값으로 읽는다", async () => {
    const view = await fetchMailboxView(fake({ mailbox_view: { data: base } }).client, TOKEN);
    expect(view?.settings).toEqual(RECOMMENDED);
  });

  it("부모님 화면용 설정(글씨·답장 문구)을 읽는다 — 엉뚱한 칸은 권장으로", async () => {
    const view = await fetchMailboxView(
      fake({ mailbox_view: { data: { ...base, settings: { font: "xlarge", words: ["고맙다", "또 가자", "잘했다"], heart: "all", past: null } } } }).client,
      TOKEN,
    );
    expect(view?.settings.font).toBe("xlarge");
    expect(view?.settings.words).toEqual(["고맙다", "또 가자", "잘했다"]);
    expect(view?.settings.heart).toBe(RECOMMENDED.heart);
    expect(view?.settings.past).toBe(RECOMMENDED.past);
  });

  it("엽서 한 장에도 설정이 따라온다", async () => {
    const card = {
      id: CARD,
      senderName: "지민",
      snapshot,
      greeting: "",
      sentAt: "",
      mailbox: { name: "x", tone: "casual", members: [], settings: { font: "normal" } },
      replies: [],
    };
    const result = await fetchMailboxPostcard(fake({ mailbox_postcard: { data: card } }).client, TOKEN, CARD);
    expect(result?.settings.font).toBe("normal");
  });

  it("엽서 목록에 사진 수(photoCount)가 있다 — 없으면 대표 사진 유무로 0·1", async () => {
    const card = { id: CARD, senderName: "지민", title: "t", startedOn: "", cover: "a.webp", greeting: "", sentAt: "", openedAt: null, replies: [] };
    const view = await fetchMailboxView(
      fake({ mailbox_view: { data: { ...base, postcards: [{ ...card, photoCount: 14 }, { ...card, id: "Q".repeat(43), photoCount: undefined }, { ...card, id: "R".repeat(43), cover: null, photoCount: 0 }] } } }).client,
      TOKEN,
    );
    expect(view?.postcards.map((entry) => entry.photoCount)).toEqual([14, 1, 0]);
  });
});

describe("fetchMailboxPostcard", () => {
  const data = {
    id: CARD,
    senderName: "지민",
    snapshot,
    greeting: "엄마 아빠, 바다 보고 왔어요",
    sentAt: "2026-10-02T00:00:00Z",
    mailbox: { name: "우리 엄마 아빠", tone: "casual", members: ["엄마", "아빠"] },
    replies: [],
  };

  it("엽서 한 장을 읽는다", async () => {
    const { client, calls } = fake({ mailbox_postcard: { data } });
    const result = await fetchMailboxPostcard(client, TOKEN, CARD);
    expect(calls[0]).toEqual({ name: "mailbox_postcard", args: { box_token: TOKEN, card_id: CARD } });
    expect(result).toMatchObject({ id: CARD, senderName: "지민", greeting: "엄마 아빠, 바다 보고 왔어요", members: ["엄마", "아빠"], tone: "casual" });
    expect(result?.snapshot.title).toBe("강릉 바다");
  });

  it("스냅샷 모양이 틀리면 null — 그리지 않는다", async () => {
    const bad = fake({ mailbox_postcard: { data: { ...data, snapshot: { v: 9 } } } });
    expect(await fetchMailboxPostcard(bad.client, TOKEN, CARD)).toBeNull();
    const evil = fake({ mailbox_postcard: { data: { ...data, snapshot: { ...snapshot, files: ["../../x"] } } } });
    expect(await fetchMailboxPostcard(evil.client, TOKEN, CARD)).toBeNull();
  });

  it("엽서 주소·링크 글자가 틀리면 묻지도 않는다", async () => {
    const { client, calls } = fake({});
    expect(await fetchMailboxPostcard(client, "짧음", CARD)).toBeNull();
    expect(await fetchMailboxPostcard(client, TOKEN, "짧음")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("그 우편함에 없는 엽서(null)는 null", async () => {
    expect(await fetchMailboxPostcard(fake({ mailbox_postcard: { data: null } }).client, TOKEN, CARD)).toBeNull();
  });
});

describe("책꽂이 재료 · 끝난 날과 곳 목록", () => {
  const base = { name: "x", tone: "casual", members: [], postcards: [] };
  const raw = { id: CARD, senderName: "지민", title: "여수", startedOn: "2025-10-05", cover: "a.webp", greeting: "", sentAt: "", openedAt: null, replies: [] };
  const read = async (over: Record<string, unknown>) =>
    (await fetchMailboxView(fake({ mailbox_view: { data: { ...base, postcards: [{ ...raw, ...over }] } } }).client, TOKEN))?.postcards[0];

  it("끝난 날과 곳 목록을 읽는다", async () => {
    const card = await read({
      endedOn: "2025-10-07",
      places: [
        { placeName: "오동도", lat: 34.74, lng: 127.76, day: "2025-10-05", photoCount: 2, photo: "a.webp" },
        { placeName: "향일암", lat: 34.59, lng: 127.8, day: "2025-10-06", photoCount: 0, photo: null },
      ],
    });
    expect(card?.endedOn).toBe("2025-10-07");
    expect(card?.places).toEqual([
      { placeName: "오동도", lat: 34.74, lng: 127.76, day: "2025-10-05", photoCount: 2, photo: "a.webp" },
      { placeName: "향일암", lat: 34.59, lng: 127.8, day: "2025-10-06", photoCount: 0, photo: null },
    ]);
  });

  it("옛 SQL 이라 없으면 — 끝난 날은 시작한 날로, 곳 목록은 빈 목록으로", async () => {
    const card = await read({});
    expect(card?.endedOn).toBe("2025-10-05");
    expect(card?.places).toEqual([]);
  });

  it("모양이 틀린 곳만 버린다 — 좌표가 글자, 날이 이상함, 사진 이름에 ../ , 이름이 없음", async () => {
    const good = { placeName: "오동도", lat: 34.74, lng: 127.76, day: "2025-10-05", photoCount: 1, photo: "a.webp" };
    const card = await read({
      places: [
        good,
        { ...good, lat: "34" },
        { ...good, day: "어제" },
        { ...good, photo: "../x" },
        { ...good, placeName: 3 },
        "x",
        null,
      ],
    });
    expect(card?.places).toEqual([good]);
  });

  it("사진 수가 이상하면 0, 소수는 내림", async () => {
    const card = await read({
      places: [
        { placeName: "가", lat: 1, lng: 2, day: "2025-10-05", photoCount: -3, photo: null },
        { placeName: "나", lat: 1, lng: 2, day: "2025-10-05", photoCount: 2.9, photo: null },
        { placeName: "다", lat: 1, lng: 2, day: "2025-10-05", photoCount: "많이", photo: null },
      ],
    });
    expect(card?.places.map((place) => place.photoCount)).toEqual([0, 2, 0]);
  });

  it("끝난 날이 이상하면 시작한 날로", async () => {
    expect((await read({ endedOn: "내일" }))?.endedOn).toBe("2025-10-05");
  });
});

describe("하트 · 받는 쪽", () => {
  const card = {
    id: CARD,
    senderName: "지민",
    snapshot,
    greeting: "",
    sentAt: "",
    mailbox: { name: "x", tone: "casual", members: ["엄마", "아빠"] },
    replies: [],
  };

  it("엽서 한 장에 누가 어느 사진에 하트를 달았는지 따라온다", async () => {
    const result = await fetchMailboxPostcard(
      fake({ mailbox_postcard: { data: { ...card, hearts: [{ who: "엄마", file: "a.webp" }, { who: "아빠", file: "" }] } } }).client,
      TOKEN,
      CARD,
    );
    expect(result?.hearts).toEqual([
      { who: "엄마", file: "a.webp" },
      { who: "아빠", file: "" },
    ]);
  });

  it("하트가 없거나(옛 SQL) 모양이 틀리면 빈 목록 — 틀린 줄만 버린다", async () => {
    expect((await fetchMailboxPostcard(fake({ mailbox_postcard: { data: card } }).client, TOKEN, CARD))?.hearts).toEqual([]);
    const result = await fetchMailboxPostcard(
      fake({
        mailbox_postcard: {
          data: { ...card, hearts: [{ who: "엄마", file: "../x" }, { who: 3, file: "a.webp" }, "x", { who: "아빠", file: "a.webp" }] },
        },
      }).client,
      TOKEN,
      CARD,
    );
    expect(result?.hearts).toEqual([{ who: "아빠", file: "a.webp" }]);
  });

  it("하트를 켠다 — 이름·사진·켬 여부를 함수에 넘긴다", async () => {
    const { client, calls } = fake({ mailbox_heart: { data: true } });
    expect(await toggleHeart(client, TOKEN, CARD, "엄마", "a.webp", true)).toEqual({ ok: true });
    expect(calls[0]).toEqual({
      name: "mailbox_heart",
      args: { box_token: TOKEN, card_id: CARD, heart_who: "엄마", heart_file: "a.webp", heart_on: true },
    });
  });

  it("끄기도 같은 길 — 책 하트는 사진이 빈 글자", async () => {
    const { client, calls } = fake({ mailbox_heart: { data: true } });
    expect(await toggleHeart(client, TOKEN, CARD, "엄마", "", false)).toEqual({ ok: true });
    expect(calls[0].args).toMatchObject({ heart_file: "", heart_on: false });
  });

  it("너무 잦으면 often, 하트 방식이 바뀌었으면 changed, 링크가 닫혔으면 closed, 그 밖은 failed", async () => {
    const reason = async (rpc: Parameters<typeof fake>[0]) => toggleHeart(fake(rpc).client, TOKEN, CARD, "엄마", "a.webp", true);
    expect(await reason({ mailbox_heart: { error: { message: "mailbox: 하트가 너무 잦다" } } })).toEqual({ ok: false, reason: "often" });
    expect(await reason({ mailbox_heart: { error: { message: "mailbox: 하트 방식이 바뀌었다" } } })).toEqual({ ok: false, reason: "changed" });
    expect(await reason({ mailbox_heart: { data: false } })).toEqual({ ok: false, reason: "closed" });
    expect(await reason({ mailbox_heart: { error: { message: "boom" } } })).toEqual({ ok: false, reason: "failed" });
  });

  it("묻기 전에 걸러낸다 — 이름·파일 이름·링크 글자가 틀리면 묻지도 않는다", async () => {
    const { client, calls } = fake({});
    expect(await toggleHeart(client, TOKEN, CARD, "", "a.webp", true)).toEqual({ ok: false, reason: "invalid" });
    expect(await toggleHeart(client, TOKEN, CARD, "가".repeat(11), "a.webp", true)).toEqual({ ok: false, reason: "invalid" });
    expect(await toggleHeart(client, TOKEN, CARD, "엄마", "../x", true)).toEqual({ ok: false, reason: "invalid" });
    expect(await toggleHeart(client, "짧음", CARD, "엄마", "a.webp", true)).toEqual({ ok: false, reason: "invalid" });
    expect(await toggleHeart(client, TOKEN, "짧음", "엄마", "a.webp", true)).toEqual({ ok: false, reason: "invalid" });
    expect(calls).toHaveLength(0);
  });

  it("네트워크가 끊겨 던져도 failed 로 돌려준다", async () => {
    const throwing = { rpc: async () => { throw new Error("offline"); } } as unknown as SupabaseClient;
    expect(await toggleHeart(throwing, TOKEN, CARD, "엄마", "a.webp", true)).toEqual({ ok: false, reason: "failed" });
  });
});

describe("markPostcardOpened · replyToPostcard", () => {
  it("열어 봤다고 적는다 — 실패해도 조용히(보는 데 지장 없다)", async () => {
    const { client, calls } = fake({ mailbox_open: { data: true } });
    await markPostcardOpened(client, TOKEN, CARD);
    expect(calls[0]).toEqual({ name: "mailbox_open", args: { box_token: TOKEN, card_id: CARD } });
    await expect(markPostcardOpened(fake({ mailbox_open: { error: { message: "x" } } }).client, TOKEN, CARD)).resolves.toBeUndefined();
  });

  it("답장을 보낸다", async () => {
    const { client, calls } = fake({ mailbox_reply: { data: true } });
    expect(await replyToPostcard(client, TOKEN, CARD, "엄마", "좋구나")).toEqual({ ok: true });
    expect(calls[0]).toEqual({
      name: "mailbox_reply",
      args: { box_token: TOKEN, card_id: CARD, reply_who: "엄마", reply_reaction: "좋구나" },
    });
  });

  it("너무 잦은 답장은 too-often, 그 밖은 failed, 링크가 닫혔으면 closed", async () => {
    expect(await replyToPostcard(fake({ mailbox_reply: { error: { message: "mailbox: 답장이 너무 잦다" } } }).client, TOKEN, CARD, "엄마", "좋구나")).toEqual({ ok: false, reason: "often" });
    expect(await replyToPostcard(fake({ mailbox_reply: { error: { message: "boom" } } }).client, TOKEN, CARD, "엄마", "좋구나")).toEqual({ ok: false, reason: "failed" });
    expect(await replyToPostcard(fake({ mailbox_reply: { data: false } }).client, TOKEN, CARD, "엄마", "좋구나")).toEqual({ ok: false, reason: "closed" });
  });

  it("이름·답장 글자 수가 틀리면 묻지도 않는다", async () => {
    const { client, calls } = fake({});
    expect(await replyToPostcard(client, TOKEN, CARD, "", "좋구나")).toEqual({ ok: false, reason: "invalid" });
    expect(await replyToPostcard(client, TOKEN, CARD, "가".repeat(11), "좋구나")).toEqual({ ok: false, reason: "invalid" });
    expect(await replyToPostcard(client, TOKEN, CARD, "엄마", "가".repeat(31))).toEqual({ ok: false, reason: "invalid" });
    expect(calls).toHaveLength(0);
  });
});
