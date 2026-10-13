"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { logUse, screenOf } from "@/lib/usage";
import { readStart } from "@/lib/start";

/*
  화면을 열 때마다 어느 화면인지 하나 센다(lib/usage). 그리는 것은 없다.

  화면마다 따로 적지 않고 여기 한 곳에서 주소를 보고 센다 — 화면이 늘어도 빠뜨리지 않는다.
  같은 화면 안에서 주소의 다른 부분(보던 해 같은 것)만 바뀌면 다시 세지 않는다.
*/
function Track() {
  const pathname = usePathname();
  const params = useSearchParams();
  const v = params.get("v");
  const view = params.get("view");
  // 화면이 바뀔 때만 센다. 같은 화면 안에서 보던 해(?y=)만 바뀌면 다시 세지 않는다.
  useEffect(() => {
    // 지난번에 고른 갈래는 쿠키에 있다 — 브라우저에서만 읽는다.
    const screen = screenOf(pathname, { v, view }, readStart());
    if (screen) logUse(screen);
  }, [pathname, v, view]);
  return null;
}

export function UsageTracker() {
  // useSearchParams 는 정적으로 그리는 화면에서 경계가 있어야 한다.
  return (
    <Suspense fallback={null}>
      <Track />
    </Suspense>
  );
}
