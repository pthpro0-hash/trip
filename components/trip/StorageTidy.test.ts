// @vitest-environment node
import { describe, it, expect } from "vitest";
import { reshrunkMessage } from "./StorageTidy";

const MB = 1024 * 1024;
const outcome = (done: number, skipped: number, failed: number) => ({
  done,
  skipped,
  failed,
  bytesBefore: done * 4 * MB,
  bytesAfter: done * MB,
});

describe("reshrunkMessage", () => {
  it("줄인 것과 더 줄일 수 없어 둔 것을 함께 알린다", () => {
    expect(reshrunkMessage(outcome(10, 3, 0))).toBe(
      "사진 10장을 다시 줄였어요(40MB → 10MB). 3장은 더 줄일 수 없어 그대로 뒀어요.",
    );
  });

  it("더 줄일 것이 없었으면 그렇다고만", () => {
    expect(reshrunkMessage(outcome(0, 23, 0))).toBe("23장은 더 줄일 수 없어 그대로 뒀어요.");
  });

  it("못 한 것은 이어서 할 수 있다고", () => {
    expect(reshrunkMessage(outcome(0, 0, 2))).toContain("2장은 못 했어요");
  });

  it("아무것도 없으면", () => {
    expect(reshrunkMessage(outcome(0, 0, 0))).toBe("다시 줄인 사진이 없어요.");
  });
});
