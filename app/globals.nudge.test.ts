// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

/*
  발자취의 '재생' 단추가 처음에는 깜빡여 누르도록 이끈다(FootprintPlayer 의 data-nudge).
  깜빡임은 움직임에 민감한 사람에게 괴로울 수 있다 — 기기가 "동작 줄이기"를 켜 두었으면 움직이지 않는다.
  CSS 는 jsdom 이 돌려 주지 않으니 글자로 못 박는다.
*/
describe("globals.css · 재생 단추 깜빡임", () => {
  it("깜빡이는 움직임을 정의해 두었다", () => {
    expect(css).toMatch(/@keyframes\s+play-nudge/);
  });

  it("data-nudge 가 켜졌을 때만 깜빡인다", () => {
    expect(css).toMatch(/\.play-nudge\[data-nudge=["']true["']\]\s*\{[^}]*animation:\s*play-nudge/);
  });

  it("움직임을 줄이는 설정에서는 깜빡이지 않는다 — 대신 눈에 띄는 테두리만", () => {
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toMatch(/\.play-nudge\[data-nudge=["']true["']\]\s*\{[^}]*animation:\s*none/);
    expect(reduced).toMatch(/box-shadow/);
  });
});
