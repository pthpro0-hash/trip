# 여행세상 Phase 1 (MVP: 필터 + 지도 탐색) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첨부된 "2025~2026 한국관광 100선" 데이터를 기반으로, 로그인 없이 지역/계절/테마로
관광지를 필터링하고 지도에서 탐색할 수 있는 Next.js 웹앱(Phase 1 MVP)을 만든다.

**Architecture:** Next.js(App Router) + TypeScript + Tailwind CSS. 별도 백엔드 없이 정적
JSON(`lib/data/spots.json`)을 소스로 SSG하고, 필터링은 전부 클라이언트에서 순수 함수로
처리한다. 지도는 카카오맵 JS SDK를 스크립트 태그로 로드한다.

**Tech Stack:** Next.js 15(App Router), React, TypeScript, Tailwind CSS, Vitest +
Testing Library(단위/컴포넌트 테스트), tsx(마크다운 파싱 스크립트 실행), Kakao Maps JS SDK,
Vercel(배포).

**Spec:** [docs/superpowers/specs/2026-09-04-travel-recommendation-service-design.md](../specs/2026-09-04-travel-recommendation-service-design.md)

## Global Constraints

- Phase 1은 회원가입/로그인 없이 동작한다 (스펙 5절).
- 필터링은 서버 API 없이 클라이언트에서 처리한다 (스펙 3절, 5절).
- 데이터 소스는 `lib/data/spots.json` 하나이며, 스펙 4절의 `Spot` 스키마를 따른다.
- 지도는 카카오맵 API를 사용한다 (스펙 3절).
- 필터 조합은 지역/계절/테마 간 AND 조건이다 (스펙 5절).
- 배포 대상은 Vercel이다 (스펙 8절).

## 사람이 먼저 처리해야 하는 사전 준비물

이 플랜은 카카오맵 API 키가 필요한 지점(Task 5)에서 실행이 막힌다. 에이전트가 대신 발급받을
수 없으므로, Task 5 착수 전에 아래를 사용자가 직접 준비해야 한다:

1. https://developers.kakao.com 에서 애플리케이션 생성
2. "JavaScript 키" 발급
3. 카카오 개발자 콘솔 → 앱 설정 → 플랫폼 → Web 플랫폼에 `http://localhost:3000` 등록
4. 발급받은 키를 어디에 넣을지는 Task 1에서 만드는 `.env.local`에 안내되어 있다

Task 1~4는 카카오 키 없이도 진행 가능하다.

---

### Task 1: 프로젝트 스캐폴딩 (Next.js + TypeScript + Tailwind + 테스트 환경)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Create: `.env.local.example`, `.gitignore`, `README.md`

**Interfaces:**
- Produces: `@/*` import alias가 프로젝트 루트를 가리킴. `npm test` = vitest 실행,
  `npm run dev` = 개발 서버, `npm run build` = 프로덕션 빌드.

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
npx create-next-app@latest . --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm
```

프롬프트가 뜨면(버전에 따라 Turbopack 사용 여부를 물을 수 있음) 기본값(Enter)을 선택한다.

- [ ] **Step 2: 개발 서버로 스캐폴딩 확인**

Run: `npm run dev` 실행 후 다른 터미널에서 `curl -sf http://localhost:3000 > /dev/null && echo OK`
Expected: `OK` 출력. 확인 후 dev 서버 종료(Ctrl+C).

- [ ] **Step 3: 테스트 도구 설치**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom tsx
```

- [ ] **Step 4: vitest 설정 작성**

`vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

`vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

`package.json`의 `scripts`에 추가:
```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 5: 테스트 스크립트 동작 확인용 더미 테스트**

`lib/sanity.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("test runner가 동작한다", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed. 통과를 확인한 뒤 `lib/sanity.test.ts` 파일은 삭제한다.

- [ ] **Step 6: 사이트 기본 레이아웃 작성**

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "여행세상 | 한국관광 100선 추천",
  description: "2025~2026 한국관광 100선 데이터를 조건별로 필터링하고 지도에서 탐색하세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-neutral-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: 환경변수 예시 파일 및 gitignore 확인**

`.env.local.example`:
```
# https://developers.kakao.com 에서 발급받은 JavaScript 키
NEXT_PUBLIC_KAKAO_MAP_KEY=
```

`.gitignore`에 `.env.local`이 포함되어 있는지 확인 (create-next-app이 기본 생성하는
`.gitignore`에 이미 포함됨).

- [ ] **Step 8: README 작성**

`README.md`:
```markdown
# 여행세상

2025~2026 한국관광 100선 데이터를 조건별로 필터링하고 지도에서 탐색하는 웹앱.

## 시작하기

1. `.env.local.example`을 `.env.local`로 복사하고 카카오맵 JavaScript 키를 채워넣는다.
2. `npm install`
3. `npm run dev` → http://localhost:3000

## 테스트

`npm test`
```

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "chore: Next.js 프로젝트 스캐폴딩 및 테스트 환경 구성"
```

---

### Task 2: 데이터 타입 정의 및 마크다운 → JSON 파서

**Files:**
- Create: `lib/types.ts`
- Create: `data/source/tour-100-2025-2026.md` (첨부 원본 마크다운 복사본)
- Create: `lib/scripts/parse-md.ts`
- Create: `lib/scripts/parse-md.test.ts`
- Create: `lib/data/spots.json` (생성 결과물, Step 6에서 생성)

**Interfaces:**
- Produces: `Spot`, `Region`, `Season`, `Theme` 타입 (`lib/types.ts`). `parseMarkdown(source: string): Spot[]` 함수 (`lib/scripts/parse-md.ts`). `lib/data/spots.json`은 `Spot[]` 100건.

- [ ] **Step 1: 타입 정의**

`lib/types.ts`:
```typescript
export type Region = "수도권" | "강원권" | "충청권" | "전라권" | "경상권" | "제주권";
export type Season = "봄" | "여름" | "가을" | "겨울" | "사계절";
export type Theme =
  | "역사유적"
  | "자연경관"
  | "테마파크"
  | "해변"
  | "야경"
  | "체험마을"
  | "정원"
  | "섬";

export interface Spot {
  id: string;
  name: string;
  region: Region;
  lat: number;
  lng: number;
  summary: string;
  highlights: string[];
  seasons: Season[];
  seasonNote?: string;
  specialty: string[];
  foods: string[];
  themes: Theme[];
}
```

**설계 노트 (스펙 대비 변경점)**: 스펙 4절의 `id` 예시는 로마자(`gyeongbokgung`)였지만, 100곳을
전부 수동으로 로마자 변환하는 대신 한글 이름을 슬러그로 그대로 사용한다(예: `id: "경복궁"`).
Next.js 동적 라우트는 UTF-8 슬러그를 문제없이 처리하며, 자동화된 파서만으로 완결되는 쪽을
택했다. 또한 스펙의 테마 후보 중 "산"은 "자연경관"과 겹치는 경우가 대부분이라 8개 테마로
단순화했다 (스펙 9절 "태그 체계 최종 확정"에 대한 구현 결정).

- [ ] **Step 2: 원본 마크다운 파일을 저장소로 복사**

```bash
mkdir -p data/source
cp "/c/Users/pthpro/Downloads/2025-2026_한국관광_100선_전체정리.md" "data/source/tour-100-2025-2026.md"
```

(Bash 도구가 아닌 PowerShell을 사용한다면:
`Copy-Item "C:\Users\pthpro\Downloads\2025-2026_한국관광_100선_전체정리.md" "data\source\tour-100-2025-2026.md"`)

- [ ] **Step 3: 파서에 대한 실패하는 테스트 작성**

`lib/scripts/parse-md.test.ts`:
```typescript
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
```

- [ ] **Step 4: 테스트 실행하여 실패 확인**

Run: `npm test -- parse-md`
Expected: FAIL (`parse-md.ts` 모듈이 아직 없음)

- [ ] **Step 5: 파서 구현**

`lib/scripts/parse-md.ts`:
```typescript
import fs from "node:fs";
import path from "node:path";
import type { Region, Season, Theme, Spot } from "../types";

const REGION_HEADER = /^## (.+?) \(\d+곳\)/;
const SPOT_HEADER = /^### (.+)$/;
const FIELD_COORD = /^- \*\*위도, 경도\*\*:\s*(.+)$/;
const FIELD_SUMMARY = /^- \*\*요약\*\*:\s*(.+)$/;
const FIELD_HIGHLIGHTS_START = /^- \*\*꼭 볼 것\*\*:\s*$/;
const FIELD_SEASON = /^- \*\*추천 계절\*\*:\s*(.+)$/;
const FIELD_SPECIALTY = /^- \*\*특산물\*\*:\s*(.+)$/;
const FIELD_FOODS = /^- \*\*대표 음식\*\*:\s*(.+)$/;
const BULLET = /^\s*-\s+(.+)$/;

const THEME_RULES: [RegExp, Theme][] = [
  [/궁|종묘|서원|향교|읍성|유적|왕릉|고분|사찰|법주사|통도사|쌍계사|불국사|석굴암|현충사|향교/, "역사유적"],
  [/해수욕장|해변|바다|갯벌|해안/, "해변"],
  [/산|봉|계곡|폭포|국립공원|휴양림|숲|자작나무|습지|늪|계곡/, "자연경관"],
  [/워터파크|놀이공원|테마파크|랜드|에버랜드/, "테마파크"],
  [/야경|전망대|타워|스카이|일몰|일출/, "야경"],
  [/민속촌|한옥마을|장터|시장|전통마을/, "체험마을"],
  [/수목원|정원|식물원|화원/, "정원"],
  [/섬(?!사람)/, "섬"],
];

export function slugify(name: string): string {
  return name
    .trim()
    .replace(/[()·]/g, "")
    .replace(/&/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCoord(raw: string): { lat: number; lng: number } {
  const match = raw.match(/(\d+\.\d+),\s*(\d+\.\d+)/);
  if (!match) throw new Error(`좌표를 파싱할 수 없습니다: ${raw}`);
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function parseSeasons(raw: string): { seasons: Season[]; seasonNote?: string } {
  const keywords: Season[] = ["사계절", "봄", "여름", "가을", "겨울"];
  const seasons = keywords.filter((k) => raw.includes(k));
  const notes = [...raw.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  return {
    seasons: seasons.length > 0 ? seasons : ["사계절"],
    seasonNote: notes.length > 0 ? notes.join(", ") : undefined,
  };
}

function splitCommaList(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function deriveThemes(name: string, summary: string, highlights: string[]): Theme[] {
  const text = [name, summary, highlights.join(" ")].join(" ");
  const themes = THEME_RULES.filter(([pattern]) => pattern.test(text)).map(([, theme]) => theme);
  return Array.from(new Set(themes));
}

interface Draft {
  name: string;
  highlights: string[];
  lat?: number;
  lng?: number;
  summary?: string;
  seasons?: Season[];
  seasonNote?: string;
  specialty?: string[];
  foods?: string[];
}

export function parseMarkdown(source: string): Spot[] {
  const lines = source.split("\n");
  const spots: Spot[] = [];

  let region: Region | null = null;
  let current: Draft | null = null;
  let collectingHighlights = false;

  const flush = () => {
    if (!current || !region) return;
    if (current.lat === undefined || current.lng === undefined) {
      throw new Error(`좌표가 없는 항목: ${current.name}`);
    }
    spots.push({
      id: slugify(current.name),
      name: current.name,
      region,
      lat: current.lat,
      lng: current.lng,
      summary: current.summary ?? "",
      highlights: current.highlights,
      seasons: current.seasons ?? ["사계절"],
      seasonNote: current.seasonNote,
      specialty: current.specialty ?? [],
      foods: current.foods ?? [],
      themes: deriveThemes(current.name, current.summary ?? "", current.highlights),
    });
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    const regionMatch = line.match(REGION_HEADER);
    if (regionMatch) {
      flush();
      region = regionMatch[1].trim() as Region;
      collectingHighlights = false;
      continue;
    }

    const spotMatch = line.match(SPOT_HEADER);
    if (spotMatch) {
      flush();
      current = { name: spotMatch[1].trim(), highlights: [] };
      collectingHighlights = false;
      continue;
    }

    if (!current) continue;

    const coordMatch = line.match(FIELD_COORD);
    if (coordMatch) {
      Object.assign(current, parseCoord(coordMatch[1]));
      collectingHighlights = false;
      continue;
    }

    const summaryMatch = line.match(FIELD_SUMMARY);
    if (summaryMatch) {
      current.summary = summaryMatch[1].trim();
      collectingHighlights = false;
      continue;
    }

    if (FIELD_HIGHLIGHTS_START.test(line)) {
      collectingHighlights = true;
      continue;
    }

    const seasonMatch = line.match(FIELD_SEASON);
    if (seasonMatch) {
      Object.assign(current, parseSeasons(seasonMatch[1]));
      collectingHighlights = false;
      continue;
    }

    const specialtyMatch = line.match(FIELD_SPECIALTY);
    if (specialtyMatch) {
      current.specialty = splitCommaList(specialtyMatch[1]);
      collectingHighlights = false;
      continue;
    }

    const foodsMatch = line.match(FIELD_FOODS);
    if (foodsMatch) {
      current.foods = splitCommaList(foodsMatch[1]);
      collectingHighlights = false;
      continue;
    }

    if (collectingHighlights) {
      const bulletMatch = line.match(BULLET);
      if (bulletMatch) {
        current.highlights.push(bulletMatch[1].trim());
        continue;
      }
      collectingHighlights = false;
    }
  }

  flush();
  return spots;
}

export function parseMarkdownFile(filePath: string): Spot[] {
  const source = fs.readFileSync(filePath, "utf-8");
  return parseMarkdown(source);
}

if (require.main === module) {
  const sourcePath = path.join(process.cwd(), "data/source/tour-100-2025-2026.md");
  const outPath = path.join(process.cwd(), "lib/data/spots.json");
  const spots = parseMarkdownFile(sourcePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(spots, null, 2), "utf-8");
  console.log(`Parsed ${spots.length} spots -> ${outPath}`);
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- parse-md`
Expected: 8 passed

- [ ] **Step 7: 실제 원본 파일로 spots.json 생성**

```bash
npx tsx lib/scripts/parse-md.ts
```

Expected 출력: `Parsed 100 spots -> .../lib/data/spots.json`

- [ ] **Step 8: 생성 결과 데이터 무결성 테스트**

`lib/data/spots.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import spots from "./spots.json";
import type { Spot } from "../types";

describe("spots.json", () => {
  const typed = spots as Spot[];

  it("정확히 100건이다", () => {
    expect(typed).toHaveLength(100);
  });

  it("모든 항목이 필수 필드를 가진다", () => {
    for (const spot of typed) {
      expect(spot.id).toBeTruthy();
      expect(spot.name).toBeTruthy();
      expect(typeof spot.lat).toBe("number");
      expect(typeof spot.lng).toBe("number");
      expect(spot.highlights.length).toBeGreaterThan(0);
      expect(spot.foods.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("id가 중복되지 않는다", () => {
    const ids = typed.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

Run: `npm test -- spots`
Expected: 3 passed. 실패 시(예: id 중복, foods 2개 미만) 해당 원본 항목을 확인하고
`parse-md.ts`의 규칙을 보정한 뒤 Step 7부터 다시 실행한다.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: 관광지 마크다운 파서 및 spots.json 데이터 생성"
```

---

### Task 3: 필터링 순수 함수 (`lib/filter.ts`)

**Files:**
- Create: `lib/filter.ts`
- Create: `lib/filter.test.ts`

**Interfaces:**
- Consumes: `Spot`, `Region`, `Season`, `Theme` (`lib/types.ts`)
- Produces: `filterSpots(spots: Spot[], criteria: FilterCriteria): Spot[]`,
  `suggestRelaxedFilters(spots: Spot[], criteria: FilterCriteria): RelaxationSuggestion[]`,
  `FilterCriteria`, `RelaxationSuggestion` 타입. Task 5(메인 페이지)에서 그대로 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/filter.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { filterSpots, suggestRelaxedFilters } from "./filter";
import type { Spot } from "./types";

const SPOTS: Spot[] = [
  {
    id: "a", name: "A", region: "경상권", lat: 0, lng: 0, summary: "", highlights: ["x"],
    seasons: ["가을"], specialty: [], foods: ["f1", "f2"], themes: ["자연경관"],
  },
  {
    id: "b", name: "B", region: "경상권", lat: 0, lng: 0, summary: "", highlights: ["x"],
    seasons: ["봄"], specialty: [], foods: ["f1", "f2"], themes: ["역사유적"],
  },
  {
    id: "c", name: "C", region: "제주권", lat: 0, lng: 0, summary: "", highlights: ["x"],
    seasons: ["가을"], specialty: [], foods: ["f1", "f2"], themes: ["자연경관"],
  },
];

describe("filterSpots", () => {
  it("조건이 없으면 전체를 반환한다", () => {
    expect(filterSpots(SPOTS, {})).toHaveLength(3);
  });

  it("region 조건으로 필터링한다", () => {
    const result = filterSpots(SPOTS, { regions: ["경상권"] });
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("region과 season은 AND로 결합된다", () => {
    const result = filterSpots(SPOTS, { regions: ["경상권"], seasons: ["가을"] });
    expect(result.map((s) => s.id)).toEqual(["a"]);
  });

  it("region, season, theme 세 조건 모두 AND로 결합된다", () => {
    const result = filterSpots(SPOTS, {
      regions: ["경상권"],
      seasons: ["가을"],
      themes: ["역사유적"],
    });
    expect(result).toHaveLength(0);
  });
});

describe("suggestRelaxedFilters", () => {
  it("결과가 0건일 때 완화 가능한 조건과 예상 건수를 제안한다", () => {
    const criteria = { regions: ["경상권"] as const, seasons: ["가을"] as const, themes: ["역사유적"] as const };
    const suggestions = suggestRelaxedFilters(SPOTS, criteria);
    expect(suggestions.find((s) => s.relaxed === "themes")?.count).toBe(1);
  });

  it("완화해도 0건이면 제안 목록에서 제외한다", () => {
    const criteria = { regions: ["제주권"] as const, themes: ["역사유적"] as const };
    const suggestions = suggestRelaxedFilters(SPOTS, criteria);
    expect(suggestions.every((s) => s.count > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- filter`
Expected: FAIL (`filter.ts` 없음)

- [ ] **Step 3: 구현**

`lib/filter.ts`:
```typescript
import type { Spot, Region, Season, Theme } from "./types";

export interface FilterCriteria {
  regions?: Region[];
  seasons?: Season[];
  themes?: Theme[];
}

export function filterSpots(spots: Spot[], criteria: FilterCriteria): Spot[] {
  return spots.filter((spot) => {
    if (criteria.regions?.length && !criteria.regions.includes(spot.region)) return false;
    if (criteria.seasons?.length && !spot.seasons.some((s) => criteria.seasons!.includes(s))) {
      return false;
    }
    if (criteria.themes?.length && !spot.themes.some((t) => criteria.themes!.includes(t))) {
      return false;
    }
    return true;
  });
}

export interface RelaxationSuggestion {
  relaxed: "regions" | "seasons" | "themes";
  count: number;
}

export function suggestRelaxedFilters(
  spots: Spot[],
  criteria: FilterCriteria,
): RelaxationSuggestion[] {
  const keys: RelaxationSuggestion["relaxed"][] = ["regions", "seasons", "themes"];
  const suggestions: RelaxationSuggestion[] = [];

  for (const key of keys) {
    if (!criteria[key]?.length) continue;
    const relaxed: FilterCriteria = { ...criteria, [key]: undefined };
    const count = filterSpots(spots, relaxed).length;
    if (count > 0) suggestions.push({ relaxed: key, count });
  }

  return suggestions.sort((a, b) => a.count - b.count);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- filter`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 지역/계절/테마 필터링 순수 함수 추가"
```

---

### Task 4: 카카오맵 스크립트 URL 빌더 + 지도 컴포넌트

**Files:**
- Create: `lib/kakao.ts`
- Create: `lib/kakao.test.ts`
- Create: `components/map/KakaoMap.tsx`
- Create: `components/map/KakaoMap.test.tsx`

**Interfaces:**
- Consumes: `Spot` (`lib/types.ts`)
- Produces: `buildKakaoScriptSrc(apiKey: string): string`,
  `<KakaoMap spots={Spot[]} selectedId?={string} onMarkerClick?={(id: string) => void} />`.
  Task 6(메인 페이지)에서 그대로 사용.

- [ ] **Step 1: 스크립트 URL 빌더 테스트**

`lib/kakao.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildKakaoScriptSrc } from "./kakao";

describe("buildKakaoScriptSrc", () => {
  it("appkey 쿼리 파라미터를 포함한 SDK URL을 만든다", () => {
    expect(buildKakaoScriptSrc("abc123")).toBe(
      "https://dapi.kakao.com/v2/maps/sdk.js?appkey=abc123&autoload=false",
    );
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- kakao`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/kakao.ts`:
```typescript
export function buildKakaoScriptSrc(apiKey: string): string {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- kakao`
Expected: 1 passed

- [ ] **Step 5: KakaoMap 컴포넌트 테스트 (window.kakao 없이 렌더만 검증)**

`components/map/KakaoMap.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { KakaoMap } from "./KakaoMap";

describe("KakaoMap", () => {
  it("window.kakao가 없어도 컨테이너를 렌더링한다 (SSR/로딩 전 안전성)", () => {
    const { container } = render(<KakaoMap spots={[]} />);
    expect(container.querySelector("div")).toBeTruthy();
  });
});
```

- [ ] **Step 6: 테스트 실행하여 실패 확인**

Run: `npm test -- KakaoMap`
Expected: FAIL (`KakaoMap.tsx` 없음)

- [ ] **Step 7: 구현**

`components/map/KakaoMap.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import type { Spot } from "@/lib/types";
import { buildKakaoScriptSrc } from "@/lib/kakao";

declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoMapProps {
  spots: Spot[];
  selectedId?: string;
  onMarkerClick?: (id: string) => void;
}

export function KakaoMap({ spots, selectedId, onMarkerClick }: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  const renderMarkers = () => {
    if (!mapRef.current || !window.kakao) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    spots.forEach((spot) => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(spot.lat, spot.lng),
        map: mapRef.current,
      });
      window.kakao.maps.event.addListener(marker, "click", () => {
        onMarkerClick?.(spot.id);
      });
      markersRef.current.set(spot.id, marker);
    });
  };

  const initMap = () => {
    if (!containerRef.current || !window.kakao) return;
    window.kakao.maps.load(() => {
      const map = new window.kakao.maps.Map(containerRef.current, {
        center: new window.kakao.maps.LatLng(36.5, 127.8),
        level: 13,
      });
      mapRef.current = map;
      renderMarkers();
    });
  };

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  useEffect(() => {
    if (!selectedId || !mapRef.current || !window.kakao) return;
    const spot = spots.find((s) => s.id === selectedId);
    if (spot) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(spot.lat, spot.lng));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";

  return (
    <>
      <Script src={buildKakaoScriptSrc(apiKey)} strategy="afterInteractive" onLoad={initMap} />
      <div ref={containerRef} className="h-full min-h-[400px] w-full" />
    </>
  );
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test -- KakaoMap`
Expected: 1 passed

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: 카카오맵 스크립트 로더 및 KakaoMap 컴포넌트 추가"
```

---

### Task 5: 필터 바 + 관광지 카드 + 메인 페이지 조합

> **선행 조건**: "사람이 먼저 처리해야 하는 사전 준비물" 섹션의 카카오 API 키가 `.env.local`에
> 설정되어 있어야 지도가 실제로 렌더링된다. 키가 없어도 코드 작성과 테스트는 진행 가능하다.

**Files:**
- Create: `components/filter/FilterBar.tsx`
- Create: `components/filter/FilterBar.test.tsx`
- Create: `components/spot/SpotCard.tsx`
- Create: `components/spot/SpotCard.test.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `filterSpots`, `suggestRelaxedFilters`, `FilterCriteria` (`lib/filter.ts`);
  `Spot`, `Region`, `Season`, `Theme` (`lib/types.ts`); `KakaoMap` (`components/map/KakaoMap.tsx`);
  `spots.json` (`lib/data/spots.json`)
- Produces: `<FilterBar criteria={FilterCriteria} onChange={(c: FilterCriteria) => void} />`,
  `<SpotCard spot={Spot} selected={boolean} onSelect={(id: string) => void} />`

- [ ] **Step 1: FilterBar 실패하는 테스트 작성**

`components/filter/FilterBar.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  it("6개 권역 체크박스를 렌더링한다", () => {
    render(<FilterBar criteria={{}} onChange={() => {}} />);
    expect(screen.getByLabelText("수도권")).toBeTruthy();
    expect(screen.getByLabelText("제주권")).toBeTruthy();
  });

  it("권역을 선택하면 onChange가 갱신된 조건으로 호출된다", () => {
    const onChange = vi.fn();
    render(<FilterBar criteria={{}} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("경상권"));
    expect(onChange).toHaveBeenCalledWith({ regions: ["경상권"] });
  });

  it("이미 선택된 권역을 다시 클릭하면 선택이 해제된다", () => {
    const onChange = vi.fn();
    render(<FilterBar criteria={{ regions: ["경상권"] }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("경상권"));
    expect(onChange).toHaveBeenCalledWith({ regions: [] });
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- FilterBar`
Expected: FAIL

- [ ] **Step 3: FilterBar 구현**

`components/filter/FilterBar.tsx`:
```tsx
"use client";

import type { FilterCriteria } from "@/lib/filter";
import type { Region, Season, Theme } from "@/lib/types";

const REGIONS: Region[] = ["수도권", "강원권", "충청권", "전라권", "경상권", "제주권"];
const SEASONS: Season[] = ["봄", "여름", "가을", "겨울", "사계절"];
const THEMES: Theme[] = [
  "역사유적", "자연경관", "테마파크", "해변", "야경", "체험마을", "정원", "섬",
];

interface FilterBarProps {
  criteria: FilterCriteria;
  onChange: (criteria: FilterCriteria) => void;
}

function toggle<T>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function FilterBar({ criteria, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4">
      <FilterGroup
        label="권역"
        options={REGIONS}
        selected={criteria.regions ?? []}
        onToggle={(v) => onChange({ ...criteria, regions: toggle(criteria.regions, v) })}
      />
      <FilterGroup
        label="계절"
        options={SEASONS}
        selected={criteria.seasons ?? []}
        onToggle={(v) => onChange({ ...criteria, seasons: toggle(criteria.seasons, v) })}
      />
      <FilterGroup
        label="테마"
        options={THEMES}
        selected={criteria.themes ?? []}
        onToggle={(v) => onChange({ ...criteria, themes: toggle(criteria.themes, v) })}
      />
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 text-sm font-medium text-neutral-500">{label}</span>
      {options.map((option) => (
        <label
          key={option}
          className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
            selected.includes(option)
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-300 text-neutral-700"
          }`}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
            aria-label={option}
          />
          {option}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: FilterBar 테스트 통과 확인**

Run: `npm test -- FilterBar`
Expected: 3 passed

- [ ] **Step 5: SpotCard 실패하는 테스트 작성**

`components/spot/SpotCard.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpotCard } from "./SpotCard";
import type { Spot } from "@/lib/types";

const SPOT: Spot = {
  id: "gyeongbokgung", name: "경복궁", region: "수도권", lat: 37.5796, lng: 126.977,
  summary: "조선 왕조의 법궁", highlights: ["근정전"], seasons: ["봄", "가을"],
  specialty: ["경기미"], foods: ["설렁탕", "왕갈비"], themes: ["역사유적"],
};

describe("SpotCard", () => {
  it("이름과 대표 음식을 표시한다", () => {
    render(<SpotCard spot={SPOT} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("경복궁")).toBeTruthy();
    expect(screen.getByText("설렁탕")).toBeTruthy();
  });

  it("클릭하면 onSelect가 spot id와 함께 호출된다", () => {
    const onSelect = vi.fn();
    render(<SpotCard spot={SPOT} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("gyeongbokgung");
  });
});
```

- [ ] **Step 6: 테스트 실행하여 실패 확인**

Run: `npm test -- SpotCard`
Expected: FAIL

- [ ] **Step 7: SpotCard 구현**

`components/spot/SpotCard.tsx`:
```tsx
"use client";

import type { Spot } from "@/lib/types";

interface SpotCardProps {
  spot: Spot;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function SpotCard({ spot, selected, onSelect }: SpotCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(spot.id)}
      className={`w-full rounded-lg border p-3 text-left transition ${
        selected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
      }`}
    >
      <h3 className="font-semibold">{spot.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{spot.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {spot.seasons.map((season) => (
          <span key={season} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            {season}
          </span>
        ))}
        {spot.foods.map((food) => (
          <span key={food} className="rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
            {food}
          </span>
        ))}
      </div>
    </button>
  );
}
```

- [ ] **Step 8: SpotCard 테스트 통과 확인**

Run: `npm test -- SpotCard`
Expected: 2 passed

- [ ] **Step 9: 메인 페이지 조합**

`app/page.tsx`:
```tsx
"use client";

import { useMemo, useState } from "react";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { filterSpots, suggestRelaxedFilters, type FilterCriteria } from "@/lib/filter";
import { FilterBar } from "@/components/filter/FilterBar";
import { SpotCard } from "@/components/spot/SpotCard";
import { KakaoMap } from "@/components/map/KakaoMap";

const SPOTS = spotsData as Spot[];

const RELAX_LABEL: Record<"regions" | "seasons" | "themes", string> = {
  regions: "권역",
  seasons: "계절",
  themes: "테마",
};

export default function HomePage() {
  const [criteria, setCriteria] = useState<FilterCriteria>({});
  const [selectedId, setSelectedId] = useState<string>();

  const results = useMemo(() => filterSpots(SPOTS, criteria), [criteria]);
  const suggestions = useMemo(
    () => (results.length === 0 ? suggestRelaxedFilters(SPOTS, criteria) : []),
    [results, criteria],
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">여행세상</h1>
      <FilterBar criteria={criteria} onChange={setCriteria} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
              조건에 맞는 곳이 없어요.
              {suggestions.map((s) => (
                <div key={s.relaxed}>
                  {RELAX_LABEL[s.relaxed]} 조건을 빼면 {s.count}곳 있어요.
                </div>
              ))}
            </div>
          ) : (
            results.map((spot) => (
              <SpotCard
                key={spot.id}
                spot={spot}
                selected={spot.id === selectedId}
                onSelect={setSelectedId}
              />
            ))
          )}
        </div>
        <div className="h-[500px]">
          <KakaoMap spots={results} selectedId={selectedId} onMarkerClick={setSelectedId} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 모든 테스트 passed (Task 1~5 누적)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: 필터 바, 관광지 카드, 지도를 연결한 메인 페이지 구현"
```

---

### Task 6: 관광지 상세 페이지

**Files:**
- Create: `app/spots/[slug]/page.tsx`
- Create: `app/spots/[slug]/page.test.tsx`
- Create: `lib/related.ts`
- Create: `lib/related.test.ts`

**Interfaces:**
- Consumes: `Spot` (`lib/types.ts`), `spots.json` (`lib/data/spots.json`), `KakaoMap`
  (`components/map/KakaoMap.tsx`)
- Produces: `getRelatedSpots(spots: Spot[], current: Spot, count: number): Spot[]`

- [ ] **Step 1: related.ts 실패하는 테스트 작성**

`lib/related.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getRelatedSpots } from "./related";
import type { Spot } from "./types";

const base: Omit<Spot, "id" | "name" | "region"> = {
  lat: 0, lng: 0, summary: "", highlights: ["x"], seasons: ["봄"], specialty: [],
  foods: ["f1", "f2"], themes: [],
};

const SPOTS: Spot[] = [
  { ...base, id: "a", name: "A", region: "경상권" },
  { ...base, id: "b", name: "B", region: "경상권" },
  { ...base, id: "c", name: "C", region: "경상권" },
  { ...base, id: "d", name: "D", region: "경상권" },
  { ...base, id: "e", name: "E", region: "제주권" },
];

describe("getRelatedSpots", () => {
  it("같은 권역에서 자기 자신을 제외하고 최대 count개를 반환한다", () => {
    const related = getRelatedSpots(SPOTS, SPOTS[0], 3);
    expect(related).toHaveLength(3);
    expect(related.every((s) => s.region === "경상권")).toBe(true);
    expect(related.find((s) => s.id === "a")).toBeUndefined();
  });

  it("같은 권역 후보가 count보다 적으면 있는 만큼만 반환한다", () => {
    const related = getRelatedSpots(SPOTS, SPOTS[4], 3);
    expect(related).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- related`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/related.ts`:
```typescript
import type { Spot } from "./types";

export function getRelatedSpots(spots: Spot[], current: Spot, count: number): Spot[] {
  return spots.filter((s) => s.region === current.region && s.id !== current.id).slice(0, count);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- related`
Expected: 2 passed

- [ ] **Step 5: 상세 페이지 구현**

`app/spots/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { getRelatedSpots } from "@/lib/related";
import { KakaoMap } from "@/components/map/KakaoMap";
import Link from "next/link";

const SPOTS = spotsData as Spot[];

export function generateStaticParams() {
  return SPOTS.map((spot) => ({ slug: spot.id }));
}

export default function SpotDetailPage({ params }: { params: { slug: string } }) {
  const spot = SPOTS.find((s) => s.id === params.slug);
  if (!spot) notFound();

  const related = getRelatedSpots(SPOTS, spot, 3);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/" className="text-sm text-neutral-500">
        ← 목록으로
      </Link>
      <h1 className="text-2xl font-bold">{spot.name}</h1>
      <p className="text-neutral-700">{spot.summary}</p>

      <section>
        <h2 className="font-semibold">꼭 볼 것</h2>
        <ul className="list-inside list-disc text-sm text-neutral-700">
          {spot.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="font-semibold">추천 계절: </span>
          {spot.seasons.join(", ")}
          {spot.seasonNote ? ` (${spot.seasonNote})` : ""}
        </div>
        <div>
          <span className="font-semibold">특산물: </span>
          {spot.specialty.join(", ")}
        </div>
        <div>
          <span className="font-semibold">대표 음식: </span>
          {spot.foods.join(", ")}
        </div>
      </section>

      <div className="h-[300px]">
        <KakaoMap spots={[spot]} />
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="font-semibold">같은 권역 다른 추천</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/spots/${r.id}`} className="text-blue-600 hover:underline">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 6: 빌드로 정적 라우트 생성 확인**

Run: `npm run build`
Expected: 빌드 성공, `/spots/[slug]`가 100개 정적 페이지로 생성되었다는 로그 출력 (예:
`● /spots/[slug]` 아래 100개 경로 목록 또는 "100 paths" 요약)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 관광지 상세 페이지 및 같은 권역 추천 로직 추가"
```

---

### Task 7: 모바일 지도/리스트 탭 전환

**Files:**
- Create: `components/layout/ViewToggle.tsx`
- Create: `components/layout/ViewToggle.test.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `<ViewToggle value={"list" | "map"} onChange={(v: "list" | "map") => void} />`

- [ ] **Step 1: 실패하는 테스트 작성**

`components/layout/ViewToggle.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewToggle } from "./ViewToggle";

describe("ViewToggle", () => {
  it("현재 선택된 탭을 표시한다", () => {
    render(<ViewToggle value="list" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "리스트" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("지도 탭 클릭 시 onChange('map')이 호출된다", () => {
    const onChange = vi.fn();
    render(<ViewToggle value="list" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "지도" }));
    expect(onChange).toHaveBeenCalledWith("map");
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test -- ViewToggle`
Expected: FAIL

- [ ] **Step 3: 구현**

`components/layout/ViewToggle.tsx`:
```tsx
"use client";

interface ViewToggleProps {
  value: "list" | "map";
  onChange: (value: "list" | "map") => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-2 md:hidden">
      {(["list", "map"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
          className={`rounded-full px-3 py-1 text-sm ${
            value === tab ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
          }`}
        >
          {tab === "list" ? "리스트" : "지도"}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- ViewToggle`
Expected: 2 passed

- [ ] **Step 5: `app/page.tsx`에 통합**

`app/page.tsx`의 `results.length === 0 ? ... : ...` 블록을 감싸는 grid 컨테이너를 아래처럼
모바일에서는 탭으로 하나만 보이도록 수정한다 (변경 부분만 표시):

```tsx
// import 추가
import { ViewToggle } from "@/components/layout/ViewToggle";

// HomePage 컴포넌트 내부, useState 옆에 추가
const [mobileView, setMobileView] = useState<"list" | "map">("list");

// return문의 <FilterBar .../> 바로 아래에 추가
<ViewToggle value={mobileView} onChange={setMobileView} />

// 기존 grid div를 아래로 교체
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div className={`flex flex-col gap-2 ${mobileView === "map" ? "hidden md:flex" : ""}`}>
    {/* 기존 리스트 렌더링 내용 그대로 */}
  </div>
  <div className={`h-[500px] ${mobileView === "list" ? "hidden md:block" : ""}`}>
    {/* 기존 KakaoMap 그대로 */}
  </div>
</div>
```

- [ ] **Step 6: 브라우저에서 모바일 뷰 수동 확인**

Run: `npm run dev`, 브라우저에서 뷰포트를 375px로 좁혀 리스트/지도 탭 전환이 동작하는지,
768px 이상에서는 탭이 사라지고 2컬럼으로 보이는지 확인한다.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 모바일 리스트/지도 탭 전환 UI 추가"
```

---

### Task 8: 배포 준비 및 브라우저 통합 확인

**Files:**
- Modify: `README.md`

**Interfaces:** 없음 (설정/검증 전용 태스크)

- [ ] **Step 1: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [ ] **Step 2: README에 Vercel 배포 안내 추가**

`README.md`에 아래 섹션 추가:
```markdown
## 배포 (Vercel)

1. https://vercel.com 에서 이 저장소를 New Project로 가져온다.
2. 프로젝트 환경변수에 `NEXT_PUBLIC_KAKAO_MAP_KEY`를 추가한다.
3. 카카오 개발자 콘솔의 Web 플랫폼 목록에 Vercel 배포 도메인(예: `https://<project>.vercel.app`)을 추가로 등록한다.
4. Deploy.
```

- [ ] **Step 3: 로컬 개발 서버로 전체 시나리오 수동 확인**

Run: `npm run dev`, 브라우저에서 아래를 순서대로 확인한다.
1. 메인 페이지 로드 시 100곳이 모두 리스트/지도에 표시되는지
2. "경상권" + "가을" 필터를 선택했을 때 리스트와 지도 마커가 함께 줄어드는지
3. 결과가 0건이 되는 조합(예: "제주권" + "겨울" + "테마파크")을 선택했을 때 완화 제안 문구가
   보이는지
4. 카드 클릭 시 지도가 해당 마커로 이동하는지 (카카오 키가 설정된 경우)
5. 카드에서 상세 페이지로 이동해 "같은 권역 다른 추천"이 보이는지, 목록으로 복귀가 되는지

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: Vercel 배포 안내 추가"
```

---

## Self-Review 결과

- **스펙 커버리지**: 스펙 5절(필터+지도, 상세페이지, 모바일 대응, 성능)은 Task 1~7이 모두
  구현. 스펙 4절(데이터 모델)은 Task 2. 스펙 8절(배포, SEO)은 Task 6 Step 6(SSG 확인)과
  Task 8. 스펙 2절에서 "제외"로 명시한 회원가입/코스생성/AI대화/외부데이터는 이 플랜에
  포함하지 않음(의도된 범위 밖).
- **플레이스홀더 스캔**: "TBD"/"적절히 처리" 류 문구 없음. 모든 단계에 실행 가능한 코드/명령을
  포함.
- **타입 일관성**: `Spot`(Task 2) → `FilterCriteria`(Task 3) → `FilterBar`/`SpotCard`/`KakaoMap`
  props(Task 4~5) → `getRelatedSpots`(Task 6)까지 필드명·타입이 동일하게 유지됨을 확인.
