export type BatchDateParseResult = {
  dates: string[];
  invalid: string[];
  duplicates: string[];
};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

export function parseBatchDates(
  input: string | string[]
): BatchDateParseResult {
  const values = Array.isArray(input) ? input : input.split(/[\s,;]+/);
  const dates: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value) continue;
    if (!isValidDate(value)) {
      invalid.push(value);
      continue;
    }
    if (seen.has(value)) {
      duplicates.push(value);
      continue;
    }
    seen.add(value);
    dates.push(value);
  }

  return { dates: dates.sort(), invalid, duplicates };
}

export function buildBatchTripTitle(titlePrefix: string, tripDate: string) {
  const prefix = titlePrefix.trim() || "반복 출장";
  return `${prefix} · ${tripDate}`.slice(0, 150);
}
