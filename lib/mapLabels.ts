import type { MapPoint, ViewBox } from "./koreaMap";

export interface LabelInput {
  id: string;
  text: string;
  subText?: string;
  anchor: MapPoint;
}

export interface PlacedLabel {
  id: string;
  /** Center of the label box. */
  x: number;
  /** Top edge of the label box. */
  y: number;
  width: number;
  height: number;
  visible: boolean;
  /** False when the label only fit after dropping its second line. */
  showSubText: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutOptions {
  viewBox: ViewBox;
  fontSize: number;
  /** How far the pin graphic rises above its anchor point. */
  pinHeight: number;
}

// Korean glyphs are full-width, latin/digits roughly half — close enough to
// reserve space without measuring text in the DOM (this runs during render,
// including on the server).
function estimateTextWidth(text: string, fontSize: number) {
  let units = 0;
  for (const char of text) {
    units += /[ᄀ-ᇿ가-힯　-〿＀-￯]/.test(char) ? 1 : 0.55;
  }
  return units * fontSize;
}

function overlaps(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

function contains(outer: ViewBox, inner: Rect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

// Greedy label placement: try below the pin first (the reference infographic's
// default), then above, then to either side, then further below. A label that
// can't find a free slot is dropped rather than drawn on top of another one —
// the pin stays clickable and the numbered list under the map still covers it.
export function layoutLabels(
  inputs: LabelInput[],
  { viewBox, fontSize, pinHeight }: LayoutOptions,
): PlacedLabel[] {
  const gap = fontSize * 0.45;
  const placed: Rect[] = [];

  // Pins are obstacles too, so a label never lands on a neighbouring marker.
  const pinBoxes: Rect[] = inputs.map((input) => ({
    x: input.anchor.x - pinHeight * 0.4,
    y: input.anchor.y - pinHeight,
    width: pinHeight * 0.8,
    height: pinHeight,
  }));

  const ordered = [...inputs].sort((a, b) => a.anchor.y - b.anchor.y);
  const results = new Map<string, PlacedLabel>();

  for (const input of ordered) {
    const { anchor } = input;
    // Two shots at fitting: the full two-line label, then name-only. A name
    // with no description still tells the reader what the pin is, so shedding
    // the second line beats dropping the label entirely.
    const variants = input.subText
      ? [
          { lines: [input.text, input.subText], showSubText: true },
          { lines: [input.text], showSubText: false },
        ]
      : [{ lines: [input.text], showSubText: false }];

    let slot: Rect | undefined;
    let showSubText = false;
    let width = 0;
    let height = 0;

    for (const variant of variants) {
      width = Math.max(...variant.lines.map((line) => estimateTextWidth(line, fontSize)));
      height = fontSize * (variant.lines.length === 2 ? 2.35 : 1.25);

      const below = anchor.y + gap;
      const above = anchor.y - pinHeight - gap - height;
      const side = anchor.y - pinHeight / 2 - height / 2;
      const right = anchor.x + gap + pinHeight * 0.4;
      const left = anchor.x - gap - pinHeight * 0.4 - width;
      // Ordered by preference: straight below reads most clearly (and matches
      // the reference infographic), then above, then the sides, then diagonals
      // and further-out rows for pins in crowded neighbourhoods.
      const candidates: Rect[] = [
        { x: anchor.x - width / 2, y: below, width, height },
        { x: anchor.x - width / 2, y: above, width, height },
        { x: right, y: side, width, height },
        { x: left, y: side, width, height },
        { x: right, y: below, width, height },
        { x: left, y: below, width, height },
        { x: right, y: above, width, height },
        { x: left, y: above, width, height },
        { x: anchor.x - width / 2, y: below + height * 1.25, width, height },
        { x: anchor.x - width / 2, y: above - height * 1.25, width, height },
      ];

      slot = candidates.find(
        (candidate) =>
          contains(viewBox, candidate) &&
          !placed.some((rect) => overlaps(candidate, rect)) &&
          !pinBoxes.some((rect) => overlaps(candidate, rect)),
      );

      if (slot) {
        showSubText = variant.showSubText;
        break;
      }
    }

    if (slot) {
      placed.push(slot);
      results.set(input.id, {
        id: input.id,
        x: slot.x + slot.width / 2,
        y: slot.y,
        width,
        height,
        visible: true,
        showSubText,
      });
    } else {
      results.set(input.id, {
        id: input.id,
        x: anchor.x,
        y: anchor.y + gap,
        width,
        height,
        visible: false,
        showSubText: false,
      });
    }
  }

  // Preserve the caller's order so labels line up with pin numbering.
  return inputs.map((input) => results.get(input.id)!);
}
