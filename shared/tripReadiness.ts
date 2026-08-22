export type TripReadinessStage = {
  id: "brief" | "stops" | "route";
  label: string;
  detail: string;
  complete: boolean;
};

export function getTripReadiness(title: string, managerName: string, destinationCount: number) {
  const hasBrief = Boolean(title.trim() && managerName.trim());
  const hasStops = destinationCount > 0;
  const canOptimize = destinationCount >= 2;

  const stages: TripReadinessStage[] = [
    { id: "brief", label: "계획 정보", detail: hasBrief ? "기초 정보 준비됨" : "출장명·담당자 입력", complete: hasBrief },
    { id: "stops", label: "현장 목적지", detail: hasStops ? `${destinationCount}곳 등록됨` : "목적지 등록 대기", complete: hasStops },
    { id: "route", label: "동선 설계", detail: canOptimize ? "최적화 계산 가능" : "목적지 2곳 필요", complete: canOptimize },
  ];

  return {
    stages,
    completedCount: stages.filter(stage => stage.complete).length,
    canOptimize,
  };
}
