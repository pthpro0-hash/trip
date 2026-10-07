/*
  가고 싶은 곳 — 부모님이 여행 100선에서 골라 가족에게 보내는 곳.

  받는 쪽은 로그인이 없어서 "누가"는 이름 글자(who)다. 한 개 = (이름, 곳 id). 켜고 끄는 일은 함수(mailbox_wish)가
  하고, 여기는 화면이 쓰는 순수한 계산만 둔다(하트와 같은 모양, lib/mailboxHearts).
*/

export interface Wish {
  who: string;
  /** 여행 100선의 id. */
  spot: string;
}

/** 서버(mailbox.sql)가 받는 곳 이름 모양과 같다 — 길이 1~60, 슬래시·공백 없음. */
export function isWishSpot(value: string): boolean {
  return /^[^/\s]{1,60}$/.test(value);
}

/** 이 곳에 가고 싶다고 한 사람 수. */
export function wishCount(wishes: Wish[], spot: string): number {
  return wishes.filter((wish) => wish.spot === spot).length;
}

/** 이 사람이 이 곳을 골랐는가. */
export function wishedBy(wishes: Wish[], who: string, spot: string): boolean {
  return wishes.some((wish) => wish.who === who && wish.spot === spot);
}

/** 켜거나 끈 새 목록. 이미 켠 것을 또 켜도 하나, 없는 것을 꺼도 그대로 — 두 번 눌러도 탈이 없다. */
export function withWish(wishes: Wish[], who: string, spot: string, on: boolean): Wish[] {
  const rest = wishes.filter((wish) => !(wish.who === who && wish.spot === spot));
  return on ? [...rest, { who, spot }] : rest;
}

/** 보내는 사람이 읽는 가고 싶은 곳 한 줄. */
export interface SentWish {
  id: string;
  mailboxId: string;
  who: string;
  spot: string;
  at: string;
  /** 보내는 사람이 이미 봤는가. 아니면 새 것이다. */
  seen: boolean;
}

/** 책장별로 모은다. 순서는 받은 차례(들어온 순서 그대로). */
export function groupWishes(rows: SentWish[]): Map<string, SentWish[]> {
  const byBox = new Map<string, SentWish[]>();
  for (const row of rows) byBox.set(row.mailboxId, [...(byBox.get(row.mailboxId) ?? []), row]);
  return byBox;
}
