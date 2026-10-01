// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  FAMILY_LIMIT,
  FAMILY_ROLES,
  INVITE_DAYS,
  canDo,
  inviteExpiresAt,
  inviteExpired,
  isInviteToken,
  isFamilyRole,
  newInviteToken,
  roleHint,
  roleLabel,
  type FamilyAction,
} from "./family";

const ACTIONS: FamilyAction[] = ["read", "edit", "add", "remove"];
const allowed = (role: Parameters<typeof canDo>[0]) => ACTIONS.filter((action) => canDo(role, action));

describe("권한 · 무엇을 할 수 있나", () => {
  it("보기만: 읽기만", () => {
    expect(allowed("view")).toEqual(["read"]);
  });

  it("수정만: 읽고 고친다 — 더하지도 지우지도 못한다", () => {
    expect(allowed("edit")).toEqual(["read", "edit"]);
  });

  it("추가도 가능: 모두 — 삭제도 포함", () => {
    expect(allowed("full")).toEqual(["read", "edit", "add", "remove"]);
  });

  it("주인(권한 없음, null)은 모두 할 수 있다", () => {
    expect(allowed(null)).toEqual(ACTIONS);
  });

  it("알 수 없는 권한은 아무것도 못 한다", () => {
    // @ts-expect-error 일부러 틀린 값
    expect(allowed("admin")).toEqual([]);
  });
});

describe("권한 이름", () => {
  it("세 가지가 낮은 순서로 있다", () => {
    expect(FAMILY_ROLES).toEqual(["view", "edit", "full"]);
  });

  it("사람이 읽는 이름과 설명이 있다", () => {
    expect(roleLabel("view")).toBe("보기만");
    expect(roleLabel("edit")).toBe("수정만");
    expect(roleLabel("full")).toBe("추가도 가능");
    for (const role of FAMILY_ROLES) expect(roleHint(role).length).toBeGreaterThan(5);
    expect(roleHint("edit")).toContain("삭제");
  });

  it("isFamilyRole 은 세 값만 받는다", () => {
    expect(FAMILY_ROLES.every(isFamilyRole)).toBe(true);
    expect(isFamilyRole("owner")).toBe(false);
    expect(isFamilyRole(null)).toBe(false);
  });
});

describe("한도", () => {
  it("가족은 한 사람에게 최대 8명", () => {
    expect(FAMILY_LIMIT).toBe(8);
  });

  it("초대 링크는 7일", () => {
    expect(INVITE_DAYS).toBe(7);
  });
});

describe("초대 링크", () => {
  it("무작위이고, 짐작할 수 없게 길다", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(isInviteToken(a)).toBe(true);
  });

  it("주소에 넣어도 안전한 글자만 쓴다", () => {
    for (let i = 0; i < 50; i += 1) expect(newInviteToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("너무 짧거나 이상한 글자가 든 것은 초대가 아니다", () => {
    expect(isInviteToken("abc")).toBe(false);
    expect(isInviteToken("a".repeat(31))).toBe(false);
    expect(isInviteToken("a".repeat(32) + "!")).toBe(false);
    expect(isInviteToken("")).toBe(false);
  });

  it("만료는 만든 때로부터 7일 뒤", () => {
    const made = new Date("2026-10-01T09:00:00Z");
    expect(inviteExpiresAt(made).toISOString()).toBe("2026-10-08T09:00:00.000Z");
  });

  it("만료 시각이 지났으면 쓸 수 없다", () => {
    const expires = "2026-10-08T09:00:00Z";
    expect(inviteExpired(expires, new Date("2026-10-08T08:59:59Z"))).toBe(false);
    expect(inviteExpired(expires, new Date("2026-10-08T09:00:00Z"))).toBe(true);
    expect(inviteExpired("깨진 값", new Date())).toBe(true);
  });
});
