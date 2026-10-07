/*
  책장(우편함) 설정.

  권장값이 기본이다. 저장된 값은 칸마다 따로 읽는다 — 비었거나, 모양이 틀렸거나, 선택지 밖이면 그 칸만
  권장으로 되돌리고 나머지는 살린다. 저장된 값 하나가 틀려도 화면이 깨지지 않게 하려는 것이다.

  어느 설정이 어디에 쓰이나:
    photos·size   엽서를 보낼 때(새로 꽂는 책부터). 이미 보낸 엽서는 보낸 순간 그대로다.
    font·words·heart·past·year  부모님 화면(바로 바뀐다). 하트는 사진마다 / 책마다, past 는 '작년 오늘', year 는 '올해의 책'을 보일지.
    keep  앞으로 붙는 기능의 자리. 값은 지금부터 저장할 수 있지만 그 기능이 생기기 전에는
                  화면에 내지 않는다.
*/

export type FontSize = "normal" | "large" | "xlarge";

export interface MailboxSettings {
  /** 책 한 권에 싣는 사진 수. */
  photos: 6 | 12 | 20;
  /** 엽서로 복사하는 사진의 긴 변(px). */
  size: 640 | 960;
  /** 부모님 화면의 글씨 크기. */
  font: FontSize;
  /** 하트를 사진마다 받을지, 책마다 한 번만 받을지. */
  heart: "photo" | "book";
  /** 답장 단추 문구 셋. */
  words: [string, string, string];
  /** 책장에 사진까지 보관할 책 수. */
  keep: 10 | "all";
  /** 책장 홈에 "작년 오늘"을 보일지. */
  past: boolean;
  /** 연말에 "올해의 책"을 저절로 만들지. */
  year: boolean;
}

export const RECOMMENDED: MailboxSettings = {
  photos: 20,
  size: 640,
  font: "large",
  heart: "photo",
  words: ["좋구나", "잘 다녀왔니", "다음엔 같이 가자"],
  keep: 10,
  past: true,
  year: true,
};

export const PHOTO_CHOICES = [6, 12, 20] as const;
export const SIZE_CHOICES = [640, 960] as const;
export const FONT_CHOICES: FontSize[] = ["normal", "large", "xlarge"];
export const HEART_CHOICES = ["photo", "book"] as const;
/** 답장 문구 한 칸의 글자 수. */
export const WORD_MAX = 15;

/** 부모님 화면 글씨의 배율. 지금 화면(크게)이 기준 1이다. */
export const FONT_SCALE: Record<FontSize, number> = { normal: 0.85, large: 1, xlarge: 1.2 };
export const FONT_LABEL: Record<FontSize, string> = { normal: "보통", large: "크게", xlarge: "아주 크게" };

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const pick = <T,>(value: unknown, choices: readonly T[], fallback: T): T => (choices.includes(value as T) ? (value as T) : fallback);
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

/** 답장 문구 셋. 칸마다 다듬고(공백·15자), 비었거나 다른 칸과 겹치면 그 칸만 권장으로. */
function wordsOf(value: unknown): [string, string, string] {
  const raw = Array.isArray(value) ? value : [];
  const result: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const text = typeof raw[index] === "string" ? (raw[index] as string).trim().slice(0, WORD_MAX) : "";
    result.push(text && !result.includes(text) ? text : RECOMMENDED.words[index]);
  }
  // 권장으로 되돌린 칸이 앞 칸과 겹치면 한 번 더 비켜 준다.
  for (let index = 1; index < 3; index += 1) {
    if (result.indexOf(result[index]) !== index) {
      const spare = RECOMMENDED.words.find((word) => !result.includes(word));
      if (spare) result[index] = spare;
    }
  }
  return result as [string, string, string];
}

/** 저장된 값을 읽는다. 어떤 것이 와도 쓸 수 있는 설정을 돌려준다. */
export function resolveSettings(raw: unknown): MailboxSettings {
  const source = isRecord(raw) ? raw : {};
  return {
    photos: pick(source.photos, PHOTO_CHOICES, RECOMMENDED.photos),
    size: pick(source.size, SIZE_CHOICES, RECOMMENDED.size),
    font: pick(source.font, FONT_CHOICES, RECOMMENDED.font),
    heart: pick(source.heart, HEART_CHOICES, RECOMMENDED.heart),
    words: wordsOf(source.words),
    keep: pick(source.keep, [10, "all"] as const, RECOMMENDED.keep),
    past: bool(source.past, RECOMMENDED.past),
    year: bool(source.year, RECOMMENDED.year),
  };
}

export interface ReceiverSettings {
  font: FontSize;
  heart: MailboxSettings["heart"];
  words: [string, string, string];
  past: boolean;
  year: boolean;
}

/** 부모님 화면에 내려가는 것. 사진 수·크기·보관 권수는 보내는 쪽 일이라 내려가지 않는다. */
export function receiverSettings(settings: MailboxSettings): ReceiverSettings {
  return { font: settings.font, heart: settings.heart, words: settings.words, past: settings.past, year: settings.year };
}

/**
 * 한 책을 여러 책장에 꽂을 때의 한도. 사진 복사본은 하나라서 사진 수는 가장 적은 쪽에, 크기는 더 선명한
 * 쪽에 맞춘다(모자라게 보내지는 않고, 한 책장의 한도는 넘지 않는다).
 */
export function sendLimits(list: MailboxSettings[]): { photos: number; size: number } {
  if (list.length === 0) return { photos: RECOMMENDED.photos, size: RECOMMENDED.size };
  return {
    photos: Math.min(...list.map((settings) => settings.photos)),
    size: Math.max(...list.map((settings) => settings.size)),
  };
}

export type SettingKey = keyof MailboxSettings;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** 이 칸이 권장과 다른가. */
export function differsFromRecommended(settings: MailboxSettings, key: SettingKey): boolean {
  return !same(settings[key], RECOMMENDED[key]);
}

/** 권장과 다른 칸의 수(답장 문구 셋은 한 칸으로 센다). */
export function settingsDiffCount(settings: MailboxSettings): number {
  return (Object.keys(RECOMMENDED) as SettingKey[]).filter((key) => differsFromRecommended(settings, key)).length;
}

/**
 * 책 한 권이 보관함에서 차지하는 크기의 어림. 사진 한 장은 640px 에서 50~70KB, 960px 에서 100~140KB 쯤이다
 * (WebP, 사진마다 다르다). 설정 화면에서 선택이 용량에 어떤 영향을 주는지 보여 주는 데 쓴다.
 */
export function bookSizeText(photos: number, size: number): string {
  const each = size === 960 ? [0.1, 0.14] : [0.05, 0.07];
  const [low, high] = each.map((mb) => (photos * mb).toFixed(1));
  return `약 ${low}~${high}MB`;
}
