export type VisitTimeConstraint = {
  id: string;
  serviceMinutes?: number;
  windowStart?: string;
  windowEnd?: string;
};

export type ScheduledVisit = {
  id: string;
  sequence: number;
  arrival: Date;
  visitStart: Date;
  visitEnd: Date;
  travelMinutes: number;
  waitMinutes: number;
  serviceMinutes: number;
  windowStart?: string;
  windowEnd?: string;
  status: "on_time" | "late" | "invalid_window";
};

export type ConstrainedVisitSchedule = {
  stops: ScheduledVisit[];
  totalWaitMinutes: number;
  totalServiceMinutes: number;
  violations: ScheduledVisit[];
  routeEnd: Date | null;
};

export function isTimeOfDay(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeAt(tripDate: string, time: string) {
  return new Date(`${tripDate}T${time}:00`);
}

function normalizedServiceMinutes(value: number | undefined) {
  if (!Number.isFinite(value)) return 20;
  return Math.min(Math.max(Math.round(value as number), 0), 480);
}

export function buildConstrainedVisitSchedule(input: {
  tripDate: string;
  departureTime: string;
  routeDurationMinutes: number;
  stops: VisitTimeConstraint[];
}): ConstrainedVisitSchedule {
  const departureTime = isTimeOfDay(input.departureTime)
    ? input.departureTime
    : "09:00";
  const start = timeAt(input.tripDate, departureTime);
  if (!input.stops.length || Number.isNaN(start.getTime())) {
    return {
      stops: [],
      totalWaitMinutes: 0,
      totalServiceMinutes: 0,
      violations: [],
      routeEnd: null,
    };
  }

  const travelPerStop = Math.max(
    0,
    Math.ceil(Math.max(0, input.routeDurationMinutes) / input.stops.length)
  );
  let cursor = start;
  let totalWaitMinutes = 0;
  let totalServiceMinutes = 0;

  const stops = input.stops.map((stop, index) => {
    const travelMinutes = travelPerStop;
    const arrival = new Date(cursor.getTime() + travelMinutes * 60_000);
    const serviceMinutes = normalizedServiceMinutes(stop.serviceMinutes);
    const windowStart = isTimeOfDay(stop.windowStart)
      ? stop.windowStart
      : undefined;
    const windowEnd = isTimeOfDay(stop.windowEnd) ? stop.windowEnd : undefined;
    const earliest = windowStart ? timeAt(input.tripDate, windowStart) : null;
    const latest = windowEnd ? timeAt(input.tripDate, windowEnd) : null;
    const invalidWindow = Boolean(
      earliest && latest && earliest.getTime() > latest.getTime()
    );
    const waitMinutes =
      earliest && arrival.getTime() < earliest.getTime()
        ? Math.ceil((earliest.getTime() - arrival.getTime()) / 60_000)
        : 0;
    const visitStart = new Date(arrival.getTime() + waitMinutes * 60_000);
    const visitEnd = new Date(visitStart.getTime() + serviceMinutes * 60_000);
    const status = invalidWindow
      ? "invalid_window"
      : latest && visitStart.getTime() > latest.getTime()
        ? "late"
        : "on_time";

    totalWaitMinutes += waitMinutes;
    totalServiceMinutes += serviceMinutes;
    cursor = visitEnd;
    return {
      id: stop.id,
      sequence: index + 1,
      arrival,
      visitStart,
      visitEnd,
      travelMinutes,
      waitMinutes,
      serviceMinutes,
      windowStart,
      windowEnd,
      status,
    } satisfies ScheduledVisit;
  });

  return {
    stops,
    totalWaitMinutes,
    totalServiceMinutes,
    violations: stops.filter(stop => stop.status !== "on_time"),
    routeEnd: stops.at(-1)?.visitEnd ?? null,
  };
}
