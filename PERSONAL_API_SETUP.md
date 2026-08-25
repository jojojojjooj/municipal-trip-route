# 개인용 API 설정

이 문서는 한 명이 자신의 컴퓨터에서 출장동선을 실행하는 경우를 위한 설정입니다. 실제 비밀값은 절대로 저장소에 넣지 말고 `.env`에만 보관합니다.

## 1. 개인 설정 파일 만들기

```bash
cp PERSONAL_ENV_TEMPLATE.txt .env
pnpm env:check
```

`.env`의 `DATABASE_URL`과 `JWT_SECRET`을 먼저 채웁니다. 데이터가 지속되어야 하므로 MySQL 호환 데이터베이스가 필요합니다. 초기 설정 뒤에는 다음 명령으로 스키마를 적용합니다.

```bash
pnpm db:push
```

## 2. 로그인 없이 개인 모드 사용

로컬 개발 서버에서만 `LOCAL_PERSONAL_MODE=true`을 사용하면 하나의 관리자 계정이 자동으로 생성됩니다. 이 모드는 `NODE_ENV=production`에서 강제로 비활성화되므로, 공개 서버 인증에 사용하면 안 됩니다.

## 3. 카카오 지도·주소 검색

`VITE_KAKAO_MAP_APP_KEY`에는 JavaScript 키를, `KAKAO_REST_API_KEY`에는 REST API 키를 넣습니다. 카카오 플랫폼의 Web 도메인에 `http://localhost:3000`과 필요 시 `http://localhost:3001`을 등록합니다. 지도 표시는 JavaScript 키, 주소 검색과 역지오코딩은 REST 키를 사용합니다.

## 4. 사진·보고서 파일 저장

파일 기능은 `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`가 모두 있으면 일반 S3 호환 저장소를 사용합니다. AWS S3, Cloudflare R2, MinIO 등과 호환됩니다. R2·MinIO처럼 별도 API 주소가 있는 경우 `S3_ENDPOINT`를, path-style 주소가 필요한 경우 `S3_FORCE_PATH_STYLE=true`를 설정합니다. 파일 조회 주소는 기본 15분짜리 서명 URL이며 `S3_SIGNED_URL_EXPIRES_SECONDS`로 60~3600초 범위에서 조정할 수 있습니다.

## 5. 실행·검증

```bash
pnpm env:check
pnpm check
pnpm test
pnpm dev
```

브라우저에서 서버가 알려주는 `http://localhost:<port>`를 열어 로그인 없이 개인 계획을 저장하고, 카카오 주소 검색·지도·사진 첨부까지 차례로 확인합니다.
