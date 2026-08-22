import { describe, expect, it } from "vitest";
import { filterTripReportEvidence, moveTripReportEvidenceOrder, orderTripReportEvidence, selectTripReportEvidence } from "../shared/tripReportEvidence";

describe("trip report evidence", () => {
  it("selects a representative photo from each destination before adding secondary photos", () => {
    const evidence = selectTripReportEvidence([
      { id: "one", name: "시청", address: "서울 중구", executionStatus: "completed", photos: [{ storageKey: "one-plain", url: "plain", fileName: "plain.jpg" }, { storageKey: "one-described", url: "described", fileName: "described.jpg", takenAt: "2026-08-22", description: "안내 표지판 확인" }] },
      { id: "two", name: "서울역", address: "서울 중구", executionStatus: "issue", photos: [{ storageKey: "two-issue", url: "issue", fileName: "issue.jpg", description: "보도 경계석 확인" }] },
    ]);

    expect(evidence.map(item => item.storageKey)).toEqual(["one-described", "two-issue", "one-plain"]);
    expect(evidence[0]).toMatchObject({ destinationName: "시청", sequence: 1, takenAt: "2026-08-22" });
    expect(evidence[1]).toMatchObject({ destinationName: "서울역", sequence: 2 });
  });

  it("limits report evidence and handles an empty capacity", () => {
    const photos = Array.from({ length: 8 }, (_, index) => ({ storageKey: `photo-${index}`, url: `url-${index}`, fileName: `photo-${index}.jpg`, description: `설명 ${index}` }));
    expect(selectTripReportEvidence([{ id: "one", name: "현장", address: "주소", photos }]).map(item => item.storageKey)).toHaveLength(6);
    expect(selectTripReportEvidence([{ id: "one", name: "현장", address: "주소", photos }], 0)).toEqual([]);
  });

  it("applies a saved manual order while keeping unlisted evidence after it", () => {
    const evidence = selectTripReportEvidence([
      { id: "one", name: "시청", address: "서울 중구", photos: [{ storageKey: "one", url: "one", fileName: "one.jpg" }] },
      { id: "two", name: "서울역", address: "서울 중구", photos: [{ storageKey: "two", url: "two", fileName: "two.jpg" }] },
      { id: "three", name: "광장", address: "서울 중구", photos: [{ storageKey: "three", url: "three", fileName: "three.jpg" }] },
    ]);

    expect(orderTripReportEvidence(evidence, ["three", "one"]).map(item => item.storageKey)).toEqual(["three", "one", "two"]);
  });

  it("moves a photo one position at a time and protects first and last positions", () => {
    const evidence = selectTripReportEvidence([
      { id: "one", name: "시청", address: "서울 중구", photos: [{ storageKey: "one", url: "one", fileName: "one.jpg" }] },
      { id: "two", name: "서울역", address: "서울 중구", photos: [{ storageKey: "two", url: "two", fileName: "two.jpg" }] },
      { id: "three", name: "광장", address: "서울 중구", photos: [{ storageKey: "three", url: "three", fileName: "three.jpg" }] },
    ]);

    expect(moveTripReportEvidenceOrder(evidence, "two", "up")).toEqual(["two", "one", "three"]);
    expect(moveTripReportEvidenceOrder(evidence, "two", "down")).toEqual(["one", "three", "two"]);
    expect(moveTripReportEvidenceOrder(evidence, "one", "up")).toBeNull();
    expect(moveTripReportEvidenceOrder(evidence, "three", "down")).toBeNull();
  });

  it("removes excluded evidence without changing the order of included photos", () => {
    const evidence = selectTripReportEvidence([
      { id: "one", name: "시청", address: "서울 중구", photos: [{ storageKey: "one", url: "one", fileName: "one.jpg" }] },
      { id: "two", name: "서울역", address: "서울 중구", photos: [{ storageKey: "two", url: "two", fileName: "two.jpg" }] },
      { id: "three", name: "광장", address: "서울 중구", photos: [{ storageKey: "three", url: "three", fileName: "three.jpg" }] },
    ]);

    const ordered = orderTripReportEvidence(evidence, ["three", "one", "two"]);
    expect(filterTripReportEvidence(ordered, ["one"]).map(item => item.storageKey)).toEqual(["three", "two"]);
  });
});
