// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildSketch, type SketchTrip } from "./sketch";
import {
  distanceInWords,
  headline,
  koreanCount,
  paceInWords,
  photoPaceInWords,
  times,
} from "./sketchWords";

function trip(partial: Partial<SketchTrip> & { id: string }): SketchTrip {
  return { startedOn: "2026-09-13", endedOn: "2026-09-13", companions: null, visits: [], ...partial };
}

const 바다 = (name: string, lat: number) => ({
  placeName: name,
  spotId: null,
  lat,
  lng: 128.9,
  photoCount: 3,
});
const 산 = { placeName: "남산둘레길", spotId: null, lat: 37.5548, lng: 126.9797, photoCount: 2 };
const 제주 = { placeName: "성산일출봉", spotId: null, lat: 33.458, lng: 126.94, photoCount: 4 };

const 스케치 = (trips: SketchTrip[]) => buildSketch(trips);

describe("koreanCount · times", () => {
  it("스무까지는 우리말로", () => {
    expect(koreanCount(1)).toBe("한");
    expect(koreanCount(13)).toBe("열세");
    expect(koreanCount(20)).toBe("스무");
  });

  it("그보다 크면 숫자가 오히려 읽기 쉽다", () => {
    expect(koreanCount(23)).toBe("23");
  });

  it("우리말 수에는 띄어쓰기가 붙고 아라비아 숫자에는 붙지 않는다", () => {
    // `${koreanCount(n)} 번` 으로 이으면 "13 번"이 되어 어색했다.
    expect(times(3)).toBe("세 번");
    expect(times(13)).toBe("열세 번");
    expect(times(23)).toBe("23번");
  });
});

describe("distanceInWords", () => {
  it("379km 는 서울–부산 한 번", () => {
    expect(distanceInWords(379)).toBe("서울에서 부산까지를 한 번 오갈 거리");
  });

  it("200km 는 부산까지는 못 미치니 강릉 자로 잰다", () => {
    expect(distanceInWords(200)).toBe("서울에서 강릉까지를 한 번 오갈 거리");
  });

  it("긴 거리는 여러 번으로", () => {
    expect(distanceInWords(1000)).toBe("서울에서 부산까지를 세 번 오갈 거리");
  });

  it("견줄 만큼 아니면 말하지 않는다", () => {
    // 틀린 말을 하느니 비워 둔다.
    expect(distanceInWords(40)).toBeNull();
    expect(distanceInWords(0)).toBeNull();
  });
});

describe("paceInWords", () => {
  it("한 해에 열세 번이면 한 달에 한 번꼴", () => {
    expect(paceInWords(13, 365)).toBe("한 달에 한 번꼴로");
  });

  it("자주 다니면 그렇게 말한다", () => {
    expect(paceInWords(30, 300)).toBe("열흘에 한 번꼴로");
  });

  it("두어 번 다닌 것으로는 빈도를 말할 수 없다", () => {
    expect(paceInWords(2, 365)).toBeNull();
  });

  it("기간이 짧아도 말하지 않는다", () => {
    expect(paceInWords(5, 10)).toBeNull();
  });
});

describe("photoPaceInWords", () => {
  it("184장을 13번에 나누면 한 번에 14장", () => {
    expect(photoPaceInWords(184, 13)).toBe("한 번에 14장씩");
  });

  it("사진이 없으면 말하지 않는다", () => {
    expect(photoPaceInWords(0, 5)).toBeNull();
  });
});

describe("headline", () => {
  it("한 사람과 절반 넘게 다녔으면 그 사람이 그해다", () => {
    const s = 스케치([
      trip({ id: "1", companions: "민수", visits: [산] }),
      trip({ id: "2", companions: "민수", visits: [산] }),
      trip({ id: "3", companions: "가족", visits: [산] }),
    ]);
    expect(headline(s)).toBe("민수와 두 번");
  });

  it("바다가 절반을 넘으면 바다의 해", () => {
    const s = 스케치([
      trip({ id: "1", visits: [바다("화진포해변", 38.4)] }),
      trip({ id: "2", visits: [바다("안목해변", 37.7)] }),
      trip({ id: "3", visits: [산] }),
    ]);
    expect(headline(s)).toBe("바다만 두 번 다닌 해");
  });

  it("사람이 바다보다 앞선다 — 기억을 부르는 힘이 세다", () => {
    const s = 스케치([
      trip({ id: "1", companions: "민수", visits: [바다("화진포해변", 38.4)] }),
      trip({ id: "2", companions: "민수", visits: [바다("안목해변", 37.7)] }),
    ]);
    expect(headline(s)).toBe("민수와 두 번");
  });

  it("제주는 그 자체로 한 문장", () => {
    const s = 스케치([
      trip({ id: "1", visits: [제주] }),
      trip({ id: "2", visits: [산] }),
      trip({ id: "3", visits: [산] }),
    ]);
    expect(headline(s)).toBe("제주까지 다녀온 해");
  });

  it("한 계절에 몰렸으면 그 계절의 해", () => {
    const s = 스케치([
      trip({ id: "1", startedOn: "2026-09-13", endedOn: "2026-09-13", visits: [산] }),
      trip({ id: "2", startedOn: "2026-10-02", endedOn: "2026-10-02", visits: [산] }),
      trip({ id: "3", startedOn: "2026-11-11", endedOn: "2026-11-11", visits: [산] }),
    ]);
    expect(headline(s)).toBe("가을에만 다닌 해");
  });

  it("전체를 볼 때는 '…한 해'라고 하지 않는다 — 해가 여럿이다", () => {
    const s = 스케치([
      trip({ id: "1", startedOn: "2025-09-13", endedOn: "2025-09-13", visits: [산] }),
      trip({ id: "2", startedOn: "2026-10-02", endedOn: "2026-10-02", visits: [산] }),
      trip({ id: "3", startedOn: "2026-11-11", endedOn: "2026-11-11", visits: [산] }),
    ]);
    expect(headline(s, "year")).toBe("가을에만 다닌 해");
    expect(headline(s, "all")).toBe("세 번 길을 나섰어요");
  });

  it("두드러진 것이 없으면 센 것을 그대로 말한다", () => {
    const s = 스케치([
      trip({ id: "1", startedOn: "2026-03-01", endedOn: "2026-03-01", visits: [산] }),
      trip({ id: "2", startedOn: "2026-07-01", endedOn: "2026-07-01", visits: [산] }),
      trip({ id: "3", startedOn: "2026-11-01", endedOn: "2026-11-01", visits: [산] }),
      trip({ id: "4", startedOn: "2026-12-20", endedOn: "2026-12-20", visits: [산] }),
    ]);
    expect(headline(s)).toBe("네 번 길을 나선 해");
  });

  it("한 번뿐이어도 초라해 보이지 않게", () => {
    expect(headline(스케치([trip({ id: "1", visits: [산] })]))).toBe("한 번의 여행");
    expect(
      headline(스케치([trip({ id: "1", visits: [산, 바다("안목해변", 37.7)] })])),
    ).toBe("한 번의 긴 여행");
  });

  it("아무것도 없으면 아무 말도 하지 않는다", () => {
    expect(headline(스케치([]))).toBe("");
  });
});
