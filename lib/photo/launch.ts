/*
  어느 화면에서든 [사진 고르기]를 누르면 사진첩이 곧바로 열리게 하는 다리.

  사진첩은 누른 바로 그 순간에, 누른 화면에 있는 입력칸으로만 열 수 있다(브라우저 규칙). 그래서 모든 화면에 늘 떠 있는 숨은 입력칸
  (components/photo/PhotoLauncher)을 하나 두고, 누르면 그것으로 사진첩을 연 채 '사진으로 여행 추가'로 간다. 사진을 고르면 그 화면이
  여기서 받아 간다. 이 모듈은 둘 사이의 작은 우체통이다.
*/
let input: HTMLInputElement | null = null;
let pending: File[] | null = null;
let opened = false;
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

export const launchOpened = () => opened;

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
