import { describe, expect, it } from "vitest";
import { createTripResultReportDraft, parseTripResultReportDraft } from "../shared/tripReportDraft";

describe("trip result report draft", () => {
  it("summarizes actual completion, evidence, and unresolved issue data", () => {
    const draft = createTripResultReportDraft({
      title: "보행 환경 점검",
      tripDate: "2026-08-22",
      managerName: "김담당",
      department: "안전총괄과",
      fixedStart: { name: "시청", address: "서울 중구" },
      returnToStart: true,
      routeDistanceKm: 12.4,
      routeDurationMinutes: 38,
      checklist: { preDeparture: true, onSite: true, wrapUp: false },
      destinations: [
        { name: "시청", address: "서울 중구", executionStatus: "completed", photos: [{ storageKey: "photo-1" }] },
        { name: "서울역", address: "서울 중구", executionStatus: "issue", issueNote: "보도 경계석 확인", issueOwner: "시설팀", issueDueAt: "2026-08-23" },
      ],
    }, "2026-08-22T09:00:00.000Z");

    expect(draft.overview).toContain("12.4km / 약 38분");
    expect(draft.outcome).toContain("완료율은 50%");
    expect(draft.outcome).toContain("현장 사진 1건");
    expect(draft.issueActions).toContain("서울역");
    expect(draft.issueActions).toContain("시설팀");
    expect(draft.followUp).toContain("서울역");
  });

  it("rejects malformed persisted content and restores a complete editable draft", () => {
    expect(parseTripResultReportDraft("not-json")).toBeNull();
    expect(parseTripResultReportDraft(JSON.stringify({ overview: "개요" }))).toBeNull();
    expect(parseTripResultReportDraft(JSON.stringify({ overview: "개요", outcome: "결과", issueActions: "조치", followUp: "계획", generatedAt: "2026-08-22T09:00:00.000Z", evidenceOrder: ["photo-3", "photo-1"], excludedEvidenceKeys: ["photo-2"] }))).toMatchObject({ outcome: "결과", followUp: "계획", evidenceOrder: ["photo-3", "photo-1"], excludedEvidenceKeys: ["photo-2"] });
  });
});
