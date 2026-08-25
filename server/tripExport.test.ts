import { describe, expect, it } from "vitest";
import {
  makeTripStopsCsv,
  makeTripStopsCsvFileName,
  parseTripStopsCsv,
} from "../shared/tripExport";

describe("trip export", () => {
  it("exports operational and schedule columns with spreadsheet-safe Korean CSV content", () => {
    const csv = makeTripStopsCsv("현장, 점검", "2026-08-22", [
      {
        sequence: 1,
        name: "시청",
        address: "서울, 중구",
        latitude: 37.5665,
        longitude: 126.978,
        executionStatus: "completed",
        completedAt: "2026-08-22T01:00:00.000Z",
        issueNote: '안내판 "훼손"',
        note: "조치 요청",
        serviceMinutes: 35,
        windowStart: "09:30",
        windowEnd: "11:00",
      },
    ]);

    expect(csv).toMatch(
      /^\uFEFF출장명,출장일,순서,목적지,주소,위도,경도,실행 상태,완료 시각,현장 이슈,이슈 담당자,조치 기한,해결 시각,현장 메모,체류 시간\(분\),방문 가능 시작,방문 가능 종료/
    );
    expect(csv).toContain(
      '"현장, 점검",2026-08-22,1,시청,"서울, 중구",37.5665,126.978,완료,2026-08-22T01:00:00.000Z,"안내판 ""훼손""",,,,조치 요청,35,09:30,11:00'
    );
  });

  it("round-trips exported destinations, including quoted multiline values and time constraints", () => {
    const csv = makeTripStopsCsv("현장, 점검", "2026-08-22", [
      {
        sequence: 2,
        name: "구청",
        address: "서울, 종로구",
        latitude: 37.5735,
        longitude: 126.9788,
        executionStatus: "issue",
        issueNote: "첫 줄\n두 번째 줄",
        note: '담당자 "확인"',
        serviceMinutes: 45,
        windowStart: "13:00",
        windowEnd: "15:30",
      },
      {
        sequence: 1,
        name: "시청",
        address: "서울 중구",
        latitude: 37.5665,
        longitude: 126.978,
        executionStatus: "completed",
        completedAt: "2026-08-22T01:00:00.000Z",
      },
    ]);

    const parsed = parseTripStopsCsv(csv);
    expect(parsed.title).toBe("현장, 점검");
    expect(parsed.tripDate).toBe("2026-08-22");
    expect(parsed.stops).toEqual([
      expect.objectContaining({
        sequence: 1,
        name: "시청",
        executionStatus: "completed",
        serviceMinutes: 20,
      }),
      expect.objectContaining({
        sequence: 2,
        name: "구청",
        executionStatus: "issue",
        issueNote: "첫 줄\n두 번째 줄",
        note: '담당자 "확인"',
        serviceMinutes: 45,
        windowStart: "13:00",
        windowEnd: "15:30",
      }),
    ]);
  });

  it("rejects malformed headers and invalid coordinates", () => {
    expect(() => parseTripStopsCsv("목적지,주소\n시청,서울")).toThrow(
      "여정도에서 내보낸 목적지 CSV 형식이 아닙니다."
    );
    const validHeader =
      "출장명,출장일,순서,목적지,주소,위도,경도,실행 상태,완료 시각,현장 이슈,이슈 담당자,조치 기한,해결 시각,현장 메모";
    expect(() =>
      parseTripStopsCsv(
        `${validHeader}\n출장,2026-08-22,1,시청,서울,100,126.9,예정,,,,,,`
      )
    ).toThrow("위도 범위가 올바르지 않습니다.");
  });

  it("accepts legacy CSV files and validates newly added schedule columns", () => {
    const legacyHeader =
      "출장명,출장일,순서,목적지,주소,위도,경도,실행 상태,완료 시각,현장 이슈,이슈 담당자,조치 기한,해결 시각,현장 메모";
    const legacy = parseTripStopsCsv(
      `${legacyHeader}\n출장,2026-08-22,1,시청,서울,37.5,126.9,예정,,,,,,`
    );
    expect(legacy.stops[0]).toMatchObject({ serviceMinutes: 20 });

    const currentHeader = `${legacyHeader},체류 시간(분),방문 가능 시작,방문 가능 종료`;
    expect(() =>
      parseTripStopsCsv(
        `${currentHeader}\n출장,2026-08-22,1,시청,서울,37.5,126.9,예정,,,,,,,20,9:00,11:00`
      )
    ).toThrow("방문 가능 시작은 HH:mm 형식이어야 합니다.");
  });

  it("makes a safe destination-list filename", () => {
    expect(makeTripStopsCsvFileName("도로/시설: 점검", "2026-08-22")).toBe(
      "도로-시설--점검-2026-08-22-목적지.csv"
    );
  });
});
