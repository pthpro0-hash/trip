// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

/*
  사진에서 촬영 시각과 위치를 읽어 무엇이 무엇인지 가른다. 파일을 실제로 읽지 않고 읽어 낸 태그를 끼워 넣는다.
  메신저를 거치면 위치뿐 아니라 촬영 시각도 지워진다 — 그런 사진도 버리지 않고 '위치를 모르는 사진'으로 넘겨, 사람이 날짜와 장소를 정할 수 있게 한다.
*/
const tagsByName: Record<string, Record<string, unknown> | null | Error> = {};
vi.mock("exifr", () => ({
  default: {
    parse: async (file: File) => {
      const tags = tagsByName[file.name];
      if (tags instanceof Error) throw tags;
      return tags ?? null;
    },
  },
}));

const { readShots } = await import("./readShots");

const file = (name: string, type: string, lastModified = Date.UTC(2026, 8, 20, 3, 0, 0)) => new File(["x"], name, { type, lastModified });
const camera = { DateTimeOriginal: new Date("2026-09-13T09:21:00"), Model: "iPhone" };

describe("readShots", () => {
  it("시각과 위치가 있으면 여행으로 묶을 사진이다", async () => {
    tagsByName["a.jpg"] = { ...camera, latitude: 37.5, longitude: 127 };
    const result = await readShots([file("a.jpg", "image/jpeg")]);
    expect(result.shots.map((s) => [s.id, s.lat, s.lng])).toEqual([["a.jpg", 37.5, 127]]);
    expect(result.withoutLocation).toEqual([]);
  });

  it("시각은 있고 위치만 없으면 '위치를 모르는 사진'이고, 날짜는 어림한 것이 아니다", async () => {
    tagsByName["b.jpg"] = { ...camera };
    const result = await readShots([file("b.jpg", "image/jpeg")]);
    expect(result.shots).toEqual([]);
    expect(result.withoutLocation).toEqual([{ id: "b.jpg", takenAt: camera.DateTimeOriginal }]);
    expect(result.withoutLocation[0].guessed).toBeUndefined();
  });

  it("시각마저 없는 사진(메신저)은 파일 날짜로 어림해 '위치를 모르는 사진'으로 넘긴다", async () => {
    tagsByName["kakao.jpg"] = null;
    const result = await readShots([file("kakao.jpg", "image/jpeg", Date.UTC(2026, 8, 20, 3, 0, 0))]);
    expect(result.unreadable).toEqual([]);
    expect(result.withoutLocation).toHaveLength(1);
    expect(result.withoutLocation[0]).toMatchObject({ id: "kakao.jpg", guessed: true });
    expect(result.withoutLocation[0].takenAt.getTime()).toBe(Date.UTC(2026, 8, 20, 3, 0, 0));
  });

  it("읽다가 던져도(깨진 파일) 사진이면 같은 길로 간다 — 앱이 멈추지 않는다", async () => {
    tagsByName["broken.jpg"] = new Error("bad exif");
    const result = await readShots([file("broken.jpg", "image/jpeg")]);
    expect(result.withoutLocation.map((p) => p.id)).toEqual(["broken.jpg"]);
  });

  it("브라우저가 형식을 모르는 HEIC 도 이름으로 사진으로 본다", async () => {
    tagsByName["IMG.HEIC"] = null;
    const result = await readShots([file("IMG.HEIC", "")]);
    expect(result.withoutLocation.map((p) => p.id)).toEqual(["IMG.HEIC"]);
  });

  it("동영상은 사진이 아니라 읽지 못한 것이다", async () => {
    tagsByName["clip.mp4"] = null;
    const result = await readShots([file("clip.mp4", "video/mp4")]);
    expect(result.unreadable).toEqual(["clip.mp4"]);
    expect(result.withoutLocation).toEqual([]);
  });

  it("카메라 정보 없는 PNG 는 화면 캡처다 — 시각이 있든 없든 장소 사진이 아니다", async () => {
    tagsByName["cap.png"] = null;
    tagsByName["cap2.png"] = { DateTimeOriginal: new Date("2026-09-13T09:21:00") };
    const result = await readShots([file("cap.png", "image/png"), file("cap2.png", "image/png")]);
    expect(result.screenshots).toEqual(["cap.png", "cap2.png"]);
    expect(result.withoutLocation).toEqual([]);
  });

  it("파일 날짜도 없으면(0) 읽지 못한 것이다", async () => {
    tagsByName["nodate.jpg"] = null;
    const result = await readShots([file("nodate.jpg", "image/jpeg", 0)]);
    expect(result.unreadable).toEqual(["nodate.jpg"]);
  });
});
