# 여정도: 지자체 출장 동선

카카오맵을 기반으로 여러 출장 목적지를 등록하고 방문 순서를 최적화하는 반응형 지자체 출장 관리 웹앱입니다. 출장 계획·현장 사진·운영 상태·협업·결과 보고서·HWPX 내보내기를 하나의 흐름으로 관리합니다.

[![CI](https://github.com/jojojojjooj/municipal-trip-route/actions/workflows/ci.yml/badge.svg)](https://github.com/jojojojjooj/municipal-trip-route/actions/workflows/ci.yml)

## 주요 기능

| 영역        | 제공 기능                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| 동선 설계   | 주소 검색·지도 선택·목적지 CSV 일괄 가져오기, 고정 출발지, 왕복 옵션, Nearest Neighbor 및 2-opt 기반 경로 최적화 |
| 현장 운영   | 목적지 실행 상태, 이슈·조치 기한, 체크리스트, 현장 메모·사진·촬영일·설명 기록                                    |
| 협업과 분석 | 소유자·편집자·열람자 권한, 공유 링크, 최근 출장·완료율·이슈 현황 분석                                            |
| 보고서      | 출장 요약 PDF, 사진 현장 기록 PDF, 결과 보고서 초안, HWPX 다운로드 및 웹 미리보기                                |

## 기술 구성

React 19, TypeScript, Vite, Tailwind CSS 4, Express 4, tRPC 11, Drizzle ORM, MySQL/TiDB를 사용합니다. 지도 렌더링과 주소 검색에는 카카오맵 JavaScript SDK 및 카카오 로컬 API를 사용합니다.

## 빠른 시작

Node.js 22 이상과 pnpm 10을 준비한 뒤 아래 명령을 실행합니다.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm dev
```

실행 전에는 데이터베이스, 세션, 카카오맵, OAuth, 사진 저장소의 환경변수를 별도 설정해야 합니다. 실제 비밀값은 커밋하지 마십시오. 상세한 외부 호스팅·도메인 연결 절차는 [EXTERNAL_DEPLOYMENT.md](./EXTERNAL_DEPLOYMENT.md)를 참고하십시오.

## 환경 설정 요약

| 항목                  | 주요 환경변수                                              |
| --------------------- | ---------------------------------------------------------- |
| 데이터베이스          | `DATABASE_URL`                                             |
| 세션 서명             | `JWT_SECRET`                                               |
| 카카오 지도·주소 검색 | `VITE_KAKAO_MAP_APP_KEY`, `KAKAO_REST_API_KEY`             |
| OAuth                 | `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` |
| 사진 저장소           | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`         |

`VITE_` 접두사 변수는 브라우저 번들에 노출될 수 있습니다. 데이터베이스 연결 문자열, REST API 키, 세션 비밀값 등 서버 전용 정보에는 이 접두사를 사용하지 마십시오.

## 목적지 CSV 가져오기

출장 설계 화면의 `CSV로 일괄 가져오기`에서 이 앱이 내보낸 목적지 CSV를 다시 불러올 수 있습니다. 가져오기는 현재 목적지 목록을 교체하며, 출장명·출장일·방문 순서·좌표·실행 상태·현장 이슈·현장 메모를 복원합니다. 위도·경도 범위, 필수 목적지명·주소, 실행 상태와 최대 100개 목적지를 검증하고, 동일 좌표의 중복 행은 한 건으로 정리합니다. 사진은 파일 자체가 CSV에 포함되지 않으므로 가져온 뒤 목적지별로 다시 첨부해야 합니다.

가져오기 형식은 앱의 `CSV` 내보내기 결과와 동일합니다. 스프레드시트에서 편집한 뒤 저장할 때는 첫 번째 헤더 행과 `출장명, 출장일, 순서, 목적지, 주소, 위도, 경도, 실행 상태, 완료 시각, 현장 이슈, 이슈 담당자, 조치 기한, 해결 시각, 현장 메모` 열 순서를 유지하십시오.

## 외부 S3 호환 저장소 전환

현재 사진 업로드는 관리형 사전 서명 URL 연동을 사용합니다. AWS S3, Cloudflare R2, MinIO 등 외부 S3 호환 저장소로 운영하려면 환경변수만 추가하는 방식이 아니라 저장소 어댑터를 교체해야 합니다. 업로드 키 생성, 권한 확인 및 URL 반환 규칙을 보존하면 사진·PDF·결과 보고서 기능을 유지할 수 있습니다.

| 구성 항목      | 권장 값                                                                             | 주의사항                                                                |
| -------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 버킷           | 비공개 버킷                                                                         | 현장 사진을 공개 읽기 버킷에 두지 않습니다.                             |
| 서버 자격 증명 | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | 모두 서버 전용 비밀값으로 관리하며 `VITE_` 접두사를 붙이지 않습니다.    |
| 객체 키        | `trips/{tripId}/...` 같은 사용자·출장 단위 접두사                                   | 사용자 요청으로 전달된 키를 그대로 사용하지 않고 서버에서 정규화합니다. |
| 다운로드       | 짧은 만료 시간의 사전 서명 GET URL                                                  | 권한 확인 후 발급하고, URL을 데이터베이스에 영구 저장하지 않습니다.     |

전환 시 `server/storage.ts`의 `storagePut`, `storageGet`, `storageGetSignedUrl`을 S3 SDK 기반 구현으로 바꾸고, `server/_core/storageProxy.ts`는 인증·권한 확인 뒤 사전 서명 GET URL로 307 리디렉션하는 현재 계약을 유지하십시오. 업로드에는 최소 권한의 `PutObject`, 다운로드에는 `GetObject`만 부여하고, 버킷 전체 삭제·목록 권한은 부여하지 않는 구성을 권장합니다.

## 외부 OAuth 제공자 전환

현재 로그인은 관리형 OAuth SDK를 사용합니다. Auth0, Keycloak, Google OAuth 또는 조직의 OpenID Connect 제공자로 바꾸려면 프런트엔드 로그인 시작 함수, 서버 콜백 처리, 사용자 식별자 매핑을 함께 교체해야 합니다. 단순히 새 OAuth 환경변수만 설정하면 기존 인증 흐름이 전환되지는 않습니다.

1. OAuth 제공자에 `https://<최종-도메인>/api/oauth/callback`을 정확한 리디렉션 URI로 등록합니다.
2. 서버 전용 비밀 설정에 `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_ISSUER_URL`, `JWT_SECRET`을 등록합니다. 클라이언트 시크릿과 세션 서명 키는 절대 `VITE_` 변수로 노출하지 않습니다.
3. `client/src/const.ts`의 로그인 시작 경로를 제공자의 Authorization Endpoint와 PKCE 흐름에 맞추고, `server/_core/oauth.ts`에서 코드 교환·ID 토큰 검증·사용자 정보 조회를 서버에서만 처리합니다.
4. 공급자의 안정적인 subject 값을 `users.openId`에 매핑하고, 이메일·이름은 선택적 프로필 값으로 저장합니다. 이메일을 식별자 대신 사용하지 마십시오.
5. `state` 검증, HTTPS, `Secure`·`HttpOnly` 세션 쿠키, 프록시의 `X-Forwarded-Proto` 전달을 유지한 뒤 로그인·로그아웃·권한별 계획 접근을 점검합니다.

외부 도메인, 데이터베이스, 기존 사진 저장소까지 포함한 전체 이전 순서는 [EXTERNAL_DEPLOYMENT.md](./EXTERNAL_DEPLOYMENT.md)를 참고하십시오.

## 품질 확인

```bash
pnpm check
pnpm test
pnpm build
```

GitHub Actions는 `main` 브랜치 푸시와 `main` 대상 풀 리퀘스트에서 타입 검사, 단위 테스트, 프로덕션 빌드를 실행합니다. 공개 CI에는 실제 카카오 API 키를 주입하지 않으므로 카카오 네트워크 통합 테스트는 키가 설정된 로컬 또는 별도 보호 환경에서만 실행됩니다.

## 기여 및 보안

기여 방법은 [CONTRIBUTING.md](./CONTRIBUTING.md), 보안 취약점 제보 방법은 [SECURITY.md](./SECURITY.md)를 참고하십시오.

## 라이선스

이 프로젝트는 [MIT License](./LICENSE)를 따릅니다.
