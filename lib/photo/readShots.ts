import exifr from "exifr";
import type { Shot } from "./types";

/** 고른 파일들을 읽고 나서 무엇이 무엇인지 갈라 놓은 결과. */
export interface ReadResult {
  /** 언제 어디서 찍혔는지 아는 사진. 여행으로 묶을 수 있다. */
  shots: Shot[];
  /** 찍은 때는 알지만 어디인지 모르는 사진. 카톡을 거치면 위치가 지워진다. */
  withoutLocation: { id: string; takenAt: Date }[];
  /** 화면 캡처. 장소 사진이 아니다. */
  screenshots: string[];
  /** 촬영 정보를 읽지 못한 것. 동영상이 여기 들어온다. */
  unreadable: string[];
}

function isScreenshot(file: File, model: unknown) {
  // 카메라 정보가 없는 PNG는 화면 캡처다. 실제 사진에는 기종이 들어 있다.
  return !model && /\.png$/i.test(file.name);
}

/**
 * 사진에서 촬영 시각과 위치를 읽는다. 전부 브라우저 안에서 일어나며
 * 이 단계에서는 어떤 파일도 서버로 보내지 않는다.
 */
export async function readShots(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<ReadResult> {
  const result: ReadResult = {
    shots: [],
    withoutLocation: [],
    screenshots: [],
    unreadable: [],
  };

  for (const [index, file] of files.entries()) {
    let tags: Record<string, unknown> | null = null;
    try {
      tags = await exifr.parse(file, { tiff: true, exif: true, gps: true });
    } catch {
      // 아래에서 '읽지 못함'으로 처리한다.
    }

    const takenAt = (tags?.DateTimeOriginal ?? tags?.CreateDate) as Date | undefined;

    if (!takenAt) result.unreadable.push(file.name);
    else if (isScreenshot(file, tags?.Model)) result.screenshots.push(file.name);
    else if (typeof tags?.latitude !== "number" || typeof tags?.longitude !== "number") {
      result.withoutLocation.push({ id: file.name, takenAt });
    } else {
      result.shots.push({
        id: file.name,
        takenAt,
        lat: tags.latitude,
        lng: tags.longitude,
      });
    }

    onProgress?.(index + 1, files.length);
  }

  result.shots.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
  return result;
}
