export const TRIP_DRAFT_STORAGE_KEY = "municipal-trip-route-draft-v1";
export const TRIP_DRAFT_AUTOSAVE_INTERVAL_MS = 20_000;

export type TripDraftPhoto = {
  storageKey: string;
  url: string;
  fileName: string;
  takenAt?: string;
  description?: string;
};

export type TripDraftDestination = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  note?: string;
  photos?: TripDraftPhoto[];
  executionStatus?: "planned" | "in_progress" | "completed" | "issue";
  completedAt?: string;
  issueNote?: string;
  issueOwner?: string;
  issueDueAt?: string;
  issueResolvedAt?: string;
};

export type TripDraftFixedStart = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type TripDraftPayload = {
  title: string;
  tripDate: string;
  managerName: string;
  department: string;
  fixedStart: TripDraftFixedStart | null;
  returnToStart: boolean;
  checklist: { preDeparture: boolean; onSite: boolean; wrapUp: boolean };
  destinations: TripDraftDestination[];
  fieldRecordFilter: { takenAt: string; destinationId: string; descriptionQuery: string };
  selectedFieldRecordKeys: string[];
  activeWorkspace: "planner" | "records" | "operations" | "report";
  workMode: "map" | "list";
};

export type TripDraftEnvelope = {
  version: 1;
  updatedAt: number;
  payload: TripDraftPayload;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPhoto(value: unknown): TripDraftPhoto | null {
  if (!isRecord(value)) return null;
  const storageKey = readString(value.storageKey);
  const url = readString(value.url);
  const fileName = readString(value.fileName);
  if (!storageKey || !url || !fileName) return null;
  return {
    storageKey,
    url,
    fileName,
    ...(readString(value.takenAt) ? { takenAt: readString(value.takenAt) } : {}),
    ...(readString(value.description) ? { description: readString(value.description) } : {}),
  };
}

function readDestination(value: unknown): TripDraftDestination | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const name = readString(value.name);
  const address = readString(value.address);
  const latitude = readNumber(value.latitude);
  const longitude = readNumber(value.longitude);
  if (!id || !name || !address || latitude === null || longitude === null) return null;
  const photos = Array.isArray(value.photos) ? value.photos.map(readPhoto).filter((photo): photo is TripDraftPhoto => Boolean(photo)).slice(0, 3) : [];
  const executionStatus = ["planned", "in_progress", "completed", "issue"].includes(readString(value.executionStatus)) ? readString(value.executionStatus) as TripDraftDestination["executionStatus"] : "planned";
  return {
    id,
    name,
    address,
    latitude,
    longitude,
    note: readString(value.note),
    photos,
    executionStatus,
    ...(readString(value.completedAt) ? { completedAt: readString(value.completedAt) } : {}),
    ...(readString(value.issueNote) ? { issueNote: readString(value.issueNote) } : {}),
    ...(readString(value.issueOwner) ? { issueOwner: readString(value.issueOwner) } : {}),
    ...(readString(value.issueDueAt) ? { issueDueAt: readString(value.issueDueAt) } : {}),
    ...(readString(value.issueResolvedAt) ? { issueResolvedAt: readString(value.issueResolvedAt) } : {}),
  };
}

function readFixedStart(value: unknown): TripDraftFixedStart | null {
  const destination = readDestination(value);
  return destination ? { id: destination.id, name: destination.name, address: destination.address, latitude: destination.latitude, longitude: destination.longitude } : null;
}

export function createTripDraftEnvelope(payload: TripDraftPayload, updatedAt = Date.now()): TripDraftEnvelope {
  return { version: 1, updatedAt, payload };
}

export function parseTripDraft(value: string | null | undefined): TripDraftEnvelope | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.payload)) return null;
    const updatedAt = readNumber(parsed.updatedAt);
    if (updatedAt === null) return null;
    const payload = parsed.payload;
    const destinations = Array.isArray(payload.destinations) ? payload.destinations.map(readDestination).filter((destination): destination is TripDraftDestination => Boolean(destination)).slice(0, 30) : [];
    return {
      version: 1,
      updatedAt,
      payload: {
        title: readString(payload.title),
        tripDate: readString(payload.tripDate),
        managerName: readString(payload.managerName),
        department: readString(payload.department),
        fixedStart: readFixedStart(payload.fixedStart),
        returnToStart: Boolean(payload.returnToStart),
        checklist: isRecord(payload.checklist) ? { preDeparture: Boolean(payload.checklist.preDeparture), onSite: Boolean(payload.checklist.onSite), wrapUp: Boolean(payload.checklist.wrapUp) } : { preDeparture: false, onSite: false, wrapUp: false },
        destinations,
        fieldRecordFilter: isRecord(payload.fieldRecordFilter) ? {
          takenAt: readString(payload.fieldRecordFilter.takenAt),
          destinationId: readString(payload.fieldRecordFilter.destinationId),
          descriptionQuery: readString(payload.fieldRecordFilter.descriptionQuery),
        } : { takenAt: "", destinationId: "", descriptionQuery: "" },
        selectedFieldRecordKeys: Array.isArray(payload.selectedFieldRecordKeys) ? payload.selectedFieldRecordKeys.filter((key): key is string => typeof key === "string").slice(0, 90) : [],
        activeWorkspace: payload.activeWorkspace === "records" || payload.activeWorkspace === "operations" || payload.activeWorkspace === "report" ? payload.activeWorkspace : "planner",
        workMode: payload.workMode === "list" ? "list" : "map",
      },
    };
  } catch {
    return null;
  }
}

export function hasTripDraftContent(payload: TripDraftPayload) {
  return Boolean(
    payload.title.trim()
    || payload.managerName.trim()
    || payload.fixedStart
    || payload.destinations.length
    || payload.fieldRecordFilter.takenAt
    || payload.fieldRecordFilter.destinationId
    || payload.fieldRecordFilter.descriptionQuery.trim()
    || payload.selectedFieldRecordKeys.length,
  );
}

export function pickLatestTripDraft(...drafts: Array<TripDraftEnvelope | null | undefined>) {
  return drafts.filter((draft): draft is TripDraftEnvelope => Boolean(draft)).sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
}

export function tripDraftFingerprint(payload: TripDraftPayload) {
  return JSON.stringify(payload);
}
