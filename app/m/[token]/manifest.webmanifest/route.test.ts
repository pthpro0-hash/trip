// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GET } from "./route";

const TOKEN = "T".repeat(43);
const call = (token: string) => GET(new Request("https://x.test"), { params: Promise.resolve({ token }) });

describe("책장 홈 화면 아이콘 정보", () => {
  it("이 책장을 바로 여는 앱으로 설치된다", async () => {
    const response = await call(TOKEN);
    expect(response.headers.get("content-type")).toContain("application/manifest+json");
    const manifest = await response.json();
    expect(manifest.name).toBe("가족 책장");
    expect(manifest.start_url).toBe(`/m/${TOKEN}`);
    expect(manifest.scope).toBe(`/m/${TOKEN}`);
    expect(manifest.display).toBe("standalone");
  });

  it("아이콘 파일이 실제로 있다", async () => {
    const manifest = await (await call(TOKEN)).json();
    for (const icon of manifest.icons) expect(existsSync(join(process.cwd(), "public", icon.src)), icon.src).toBe(true);
  });

  it("링크 글자가 아니면 404", async () => {
    expect((await call("짧음")).status).toBe(404);
    expect((await call("../x")).status).toBe(404);
  });

  it("캐시하지 않는다 — 링크를 새로 만들면 옛 책장 아이콘이 되살아나지 않게", async () => {
    expect((await call(TOKEN)).headers.get("cache-control")).toBe("no-store");
  });
});
