"use client";

import { useState } from "react";
import Image from "next/image";
import type { SpotImage } from "@/lib/types";

interface SpotGalleryProps {
  name: string;
  images: SpotImage[];
}

export function SpotGallery({ name, images }: SpotGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-bg-subtle">
        <Image
          src={active.url}
          alt={`${name} 사진 ${activeIndex + 1}`}
          fill
          // One column on phones, capped by the article width on desktop.
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          priority
        />
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-6 gap-2">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${name} 사진 ${index + 1} 보기`}
              aria-pressed={index === activeIndex}
              className={`relative aspect-[4/3] overflow-hidden rounded-xl transition ${
                index === activeIndex
                  ? "ring-2 ring-accent"
                  : "ring-1 ring-line opacity-60 hover:opacity-100"
              }`}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="(max-width: 768px) 20vw, 150px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
