import { GREETING_NAME_MAX, NAME_MAX, normalizeMembers, type Tone } from "./mailbox";
import { resolveSettings } from "./mailboxSettings";
import type { MailboxInput, MailboxItem } from "./supabase/mailbox";

/*
  처음 엽서를 보내는 사람의 책장.

  책장이 없으면 엽서를 보낼 수 없는데, 책장을 만들려면 /mailboxes 로 떠나 다섯 칸(책장 이름 · 부르는 말 · 앞에 붙일지 ·
  받는 분 이름 · 말투)을 채우고 여행 상세로 돌아와 다시 공유를 눌러야 했다. 핵심 기능의 첫 관문이 가장 먼 길이었다.

  엽서 창 안에서 두 가지만 묻는다 — "누구에게 보내나요?"(예: 엄마, 아빠)와 말투. 나머지는 그 답에서 만든다:
    책장 이름   "우리 엄마 아빠"       내가 알아보려고 붙이는 이름이다.
    부르는 말   "엄마 아빠"            인사말 맨 앞에 붙는다("엄마 아빠, 바다 보고 왔어요").
    받는 분     "엄마, 아빠"           받는 쪽이 처음 열 때 "누가 보시나요?"에서 고르는 이름들.
  인사말 앞에 부르는 말을 붙이는 것(useGreeting)은 켜 둔다. 설정은 전부 권장값이고, 바꾸는 것은 나중에 '가족 책장'에서 한다.
*/

/** 이름들을 공백으로 이어 붙이되 max 자를 넘기지 않게 — 넘치면 뒤의 이름부터 뺀다. 이름을 반 토막 내지 않는다. */
function fit(names: string[], max: number): string {
  const kept = [...names];
  while (kept.length > 1 && kept.join(" ").length > max) kept.pop();
  return kept.join(" ").slice(0, max);
}

/**
 * "누구에게 보내나요?"의 답으로 첫 책장을 만든다. 받는 분을 하나도 알아볼 수 없으면 null.
 *
 * 받는 분 이름들(members)은 줄이지 않는다 — 받는 쪽이 "누가 보시나요?"에서 고르는 이름이라 빠지면 그분이 고를 수 없다.
 * 줄이는 것은 부르는 말(20자)과 책장 이름(40자)뿐이다.
 */
export function firstShelfInput(who: string, tone: Tone): MailboxInput | null {
  const members = normalizeMembers(who);
  if (members.length === 0) return null;
  return {
    // "우리 " 세 글자를 뺀 만큼 이름을 담는다.
    name: `우리 ${fit(members, NAME_MAX - 3)}`,
    greetingName: fit(members, GREETING_NAME_MAX),
    useGreeting: true,
    tone,
    members: members.join(", "),
  };
}

/**
 * 방금 만든 책장을 서버에서 다시 읽지 않고 엽서 창이 바로 쓸 수 있는 모양으로. 만들 때 설정은 정하지 않았으니 권장값이고,
 * 보내는 사람은 주인 하나다. (fetchMailboxes 가 읽어 오는 것과 같은 모양이다.)
 */
export function firstShelfItem(ownerId: string, input: MailboxInput, created: { id: string; token: string }): MailboxItem {
  return {
    id: created.id,
    ownerId,
    name: input.name,
    greetingName: input.greetingName || null,
    useGreeting: input.useGreeting,
    tone: input.tone,
    members: normalizeMembers(input.members),
    token: created.token,
    closed: false,
    settings: resolveSettings(null),
    senderCount: 1,
  };
}
