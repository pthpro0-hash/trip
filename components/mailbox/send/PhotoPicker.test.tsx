import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoPicker } from "./PhotoPicker";

/*
  엽서에 실을 사진은 자동으로 골라 둔다(곳마다 골고루). 사람 대부분은 그대로 보내는데, 예전에는 스무 장 가까운 사진
  격자가 창 맨 위를 차지했다. 접어 두고 "사진 12장을 골라 뒀어요 · 바꾸기"로 말한다 — 바꾸고 싶은 사람만 연다.
*/

const photos = ["a", "b", "c", "d"].map((id) => ({ id, storagePath: `u/${id}.webp` }));
const urls = new Map(photos.map((photo) => [photo.storagePath, `https://x/${photo.id}`]));

function picker(props: Partial<ComponentProps<typeof PhotoPicker>> = {}) {
  const onToggle = vi.fn();
  const onReset = vi.fn();
  const view = render(
    <PhotoPicker
      photos={photos}
      urls={urls}
      picked={["a", "b", "c"]}
      limit={20}
      limitNote={null}
      manual={false}
      onToggle={onToggle}
      onReset={onReset}
      {...props}
    />,
  );
  return { ...view, onToggle, onReset };
}

const toggle = () => screen.getByRole("button", { name: /바꾸기|접기/ });

describe("PhotoPicker", () => {
  it("처음에는 접혀 있고 몇 장을 골라 뒀는지만 말한다", () => {
    picker();
    expect(screen.getByText("사진 3장을 골라 뒀어요")).toBeTruthy();
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "엽서에서 빼기" })).toBeNull();
  });

  it("바꾸기를 누르면 사진 격자가 펼쳐진다 — 고른 수와 한도와 함께", () => {
    picker();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("3/20")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "엽서에서 빼기" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "엽서에 넣기" })).toHaveLength(1);
  });

  it("다시 누르면 접힌다", () => {
    picker();
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(screen.queryByRole("button", { name: "엽서에서 빼기" })).toBeNull();
  });

  it("사진을 누르면 넣고 뺀다고 알린다", () => {
    const { onToggle } = picker();
    fireEvent.click(toggle());
    fireEvent.click(screen.getAllByRole("button", { name: "엽서에서 빼기" })[1]);
    expect(onToggle).toHaveBeenLastCalledWith("b");
    fireEvent.click(screen.getByRole("button", { name: "엽서에 넣기" }));
    expect(onToggle).toHaveBeenLastCalledWith("d");
  });

  it("고른 사진에는 몇 번째로 실리는지 번호가 붙는다 — 고른 차례가 아니라 엽서에 실리는(여행) 차례로", () => {
    // 엽서는 여행 차례(a → c)대로 실린다. 나중에 눌러 넣은 사진이라고 뒤로 가지 않는다.
    picker({ picked: ["c", "a"] });
    fireEvent.click(toggle());
    const on = screen.getAllByRole("button", { name: "엽서에서 빼기" });
    expect(on[0]).toHaveTextContent("1");
    expect(on[1]).toHaveTextContent("2");
    for (const button of on) expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("단추 이름이 무엇을 바꾸는지 말한다 — 같은 창의 다른 ‘바꾸기’와 헷갈리지 않게", () => {
    picker();
    expect(screen.getByRole("button", { name: "사진 바꾸기" })).toBeTruthy();
    fireEvent.click(toggle());
    expect(screen.getByRole("button", { name: "사진 접기" })).toBeTruthy();
  });

  it("한도에 닿으면 나머지는 막힌다", () => {
    picker({ picked: ["a", "b", "c"], limit: 3 });
    fireEvent.click(toggle());
    expect(screen.getByRole("button", { name: "엽서에 넣기" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "엽서에서 빼기" })[0]).toBeEnabled();
  });

  it("직접 고른 뒤에는 추천으로 되돌리는 길이 있다", () => {
    const { onReset } = picker({ manual: true });
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name: "추천으로 고르기" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("자동으로 골라 둔 채면 되돌리는 단추가 없다", () => {
    picker({ manual: false });
    fireEvent.click(toggle());
    expect(screen.queryByRole("button", { name: "추천으로 고르기" })).toBeNull();
  });

  it("한도 때문에 줄어든 까닭을 접어 둔 채로도 알려 준다 — 펼쳐야 알 수 있으면 ‘왜 6장이지?’가 된다", () => {
    picker({ limitNote: "책장 설정에 따라 6장까지 고를 수 있어요." });
    expect(screen.getByText("책장 설정에 따라 6장까지 고를 수 있어요.")).toBeTruthy();
    // 펼쳐도 한 번만 나온다.
    fireEvent.click(toggle());
    expect(screen.getAllByText("책장 설정에 따라 6장까지 고를 수 있어요.")).toHaveLength(1);
  });

  it("까닭이 없으면 말하지 않는다", () => {
    const { container } = picker({ limitNote: null });
    expect(container.textContent).not.toContain("고를 수 있어요");
  });

  it("사진 그림은 필요할 때만 받는다 — 사진이 많은 여행도 창이 가볍게 열린다", () => {
    const { container } = picker();
    fireEvent.click(toggle());
    const images = [...container.querySelectorAll("img")];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(image.getAttribute("loading")).toBe("lazy");
  });

  it("하나도 고르지 않았으면 그렇게 말한다", () => {
    picker({ picked: [] });
    expect(screen.getByText("사진을 고르지 않았어요 — 글과 지도만 가요")).toBeTruthy();
  });

  it("이 여행에 사진이 없으면 펼칠 것도 없다", () => {
    picker({ photos: [], picked: [] });
    expect(screen.getByText("이 여행에는 사진이 없어요. 글과 지도만 가요.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /바꾸기|접기/ })).toBeNull();
  });
});
