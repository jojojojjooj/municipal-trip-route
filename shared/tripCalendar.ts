type CalendarStop = {
  sequence: number;
  name: string;
  address: string;
  note?: string;
};

export type TripCalendarInput = {
  title: string;
  tripDate: string;
  managerName: string;
  department?: string;
  returnToStart?: boolean;
  fixedStartName?: string;
  routeDistanceKm?: number;
  routeDurationMinutes?: number;
  stops: CalendarStop[];
};

function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n");
}

function escapeParam(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function foldLine(line: string) {
  const chunks: string[] = [];
  let remaining = line;
  const firstLineWidth = 75;
  const continuationLineWidth = 74;
  while (remaining.length > firstLineWidth) {
    const width = chunks.length ? continuationLineWidth : firstLineWidth;
    chunks.push(remaining.slice(0, width));
    remaining = remaining.slice(width);
  }
  chunks.push(remaining);
  return chunks.join("\r\n ");
}

function toUtcTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function toDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[1]}${match[2]}${match[3]}` : "";
}

function toNextDateValue(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function makeTripCalendarFileName(title: string, tripDate: string) {
  const safeTitle =
    title
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "출장계획";
  return `${safeTitle}-${tripDate || "일정미정"}.ics`;
}

export function makeTripCalendar(input: TripCalendarInput, now = new Date()) {
  const dateValue = toDateValue(input.tripDate);
  const nextDateValue = toNextDateValue(input.tripDate);
  if (!dateValue || !nextDateValue)
    throw new Error("유효한 출장일을 입력해 주세요.");
  if (!input.stops.length)
    throw new Error("캘린더에 등록할 목적지가 없습니다.");

  const summary = input.title.trim() || "지자체 출장";
  const location =
    input.fixedStartName?.trim() || input.stops[0]?.address || "";
  const description = [
    `담당자: ${input.managerName.trim() || "미입력"}`,
    input.department?.trim() ? `부서: ${input.department.trim()}` : "",
    `방문 목적지: ${input.stops.length}곳`,
    input.routeDistanceKm !== undefined
      ? `예상 이동 거리: ${input.routeDistanceKm.toFixed(1)}km`
      : "",
    input.routeDurationMinutes !== undefined
      ? `예상 이동 시간: ${input.routeDurationMinutes}분`
      : "",
    input.returnToStart && input.fixedStartName
      ? `복귀: ${input.fixedStartName.trim()}`
      : "",
    "",
    ...input.stops.map(
      stop =>
        `${stop.sequence}. ${stop.name} — ${stop.address}${stop.note?.trim() ? ` — ${stop.note.trim()}` : ""}`
    ),
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Yeongjeongdo//Municipal Trip Route//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:municipal-trip-${dateValue}-${input.stops
      .map(stop => `${stop.sequence}-${stop.name}`)
      .join("-")
      .slice(0, 120)}@yeongjeongdo`,
    `DTSTAMP:${toUtcTimestamp(now)}`,
    `DTSTART;VALUE=DATE:${dateValue}`,
    `DTEND;VALUE=DATE:${nextDateValue}`,
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText(location)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `X-MUNICIPAL-TRIP-MANAGER:${escapeParam(input.managerName.trim() || "미입력")}`,
    `X-MUNICIPAL-TRIP-STOPS:${input.stops.length}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `\uFEFF${lines.map(foldLine).join("\r\n")}\r\n`;
}
