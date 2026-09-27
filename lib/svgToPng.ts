/*
  화면의 SVG 를 그대로 그림 파일로.

  html2canvas 같은 것을 끌어오지 않는다. SVG 는 이미 그림이라, 글자로
  바꿔 이미지로 읽히고 캔버스에 그려 내려받을 수 있다. 보이는 것과
  저장되는 것이 어긋날 일이 없다.
*/

/** 화면보다 크게 그려야 저장본이 흐리지 않다. */
const SCALE = 2;

/*
  스토리에 올릴 비율.

  공유는 대부분 세로다. 카드 자체를 9:16 으로 다시 짜는 대신 흰 바탕
  가운데에 앉힌다 — 카드 하나만 관리하면 되고, 위아래 여백은 스토리에
  글자나 스티커를 얹을 자리가 되어 오히려 쓸모가 있다.
*/
export const STORY = { width: 1080, height: 1920 } as const;

/**
 * 세로 바탕 안에 카드를 통째로 앉힐 자리.
 *
 * 폭에만 맞추면 카드가 길어졌을 때 위아래가 잘린다. 긴 쪽에 맞춰
 * 넣어야 무엇을 바꾸든 안 잘린다.
 */
export function fitInStory(
  width: number,
  height: number,
  box: { width: number; height: number } = STORY,
  margin = 0.9,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min((box.width * margin) / width, (box.height * margin) / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  return {
    x: (box.width - drawWidth) / 2,
    y: (box.height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

export interface SaveOptions {
  /** 세로(9:16) 바탕에 앉혀 내보낸다. */
  story?: boolean;
  /** 세로 바탕의 색. 카드 바탕과 같아야 카드가 액자에 끼운 듯 떠 보이지 않는다. */
  background?: string;
}

/** SVG 글자를 그림으로 읽어 캔버스에 그리고 PNG 로. 못 그리면 null. */
async function rasterize(
  markup: string,
  size: { width: number; height: number },
  draw: (context: CanvasRenderingContext2D, image: HTMLImageElement) => void,
): Promise<Blob | null> {
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("svg load failed"));
      element.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    draw(context, image);

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 화면의 SVG 를 PNG 로. 못 그리면 null. */
export async function svgToPngBlob(svg: SVGSVGElement, options: SaveOptions = {}): Promise<Blob | null> {
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || svg.clientWidth;
  const height = viewBox.height || svg.clientHeight;
  if (!width || !height) return null;

  // 바깥으로 꺼내는 순간 페이지의 CSS 는 따라오지 않는다. 크기만 박아 둔다.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const markup = new XMLSerializer().serializeToString(clone);

  if (!options.story) {
    return rasterize(markup, { width: width * SCALE, height: height * SCALE }, (context, image) =>
      context.drawImage(image, 0, 0, width * SCALE, height * SCALE),
    );
  }

  return rasterize(markup, STORY, (context, image) => {
    // 바탕을 먼저 칠한다. 칠하지 않으면 남는 자리가 투명하게 나가고,
    // 스토리에 올리면 그 부분이 시커멓게 된다.
    context.fillStyle = options.background ?? "#ffffff";
    context.fillRect(0, 0, STORY.width, STORY.height);
    const box = fitInStory(width, height);
    context.drawImage(image, box.x, box.y, box.width, box.height);
  });
}

/** 이미 짜 둔 SVG 글자를 그 크기 그대로 PNG 로. */
export function markupToPngBlob(markup: string, size: { width: number; height: number }): Promise<Blob | null> {
  return rasterize(markup, size, (context, image) => context.drawImage(image, 0, 0, size.width, size.height));
}

export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  fileName: string,
  options: SaveOptions = {},
): Promise<boolean> {
  const png = await svgToPngBlob(svg, options);
  if (!png) return false;

  const link = document.createElement("a");
  link.href = URL.createObjectURL(png);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
  return true;
}
