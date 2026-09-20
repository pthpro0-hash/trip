import { getSpotOverview } from "./media";
import type { Spot } from "./types";

/*
  "아이랑 가기 좋은 곳", "비 오는 날" 같은 문장 검색을 받기 위한 층.

  임베딩 대신 상황 태그를 쓴다. 여행지마다 소개글·테마에서 상황을 미리
  뽑아두고("아이동반", "실내"), 문장에서는 그 상황을 가리키는 말을 찾아
  이어 붙인다. 표현 범위는 아래 사전에 한정되지만, 외부 API도 모델
  다운로드도 없이 즉시 답한다.
*/

export type Situation = "아이동반" | "실내" | "힐링" | "액티비티" | "데이트" | "사진";

export const SITUATION_LABEL: Record<Situation, string> = {
  아이동반: "아이와 함께",
  실내: "실내·비 올 때",
  힐링: "조용한 휴식",
  액티비티: "활동적인",
  데이트: "데이트",
  사진: "사진 찍기 좋은",
};

/*
  상황을 읽어내는 낱말들. 그 여행지가 어떤 곳인지 규정하는 말만 넣는다.

  처음엔 소개글 전체에서 '산책'·'전망' 같은 말까지 찾았더니 데이트가 69곳
  (전체의 57%), 실내가 33곳이 되고 경복궁이 '실내'로 잡혔다. 근처 박물관이
  소개글에 언급됐다는 이유였다. 비 오는 날 추천으로 야외 궁궐을 내놓으면
  기능 자체가 신뢰를 잃는다.

  그래서 장소의 종류를 가리키는 말만 남기고, 찾는 범위도 이름·요약·테마로
  좁혔다. 아래 SOFT_KEYWORDS만 소개글까지 본다.
*/
const SITUATION_KEYWORDS: Record<Situation, string[]> = {
  아이동반: ["테마파크", "동물원", "과학관", "민속촌", "놀이", "워터파크", "아쿠아리움", "체험마을"],
  실내: ["박물관", "미술관", "전시관", "아쿠아리움", "온실", "수족관", "기념관"],
  힐링: ["휴양림", "수목원", "숲길", "자작나무", "정원", "둘레길", "산책로"],
  액티비티: ["케이블카", "출렁다리", "스카이워크", "짚라인", "레포츠", "스카이밸리", "모노레일"],
  데이트: ["야경", "카페거리", "전망대"],
  사진: ["벽화마을", "포토존", "전망대", "일출", "일몰"],
};

// 소개글까지 뒤져도 좋을 만큼 뜻이 분명한 말. 다른 데서는 거의 안 쓰인다.
const SOFT_KEYWORDS: Record<Situation, string[]> = {
  아이동반: ["어린이", "놀이기구", "키즈"],
  실내: ["실내 전시", "상설전시"],
  힐링: ["치유", "명상"],
  액티비티: ["짚라인", "서핑", "패러글라이딩", "래프팅"],
  데이트: ["야경 명소"],
  사진: ["포토존", "인생샷", "사진 명소"],
};

// 문장에서 상황을 가리키는 말. 왼쪽이 사람이 쓰는 말, 오른쪽이 태그다.
const QUERY_TO_SITUATION: Record<string, Situation> = {
  아이: "아이동반",
  아이랑: "아이동반",
  아이들: "아이동반",
  애들: "아이동반",
  유아: "아이동반",
  아기: "아이동반",
  가족: "아이동반",
  가족끼리: "아이동반",
  어린이: "아이동반",
  비: "실내",
  비올때: "실내",
  비오는: "실내",
  우천: "실내",
  실내: "실내",
  더울때: "실내",
  추울때: "실내",
  힐링: "힐링",
  힐링되는: "힐링",
  힐링하기: "힐링",
  휴식: "힐링",
  쉬기: "힐링",
  쉬어가기: "힐링",
  조용한: "힐링",
  조용히: "힐링",
  한적한: "힐링",
  걷기: "힐링",
  액티비티: "액티비티",
  활동적인: "액티비티",
  놀거리: "액티비티",
  체험: "액티비티",
  데이트: "데이트",
  연인: "데이트",
  커플: "데이트",
  분위기: "데이트",
  사진: "사진",
  인생샷: "사진",
  포토: "사진",
  사진찍기: "사진",
  촬영: "사진",
  뷰맛집: "사진",
};

// 문장에서 뜻을 나르지 않는 말. 이걸 걸러내지 않으면 "아이랑 가기 좋은 곳"이
// '가기'·'좋은'·'곳'까지 모두 맞아야 해서 0건이 된다.
const STOPWORDS = new Set([
  "가기", "가서", "갈만한", "갈만", "갈", "가볼만한", "가볼", "볼만한", "보기",
  "좋은", "좋다", "좋아", "괜찮은", "멋진", "예쁜", "유명한", "최고",
  "곳", "장소", "여행지", "데", "곳좀", "추천", "추천해줘", "추천해", "알려줘",
  "어디", "어디가", "뭐가", "있나", "있는", "하는", "하기", "할", "때", "날", "날씨",
  "함께", "같이", "랑", "이랑", "와", "과", "에서", "으로", "로",
  "오는", "올때", "오면", "찍기", "찍을", "놀기", "즐기기", "다니기", "지내기",
]);

export function isStopword(term: string): boolean {
  return STOPWORDS.has(term.toLowerCase());
}

/** 검색어 낱말이 가리키는 상황. 없으면 null. */
export function situationFor(term: string): Situation | null {
  return QUERY_TO_SITUATION[term.toLowerCase()] ?? null;
}

const cache = new Map<string, Set<Situation>>();

/** 여행지가 해당하는 상황들. 소개글·테마·볼거리에서 읽어낸다. */
export function situationsOf(spot: Spot): Set<Situation> {
  const cached = cache.get(spot.id);
  if (cached) return cached;

  // 이름·요약·테마까지만. 볼거리 목록은 넣지 않는다 — 경복궁의 볼거리에
  // '국립고궁박물관'이 있다고 경복궁을 '실내'로 치면, 비 오는 날 추천으로
  // 야외 궁궐이 올라온다. 장소 안에 뭐가 있느냐가 아니라 그 장소가 어떤
  // 곳이냐를 봐야 한다.
  const core = [spot.name, spot.summary, spot.themes.join(" ")].join(" ");
  const overview = getSpotOverview(spot.id);

  const found = new Set<Situation>();
  for (const [situation, keywords] of Object.entries(SITUATION_KEYWORDS) as [
    Situation,
    string[],
  ][]) {
    if (keywords.some((keyword) => core.includes(keyword))) found.add(situation);
  }
  for (const [situation, keywords] of Object.entries(SOFT_KEYWORDS) as [Situation, string[]][]) {
    if (keywords.some((keyword) => overview.includes(keyword))) found.add(situation as Situation);
  }

  cache.set(spot.id, found);
  return found;
}
