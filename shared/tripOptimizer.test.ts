import { describe, expect, it } from "vitest";
import { optimizeRoute, routeDistanceKm, type RoutePoint } from "./tripOptimizer";

const points: RoutePoint[] = [
  { id: "origin", latitude: 35.5692, longitude: 126.8556 },
  { id: "east", latitude: 35.5701, longitude: 126.9041 },
  { id: "north", latitude: 35.6052, longitude: 126.8672 },
  { id: "west", latitude: 35.5638, longitude: 126.8213 },
];

describe("optimizeRoute", () => {
  it("keeps the departure point, visits every destination once, and improves the baseline order", () => {
    const baselineDistance = routeDistanceKm(points);
    const optimized = optimizeRoute(points);

    expect(optimized.orderedIds[0]).toBe("origin");
    expect(new Set(optimized.orderedIds)).toEqual(new Set(points.map(point => point.id)));
    expect(optimized.totalDistanceKm).toBeLessThanOrEqual(baselineDistance);
    expect(optimized.estimatedMinutes).toBeGreaterThanOrEqual(0);
  });
});
