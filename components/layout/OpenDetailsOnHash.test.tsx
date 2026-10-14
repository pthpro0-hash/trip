import { describe, it, expect, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { OpenDetailsOnHash } from "./OpenDetailsOnHash";

/* 도움말은 갈래를 접어 둔다. #갈래 로 오면(목차를 누르거나 주소로) 그 갈래가 펼쳐져야 찾으러 온 것이 보인다. */
const page = () => (
  <>
    <OpenDetailsOnHash />
    <section id="shelf">
      <details>
        <summary>가족 책장</summary>
        <p>안</p>
      </details>
    </section>
    <details id="faq">
      <summary>자주 묻는 것</summary>
    </details>
  </>
);

afterEach(() => {
  window.location.hash = "";
});

describe("OpenDetailsOnHash", () => {
  it("들어올 때 주소의 #갈래 를 펼친다 — 갈래 안의 details", () => {
    window.location.hash = "#shelf";
    const { container } = render(page());
    expect((container.querySelector("#shelf details") as HTMLDetailsElement).open).toBe(true);
  });

  it("목차를 눌러 #갈래 가 바뀌면 그것도 펼친다 — 갈래 자체가 details 여도", () => {
    const { container } = render(page());
    expect((container.querySelector("#faq") as HTMLDetailsElement).open).toBe(false);
    act(() => {
      window.location.hash = "#faq";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect((container.querySelector("#faq") as HTMLDetailsElement).open).toBe(true);
  });

  it("모르는 #이름 이면 아무것도 하지 않는다", () => {
    window.location.hash = "#없는곳";
    const { container } = render(page());
    expect((container.querySelector("#shelf details") as HTMLDetailsElement).open).toBe(false);
  });
});
