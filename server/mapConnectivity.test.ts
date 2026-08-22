import { describe, expect, it } from "vitest";
import {
  MAP_AUTO_RETRY_LIMIT,
  getScheduledMapRetryAttempt,
  shouldScheduleMapRetry,
} from "../shared/mapConnectivity";

describe("지도 연결 재시도 정책", () => {
  it("온라인 상태에서는 최대 3회까지 다음 자동 재시도를 예약한다", () => {
    expect(getScheduledMapRetryAttempt(0)).toBe(1);
    expect(getScheduledMapRetryAttempt(2)).toBe(MAP_AUTO_RETRY_LIMIT);
    expect(shouldScheduleMapRetry(true, 0)).toBe(true);
    expect(shouldScheduleMapRetry(true, MAP_AUTO_RETRY_LIMIT)).toBe(false);
  });

  it("오프라인 상태에서는 자동 재시도를 예약하지 않는다", () => {
    expect(shouldScheduleMapRetry(false, 0)).toBe(false);
  });
});
