import { describe, expect, it } from "vitest";
import { optimizeRoute, routeDistanceKm, type RoutePoint } from "../shared/tripOptimizer";

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
    expect(new Set(optimized.orderedIds)).toEqual(new Set(points.map(point => point.id)));
    expect(optimized.totalDistanceKm).toBeLessThanOrEqual(baselineDistance);
    expect(optimized.estimatedMinutes).toBeGreaterThanOrEqual(0);
  });
});

