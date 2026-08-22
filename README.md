# 여정도: 지자체 출장 동선

카카오맵을 기반으로 여러 출장 목적지를 등록하고 방문 순서를 최적화하는 반응형 지자체 출장 관리 웹앱입니다. 출장 계획·현장 사진·운영 상태·협업·결과 보고서·HWPX 내보내기를 하나의 흐름으로 관리합니다.

## 주요 기능

| 영역 | 제공 기능 |
|---|---|
| 동선 설계 | 주소 검색, 지도 선택, 고정 출발지, 왕복 옵션, Nearest Neighbor 및 2-opt 기반 경로 최적화 |
| 현장 운영 | 목적지 실행 상태, 이슈·조치 기한, 체크리스트, 현장 메모·사진·촬영일·설명 기록 |
| 협업과 분석 | 소유자·편집자·열람자 권한, 공유 링크, 최근 출장·완료율·이슈 현황 분석 |
| 보고서 | 출장 요약 PDF, 사진 현장 기록 PDF, 결과 보고서 초안, HWPX 다운로드 및 웹 미리보기 |

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

| 항목 | 주요 환경변수 |
|---|---|
| 데이터베이스 | `DATABASE_URL` |
| 세션 서명 | `JWT_SECRET` |
| 카카오 지도·주소 검색 | `VITE_KAKAO_MAP_APP_KEY`, `KAKAO_REST_API_KEY` |
| OAuth | `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` |
| 사진 저장소 | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` |

`VITE_` 접두사 변수는 브라우저 번들에 노출될 수 있습니다. 데이터베이스 연결 문자열, REST API 키, 세션 비밀값 등 서버 전용 정보에는 이 접두사를 사용하지 마십시오.

## 품질 확인

```bash
pnpm check
pnpm test
pnpm build
```

## 기여 및 보안

기여 방법은 [CONTRIBUTING.md](./CONTRIBUTING.md), 보안 취약점 제보 방법은 [SECURITY.md](./SECURITY.md)를 참고하십시오.

## 라이선스

이 프로젝트는 [MIT License](./LICENSE)를 따릅니다.
