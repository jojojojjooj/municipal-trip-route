# 로컬 개발 및 테스트 기록

## 이번 실행 결과

로컬 저장소에서 Node.js `v22.13.0`, pnpm `v10.4.1` 환경을 확인했고, lockfile 기준 의존성 설치와 타입 검사·테스트·프로덕션 빌드를 수행했습니다.

| 항목 | 실행 명령 | 결과 |
|---|---|---|
| 의존성 설치 | `pnpm install --frozen-lockfile` | 성공 |
| 타입 검사 | `pnpm check` | 성공 |
| 단위 테스트 | `pnpm test` | 22개 파일·67개 테스트 성공 |
| 운영 빌드 | `pnpm build` | 성공 |
| 개발 서버 | `pnpm dev` | `http://localhost:3001`에서 실행 확인 |

기본 포트 3000이 이미 다른 개발 프로세스에서 사용 중이어서, 이 로컬 인스턴스는 자동으로 3001 포트에서 시작됐습니다.

## 실행 방법

```bash
git clone https://github.com/jojojojjooj/municipal-trip-route.git
cd municipal-trip-route
pnpm install --frozen-lockfile
pnpm dev
```

터미널에 표시되는 `http://localhost:<port>` 주소를 브라우저에서 엽니다.

## 외부 서비스가 필요한 기능

현재 저장소에는 로컬 `.env` 파일이 없으므로, 기본 화면과 정적 계산·테스트는 실행되지만 아래 기능은 개발용 환경변수가 있어야 완전하게 확인할 수 있습니다.

| 기능 | 필요한 설정 |
|---|---|
| 로그인·계획 저장·협업 | `DATABASE_URL`, `JWT_SECRET`, OAuth 관련 설정 |
| 카카오 지도 표시 | `VITE_KAKAO_MAP_APP_KEY` |
| 주소 검색·역지오코딩 | `KAKAO_REST_API_KEY` |
| 현장 사진 저장 | S3 호환 저장소 및 관련 서버 설정 |

환경변수는 버전 관리에 올리지 말고 개인 개발용 `.env` 파일로만 관리합니다.

## 로컬 화면 상태

로그인 전 랜딩 화면은 정상 렌더링됐습니다. 로그인, 데이터 저장, 지도 SDK·주소 검색은 유효한 개발용 OAuth·DB·카카오 키를 제공한 뒤 검증할 수 있습니다.
