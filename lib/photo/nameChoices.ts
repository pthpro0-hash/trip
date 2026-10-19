import { isInKorea } from "@/lib/weatherGrid";
import type { PlaceAnswer } from "./placeVote";

/*
  곳 이름을 고칠 때 눌러서 고를 후보 — 그 자리 주변의 이름난 곳.

  자동으로 붙은 이름(옛날에는 대개 주소)이 틀렸을 때 타이핑하지 않고 한 번에 고치게 한다. 후보는 고칠 때 그 자리에서 묻는다 —
  기록에 따로 저장해 두지 않으므로, 이미 기록된 여행도 새 규칙(1.5km 안의 이름난 곳)의 후보를 받는다.
*/

/**
 * 이 자리의 이름 후보. 가장 나은 이름이 이름난 곳이면 그것이 맨 앞(근처면 "…근처" 그대로), 그다음 주변 후보들.
 * 지금 이름은 뺀다. 한국 밖이거나 못 물으면 빈 목록 — 후보가 없다고 고치기가 막히지 않는다.
 */
export async function fetchNameChoices(lat: number, lng: number, current: string): Promise<string[]> {
  if (!isInKorea(lat, lng)) return [];
  try {
    const response = await fetch("/api/place", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points: [{ lat, lng }] }),
    });
    if (!response.ok) return [];
    const body: { places?: PlaceAnswer[] } = await response.json();
    const place = body.places?.[0];
    if (!place) return [];
    // 주소로 물러난 이름은 후보가 아니다. 이름난 곳으로 붙은 것만.
    const best = place.kind && place.kind !== "area" ? [place.title] : [];
    return [...new Set([...best, ...(place.candidates ?? [])])].filter((name) => name !== current).slice(0, 5);
  } catch {
    return [];
  }
}
