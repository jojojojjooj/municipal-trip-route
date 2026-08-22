import JSZip from "jszip";

export type HwpxEvidence = {
  destinationName: string;
  destinationAddress: string;
  takenAt?: string;
  description?: string;
  sequence: number;
};

export type TripResultHwpxInput = {
  title: string;
  tripDate: string;
  managerName: string;
  department?: string;
  overview: string;
  outcome: string;
  issueActions: string;
  followUp: string;
  evidence: HwpxEvidence[];
  generatedAt: string;
};

const HWPX_MIMETYPE = "application/hwp+zip";
const NS_CORE = "http://www.hancom.co.kr/hwpml/2011/core";
const NS_PARA = "http://www.hancom.co.kr/hwpml/2011/paragraph";
const NS_HEAD = "http://www.hancom.co.kr/hwpml/2011/head";

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function paragraph(text: string, id: number, heading = false) {
  const safe = escapeXml(text || " ");
  return `<hp:p id="${id}" paraPrIDRef="${heading ? 1 : 0}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${heading ? 1 : 0}"><hp:t>${safe}</hp:t></hp:run></hp:p>`;
}

function paragraphLines(text: string, idStart: number) {
  const lines = text.split(/\r?\n/).filter(line => line.trim()).map((line, index) => paragraph(line, idStart + index));
  return { xml: lines.join(""), nextId: idStart + Math.max(lines.length, 1) };
}

function createHeaderXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><hh:head xmlns:hh="${NS_HEAD}" xmlns:hc="${NS_CORE}" version="1.7"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList><hh:fontfaces><hh:fontface lang="HANGUL" count="1"><hh:font id="0" face="함초롬바탕" type="TTF"/></hh:fontface></hh:fontfaces><hh:charProperties><hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0"><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/></hh:charPr><hh:charPr id="1" height="1500" textColor="#1f2d2b" shadeColor="none" useFontSpace="0" useKerning="0" bold="1"><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/></hh:charPr></hh:charProperties><hh:paraProperties><hh:paraPr id="0" align="JUSTIFY" vertAlign="BASELINE" headingType="NONE" keepWithNext="0" keepLines="0" pageBreakBefore="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0"/><hh:paraPr id="1" align="LEFT" vertAlign="BASELINE" headingType="NONE" keepWithNext="1" keepLines="0" pageBreakBefore="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0"/></hh:paraProperties><hh:styles><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042"/></hh:styles></hh:refList></hh:head>`;
}

function createSectionXml(input: TripResultHwpxInput) {
  let id = 1;
  const parts: string[] = [];
  const pushHeading = (text: string) => { parts.push(paragraph(text, id++, true)); };
  const pushBody = (text: string) => { const body = paragraphLines(text, id); parts.push(body.xml); id = body.nextId; };
  const generatedAt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(input.generatedAt));

  pushHeading("출장 결과 보고서");
  pushBody(`출장명: ${input.title.trim() || "미저장 출장 계획"}`);
  pushBody(`출장일: ${input.tripDate || "일정 미정"}`);
  pushBody(`담당자: ${input.managerName.trim() || "미입력"}${input.department?.trim() ? ` / ${input.department.trim()}` : ""}`);
  pushBody(`생성일시: ${generatedAt}`);
  pushHeading("01 / 출장 개요");
  pushBody(input.overview);
  pushHeading("02 / 수행 결과");
  pushBody(input.outcome);
  pushHeading("03 / 이슈 및 조치");
  pushBody(input.issueActions);
  pushHeading("04 / 후속 계획");
  pushBody(input.followUp);
  pushHeading("05 / 현장 증빙 사진");
  if (!input.evidence.length) pushBody("보고서에 포함된 현장 증빙 사진이 없습니다.");
  input.evidence.forEach((photo, index) => pushBody(`사진 ${String(index + 1).padStart(2, "0")} · 방문 ${String(photo.sequence).padStart(2, "0")} · ${photo.destinationName}\n${photo.destinationAddress}\n촬영일: ${photo.takenAt || "미입력"}\n설명: ${photo.description?.trim() || "설명 미입력"}`));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><hp:sec xmlns:hp="${NS_PARA}" xmlns:hc="${NS_CORE}" version="1.7">${parts.join("")}</hp:sec>`;
}

function createContentHpf() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="1.0"><opf:manifest><opf:item id="header" href="header.xml" media-type="application/xml"/><opf:item id="section0" href="section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="section0"/></opf:spine></opf:package>`;
}

function createContainerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="Contents/content.hpf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
}

export function makeTripResultHwpxFileName(title: string, tripDate: string) {
  const safeTitle = (title.trim() || "출장결과보고서").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 70);
  const safeDate = (tripDate || "미정").replace(/[^0-9-]/g, "");
  return `${safeTitle}_${safeDate || "미정"}_결과보고서.hwpx`;
}

export async function buildTripResultHwpx(input: TripResultHwpxInput): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("mimetype", HWPX_MIMETYPE, { compression: "STORE" });
  zip.file("META-INF/container.xml", createContainerXml());
  zip.file("META-INF/manifest.xml", `<?xml version="1.0" encoding="UTF-8"?><manifest xmlns="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><file-entry full-path="/" media-type="${HWPX_MIMETYPE}"/><file-entry full-path="Contents/content.hpf" media-type="application/oebps-package+xml"/><file-entry full-path="Contents/header.xml" media-type="application/xml"/><file-entry full-path="Contents/section0.xml" media-type="application/xml"/></manifest>`);
  zip.file("Contents/content.hpf", createContentHpf());
  zip.file("Contents/header.xml", createHeaderXml());
  zip.file("Contents/section0.xml", createSectionXml(input));
  zip.file("Contents/settings.xml", `<?xml version="1.0" encoding="UTF-8"?><hs:settings xmlns:hs="http://www.hancom.co.kr/hwpml/2011/settings" version="1.7"/>`);
  zip.file("version.xml", `<?xml version="1.0" encoding="UTF-8"?><hv:version xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" targetApplication="HWP" version="1.7"/>`);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
