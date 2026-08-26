import {
  boolean,
  date,
  decimal,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 150 }).notNull(),
  tripDate: date("tripDate").notNull(),
  managerName: varchar("managerName", { length: 100 }).notNull(),
  department: varchar("department", { length: 100 }),
  shareToken: varchar("shareToken", { length: 36 }).notNull().unique(),
  fixedStartName: varchar("fixedStartName", { length: 150 }),
  fixedStartAddress: varchar("fixedStartAddress", { length: 255 }),
  fixedStartLatitude: decimal("fixedStartLatitude", {
    precision: 10,
    scale: 7,
  }),
  fixedStartLongitude: decimal("fixedStartLongitude", {
    precision: 10,
    scale: 7,
  }),
  returnToStart: boolean("returnToStart").notNull().default(false),
  routeDistanceKm: decimal("routeDistanceKm", {
    precision: 10,
    scale: 2,
  }).notNull(),
  routeDurationMinutes: int("routeDurationMinutes").notNull(),
  departureTime: varchar("departureTime", { length: 5 })
    .notNull()
    .default("09:00"),
  preDepartureChecked: boolean("preDepartureChecked").notNull().default(false),
  onSiteChecked: boolean("onSiteChecked").notNull().default(false),
  wrapUpChecked: boolean("wrapUpChecked").notNull().default(false),
  reportDraft: mediumtext("reportDraft"),
  isTemplate: boolean("isTemplate").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tripStops = mysqlTable("tripStops", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  sequence: int("sequence").notNull(),
  note: varchar("note", { length: 1000 }),
  serviceMinutes: int("serviceMinutes").notNull().default(20),
  windowStart: varchar("windowStart", { length: 5 }),
  windowEnd: varchar("windowEnd", { length: 5 }),
  executionStatus: mysqlEnum("executionStatus", [
    "planned",
    "in_progress",
    "completed",
    "issue",
  ])
    .notNull()
    .default("planned"),
  completedAt: timestamp("completedAt"),
  issueNote: varchar("issueNote", { length: 1000 }),
  issueOwner: varchar("issueOwner", { length: 100 }),
  issueDueAt: date("issueDueAt"),
  issueResolvedAt: timestamp("issueResolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tripAuditLogs = mysqlTable("tripAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  actorUserId: int("actorUserId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entityType", { length: 40 }).notNull(),
  entityId: int("entityId"),
  beforeSnapshot: mediumtext("beforeSnapshot"),
  afterSnapshot: mediumtext("afterSnapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tripExpenses = mysqlTable("tripExpenses", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  category: mysqlEnum("category", [
    "transport",
    "parking",
    "meal",
    "lodging",
    "other",
  ]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tripCollaborators = mysqlTable(
  "tripCollaborators",
  {
    id: int("id").autoincrement().primaryKey(),
    tripId: int("tripId")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: mysqlEnum("permission", ["viewer", "editor"])
      .notNull()
      .default("viewer"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("tripCollaborators_tripId_userId_unique").on(
      table.tripId,
      table.userId
    ),
  ]
);

export const tripStopPhotos = mysqlTable("tripStopPhotos", {
  id: int("id").autoincrement().primaryKey(),
  tripStopId: int("tripStopId")
    .notNull()
    .references(() => tripStops.id, { onDelete: "cascade" }),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  url: varchar("url", { length: 750 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  takenAt: date("takenAt"),
  description: varchar("description", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tripDrafts = mysqlTable("tripDrafts", {
  ownerId: int("ownerId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  payload: mediumtext("payload").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type TripStop = typeof tripStops.$inferSelect;
export type TripAuditLog = typeof tripAuditLogs.$inferSelect;
export type TripCollaborator = typeof tripCollaborators.$inferSelect;
export type TripDraft = typeof tripDrafts.$inferSelect;
