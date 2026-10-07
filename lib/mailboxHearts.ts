/*
  하트 — 부모님이 사진에(또는 책 한 권에) 누르는 가장 작은 답장.

  받는 쪽은 로그인이 없어서 "누가"는 이름 글자(who)다. 하트 한 개 = (이름, 사진 파일). 책마다 하트를 받는
  책장(설정 heart:"book")은 사진 파일이 빈 글자다. 켜고 끄는 일은 함수(mailbox_heart)가 하고, 여기는 화면이
  쓰는 순수한 계산만 둔다.
*/

export interface Heart {
  who: string;
  /** 하트를 단 사진 파일 이름. 책 하트면 빈 글자. */
  file: string;
}

/** 빈 글자(책 하트)이거나 엽서 보관함 파일 이름 모양. 서버(mailbox.sql)가 막는 모양과 같다. */
export function isHeartFile(file: string): boolean {
  return file === "" || /^[A-Za-z0-9._-]{1,80}$/.test(file);
}

/** 이 사진(빈 글자면 책)에 하트가 몇 개인가. */
export function heartCount(hearts: Heart[], file: string): number {
  return hearts.filter((heart) => heart.file === file).length;
}

/** 이 사람이 이 사진에 하트를 달았는가. */
export function heartedBy(hearts: Heart[], who: string, file: string): boolean {
  return hearts.some((heart) => heart.who === who && heart.file === file);
}

/** 이 사진에 하트를 단 사람들(단 차례, 같은 이름은 한 번). */
export function heartNames(hearts: Heart[], file: string): string[] {
  const names: string[] = [];
  for (const heart of hearts) if (heart.file === file && !names.includes(heart.who)) names.push(heart.who);
  return names;
}

/** 하트를 켜거나 끈 새 목록. 이미 켠 것을 또 켜도 하나, 없는 것을 꺼도 그대로 — 두 번 눌러도 탈이 없다. */
export function withHeart(hearts: Heart[], who: string, file: string, on: boolean): Heart[] {
  const rest = hearts.filter((heart) => !(heart.who === who && heart.file === file));
  return on ? [...rest, { who, file }] : rest;
}

/** 보낸 사람이 읽는 하트 한 줄(책장·이름마다). 사진 하트는 몇 장, 책 하트는 책 하나. */
export interface HeartLine {
  mailboxId: string;
  who: string;
  photos: number;
  book: boolean;
  /** 이 줄에 든 하트 행들의 id — "봤다"고 표시할 때 쓴다. */
  ids: string[];
}

export function summarizeHearts(rows: { id: string; mailboxId: string; who: string; file: string }[]): HeartLine[] {
  const lines: HeartLine[] = [];
  for (const row of rows) {
    let line = lines.find((entry) => entry.mailboxId === row.mailboxId && entry.who === row.who);
    if (!line) {
      line = { mailboxId: row.mailboxId, who: row.who, photos: 0, book: false, ids: [] };
      lines.push(line);
    }
    if (row.file === "") line.book = true;
    else line.photos += 1;
    line.ids.push(row.id);
  }
  return lines;
}
