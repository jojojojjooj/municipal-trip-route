import { describe, expect, it } from "vitest";
import { makeTripPhotoDataUrl } from "../shared/tripPhoto";

describe("makeTripPhotoDataUrl", () => {
  it("creates a browser-safe data URL for an allowed field-photo type", () => {
    expect(makeTripPhotoDataUrl("image/png", "aGVsbG8=")).toBe("data:image/png;base64,aGVsbG8=");
  });

  it("rejects unsupported and empty photo payloads", () => {
    expect(() => makeTripPhotoDataUrl("image/gif", "aGVsbG8=")).toThrow("지원하지 않는 사진 형식입니다.");
    expect(() => makeTripPhotoDataUrl("image/jpeg", "")).toThrow("사진 데이터가 비어 있습니다.");
  });
});
