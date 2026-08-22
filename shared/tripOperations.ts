export const EXECUTION_STATUSES = ["planned", "in_progress", "completed", "issue"] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export type TripChecklist = {
  preDeparture: boolean;
  onSite: boolean;
  wrapUp: boolean;
};

export const EMPTY_TRIP_CHECKLIST: TripChecklist = {
  preDeparture: false,
  onSite: false,
  wrapUp: false,
};

export function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return typeof value === "string" && EXECUTION_STATUSES.includes(value as ExecutionStatus);
}

export function executionStatusLabel(status: ExecutionStatus) {
  return ({ planned: "예정", in_progress: "진행", completed: "완료", issue: "이슈" })[status];
}

export function getTripIssueSummary(stops: Array<{ executionStatus?: ExecutionStatus; issueDueAt?: string | null; issueResolvedAt?: string | null }>, now = new Date()) {
  const issues = stops.filter(stop => stop.executionStatus === "issue");
  const overdue = issues.filter(stop => {
    if (!stop.issueDueAt || stop.issueResolvedAt) return false;
    const dueAt = new Date(`${stop.issueDueAt}T23:59:59`);
    return Number.isFinite(dueAt.getTime()) && dueAt.getTime() < now.getTime();
  });
  const resolved = stops.filter(stop => Boolean(stop.issueResolvedAt));
  return { total: issues.length, overdue: overdue.length, resolved: resolved.length, unresolved: issues.length - resolved.length };
}

export function getTripOperationSummary(stops: Array<{ executionStatus?: ExecutionStatus }>) {
  const counts = { planned: 0, in_progress: 0, completed: 0, issue: 0 };
  stops.forEach(stop => { counts[stop.executionStatus ?? "planned"] += 1; });
  const total = stops.length;
  return {
    total,
    ...counts,
    completionRate: total ? Math.round((counts.completed / total) * 100) : 0,
    nextIndex: stops.findIndex(stop => (stop.executionStatus ?? "planned") !== "completed"),
  };
}

export function getChecklistProgress(checklist: TripChecklist) {
  const completed = Object.values(checklist).filter(Boolean).length;
  return { completed, total: 3, percent: Math.round((completed / 3) * 100) };
}

export function buildVisitSchedule(tripDate: string, routeDurationMinutes: number, stopCount: number, dwellMinutes = 20) {
  if (!stopCount) return [];
  const travelPerStop = Math.max(1, Math.ceil(routeDurationMinutes / stopCount));
  const start = new Date(`${tripDate}T09:00:00`);
  return Array.from({ length: stopCount }, (_, index) => {
    const arrival = new Date(start.getTime() + index * (travelPerStop + dwellMinutes) * 60_000);
    return { sequence: index + 1, arrival, travelMinutes: travelPerStop, dwellMinutes };
  });
}
