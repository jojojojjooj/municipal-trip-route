import { describe, expect, it } from "vitest";
import { buildBatchTripTitle, parseBatchDates } from "../shared/tripBatch";

describe("trip batch helpers", () => {
  it("normalizes whitespace-separated dates, sorts them, and reports duplicates", () => {
    expect(
      parseBatchDates("2026-09-12\n2026-09-01, 2026-09-12; 2026-02-30")
    ).toEqual({
      dates: ["2026-09-01", "2026-09-12"],
      invalid: ["2026-02-30"],
      duplicates: ["2026-09-12"],
    });
  });

  it("accepts array input and ignores blank values", () => {
    expect(parseBatchDates(["", "2026-01-01", " 2026-01-02 "])).toEqual({
      dates: ["2026-01-01", "2026-01-02"],
      invalid: [],
      duplicates: [],
    });
  });

  it("builds a bounded title for each generated plan", () => {
    expect(buildBatchTripTitle("하천 정기 점검", "2026-09-01")).toBe(
      "하천 정기 점검 · 2026-09-01"
    );
    expect(buildBatchTripTitle("", "2026-09-01")).toBe(
      "반복 출장 · 2026-09-01"
    );
    expect(
      buildBatchTripTitle("가".repeat(200), "2026-09-01").length
    ).toBeLessThanOrEqual(150);
  });
});
