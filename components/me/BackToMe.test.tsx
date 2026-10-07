import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackToMe } from "./BackToMe";

describe("BackToMe", () => {
  it("가족 공유·가족 책장에서 내 정보로 돌아가는 길", () => {
    render(<BackToMe />);
    expect(screen.getByRole("link", { name: /내 정보/ })).toHaveAttribute("href", "/me");
  });
});
