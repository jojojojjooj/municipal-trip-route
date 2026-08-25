import {
  executionStatusLabel,
  isExecutionStatus,
  type ExecutionStatus,
} from "./tripOperations";

export type CsvStop = {
  sequence: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  executionStatus?: ExecutionStatus;
  completedAt?: string;
  issueNote?: string;
  issueOwner?: string;
  issueDueAt?: string;
  issueResolvedAt?: string;
  note?: string;
};

export type ParsedTripStopsCsv = {
  title: string;
  tripDate: string;
  stops: CsvStop[];
};

const CSV_HEADERS = [
  "출장명",
  "출장일",
  "순서",
  "목적지",
  "주소",
  "위도",
  "경도",
  "실행 상태",
  "완료 시각",
  "현장 이슈",
  "이슈 담당자",
  "조치 기한",
  "해결 시각",
  "현장 메모",
] as const;
const STATUS_BY_LABEL: Record<string, ExecutionStatus> = {
  예정: "planned",
  진행: "in_progress",
  완료: "completed",
  이슈: "issue",
};
const MAX_IMPORTED_STOPS = 100;

function escapeCsv(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = input.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("CSV 파일의 따옴표가 닫히지 않았습니다.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseRequiredNumber(value: string, label: string, rowNumber: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error(`${rowNumber}행의 ${label} 값이 올바르지 않습니다.`);
  return parsed;
}

function parseStatus(value: string, rowNumber: number): ExecutionStatus {
  const normalized = value.trim();
  if (!normalized) return "planned";
  if (isExecutionStatus(normalized)) return normalized;
  const status = STATUS_BY_LABEL[normalized];
  if (status) return status;
  throw new Error(
    `${rowNumber}행의 실행 상태 '${normalized}'를 인식할 수 없습니다.`
  );
}

export function makeTripStopsCsv(
  title: string,
  tripDate: string,
  stops: CsvStop[]
) {
  const rows = stops.map(stop => [
    title,
    tripDate,
    stop.sequence,
    stop.name,
    stop.address,
    stop.latitude,
    stop.longitude,
    executionStatusLabel(stop.executionStatus ?? "planned"),
    stop.completedAt ?? "",
    stop.issueNote ?? "",
    stop.issueOwner ?? "",
    stop.issueDueAt ?? "",
    stop.issueResolvedAt ?? "",
    stop.note ?? "",
  ]);
  return `\uFEFF${[CSV_HEADERS, ...rows].map(row => row.map(escapeCsv).join(",")).join("\r\n")}`;
}

export function parseTripStopsCsv(input: string): ParsedTripStopsCsv {
  if (!input.trim()) throw new Error("CSV 파일이 비어 있습니다.");
  const rows = parseCsvRows(input).filter(row =>
    row.some(cell => cell.trim() !== "")
  );
  if (!rows.length) throw new Error("CSV 파일에 데이터가 없습니다.");

  const header = rows[0].map(cell => cell.trim());
  const hasExpectedHeader =
    CSV_HEADERS.length === header.length &&
    CSV_HEADERS.every((label, index) => label === header[index]);
  if (!hasExpectedHeader)
    throw new Error("여정도에서 내보낸 목적지 CSV 형식이 아닙니다.");

  const dataRows = rows.slice(1);
  if (!dataRows.length) throw new Error("CSV 파일에 가져올 목적지가 없습니다.");
  if (dataRows.length > MAX_IMPORTED_STOPS)
    throw new Error(
      `한 번에 최대 ${MAX_IMPORTED_STOPS}곳까지 가져올 수 있습니다.`
    );

  const stops = dataRows
    .map((rawRow, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const row = [
        ...rawRow,
        ...Array.from({ length: CSV_HEADERS.length - rawRow.length }, () => ""),
      ].slice(0, CSV_HEADERS.length);
      if (rawRow.length > CSV_HEADERS.length)
        throw new Error(`${rowNumber}행의 열 개수가 헤더와 다릅니다.`);

      const name = row[3]?.trim() ?? "";
      const address = row[4]?.trim() ?? "";
      if (!name) throw new Error(`${rowNumber}행의 목적지명이 비어 있습니다.`);
      if (!address) throw new Error(`${rowNumber}행의 주소가 비어 있습니다.`);

      const latitude = parseRequiredNumber(row[5] ?? "", "위도", rowNumber);
      const longitude = parseRequiredNumber(row[6] ?? "", "경도", rowNumber);
      if (latitude < -90 || latitude > 90)
        throw new Error(`${rowNumber}행의 위도 범위가 올바르지 않습니다.`);
      if (longitude < -180 || longitude > 180)
        throw new Error(`${rowNumber}행의 경도 범위가 올바르지 않습니다.`);

      const parsedSequence = Number(row[2]);
      const sequence =
        Number.isInteger(parsedSequence) && parsedSequence > 0
          ? parsedSequence
          : rowIndex + 1;
      return {
        sequence,
        name,
        address,
        latitude,
        longitude,
        executionStatus: parseStatus(row[7] ?? "", rowNumber),
        completedAt: row[8]?.trim() || undefined,
        issueNote: row[9]?.trim() || undefined,
        issueOwner: row[10]?.trim() || undefined,
        issueDueAt: row[11]?.trim() || undefined,
        issueResolvedAt: row[12]?.trim() || undefined,
        note: row[13]?.trim() || undefined,
      } satisfies CsvStop;
    })
    .sort((a, b) => a.sequence - b.sequence);

  return {
    title: rows[1]?.[0]?.trim() ?? "",
    tripDate: rows[1]?.[1]?.trim() ?? "",
    stops,
  };
}

export function makeTripStopsCsvFileName(title: string, tripDate: string) {
  const safeTitle =
    title
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "출장계획";
  return `${safeTitle}-${tripDate || "일정미정"}-목적지.csv`;
}
