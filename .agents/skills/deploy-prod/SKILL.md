---
name: deploy-prod
description: 내 여행 스케치(Vercel 프로젝트 yeohaeng-sesang)를 프로덕션에 배포하고 확인한다. 사용자가 "배포해줘", "프로덕션에 올려줘", "vercel 배포", "완료되면 배포까지" 라고 하거나, 변경을 끝내고 폰으로 확인하게 해야 할 때 반드시 이 스킬을 쓴다. 이 프로젝트의 배포는 .env.local 이 덮어써진 적이 두 번 있어 백업·비교 절차가 필수다.
---

# 프로덕션 배포

`.env.local`에는 Supabase·카카오 키가 있고 git에 없다. `vercel` 명령이 과거 두 번 덮어썼고, 잃으면 사장님이 키를 다시 발급받아야 한다. 그래서 배포 앞뒤로 백업과 비교를 한다. 키 값은 화면에 절대 찍지 않는다. 있는지 없는지와 SHA 앞 8자리 지문만 쓴다.

작업 디렉터리는 worktree `여행세상-개인화`(가지 `personalization`)다. 다른 곳으로 `cd` 하지 않는다. 푸시는 사용자가 요청할 때만 한다.

## 순서

1. **확인**: `npx tsc --noEmit -p .` 와 `npx vitest run` 이 통과해야 한다. 실패하면 배포하지 않고 이유를 알린다.
2. **커밋**: 변경이 있으면 한국어 커밋 메시지로 커밋한다. 시스템이 정해 준 Co-Authored-By 줄을 붙인다.
3. **백업**: `cp .env.local "$TEMP/env.backup"` 그리고 `sha256sum .env.local | cut -c1-8`.
4. **배포**: `npx vercel --prod --yes`. 출력의 배포 주소를 적어 둔다.
5. **비교**: `diff -q .env.local "$TEMP/env.backup"`. 다르면 `cp "$TEMP/env.backup" .env.local` 로 되돌리고 사용자에게 알린다. 같으면 "그대로"라고만 말한다.
6. **확인**: `npx vercel inspect <배포 주소>` 로 `Ready` 를 보고, `https://yeohaeng-sesang.vercel.app` 의 `/`, `/trips`, `/login` 이 200 인지 본다. 함수 지역은 `vercel.json` 의 `syd1`(시드니)이다.
7. **메모**: `~/.Codex/projects/C--Users-pthpro-Documents-0-----------/memory/project_open_items.md` 의 최신 커밋과 남은 일을 고친다. 이미 있는 줄을 고치고 중복으로 덧붙이지 않는다.

## 사용자에게 말할 것

로그인이 필요한 화면은 로컬에서 볼 수 없고, 사용자가 폰으로 프로덕션에서 확인한다. 끝맺음에 다음을 구분해서 적는다.

- **제가 확인한 것**: 시험 통과, 배포 Ready, 주요 경로 200, `.env.local` 그대로, 샘플(`/hubcheck` 등)로 본 화면.
- **폰에서 봐 주실 것**: 실제 기록이 있어야 보이는 화면을 구체적으로. 어느 화면에서 무엇을 눌러 무엇이 보여야 하는지, 새로고침이 필요한지까지.

완료 요약은 "한 일 / 남은 일 / 다음 한 걸음" 순서로 짧게 쓴다.
