/*
  화면의 SVG 를 그대로 그림 파일로.

  html2canvas 같은 것을 끌어오지 않는다. SVG 는 이미 그림이라, 글자로
  바꿔 이미지로 읽히고 캔버스에 그려 내려받을 수 있다. 보이는 것과
  저장되는 것이 어긋날 일이 없다.
*/

/** 화면보다 크게 그려야 저장본이 흐리지 않다. */
const SCALE = 2;

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
export async function svgToPngBlob(svg: SVGSVGElement): Promise<Blob | null> {
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || svg.clientWidth;
  const height = viewBox.height || svg.clientHeight;
  if (!width || !height) return null;

  // 바깥으로 꺼내는 순간 페이지의 CSS 는 따라오지 않는다. 크기만 박아 둔다.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const markup = new XMLSerializer().serializeToString(clone);

  return rasterize(markup, { width: width * SCALE, height: height * SCALE }, (context, image) =>
    context.drawImage(image, 0, 0, width * SCALE, height * SCALE),
  );
}

/** 이미 짜 둔 SVG 글자를 그 크기 그대로 PNG 로. */
export function markupToPngBlob(markup: string, size: { width: number; height: number }): Promise<Blob | null> {
  return rasterize(markup, size, (context, image) => context.drawImage(image, 0, 0, size.width, size.height));
}

export async function downloadSvgAsPng(svg: SVGSVGElement, fileName: string): Promise<boolean> {
  const png = await svgToPngBlob(svg);
  if (!png) return false;

  const link = document.createElement("a");
  link.href = URL.createObjectURL(png);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
  return true;
}
