import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { todayKey } from "@/lib/welcome";

/*
  로그인 전 첫 방문자에게 뜨는 환영 팝업. 이 서비스가 무엇을 해 주는지를 약속 한 줄·설명 한 줄·3단계·단추 하나로
  말한다. 화면 맨 위에 끼워 넣으면 아래(여행 100선)가 밀리고 영역이 구분되지 않아, 뒤를 어둡게 하는 팝업으로 둔다.
*/

let user: { id: string } | null = null;
let failToAsk = false;
vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({
    auth: {
      getUser: async () => {
        if (failToAsk) throw new Error("network");
        return { data: { user } };
      },
    },
  }),
}));

const { WelcomeDialog } = await import("./WelcomeDialog");

const setReferrer = (value: string) =>
  Object.defineProperty(document, "referrer", { value, configurable: true });

const 팝업 = () => screen.findByRole("dialog", { name: /사진만 고르면/ });

describe("WelcomeDialog", () => {
  beforeEach(() => {
    user = null;
    failToAsk = false;
    window.localStorage.clear();
    window.sessionStorage.clear();
    setReferrer("");
    document.body.style.overflow = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("뜰 때", () => {
    it("로그인 전 첫 방문이면 뜬다 — 약속 한 줄이 제목이다", async () => {
      render(<WelcomeDialog />);
      const dialog = await 팝업();
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent("사진만 고르면, 여행이 정리돼요");
    });

    it("서비스 이름과 설명 한 줄이 있다", async () => {
      render(<WelcomeDialog />);
      const dialog = await 팝업();
      expect(within(dialog).getByText("내 여행 스케치")).toBeTruthy();
      expect(within(dialog).getByText("날짜와 장소로 묶고, 지도와 한 장짜리 카드로 만들어 드려요.")).toBeTruthy();
    });

    it("무엇이 되는지 3단계로 보여 준다 — 예시 그림 대신", async () => {
      const { container } = render(<WelcomeDialog />);
      const dialog = await 팝업();
      const steps = within(dialog).getByRole("list", { name: "이렇게 돼요" });
      const labels = within(steps)
        .getAllByRole("listitem")
        .map((item) => item.textContent?.replace("›", "").trim());
      expect(labels).toEqual(["사진 고르기", "저절로 정리", "지도·한 장 카드"]);
      expect(container.querySelector("img")).toBeNull();
    });

    it("누를 단추는 하나 — '사진 고르기'가 로그인 없이 사진 고르는 화면으로 간다", async () => {
      render(<WelcomeDialog />);
      const dialog = await 팝업();
      expect(within(dialog).getByRole("link", { name: "사진 고르기" })).toHaveAttribute("href", "/trips/new");
      expect(within(dialog).queryByRole("link", { name: /로그인/ })).toBeNull();
    });

    it("안심 한 줄 — 고르는 동안 사진은 기기 밖으로 나가지 않고, 기록할 때 로그인한다", async () => {
      render(<WelcomeDialog />);
      const dialog = await 팝업();
      expect(within(dialog).getByText(/고르는 동안 사진은 이 기기 밖으로 나가지 않아요/)).toBeTruthy();
      expect(within(dialog).getByText("기록으로 남길 때 로그인해요")).toBeTruthy();
      // 기록할 때 사진을 올릴 수 있으니 "올라가지 않아요"라고 약속하지 않는다.
      expect(dialog.textContent).not.toContain("올라가지 않아요");
    });

    it("닫는 길이 셋 있다 — 오늘 그만 보기, 나중에, ✕", async () => {
      render(<WelcomeDialog />);
      const dialog = await 팝업();
      expect(within(dialog).getByRole("button", { name: "오늘 그만 보기" })).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "나중에" })).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "닫기" })).toBeTruthy();
    });

    it("뜨는 동안 뒤 화면은 굴러가지 않는다", async () => {
      render(<WelcomeDialog />);
      await 팝업();
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("서버가 그린 첫 그림에는 없다 — 브라우저에서만 그려서 검색엔진이 받는 본문에는 들어가지 않는다", () => {
      expect(renderToStaticMarkup(<WelcomeDialog />)).toBe("");
    });
  });

  describe("안 뜰 때", () => {
    it("로그인한 사람에게는 안 뜬다", async () => {
      user = { id: "나" };
      render(<WelcomeDialog />);
      // 로그인 여부를 묻는 것이 끝날 때까지 기다린 뒤에도 없어야 한다.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("로그인 여부를 못 물었으면 안 뜬다 — 쓰는 사람을 귀찮게 하는 쪽이 더 나쁘다", async () => {
      failToAsk = true;
      render(<WelcomeDialog />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("검색 결과에서 바로 넘어온 사람에게는 안 뜬다", async () => {
      setReferrer("https://www.google.com/");
      render(<WelcomeDialog />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("검색에서 온 방문은 이번 방문 내내 안 뜬다 — 새로 고쳐 출처가 사라져도", async () => {
      setReferrer("https://search.naver.com/search.naver?query=x");
      const first = render(<WelcomeDialog />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      first.unmount();

      setReferrer("");
      render(<WelcomeDialog />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("카톡 링크나 주소 직접 입력(출처 없음)이면 뜬다", async () => {
      setReferrer("");
      render(<WelcomeDialog />);
      expect(await 팝업()).toBeTruthy();
    });

    it("메일이나 블로그에서 온 사람에게는 뜬다 — 검색이 아니다", async () => {
      setReferrer("https://blog.naver.com/someone/1");
      render(<WelcomeDialog />);
      expect(await 팝업()).toBeTruthy();
    });

    it("저장소가 막혀 있으면 안 뜬다 — 닫아도 기억하지 못해 올 때마다 뜬다", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("막힘");
      });
      render(<WelcomeDialog />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("닫을 때", () => {
    it("'오늘 그만 보기'는 닫고, 오늘 하루는 다시 안 뜬다 — 새로 열어도", async () => {
      const first = render(<WelcomeDialog />);
      fireEvent.click(within(await 팝업()).getByRole("button", { name: "오늘 그만 보기" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(window.localStorage.getItem("welcome:snooze")).toBe(todayKey());
      first.unmount();

      // 새 방문(탭을 닫았다 열었다)이어도 오늘은 안 뜬다.
      window.sessionStorage.clear();
      render(<WelcomeDialog />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("그만 본 날이 어제였으면 오늘은 다시 뜬다", async () => {
      window.localStorage.setItem("welcome:snooze", todayKey(new Date(Date.now() - 24 * 60 * 60 * 1000)));
      render(<WelcomeDialog />);
      expect(await 팝업()).toBeTruthy();
    });

    it("'나중에'는 이번 방문만 닫는다 — 같은 방문에는 다시 안 뜨고, 새 방문에는 또 뜬다", async () => {
      const first = render(<WelcomeDialog />);
      fireEvent.click(within(await 팝업()).getByRole("button", { name: "나중에" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      // 오늘 그만 보기를 누른 것은 아니다.
      expect(window.localStorage.getItem("welcome:snooze")).toBeNull();
      first.unmount();

      // 같은 방문(새로 고침)에는 안 뜬다.
      const second = render(<WelcomeDialog />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole("dialog")).toBeNull();
      second.unmount();

      // 새 방문(탭을 닫았다 열었다)에는 또 뜬다.
      window.sessionStorage.clear();
      render(<WelcomeDialog />);
      expect(await 팝업()).toBeTruthy();
    });

    it("✕ 도 나중에와 같다", async () => {
      render(<WelcomeDialog />);
      fireEvent.click(within(await 팝업()).getByRole("button", { name: "닫기" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(window.localStorage.getItem("welcome:snooze")).toBeNull();
    });

    it("Esc 로 닫힌다", async () => {
      render(<WelcomeDialog />);
      await 팝업();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("바깥을 누르면 닫히고, 안쪽을 눌러서는 닫히지 않는다", async () => {
      render(<WelcomeDialog />);
      const dialog = await 팝업();
      fireEvent.click(dialog);
      expect(screen.queryByRole("dialog")).not.toBeNull();
      fireEvent.click(dialog.parentElement!);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("'사진 고르기'를 누르면 닫힌다 — 돌아와도 다시 뜨지 않게", async () => {
      render(<WelcomeDialog />);
      const link = within(await 팝업()).getByRole("link", { name: "사진 고르기" });
      // 실제로 이동하지는 않는다.
      link.addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(link);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("닫으면 뒤 화면이 다시 굴러간다", async () => {
      render(<WelcomeDialog />);
      fireEvent.click(within(await 팝업()).getByRole("button", { name: "나중에" }));
      await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
    });
  });
});
