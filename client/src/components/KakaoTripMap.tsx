import { MAP_AUTO_RETRY_DELAY_SECONDS, MAP_AUTO_RETRY_LIMIT, getScheduledMapRetryAttempt, shouldScheduleMapRetry } from "@shared/mapConnectivity";
import { useCallback, useEffect, useRef, useState } from "react";

export type MapDestination = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  note?: string;
  photos?: { storageKey: string; url: string; fileName: string; takenAt?: string; description?: string; dataUrl?: string }[];
};

type KakaoTripMapProps = {
  destinations: MapDestination[];
  fixedStart?: MapDestination | null;
  returnToStart?: boolean;
  onMapClick: (coordinates: { latitude: number; longitude: number }) => void;
  onContinueWithoutMap?: () => void;
  retryRequestId?: number;
};

declare global {
  interface Window {
    kakao?: any;
    kakaoMapsPromise?: Promise<void>;
  }
}

function loadKakaoMaps() {
  if (window.kakao?.maps) return Promise.resolve();
  if (window.kakaoMapsPromise) return window.kakaoMapsPromise;

  const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY;
  if (!appKey) return Promise.reject(new Error("카카오 지도 JavaScript 키가 설정되지 않았습니다."));

  window.kakaoMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.kakaoMapsSdk = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${appKey}`;
    script.onload = () => window.kakao.maps.load(resolve);
    script.onerror = () => reject(new Error("카카오 지도 SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return window.kakaoMapsPromise;
}

function resetKakaoMapsLoader() {
  window.kakaoMapsPromise = undefined;
  document.querySelectorAll<HTMLScriptElement>('script[data-kakao-maps-sdk="true"]').forEach(script => script.remove());
}

export default function KakaoTripMap({ destinations, fixedStart = null, returnToStart = false, onMapClick, onContinueWithoutMap, retryRequestId = 0 }: KakaoTripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const retryTimerRef = useRef<number | undefined>(undefined);
  const countdownTimerRef = useRef<number | undefined>(undefined);

  const clearAutoRetryTimers = useCallback(() => {
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    retryTimerRef.current = undefined;
    countdownTimerRef.current = undefined;
  }, []);

  const clearMapSurface = useCallback(() => {
    layersRef.current.forEach(layer => layer.setMap?.(null));
    layersRef.current = [];
    mapRef.current = null;
    containerRef.current?.replaceChildren();
  }, []);

  const retryMap = useCallback((source: "manual" | "automatic" = "manual") => {
    clearAutoRetryTimers();
    clearMapSurface();
    resetKakaoMapsLoader();
    setMapError(null);
    setMapStatus("loading");
    setRetryCountdown(null);
    if (source === "manual") setAutoRetryCount(0);
    setRetryCount(count => count + 1);
  }, [clearAutoRetryTimers, clearMapSurface]);

  useEffect(() => {
    const markOffline = () => setIsOnline(false);
    const markOnline = () => setIsOnline(true);
    window.addEventListener("offline", markOffline);
    window.addEventListener("online", markOnline);
    return () => {
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", markOnline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let readyTimeout: number | undefined;
    setMapStatus("loading");
    setMapError(null);
    if (!isOnline) {
      clearMapSurface();
      setMapError("현재 인터넷 연결이 끊겨 있어 지도를 불러올 수 없습니다.");
      setMapStatus("error");
      return () => {
        cancelled = true;
      };
    }
    if (retryRequestId > 0) resetKakaoMapsLoader();
    const simulateFailure = import.meta.env.DEV && retryCount === 0 && new URLSearchParams(window.location.search).get("map-status-test") === "error";
    if (simulateFailure) {
      readyTimeout = window.setTimeout(() => {
        if (!cancelled) {
          setMapError("테스트용 지도 SDK 연결 실패 상태입니다.");
          setMapStatus("error");
        }
      }, 180);
      return () => {
        cancelled = true;
        if (readyTimeout) window.clearTimeout(readyTimeout);
      };
    }
    loadKakaoMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        clearMapSurface();
        if (!containerRef.current) return;
        const center = new window.kakao.maps.LatLng(35.8242, 127.148);
        const map = new window.kakao.maps.Map(containerRef.current, { center, level: 10 });
        mapRef.current = map;
        const markReady = () => {
          if (!cancelled) setMapStatus("ready");
        };
        window.kakao.maps.event.addListener(map, "tilesloaded", markReady);
        readyTimeout = window.setTimeout(markReady, 1800);
        window.kakao.maps.event.addListener(map, "click", (mouseEvent: any) => {
          const latLng = mouseEvent.latLng;
          onMapClick({ latitude: latLng.getLat(), longitude: latLng.getLng() });
        });
      })
      .catch(error => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : "지도를 불러오지 못했습니다.");
          setMapStatus("error");
        }
      });
    return () => {
      cancelled = true;
      if (readyTimeout) window.clearTimeout(readyTimeout);
    };
  }, [clearMapSurface, isOnline, onMapClick, retryCount, retryRequestId]);

  useEffect(() => {
    clearAutoRetryTimers();
    if (mapStatus !== "error" || !shouldScheduleMapRetry(isOnline, autoRetryCount)) {
      setRetryCountdown(null);
      return;
    }

    const retryAt = Date.now() + MAP_AUTO_RETRY_DELAY_SECONDS * 1000;
    const updateCountdown = () => setRetryCountdown(Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)));
    updateCountdown();
    countdownTimerRef.current = window.setInterval(updateCountdown, 250);
    retryTimerRef.current = window.setTimeout(() => {
      clearAutoRetryTimers();
      setAutoRetryCount(current => current + 1);
      setRetryCountdown(null);
      retryMap("automatic");
    }, MAP_AUTO_RETRY_DELAY_SECONDS * 1000);

    return clearAutoRetryTimers;
  }, [autoRetryCount, clearAutoRetryTimers, isOnline, mapStatus, retryMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;
    layersRef.current.forEach(layer => layer.setMap?.(null));
    layersRef.current = [];

    const bounds = new window.kakao.maps.LatLngBounds();
    const routeLocations = fixedStart ? [fixedStart, ...destinations, ...(returnToStart ? [fixedStart] : [])] : destinations;
    const path = routeLocations.map((destination, index) => {
      const isFixedStart = fixedStart?.id === destination.id;
      const isReturn = returnToStart && isFixedStart && index === routeLocations.length - 1;
      const position = new window.kakao.maps.LatLng(destination.latitude, destination.longitude);
      bounds.extend(position);
      const marker = new window.kakao.maps.Marker({ map, position, title: isReturn ? `복귀지 · ${destination.name}` : isFixedStart ? `출발지 · ${destination.name}` : `${destination.name}${destination.note ? ` · 메모: ${destination.note}` : ""}${destination.photos?.length ? ` · 사진 ${destination.photos.length}장` : ""}` });
      const label = new window.kakao.maps.CustomOverlay({
        map,
        position,
        content: isReturn ? `<div class="map-return-label">복귀</div>` : isFixedStart ? `<div class="map-origin-label">출발</div>` : `<div class="map-number-label">${index}</div>`,
        yAnchor: 2.1,
      });
      layersRef.current.push(marker, label);
      return position;
    });

    if (path.length > 1) {
      const polyline = new window.kakao.maps.Polyline({
        map,
        path,
        strokeWeight: 4,
        strokeColor: "#e2583e",
        strokeOpacity: 0.88,
        strokeStyle: "solid",
      });
      layersRef.current.push(polyline);
    }
    if (path.length === 1) map.setCenter(path[0]);
    if (path.length > 1) map.setBounds(bounds);
  }, [destinations, fixedStart, returnToStart]);

  return (
    <div className="relative h-full min-h-[410px] overflow-hidden bg-[#e6e2d8]">
      <div ref={containerRef} className="h-full min-h-[410px] w-full" aria-label="출장 목적지 지도" />
      <div className="map-cartographic-guides pointer-events-none absolute inset-0" aria-hidden="true"><span className="map-guide-corner map-guide-corner-top" /><span className="map-guide-corner map-guide-corner-bottom" /><span className="map-guide-axis map-guide-axis-x">EASTING</span><span className="map-guide-axis map-guide-axis-y">NORTHING</span></div>
      <div className="map-field-status" aria-live="polite">
        <span className={`map-field-status-dot ${!isOnline ? "map-field-status-dot-offline" : mapStatus === "ready" ? "map-field-status-dot-ready" : ""}`} />
        <div><p>FIELD MAP</p><strong>{!isOnline ? "OFFLINE" : mapStatus === "ready" ? "LIVE CONNECTION" : mapStatus === "error" ? "RECOVERY MODE" : "CONNECTING"}</strong></div>
        <span className="map-field-status-stops">{fixedStart ? "START FIXED" : `${String(destinations.length).padStart(2, "0")} STOPS`}</span>
      </div>
      {mapStatus === "ready" ? <div className="map-operational-reference pointer-events-none" aria-hidden="true"><span>GRID REF</span><strong>{fixedStart ? "FIXED START" : "OPEN ROUTE"}</strong><small>{String(destinations.length).padStart(2, "0")} POINTS · KAKAO MAP</small></div> : null}
      <div
        className={`map-skeleton pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ease-out ${mapStatus === "loading" ? "opacity-100" : "opacity-0"}`}
        aria-hidden={mapStatus !== "loading"}
      >
        <div className="map-skeleton-grid absolute inset-0" />
        <div className="absolute inset-x-7 top-7 flex items-center justify-between">
          <div className="h-2 w-28 bg-[#1f2d2b]/12" />
          <div className="h-2 w-14 bg-[#1f2d2b]/10" />
        </div>
        <div className="absolute left-[18%] top-[26%] h-9 w-9 rounded-full border border-[#c4503d]/35 bg-[#fffdf7]/65 shadow-[0_8px_22px_rgba(31,45,43,.08)]" />
        <div className="absolute bottom-[29%] right-[22%] h-5 w-5 rounded-full border border-[#1f2d2b]/20 bg-[#fffdf7]/60" />
        <div className="absolute bottom-7 left-7 flex items-center gap-3 border border-black/10 bg-[#fffdf7]/80 px-4 py-3 backdrop-blur-sm">
          <span className="map-skeleton-dot h-2 w-2 rounded-full bg-[#c4503d]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#1f2d2b]">Map loading</p>
            <p className="mt-1 text-xs text-stone-500">출장 지도를 준비하고 있습니다.</p>
          </div>
        </div>
        {autoRetryCount > 0 ? <div className="absolute right-7 top-7 border border-black/10 bg-[#fffdf7]/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[.13em] text-[#4a514e] backdrop-blur-sm">
          자동 재시도 {autoRetryCount}/{MAP_AUTO_RETRY_LIMIT}
        </div> : null}
      </div>
      {mapError ? (
        <div className="map-error-shell absolute inset-0 z-20 grid place-items-center bg-[#ece8df] p-8 text-center">
          <div className="map-error-panel">
            <p className="font-display text-3xl">지도 연결을 확인해 주세요</p>
            <p className="mt-3 max-w-xs text-sm leading-6 text-stone-600">{mapError}</p>
            <p className={`map-connectivity-status mt-4 ${isOnline ? "" : "map-connectivity-status-offline"}`} role="status" aria-live="polite">
              {!isOnline
                ? "오프라인 상태입니다. 인터넷이 복구되면 지도 연결을 다시 시작합니다."
                : retryCountdown !== null
                  ? `자동 재시도 예정 ${getScheduledMapRetryAttempt(autoRetryCount)}/${MAP_AUTO_RETRY_LIMIT} · ${retryCountdown}초 후 연결합니다.`
                  : autoRetryCount >= MAP_AUTO_RETRY_LIMIT
                    ? `자동 재시도 ${MAP_AUTO_RETRY_LIMIT}회를 완료했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.`
                    : "지도 연결 상태를 확인하고 있습니다."}
            </p>
            <div className="map-error-actions mt-6">
              <button type="button" className="map-retry-button" onClick={() => retryMap()} disabled={!isOnline}>
                {isOnline ? "지금 다시 시도" : "네트워크 복구 대기 중"}
              </button>
              {onContinueWithoutMap ? <button type="button" className="map-list-mode-button" onClick={onContinueWithoutMap}>
                주소 목록으로 계속
              </button> : null}
            </div>
          </div>
        </div>
      ) : mapStatus === "ready" ? (
        <div className="map-ready-instruction pointer-events-none absolute bottom-5 left-5">
          <span className="map-ready-instruction-mark">+</span><span><strong>{fixedStart ? "고정 출발지에서 목적지까지 동선을 표시합니다" : "지도를 클릭해 목적지를 추가하세요"}</strong><small>{fixedStart ? "출발 지점은 어두운 출발 마커로 표시됩니다." : "선택한 위치는 주소로 변환됩니다."}</small></span>
        </div>
      ) : null}
    </div>
  );
}
