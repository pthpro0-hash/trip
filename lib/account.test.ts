import { describe, it, expect } from "vitest";
import { accountOf } from "./account";

describe("accountOf · 지금 로그인한 사람을 화면에 어떻게 부를까", () => {
  it("로그인 서비스가 준 이름(full_name)을 먼저 쓴다", () => {
    expect(accountOf({ user_metadata: { full_name: "김지민", name: "지민" }, email: "jimin@example.com" }).name).toBe("김지민");
  });

  it("full_name 이 없으면 name", () => {
    expect(accountOf({ user_metadata: { name: "지민" }, email: "jimin@example.com" }).name).toBe("지민");
  });

  it("이름이 없으면(카카오 등) 이메일 앞부분", () => {
    expect(accountOf({ user_metadata: {}, email: "jimin@example.com" }).name).toBe("jimin");
    expect(accountOf({ email: "jimin@example.com" }).name).toBe("jimin");
  });

  it("아무것도 없으면 '내 계정'", () => {
    expect(accountOf({}).name).toBe("내 계정");
    expect(accountOf({ user_metadata: { full_name: "" }, email: "" }).name).toBe("내 계정");
  });

  it("프로필 사진 주소가 있으면 함께 준다", () => {
    expect(accountOf({ user_metadata: { avatar_url: "https://img.example/a.png" }, email: "a@b.c" }).avatar).toBe("https://img.example/a.png");
    expect(accountOf({ email: "a@b.c" }).avatar).toBeUndefined();
  });
});
