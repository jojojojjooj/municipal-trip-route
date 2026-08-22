import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildTripResultHwpx, makeTripResultHwpxFileName } from "../shared/tripResultHwpx";

describe("trip result HWPX export", () => {
  it("creates an XML ZIP package with report text and ordered evidence metadata", async () => {
    const bytes = await buildTripResultHwpx({
      title: "시설 점검 출장",
      tripDate: "2026-08-22",
      managerName: "홍길동",
      department: "건설과",
      overview: "시설물 점검을 위해 현장을 방문했다.",
      outcome: "2개 목적지의 점검을 완료했다.",
      issueActions: "배수로 이슈는 시설팀에 전달했다.",
      followUp: "다음 주 재점검한다.",
      generatedAt: "2026-08-22T09:30:00.000Z",
      evidence: [{ destinationName: "시청 별관", destinationAddress: "서울 중구 세종대로 110", takenAt: "2026-08-22", description: "배수로 현황", sequence: 2 }],
    });

    const archive = await JSZip.loadAsync(bytes);
    expect(Object.keys(archive.files)).toEqual(expect.arrayContaining([
      "mimetype",
      "META-INF/container.xml",
      "META-INF/manifest.xml",
      "Contents/content.hpf",
      "Contents/header.xml",
      "Contents/section0.xml",
      "Contents/settings.xml",
      "version.xml",
    ]));
    await expect(archive.file("mimetype")?.async("string")).resolves.toBe("application/hwp+zip");
    const section = await archive.file("Contents/section0.xml")?.async("string");
    expect(section).toContain("출장 결과 보고서");
    expect(section).toContain("시설 점검 출장");
    expect(section).toContain("배수로 현황");
    expect(section).toContain("방문 02");
  });

  it("uses a safe HWPX download file name", () => {
    expect(makeTripResultHwpxFileName("시설/점검: 출장", "2026-08-22")).toBe("시설-점검--출장_2026-08-22_결과보고서.hwpx");
  });
});
