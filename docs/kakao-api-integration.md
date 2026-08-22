# Kakao API Integration Notes

## Confirmed integration requirements

Kakao Maps JavaScript SDK requires an application JavaScript key and the deployed web domain must be registered in the Kakao Developers console. The app loads the map SDK with the JavaScript key and uses it solely for browser-side map rendering.

Kakao Local REST API address search uses `GET https://dapi.kakao.com/v2/local/search/address.json`. Requests must send `Authorization: KakaoAK {REST_API_KEY}`. The response provides `address_name`, longitude `x`, and latitude `y`, allowing the server to return normalized destinations to the client without exposing the REST key.

## Implementation decision

The client will load only the Kakao Maps JavaScript SDK key. The server will hold the Kakao Local REST API key and provide authenticated address-search procedures. The route visualization will use Kakao map markers and a `kakao.maps.Polyline`; the trip optimizer will determine the ordered coordinate sequence locally using a TSP approximation before the polyline is rendered.

## Console observation on 2026-08-21

The user has an authenticated Kakao Developers app named `출장`. Its general settings currently show no representative app domain. The production deployment domain must be registered in the platform configuration before the JavaScript map SDK is expected to render outside local development. The REST API 403 diagnosis remains separate from the JavaScript SDK platform-domain requirement.

The app console contains distinct REST API and JavaScript platform keys. The service deliberately uses the REST API key only in the server router and the JavaScript key only in the browser SDK loader. No platform-key values are recorded in project files or documentation.

The current managed preview domain was registered to the JavaScript key's SDK domain list after the user's explicit approval. Production will require the published custom or generated domain to be added separately before go-live.

## Activation blocker

The Kakao SDK response identifies the app's `OPEN_MAP_AND_LOCAL` product as disabled. This is an app-product activation state rather than a JavaScript key format or domain-registration problem. The Kakao Map/Local product must be enabled in the logged-in developer console before the browser SDK and Local REST API can be verified live.

The Kakao Map product status was subsequently confirmed as `ON` in the app console. The app now has the product's daily free quota assignment; SDK and Local API requests should be revalidated from the project runtime after the setting propagation completes.

## Live verification

After activation, the project runtime received successful responses from both the JavaScript SDK and Local address search endpoint. In the authenticated planner, Kakao tiles, numbered markers, the destination polyline, address-search result selection, and the computed route-summary distance/time all rendered as expected.

## Sources

- https://apis.map.kakao.com/web/guide/
- https://developers.kakao.com/docs/ko/local/dev-guide
