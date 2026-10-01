"use client";

import { useEffect } from "react";

/*
  서비스 워커(public/sw.js)를 등록한다. 앱처럼 빨리 열리고, 끊겼을 때 안내 화면이 뜬다.
  개발 중에는 등록하지 않는다 — 고칠 때마다 저장해 둔 옛 파일이 남아 헷갈린다.
  updateViaCache: "none" — sw.js 자체는 늘 새로 확인해서, 새 판이 배포되면 바로 이어받는다.
*/
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // 등록하지 못해도 서비스는 그대로 쓸 수 있다. 앱처럼 빨라지지 않을 뿐이다.
    });
  }, []);
  return null;
}
