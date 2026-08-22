import { describe, expect, it } from "vitest";
import { filterFieldRecords, getSelectedFieldRecords, toggleRecordSelection } from "../shared/fieldRecordFilters";

const records = [
  { storageKey: "a", destinationId: "city-hall", takenAt: "2026-08-20", description: "청사 주변 보행로 점검" },
  { storageKey: "b", destinationId: "city-hall", takenAt: "2026-08-21", description: "민원실 안내 표지판 확인" },
  { storageKey: "c", destinationId: "station", takenAt: "2026-08-21", description: "역사 출입 동선 확인" },
];

describe("field record filtering and selection", () => {
  it("filters records by date and destination together", () => {
    expect(filterFieldRecords(records, { takenAt: "2026-08-21", destinationId: "city-hall" }).map(record => record.storageKey)).toEqual(["b"]);
    expect(filterFieldRecords(records, { takenAt: "", destinationId: "station" }).map(record => record.storageKey)).toEqual(["c"]);
  });

  it("filters descriptions by a case-insensitive keyword together with other filters", () => {
    expect(filterFieldRecords(records, { takenAt: "", destinationId: "", descriptionQuery: "안내 표지판" }).map(record => record.storageKey)).toEqual(["b"]);
    expect(filterFieldRecords(records, { takenAt: "2026-08-21", destinationId: "", descriptionQuery: "확인" }).map(record => record.storageKey)).toEqual(["b", "c"]);
    expect(filterFieldRecords(records, { takenAt: "", destinationId: "", descriptionQuery: "UNKNOWN" })).toEqual([]);
  });

  it("only returns selected records that remain in the current filtered result", () => {
    const visibleRecords = filterFieldRecords(records, { takenAt: "2026-08-21", destinationId: "city-hall", descriptionQuery: "" });
    expect(getSelectedFieldRecords(visibleRecords, ["a", "b", "c"]).map(record => record.storageKey)).toEqual(["b"]);
  });

  it("adds and removes a selected record key", () => {
    expect(toggleRecordSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleRecordSelection(["a", "b"], "a")).toEqual(["b"]);
  });
});
