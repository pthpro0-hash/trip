import { attachParticle } from "@/lib/korean";

/*
  만들기 전에 보는 엽서.

  예전에는 "받는 분께 보이는 글: …" 한 줄뿐이라 사진과 이름까지 어떻게 보이는지는 만들어 보기 전에는 알 수 없었다.
  받는 화면 그대로는 아니고(그것은 만든 뒤 링크로 연다), 사진 · 글 · 보낸 사람이 한 장으로 보이는 정도의 맛보기다.
  서버에 아무것도 묻지 않는다 — 이미 있는 사진 주소와 쓰는 중인 글만 쓴다.
*/

interface PostcardPreviewProps {
  /** 엽서에 실릴 첫 사진의 주소. 사진이 없거나 주소가 아직 안 왔으면 null. */
  photoUrl: string | null;
  /** 받는 분께 보일 글(부르는 말이 붙은 것). 비어 있으면 안내를 보인다. */
  text: string;
  /** 보내는 이름. */
  senderName: string;
}

export function PostcardPreview({ photoUrl, text, senderName }: PostcardPreviewProps) {
  const sender = senderName.trim();
  const body = text.trim();

  return (
    <div role="group" aria-label="엽서 미리보기" className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="h-36 w-full bg-bg-subtle">
        {photoUrl && (
          // 우리 보관함의 서명 주소라 그때그때 달라진다. next/image 로 미리 최적화할 수 없다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-col gap-1 px-4 py-3">
        {body ? (
          <p className="break-keep text-[15px] leading-relaxed text-text">“{body}”</p>
        ) : (
          <p className="text-[14px] leading-relaxed text-text-faint">한 줄을 쓰면 여기에 이렇게 보여요</p>
        )}
        <p className="text-[12px] text-text-faint">
          {sender ? `${attachParticle(sender, "이", "가")} 보낸 여행 엽서 · 받는 분께 이렇게 보여요` : "보내는 이름을 적어 주세요"}
        </p>
      </div>
    </div>
  );
}
