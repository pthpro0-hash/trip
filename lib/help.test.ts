// @vitest-environment node
import { describe, it, expect } from "vitest";
import { CHAPTERS, DETAIL_MAX, SUMMARY_MAX } from "./help";

/*
  안내가 화면보다 앞서 나가면 사람은 없는 단추를 찾아 헤매고, 그때부터
  안내를 믿지 않는다. 글이 비어 있지 않은지만이라도 못 박는다.
*/
describe("도움말 내용", () => {
  it("갈래마다 제목·설명·갈 곳·단계가 있다", () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.title.length).toBeGreaterThan(0);
      expect(chapter.blurb.length).toBeGreaterThan(0);
      expect(chapter.href.startsWith("/")).toBe(true);
      expect(chapter.steps.length).toBeGreaterThan(0);
      for (const step of chapter.steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it("갈래 이름이 겹치지 않는다", () => {
    const ids = CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
    글은 세 층이다 — 갈래의 요약(blurb), 항목의 제목+한 줄 요약(목록), 눌러야 펼쳐지는 상세설명.
    한 문단에 다 넣던 때는 항목 하나가 2천 자를 넘었다. 다시 그렇게 자라지 못하게 한도를 못 박는다.
  */
  describe("세 층 — 요약 · 목록 · 상세설명", () => {
    const steps = CHAPTERS.flatMap((chapter) => chapter.steps.map((step) => ({ chapter, step })));

    it("항목마다 한 줄 요약이 있고, 제목과도 설명과도 다르다", () => {
      for (const { step } of steps) {
        expect(step.summary.trim().length, step.title).toBeGreaterThan(0);
        expect(step.summary, step.title).not.toBe(step.title);
        expect(step.summary, step.title).not.toBe(step.detail);
      }
    });

    it(`한 줄 요약은 ${SUMMARY_MAX}자를 넘지 않는다 — 목록에서 훑어볼 수 있게`, () => {
      for (const { step } of steps) expect(step.summary.length, step.title).toBeLessThanOrEqual(SUMMARY_MAX);
    });

    it(`상세설명은 ${DETAIL_MAX}자를 넘지 않는다 — 길어지면 항목을 나눈다`, () => {
      for (const { step } of steps) expect(step.detail.length, step.title).toBeLessThanOrEqual(DETAIL_MAX);
    });

    it("갈래의 요약(blurb)은 한 줄이다", () => {
      for (const chapter of CHAPTERS) expect(chapter.blurb.length, chapter.title).toBeLessThanOrEqual(60);
    });

    it("항목 제목이 한 갈래 안에서 겹치지 않는다", () => {
      for (const chapter of CHAPTERS) {
        const titles = chapter.steps.map((step) => step.title);
        expect(new Set(titles).size, chapter.title).toBe(titles.length);
      }
    });
  });

  /*
    사진으로 여행 추가 화면은 세 걸음(고르기 · 확인 · 기록)이고, 확인 화면의 카드는 곳 목록 · 동행 · 나누기 · 합치기를
    "다듬기" 안에 접고 아래에 기록 막대가 붙는다. 안내가 화면보다 앞서거나 뒤처지면 없는 단추를 찾아 헤맨다.
  */
  it("사진을 고르는 화면의 안내가 지금 화면의 이름을 쓴다", () => {
    const sketch = CHAPTERS.find((chapter) => chapter.id === "sketch")!;
    const text = sketch.steps.map((step) => `${step.title} ${step.summary} ${step.detail}`).join(" ");
    // 지금 화면에 있는 단추들.
    for (const word of ["여행 아님", "되돌리기", "다듬기", "제안", "위 여행과 한 여행이었어요", "따로 기록하기", "사진도 함께 올리기", "기록하기", "지도에서 보기", "한장 요약 보기"]) {
      expect(text, word).toContain(word);
    }
    // 없어진 이름과 보이지 않게 된 기술 용어.
    expect(text).not.toContain("일상이에요");
    expect(text).not.toContain("2048px");
  });

  it("로그인하지 않아도 사진은 읽어 볼 수 있다는 것을 알린다", () => {
    const sketch = CHAPTERS.find((chapter) => chapter.id === "sketch")!;
    const first = sketch.steps[0];
    expect(first.detail).toContain("로그인하지 않아도");
    expect(first.detail).toContain("기록할 때 로그인");
  });

  it("아래 탭이 사진을 고르는 화면에서도 숨는다는 것을 알린다", () => {
    const sketch = CHAPTERS.find((chapter) => chapter.id === "sketch")!;
    const tabs = sketch.steps.find((step) => step.title === "폰에서는 아래 탭으로 오가세요");
    expect(tabs?.detail).toContain("사진을 고르는 화면");
  });

  /*
    내 여행 화면의 시트가 바뀌었다 — 처음 모습에 여행 카드 줄, 달 막대는 "기간" 단추 뒤로, 지도 위의 칩 둘은 "지도 옵션"
    하나로, "열기"는 눌린 여행에만. 안내가 옛 이름을 말하면 없는 단추를 찾아 헤맨다.
  */
  describe("내 여행 시트의 이름", () => {
    const sketch = () => CHAPTERS.find((chapter) => chapter.id === "sketch")!.steps;
    const text = () => sketch().map((step) => `${step.title} ${step.summary} ${step.detail}`).join(" ");
    const stepOf = (title: string) => sketch().find((step) => step.title === title)!;

    it("지도 위 단추는 '지도 옵션' 하나이고, 그 안에 다녀온 시도와 100선 겹쳐 보기가 있다고 알린다", () => {
      expect(stepOf("밟은 시도를 세어 보세요").detail).toContain("'지도 옵션'");
      expect(stepOf("밟은 시도를 세어 보세요").detail).toContain("'다녀온 시도 N/17'");
      expect(stepOf("100선을 겹쳐 보세요").detail).toContain("'지도 옵션'");
      expect(stepOf("100선을 겹쳐 보세요").detail).toContain("'100선 겹쳐 보기'");
    });

    it("달 막대는 '기간'을 눌러야 열린다고 알린다", () => {
      const step = stepOf("기간으로 좁혀 보세요");
      expect(step.summary).toContain("'기간'");
      expect(step.detail).toContain("'기간'");
      expect(step.detail).toContain("풀기");
    });

    it("여행을 누르면 지도에서 고르고, '열기'는 눌린 여행에 나타난다고 알린다", () => {
      const step = stepOf("지도를 옮기면 목록이 따라와요");
      expect(step.detail).toContain("여행 카드");
      expect(step.detail).toContain("눌린 여행에 나타나는 '열기'");
    });

    it("처음에는 여행 카드, 끌어올리면 목록이라고 알린다", () => {
      const step = stepOf("목록을 끌어 올리고 내리세요");
      expect(step.summary).toContain("여행 카드");
      expect(step.detail).toContain("가로로 늘어서요");
    });

    it("없어진 이름을 말하지 않는다 — 시도 칩, 잇기 끄기", () => {
      expect(text()).not.toContain("'시도 N/17'을 누르면");
      expect(text()).not.toContain("잇기 끄기");
      expect(text()).not.toContain("목록 위의 막대");
    });
  });

  /*
    여행 상세의 단추가 바뀌었다 — "링크 공유"와 "엽서 보내기"가 "공유" 하나로 합쳐지고(누르면 고르는 시트), 지우기는
    "⋯" 안으로 들어갔다. 안내가 옛 이름을 말하면 없는 단추를 찾아 헤맨다.
  */
  describe("여행 상세의 단추 이름", () => {
    const all = () =>
      CHAPTERS.flatMap((chapter) => chapter.steps)
        .map((step) => `${step.title} ${step.summary} ${step.detail}`)
        .join(" ");
    const stepOf = (title: string) => CHAPTERS.flatMap((chapter) => chapter.steps).find((step) => step.title === title)!;

    it("엽서는 '공유'에서 '부모님께 엽서 보내기'로 보낸다고 알린다", () => {
      const step = stepOf("엽서 보내기");
      expect(step.summary).toContain("'공유'");
      expect(step.detail).toContain("'공유'");
      expect(step.detail).toContain("'부모님께 엽서 보내기'");
    });

    it("책장은 처음 엽서를 보낼 때 '누구에게 보내나요?'에 답하면 저절로 만들어진다고 알린다", () => {
      const step = stepOf("책장 만들기");
      expect(step.summary).toContain("저절로");
      expect(step.detail).toContain("'누구에게 보내나요?'");
      expect(step.detail).toContain("'가족 책장'");
    });

    it("엽서는 한 줄을 쓰고 '엽서 만들기'를 누르면 되고, 링크는 '카카오톡 등으로 보내기'로 보낸다고 알린다", () => {
      const detail = stepOf("엽서 보내기").detail;
      expect(detail).toContain("'엽서 만들기'");
      expect(detail).toContain("'카카오톡 등으로 보내기'");
    });

    it("사진과 인사말은 접혀 있고, 어느 단추로 연다고 알린다", () => {
      const step = stepOf("사진과 인사말은 알아서 채워져요");
      expect(step.detail).toContain("'사진 바꾸기'");
      expect(step.detail).toContain("'인사말 고치기'");
      expect(step.detail).toContain("'받는 곳 바꾸기'");
    });

    it("부모님 반응(열어 보셨는지·답장·하트)은 여행 상세의 공유 줄 아래에서 보고, 안 열어 보셨으면 다시 보낸다고 알린다", () => {
      const step = stepOf("부모님 반응 보기");
      expect(step.summary).toContain("여행 상세");
      expect(step.detail).toContain("열어 보셨어요");
      expect(step.detail).toContain("아직 안 열어 보셨어요");
      expect(step.detail).toContain("'새 답장'");
      expect(step.detail).toContain("'새 하트'");
      expect(step.detail).toContain("[다시 보내기]");
      // 컴퓨터(공유창이 없는 브라우저)에서는 같은 자리가 [링크 복사]다.
      expect(step.detail).toContain("[링크 복사]");
    });

    it("없어진 길을 말하지 않는다 — 책장을 먼저 만들러 가야 한다는 안내", () => {
      expect(all()).not.toContain("에서 책장을 만들면 돼요");
    });

    it("여행 하나의 링크는 '공유'에서 '링크로 보여 주기'로 만든다고 알린다", () => {
      const step = stepOf("여행 하나만 링크로 보여 주기");
      expect(step.summary).toContain("'공유'");
      expect(step.detail).toContain("'링크로 보여 주기'");
    });

    it("여행 상세의 지우기는 '⋯' 안에 있다고 알린다", () => {
      expect(stepOf("언제든 지울 수 있어요").detail).toContain("'⋯' 안의 '이 여행 지우기'");
    });

    it("없어진 단추 이름을 여행 상세의 것으로 말하지 않는다", () => {
      expect(all()).not.toContain("여행 상세의 '링크 공유'");
      expect(all()).not.toContain("여행 상세의 '엽서 보내기'");
    });
  });

  it("가족 책장은 계정과 보관에서 갈래를 따로 떼어 냈다 — 순서는 스케치·이번 여행·100선·가족 책장·계정", () => {
    expect(CHAPTERS.map((chapter) => chapter.id)).toEqual(["sketch", "trip", "browse", "shelf", "account"]);
    const shelf = CHAPTERS.find((chapter) => chapter.id === "shelf")!;
    expect(shelf.title).toBe("가족 책장");
    expect(shelf.href).toBe("/mailboxes");
  });

  it("내 정보에서 내 책장 속으로 들어가는 길을 알려 준다", () => {
    const shelf = CHAPTERS.find((chapter) => chapter.id === "shelf")!;
    const step = shelf.steps.find((s) => s.title === "내 책장 속으로 들어가 보기")!;
    expect(step).toBeTruthy();
    expect(step.detail).toContain("내 정보");
    expect(step.detail).toContain("책꽂이");
    expect(step.detail).toContain("부모님께 가지 않아요");
  });

  it("책꽂이의 단추가 해 제목 아래로 옮겨진 것을 말한다", () => {
    const shelf = CHAPTERS.find((chapter) => chapter.id === "shelf")!;
    const text = shelf.steps.map((step) => step.detail).join(" ");
    expect(text).toContain("해 제목 바로 아래 '올해의 책 보기'");
    expect(text).toContain("해 제목 바로 아래 '지도로 보기'");
    expect(text).not.toContain("다녀온 곳 지도로 보기");
  });
});
