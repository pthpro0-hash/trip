// 로고(components/layout/Logo.tsx)로 아이콘 파일을 다시 만든다: node scripts/make-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const dots = `
  <circle cx="44" cy="30" r="13" fill="#fff" opacity="0.22"/>
  <circle cx="18" cy="42" r="4.2" fill="#fff" opacity="0.55"/>
  <circle cx="28" cy="21" r="5.6" fill="#fff" opacity="0.75"/>
  <circle cx="36" cy="49" r="4.6" fill="#fff" opacity="0.65"/>
  <circle cx="44" cy="30" r="8" fill="#fff"/>`;

// 브라우저 탭·앱 목록: 둥근 타일.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="15" fill="#0071e3"/>${dots}</svg>`;
// 폰 홈 화면: 기기가 직접 둥글게 깎으므로 가장자리까지 꽉 채운다.
const bleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0071e3"/>${dots}</svg>`;

writeFileSync("app/icon.svg", tile);
await sharp(Buffer.from(bleed), { density: 600 }).resize(180, 180).png().toFile("app/apple-icon.png");

// 앱(PWA) 아이콘 — 홈 화면용. 둥글게 깎이는 자리를 위해 가장자리까지 채운 판과, 안드로이드가
// 모양을 마음대로 오려도 점이 잘리지 않게 점들을 가운데로 85% 줄인 판(maskable)을 만든다.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0071e3"/><g transform="translate(32 32) scale(0.85) translate(-32 -32)">${dots}</g></svg>`;
await sharp(Buffer.from(bleed), { density: 600 }).resize(192, 192).png().toFile("public/icon-192.png");
await sharp(Buffer.from(bleed), { density: 600 }).resize(512, 512).png().toFile("public/icon-512.png");
await sharp(Buffer.from(maskable), { density: 600 }).resize(512, 512).png().toFile("public/icon-maskable-512.png");

// favicon.ico — PNG 를 담은 ico 한 장(48px).
const png = await sharp(Buffer.from(tile), { density: 600 }).resize(48, 48).png().toBuffer();
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(1, 4);
head.writeUInt8(48, 6);
head.writeUInt8(48, 7);
head.writeUInt16LE(1, 10);
head.writeUInt16LE(32, 12);
head.writeUInt32LE(png.length, 14);
head.writeUInt32LE(22, 18);
writeFileSync("app/favicon.ico", Buffer.concat([head, png]));
console.log("icons written");
