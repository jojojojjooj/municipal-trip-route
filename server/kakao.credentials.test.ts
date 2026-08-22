import { describe, expect, it } from "vitest";

const appKey = process.env.VITE_KAKAO_MAP_APP_KEY;
const restKey = process.env.KAKAO_REST_API_KEY;
const describeKakaoIntegration = appKey && restKey ? describe : describe.skip;

describeKakaoIntegration("Kakao Local API credentials", () => {
  it("is supplied to the server runtime without exposing it to the client", () => {
    expect(restKey).toBeTruthy();
    expect(restKey).not.toContain("KakaoAK");
  });

  it("accepts the JavaScript key for the registered preview domain", async () => {
    expect(appKey).toBeTruthy();

    const response = await fetch(`https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${appKey}`, {
      headers: {
        Referer: "https://3000-i08mm63gtrbh9gto7mwp3-d56a3847.us3.manus.computer/",
      },
    });

    expect(response.status).toBe(200);
  }, 15_000);

  it("accepts the REST key for a Local address search", async () => {
    expect(restKey).toBeTruthy();

    const response = await fetch("https://dapi.kakao.com/v2/local/search/address.json?query=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C%20%EC%A4%91%EA%B5%AC%20%EC%84%B8%EC%A2%85%EB%8C%80%EB%A1%9C%20110", {
      headers: { Authorization: `KakaoAK ${restKey}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { documents?: unknown[] };
    expect(body.documents?.length).toBeGreaterThan(0);
  }, 15_000);
});
