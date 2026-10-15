/*
  검색용 공식 소개글. 필요할 때 받는다.

  소개글은 여행지 121곳에 약 150KB 라 첫 화면 JS 를 무겁게 했다. 목록 카드는 쓰지 않고 검색(소개글 낱말 맞춤, 상황어)만 쓴다. 그래서
  검색칸을 누르는 순간(또는 검색어가 있는 채로 열릴 때) 받아 두고, 받기 전에는 소개글 없이 찾는다 — 이름·지역·주소·요약으로 찾는
  결과는 그대로이고, 소개글에만 있는 낱말로 걸리던 결과만 받은 뒤에 더해진다.

  받으면 구독한 곳에 알린다(검색 결과를 다시 셀 수 있게).
*/
let loaded: Record<string, string> | null = null;
let loading: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

/** 소개글. 아직 받기 전이거나 모르는 곳은 빈 문자열. */
export function getSpotOverview(spotId: string): string {
  return loaded?.[spotId] ?? "";
}

export const overviewsLoaded = (): boolean => loaded !== null;

/** 받을 때마다 하나씩 올라가는 값. 화면이 결과를 다시 셀 때를 안다. */
export const overviewsVersion = (): number => version;

/** 받아 둔 것이 바뀔 때 부른다(소개글에서 읽어낸 것을 들고 있는 곳이 비울 수 있게). 구독을 끊는 함수를 돌려준다. */
export function subscribeOverviews(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** 소개글을 받는다. 이미 받았거나 받는 중이면 같은 약속을 돌려준다. 못 받으면 조용히 소개글 없이 간다(다음에 다시 시도). */
export function loadOverviews(): Promise<void> {
  if (loaded) return Promise.resolve();
  loading ??= import("./data/spot-overview.json")
    .then((module) => {
      loaded = module.default as Record<string, string>;
      version += 1;
      for (const listener of [...listeners]) listener();
    })
    .catch(() => {
      loading = null;
    });
  return loading;
}
