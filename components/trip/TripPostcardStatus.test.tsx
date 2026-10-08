import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TripPostcardLine } from "@/lib/supabase/postcards";
import { TripPostcardStatus } from "./TripPostcardStatus";

/*
  엽서를 보내고 나면 궁금한 것은 하나다 — 부모님이 열어 보셨나. 예전에는 ‘내 정보 → 가족 책장’의 보낸 엽서 목록을 열어야 알 수
  있었다. 여행 상세의 공유 줄 아래에 받는 곳마다 한 줄로 알려 준다.
*/

const line = (over: Partial<TripPostcardLine> = {}): TripPostcardLine => ({
  mailboxId: "m1",
  name: "우리 엄마 아빠",
  greetingName: "엄마 아빠",
  opened: false,
  ...over,
});

describe("TripPostcardStatus", () => {
  it("보낸 엽서가 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<TripPostcardStatus lines={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("아직 안 열어 보셨으면 그렇게 말한다", () => {
    render(<TripPostcardStatus lines={[line()]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("엄마 아빠께 엽서를 보냈어요 · 아직 안 열어 보셨어요");
  });

  it("열어 보셨으면 열어 보셨다고 말한다", () => {
    render(<TripPostcardStatus lines={[line({ opened: true })]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("엄마 아빠께 엽서를 보냈어요 · 열어 보셨어요 ✓");
    expect(screen.queryByText(/아직 안 열어/)).toBeNull();
  });

  it("체크 표시는 소리 내어 읽지 않는다 — ‘열어 보셨어요’가 이미 말하고 있다", () => {
    const { container } = render(<TripPostcardStatus lines={[line({ opened: true })]} />);
    const mark = [...container.querySelectorAll("[aria-hidden=true]")].find((node) => node.textContent === "✓");
    expect(mark).toBeTruthy();
  });

  it("부르는 말이 없는 책장은 책장 이름으로 말한다", () => {
    render(<TripPostcardStatus lines={[line({ greetingName: null, name: "장인 장모님 책장" })]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("장인 장모님 책장에 엽서를 보냈어요 · 아직 안 열어 보셨어요");
  });

  it("받는 곳이 여럿이면 한 곳에 한 줄씩", () => {
    render(
      <TripPostcardStatus
        lines={[line({ opened: true }), line({ mailboxId: "m2", greetingName: "장모님", name: "장인 장모님 책장" })]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("엄마 아빠께 엽서를 보냈어요 · 열어 보셨어요 ✓");
    expect(items[1]).toHaveTextContent("장모님께 엽서를 보냈어요 · 아직 안 열어 보셨어요");
  });

  it("목록에 이름이 있다 — 화면 낭독기가 ‘보낸 엽서’라고 알린다", () => {
    render(<TripPostcardStatus lines={[line()]} />);
    expect(screen.getByRole("list", { name: "보낸 엽서" })).toBeTruthy();
  });
});
