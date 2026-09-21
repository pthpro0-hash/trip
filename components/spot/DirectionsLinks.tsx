import type { Spot } from "@/lib/types";

interface DirectionsLinksProps {
  spot: Spot;
}

// 받침이 있으면 "-으로", 없으면 "-로". 받침이 ㄹ이면 "-로".
// 이게 없으면 "네이버지도으로"처럼 어색한 말이 그대로 버튼에 찍힌다.
function withParticle(word: string) {
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  if (!isHangul) return `${word}로`;
  const tail = (last - 0xac00) % 28;
  return tail === 0 || tail === 8 ? `${word}로` : `${word}으로`;
}

/*
  "가보고 싶다"에서 "가야겠다"로 넘어가는 지점. 앱이 깔려 있으면 앱이,
  없으면 웹 지도가 열리도록 각 서비스의 공개 URL 형식을 쓴다.
  좌표는 이미 갖고 있으므로 추가 데이터가 필요 없다.
*/
export function DirectionsLinks({ spot }: DirectionsLinksProps) {
  const name = encodeURIComponent(spot.name);
  const links = [
    {
      label: "카카오맵",
      href: `https://map.kakao.com/link/to/${name},${spot.lat},${spot.lng}`,
    },
    {
      label: "네이버지도",
      href: `https://map.naver.com/p/directions/-/${spot.lng},${spot.lat},${name}/-/transit`,
    },
    {
      label: "구글지도",
      href: `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          {withParticle(link.label)} 길찾기
        </a>
      ))}
    </div>
  );
}
