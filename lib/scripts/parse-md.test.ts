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
