import { describe, expect, it } from "vitest";
import { getTripPreflight } from "../shared/tripPreflight";

describe("trip preflight", () => {
  it("시간창 오류와 동기화 충돌을 출발 차단으로 분류한다", () => {
    const result = getTripPreflight({
      title: "",
      managerName: "담당",
      destinationCount: 1,
      invalidWindows: 1,
      lateVisits: 0,
      preDepartureChecked: true,
      offlinePending: 0,
      offlineConflicts: 1,
    });
    expect(result.status).toBe("blocked");
    expect(result.blockers).toHaveLength(3);
  });
  it("지연·체크리스트·대기열은 주의로 분류한다", () => {
    const result = getTripPreflight({
      title: "점검",
      managerName: "담당",
      destinationCount: 2,
      invalidWindows: 0,
      lateVisits: 1,
      preDepartureChecked: false,
      offlinePending: 2,
      offlineConflicts: 0,
    });
    expect(result.status).toBe("warning");
    expect(result.warnings).toHaveLength(3);
  });
});
