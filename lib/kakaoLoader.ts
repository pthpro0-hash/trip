import { buildKakaoScriptSrc } from "./kakao";

// next/script dedupes by src, and when several components render a Script with
// the same src in one commit only one of them gets its onReady — which left
// every region map after the first with an empty container. Loading the SDK
// through one shared promise instead makes "how many maps are on the page"
// irrelevant.
let loadPromise: Promise<void> | null = null;

function sdkReady() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
  const kakao = (window as any).kakao;
  return Boolean(kakao?.maps?.LatLng);
}

export function loadKakaoMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (sdkReady()) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const src = buildKakaoScriptSrc(apiKey);

  loadPromise = new Promise<void>((resolve, reject) => {
    const finish = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.load) {
        reject(new Error("Kakao Maps SDK did not initialize"));
        return;
      }
      // The SDK is loaded with autoload=false, so the map classes only exist
      // after this callback runs.
      kakao.maps.load(() => resolve());
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () => reject(new Error("Kakao Maps SDK failed to load")));
      // next/script may have already finished with this tag.
      if (sdkReady()) resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", finish);
    script.addEventListener("error", () => reject(new Error("Kakao Maps SDK failed to load")));
    document.head.appendChild(script);
  }).catch((error) => {
    // Let a later mount retry rather than caching the failure forever.
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}
