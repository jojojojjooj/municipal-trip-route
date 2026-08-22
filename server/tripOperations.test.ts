import { describe, expect, it } from "vitest";
import { buildVisitSchedule, EMPTY_TRIP_CHECKLIST, getChecklistProgress, getTripIssueSummary, getTripOperationSummary } from "../shared/tripOperations";
import { makeTripStopsCsv } from "../shared/tripExport";

describe("trip operations", () => {
  it("summarizes status progress and identifies the next unfinished stop", () => {
    const summary = getTripOperationSummary([{ executionStatus: "completed" }, { executionStatus: "in_progress" }, { executionStatus: "issue" }, { executionStatus: "planned" }]);
    expect(summary).toMatchObject({ total: 4, completed: 1, in_progress: 1, issue: 1, planned: 1, completionRate: 25, nextIndex: 1 });
  });

  it("builds an ordered expected-arrival schedule and checklist progress", () => {
    const schedule = buildVisitSchedule("2026-08-22", 60, 3);
    expect(schedule).toHaveLength(3);
    expect(schedule[1].arrival.getTime()).toBeGreaterThan(schedule[0].arrival.getTime());
    expect(getChecklistProgress({ ...EMPTY_TRIP_CHECKLIST, preDeparture: true, onSite: true })).toEqual({ completed: 2, total: 3, percent: 67 });
  });

  it("counts unresolved, resolved, and overdue issues without treating resolved items as overdue", () => {
    const summary = getTripIssueSummary([
      { executionStatus: "issue", issueDueAt: "2026-08-20" },
      { executionStatus: "issue", issueDueAt: "2026-08-21", issueResolvedAt: "2026-08-21T04:00:00.000Z" },
      { executionStatus: "completed", issueResolvedAt: "2026-08-22T04:00:00.000Z" },
    ], new Date("2026-08-22T03:00:00.000Z"));

    expect(summary).toEqual({ total: 2, overdue: 1, resolved: 2, unresolved: 0 });
  });

  it("exports operational stop data as an Excel-compatible CSV", () => {
    const csv = makeTripStopsCsv("보행로, 점검", "2026-08-22", [{ sequence: 1, name: "시청", address: "서울 중구", latitude: 37.56, longitude: 126.97, executionStatus: "issue", issueNote: "안내판 \"훼손\"", issueOwner: "시설팀", issueDueAt: "2026-08-23", issueResolvedAt: "2026-08-24T01:00:00.000Z" }]);
    expect(csv).toContain("\uFEFF출장명");
    expect(csv).toContain('"보행로, 점검"');
    expect(csv).toContain('"안내판 ""훼손"""');
    expect(csv).toContain("이슈");
    expect(csv).toContain("이슈 담당자");
    expect(csv).toContain("시설팀");
  });
});
