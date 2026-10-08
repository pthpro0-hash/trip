import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostcardPreview } from "./PostcardPreview";

/*
  엽서를 만들기 전에 받는 분이 어떻게 보게 되는지를 보여 준다. 예전에는 "받는 분께 보이는 글: …" 한 줄뿐이라 사진과
  이름까지 어떻게 보이는지 만들어 보기 전에는 알 수 없었다.
*/
describe("PostcardPreview", () => {
  it("사진과 글, 보낸 사람이 한 장의 엽서로 보인다", () => {
    const { container } = render(
      <PostcardPreview photoUrl="https://예시/a.webp" text="엄마 아빠, 바다 보고 왔어요" senderName="민지" />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://예시/a.webp");
    expect(screen.getByText("“엄마 아빠, 바다 보고 왔어요”")).toBeTruthy();
    expect(screen.getByText(/민지가 보낸 엽서/)).toBeTruthy();
  });

  it("받는 분께 이렇게 보인다고 말한다", () => {
    render(<PostcardPreview photoUrl={null} text="안녕" senderName="민지" />);
    expect(screen.getByText(/받는 분께 이렇게 보여요/)).toBeTruthy();
  });

  it("보낸 사람의 이름에 받침이 있으면 '이'를 붙인다", () => {
    render(<PostcardPreview photoUrl={null} text="안녕" senderName="지민" />);
    expect(screen.getByText(/지민이 보낸 엽서/)).toBeTruthy();
  });

  it("글이 비어 있으면 어디에 쓰는지 안내한다 — 빈 따옴표를 보이지 않는다", () => {
    const { container } = render(<PostcardPreview photoUrl={null} text="" senderName="민지" />);
    expect(screen.getByText("한 줄을 쓰면 여기에 이렇게 보여요")).toBeTruthy();
    expect(container.textContent).not.toContain("“”");
  });

  it("보내는 이름이 비어 있으면 적어 달라고 한다", () => {
    render(<PostcardPreview photoUrl={null} text="안녕" senderName="  " />);
    expect(screen.getByText("보내는 이름을 적어 주세요")).toBeTruthy();
    expect(screen.queryByText(/보낸 엽서/)).toBeNull();
  });

  it("사진이 없으면 사진 자리는 빈 칸이다 — 이 여행에 사진이 없거나 하나도 안 골랐을 때", () => {
    const { container } = render(<PostcardPreview photoUrl={null} text="안녕" senderName="민지" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("사진은 장식이다 — 엽서의 글이 내용이다", () => {
    const { container } = render(<PostcardPreview photoUrl="https://예시/a.webp" text="안녕" senderName="민지" />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
