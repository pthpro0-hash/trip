"use client";

import { useState } from "react";
import {
  FONT_CHOICES,
  FONT_LABEL,
  FONT_SCALE,
  HEART_CHOICES,
  PHOTO_CHOICES,
  RECOMMENDED,
  WORD_MAX,
  bookSizeText,
  differsFromRecommended,
  resolveSettings,
  type FontSize,
  type MailboxSettings,
  type SettingKey,
} from "@/lib/mailboxSettings";

/*
  책장 설정 — 권장값이 기본이고, 바꾼 것은 "권장" 표시가 사라져 한눈에 보인다.

  지금 쓰이는 설정만 보인다: 책 한 권 사진 수·크기(새로 꽂는 책부터), 부모님 화면 글씨·답장 문구·하트·작년 오늘(바로).
  보관 권수·올해의 책은 그 기능이 생길 때 이 화면에 더해진다. 값은 지금도 지켜서 저장한다
  (설정을 저장한다고 아직 안 보이는 칸이 권장으로 덮이지 않게).
*/

interface Props {
  initial: MailboxSettings;
  busy: boolean;
  onSave: (settings: MailboxSettings) => void;
  onCancel: () => void;
}

/** 화면에 내는 칸들. 권장과 다른지 셀 때도 이것만 본다. */
const SHOWN: SettingKey[] = ["photos", "size", "font", "words", "heart", "past"];

function Rec({ show }: { show: boolean }) {
  return show ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">권장</span> : null;
}

function Segment<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; text: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {options.map((option) => (
        <label
          key={String(option.value)}
          className={`flex-1 cursor-pointer rounded-lg px-1.5 py-2 text-center text-[13px] font-medium leading-tight ring-1 transition ${
            option.value === value ? "bg-text text-bg ring-text" : "bg-bg text-text-muted ring-line hover:bg-bg-subtle"
          }`}
        >
          <input
            type="radio"
            name={label}
            value={String(option.value)}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.text}
          {option.hint && <span className="mt-0.5 block text-[11px] font-normal opacity-75">{option.hint}</span>}
        </label>
      ))}
    </div>
  );
}

export function MailboxSettingsEditor({ initial, busy, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<MailboxSettings>(initial);
  const set = <K extends keyof MailboxSettings>(key: K, value: MailboxSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const differs = (key: SettingKey) => differsFromRecommended(draft, key);
  const different = SHOWN.filter(differs).length;

  const setWord = (index: number, text: string) => {
    const words = [...draft.words] as MailboxSettings["words"];
    words[index] = text;
    set("words", words);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // 비운 문구·범위를 벗어난 값은 저장 전에 권장으로 다듬는다. 화면에 안 보이는 칸은 값을 그대로 지킨다.
        onSave(resolveSettings(draft));
      }}
      className="flex flex-col gap-4 rounded-xl bg-bg p-3.5 ring-1 ring-line"
    >
      <section className="flex flex-col gap-3">
        <h4 className="text-[15px] font-semibold text-text">책</h4>
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[14px] text-text">
            책 한 권 사진 수 <Rec show={!differs("photos")} />
          </p>
          <Segment
            label="책 한 권 사진 수"
            value={draft.photos}
            options={PHOTO_CHOICES.map((count) => ({ value: count, text: `${count}장` }))}
            onChange={(value) => set("photos", value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[14px] text-text">
            사진 크기 <Rec show={!differs("size")} />
          </p>
          <Segment
            label="사진 크기"
            value={draft.size}
            options={[
              { value: 640, text: "보통", hint: "640px" },
              { value: 960, text: "선명", hint: "960px · 용량 2배" },
            ]}
            onChange={(value) => set("size", value)}
          />
          <p className="text-[12px] leading-relaxed text-text-faint">
            책 한 권이 {bookSizeText(draft.photos, draft.size)}예요. 새로 꽂는 책부터 적용돼요. 이미 꽂은 책은 보낸 순간 그대로예요.
            한 책을 우편함 여러 곳에 꽂을 때는 사진 수는 가장 적은 쪽에, 크기는 더 선명한 쪽에 맞춰요.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="text-[15px] font-semibold text-text">부모님 화면</h4>
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[14px] text-text">
            글씨 크기 <Rec show={!differs("font")} />
          </p>
          <Segment
            label="글씨 크기"
            value={draft.font}
            options={FONT_CHOICES.map((font: FontSize) => ({ value: font, text: FONT_LABEL[font] }))}
            onChange={(value) => set("font", value)}
          />
          <p
            data-testid="font-preview"
            style={{ fontSize: `${Math.round(22 * FONT_SCALE[draft.font] * 10) / 10}px` }}
            className="rounded-lg bg-bg-subtle px-3 py-2 leading-relaxed text-text"
          >
            엄마 아빠, 강릉 바다 보고 왔어요!
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[14px] text-text">
            답장 단추 문구 <Rec show={!differs("words")} />
          </p>
          <div className="flex gap-1.5">
            {draft.words.map((word, index) => (
              <input
                key={index}
                type="text"
                value={word}
                maxLength={WORD_MAX}
                onChange={(event) => setWord(index, event.target.value)}
                aria-label={`답장 문구 ${index + 1}`}
                placeholder={RECOMMENDED.words[index]}
                className="min-w-0 flex-1 rounded-lg bg-bg-subtle px-2.5 py-2 text-[13px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
              />
            ))}
          </div>
          <p className="text-[12px] leading-relaxed text-text-faint">
            집마다 말투가 달라서 직접 바꿀 수 있어요. {WORD_MAX}자까지, 비우면 권장 문구가 돼요. 부모님 화면에는 바로 적용돼요.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[14px] text-text">
            하트 <Rec show={!differs("heart")} />
          </p>
          <Segment
            label="하트 받는 방식"
            value={draft.heart}
            options={HEART_CHOICES.map((choice) => ({
              value: choice,
              text: choice === "photo" ? "사진마다" : "책마다",
              hint: choice === "photo" ? "사진 한 장 한 장에" : "여행 한 번에 하나",
            }))}
            onChange={(value) => set("heart", value)}
          />
          <p className="text-[12px] leading-relaxed text-text-faint">
            부모님이 누른 하트는 보낸 엽서 목록에 모여 보여요. 바꾸면 바로 적용돼요. 이미 단 하트는 남아 있지만, 화면에는 지금 방식의 하트만 보여요.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[14px] text-text">
            작년 오늘 <Rec show={!differs("past")} />
          </p>
          <Segment
            label="작년 오늘"
            value={draft.past ? "on" : "off"}
            options={[
              { value: "on", text: "보여 주기" },
              { value: "off", text: "안 보여 주기" },
            ]}
            onChange={(value) => set("past", value === "on")}
          />
          <p className="text-[12px] leading-relaxed text-text-faint">
            오늘 즈음(앞뒤 3일) 다녀온 지난 해의 책을 우편함 맨 위에 보여 줘요. 해당하는 책이 없으면 아무것도 나오지 않고, 바꾸면 바로 적용돼요.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
        >
          저장
        </button>
        <button type="button" onClick={onCancel} className="rounded-full bg-bg-subtle px-4 py-2.5 text-[14px] font-medium text-text-muted hover:bg-line">
          그만두기
        </button>
        <span className="ml-auto text-[12px] text-text-faint">{different === 0 ? "지금 모두 권장 설정이에요" : `권장과 다른 설정 ${different}개`}</span>
        <button
          type="button"
          onClick={() => setDraft(RECOMMENDED)}
          className="text-[13px] font-medium text-accent hover:text-accent-hover"
        >
          권장으로 되돌리기
        </button>
      </div>
    </form>
  );
}
