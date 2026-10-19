import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

/*
  크게 볼 사진의 주소를 보고 있는 자리 앞뒤로 한 번에 미리 받아 둔다. 넘길 때마다 한 장씩 묻느라 느리던 것을 없앤다.
*/
const signedUrls = vi.fn<(client: unknown, paths: string[]) => Promise<Map<string, string>>>();
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({}) }));
vi.mock("@/lib/supabase/photos", () => ({ signedUrls: (client: unknown, paths: string[]) => signedUrls(client, paths) }));
const { nearIndexes, useBigPhotos } = await import("./useBigPhotos");

const paths = Array.from({ length: 10 }, (_, i) => `u/v/${i}.webp`);
const answer = (asked: string[]) => new Map(asked.map((path) => [path, `https://서명/${path}`]));

beforeEach(() => {
  signedUrls.mockReset();
  signedUrls.mockImplementation(async (_client, asked) => answer(asked));
});

describe("nearIndexes", () => {
  it("보고 있는 것이 맨 앞이고, 다음 쪽을 더 멀리까지 잡는다", () => {
    expect(nearIndexes(5, 10)).toEqual([5, 6, 4, 7, 8]);
  });

  it("끝에서는 처음으로 돌아 센다", () => {
    expect(nearIndexes(9, 10)).toEqual([9, 0, 8, 1, 2]);
    expect(nearIndexes(0, 10)).toEqual([0, 1, 9, 2, 3]);
  });

  it("사진이 적으면 겹치지 않게 있는 것만", () => {
    expect(nearIndexes(0, 2)).toEqual([0, 1]);
    expect(nearIndexes(0, 1)).toEqual([0]);
    expect(nearIndexes(0, 0)).toEqual([]);
  });
});

describe("useBigPhotos", () => {
  it("보고 있지 않을 때는 아무것도 묻지 않는다", () => {
    const { result } = renderHook(() => useBigPhotos(paths, null));
    expect(signedUrls).not.toHaveBeenCalled();
    expect(result.current(0)).toBeNull();
  });

  it("열면 보고 있는 자리 앞뒤를 한 번의 요청으로 묻고, 번호로 주소를 찾는다", async () => {
    const { result } = renderHook(() => useBigPhotos(paths, 5));
    await waitFor(() => expect(result.current(5)).toBe("https://서명/u/v/5.webp"));
    expect(signedUrls).toHaveBeenCalledTimes(1);
    expect(signedUrls.mock.calls[0][1]).toEqual([5, 6, 4, 7, 8].map((i) => paths[i]));
    expect(result.current(6)).toBe("https://서명/u/v/6.webp");
    // 멀리 있는 것은 아직 모른다.
    expect(result.current(0)).toBeNull();
  });

  it("넘기면 새로 필요한 것만 묻는다 — 이미 받은 것은 다시 묻지 않는다", async () => {
    const { result, rerender } = renderHook(({ at }) => useBigPhotos(paths, at), { initialProps: { at: 5 } });
    await waitFor(() => expect(result.current(5)).not.toBeNull());
    rerender({ at: 6 });
    await waitFor(() => expect(signedUrls).toHaveBeenCalledTimes(2));
    // 6 이 보이는 자리의 앞뒤(6 7 5 8 9) 가운데 새 것은 9 뿐이다.
    expect(signedUrls.mock.calls[1][1]).toEqual([paths[9]]);
    await waitFor(() => expect(result.current(9)).not.toBeNull());
  });

  it("이미 다 받은 자리로 넘기면 묻지 않는다", async () => {
    const { result, rerender } = renderHook(({ at }) => useBigPhotos(paths, at), { initialProps: { at: 5 } });
    await waitFor(() => expect(result.current(5)).not.toBeNull());
    signedUrls.mockClear();
    rerender({ at: 5 });
    rerender({ at: 6 });
    rerender({ at: 5 });
    await act(async () => undefined);
    // 5 → 6 만 새 것(9)이 있다. 다시 5 로 돌아온 것은 묻지 않는다.
    expect(signedUrls).toHaveBeenCalledTimes(1);
  });

  it("목록이 같은 내용이면(그릴 때마다 새 배열이어도) 다시 묻지 않는다", async () => {
    const { result, rerender } = renderHook(() => useBigPhotos([...paths], 5));
    await waitFor(() => expect(result.current(5)).not.toBeNull());
    rerender();
    rerender();
    await act(async () => undefined);
    expect(signedUrls).toHaveBeenCalledTimes(1);
  });

  it("못 받은 것은 다음에 다시 묻는다 — 한 번 실패해서 영영 비지 않게", async () => {
    signedUrls.mockRejectedValueOnce(new Error("망"));
    const { result, rerender } = renderHook(({ at }) => useBigPhotos(paths, at), { initialProps: { at: 5 } });
    await act(async () => undefined);
    expect(result.current(5)).toBeNull();
    rerender({ at: 6 });
    await waitFor(() => expect(result.current(6)).not.toBeNull());
    // 처음에 실패한 5 도 이번 요청에 다시 실렸다.
    expect(signedUrls.mock.calls[1][1]).toContain(paths[5]);
  });

  it("주소를 일부만 돌려줘도 받은 것은 쓰고, 못 받은 것은 비워 둔다", async () => {
    signedUrls.mockImplementationOnce(async (_c, asked) => answer(asked.slice(0, 1)));
    const { result } = renderHook(() => useBigPhotos(paths, 5));
    await waitFor(() => expect(result.current(5)).not.toBeNull());
    expect(result.current(6)).toBeNull();
  });

  it("사진이 없으면 아무것도 하지 않는다", () => {
    renderHook(() => useBigPhotos([], 0));
    expect(signedUrls).not.toHaveBeenCalled();
  });
});
