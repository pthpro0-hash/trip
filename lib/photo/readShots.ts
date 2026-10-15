import exifr from "exifr";
import type { Shot } from "./types";

/** 고른 파일들을 읽고 나서 무엇이 무엇인지 갈라 놓은 결과. */
export interface ReadResult {
  /** 언제 어디서 찍혔는지 아는 사진. 여행으로 묶을 수 있다. */
  shots: Shot[];
  /**
   * 어디인지 모르는 사진. 카톡을 거치면 위치가 지워진다 — 사람이 날짜와 장소를 정하면 여행에 넣을 수 있다.
   * guessed: 촬영 시각마저 지워져 파일 날짜(받은 날일 수 있다)로 어림한 것.
   */
  withoutLocation: { id: string; takenAt: Date; guessed?: boolean }[];
  /** 화면 캡처. 장소 사진이 아니다. */
  screenshots: string[];
  /** 사진으로 볼 수 없는 것. 동영상이 여기 들어온다. */
  unreadable: string[];
}

/** 사진 파일인가 — 동영상·문서는 아니다. 브라우저가 형식을 모르는 HEIC 는 이름으로 본다. */
function isImage(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name);
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

    if (!takenAt) {
      /*
        메신저를 거치면 촬영 시각도 지워진다. 사진이면 파일 날짜로 어림해 '위치를 모르는 사진'으로 넘긴다(사람이 날짜를 고칠 수 있다).
        카메라 정보 없는 PNG 는 화면 캡처로 본다.
      */
      if (!isImage(file)) result.unreadable.push(file.name);
      else if (/\.png$/i.test(file.name)) result.screenshots.push(file.name);
      else if (file.lastModified > 0) result.withoutLocation.push({ id: file.name, takenAt: new Date(file.lastModified), guessed: true });
      else result.unreadable.push(file.name);
    } else if (isScreenshot(file, tags?.Model)) result.screenshots.push(file.name);
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
