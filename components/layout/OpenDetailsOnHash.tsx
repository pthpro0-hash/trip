"use client";

import { useEffect } from "react";

/*
  주소의 #갈래 로 오면 그 갈래의 접힌 칸(details)을 연다. 그리는 것은 없다.

  도움말은 갈래를 접어 둔다. 목차를 누르거나 #shelf 같은 주소로 들어왔는데 접힌 제목만 보이면 찾으러 온 것이 안 보인다.
  어떤 브라우저는 스스로 열어 주지만 모두가 그렇지는 않다.
*/
export function OpenDetailsOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      const details = target instanceof HTMLDetailsElement ? target : target?.querySelector("details");
      if (details instanceof HTMLDetailsElement) details.open = true;
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
