/*
  서비스 로고 — 파란 타일 위에 흩어진 흰 점들. 가장 큰 점이 지금 곳이고, 나머지는 지나온 곳이다.
  (지도 위에 다녀온 곳을 점으로만 찍는 이 서비스의 그림이다. 점 사이는 잇지 않는다.)

  app/icon.svg · app/apple-icon.png · app/favicon.ico 와 같은 그림이다. 모양을 바꾸면 그쪽도
  함께 바꾼다(scripts/make-icons.mjs 가 파일들을 다시 만든다).
*/
export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#0071e3" />
      <circle cx="44" cy="30" r="13" fill="#fff" opacity="0.22" />
      <circle cx="18" cy="42" r="4.2" fill="#fff" opacity="0.55" />
      <circle cx="28" cy="21" r="5.6" fill="#fff" opacity="0.75" />
      <circle cx="36" cy="49" r="4.6" fill="#fff" opacity="0.65" />
      <circle cx="44" cy="30" r="8" fill="#fff" />
    </svg>
  );
}
