"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchTripDetail,
  fetchUsedCompanions,
  saveTripCompanions,
  saveTripNote,
  saveTripSubtitle,
  saveTripTitle,
  saveVisitName,
  type TripDetail as Detail,
} from "@/lib/supabase/tripDetail";
import { buildTripTitle } from "@/lib/photo/tripTitle";
import { deletePhoto, setCoverPhoto, signedUrls, thumbUrls } from "@/lib/supabase/photos";
import { deleteTrip } from "@/lib/supabase/trips";
import { rememberPlaceName } from "@/lib/supabase/placeNames";
import { PhotoViewer } from "./PhotoViewer";
import { logEvent } from "@/lib/supabase/serviceLog";
import { companionSuggestions } from "@/lib/companions";
import { attachParticle } from "@/lib/korean";
import { CompanionEditor } from "./CompanionEditor";
import { stayLabel, tripClues } from "@/lib/photo/clues";
import { CourseMap } from "@/components/course/CourseMap";
import { Waiting, WaitingOverlay } from "@/components/layout/Waiting";

type Status = "loading" | "guest" | "missing" | "ready";

function formatSpan(startedOn: string, endedOn: string) {
  const short = (value: string) => {
    const [, month, day] = value.split("-");
    return `${Number(month)}월 ${Number(day)}일`;
  };
  const year = startedOn.slice(0, 4);
  if (startedOn === endedOn) return `${year}년 ${short(startedOn)}`;
  return `${year}년 ${short(startedOn)} ~ ${short(endedOn)}`;
}

/** 같은 이름으로 다녀온 때를 모아 보는 화면. */
const placeHref = (name: string) => `/places?name=${encodeURIComponent(name)}`;

function hourMinute(date: Date) {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function TripDetail({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [trip, setTrip] = useState<Detail | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  /*
    제목은 적어 두기 단추 없이 손을 떼면 저장한다. 한 줄짜리라 단추까지
    두면 무겁고, 무엇보다 이름은 고치다 만 채로 두는 법이 없다.
  */
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [titleSaved, setTitleSaved] = useState(false);
  const [titleFailed, setTitleFailed] = useState(false);
  /** 고치고 있는 장소. 한 번에 하나만 연다. */
  const [editingVisit, setEditingVisit] = useState<string | null>(null);
  const [visitName, setVisitName] = useState("");
  const [visitFailed, setVisitFailed] = useState(false);
  /** 방금 고친 이름을 기억해 둔 방문. "다음부터 이 이름으로" 를 한 번 알린다. */
  const [rememberedVisit, setRememberedVisit] = useState<string | null>(null);
  /*
    Escape 로 버리는 중인지 표시한다.

    되돌린 값은 다음 그림에서야 반영되는데 blur 는 그보다 먼저 온다.
    그래서 깃발 없이는 "버렸다"고 해 놓고 고치던 값이 저장된다.
    ref 를 쓰는 것은 다시 그리지 않고 지금 당장 읽어야 하기 때문이다.
  */
  const cancelling = useRef(false);

  /** 버리는 중이면 저장을 건너뛴다. */
  const onBlurUnless = (save: () => void) => () => {
    if (cancelling.current) {
      cancelling.current = false;
      return;
    }
    save();
  };
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  // 사진을 지우는 것도 되돌릴 수 없다. 한 번 물어보고 나서 지운다.
  const [confirmingPhoto, setConfirmingPhoto] = useState<string | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  // 여행 통째로 지우는 일도 되돌릴 수 없다. 한 번 물어보고 나서 지운다.
  const [confirmingTrip, setConfirmingTrip] = useState(false);
  const [removingTrip, setRemovingTrip] = useState(false);
  const [tripError, setTripError] = useState(false);
  /*
    크게 보고 있는 사진. 목록에는 작은 판을 쓰지만 여기서는 보관본을
    그대로 불러온다 — 열어 본 것만 받으므로 미리 받아 둘 이유가 없다.
  */
  const [viewing, setViewing] = useState<number | null>(null);
  /** 다른 여행들에 적어 둔 동행자. 나중에 채울 때 단추로 내민다. */
  const [usedCompanions, setUsedCompanions] = useState<string[]>([]);
  const [bigUrls, setBigUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        setStatus("guest");
        return;
      }
      setUserId(data.user.id);

      const detail = await fetchTripDetail(supabase, data.user.id, tripId);
      if (!active) return;
      if (!detail) {
        setStatus("missing");
        return;
      }
      setTrip(detail);
      setTitle(detail.title ?? "");
      setSubtitle(detail.subtitle ?? "");
      setNote(detail.note ?? "");
      setStatus("ready");

      void fetchUsedCompanions(supabase, data.user.id).then((names) => {
        if (active) setUsedCompanions(names);
      });

      const paths = detail.visits.flatMap((visit) => visit.photos.map((p) => p.storagePath));
      if (paths.length > 0) {
        const urls = await thumbUrls(supabase, paths);
        if (active) setPhotoUrls(urls);
      }
    });

    return () => {
      active = false;
    };
  }, [tripId]);

  /*
    부제의 자동값은 장소 요약이다.

    가져올 때 지어 준 이름이 바로 이것이었다. 사람이 제목을 "민수랑 첫
    휴가"로 바꾸면 어디였는지가 사라지므로, 손대지 않은 부제가 그 자리를
    이어받는다. 한 번이라도 직접 쓰면 그 뒤로는 건드리지 않는다.
  */
  const autoSubtitle = trip
    ? buildTripTitle(
        trip.visits.map((visit) => ({
          label: visit.placeName,
          photoCount: visit.photos.length,
        })),
      )
    : "";

  /** 손을 뗄 때 저장한다. 바뀐 것이 없으면 아무 일도 하지 않는다. */
  const removeTrip = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !userId) return;

    setRemovingTrip(true);
    setTripError(false);
    const ok = await deleteTrip(supabase, userId, tripId);
    logEvent(supabase, "trip_deleted", { ok });

    if (!ok) {
      setTripError(true);
      setRemovingTrip(false);
      setConfirmingTrip(false);
      return;
    }
    /*
      지운 여행의 자리로 돌아갈 수는 없다. 목록을 처음부터 보여 준다 —
      askRestore 를 부르지 않으므로 저절로 맨 위다.
    */
    router.push("/trips");
  };

  const submitTitle = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !userId || !trip) return;
    if (title.trim() === (trip.title ?? "")) return;

    setTitleFailed(false);
    const ok = await saveTripTitle(supabase, userId, tripId, title);
    if (!ok) {
      setTitleFailed(true);
      return;
    }
    // 목록과 검색이 이 값을 쓰므로 화면이 들고 있는 것도 함께 맞춘다.
    setTrip({ ...trip, title: title.trim() || null });
    setTitleSaved(true);
    logEvent(supabase, "trip_renamed", { title: true });
  };

  const submitSubtitle = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !userId || !trip) return;
    if (subtitle.trim() === (trip.subtitle ?? "")) return;

    setTitleFailed(false);
    const ok = await saveTripSubtitle(supabase, userId, tripId, subtitle);
    if (!ok) {
      setTitleFailed(true);
      return;
    }
    setTrip({ ...trip, subtitle: subtitle.trim() || null });
    setTitleSaved(true);
    logEvent(supabase, "trip_renamed", { subtitle: true });
  };

  const submitCompanions = async (next: string) => {
    const supabase = getBrowserClient();
    if (!supabase || !userId || !trip) return false;
    const ok = await saveTripCompanions(supabase, userId, tripId, next);
    if (!ok) return false;
    const value = next.trim() || null;
    setTrip({ ...trip, companions: value });
    // 방금 적은 이름도 다음 추천에 들어가게.
    if (value) setUsedCompanions((current) => [...current, value]);
    logEvent(supabase, "trip_renamed", { companions: true });
    return true;
  };

  const submitVisitName = async (visitId: string) => {
    const supabase = getBrowserClient();
    if (!supabase || !userId || !trip) return;

    const name = visitName.trim();
    const before = trip.visits.find((visit) => visit.id === visitId)?.placeName;
    setEditingVisit(null);
    // 이름 없는 곳은 나중에 다시 찾을 길이 없다. 비우면 되돌린다.
    if (name.length === 0 || name === before) return;

    setVisitFailed(false);
    setRememberedVisit(null);
    const ok = await saveVisitName(supabase, userId, visitId, name);
    if (!ok) {
      setVisitFailed(true);
      return;
    }
    setTrip({
      ...trip,
      visits: trip.visits.map((visit) =>
        visit.id === visitId ? { ...visit, placeName: name } : visit,
      ),
    });
    // 지도 서비스가 지어 준 이름을 사람이 얼마나 고치는지. 이름 짓기
    // 규칙이 맞는지 아는 유일한 신호다.
    logEvent(supabase, "trip_renamed", { place: true });

    // 이 자리를 이 이름으로 기억한다. 다음에 같은 곳 사진을 가져오면 이 이름이 붙는다.
    const visit = trip.visits.find((one) => one.id === visitId);
    if (visit && (await rememberPlaceName(supabase, userId, visit.lat, visit.lng, name))) {
      setRememberedVisit(visitId);
    }
  };

  const submitNote = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !userId) return;
    setSavingNote(true);
    setNoteSaved(false);
    const ok = await saveTripNote(supabase, userId, tripId, note);
    setSavingNote(false);
    setNoteSaved(ok);
  };

  const removePhoto = async (visitId: string, photoId: string, storagePath: string) => {
    const supabase = getBrowserClient();
    if (!supabase || !userId || !trip) return;

    setRemovingPhoto(photoId);
    setPhotoError(false);

    const wasCover = trip.visits
      .flatMap((visit) => visit.photos)
      .find((photo) => photo.id === photoId)?.isCover;

    const ok = await deletePhoto(supabase, userId, { id: photoId, storagePath, visitId });
    if (!ok) {
      setPhotoError(true);
      setRemovingPhoto(null);
      setConfirmingPhoto(null);
      return;
    }

    const kept = trip.visits.map((visit) =>
      visit.id === visitId
        ? { ...visit, photos: visit.photos.filter((photo) => photo.id !== photoId) }
        : visit,
    );

    /*
      대표였던 사진을 지우면 목록의 썸네일이 비어 버린다.
      남은 사진 중 첫 장을 대신 세운다.
    */
    let nextCoverId: string | null = null;
    if (wasCover) {
      nextCoverId = kept.flatMap((visit) => visit.photos)[0]?.id ?? null;
      if (nextCoverId) {
        await setCoverPhoto(
          supabase,
          userId,
          kept.map((visit) => visit.id),
          nextCoverId,
        );
      }
    }

    setTrip({
      ...trip,
      visits: kept.map((visit) => ({
        ...visit,
        // 지금 상태를 고쳐 쓰지 않고 새로 만든다. 남은 방문은 원래 객체를
        // 그대로 재사용하기 때문에, 직접 고치면 이전 상태까지 함께 바뀐다.
        photos: visit.photos.map((photo) =>
          nextCoverId && photo.id === nextCoverId ? { ...photo, isCover: true } : photo,
        ),
      })),
    });
    logEvent(supabase, "photo_deleted", { ok: false });
    logEvent(supabase, "photo_deleted", { ok: true });
    setRemovingPhoto(null);
    setConfirmingPhoto(null);
  };

  if (status === "loading") return <Waiting title="여행을 불러오고 있어요" />;

  if (status === "guest") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[15px] text-text-muted">여행 기록은 로그인해야 볼 수 있어요.</p>
        <Link
          href={`/login?next=${encodeURIComponent(`/trips/${tripId}`)}`}
          className="self-start rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  if (status === "missing" || !trip) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[15px] text-text-muted">그 여행을 찾지 못했어요.</p>
        <Link href="/trips" className="self-start text-[15px] font-medium text-accent">
          내 여행으로 →
        </Link>
      </div>
    );
  }

  /*
    크게 볼 때는 여행 전체를 한 줄로 이어 넘긴다. 방문 단위로 끊어
    놓으면 여덟 장 보고 창을 닫았다 다시 열어야 한다.
  */
  const reel = trip.visits.flatMap((visit) => visit.photos);

  const open = async (storagePath: string) => {
    const at = reel.findIndex((photo) => photo.storagePath === storagePath);
    if (at < 0) return;
    setViewing(at);
    if (bigUrls.has(storagePath)) return;

    const supabase = getBrowserClient();
    if (!supabase) return;
    const urls = await signedUrls(supabase, [storagePath]);
    const url = urls.get(storagePath);
    if (url) setBigUrls((current) => new Map(current).set(storagePath, url));
  };

  /** 끝에서 넘기면 처음으로 돈다. 막다른 길을 만들지 않는다. */
  const move = (step: number) => {
    if (viewing === null || reel.length === 0) return;
    const next = (viewing + step + reel.length) % reel.length;
    void open(reel[next].storagePath);
  };

  const allPhotoTimes = trip.visits.flatMap((visit) => visit.photos.map((p) => p.takenAt));
  const clues = tripClues(trip.visits[0]?.startedAt ?? new Date(), allPhotoTimes, trip.visits.length);
  const stops = trip.visits.map((visit) => ({
    lat: visit.lat,
    lng: visit.lng,
    name: visit.placeName,
  }));

  return (
    <>
      {/*
        사진까지 함께 지운다. 장수가 많으면 시간이 걸리고, 도는 동안
        다른 데를 누르면 절반만 지워진 기록이 남는다.
      */}
      {removingTrip && <WaitingOverlay title="여행을 지우고 있어요" />}
      {removingPhoto && <WaitingOverlay title="사진을 지우고 있어요" />}

      <div>
        {/*
          날짜를 값이 아니라 안내 글로 둔다. 값으로 넣으면 이름을 짓지
          않은 사람이 손만 대도 날짜 문구가 제목으로 굳어 버린다.
        */}
        <input
          type="text"
          value={title}
          aria-label="여행 제목"
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleSaved(false);
          }}
          onBlur={onBlurUnless(() => void submitTitle())}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              cancelling.current = true;
              setTitle(trip.title ?? "");
              event.currentTarget.blur();
            }
          }}
          placeholder={formatSpan(trip.startedOn, trip.endedOn)}
          className="-mx-2 w-full rounded-xl bg-transparent px-2 py-1 text-[28px] font-bold tracking-tight text-text outline-none transition placeholder:text-text placeholder:opacity-100 hover:bg-bg-subtle focus:bg-bg-subtle focus:ring-2 focus:ring-accent md:text-[32px]"
        />
        {/*
          부제도 같은 규칙이다 — 자동값을 값이 아니라 안내 글로 둔다.
          그래야 손만 댄 것과 직접 쓴 것이 구별된다.
        */}
        <input
          type="text"
          value={subtitle}
          aria-label="부제"
          onChange={(event) => {
            setSubtitle(event.target.value);
            setTitleSaved(false);
          }}
          onBlur={onBlurUnless(() => void submitSubtitle())}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              cancelling.current = true;
              setSubtitle(trip.subtitle ?? "");
              event.currentTarget.blur();
            }
          }}
          placeholder={autoSubtitle || "한 줄 덧붙이기"}
          className="-mx-2 mt-0.5 w-full rounded-lg bg-transparent px-2 py-1 text-[16px] text-text-muted outline-none transition placeholder:text-text-muted placeholder:opacity-100 hover:bg-bg-subtle focus:bg-bg-subtle focus:ring-2 focus:ring-accent"
        />
        <p className="mt-0.5 px-0 text-[14px] text-text-faint">
          <span>{formatSpan(trip.startedOn, trip.endedOn)}</span>
          {titleSaved && <span> · 바꿨어요</span>}
        </p>
        <div className="mt-0.5 text-[14px] text-text-faint">
          <CompanionEditor
            value={trip.companions}
            suggestions={companionSuggestions(usedCompanions, trip.companions ?? "")}
            onSave={submitCompanions}
          />
        </div>
        {titleFailed && (
          <p className="mt-1 text-[14px] text-text-muted">
            이름을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.
          </p>
        )}
        <p className="mt-1.5 text-[13px] text-text-faint">
          제목·부제·동행·장소 이름을 눌러 고칠 수 있어요. 비우면 원래대로 돌아가요.
        </p>
      </div>

      {/*
        지우기는 맨 아래가 아니라 여기에 둔다. 사진을 다 훑어 내려간
        끝에서 지우기를 만나면 손이 미끄러진다.
      */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => (confirmingTrip ? void removeTrip() : setConfirmingTrip(true))}
          onBlur={() => setConfirmingTrip(false)}
          disabled={removingTrip}
          className={`self-start rounded-full px-3.5 py-1.5 text-[13px] font-medium transition disabled:opacity-60 ${
            confirmingTrip
              ? "bg-[#d70015] text-white"
              : "bg-bg-subtle text-text-muted hover:bg-line"
          }`}
        >
          {removingTrip
            ? "지우는 중…"
            : confirmingTrip
              ? "정말 지울까요? 사진도 함께 사라져요"
              : "이 여행 지우기"}
        </button>
        {tripError && (
          <span className="text-[13px] text-text-muted">지우지 못했어요. 잠시 후 다시 시도해 주세요.</span>
        )}
      </div>

      {stops.length > 0 && (
        <div className="h-[320px] overflow-hidden rounded-2xl ring-1 ring-line">
          <CourseMap spots={stops} />
        </div>
      )}

      {visitFailed && (
        <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
          장소 이름을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {photoError && (
        <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
          사진을 지우지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      <ol className="flex flex-col gap-5">
        {trip.visits.map((visit, index) => {
          const stay = stayLabel(visit.startedAt, visit.endedAt);
          return (
            <li key={visit.id} className="flex flex-col gap-2.5">
              <div className="flex items-baseline gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-on-accent">
                  {index + 1}
                </span>
                {editingVisit === visit.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={visitName}
                    aria-label={`${visit.placeName} 이름 고치기`}
                    onChange={(event) => setVisitName(event.target.value)}
                    onBlur={onBlurUnless(() => void submitVisitName(visit.id))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        cancelling.current = true;
                        setEditingVisit(null);
                        event.currentTarget.blur();
                      }
                    }}
                    className="-mx-2 min-w-0 flex-1 rounded-lg bg-bg-subtle px-2 py-0.5 text-[17px] font-semibold tracking-tight text-text outline-none ring-2 ring-accent"
                  />
                ) : (
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    {/*
                      이름을 누르면 같은 이름으로 다녀온 때를 모두 모아 본다.
                      100선이면 그 소개는 옆의 작은 링크로.
                    */}
                    <Link
                      href={placeHref(visit.placeName)}
                      className="text-[17px] font-semibold tracking-tight text-text underline decoration-line-strong underline-offset-4 hover:text-accent hover:decoration-accent"
                    >
                      {visit.placeName}
                    </Link>
                    {visit.spotId && (
                      <Link
                        href={`/spots/${visit.spotId}`}
                        className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent hover:text-accent-hover"
                      >
                        100선
                      </Link>
                    )}
                    {/*
                      이름 자체가 링크라, 눌러서 고치게 하면 링크와 부딪힌다.
                      고치는 손잡이를 따로 둔다.
                    */}
                    <button
                      type="button"
                      onClick={() => {
                        setVisitName(visit.placeName);
                        setEditingVisit(visit.id);
                      }}
                      aria-label={`${visit.placeName} 이름 고치기`}
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[12px] font-medium text-text-faint transition hover:bg-bg-subtle hover:text-text"
                    >
                      고치기
                    </button>
                  </div>
                )}
              </div>

              {rememberedVisit === visit.id && (
                <p className="pl-8 text-[13px] text-accent">
                  다음부터 이 자리 사진은 &lsquo;{visit.placeName}&rsquo;
                  {attachParticle(visit.placeName, "으로", "로", true).slice(visit.placeName.length)} 붙여 드려요.
                </p>
              )}
              <p className="pl-8 text-[13px] text-text-faint">
                {hourMinute(visit.startedAt)}
                {hourMinute(visit.endedAt) !== hourMinute(visit.startedAt) &&
                  `~${hourMinute(visit.endedAt)}`}
                {stay && ` · ${stay}`}
                {visit.dong && ` · ${visit.dong}`}
              </p>

              {visit.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pl-8 sm:grid-cols-3">
                  {visit.photos.map((photo) => {
                    const url = photoUrls.get(photo.storagePath);
                    const confirming = confirmingPhoto === photo.id;
                    return (
                      <div
                        key={photo.id}
                        className="relative aspect-square overflow-hidden rounded-xl bg-bg-subtle"
                      >
                        {url && (
                          <button
                            type="button"
                            onClick={() => void open(photo.storagePath)}
                            aria-label="사진 크게 보기"
                            className="h-full w-full cursor-zoom-in"
                          >
                            {/* 우리 보관함의 서명 주소라 그때그때 달라진다.
                                next/image 로 미리 최적화할 수 없다. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            confirming
                              ? removePhoto(visit.id, photo.id, photo.storagePath)
                              : setConfirmingPhoto(photo.id)
                          }
                          onBlur={() =>
                            setConfirmingPhoto((current) =>
                              current === photo.id ? null : current,
                            )
                          }
                          disabled={removingPhoto === photo.id}
                          aria-label={confirming ? "이 사진 정말 지우기" : "이 사진 지우기"}
                          className={`absolute right-1.5 top-1.5 rounded-full px-2 py-1 text-[12px] font-medium backdrop-blur-sm transition disabled:opacity-60 ${
                            confirming
                              ? "bg-[#d70015] text-white"
                              : "bg-black/45 text-white hover:bg-black/65"
                          }`}
                        >
                          {removingPhoto === photo.id ? "…" : confirming ? "정말?" : "✕"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {viewing !== null && reel[viewing] && (
        <PhotoViewer
          url={bigUrls.get(reel[viewing].storagePath) ?? null}
          index={viewing + 1}
          total={reel.length}
          onClose={() => setViewing(null)}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
        />
      )}

      {/*
        빈 칸을 먼저 내밀지 않는다. 그날로 데려간 다음에 묻는다.
      */}
      <section className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-5">
        <p className="text-[14px] leading-relaxed text-text-muted">
          {/* 요일만 있으면 어느 날인지 떠오르지 않는다. 날짜부터 말한다. */}
          {formatSpan(trip.startedOn, trip.startedOn)} {clues.weekday}이었어요
          {clues.placeCount > 1 && ` · ${clues.placeCount}곳을 다니셨네요`}
          {clues.photoCount > 0 && ` · 사진 ${clues.photoCount}장`}
          {clues.busiestTime && ` · ${clues.busiestTime}에 가장 많이 찍으셨어요`}
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-faint">기억나는 일이 있나요?</span>
          <textarea
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteSaved(false);
            }}
            rows={3}
            placeholder="예: 비가 와서 우산 사러 편의점에 들렀다"
            className="resize-y rounded-xl bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={submitNote}
            disabled={savingNote}
            className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
          >
            {savingNote ? "적는 중…" : "적어두기"}
          </button>
          {noteSaved && <span className="text-[13px] text-text-muted">적어뒀어요.</span>}
          <span className="text-[13px] text-text-faint">나중에 쓰셔도 돼요.</span>
        </div>
      </section>
    </>
  );
}
