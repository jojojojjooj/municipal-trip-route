import { describe, expect, it } from "vitest";
import { makeFieldRecordPdfFileName, makeTripPdfFileName } from "../shared/pdfReport";

describe("makeTripPdfFileName", () => {
  it("creates a dated Korean filename for a trip report", () => {
    expect(makeTripPdfFileName("읍면동 현장 점검", "2026-08-21")).toBe("2026-08-21_읍면동 현장 점검_출장요약.pdf");
  });

  it("removes unsafe filename characters and supplies fallbacks", () => {
    expect(makeTripPdfFileName("현장/점검: A?", "not-a-date")).toBe("undated_현장-점검- A-_출장요약.pdf");
    expect(makeTripPdfFileName("", "2026-08-21")).toBe("2026-08-21_출장경로_출장요약.pdf");
  });
});

describe("makeFieldRecordPdfFileName", () => {
  it("creates a dated Korean filename for a field-record report", () => {
    expect(makeFieldRecordPdfFileName("읍면동 현장 점검", "2026-08-21")).toBe("2026-08-21_읍면동 현장 점검_현장기록.pdf");
  });
});
