import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import type { Bounds, HubPlace } from "@/lib/hub";

let wide = false;
vi.mock("@/lib/useWide", () => ({ useWide: () => wide }));

/** 허브가 지도에 건넨 것. 지도를 옮기는 것(onView)과 지도가 날아갈 곳(flyTo)을 시험에서 다룬다. */
let map: {
  onView?: (bounds: Bounds) => void;
  flyTo?: { key: number; places: HubPlace[] } | null;
} = {};
// 카카오 지도는 시험 안에서 띄울 수 없다. 여기서 보는 것은 지도 밖의 배치다.
vi.mock("./HubMap", async () => {
  const React = await import("react");
  return {
    HubMap: React.forwardRef(function HubMapStub(props: typeof map) {
      map = props;
      return null;
    }),
  };
});
const { HubView } = await import("./SketchHub");
const { PEEK } = await import("./HubSheet");

/*
  내 여행 화면의 시트.

  처음 열면(살짝 올린 모습) 여행 목록이 안 보이고 요약 · 달 막대 · 단추만 보였다. 이제 첫 줄에 "내 여행 N개", 그 아래
  여행 카드 줄이다. 달 막대는 "기간" 단추 뒤로, 지도 위의 칩 둘은 "지도 옵션" 하나로 접혔다. 끌어올리면 같은 여행이
  세로 목록이 된다.
*/

const place = (partial: Partial<HubPlace> & Pick<HubPlace, "visitId" | "tripId" | "tripLabel">): HubPlace => ({
  placeName: "안목해변",
  lat: 37.77,
  lng: 128.95,
  startedAt: "2026-08-13 09:00:00",
  photoCount: 12,
  coverPath: null,
  dong: null,
  spotId: null,
  ...partial,
});

const 강릉 = place({ visitId: "v1", tripId: "t1", tripLabel: "강릉 바다" });
const 제주 = place({
  visitId: "v2",
  tripId: "t2",
  tripLabel: "제주 가족여행",
  placeName: "성산일출봉",
  lat: 33.458,
  lng: 126.94,
  startedAt: "2026-09-02 10:00:00",
  photoCount: 3,
});
const 두달 = [강릉, 제주];
const 한달 = [강릉, place({ ...제주, visitId: "v3", startedAt: "2026-08-20 10:00:00" })];

const 두여행 = [
  { id: "t1", startedOn: "2026-08-13" },
  { id: "t2", startedOn: "2026-09-02" },
];

function sheet(
  options: {
    places?: HubPlace[];
    trips?: { id: string; startedOn: string }[];
    returnTrip?: string | null;
    onList?: () => void;
  } = {},
) {
  const places = options.places ?? 두달;
  return render(
    <HubView
      status="ready"
      userId="u1"
      trips={options.trips ?? 두여행}
      places={places}
      pinUrls={new Map()}
      returnTrip={options.returnTrip ?? null}
      switcher={<span>갈래 스위치</span>}
      onList={options.onList ?? (() => undefined)}
    />,
  );
}

const section = () => screen.getByRole("region", { name: "내 여행 목록" }) as HTMLElement;
const cardRow = () => screen.queryByRole("list", { name: "이 화면의 여행" });
const handle = () => screen.getByRole("button", { name: /목록 (펼치기|접기)/ });
/** 시트를 한 칸 올린다(손잡이를 자판으로 누르는 것과 같다). */
const raise = () => fireEvent.keyDown(handle(), { key: "Enter" });

describe("HubView · 시트의 첫 모습(살짝 올림)", () => {
  beforeEach(() => {
    wide = false;
    window.sessionStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  describe("머리", () => {
    it("첫 줄이 '내 여행 N개' — 무엇의 목록인지부터 말한다", () => {
      sheet();
      expect(screen.getByText("내 여행 2개")).toBeTruthy();
      expect(screen.getByText("사진 15장")).toBeTruthy();
    });

    it("지금 화면에 든 곳 수는 곁에 작게", () => {
      sheet();
      expect(screen.getByText("이 화면 2곳")).toBeTruthy();
    });

    it("처음에 여행 카드가 보인다 — 새 여행부터", () => {
      sheet();
      const items = within(cardRow()!).getAllByRole("listitem");
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent("제주 가족여행");
      expect(items[1]).toHaveTextContent("강릉 바다");
    });

    it("세로 목록은 아직 그리지 않는다 — 같은 여행이 두 번 보이지 않게", () => {
      sheet();
      expect(screen.getAllByText("제주 가족여행")).toHaveLength(1);
    });

    it("시트를 살짝 올린 높이는 카드 줄이 들어갈 만큼이다", () => {
      sheet();
      expect(section().style.height).toBe(`${PEEK}px`);
      expect(PEEK).toBeGreaterThanOrEqual(240);
    });

    it("고르기 전에는 '열기'가 없다", () => {
      sheet();
      expect(screen.queryByRole("link", { name: /열기/ })).toBeNull();
    });
  });

  describe("카드를 누르면", () => {
    it("그 여행을 고른다 — 열기가 나타나고, 머리는 선택 풀기로 바뀐다", () => {
      sheet();
      fireEvent.click(screen.getByRole("button", { name: /강릉 바다/ }));
      expect(screen.getByRole("button", { name: /강릉 바다/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("link", { name: /열기/ })).toHaveAttribute("href", "/trips/t1");
      expect(screen.getByRole("button", { name: "선택 풀기" })).toBeTruthy();
      expect(screen.queryByText("이 화면 2곳")).toBeNull();
    });

    it("그 여행을 다시 걸을 수 있게 된다", () => {
      sheet();
      expect(screen.queryByRole("button", { name: /다시 걷기/ })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /강릉 바다/ }));
      expect(screen.getByRole("button", { name: /이 여행 다시 걷기/ })).toBeTruthy();
    });

    it("선택 풀기를 누르면 처음으로", () => {
      sheet();
      fireEvent.click(screen.getByRole("button", { name: /강릉 바다/ }));
      fireEvent.click(screen.getByRole("button", { name: "선택 풀기" }));
      expect(screen.queryByRole("link", { name: /열기/ })).toBeNull();
      expect(screen.getByText("이 화면 2곳")).toBeTruthy();
    });

    it("상세에서 돌아오면 그 여행이 이어진 채 열린다", () => {
      sheet({ returnTrip: "t2" });
      expect(screen.getByRole("button", { name: /제주 가족여행/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("link", { name: /열기/ })).toHaveAttribute("href", "/trips/t2");
    });
  });

  describe("기간", () => {
    it("달이 둘 이상이면 '기간 전체' 단추가 있고, 달 막대는 접혀 있다", () => {
      sheet();
      expect(screen.getByRole("button", { name: "기간 전체" })).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("group", { name: /달마다 찍은 사진/ })).toBeNull();
    });

    it("달이 하나뿐이면 단추도 없다 — 고를 기간이 없다", () => {
      sheet({ places: 한달 });
      expect(screen.queryByRole("button", { name: /^기간/ })).toBeNull();
    });

    it("누르면 시트가 반쯤 올라오고 달 막대가 펼쳐진다", () => {
      sheet();
      fireEvent.click(screen.getByRole("button", { name: "기간 전체" }));
      expect(section().style.height).toBe(`${PEEK + 60}px`);
      expect(screen.getByRole("group", { name: /달마다 찍은 사진/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: "기간 전체" })).toHaveAttribute("aria-expanded", "true");
    });

    it("다시 누르면 접힌다", () => {
      sheet();
      fireEvent.click(screen.getByRole("button", { name: "기간 전체" }));
      fireEvent.click(screen.getByRole("button", { name: "기간 전체" }));
      expect(screen.queryByRole("group", { name: /달마다 찍은 사진/ })).toBeNull();
    });

    it("시트를 도로 내리면 접힌다 — 다시 올렸을 때 저절로 펼쳐져 있지 않게", () => {
      sheet();
      fireEvent.click(screen.getByRole("button", { name: "기간 전체" }));
      // 반쯤 → 살짝
      fireEvent.keyDown(handle(), { key: "Enter" });
      expect(section().style.height).toBe(`${PEEK}px`);
      raise();
      expect(screen.queryByRole("group", { name: /달마다 찍은 사진/ })).toBeNull();
      expect(screen.getByRole("button", { name: "기간 전체" })).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("끌어올리면", () => {
    it("카드 줄이 세로 목록이 된다 — 같은 여행이 한 곳에만 보인다", () => {
      sheet();
      raise();
      expect(section().style.height).toBe(`${PEEK + 60}px`);
      expect(cardRow()).toBeNull();
      expect(screen.getAllByText("제주 가족여행")).toHaveLength(1);
      // 세로 목록의 줄도 눌러 고른다.
      fireEvent.click(screen.getByRole("button", { name: /강릉 바다/ }));
      expect(screen.getByRole("link", { name: "열기" })).toHaveAttribute("href", "/trips/t1");
    });

    it("머리의 첫 줄과 단추들은 그대로 있다", () => {
      sheet();
      raise();
      expect(screen.getByText("내 여행 2개")).toBeTruthy();
      expect(screen.getByRole("radio", { name: "지도" })).toBeTruthy();
    });
  });

  describe("지도 위의 단추", () => {
    it("칩 둘이 아니라 '지도 옵션' 하나뿐이다", () => {
      sheet();
      expect(screen.getByRole("button", { name: "지도 옵션" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^시도/ })).toBeNull();
      expect(screen.queryByText("100선 겹쳐 보기")).toBeNull();
    });

    it("누르면 다녀온 시도와 100선 겹쳐 보기가 나온다", () => {
      sheet();
      fireEvent.click(screen.getByRole("button", { name: "지도 옵션" }));
      expect(screen.getByRole("button", { name: /다녀온 시도/ })).toBeTruthy();
      expect(screen.getByRole("switch", { name: "100선 겹쳐 보기" })).toHaveAttribute("aria-checked", "false");
    });

    it("100선을 켜면 범례가 지도 위에 남는다, 끄면 사라진다", () => {
      const { container } = sheet();
      fireEvent.click(screen.getByRole("button", { name: "지도 옵션" }));
      fireEvent.click(screen.getByRole("switch", { name: "100선 겹쳐 보기" }));
      expect(container).toHaveTextContent("아직 안 간 곳");

      fireEvent.click(screen.getByRole("button", { name: "지도 옵션" }));
      expect(screen.getByRole("switch", { name: "100선 겹쳐 보기" })).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("switch", { name: "100선 겹쳐 보기" }));
      expect(container).not.toHaveTextContent("아직 안 간 곳");
    });

    it("다녀온 시도를 누르면 칠한 곳 창이 열린다", async () => {
      sheet();
      fireEvent.click(screen.getByRole("button", { name: "지도 옵션" }));
      fireEvent.click(screen.getByRole("button", { name: /다녀온 시도/ }));
      expect(await screen.findByRole("dialog", { name: "칠한 곳" })).toBeTruthy();
    });
  });

  describe("지도와 목록 스위치 · 사진 고르기 · 한장 요약", () => {
    it("단추 줄은 옆으로 민다 — 줄이 바뀌어 시트 머리가 커지면 아래가 잘린다", () => {
      sheet();
      const row = screen.getByRole("radiogroup", { name: "보기 방식" }).parentElement!;
      expect(row.className).toContain("overflow-x-auto");
      expect(row.className).not.toContain("flex-wrap");
    });

    it("전과 같이 머리의 단추 줄에 있다", () => {
      sheet();
      expect(screen.getByRole("radio", { name: "지도" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("link", { name: "+ 사진 고르기" }).className).toContain("max-sm:hidden");
      expect(screen.getByRole("link", { name: "한장 요약" }).className).toContain("max-sm:hidden");
    });
  });
});

/*
  카드를 누르면 지도가 그 여행으로 날아간다. 목록은 "지금 지도에 보이는 여행"만 보여 주는데, 그 바람에 날아간 자리에서
  목록이 그 여행 하나로 줄면 다른 여행으로 건너뛸 길이 사라진다. 고른 동안에는 목록을 줄이지 않는다. 지도를 직접 옮겨서
  좁아진 것은 그대로 따라가되, 되돌릴 길(전체 보기)을 준다.
*/
describe("HubView · 지도를 옮기면 목록이 따라온다", () => {
  const 제주만 = { south: 33, west: 126, north: 34, east: 127.5 };
  const 강릉만 = { south: 37, west: 128, north: 38, east: 129.5 };
  const 지도옮기기 = (bounds: Bounds) => act(() => map.onView!(bounds));
  const 카드이름 = () =>
    within(cardRow()!)
      .getAllByRole("listitem")
      .map((item) => item.textContent);

  beforeEach(() => {
    wide = false;
    map = {};
    window.sessionStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("지도를 한 곳으로 옮기면 카드도 그곳 여행만 남는다", () => {
    sheet();
    지도옮기기(제주만);
    expect(카드이름()).toHaveLength(1);
    expect(카드이름()[0]).toContain("제주 가족여행");
    expect(screen.getByText("이 화면 1곳")).toBeTruthy();
  });

  it("좁아졌으면 '전체 보기'가 나타나고, 누르면 모든 여행이 보이게 날아간다", () => {
    sheet();
    expect(screen.queryByRole("button", { name: "전체 보기" })).toBeNull();

    지도옮기기(제주만);
    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(map.flyTo!.places.map((place) => place.visitId).sort()).toEqual(["v1", "v2"]);
  });

  it("지도에 다 보이면 '전체 보기'가 없다", () => {
    sheet();
    지도옮기기({ south: 30, west: 124, north: 39, east: 130 });
    expect(screen.queryByRole("button", { name: "전체 보기" })).toBeNull();
    expect(카드이름()).toHaveLength(2);
  });

  it("여행을 고르면 지도가 날아가 좁아져도 카드가 그 하나로 줄지 않는다 — 다른 여행으로 건너뛸 수 있게", () => {
    sheet();
    fireEvent.click(screen.getByRole("button", { name: /제주 가족여행/ }));
    // 날아간 지도가 제주만 비춘다.
    지도옮기기(제주만);
    expect(카드이름()).toHaveLength(2);
    expect(screen.getByRole("button", { name: /제주 가족여행/ })).toHaveAttribute("aria-pressed", "true");

    // 다른 여행을 누르면 그리로 옮겨 간다.
    fireEvent.click(screen.getByRole("button", { name: /강릉 바다/ }));
    expect(screen.getByRole("button", { name: /강릉 바다/ })).toHaveAttribute("aria-pressed", "true");
    expect(map.flyTo!.places.map((place) => place.tripId)).toEqual(["t1"]);
  });

  it("선택을 풀면 다시 지도에 보이는 것만 따라간다", () => {
    sheet();
    fireEvent.click(screen.getByRole("button", { name: /제주 가족여행/ }));
    지도옮기기(제주만);
    fireEvent.click(screen.getByRole("button", { name: "선택 풀기" }));
    expect(카드이름()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "전체 보기" })).toBeTruthy();
  });

  it("끌어올린 세로 목록도 같은 규칙이다", () => {
    sheet();
    raise();
    지도옮기기(강릉만);
    expect(screen.queryByText("제주 가족여행")).toBeNull();
    expect(screen.getByText("강릉 바다")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /강릉 바다/ }));
    expect(screen.getByText("제주 가족여행")).toBeTruthy();
  });

  it("기간을 골랐으면 전체 보기도 그 기간 안에서 — 기간 밖 여행으로 날아가지 않는다", () => {
    const 부산 = place({
      visitId: "v4",
      tripId: "t3",
      tripLabel: "부산 겨울",
      placeName: "해운대",
      lat: 35.158,
      lng: 129.16,
      startedAt: "2025-12-24 14:00:00",
    });
    sheet({
      places: [강릉, 제주, 부산],
      trips: [...두여행, { id: "t3", startedOn: "2025-12-24" }],
    });

    // 2026년만 고른다 — 달 막대는 "기간"을 눌러야 열린다. 해를 고르면 그해의 첫 달부터 끝 달까지(빈 달 포함)다.
    fireEvent.click(screen.getByRole("button", { name: "기간 전체" }));
    fireEvent.click(screen.getByRole("button", { name: "2026" }));
    expect(screen.getByRole("button", { name: "기간 2026.01 ~ 2026.09" })).toBeTruthy();

    지도옮기기(제주만);
    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(map.flyTo!.places.map((p) => p.visitId).sort()).toEqual(["v1", "v2"]);
  });
});

describe("HubView · 넓은 화면의 옆 목록", () => {
  beforeEach(() => {
    wide = true;
    window.sessionStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("옆에 목록이 서 있어서 카드 줄은 두지 않는다 — 처음부터 세로 목록", () => {
    sheet();
    expect(cardRow()).toBeNull();
    expect(screen.getAllByText("제주 가족여행")).toHaveLength(1);
    expect(screen.getByText("내 여행 2개")).toBeTruthy();
  });

  it("고른 줄에만 '열기'가 있다", () => {
    sheet();
    expect(screen.queryByRole("link", { name: "열기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /제주 가족여행/ }));
    expect(screen.getByRole("link", { name: "열기" })).toHaveAttribute("href", "/trips/t2");
  });

  it("'기간'을 누르면 달 막대가 곧바로 펼쳐진다 — 올릴 시트가 없다", () => {
    sheet();
    fireEvent.click(screen.getByRole("button", { name: "기간 전체" }));
    expect(screen.getByRole("group", { name: /달마다 찍은 사진/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "기간 전체" }));
    expect(screen.queryByRole("group", { name: /달마다 찍은 사진/ })).toBeNull();
  });

  it("지도 옵션은 여기서도 하나다", () => {
    sheet();
    expect(screen.getByRole("button", { name: "지도 옵션" })).toBeTruthy();
  });

  it("단추 줄은 줄을 바꿔 다 보인다 — 옆 목록은 폭이 좁아 '한장 요약'이 잘렸다", () => {
    sheet();
    const row = screen.getByRole("radiogroup", { name: "보기 방식" }).parentElement!;
    expect(row.className).toContain("flex-wrap");
    expect(row.className).not.toContain("overflow-x-auto");
    expect(screen.getByRole("link", { name: "한장 요약" })).toBeTruthy();
  });
});
