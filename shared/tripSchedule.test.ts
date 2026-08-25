import { describe, expect, it } from "vitest";
import { buildConstrainedVisitSchedule, isTimeOfDay } from "./tripSchedule";

describe("constrained visit schedule", () => {
  it("adds wait time before a visit window and flags a later violation", () => {
    const result = buildConstrainedVisitSchedule({
      tripDate: "2026-08-25",
      departureTime: "09:00",
      routeDurationMinutes: 60,
      stops: [
        {
          id: "one",
          serviceMinutes: 20,
          windowStart: "10:00",
          windowEnd: "12:00",
        },
        { id: "two", serviceMinutes: 15, windowEnd: "10:45" },
      ],
    });

    expect(result.stops[0]).toMatchObject({
      travelMinutes: 30,
      waitMinutes: 30,
      status: "on_time",
    });
    expect(result.stops[0]?.visitStart.getHours()).toBe(10);
    expect(result.stops[1]).toMatchObject({ status: "late", waitMinutes: 0 });
    expect(result.totalWaitMinutes).toBe(30);
    expect(result.totalServiceMinutes).toBe(35);
    expect(result.violations).toHaveLength(1);
  });

  it("marks a reverse time window as invalid and accepts valid time values", () => {
    const result = buildConstrainedVisitSchedule({
      tripDate: "2026-08-25",
      departureTime: "08:30",
      routeDurationMinutes: 0,
      stops: [{ id: "one", windowStart: "15:00", windowEnd: "10:00" }],
    });
    expect(result.stops[0]?.status).toBe("invalid_window");
    expect(isTimeOfDay("23:59")).toBe(true);
    expect(isTimeOfDay("24:00")).toBe(false);
  });
});
