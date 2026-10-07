import { describe, it, expect } from "vitest";
import {
  ADD_HREF,
  LIST_HREF,
  MAP_HREF,
  ME_HREF,
  SKETCH_HREF,
  SPOTS_HREF,
  activeNav,
  homeStart,
  hubHref,
  isReceiverPath,
  showsBottomNav,
  viewOf,
} from "./nav";

/*
  이 서비스의 길을 한 곳에 적어 둔다. 위 띠, 폰 하단 탭, 뒤로 가기가 모두 같은
  주소를 부르므로, 어디서 어긋나면 그것을 누른 사람이 엉뚱한 곳에 선다.
*/
describe("주소", () => {
  it("내 여행은 한 화면의 두 모습 — 같은 주소에 view 만 다르다", () => {
    expect(MAP_HREF).toBe("/?v=sketch");
    expect(LIST_HREF).toBe("/?v=sketch&view=list");
    expect(SPOTS_HREF).toBe("/?v=spots");
    expect(SKETCH_HREF).toBe("/sketch");
    expect(ADD_HREF).toBe("/trips/new");
    expect(ME_HREF).toBe("/me");
  });
});

describe("viewOf · 어느 모습으로 열까", () => {
  it("list 만 목록이고, 나머지는 지도", () => {
    expect(viewOf("list")).toBe("list");
    expect(viewOf("map")).toBe("map");
    expect(viewOf(undefined)).toBe("map");
    expect(viewOf(null)).toBe("map");
    expect(viewOf("아무거나")).toBe("map");
  });
});

describe("hubHref · 주소에 적을 모습", () => {
  it("지도는 view 를 적지 않는다", () => {
    expect(hubHref("map")).toBe("/?v=sketch");
  });

  it("목록은 view=list", () => {
    expect(hubHref("list")).toBe("/?v=sketch&view=list");
  });

  it("보던 해가 있으면 y 를 붙인다", () => {
    expect(hubHref("map", "2025")).toBe("/?v=sketch&y=2025");
    expect(hubHref("list", "2025")).toBe("/?v=sketch&view=list&y=2025");
  });
});

describe("activeNav · 켜질 갈래", () => {
  it("첫 화면은 지금 열린 갈래를 따른다", () => {
    expect(activeNav("/", "sketch")).toBe("trips");
    expect(activeNav("/", "spots")).toBe("spots");
    expect(activeNav("/", null)).toBeNull();
  });

  it("한장 요약은 '한장'", () => {
    expect(activeNav("/sketch", null)).toBe("sketch");
  });

  it("여행 목록·상세·사진 고르기·같은 이름 모아 보기는 '내 여행'", () => {
    expect(activeNav("/trips", null)).toBe("trips");
    expect(activeNav("/trips/abc", null)).toBe("trips");
    expect(activeNav("/trips/new", null)).toBe("trips");
    expect(activeNav("/places", null)).toBe("trips");
  });

  it("여행지·권역·이번 여행은 '여행 100선'", () => {
    expect(activeNav("/spots/경복궁", null)).toBe("spots");
    expect(activeNav("/regions/강원권", null)).toBe("spots");
    expect(activeNav("/course", null)).toBe("spots");
  });

  it("내 정보와 그 안의 가족 공유·가족 우편함은 '내 정보'", () => {
    for (const path of ["/me", "/family", "/mailboxes", "/mailboxes/join/abc"]) expect(activeNav(path, null)).toBe("me");
  });

  it("어느 쪽도 아니면 아무것도 켜지 않는다", () => {
    expect(activeNav("/privacy", null)).toBeNull();
    expect(activeNav("/help", null)).toBeNull();
    expect(activeNav("/login", null)).toBeNull();
  });

  it("앞부분만 닮은 다른 주소는 아니다", () => {
    expect(activeNav("/sketchbook", null)).toBeNull();
    expect(activeNav("/tripsy", null)).toBeNull();
    expect(activeNav("/spotsfoo", null)).toBeNull();
    expect(activeNav("/mentor", null)).toBeNull();
    expect(activeNav("/family-tree", null)).toBeNull();
  });
});

describe("isReceiverPath · 가족 우편함 받는 쪽", () => {
  /*
    부모님은 링크 하나로 들어온다. 위 띠(내 여행·여행 100선·로그인)와 하단 탭, 처음 온 사람 안내창이
    보이면 어디를 눌러야 할지 헷갈린다 — 받는 쪽에는 엽서와 답장 단추뿐이다.
  */
  it("/m 과 그 아래는 받는 쪽이다", () => {
    for (const path of ["/m/abc", "/m/abc/p/def", "/m"]) expect(isReceiverPath(path)).toBe(true);
  });

  it("앞부분만 닮은 주소는 아니다 — 보내는 쪽 /mailboxes 는 평소 화면이다", () => {
    for (const path of ["/mailboxes", "/mailboxes/join/abc", "/map", "/", "/trips/new"]) expect(isReceiverPath(path)).toBe(false);
  });

  it("받는 쪽에는 하단 탭도 없다", () => {
    expect(showsBottomNav("/m/abc")).toBe(false);
    expect(showsBottomNav("/mailboxes")).toBe(true);
  });
});

describe("showsBottomNav · 폰 하단 탭을 보일 화면", () => {
  it.each(["/", "/trips", "/trips/abc", "/trips/new", "/spots/경복궁", "/regions/강원권", "/course", "/places", "/help", "/privacy", "/me", "/family", "/mailboxes"])(
    "%s 에서는 보인다",
    (path) => {
      expect(showsBottomNav(path)).toBe(true);
    },
  );

  it("한장 요약에서는 숨긴다 — 저장 막대가 그 자리를 쓴다", () => {
    expect(showsBottomNav("/sketch")).toBe(false);
  });

  it("링크로 받은 화면에서는 숨긴다 — 받는 사람에게 '내 여행'은 없다", () => {
    expect(showsBottomNav("/s/abcdefghijklmnop")).toBe(false);
    expect(showsBottomNav("/t/abcdefghijklmnop")).toBe(false);
  });

  it("로그인 길에서는 숨긴다", () => {
    expect(showsBottomNav("/login")).toBe(false);
    expect(showsBottomNav("/auth/callback")).toBe(false);
  });

  it("앞부분만 닮은 주소는 보인다", () => {
    expect(showsBottomNav("/spots/경복궁")).toBe(true);
    expect(showsBottomNav("/trips")).toBe(true);
    expect(showsBottomNav("/sketchbook")).toBe(true);
  });
});

/*
  첫 화면("/")에서 지금 열린 갈래. 서버가 그린 첫 그림에서는 쿠키(지난번에 고른 것)를
  모른다 — 그때는 "아직 모름"이라 아무것도 켜지 않고, 붙은 뒤에 맞춘다. 서버와
  다르게 그리면 React 가 서버가 그린 것을 그대로 두어 켜진 곳이 어긋난 채 남는다.
*/
describe("homeStart · 첫 화면에서 열린 갈래", () => {
  it("주소에 적힌 갈래가 먼저다", () => {
    expect(homeStart("sketch", "spots")).toBe("sketch");
    expect(homeStart("spots", "sketch")).toBe("spots");
    expect(homeStart("sketch", "unknown")).toBe("sketch");
  });

  it("주소에 없으면 지난번에 고른 것", () => {
    expect(homeStart(null, "sketch")).toBe("sketch");
    expect(homeStart(null, "spots")).toBe("spots");
  });

  it("고른 적이 없으면 여행 100선 — 첫 화면(app/page)과 같은 규칙", () => {
    expect(homeStart(null, null)).toBe("spots");
  });

  it("쿠키를 아직 모르면(서버가 그린 첫 그림) 모른다", () => {
    expect(homeStart(null, "unknown")).toBeNull();
  });

  it("엉뚱한 주소값은 없는 것으로 친다", () => {
    expect(homeStart("해킹", "sketch")).toBe("sketch");
    expect(homeStart("해킹", "unknown")).toBeNull();
  });
});
