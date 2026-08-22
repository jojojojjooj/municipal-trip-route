export type TripReportEvidencePhoto = {
  storageKey: string;
  url: string;
  fileName: string;
  takenAt?: string;
  description?: string;
  dataUrl?: string;
};

export type TripReportEvidenceStop = {
  id: string;
  name: string;
  address: string;
  sequence?: number;
  executionStatus?: "planned" | "in_progress" | "completed" | "issue";
  photos?: TripReportEvidencePhoto[];
};

export type TripReportEvidence = TripReportEvidencePhoto & {
  destinationId: string;
  destinationName: string;
  destinationAddress: string;
  sequence: number;
};

function scorePhoto(stop: TripReportEvidenceStop, photo: TripReportEvidencePhoto) {
  return (photo.description?.trim() ? 4 : 0) + (photo.takenAt ? 2 : 0) + (stop.executionStatus === "issue" ? 2 : 0) + (stop.executionStatus === "completed" ? 1 : 0);
}

export function selectTripReportEvidence(stops: TripReportEvidenceStop[], limit = 6): TripReportEvidence[] {
  if (limit <= 0) return [];
  const rankedStops = stops.map((stop, index) => ({ stop, index, photos: [...(stop.photos ?? [])].sort((left, right) => scorePhoto(stop, right) - scorePhoto(stop, left) || (right.takenAt ?? "").localeCompare(left.takenAt ?? "")) })).filter(item => item.photos.length);
  const selected: TripReportEvidence[] = [];
  const push = (stop: TripReportEvidenceStop, index: number, photo: TripReportEvidencePhoto) => selected.push({ ...photo, destinationId: stop.id, destinationName: stop.name, destinationAddress: stop.address, sequence: stop.sequence ?? index + 1 });

  for (const item of rankedStops) {
    if (selected.length >= limit) break;
    push(item.stop, item.index, item.photos[0]);
  }
  for (const item of rankedStops) {
    for (const photo of item.photos.slice(1)) {
      if (selected.length >= limit) break;
      push(item.stop, item.index, photo);
    }
    if (selected.length >= limit) break;
  }
  return selected;
}

export function orderTripReportEvidence(evidence: TripReportEvidence[], preferredOrder: string[] | undefined): TripReportEvidence[] {
  if (!preferredOrder?.length) return evidence;
  const rank = new Map(preferredOrder.map((storageKey, index) => [storageKey, index]));
  return [...evidence].sort((left, right) => {
    const leftRank = rank.get(left.storageKey);
    const rightRank = rank.get(right.storageKey);
    if (leftRank === undefined && rightRank === undefined) return 0;
    if (leftRank === undefined) return 1;
    if (rightRank === undefined) return -1;
    return leftRank - rightRank;
  });
}

export function moveTripReportEvidenceOrder(evidence: TripReportEvidence[], storageKey: string, direction: "up" | "down"): string[] | null {
  const keys = evidence.map(photo => photo.storageKey);
  const currentIndex = keys.indexOf(storageKey);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= keys.length) return null;
  [keys[currentIndex], keys[targetIndex]] = [keys[targetIndex], keys[currentIndex]];
  return keys;
}

export function filterTripReportEvidence(evidence: TripReportEvidence[], excludedKeys: string[] | undefined): TripReportEvidence[] {
  if (!excludedKeys?.length) return evidence;
  const excluded = new Set(excludedKeys);
  return evidence.filter(photo => !excluded.has(photo.storageKey));
}
