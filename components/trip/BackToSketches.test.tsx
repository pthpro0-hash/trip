import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackToSketches, backLabel } from "./BackToSketches";
import { tripFocus } from "@/lib/scrollMemory";

/*
  여행 상세는 지도에서도, 목록에서도 열린다. 돌아갈 곳은 떠나올 때
  적어 둔 곳이다.
*/
describe("BackToSketches", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("적어 둔 곳이 없으면 목록으로", () => {
    render(<BackToSketches tripId="t1" />);
    expect(screen.getByRole("link", { name: "← 내 스케치" })).toHaveAttribute("href", "/trips");
  });

  it("지도에서 왔으면 지도로", () => {
    tripFocus.rememberFrom("/?v=sketch");
    render(<BackToSketches tripId="t1" />);
    expect(screen.getByRole("link", { name: "← 내 스케치" })).toHaveAttribute("href", "/?v=sketch");
  });

  it("바깥 주소는 따라가지 않는다", () => {
    tripFocus.rememberFrom("//남의곳");
    render(<BackToSketches tripId="t1" />);
    expect(screen.getByRole("link", { name: "← 내 스케치" })).toHaveAttribute("href", "/trips");
  });

  it("누르면 이 여행 앞에 세워 달라고 적어 둔다", () => {
    render(<BackToSketches tripId="t1" />);
    fireEvent.click(screen.getByRole("link", { name: "← 내 스케치" }));
    expect(tripFocus.peek()).toBe("t1");
  });
});

describe("backLabel", () => {
  it("같은 이름 모아 보기에서 왔으면 그 곳 이름으로 돌아간다", () => {
    expect(backLabel(`/places?name=${encodeURIComponent("안목해변")}`)).toBe("← 안목해변");
  });

  it("그 밖에는 내 스케치", () => {
    expect(backLabel("/trips")).toBe("← 내 스케치");
    expect(backLabel("/?v=sketch")).toBe("← 내 스케치");
    expect(backLabel(null)).toBe("← 내 스케치");
  });
});
