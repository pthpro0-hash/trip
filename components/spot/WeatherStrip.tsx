"use client";

import { useEffect, useState } from "react";
import type { DailyForecast } from "@/lib/weather";

interface WeatherStripProps {
  lat: number;
  lng: number;
}

// 글자만으로도 읽히지만, 한눈에 들어오는 건 그림이다.
const ICON: Record<string, string> = {
  맑음: "☀️",
  구름많음: "⛅",
  흐림: "☁️",
  비: "🌧️",
  "비/눈": "🌨️",
  눈: "❄️",
  소나기: "🌦️",
};

// 우산을 챙길지 말지 가르는 선.
const RAIN_WARNING_THRESHOLD = 60;

function formatTemp(value?: number) {
  return value === undefined ? "–" : `${Math.round(value)}°`;
}

export function WeatherStrip({ lat, lng }: WeatherStripProps) {
  const [days, setDays] = useState<DailyForecast[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/weather?lat=${lat}&lng=${lng}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((payload: { days?: DailyForecast[] }) => {
        if (payload.days?.length) setDays(payload.days);
        else setFailed(true);
      })
      .catch((error: unknown) => {
        // 페이지를 떠나며 취소된 것은 실패가 아니다.
        if ((error as Error)?.name !== "AbortError") setFailed(true);
      });

    return () => controller.abort();
  }, [lat, lng]);

  // 날씨는 있으면 좋은 정보다. 못 가져왔다고 페이지에 빈 자리를 남기지 않는다.
  if (failed) return null;

  return (
    <section className="rounded-2xl bg-bg-subtle p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">날씨</h2>

      {days === null ? (
        <div className="mt-3 grid grid-cols-3 gap-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-[86px] animate-pulse rounded-xl bg-line" />
          ))}
        </div>
      ) : (
        <>
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {days.map((day) => (
              <li
                key={day.date}
                className="flex flex-col items-center gap-1 rounded-xl bg-surface p-3 ring-1 ring-line"
              >
                <span className="text-[12px] font-medium text-text-muted">{day.label}</span>
                <span className="text-[22px] leading-none" aria-hidden="true">
                  {ICON[day.sky] ?? "🌡️"}
                </span>
                <span className="text-[12px] text-text-muted">{day.sky}</span>
                <span className="text-[14px] font-medium text-text">
                  {formatTemp(day.minTemp)} / {formatTemp(day.maxTemp)}
                </span>
                <span
                  className={`text-[12px] ${
                    day.rainChance >= RAIN_WARNING_THRESHOLD
                      ? "font-medium text-accent"
                      : "text-text-faint"
                  }`}
                >
                  강수 {day.rainChance}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-text-faint">날씨 제공: 기상청 단기예보</p>
        </>
      )}
    </section>
  );
}
