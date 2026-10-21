import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoQuotaView } from "./PhotoQuota";
import type { GradeRequest } from "@/lib/supabase/grade";

/*
  내 정보의 "사진 보관" 칸. 등급 번호 대신 보관 한도와 사용량을 보이고, 더 큰 한도를 신청한다.
*/

const pending: GradeRequest = {
  id: "r1",
  fromGrade: 4,
  toGrade: 3,
  message: null,
  status: "pending",
  adminNote: null,
  createdAt: "2026-10-22T09:00:00Z",
  decidedAt: null,
};

const view = (props: Partial<Parameters<typeof PhotoQuotaView>[0]> = {}) =>
  render(
    <PhotoQuotaView
      quota={{ grade: 4, limit: 500, used: 312 }}
      request={null}
      busy={false}
      message={null}
      onRequest={() => undefined}
      onCancel={() => undefined}
      {...props}
    />,
  );

describe("PhotoQuotaView", () => {
  it("보관 한도와 사용량, 남은 자리를 보인다 — 등급 번호는 보이지 않는다", () => {
    const { container } = view();
    expect(screen.getByText("보관 한도 500장")).toBeTruthy();
    expect(container.textContent).toContain("312 / 500장 사용");
    expect(container.textContent).toContain("남은 자리 188장");
    expect(screen.getByRole("progressbar", { name: "사진 보관 사용량" })).toHaveAttribute("aria-valuenow", "312");
    expect(container.textContent).not.toMatch(/\d등급/);
  });

  it("무제한이면 막대 없이 보관 장수만", () => {
    const { container } = view({ quota: { grade: 1, limit: null, used: 4210 } });
    expect(screen.getByText("보관 한도 무제한")).toBeTruthy();
    expect(container.textContent).toContain("4,210장 보관 중");
    expect(screen.queryByRole("progressbar")).toBeNull();
    // 더 올릴 등급이 없으니 신청 단추도 없다.
    expect(screen.queryByRole("button", { name: "등업 신청" })).toBeNull();
  });

  it("다 찼으면 사진 없이 기록은 된다고 알린다", () => {
    view({ quota: { grade: 4, limit: 500, used: 500 } });
    expect(screen.getByText(/보관 자리가 다 찼어요/)).toBeTruthy();
  });

  it("등업 신청 — 더 큰 한도를 골라 하고 싶은 말과 함께 보낸다", () => {
    const onRequest = vi.fn();
    view({ onRequest });
    fireEvent.click(screen.getByRole("button", { name: "등업 신청" }));
    // 지금보다 큰 한도만 고를 수 있다. 처음에는 바로 위(1,000장)가 골라져 있다.
    expect(screen.getAllByRole("radio").map((radio) => radio.parentElement?.textContent)).toEqual(["무제한", "2,000장", "1,000장"]);
    fireEvent.click(screen.getByLabelText("2,000장"));
    fireEvent.change(screen.getByLabelText("하고 싶은 말 (선택)"), { target: { value: "해외 사진도 보관하고 싶어요" } });
    fireEvent.click(screen.getByRole("button", { name: "신청하기" }));
    expect(onRequest).toHaveBeenCalledWith(2, "해외 사진도 보관하고 싶어요");
  });

  it("검토 중인 신청이 있으면 그 사실과 거두기만 보인다", () => {
    const onCancel = vi.fn();
    view({ request: pending, onCancel });
    expect(screen.getByText(/1,000장으로 등업 신청을 검토하고 있어요/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "등업 신청" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "신청 거두기" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("지난 신청의 결과와 메모를 알린다", () => {
    view({ request: { ...pending, status: "declined", adminNote: "다음 달에 다시 신청해 주세요", decidedAt: "2026-10-23T00:00:00Z" } });
    expect(screen.getByText(/이번엔 어려워요 — 다음 달에 다시 신청해 주세요/)).toBeTruthy();
  });
});
