import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { allowedTripPhotoMimeTypes, makeTripPhotoDataUrl } from "../shared/tripPhoto";
import { parseTripDraft } from "../shared/tripDraft";
import { parseBatchDates } from "../shared/tripBatch";
import { EXECUTION_STATUSES } from "../shared/tripOperations";
import * as db from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const photoInput = z.object({ storageKey: z.string().trim().min(1).max(500), url: z.string().trim().min(1).max(750), fileName: z.string().trim().min(1).max(255), takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), description: z.string().trim().max(500).optional() });
const destinationInput = z.object({ name: z.string().trim().min(1).max(150), address: z.string().trim().min(1).max(255), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), sequence: z.number().int().min(1), note: z.string().trim().max(1000).optional(), photos: z.array(photoInput).max(3).optional(), executionStatus: z.enum(EXECUTION_STATUSES).optional(), completedAt: z.string().datetime().optional(), issueNote: z.string().trim().max(1000).optional(), issueOwner: z.string().trim().max(100).optional(), issueDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), issueResolvedAt: z.string().datetime().optional() });
const fixedStartInput = z.object({ name: z.string().trim().min(1).max(150), address: z.string().trim().min(1).max(255), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
const tripInput = z.object({ title: z.string().trim().min(1).max(150), tripDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), managerName: z.string().trim().min(1).max(100), department: z.string().trim().max(100).optional(), fixedStart: fixedStartInput.nullable(), returnToStart: z.boolean(), routeDistanceKm: z.number().min(0), routeDurationMinutes: z.number().int().min(0), checklist: z.object({ preDeparture: z.boolean(), onSite: z.boolean(), wrapUp: z.boolean() }).default({ preDeparture: false, onSite: false, wrapUp: false }), stops: z.array(destinationInput).min(1).max(30) });

type KakaoDocument = { address_name?: string; place_name?: string; road_address?: { address_name?: string } | null; address?: { address_name?: string } | null; x: string; y: string };

function getKakaoRestKey() {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "카카오 로컬 API 설정이 아직 준비되지 않았습니다." });
  return apiKey;
}

async function callKakaoLocal(path: string) {
  const response = await fetch(`https://dapi.kakao.com${path}`, { headers: { Authorization: `KakaoAK ${getKakaoRestKey()}` } });
  if (response.status === 403) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "카카오 주소 검색 인증이 거부되었습니다. 프로젝트 런타임 키 설정을 확인해 주세요." });
  if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "카카오 주소 검색 서비스에 연결하지 못했습니다." });
  return response.json() as Promise<{ documents: KakaoDocument[] }>;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  trip: router({
    draft: router({
      get: protectedProcedure.query(async ({ ctx }) => (await db.getTripDraftForOwner(ctx.user.id)) ?? null),
      save: protectedProcedure.input(z.object({ payload: z.string().min(1).max(250_000) })).mutation(async ({ ctx, input }) => {
        if (!parseTripDraft(input.payload)) throw new TRPCError({ code: "BAD_REQUEST", message: "임시 초안 형식이 올바르지 않습니다." });
        const draft = await db.upsertTripDraftForOwner(ctx.user.id, input.payload);
        if (!draft) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "임시 초안을 저장하지 못했습니다." });
        return draft;
      }),
      clear: protectedProcedure.mutation(async ({ ctx }) => ({ success: await db.clearTripDraftForOwner(ctx.user.id) })),
    }),
    template: router({
      toggle: protectedProcedure.input(z.object({ tripId: z.number().int().positive(), isTemplate: z.boolean() })).mutation(async ({ ctx, input }) => {
        const updated = await db.updateTripTemplateForOwner(ctx.user.id, input.tripId, input.isTemplate);
        if (!updated) throw new TRPCError({ code: "FORBIDDEN", message: "반복 출장 템플릿은 계획 소유자만 관리할 수 있습니다." });
        return { success: true, isTemplate: input.isTemplate } as const;
      }),
      createBatch: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), dates: z.array(z.string()).min(1).max(31), titlePrefix: z.string().trim().max(120).default(""), managerName: z.string().trim().max(100).default(""), department: z.string().trim().max(100).optional() })).mutation(async ({ ctx, input }) => {
        const parsedDates = parseBatchDates(input.dates);
        if (parsedDates.invalid.length) throw new TRPCError({ code: "BAD_REQUEST", message: `유효하지 않은 날짜가 있습니다: ${parsedDates.invalid.join(", ")}` });
        if (parsedDates.duplicates.length) throw new TRPCError({ code: "BAD_REQUEST", message: `중복된 날짜가 있습니다: ${parsedDates.duplicates.join(", ")}` });
        if (!parsedDates.dates.length) throw new TRPCError({ code: "BAD_REQUEST", message: "생성할 출장 날짜를 선택해 주세요." });
        const result = await db.createTripsFromTemplateForOwner(ctx.user.id, input.templateId, { ...input, dates: parsedDates.dates });
        if (result.status === "forbidden") throw new TRPCError({ code: "FORBIDDEN", message: "반복 출장 템플릿을 찾을 수 없거나 사용할 권한이 없습니다." });
        return result;
      }),
    }),
    uploadPhoto: protectedProcedure.input(z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), contentBase64: z.string().min(1).max(7_000_000) })).mutation(async ({ ctx, input }) => {
      const bytes = Buffer.from(input.contentBase64, "base64");
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "사진은 5MB 이하로 첨부해 주세요." });
      const extension = input.mimeType.split("/")[1];
      const safeName = input.fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, "_").slice(0, 100) || `field-photo.${extension}`;
      const stored = await storagePut(`trip-photos/${ctx.user.id}/${Date.now()}-${safeName}`, bytes, input.mimeType);
      return { storageKey: stored.key, url: stored.url, fileName: input.fileName };
    }),
    getPhotoData: protectedProcedure.input(z.object({ storageKey: z.string().trim().min(1).max(500) })).query(async ({ ctx, input }) => {
      const photo = await db.getTripPhotoForUser(ctx.user.id, input.storageKey);
      if (!photo) throw new TRPCError({ code: "NOT_FOUND", message: "현장 사진을 찾을 수 없습니다." });
      const response = await fetch(await storageGetSignedUrl(photo.storageKey));
      if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "현장 사진을 불러오지 못했습니다." });
      const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      if (!allowedTripPhotoMimeTypes.includes(mimeType as (typeof allowedTripPhotoMimeTypes)[number])) throw new TRPCError({ code: "UNSUPPORTED_MEDIA_TYPE", message: "지원하지 않는 사진 형식입니다." });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "PDF용 사진 데이터를 준비할 수 없습니다." });
      return { dataUrl: makeTripPhotoDataUrl(mimeType, bytes.toString("base64")), fileName: photo.fileName };
    }),
    searchAddress: protectedProcedure.input(z.object({ query: z.string().trim().min(2).max(100) })).query(async ({ input }) => {
      const addressResult = await callKakaoLocal(`/v2/local/search/address.json?query=${encodeURIComponent(input.query)}&size=6`);
      const result = addressResult.documents.length ? addressResult : await callKakaoLocal(`/v2/local/search/keyword.json?query=${encodeURIComponent(input.query)}&size=6`);
      return result.documents.map((document, index) => ({ id: `${document.x}-${document.y}-${index}`, name: document.place_name ?? document.address_name ?? "검색 위치", address: document.road_address?.address_name ?? document.address?.address_name ?? document.address_name ?? "", latitude: Number(document.y), longitude: Number(document.x) }));
    }),
    reverseGeocode: protectedProcedure.input(z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })).mutation(async ({ input }) => {
      const result = await callKakaoLocal(`/v2/local/geo/coord2address.json?x=${input.longitude}&y=${input.latitude}`);
      const document = result.documents[0];
      return { address: document?.road_address?.address_name ?? document?.address?.address_name ?? `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}` };
    }),
    create: protectedProcedure.input(tripInput).mutation(async ({ ctx, input }) => {
      const trip = await db.createTrip(ctx.user.id, { ...input, shareToken: nanoid(12) });
      if (!trip) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "출장 계획을 저장하지 못했습니다." });
      return trip;
    }),
    updateStopExecution: protectedProcedure.input(z.object({ stopId: z.number().int().positive(), executionStatus: z.enum(EXECUTION_STATUSES), completedAt: z.string().datetime().nullable(), issueNote: z.string().trim().max(1000).nullable(), issueOwner: z.string().trim().max(100).nullable(), issueDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), issueResolvedAt: z.string().datetime().nullable() })).mutation(async ({ ctx, input }) => {
      const { stopId, ...patch } = input;
      const updated = await db.updateTripStopExecutionForUser(ctx.user.id, stopId, patch);
      if (!updated) throw new TRPCError({ code: "FORBIDDEN", message: "편집 권한이 없는 출장 목적지입니다." });
      return { success: true } as const;
    }),
    updateChecklist: protectedProcedure.input(z.object({ tripId: z.number().int().positive(), checklist: z.object({ preDeparture: z.boolean(), onSite: z.boolean(), wrapUp: z.boolean() }) })).mutation(async ({ ctx, input }) => {
      const updated = await db.updateTripChecklistForUser(ctx.user.id, input.tripId, input.checklist);
      if (!updated) throw new TRPCError({ code: "FORBIDDEN", message: "편집 권한이 없는 출장 계획입니다." });
      return { success: true } as const;
    }),
    updateReportDraft: protectedProcedure.input(z.object({ tripId: z.number().int().positive(), draft: z.object({ overview: z.string().trim().min(1).max(4_000), outcome: z.string().trim().min(1).max(4_000), issueActions: z.string().trim().min(1).max(4_000), followUp: z.string().trim().min(1).max(4_000), generatedAt: z.string().datetime(), evidenceOrder: z.array(z.string().trim().min(1).max(500)).max(6).optional(), excludedEvidenceKeys: z.array(z.string().trim().min(1).max(500)).max(6).optional() }) })).mutation(async ({ ctx, input }) => {
      const updated = await db.updateTripReportDraftForUser(ctx.user.id, input.tripId, JSON.stringify(input.draft));
      if (!updated) throw new TRPCError({ code: "FORBIDDEN", message: "편집 권한이 없는 출장 계획입니다." });
      return { success: true } as const;
    }),
    updateDepartment: protectedProcedure.input(z.object({ tripId: z.number().int().positive(), department: z.string().trim().max(100).nullable() })).mutation(async ({ ctx, input }) => {
      const updated = await db.updateTripDepartmentForOwner(ctx.user.id, input.tripId, input.department);
      if (!updated) throw new TRPCError({ code: "FORBIDDEN", message: "부서는 출장 계획 소유자만 수정할 수 있습니다." });
      return { success: true } as const;
    }),
    collaborators: router({
      list: protectedProcedure.input(z.object({ tripId: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const collaborators = await db.listTripCollaboratorsForOwner(ctx.user.id, input.tripId);
        if (!collaborators) throw new TRPCError({ code: "FORBIDDEN", message: "협업자는 출장 계획 소유자만 조회할 수 있습니다." });
        return collaborators;
      }),
      invite: protectedProcedure.input(z.object({ tripId: z.number().int().positive(), email: z.string().trim().email().max(320), permission: z.enum(["viewer", "editor"]) })).mutation(async ({ ctx, input }) => {
        const result = await db.inviteTripCollaboratorForOwner(ctx.user.id, input.tripId, input.email, input.permission);
        if (result.status === "not_found") throw new TRPCError({ code: "NOT_FOUND", message: "해당 이메일로 가입한 사용자를 찾을 수 없습니다." });
        if (result.status === "owner") throw new TRPCError({ code: "BAD_REQUEST", message: "출장 계획 소유자는 협업자로 추가할 수 없습니다." });
        if (result.status === "forbidden") throw new TRPCError({ code: "FORBIDDEN", message: "협업자는 출장 계획 소유자만 관리할 수 있습니다." });
        return { success: true } as const;
      }),
      remove: protectedProcedure.input(z.object({ tripId: z.number().int().positive(), collaboratorId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const removed = await db.removeTripCollaboratorForOwner(ctx.user.id, input.tripId, input.collaboratorId);
        if (!removed) throw new TRPCError({ code: "FORBIDDEN", message: "협업자는 출장 계획 소유자만 관리할 수 있습니다." });
        return { success: true } as const;
      }),
    }),
    analytics: protectedProcedure.query(({ ctx }) => db.getTripAnalyticsForUser(ctx.user.id)),
    list: protectedProcedure.query(({ ctx }) => db.listTripsForUser(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const trip = await db.getTripForUser(ctx.user.id, input.id);
      if (!trip) throw new TRPCError({ code: "NOT_FOUND", message: "출장 계획을 찾을 수 없습니다." });
      return trip;
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const deleted = await db.deleteTripForOwner(ctx.user.id, input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "삭제할 출장 계획을 찾을 수 없습니다." });
      return { success: true } as const;
    }),
    shared: publicProcedure.input(z.object({ token: z.string().min(6).max(36) })).query(async ({ input }) => {
      const trip = await db.getSharedTrip(input.token);
      if (!trip) throw new TRPCError({ code: "NOT_FOUND", message: "공유된 출장 계획을 찾을 수 없습니다." });
      return trip;
    }),
  }),
});

export type AppRouter = typeof appRouter;
