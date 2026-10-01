"use client";

import { useEffect } from "react";
import { startFamilyView, stopFamilyView, useFamilyView } from "@/lib/familyView";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchCircle } from "@/lib/supabase/family";
import { roleLabel } from "@/lib/family";

/*
  가족의 여행을 보는 동안 위 띠 바로 아래에 늘 붙어 있는 띠.

  남의 자료를 읽고 있다는 사실은 화면 어디에서도 헷갈리면 안 된다 — 내 여행인 줄 알고
  보다가 "왜 내 사진이 없지"가 되거나, 내 것인 줄 알고 지우려 들면 곤란하다. 그래서
  누구의 여행인지와 내 여행으로 돌아가는 길을 늘 보이게 둔다.

  돌아갈 때는 화면 전체를 새로 불러온다(앞 사람의 자료가 조금도 남지 않게).
*/
export function FamilyBanner() {
  const view = useFamilyView();
  const ownerId = view?.ownerId;
  const role = view?.role;
  const label = view?.label;

  /*
    보는 중에 주인이 권한을 바꾸거나 연결을 끊었을 수 있다. 화면이 열릴 때마다 한 번 맞춰
    본다 — 끊겼으면 내 여행으로 돌아가고, 권한이 달라졌으면 단추가 그 권한대로 바뀐다.
    (확인하지 못했으면 그대로 둔다. 막는 것은 어차피 DB 다.)
  */
  useEffect(() => {
    if (!ownerId || !role || !label) return;
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;
    void fetchCircle(supabase).then((circle) => {
      if (!active || circle === "failed") return;
      const now = circle.shared.find((member) => member.id === ownerId);
      if (!now) {
        stopFamilyView();
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/?v=sketch";
        return;
      }
      if (now.role !== role) startFamilyView({ ownerId, label, role: now.role });
    });
    return () => {
      active = false;
    };
  }, [ownerId, role, label]);

  if (!view) return null;

  const back = () => {
    stopFamilyView();
    // 라우터가 아니라 통째로 새로 불러온다 — 앞 화면의 자료가 남지 않게.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/?v=sketch";
  };

  return (
    <div
      role="status"
      className="sticky top-14 z-20 border-b border-line bg-accent-soft"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-[13px] text-text">
          <span className="font-semibold">{view.label}</span> 님의 여행을 보고 있어요
          <span className="ml-1.5 text-text-muted">· {roleLabel(view.role)}</span>
        </p>
        <button
          type="button"
          onClick={back}
          className="shrink-0 rounded-full bg-text px-3.5 py-1.5 text-[13px] font-medium text-bg"
        >
          내 여행으로
        </button>
      </div>
    </div>
  );
}
