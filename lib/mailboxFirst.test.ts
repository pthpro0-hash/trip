// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GREETING_NAME_MAX, NAME_MAX, composeGreeting, greetingsFor, normalizeMembers } from "./mailbox";
import { firstShelfInput, firstShelfItem } from "./mailboxFirst";
import { RECOMMENDED } from "./mailboxSettings";

/*
  처음 엽서를 보내는 사람은 책장이 없다. 책장을 만들려면 /mailboxes 로 가서 다섯 칸(책장 이름 · 부르는 말 · 앞에 붙일지 ·
  받는 분 이름 · 말투)을 채우고 돌아와야 했다. 엽서 창 안에서 "누구에게 보내나요?"와 말투 두 가지만 묻고, 나머지는 그
  답에서 만든다.
*/
describe("firstShelfInput", () => {
  it("'엄마, 아빠'라고만 답해도 책장이 갖춰진다 — 이름 · 부르는 말 · 받는 분", () => {
    expect(firstShelfInput("엄마, 아빠", "casual")).toEqual({
      name: "우리 엄마 아빠",
      greetingName: "엄마 아빠",
      useGreeting: true,
      tone: "casual",
      members: "엄마, 아빠",
    });
  });

  it("한 분이면 그분 하나", () => {
    expect(firstShelfInput("할머니", "polite")).toMatchObject({
      name: "우리 할머니",
      greetingName: "할머니",
      tone: "polite",
      members: "할머니",
    });
  });

  it("쉼표 · 가운뎃점 · 공백 어느 것으로 나눠 적어도 같다", () => {
    for (const answer of ["엄마 아빠", "엄마·아빠", "엄마,아빠", "엄마，아빠", " 엄마  ,  아빠 "]) {
      expect(firstShelfInput(answer, "casual")).toMatchObject({ greetingName: "엄마 아빠", members: "엄마, 아빠" });
    }
  });

  it("말투는 답한 대로 넘긴다", () => {
    expect(firstShelfInput("엄마", "casual")!.tone).toBe("casual");
    expect(firstShelfInput("엄마", "polite")!.tone).toBe("polite");
  });

  it("부르는 말은 인사말 앞에 붙는다 — 엽서 창이 보여 주는 글과 이어진다", () => {
    const input = firstShelfInput("엄마, 아빠", "casual")!;
    expect(input.useGreeting).toBe(true);
    expect(composeGreeting(input, "바다 보고 왔어요")).toBe("엄마 아빠, 바다 보고 왔어요");
  });

  it("비었거나 공백뿐이면 만들 수 없다", () => {
    expect(firstShelfInput("", "casual")).toBeNull();
    expect(firstShelfInput("   ", "casual")).toBeNull();
    expect(firstShelfInput(" , · ", "casual")).toBeNull();
  });

  describe("길이 한도 안에서", () => {
    const long = ["가나다라마바사아자차", "카타파하가나다라마바", "사아자차카타파하가나"];

    it("부르는 말이 20자를 넘으면 뒤의 이름부터 뺀다 — 이름을 반 토막 내지 않는다", () => {
      const input = firstShelfInput(long.join(" "), "casual")!;
      expect(input.greetingName.length).toBeLessThanOrEqual(GREETING_NAME_MAX);
      expect(input.greetingName).toBe("가나다라마바사아자차");
    });

    it("받는 분 이름은 줄이지 않는다 — 받는 쪽이 '누가 보시나요?'에서 고르는 이름이다", () => {
      const input = firstShelfInput(long.join(" "), "casual")!;
      expect(normalizeMembers(input.members)).toEqual(long);
    });

    it("책장 이름도 한도(40자)를 넘지 않는다", () => {
      const names = ["가나다라마바사아자차", "카타파하가나다라마바", "사아자차카타파하가나", "다라마바사아자차카타", "파하가나다라마바사아", "자차카타파하가나다라"];
      const input = firstShelfInput(names.join(" "), "casual")!;
      expect(input.name.length).toBeLessThanOrEqual(NAME_MAX);
      expect(input.name.startsWith("우리 ")).toBe(true);
    });

    it("여섯 명이 넘으면 여섯 명까지(받는 쪽 한도)", () => {
      const input = firstShelfInput("가 나 다 라 마 바 사 아", "casual")!;
      expect(normalizeMembers(input.members)).toHaveLength(6);
    });
  });
});

/*
  책장을 만든 직후 엽서 창은 같은 창에서 이어 간다. 방금 만든 줄을 서버에서 다시 읽다가 실패하면 "만들었는데 안 된다"가
  되니, 만든 값에 서버가 돌려준 id · 링크 글자만 붙여 쓴다.
*/
describe("firstShelfItem", () => {
  const input = firstShelfInput("엄마, 아빠", "casual")!;
  const token = "T".repeat(43);

  it("만든 책장 그대로 — 설정은 권장, 열려 있고, 보내는 사람은 나 하나", () => {
    expect(firstShelfItem("me", input, { id: "m1", token })).toEqual({
      id: "m1",
      ownerId: "me",
      name: "우리 엄마 아빠",
      greetingName: "엄마 아빠",
      useGreeting: true,
      tone: "casual",
      members: ["엄마", "아빠"],
      token,
      closed: false,
      settings: RECOMMENDED,
      senderCount: 1,
    });
  });

  it("엽서 창이 인사말을 붙이는 데 그대로 쓰인다", () => {
    const item = firstShelfItem("me", input, { id: "m1", token });
    expect(greetingsFor("바다 보고 왔어요", [item], {})[0].text).toBe("엄마 아빠, 바다 보고 왔어요");
  });

  it("부르는 말이 비어 있으면 null — 서버에서 읽어 오는 것과 같다", () => {
    expect(firstShelfItem("me", { ...input, greetingName: "" }, { id: "m1", token }).greetingName).toBeNull();
  });
});
