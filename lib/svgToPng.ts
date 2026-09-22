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
}

export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  fileName: string,
  options: SaveOptions = {},
): Promise<boolean> {
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
    const context = (() => {
      if (!options.story) {
        canvas.width = width * SCALE;
        canvas.height = height * SCALE;
        return canvas.getContext("2d");
      }
      canvas.width = STORY.width;
      canvas.height = STORY.height;
      return canvas.getContext("2d");
    })();
    if (!context) return false;

    if (options.story) {
      // 바탕을 먼저 칠한다. 칠하지 않으면 남는 자리가 투명하게 나가고,
      // 스토리에 올리면 그 부분이 시커멓게 된다.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      const box = fitInStory(width, height);
      context.drawImage(image, box.x, box.y, box.width, box.height);
    } else {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    }

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
