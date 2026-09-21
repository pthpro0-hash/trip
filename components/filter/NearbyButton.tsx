"use client";

import type { LocationState } from "@/lib/useMyLocation";

interface NearbyButtonProps {
  state: LocationState;
  onRequest: () => void;
  onClear: () => void;
}

const MESSAGE: Partial<Record<LocationState["status"], string>> = {
  denied: "위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.",
  unavailable: "위치를 가져오지 못했어요.",
};

export function NearbyButton({ state, onRequest, onClear }: NearbyButtonProps) {
  const active = state.status === "ready";
  const busy = state.status === "locating";
  const message = MESSAGE[state.status];

  return (
    <>
      <button
        type="button"
        onClick={active ? onClear : onRequest}
        disabled={busy}
        aria-pressed={active}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition disabled:opacity-60 ${
          active ? "bg-accent text-on-accent" : "bg-bg-subtle text-text hover:bg-line"
        }`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5">
          <path
            d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"
            fill={active ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="10" r="2.4" fill={active ? "var(--color-accent)" : "none"} stroke="currentColor" strokeWidth="1.6" />
        </svg>
        {busy ? "위치 찾는 중…" : active ? "가까운 순" : "내 주변"}
      </button>
      {message && <span className="text-[13px] text-text-faint">{message}</span>}
    </>
  );
}
