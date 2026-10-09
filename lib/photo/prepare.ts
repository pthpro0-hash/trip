import { shrinkToWebp, type Shrunk } from "./resize";
import { STASH_MAX_PHOTOS, beginStash, stashHasRoom, type StashMeta } from "./stash";
import type { Shot } from "./types";

/*
  로그인하러 떠나기 전에 사진을 준비해 맡겨 둔다.

  [로그인하고 기록하기]를 누르면 카카오 같은 곳으로 갔다 와야 하는데, 그러면 화면이 새로 열려 찾은 여행과 고른 사진이 사라진다.
  떠나기 전에 ① 올릴 크기로 줄인 사진(보관본 · 목록 판 · 핀)을 한 장씩 이 브라우저 저장소에 맡기고 ② 찾은 여행(제목 · 동행 ·
  곳 이름까지)을 적어 둔다(lib/photo/stash). 로그인하고 돌아오면 그 자리에서 이어 기록한다. 줄이는 일은 기록할 때 하던 것과
  같은 일이다 — 로그인 뒤에서 앞으로 옮겨 왔을 뿐이다.

  못 맡으면(공간 부족 · 사생활 보호 모드 · 저장소가 막힘) false 를 돌려주고 맡은 것은 모두 치운다. 부르는 쪽은 예전 길(같은 사진을
  한 번 더 고르기)로 물러난다 — 지금보다 나빠지는 일은 없어야 한다.
*/

/** 맡아 둘 만한 양인가. 너무 많으면 줄이는 데만 몇 분이 걸리고 저장소도 크게 잡아, 예전 길로 간다. */
export function canPrepare(count: number): boolean {
  return count > 0 && count <= STASH_MAX_PHOTOS;
}

interface PrepareInput {
  /** 올릴 사진들(방문에 든 것, 같은 사진은 한 번). */
  shots: Shot[];
  /** 고른 파일(사진 id = 파일 이름). */
  files: Map<string, File>;
  /** 여행 정보. 줄이지 못한 사진의 이름은 여기서 채운다. */
  meta: Omit<StashMeta, "v" | "savedAt" | "photoIds" | "unsupported">;
  onProgress?: (done: number, total: number, elapsedMs: number) => void;
}

export async function prepareForLogin({ shots, files, meta, onProgress }: PrepareInput): Promise<boolean> {
  if (shots.length === 0 || !(await stashHasRoom(shots.length))) return false;
  const writer = await beginStash();
  if (!writer) return false;

  const unsupported: string[] = [];
  const startedAt = Date.now();
  let done = 0;
  onProgress?.(0, shots.length, 0);

  try {
    for (const shot of shots) {
      const file = files.get(shot.id);
      let shrunk: Shrunk | null = null;
      if (file) {
        try {
          // 한 장씩 — 펼친 그림이 50MB 가까이 잡는다(기록할 때와 같은 규칙).
          shrunk = await shrinkToWebp(file);
        } catch {
          // 브라우저가 열지 못하는 형식(아이폰 HEIC 등)이거나 풀지 못한 사진. 한 장 때문에 전부를 못 맡지는 않는다.
          shrunk = null;
        }
      }
      if (shrunk) await writer.put(shot.id, shrunk);
      else unsupported.push(shot.id);
      done += 1;
      onProgress?.(done, shots.length, Date.now() - startedAt);
    }
    await writer.commit({ ...meta, unsupported });
    return true;
  } catch {
    // 저장소가 막혔다(공간 부족 등). 맡은 것을 모두 치운다.
    await writer.abort();
    return false;
  }
}
