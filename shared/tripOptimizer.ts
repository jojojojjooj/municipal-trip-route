export type RoutePoint = {
  id: string;
  latitude: number;
  longitude: number;
};

export type OptimizationStrategy = "fast" | "quality";

export type OptimizeOptions = {
  strategy?: OptimizationStrategy;
};

export type RouteSummary = {
  orderedIds: string[];
  totalDistanceKm: number;
  estimatedMinutes: number;
  optimizationStrategy: OptimizationStrategy;
};

const EARTH_RADIUS_KM = 6371;
const AVERAGE_CITY_SPEED_KMH = 32;
const TWO_OPT_EPSILON_KM = 0.0001;

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
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)))
  );
}

export function routeDistanceKm(points: RoutePoint[]) {
  return points
    .slice(1)
    .reduce(
      (total, point, index) => total + distanceKm(points[index], point),
      0
    );
}

type DistanceMatrix = number[][];

function createDistanceMatrix(points: RoutePoint[]): DistanceMatrix {
  const matrix = Array.from({ length: points.length }, () =>
    Array<number>(points.length).fill(0)
  );
  for (let row = 0; row < points.length; row += 1) {
    for (let column = row + 1; column < points.length; column += 1) {
      const distance = distanceKm(points[row], points[column]);
      matrix[row][column] = distance;
      matrix[column][row] = distance;
    }
  }
  return matrix;
}

function routeDistanceByIndex(route: number[], matrix: DistanceMatrix) {
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    total += matrix[route[index - 1]][route[index]];
  }
  return total;
}

function nearestNeighborIndices(pointCount: number, matrix: DistanceMatrix) {
  if (pointCount < 3)
    return Array.from({ length: pointCount }, (_, index) => index);
  const unvisited = new Set(
    Array.from({ length: pointCount - 1 }, (_, index) => index + 1)
  );
  const route = [0];

  while (unvisited.size) {
    const current = route[route.length - 1];
    let nearest = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of Array.from(unvisited)) {
      const candidateDistance = matrix[current][candidate];
      if (
        candidateDistance < nearestDistance ||
        (candidateDistance === nearestDistance && candidate < nearest)
      ) {
        nearest = candidate;
        nearestDistance = candidateDistance;
      }
    }
    route.push(nearest);
    unvisited.delete(nearest);
  }

  return route;
}

function cheapestInsertionIndices(pointCount: number, matrix: DistanceMatrix) {
  if (pointCount < 3)
    return Array.from({ length: pointCount }, (_, index) => index);
  const unvisited = new Set(
    Array.from({ length: pointCount - 1 }, (_, index) => index + 1)
  );
  const firstStop = Array.from(unvisited).reduce((closest, candidate) =>
    matrix[0][candidate] < matrix[0][closest] ? candidate : closest
  );
  const route = [0, firstStop];
  unvisited.delete(firstStop);

  while (unvisited.size) {
    let selectedCandidate = -1;
    let selectedPosition = route.length;
    let selectedCost = Number.POSITIVE_INFINITY;

    for (const candidate of Array.from(unvisited)) {
      for (let position = 1; position <= route.length; position += 1) {
        const previous = route[position - 1];
        const next = route[position];
        const insertionCost =
          next === undefined
            ? matrix[previous][candidate]
            : matrix[previous][candidate] +
              matrix[candidate][next] -
              matrix[previous][next];
        if (
          insertionCost < selectedCost ||
          (insertionCost === selectedCost && candidate < selectedCandidate)
        ) {
          selectedCandidate = candidate;
          selectedPosition = position;
          selectedCost = insertionCost;
        }
      }
    }

    route.splice(selectedPosition, 0, selectedCandidate);
    unvisited.delete(selectedCandidate);
  }

  return route;
}

function improveWithTwoOpt(initialRoute: number[], matrix: DistanceMatrix) {
  if (initialRoute.length < 4) return initialRoute;
  const route = [...initialRoute];

  while (true) {
    let bestStart = -1;
    let bestEnd = -1;
    let bestGain = TWO_OPT_EPSILON_KM;
    for (let start = 1; start < route.length - 2; start += 1) {
      for (let end = start + 1; end < route.length - 1; end += 1) {
        const before =
          matrix[route[start - 1]][route[start]] +
          matrix[route[end]][route[end + 1]];
        const after =
          matrix[route[start - 1]][route[end]] +
          matrix[route[start]][route[end + 1]];
        const gain = before - after;
        if (gain > bestGain) {
          bestStart = start;
          bestEnd = end;
          bestGain = gain;
        }
      }
    }
    if (bestStart === -1) break;
    const reversed = route.slice(bestStart, bestEnd + 1).reverse();
    route.splice(bestStart, reversed.length, ...reversed);
  }

  return route;
}

function selectBestRoute(candidates: number[][], matrix: DistanceMatrix) {
  return candidates.reduce((best, candidate) =>
    routeDistanceByIndex(candidate, matrix) < routeDistanceByIndex(best, matrix)
      ? candidate
      : best
  );
}

/**
 * Open-route TSP approximation with a fixed first point.
 * `fast` uses one nearest-neighbor candidate, while `quality` also evaluates
 * a cheapest-insertion candidate. Both candidates use matrix-backed best 2-opt.
 */
export function optimizeRoute(
  points: RoutePoint[],
  options: OptimizeOptions = {}
): RouteSummary {
  const strategy = options.strategy ?? "quality";
  const matrix = createDistanceMatrix(points);
  const candidates = [nearestNeighborIndices(points.length, matrix)];
  if (strategy === "quality") {
    candidates.push(cheapestInsertionIndices(points.length, matrix));
  }
  const orderedIndices = selectBestRoute(
    candidates.map(candidate => improveWithTwoOpt(candidate, matrix)),
    matrix
  );
  const totalDistanceKm = routeDistanceByIndex(orderedIndices, matrix);

  return {
    orderedIds: orderedIndices.map(index => points[index].id),
    totalDistanceKm,
    estimatedMinutes: Math.ceil(
      (totalDistanceKm / AVERAGE_CITY_SPEED_KMH) * 60
    ),
    optimizationStrategy: strategy,
  };
}
