import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MailboxHome } from "./MailboxHome";
import type { MailboxView } from "@/lib/supabase/mailboxPublic";

const TOKEN = "T".repeat(43);
const card = (over: Partial<MailboxView["postcards"][number]> = {}) => ({
  id: "P".repeat(43),
  senderName: "지민",
  title: "강릉 바다",
  startedOn: "2026-09-13",
  cover: "a.webp",
  greeting: "엄마 아빠, 바다 보고 왔어요",
  sentAt: "2026-10-02T09:00:00",
  opened: false,
  replies: [],
  ...over,
});
const view = (over: Partial<MailboxView> = {}): MailboxView => ({ tone: "casual", members: ["엄마", "아빠"], postcards: [card()], ...over });

describe("MailboxHome · 부모님이 보는 우편함", () => {
  beforeEach(() => window.localStorage.clear());

  it("새 엽서가 있으면 말로 알리고 '새 엽서' 표시가 보인다", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.getByText("새 엽서가 1장 도착했어요.")).toBeTruthy();
    expect(screen.getByText("새 엽서")).toBeTruthy();
  });

  it("엽서를 누르면 그 엽서 한 장으로 간다", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.getByRole("link", { name: /강릉 바다/ })).toHaveAttribute("href", `/m/${TOKEN}/p/${"P".repeat(43)}`);
  });

  it("엽서에는 보낸 사람과 날짜, 대표 사진(공개 보관함)이 있다", () => {
    const { container } = render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.getByText(/지민 · 10월 2일/)).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/\/storage\/v1\/object\/public\/postcards\/P+\/a\.webp$/);
  });

  it("이미 열어 본 엽서는 새 표시가 없고, 답장한 말이 보인다", () => {
    render(<MailboxHome token={TOKEN} view={view({ postcards: [card({ opened: true, replies: [{ who: "엄마", reaction: "좋구나" }] })] })} />);
    expect(screen.queryByText("새 엽서")).toBeNull();
    expect(screen.getByText("받은 엽서 1장")).toBeTruthy();
    expect(screen.getByText("엄마: 좋구나")).toBeTruthy();
  });

  it("엽서가 없으면 기다리라고 말한다", () => {
    render(<MailboxHome token={TOKEN} view={view({ postcards: [] })} />);
    expect(screen.getByText(/아직 도착한 엽서가 없어요/)).toBeTruthy();
  });

  it("제목이 없는 엽서는 '여행 엽서'로", () => {
    render(<MailboxHome token={TOKEN} view={view({ postcards: [card({ title: null })] })} />);
    expect(screen.getByRole("link", { name: /여행 엽서/ })).toBeTruthy();
  });

  it("처음에는 '누가 보시나요?'를 묻고, 한 번 고르면 기억해 다시 묻지 않는다", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.getByText("누가 보시나요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "엄마" }));
    expect(screen.queryByText("누가 보시나요?")).toBeNull();
    expect(screen.getByText(/\(으\)로 보고 계세요/)).toBeTruthy();
    expect(window.localStorage.getItem(`mailbox-who:${TOKEN.slice(0, 16)}`)).toBe("엄마");
  });

  it("받는 분 이름이 없는 우편함은 묻지 않는다", () => {
    render(<MailboxHome token={TOKEN} view={view({ members: [] })} />);
    expect(screen.queryByText("누가 보시나요?")).toBeNull();
  });

  it("바깥 길(설정·로그인·메뉴)이 없다 — 엽서 링크와 홈 화면 안내뿐", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links.every((href) => href?.startsWith("/m/"))).toBe(true);
    expect(screen.getByText(/홈 화면에 추가/)).toBeTruthy();
  });
});
