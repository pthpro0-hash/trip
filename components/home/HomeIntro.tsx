"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rememberStart, rememberStartIfUnset, startHref } from "@/lib/start";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTrips, type SavedTrip } from "@/lib/supabase/trips";
import { thumbUrls } from "@/lib/supabase/photos";
import { WelcomeHero } from "./WelcomeHero";

/*
  첫 화면 맨 위. "정보"와 "개인" 중 무엇을 볼지 사람에게 고르게 하지 않는다.

  처음 온 사람에게 "내 여행"은 문이 아니라 빈 벽이다 — 눌러 봐야 아무것도
  없고 로그인부터 하라는 말을 듣는다. 첫 화면의 절반을 "당신에겐 아직
  아무것도 없습니다"에 쓸 이유가 없다.

  그래서 기록이 있는 사람에게만 자기 기록을 올린다. 없는 사람(로그인 전이든, 로그인했지만 아직 하나도 안
  남겼든)에게는 이 서비스가 무엇을 해 주는지를 환영 영역(WelcomeHero)으로 보여 준다 — 약속 한 줄, 예시 한
  장, 단추 하나.

  번쩍임과 밀림: 화면이 번쩍이거나 아래 내용이 밀리면 누르려던 것이 손가락 밑에서 움직인다. 로그인 전 사람에게
  처음에 환영 영역을 보였다가 띠로 바꾸면 번쩍이고, 로그인한 사람에게 띠를 보였다가 환영 영역으로 바꾸면 또
  번쩍인다. 그래서 서버가 로그인 쿠키가 있는지만 보고(app/page, lib/sessionCookie) 첫 그림을 정한다 —
  maybeSignedIn 이 아니면 곧바로 환영 영역을(기다릴 것이 없다), 맞으면 띠 높이만큼 자리만 비워 두었다가 그
  사람의 형편이 알려지면 채운다.
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

/** checking 은 아직 모르는 동안(로그인 쿠키는 있다). */
type Phase = "checking" | "guest" | "empty" | "trips";

export function HomeIntro({ maybeSignedIn = false }: { maybeSignedIn?: boolean }) {
  // 로그인을 쓸 수 없는 곳이거나 로그인 쿠키가 없으면 기다릴 것도 없다. 효과 안에서 setState 하지 않는다.
  const [phase, setPhase] = useState<Phase>(() => (!isSupabaseConfigured || !maybeSignedIn ? "guest" : "checking"));
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [covers, setCovers] = useState<string[]>([]);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        setPhase("guest");
        return;
      }
      const rows = (await fetchTrips(supabase, data.user.id)) ?? [];
      if (!active) return;
      setTrips(rows);
      /*
        여행을 남긴 사람에게 이 화면의 여행 100선은 문 앞에서 한 번 돌아가는 일이다.
        갈래를 눌러 본 적이 없어도(새 폰, 지워진 쿠키) 다음부터는 내 여행으로 열리게
        기억해 둔다. 이번 화면은 그대로 두니 번쩍이지 않는다. 눌러서 고른 사람의
        선택은 뒤집지 않는다.
      */
      if (rows.length > 0) rememberStartIfUnset("sketch");
      setPhase(rows.length > 0 ? "trips" : "empty");

      const paths = rows
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

  /*
    아직 모르는 동안에는 띠 높이만큼 자리만 잡아 두고 보이지 않게 한다. 폰에서는 띠가 두 줄(글, 사진·단추)이라
    그만큼 높고, 넓은 화면에서는 한 줄이다. 로그인한 사람은 대개 여행이 있어 띠로 바뀌므로 거의 밀리지 않는다.
  */
  if (phase === "checking") return <div aria-hidden="true" className="invisible h-32 sm:h-[84px]" />;

  if (phase === "guest" || phase === "empty") return <WelcomeHero who={phase} />;

  const latest = trips[0];

  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-bg-subtle px-5 py-4">
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
        href={startHref("sketch")}
        onClick={() => rememberStart("sketch")}
        className="shrink-0 rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
      >
        내 여행 →
      </Link>
    </section>
  );
}
