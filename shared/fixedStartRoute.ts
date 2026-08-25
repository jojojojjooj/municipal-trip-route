import {
  distanceKm,
  optimizeRoute,
  type OptimizeOptions,
  type RoutePoint,
} from "./tripOptimizer";

export type FixedStart = RoutePoint & {
  name: string;
  address: string;
};

export function optimizeRouteFromFixedStart(
  fixedStart: FixedStart | null,
  stops: RoutePoint[],
  returnToStart = false,
  options: OptimizeOptions = {}
) {
  const points = fixedStart ? [fixedStart, ...stops] : stops;
  const summary = optimizeRoute(points, options);
  const shouldReturn =
    returnToStart && fixedStart !== null && summary.orderedIds.length > 1;
  const lastPoint = points.find(
    point => point.id === summary.orderedIds.at(-1)
  );
  const returnDistanceKm =
    shouldReturn && lastPoint ? distanceKm(lastPoint, fixedStart) : 0;

  return {
    ...summary,
    orderedIds: shouldReturn
      ? [...summary.orderedIds, fixedStart.id]
      : summary.orderedIds,
    orderedStopIds: fixedStart
      ? summary.orderedIds.filter(id => id !== fixedStart.id)
      : summary.orderedIds,
    totalDistanceKm: summary.totalDistanceKm + returnDistanceKm,
    estimatedMinutes: Math.ceil(
      ((summary.totalDistanceKm + returnDistanceKm) / 32) * 60
    ),
    returnDistanceKm,
    isRoundTrip: shouldReturn,
  };
}
