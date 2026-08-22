import { describe, expect, it } from "vitest";
import { createNewTripDraft, hasNewTripContent } from "../shared/newTripPlan";

describe("new trip plan state", () => {
  it("creates a blank draft while preserving the requested trip date", () => {
    expect(createNewTripDraft("2026-08-22")).toEqual({
      title: "",
      tripDate: "2026-08-22",
      managerName: "",
      fixedStartQuery: "",
      addressQuery: "",
      returnToStart: false,
      selectedPlanId: null,
      fieldRecordFilter: { takenAt: "", destinationId: "", descriptionQuery: "" },
    });
  });

  it("requests confirmation only when the current planner contains plan content", () => {
    expect(hasNewTripContent({ title: "", managerName: "", destinationCount: 0, hasFixedStart: false, selectedPlanId: null })).toBe(false);
    expect(hasNewTripContent({ title: "시설 점검", managerName: "", destinationCount: 0, hasFixedStart: false, selectedPlanId: null })).toBe(true);
    expect(hasNewTripContent({ title: "", managerName: "", destinationCount: 0, hasFixedStart: true, selectedPlanId: null })).toBe(true);
    expect(hasNewTripContent({ title: "", managerName: "", destinationCount: 0, hasFixedStart: false, selectedPlanId: 7 })).toBe(true);
  });
});
