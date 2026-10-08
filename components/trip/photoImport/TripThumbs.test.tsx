import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

const previewFromFile = vi.fn<(file: Blob, name?: string) => Promise<Blob>>();
vi.mock("@/lib/photo/resize", () => ({
  previewFromFile: (file: Blob, name?: string) => previewFromFile(file, name),
}));

import { TripThumbs } from "./TripThumbs";

/*
  카드의 작은 그림. 고른 사진은 아직 기기 안의 원본 파일뿐이라, 칸마다 작은 판을 구워 붙인다.
  사진이 수백 장이어도 폰이 버티도록: 화면 가까이 온 카드의 것만, 한 번에 하나씩 펼친다.
*/

let made: string[] = [];
let revoked: string[] = [];

beforeEach(() => {
  made = [];
  revoked = [];
  previewFromFile.mockReset();
  previewFromFile.mockImplementation(async () => new Blob(["thumb"], { type: "image/webp" }));
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:test/${made.length}`;
    made.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  });
});

afterEach(() => vi.unstubAllGlobals());

const files = (n: number) => Array.from({ length: n }, (_, i) => new File(["x"], `${i}.jpg`, { type: "image/jpeg" }));
const images = (root: HTMLElement) => [...root.querySelectorAll("img")];
const tiles = (root: HTMLElement) => root.querySelectorAll("[data-tile]");

describe("TripThumbs", () => {
  it("사진마다 작은 판을 구워 칸에 붙인다", async () => {
    const { container } = render(<TripThumbs files={files(3)} />);
    await waitFor(() => expect(images(container)).toHaveLength(3));
    expect(images(container).map((img) => img.getAttribute("src"))).toEqual(["blob:test/0", "blob:test/1", "blob:test/2"]);
    // 어느 파일인지 이름을 넘긴다 — 못 여는 형식이면 오류가 그 이름을 담는다.
    expect(previewFromFile.mock.calls.map((call) => call[1])).toEqual(["0.jpg", "1.jpg", "2.jpg"]);
  });

  it("그림이 오기 전에도 칸은 제자리에 있다 — 나중에 채워져도 카드가 밀리지 않게", async () => {
    let finish: (blob: Blob) => void = () => undefined;
    // 첫 장만 멈춰 두고, 나머지는 곧바로 준다. 줄은 하나라서 멈춘 일이 남으면 뒤 시험을 세운다.
    let asked = 0;
    previewFromFile.mockImplementation(() =>
      asked++ === 0 ? new Promise<Blob>((resolve) => (finish = resolve)) : Promise.resolve(new Blob(["x"])),
    );
    const { container } = render(<TripThumbs files={files(3)} />);
    await waitFor(() => expect(previewFromFile).toHaveBeenCalled());
    expect(tiles(container)).toHaveLength(3);
    expect(images(container)).toHaveLength(0);
    // 멈춰 둔 일은 줄을 막으니, 시험이 끝나기 전에 풀어 준다.
    finish(new Blob(["x"]));
    await waitFor(() => expect(images(container)).toHaveLength(3));
  });

  it("열지 못하는 사진은 칸을 비워 두고 나머지는 보인다", async () => {
    previewFromFile.mockImplementation(async (_file, name) => {
      if (name === "1.jpg") throw new Error("HEIC");
      return new Blob(["thumb"]);
    });
    const { container } = render(<TripThumbs files={files(3)} />);
    await waitFor(() => expect(images(container)).toHaveLength(2));
    expect(tiles(container)).toHaveLength(3);
  });

  it("한 번에 하나씩 펼친다 — 열 장이 동시에 펼쳐져 폰이 버거워지지 않게", async () => {
    let running = 0;
    let most = 0;
    previewFromFile.mockImplementation(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 3));
      running -= 1;
      return new Blob(["x"]);
    });
    const a = render(<TripThumbs files={files(3)} />);
    const b = render(<TripThumbs files={files(3)} />);
    await waitFor(() => expect(images(a.container)).toHaveLength(3));
    await waitFor(() => expect(images(b.container)).toHaveLength(3));
    expect(most).toBe(1);
  });

  it("사라질 때 만든 주소를 거둔다 — 메모리에 남지 않게", async () => {
    const { container, unmount } = render(<TripThumbs files={files(3)} />);
    await waitFor(() => expect(images(container)).toHaveLength(3));
    unmount();
    expect(revoked.sort()).toEqual([...made].sort());
  });

  it("사라진 뒤에 도착한 그림은 쓰지 않는다", async () => {
    let finish: (blob: Blob) => void = () => undefined;
    previewFromFile.mockImplementationOnce(() => new Promise<Blob>((resolve) => (finish = resolve)));
    const { unmount } = render(<TripThumbs files={files(2)} />);
    await waitFor(() => expect(previewFromFile).toHaveBeenCalled());
    unmount();
    await act(async () => finish(new Blob(["late"])));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("그림은 장식이다 — 화면 읽기 도구가 읽지 않는다", async () => {
    const { container } = render(<TripThumbs files={files(1)} />);
    await waitFor(() => expect(images(container)).toHaveLength(1));
    expect((container.firstElementChild as HTMLElement).getAttribute("aria-hidden")).toBe("true");
    expect(images(container)[0].getAttribute("alt")).toBe("");
  });

  /*
    카드가 다시 그려질 때마다(제목을 한 글자 칠 때, 다른 카드를 열 때) 부르는 쪽은 같은 사진으로 새 배열을
    만들어 건넨다. 배열이 새로 왔다고 그림을 지우고 다시 구우면 한 글자마다 그림이 깜빡이고 폰이 같은 사진을
    계속 다시 펼친다. 사진이 정말 바뀌면 부르는 쪽이 key 를 바꿔 새로 시작한다.
  */
  it("같은 사진으로 다시 그려져도 그림을 다시 굽지 않고, 만든 주소도 거두지 않는다", async () => {
    const { container, rerender } = render(<TripThumbs files={files(3)} />);
    await waitFor(() => expect(images(container)).toHaveLength(3));
    const before = images(container).map((img) => img.getAttribute("src"));

    rerender(<TripThumbs files={files(3)} />);
    rerender(<TripThumbs files={files(3)} />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(previewFromFile).toHaveBeenCalledTimes(3);
    expect(revoked).toEqual([]);
    expect(images(container).map((img) => img.getAttribute("src"))).toEqual(before);
  });

  it("key 를 바꿔 다시 그리면 새 사진으로 새로 시작한다 — 옛 주소는 거둔다", async () => {
    const { container, rerender } = render(<TripThumbs key="a" files={files(2)} />);
    await waitFor(() => expect(images(container)).toHaveLength(2));
    const first = [...made];

    rerender(<TripThumbs key="b" files={files(3)} />);
    await waitFor(() => expect(images(container)).toHaveLength(3));
    expect([...revoked].sort()).toEqual([...first].sort());
  });

  it("사진이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<TripThumbs files={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("화면 가까이 올 때까지", () => {
    let reach: () => void = () => undefined;
    let watching = 0;

    beforeEach(() => {
      watching = 0;
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(callback: IntersectionObserverCallback) {
            reach = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
          }
          observe() {
            watching += 1;
          }
          unobserve() {}
          disconnect() {}
        },
      );
    });

    it("멀리 있는 카드의 사진은 펼치지 않는다", async () => {
      const { container } = render(<TripThumbs files={files(3)} />);
      expect(watching).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(previewFromFile).not.toHaveBeenCalled();
      expect(images(container)).toHaveLength(0);
    });

    it("가까이 오면 그때 펼친다", async () => {
      const { container } = render(<TripThumbs files={files(3)} />);
      act(() => reach());
      await waitFor(() => expect(images(container)).toHaveLength(3));
    });
  });
});
