import { describe, expect, it } from "vitest";
import { getLocalPersonalUserConfig } from "./localPersonal";

describe("local personal mode", () => {
  it("creates a local administrator only in non-production mode", () => {
    expect(
      getLocalPersonalUserConfig({
        NODE_ENV: "development",
        LOCAL_PERSONAL_MODE: "true",
        LOCAL_PERSONAL_NAME: "한별",
      })
    ).toMatchObject({
      openId: "local-personal-owner",
      name: "한별",
      loginMethod: "local-personal",
      role: "admin",
    });
    expect(
      getLocalPersonalUserConfig({
        NODE_ENV: "production",
        LOCAL_PERSONAL_MODE: "true",
      })
    ).toBeNull();
  });
});
