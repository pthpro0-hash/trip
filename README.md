# 여행세상

2025~2026 한국관광 100선 데이터를 조건별로 필터링하고 지도에서 탐색하는 웹앱.

## 시작하기

1. `.env.local.example`을 `.env.local`로 복사하고 카카오맵 JavaScript 키를 채워넣는다.
2. `npm install`
3. `npm run dev` → http://localhost:3000

## 테스트

`npm test`

## 배포 (Vercel)

1. https://vercel.com 에서 이 저장소를 New Project로 가져온다.
2. 프로젝트 환경변수에 `NEXT_PUBLIC_KAKAO_MAP_KEY`를 추가한다.
3. 카카오 개발자 콘솔의 Web 플랫폼 목록에 Vercel 배포 도메인(예: `https://<project>.vercel.app`)을 추가로 등록한다.
4. Deploy.
