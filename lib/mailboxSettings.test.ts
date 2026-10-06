// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  FONT_SCALE,
  bookSizeText,
  RECOMMENDED,
  WORD_MAX,
  differsFromRecommended,
  receiverSettings,
  resolveSettings,
  sendLimits,
  settingsDiffCount,
  type MailboxSettings,
} from "./mailboxSettings";

/*
  책장 설정. 권장값이 기본이고, 저장된 값이 비었거나 깨졌거나 범위를 벗어나면 그 칸만 권장으로 읽는다
  (저장된 값 하나가 틀려도 화면이 안 깨지게). 받는 쪽에는 부모님 화면에 필요한 것만 내려간다.
*/

describe("권장값", () => {
  it("사진 20장·640px·글씨 크게·하트 사진마다·최근 10권·작년 오늘 켬·올해의 책 켬", () => {
    expect(RECOMMENDED).toEqual({
      photos: 20,
      size: 640,
      font: "large",
      heart: "photo",
      words: ["좋구나", "잘 다녀왔니", "다음엔 같이 가자"],
      keep: 10,
      past: true,
      year: true,
    });
  });

  it("글씨 크기는 지금 부모님 화면(크게)이 기준 1이다", () => {
    expect(FONT_SCALE.large).toBe(1);
    expect(FONT_SCALE.normal).toBeLessThan(1);
    expect(FONT_SCALE.xlarge).toBeGreaterThan(1);
  });
});

describe("resolveSettings · 저장된 값을 읽는다", () => {
  it("값이 없거나 모양이 틀리면 모두 권장", () => {
    for (const raw of [undefined, null, {}, [], "x", 3, { photos: "많이" }]) {
      expect(resolveSettings(raw)).toEqual(RECOMMENDED);
    }
  });

  it("맞는 값은 그대로 쓴다", () => {
    const stored: MailboxSettings = {
      photos: 12,
      size: 960,
      font: "xlarge",
      heart: "book",
      words: ["고맙다", "또 가자", "잘했다"],
      keep: "all",
      past: false,
      year: false,
    };
    expect(resolveSettings(stored)).toEqual(stored);
  });

  it("범위를 벗어난 칸만 권장으로 되돌린다 — 나머지는 살린다", () => {
    const result = resolveSettings({ photos: 7, size: 800, font: "huge", heart: "all", keep: 5, past: "yes", year: false });
    expect(result.photos).toBe(20);
    expect(result.size).toBe(640);
    expect(result.font).toBe("large");
    expect(result.heart).toBe("photo");
    expect(result.keep).toBe(10);
    expect(result.past).toBe(true);
    expect(result.year).toBe(false);
  });

  it("답장 문구는 칸마다 다듬는다 — 앞뒤 공백, 15자, 비면 그 칸만 권장", () => {
    const result = resolveSettings({ words: ["  고맙다  ", "", "가".repeat(WORD_MAX + 10)] });
    expect(result.words[0]).toBe("고맙다");
    expect(result.words[1]).toBe(RECOMMENDED.words[1]);
    expect(result.words[2]).toHaveLength(WORD_MAX);
  });

  it("답장 문구가 배열이 아니거나 셋보다 모자라면 모자란 칸만 권장", () => {
    expect(resolveSettings({ words: "좋구나" }).words).toEqual(RECOMMENDED.words);
    expect(resolveSettings({ words: ["하나뿐"] }).words).toEqual(["하나뿐", RECOMMENDED.words[1], RECOMMENDED.words[2]]);
    expect(resolveSettings({ words: [1, null, {}] }).words).toEqual(RECOMMENDED.words);
  });

  it("같은 문구를 둘 이상 쓰면 겹친 칸은 권장으로 — 단추가 똑같이 둘 보이지 않게", () => {
    const result = resolveSettings({ words: ["좋구나", "좋구나", "또 가자"] });
    expect(new Set(result.words).size).toBe(3);
    expect(result.words[0]).toBe("좋구나");
    expect(result.words[2]).toBe("또 가자");
  });
});

describe("receiverSettings · 받는 쪽에 내려가는 것", () => {
  it("부모님 화면에 필요한 것만 — 사진 수·크기·보관 권수는 내려가지 않는다", () => {
    const sent = receiverSettings(resolveSettings({ photos: 6, size: 960, keep: "all", font: "xlarge", heart: "book", past: false, year: false }));
    expect(Object.keys(sent).sort()).toEqual(["font", "heart", "past", "words", "year"]);
    expect(sent).toMatchObject({ font: "xlarge", heart: "book", past: false, year: false });
  });
});

describe("sendLimits · 한 책을 여러 책장에 꽂을 때", () => {
  const box = (over: Partial<MailboxSettings>): MailboxSettings => ({ ...RECOMMENDED, ...over });

  it("사진 수는 가장 적은 쪽에, 크기는 더 선명한 쪽에 맞춘다 — 복사본은 하나라서", () => {
    expect(sendLimits([box({ photos: 20, size: 640 }), box({ photos: 12, size: 960 })])).toEqual({ photos: 12, size: 960 });
  });

  it("하나면 그 책장 설정 그대로", () => {
    expect(sendLimits([box({ photos: 6, size: 640 })])).toEqual({ photos: 6, size: 640 });
  });

  it("책장이 없으면 권장", () => {
    expect(sendLimits([])).toEqual({ photos: RECOMMENDED.photos, size: RECOMMENDED.size });
  });
});

describe("권장과 다른 설정", () => {
  it("모두 권장이면 0", () => {
    expect(settingsDiffCount(RECOMMENDED)).toBe(0);
    expect(differsFromRecommended(RECOMMENDED, "photos")).toBe(false);
  });

  it("다른 칸을 센다(답장 문구는 한 묶음으로 한 번)", () => {
    const changed = { ...RECOMMENDED, photos: 12 as const, words: ["하나", "둘", "셋"] as [string, string, string] };
    expect(settingsDiffCount(changed)).toBe(2);
    expect(differsFromRecommended(changed, "photos")).toBe(true);
    expect(differsFromRecommended(changed, "words")).toBe(true);
    expect(differsFromRecommended(changed, "size")).toBe(false);
  });
});

describe("bookSizeText · 책 한 권의 보관 용량 어림", () => {
  it("640px 20장은 약 1.0~1.4MB, 960px 20장은 약 2.0~2.8MB", () => {
    expect(bookSizeText(20, 640)).toBe("약 1.0~1.4MB");
    expect(bookSizeText(20, 960)).toBe("약 2.0~2.8MB");
  });

  it("장수가 적으면 용량도 준다", () => {
    expect(bookSizeText(6, 640)).toBe("약 0.3~0.4MB");
    expect(bookSizeText(12, 960)).toBe("약 1.2~1.7MB");
  });
});
