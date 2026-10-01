// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/*
  sw.js 를 가짜 브라우저 환경(self·caches·fetch)에 올려 실제로 돌려 본다 — 어떤 요청을 저장하고
  어떤 요청을 건드리지 않는지.
*/
const source = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

function load(options: { online?: boolean } = {}) {
  const online = options.online ?? true;
  const stores = new Map<string, Map<string, Response>>();
  const listeners: Record<string, (event: unknown) => void> = {};
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (req: { url: string } | string) => store.get(typeof req === "string" ? req : req.url),
      put: async (req: { url: string }, res: Response) => void store.set(req.url, res),
      addAll: async (urls: string[]) => urls.forEach((u) => store.set(u, new Response("x"))),
    };
  };
  const caches = {
    open: async (name: string) => cache(name),
    match: async (req: { url: string } | string) => {
      for (const store of stores.values()) {
        const hit = store.get(typeof req === "string" ? req : req.url);
        if (hit) return hit;
      }
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const network = vi.fn(async (req: { url: string }) => {
    if (!online) throw new TypeError("offline");
    return new Response("net:" + req.url);
  });
  const self = {
    location: { origin: "https://app.test" },
    addEventListener: (name: string, fn: (event: unknown) => void) => (listeners[name] = fn),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  vm.runInNewContext(source, { self, caches, fetch: network, URL, Response });

  /** 요청 하나를 흘려 보내고, 서비스 워커가 직접 답했으면 그 답을(안 건드렸으면 undefined). */
  const request = async (path: string, init: { method?: string; mode?: string; origin?: string } = {}) => {
    const req = { url: (init.origin ?? "https://app.test") + path, method: init.method ?? "GET", mode: init.mode ?? "no-cors" };
    let answered: Promise<Response> | undefined;
    listeners.fetch({ request: req, respondWith: (p: Promise<Response>) => (answered = p) });
    return answered ? await answered : undefined;
  };
  return { stores, listeners, network, self, request };
}

const text = async (res: Response | undefined) => (res ? res.text() : undefined);

describe("sw.js 동작", () => {
  it("설치할 때 끊김 안내 화면을 저장해 두고 바로 이어받는다", async () => {
    const { listeners, stores, self } = load();
    let done: Promise<unknown> | undefined;
    listeners.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect([...stores.get("shell-v1")!.keys()]).toContain("/offline.html");
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it("옛 판의 저장분은 지우고, 지금 판 것은 둔다", async () => {
    const { listeners, stores } = load();
    stores.set("static-v0", new Map());
    stores.set("static-v1", new Map());
    let done: Promise<unknown> | undefined;
    listeners.activate({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect([...stores.keys()]).toEqual(["static-v1"]);
  });

  it("페이지 이동은 늘 네트워크 — 저장해 두지 않는다", async () => {
    const { request, stores } = load();
    expect(await text(await request("/?v=sketch", { mode: "navigate" }))).toBe("net:https://app.test/?v=sketch");
    expect(stores.size).toBe(0);
  });

  it("끊기면 페이지 이동 대신 안내 화면", async () => {
    const online = load();
    // 안내 화면은 설치 때 저장돼 있다.
    let done: Promise<unknown> | undefined;
    const offline = load({ online: false });
    offline.listeners.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(await text(await offline.request("/trips/abc", { mode: "navigate" }))).toBe("x");
    expect(online.network).not.toHaveBeenCalled();
  });

  it("해시 붙은 정적 파일은 한 번 받아 저장하고, 다음에는 저장분을 쓴다", async () => {
    const { request, network } = load();
    expect(await text(await request("/_next/static/chunks/a1b2.js"))).toBe("net:https://app.test/_next/static/chunks/a1b2.js");
    expect(network).toHaveBeenCalledTimes(1);
    expect(await text(await request("/_next/static/chunks/a1b2.js"))).toBe("net:https://app.test/_next/static/chunks/a1b2.js");
    expect(network).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["API", "/api/place?q=1", {}],
    ["로그인 길", "/auth/callback?code=x", {}],
    ["쓰기 요청", "/_next/static/a.js", { method: "POST" }],
    ["다른 출처(Supabase 등)", "/storage/v1/object/sign/x.webp", { origin: "https://abc.supabase.co" }],
    ["그 밖의 파일(데이터·이미지)", "/spots/경복궁.jpg", {}],
  ])("%s 은 건드리지 않는다 — 브라우저가 그대로 처리", async (_label, path, init) => {
    const { request, stores } = load();
    expect(await request(path, init)).toBeUndefined();
    expect(stores.size).toBe(0);
  });
});
