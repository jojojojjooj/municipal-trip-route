import { describe, expect, it } from "vitest";
import {
  createTripDraftEnvelope,
  hasTripDraftContent,
  parseTripDraft,
  pickLatestTripDraft,
  tripDraftFingerprint,
  type TripDraftPayload,
} from "../shared/tripDraft";

const payload: TripDraftPayload = {
  title: "도로 시설 점검",
  tripDate: "2026-08-22",
  departureTime: "08:30",
  managerName: "김담당",
  department: "안전총괄과",
  fixedStart: {
    id: "start-1",
    name: "시청",
    address: "서울 중구",
    latitude: 37.56,
    longitude: 126.97,
  },
  returnToStart: true,
  checklist: { preDeparture: true, onSite: false, wrapUp: false },
  destinations: [
    {
      id: "stop-1",
      name: "현장 1",
      address: "서울 중구 1",
      latitude: 37.57,
      longitude: 126.98,
      note: "보행로 확인",
      serviceMinutes: 35,
      windowStart: "09:00",
      windowEnd: "11:00",
      executionStatus: "in_progress",
      photos: [
        {
          storageKey: "photos/1.jpg",
          url: "/manus-storage/photos/1.jpg",
          fileName: "현장.jpg",
          takenAt: "2026-08-22",
          description: "안내 표지판",
        },
      ],
    },
  ],
  fieldRecordFilter: {
    takenAt: "2026-08-22",
    destinationId: "stop-1",
    descriptionQuery: "표지판",
  },
  selectedFieldRecordKeys: ["photos/1.jpg"],
  activeWorkspace: "records",
  workMode: "list",
};

describe("trip draft", () => {
  it("round-trips a safe planner draft while excluding unsupported payload fields", () => {
    const serialized = JSON.stringify(createTripDraftEnvelope(payload, 100));
    expect(parseTripDraft(serialized)).toEqual(
      createTripDraftEnvelope(payload, 100)
    );
    expect(tripDraftFingerprint(payload)).toContain("도로 시설 점검");
  });

  it("selects the newest valid draft and distinguishes empty drafts", () => {
    const local = createTripDraftEnvelope(payload, 100);
    const account = createTripDraftEnvelope(
      { ...payload, title: "계정 최신 초안" },
      200
    );
    expect(pickLatestTripDraft(local, account)).toEqual(account);
    expect(hasTripDraftContent(payload)).toBe(true);
    expect(
      hasTripDraftContent({
        ...payload,
        title: "",
        managerName: "",
        fixedStart: null,
        destinations: [],
        fieldRecordFilter: {
          takenAt: "",
          destinationId: "",
          descriptionQuery: "",
        },
        selectedFieldRecordKeys: [],
      })
    ).toBe(false);
  });

  it("rejects malformed draft text", () => {
    expect(parseTripDraft("not-json")).toBeNull();
    expect(parseTripDraft(JSON.stringify({ version: 2 }))).toBeNull();
  });
});
