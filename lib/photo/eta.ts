/*
  남은 시간을 사람 말로.

  "37/200" 만 있으면 커피를 타러 가도 되는지 알 수 없다. 그렇다고 아무
  때나 어림을 말하면 안 된다 — 첫 장은 연결을 트느라 유난히 오래 걸려서,
  두 장 보고 재면 "20분 남았어요"가 떴다가 곧 3분으로 바뀐다. 틀린 수를
  보여 주느니 몇 장 지날 때까지는 말하지 않는다.
*/

/** 이만큼 올려 본 뒤에야 남은 시간을 말한다. */
export const ETA_AFTER = 5;

export function remainingText(done: number, total: number, elapsedMs: number): string | null {
  if (done < ETA_AFTER || done >= total || elapsedMs <= 0) return null;

  const left = (elapsedMs / done) * (total - done);

  // 초 단위까지 세어 봐야 초조하기만 하다.
  if (left < 10_000) return "곧 끝나요";
  if (left < 60_000) return `${Math.round(left / 5_000) * 5}초쯤 남았어요`;
  return `${Math.ceil(left / 60_000)}분쯤 남았어요`;
}
