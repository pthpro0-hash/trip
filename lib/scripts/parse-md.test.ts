import { describe, it, expect } from "vitest";
import { parseMarkdown } from "./parse-md";

const FIXTURE = `## 수도권 (22곳)

### 경복궁
- **위도, 경도**: 37.5796, 126.9770
- **요약**: 조선 왕조의 법궁으로 경복궁은 서울의 상징적인 궁궐이다. 근정전을 중심으로 한 웅장한 건축과 경회루의 연못 풍경이 특히 아름답다.
- **꼭 볼 것**:
  - 근정전
  - 경회루
  - 근정문
- **추천 계절**: 봄(벚꽃·한복), 가을(단풍)
- **특산물**: 서울 장김치, 경기미
- **대표 음식**: 육개장, 설렁탕, 왕갈비

### 도담삼봉
- **위도, 경도**: 36.9900, 128.3500
- **요약**: 남한강에 떠 있는 세 개의 봉우리. 단양 팔경의 하나.
- **꼭 볼 것**:
  - 도담삼봉 전망
  - 석문
- **추천 계절**: 사계절
- **특산물**: 단양 마늘, 사과
- **대표 음식**: 마늘요리, 올갱이국

---

## 충청권 (15곳)

### 청남대
- **위도, 경도**: 36.4600, 127.4800
- **요약**: 대통령 별장으로 사용되던 공간. 호수와 정원 풍경이 아름답다.
- **꼭 볼 것**:
  - 본관
  - 호수 산책로
- **추천 계절**: 봄·가을
- **특산물**: 청주 포도, 직지
- **대표 음식**: 청국장, 올갱이국
`;

describe("parseMarkdown", () => {
  it("각 지역 헤더 아래 항목에 올바른 region을 부여한다", () => {
    const spots = parseMarkdown(FIXTURE);
    expect(spots.map((s) => s.region)).toEqual(["수도권", "수도권", "충청권"]);
  });

  it("좌표, 요약, 꼭 볼 것을 파싱한다", () => {
    const [gyeongbok] = parseMarkdown(FIXTURE);
    expect(gyeongbok.name).toBe("경복궁");
    expect(gyeongbok.lat).toBeCloseTo(37.5796);
    expect(gyeongbok.lng).toBeCloseTo(126.977);
    expect(gyeongbok.highlights).toEqual(["근정전", "경회루", "근정문"]);
  });

  it("계절 텍스트에서 계절 배열과 부가 설명을 분리한다", () => {
    const [gyeongbok] = parseMarkdown(FIXTURE);
    expect(gyeongbok.seasons).toEqual(["봄", "가을"]);
    expect(gyeongbok.seasonNote).toBe("벚꽃·한복, 단풍");
  });

  it("괄호 설명이 없는 '사계절'은 seasonNote가 없다", () => {
    const [, damdo] = parseMarkdown(FIXTURE);
    expect(damdo.seasons).toEqual(["사계절"]);
    expect(damdo.seasonNote).toBeUndefined();
  });

  it("가운뎃점(·)으로 구분된 계절도 인식한다", () => {
    const [, , cheongnam] = parseMarkdown(FIXTURE);
    expect(cheongnam.seasons).toEqual(["봄", "가을"]);
  });

  it("특산물과 대표 음식을 쉼표로 분리한다", () => {
    const [gyeongbok] = parseMarkdown(FIXTURE);
    expect(gyeongbok.specialty).toEqual(["서울 장김치", "경기미"]);
    expect(gyeongbok.foods).toEqual(["육개장", "설렁탕", "왕갈비"]);
  });

  it("궁 이름에서 역사유적 테마를 추론한다", () => {
    const [gyeongbok] = parseMarkdown(FIXTURE);
    expect(gyeongbok.themes).toContain("역사유적");
  });

  it("한글 이름 기반 슬러그를 id로 사용한다", () => {
    const [gyeongbok] = parseMarkdown(FIXTURE);
    expect(gyeongbok.id).toBe("경복궁");
  });
});

const THEME_EDGE_CASE_FIXTURE = `## 수도권 (7곳)

### 정동문화거리
- **위도, 경도**: 37.0000, 127.0000
- **요약**: 국립공원 근처에 있으며 유네스코 세계유산으로 등재된 거리다. 산책하기 좋다.
- **꼭 볼 것**:
  - 산책로 정비
  - 유산 등재 안내판
  - 카페거리
- **추천 계절**: 사계절
- **특산물**: 테스트특산물
- **대표 음식**: 테스트음식1, 테스트음식2

### 뚝섬한강공원
- **위도, 경도**: 37.1000, 127.1000
- **요약**: 한강변의 대표 공원.
- **꼭 볼 것**:
  - 자전거길
  - 한강뷰
  - 피크닉존
- **추천 계절**: 사계절
- **특산물**: 테스트특산물
- **대표 음식**: 테스트음식1, 테스트음식2

### 서울랜드마크타워
- **위도, 경도**: 37.2000, 127.2000
- **요약**: 도심의 새로운 랜드마크.
- **꼭 볼 것**:
  - 랜드마크 전망대
  - 야경 명소
- **추천 계절**: 사계절
- **특산물**: 테스트특산물
- **대표 음식**: 테스트음식1, 테스트음식2

### 가상해변마을
- **위도, 경도**: 37.3000, 127.3000
- **요약**: 여름철 인기 있는 해변 마을.
- **꼭 볼 것**:
  - 가상해수욕장 백사장
  - 파도타기
- **추천 계절**: 여름
- **특산물**: 테스트특산물
- **대표 음식**: 테스트음식1, 테스트음식2

### 가상지리산
- **위도, 경도**: 37.4000, 127.4000
- **요약**: 등산객이 즐겨 찾는 산.
- **꼭 볼 것**:
  - 정상 조망
  - 계곡 트레킹
- **추천 계절**: 가을
- **특산물**: 테스트특산물
- **대표 음식**: 테스트음식1, 테스트음식2

### 가상랜드파크
- **위도, 경도**: 37.5000, 127.5000
- **요약**: 놀이시설이 모여 있는 테마 공간.
- **꼭 볼 것**:
  - 롤러코스터
  - 퍼레이드
- **추천 계절**: 사계절
- **특산물**: 테스트특산물
- **대표 음식**: 테스트음식1, 테스트음식2

### 가상보석섬
- **위도, 경도**: 37.6000, 127.6000
- **요약**: 작은 섬 관광지.
- **꼭 볼 것**:
  - 조용한 해안길
  - 등대
- **추천 계절**: 사계절
- **특산물**: 테스트특산물
- **대표 음식**: 테스트음식1, 테스트음식2
`;

describe("deriveThemes 오탐(false positive) 회귀 테스트", () => {
  const spots = parseMarkdown(THEME_EDGE_CASE_FIXTURE);
  const byName = (name: string) => {
    const spot = spots.find((s) => s.name === name);
    if (!spot) throw new Error(`fixture에 없는 이름: ${name}`);
    return spot;
  };

  it("summary에만 있는 '유산'/'산책'/'국립공원'은 자연경관으로 오탐하지 않는다", () => {
    const spot = byName("정동문화거리");
    expect(spot.themes).not.toContain("자연경관");
  });

  it("'뚝섬'은 섬으로 오탐하지 않는다", () => {
    const spot = byName("뚝섬한강공원");
    expect(spot.themes).not.toContain("섬");
  });

  it("'랜드마크'는 테마파크로 오탐하지 않는다", () => {
    const spot = byName("서울랜드마크타워");
    expect(spot.themes).not.toContain("테마파크");
  });

  it("'해수욕장'이 포함되면 여전히 해변으로 분류된다", () => {
    const spot = byName("가상해변마을");
    expect(spot.themes).toContain("해변");
  });

  it("'유'로 시작하지 않고 '책'으로 이어지지 않는 진짜 산 이름은 여전히 자연경관으로 분류된다", () => {
    const spot = byName("가상지리산");
    expect(spot.themes).toContain("자연경관");
  });

  it("'랜드'로 끝나는 진짜 테마파크 이름은 여전히 테마파크로 분류된다", () => {
    const spot = byName("가상랜드파크");
    expect(spot.themes).toContain("테마파크");
  });

  it("진짜 섬 이름은 여전히 섬으로 분류된다", () => {
    const spot = byName("가상보석섬");
    expect(spot.themes).toContain("섬");
  });
});

const MOUNTAIN_COMPOUND_FALSE_POSITIVE_FIXTURE = `## 경상권 (4곳)

### 부산엑스더스카이 & 그린레일웨이
- **위도, 경도**: 35.1600, 129.1600
- **요약**: 해운대 전망대와 해안 철길.
- **꼭 볼 것**:
  - 엑스더스카이 전망대
  - 그린레일웨이
  - 해운대 야경
- **추천 계절**: 사계절
- **특산물**: 부산 어묵
- **대표 음식**: 회, 돼지국밥

### 속초 관광수산시장
- **위도, 경도**: 38.2070, 128.5940
- **요약**: 동해안 대표 수산시장.
- **꼭 볼 것**:
  - 활어 회센터
  - 중앙시장
- **추천 계절**: 사계절
- **특산물**: 속초 오징어
- **대표 음식**: 오징어순대, 활어회

### 공주 백제 유적 (공산성·무령왕릉)
- **위도, 경도**: 36.4500, 127.1200
- **요약**: 백제의 왕도였던 공주의 유적.
- **꼭 볼 것**:
  - 공산성
  - 무령왕릉
- **추천 계절**: 봄·가을
- **특산물**: 공주 밤
- **대표 음식**: 밤요리, 올갱이국

### 부여 백제 유적 (부소산성·궁남지)
- **위도, 경도**: 36.2800, 126.9100
- **요약**: 백제의 마지막 수도 부여의 유적.
- **꼭 볼 것**:
  - 부소산성
  - 궁남지
- **추천 계절**: 봄·가을
- **특산물**: 부여 연꽃
- **대표 음식**: 연잎밥, 올갱이국
`;

describe("deriveThemes 복합어 속 '산' 오탐 회귀 테스트 (부산/수산시장/산성)", () => {
  const spots = parseMarkdown(MOUNTAIN_COMPOUND_FALSE_POSITIVE_FIXTURE);
  const byName = (name: string) => {
    const spot = spots.find((s) => s.name === name);
    if (!spot) throw new Error(`fixture에 없는 이름: ${name}`);
    return spot;
  };

  it("'부산'은 자연경관으로 오탐하지 않는다", () => {
    const spot = byName("부산엑스더스카이 & 그린레일웨이");
    expect(spot.themes).not.toContain("자연경관");
  });

  it("'관광수산시장'은 자연경관으로 오탐하지 않는다", () => {
    const spot = byName("속초 관광수산시장");
    expect(spot.themes).not.toContain("자연경관");
  });

  it("'공산성'은 자연경관으로 오탐하지 않는다", () => {
    const spot = byName("공주 백제 유적 (공산성·무령왕릉)");
    expect(spot.themes).not.toContain("자연경관");
  });

  it("'부소산성'은 자연경관으로 오탐하지 않는다", () => {
    const spot = byName("부여 백제 유적 (부소산성·궁남지)");
    expect(spot.themes).not.toContain("자연경관");
  });
});
