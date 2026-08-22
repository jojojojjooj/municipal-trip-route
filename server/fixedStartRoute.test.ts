import { describe, expect, it } from "vitest";
import { optimizeRouteFromFixedStart } from "../shared/fixedStartRoute";

describe("고정 출발지 경로 최적화", () => {
  it("지정한 출발지는 항상 경로의 첫 번째 지점으로 유지하고 방문 목적지에는 포함하지 않는다", () => {
    const start = { id: "office", name: "시청", address: "전북 정읍시", latitude: 35.57, longitude: 126.86 };
    const stops = [
      { id: "north", latitude: 35.61, longitude: 126.87 },
      { id: "east", latitude: 35.58, longitude: 126.93 },
      { id: "west", latitude: 35.56, longitude: 126.81 },
    ];

    const route = optimizeRouteFromFixedStart(start, stops);

    expect(route.orderedIds[0]).toBe("office");
    expect(route.orderedStopIds).not.toContain("office");
    expect(new Set(route.orderedStopIds)).toEqual(new Set(stops.map(stop => stop.id)));
    expect(route.totalDistanceKm).toBeGreaterThan(0);
  });

  it("왕복 옵션을 켜면 마지막 방문지에서 고정 출발지로 복귀하는 구간을 거리와 경로 끝에 추가한다", () => {
    const start = { id: "office", name: "시청", address: "전북 정읍시", latitude: 35.57, longitude: 126.86 };
    const stops = [
      { id: "north", latitude: 35.61, longitude: 126.87 },
      { id: "east", latitude: 35.58, longitude: 126.93 },
    ];

    const oneWay = optimizeRouteFromFixedStart(start, stops, false);
    const roundTrip = optimizeRouteFromFixedStart(start, stops, true);

    expect(roundTrip.orderedIds[0]).toBe("office");
    expect(roundTrip.orderedIds.at(-1)).toBe("office");
    expect(roundTrip.orderedStopIds).toEqual(oneWay.orderedStopIds);
    expect(roundTrip.returnDistanceKm).toBeGreaterThan(0);
    expect(roundTrip.totalDistanceKm).toBeGreaterThan(oneWay.totalDistanceKm);
    expect(roundTrip.isRoundTrip).toBe(true);
  });
});
