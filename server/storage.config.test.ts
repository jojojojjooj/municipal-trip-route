import { describe, expect, it } from "vitest";
import { resolveStorageBackend } from "./storage";

describe("storage backend selection", () => {
  it("prefers explicitly configured S3-compatible storage", () => {
    expect(
      resolveStorageBackend({
        S3_BUCKET: "private-trip-files",
        S3_ACCESS_KEY_ID: "access",
        S3_SECRET_ACCESS_KEY: "secret",
        BUILT_IN_FORGE_API_URL: "https://forge.example",
        BUILT_IN_FORGE_API_KEY: "forge-key",
      })
    ).toBe("s3");
  });

  it("falls back to managed storage only when S3 is not configured", () => {
    expect(
      resolveStorageBackend({
        BUILT_IN_FORGE_API_URL: "https://forge.example",
        BUILT_IN_FORGE_API_KEY: "forge-key",
      })
    ).toBe("forge");
    expect(resolveStorageBackend({})).toBe("missing");
  });
});
