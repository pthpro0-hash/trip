import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { groupByDay, type PickedPlace } from "@/lib/photo/unlocated";
import type { FoundPlace } from "@/lib/photo/placeSearch";
import { UnlocatedCard, type UnlocatedCardProps } from "./UnlocatedCard";

// 작은 그림은 따로 시험한다.
vi.mock("./TripThumbs", () => ({ TripThumbs: ({ files }: { files: File[] }) => <div data-testid="thumbs">{files.length}</div> }));

/*
  위치를 모르는 사진 — 날짜와 장소를 사람이 정한다. 카드는 보여 주고 고르게만 한다.
*/
const groups = groupByDay([
  { id: "a.jpg", takenAt: new Date("2026-09-13T09:00:00") },
  { id: "b.jpg", takenAt: new Date("2026-09-13T10:00:00") },
  { id: "c.jpg", takenAt: new Date("2026-09-20T10:00:00"), guessed: true },
]);
const 경복궁: FoundPlace = { title: "경복궁", address: "서울 종로구 사직로 161", lat: 37.5796, lng: 126.977, dong: "서울 종로구 세종로", spotId: "gyeongbokgung" };

function open(over: Partial<UnlocatedCardProps> = {}) {
  const props: UnlocatedCardProps = {
    groups,
    files: new Map(groups.flatMap((group) => group.photos).map((photo) => [photo.id, new File(["x"], photo.id)])),
    days: {},
    places: {},
    onDay: vi.fn(),
    onPlace: vi.fn(),
    onClear: vi.fn(),
    search: vi.fn(async () => [경복궁]),
    ...over,
  };
  return { ...render(<UnlocatedCard {...props} />), props };
}

describe("UnlocatedCard", () => {
  it("묶음이 없으면 아무것도 그리지 않는다", () => {
    const { container } = open({ groups: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("몇 장인지와 무엇을 하면 되는지 말한다 — 정하지 않은 사진은 빠진다", () => {
    open();
    expect(screen.getByRole("heading", { name: "위치를 모르는 사진 3장" })).toBeTruthy();
    expect(screen.getByText(/정하지 않은 사진은 기록에서 빠져요/)).toBeTruthy();
    expect(screen.getAllByText(/사진 [12]장/)).toHaveLength(2);
  });

  it("날짜를 어림한 묶음에만 확인해 달라고 한다", () => {
    open();
    expect(screen.getAllByText(/파일 날짜로 어림했어요/)).toHaveLength(1);
  });

  it("장소 이름으로 찾아 하나를 고르면 그 묶음에 알린다", async () => {
    const { props } = open();
    fireEvent.change(screen.getByLabelText("2026-09-13 사진의 장소 이름"), { target: { value: "경복궁" } });
    fireEvent.click(screen.getAllByRole("button", { name: "찾기" })[0]);

    fireEvent.click(await screen.findByRole("button", { name: /경복궁\s*서울 종로구 사직로 161/ }));
    expect(props.search).toHaveBeenCalledWith("경복궁");
    expect(props.onPlace).toHaveBeenCalledWith("2026-09-13", { title: "경복궁", lat: 37.5796, lng: 126.977, dong: "서울 종로구 세종로", spotId: "gyeongbokgung" });
  });

  it("찾은 것이 없으면 그렇게 말하고, 검색이 막히면 못 물었다고 말한다", async () => {
    const search = vi.fn<(query: string) => Promise<FoundPlace[]>>().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("x"));
    open({ search });
    const input = screen.getByLabelText("2026-09-13 사진의 장소 이름");
    const find = screen.getAllByRole("button", { name: "찾기" })[0];

    fireEvent.change(input, { target: { value: "없는곳" } });
    fireEvent.click(find);
    expect(await screen.findByText(/찾지 못했어요/)).toBeTruthy();

    fireEvent.click(find);
    expect(await screen.findByText(/검색하지 못했어요/)).toBeTruthy();
    expect(screen.queryByText(/찾지 못했어요/)).toBeNull();
  });

  it("검색어가 비어 있으면 찾기를 누를 수 없다", () => {
    open();
    expect(screen.getAllByRole("button", { name: "찾기" })[0]).toBeDisabled();
  });

  it("날짜를 고치면 알린다 — 달력에 없는 값은 알리지 않는다", () => {
    const { props } = open();
    const [first] = screen.getAllByLabelText("찍은 날") as HTMLInputElement[];
    expect(first.value).toBe("2026-09-13");
    fireEvent.change(first, { target: { value: "2026-09-14" } });
    expect(props.onDay).toHaveBeenCalledWith("2026-09-13", "2026-09-14");
  });

  it("고친 날짜가 있으면 그 날짜를 보인다", () => {
    open({ days: { "2026-09-13": "2026-10-01" } });
    expect((screen.getAllByLabelText("찍은 날")[0] as HTMLInputElement).value).toBe("2026-10-01");
  });

  it("정한 장소는 이름으로 보이고, 바꾸기를 누르면 되돌린다", () => {
    const place: PickedPlace = { title: "경복궁", lat: 37.5796, lng: 126.977, dong: null, spotId: null };
    const { props } = open({ places: { "2026-09-13": place } });
    expect(screen.getByText("경복궁")).toBeTruthy();
    // 정한 묶음에는 검색칸이 없고, 정하지 않은 묶음에는 있다.
    expect(screen.queryByLabelText("2026-09-13 사진의 장소 이름")).toBeNull();
    expect(screen.getByLabelText("2026-09-20 사진의 장소 이름")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "바꾸기" }));
    expect(props.onClear).toHaveBeenCalledWith("2026-09-13");
  });

  it("검색 결과를 고르면 목록과 검색어를 비운다", async () => {
    open();
    const input = screen.getByLabelText("2026-09-13 사진의 장소 이름") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "경복궁" } });
    fireEvent.click(screen.getAllByRole("button", { name: "찾기" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /경복궁\s*서울/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /경복궁\s*서울/ })).toBeNull());
    expect(input.value).toBe("");
  });
});
