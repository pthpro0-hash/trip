import { describe, it, expect } from "vitest";
import { PREVIEW, linkPreviewMarkup } from "./linkPreview";

const card = () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 720 1060");
  svg.setAttribute("style", "display:block");
  svg.innerHTML = '<rect width="720" height="1060" fill="#fff"/>';
  return svg;
};

describe("linkPreviewMarkup", () => {
  it("1200×630 한 장에 카드를 품는다", () => {
    const markup = linkPreviewMarkup(card(), { background: "#eef0f3", kicker: "2026년 여행 스케치", headline: "바다" });
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const root = doc.documentElement;
    expect(root.getAttribute("width")).toBe(String(PREVIEW.width));
    expect(root.getAttribute("height")).toBe(String(PREVIEW.height));
    const inner = root.querySelector("svg");
    expect(inner?.getAttribute("viewBox")).toBe("0 0 720 1060");
    expect(inner?.getAttribute("style")).toBeNull();
  });

  it("사람이 적은 한 줄은 글자로만 들어간다 — 태그가 되지 않는다", () => {
    const markup = linkPreviewMarkup(card(), {
      background: "#eef0f3",
      kicker: "2026년",
      headline: '<script>alert(1)</script> & "바다"',
    });
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.documentElement.textContent).toContain("<script>");
  });

  it("긴 한 줄은 세 줄까지 접는다", () => {
    const markup = linkPreviewMarkup(card(), {
      background: "#eef0f3",
      kicker: "2026년",
      headline: "민수랑 동해안을 따라 올라가며 바다를 세 번 보고 설악산까지 걸어 올라간 아주 긴 여름의 해",
    });
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const lines = [...doc.querySelectorAll('text[font-size="58"]')];
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.at(-1)?.textContent?.endsWith("…")).toBe(true);
  });
});
