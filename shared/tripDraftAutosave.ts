export const TRIP_DRAFT_INPUT_DEBOUNCE_MS = 750;
export const TRIP_DRAFT_ACCOUNT_SYNC_INTERVAL_MS = 20_000;

export type TripDraftPersistenceState = "idle" | "local" | "syncing" | "saved" | "offline";

export function scheduleTripDraftInputSave(callback: () => void, delay = TRIP_DRAFT_INPUT_DEBOUNCE_MS) {
  return setTimeout(callback, delay);
}

export function startTripDraftAccountSync(callback: () => void, interval = TRIP_DRAFT_ACCOUNT_SYNC_INTERVAL_MS) {
  const timer = setInterval(callback, interval);
  return () => clearInterval(timer);
}

export function resolveTripDraftAccountSync(pendingPayload: string, succeeded: boolean) {
  return succeeded
    ? { pendingPayload: null, status: "saved" as const }
    : { pendingPayload, status: "local" as const };
}

export function getTripDraftStatusCopy(status: TripDraftPersistenceState) {
  if (status === "offline") return { title: "오프라인 · 기기에만 보관", detail: "네트워크가 복구되면 계정에 다시 동기화합니다." };
  if (status === "local") return { title: "브라우저에만 임시 보관됨", detail: "계정 동기화에 실패했습니다. 네트워크가 복구되면 다시 시도합니다." };
  if (status === "syncing") return { title: "계정 임시 초안 동기화 중", detail: "브라우저 초안은 이미 안전하게 보관됐습니다." };
  if (status === "saved") return { title: "브라우저·계정 임시 초안 보관됨", detail: "다른 기기에서도 이어서 작성할 수 있습니다." };
  return { title: "입력 변경 시 자동 임시 저장", detail: "20초마다 계정과 동기화" };
}
