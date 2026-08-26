import { and, asc, desc, eq, gte, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  type InsertUser,
  tripCollaborators,
  tripAuditLogs,
  tripDrafts,
  tripExpenses,
  tripStopPhotos,
  tripStops,
  trips,
  users,
} from "../drizzle/schema";
import { buildBatchTripTitle } from "../shared/tripBatch";
import type { ExecutionStatus, TripChecklist } from "../shared/tripOperations";
import { ENV } from "./_core/env";

export type TripStopPhotoInput = {
  storageKey: string;
  url: string;
  fileName: string;
  takenAt?: string;
  description?: string;
};
export type TripStopInput = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sequence: number;
  note?: string;
  serviceMinutes?: number;
  windowStart?: string;
  windowEnd?: string;
  photos?: TripStopPhotoInput[];
  executionStatus?: ExecutionStatus;
  completedAt?: string;
  issueNote?: string;
  issueOwner?: string;
  issueDueAt?: string;
  issueResolvedAt?: string;
};
export type FixedStartInput = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};
export type CreateTripInput = {
  title: string;
  tripDate: string;
  managerName: string;
  department?: string;
  shareToken: string;
  fixedStart: FixedStartInput | null;
  returnToStart: boolean;
  routeDistanceKm: number;
  routeDurationMinutes: number;
  departureTime: string;
  checklist: TripChecklist;
  stops: TripStopInput[];
};
export type TripAccessRole = "owner" | "editor" | "viewer";
export type CollaborationPermission = Exclude<TripAccessRole, "owner">;

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role =
    user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db.select().from(users).where(eq(users.openId, openId)).limit(1)
  )[0];
}

async function hydrateTrip(tripId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const trip = (
    await db.select().from(trips).where(eq(trips.id, tripId)).limit(1)
  )[0];
  if (!trip) return undefined;
  const stops = await db
    .select()
    .from(tripStops)
    .where(eq(tripStops.tripId, trip.id))
    .orderBy(asc(tripStops.sequence));
  const photos = stops.length
    ? await db
        .select()
        .from(tripStopPhotos)
        .where(
          inArray(
            tripStopPhotos.tripStopId,
            stops.map(stop => stop.id)
          )
        )
        .orderBy(asc(tripStopPhotos.id))
    : [];
  return {
    ...trip,
    stops: stops.map(stop => ({
      ...stop,
      photos: photos.filter(photo => photo.tripStopId === stop.id),
    })),
  };
}

export async function createTrip(ownerId: number, input: CreateTripInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const tripId = await db.transaction(async tx => {
    const inserted = await tx
      .insert(trips)
      .values({
        ownerId,
        title: input.title,
        tripDate: new Date(`${input.tripDate}T00:00:00.000Z`),
        managerName: input.managerName,
        department: input.department?.trim() || null,
        shareToken: input.shareToken,
        fixedStartName: input.fixedStart?.name ?? null,
        fixedStartAddress: input.fixedStart?.address ?? null,
        fixedStartLatitude: input.fixedStart?.latitude.toFixed(7) ?? null,
        fixedStartLongitude: input.fixedStart?.longitude.toFixed(7) ?? null,
        returnToStart: input.returnToStart,
        routeDistanceKm: input.routeDistanceKm.toFixed(2),
        routeDurationMinutes: input.routeDurationMinutes,
        departureTime: input.departureTime,
        preDepartureChecked: input.checklist.preDeparture,
        onSiteChecked: input.checklist.onSite,
        wrapUpChecked: input.checklist.wrapUp,
      })
      .$returningId();
    const id = inserted[0].id;
    await tx.insert(tripStops).values(
      input.stops.map(stop => ({
        tripId: id,
        name: stop.name,
        address: stop.address,
        latitude: stop.latitude.toFixed(7),
        longitude: stop.longitude.toFixed(7),
        sequence: stop.sequence,
        note: stop.note?.trim() || null,
        serviceMinutes: stop.serviceMinutes ?? 20,
        windowStart: stop.windowStart || null,
        windowEnd: stop.windowEnd || null,
        executionStatus: stop.executionStatus ?? "planned",
        completedAt: stop.completedAt ? new Date(stop.completedAt) : null,
        issueNote: stop.issueNote?.trim() || null,
        issueOwner: stop.issueOwner?.trim() || null,
        issueDueAt: stop.issueDueAt
          ? new Date(`${stop.issueDueAt}T00:00:00.000Z`)
          : null,
        issueResolvedAt: stop.issueResolvedAt
          ? new Date(stop.issueResolvedAt)
          : null,
      }))
    );
    const persistedStops = await tx
      .select({ id: tripStops.id, sequence: tripStops.sequence })
      .from(tripStops)
      .where(eq(tripStops.tripId, id));
    const stopIdBySequence = new Map(
      persistedStops.map(stop => [stop.sequence, stop.id])
    );
    const photoValues = input.stops.flatMap(stop => {
      const tripStopId = stopIdBySequence.get(stop.sequence);
      if (tripStopId === undefined)
        throw new Error("출장 목적지 사진을 연결할 수 없습니다.");
      return (stop.photos ?? []).map(photo => ({
        tripStopId,
        storageKey: photo.storageKey,
        url: photo.url,
        fileName: photo.fileName,
        takenAt: photo.takenAt
          ? new Date(`${photo.takenAt}T00:00:00.000Z`)
          : null,
        description: photo.description?.trim() || null,
      }));
    });
    if (photoValues.length) await tx.insert(tripStopPhotos).values(photoValues);
    return id;
  });
  return hydrateTrip(tripId);
}

export async function listTripsForOwner(ownerId: number) {
  const db = await getDb();
  return db
    ? db
        .select()
        .from(trips)
        .where(eq(trips.ownerId, ownerId))
        .orderBy(desc(trips.createdAt))
    : [];
}

export async function getTripAccessForUser(
  userId: number,
  tripId: number
): Promise<TripAccessRole | null> {
  const db = await getDb();
  if (!db) return null;
  const trip = (
    await db
      .select({
        ownerId: trips.ownerId,
        permission: tripCollaborators.permission,
      })
      .from(trips)
      .leftJoin(
        tripCollaborators,
        and(
          eq(tripCollaborators.tripId, trips.id),
          eq(tripCollaborators.userId, userId)
        )
      )
      .where(eq(trips.id, tripId))
      .limit(1)
  )[0];
  if (!trip) return null;
  if (trip.ownerId === userId) return "owner";
  return trip.permission ?? null;
}

export async function listTripsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ trip: trips, permission: tripCollaborators.permission })
    .from(trips)
    .leftJoin(
      tripCollaborators,
      and(
        eq(tripCollaborators.tripId, trips.id),
        eq(tripCollaborators.userId, userId)
      )
    )
    .where(or(eq(trips.ownerId, userId), eq(tripCollaborators.userId, userId)))
    .orderBy(desc(trips.createdAt));
  return rows.map(row => ({
    ...row.trip,
    access:
      row.trip.ownerId === userId
        ? ("owner" as const)
        : (row.permission as CollaborationPermission),
  }));
}

export async function getTripAnalyticsForUser(
  userId: number,
  now = new Date()
) {
  const db = await getDb();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: `${date.getMonth() + 1}월`,
      trips: 0,
      completed: 0,
      issues: 0,
      distanceKm: 0,
      durationMinutes: 0,
    };
  });
  if (!db)
    return {
      periodStart: start,
      periodEnd: now,
      totalTrips: 0,
      totalStops: 0,
      completedStops: 0,
      completionRate: 0,
      openIssues: 0,
      resolvedIssues: 0,
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      monthly: months,
      departments: [],
    };
  const rows = await db
    .select({
      tripId: trips.id,
      tripDate: trips.tripDate,
      department: trips.department,
      routeDistanceKm: trips.routeDistanceKm,
      routeDurationMinutes: trips.routeDurationMinutes,
      status: tripStops.executionStatus,
      issueResolvedAt: tripStops.issueResolvedAt,
    })
    .from(trips)
    .leftJoin(
      tripCollaborators,
      and(
        eq(tripCollaborators.tripId, trips.id),
        eq(tripCollaborators.userId, userId)
      )
    )
    .innerJoin(tripStops, eq(tripStops.tripId, trips.id))
    .where(
      and(
        gte(trips.tripDate, start),
        or(eq(trips.ownerId, userId), eq(tripCollaborators.userId, userId))
      )
    );
  const tripIds = new Set<number>();
  let totalStops = 0;
  let completedStops = 0;
  let openIssues = 0;
  let resolvedIssues = 0;
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  const monthMap = new Map(months.map(month => [month.key, month]));
  const departmentMap = new Map<
    string,
    { department: string; totalStops: number; completedStops: number }
  >();
  for (const row of rows) {
    const tripDate = new Date(row.tripDate);
    const month = monthMap.get(
      `${tripDate.getFullYear()}-${String(tripDate.getMonth() + 1).padStart(2, "0")}`
    );
    if (!tripIds.has(row.tripId)) {
      tripIds.add(row.tripId);
      const distanceKm = Number(row.routeDistanceKm ?? 0);
      const durationMinutes = row.routeDurationMinutes ?? 0;
      totalDistanceKm += distanceKm;
      totalDurationMinutes += durationMinutes;
      if (month) {
        month.trips += 1;
        month.distanceKm += distanceKm;
        month.durationMinutes += durationMinutes;
      }
    }
    totalStops += 1;
    const department = row.department?.trim() || "미분류";
    const departmentSummary = departmentMap.get(department) ?? {
      department,
      totalStops: 0,
      completedStops: 0,
    };
    departmentSummary.totalStops += 1;
    departmentMap.set(department, departmentSummary);
    if (row.status === "completed") {
      completedStops += 1;
      if (month) month.completed += 1;
    }
    if (row.status === "completed") departmentSummary.completedStops += 1;
    if (row.status === "issue") {
      if (month) month.issues += 1;
      if (row.issueResolvedAt) resolvedIssues += 1;
      else openIssues += 1;
    }
  }
  const departments = Array.from(departmentMap.values())
    .map(summary => ({
      ...summary,
      completionRate: summary.totalStops
        ? Math.round((summary.completedStops / summary.totalStops) * 100)
        : 0,
    }))
    .sort(
      (left, right) =>
        right.totalStops - left.totalStops ||
        left.department.localeCompare(right.department, "ko-KR")
    );
  return {
    periodStart: start,
    periodEnd: now,
    totalTrips: tripIds.size,
    totalStops,
    completedStops,
    completionRate: totalStops
      ? Math.round((completedStops / totalStops) * 100)
      : 0,
    openIssues,
    resolvedIssues,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalDurationMinutes,
    monthly: months,
    departments,
  };
}

export async function getTripForOwner(ownerId: number, tripId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const trip = (
    await db
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.ownerId, ownerId)))
      .limit(1)
  )[0];
  return trip ? hydrateTrip(trip.id) : undefined;
}

export async function updateTripTemplateForOwner(
  ownerId: number,
  tripId: number,
  isTemplate: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .update(trips)
    .set({ isTemplate })
    .where(and(eq(trips.id, tripId), eq(trips.ownerId, ownerId)));
  return result[0].affectedRows > 0;
}

export async function createTripsFromTemplateForOwner(
  ownerId: number,
  templateId: number,
  input: {
    dates: string[];
    titlePrefix: string;
    managerName: string;
    department?: string;
  }
) {
  const source = await getTripForOwner(ownerId, templateId);
  if (!source || !source.isTemplate)
    return { status: "forbidden" as const, trips: [] };
  const fixedStart =
    source.fixedStartName &&
    source.fixedStartAddress &&
    source.fixedStartLatitude !== null &&
    source.fixedStartLongitude !== null
      ? {
          name: source.fixedStartName,
          address: source.fixedStartAddress,
          latitude: Number(source.fixedStartLatitude),
          longitude: Number(source.fixedStartLongitude),
        }
      : null;
  const generated = [];
  for (const tripDate of input.dates) {
    const trip = await createTrip(ownerId, {
      title: buildBatchTripTitle(input.titlePrefix, tripDate),
      tripDate,
      managerName: input.managerName.trim() || source.managerName,
      department: input.department?.trim() || source.department || undefined,
      shareToken: nanoid(12),
      fixedStart,
      returnToStart: Boolean(source.returnToStart),
      routeDistanceKm: Number(source.routeDistanceKm),
      routeDurationMinutes: Number(source.routeDurationMinutes),
      departureTime: source.departureTime,
      checklist: { preDeparture: false, onSite: false, wrapUp: false },
      stops: source.stops.map((stop, index) => ({
        name: stop.name,
        address: stop.address,
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        sequence: index + 1,
        note: stop.note ?? undefined,
        serviceMinutes: stop.serviceMinutes,
        windowStart: stop.windowStart ?? undefined,
        windowEnd: stop.windowEnd ?? undefined,
        executionStatus: "planned",
      })),
    });
    if (trip) generated.push({ id: trip.id, title: trip.title, tripDate });
  }
  return { status: "created" as const, trips: generated };
}

export async function getTripForUser(userId: number, tripId: number) {
  const access = await getTripAccessForUser(userId, tripId);
  if (!access) return undefined;
  const trip = await hydrateTrip(tripId);
  return trip ? { ...trip, access } : undefined;
}

export async function listTripAuditLogsForUser(userId: number, tripId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const access = await getTripAccessForUser(userId, tripId);
  if (!access) return undefined;
  return db
    .select({
      id: tripAuditLogs.id,
      action: tripAuditLogs.action,
      entityType: tripAuditLogs.entityType,
      entityId: tripAuditLogs.entityId,
      beforeSnapshot: tripAuditLogs.beforeSnapshot,
      afterSnapshot: tripAuditLogs.afterSnapshot,
      createdAt: tripAuditLogs.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(tripAuditLogs)
    .innerJoin(users, eq(tripAuditLogs.actorUserId, users.id))
    .where(eq(tripAuditLogs.tripId, tripId))
    .orderBy(desc(tripAuditLogs.createdAt), desc(tripAuditLogs.id))
    .limit(100);
}

export async function listTripExpensesForUser(userId: number, tripId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (!(await getTripAccessForUser(userId, tripId))) return undefined;
  return db
    .select()
    .from(tripExpenses)
    .where(eq(tripExpenses.tripId, tripId))
    .orderBy(desc(tripExpenses.createdAt), desc(tripExpenses.id));
}

export async function addTripExpenseForUser(
  userId: number,
  input: {
    tripId: number;
    category: "transport" | "parking" | "meal" | "lodging" | "other";
    amount: number;
    note?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const access = await getTripAccessForUser(userId, input.tripId);
  if (!access || access === "viewer") return undefined;
  const inserted = await db
    .insert(tripExpenses)
    .values({
      tripId: input.tripId,
      category: input.category,
      amount: input.amount.toFixed(2),
      note: input.note?.trim() || null,
    })
    .$returningId();
  return inserted[0].id;
}

export async function updateTripStopExecutionForOwner(
  ownerId: number,
  stopId: number,
  input: {
    executionStatus: ExecutionStatus;
    completedAt: string | null;
    issueNote: string | null;
    issueOwner: string | null;
    issueDueAt: string | null;
    issueResolvedAt: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const ownedStop = (
    await db
      .select({ id: tripStops.id })
      .from(tripStops)
      .innerJoin(trips, eq(tripStops.tripId, trips.id))
      .where(and(eq(trips.ownerId, ownerId), eq(tripStops.id, stopId)))
      .limit(1)
  )[0];
  if (!ownedStop) return false;
  await db
    .update(tripStops)
    .set({
      executionStatus: input.executionStatus,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      issueNote: input.issueNote?.trim() || null,
      issueOwner: input.issueOwner?.trim() || null,
      issueDueAt: input.issueDueAt
        ? new Date(`${input.issueDueAt}T00:00:00.000Z`)
        : null,
      issueResolvedAt: input.issueResolvedAt
        ? new Date(input.issueResolvedAt)
        : null,
    })
    .where(eq(tripStops.id, stopId));
  return true;
}

export async function updateTripStopExecutionForUser(
  userId: number,
  stopId: number,
  input: {
    executionStatus: ExecutionStatus;
    completedAt: string | null;
    issueNote: string | null;
    issueOwner: string | null;
    issueDueAt: string | null;
    issueResolvedAt: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const stop = (
    await db
      .select({
        tripId: tripStops.tripId,
        executionStatus: tripStops.executionStatus,
        completedAt: tripStops.completedAt,
        issueNote: tripStops.issueNote,
        issueOwner: tripStops.issueOwner,
        issueDueAt: tripStops.issueDueAt,
        issueResolvedAt: tripStops.issueResolvedAt,
      })
      .from(tripStops)
      .where(eq(tripStops.id, stopId))
      .limit(1)
  )[0];
  const access = stop ? await getTripAccessForUser(userId, stop.tripId) : null;
  if (!stop || !access || access === "viewer") return false;
  await db
    .update(tripStops)
    .set({
      executionStatus: input.executionStatus,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      issueNote: input.issueNote?.trim() || null,
      issueOwner: input.issueOwner?.trim() || null,
      issueDueAt: input.issueDueAt
        ? new Date(`${input.issueDueAt}T00:00:00.000Z`)
        : null,
      issueResolvedAt: input.issueResolvedAt
        ? new Date(input.issueResolvedAt)
        : null,
    })
    .where(eq(tripStops.id, stopId));
  await db.insert(tripAuditLogs).values({
    tripId: stop.tripId,
    actorUserId: userId,
    action: "stop_execution_updated",
    entityType: "trip_stop",
    entityId: stopId,
    beforeSnapshot: JSON.stringify({
      executionStatus: stop.executionStatus,
      completedAt: stop.completedAt,
      issueNote: stop.issueNote,
      issueOwner: stop.issueOwner,
      issueDueAt: stop.issueDueAt,
      issueResolvedAt: stop.issueResolvedAt,
    }),
    afterSnapshot: JSON.stringify(input),
  });
  return true;
}

export async function updateTripChecklistForOwner(
  ownerId: number,
  tripId: number,
  checklist: TripChecklist
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .update(trips)
    .set({
      preDepartureChecked: checklist.preDeparture,
      onSiteChecked: checklist.onSite,
      wrapUpChecked: checklist.wrapUp,
    })
    .where(and(eq(trips.ownerId, ownerId), eq(trips.id, tripId)));
  return result[0].affectedRows > 0;
}

export async function updateTripChecklistForUser(
  userId: number,
  tripId: number,
  checklist: TripChecklist
) {
  const access = await getTripAccessForUser(userId, tripId);
  if (!access || access === "viewer") return false;
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .update(trips)
    .set({
      preDepartureChecked: checklist.preDeparture,
      onSiteChecked: checklist.onSite,
      wrapUpChecked: checklist.wrapUp,
    })
    .where(eq(trips.id, tripId));
  return result[0].affectedRows > 0;
}

export async function updateTripReportDraftForUser(
  userId: number,
  tripId: number,
  reportDraft: string
) {
  const access = await getTripAccessForUser(userId, tripId);
  if (!access || access === "viewer") return false;
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .update(trips)
    .set({ reportDraft })
    .where(eq(trips.id, tripId));
  return result[0].affectedRows > 0;
}

export async function updateTripDepartmentForOwner(
  ownerId: number,
  tripId: number,
  department: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .update(trips)
    .set({ department: department?.trim() || null })
    .where(and(eq(trips.id, tripId), eq(trips.ownerId, ownerId)));
  return result[0].affectedRows > 0;
}

export async function listTripCollaboratorsForOwner(
  ownerId: number,
  tripId: number
) {
  const db = await getDb();
  if (!db || (await getTripAccessForUser(ownerId, tripId)) !== "owner")
    return undefined;
  return db
    .select({
      id: tripCollaborators.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      permission: tripCollaborators.permission,
      createdAt: tripCollaborators.createdAt,
    })
    .from(tripCollaborators)
    .innerJoin(users, eq(tripCollaborators.userId, users.id))
    .where(eq(tripCollaborators.tripId, tripId))
    .orderBy(asc(tripCollaborators.createdAt));
}

export async function inviteTripCollaboratorForOwner(
  ownerId: number,
  tripId: number,
  email: string,
  permission: CollaborationPermission
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if ((await getTripAccessForUser(ownerId, tripId)) !== "owner")
    return { status: "forbidden" as const };
  const user = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.trim()))
      .limit(1)
  )[0];
  if (!user) return { status: "not_found" as const };
  if (user.id === ownerId) return { status: "owner" as const };
  await db
    .insert(tripCollaborators)
    .values({ tripId, userId: user.id, permission })
    .onDuplicateKeyUpdate({ set: { permission } });
  return { status: "invited" as const };
}

export async function removeTripCollaboratorForOwner(
  ownerId: number,
  tripId: number,
  collaboratorId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if ((await getTripAccessForUser(ownerId, tripId)) !== "owner") return false;
  const result = await db
    .delete(tripCollaborators)
    .where(
      and(
        eq(tripCollaborators.id, collaboratorId),
        eq(tripCollaborators.tripId, tripId)
      )
    );
  return result[0].affectedRows > 0;
}

export async function getTripDraftForOwner(ownerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db
      .select()
      .from(tripDrafts)
      .where(eq(tripDrafts.ownerId, ownerId))
      .limit(1)
  )[0];
}

export async function upsertTripDraftForOwner(
  ownerId: number,
  payload: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(tripDrafts)
    .values({ ownerId, payload })
    .onDuplicateKeyUpdate({ set: { payload, updatedAt: new Date() } });
  return getTripDraftForOwner(ownerId);
}

export async function clearTripDraftForOwner(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .delete(tripDrafts)
    .where(eq(tripDrafts.ownerId, ownerId));
  return result[0].affectedRows > 0;
}

export async function getTripPhotoForOwner(
  ownerId: number,
  storageKey: string
) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db
      .select({
        storageKey: tripStopPhotos.storageKey,
        fileName: tripStopPhotos.fileName,
      })
      .from(tripStopPhotos)
      .innerJoin(tripStops, eq(tripStopPhotos.tripStopId, tripStops.id))
      .innerJoin(trips, eq(tripStops.tripId, trips.id))
      .where(
        and(
          eq(trips.ownerId, ownerId),
          eq(tripStopPhotos.storageKey, storageKey)
        )
      )
      .limit(1)
  )[0];
}

export async function getTripPhotoForUser(userId: number, storageKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const photo = (
    await db
      .select({
        storageKey: tripStopPhotos.storageKey,
        fileName: tripStopPhotos.fileName,
        tripId: tripStops.tripId,
      })
      .from(tripStopPhotos)
      .innerJoin(tripStops, eq(tripStopPhotos.tripStopId, tripStops.id))
      .where(eq(tripStopPhotos.storageKey, storageKey))
      .limit(1)
  )[0];
  if (!photo || !(await getTripAccessForUser(userId, photo.tripId)))
    return undefined;
  return { storageKey: photo.storageKey, fileName: photo.fileName };
}

export async function getSharedTrip(shareToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const trip = (
    await db
      .select()
      .from(trips)
      .where(eq(trips.shareToken, shareToken))
      .limit(1)
  )[0];
  return trip ? hydrateTrip(trip.id) : undefined;
}

export async function deleteTripForOwner(ownerId: number, tripId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .delete(trips)
    .where(and(eq(trips.id, tripId), eq(trips.ownerId, ownerId)));
  return result[0].affectedRows > 0;
}
