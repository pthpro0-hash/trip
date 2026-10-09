"use client";

import { useEffect, useRef } from "react";
import { cancelLaunch, receiveFiles, registerLauncherInput } from "@/lib/photo/launch";

/** 모든 화면에 늘 떠 있는 숨은 사진 입력칸(lib/photo/launch). 그리는 것은 보이지 않는 칸 하나뿐이다. */
export function PhotoLauncher() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const element = ref.current;
    registerLauncherInput(element);
    const onCancel = () => cancelLaunch();
    element?.addEventListener("cancel", onCancel);
    return () => {
      element?.removeEventListener("cancel", onCancel);
      registerLauncherInput(null);
    };
  }, []);

  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
      onChange={(event) => receiveFiles([...(event.target.files ?? [])])}
    />
  );
}
