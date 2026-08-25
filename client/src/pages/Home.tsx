import DashboardLayout from "@/components/DashboardLayout";
import KakaoTripMap, { type MapDestination } from "@/components/KakaoTripMap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { downloadTripPdf } from "@/lib/tripPdf";
import { makeTripPhotoDataUrl } from "../../../shared/tripPhoto";
import {
  createTripDraftEnvelope,
  hasTripDraftContent,
  parseTripDraft,
  pickLatestTripDraft,
  TRIP_DRAFT_STORAGE_KEY,
  tripDraftFingerprint,
  type TripDraftEnvelope,
  type TripDraftPayload,
} from "@shared/tripDraft";
import {
  getTripDraftStatusCopy,
  resolveTripDraftAccountSync,
  scheduleTripDraftInputSave,
  startTripDraftAccountSync,
  type TripDraftPersistenceState,
} from "@shared/tripDraftAutosave";
import {
  filterFieldRecords,
  getSelectedFieldRecords,
  toggleRecordSelection,
  type FieldRecordFilter,
} from "@shared/fieldRecordFilters";
import { addRecentSearch, removeRecentSearch } from "@shared/recentSearches";
import { parseBatchDates } from "@shared/tripBatch";
import { createNewTripDraft, hasNewTripContent } from "@shared/newTripPlan";
import {
  makeTripStopsCsv,
  makeTripStopsCsvFileName,
  parseTripStopsCsv,
} from "@shared/tripExport";
import {
  makeTripCalendar,
  makeTripCalendarFileName,
} from "@shared/tripCalendar";
import {
  createTripResultReportDraft,
  parseTripResultReportDraft,
  type TripResultReportDraft,
} from "@shared/tripReportDraft";
import {
  filterTripReportEvidence,
  moveTripReportEvidenceOrder,
  orderTripReportEvidence,
  selectTripReportEvidence,
  type TripReportEvidence,
} from "@shared/tripReportEvidence";
import {
  buildTripResultHwpx,
  makeTripResultHwpxFileName,
} from "@shared/tripResultHwpx";
import {
  buildVisitSchedule,
  EMPTY_TRIP_CHECKLIST,
  executionStatusLabel,
  getChecklistProgress,
  getTripIssueSummary,
  getTripOperationSummary,
  type ExecutionStatus,
  type TripChecklist,
} from "@shared/tripOperations";
import {
  optimizeRouteFromFixedStart,
  type FixedStart,
} from "@shared/fixedStartRoute";
import type { OptimizationStrategy } from "@shared/tripOptimizer";
import {
  makeFieldRecordPdfFileName,
  makeTripPdfFileName,
  makeTripResultReportPdfFileName,
} from "@shared/pdfReport";
import { getTripReadiness } from "@shared/tripReadiness";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Cloud,
  CloudOff,
  Copy,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileUp,
  HardDrive,
  ImagePlus,
  Images,
  ListTree,
  Loader2,
  MapPin,
  Maximize2,
  Navigation,
  Plus,
  Printer,
  RefreshCcw,
  Repeat2,
  Route,
  Save,
  Search,
  Share2,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type DestinationPhoto = {
  storageKey: string;
  url: string;
  fileName: string;
  takenAt?: string;
  description?: string;
  dataUrl?: string;
};
type Destination = MapDestination & {
  photos?: DestinationPhoto[];
  executionStatus?: ExecutionStatus;
  completedAt?: string;
  issueNote?: string;
  issueOwner?: string;
  issueDueAt?: string;
  issueResolvedAt?: string;
};
type FixedStartLocation = FixedStart;
type FieldRecord = DestinationPhoto & {
  destinationId: string;
  destinationName: string;
  destinationAddress: string;
  sequence: number;
};

const today = new Date().toISOString().slice(0, 10);
const RECENT_FIELD_RECORD_SEARCHES_KEY =
  "municipal-trip-recent-field-record-searches";
const asNumber = (value: unknown) =>
  typeof value === "number" ? value : Number(value);
const toIsoDate = (value: unknown) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? today
    : parsed.toISOString().slice(0, 10);
};
const designPreviewStops: Destination[] = [
  {
    id: "design-preview-city-hall",
    name: "서울특별시청",
    address: "서울 중구 태평로1가 31",
    latitude: 37.56682,
    longitude: 126.97865,
    note: "민원실 방문 전 담당 주무관에게 연락",
    photos: [
      {
        storageKey: "design-preview-field-photo",
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 180'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23295458'/%3E%3Cstop offset='1' stop-color='%23c4503d'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='240' height='180' fill='url(%23g)'/%3E%3Ccircle cx='185' cy='38' r='26' fill='%23f7f2e9' fill-opacity='.7'/%3E%3Cpath d='M0 135 C50 95 85 150 130 115 S205 80 240 118 V180 H0Z' fill='%231f2d2b' fill-opacity='.55'/%3E%3Ctext x='18' y='30' fill='%23f7f2e9' font-family='sans-serif' font-size='14'%3EFIELD NOTE%3C/text%3E%3C/svg%3E",
        fileName: "현장-검증.png",
        takenAt: "2026-08-21",
        description: "민원실 동선과 현장 안내 표지판을 기록한 사진",
      },
      {
        storageKey: "design-preview-city-hall-prior",
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 180'%3E%3Crect width='240' height='180' fill='%23d0b78d'/%3E%3Cpath d='M0 145 L70 80 L130 132 L190 58 L240 108 V180 H0Z' fill='%23606f61'/%3E%3Ctext x='18' y='30' fill='%231f2d2b' font-family='sans-serif' font-size='14'%3EINSPECTION%3C/text%3E%3C/svg%3E",
        fileName: "현장-이전기록.png",
        takenAt: "2026-08-20",
        description: "청사 주변 보행로와 안내 시설을 점검한 사진",
      },
    ],
  },
  {
    id: "design-preview-station",
    name: "서울역",
    address: "서울 중구 봉래동2가 122-11",
    latitude: 37.55407,
    longitude: 126.9707,
    note: "회의 자료 2부 지참",
    photos: [
      {
        storageKey: "design-preview-station-photo",
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 180'%3E%3Crect width='240' height='180' fill='%238a5a50'/%3E%3Cpath d='M0 128 C42 74 86 160 136 104 S195 55 240 112 V180 H0Z' fill='%232b3b37'/%3E%3Ccircle cx='52' cy='45' r='20' fill='%23f7f2e9' fill-opacity='.7'/%3E%3Ctext x='18' y='164' fill='%23f7f2e9' font-family='sans-serif' font-size='14'%3ESTATION NOTE%3C/text%3E%3C/svg%3E",
        fileName: "서울역-현장.png",
        takenAt: "2026-08-21",
        description: "역사 출입 동선과 집결 지점을 확인한 사진",
      },
    ],
  },
];
const fixedStartPreview: FixedStartLocation = {
  id: "fixed-start-preview",
  name: "시청 별관",
  address: "서울 중구 세종대로 110",
  latitude: 37.5663,
  longitude: 126.9779,
};

type RoutePoint = { x: number; y: number };

function makeRoutePoints(destinations: Destination[]): RoutePoint[] {
  if (!destinations.length) return [];
  if (destinations.length === 1) return [{ x: 360, y: 170 }];

  const latitudes = destinations.map(destination => destination.latitude);
  const longitudes = destinations.map(destination => destination.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = Math.max(maxLatitude - minLatitude, 0.00001);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 0.00001);

  return destinations.map(destination => ({
    x: 70 + ((destination.longitude - minLongitude) / longitudeRange) * 580,
    y: 275 - ((destination.latitude - minLatitude) / latitudeRange) * 205,
  }));
}

function FieldRecordPanel({
  records,
  allRecords,
  filter,
  selectedKeys,
  recentSearches,
  recentSearchesOpen,
  onFilterChange,
  onToggleSelection,
  onToggleVisibleSelection,
  onOpenPhoto,
  onDownloadPdf,
  onSearchFocus,
  onApplyRecentSearch,
  onSaveCurrentSearch,
  onRemoveRecentSearch,
  onClearRecentSearches,
  isPdfGenerating,
}: {
  records: FieldRecord[];
  allRecords: FieldRecord[];
  filter: FieldRecordFilter;
  selectedKeys: string[];
  recentSearches: string[];
  recentSearchesOpen: boolean;
  onFilterChange: (patch: Partial<FieldRecordFilter>) => void;
  onToggleSelection: (storageKey: string) => void;
  onToggleVisibleSelection: () => void;
  onOpenPhoto: (record: FieldRecord) => void;
  onDownloadPdf: () => void;
  onSearchFocus: () => void;
  onApplyRecentSearch: (query: string) => void;
  onSaveCurrentSearch: () => void;
  onRemoveRecentSearch: (query: string) => void;
  onClearRecentSearches: () => void;
  isPdfGenerating: boolean;
}) {
  if (!allRecords.length)
    return (
      <section className="field-records-empty">
        <Images className="h-6 w-6" />
        <p className="font-display text-3xl">아직 현장 기록이 없습니다.</p>
        <span>
          목적지에 사진을 첨부하면 촬영일과 설명을 포함한 기록이 이곳에
          모입니다.
        </span>
      </section>
    );
  const dates = Array.from(
    new Set(
      allRecords
        .map(record => record.takenAt)
        .filter((value): value is string => Boolean(value))
    )
  )
    .sort()
    .reverse();
  const destinations = Array.from(
    new Map(
      allRecords.map(record => [
        record.destinationId,
        { id: record.destinationId, name: record.destinationName },
      ])
    ).values()
  );
  const visibleSelected =
    records.length > 0 &&
    records.every(record => selectedKeys.includes(record.storageKey));
  const selectedCount = selectedKeys.length;
  return (
    <section className="field-records-panel">
      <div className="field-records-heading">
        <div>
          <p className="section-label text-[#c4503d]">Field archive</p>
          <h2 className="font-display mt-2 text-4xl">현장 기록</h2>
          <p className="mt-2 text-sm text-stone-500">
            날짜·목적지와 사진 설명 키워드로 필요한 사진만 찾아 보고서로
            출력합니다.
          </p>
        </div>
        <div className="field-records-actions">
          <span>
            {String(records.length).padStart(2, "0")} /{" "}
            {String(allRecords.length).padStart(2, "0")} RECORDS
          </span>
        </div>
      </div>
      <div className="field-record-filter-panel">
        <div className="field-record-filter-fields">
          <label>
            촬영일
            <select
              value={filter.takenAt}
              onChange={event =>
                onFilterChange({ takenAt: event.target.value })
              }
            >
              <option value="">전체 날짜</option>
              {dates.map(date => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>
          <label>
            목적지
            <select
              value={filter.destinationId}
              onChange={event =>
                onFilterChange({ destinationId: event.target.value })
              }
            >
              <option value="">전체 목적지</option>
              {destinations.map(destination => (
                <option key={destination.id} value={destination.id}>
                  {destination.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-record-description-search">
            설명 검색
            <span>
              <Search className="h-3.5 w-3.5" />
              <Input
                type="search"
                value={filter.descriptionQuery ?? ""}
                onChange={event =>
                  onFilterChange({ descriptionQuery: event.target.value })
                }
                onFocus={onSearchFocus}
                onClick={onSearchFocus}
                onBlur={onSaveCurrentSearch}
                onKeyDown={event => {
                  if (event.key === "Enter") onSaveCurrentSearch();
                }}
                placeholder="예: 안내 표지판"
                aria-label="사진 설명 키워드 검색"
                aria-expanded={recentSearchesOpen}
                aria-controls="recent-field-record-searches"
              />
            </span>
            {recentSearchesOpen ? (
              <div
                id="recent-field-record-searches"
                className="recent-searches-panel"
                role="listbox"
                aria-label="최근 설명 검색어"
              >
                <div>
                  <p>
                    <Clock3 className="h-3.5 w-3.5" /> 최근 검색어
                  </p>
                  {recentSearches.length ? (
                    <button
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={onClearRecentSearches}
                    >
                      전체 비우기
                    </button>
                  ) : null}
                </div>
                {recentSearches.length ? (
                  <ul>
                    {recentSearches.map(query => (
                      <li key={query}>
                        <button
                          type="button"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => onApplyRecentSearch(query)}
                          role="option"
                          aria-label={`최근 검색어 ${query} 적용`}
                        >
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{query}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => onRemoveRecentSearch(query)}
                          aria-label={`최근 검색어 ${query} 삭제`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="recent-searches-empty">
                    최근 검색어가 없습니다.
                  </p>
                )}
              </div>
            ) : null}
          </label>
        </div>
        <button
          type="button"
          className="field-record-filter-reset"
          onClick={() =>
            onFilterChange({
              takenAt: "",
              destinationId: "",
              descriptionQuery: "",
            })
          }
          disabled={
            !filter.takenAt && !filter.destinationId && !filter.descriptionQuery
          }
        >
          <RefreshCcw className="h-3.5 w-3.5" /> 초기화
        </button>
      </div>
      <div className="field-record-selection-bar">
        <label>
          <input
            type="checkbox"
            checked={visibleSelected}
            onChange={onToggleVisibleSelection}
            disabled={!records.length}
          />
          <span>필터 결과 전체 선택</span>
        </label>
        <div>
          <strong>{selectedCount}장 선택됨</strong>
          <Button
            type="button"
            onClick={onDownloadPdf}
            disabled={isPdfGenerating || !selectedCount}
            className="field-record-pdf-button"
          >
            {isPdfGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {isPdfGenerating
              ? "보고서 생성 중"
              : `선택 사진 PDF (${selectedCount})`}
          </Button>
        </div>
      </div>
      {records.length ? (
        <div className="field-records-grid">
          {records.map(record => (
            <article
              key={record.storageKey}
              className={
                selectedKeys.includes(record.storageKey)
                  ? "field-record-card field-record-card-selected"
                  : "field-record-card"
              }
            >
              <label className="field-record-select">
                <input
                  type="checkbox"
                  checked={selectedKeys.includes(record.storageKey)}
                  onChange={() => onToggleSelection(record.storageKey)}
                  aria-label={`${record.destinationName} 사진 선택`}
                />
                <span>선택</span>
              </label>
              <button
                type="button"
                className="field-record-photo"
                onClick={() => onOpenPhoto(record)}
                aria-label={`${record.destinationName} 사진 크게 보기`}
              >
                <img
                  src={record.dataUrl ?? record.url}
                  alt={`${record.destinationName} 현장 사진`}
                />
                <span>
                  <Maximize2 className="h-4 w-4" /> 확대 보기
                </span>
              </button>
              <div className="field-record-copy">
                <p className="section-label">
                  STOP {String(record.sequence).padStart(2, "0")}
                </p>
                <h3>{record.destinationName}</h3>
                <p className="field-record-address">
                  {record.destinationAddress}
                </p>
                <p className="field-record-date">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {record.takenAt ?? "촬영일 미입력"}
                </p>
                <p
                  className={
                    record.description
                      ? "field-record-description"
                      : "field-record-description field-record-description-empty"
                  }
                >
                  {record.description || "사진 설명을 입력해 주세요."}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="field-records-empty field-records-empty-filter">
          <Search className="h-5 w-5" />
          <p className="font-display text-3xl">조건에 맞는 사진이 없습니다.</p>
          <span>
            날짜·목적지 조건 또는 설명 검색어를 초기화해 다른 현장 기록을
            확인하세요.
          </span>
        </section>
      )}
    </section>
  );
}

function ResultReportEvidencePreview({
  evidence,
  excludedKeys,
  canReorder,
  draggedKey,
  onDragStart,
  onDragEnd,
  onReorder,
  onMove,
  onToggleIncluded,
  onOpenPhoto,
}: {
  evidence: TripReportEvidence[];
  excludedKeys: string[];
  canReorder: boolean;
  draggedKey: string | null;
  onDragStart: (storageKey: string) => void;
  onDragEnd: () => void;
  onReorder: (sourceKey: string, targetKey: string) => void;
  onMove: (storageKey: string, direction: "up" | "down") => void;
  onToggleIncluded: (storageKey: string) => void;
  onOpenPhoto: (photo: FieldRecord) => void;
}) {
  if (!evidence.length) return null;
  const includedCount = evidence.filter(
    photo => !excludedKeys.includes(photo.storageKey)
  ).length;
  return (
    <section
      className="result-report-evidence-preview print:hidden"
      aria-label="자동 배치 현장 증빙 사진"
    >
      <div>
        <p className="section-label text-[#c4503d]">Auto placed evidence</p>
        <h3>보고서 본문 사진 배치</h3>
        <p>
          {canReorder
            ? "사진을 끌어 원하는 위치에 놓거나 위·아래 버튼을 눌러 순서를 바꿀 수 있습니다. 포함 토글을 끄면 초안 저장 후 PDF 본문에서도 제외됩니다."
            : "목적지 다양성, 사진 설명, 촬영일과 실행 상태를 기준으로 최대 6장을 자동 배치합니다."}
        </p>
      </div>
      <span>
        {includedCount}/{evidence.length}장 포함
      </span>
      <div className="result-report-evidence-preview-grid">
        {evidence.map((photo, index) => {
          const isIncluded = !excludedKeys.includes(photo.storageKey);
          return (
            <article
              key={photo.storageKey}
              draggable={canReorder}
              className={`${draggedKey === photo.storageKey ? "result-report-evidence-card result-report-evidence-card-dragging" : "result-report-evidence-card"}${isIncluded ? "" : " result-report-evidence-card-excluded"}`}
              onDragStart={event => {
                if (!canReorder) return;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", photo.storageKey);
                onDragStart(photo.storageKey);
              }}
              onDragOver={event => {
                if (canReorder) event.preventDefault();
              }}
              onDrop={event => {
                event.preventDefault();
                const sourceKey =
                  event.dataTransfer.getData("text/plain") || draggedKey;
                if (sourceKey) onReorder(sourceKey, photo.storageKey);
              }}
              onDragEnd={onDragEnd}
            >
              <button
                type="button"
                onClick={() => onOpenPhoto(photo)}
                aria-label={`${photo.destinationName} 보고서 증빙 사진 크게 보기`}
              >
                <img
                  src={photo.dataUrl ?? photo.url}
                  alt={`${photo.destinationName} 보고서 증빙 사진`}
                />
                <span>
                  <strong>
                    PHOTO {String(index + 1).padStart(2, "0")} ·{" "}
                    {photo.destinationName}
                  </strong>
                  <small>
                    {photo.takenAt ?? "촬영일 미입력"} ·{" "}
                    {photo.description?.trim() || "설명 미입력"}
                  </small>
                </span>
              </button>
              {canReorder ? (
                <div className="result-report-evidence-include-control">
                  <span>보고서 포함</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isIncluded}
                    onClick={() => onToggleIncluded(photo.storageKey)}
                  >
                    <i />
                    {isIncluded ? "포함" : "제외"}
                  </button>
                </div>
              ) : (
                <p className="result-report-evidence-readonly-status">
                  {isIncluded ? "보고서 포함" : "보고서 제외"}
                </p>
              )}
              {canReorder ? (
                <div className="result-report-evidence-move-controls">
                  <span>
                    순서 {index + 1}/{evidence.length}
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => onMove(photo.storageKey, "up")}
                      disabled={index === 0}
                      aria-label={`${photo.destinationName} 사진 위로 이동`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" /> 위
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(photo.storageKey, "down")}
                      disabled={index === evidence.length - 1}
                      aria-label={`${photo.destinationName} 사진 아래로 이동`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" /> 아래
                    </button>
                  </div>
                </div>
              ) : null}
              {canReorder ? (
                <p
                  className="result-report-evidence-drag-handle"
                  aria-hidden="true"
                >
                  DRAG TO REORDER
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HwpxReportPreview({
  title,
  tripDate,
  managerName,
  department,
  draft,
  evidence,
}: {
  title: string;
  tripDate: string;
  managerName: string;
  department: string;
  draft: TripResultReportDraft;
  evidence: TripReportEvidence[];
}) {
  const generatedAt = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(draft.generatedAt));
  const previewOpen =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("hwpx-preview") === "open";
  const sections = [
    ["01 / 출장 개요", draft.overview],
    ["02 / 수행 결과", draft.outcome],
    ["03 / 이슈 및 조치", draft.issueActions],
    ["04 / 후속 계획", draft.followUp],
  ] as const;
  return (
    <section
      className="hwpx-preview-shell print:hidden"
      aria-label="HWPX 결과 보고서 미리보기"
    >
      <details open={previewOpen || undefined}>
        <summary>
          <span>
            <FileText className="h-4 w-4" />
            <strong>HWPX 문서 미리보기</strong>
            <small>
              현재 문안·포함 사진·배치 순서를 한글 문서 본문 기준으로
              확인합니다.
            </small>
          </span>
          <span className="hwpx-preview-open">열기</span>
        </summary>
        <div className="hwpx-preview-stage">
          <div className="hwpx-preview-paper">
            <header>
              <p>여정도 · MUNICIPAL TRIP DESK</p>
              <h3>출장 결과 보고서</h3>
              <span>HWPX DOCUMENT PREVIEW</span>
            </header>
            <dl>
              <div>
                <dt>출장명</dt>
                <dd>{title.trim() || "미저장 출장 계획"}</dd>
              </div>
              <div>
                <dt>출장일</dt>
                <dd>{tripDate || "일정 미정"}</dd>
              </div>
              <div>
                <dt>담당자 / 부서</dt>
                <dd>
                  {managerName.trim() || "미입력"}
                  {department.trim() ? ` / ${department.trim()}` : ""}
                </dd>
              </div>
              <div>
                <dt>생성일시</dt>
                <dd>{generatedAt}</dd>
              </div>
            </dl>
            <div className="hwpx-preview-sections">
              {sections.map(([heading, copy]) => (
                <section key={heading}>
                  <h4>{heading}</h4>
                  <p>{copy || "내용 미입력"}</p>
                </section>
              ))}
            </div>
            <section className="hwpx-preview-evidence">
              <h4>05 / 현장 증빙 사진</h4>
              {evidence.length ? (
                <ol>
                  {evidence.map((photo, index) => (
                    <li key={photo.storageKey}>
                      <strong>
                        사진 {String(index + 1).padStart(2, "0")} · 방문{" "}
                        {String(photo.sequence).padStart(2, "0")}
                      </strong>
                      <span>{photo.destinationName}</span>
                      <small>{photo.destinationAddress}</small>
                      <small>촬영일: {photo.takenAt || "미입력"}</small>
                      <p>설명: {photo.description?.trim() || "설명 미입력"}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>보고서에 포함된 현장 증빙 사진이 없습니다.</p>
              )}
            </section>
            <footer>다운로드되는 HWPX의 본문 구성 미리보기입니다.</footer>
          </div>
        </div>
      </details>
    </section>
  );
}

function FieldRecordPdfReport({
  title,
  tripDate,
  managerName,
  records,
  reportRef,
}: {
  title: string;
  tripDate: string;
  managerName: string;
  records: FieldRecord[];
  reportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const generatedAt = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  return (
    <div
      ref={reportRef}
      aria-hidden="true"
      data-trip-pdf-report
      data-field-record-pdf-report
      className="pointer-events-none fixed left-[-10000px] top-0 w-[794px] overflow-hidden bg-[#f7f2e9] p-12 text-[#1f2d2b]"
    >
      <header className="border-b-2 border-[#1f2d2b] pb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="pdf-accent text-[11px] font-bold uppercase tracking-[0.32em] text-[#c4503d]">
              Municipal Trip Desk
            </p>
            <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.06em]">
              선택 현장 기록 보고서
            </h1>
          </div>
          <div className="border-l border-[#1f2d2b]/30 pl-5 text-right text-xs leading-5 text-stone-600">
            <p>SELECTED FIELD RECORDS</p>
            <p>{tripDate || "일정 미정"}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-[1fr_auto] gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">
              출장명
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {title.trim() || "미저장 출장 계획"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">
              담당자
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {managerName.trim() || "미입력"}
            </p>
          </div>
        </div>
      </header>
      <section className="mt-8 border-y border-[#1f2d2b]/35 py-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="pdf-accent text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4503d]">
              Selected field archive
            </p>
            <p className="mt-2 text-sm text-stone-600">
              선택한 현장 사진과 확인 내용을 시간순으로 정리한 기록입니다.
            </p>
          </div>
          <p className="font-display text-4xl">
            {String(records.length).padStart(2, "0")}
            <span className="ml-1 text-base">RECORDS</span>
          </p>
        </div>
      </section>
      <section className="field-record-pdf-list mt-8">
        {records.map((record, index) => (
          <article key={record.storageKey} className="field-record-pdf-item">
            <div className="field-record-pdf-image">
              <img
                data-trip-photo-key={record.storageKey}
                src={record.dataUrl ?? record.url}
                alt={`${record.destinationName} 현장 사진`}
              />
            </div>
            <div className="field-record-pdf-copy">
              <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.22em] text-[#c4503d]">
                Record {String(index + 1).padStart(2, "0")} · Stop{" "}
                {String(record.sequence).padStart(2, "0")}
              </p>
              <h2 className="mt-3 text-xl font-semibold">
                {record.destinationName}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {record.destinationAddress}
              </p>
              <p className="mt-5 border-l-2 border-[#c4503d] pl-3 text-sm font-semibold text-[#8a5a50]">
                촬영일 · {record.takenAt ?? "미입력"}
              </p>
              <p className="mt-4 text-sm leading-6 text-stone-700">
                {record.description || "사진 설명이 아직 입력되지 않았습니다."}
              </p>
            </div>
          </article>
        ))}
      </section>
      <footer className="mt-10 flex items-center justify-between border-t border-[#1f2d2b]/30 pt-4 text-[10px] tracking-[0.12em] text-stone-500">
        <p>여정도 · MUNICIPAL TRIP DESK</p>
        <p>생성일시 {generatedAt}</p>
      </footer>
    </div>
  );
}

function TripResultReportPdf({
  title,
  tripDate,
  managerName,
  department,
  draft,
  destinations,
  reportRef,
}: {
  title: string;
  tripDate: string;
  managerName: string;
  department: string;
  draft: TripResultReportDraft;
  destinations: Destination[];
  reportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const evidenceStops = destinations.filter(
    destination => destination.photos?.length
  );
  return (
    <div
      ref={reportRef}
      aria-hidden="true"
      data-trip-pdf-report
      data-trip-result-report
      className="pointer-events-none fixed left-[-10000px] top-0 w-[794px] overflow-hidden bg-[#f7f2e9] p-12 text-[#1f2d2b]"
    >
      <header className="border-b-2 border-[#1f2d2b] pb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="pdf-accent text-[11px] font-bold uppercase tracking-[0.32em] text-[#c4503d]">
              Municipal Trip Desk
            </p>
            <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.06em]">
              출장 결과 보고서
            </h1>
          </div>
          <div className="border-l border-[#1f2d2b]/30 pl-5 text-right text-xs leading-5 text-stone-600">
            <p>TRIP RESULT REPORT</p>
            <p>{tripDate || "일정 미정"}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-[1fr_auto] gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">
              출장명
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {title.trim() || "미저장 출장 계획"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">
              담당자 / 부서
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {managerName.trim() || "미입력"}
              {department.trim() ? ` · ${department.trim()}` : ""}
            </p>
          </div>
        </div>
      </header>
      <section className="mt-8 space-y-6">
        <div>
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
            01 / 출장 개요
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {draft.overview}
          </p>
        </div>
        <div className="border-t border-[#1f2d2b]/20 pt-6">
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
            02 / 수행 결과
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {draft.outcome}
          </p>
        </div>
        <div className="border-t border-[#1f2d2b]/20 pt-6">
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
            03 / 이슈 및 조치
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {draft.issueActions}
          </p>
        </div>
        <div className="border-t border-[#1f2d2b]/20 pt-6">
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
            04 / 후속 계획
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {draft.followUp}
          </p>
        </div>
      </section>
      {evidenceStops.length ? (
        <section className="mt-8 border-y border-[#1f2d2b]/20 py-5">
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
            Field evidence
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            현장 증빙 사진은{" "}
            {evidenceStops
              .map(stop => `${stop.name} ${stop.photos?.length ?? 0}장`)
              .join(" · ")}
            으로 기록되어 있습니다.
          </p>
        </section>
      ) : null}
      <footer className="mt-10 flex items-center justify-between border-t border-[#1f2d2b]/30 pt-4 text-[10px] tracking-[0.12em] text-stone-500">
        <p>여정도 · MUNICIPAL TRIP DESK</p>
        <p>
          초안 생성일시{" "}
          {new Intl.DateTimeFormat("ko-KR", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(draft.generatedAt))}
        </p>
      </footer>
    </div>
  );
}

function TripResultReportPdfWithEvidence({
  title,
  tripDate,
  managerName,
  department,
  draft,
  destinations,
  reportRef,
}: {
  title: string;
  tripDate: string;
  managerName: string;
  department: string;
  draft: TripResultReportDraft;
  destinations: Destination[];
  reportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const evidence = filterTripReportEvidence(
    orderTripReportEvidence(
      selectTripReportEvidence(destinations),
      draft.evidenceOrder
    ),
    draft.excludedEvidenceKeys
  );
  return (
    <div
      ref={reportRef}
      aria-hidden="true"
      data-trip-pdf-report
      data-trip-result-report
      className="pointer-events-none fixed left-[-10000px] top-0 w-[794px] overflow-hidden bg-[#f7f2e9] p-12 text-[#1f2d2b]"
    >
      <header className="border-b-2 border-[#1f2d2b] pb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="pdf-accent text-[11px] font-bold uppercase tracking-[0.32em] text-[#c4503d]">
              Municipal Trip Desk
            </p>
            <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.06em]">
              출장 결과 보고서
            </h1>
          </div>
          <div className="border-l border-[#1f2d2b]/30 pl-5 text-right text-xs leading-5 text-stone-600">
            <p>TRIP RESULT REPORT</p>
            <p>{tripDate || "일정 미정"}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-[1fr_auto] gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">
              출장명
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {title.trim() || "미저장 출장 계획"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">
              담당자 / 부서
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {managerName.trim() || "미입력"}
              {department.trim() ? ` · ${department.trim()}` : ""}
            </p>
          </div>
        </div>
      </header>
      <section className="mt-8 space-y-6">
        <div>
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
            01 / 출장 개요
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {draft.overview}
          </p>
        </div>
        <div className="border-t border-[#1f2d2b]/20 pt-6">
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
            02 / 수행 결과
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {draft.outcome}
          </p>
        </div>
        <div className="border-t border-[#1f2d2b]/20 pt-6">
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
            03 / 이슈 및 조치
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {draft.issueActions}
          </p>
        </div>
        <div className="border-t border-[#1f2d2b]/20 pt-6">
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
            04 / 후속 계획
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {draft.followUp}
          </p>
        </div>
      </section>
      {evidence.length ? (
        <section className="result-report-pdf-evidence mt-8 border-t border-[#1f2d2b]/20 pt-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="pdf-accent text-[10px] font-bold uppercase tracking-[.24em] text-[#c4503d]">
                05 / 현장 증빙 사진
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                목적지별 설명·촬영일·실행 상태를 기준으로 대표 증빙을 자동
                배치했습니다.
              </p>
            </div>
            <p className="font-display text-3xl text-[#1f2d2b]">
              {String(evidence.length).padStart(2, "0")}
              <span className="ml-1 text-xs">PHOTOS</span>
            </p>
          </div>
          <div className="result-report-pdf-evidence-grid mt-5">
            {evidence.map((photo, index) => (
              <figure
                key={photo.storageKey}
                className="result-report-pdf-evidence-item"
              >
                <div>
                  <img
                    data-trip-photo-key={photo.storageKey}
                    src={photo.dataUrl ?? photo.url}
                    alt={`${photo.destinationName} 현장 증빙`}
                  />
                </div>
                <figcaption>
                  <p>
                    PHOTO {String(index + 1).padStart(2, "0")} · STOP{" "}
                    {String(photo.sequence).padStart(2, "0")}
                  </p>
                  <h2>{photo.destinationName}</h2>
                  <small>
                    {photo.takenAt
                      ? `촬영일 · ${photo.takenAt}`
                      : "촬영일 미입력"}
                  </small>
                  <blockquote>
                    {photo.description?.trim() ||
                      "사진 설명이 입력되지 않았습니다."}
                  </blockquote>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
      <footer className="mt-10 flex items-center justify-between border-t border-[#1f2d2b]/30 pt-4 text-[10px] tracking-[0.12em] text-stone-500">
        <p>여정도 · MUNICIPAL TRIP DESK</p>
        <p>
          초안 생성일시{" "}
          {new Intl.DateTimeFormat("ko-KR", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(draft.generatedAt))}
        </p>
      </footer>
    </div>
  );
}

function PdfReport({
  title,
  tripDate,
  managerName,
  fixedStart,
  returnToStart,
  destinations,
  checklist,
  distanceKm,
  durationMinutes,
  routePoints,
  reportRef,
}: {
  title: string;
  tripDate: string;
  managerName: string;
  fixedStart: FixedStartLocation | null;
  returnToStart: boolean;
  destinations: Destination[];
  checklist: TripChecklist;
  distanceKm: number;
  durationMinutes: number;
  routePoints: RoutePoint[];
  reportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const polyline = routePoints.map(point => `${point.x},${point.y}`).join(" ");
  const generatedAt = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  const operationSummary = getTripOperationSummary(destinations);
  const visitSchedule = buildVisitSchedule(
    tripDate,
    durationMinutes,
    destinations.length
  );

  return (
    <div
      ref={reportRef}
      aria-hidden="true"
      data-trip-pdf-report
      className="pointer-events-none fixed left-[-10000px] top-0 w-[794px] overflow-hidden bg-[#f7f2e9] p-12 text-[#1f2d2b]"
    >
      <header className="border-b-2 border-[#1f2d2b] pb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="pdf-accent text-[11px] font-bold uppercase tracking-[0.32em] text-[#c4503d]">
              Municipal Trip Desk
            </p>
            <h1 className="mt-3 font-display text-5xl leading-none tracking-[-0.06em]">
              출장 경로 요약
            </h1>
          </div>
          <div className="border-l border-[#1f2d2b]/30 pl-5 text-right text-xs leading-5 text-stone-600">
            <p>TRIP ROUTE REPORT</p>
            <p>{tripDate || "일정 미정"}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-[1fr_auto] gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">
              출장명
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {title.trim() || "미저장 출장 계획"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">
              담당자
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {managerName.trim() || "미입력"}
            </p>
          </div>
        </div>
        {fixedStart ? (
          <div className="mt-5 border-l-2 border-[#c4503d] bg-[#eee7da] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8a5a50]">
              {returnToStart ? "고정 출발지 · 왕복 복귀" : "고정 출발지"}
            </p>
            <p className="mt-2 text-base font-semibold">{fixedStart.name}</p>
            <p className="mt-1 text-sm text-stone-600">{fixedStart.address}</p>
          </div>
        ) : null}
      </header>

      <section className="mt-8 grid grid-cols-3 gap-3">
        <div
          data-trip-pdf-card
          className="border border-[#1f2d2b]/20 bg-[#eee7da] p-5"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
            총 이동 거리
          </p>
          <p className="mt-5 font-display text-4xl tracking-[-0.04em]">
            {distanceKm.toFixed(1)}
            <span className="ml-1 text-lg">km</span>
          </p>
        </div>
        <div
          data-trip-pdf-card
          className="border border-[#1f2d2b]/20 bg-[#eee7da] p-5"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
            예상 소요 시간
          </p>
          <p className="mt-5 font-display text-4xl tracking-[-0.04em]">
            {durationMinutes}
            <span className="ml-1 text-lg">분</span>
          </p>
        </div>
        <div
          data-trip-pdf-card
          className="border border-[#1f2d2b]/20 bg-[#eee7da] p-5"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
            방문 목적지
          </p>
          <p className="mt-5 font-display text-4xl tracking-[-0.04em]">
            {destinations.length}
            <span className="ml-1 text-lg">곳</span>
          </p>
        </div>
      </section>

      <section
        className="mt-5 grid grid-cols-[1.1fr_1fr] gap-3"
        data-trip-pdf-operations
      >
        <div className="border border-[#1f2d2b]/20 bg-[#edf3ed] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-stone-500">
            Field execution
          </p>
          <p className="mt-3 font-display text-4xl tracking-[-.04em]">
            {operationSummary.completionRate}
            <span className="ml-1 text-lg">%</span>
          </p>
          <p className="mt-2 text-xs text-stone-600">
            완료 {operationSummary.completed} · 진행{" "}
            {operationSummary.in_progress} · 이슈 {operationSummary.issue}
          </p>
        </div>
        <div className="border border-[#1f2d2b]/20 bg-[#eee7da] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-stone-500">
            Operational checklist
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-stone-700">
            <li>{checklist.preDeparture ? "✓" : "○"} 출발 전 확인</li>
            <li>{checklist.onSite ? "✓" : "○"} 현장 도착 확인</li>
            <li>{checklist.wrapUp ? "✓" : "○"} 복귀·정리 확인</li>
          </ul>
        </div>
      </section>

      <section className="mt-8 border-y border-[#1f2d2b]/35 py-6">
        <div className="flex items-center justify-between">
          <p className="pdf-accent text-[10px] font-bold uppercase tracking-[0.28em] text-[#c4503d]">
            Route schematic
          </p>
          <p className="text-xs text-stone-500">
            방문 순서를 기준으로 한 경로 개요
          </p>
        </div>
        <svg
          data-trip-pdf-route
          className="mt-4 h-[300px] w-full border border-[#1f2d2b]/15 bg-[#f1eadc]"
          viewBox="0 0 720 330"
          role="img"
          aria-label="출장 방문 순서 경로도"
        >
          <path
            d="M0 65 H720 M0 165 H720 M0 265 H720"
            stroke="#1f2d2b"
            strokeOpacity="0.1"
            strokeWidth="1"
          />
          <path
            d="M120 0 V330 M360 0 V330 M600 0 V330"
            stroke="#1f2d2b"
            strokeOpacity="0.1"
            strokeWidth="1"
          />
          {routePoints.length > 1 && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#c4503d"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {routePoints.map((point, index) => (
            <g key={`${point.x}-${point.y}-${index}`}>
              <circle cx={point.x} cy={point.y} r="18" fill="#1f2d2b" />
              <text
                x={point.x}
                y={point.y + 6}
                textAnchor="middle"
                fill="#f7f2e9"
                fontSize="16"
                fontWeight="700"
              >
                {returnToStart && index === routePoints.length - 1
                  ? "↩"
                  : index + 1}
              </text>
            </g>
          ))}
        </svg>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between border-b border-[#1f2d2b] pb-3">
          <h2 className="font-display text-3xl tracking-[-0.04em]">
            방문 순서
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">
            Visit sequence
          </p>
        </div>
        <ol className="divide-y divide-[#1f2d2b]/15">
          {destinations.map((destination, index) => (
            <li
              key={destination.id}
              className="grid grid-cols-[42px_1fr] gap-4 py-4"
            >
              <span className="pdf-accent font-display text-2xl text-[#c4503d]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-semibold">{destination.name}</p>
                <p className="mt-1 text-sm text-stone-600">
                  {destination.address}
                </p>
                <p className="mt-2 text-xs font-semibold text-[#8a5a50]">
                  예상 도착 ·{" "}
                  {new Intl.DateTimeFormat("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(visitSchedule[index]?.arrival)}{" "}
                  · 상태{" "}
                  {executionStatusLabel(
                    destination.executionStatus ?? "planned"
                  )}
                </p>
                {destination.completedAt ? (
                  <p className="mt-1 text-xs text-[#2f6557]">
                    완료 시각 ·{" "}
                    {new Intl.DateTimeFormat("ko-KR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(destination.completedAt))}
                  </p>
                ) : null}
                {destination.issueNote ||
                destination.issueOwner ||
                destination.issueDueAt ? (
                  <div className="mt-2 border-l-2 border-[#c4503d] pl-3 text-xs leading-5 text-[#8a5a50]">
                    <p>이슈 · {destination.issueNote || "기록 미입력"}</p>
                    <p>
                      담당 · {destination.issueOwner || "미지정"}
                      {destination.issueDueAt
                        ? ` · 기한 ${destination.issueDueAt}`
                        : ""}
                      {destination.issueResolvedAt
                        ? ` · 해결 ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(destination.issueResolvedAt))}`
                        : ""}
                    </p>
                  </div>
                ) : null}
                {destination.note ? (
                  <div className="pdf-stop-note">
                    <StickyNote className="h-3.5 w-3.5" />
                    <span>{destination.note}</span>
                  </div>
                ) : null}
                {destination.photos?.length ? (
                  <div className="pdf-photo-grid">
                    {destination.photos.slice(0, 3).map(photo => (
                      <figure key={photo.storageKey}>
                        <img
                          data-trip-photo-key={photo.storageKey}
                          src={photo.dataUrl ?? photo.url}
                          alt={`${destination.name} 현장 사진`}
                        />
                        {photo.takenAt || photo.description ? (
                          <figcaption>
                            {photo.takenAt ? `${photo.takenAt} · ` : ""}
                            {photo.description ?? ""}
                          </figcaption>
                        ) : null}
                      </figure>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-10 flex items-center justify-between border-t border-[#1f2d2b]/30 pt-4 text-[10px] tracking-[0.12em] text-stone-500">
        <p>여정도 · MUNICIPAL TRIP DESK</p>
        <p>생성일시 {generatedAt}</p>
      </footer>
    </div>
  );
}

function AddressWorkMode({
  destinations,
  fixedStart,
  onMove,
  onRemove,
  onRestoreMap,
}: {
  destinations: Destination[];
  fixedStart: FixedStartLocation | null;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onRestoreMap: () => void;
}) {
  return (
    <section className="address-workspace order-1 min-w-0 min-h-[520px] border border-[#1f2d2b]/15 xl:order-2">
      <header className="flex flex-col items-start gap-4 border-b border-[#1f2d2b]/15 px-5 py-5 2xl:flex-row 2xl:justify-between 2xl:gap-5">
        <div>
          <p className="section-label text-[#c4503d]">Address work mode</p>
          <h2 className="font-display mt-2 break-keep text-2xl leading-tight tracking-[-.035em] sm:text-3xl">
            주소 목록으로 계속
          </h2>
          <p className="mt-2 max-w-md break-keep text-sm leading-6 text-stone-600">
            지도 연결을 기다리지 않아도 주소 검색, 방문 순서 조정, 동선 최적화와
            PDF 생성은 계속 사용할 수 있습니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRestoreMap}
          className="route-action-tertiary shrink-0 px-3"
        >
          <RefreshCcw className="mr-2 h-3.5 w-3.5" /> 지도 재연결
        </Button>
      </header>
      <div className="p-6">
        {fixedStart ? (
          <div className="fixed-start-list-summary">
            <MapPin className="h-4 w-4" />
            <div>
              <p>고정 출발지 · {fixedStart.name}</p>
              <small>{fixedStart.address}</small>
            </div>
          </div>
        ) : null}
        {destinations.length ? (
          <ol className="divide-y divide-[#1f2d2b]/12 border-y border-[#1f2d2b]/15">
            {destinations.map((destination, index) => (
              <li
                key={destination.id}
                className="grid grid-cols-[42px_minmax(0,1fr)_auto] gap-4 py-4"
              >
                <span className="font-display text-2xl text-[#c4503d]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {destination.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-stone-500">
                    {destination.address}
                  </p>
                  {destination.note ? (
                    <p className="address-work-note">
                      <StickyNote className="h-3 w-3" />
                      {destination.note}
                    </p>
                  ) : null}
                  {destination.photos?.length ? (
                    <p className="address-work-note">
                      <Images className="h-3 w-3" />
                      현장 사진 {destination.photos.length}장
                    </p>
                  ) : null}
                  <p className="mt-2 text-[10px] font-semibold tracking-[.08em] text-stone-400">
                    {destination.latitude.toFixed(5)},{" "}
                    {destination.longitude.toFixed(5)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                    className="icon-button"
                    aria-label={`${destination.name} 위로 이동`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={index === destinations.length - 1}
                    className="icon-button"
                    aria-label={`${destination.name} 아래로 이동`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(destination.id)}
                    className="icon-button hover:text-[#c4503d]"
                    aria-label={`${destination.name} 삭제`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="grid min-h-[260px] place-items-center border border-dashed border-[#1f2d2b]/18 bg-[#fffdf7]/50 p-8 text-center">
            <div>
              <ListTree className="mx-auto h-6 w-6 text-[#c4503d]" />
              <p className="mt-4 font-display text-2xl">주소를 추가해 주세요</p>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                좌측의 주소 검색에서 목적지를 추가하면 이 목록에서 방문 순서를
                관리할 수 있습니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const previewParams = new URLSearchParams(window.location.search);
  const isDesignPreview =
    import.meta.env.DEV &&
    (previewParams.get("design-preview") === "complete" ||
      previewParams.get("fixed-start-preview") === "complete" ||
      previewParams.get("round-trip-preview") === "complete");
  const isFixedStartPreview =
    import.meta.env.DEV &&
    previewParams.get("fixed-start-preview") === "complete";
  const isRoundTripPreview =
    import.meta.env.DEV &&
    previewParams.get("round-trip-preview") === "complete";
  const [title, setTitle] = useState(() =>
    isDesignPreview ? "현장 운영 고도화 검증" : ""
  );
  const [tripDate, setTripDate] = useState(today);
  const [managerName, setManagerName] = useState(() =>
    isDesignPreview ? "검증 담당" : ""
  );
  const [department, setDepartment] = useState("");
  const [archiveQuery, setArchiveQuery] = useState("");
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaboratorPermission, setCollaboratorPermission] = useState<
    "viewer" | "editor"
  >("viewer");
  const [fixedStartQuery, setFixedStartQuery] = useState("");
  const [fixedStart, setFixedStart] = useState<FixedStartLocation | null>(() =>
    isFixedStartPreview || isRoundTripPreview ? fixedStartPreview : null
  );
  const [returnToStart, setReturnToStart] = useState(() => isRoundTripPreview);
  const [optimizationStrategy, setOptimizationStrategy] =
    useState<OptimizationStrategy>("quality");
  const [addressQuery, setAddressQuery] = useState("");
  const [destinations, setDestinations] = useState<Destination[]>(() =>
    isDesignPreview ? designPreviewStops : []
  );
  const [checklist, setChecklist] =
    useState<TripChecklist>(EMPTY_TRIP_CHECKLIST);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [fieldRecordPdfGenerating, setFieldRecordPdfGenerating] =
    useState(false);
  const [fieldRecordFilter, setFieldRecordFilter] = useState<FieldRecordFilter>(
    { takenAt: "", destinationId: "", descriptionQuery: "" }
  );
  const [recentFieldRecordSearches, setRecentFieldRecordSearches] = useState<
    string[]
  >(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(RECENT_FIELD_RECORD_SEARCHES_KEY) ?? "[]"
      );
      return Array.isArray(parsed) &&
        parsed.every(value => typeof value === "string")
        ? parsed
        : [];
    } catch {
      return [];
    }
  });
  const [recentSearchesOpen, setRecentSearchesOpen] = useState(false);
  const [selectedFieldRecordKeys, setSelectedFieldRecordKeys] = useState<
    string[]
  >([]);
  const [activeWorkspace, setActiveWorkspace] = useState<
    "planner" | "records" | "operations" | "report"
  >(() =>
    previewParams.get("workspace") === "records"
      ? "records"
      : previewParams.get("workspace") === "operations"
        ? "operations"
        : previewParams.get("workspace") === "report"
          ? "report"
          : "planner"
  );
  const [activePhoto, setActivePhoto] = useState<FieldRecord | null>(null);
  const [resultReportDraft, setResultReportDraft] =
    useState<TripResultReportDraft | null>(null);
  const [draggedEvidenceKey, setDraggedEvidenceKey] = useState<string | null>(
    null
  );
  const [resultReportPdfGenerating, setResultReportPdfGenerating] =
    useState(false);
  const [resultReportHwpxGenerating, setResultReportHwpxGenerating] =
    useState(false);
  const [newPlanConfirmOpen, setNewPlanConfirmOpen] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [availableDraft, setAvailableDraft] =
    useState<TripDraftEnvelope | null>(null);
  const [draftRestoreOpen, setDraftRestoreOpen] = useState(false);
  const [draftStatus, setDraftStatus] =
    useState<TripDraftPersistenceState>("idle");
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<number | null>(null);
  const [workMode, setWorkMode] = useState<"map" | "list">(() =>
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("work-mode-test") === "list"
      ? "list"
      : "map"
  );
  const [mapRetryRequestId, setMapRetryRequestId] = useState(0);
  const [csvImporting, setCsvImporting] = useState(false);
  const [calendarDownloading, setCalendarDownloading] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchTemplateId, setBatchTemplateId] = useState<number | null>(null);
  const [batchDatesText, setBatchDatesText] = useState("");
  const [batchTitlePrefix, setBatchTitlePrefix] = useState("");
  const [batchManagerName, setBatchManagerName] = useState("");
  const [batchDepartment, setBatchDepartment] = useState("");
  const reportRef = useRef<HTMLDivElement | null>(null);
  const fieldRecordPdfRef = useRef<HTMLDivElement | null>(null);
  const csvImportInputRef = useRef<HTMLInputElement | null>(null);
  const resultReportPdfRef = useRef<HTMLDivElement | null>(null);
  const draftBaselineRef = useRef<string | null>(null);
  const pendingAccountDraftRef = useRef<string | null>(null);
  const utils = trpc.useUtils();
  const plans = trpc.trip.list.useQuery();
  const analytics = trpc.trip.analytics.useQuery();
  const accountDraft = trpc.trip.draft.get.useQuery();
  const selectedPlan = trpc.trip.get.useQuery(
    { id: selectedPlanId ?? 0 },
    { enabled: selectedPlanId !== null }
  );
  const collaborators = trpc.trip.collaborators.list.useQuery(
    { tripId: selectedPlanId ?? 0 },
    {
      enabled: selectedPlanId !== null && selectedPlan.data?.access === "owner",
    }
  );
  const addressSearch = trpc.trip.searchAddress.useQuery(
    { query: addressQuery.trim() },
    { enabled: addressQuery.trim().length >= 2 }
  );
  const fixedStartSearch = trpc.trip.searchAddress.useQuery(
    { query: fixedStartQuery.trim() },
    { enabled: fixedStartQuery.trim().length >= 2 }
  );
  const reverseGeocode = trpc.trip.reverseGeocode.useMutation();
  const routeSummary = useMemo(
    () =>
      optimizeRouteFromFixedStart(
        fixedStart,
        destinations.map(destination => ({
          id: destination.id,
          latitude: destination.latitude,
          longitude: destination.longitude,
        })),
        returnToStart,
        { strategy: optimizationStrategy }
      ),
    [destinations, fixedStart, optimizationStrategy, returnToStart]
  );
  const operationSummary = useMemo(
    () => getTripOperationSummary(destinations),
    [destinations]
  );
  const issueSummary = useMemo(
    () => getTripIssueSummary(destinations),
    [destinations]
  );
  const selectedAccess =
    selectedPlan.data?.access ??
    (selectedPlanId === null ? "owner" : undefined);
  const canOperatePlan = selectedAccess !== "viewer";
  const canManageCollaboration = selectedAccess === "owner";
  const resultReportPreview = useMemo(
    () =>
      createTripResultReportDraft({
        title,
        tripDate,
        managerName,
        department,
        fixedStart,
        returnToStart,
        routeDistanceKm: routeSummary.totalDistanceKm,
        routeDurationMinutes: routeSummary.estimatedMinutes,
        checklist,
        destinations,
      }),
    [
      checklist,
      department,
      destinations,
      fixedStart,
      managerName,
      returnToStart,
      routeSummary.estimatedMinutes,
      routeSummary.totalDistanceKm,
      title,
      tripDate,
    ]
  );
  const resultReportEvidence = useMemo(
    () =>
      orderTripReportEvidence(
        selectTripReportEvidence(destinations),
        resultReportDraft?.evidenceOrder
      ),
    [destinations, resultReportDraft?.evidenceOrder]
  );
  const includedResultReportEvidence = useMemo(
    () =>
      filterTripReportEvidence(
        resultReportEvidence,
        resultReportDraft?.excludedEvidenceKeys
      ),
    [resultReportEvidence, resultReportDraft?.excludedEvidenceKeys]
  );
  const templatePlans = useMemo(
    () => (plans.data ?? []).filter(plan => plan.isTemplate),
    [plans.data]
  );
  const selectedBatchTemplate = useMemo(
    () => templatePlans.find(plan => plan.id === batchTemplateId) ?? null,
    [batchTemplateId, templatePlans]
  );
  const batchDatePreview = useMemo(
    () => parseBatchDates(batchDatesText),
    [batchDatesText]
  );
  const filteredPlans = useMemo(() => {
    const query = archiveQuery.trim().toLocaleLowerCase("ko-KR");
    if (!query) return plans.data ?? [];
    return (plans.data ?? []).filter(plan =>
      [
        plan.title,
        plan.managerName,
        plan.department ?? "",
        toIsoDate(plan.tripDate),
      ].some(value => value.toLocaleLowerCase("ko-KR").includes(query))
    );
  }, [archiveQuery, plans.data]);
  const visitSchedule = useMemo(
    () =>
      buildVisitSchedule(
        tripDate,
        routeSummary.estimatedMinutes,
        destinations.length
      ),
    [destinations.length, routeSummary.estimatedMinutes, tripDate]
  );
  const pdfRoutePoints = useMemo(
    () =>
      makeRoutePoints(
        fixedStart
          ? [
              fixedStart,
              ...destinations,
              ...(returnToStart ? [fixedStart] : []),
            ]
          : destinations
      ),
    [destinations, fixedStart, returnToStart]
  );
  const tripReadiness = useMemo(
    () => getTripReadiness(title, managerName, destinations.length),
    [destinations.length, managerName, title]
  );
  const fieldRecords = useMemo(
    () =>
      destinations
        .flatMap((destination, index) =>
          (destination.photos ?? []).map(photo => ({
            ...photo,
            destinationId: destination.id,
            destinationName: destination.name,
            destinationAddress: destination.address,
            sequence: index + 1,
          }))
        )
        .sort((a, b) => (b.takenAt ?? "").localeCompare(a.takenAt ?? "")),
    [destinations]
  );
  const filteredFieldRecords = useMemo(
    () => filterFieldRecords(fieldRecords, fieldRecordFilter),
    [fieldRecords, fieldRecordFilter]
  );
  const selectedFieldRecords = useMemo(
    () =>
      getSelectedFieldRecords(filteredFieldRecords, selectedFieldRecordKeys),
    [filteredFieldRecords, selectedFieldRecordKeys]
  );
  const visibleSelectedFieldRecordKeys = useMemo(
    () => selectedFieldRecords.map(record => record.storageKey),
    [selectedFieldRecords]
  );
  const currentDraftPayload = useMemo<TripDraftPayload>(
    () => ({
      title,
      tripDate,
      managerName,
      department,
      fixedStart: fixedStart
        ? {
            id: fixedStart.id,
            name: fixedStart.name,
            address: fixedStart.address,
            latitude: fixedStart.latitude,
            longitude: fixedStart.longitude,
          }
        : null,
      returnToStart,
      checklist,
      destinations: destinations.map(destination => ({
        id: destination.id,
        name: destination.name,
        address: destination.address,
        latitude: destination.latitude,
        longitude: destination.longitude,
        note: destination.note,
        photos: (destination.photos ?? []).map(
          ({ storageKey, url, fileName, takenAt, description }) => ({
            storageKey,
            url,
            fileName,
            takenAt,
            description,
          })
        ),
        executionStatus: destination.executionStatus ?? "planned",
        completedAt: destination.completedAt,
        issueNote: destination.issueNote,
        issueOwner: destination.issueOwner,
        issueDueAt: destination.issueDueAt,
        issueResolvedAt: destination.issueResolvedAt,
      })),
      fieldRecordFilter: {
        takenAt: fieldRecordFilter.takenAt,
        destinationId: fieldRecordFilter.destinationId,
        descriptionQuery: fieldRecordFilter.descriptionQuery ?? "",
      },
      selectedFieldRecordKeys,
      activeWorkspace,
      workMode,
    }),
    [
      activeWorkspace,
      checklist,
      department,
      destinations,
      fieldRecordFilter,
      fixedStart,
      managerName,
      returnToStart,
      selectedFieldRecordKeys,
      title,
      tripDate,
      workMode,
    ]
  );
  const currentDraftFingerprint = useMemo(
    () => tripDraftFingerprint(currentDraftPayload),
    [currentDraftPayload]
  );
  const draftStatusCopy = getTripDraftStatusCopy(draftStatus);
  const draftSave = trpc.trip.draft.save.useMutation();
  const draftClear = trpc.trip.draft.clear.useMutation({
    onSuccess: () => {
      void utils.trip.draft.get.invalidate();
    },
  });

  const applyTripDraft = useCallback((draft: TripDraftEnvelope) => {
    const payload = draft.payload;
    setTitle(payload.title);
    setTripDate(payload.tripDate || today);
    setManagerName(payload.managerName);
    setDepartment(payload.department);
    setFixedStart(payload.fixedStart);
    setFixedStartQuery("");
    setReturnToStart(payload.returnToStart);
    setChecklist(payload.checklist);
    setDestinations(payload.destinations);
    setAddressQuery("");
    setSelectedPlanId(null);
    setFieldRecordFilter(payload.fieldRecordFilter);
    setSelectedFieldRecordKeys(payload.selectedFieldRecordKeys);
    setActiveWorkspace(payload.activeWorkspace);
    setWorkMode(payload.workMode);
    setDraftUpdatedAt(draft.updatedAt);
    setDraftStatus("saved");
    draftBaselineRef.current = tripDraftFingerprint(payload);
    pendingAccountDraftRef.current = null;
  }, []);

  const clearStoredTripDraft = useCallback(() => {
    pendingAccountDraftRef.current = null;
    draftBaselineRef.current = currentDraftFingerprint;
    try {
      window.localStorage.removeItem(TRIP_DRAFT_STORAGE_KEY);
    } catch {
      /* storage can be unavailable */
    }
    if (!isDesignPreview) draftClear.mutate();
    setAvailableDraft(null);
    setDraftRestoreOpen(false);
    setDraftUpdatedAt(null);
    setDraftStatus("idle");
  }, [currentDraftFingerprint, draftClear, isDesignPreview]);

  const restoreAvailableTripDraft = () => {
    if (!availableDraft) return;
    applyTripDraft(availableDraft);
    setAvailableDraft(null);
    setDraftRestoreOpen(false);
    toast.success("마지막 임시 초안을 복원했습니다.");
  };

  const syncAccountDraft = useCallback(() => {
    const pending = pendingAccountDraftRef.current;
    if (!pending || !navigator.onLine || draftSave.isPending || isDesignPreview)
      return;
    setDraftStatus("syncing");
    draftSave.mutate(
      { payload: pending },
      {
        onSuccess: () => {
          const outcome = resolveTripDraftAccountSync(pending, true);
          if (pendingAccountDraftRef.current === pending)
            pendingAccountDraftRef.current = outcome.pendingPayload;
          setDraftStatus(outcome.status);
          void utils.trip.draft.get.invalidate();
        },
        onError: () => {
          const outcome = resolveTripDraftAccountSync(pending, false);
          if (pendingAccountDraftRef.current === pending)
            pendingAccountDraftRef.current = outcome.pendingPayload;
          setDraftStatus(outcome.status);
        },
      }
    );
  }, [draftSave, isDesignPreview, utils.trip.draft]);

  useEffect(() => {
    if (!selectedPlan.data) return;
    setTitle(selectedPlan.data.title);
    setTripDate(toIsoDate(selectedPlan.data.tripDate));
    setManagerName(selectedPlan.data.managerName);
    setDepartment(selectedPlan.data.department ?? "");
    setDestinations(
      selectedPlan.data.stops.map(stop => ({
        id: String(stop.id),
        name: stop.name,
        address: stop.address,
        latitude: asNumber(stop.latitude),
        longitude: asNumber(stop.longitude),
        note: stop.note ?? "",
        executionStatus: stop.executionStatus,
        completedAt: stop.completedAt
          ? new Date(stop.completedAt).toISOString()
          : undefined,
        issueNote: stop.issueNote ?? undefined,
        issueOwner: stop.issueOwner ?? undefined,
        issueDueAt: stop.issueDueAt ? toIsoDate(stop.issueDueAt) : undefined,
        issueResolvedAt: stop.issueResolvedAt
          ? new Date(stop.issueResolvedAt).toISOString()
          : undefined,
        photos:
          stop.photos?.map(photo => ({
            storageKey: photo.storageKey,
            url: photo.url,
            fileName: photo.fileName,
            takenAt: photo.takenAt ? toIsoDate(photo.takenAt) : undefined,
            description: photo.description ?? undefined,
          })) ?? [],
      }))
    );
    if (
      selectedPlan.data.fixedStartName &&
      selectedPlan.data.fixedStartAddress &&
      selectedPlan.data.fixedStartLatitude !== null &&
      selectedPlan.data.fixedStartLongitude !== null
    ) {
      setFixedStart({
        id: `saved-start-${selectedPlan.data.id}`,
        name: selectedPlan.data.fixedStartName,
        address: selectedPlan.data.fixedStartAddress,
        latitude: asNumber(selectedPlan.data.fixedStartLatitude),
        longitude: asNumber(selectedPlan.data.fixedStartLongitude),
      });
    } else setFixedStart(null);
    setReturnToStart(Boolean(selectedPlan.data.returnToStart));
    setChecklist({
      preDeparture: Boolean(selectedPlan.data.preDepartureChecked),
      onSite: Boolean(selectedPlan.data.onSiteChecked),
      wrapUp: Boolean(selectedPlan.data.wrapUpChecked),
    });
    setResultReportDraft(
      parseTripResultReportDraft(selectedPlan.data.reportDraft)
    );
  }, [selectedPlan.data]);

  useEffect(() => {
    const validKeys = new Set(fieldRecords.map(record => record.storageKey));
    setSelectedFieldRecordKeys(previous =>
      previous.filter(key => validKeys.has(key))
    );
  }, [fieldRecords]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        RECENT_FIELD_RECORD_SEARCHES_KEY,
        JSON.stringify(recentFieldRecordSearches)
      );
    } catch {
      /* storage can be unavailable */
    }
  }, [recentFieldRecordSearches]);

  useEffect(() => {
    if (draftReady) return;
    if (isDesignPreview) {
      setDraftReady(true);
      return;
    }
    if (accountDraft.isLoading) return;
    let localDraft: TripDraftEnvelope | null = null;
    try {
      localDraft = parseTripDraft(
        window.localStorage.getItem(TRIP_DRAFT_STORAGE_KEY)
      );
    } catch {
      /* storage can be unavailable */
    }
    const accountVersion = parseTripDraft(accountDraft.data?.payload);
    const latest = pickLatestTripDraft(localDraft, accountVersion);
    if (latest && hasTripDraftContent(latest.payload)) {
      setAvailableDraft(latest);
      setDraftRestoreOpen(true);
      setDraftUpdatedAt(latest.updatedAt);
      draftBaselineRef.current = tripDraftFingerprint(latest.payload);
    }
    setDraftReady(true);
  }, [
    accountDraft.data?.payload,
    accountDraft.isLoading,
    draftReady,
    isDesignPreview,
  ]);

  useEffect(() => {
    if (
      !draftReady ||
      isDesignPreview ||
      selectedPlanId !== null ||
      !hasTripDraftContent(currentDraftPayload) ||
      draftBaselineRef.current === currentDraftFingerprint
    )
      return;
    const envelope = createTripDraftEnvelope(currentDraftPayload);
    const serialized = JSON.stringify(envelope);
    const timer = scheduleTripDraftInputSave(() => {
      try {
        window.localStorage.setItem(TRIP_DRAFT_STORAGE_KEY, serialized);
      } catch {
        /* storage can be unavailable */
      }
      pendingAccountDraftRef.current = serialized;
      setDraftUpdatedAt(envelope.updatedAt);
      setDraftStatus(navigator.onLine ? "local" : "offline");
      syncAccountDraft();
    });
    return () => window.clearTimeout(timer);
  }, [
    currentDraftFingerprint,
    currentDraftPayload,
    draftReady,
    isDesignPreview,
    selectedPlanId,
    syncAccountDraft,
  ]);

  useEffect(() => {
    if (!draftReady || isDesignPreview) return;
    const stopAccountSync = startTripDraftAccountSync(syncAccountDraft);
    window.addEventListener("online", syncAccountDraft);
    return () => {
      stopAccountSync();
      window.removeEventListener("online", syncAccountDraft);
    };
  }, [draftReady, isDesignPreview, syncAccountDraft]);

  useEffect(() => {
    if (!draftReady || isDesignPreview) return;
    const persistOnExit = () => {
      if (
        selectedPlanId !== null ||
        !hasTripDraftContent(currentDraftPayload) ||
        draftBaselineRef.current === currentDraftFingerprint
      )
        return;
      try {
        window.localStorage.setItem(
          TRIP_DRAFT_STORAGE_KEY,
          JSON.stringify(createTripDraftEnvelope(currentDraftPayload))
        );
      } catch {
        /* storage can be unavailable */
      }
    };
    window.addEventListener("pagehide", persistOnExit);
    return () => window.removeEventListener("pagehide", persistOnExit);
  }, [
    currentDraftFingerprint,
    currentDraftPayload,
    draftReady,
    isDesignPreview,
    selectedPlanId,
  ]);

  const updateDestinations = useCallback((next: Destination[]) => {
    setDestinations(next);
    setSelectedPlanId(null);
  }, []);
  const addDestination = useCallback(
    (destination: Omit<Destination, "id">) => {
      if (
        destinations.some(
          item =>
            Math.abs(item.latitude - destination.latitude) < 0.00001 &&
            Math.abs(item.longitude - destination.longitude) < 0.00001
        )
      ) {
        return toast.info("이미 포함된 목적지입니다.");
      }
      updateDestinations([
        ...destinations,
        { ...destination, id: crypto.randomUUID() },
      ]);
      setAddressQuery("");
    },
    [destinations, updateDestinations]
  );
  const setFixedStartFromSearch = (
    location: Omit<FixedStartLocation, "id"> & { id?: string }
  ) => {
    setFixedStart({
      ...location,
      id: `fixed-start-${location.id ?? `${location.latitude}-${location.longitude}`}`,
    });
    setFixedStartQuery("");
    setSelectedPlanId(null);
  };
  const onMapClick = useCallback(
    async ({
      latitude,
      longitude,
    }: {
      latitude: number;
      longitude: number;
    }) => {
      try {
        const result = await reverseGeocode.mutateAsync({
          latitude,
          longitude,
        });
        addDestination({
          name: "지도 선택 목적지",
          address: result.address,
          latitude,
          longitude,
        });
      } catch {
        addDestination({
          name: "지도 선택 목적지",
          address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          latitude,
          longitude,
        });
        toast.info("주소 해석에 실패해 좌표로 목적지를 추가했습니다.");
      }
    },
    [addDestination, reverseGeocode]
  );
  const optimize = () => {
    const order = new Map(
      routeSummary.orderedStopIds.map((id, index) => [id, index])
    );
    updateDestinations(
      [...destinations].sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
      )
    );
    toast.success(
      "Nearest Neighbor + 2-opt 방식으로 방문 순서를 정렬했습니다."
    );
  };
  const moveDestination = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= destinations.length) return;
    const next = [...destinations];
    [next[index], next[target]] = [next[target], next[index]];
    updateDestinations(next);
  };
  const updateDestinationNote = (id: string, note: string) => {
    updateDestinations(
      destinations.map(destination =>
        destination.id === id ? { ...destination, note } : destination
      )
    );
  };
  const updatePhotoMetadata = (
    destinationId: string,
    storageKey: string,
    patch: Pick<DestinationPhoto, "takenAt" | "description">
  ) => {
    updateDestinations(
      destinations.map(destination =>
        destination.id === destinationId
          ? {
              ...destination,
              photos: (destination.photos ?? []).map(photo =>
                photo.storageKey === storageKey ? { ...photo, ...patch } : photo
              ),
            }
          : destination
      )
    );
  };
  const updateFieldRecordFilter = (patch: Partial<FieldRecordFilter>) => {
    setFieldRecordFilter(previous => ({ ...previous, ...patch }));
    setSelectedPlanId(null);
  };
  const saveCurrentFieldRecordSearch = () => {
    const query = fieldRecordFilter.descriptionQuery ?? "";
    if (query.trim())
      setRecentFieldRecordSearches(previous =>
        addRecentSearch(previous, query)
      );
    setRecentSearchesOpen(false);
  };
  const applyRecentFieldRecordSearch = (query: string) => {
    updateFieldRecordFilter({ descriptionQuery: query });
    setRecentFieldRecordSearches(previous => addRecentSearch(previous, query));
    setRecentSearchesOpen(false);
  };
  const removeFieldRecordSearch = (query: string) =>
    setRecentFieldRecordSearches(previous =>
      removeRecentSearch(previous, query)
    );
  const toggleFieldRecordSelection = (storageKey: string) => {
    setSelectedFieldRecordKeys(previous =>
      toggleRecordSelection(previous, storageKey)
    );
    setSelectedPlanId(null);
  };
  const toggleVisibleFieldRecordSelection = () => {
    const visibleKeys = filteredFieldRecords.map(record => record.storageKey);
    if (!visibleKeys.length) return;
    setSelectedFieldRecordKeys(previous =>
      visibleKeys.every(key => previous.includes(key))
        ? previous.filter(key => !visibleKeys.includes(key))
        : Array.from(new Set([...previous, ...visibleKeys]))
    );
    setSelectedPlanId(null);
  };
  const startNewPlan = () => {
    const draft = createNewTripDraft(today);
    setTitle(draft.title);
    setTripDate(draft.tripDate);
    setManagerName(draft.managerName);
    setDepartment("");
    setFixedStartQuery(draft.fixedStartQuery);
    setAddressQuery(draft.addressQuery);
    setFixedStart(null);
    setReturnToStart(draft.returnToStart);
    setChecklist(EMPTY_TRIP_CHECKLIST);
    setDestinations([]);
    setResultReportDraft(null);
    setSelectedPlanId(draft.selectedPlanId);
    setFieldRecordFilter(draft.fieldRecordFilter);
    setSelectedFieldRecordKeys([]);
    setRecentSearchesOpen(false);
    setActivePhoto(null);
    setActiveWorkspace("planner");
    setWorkMode("map");
    setNewPlanConfirmOpen(false);
    clearStoredTripDraft();
    toast.success("새 출장 계획을 시작합니다. 저장한 계획은 유지됩니다.");
  };
  const requestNewPlan = () => {
    if (
      hasNewTripContent({
        title,
        managerName,
        destinationCount: destinations.length,
        hasFixedStart: Boolean(fixedStart),
        selectedPlanId,
      })
    ) {
      setNewPlanConfirmOpen(true);
      return;
    }
    startNewPlan();
  };
  const uploadPhoto = trpc.trip.uploadPhoto.useMutation();
  const addDestinationPhotos = async (id: string, files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    const destination = destinations.find(item => item.id === id);
    const remaining = Math.max(0, 3 - (destination?.photos?.length ?? 0));
    if (!remaining)
      return toast.info("목적지별 사진은 최대 3장까지 첨부할 수 있습니다.");
    const targets = selectedFiles.slice(0, remaining);
    try {
      const uploaded = await Promise.all(
        targets.map(async file => {
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
            throw new Error("JPG, PNG, WEBP 파일만 첨부할 수 있습니다.");
          if (file.size > 5 * 1024 * 1024)
            throw new Error("사진은 5MB 이하로 첨부해 주세요.");
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve(String(reader.result).split(",")[1] ?? "");
            reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
            reader.readAsDataURL(file);
          });
          const uploaded = await uploadPhoto.mutateAsync({
            fileName: file.name,
            mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
            contentBase64: base64,
          });
          return {
            ...uploaded,
            takenAt: today,
            dataUrl: makeTripPhotoDataUrl(file.type, base64),
          };
        })
      );
      updateDestinations(
        destinations.map(item =>
          item.id === id
            ? { ...item, photos: [...(item.photos ?? []), ...uploaded] }
            : item
        )
      );
      toast.success(`${uploaded.length}장의 현장 사진을 첨부했습니다.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "사진 첨부에 실패했습니다."
      );
    }
  };
  const restoreMap = () => {
    setWorkMode("map");
    setMapRetryRequestId(value => value + 1);
  };
  const createTrip = trpc.trip.create.useMutation({
    onSuccess: trip => {
      utils.trip.list.invalidate();
      setSelectedPlanId(trip.id);
      clearStoredTripDraft();
      toast.success("출장 계획을 저장했습니다.");
    },
    onError: error => toast.error(error.message),
  });
  const removeTrip = trpc.trip.remove.useMutation({
    onSuccess: () => {
      utils.trip.list.invalidate();
      setSelectedPlanId(null);
      toast.success("출장 계획을 삭제했습니다.");
    },
    onError: error => toast.error(error.message),
  });
  const toggleTripTemplate = trpc.trip.template.toggle.useMutation({
    onSuccess: result => {
      void utils.trip.list.invalidate();
      toast.success(
        result.isTemplate
          ? "반복 출장 템플릿으로 지정했습니다."
          : "반복 출장 템플릿 지정을 해제했습니다."
      );
    },
    onError: error => toast.error(error.message),
  });
  const createBatchTrips = trpc.trip.template.createBatch.useMutation({
    onSuccess: result => {
      void utils.trip.list.invalidate();
      setBatchDialogOpen(false);
      setBatchTemplateId(null);
      toast.success(
        `${result.trips.length}개의 반복 출장 계획을 생성했습니다.`
      );
    },
    onError: error => toast.error(error.message),
  });
  const updateStopExecution = trpc.trip.updateStopExecution.useMutation({
    onSuccess: () => {
      if (selectedPlanId !== null)
        void utils.trip.get.invalidate({ id: selectedPlanId });
    },
    onError: error => toast.error(error.message),
  });
  const updateChecklist = trpc.trip.updateChecklist.useMutation({
    onSuccess: () => {
      if (selectedPlanId !== null)
        void utils.trip.get.invalidate({ id: selectedPlanId });
    },
    onError: error => toast.error(error.message),
  });
  const updateReportDraft = trpc.trip.updateReportDraft.useMutation({
    onSuccess: () => {
      if (selectedPlanId !== null)
        void utils.trip.get.invalidate({ id: selectedPlanId });
      toast.success("결과 보고서 초안을 저장했습니다.");
    },
    onError: error => toast.error(error.message),
  });
  const updateDepartment = trpc.trip.updateDepartment.useMutation({
    onSuccess: () => {
      if (selectedPlanId !== null)
        void utils.trip.get.invalidate({ id: selectedPlanId });
    },
    onError: error => toast.error(error.message),
  });
  const inviteCollaborator = trpc.trip.collaborators.invite.useMutation({
    onSuccess: () => {
      if (selectedPlanId !== null)
        void utils.trip.collaborators.list.invalidate({
          tripId: selectedPlanId,
        });
      setCollaboratorEmail("");
      toast.success("협업자를 추가했습니다.");
    },
    onError: error => toast.error(error.message),
  });
  const removeCollaborator = trpc.trip.collaborators.remove.useMutation({
    onSuccess: () => {
      if (selectedPlanId !== null)
        void utils.trip.collaborators.list.invalidate({
          tripId: selectedPlanId,
        });
      toast.success("협업자 권한을 해제했습니다.");
    },
    onError: error => toast.error(error.message),
  });
  const setChecklistItem = (key: keyof TripChecklist, value: boolean) => {
    if (!canOperatePlan) return toast.error("이 계획은 열람 전용입니다.");
    const next = { ...checklist, [key]: value };
    setChecklist(next);
    if (selectedPlanId !== null)
      updateChecklist.mutate({ tripId: selectedPlanId, checklist: next });
  };
  const setDestinationExecution = (
    destinationId: string,
    executionStatus: ExecutionStatus,
    issueNote?: string,
    issuePatch: Partial<
      Pick<Destination, "issueOwner" | "issueDueAt" | "issueResolvedAt">
    > = {}
  ) => {
    if (!canOperatePlan) {
      toast.error("이 계획은 열람 전용입니다.");
      return;
    }
    const current = destinations.find(
      destination => destination.id === destinationId
    );
    if (!current) return;
    const completedAt =
      executionStatus === "completed"
        ? (current.completedAt ?? new Date().toISOString())
        : undefined;
    const nextIssueNote =
      executionStatus === "issue"
        ? (issueNote ?? current.issueNote ?? "")
        : current.issueNote;
    const issueResolvedAt =
      executionStatus === "issue"
        ? (issuePatch.issueResolvedAt ?? current.issueResolvedAt)
        : current.executionStatus === "issue"
          ? (current.issueResolvedAt ?? new Date().toISOString())
          : current.issueResolvedAt;
    const next = {
      ...current,
      executionStatus,
      completedAt,
      issueNote: nextIssueNote,
      issueOwner: issuePatch.issueOwner ?? current.issueOwner,
      issueDueAt: issuePatch.issueDueAt ?? current.issueDueAt,
      issueResolvedAt,
    };
    setDestinations(previous =>
      previous.map(destination =>
        destination.id === destinationId ? next : destination
      )
    );
    if (selectedPlanId !== null && /^\d+$/.test(destinationId)) {
      updateStopExecution.mutate({
        stopId: Number(destinationId),
        executionStatus,
        completedAt: completedAt ?? null,
        issueNote: nextIssueNote ?? null,
        issueOwner: next.issueOwner ?? null,
        issueDueAt: next.issueDueAt ?? null,
        issueResolvedAt: next.issueResolvedAt ?? null,
      });
    }
  };
  const saveTrip = () => {
    if (!title.trim() || !managerName.trim())
      return toast.error("출장명과 담당자를 입력해 주세요.");
    if (!destinations.length)
      return toast.error("최소 한 곳의 출장 목적지를 등록해 주세요.");
    createTrip.mutate({
      title: title.trim(),
      tripDate,
      managerName: managerName.trim(),
      department: department.trim() || undefined,
      fixedStart: fixedStart
        ? {
            name: fixedStart.name,
            address: fixedStart.address,
            latitude: fixedStart.latitude,
            longitude: fixedStart.longitude,
          }
        : null,
      returnToStart,
      routeDistanceKm: routeSummary.totalDistanceKm,
      routeDurationMinutes: routeSummary.estimatedMinutes,
      checklist,
      stops: destinations.map((destination, index) => ({
        ...destination,
        sequence: index + 1,
      })),
    });
  };
  const importStopsCsv = async (file: File | undefined) => {
    if (!file) return;
    if (!canOperatePlan) {
      toast.error("이 계획은 열람 전용입니다.");
      return;
    }
    if (
      destinations.length &&
      !window.confirm(
        "현재 목적지 목록을 CSV 내용으로 교체할까요? 저장하지 않은 목적지와 순서는 사라집니다."
      )
    )
      return;
    setCsvImporting(true);
    try {
      const parsed = parseTripStopsCsv(await file.text());
      const seenCoordinates = new Set<string>();
      const importedStops: Destination[] = [];
      let duplicateCount = 0;
      parsed.stops.forEach(stop => {
        const coordinateKey = `${stop.latitude.toFixed(5)},${stop.longitude.toFixed(5)}`;
        if (seenCoordinates.has(coordinateKey)) {
          duplicateCount += 1;
          return;
        }
        seenCoordinates.add(coordinateKey);
        importedStops.push({
          id: crypto.randomUUID(),
          name: stop.name,
          address: stop.address,
          latitude: stop.latitude,
          longitude: stop.longitude,
          note: stop.note,
          photos: [],
          executionStatus: stop.executionStatus,
          completedAt: stop.completedAt,
          issueNote: stop.issueNote,
          issueOwner: stop.issueOwner,
          issueDueAt: stop.issueDueAt,
          issueResolvedAt: stop.issueResolvedAt,
        });
      });
      if (!importedStops.length)
        throw new Error("중복 좌표를 제외하면 가져올 목적지가 없습니다.");
      setDestinations(importedStops);
      setSelectedPlanId(null);
      setAddressQuery("");
      setResultReportDraft(null);
      if (!title.trim() && parsed.title) setTitle(parsed.title);
      if (parsed.tripDate) setTripDate(toIsoDate(parsed.tripDate));
      setActiveWorkspace("planner");
      setWorkMode("map");
      toast.success(
        `${importedStops.length}곳의 목적지를 가져왔습니다.${duplicateCount ? ` 중복 ${duplicateCount}곳은 제외했습니다.` : ""}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "CSV 가져오기에 실패했습니다."
      );
    } finally {
      setCsvImporting(false);
      if (csvImportInputRef.current) csvImportInputRef.current.value = "";
    }
  };
  const shareTrip = async () => {
    if (!selectedPlan.data?.shareToken)
      return toast.info(
        "먼저 계획을 저장하면 읽기 전용 공유 링크가 생성됩니다."
      );
    const url = `${window.location.origin}/share/${selectedPlan.data.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("공유 링크를 클립보드에 복사했습니다.");
    } catch {
      toast.message("공유 링크", { description: url });
    }
  };
  const downloadStopsCsv = () => {
    if (!destinations.length)
      return toast.info("내보낼 목적지를 먼저 등록해 주세요.");
    const csv = makeTripStopsCsv(
      title,
      tripDate,
      destinations.map((destination, index) => ({
        ...destination,
        sequence: index + 1,
      }))
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = makeTripStopsCsvFileName(title, tripDate);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    toast.success("목적지 운영 목록을 CSV로 내보냈습니다.");
  };
  const downloadCalendar = () => {
    if (!destinations.length)
      return toast.info("캘린더에 등록할 목적지를 먼저 추가해 주세요.");
    if (!tripDate)
      return toast.info("캘린더에 넣을 출장일을 먼저 입력해 주세요.");
    setCalendarDownloading(true);
    try {
      const calendar = makeTripCalendar({
        title,
        tripDate,
        managerName,
        department,
        returnToStart,
        fixedStartName: fixedStart?.name,
        routeDistanceKm: routeSummary.totalDistanceKm,
        routeDurationMinutes: routeSummary.estimatedMinutes,
        stops: destinations.map((destination, index) => ({
          sequence: index + 1,
          name: destination.name,
          address: destination.address,
          note: destination.note,
        })),
      });
      const url = URL.createObjectURL(
        new Blob([calendar], { type: "text/calendar;charset=utf-8" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = makeTripCalendarFileName(title, tripDate);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success("출장 일정을 캘린더 파일로 내보냈습니다.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "캘린더 파일 생성에 실패했습니다."
      );
    } finally {
      setCalendarDownloading(false);
    }
  };
  const duplicateTrip = async (tripId: number) => {
    try {
      const source = await utils.trip.get.fetch({ id: tripId });
      setTitle(`${source.title} 사본`);
      setTripDate(toIsoDate(source.tripDate));
      setManagerName(source.managerName);
      setDepartment(source.department ?? "");
      setFixedStart(
        source.fixedStartName &&
          source.fixedStartAddress &&
          source.fixedStartLatitude !== null &&
          source.fixedStartLongitude !== null
          ? {
              id: `copied-start-${source.id}`,
              name: source.fixedStartName,
              address: source.fixedStartAddress,
              latitude: asNumber(source.fixedStartLatitude),
              longitude: asNumber(source.fixedStartLongitude),
            }
          : null
      );
      setReturnToStart(Boolean(source.returnToStart));
      setChecklist(EMPTY_TRIP_CHECKLIST);
      setDestinations(
        source.stops.map(stop => ({
          id: crypto.randomUUID(),
          name: stop.name,
          address: stop.address,
          latitude: asNumber(stop.latitude),
          longitude: asNumber(stop.longitude),
          note: stop.note ?? "",
          photos:
            stop.photos?.map(photo => ({
              storageKey: photo.storageKey,
              url: photo.url,
              fileName: photo.fileName,
              takenAt: photo.takenAt ? toIsoDate(photo.takenAt) : undefined,
              description: photo.description ?? undefined,
            })) ?? [],
          executionStatus: "planned",
        }))
      );
      setResultReportDraft(null);
      setSelectedPlanId(null);
      setActiveWorkspace("planner");
      setWorkMode("map");
      toast.success(
        "저장 계획을 복제했습니다. 새 계획으로 수정 후 저장하세요."
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "출장 계획을 복제하지 못했습니다."
      );
    }
  };
  const openBatchDialog = (plan: {
    id: number;
    title: string;
    managerName: string;
    department?: string | null;
  }) => {
    setBatchTemplateId(plan.id);
    setBatchTitlePrefix(plan.title);
    setBatchManagerName(plan.managerName);
    setBatchDepartment(plan.department ?? "");
    setBatchDatesText("");
    setBatchDialogOpen(true);
  };
  const submitBatchGeneration = () => {
    if (batchTemplateId === null)
      return toast.error("반복 출장 템플릿을 선택해 주세요.");
    const parsed = parseBatchDates(batchDatesText);
    if (parsed.invalid.length)
      return toast.error(
        `유효하지 않은 날짜가 있습니다: ${parsed.invalid.join(", ")}`
      );
    if (parsed.duplicates.length)
      return toast.error(
        `중복된 날짜가 있습니다: ${parsed.duplicates.join(", ")}`
      );
    if (!parsed.dates.length)
      return toast.info("생성할 출장 날짜를 입력해 주세요.");
    createBatchTrips.mutate({
      templateId: batchTemplateId,
      dates: parsed.dates,
      titlePrefix: batchTitlePrefix.trim(),
      managerName: batchManagerName.trim(),
      department: batchDepartment.trim() || undefined,
    });
  };
  const downloadPdf = async () => {
    if (!destinations.length)
      return toast.error("PDF로 만들 출장 목적지를 먼저 추가해 주세요.");
    if (!reportRef.current)
      return toast.error("PDF 보고서 화면을 준비하지 못했습니다.");
    setPdfGenerating(true);
    try {
      const photoLookup = new Map(
        destinations.flatMap(destination =>
          (destination.photos ?? []).map(photo => [photo.storageKey, photo])
        )
      );
      const pdfImages = Array.from(
        reportRef.current.querySelectorAll<HTMLImageElement>(
          "img[data-trip-photo-key]"
        )
      );
      const originalSources = pdfImages.map(
        image => [image, image.src] as const
      );
      await Promise.all(
        pdfImages.map(async image => {
          const storageKey = image.dataset.tripPhotoKey;
          const photo = storageKey ? photoLookup.get(storageKey) : undefined;
          if (!photo) return;
          image.src =
            photo.dataUrl ??
            (photo.url.startsWith("data:")
              ? photo.url
              : (
                  await utils.trip.getPhotoData.fetch({
                    storageKey: photo.storageKey,
                  })
                ).dataUrl);
        })
      );
      await Promise.all(
        pdfImages.map(image => image.decode().catch(() => undefined))
      );
      await new Promise<void>(resolve =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve())
        )
      );
      await downloadTripPdf(
        reportRef.current,
        makeTripPdfFileName(title, tripDate)
      );
      originalSources.forEach(([image, source]) => {
        image.src = source;
      });
      toast.success("출장 경로 요약 PDF를 다운로드했습니다.");
    } catch (error) {
      console.error("[Trip PDF]", error);
      toast.error("PDF 생성에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setPdfGenerating(false);
    }
  };
  const downloadFieldRecordPdf = async () => {
    if (!selectedFieldRecords.length)
      return toast.info("PDF로 출력할 현장 사진을 선택해 주세요.");
    if (!fieldRecordPdfRef.current)
      return toast.error("현장 기록 보고서 화면을 준비하지 못했습니다.");
    setFieldRecordPdfGenerating(true);
    const originalSources: [HTMLImageElement, string][] = [];
    try {
      const photoLookup = new Map(
        selectedFieldRecords.map(record => [record.storageKey, record])
      );
      const pdfImages = Array.from(
        fieldRecordPdfRef.current.querySelectorAll<HTMLImageElement>(
          "img[data-trip-photo-key]"
        )
      );
      originalSources.push(
        ...pdfImages.map(
          image => [image, image.src] as [HTMLImageElement, string]
        )
      );
      await Promise.all(
        pdfImages.map(async image => {
          const storageKey = image.dataset.tripPhotoKey;
          const record = storageKey ? photoLookup.get(storageKey) : undefined;
          if (!record) return;
          image.src =
            record.dataUrl ??
            (record.url.startsWith("data:")
              ? record.url
              : (
                  await utils.trip.getPhotoData.fetch({
                    storageKey: record.storageKey,
                  })
                ).dataUrl);
        })
      );
      await Promise.all(
        pdfImages.map(image => image.decode().catch(() => undefined))
      );
      await new Promise<void>(resolve =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve())
        )
      );
      await downloadTripPdf(
        fieldRecordPdfRef.current,
        makeFieldRecordPdfFileName(title, tripDate)
      );
      toast.success("현장 기록 PDF를 다운로드했습니다.");
    } catch (error) {
      console.error("[Field record PDF]", error);
      toast.error("현장 기록 PDF 생성에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      originalSources.forEach(([image, source]) => {
        image.src = source;
      });
      setFieldRecordPdfGenerating(false);
    }
  };
  const generateResultReportDraft = () => {
    setResultReportDraft(resultReportPreview);
    toast.success("운영 기록을 바탕으로 결과 보고서 초안을 구성했습니다.");
  };
  const saveResultReportDraft = () => {
    if (!canOperatePlan) return toast.error("이 계획은 열람 전용입니다.");
    if (selectedPlanId === null)
      return toast.info(
        "결과 보고서 초안을 저장하려면 먼저 출장 계획을 저장해 주세요."
      );
    const draft = resultReportDraft ?? resultReportPreview;
    setResultReportDraft(draft);
    updateReportDraft.mutate({ tripId: selectedPlanId, draft });
  };
  const reorderResultReportEvidence = (
    sourceKey: string,
    targetKey: string
  ) => {
    if (!canOperatePlan || sourceKey === targetKey) return;
    const orderedKeys = resultReportEvidence.map(photo => photo.storageKey);
    const sourceIndex = orderedKeys.indexOf(sourceKey);
    const targetIndex = orderedKeys.indexOf(targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;
    orderedKeys.splice(sourceIndex, 1);
    orderedKeys.splice(targetIndex, 0, sourceKey);
    setResultReportDraft(previous => ({
      ...(previous ?? resultReportPreview),
      evidenceOrder: orderedKeys,
    }));
    setDraggedEvidenceKey(null);
  };
  const moveResultReportEvidence = (
    storageKey: string,
    direction: "up" | "down"
  ) => {
    if (!canOperatePlan) return;
    const orderedKeys = moveTripReportEvidenceOrder(
      resultReportEvidence,
      storageKey,
      direction
    );
    if (!orderedKeys) return;
    setResultReportDraft(previous => ({
      ...(previous ?? resultReportPreview),
      evidenceOrder: orderedKeys,
    }));
  };
  const toggleResultReportEvidence = (storageKey: string) => {
    if (!canOperatePlan) return;
    setResultReportDraft(previous => {
      const draft = previous ?? resultReportPreview;
      const excludedKeys = new Set(draft.excludedEvidenceKeys ?? []);
      if (excludedKeys.has(storageKey)) excludedKeys.delete(storageKey);
      else excludedKeys.add(storageKey);
      return { ...draft, excludedEvidenceKeys: Array.from(excludedKeys) };
    });
  };
  const downloadResultReportPdf = async () => {
    if (!resultReportPdfRef.current)
      return toast.error("결과 보고서 화면을 준비하지 못했습니다.");
    setResultReportPdfGenerating(true);
    const originalSources: [HTMLImageElement, string][] = [];
    try {
      const photoLookup = new Map(
        destinations.flatMap(destination =>
          (destination.photos ?? []).map(photo => [photo.storageKey, photo])
        )
      );
      const pdfImages = Array.from(
        resultReportPdfRef.current.querySelectorAll<HTMLImageElement>(
          "img[data-trip-photo-key]"
        )
      );
      originalSources.push(
        ...pdfImages.map(
          image => [image, image.src] as [HTMLImageElement, string]
        )
      );
      await Promise.all(
        pdfImages.map(async image => {
          const storageKey = image.dataset.tripPhotoKey;
          const photo = storageKey ? photoLookup.get(storageKey) : undefined;
          if (!photo) return;
          image.src =
            photo.dataUrl ??
            (photo.url.startsWith("data:")
              ? photo.url
              : (
                  await utils.trip.getPhotoData.fetch({
                    storageKey: photo.storageKey,
                  })
                ).dataUrl);
        })
      );
      await Promise.all(
        pdfImages.map(image => image.decode().catch(() => undefined))
      );
      await new Promise<void>(resolve =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve())
        )
      );
      await downloadTripPdf(
        resultReportPdfRef.current,
        makeTripResultReportPdfFileName(title, tripDate)
      );
      toast.success("출장 결과 보고서 PDF를 다운로드했습니다.");
    } catch (error) {
      console.error("[Trip result report PDF]", error);
      toast.error("결과 보고서 PDF 생성에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      originalSources.forEach(([image, source]) => {
        image.src = source;
      });
      setResultReportPdfGenerating(false);
    }
  };
  const downloadResultReportHwpx = async () => {
    setResultReportHwpxGenerating(true);
    try {
      const draft = resultReportDraft ?? resultReportPreview;
      const bytes = await buildTripResultHwpx({
        title,
        tripDate,
        managerName,
        department,
        overview: draft.overview,
        outcome: draft.outcome,
        issueActions: draft.issueActions,
        followUp: draft.followUp,
        generatedAt: draft.generatedAt,
        evidence: includedResultReportEvidence.map(photo => ({
          destinationName: photo.destinationName,
          destinationAddress: photo.destinationAddress,
          takenAt: photo.takenAt,
          description: photo.description,
          sequence: photo.sequence,
        })),
      });
      const blobBytes = new Uint8Array(bytes.byteLength);
      blobBytes.set(bytes);
      const url = URL.createObjectURL(
        new Blob([blobBytes.buffer], { type: "application/hwp+zip" })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = makeTripResultHwpxFileName(title, tripDate);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("출장 결과 보고서 HWPX를 다운로드했습니다.");
    } catch (error) {
      console.error("[Trip result report HWPX]", error);
      toast.error("결과 보고서 HWPX 생성에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setResultReportHwpxGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <div
        id="planner"
        className="mx-auto max-w-[1680px] px-5 py-7 sm:px-8 lg:px-10 lg:py-10"
      >
        <div className="grid gap-7 border-b border-black/15 pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.26em] text-[#c4503d]">
              Route Intelligence for the field
            </p>
            <h1 className="font-display mt-3 max-w-3xl break-keep text-[2.55rem] font-medium leading-[.98] tracking-[-.04em] sm:text-[4.75rem]">
              현장으로 향하는
              <span className="mt-1 block font-normal">가장 단정한 순서.</span>
            </h1>
          </div>
          <p className="max-w-xs text-sm leading-6 text-stone-600">
            다중 출장 목적지를 지도 위에 쌓고, 동선의 낭비를 줄이는 방문 순서를
            설계합니다.
          </p>
        </div>

        <div className="workspace-tabs-row">
          <div
            className="workspace-tabs"
            role="tablist"
            aria-label="출장 작업 보기"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeWorkspace === "planner"}
              className={
                activeWorkspace === "planner"
                  ? "workspace-tab workspace-tab-active"
                  : "workspace-tab"
              }
              onClick={() => setActiveWorkspace("planner")}
            >
              <Route className="h-4 w-4" /> 여정 설계
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeWorkspace === "operations"}
              className={
                activeWorkspace === "operations"
                  ? "workspace-tab workspace-tab-active"
                  : "workspace-tab"
              }
              onClick={() => setActiveWorkspace("operations")}
            >
              <ClipboardCheck className="h-4 w-4" /> 운영 보드{" "}
              <span>{issueSummary.unresolved}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeWorkspace === "records"}
              className={
                activeWorkspace === "records"
                  ? "workspace-tab workspace-tab-active"
                  : "workspace-tab"
              }
              onClick={() => setActiveWorkspace("records")}
            >
              <Images className="h-4 w-4" /> 현장 기록{" "}
              <span>{fieldRecords.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeWorkspace === "report"}
              className={
                activeWorkspace === "report"
                  ? "workspace-tab workspace-tab-active"
                  : "workspace-tab"
              }
              onClick={() => setActiveWorkspace("report")}
            >
              <FileText className="h-4 w-4" /> 결과 보고서
            </button>
          </div>
          <Button
            type="button"
            onClick={requestNewPlan}
            variant="outline"
            className="new-plan-button"
          >
            <Plus className="h-3.5 w-3.5" /> 새 계획
          </Button>
        </div>
        {activeWorkspace === "planner" && draftReady ? (
          <div
            className={
              draftStatus === "offline"
                ? "trip-draft-status trip-draft-status-offline"
                : draftStatus === "local"
                  ? "trip-draft-status trip-draft-status-local"
                  : "trip-draft-status"
            }
            role="status"
          >
            <div>
              {draftStatus === "offline" ? (
                <CloudOff className="h-3.5 w-3.5" />
              ) : draftStatus === "syncing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : draftStatus === "saved" ? (
                <Cloud className="h-3.5 w-3.5" />
              ) : (
                <HardDrive className="h-3.5 w-3.5" />
              )}
              <span>
                <strong>{draftStatusCopy.title}</strong>
                <small>
                  {draftUpdatedAt
                    ? `${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(draftUpdatedAt))} 저장 · ${draftStatusCopy.detail}`
                    : draftStatusCopy.detail}
                </small>
              </span>
            </div>
            {hasTripDraftContent(currentDraftPayload) ? (
              <button type="button" onClick={clearStoredTripDraft}>
                임시 초안 비우기
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={activeWorkspace === "planner" ? "" : "hidden"}>
          <section
            className="planner-progress"
            aria-label="출장 계획 준비 단계"
          >
            <div className="planner-progress-intro">
              <p className="section-label text-[#c4503d]">Field dossier</p>
              <p className="mt-1 text-sm font-semibold text-[#1f2d2b]">
                준비도 {tripReadiness.completedCount}/3
              </p>
            </div>
            <ol className="planner-progress-steps">
              {tripReadiness.stages.map((stage, index) => (
                <li
                  key={stage.id}
                  className={
                    stage.complete
                      ? "planner-progress-step planner-progress-step-complete"
                      : "planner-progress-step"
                  }
                >
                  <span className="planner-progress-index">
                    {stage.complete ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <span>
                    <strong>{stage.label}</strong>
                    <small>{stage.detail}</small>
                  </span>
                </li>
              ))}
            </ol>
            <p className="planner-progress-note">
              {tripReadiness.canOptimize
                ? "동선 계산을 시작할 수 있습니다."
                : "현장 순서를 정할 준비를 이어가세요."}
            </p>
          </section>

          <section className="operations-dashboard" aria-label="현장 운영 현황">
            <div className="operations-dashboard-heading">
              <div>
                <p className="section-label text-[#c4503d]">Field execution</p>
                <h2 className="font-display mt-1 text-3xl">현장 운영 현황</h2>
              </div>
              <p>
                {operationSummary.total
                  ? `완료 ${operationSummary.completed}/${operationSummary.total} · 진행률 ${operationSummary.completionRate}%`
                  : "목적지를 등록하면 실행 현황을 관리할 수 있습니다."}
              </p>
            </div>
            <div className="operations-metric-grid">
              <article className="operations-metric operations-metric-primary">
                <CheckCircle2 className="h-4 w-4" />
                <span>진행률</span>
                <strong>
                  {operationSummary.completionRate}
                  <em>%</em>
                </strong>
                <small>
                  완료 {operationSummary.completed} · 진행{" "}
                  {operationSummary.in_progress}
                </small>
              </article>
              <article className="operations-metric">
                <Navigation className="h-4 w-4" />
                <span>다음 방문</span>
                <strong className="operations-next-stop">
                  {operationSummary.nextIndex >= 0
                    ? destinations[operationSummary.nextIndex]?.name
                    : operationSummary.total
                      ? "전체 완료"
                      : "목적지 대기"}
                </strong>
                <small>
                  {operationSummary.nextIndex >= 0
                    ? `${String(operationSummary.nextIndex + 1).padStart(2, "0")}번 순서 · ${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(visitSchedule[operationSummary.nextIndex]?.arrival)}`
                    : "동선 준비 상태"}
                </small>
              </article>
              <article
                className={
                  operationSummary.issue
                    ? "operations-metric operations-metric-issue"
                    : "operations-metric"
                }
              >
                <AlertTriangle className="h-4 w-4" />
                <span>현장 이슈</span>
                <strong>
                  {operationSummary.issue}
                  <em>건</em>
                </strong>
                <small>
                  {operationSummary.issue
                    ? "확인·조치가 필요한 기록"
                    : "기록된 이슈가 없습니다."}
                </small>
              </article>
            </div>
            <div className="operations-checklist">
              <div>
                <ClipboardCheck className="h-4 w-4" />
                <span>
                  <strong>운영 체크리스트</strong>
                  <small>
                    {getChecklistProgress(checklist).completed}/3 완료
                  </small>
                </span>
              </div>
              <div className="operations-checklist-items">
                {(
                  [
                    { key: "preDeparture", label: "출발 전 확인" },
                    { key: "onSite", label: "현장 도착 확인" },
                    { key: "wrapUp", label: "복귀·정리 확인" },
                  ] as const
                ).map(item => (
                  <button
                    type="button"
                    key={item.key}
                    className={
                      checklist[item.key]
                        ? "operations-check operations-check-done"
                        : "operations-check"
                    }
                    onClick={() =>
                      setChecklistItem(item.key, !checklist[item.key])
                    }
                  >
                    <span>
                      {checklist[item.key] ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : null}
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div
            className={`planner-workbench mt-8 grid gap-7 ${workMode === "list" ? "address-work-grid" : "xl:grid-cols-[380px_minmax(0,1fr)_320px]"}`}
          >
            <section className="planner-input-dossier order-2 xl:order-1">
              <div className="border-y border-black/15 py-4">
                <p className="section-label">01 / Plan identity</p>
              </div>
              <div className="space-y-5 py-6">
                <label className="editorial-label">
                  출장명
                  <Input
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                    placeholder="예: 읍면동 현장 점검"
                    className="editorial-input"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="editorial-label">
                    출장일
                    <Input
                      type="date"
                      value={tripDate}
                      onChange={event => setTripDate(event.target.value)}
                      className="editorial-input"
                    />
                  </label>
                  <label className="editorial-label">
                    담당자
                    <Input
                      value={managerName}
                      onChange={event => setManagerName(event.target.value)}
                      placeholder="성명"
                      className="editorial-input"
                    />
                  </label>
                  <label className="editorial-label">
                    부서
                    <Input
                      value={department}
                      onChange={event => setDepartment(event.target.value)}
                      placeholder="예: 건설과"
                      className="editorial-input"
                    />
                  </label>
                </div>
              </div>
              <div
                className={
                  fixedStart
                    ? "fixed-start-panel fixed-start-panel-active"
                    : "fixed-start-panel"
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="section-label text-[#c4503d]">
                      Departure desk
                    </p>
                    <h2 className="mt-1 text-sm font-semibold text-[#1f2d2b]">
                      출발·복귀 기준점
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      현장 이동의 기준 위치를 설정하고 왕복 여부를 결정합니다.
                    </p>
                  </div>
                  {fixedStart ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFixedStart(null);
                        setReturnToStart(false);
                        setSelectedPlanId(null);
                      }}
                      className="fixed-start-clear"
                      aria-label="고정 출발지 해제"
                    >
                      <X className="h-3.5 w-3.5" /> 해제
                    </button>
                  ) : null}
                </div>
                {fixedStart ? (
                  <>
                    <div className="fixed-start-selected">
                      <span className="departure-node">A</span>
                      <div>
                        <strong>{fixedStart.name}</strong>
                        <span>{fixedStart.address}</span>
                      </div>
                      <span className="departure-state">START</span>
                    </div>
                    <div className="return-trip-control">
                      <span className="return-route-mark">
                        <Repeat2 className="h-4 w-4" />
                      </span>
                      <div>
                        <strong>출발지로 복귀</strong>
                        <small>
                          {returnToStart
                            ? "최종 목적지에서 출발지로 복귀합니다."
                            : "편도 동선으로 마지막 목적지에서 종료합니다."}
                        </small>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={returnToStart}
                        onClick={() => {
                          setReturnToStart(value => !value);
                          setSelectedPlanId(null);
                        }}
                        className={
                          returnToStart
                            ? "return-trip-switch return-trip-switch-on"
                            : "return-trip-switch"
                        }
                      >
                        <span />
                      </button>
                    </div>
                    <p className="departure-panel-foot">
                      {returnToStart
                        ? "ROUND TRIP ACTIVE · 복귀 구간이 거리와 시간에 포함됩니다."
                        : "ONE WAY MODE · 필요 시 왕복 복귀를 활성화하세요."}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="relative mt-4">
                      <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-[#c4503d]" />
                      <Input
                        value={fixedStartQuery}
                        onChange={event =>
                          setFixedStartQuery(event.target.value)
                        }
                        placeholder="회사·집 주소 또는 장소 검색"
                        className="h-11 rounded-none border-[#c4503d]/35 bg-[#fffdf7]/60 pl-10"
                      />
                    </div>
                    {fixedStartSearch.isError && (
                      <p className="mt-2 text-xs text-[#c4503d]">
                        {fixedStartSearch.error.message}
                      </p>
                    )}
                    {fixedStartSearch.data && (
                      <div className="fixed-start-results">
                        {fixedStartSearch.data.map(result => (
                          <button
                            type="button"
                            key={result.id}
                            onClick={() => setFixedStartFromSearch(result)}
                          >
                            <span>{result.name}</span>
                            <small>{result.address}</small>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="departure-panel-foot">
                      출발지를 지정하지 않으면 첫 번째 목적지에서 출발합니다.
                    </p>
                  </>
                )}
              </div>
              <div className="border-y border-black/15 py-4">
                <p className="section-label">02 / Destinations</p>
              </div>
              <div className="py-5">
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-stone-500" />
                  <Input
                    value={addressQuery}
                    onChange={event => setAddressQuery(event.target.value)}
                    placeholder="주소 또는 장소 검색"
                    className="h-11 rounded-none border-black/15 bg-transparent pl-10"
                  />
                </div>
                {addressSearch.isError && (
                  <p className="mt-2 text-xs text-[#c4503d]">
                    {addressSearch.error.message}
                  </p>
                )}
                {addressSearch.data && (
                  <div className="border border-t-0 border-black/10 bg-[#fffdf7]">
                    {addressSearch.data.map(result => (
                      <button
                        key={result.id}
                        onClick={() => addDestination(result)}
                        className="block w-full border-b border-black/5 px-3 py-3 text-left last:border-b-0 hover:bg-[#f0eadc]"
                      >
                        <span className="block text-sm font-semibold">
                          {result.name}
                        </span>
                        <span className="mt-1 block truncate text-xs text-stone-500">
                          {result.address}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3 border-y border-dashed border-black/15 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => csvImportInputRef.current?.click()}
                    disabled={csvImporting}
                    className="rounded-none border-[#1f2d2b]/30 bg-transparent text-xs"
                  >
                    {csvImporting ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileUp className="mr-2 h-3.5 w-3.5" />
                    )}{" "}
                    CSV로 일괄 가져오기
                  </Button>
                  <input
                    ref={csvImportInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={event => {
                      void importStopsCsv(event.target.files?.[0]);
                    }}
                  />
                  <span className="text-[10px] leading-4 text-stone-500">
                    여정도에서 내보낸 목적지 CSV를 불러옵니다.
                  </span>
                </div>
                <div className="mt-5 space-y-2">
                  {destinations.length === 0 ? (
                    <div className="destination-empty-state">
                      <span className="destination-empty-mark">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <p className="font-display text-2xl text-[#1f2d2b]">
                        첫 현장 지점을 기록하세요
                      </p>
                      <p>
                        주소를 검색하거나 지도를 클릭하면
                        <br />
                        방문 순서와 경로 요약이 시작됩니다.
                      </p>
                      <div>
                        <span>SEARCH</span>
                        <i /> <span>MAP CLICK</span>
                        <i /> <span>ROUTE READY</span>
                      </div>
                    </div>
                  ) : (
                    destinations.map((destination, index) => (
                      <div
                        key={destination.id}
                        className="destination-note-card"
                      >
                        <div className="flex items-start gap-3">
                          <span className="font-display text-2xl text-[#c4503d]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {destination.name}
                            </p>
                            <p className="truncate text-xs text-stone-500">
                              {destination.address}
                            </p>
                            <p className="destination-arrival-time">
                              <Clock3 className="h-3 w-3" /> 예상 도착{" "}
                              {new Intl.DateTimeFormat("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(visitSchedule[index]?.arrival)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => moveDestination(index, -1)}
                              disabled={index === 0}
                              className="icon-button"
                              aria-label={`${destination.name} 위로 이동`}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => moveDestination(index, 1)}
                              disabled={index === destinations.length - 1}
                              className="icon-button"
                              aria-label={`${destination.name} 아래로 이동`}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                updateDestinations(
                                  destinations.filter(
                                    item => item.id !== destination.id
                                  )
                                )
                              }
                              className="icon-button hover:text-[#c4503d]"
                              aria-label={`${destination.name} 삭제`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="destination-execution">
                          <div className="destination-execution-head">
                            <span>실행 상태</span>
                            <strong
                              className={`execution-status execution-status-${destination.executionStatus ?? "planned"}`}
                            >
                              {executionStatusLabel(
                                destination.executionStatus ?? "planned"
                              )}
                            </strong>
                          </div>
                          <div className="destination-execution-actions">
                            {(
                              [
                                "planned",
                                "in_progress",
                                "completed",
                                "issue",
                              ] as const
                            ).map(status => (
                              <button
                                type="button"
                                key={status}
                                className={
                                  destination.executionStatus === status
                                    ? `execution-state execution-state-active execution-state-${status}`
                                    : "execution-state"
                                }
                                onClick={() =>
                                  setDestinationExecution(
                                    destination.id,
                                    status,
                                    status === "issue"
                                      ? destination.issueNote || "확인 필요"
                                      : undefined
                                  )
                                }
                              >
                                {executionStatusLabel(status)}
                              </button>
                            ))}
                          </div>
                          {destination.executionStatus === "issue" ? (
                            <label className="destination-issue-input">
                              이슈 기록
                              <textarea
                                value={destination.issueNote ?? ""}
                                onChange={event =>
                                  setDestinations(previous =>
                                    previous.map(item =>
                                      item.id === destination.id
                                        ? {
                                            ...item,
                                            issueNote: event.target.value,
                                          }
                                        : item
                                    )
                                  )
                                }
                                onBlur={event =>
                                  setDestinationExecution(
                                    destination.id,
                                    "issue",
                                    event.target.value
                                  )
                                }
                                maxLength={1000}
                                placeholder="현장에서 확인된 이슈와 후속 조치 내용을 기록하세요."
                              />
                            </label>
                          ) : null}
                          {destination.completedAt ? (
                            <p className="destination-completed-time">
                              <CheckCircle2 className="h-3.5 w-3.5" /> 완료{" "}
                              {new Intl.DateTimeFormat("ko-KR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              }).format(new Date(destination.completedAt))}
                            </p>
                          ) : null}
                        </div>
                        <label className="destination-note-input">
                          <span>
                            <StickyNote className="h-3.5 w-3.5" /> 현장 메모
                          </span>
                          <textarea
                            value={destination.note ?? ""}
                            onChange={event =>
                              updateDestinationNote(
                                destination.id,
                                event.target.value
                              )
                            }
                            maxLength={1000}
                            placeholder="확인 사항, 담당자 전달사항, 준비물 등을 남겨 주세요."
                            aria-label={`${destination.name} 현장 메모`}
                          />
                        </label>
                        <div className="destination-photo-strip">
                          <div>
                            <span>
                              <Images className="h-3.5 w-3.5" /> 현장 사진
                            </span>
                            <small>{destination.photos?.length ?? 0}/3</small>
                          </div>
                          {destination.photos?.length ? (
                            <>
                              <div className="destination-photo-grid">
                                {destination.photos.map(photo => (
                                  <figure key={photo.storageKey}>
                                    <button
                                      type="button"
                                      className="destination-photo-zoom"
                                      onClick={() =>
                                        setActivePhoto({
                                          ...photo,
                                          destinationId: destination.id,
                                          destinationName: destination.name,
                                          destinationAddress:
                                            destination.address,
                                          sequence: index + 1,
                                        })
                                      }
                                      aria-label={`${destination.name} 사진 크게 보기`}
                                    >
                                      <img
                                        src={photo.dataUrl ?? photo.url}
                                        alt={`${destination.name} 현장 사진`}
                                      />
                                      <span>
                                        <Maximize2 className="h-3.5 w-3.5" />
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateDestinations(
                                          destinations.map(item =>
                                            item.id === destination.id
                                              ? {
                                                  ...item,
                                                  photos: (
                                                    item.photos ?? []
                                                  ).filter(
                                                    current =>
                                                      current.storageKey !==
                                                      photo.storageKey
                                                  ),
                                                }
                                              : item
                                          )
                                        )
                                      }
                                      aria-label={`${photo.fileName} 삭제`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </figure>
                                ))}
                              </div>
                              <div className="destination-photo-metadata">
                                {destination.photos.map((photo, photoIndex) => (
                                  <div
                                    key={`${photo.storageKey}-metadata`}
                                    className="destination-photo-metadata-card"
                                  >
                                    <div>
                                      <span>
                                        PHOTO{" "}
                                        {String(photoIndex + 1).padStart(
                                          2,
                                          "0"
                                        )}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActivePhoto({
                                            ...photo,
                                            destinationId: destination.id,
                                            destinationName: destination.name,
                                            destinationAddress:
                                              destination.address,
                                            sequence: index + 1,
                                          })
                                        }
                                      >
                                        <Maximize2 className="h-3.5 w-3.5" />{" "}
                                        크게 보기
                                      </button>
                                    </div>
                                    <label>
                                      촬영일
                                      <input
                                        type="date"
                                        value={photo.takenAt ?? ""}
                                        onChange={event =>
                                          updatePhotoMetadata(
                                            destination.id,
                                            photo.storageKey,
                                            {
                                              takenAt:
                                                event.target.value || undefined,
                                            }
                                          )
                                        }
                                      />
                                    </label>
                                    <label>
                                      사진 설명
                                      <textarea
                                        value={photo.description ?? ""}
                                        onChange={event =>
                                          updatePhotoMetadata(
                                            destination.id,
                                            photo.storageKey,
                                            { description: event.target.value }
                                          )
                                        }
                                        maxLength={500}
                                        placeholder="사진에서 확인한 현장 상황을 남겨 주세요."
                                      />
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : null}
                          <label className="destination-photo-add">
                            <ImagePlus className="h-4 w-4" /> 사진 첨부
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              onChange={event => {
                                void addDestinationPhotos(
                                  destination.id,
                                  event.target.files
                                );
                                event.currentTarget.value = "";
                              }}
                              disabled={
                                uploadPhoto.isPending ||
                                (destination.photos?.length ?? 0) >= 3
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  onClick={optimize}
                  disabled={destinations.length < 2}
                  variant="outline"
                  className="mt-5 w-full rounded-none border-[#1f2d2b] bg-transparent text-[#1f2d2b] hover:bg-[#1f2d2b] hover:text-[#f5f1e8]"
                >
                  <Route className="mr-2 h-4 w-4" /> 최적 방문 순서 계산
                </Button>
              </div>
            </section>

            {workMode === "map" ? (
              <section className="map-workspace-panel order-1 min-h-[520px] overflow-hidden border border-black/15 bg-[#f3eee4] xl:order-2">
                <KakaoTripMap
                  destinations={destinations}
                  fixedStart={fixedStart}
                  returnToStart={returnToStart}
                  onMapClick={onMapClick}
                  onContinueWithoutMap={() => setWorkMode("list")}
                  retryRequestId={mapRetryRequestId}
                />
              </section>
            ) : (
              <AddressWorkMode
                destinations={destinations}
                fixedStart={fixedStart}
                onMove={moveDestination}
                onRemove={id =>
                  updateDestinations(
                    destinations.filter(destination => destination.id !== id)
                  )
                }
                onRestoreMap={restoreMap}
              />
            )}

            <aside className="route-summary-panel order-3">
              <div className="route-summary-heading">
                <div>
                  <p className="section-label">03 / Route Summary</p>
                  <p>현장 운영 경로</p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="optimization-strategy" className="sr-only">
                    경로 최적화 모드
                  </label>
                  <select
                    id="optimization-strategy"
                    value={optimizationStrategy}
                    onChange={event =>
                      setOptimizationStrategy(
                        event.target.value as OptimizationStrategy
                      )
                    }
                    className="h-8 border border-black/15 bg-[#fffdf7] px-2 text-[10px] font-bold text-stone-600 outline-none focus:border-[#c4503d]"
                  >
                    <option value="quality">정밀 경로</option>
                    <option value="fast">빠른 경로</option>
                  </select>
                  <span
                    className={
                      returnToStart
                        ? "route-mode-chip route-mode-chip-round"
                        : "route-mode-chip"
                    }
                  >
                    {returnToStart ? (
                      <Repeat2 className="h-3.5 w-3.5" />
                    ) : (
                      <Navigation className="h-3.5 w-3.5" />
                    )}
                    {returnToStart ? "왕복" : "편도"}
                  </span>
                </div>
              </div>
              <div className="route-summary-grid mt-5">
                <div className="route-card route-card-primary">
                  <MapPin className="h-5 w-5 text-[#d66b55]" />
                  <p>{returnToStart ? "왕복 총 이동 거리" : "총 이동 거리"}</p>
                  <strong>
                    {routeSummary.totalDistanceKm.toFixed(1)}
                    <em>km</em>
                  </strong>
                  <span className="route-card-detail">
                    {returnToStart
                      ? `복귀 구간 ${routeSummary.returnDistanceKm.toFixed(1)}km 포함`
                      : "최종 목적지에서 종료"}
                  </span>
                </div>
                <div className="route-card">
                  <Navigation className="h-5 w-5 text-[#c4503d]" />
                  <p>예상 소요 시간</p>
                  <strong>
                    {routeSummary.estimatedMinutes}
                    <em>분</em>
                  </strong>
                </div>
                <div className="route-card route-card-stops">
                  <ListTree className="h-5 w-5 text-[#c4503d]" />
                  <p>방문 목적지</p>
                  <strong>
                    {destinations.length}
                    <em>곳</em>
                  </strong>
                </div>
              </div>
              <div className="route-status-note">
                <Route className="h-4 w-4" />
                <span>
                  <strong>
                    {tripReadiness.canOptimize
                      ? "ROUTE READY"
                      : "ROUTE PREPARATION"}
                  </strong>
                  <small>
                    {tripReadiness.canOptimize
                      ? returnToStart
                        ? "복귀 구간까지 포함한 왕복 동선을 준비했습니다."
                        : optimizationStrategy === "quality"
                          ? "거리 행렬 + 다중 후보 + best 2-opt로 정밀 방문 순서를 계산합니다."
                          : "거리 행렬 + Nearest Neighbor + best 2-opt로 빠르게 계산합니다."
                      : "목적지를 2곳 이상 등록하면 최적 동선 계산을 시작합니다."}
                  </small>
                </span>
              </div>
              <div
                className={
                  fixedStart
                    ? "route-fixed-start route-fixed-start-active"
                    : "route-fixed-start"
                }
              >
                <MapPin className="h-4 w-4" />
                <div>
                  <p>
                    {returnToStart ? "고정 출발지 · 왕복 복귀" : "고정 출발지"}
                  </p>
                  <strong>
                    {fixedStart
                      ? fixedStart.name
                      : "출발지를 지정하지 않았습니다."}
                  </strong>
                  <small>
                    {fixedStart
                      ? returnToStart
                        ? `${fixedStart.address} · 복귀 지점`
                        : fixedStart.address
                      : "지정하지 않으면 첫 번째 목적지에서 동선을 시작합니다."}
                  </small>
                </div>
              </div>
              <div className="route-sequence-panel mt-5">
                <div className="flex items-center justify-between">
                  <p className="section-label">Visit sequence</p>
                  <span className="text-[10px] font-bold tracking-[.13em] text-stone-400">
                    {String(destinations.length).padStart(2, "0")} STOPS
                  </span>
                </div>
                {destinations.length ? (
                  <ol className="route-timeline mt-4">
                    {destinations.map((destination, index) => (
                      <li key={destination.id}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <p className="truncate">{destination.name}</p>
                          {destination.note ? (
                            <small>
                              <StickyNote className="h-3 w-3" />
                              {destination.note}
                            </small>
                          ) : null}
                          {destination.photos?.length ? (
                            <small>
                              <Images className="h-3 w-3" />
                              현장 사진 {destination.photos.length}장
                            </small>
                          ) : null}
                        </div>
                      </li>
                    ))}
                    {returnToStart && fixedStart ? (
                      <li className="route-return-leg">
                        <Repeat2 className="h-3.5 w-3.5" />{" "}
                        <span>{fixedStart.name} 복귀</span>
                      </li>
                    ) : null}
                  </ol>
                ) : (
                  <p className="route-sequence-empty">
                    등록된 목적지가 없습니다. 첫 현장 지점을 추가해 주세요.
                  </p>
                )}
              </div>
              <div className="route-completion-panel">
                <div>
                  <p className="section-label">Next action</p>
                  <strong>
                    {tripReadiness.canOptimize
                      ? "계획을 저장하거나 보고서로 출력하세요."
                      : "목적지를 등록하면 경로를 완성할 수 있습니다."}
                  </strong>
                </div>
                <Button
                  onClick={saveTrip}
                  disabled={createTrip.isPending}
                  className="route-action-primary"
                >
                  <Plus className="mr-2 h-4 w-4" /> 계획 저장
                </Button>
              </div>
              <div className="route-output-grid">
                <Button
                  onClick={downloadPdf}
                  disabled={!destinations.length || pdfGenerating}
                  variant="outline"
                  className="route-action-secondary"
                >
                  {pdfGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                  )}
                  {pdfGenerating ? "PDF 생성 중" : "PDF 다운로드"}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => window.print()}
                    variant="outline"
                    className="route-action-tertiary"
                  >
                    <Printer className="mr-2 h-4 w-4" /> 인쇄
                  </Button>
                  <Button
                    onClick={shareTrip}
                    variant="outline"
                    className="route-action-tertiary"
                  >
                    <Share2 className="mr-2 h-4 w-4" /> 공유
                  </Button>
                  <Button
                    onClick={downloadStopsCsv}
                    variant="outline"
                    className="route-action-tertiary"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
                  </Button>
                  <Button
                    onClick={downloadCalendar}
                    disabled={!destinations.length || calendarDownloading}
                    variant="outline"
                    className="route-action-tertiary"
                  >
                    {calendarDownloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarPlus className="mr-2 h-4 w-4" />
                    )}
                    {calendarDownloading ? "생성 중" : "캘린더"}
                  </Button>
                </div>
              </div>
            </aside>
          </div>

          <div className="mobile-action-dock-spacer" aria-hidden="true" />
          <section
            className="mobile-action-dock print:hidden"
            aria-label="모바일 경로 작업"
          >
            <div className="mobile-action-dock-card">
              <div className="mobile-action-dock-heading">
                <span>ROUTE OPS</span>
                <strong>
                  {destinations.length}곳 ·{" "}
                  {routeSummary.totalDistanceKm.toFixed(1)}km
                </strong>
              </div>
              <div className="mobile-action-dock-primary">
                <Button
                  onClick={saveTrip}
                  disabled={createTrip.isPending}
                  className="route-action-primary"
                >
                  <Plus className="h-4 w-4" /> 저장
                </Button>
                <Button
                  onClick={downloadPdf}
                  disabled={!destinations.length || pdfGenerating}
                  variant="outline"
                  className="route-action-secondary"
                >
                  {pdfGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}{" "}
                  PDF
                </Button>
              </div>
              <div className="mobile-action-dock-secondary">
                <button type="button" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" /> 인쇄
                </button>
                <button type="button" onClick={shareTrip}>
                  <Share2 className="h-3.5 w-3.5" /> 공유
                </button>
                <button type="button" onClick={downloadStopsCsv}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                </button>
                <button
                  type="button"
                  onClick={downloadCalendar}
                  disabled={!destinations.length || calendarDownloading}
                >
                  {calendarDownloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CalendarPlus className="h-3.5 w-3.5" />
                  )}{" "}
                  캘린더
                </button>
              </div>
            </div>
          </section>

          <section
            id="saved-plans"
            className="saved-plans-archive mt-16 border-t border-black/15 pt-7 print:hidden"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-label text-[#c4503d]">Archive</p>
                <h2 className="font-display mt-2 break-keep text-4xl">
                  저장한 출장 계획
                </h2>
              </div>
              <p className="text-sm text-stone-500">
                최근 저장한 동선을 다시 불러오고 관리합니다.
              </p>
            </div>
            {plans.isLoading ? (
              <p className="py-8 text-sm text-stone-500">
                계획을 불러오는 중입니다.
              </p>
            ) : plans.data?.length ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {plans.data.map(plan => (
                  <article
                    key={plan.id}
                    className="border border-black/15 bg-[#eee9de] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="section-label">
                        {toIsoDate(plan.tripDate)} / {plan.managerName}
                      </p>
                      {plan.isTemplate ? (
                        <span className="inline-flex shrink-0 items-center gap-1 border border-[#c4503d]/35 bg-[#f4e8da] px-2 py-1 text-[9px] font-bold tracking-[.06em] text-[#9c4538]">
                          <Repeat2 className="h-3 w-3" /> 반복 템플릿
                        </span>
                      ) : null}
                    </div>
                    <h3 className="font-display mt-3 text-3xl">{plan.title}</h3>
                    <p className="mt-4 text-sm text-stone-600">
                      {asNumber(plan.routeDistanceKm).toFixed(1)}km ·{" "}
                      {plan.routeDurationMinutes}분
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Button
                        onClick={() => setSelectedPlanId(plan.id)}
                        variant="outline"
                        className="rounded-none border-black/20 bg-transparent"
                      >
                        불러오기
                      </Button>
                      <Button
                        onClick={() => {
                          void duplicateTrip(plan.id);
                        }}
                        variant="outline"
                        className="rounded-none border-black/20 bg-transparent"
                      >
                        <Copy className="mr-2 h-3.5 w-3.5" /> 복제
                      </Button>
                      {plan.access === "owner" ? (
                        <Button
                          onClick={() =>
                            toggleTripTemplate.mutate({
                              tripId: plan.id,
                              isTemplate: !plan.isTemplate,
                            })
                          }
                          disabled={toggleTripTemplate.isPending}
                          variant="outline"
                          className="rounded-none border-[#c4503d]/35 bg-transparent text-[#9c4538]"
                        >
                          <Repeat2 className="mr-2 h-3.5 w-3.5" />{" "}
                          {plan.isTemplate ? "템플릿 해제" : "템플릿 지정"}
                        </Button>
                      ) : null}
                      {plan.isTemplate && plan.access === "owner" ? (
                        <Button
                          onClick={() => openBatchDialog(plan)}
                          variant="outline"
                          className="rounded-none border-[#2f6557]/35 bg-transparent text-[#2f6557]"
                        >
                          <CalendarDays className="mr-2 h-3.5 w-3.5" /> 일괄
                          생성
                        </Button>
                      ) : null}
                      <Button
                        onClick={() => {
                          if (window.confirm("이 출장 계획을 삭제할까요?"))
                            removeTrip.mutate({ id: plan.id });
                        }}
                        variant="ghost"
                        className="ml-auto rounded-none text-stone-500 hover:text-[#c4503d]"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> 삭제
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 border border-dashed border-black/15 py-10 text-center text-sm text-stone-500">
                아직 저장한 출장 계획이 없습니다.
              </div>
            )}
          </section>
        </div>
        {activeWorkspace === "operations" ? (
          <section
            className="operations-board print:hidden"
            aria-label="운영 분석 및 이슈 보드"
          >
            <header className="operations-board-header">
              <div>
                <p className="section-label text-[#c4503d]">
                  Operations intelligence
                </p>
                <h2 className="font-display mt-2 text-4xl">운영 보드</h2>
                <p>
                  저장된 출장 데이터와 현재 계획을 바탕으로 완료·이슈·후속
                  조치를 한 화면에서 관리합니다.
                </p>
              </div>
              <div className="operations-board-period">
                <CalendarDays className="h-4 w-4" />
                <span>최근 6개월</span>
              </div>
            </header>
            <div className="operations-board-metrics">
              <article>
                <span>저장 출장</span>
                <strong>
                  {analytics.data?.totalTrips ?? 0}
                  <em>건</em>
                </strong>
                <small>권한 있는 출장 기준</small>
              </article>
              <article>
                <span>목적지 완료율</span>
                <strong>
                  {analytics.data?.completionRate ?? 0}
                  <em>%</em>
                </strong>
                <small>
                  완료 {analytics.data?.completedStops ?? 0} /{" "}
                  {analytics.data?.totalStops ?? 0}
                </small>
              </article>
              <article
                className={
                  (analytics.data?.openIssues ?? 0)
                    ? "operations-board-metric-alert"
                    : ""
                }
              >
                <span>미해결 이슈</span>
                <strong>
                  {analytics.data?.openIssues ?? 0}
                  <em>건</em>
                </strong>
                <small>해결 기록 {analytics.data?.resolvedIssues ?? 0}건</small>
              </article>
              <article
                className={
                  issueSummary.overdue ? "operations-board-metric-alert" : ""
                }
              >
                <span>현재 계획 기한 경과</span>
                <strong>
                  {issueSummary.overdue}
                  <em>건</em>
                </strong>
                <small>미해결 이슈 {issueSummary.unresolved}건</small>
              </article>
            </div>
            <div className="operations-board-grid">
              <article className="operations-analysis-panel">
                <div className="operations-panel-heading">
                  <div>
                    <p className="section-label">6-month trace</p>
                    <h3>월별 현장 완료·이슈</h3>
                  </div>
                  <small>실제 저장 데이터</small>
                </div>
                <div className="operations-month-chart">
                  {(analytics.data?.monthly ?? []).map(month => {
                    const max = Math.max(
                      1,
                      ...(analytics.data?.monthly ?? []).flatMap(item => [
                        item.completed,
                        item.issues,
                      ])
                    );
                    return (
                      <div key={month.key} className="operations-month">
                        <div className="operations-bars">
                          <span
                            className="operations-bar operations-bar-complete"
                            style={{
                              height: `${Math.max(5, Math.round((month.completed / max) * 100))}%`,
                            }}
                            title={`완료 ${month.completed}건`}
                          />
                          <span
                            className="operations-bar operations-bar-issue"
                            style={{
                              height: `${Math.max(3, Math.round((month.issues / max) * 100))}%`,
                            }}
                            title={`이슈 ${month.issues}건`}
                          />
                        </div>
                        <strong>{month.label}</strong>
                        <small>{month.trips}회</small>
                      </div>
                    );
                  })}
                </div>
                <div className="operations-chart-legend">
                  <span>
                    <i className="operations-legend-complete" />
                    완료 목적지
                  </span>
                  <span>
                    <i className="operations-legend-issue" />
                    이슈 목적지
                  </span>
                </div>
              </article>
              <article className="operations-search-panel">
                <div className="operations-panel-heading">
                  <div>
                    <p className="section-label">Quick navigation</p>
                    <h3>통합 검색·빠른 이동</h3>
                  </div>
                  <Search className="h-4 w-4" />
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <Input
                    value={archiveQuery}
                    onChange={event => setArchiveQuery(event.target.value)}
                    placeholder="출장명·부서·담당자·현재 목적지 검색"
                    className="h-10 rounded-none border-black/15 bg-[#fffdf7] pl-9"
                  />
                </div>
                {archiveQuery.trim() ? (
                  <div className="operations-search-results">
                    <p>저장 출장 {filteredPlans.length}건</p>
                    {filteredPlans.slice(0, 4).map(plan => (
                      <button
                        type="button"
                        key={plan.id}
                        onClick={() => {
                          setSelectedPlanId(plan.id);
                          setActiveWorkspace("planner");
                        }}
                      >
                        <span>{plan.title}</span>
                        <small>
                          {plan.department || plan.managerName} ·{" "}
                          {toIsoDate(plan.tripDate)}
                        </small>
                      </button>
                    ))}
                    {destinations
                      .filter(destination =>
                        [
                          destination.name,
                          destination.address,
                          destination.issueNote ?? "",
                          destination.issueOwner ?? "",
                        ].some(value =>
                          value
                            .toLocaleLowerCase("ko-KR")
                            .includes(
                              archiveQuery.trim().toLocaleLowerCase("ko-KR")
                            )
                        )
                      )
                      .slice(0, 3)
                      .map(destination => (
                        <button
                          type="button"
                          key={`current-${destination.id}`}
                          onClick={() => {
                            setActiveWorkspace("planner");
                            window.setTimeout(
                              () =>
                                document
                                  .getElementById(
                                    `destination-${destination.id}`
                                  )
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                  }),
                              0
                            );
                          }}
                        >
                          <span>현재 · {destination.name}</span>
                          <small>
                            {destination.issueNote || destination.address}
                          </small>
                        </button>
                      ))}
                  </div>
                ) : (
                  <p className="operations-search-hint">
                    저장 출장, 부서, 담당자와 현재 목적지·이슈를 함께 찾습니다.
                  </p>
                )}
              </article>
            </div>
            <section className="operations-department-panel">
              <div className="operations-panel-heading">
                <div>
                  <p className="section-label">Department performance</p>
                  <h3>부서별 완료율</h3>
                </div>
                <small>최근 6개월 · 실제 목적지 기준</small>
              </div>
              {analytics.data?.departments.length ? (
                <div className="operations-department-list">
                  {analytics.data.departments.map(item => (
                    <article key={item.department}>
                      <div>
                        <strong>{item.department}</strong>
                        <small>
                          완료 {item.completedStops} / {item.totalStops} 목적지
                        </small>
                      </div>
                      <div>
                        <span>
                          <i style={{ width: `${item.completionRate}%` }} />
                        </span>
                        <strong>{item.completionRate}%</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="operations-department-empty">
                  저장된 부서별 목적지 데이터가 아직 없습니다.
                </p>
              )}
            </section>
            <section className="operations-issue-board">
              <div className="operations-panel-heading">
                <div>
                  <p className="section-label text-[#c4503d]">
                    Issue ownership
                  </p>
                  <h3>현장 이슈 보드</h3>
                </div>
                <span
                  className={
                    issueSummary.overdue
                      ? "operations-issue-count operations-issue-count-alert"
                      : "operations-issue-count"
                  }
                >
                  미해결 {issueSummary.unresolved}건 · 기한 경과{" "}
                  {issueSummary.overdue}건
                </span>
              </div>
              {destinations.filter(
                destination =>
                  destination.executionStatus === "issue" ||
                  destination.issueNote
              ).length ? (
                <div className="operations-issue-list">
                  {destinations
                    .filter(
                      destination =>
                        destination.executionStatus === "issue" ||
                        destination.issueNote
                    )
                    .map((destination, index) => {
                      const isOverdue = Boolean(
                        destination.issueDueAt &&
                          !destination.issueResolvedAt &&
                          new Date(
                            `${destination.issueDueAt}T23:59:59`
                          ).getTime() < Date.now()
                      );
                      return (
                        <article
                          key={destination.id}
                          className={
                            isOverdue
                              ? "operations-issue-card operations-issue-card-overdue"
                              : "operations-issue-card"
                          }
                        >
                          <div>
                            <span className="operations-issue-index">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <p>
                              <strong>{destination.name}</strong>
                              <small>{destination.address}</small>
                            </p>
                            {destination.issueNote ? (
                              <blockquote>{destination.issueNote}</blockquote>
                            ) : (
                              <p className="operations-issue-empty">
                                이슈 기록을 입력해 주세요.
                              </p>
                            )}
                          </div>
                          <div className="operations-issue-controls">
                            <label>
                              담당자
                              <Input
                                value={destination.issueOwner ?? ""}
                                onChange={event =>
                                  setDestinations(previous =>
                                    previous.map(item =>
                                      item.id === destination.id
                                        ? {
                                            ...item,
                                            issueOwner: event.target.value,
                                          }
                                        : item
                                    )
                                  )
                                }
                                onBlur={event =>
                                  setDestinationExecution(
                                    destination.id,
                                    "issue",
                                    destination.issueNote,
                                    { issueOwner: event.target.value }
                                  )
                                }
                                placeholder="성명 또는 역할"
                              />
                            </label>
                            <label>
                              조치 기한
                              <Input
                                type="date"
                                value={destination.issueDueAt ?? ""}
                                onChange={event =>
                                  setDestinations(previous =>
                                    previous.map(item =>
                                      item.id === destination.id
                                        ? {
                                            ...item,
                                            issueDueAt:
                                              event.target.value || undefined,
                                          }
                                        : item
                                    )
                                  )
                                }
                                onBlur={event =>
                                  setDestinationExecution(
                                    destination.id,
                                    "issue",
                                    destination.issueNote,
                                    {
                                      issueDueAt:
                                        event.target.value || undefined,
                                    }
                                  )
                                }
                              />
                            </label>
                            {destination.issueResolvedAt ? (
                              <p className="operations-resolved">
                                <CheckCircle2 className="h-3.5 w-3.5" /> 해결{" "}
                                {new Intl.DateTimeFormat("ko-KR", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                }).format(
                                  new Date(destination.issueResolvedAt)
                                )}
                              </p>
                            ) : (
                              <Button
                                type="button"
                                onClick={() =>
                                  setDestinationExecution(
                                    destination.id,
                                    "completed",
                                    destination.issueNote
                                  )
                                }
                                variant="outline"
                                className="operations-resolve-button"
                              >
                                <Check className="mr-2 h-3.5 w-3.5" /> 조치 완료
                              </Button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                </div>
              ) : (
                <div className="operations-issue-empty-state">
                  <AlertTriangle className="h-5 w-5" />
                  <p>등록된 현장 이슈가 없습니다.</p>
                  <small>
                    여정 설계에서 목적지 상태를 ‘이슈’로 지정하면 이곳에서
                    담당자와 조치 기한을 관리할 수 있습니다.
                  </small>
                </div>
              )}
            </section>
          </section>
        ) : null}
        {activeWorkspace === "operations" && selectedPlanId !== null ? (
          <section
            className="collaboration-panel print:hidden"
            aria-label="부서 협업 권한 관리"
          >
            <header className="operations-panel-heading">
              <div>
                <p className="section-label text-[#c4503d]">
                  Department collaboration
                </p>
                <h3>부서·협업 권한</h3>
              </div>
              <span
                className={
                  canManageCollaboration
                    ? "collaboration-role collaboration-role-owner"
                    : selectedAccess === "editor"
                      ? "collaboration-role collaboration-role-editor"
                      : "collaboration-role"
                }
              >
                {canManageCollaboration
                  ? "소유자"
                  : selectedAccess === "editor"
                    ? "편집자"
                    : "열람자"}
              </span>
            </header>
            <div className="collaboration-layout">
              <div className="collaboration-department">
                <label>
                  부서 분류
                  <Input
                    value={department}
                    disabled={!canManageCollaboration}
                    onChange={event => setDepartment(event.target.value)}
                    onBlur={event => {
                      if (canManageCollaboration)
                        updateDepartment.mutate({
                          tripId: selectedPlanId,
                          department: event.target.value.trim() || null,
                        });
                    }}
                    placeholder="예: 건설과"
                  />
                </label>
                <p>
                  {canManageCollaboration
                    ? "부서명은 출장 소유자만 변경할 수 있습니다."
                    : "이 계획은 협업 권한에 따라 열람 또는 현장 실행만 가능합니다."}
                </p>
              </div>
              {canManageCollaboration ? (
                <form
                  className="collaboration-invite"
                  onSubmit={event => {
                    event.preventDefault();
                    if (!collaboratorEmail.trim())
                      return toast.error("협업자 이메일을 입력해 주세요.");
                    inviteCollaborator.mutate({
                      tripId: selectedPlanId,
                      email: collaboratorEmail.trim(),
                      permission: collaboratorPermission,
                    });
                  }}
                >
                  <label>
                    협업자 이메일
                    <Input
                      type="email"
                      value={collaboratorEmail}
                      onChange={event =>
                        setCollaboratorEmail(event.target.value)
                      }
                      placeholder="가입한 사용자 이메일"
                    />
                  </label>
                  <label>
                    권한
                    <select
                      value={collaboratorPermission}
                      onChange={event =>
                        setCollaboratorPermission(
                          event.target.value as "viewer" | "editor"
                        )
                      }
                    >
                      <option value="viewer">열람자</option>
                      <option value="editor">편집자</option>
                    </select>
                  </label>
                  <Button
                    type="submit"
                    disabled={inviteCollaborator.isPending}
                    className="collaboration-invite-button"
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" /> 초대·권한 적용
                  </Button>
                </form>
              ) : null}
            </div>
            {canManageCollaboration ? (
              <div className="collaboration-list">
                {collaborators.isLoading ? (
                  <p>협업자를 불러오는 중입니다.</p>
                ) : collaborators.data?.length ? (
                  collaborators.data.map(collaborator => (
                    <article key={collaborator.id}>
                      <div>
                        <strong>{collaborator.name || "이름 미입력"}</strong>
                        <small>{collaborator.email || "이메일 미입력"}</small>
                      </div>
                      <div>
                        <select
                          value={collaborator.permission}
                          onChange={event =>
                            inviteCollaborator.mutate({
                              tripId: selectedPlanId,
                              email: collaborator.email ?? "",
                              permission: event.target.value as
                                | "viewer"
                                | "editor",
                            })
                          }
                          disabled={!collaborator.email}
                        >
                          <option value="viewer">열람자</option>
                          <option value="editor">편집자</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            removeCollaborator.mutate({
                              tripId: selectedPlanId,
                              collaboratorId: collaborator.id,
                            })
                          }
                          aria-label={`${collaborator.name || collaborator.email || "협업자"} 제거`}
                        >
                          <X className="h-3.5 w-3.5" /> 제거
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="collaboration-empty">
                    현재 협업자가 없습니다. 이미 가입한 사용자의 이메일로 초대할
                    수 있습니다.
                  </p>
                )}
              </div>
            ) : (
              <p className="collaboration-viewer-note">
                {selectedAccess === "editor"
                  ? "편집 권한으로 현장 실행 상태·체크리스트·이슈를 갱신할 수 있습니다. 협업자 관리와 부서 변경은 소유자만 가능합니다."
                  : "열람 권한으로 계획·현장 기록을 확인할 수 있습니다. 상태 변경, 협업자 관리와 삭제는 제한됩니다."}
              </p>
            )}
          </section>
        ) : null}
        {activeWorkspace === "records" ? (
          <FieldRecordPanel
            records={filteredFieldRecords}
            allRecords={fieldRecords}
            filter={fieldRecordFilter}
            selectedKeys={visibleSelectedFieldRecordKeys}
            recentSearches={recentFieldRecordSearches}
            recentSearchesOpen={recentSearchesOpen}
            onFilterChange={updateFieldRecordFilter}
            onToggleSelection={toggleFieldRecordSelection}
            onToggleVisibleSelection={toggleVisibleFieldRecordSelection}
            onOpenPhoto={setActivePhoto}
            onDownloadPdf={downloadFieldRecordPdf}
            onSearchFocus={() => setRecentSearchesOpen(true)}
            onApplyRecentSearch={applyRecentFieldRecordSearch}
            onSaveCurrentSearch={saveCurrentFieldRecordSearch}
            onRemoveRecentSearch={removeFieldRecordSearch}
            onClearRecentSearches={() => setRecentFieldRecordSearches([])}
            isPdfGenerating={fieldRecordPdfGenerating}
          />
        ) : null}
        {activeWorkspace === "report" ? (
          <section
            className="result-report-workspace print:hidden"
            aria-label="출장 결과 보고서 초안"
          >
            <header className="result-report-header">
              <div>
                <p className="section-label text-[#c4503d]">
                  Trip result draft
                </p>
                <h2 className="font-display mt-2 text-4xl">출장 결과 보고서</h2>
                <p>
                  현재 계획의 이동 경로, 실행 상태, 이슈, 체크리스트와 현장
                  증빙을 바탕으로 초안을 구성합니다. 문안은 바로 수정할 수
                  있습니다.
                </p>
              </div>
              <div className="result-report-status">
                <FileText className="h-4 w-4" />
                <span>
                  {selectedPlanId === null
                    ? "미저장 계획 · 로컬 초안"
                    : resultReportDraft
                      ? "저장된 초안"
                      : "자동 초안 준비"}
                </span>
              </div>
            </header>
            <div className="result-report-summary">
              <article>
                <span>완료</span>
                <strong>
                  {operationSummary.completed}/{operationSummary.total}
                </strong>
                <small>목적지 실행 결과</small>
              </article>
              <article>
                <span>이슈</span>
                <strong>{issueSummary.unresolved}</strong>
                <small>미해결 · 기한 경과 {issueSummary.overdue}</small>
              </article>
              <article>
                <span>현장 증빙</span>
                <strong>{fieldRecords.length}</strong>
                <small>사진 기록 수</small>
              </article>
              <article>
                <span>체크리스트</span>
                <strong>{getChecklistProgress(checklist).completed}/3</strong>
                <small>운영 확인 항목</small>
              </article>
            </div>
            <div className="result-report-actions">
              <Button
                type="button"
                onClick={generateResultReportDraft}
                disabled={!canOperatePlan}
                className="route-action-primary"
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> 자동 초안 생성
              </Button>
              <Button
                type="button"
                onClick={saveResultReportDraft}
                disabled={!canOperatePlan || updateReportDraft.isPending}
                variant="outline"
                className="route-action-secondary"
              >
                {updateReportDraft.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}{" "}
                초안 저장
              </Button>
              <Button
                type="button"
                onClick={() => void downloadResultReportHwpx()}
                disabled={resultReportHwpxGenerating}
                variant="outline"
                className="route-action-secondary"
              >
                {resultReportHwpxGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}{" "}
                결과 HWPX
              </Button>
              <Button
                type="button"
                onClick={() => void downloadResultReportPdf()}
                disabled={resultReportPdfGenerating}
                variant="outline"
                className="route-action-secondary"
              >
                {resultReportPdfGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}{" "}
                결과 PDF
              </Button>
            </div>
            <div className="result-report-editor">
              {(
                [
                  {
                    key: "overview",
                    label: "01 / 출장 개요",
                    hint: "출장 목적·일정·출발 기준과 이동 개요를 확인하세요.",
                  },
                  {
                    key: "outcome",
                    label: "02 / 수행 결과",
                    hint: "완료율·체크리스트·현장 증빙 요약을 수정하세요.",
                  },
                  {
                    key: "issueActions",
                    label: "03 / 이슈 및 조치",
                    hint: "담당자·기한·해결 상태와 필요한 조치 내용을 검토하세요.",
                  },
                  {
                    key: "followUp",
                    label: "04 / 후속 계획",
                    hint: "재방문, 추가 조치, 공유 계획을 구체화하세요.",
                  },
                ] as const
              ).map(section => (
                <label key={section.key}>
                  <span>
                    <strong>{section.label}</strong>
                    <small>{section.hint}</small>
                  </span>
                  <textarea
                    value={
                      (resultReportDraft ?? resultReportPreview)[section.key]
                    }
                    disabled={!canOperatePlan}
                    onChange={event =>
                      setResultReportDraft(previous => ({
                        ...(previous ?? resultReportPreview),
                        [section.key]: event.target.value,
                      }))
                    }
                    maxLength={4000}
                  />
                </label>
              ))}
            </div>
            {!canOperatePlan ? (
              <p className="result-report-readonly">
                열람 권한으로는 자동 생성 결과를 확인하고 PDF 또는 HWPX로 출력할
                수 있습니다. 문안 수정·저장은 편집 권한이 필요합니다.
              </p>
            ) : selectedPlanId === null ? (
              <p className="result-report-readonly">
                현재 계획에서도 초안을 작성·PDF 또는 HWPX로 출력할 수 있습니다.
                다음에도 이어서 편집하려면 먼저 출장 계획을 저장하세요.
              </p>
            ) : null}
          </section>
        ) : null}
        {activeWorkspace === "report" ? (
          <HwpxReportPreview
            title={title}
            tripDate={tripDate}
            managerName={managerName}
            department={department}
            draft={resultReportDraft ?? resultReportPreview}
            evidence={includedResultReportEvidence}
          />
        ) : null}
      </div>

      {activeWorkspace === "report" ? (
        <ResultReportEvidencePreview
          evidence={resultReportEvidence}
          excludedKeys={resultReportDraft?.excludedEvidenceKeys ?? []}
          canReorder={canOperatePlan}
          draggedKey={draggedEvidenceKey}
          onDragStart={setDraggedEvidenceKey}
          onDragEnd={() => setDraggedEvidenceKey(null)}
          onReorder={reorderResultReportEvidence}
          onMove={moveResultReportEvidence}
          onToggleIncluded={toggleResultReportEvidence}
          onOpenPhoto={setActivePhoto}
        />
      ) : null}
      <PdfReport
        reportRef={reportRef}
        title={title}
        tripDate={tripDate}
        managerName={managerName}
        fixedStart={fixedStart}
        returnToStart={returnToStart}
        destinations={destinations}
        checklist={checklist}
        distanceKm={routeSummary.totalDistanceKm}
        durationMinutes={routeSummary.estimatedMinutes}
        routePoints={pdfRoutePoints}
      />
      <FieldRecordPdfReport
        reportRef={fieldRecordPdfRef}
        title={title}
        tripDate={tripDate}
        managerName={managerName}
        records={selectedFieldRecords}
      />
      <TripResultReportPdfWithEvidence
        reportRef={resultReportPdfRef}
        title={title}
        tripDate={tripDate}
        managerName={managerName}
        department={department}
        draft={resultReportDraft ?? resultReportPreview}
        destinations={destinations}
      />
      <Dialog
        open={draftRestoreOpen}
        onOpenChange={open => {
          if (!open) setDraftRestoreOpen(false);
        }}
      >
        <DialogContent className="trip-draft-dialog rounded-none border-[#1f2d2b]/20 bg-[#f7f2e9] p-5 sm:max-w-md sm:p-7">
          <DialogHeader>
            <p className="section-label text-[#c4503d]">Draft recovery</p>
            <DialogTitle className="font-display text-4xl font-normal">
              작성 중인 계획이 있습니다
            </DialogTitle>
            <DialogDescription className="leading-6 text-stone-600">
              {availableDraft
                ? `${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(availableDraft.updatedAt))}에 저장된 임시 초안입니다. 브라우저와 계정에 보관되어 다른 기기에서도 이어서 작성할 수 있습니다.`
                : "저장된 임시 초안을 불러오는 중입니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="trip-draft-dialog-actions">
            <Button
              type="button"
              variant="outline"
              onClick={clearStoredTripDraft}
              className="route-action-tertiary"
            >
              초안 비우기
            </Button>
            <Button
              type="button"
              onClick={restoreAvailableTripDraft}
              disabled={!availableDraft}
              className="route-action-primary"
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> 이어서 작성
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={newPlanConfirmOpen} onOpenChange={setNewPlanConfirmOpen}>
        <DialogContent className="new-plan-dialog rounded-none border-[#1f2d2b]/20 bg-[#f7f2e9] p-5 sm:max-w-md sm:p-7">
          <DialogHeader>
            <p className="section-label text-[#c4503d]">New trip dossier</p>
            <DialogTitle className="font-display text-4xl font-normal">
              새 계획을 시작할까요?
            </DialogTitle>
            <DialogDescription className="leading-6 text-stone-600">
              현재 입력한 출장 정보, 목적지, 출발지와 현장 기록 선택 상태를
              비웁니다. 이미 저장한 출장 계획은 그대로 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="new-plan-dialog-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewPlanConfirmOpen(false)}
              className="route-action-tertiary"
            >
              계속 작성
            </Button>
            <Button
              type="button"
              onClick={startNewPlan}
              className="route-action-primary"
            >
              <Plus className="mr-2 h-4 w-4" /> 새 계획 시작
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={batchDialogOpen}
        onOpenChange={open => {
          setBatchDialogOpen(open);
          if (!open) setBatchTemplateId(null);
        }}
      >
        <DialogContent className="rounded-none border-[#1f2d2b]/20 bg-[#f7f2e9] p-5 sm:max-w-lg sm:p-7">
          <DialogHeader>
            <p className="section-label text-[#c4503d]">Repeat trip batch</p>
            <DialogTitle className="font-display text-4xl font-normal">
              반복 출장 일괄 생성
            </DialogTitle>
            <DialogDescription className="leading-6 text-stone-600">
              {selectedBatchTemplate
                ? `${selectedBatchTemplate.title}의 출발지·목적지·경로를 복사해 여러 날짜의 새 계획을 만듭니다.`
                : "템플릿 정보를 불러오는 중입니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid gap-4">
            <label className="editorial-label">
              계획명 접두어
              <Input
                value={batchTitlePrefix}
                onChange={event => setBatchTitlePrefix(event.target.value)}
                placeholder="예: 하천 정기 점검"
                className="editorial-input"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="editorial-label">
                담당자
                <Input
                  value={batchManagerName}
                  onChange={event => setBatchManagerName(event.target.value)}
                  placeholder="비워두면 템플릿 담당자 사용"
                  className="editorial-input"
                />
              </label>
              <label className="editorial-label">
                부서
                <Input
                  value={batchDepartment}
                  onChange={event => setBatchDepartment(event.target.value)}
                  placeholder="비워두면 템플릿 부서 사용"
                  className="editorial-input"
                />
              </label>
            </div>
            <label className="editorial-label">
              생성할 출장일{" "}
              <textarea
                value={batchDatesText}
                onChange={event => setBatchDatesText(event.target.value)}
                placeholder="날짜를 줄바꿈·쉼표·세미콜론으로 구분하세요. 예: 2026-09-01\n2026-09-15\n2026-10-01"
                className="mt-2 min-h-28 w-full resize-y border border-black/15 bg-[#fffdf7]/70 p-3 text-sm font-medium tracking-normal text-[#1f2d2b] outline-none transition focus:border-[#c4503d]"
                maxLength={4000}
              />
              <span className="mt-2 block font-normal tracking-normal text-stone-500">
                {batchDatePreview.dates.length}개 생성 예정
                {batchDatePreview.duplicates.length
                  ? ` · 중복 ${batchDatePreview.duplicates.length}개`
                  : ""}
                {batchDatePreview.invalid.length
                  ? ` · 형식 오류 ${batchDatePreview.invalid.length}개`
                  : ""}
              </span>
            </label>
            <div className="border-l-2 border-[#c4503d] bg-[#eee7da] px-3 py-2 text-xs leading-5 text-stone-600">
              각 생성 계획은 체크리스트를 초기화하고 실행 상태를 ‘예정’으로
              시작합니다. 템플릿의 사진과 기존 완료 상태는 복사하지 않습니다.
            </div>
          </div>
          <div className="new-plan-dialog-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBatchDialogOpen(false)}
              className="route-action-tertiary"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={submitBatchGeneration}
              disabled={
                createBatchTrips.isPending ||
                !selectedBatchTemplate ||
                !batchDatePreview.dates.length ||
                batchDatePreview.invalid.length > 0 ||
                batchDatePreview.duplicates.length > 0
              }
              className="route-action-primary"
            >
              {createBatchTrips.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Repeat2 className="mr-2 h-4 w-4" />
              )}
              {createBatchTrips.isPending
                ? "생성 중"
                : `${batchDatePreview.dates.length || 0}개 계획 생성`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(activePhoto)}
        onOpenChange={open => {
          if (!open) setActivePhoto(null);
        }}
      >
        <DialogContent className="field-photo-dialog max-h-[90vh] overflow-y-auto rounded-none border-[#1f2d2b]/20 bg-[#f7f2e9] p-5 sm:max-w-3xl sm:p-7">
          {activePhoto ? (
            <>
              <DialogHeader>
                <p className="section-label text-[#c4503d]">
                  Field photo · stop{" "}
                  {String(activePhoto.sequence).padStart(2, "0")}
                </p>
                <DialogTitle className="font-display text-4xl font-normal">
                  {activePhoto.destinationName}
                </DialogTitle>
                <DialogDescription className="text-stone-500">
                  {activePhoto.destinationAddress}
                </DialogDescription>
              </DialogHeader>
              <img
                className="field-photo-dialog-image"
                src={activePhoto.dataUrl ?? activePhoto.url}
                alt={`${activePhoto.destinationName} 현장 사진 확대`}
              />
              <div className="field-photo-dialog-meta">
                <p>
                  <CalendarDays className="h-4 w-4" />{" "}
                  {activePhoto.takenAt ?? "촬영일 미입력"}
                </p>
                <p>
                  {activePhoto.description ||
                    "사진 설명이 아직 입력되지 않았습니다."}
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
