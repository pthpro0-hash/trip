"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTrips, type SavedTrip } from "@/lib/supabase/trips";
import { thumbUrls } from "@/lib/supabase/photos";

/*
  첫 화면에서 "정보"와 "개인" 중 무엇을 볼지 사람에게 고르게 하지 않는다.

  처음 온 사람에게 "내 스케치"는 문이 아니라 빈 벽이다 — 눌러 봐야 아무것도
  없고 로그인부터 하라는 말을 듣는다. 첫 화면의 절반을 "당신에겐 아직
  아무것도 없습니다"에 쓸 이유가 없다.

  그래서 기록이 있는 사람에게만 자기 기록을 올린다. 없는 사람에게는
  그런 것이 있다고 한 줄로 알려 주기만 한다.
*/

/** 띠에 늘어놓을 사진 수. 더 늘리면 아래 100선 목록을 밀어낸다. */
const COVERS = 3;

function formatSpan(startedOn: string, endedOn: string) {
  const short = (value: string) => {
    const [, month, day] = value.split("-");
    return `${Number(month)}월 ${Number(day)}일`;
  };
  if (startedOn === endedOn) return short(startedOn);
  return `${short(startedOn)} ~ ${short(endedOn)}`;
}

export function HomeIntro() {
  const [trips, setTrips] = useState<SavedTrip[] | null>(null);
  const [covers, setCovers] = useState<string[]>([]);
  // 로그인 설정이 없으면 기다릴 것도 없다. 효과 안에서 setState 하지 않는다.
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        setReady(true);
        return;
      }
      const rows = await fetchTrips(supabase, data.user.id);
      if (!active) return;
      setTrips(rows ?? []);
      setReady(true);

      const paths = (rows ?? [])
        .map((trip) => trip.coverPath)
        .filter((path): path is string => !!path)
        .slice(0, COVERS);
      if (paths.length === 0) return;

      const urls = await thumbUrls(supabase, paths);
      if (active) {
        setCovers(paths.map((path) => urls.get(path)).filter((url): url is string => !!url));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const latest = trips?.[0];

  /*
    아직 모르는 동안에는 자리만 잡아 두고 보이지 않게 한다.

    아무것도 그리지 않으면 로그인 확인이 끝나는 순간 띠가 끼어들며 아래
    내용이 통째로 밀린다. 누르려던 것이 손가락 밑에서 움직인다. 그렇다고
    "로그인하세요"를 먼저 띄웠다가 바꾸면 그것대로 깜빡인다.

    높이를 숫자로 적어 두면 글이 바뀔 때마다 어긋나므로, 같은 띠를 그대로
    그리고 보이지만 않게 한다. 자리는 저절로 맞는다.
  */
  const veil = ready ? "" : "invisible";

  if (!latest) {
    return (
      <section
        className={`flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-bg-subtle px-5 py-4 ${veil}`}
      >
        <div className="min-w-0 basis-full sm:flex-1">
          <p className="text-[16px] font-semibold tracking-tight text-text">
            사진 속에 답이 있어요
          </p>
          <p className="mt-0.5 text-[14px] leading-relaxed text-text-muted">
            언제 어디서 찍었는지는 사진이 알고 있어요. 골라 넣으면 여행으로 묶어 드려요.
          </p>
        </div>
        <Link
          href="/trips/new"
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          사진에서 찾아보기 →
        </Link>
      </section>
    );
  }

  return (
    <section
      className={`flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-bg-subtle px-5 py-4 ${veil}`}
    >
      <div className="min-w-0 basis-full sm:flex-1">
        <p className="truncate text-[16px] font-semibold tracking-tight text-text">
          {latest.title || formatSpan(latest.startedOn, latest.endedOn)}
        </p>
        <p className="mt-0.5 text-[14px] text-text-muted">
          {latest.title && `${formatSpan(latest.startedOn, latest.endedOn)} · `}
          여행 {trips.length}건을 남기셨어요
        </p>
      </div>

      {covers.length > 0 && (
        <div className="flex shrink-0 gap-1.5">
          {covers.map((url) => (
            // 우리 보관함의 서명 주소라 그때그때 달라진다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="h-12 w-12 rounded-lg object-cover ring-1 ring-line"
            />
          ))}
        </div>
      )}

      <Link
        href="/trips"
        className="shrink-0 rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
      >
        내 스케치 →
      </Link>
    </section>
  );
}
