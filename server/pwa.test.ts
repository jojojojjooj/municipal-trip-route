import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getPwaNetworkStatusCopy,
  PWA_SERVICE_WORKER_URL,
  shouldRegisterPwaServiceWorker,
} from "../shared/pwa";

describe("현장용 PWA", () => {
  it("운영 환경에서는 등록하고 개발 환경에서는 명시적 미리보기에서만 서비스 워커를 등록한다", () => {
    expect(
      shouldRegisterPwaServiceWorker({
        isProduction: true,
        isSupported: true,
        search: "",
      })
    ).toBe(true);
    expect(
      shouldRegisterPwaServiceWorker({
        isProduction: false,
        isSupported: true,
        search: "?pwa-preview",
      })
    ).toBe(true);
    expect(
      shouldRegisterPwaServiceWorker({
        isProduction: false,
        isSupported: true,
        search: "",
      })
    ).toBe(false);
    expect(
      shouldRegisterPwaServiceWorker({
        isProduction: true,
        isSupported: false,
        search: "",
      })
    ).toBe(false);
  });

  it("온라인·오프라인 상태에 맞는 현장 복원 안내를 제공한다", () => {
    expect(getPwaNetworkStatusCopy(true)).toMatchObject({
      title: "현장 연결 상태 · 온라인",
    });
    expect(getPwaNetworkStatusCopy(false)).toMatchObject({
      title: "현장 연결 상태 · 오프라인",
    });
    expect(getPwaNetworkStatusCopy(false).detail).toContain("임시 초안");
  });

  it("매니페스트·서비스 워커·오프라인 폴백을 함께 제공한다", () => {
    const publicDirectory = path.resolve(process.cwd(), "client/public");
    const manifest = JSON.parse(
      readFileSync(path.join(publicDirectory, "manifest.json"), "utf8")
    );
    const serviceWorker = readFileSync(
      path.join(publicDirectory, PWA_SERVICE_WORKER_URL.slice(1)),
      "utf8"
    );
    const offlinePage = readFileSync(
      path.join(publicDirectory, "offline.html"),
      "utf8"
    );

    expect(manifest).toMatchObject({
      name: "출장동선",
      display: "standalone",
      start_url: "/",
    });
    expect(serviceWorker).toContain('"/offline.html"');
    expect(serviceWorker).toContain('request.mode === "navigate"');
    expect(offlinePage).toContain("인터넷 연결을 확인해 주세요.");
  });
});
