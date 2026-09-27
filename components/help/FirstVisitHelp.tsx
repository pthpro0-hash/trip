"use client";

import { useEffect, useState } from "react";
import { HelpDialog } from "./HelpDialog";
import { hasSeen, markSeen } from "@/lib/seen";

const KEY = "help";

/*
  처음 온 사람에게 한 번만 내민다.

  본 적이 있는지는 브라우저에만 있는 사실이라 서버가 그린 화면에는 없다.
  그래서 처음에는 아무것도 그리지 않고, 화면에 붙은 뒤에 연다.

  붙었는지를 화면 밖 값으로 알아내는 길도 있지만, 그 길은 "달라졌으니
  알아서 다시 그려 주겠지" 에 기댄다. 여기서는 그 기대가 빗나갔다 —
  팝업이 영영 뜨지 않았고, 왜 안 뜨는지도 화면에 아무 흔적이 없었다.
  마운트 뒤에 한 번 도는 이 방식은 기댈 것이 없다.

  닫는 순간 본 것으로 친다. 끝까지 읽었는지까지 따지면, 급해서 닫은
  사람에게 올 때마다 다시 들이밀게 된다.
*/
export function FirstVisitHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소는 화면에 붙은 뒤에야 읽을 수 있다.
    if (!hasSeen(KEY)) setOpen(true);
  }, []);

  if (!open) return null;

  return (
    <HelpDialog
      onClose={() => {
        markSeen(KEY);
        setOpen(false);
      }}
    />
  );
}
