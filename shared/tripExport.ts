import { executionStatusLabel, type ExecutionStatus } from "./tripOperations";

type CsvStop = {
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

function escapeCsv(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

export function makeTripStopsCsv(title: string, tripDate: string, stops: CsvStop[]) {
  const header = ["출장명", "출장일", "순서", "목적지", "주소", "위도", "경도", "실행 상태", "완료 시각", "현장 이슈", "이슈 담당자", "조치 기한", "해결 시각", "현장 메모"];
  const rows = stops.map(stop => [title, tripDate, stop.sequence, stop.name, stop.address, stop.latitude, stop.longitude, executionStatusLabel(stop.executionStatus ?? "planned"), stop.completedAt ?? "", stop.issueNote ?? "", stop.issueOwner ?? "", stop.issueDueAt ?? "", stop.issueResolvedAt ?? "", stop.note ?? ""]);
  return `\uFEFF${[header, ...rows].map(row => row.map(escapeCsv).join(",")).join("\r\n")}`;
}

export function makeTripStopsCsvFileName(title: string, tripDate: string) {
  const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 60) || "출장계획";
  return `${safeTitle}-${tripDate || "일정미정"}-목적지.csv`;
}
