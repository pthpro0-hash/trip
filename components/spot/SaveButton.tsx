"use client";

import { useSavedSpots } from "@/lib/favorites";

interface SaveButtonProps {
  spotId: string;
  spotName: string;
  /** overlay: 사진 위에 얹는 동그란 하트. inline: 글자가 함께 있는 버튼. */
  variant?: "overlay" | "inline";
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        d="M12 20.5 4.2 13a4.8 4.8 0 0 1 6.8-6.8l1 1 1-1A4.8 4.8 0 0 1 19.8 13Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SaveButton({ spotId, spotName, variant = "overlay" }: SaveButtonProps) {
  const { ids, toggle } = useSavedSpots();
  const saved = ids.includes(spotId);
  const label = saved ? `${spotName} 찜 해제` : `${spotName} 찜하기`;

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={() => toggle(spotId)}
        aria-pressed={saved}
        aria-label={label}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-medium transition ${
          saved
            ? "bg-accent-soft text-accent"
            : "bg-bg-subtle text-text hover:bg-line"
        }`}
      >
        <Heart filled={saved} />
        {saved ? "찜함" : "찜하기"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(spotId)}
      aria-pressed={saved}
      aria-label={label}
      /*
        사진 위에 올라가는 버튼이라 밝은 사진에서도 보이도록 어두운 반투명
        원 위에 흰 하트를 둔다. 테마 토큰을 쓰면 밝은 사진에서 사라진다.
      */
      className={`absolute right-2.5 top-2.5 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/45 backdrop-blur-sm transition hover:bg-black/60 ${
        saved ? "text-[#ff5a5f]" : "text-white"
      }`}
    >
      <Heart filled={saved} />
    </button>
  );
}
