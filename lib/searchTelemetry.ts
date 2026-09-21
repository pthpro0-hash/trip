import { track } from "@vercel/analytics";

/*
  결과가 0건인 검색어만 모은다.

  무엇을 보강해야 하는지 알려주는 가장 값싼 신호다. 동의어 사전에 빠진 말,
  데이터에 없는 여행지, 예상 못 한 표현이 전부 여기 쌓인다. 나중에 검색
  순위를 실제 사용 기록으로 보정할 때의 출발점이기도 하다.

  검색어 외에는 아무것도 보내지 않는다. 타이핑 도중의 중간 상태까지 보내면
  '경복'·'경복궁' 같은 조각이 잡음으로 쌓이므로, 입력이 멈춘 뒤 한 번만
  기록하고 같은 검색어는 한 세션에 한 번만 보낸다.
*/
const reported = new Set<string>();

export function reportEmptySearch(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2 || reported.has(trimmed)) return;
  reported.add(trimmed);
  track("search_no_results", { query: trimmed.slice(0, 60) });
}
