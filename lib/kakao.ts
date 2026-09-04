export function buildKakaoScriptSrc(apiKey: string): string {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
}
