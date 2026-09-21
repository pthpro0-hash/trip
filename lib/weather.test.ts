// @vitest-environment node
import { describe, it, expect } from "vitest";
import { latLngToGrid, isInKorea } from "./weatherGrid";
import {
  kstToday,
  latestBase,
  secondsUntilNextPublish,
  summarizeForecast,
  type ForecastItem,
} from "./weather";

describe("latLngToGrid", () => {
  it("기상청 문서의 예시(서울시청)와 같은 격자를 낸다", () => {
    expect(latLngToGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 });
  });

  it("주요 도시 격자가 공표값과 일치한다", () => {
    expect(latLngToGrid(35.1796, 129.0756)).toEqual({ nx: 98, ny: 76 }); // 부산
    expect(latLngToGrid(33.4996, 126.5312)).toEqual({ nx: 53, ny: 38 }); // 제주
    expect(latLngToGrid(36.3504, 127.3845)).toEqual({ nx: 67, ny: 100 }); // 대전
    expect(latLngToGrid(37.4563, 126.7052)).toEqual({ nx: 55, ny: 124 }); // 인천
  });

  it("남쪽으로 갈수록 ny가 작아지고, 동쪽으로 갈수록 nx가 커진다", () => {
    const seoul = latLngToGrid(37.5665, 126.978);
    const jeju = latLngToGrid(33.4996, 126.5312);
    const gangneung = latLngToGrid(37.7519, 128.8761);
    expect(jeju.ny).toBeLessThan(seoul.ny);
    expect(gangneung.nx).toBeGreaterThan(seoul.nx);
  });
});

describe("isInKorea", () => {
  it("국내 좌표를 받아들인다", () => {
    expect(isInKorea(37.5665, 126.978)).toBe(true);
    expect(isInKorea(33.3617, 126.5292)).toBe(true);
  });

  it("국외와 잘못된 값은 거른다", () => {
    expect(isInKorea(35.6762, 139.6503)).toBe(false); // 도쿄
    expect(isInKorea(0, 0)).toBe(false);
    expect(isInKorea(Number.NaN, 126.978)).toBe(false);
  });
});

// 2026-09-21 14:30 KST = 05:30 UTC
const at = (iso: string) => new Date(iso);

describe("latestBase", () => {
  it("발표 45분이 지난 가장 최신 분을 고른다", () => {
    // 15:00 KST — 14시 발표가 올라온 뒤.
    expect(latestBase(at("2026-09-21T06:00:00Z"))).toEqual({
      baseDate: "20260921",
      baseTime: "1400",
    });
  });

  it("발표 직후 45분 안에는 이전 발표분을 쓴다", () => {
    // 14:30 KST — 14시 발표는 아직 올라오지 않았다.
    expect(latestBase(at("2026-09-21T05:30:00Z"))).toEqual({
      baseDate: "20260921",
      baseTime: "1100",
    });
  });

  it("자정 직후에는 전날 23시 발표를 쓴다", () => {
    // 00:30 KST = 전날 15:30 UTC
    expect(latestBase(at("2026-09-20T15:30:00Z"))).toEqual({
      baseDate: "20260920",
      baseTime: "2300",
    });
  });

  it("KST로 계산한다 — 서버가 UTC로 돌아도 날짜가 밀리지 않는다", () => {
    // 2026-09-21 08:00 KST = 2026-09-20 23:00 UTC
    expect(latestBase(at("2026-09-20T23:00:00Z")).baseDate).toBe("20260921");
  });
});

describe("kstToday", () => {
  it("UTC로는 전날이어도 KST 날짜를 낸다", () => {
    expect(kstToday(at("2026-09-20T23:00:00Z"))).toBe("20260921");
  });
});

describe("secondsUntilNextPublish", () => {
  it("다음 발표까지 남은 시간을 준다", () => {
    // 14:00 KST → 다음은 14:45
    expect(secondsUntilNextPublish(at("2026-09-21T05:00:00Z"))).toBe(45 * 60);
  });

  it("마지막 발표 뒤에는 다음날 첫 발표까지 센다", () => {
    // 23:50 KST → 다음날 02:45
    expect(secondsUntilNextPublish(at("2026-09-21T14:50:00Z"))).toBe((175 + 0) * 60);
  });

  it("언제 물어도 0보다 크고 하루보다 짧다", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const seconds = secondsUntilNextPublish(at(`2026-09-21T${String(hour).padStart(2, "0")}:00:00Z`));
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(24 * 3600);
    }
  });
});

function item(fcstDate: string, fcstTime: string, category: string, fcstValue: string): ForecastItem {
  return { fcstDate, fcstTime, category, fcstValue };
}

describe("summarizeForecast", () => {
  const now = at("2026-09-21T05:30:00Z"); // 09-21 14:30 KST

  it("하루치를 한 줄로 접는다", () => {
    const days = summarizeForecast(
      [
        item("20260921", "1400", "TMP", "27"),
        item("20260921", "0600", "TMN", "18"),
        item("20260921", "1500", "TMX", "29"),
        item("20260921", "1400", "SKY", "1"),
        item("20260921", "1400", "PTY", "0"),
        item("20260921", "1400", "POP", "20"),
        item("20260921", "1700", "POP", "40"),
      ],
      now,
    );

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "20260921",
      label: "오늘",
      minTemp: 18,
      maxTemp: 29,
      sky: "맑음",
      rainChance: 40, // 하루 중 가장 높은 값
    });
  });

  it("비가 오면 하늘 상태보다 강수 형태를 쓴다", () => {
    const days = summarizeForecast(
      [
        item("20260921", "1400", "SKY", "3"),
        item("20260921", "1400", "PTY", "1"),
        item("20260921", "1400", "POP", "80"),
      ],
      now,
    );
    expect(days[0].sky).toBe("비");
  });

  it("최저·최고가 따로 오지 않으면 시간대별 기온에서 끌어낸다", () => {
    const days = summarizeForecast(
      [
        item("20260921", "1500", "TMP", "29"),
        item("20260921", "1800", "TMP", "24"),
        item("20260921", "2100", "TMP", "21"),
      ],
      now,
    );
    expect(days[0].minTemp).toBe(21);
    expect(days[0].maxTemp).toBe(29);
  });

  it("오늘·내일·모레에 이름을 붙이고 날짜순으로 낸다", () => {
    const days = summarizeForecast(
      [
        item("20260923", "1400", "SKY", "4"),
        item("20260921", "1400", "SKY", "1"),
        item("20260922", "1400", "SKY", "3"),
      ],
      now,
    );
    expect(days.map((d) => d.label)).toEqual(["오늘", "내일", "모레"]);
    expect(days.map((d) => d.sky)).toEqual(["맑음", "구름많음", "흐림"]);
  });

  it("사흘 너머의 예보는 버린다", () => {
    const days = summarizeForecast(
      [item("20260921", "1400", "SKY", "1"), item("20260925", "1400", "SKY", "1")],
      now,
    );
    expect(days).toHaveLength(1);
  });

  it("한밤중이 아니라 낮 날씨로 하루를 대표한다", () => {
    const days = summarizeForecast(
      [
        item("20260922", "0300", "SKY", "4"),
        item("20260922", "1500", "SKY", "1"),
        item("20260922", "2300", "SKY", "4"),
      ],
      now,
    );
    expect(days[0].sky).toBe("맑음");
  });

  it("값이 없으면 빈 배열", () => {
    expect(summarizeForecast([], now)).toEqual([]);
  });

  it("알 수 없는 코드가 와도 무너지지 않는다", () => {
    const days = summarizeForecast(
      [item("20260921", "1400", "SKY", "9"), item("20260921", "1400", "POP", "10")],
      now,
    );
    expect(days[0].sky).toBe("정보 없음");
  });
});
