/*
  화면의 SVG 를 그대로 그림 파일로.

  html2canvas 같은 것을 끌어오지 않는다. SVG 는 이미 그림이라, 글자로
  바꿔 이미지로 읽히고 캔버스에 그려 내려받을 수 있다. 보이는 것과
  저장되는 것이 어긋날 일이 없다.
*/

/** 화면보다 크게 그려야 저장본이 흐리지 않다. */
const SCALE = 2;

export async function downloadSvgAsPng(svg: SVGSVGElement, fileName: string): Promise<boolean> {
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || svg.clientWidth;
  const height = viewBox.height || svg.clientHeight;
  if (!width || !height) return false;

  // 바깥으로 꺼내는 순간 페이지의 CSS 는 따라오지 않는다. 크기만 박아 둔다.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const markup = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("svg load failed"));
      element.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;

    const context = canvas.getContext("2d");
    if (!context) return false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) return false;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(png);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}
