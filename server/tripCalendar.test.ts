import { describe, expect, it } from "vitest";
import {
  makeTripCalendar,
  makeTripCalendarFileName,
} from "../shared/tripCalendar";

describe("trip calendar export", () => {
  it("creates a Korean all-day calendar event with route details", () => {
    const ics = makeTripCalendar(
      {
        title: "현장, 점검",
        tripDate: "2026-08-25",
        departureTime: "08:30",
        managerName: "홍길동",
        department: "건설과",
        returnToStart: true,
        fixedStartName: "시청 별관",
        routeDistanceKm: 12.4,
        routeDurationMinutes: 48,
        stops: [
          {
            sequence: 1,
            name: "시청; 본관",
            address: "서울, 중구",
            note: "담당자 확인",
            serviceMinutes: 35,
            windowStart: "09:00",
            windowEnd: "11:00",
          },
        ],
      },
      new Date("2026-08-24T03:04:05.000Z")
    );

    expect(ics).toMatch(/^\uFEFFBEGIN:VCALENDAR\r\n/);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260825");
    expect(ics).toContain("DTEND;VALUE=DATE:20260826");
    expect(ics).toContain("SUMMARY:현장\\, 점검");
    expect(ics).toContain("DESCRIPTION:담당자: 홍길동\\n부서: 건설과");
    expect(ics).toContain("출발 시각: 08:30");
    expect(ics).toContain("예정 09:18–09:53 · 체류 35분");
    expect(ics).toContain("가능 09:00–11:00");
    expect(ics).toContain("시청\\; 본관");
    expect(ics).toContain("예상 이동 거리: 12.4km");
    expect(ics).toContain("END:VCALENDAR\r\n");
  });

  it("folds long iCalendar lines without breaking the event", () => {
    const ics = makeTripCalendar({
      title: "긴 출장 계획",
      tripDate: "2026-08-25",
      managerName: "담당자",
      stops: [{ sequence: 1, name: "목적지", address: "주소".repeat(60) }],
    });

    const lines = ics.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines.filter(line => line.length > 75)).toHaveLength(0);
    expect(lines.some(line => line.startsWith(" "))).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("rejects a missing date or destination and creates a safe filename", () => {
    expect(() =>
      makeTripCalendar({
        title: "출장",
        tripDate: "",
        managerName: "담당자",
        stops: [{ sequence: 1, name: "시청", address: "서울" }],
      })
    ).toThrow("유효한 출장일");
    expect(() =>
      makeTripCalendar({
        title: "출장",
        tripDate: "2026-08-25",
        managerName: "담당자",
        stops: [],
      })
    ).toThrow("등록할 목적지");
    expect(makeTripCalendarFileName("도로/시설: 점검", "2026-08-25")).toBe(
      "도로-시설--점검-2026-08-25.ics"
    );
  });
});
