import { describe, it, expect, beforeEach } from "vitest";
import { canIn, ownerOf, readFamilyView, startFamilyView, stopFamilyView, subscribeFamilyView } from "./familyView";

const view = { ownerId: "o1", label: "mom@example.com", role: "view" as const };

describe("가족 여행 보기 · 지금 누구의 여행을 보는가", () => {
  beforeEach(() => stopFamilyView());

  it("처음에는 내 여행(null)이다", () => {
    expect(readFamilyView()).toBeNull();
  });

  it("시작하면 읽을 수 있고, 같은 값은 같은 객체로 돌려준다(화면이 불필요하게 다시 그려지지 않게)", () => {
    startFamilyView(view);
    expect(readFamilyView()).toEqual(view);
    expect(readFamilyView()).toBe(readFamilyView());
  });

  it("끝내면 내 여행으로 돌아온다", () => {
    startFamilyView(view);
    stopFamilyView();
    expect(readFamilyView()).toBeNull();
  });

  it("모양이 틀린 값(옛것·손댄 것)은 없는 것으로 본다", () => {
    window.sessionStorage.setItem("family-view", "{깨짐");
    expect(readFamilyView()).toBeNull();
    window.sessionStorage.setItem("family-view", JSON.stringify({ ownerId: "o1", label: "x", role: "admin" }));
    expect(readFamilyView()).toBeNull();
    window.sessionStorage.setItem("family-view", JSON.stringify({ ownerId: 3, label: "x", role: "view" }));
    expect(readFamilyView()).toBeNull();
  });

  it("바뀔 때 듣는 쪽에 알린다", () => {
    let calls = 0;
    const off = subscribeFamilyView(() => (calls += 1));
    startFamilyView(view);
    stopFamilyView();
    off();
    startFamilyView(view);
    expect(calls).toBe(2);
  });
});

describe("자료의 주인", () => {
  it("가족 여행을 보는 중이면 그 주인, 아니면 나", () => {
    expect(ownerOf(view, "me")).toBe("o1");
    expect(ownerOf(null, "me")).toBe("me");
  });
});

describe("무엇을 할 수 있나 — 그 주인이 준 권한대로", () => {
  const as = (role: "view" | "edit" | "full") => ({ ...view, role });
  const can = (v: ReturnType<typeof as> | null) =>
    (["read", "edit", "add", "remove"] as const).filter((action) => canIn(v, action));

  it("내 여행이면 모두", () => {
    expect(can(null)).toEqual(["read", "edit", "add", "remove"]);
  });

  it("보기만: 읽기", () => {
    expect(can(as("view"))).toEqual(["read"]);
  });

  it("수정만: 읽고 고친다 — 더하거나 지우지 못한다", () => {
    expect(can(as("edit"))).toEqual(["read", "edit"]);
  });

  it("추가도 가능: 모두", () => {
    expect(can(as("full"))).toEqual(["read", "edit", "add", "remove"]);
  });
});
