export type TripPreflightItem = {
  level: "blocker" | "warning" | "ready";
  label: string;
  detail: string;
};

export function getTripPreflight(input: {
  title: string;
  managerName: string;
  destinationCount: number;
  invalidWindows: number;
  lateVisits: number;
  preDepartureChecked: boolean;
  offlinePending: number;
  offlineConflicts: number;
}) {
  const items: TripPreflightItem[] = [];
  if (!input.title.trim() || !input.managerName.trim())
    items.push({
      level: "blocker",
      label: "계획 정보",
      detail: "출장명과 담당자를 입력하세요.",
    });
  if (!input.destinationCount)
    items.push({
      level: "blocker",
      label: "목적지",
      detail: "최소 한 곳의 방문 목적지가 필요합니다.",
    });
  if (input.invalidWindows)
    items.push({
      level: "blocker",
      label: "시간창",
      detail: `유효하지 않은 방문 가능 시간대 ${input.invalidWindows}건을 수정하세요.`,
    });
  if (input.offlineConflicts)
    items.push({
      level: "blocker",
      label: "동기화 충돌",
      detail: `현장 변경 충돌 ${input.offlineConflicts}건을 해소하세요.`,
    });
  if (input.lateVisits)
    items.push({
      level: "warning",
      label: "예상 지연",
      detail: `방문 가능 종료 시각을 넘길 수 있는 목적지 ${input.lateVisits}건이 있습니다.`,
    });
  if (!input.preDepartureChecked)
    items.push({
      level: "warning",
      label: "출발 전 확인",
      detail: "체크리스트의 출발 전 확인을 완료하세요.",
    });
  if (input.offlinePending)
    items.push({
      level: "warning",
      label: "동기화 대기",
      detail: `전송 대기 작업 ${input.offlinePending}건이 남아 있습니다.`,
    });
  if (!items.length)
    items.push({
      level: "ready",
      label: "출발 준비 완료",
      detail: "현재 계획에는 출발을 막는 항목이 없습니다.",
    });
  const blockers = items.filter(item => item.level === "blocker");
  const warnings = items.filter(item => item.level === "warning");
  return {
    items,
    blockers,
    warnings,
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "ready",
  } as const;
}
