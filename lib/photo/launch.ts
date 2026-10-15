/*
  어느 화면에서든 [사진 고르기]를 누르면 사진첩이 곧바로 열리게 하는 다리.

  사진첩은 누른 바로 그 순간에, 누른 화면에 있는 입력칸으로만 열 수 있다(브라우저 규칙). 그래서 모든 화면에 늘 떠 있는 숨은 입력칸
  (components/photo/PhotoLauncher)을 하나 두고, 누르면 그것으로 사진첩을 연 채 '사진으로 여행 추가'로 간다. 사진을 고르면 그 화면이
  여기서 받아 간다. 이 모듈은 둘 사이의 작은 우체통이다.
*/
let input: HTMLInputElement | null = null;
let pending: File[] | null = null;
let opened = false;
let openedAt = 0;
/*
  취소했는데 cancel 이 오지 않는 브라우저(아이폰 사파리)에서는 '열려 있다'가 영영 남는다 — 그러면 나중에 앱으로 돌아올 때마다
  '불러오는 중'이 떴다. 사진첩은 이만큼 지나면 닫힌 것으로 본다(오래 고르는 중이어도 고른 사진은 평소대로 받는다).
*/
const OPEN_MAX_MS = 90_000;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function registerLauncherInput(element: HTMLInputElement | null): void {
  input = element;
}

/** 사진첩을 연다. 누른 순간(클릭 처리 안)에서 불러야 한다. 열 입력칸이 없으면 false. */
export function launchPicker(): boolean {
  if (!input) return false;
  input.value = "";
  opened = true;
  openedAt = Date.now();
  emit();
  input.click();
  return true;
}

export function receiveFiles(files: File[]): void {
  opened = false;
  pending = files.length > 0 ? files : null;
  emit();
}

export function cancelLaunch(): void {
  opened = false;
  emit();
}

export const launchOpened = () => opened && Date.now() - openedAt < OPEN_MAX_MS;

/** 사진첩 입력칸에 고른 사진이 이미 들어와 있는가 — 들어와 있으면 곧 change 가 온다(취소가 아니다). */
export const launchHasFiles = () => (input?.files?.length ?? 0) > 0;

/** 고른 사진이 와 있으면 가져가고 비운다. */
export function takePendingFiles(): File[] | null {
  const files = pending;
  pending = null;
  return files;
}

export function subscribeLaunch(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
