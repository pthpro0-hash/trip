"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTrips, type SavedTrip } from "@/lib/supabase/trips";
import { fetchHeadlines, saveHeadline } from "@/lib/supabase/sketchYears";
import { visitCovers } from "@/lib/supabase/photos";
import type { SketchTrip } from "@/lib/sketch";
import { yearFromSearch, yearsOf, type SidoOf } from "@/lib/sketchStory";
import { tripFocus } from "@/lib/scrollMemory";
import { SketchShowcase } from "./SketchShowcase";
import { AllYearsShowcase } from "./AllYearsShowcase";
import { Waiting } from "@/components/layout/Waiting";

/*
  한장 요약 — 남에게 보여 주는 얼굴.

  예전에는 이 위에 검색·권역·해·함께 거르개가 쌓여 있었다. 찾고 거르는
  일은 이제 내 여행 지도가 더 잘한다. 여기서는 한 해를 작품으로 보여
  주는 데만 힘을 쓴다. 해를 고르는 탭 하나만 남긴다.

  해가 둘 이상이면 맨 앞에 "전체" 탭을 둔다. 모든 해를 한 장에 담되
  해마다 색을 달리해 섞이지 않게 하고, 해끼리 견준다(AllYearsShowcase).
  처음 열면 여전히 가장 최근 해다 — 보여 주고 싶은 것은 대개 올해다.
*/

type Status = "loading" | "guest" | "failed" | "ready";

export function SketchView() {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  /*
    고른 해. "all" 은 지금까지 전부.

    주소의 ?y= 로 열 수 있다. "그해의 곳들"에서 여행 상세로 갔다가 돌아오면 보던
    해로 서야 한다 — 그렇지 않으면 2024년을 보다 나온 사람이 늘 최근 해로 돌아온다.
    서버에서는 주소를 모르지만, 첫 화면(불러오는 중)은 해와 무관해 어긋나지 않는다.
  */
  const [year, setYear] = useState<number | "all" | null>(() =>
    typeof window === "undefined" ? null : yearFromSearch(window.location.search),
  );
  /** 해마다 적어 둔 한 줄. 적지 않은 해는 없다. */
  const [written, setWritten] = useState<Map<number, string>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  /** 방문마다 대표 사진 한 장. 지도에 점 대신 얹는다. */
  const [covers, setCovers] = useState<Map<string, string>>(new Map());
  /** 시도 경계(60KB)는 따로 불러온다. 없으면 시도 장면만 비어 있다. */
  const [sidoOf, setSidoOf] = useState<SidoOf | undefined>(undefined);

  useEffect(() => {
    /*
      상세에서 돌아온 것이다. 상세가 "이 여행 앞에 세워 달라"고 적어 둔 것은 목록의
      장부인데 여기서는 아무도 읽지 않는다 — 지우지 않으면 나중에 목록을 열 때 엉뚱한
      카드 앞에 선다.
    */
    tripFocus.forget();

    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        setStatus("guest");
        return;
      }
      const rows = await fetchTrips(supabase, data.user.id);
      if (!active) return;
      if (!rows) {
        setStatus("failed");
        return;
      }
      setTrips(rows);
      setUserId(data.user.id);
      setStatus("ready");

      // 둘 다 곁다리다. 못 불러와도 스케치는 그려져야 한다.
      try {
        const lines = await fetchHeadlines(supabase, data.user.id);
        if (active) setWritten(lines);
      } catch {
        // 적어 둔 말을 못 불러온 것뿐이다.
      }
      try {
        const shots = await visitCovers(supabase, data.user.id);
        if (active) setCovers(shots);
      } catch {
        // 사진을 못 얹으면 점으로 그려진다.
      }
    });

    void import("@/lib/sido").then((module) => {
      // 상태에 함수를 넣을 때는 한 겹 감싼다 — 그대로 넘기면 React 가 갱신 함수로 부른다.
      if (active) setSidoOf(() => module.sidoOf);
    });

    return () => {
      active = false;
    };
  }, []);

  const all: SketchTrip[] = useMemo(
    () =>
      trips.map((trip) => ({
        id: trip.id,
        startedOn: trip.startedOn,
        endedOn: trip.endedOn,
        companions: trip.companions,
        visits: trip.visits.map((visit) => ({
          placeName: visit.placeName,
          spotId: visit.spotId,
          lat: visit.lat,
          lng: visit.lng,
          photoCount: visit.photoCount,
          dong: visit.dong,
          photoPath: covers.get(visit.id) ?? null,
          // "2026-09-13T09:21:23" → 그곳에 간 날. 여행 시작일이 아니라 그날이다.
          visitedOn: visit.startedAt.slice(0, 10),
        })),
      })),
    [trips, covers],
  );

  const years = useMemo(() => yearsOf(all), [all]);
  /**
   * 고르지 않았으면 가장 최근 해. 보여 주고 싶은 것은 대개 올해다.
   * 주소에서 온 해는 기록에 있는 해일 때만 따른다 — 없는 해를 열면 빈 그림이 뜬다.
   */
  const shown = (() => {
    if (year === "all") return years.length < 2 ? (years[0] ?? null) : "all";
    if (year !== null && years.includes(year)) return year;
    return years[0] ?? null;
  })();

  if (status === "loading") return <Waiting title="스케치를 그리고 있어요" />;

  if (status === "guest") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[15px] text-text-muted">
          로그인하시면 한 해의 여행을 한 장의 그림과 이야기로 모아 드려요.
        </p>
        <Link
          href="/login?next=%2Fsketch"
          className="self-start rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[15px] text-text-muted">
        기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  if (trips.length === 0 || shown === null) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6 text-center">
        <p className="text-[17px] font-medium text-text">아직 그릴 것이 없어요</p>
        <p className="text-[15px] leading-relaxed text-text-muted">
          사진을 고르면 한 해가 한 장의 그림이 돼요.
        </p>
        <Link
          href="/trips/new"
          className="self-center rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          사진 고르기
        </Link>
      </div>
    );
  }

  const write = async (forYear: number, line: string) => {
    const supabase = getBrowserClient();
    if (!supabase || !userId) return false;
    if (!(await saveHeadline(supabase, userId, forYear, line))) return false;
    setWritten((current) => {
      const next = new Map(current);
      if (line.trim()) next.set(forYear, line.trim());
      else next.delete(forYear);
      return next;
    });
    return true;
  };

  const pick = (entry: number | "all") => {
    setYear(entry);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {/* 해가 하나뿐이면 고를 것이 없다. 탭을 두지 않는다. */}
      {years.length > 1 && (
        <div role="tablist" aria-label="해 고르기" className="flex flex-wrap gap-1.5">
          {(["all", ...years] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={entry === shown}
              onClick={() => pick(entry)}
              className={`rounded-full px-4 py-2 text-[15px] font-semibold tabular-nums transition ${
                entry === shown ? "bg-text text-bg" : "bg-bg-subtle text-text-muted hover:bg-line hover:text-text"
              }`}
            >
              {entry === "all" ? "전체" : entry}
            </button>
          ))}
        </div>
      )}

      {shown === "all" ? (
        <AllYearsShowcase all={all} sidoOf={sidoOf} onPickYear={pick} userId={userId} />
      ) : (
        <SketchShowcase
          key={shown}
          year={shown}
          all={all}
          written={written.get(shown)}
          onWrite={write}
          sidoOf={sidoOf}
          userId={userId}
        />
      )}
    </>
  );
}
