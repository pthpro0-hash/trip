"use client";

import { useId, useState, type FormEvent } from "react";
import { searchPlaces, type FoundPlace } from "@/lib/photo/placeSearch";
import { isDayKey, type PickedPlace, type UnlocatedGroup } from "@/lib/photo/unlocated";
import { TripThumbs } from "./TripThumbs";

/*
  위치를 모르는 사진 — 메신저로 받았거나 위치 저장을 꺼 둔 사진.

  좌표가 없으면 여행으로 묶을 수 없어서 예전에는 "위치 없음 N장"이라고만 세고 버렸다. 날짜와 장소를 사람이 정해 주면 그 사진도
  여행이 된다(lib/photo/unlocated). 사진마다 정하기엔 번거로워 찍은 날 하루를 한 묶음으로 두고, 묶음마다 장소 한 곳을 고른다.
  이 카드는 보여 주고 고르게만 한다 — 정한 것이 여행 목록에 어떻게 들어가는지는 부르는 쪽(PhotoImport)이 정한다.
*/

export interface UnlocatedCardProps {
  groups: UnlocatedGroup[];
  /** 고른 파일(이름이 열쇠). 작은 그림을 만든다. */
  files: Map<string, File>;
  /** 사람이 고친 날짜. 없으면 찍힌 날 그대로. */
  days: Record<string, string>;
  /** 정한 장소. 없으면 아직이다. */
  places: Record<string, PickedPlace>;
  onDay: (key: string, day: string) => void;
  onPlace: (key: string, place: PickedPlace) => void;
  onClear: (key: string) => void;
  /** 장소를 이름으로 찾는다(시험에서 바꿔 끼운다). */
  search?: (query: string) => Promise<FoundPlace[]>;
}

const THUMBS = 3;

export function UnlocatedCard({ groups, files, days, places, onDay, onPlace, onClear, search = searchPlaces }: UnlocatedCardProps) {
  const total = groups.reduce((sum, group) => sum + group.photos.length, 0);
  if (groups.length === 0) return null;

  return (
    <section aria-label="위치를 모르는 사진" className="flex flex-col gap-3 rounded-2xl bg-accent-soft p-4">
      <div className="break-keep">
        <h3 className="text-[16px] font-semibold text-text">위치를 모르는 사진 {total}장</h3>
        <p className="mt-1 text-[13px] leading-snug text-text-muted">
          메신저로 받았거나 위치 저장을 꺼 둔 사진이에요. 날짜와 장소를 정해 주면 이 사진도 여행으로 기록해요. 정하지 않은 사진은 기록에서 빠져요.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {groups.map((group) => (
          <li key={group.key}>
            <GroupRow
              group={group}
              files={files}
              day={days[group.key] ?? group.key}
              place={places[group.key]}
              onDay={(day) => onDay(group.key, day)}
              onPlace={(place) => onPlace(group.key, place)}
              onClear={() => onClear(group.key)}
              search={search}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface GroupRowProps {
  group: UnlocatedGroup;
  files: Map<string, File>;
  day: string;
  place: PickedPlace | undefined;
  onDay: (day: string) => void;
  onPlace: (place: PickedPlace) => void;
  onClear: () => void;
  search: (query: string) => Promise<FoundPlace[]>;
}

function GroupRow({ group, files, day, place, onDay, onPlace, onClear, search }: GroupRowProps) {
  const dateId = useId();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundPlace[] | null>(null);
  const [state, setState] = useState<"idle" | "searching" | "failed">("idle");

  const thumbs = group.photos.slice(0, THUMBS).flatMap((photo) => {
    const file = files.get(photo.id);
    return file ? [file] : [];
  });

  const find = async (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (!text || state === "searching") return;
    setState("searching");
    try {
      setFound(await search(text));
      setState("idle");
    } catch {
      setFound(null);
      setState("failed");
    }
  };

  const choose = (item: FoundPlace) => {
    onPlace({ title: item.title, lat: item.lat, lng: item.lng, dong: item.dong, spotId: item.spotId });
    setFound(null);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-surface p-3.5 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label htmlFor={dateId} className="text-[13px] font-medium text-text-muted">
          찍은 날
        </label>
        <input
          id={dateId}
          type="date"
          value={day}
          onChange={(event) => {
            if (isDayKey(event.target.value)) onDay(event.target.value);
          }}
          className="rounded-lg bg-bg-subtle px-2.5 py-1 text-[15px] text-text outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="text-[13px] text-text-faint">사진 {group.photos.length}장</span>
      </div>

      {group.guessed && (
        <p className="break-keep text-[13px] leading-snug text-text-muted">
          촬영 날짜가 없어 파일 날짜로 어림했어요. 맞는지 확인해 주세요.
        </p>
      )}

      {thumbs.length > 0 && <TripThumbs key={thumbs.map((file) => file.name).join("|")} files={thumbs} />}

      {place ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-bg-subtle px-3 py-2">
          <p className="min-w-0 break-keep text-[14px] text-text">
            <span className="text-text-faint">장소 </span>
            <span className="font-semibold">{place.title}</span>
          </p>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[13px] font-medium text-text-muted underline underline-offset-2 transition hover:text-text"
          >
            바꾸기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <form onSubmit={find} className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="장소 이름 (예: 경복궁)"
              aria-label={`${day} 사진의 장소 이름`}
              maxLength={40}
              className="min-w-0 flex-1 rounded-lg bg-bg-subtle px-3 py-2 text-[15px] text-text outline-none placeholder:text-text-faint focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={state === "searching" || query.trim() === ""}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
            >
              {state === "searching" ? "찾는 중…" : "찾기"}
            </button>
          </form>

          {state === "failed" && <p className="text-[13px] text-text-muted">검색하지 못했어요. 잠시 뒤 다시 해 주세요.</p>}
          {found && found.length === 0 && (
            <p className="text-[13px] text-text-muted">찾지 못했어요. 다른 이름이나 더 간단한 이름으로 찾아 보세요. 한국 안의 장소만 찾을 수 있어요.</p>
          )}
          {found && found.length > 0 && (
            <ul className="flex flex-col overflow-hidden rounded-lg ring-1 ring-line">
              {found.map((item, index) => (
                <li key={`${item.lat},${item.lng},${index}`} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => choose(item)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition hover:bg-bg-subtle"
                  >
                    <span className="text-[14px] font-semibold text-text">{item.title}</span>
                    {item.address && <span className="text-[12px] text-text-faint">{item.address}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
