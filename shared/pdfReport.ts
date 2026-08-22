export function makeTripPdfFileName(title: string, tripDate: string) {
  const safeTitle = (title.trim() || "출장경로")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 70);
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(tripDate) ? tripDate : "undated";
  return `${safeDate}_${safeTitle || "출장경로"}_출장요약.pdf`;
}

export function makeFieldRecordPdfFileName(title: string, tripDate: string) {
  const safeTitle = (title.trim() || "출장경로")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 70);
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(tripDate) ? tripDate : "undated";
  return `${safeDate}_${safeTitle || "출장경로"}_현장기록.pdf`;
}

export function makeTripResultReportPdfFileName(title: string, tripDate: string) {
  const safeTitle = (title.trim() || "출장결과")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 70);
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(tripDate) ? tripDate : "undated";
  return `${safeDate}_${safeTitle || "출장결과"}_결과보고서.pdf`;
}
