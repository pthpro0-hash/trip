import type { Shrunk } from "./resize";
import type { StashedTrip } from "./stashTrips";

/*
  로그인하러 떠나기 전에 사진과 찾은 여행을 이 브라우저 안에 잠깐 맡겨 둔다.

  로그인은 카카오 같은 곳으로 갔다 오는 길이라 화면이 새로 열리고, 찾은 여행과 고른 사진이 사라진다. 그러면 사진첩에서 같은
  사진을 처음부터 다시 골라야 했다. 그래서 떠나기 전에 ① 올릴 크기로 줄인 사진(보관본 · 목록 판 · 핀)과 ② 찾은 여행(제목 · 동행
  · 곳 이름까지)을 IndexedDB 에 맡기고, 로그인하고 돌아오면 꺼내 그 자리에서 이어 기록한다. 서버로는 아무것도 가지 않는다 —
  "고르는 동안 사진은 이 기기 밖으로 나가지 않아요"라는 약속은 그대로다.

  지켜야 할 것:
    - 한 번에 한 벌만 맡는다(새로 맡으면 이전 것은 지운다).
    - 여행 정보(meta)를 마지막에 적는다. 사진만 몇 장 맡다 끊긴 조각은 '맡겨 둔 것'으로 읽히지 않는다.
    - 하루(STASH_TTL_MS)가 지나면 읽는 순간 비운다 — 공용 기기에 사진 조각이 남지 않게.
    - 어떤 함수도 던지지 않는다. 저장소를 못 쓰는 때(사생활 보호 모드 · 공간 부족 · 거절)에는 "못 했다"만 돌려줘 부르는 쪽이
      예전 길(같은 사진을 한 번 더 고르기)로 물러난다.
    - 사진은 Blob 이 아니라 ArrayBuffer 로 맡긴다. 오래된 사파리는 IndexedDB 에 Blob 을 넣다 탈이 난 적이 있어서, 어느
      브라우저에서나 같게 구조화 복제되는 바이트로 맡고 꺼낼 때 Blob 으로 되돌린다.
*/

const DB_NAME = "trip-stash";
const META = "meta";
const PHOTOS = "photos";
const CURRENT = "current";

/** 맡겨 둔 것을 남겨 두는 시간. 지나면 읽는 순간 비운다. */
export const STASH_TTL_MS = 24 * 60 * 60 * 1000;
/** 사진 한 장을 맡는 데 드는 크기의 어림 — 보관본(≤600KB) + 목록 판(≤150KB) + 핀. */
export const STASH_BYTES_PER_PHOTO = 800 * 1024;
/** 이보다 많으면 맡지 않고 예전처럼 한다 — 줄이는 데만 몇 분이 걸리고 저장소도 크게 잡는다. */
export const STASH_MAX_PHOTOS = 500;

export interface StashPlace {
  title: string;
  isCuratedSpot: boolean;
  spotId: string | null;
  dong: string | null;
}

export interface StashMeta {
  v: 1;
  savedAt: number;
  trips: StashedTrip[];
  /** 손댄 제목과 동행(여행의 열쇠 = 첫 사진의 id). */
  titles: Record<string, string>;
  companions: Record<string, string>;
  /** 좌표 열쇠 → 곳 이름. 돌아와서 다시 묻지 않는다. */
  places: [string, StashPlace][];
  /** 줄이지 못한 사진의 이름(아이폰 HEIC 등). 기록한 뒤 '올리지 못한 사진'으로 알린다. */
  unsupported: string[];
  /** 맡긴 사진의 id. */
  photoIds: string[];
}

interface PhotoRecord {
  full: ArrayBuffer;
  thumb: ArrayBuffer;
  marker: ArrayBuffer;
  types: [string, string, string];
}

export interface StashWriter {
  put(id: string, shrunk: Shrunk): Promise<void>;
  /** 여행 정보를 적어 맡기기를 마친다. 이것을 적기 전에는 맡겨 둔 것으로 읽히지 않는다. */
  commit(meta: Omit<StashMeta, "v" | "savedAt" | "photoIds">): Promise<void>;
  /** 맡기다 그만둔다. 맡은 사진을 모두 치운다. */
  abort(): Promise<void>;
}

/** 이 브라우저에 저장소가 있는가(실제로 쓸 수 있는지는 probeStash 가 본다). */
export function stashSupported(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(META);
      request.result.createObjectStore(PHOTOS);
    };
    request.onsuccess = () => {
      const db = request.result;
      // 다른 곳에서 저장소를 지우거나 바꾸려 하면 열어 둔 연결을 놓아 준다(안 놓으면 그쪽이 영영 기다린다).
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("open failed"));
    request.onblocked = () => reject(new Error("blocked"));
  });
}

const wrap = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("request failed"));
  });

const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
  });

/** 맡긴 사진과 여행 정보를 모두 지운다. */
async function wipe(db: IDBDatabase): Promise<void> {
  const tx = db.transaction([META, PHOTOS], "readwrite");
  tx.objectStore(META).clear();
  tx.objectStore(PHOTOS).clear();
  await finished(tx);
}

/** 저장소를 열어 보고 아주 작은 것을 써 본다. 사생활 보호 모드처럼 쓸 수 없는 곳을 미리 가려낸다. */
export async function probeStash(): Promise<boolean> {
  if (!stashSupported()) return false;
  try {
    const db = await open();
    try {
      const tx = db.transaction(META, "readwrite");
      tx.objectStore(META).put(1, "probe");
      tx.objectStore(META).delete("probe");
      await finished(tx);
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/**
 * 사진 몇 장을 맡을 공간이 넉넉한가. 모자라면 쓰다 실패하기 전에 미리 물러난다. 공간을 알려 주지 않는 브라우저는 막지
 * 않는다(쓰다 실패하면 그때 물러난다).
 */
export async function stashHasRoom(photos: number): Promise<boolean> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate?.quota) return true;
    const free = estimate.quota - (estimate.usage ?? 0);
    return free > photos * STASH_BYTES_PER_PHOTO * 1.25;
  } catch {
    return true;
  }
}

const toBuffer = (blob: Blob) => blob.arrayBuffer();
const toBlob = (buffer: ArrayBuffer, type: string) => new Blob([buffer], { type });

/**
 * 맡기기를 시작한다. 이전에 맡긴 것은 먼저 지운다. 저장소를 못 쓰면 null — 부르는 쪽이 예전 길로 물러난다.
 */
export async function beginStash(): Promise<StashWriter | null> {
  if (!stashSupported()) return null;
  let db: IDBDatabase;
  try {
    db = await open();
    await wipe(db);
  } catch {
    return null;
  }

  const ids: string[] = [];
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    db.close();
  };

  return {
    async put(id, shrunk) {
      const record: PhotoRecord = {
        full: await toBuffer(shrunk.full),
        thumb: await toBuffer(shrunk.thumb),
        marker: await toBuffer(shrunk.marker),
        types: [shrunk.full.type, shrunk.thumb.type, shrunk.marker.type],
      };
      const tx = db.transaction(PHOTOS, "readwrite");
      tx.objectStore(PHOTOS).put(record, id);
      await finished(tx);
      if (!ids.includes(id)) ids.push(id);
    },
    async commit(meta) {
      try {
        const full: StashMeta = { v: 1, savedAt: Date.now(), photoIds: [...ids], ...meta };
        const tx = db.transaction(META, "readwrite");
        tx.objectStore(META).put(full, CURRENT);
        await finished(tx);
      } finally {
        close();
      }
    },
    async abort() {
      try {
        await wipe(db);
      } catch {
        // 지우지 못해도 여행 정보가 없으니 맡겨 둔 것으로 읽히지 않는다. 다음에 맡길 때 지워진다.
      } finally {
        close();
      }
    },
  };
}

const isRecord = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value);

/** 읽어 온 것이 맡길 때의 모양 그대로인가. 깨졌거나 다른 판이면 되살리다 화면이 깨지므로 미리 거른다. */
function wellFormed(meta: StashMeta): boolean {
  return (
    typeof meta.savedAt === "number" &&
    Array.isArray(meta.trips) &&
    Array.isArray(meta.places) &&
    Array.isArray(meta.unsupported) &&
    Array.isArray(meta.photoIds) &&
    isRecord(meta.titles) &&
    isRecord(meta.companions)
  );
}

/**
 * 맡겨 둔 여행 정보. 없거나, 맡기다 만 것이거나, 하루가 지났거나, 모양이 맞지 않으면 null(지난 것·깨진 것은 사진까지 비운다).
 */
export async function readStash(): Promise<StashMeta | null> {
  if (!stashSupported()) return null;
  try {
    const db = await open();
    try {
      const meta = await wrap<StashMeta | undefined>(db.transaction(META, "readonly").objectStore(META).get(CURRENT));
      if (!meta || meta.v !== 1) return null;
      if (!wellFormed(meta) || Date.now() - meta.savedAt > STASH_TTL_MS) {
        await wipe(db);
        return null;
      }
      return meta;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** 맡겨 둔 사진 한 장. 없거나 못 읽으면 null. */
export async function loadStashedPhoto(id: string): Promise<Shrunk | null> {
  if (!stashSupported()) return null;
  try {
    const db = await open();
    try {
      const record = await wrap<PhotoRecord | undefined>(db.transaction(PHOTOS, "readonly").objectStore(PHOTOS).get(id));
      if (!record) return null;
      return {
        full: toBlob(record.full, record.types[0]),
        thumb: toBlob(record.thumb, record.types[1]),
        marker: toBlob(record.marker, record.types[2]),
      };
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** 맡긴 것을 모두 지운다. 못 지워도 던지지 않는다. */
export async function clearStash(): Promise<void> {
  if (!stashSupported()) return;
  try {
    const db = await open();
    try {
      await wipe(db);
    } finally {
      db.close();
    }
  } catch {
    // 지우지 못했다. 하루가 지나면 읽는 순간 비워진다.
  }
}
