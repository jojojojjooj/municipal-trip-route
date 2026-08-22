import { describe, expect, it } from "vitest";
import { getTripReadiness } from "../shared/tripReadiness";

describe("출장 계획 준비 상태", () => {
  it("기본 정보와 두 개 이상 목적지가 있으면 동선 최적화 준비 상태가 된다", () => {
    const readiness = getTripReadiness("읍면동 현장 점검", "홍길동", 2);

    expect(readiness.completedCount).toBe(3);
    expect(readiness.canOptimize).toBe(true);
    expect(readiness.stages.map(stage => stage.complete)).toEqual([true, true, true]);
  });

  it("목적지가 하나 이하이면 동선 최적화 준비 상태가 아니다", () => {
    const readiness = getTripReadiness("", "", 1);

    expect(readiness.completedCount).toBe(1);
    expect(readiness.canOptimize).toBe(false);
    expect(readiness.stages[2]?.detail).toBe("목적지 2곳 필요");
  });
});
