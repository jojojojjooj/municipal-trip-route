import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { createTripDraftEnvelope } from "../shared/tripDraft";

const dbMocks = vi.hoisted(() => ({
  createTrip: vi.fn(),
  listTripsForUser: vi.fn(),
  getTripForUser: vi.fn(),
  getSharedTrip: vi.fn(),
  deleteTripForOwner: vi.fn(),
  getTripDraftForOwner: vi.fn(),
  upsertTripDraftForOwner: vi.fn(),
  clearTripDraftForOwner: vi.fn(),
  updateTripStopExecutionForUser: vi.fn(),
  updateTripChecklistForUser: vi.fn(),
  updateTripReportDraftForUser: vi.fn(),
  updateTripDepartmentForOwner: vi.fn(),
  listTripCollaboratorsForOwner: vi.fn(),
  inviteTripCollaboratorForOwner: vi.fn(),
  removeTripCollaboratorForOwner: vi.fn(),
  getTripAnalyticsForUser: vi.fn(),
  updateTripTemplateForOwner: vi.fn(),
  createTripsFromTemplateForOwner: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "field-manager",
      name: "담당자",
      email: "manager@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const input = {
  title: "읍면동 현장 점검",
  tripDate: "2026-08-21",
  managerName: "담당자",
  fixedStart: { name: "정읍시청", address: "전북특별자치도 정읍시", latitude: 35.57, longitude: 126.86 },
  returnToStart: true,
  routeDistanceKm: 12.4,
  routeDurationMinutes: 31,
  checklist: { preDeparture: true, onSite: false, wrapUp: false },
  stops: [{ name: "시청", address: "전북특별자치도 정읍시", latitude: 35.57, longitude: 126.86, sequence: 1, note: "현장 담당자에게 사전 연락", photos: [{ storageKey: "trip-photos/7/site.jpg", url: "/manus-storage/trip-photos/7/site.jpg", fileName: "현장.jpg", takenAt: "2026-08-21", description: "민원실 출입 동선과 현장 안내 표지판을 확인한 사진" }] }],
};

describe("trip router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("KAKAO_REST_API_KEY", "test-kakao-rest-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates a user-owned trip with a generated share token", async () => {
    dbMocks.createTrip.mockResolvedValue({ id: 11, ...input, shareToken: "share-token", stops: input.stops });
    const result = await appRouter.createCaller(context()).trip.create(input);

    expect(result.id).toBe(11);
    expect(dbMocks.createTrip).toHaveBeenCalledWith(7, expect.objectContaining({
      title: input.title,
      shareToken: expect.any(String),
      fixedStart: input.fixedStart,
      returnToStart: true,
      stops: input.stops,
    }));
  });

  it("marks a saved trip as a repeatable template through the owner-only procedure", async () => {
    dbMocks.updateTripTemplateForOwner.mockResolvedValue(true);

    await expect(appRouter.createCaller(context()).trip.template.toggle({ tripId: 11, isTemplate: true })).resolves.toEqual({ success: true, isTemplate: true });
    expect(dbMocks.updateTripTemplateForOwner).toHaveBeenCalledWith(7, 11, true);
  });

  it("validates batch dates before creating trips from a template", async () => {
    dbMocks.createTripsFromTemplateForOwner.mockResolvedValue({ status: "created", trips: [{ id: 21, title: "정기 점검 · 2026-09-01", tripDate: "2026-09-01" }] });
    const caller = appRouter.createCaller(context());

    await expect(caller.trip.template.createBatch({ templateId: 11, dates: ["2026-09-12", "2026-09-01"], titlePrefix: "정기 점검", managerName: "담당자" })).resolves.toMatchObject({ status: "created" });
    expect(dbMocks.createTripsFromTemplateForOwner).toHaveBeenCalledWith(7, 11, expect.objectContaining({ dates: ["2026-09-01", "2026-09-12"], titlePrefix: "정기 점검", managerName: "담당자" }));
    await expect(caller.trip.template.createBatch({ templateId: 11, dates: ["2026-02-30"], titlePrefix: "정기 점검", managerName: "담당자" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.trip.template.createBatch({ templateId: 11, dates: ["2026-09-01", "2026-09-01"], titlePrefix: "정기 점검", managerName: "담당자" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lists, deletes, and reads shared trip data through ownership-aware helpers", async () => {
    dbMocks.listTripsForUser.mockResolvedValue([{ id: 11, title: input.title, access: "owner" }]);
    dbMocks.deleteTripForOwner.mockResolvedValue(true);
    dbMocks.getSharedTrip.mockResolvedValue({ id: 11, ...input, shareToken: "share-token", stops: input.stops });
    const caller = appRouter.createCaller(context());

    await expect(caller.trip.list()).resolves.toHaveLength(1);
    await expect(caller.trip.remove({ id: 11 })).resolves.toEqual({ success: true });
    await expect(caller.trip.shared({ token: "share-token" })).resolves.toMatchObject({ id: 11, title: input.title });
    expect(dbMocks.listTripsForUser).toHaveBeenCalledWith(7);
    expect(dbMocks.deleteTripForOwner).toHaveBeenCalledWith(7, 11);
  });

  it("stores, reads, and clears only the authenticated user's temporary draft", async () => {
    const payload = JSON.stringify(createTripDraftEnvelope({
      title: "임시 점검 계획",
      tripDate: "2026-08-22",
      managerName: "담당자",
      department: "안전총괄과",
      fixedStart: null,
      returnToStart: false,
      checklist: { preDeparture: false, onSite: false, wrapUp: false },
      destinations: [],
      fieldRecordFilter: { takenAt: "", destinationId: "", descriptionQuery: "" },
      selectedFieldRecordKeys: [],
      activeWorkspace: "planner",
      workMode: "map",
    }, 1_760_000_000_000));
    dbMocks.upsertTripDraftForOwner.mockResolvedValue({ ownerId: 7, payload, updatedAt: new Date() });
    dbMocks.getTripDraftForOwner.mockResolvedValue({ ownerId: 7, payload, updatedAt: new Date() });
    dbMocks.clearTripDraftForOwner.mockResolvedValue(true);
    const caller = appRouter.createCaller(context());

    await expect(caller.trip.draft.save({ payload })).resolves.toMatchObject({ ownerId: 7, payload });
    await expect(caller.trip.draft.get()).resolves.toMatchObject({ ownerId: 7, payload });
    await expect(caller.trip.draft.clear()).resolves.toEqual({ success: true });
    expect(dbMocks.upsertTripDraftForOwner).toHaveBeenCalledWith(7, payload);
    expect(dbMocks.getTripDraftForOwner).toHaveBeenCalledWith(7);
    expect(dbMocks.clearTripDraftForOwner).toHaveBeenCalledWith(7);
  });

  it("updates execution status and checklist through authenticated editor-capable helpers", async () => {
    dbMocks.updateTripStopExecutionForUser.mockResolvedValue(true);
    dbMocks.updateTripChecklistForUser.mockResolvedValue(true);
    const caller = appRouter.createCaller(context());

    await expect(caller.trip.updateStopExecution({ stopId: 91, executionStatus: "completed", completedAt: "2026-08-22T01:10:00.000Z", issueNote: "배수로 확인", issueOwner: "현장반", issueDueAt: "2026-08-23", issueResolvedAt: "2026-08-22T01:10:00.000Z" })).resolves.toEqual({ success: true });
    await expect(caller.trip.updateChecklist({ tripId: 11, checklist: input.checklist })).resolves.toEqual({ success: true });

    expect(dbMocks.updateTripStopExecutionForUser).toHaveBeenCalledWith(7, 91, { executionStatus: "completed", completedAt: "2026-08-22T01:10:00.000Z", issueNote: "배수로 확인", issueOwner: "현장반", issueDueAt: "2026-08-23", issueResolvedAt: "2026-08-22T01:10:00.000Z" });
    expect(dbMocks.updateTripChecklistForUser).toHaveBeenCalledWith(7, 11, input.checklist);
  });

  it("rejects an execution update when the server denies editor permission", async () => {
    dbMocks.updateTripStopExecutionForUser.mockResolvedValue(false);

    await expect(appRouter.createCaller(context()).trip.updateStopExecution({ stopId: 91, executionStatus: "issue", completedAt: null, issueNote: "확인 필요", issueOwner: "시설팀", issueDueAt: "2026-08-23", issueResolvedAt: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stores an editable result report draft through the editor-capable helper", async () => {
    dbMocks.updateTripReportDraftForUser.mockResolvedValue(true);
    const draft = { overview: "출장 개요", outcome: "수행 결과", issueActions: "이슈 조치", followUp: "후속 계획", generatedAt: "2026-08-22T01:10:00.000Z", evidenceOrder: ["photo-3", "photo-1"], excludedEvidenceKeys: ["photo-2"] };

    await expect(appRouter.createCaller(context()).trip.updateReportDraft({ tripId: 11, draft })).resolves.toEqual({ success: true });
    expect(dbMocks.updateTripReportDraftForUser).toHaveBeenCalledWith(7, 11, JSON.stringify(draft));
  });

  it("lets only the owner-facing helper manage collaborators and department", async () => {
    dbMocks.updateTripDepartmentForOwner.mockResolvedValue(true);
    dbMocks.inviteTripCollaboratorForOwner.mockResolvedValue({ status: "invited" });
    dbMocks.listTripCollaboratorsForOwner.mockResolvedValue([{ id: 8, userId: 9, name: "협업자", email: "collab@example.com", permission: "viewer", createdAt: new Date() }]);
    dbMocks.removeTripCollaboratorForOwner.mockResolvedValue(true);
    const caller = appRouter.createCaller(context());

    await expect(caller.trip.updateDepartment({ tripId: 11, department: "안전총괄과" })).resolves.toEqual({ success: true });
    await expect(caller.trip.collaborators.invite({ tripId: 11, email: "collab@example.com", permission: "editor" })).resolves.toEqual({ success: true });
    await expect(caller.trip.collaborators.list({ tripId: 11 })).resolves.toHaveLength(1);
    await expect(caller.trip.collaborators.remove({ tripId: 11, collaboratorId: 8 })).resolves.toEqual({ success: true });
    expect(dbMocks.updateTripDepartmentForOwner).toHaveBeenCalledWith(7, 11, "안전총괄과");
    expect(dbMocks.inviteTripCollaboratorForOwner).toHaveBeenCalledWith(7, 11, "collab@example.com", "editor");
  });

  it("returns the authenticated user's actual six-month analytics scope", async () => {
    dbMocks.getTripAnalyticsForUser.mockResolvedValue({ totalTrips: 2, totalStops: 5, completedStops: 3, completionRate: 60, openIssues: 1, resolvedIssues: 1, monthly: [] });

    await expect(appRouter.createCaller(context()).trip.analytics()).resolves.toMatchObject({ completionRate: 60, openIssues: 1 });
    expect(dbMocks.getTripAnalyticsForUser).toHaveBeenCalledWith(7);
  });

  it("uses address search before keyword fallback and reverse-geocodes map clicks", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ documents: [{ place_name: "정읍시청", address_name: "전북특별자치도 정읍시", x: "126.86", y: "35.57" }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ documents: [{ address: { address_name: "전북특별자치도 정읍시" }, x: "126.86", y: "35.57" }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const caller = appRouter.createCaller(context());

    await expect(caller.trip.searchAddress({ query: "정읍시청" })).resolves.toMatchObject([{ name: "정읍시청" }]);
    await expect(caller.trip.reverseGeocode({ latitude: 35.57, longitude: 126.86 })).resolves.toEqual({ address: "전북특별자치도 정읍시" });
    expect(fetchMock.mock.calls[0][0]).toContain("/v2/local/search/address.json");
    expect(fetchMock.mock.calls[1][0]).toContain("/v2/local/geo/coord2address.json");
    vi.unstubAllGlobals();
  });

  it("falls back to formatted coordinates when reverse geocoding has no address", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ documents: [] }),
    }));

    const result = await appRouter.createCaller(context()).trip.reverseGeocode({ latitude: 37.5665, longitude: 126.978 });

    expect(result).toEqual({ address: "37.56650, 126.97800" });
    vi.unstubAllGlobals();
  });
});
