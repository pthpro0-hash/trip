// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  BODY_MAX,
  DEFAULT_REACTIONS,
  MAILBOX_LIMIT,
  MAILBOX_SENDER_LIMIT,
  POSTCARD_PHOTOS_MAX,
  buildPostcardSnapshot,
  composeGreeting,
  greetingsFor,
  isMailboxToken,
  isPostcardId,
  isPostcardSnapshot,
  mailboxInviteUrl,
  mailboxUrl,
  newMailboxToken,
  newPostcardId,
  normalizeMembers,
  pickPostcardPhotos,
  postcardSpan,
  postcardSteps,
  postcardTitle,
  postcardUrl,
  suggestionsFor,
  type PostcardPhotoCandidate,
} from "./mailbox";
import type { TripDetail } from "./supabase/tripDetail";
import type { PostcardSnapshot as PostcardSnapshotLike } from "./mailbox";

describe("한도", () => {
  it("우편함은 3개, 보내는 사람은 8명, 책 한 권 사진은 최대 20장", () => {
    expect(MAILBOX_LIMIT).toBe(3);
    expect(MAILBOX_SENDER_LIMIT).toBe(8);
    expect(POSTCARD_PHOTOS_MAX).toBe(20);
  });

  it("답장 단추의 기본 문구는 셋", () => {
    expect(DEFAULT_REACTIONS).toEqual(["좋구나", "잘 다녀왔니", "다음엔 같이 가자"]);
  });
});

describe("링크의 글자", () => {
  it("우편함 링크와 엽서 주소는 무작위이고 서로 다르다", () => {
    expect(newMailboxToken()).not.toBe(newMailboxToken());
    expect(newPostcardId()).not.toBe(newPostcardId());
    expect(isMailboxToken(newMailboxToken())).toBe(true);
    expect(isPostcardId(newPostcardId())).toBe(true);
  });

  it("주소에 넣어도 안전한 글자만", () => {
    for (let i = 0; i < 30; i += 1) {
      expect(newMailboxToken()).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(newPostcardId()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("짧거나 이상한 글자는 거절한다", () => {
    for (const bad of ["", "abc", "a".repeat(31), "a".repeat(65), "a".repeat(40) + "!", "../" + "a".repeat(40)]) {
      expect(isMailboxToken(bad)).toBe(false);
    }
    expect(isPostcardId("short")).toBe(false);
    expect(isPostcardId("a".repeat(16))).toBe(true);
    expect(isPostcardId("a".repeat(65))).toBe(false);
  });

  it("주소 만들기", () => {
    expect(mailboxUrl("https://x.test", "TOK")).toBe("https://x.test/m/TOK");
    expect(postcardUrl("https://x.test", "TOK", "PID")).toBe("https://x.test/m/TOK/p/PID");
    expect(mailboxInviteUrl("https://x.test", "TOK")).toBe("https://x.test/mailboxes/join/TOK");
  });
});

describe("normalizeMembers · 받는 분 이름들", () => {
  it("쉼표·점·공백으로 나눠 다듬는다", () => {
    expect(normalizeMembers("엄마, 아빠")).toEqual(["엄마", "아빠"]);
    expect(normalizeMembers("엄마·아빠 ,  할머니")).toEqual(["엄마", "아빠", "할머니"]);
  });

  it("겹치는 것·빈 것은 버리고 여섯 명까지, 이름은 10자까지", () => {
    expect(normalizeMembers("엄마, 엄마, ,아빠")).toEqual(["엄마", "아빠"]);
    expect(normalizeMembers("a,b,c,d,e,f,g,h")).toHaveLength(6);
    expect(normalizeMembers("가".repeat(20))[0]).toHaveLength(10);
    expect(normalizeMembers("")).toEqual([]);
  });
});

describe("composeGreeting · 호칭은 본문과 따로, 맨 앞에만", () => {
  const box = { greetingName: "엄마 아빠", useGreeting: true };

  it("부르는 말을 맨 앞에 붙인다", () => {
    expect(composeGreeting(box, "강릉 바다 보고 왔어요!")).toBe("엄마 아빠, 강릉 바다 보고 왔어요!");
  });

  it("본문 안의 이름은 건드리지 않는다", () => {
    expect(composeGreeting(box, "이모도 보고 싶어하셨어요. 아빠는 건강하시죠?")).toBe(
      "엄마 아빠, 이모도 보고 싶어하셨어요. 아빠는 건강하시죠?",
    );
  });

  it("호칭 붙이기를 끄면 본문만", () => {
    expect(composeGreeting({ ...box, useGreeting: false }, "안녕하세요")).toBe("안녕하세요");
  });

  it("부르는 말이 없으면 본문만", () => {
    expect(composeGreeting({ greetingName: "", useGreeting: true }, "안녕하세요")).toBe("안녕하세요");
    expect(composeGreeting({ greetingName: null, useGreeting: true }, "안녕하세요")).toBe("안녕하세요");
  });

  it("본문이 비어 있으면 빈 글 — 호칭만 덩그러니 나가지 않는다", () => {
    expect(composeGreeting(box, "   ")).toBe("");
  });

  it("앞뒤 공백을 다듬고 글자 수 한도를 넘지 않는다", () => {
    expect(composeGreeting(box, "  안녕  ")).toBe("엄마 아빠, 안녕");
    expect(composeGreeting(box, "가".repeat(BODY_MAX + 50)).length).toBeLessThanOrEqual(BODY_MAX + "엄마 아빠, ".length);
  });
});

describe("greetingsFor · 복사 후 수정", () => {
  const boxes = [
    { id: "a", greetingName: "엄마 아빠", useGreeting: true },
    { id: "b", greetingName: "장모님", useGreeting: true },
  ];

  it("처음 쓴 본문을 모든 우편함에 복사하고 호칭만 우편함 것을 붙인다", () => {
    const result = greetingsFor("바다 보고 왔어요!", boxes, {});
    expect(result).toEqual([
      { mailboxId: "a", body: "바다 보고 왔어요!", edited: false, text: "엄마 아빠, 바다 보고 왔어요!" },
      { mailboxId: "b", body: "바다 보고 왔어요!", edited: false, text: "장모님, 바다 보고 왔어요!" },
    ]);
  });

  it("직접 고친 우편함은 그 글을 쓰고 '고쳤다'고 표시한다", () => {
    const result = greetingsFor("바다 보고 왔어요!", boxes, { b: "건강하시죠? 바다 보고 왔습니다." });
    expect(result[0].edited).toBe(false);
    expect(result[1]).toEqual({ mailboxId: "b", body: "건강하시죠? 바다 보고 왔습니다.", edited: true, text: "장모님, 건강하시죠? 바다 보고 왔습니다." });
  });

  it("처음 글을 고치면 고치지 않은 우편함만 따라간다", () => {
    const result = greetingsFor("산 보고 왔어요", boxes, { b: "직접 쓴 글" });
    expect(result.map((r) => r.body)).toEqual(["산 보고 왔어요", "직접 쓴 글"]);
  });

  it("고친 것을 비우면 다시 따라간다(원래대로)", () => {
    const result = greetingsFor("산 보고 왔어요", boxes, { b: "" });
    expect(result[1].edited).toBe(false);
    expect(result[1].body).toBe("산 보고 왔어요");
  });
});

describe("suggestionsFor · 말투별 추천 문구", () => {
  it("존댓말 우편함에는 존대 인사를 권한다", () => {
    expect(suggestionsFor("polite")).toContain("건강하시죠?");
  });

  it("편한 우편함에는 편한 말을 권한다", () => {
    const casual = suggestionsFor("casual");
    expect(casual.length).toBeGreaterThan(0);
    expect(casual).not.toContain("건강하시죠?");
  });
});

describe("pickPostcardPhotos · 책에 실을 사진 고르기", () => {
  const photo = (id: string, visitId: string, at: string, isCover = false): PostcardPhotoCandidate => ({
    id,
    visitId,
    takenAt: new Date(at),
    isCover,
  });

  it("사진이 3장 이하면 그대로 여행에 나온 차례로", () => {
    const photos = [photo("p2", "v1", "2026-09-13T10:00"), photo("p1", "v1", "2026-09-13T09:00")];
    expect(pickPostcardPhotos(photos).map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("곳이 여럿이면 곳마다 대표 한 장씩 — 한 곳에 몰리지 않는다", () => {
    const photos = [
      photo("a1", "A", "2026-09-13T09:00"),
      photo("a2", "A", "2026-09-13T09:05", true),
      photo("a3", "A", "2026-09-13T09:10"),
      photo("b1", "B", "2026-09-13T12:00"),
      photo("c1", "C", "2026-09-13T15:00"),
    ];
    expect(pickPostcardPhotos(photos, 3).map((p) => p.id)).toEqual(["a2", "b1", "c1"]);
  });

  it("곳이 둘뿐이면 곳마다 한 장씩 고르고 남는 자리는 이어서 채운다", () => {
    const photos = [
      photo("a1", "A", "2026-09-13T09:00"),
      photo("a2", "A", "2026-09-13T09:05"),
      photo("b1", "B", "2026-09-13T12:00"),
      photo("b2", "B", "2026-09-13T12:05"),
    ];
    const picked = pickPostcardPhotos(photos, 3).map((p) => p.id);
    expect(picked).toHaveLength(3);
    expect(picked).toContain("a1");
    expect(picked).toContain("b1");
  });

  it("곳이 많으면 앞에서 3곳이 아니라 고르게 흩어 뽑는다", () => {
    const photos = ["A", "B", "C", "D", "E", "F"].map((v, i) => photo(v.toLowerCase() + "1", v, `2026-09-1${i + 1}T09:00`));
    expect(pickPostcardPhotos(photos, 3).map((p) => p.id)).toEqual(["a1", "c1", "f1"]);
  });

  it("한도를 안 주면 20장까지 — 사진이 20장 이하면 모두, 넘으면 곳별로 고르게 20장", () => {
    const many = Array.from({ length: 30 }, (_, i) => photo(`p${String(i).padStart(2, "0")}`, `v${i % 6}`, `2026-09-13T${String(i % 24).padStart(2, "0")}:${String(i).padStart(2, "0")}`, i % 5 === 0));
    expect(pickPostcardPhotos(many)).toHaveLength(20);
    expect(pickPostcardPhotos(many.slice(0, 14))).toHaveLength(14);
  });

  it("20장을 고를 때도 여섯 곳이 모두 한 장 이상 들어간다 — 한 곳에 몰리지 않는다", () => {
    const many = Array.from({ length: 60 }, (_, i) => photo(`q${String(i).padStart(2, "0")}`, `v${i % 6}`, `2026-09-13T${String(Math.floor(i / 6)).padStart(2, "0")}:${String(i).padStart(2, "0")}`));
    const picked = pickPostcardPhotos(many, 20);
    expect(new Set(picked.map((p) => p.visitId)).size).toBe(6);
  });

  it("사진이 없으면 빈 배열이고, 개수를 바꿀 수 있다", () => {
    expect(pickPostcardPhotos([])).toEqual([]);
    const photos = ["A", "B", "C"].map((v) => photo(v + "1", v, "2026-09-13T09:00"));
    expect(pickPostcardPhotos(photos, 1)).toHaveLength(1);
  });
});

describe("엽서 스냅샷 · 보낸 순간의 모습", () => {
  const trip: TripDetail = {
    id: "t1",
    title: "강릉 바다",
    subtitle: null,
    startedOn: "2026-09-13",
    endedOn: "2026-09-14",
    companions: "민수",
    note: "비가 왔다",
    visits: [
      {
        id: "v1",
        placeName: "안목해변",
        spotId: null,
        dong: "강릉시 견소동",
        lat: 37.77281,
        lng: 128.94742,
        startedAt: new Date("2026-09-13T09:21"),
        endedAt: new Date("2026-09-13T11:04"),
        photos: [{ id: "p1", storagePath: "u/v1/1.webp", takenAt: new Date("2026-09-13T09:30"), isCover: true }],
      },
      {
        id: "v2",
        placeName: "경포대",
        spotId: null,
        dong: null,
        lat: 37.79,
        lng: 128.9,
        startedAt: new Date("2026-09-14T06:11"),
        endedAt: new Date("2026-09-14T08:41"),
        photos: [{ id: "p2", storagePath: "u/v2/1.webp", takenAt: new Date("2026-09-14T06:20"), isCover: false }],
      },
    ],
  };

  it("제목·기간·곳·사진 파일만 싣고, 좌표는 흐린다", () => {
    const snap = buildPostcardSnapshot(trip, new Map([["u/v1/1.webp", "a.webp"], ["u/v2/1.webp", "b.webp"]]));
    expect(snap.title).toBe("강릉 바다");
    expect(snap.startedOn).toBe("2026-09-13");
    expect(snap.visits[0]).toEqual({ placeName: "안목해변", lat: 37.77, lng: 128.95, day: "2026-09-13", photos: ["a.webp"] });
    expect(snap.files).toEqual(["a.webp", "b.webp"]);
  });

  it("메모·동행자·id·원본 경로·시각은 싣지 않는다", () => {
    const text = JSON.stringify(buildPostcardSnapshot(trip, new Map([["u/v1/1.webp", "a.webp"]])));
    for (const secret of ["비가 왔다", "민수", "t1", "p1", "u/v1", "09:21", "견소동"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("고르지 않은 사진(파일 이름이 없는 것)은 싣지 않는다", () => {
    const snap = buildPostcardSnapshot(trip, new Map([["u/v2/1.webp", "b.webp"]]));
    expect(snap.visits[0].photos).toEqual([]);
    expect(snap.files).toEqual(["b.webp"]);
  });

  it("사진 파일이 20개를 넘는 스냅샷은 받지 않는다 — 남용을 막는다", () => {
    const files = Array.from({ length: 21 }, (_, i) => `f${i}.webp`);
    const snap = { v: 1, title: "t", startedOn: "2026-09-13", endedOn: "2026-09-13", visits: [], files };
    expect(isPostcardSnapshot(snap)).toBe(false);
    expect(isPostcardSnapshot({ ...snap, files: files.slice(0, 20) })).toBe(true);
  });

  it("isPostcardSnapshot 은 이 모양만 받는다", () => {
    const snap = buildPostcardSnapshot(trip, new Map([["u/v1/1.webp", "a.webp"]]));
    expect(isPostcardSnapshot(snap)).toBe(true);
    expect(isPostcardSnapshot({ ...snap, v: 2 })).toBe(false);
    expect(isPostcardSnapshot({ ...snap, files: ["../x"] })).toBe(false);
    expect(isPostcardSnapshot({ ...snap, visits: [{ placeName: 1 }] })).toBe(false);
    expect(isPostcardSnapshot(null)).toBe(false);
  });
});

describe("엽서 화면에 쓰는 말 · 점", () => {
  const snap = (over: Partial<PostcardSnapshotLike> = {}): PostcardSnapshotLike => ({
    v: 1,
    title: "강릉 바다",
    startedOn: "2026-09-13",
    endedOn: "2026-09-14",
    visits: [
      { placeName: "안목해변", lat: 37.77, lng: 128.95, day: "2026-09-13", photos: ["a.webp", "b.webp"] },
      { placeName: "경포대", lat: 37.79, lng: 128.9, day: "2026-09-14", photos: [] },
      { placeName: "주문진", lat: 37.89, lng: 128.83, day: "2026-09-14", photos: ["c.webp"] },
    ],
    files: ["a.webp", "b.webp", "c.webp"],
    ...over,
  });

  it("제목이 있으면 그것, 없으면 곳 이름으로 짓는다", () => {
    expect(postcardTitle(snap())).toBe("강릉 바다");
    expect(postcardTitle(snap({ title: null }))).toBe("안목해변 외 2곳");
    expect(postcardTitle(snap({ title: "  ", visits: [snap().visits[0]] }))).toBe("안목해변");
    expect(postcardTitle(snap({ title: null, visits: [] }))).toBe("여행 엽서");
  });

  it("기간은 말로 — 같은 날, 같은 달, 달이 넘어갈 때", () => {
    expect(postcardSpan(snap({ startedOn: "2026-09-13", endedOn: "2026-09-13" }))).toBe("9월 13일");
    expect(postcardSpan(snap())).toBe("9월 13일 ~ 14일");
    expect(postcardSpan(snap({ startedOn: "2026-08-31", endedOn: "2026-09-01" }))).toBe("8월 31일 ~ 9월 1일");
  });

  it("발자취 재생에 쓸 점들 — 들른 차례, 흐린 좌표, 사진 수와 첫 사진", () => {
    const steps = postcardSteps(snap());
    expect(steps.map((s) => s.placeName)).toEqual(["안목해변", "경포대", "주문진"]);
    expect(steps[0]).toMatchObject({ month: 9, day: 13, lat: 37.77, lng: 128.95, photoCount: 2, photoPath: "a.webp", tripId: "" });
    expect(steps[1]).toMatchObject({ photoCount: 0, photoPath: null });
  });

  it("날을 못 읽는 곳은 건너뛴다", () => {
    const bad = snap({ visits: [{ placeName: "x", lat: 1, lng: 1, day: "깨짐", photos: [] }, snap().visits[0]] });
    expect(postcardSteps(bad)).toHaveLength(1);
  });
});
