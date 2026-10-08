import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { SketchTrip } from "@/lib/sketch";

vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => null }));
const { SketchShowcase } = await import("./SketchShowcase");

const all: SketchTrip[] = [
  {
    id: "t1",
    startedOn: "2026-08-13",
    endedOn: "2026-08-14",
    companions: null,
    visits: [
      { placeName: "안목해변", spotId: null, lat: 37.77, lng: 128.95, photoCount: 18, dong: null, photoPath: null },
    ],
  },
];

/*
  그해의 한 줄은 화면이 먼저 지어 두지만, 그해가 어땠는지는 본인만
  안다. 고쳐 쓰는 길이 막히면 안 되고, 취소가 저장이 되어도 안 된다.
*/
describe("SketchShowcase · 한 줄", () => {
  it("고쳐 쓰는 길이 있다", () => {
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={async () => true} sidoOf={undefined} />);
    expect(screen.getByRole("button", { name: /한 줄 고쳐 쓰기/ })).toBeTruthy();
  });

  it("적어 둔 말이 있으면 그것을 보인다", () => {
    render(<SketchShowcase year={2026} all={all} written="민수랑 바다만 본 해" onWrite={async () => true} sidoOf={undefined} />);
    expect(screen.getAllByText("민수랑 바다만 본 해").length).toBeGreaterThan(0);
  });

  /*
    그해의 한 줄은 카드 안에 이미 크게 있다. 카드 위에 같은 문장을 또 크게 적으면 폰의 첫 화면 한가운데를
    반복이 차지해 카드가 아래로 밀린다.
  */
  it("한 줄은 카드 안에만 있다 — 카드 밖에 같은 말이 또 나오지 않는다", () => {
    const { container } = render(
      <SketchShowcase year={2026} all={all} written="민수랑 바다만 본 해" onWrite={async () => true} sidoOf={undefined} />,
    );
    const found = screen.getAllByText("민수랑 바다만 본 해");
    expect(found).toHaveLength(1);
    expect(found[0].closest("svg")).toBe(container.querySelector("svg"));
  });

  it("고쳐 쓰고 Enter 를 누르면 그해의 말로 적는다", async () => {
    const onWrite = vi.fn(async () => true);
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={onWrite} sidoOf={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /한 줄 고쳐 쓰기/ }));
    const input = screen.getByLabelText("2026년 한 줄");
    fireEvent.change(input, { target: { value: "바다를 세 번 본 해" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onWrite).toHaveBeenCalledWith(2026, "바다를 세 번 본 해");
  });

  it("Esc 로 취소하면 적지 않는다", () => {
    const onWrite = vi.fn(async () => true);
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={onWrite} sidoOf={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /한 줄 고쳐 쓰기/ }));
    const input = screen.getByLabelText("2026년 한 줄");
    fireEvent.change(input, { target: { value: "버릴 말" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onWrite).not.toHaveBeenCalled();
  });

  it("저장 단추가 늘 붙어 있다", () => {
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={async () => true} sidoOf={undefined} />);
    expect(screen.getByRole("button", { name: "2026년 이미지 저장" })).toBeTruthy();
  });

  it("'스토리용 세로'는 없다 — 기능째 걷어 냈다", () => {
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={async () => true} sidoOf={undefined} userId="u1" />);
    expect(screen.queryByRole("button", { name: /스토리/ })).toBeNull();
    // 남은 단추는 이미지 저장과 링크 공유 둘.
    const bar = screen.getByRole("button", { name: "2026년 이미지 저장" }).parentElement!;
    expect(within(bar).getAllByRole("button").map((button) => button.textContent)).toEqual(["이미지 저장", "링크 공유"]);
  });
});

const withPhotos: SketchTrip[] = [
  {
    ...all[0],
    visits: [
      { placeName: "안목해변", spotId: null, lat: 37.77, lng: 128.95, photoCount: 18, dong: null, photoPath: "a.webp" },
      { placeName: "속초해변", spotId: null, lat: 38.19, lng: 128.6, photoCount: 8, dong: null, photoPath: "b.webp" },
    ],
  },
];

const show = (trips: SketchTrip[]) =>
  render(<SketchShowcase year={2026} all={trips} written={undefined} onWrite={async () => true} sidoOf={undefined} />);

/*
  같은 한 해라도 보여 줄 곳에 따라 어울리는 모양이 다르다. 고른 모양
  그대로 보이고, 그대로 저장되고, 다음에 와도 그 모양이어야 한다.
*/
describe("SketchShowcase · 카드 모양", () => {
  beforeEach(() => window.localStorage.clear());

  it("세 모양 가운데 처음에는 지도", () => {
    show(withPhotos);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["지도", "사진 콜라주", "선 그림"]);
    expect(screen.getByRole("radio", { name: "지도" }).getAttribute("aria-checked")).toBe("true");
  });

  it("선 그림을 고르면 선 그림 카드가 보이고, 다음에도 기억한다", () => {
    const { unmount } = show(withPhotos);
    fireEvent.click(screen.getByRole("radio", { name: "선 그림" }));
    expect(screen.getByRole("img", { name: /선 그림/ })).toBeTruthy();
    unmount();

    show(withPhotos);
    expect(screen.getByRole("radio", { name: "선 그림" }).getAttribute("aria-checked")).toBe("true");
  });

  it("사진이 있는 해는 콜라주를 고를 수 있다 — 칸마다 그곳 여행으로 이어진다", () => {
    show(withPhotos);
    fireEvent.click(screen.getByRole("radio", { name: "사진 콜라주" }));
    expect(screen.getByRole("img", { name: /사진 콜라주, 안목해변, 속초해변/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "안목해변 여행 열기" }).getAttribute("href")).toBe("/trips/t1");
  });

  it("사진이 없는 해는 콜라주를 고를 수 없다", () => {
    show(all);
    expect((screen.getByRole("radio", { name: "사진 콜라주" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("콜라주를 골라 뒀어도 사진이 없는 해는 지도로 보이고 그 까닭을 말한다", () => {
    window.localStorage.setItem("sketch:cardStyle", "collage");
    show(all);
    expect(screen.getByRole("radio", { name: "지도" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("이 해에는 올린 사진이 없어 지도로 보여 드려요.")).toBeTruthy();
  });
});

describe("SketchShowcase · 링크", () => {
  it("로그인한 사람에게만 링크 공유 단추가 있다", () => {
    const { unmount } = show(withPhotos);
    expect(screen.queryByRole("button", { name: "2026년 링크로 보여 주기" })).toBeNull();
    unmount();
    render(
      <SketchShowcase year={2026} all={withPhotos} written={undefined} onWrite={async () => true} sidoOf={undefined} userId="u1" />,
    );
    expect(screen.getByRole("button", { name: "2026년 링크로 보여 주기" })).toBeTruthy();
  });
});

/*
  화면이 지은 한 줄에는 함께한 사람의 이름이 들어갈 수 있다("민수와 두 번").
  내 화면에서는 괜찮지만 링크로 남에게 보여 줄 때는 빼야 한다.
*/
describe("SketchShowcase · 링크의 한 줄", () => {
  const withFriend: SketchTrip[] = [
    { ...withPhotos[0], id: "a", startedOn: "2026-05-01", endedOn: "2026-05-01", companions: "민수" },
    { ...withPhotos[0], id: "b", startedOn: "2026-06-01", endedOn: "2026-06-01", companions: "민수" },
  ];

  it("내 화면에는 이름이 보여도, 링크 창의 미리보기에는 없다", async () => {
    render(
      <SketchShowcase year={2026} all={withFriend} written={undefined} onWrite={async () => true} sidoOf={undefined} userId="u1" />,
    );
    expect(screen.getAllByText(/민수와/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "2026년 링크로 보여 주기" }));
    // 링크 창은 누를 때 받아 오는 조각이라, 시험을 한꺼번에 돌리면 몇 초 걸린다.
    const dialog = await screen.findByRole("dialog", {}, { timeout: 15000 });
    expect(dialog.textContent).not.toContain("민수");
  }, 20000);
});

/*
  열자마자 보여야 하는 것은 결과다. 카드 모양을 고르는 줄이 카드보다 위에 있으면
  첫 화면이 설정으로 시작한다.
*/
describe("SketchShowcase · 순서", () => {
  const open = () =>
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={async () => true} sidoOf={undefined} />);
  const after = (first: Element, second: Element) =>
    Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

  it("카드가 먼저고, 카드 모양 고르기는 카드 아래에 있다", () => {
    const { container } = open();
    const card = container.querySelector("svg")!;
    expect(after(card, screen.getByRole("radiogroup", { name: "카드 모양" }))).toBe(true);
  });

  it("한 줄 고쳐 쓰기는 카드 아래, 카드 모양 고르기와 같은 줄에 있다 — 카드가 맨 위로 올라온다", () => {
    const { container } = open();
    const card = container.querySelector("svg")!;
    const edit = screen.getByRole("button", { name: /한 줄 고쳐 쓰기/ });
    const group = screen.getByRole("radiogroup", { name: "카드 모양" });
    expect(after(card, edit)).toBe(true);
    expect(group.parentElement).toBe(edit.parentElement);
  });

  it("카드 위에는 카드 말고 아무것도 없다", () => {
    const { container } = open();
    const article = container.querySelector("article")!;
    expect(article.firstElementChild?.querySelector("svg")).toBeTruthy();
  });

  it("카드 모양 설명 문장은 없다 — 이름만으로 알 수 있다", () => {
    open();
    expect(screen.queryByText(/다닌 곳과 계절을 지도 위에/)).toBeNull();
    expect(screen.queryByText(/그해의 사진을 한 장에/)).toBeNull();
  });

  it("고쳐 쓰는 중에는 그 줄이 입력칸으로 바뀐다", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /한 줄 고쳐 쓰기/ }));
    expect(screen.getByLabelText("2026년 한 줄")).toBeTruthy();
    expect(screen.getByText(/Esc 로 취소/)).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "카드 모양" })).toBeNull();
  });

  it("카드 모양 고르기는 그해의 이야기보다 위다 — 카드를 바꾸고 바로 이어 읽는다", () => {
    open();
    expect(after(screen.getByRole("radiogroup", { name: "카드 모양" }), screen.getByText("2026년의 나"))).toBe(true);
  });
});
