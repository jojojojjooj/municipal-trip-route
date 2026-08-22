export type RoutePoint = {
  id: string;
  latitude: number;
  longitude: number;
};

export type RouteSummary = {
  orderedIds: string[];
  totalDistanceKm: number;
  estimatedMinutes: number;
};

const EARTH_RADIUS_KM = 6371;
const AVERAGE_CITY_SPEED_KMH = 32;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function distanceKm(a: RoutePoint, b: RoutePoint) {
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const startLatitude = toRadians(a.latitude);
  const endLatitude = toRadians(b.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function routeDistanceKm(points: RoutePoint[]) {
  return points.slice(1).reduce((total, point, index) => total + distanceKm(points[index], point), 0);
}

function nearestNeighbor(points: RoutePoint[]) {
  if (points.length < 3) return [...points];

  const unvisited = points.slice(1);
  const ordered = [points[0]];

  while (unvisited.length) {
    const current = ordered[ordered.length - 1];
    let nearestIndex = 0;
    let nearestDistance = distanceKm(current, unvisited[0]);

    for (let index = 1; index < unvisited.length; index += 1) {
      const candidateDistance = distanceKm(current, unvisited[index]);
      if (candidateDistance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = candidateDistance;
      }
    }

    ordered.push(unvisited.splice(nearestIndex, 1)[0]);
  }

  return ordered;
}

function improveWithTwoOpt(initialRoute: RoutePoint[]) {
  if (initialRoute.length < 4) return initialRoute;

  const route = [...initialRoute];
  let improved = true;

  while (improved) {
    improved = false;
    for (let start = 1; start < route.length - 2; start += 1) {
      for (let end = start + 1; end < route.length - 1; end += 1) {
        const before = distanceKm(route[start - 1], route[start]) + distanceKm(route[end], route[end + 1]);
        const after = distanceKm(route[start - 1], route[end]) + distanceKm(route[start], route[end + 1]);
        if (after + 0.0001 < before) {
          const reversed = route.slice(start, end + 1).reverse();
          route.splice(start, reversed.length, ...reversed);
          improved = true;
        }
      }
    }
  }

  return route;
}

/**
 * Open-route TSP approximation: keeps the first location as the departure point,
 * creates a nearest-neighbor route, then applies 2-opt segment improvements.
 */
export function optimizeRoute(points: RoutePoint[]): RouteSummary {
  const ordered = improveWithTwoOpt(nearestNeighbor(points));
  const totalDistanceKm = routeDistanceKm(ordered);

  return {
    orderedIds: ordered.map(point => point.id),
    totalDistanceKm,
    estimatedMinutes: Math.ceil((totalDistanceKm / AVERAGE_CITY_SPEED_KMH) * 60),
  };
}
