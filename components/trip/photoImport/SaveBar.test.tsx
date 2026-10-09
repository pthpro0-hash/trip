import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SaveBar } from "./SaveBar";

/*
  기록하는 단추는 길게 늘어선 카드 목록의 맨 아래에 있었다. 카드가 열 장이면 단추까지 한참 내려가야 했고,
  "이제 뭘 눌러야 하지?"를 찾아야 했다. 막대로 화면 아래에 붙여 두면 어디에 있든 다음 걸음이 보인다.
*/
function bar(props: Partial<ComponentProps<typeof SaveBar>> = {}) {
  const onSave = vi.fn();
  const onWithPhotos = vi.fn();
  const view = render(
    <SaveBar mode="save" count={2} saving={false} withPhotos onWithPhotos={onWithPhotos} onSave={onSave} {...props} />,
  );
  return { ...view, onSave, onWithPhotos };
}

/**
 * 링크를 눌러 보고, 앱이 이동(기본 동작)을 막았는지 알려 준다. 막지 않은 클릭은 jsdom 이 실제로 이동하려 들어 소리를 내므로,
 * 앱의 처리가 모두 끝난 맨 마지막에 우리가 막는다.
 */
function clickLink(link: HTMLElement): boolean {
  let prevented = false;
  const last = (event: Event) => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener("click", last);
  fireEvent.click(link);
  document.removeEventListener("click", last);
  return prevented;
}

describe("SaveBar · 기록하기", () => {
  it("기록할 건수를 단추에 적는다", () => {
    bar({ count: 3 });
    expect(screen.getByRole("button", { name: "여행 3건 기록하기" })).toBeEnabled();
  });

  it("누르면 기록을 시작한다", () => {
    const { onSave } = bar();
    fireEvent.click(screen.getByRole("button", { name: /기록하기/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("사진도 함께 올릴지 막대에서 고른다 — 올리면 무엇이 되는지 한 줄로 알린다", () => {
    const { onWithPhotos } = bar({ withPhotos: true });
    const box = screen.getByRole("checkbox", { name: /사진도 함께 올리기/ });
    expect(box).toBeChecked();
    expect(screen.getByText("줄여서 올리고 원본은 보관하지 않아요")).toBeTruthy();
    fireEvent.click(box);
    expect(onWithPhotos).toHaveBeenCalledWith(false);
  });

  it("끈 상태로 보여 준다", () => {
    bar({ withPhotos: false });
    expect(screen.getByRole("checkbox", { name: /사진도 함께 올리기/ })).not.toBeChecked();
  });

  it("기술 용어(픽셀 수)를 내밀지 않는다", () => {
    const { container } = bar();
    expect(container.textContent).not.toMatch(/2048|px/);
  });

  it("모두 이미 기록한 날짜면 누를 수 없고 그렇다고 말한다", () => {
    bar({ count: 0 });
    expect(screen.getByRole("button", { name: "모두 이미 기록했어요" })).toBeDisabled();
  });

  it("기록하는 동안에는 누를 수 없다 — 두 번 누르면 같은 사진이 두 번 올라간다", () => {
    bar({ saving: true });
    expect(screen.getByRole("button", { name: "기록하는 중…" })).toBeDisabled();
  });

  it("화면 아래에 붙는다 — 글자 입력과 기기 아래 막대(홈 바)를 피해서", () => {
    const { container } = bar();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("sticky");
    expect(root.className).toContain("bottom-0");
    expect(root.className).toContain("safe-area-inset-bottom");
  });
});

describe("SaveBar · 로그인하고 기록하기", () => {
  it("로그인 전이면 로그인 길을 내민다 — 돌아올 곳은 이 화면이다", () => {
    bar({ mode: "login" });
    const link = screen.getByRole("link", { name: "로그인하고 기록하기" });
    expect(link).toHaveAttribute("href", "/login?next=%2Ftrips%2Fnew");
  });

  it("찾은 결과가 로그인 뒤에 이어지지 않는다는 것을 솔직히 말한다", () => {
    bar({ mode: "login" });
    expect(screen.getByText("로그인한 뒤 같은 사진을 한 번 더 골라 주세요")).toBeTruthy();
  });

  it("로그인 전에는 올릴 사진을 고르는 칸도, 기록 단추도 없다", () => {
    bar({ mode: "login" });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /기록하기/ })).toBeNull();
  });

  // 사진을 맡아 둘 수 있으면(onLogin) 로그인 뒤에 그대로 이어서 기록한다. 맡아 둘 수 없으면 예전 길 그대로다 — 링크가 곧바로 로그인으로
  // 가고, 같은 사진을 한 번 더 골라야 한다고 솔직히 말한다.
  describe("사진을 맡아 둘 수 있을 때(onLogin)", () => {
    it("로그인한 뒤 그대로 이어서 기록한다고 말한다 — 같은 사진을 다시 고르라고 하지 않는다", () => {
      bar({ mode: "login", onLogin: vi.fn() });
      expect(screen.getByText("로그인한 뒤 이 여행들을 그대로 이어서 기록해요")).toBeTruthy();
      expect(screen.queryByText(/한 번 더 골라/)).toBeNull();
    });

    it("누르면 링크가 곧바로 떠나지 않고 먼저 부르는 쪽이 사진을 준비한다", () => {
      const onLogin = vi.fn();
      bar({ mode: "login", onLogin });
      const link = screen.getByRole("link", { name: "로그인하고 기록하기" });
      expect(clickLink(link)).toBe(true);
      expect(onLogin).toHaveBeenCalledTimes(1);
    });

    it("그래도 링크다 — 가야 할 곳(돌아올 곳은 이 화면)이 주소에 있다", () => {
      bar({ mode: "login", onLogin: vi.fn() });
      expect(screen.getByRole("link", { name: "로그인하고 기록하기" })).toHaveAttribute("href", "/login?next=%2Ftrips%2Fnew");
    });
  });

  it("맡아 두려다 못 했다는 말(notice)은 단추 바로 위에 붙고, 아래 안내는 그대로 남는다", () => {
    const { container } = bar({ mode: "login", notice: "이 브라우저에서는 사진을 잠깐 맡아 둘 수 없어요" });
    const notice = screen.getByRole("status");
    expect(notice.textContent).toBe("이 브라우저에서는 사진을 잠깐 맡아 둘 수 없어요");
    // 단추보다 앞에 있다.
    const link = screen.getByRole("link", { name: "로그인하고 기록하기" });
    expect(notice.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).toContain("로그인한 뒤 같은 사진을 한 번 더 골라 주세요");
  });

  it("알릴 말이 없으면 알림 칸을 두지 않는다", () => {
    bar({ mode: "login" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("사진을 맡아 둘 수 없으면(onLogin 없음) 누르면 그대로 로그인으로 간다", () => {
    bar({ mode: "login" });
    expect(clickLink(screen.getByRole("link", { name: "로그인하고 기록하기" }))).toBe(false);
  });
});
