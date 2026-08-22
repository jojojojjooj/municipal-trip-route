import { describe, expect, it } from "vitest";
import { makeTripStopsCsv, makeTripStopsCsvFileName } from "../shared/tripExport";

describe("trip export", () => {
  it("exports operational columns with spreadsheet-safe Korean CSV content", () => {
    const csv = makeTripStopsCsv("현장, 점검", "2026-08-22", [{ sequence: 1, name: "시청", address: "서울, 중구", latitude: 37.5665, longitude: 126.978, executionStatus: "completed", completedAt: "2026-08-22T01:00:00.000Z", issueNote: "안내판 \"훼손\"", note: "조치 요청" }]);

    expect(csv).toMatch(/^\uFEFF출장명,출장일,순서,목적지/);
    expect(csv).toContain('"현장, 점검",2026-08-22,1,시청,"서울, 중구",37.5665,126.978,완료,2026-08-22T01:00:00.000Z,"안내판 ""훼손""",,,,조치 요청');
  });

  it("makes a safe destination-list filename", () => {
    expect(makeTripStopsCsvFileName("도로/시설: 점검", "2026-08-22")).toBe("도로-시설--점검-2026-08-22-목적지.csv");
  });
});
