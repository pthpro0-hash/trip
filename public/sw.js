/*
  서비스 워커 — 앱처럼 빨리 열리고, 인터넷이 끊겼을 때 빈 화면 대신 안내를 보여 준다.

  저장하는 것은 두 가지뿐이다.
    1. 바뀌지 않는 정적 파일(/_next/static/ — 이름에 해시가 붙어 내용이 바뀌면 이름도 바뀐다)
    2. 끊겼을 때 보여 줄 안내 화면(/offline.html)

  사람의 자료는 절대 저장하지 않는다. 기록·사진·로그인 응답을 저장해 두면 로그아웃한 뒤에도,
  같은 폰을 다른 사람이 써도 앞 사람의 것이 보일 수 있다. 페이지 이동은 늘 네트워크로 간다 —
  그래서 새로 배포하면 바로 새 화면이 뜨고, 저장해 둔 옛 화면을 보여 주는 일이 없다.

  고칠 때는 VERSION 을 올린다(옛 저장분을 지운다).
*/
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const SHELL = `shell-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/offline.html", "/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC && key !== SHELL).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 쓰기 요청과 다른 출처(Supabase·카카오·사진 주소)는 건드리지 않는다.
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  // 사람의 자료가 오가는 길은 절대 저장하지 않는다.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // 페이지 이동: 늘 네트워크로. 끊겼을 때만 안내 화면.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/offline.html")) ?? Response.error()),
    );
    return;
  }

  // 해시가 붙은 정적 파일: 저장해 둔 것이 있으면 그것을, 없으면 받아서 저장한다.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
