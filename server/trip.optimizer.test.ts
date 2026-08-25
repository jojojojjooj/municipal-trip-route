import { describe, expect, it } from "vitest";
import {
  optimizeRoute,
  routeDistanceKm,
  type RoutePoint,
} from "../shared/tripOptimizer";

const points: RoutePoint[] = [
  { id: "origin", latitude: 35.5692, longitude: 126.8556 },
  { id: "east", latitude: 35.5701, longitude: 126.9041 },
  { id: "north", latitude: 35.6052, longitude: 126.8672 },
  { id: "west", latitude: 35.5638, longitude: 126.8213 },
];

describe("출장 동선 TSP 근사 최적화", () => {
  it("출발지를 유지하며 모든 목적지를 한 번씩 포함하고 기준 순서보다 긴 동선을 만들지 않는다", () => {
    const baselineDistance = routeDistanceKm(points);
    const optimized = optimizeRoute(points);

    expect(optimized.orderedIds[0]).toBe("origin");
    expect(new Set(optimized.orderedIds)).toEqual(
      new Set(points.map(point => point.id))
    );
    expect(optimized.totalDistanceKm).toBeLessThanOrEqual(baselineDistance);
    expect(optimized.estimatedMinutes).toBeGreaterThanOrEqual(0);
  });

  it("시간창 우선 모드는 임박한 방문 종료 시각을 고려해 지연 위험이 적은 순서를 선택한다", () => {
    const timeConstrainedPoints: RoutePoint[] = [
      { id: "origin", latitude: 37.5665, longitude: 126.978 },
      {
        id: "near",
        latitude: 37.5665,
        longitude: 126.988,
        serviceMinutes: 5,
      },
      {
        id: "deadline",
        latitude: 37.5665,
        longitude: 127.078,
        serviceMinutes: 5,
        windowEnd: "09:20",
      },
    ];

    const optimized = optimizeRoute(timeConstrainedPoints, {
      strategy: "schedule",
      departureTime: "09:00",
      startsWithFixedPoint: true,
    });

    expect(optimized.orderedIds).toEqual(["origin", "deadline", "near"]);
    expect(new Set(optimized.orderedIds)).toEqual(
      new Set(timeConstrainedPoints.map(point => point.id))
    );
    expect(optimized.optimizationStrategy).toBe("schedule");
  });
});
