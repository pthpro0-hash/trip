import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SavedTrip } from "@/lib/supabase/trips";

const { trips } = vi.hoisted(() => ({
  trips: [
    {
      id: "t1",
      title: "강릉 바다",
      startedOn: "2026-08-13",
      endedOn: "2026-08-14",
      companions: null,
      note: null,
      coverPath: null,
      visits: [
        {
          id: "v1",
          placeName: "안목해변",
          spotId: null,
          dong: null,
          lat: 37.77,
          lng: 128.95,
          startedAt: "2026-08-13T09:00:00",
          photoCount: 12,
        },
      ],
    },
  ] as SavedTrip[],
}));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } }),
}));
vi.mock("@/lib/supabase/trips", () => ({ fetchTrips: async () => trips }));
vi.mock("@/lib/supabase/photos", () => ({
  markerUrls: async () => new Map(),
  visitCovers: async () => new Map(),
  thumbUrls: async () => new Map(),
}));
vi.mock("@/lib/useWide", () => ({ useWide: () => false }));
/*
  주소의 ?view= 가 모습의 진실이다. 위 띠의 "내 여행"을 눌러 들어오는 것처럼 주소가
  밖에서 바뀌면 화면이 그것을 따라야 한다. 시험에서는 이 값을 손으로 바꾼다.
*/
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
// 카카오 지도는 시험 안에서 띄울 수 없다. 여기서 보는 것은 지도와 목록을 오가는 길이다.
vi.mock("./HubMap", async () => {
  const React = await import("react");
  return {
    HubMap: React.forwardRef(function HubMapStub() {
      return null;
    }),
  };
});
vi.mock("@/components/trip/TripArchive", () => ({
  TripArchive: ({ onView }: { onView: (next: "map" | "list") => void }) => (
    <div>
      <p>목록 모습</p>
      <button type="button" onClick={() => onView("map")}>
        지도로
      </button>
    </div>
  ),
}));

const { SketchHub } = await import("./SketchHub");

const 갈래 = <span>갈래</span>;
const open = (props: { initialView?: "map" | "list"; initialYear?: string } = {}) => {
  // 서버는 주소를 보고 initialView 를 넘긴다 — 둘은 늘 같다.
  search = props.initialView === "list" ? "view=list" : "";
  return render(<SketchHub switcher={갈래} {...props} />);
};

/*
  내 여행은 한 화면의 두 모습이다. 오갈 때 화면이 넘어가는 것이 아니라 모습만
  바뀌고, 주소에 그 모습이 적혀 새로 고치거나 링크를 건네도 같은 모습이 된다.
*/
describe("SketchHub · 지도와 목록", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    window.history.replaceState(null, "", "/?v=sketch");
  });

  it("처음에는 지도 — 스위치에서 지도가 켜져 있다", async () => {
    open();
    expect(await screen.findByRole("radio", { name: "지도" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("목록 모습")).toBeNull();
  });

  it("주소가 목록이면 목록으로 연다 — 지도를 받아 오지 않고", () => {
    open({ initialView: "list" });
    expect(screen.getByText("목록 모습")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "지도" })).toBeNull();
  });

  it("지도에서 목록을 누르면 목록 모습이 되고, 주소에 view=list 가 적힌다", async () => {
    open();
    fireEvent.click(await screen.findByRole("radio", { name: "목록" }));
    expect(await screen.findByText("목록 모습")).toBeTruthy();
    expect(window.location.search).toBe("?v=sketch&view=list");
  });

  it("목록에서 지도로 돌아오면 주소에서 view 가 빠진다", async () => {
    open({ initialView: "list" });
    fireEvent.click(screen.getByRole("button", { name: "지도로" }));
    expect(await screen.findByRole("radio", { name: "지도" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(window.location.search).toBe("?v=sketch"));
  });

  it("보던 해(?y=)는 지도로 돌아올 때 남고, 목록 주소에는 붙지 않는다", async () => {
    open({ initialYear: "2025" });
    fireEvent.click(await screen.findByRole("radio", { name: "목록" }));
    await screen.findByText("목록 모습");
    expect(window.location.search).toBe("?v=sketch&view=list");

    fireEvent.click(screen.getByRole("button", { name: "지도로" }));
    await screen.findByRole("radio", { name: "지도" });
    await waitFor(() => expect(window.location.search).toBe("?v=sketch&y=2025"));
  });

  describe("주소가 밖에서 바뀔 때", () => {
    it("목록에서 위 띠의 '내 여행'(/?v=sketch)을 누르면 지도로 돌아온다", async () => {
      const view = open({ initialView: "list" });
      expect(screen.getByText("목록 모습")).toBeTruthy();

      search = "";
      view.rerender(<SketchHub switcher={갈래} />);
      expect(await screen.findByRole("radio", { name: "지도" })).toHaveAttribute("aria-checked", "true");
      expect(screen.queryByText("목록 모습")).toBeNull();
    });

    it("지도에서 주소가 목록으로 바뀌면 목록으로 간다", async () => {
      const view = open();
      await screen.findByRole("radio", { name: "지도" });

      search = "view=list";
      view.rerender(<SketchHub switcher={갈래} initialView="list" />);
      expect(await screen.findByText("목록 모습")).toBeTruthy();
    });

    /*
      직접 누르면 화면이 먼저 바뀌고, 주소는 조금 뒤에 따라온다. 그 사이의 어긋남을
      "밖에서 바뀐 것"으로 읽어 되돌리면 눌러도 안 넘어가는 화면이 된다.
    */
    it("직접 누른 것은 주소가 뒤늦게 따라와도 뒤집히지 않는다", async () => {
      const view = open();
      fireEvent.click(await screen.findByRole("radio", { name: "목록" }));
      await screen.findByText("목록 모습");

      // 주소는 아직 그대로인 채 다시 그린다.
      view.rerender(<SketchHub switcher={갈래} />);
      expect(screen.getByText("목록 모습")).toBeTruthy();

      // 뒤늦게 주소가 따라온다.
      search = "view=list";
      view.rerender(<SketchHub switcher={갈래} />);
      expect(screen.getByText("목록 모습")).toBeTruthy();
    });
  });
});
