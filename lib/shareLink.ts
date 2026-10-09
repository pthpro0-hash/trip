import { attachParticle } from "./korean";

/*
  엽서 링크를 받는 분께 보내는 두 길 — 폰의 공유창(카카오톡이 목록에 나온다)과 링크 복사.

  엽서를 만든 직후(SentDone)와, 안 열어 보셨을 때 다시 보낼 때(여행 상세)가 같은 말·같은 규칙을 쓴다.
*/

/** 폰의 공유창을 열 수 있는가. 안 되는 브라우저에서는 링크 복사를 낸다. */
export function canShareLink(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** 엽서 링크를 공유창으로 보낸다. 창을 그냥 닫은 것은 실패가 아니다. */
export async function shareCard(input: { senderName: string; greeting: string; url: string }): Promise<void> {
  try {
    await navigator.share({
      title: `${attachParticle(input.senderName, "이", "가")} 보낸 여행 엽서`,
      text: input.greeting,
      url: input.url,
    });
  } catch {
    // 공유 창을 닫은 것뿐이다.
  }
}

/** 링크를 복사한다. 못 했으면 false(그때는 주소를 보여 줘 손으로 복사하게 한다). */
export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/** 복사한 뒤 알려 주는 말. 못 했으면 주소를 그대로 적어 준다. */
export function copiedNote(copied: boolean, name: string, url: string): string {
  return copied
    ? `${name} 링크를 복사했어요. 카카오톡에 붙여 넣어 보내 주세요.`
    : `복사하지 못했어요. 이 주소를 직접 복사해 주세요: ${url}`;
}
