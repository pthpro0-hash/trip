"use client";

import dynamic from "next/dynamic";

/*
  내 여행 허브를 필요할 때만 받는다.

  첫 화면(app/page)은 서버가 쿠키를 보고 내 여행과 여행 100선 중 하나만 그린다. 그런데 서버 컴포넌트가 클라이언트 컴포넌트를
  그냥 가져오면 그리지 않는 쪽의 코드와 로그인 연결 코드까지 첫 JS 에 들어온다(둘러보는 사람이 내 여행 허브를 받았다).
  이 얇은 껍질이 허브를 따로 쪼개, 내 여행을 그릴 때만 받게 한다.
*/
export const SketchHub = dynamic(() => import("./SketchHub").then((module) => module.SketchHub));
