export const PWA_SERVICE_WORKER_URL = "/sw.js";

export function shouldRegisterPwaServiceWorker(input: {
  isProduction: boolean;
  isSupported: boolean;
  search: string;
}) {
  if (!input.isSupported) return false;
  if (input.isProduction) return true;
  return new URLSearchParams(input.search).has("pwa-preview");
}

export function getPwaNetworkStatusCopy(isOnline: boolean) {
  return isOnline
    ? {
        title: "현장 연결 상태 · 온라인",
        detail:
          "계획 저장과 계정 초안 동기화가 가능합니다. 브라우저 메뉴에서 앱 설치를 선택하면 현장 홈 화면에 추가할 수 있습니다.",
      }
    : {
        title: "현장 연결 상태 · 오프라인",
        detail:
          "지도·주소 검색·서버 저장은 일시 중단됩니다. 이 기기에 저장된 임시 초안은 계속 편집할 수 있으며, 연결이 복구되면 계정 동기화를 다시 시도합니다.",
      };
}
