import { CARD_HEIGHT, CARD_WIDTH, FAINT, FONT, INK, MUTED, SIGNATURE } from "@/components/sketch/cardInk";
import { wrapWords } from "./svgText";

/*
  링크 미리보기 그림(og:image).

  카톡에 링크를 붙이면 이 그림이 뜬다. 1200×630 이 가장 널리 맞는다.
  세로 카드를 가운데에 작게 앉혀 보니 채팅창에서는 글자가 하나도 읽히지
  않았다. 그래서 왼쪽에 카드, 오른쪽에 그해와 한 줄을 크게 적는다 —
  작게 보여도 "누구의 몇 년 여행"인지는 읽힌다.

  카드를 통째로 안쪽 <svg> 로 품은 SVG 한 장을 짓고, 그것을 그림으로
  바꾼다(lib/svgToPng 의 markupToPngBlob).
*/

export const PREVIEW = { width: 1200, height: 630 } as const;

const CARD_BOX = { x: 72, y: 44, height: 542 };
const TEXT_X = 500;
const TEXT_WIDTH = PREVIEW.width - TEXT_X - 64;

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface PreviewWords {
  /** 바탕색. 카드 바탕보다 한 톤 짙게. */
  background: string;
  /** "2026년 여행 스케치" */
  kicker: string;
  headline: string;
}

/** 카드 SVG 를 품은 미리보기 SVG 글자. */
export function linkPreviewMarkup(card: SVGSVGElement, words: PreviewWords): string {
  const width = Math.round((CARD_BOX.height * CARD_WIDTH) / CARD_HEIGHT);
  const inner = card.cloneNode(true) as SVGSVGElement;
  inner.removeAttribute("style");
  inner.setAttribute("x", String(CARD_BOX.x));
  inner.setAttribute("y", String(CARD_BOX.y));
  inner.setAttribute("width", String(width));
  inner.setAttribute("height", String(CARD_BOX.height));
  const cardMarkup = new XMLSerializer().serializeToString(inner);

  const lines = wrapWords(words.headline.split(/\s+/).filter(Boolean), TEXT_WIDTH, 58, {
    maxLines: 3,
    separator: " ",
    rest: () => "…",
  });
  const headline = lines
    .map(
      (line, index) =>
        `<text x="${TEXT_X}" y="${262 + index * 76}" font-family="${escape(FONT)}" font-size="58" font-weight="700" fill="${INK}">${escape(line)}</text>`,
    )
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIEW.width}" height="${PREVIEW.height}" viewBox="0 0 ${PREVIEW.width} ${PREVIEW.height}">`,
    `<rect width="${PREVIEW.width}" height="${PREVIEW.height}" fill="${words.background}"/>`,
    // 카드 밑 옅은 그림자. 작게 보여도 카드 가장자리가 선다.
    `<filter id="preview-shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>`,
    `<rect x="${CARD_BOX.x}" y="${CARD_BOX.y + 8}" width="${width}" height="${CARD_BOX.height}" rx="14" fill="#000000" fill-opacity="0.16" filter="url(#preview-shadow)"/>`,
    cardMarkup,
    `<text x="${TEXT_X}" y="176" font-family="${escape(FONT)}" font-size="34" font-weight="600" fill="${MUTED}">${escape(words.kicker)}</text>`,
    headline,
    `<text x="${TEXT_X}" y="${PREVIEW.height - 64}" font-family="${escape(FONT)}" font-size="26" fill="${FAINT}">${escape(SIGNATURE)}</text>`,
    `</svg>`,
  ].join("");
}
