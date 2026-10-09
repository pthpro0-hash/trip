"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { launchPicker } from "@/lib/photo/launch";

/**
 * '사진 고르기' 링크. 모양과 주소는 그대로 링크이고, 그냥 누르면 사진첩이 곧바로 열린 채 '사진으로 여행 추가'로 간다
 * (새 창으로 열기 · 키를 누른 클릭은 평소 링크).
 */
export function AddPhotosLink({ onClick, ...rest }: ComponentProps<typeof Link>) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (plain && !event.defaultPrevented) launchPicker();
  };
  return <Link {...rest} onClick={handle} />;
}
