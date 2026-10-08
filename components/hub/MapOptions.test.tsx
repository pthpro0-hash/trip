import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MapOptions } from "./MapOptions";

/*
  지도 위 왼쪽에 칩 둘("시도 3/17", "100선 겹쳐 보기")이 늘 떠 있었다. 처음 보는 사람에게는 "시도 3/17"이 무엇을 세는
  것인지, "100선 겹쳐 보기"가 켜고 끄는 것인지 알기 어렵고, 지도를 가리는 것이 둘이다. 단추 하나("지도 옵션")로 합치고
  눌러야 두 가지가 나온다. 지도 위에는 단추 하나만 남는다.
*/

function options(props: Partial<ComponentProps<typeof MapOptions>> = {}) {
  const onSido = vi.fn();
  const onCurated = vi.fn();
  const view = render(<MapOptions sidoCount={3} curatedOn={false} onSido={onSido} onCurated={onCurated} {...props} />);
  return { ...view, onSido, onCurated };
}

const trigger = () => screen.getByRole("button", { name: "지도 옵션" });
const open = () => fireEvent.click(trigger());

describe("MapOptions", () => {
  it("처음에는 단추 하나만 있다 — 칩 둘이 지도를 가리지 않는다", () => {
    options();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /다녀온 시도/ })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("누르면 두 가지가 나온다 — 다녀온 시도, 100선 겹쳐 보기", () => {
    options();
    open();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /다녀온 시도 3\/17/ })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "100선 겹쳐 보기" })).toHaveAttribute("aria-checked", "false");
  });

  it("시도 수를 아직 모르면 …로 보인다 — 경계를 받아 오는 동안", () => {
    options({ sidoCount: null });
    open();
    expect(screen.getByRole("button", { name: /다녀온 시도 …\/17/ })).toBeTruthy();
  });

  it("다녀온 시도를 누르면 알리고 닫는다", () => {
    const { onSido } = options();
    open();
    fireEvent.click(screen.getByRole("button", { name: /다녀온 시도/ }));
    expect(onSido).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("100선 겹쳐 보기는 켜고 끄는 스위치다 — 누르면 알리고 닫는다", () => {
    const { onCurated } = options();
    open();
    fireEvent.click(screen.getByRole("switch", { name: "100선 겹쳐 보기" }));
    expect(onCurated).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("켜져 있으면 스위치가 켜진 모습이다", () => {
    options({ curatedOn: true });
    open();
    expect(screen.getByRole("switch", { name: "100선 겹쳐 보기" })).toHaveAttribute("aria-checked", "true");
  });

  it("단추를 다시 누르면 닫힌다", () => {
    options();
    open();
    open();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("Esc 로 닫는다", () => {
    options();
    open();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("바깥을 누르면 닫고, 안쪽을 누르면 닫지 않는다", () => {
    options();
    open();
    fireEvent.pointerDown(screen.getByRole("group", { name: "지도 옵션" }));
    expect(screen.getByRole("switch")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  describe("100선을 겹쳐 보는 동안", () => {
    it("무엇이 어떤 동그라미인지 알리는 범례가 지도 위에 남는다 — 창이 닫혀 있어도", () => {
      const { container } = options({ curatedOn: true });
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      expect(container).toHaveTextContent("아직 안 간 곳");
      expect(container).toHaveTextContent("가고 싶은 곳");
    });

    it("단추가 켜진 모습이라 켜 둔 것이 보인다", () => {
      options({ curatedOn: true });
      expect(trigger().className).toContain("bg-accent");
    });

    it("꺼져 있으면 범례도 켜진 모습도 없다", () => {
      const { container } = options({ curatedOn: false });
      expect(container).not.toHaveTextContent("아직 안 간 곳");
      expect(trigger().className).not.toContain("bg-accent");
    });
  });
});
