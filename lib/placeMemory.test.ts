// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NAME_REACH_KM, memoriesNear, rememberedName } from "./placeMemory";

const 안목 = { id: "a", lat: 37.7719, lng: 128.9476, name: "안목 커피거리" };
const 경포 = { id: "b", lat: 37.8055, lng: 128.9082, name: "경포 호수" };

describe("rememberedName", () => {
  it("같은 해변 안(수백 m)이면 고쳐 둔 이름", () => {
    // 안목해변 끝에서 끝까지 약 300m
    expect(rememberedName([안목, 경포], 37.7745, 128.9466)?.name).toBe("안목 커피거리");
  });

  it("옆 동네까지 번지지 않는다", () => {
    // 강릉항 — 안목에서 약 1km
    expect(rememberedName([안목], 37.7717, 128.9585)).toBeNull();
  });

  it("둘 다 가까우면 더 가까운 쪽", () => {
    const 옆 = { id: "c", lat: 37.7722, lng: 128.9486, name: "안목 방파제" };
    expect(rememberedName([안목, 옆], 37.7723, 128.9487)?.name).toBe("안목 방파제");
  });

  it("거리는 400m", () => {
    expect(NAME_REACH_KM).toBe(0.4);
  });
});

describe("memoriesNear", () => {
  it("다시 고치면 지울, 거리 안의 옛 기억만", () => {
    expect(memoriesNear([안목, 경포], 37.772, 128.9477).map((memory) => memory.id)).toEqual(["a"]);
  });
});
