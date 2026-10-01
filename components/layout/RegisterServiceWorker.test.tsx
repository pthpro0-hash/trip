import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

const register = vi.fn(async () => ({}));
beforeEach(() => {
  register.mockClear();
  Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("RegisterServiceWorker", () => {
  it("실서비스에서는 /sw.js 를 등록한다 — 판이 바뀌면 바로 확인하도록 캐시 없이", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { RegisterServiceWorker } = await import("./RegisterServiceWorker");
    render(<RegisterServiceWorker />);
    await vi.waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" }));
  });

  it("개발 중에는 등록하지 않는다 — 고칠 때마다 옛 파일이 남아 헷갈린다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { RegisterServiceWorker } = await import("./RegisterServiceWorker");
    render(<RegisterServiceWorker />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(register).not.toHaveBeenCalled();
  });
});
