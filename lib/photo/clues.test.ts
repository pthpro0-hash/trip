// @vitest-environment node
import { describe, it, expect } from "vitest";
import { stayLabel, timeOfDayLabel, tripClues, weekdayLabel } from "./clues";

describe("weekdayLabel", () => {
  it("요일을 알려준다", () => {
    // 2026-09-13 은 일요일
    expect(weekdayLabel(new Date(2026, 8, 13))).toBe("일요일");
    expect(weekdayLabel(new Date(2026, 8, 14))).toBe("월요일");
  });
});

describe("timeOfDayLabel", () => {
  it("사람이 쓰는 말로 시간대를 가른다", () => {
    expect(timeOfDayLabel(new Date(2026, 8, 13, 3))).toBe("새벽");
    expect(timeOfDayLabel(new Date(2026, 8, 13, 6, 11))).toBe("이른 아침");
    expect(timeOfDayLabel(new Date(2026, 8, 13, 10))).toBe("오전");
    expect(timeOfDayLabel(new Date(2026, 8, 13, 13))).toBe("한낮");
    expect(timeOfDayLabel(new Date(2026, 8, 13, 16))).toBe("늦은 오후");
    expect(timeOfDayLabel(new Date(2026, 8, 13, 19, 12))).toBe("해질녘");
    expect(timeOfDayLabel(new Date(2026, 8, 13, 22))).toBe("밤");
  });
});

describe("stayLabel", () => {
  const at = (h: number, m: number) => new Date(2026, 8, 13, h, m);

  it("분으로 말한다", () => {
    expect(stayLabel(at(9, 0), at(9, 51))).toBe("51분 머물렀어요");
  });

  it("한 시간이 넘으면 시간과 분으로", () => {
    expect(stayLabel(at(9, 0), at(11, 30))).toBe("2시간 30분 머물렀어요");
    expect(stayLabel(at(9, 0), at(11, 0))).toBe("2시간 머물렀어요");
  });

  it("한 번 찍고 지나간 곳은 말하지 않는다", () => {
    // 2분이면 머물렀다고 할 것이 없다.
    expect(stayLabel(at(19, 12), at(19, 14))).toBeNull();
  });
});

describe("tripClues", () => {
  const start = new Date(2026, 8, 13, 9, 21);

  it("사진을 가장 많이 찍은 시간대를 찾는다", () => {
    const times = [
      new Date(2026, 8, 13, 19, 10),
      new Date(2026, 8, 13, 19, 30),
      new Date(2026, 8, 13, 10, 0),
    ];
    expect(tripClues(start, times, 2).busiestTime).toBe("해질녘");
  });

  it("사진이 한 장뿐이면 시간대를 말하지 않는다", () => {
    // 한 장으로 "그때 몰아 찍었다"고 할 수는 없다.
    expect(tripClues(start, [new Date(2026, 8, 13, 19, 10)], 1).busiestTime).toBeNull();
  });

  it("사진이 없어도 무너지지 않는다", () => {
    const clues = tripClues(start, [], 1);
    expect(clues.photoCount).toBe(0);
    expect(clues.busiestTime).toBeNull();
    expect(clues.weekday).toBe("일요일");
  });

  it("다녀온 곳 수를 그대로 전한다", () => {
    expect(tripClues(start, [], 3).placeCount).toBe(3);
  });
});
