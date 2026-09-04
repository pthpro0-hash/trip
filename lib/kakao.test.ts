import { describe, it, expect } from "vitest";
import { buildKakaoScriptSrc } from "./kakao";

describe("buildKakaoScriptSrc", () => {
  it("appkey 쿼리 파라미터를 포함한 SDK URL을 만든다", () => {
    expect(buildKakaoScriptSrc("abc123")).toBe(
      "https://dapi.kakao.com/v2/maps/sdk.js?appkey=abc123&autoload=false",
    );
  });
});
