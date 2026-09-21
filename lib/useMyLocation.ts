"use client";

import { useCallback, useState } from "react";
import type { Point } from "./geo";

export type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; point: Point }
  | { status: "denied" }
  | { status: "unavailable" };

const OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  // 여행지까지의 거리를 재는 용도라 1분 전 위치로도 충분하다.
  maximumAge: 60_000,
};

/**
 * 위치는 물어봐야 알 수 있는 것이라, 화면이 뜨자마자 묻지 않고
 * 사용자가 "내 주변"을 누를 때만 요청한다.
 */
export function useMyLocation() {
  const [state, setState] = useState<LocationState>({ status: "idle" });

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unavailable" });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setState({
          status: "ready",
          point: { lat: position.coords.latitude, lng: position.coords.longitude },
        }),
      (error) =>
        setState(
          error.code === error.PERMISSION_DENIED
            ? { status: "denied" }
            : { status: "unavailable" },
        ),
      OPTIONS,
    );
  }, []);

  const clear = useCallback(() => setState({ status: "idle" }), []);

  return { state, request, clear };
}
