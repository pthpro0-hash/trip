import { afterEach, describe, expect, it, vi } from "vitest";

// The loader caches its promise at module scope, so each case needs a fresh
// copy of the module to start from "nothing loaded yet".
async function freshLoader() {
  vi.resetModules();
  return (await import("./kakaoLoader")).loadKakaoMaps;
}

function stubSdkOnLoad() {
  // Mimics the real SDK: the script defines window.kakao, and the map classes
  // only exist after kakao.maps.load()'s callback runs (autoload=false).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub mirrors the untyped Kakao SDK
  (window as any).kakao = {
    maps: {
      load: (cb: () => void) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub mirrors the untyped Kakao SDK
        (window as any).kakao.maps.LatLng = function LatLng() {};
        cb();
      },
    },
  };
}

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub mirrors the untyped Kakao SDK
  delete (window as any).kakao;
  document.head.querySelectorAll("script").forEach((script) => script.remove());
});

describe("loadKakaoMaps", () => {
  it("SDK가 이미 로드돼 있으면 스크립트를 추가하지 않는다", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub mirrors the untyped Kakao SDK
    (window as any).kakao = { maps: { LatLng: function LatLng() {}, load: () => {} } };
    const load = await freshLoader();

    await load("already-loaded-key");

    expect(document.head.querySelectorAll("script")).toHaveLength(0);
  });

  it("여러 번 호출해도 스크립트를 한 번만 주입한다 (지도 여러 개를 한 페이지에 둘 때)", async () => {
    const load = await freshLoader();

    const first = load("multi-map-key");
    const second = load("multi-map-key");

    const scripts = document.head.querySelectorAll("script");
    expect(scripts).toHaveLength(1);

    stubSdkOnLoad();
    scripts[0].dispatchEvent(new Event("load"));

    await expect(Promise.all([first, second])).resolves.toBeTruthy();
  });

  it("로드에 실패하면 reject하고, 다음 호출에서 다시 시도한다", async () => {
    const load = await freshLoader();

    const failing = load("retry-key");
    document.head.querySelectorAll("script")[0].dispatchEvent(new Event("error"));
    await expect(failing).rejects.toThrow();

    load("retry-key");
    expect(document.head.querySelectorAll("script")).toHaveLength(2);
  });
});
