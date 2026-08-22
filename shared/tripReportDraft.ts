import { getTripIssueSummary, getTripOperationSummary, type ExecutionStatus, type TripChecklist } from "./tripOperations";

export type ReportDestination = {
  name: string;
  address: string;
  executionStatus?: ExecutionStatus;
  completedAt?: string;
  issueNote?: string;
  issueOwner?: string;
  issueDueAt?: string;
  issueResolvedAt?: string;
  photos?: { storageKey: string; description?: string }[];
};

export type TripResultReportDraft = {
  overview: string;
  outcome: string;
  issueActions: string;
  followUp: string;
  generatedAt: string;
  evidenceOrder?: string[];
  excludedEvidenceKeys?: string[];
};

export type TripResultReportInput = {
  title: string;
  tripDate: string;
  managerName: string;
  department?: string;
  fixedStart?: { name: string; address: string } | null;
  returnToStart: boolean;
  routeDistanceKm: number;
  routeDurationMinutes: number;
  checklist: TripChecklist;
  destinations: ReportDestination[];
};

export function createTripResultReportDraft(input: TripResultReportInput, generatedAt = new Date().toISOString()): TripResultReportDraft {
  const operation = getTripOperationSummary(input.destinations);
  const issues = getTripIssueSummary(input.destinations, new Date(generatedAt));
  const completedNames = input.destinations.filter(destination => destination.executionStatus === "completed").map(destination => destination.name);
  const evidenceCount = input.destinations.reduce((count, destination) => count + (destination.photos?.length ?? 0), 0);
  const pendingDestinations = input.destinations.filter(destination => destination.executionStatus !== "completed").map(destination => destination.name);
  const openIssueLines = input.destinations
    .filter(destination => destination.executionStatus === "issue" || (destination.issueNote && !destination.issueResolvedAt))
    .map(destination => `- ${destination.name}: ${destination.issueNote || "현장 확인 필요"} (담당 ${destination.issueOwner || "미지정"}${destination.issueDueAt ? `, 기한 ${destination.issueDueAt}` : ""})`);
  const checklistDone = [input.checklist.preDeparture, input.checklist.onSite, input.checklist.wrapUp].filter(Boolean).length;
  const title = input.title.trim() || "출장";
  const date = input.tripDate || "일정 미정";
  const route = `${input.routeDistanceKm.toFixed(1)}km / 약 ${input.routeDurationMinutes}분`;
  const start = input.fixedStart ? `${input.fixedStart.name}(${input.fixedStart.address})` : "별도 출발지 미지정";

  return {
    overview: `${date} ${title}을(를) ${input.managerName.trim() || "담당자 미입력"}${input.department?.trim() ? `(${input.department.trim()})` : ""} 주관으로 수행했다. ${start}에서 출발해 ${input.destinations.length}개 목적지를 ${input.returnToStart ? "왕복" : "편도"} 동선으로 방문했으며, 계획 이동 규모는 ${route}이다.`,
    outcome: `현장 실행 결과 목적지 ${input.destinations.length}곳 중 ${operation.completed}곳을 완료하여 완료율은 ${operation.completionRate}%이다. ${completedNames.length ? `완료 대상은 ${completedNames.join(", ")}이다. ` : "완료 처리된 목적지는 아직 없다. "}운영 체크리스트는 ${checklistDone}/3 항목을 확인했으며, 현장 사진 ${evidenceCount}건을 증빙 자료로 기록했다.`,
    issueActions: openIssueLines.length ? `미해결 또는 조치 중 이슈는 다음과 같다.\n${openIssueLines.join("\n")}\n\n기한 경과 이슈는 ${issues.overdue}건이며, 담당 부서는 조치 결과와 증빙 자료를 보완해야 한다.` : issues.resolved ? `이번 출장에서 기록된 이슈 ${issues.resolved}건은 해결 처리됐다. 해결 근거와 현장 사진은 계획의 목적지 기록에서 확인할 수 있다.` : "현장 이슈가 기록되지 않았다. 추후 민원·시설 상태 변화 여부를 정기적으로 확인한다.",
    followUp: pendingDestinations.length ? `미완료 목적지 ${pendingDestinations.join(", ")}의 방문 일정과 조치 담당자를 재확인한다. 이슈 조치가 완료되면 상태·완료 시각·사진 증빙을 업데이트하고 결과 보고서를 최종 확정한다.` : "출장 결과와 현장 증빙을 관련 부서에 공유하고, 후속 점검이 필요한 사항은 관리 대장에 등록한다. 필요 시 다음 정기 점검 일정에 반영한다.",
    generatedAt,
  };
}

export function parseTripResultReportDraft(value: string | null | undefined): TripResultReportDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<TripResultReportDraft>;
    if (typeof parsed.overview !== "string" || typeof parsed.outcome !== "string" || typeof parsed.issueActions !== "string" || typeof parsed.followUp !== "string") return null;
    const evidenceOrder = Array.isArray(parsed.evidenceOrder) ? parsed.evidenceOrder.filter((storageKey): storageKey is string => typeof storageKey === "string" && storageKey.length > 0).slice(0, 6) : undefined;
    const excludedEvidenceKeys = Array.isArray(parsed.excludedEvidenceKeys) ? parsed.excludedEvidenceKeys.filter((storageKey): storageKey is string => typeof storageKey === "string" && storageKey.length > 0).slice(0, 6) : undefined;
    return { overview: parsed.overview, outcome: parsed.outcome, issueActions: parsed.issueActions, followUp: parsed.followUp, generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : new Date().toISOString(), ...(evidenceOrder?.length ? { evidenceOrder } : {}), ...(excludedEvidenceKeys?.length ? { excludedEvidenceKeys } : {}) };
  } catch {
    return null;
  }
}
