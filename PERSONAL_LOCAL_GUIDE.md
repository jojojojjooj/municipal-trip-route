# 개인 DB·로컬 카카오맵 사용 안내

이 안내는 **공개 홈페이지나 유료 호스팅 없이**, 한 대의 개인 컴퓨터에서 출장동선을 사용하는 방법입니다. 웹 서버는 실행 중인 컴퓨터의 `localhost`에서만 열리고, 출장·비용·감사 로그 데이터는 본인이 지정한 MySQL 호환 데이터베이스에 저장됩니다.

## 1. 준비

Node.js 22 이상, pnpm 10 이상, MySQL 8 또는 TiDB/MySQL 호환 개인 DB를 준비합니다. DB가 로컬 컴퓨터에 있다면 아래처럼 빈 데이터베이스만 한 번 만듭니다.

```sql
CREATE DATABASE municipal_trip_route CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

프로젝트를 받은 뒤 개인 환경 파일을 만듭니다. 실제 `.env`는 이미 Git 제외 대상이므로 저장소에 올리지 마십시오.

```bash
pnpm install --frozen-lockfile
cp PERSONAL_ENV_TEMPLATE.txt .env
```

## 2. 개인 `.env` 설정

`DATABASE_URL`은 본인 DB 주소, `JWT_SECRET`은 충분히 긴 무작위 문자열로 바꿉니다. 로그인 없이 개인 전용으로 쓰려면 `LOCAL_PERSONAL_MODE=true`을 유지합니다. 이 모드는 `NODE_ENV=production`에서 비활성화되므로 공개 서비스 인증 용도로 사용하지 않습니다.

```dotenv
DATABASE_URL=mysql://USER:PASSWORD@127.0.0.1:3306/municipal_trip_route
JWT_SECRET=개인용으로-생성한-긴-무작위-문자열
LOCAL_PERSONAL_MODE=true
LOCAL_PERSONAL_OPEN_ID=local-personal-owner
LOCAL_PERSONAL_NAME=본인 이름
```

새 버전의 테이블(시간창, 감사 로그, 출장 비용 포함)은 아래 명령으로 적용합니다. 이미 저장된 개인 데이터가 있다면 실행 전 DB 백업을 권장합니다.

```bash
pnpm env:check
pnpm db:push
```

## 3. 카카오맵·주소 검색 연결

카카오 디벨로퍼스에서 개인 앱을 만든 뒤 카카오맵과 로컬 기능을 사용 설정합니다. **JavaScript 키**는 브라우저 지도 렌더링에, **REST API 키**는 서버의 주소 검색·역지오코딩에 사용합니다. 두 키를 바꿔 넣으면 지도 또는 검색이 각각 실패할 수 있습니다.

카카오 앱의 플랫폼 설정에서 Web 도메인으로 실제 로컬 주소를 등록합니다. 기본 포트가 비어 있으면 앱은 보통 `http://localhost:3000`에서 실행되며, 사용 중이면 콘솔에 표시된 다음 포트(예: `http://localhost:3001`)를 함께 등록합니다.

| 용도                 | 환경 변수                | 노출 원칙                                                |
| -------------------- | ------------------------ | -------------------------------------------------------- |
| 지도 JavaScript SDK  | `VITE_KAKAO_MAP_APP_KEY` | 브라우저 번들에 포함되므로 Web 도메인 제한을 반드시 적용 |
| 주소 검색·역지오코딩 | `KAKAO_REST_API_KEY`     | 서버 전용으로 유지, `VITE_` 접두사 사용 금지             |

```dotenv
VITE_KAKAO_MAP_APP_KEY=카카오_JavaScript_키
KAKAO_REST_API_KEY=카카오_REST_API_키
```

## 4. 실행과 점검

```bash
pnpm env:check
pnpm check
pnpm test
pnpm dev
```

콘솔에 표시된 `http://localhost:<port>`를 열고 다음을 순서대로 확인합니다.

1. 개인 관리자 상태로 플래너가 열리는지 확인합니다.
2. 카카오 주소 검색 결과를 추가하고 지도 마커가 보이는지 확인합니다.
3. 계획을 저장한 뒤 새로고침해 개인 DB에서 복원되는지 확인합니다.
4. 시간창·감사 로그·비용 기능을 사용하려면 `pnpm db:push`가 최신 마이그레이션까지 완료됐는지 확인합니다.

## 5. 자주 발생하는 문제

| 증상                    | 우선 확인할 항목                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| 지도가 표시되지 않음    | JavaScript 키인지, Web 도메인과 실제 localhost 포트가 일치하는지 확인                                     |
| 주소 검색이 실패함      | REST API 키 설정과 서버 재시작 여부 확인                                                                  |
| 개인 모드가 열리지 않음 | `.env`의 `LOCAL_PERSONAL_MODE=true`, `DATABASE_URL`, `JWT_SECRET` 확인                                    |
| 저장 데이터가 사라짐    | `DATABASE_URL`이 같은 DB를 가리키는지, `pnpm db:push` 완료 여부 확인                                      |
| 포트가 바뀜             | 다른 개발 서버가 사용 중인 정상 동작입니다. 콘솔에 표시된 URL을 열고 해당 포트를 카카오 Web 도메인에 추가 |

## 6. 선택 기능

사진을 영구 보관하려면 개인 S3 호환 저장소를 설정합니다. 설정하지 않아도 계획·경로·시간창·현장 상태·감사 로그·비용 데이터는 개인 DB에서 사용할 수 있습니다. 사진 업로드는 저장소를 별도로 설정하기 전까지 제한될 수 있습니다.

관련 세부 변수는 [PERSONAL_ENV_TEMPLATE.txt](./PERSONAL_ENV_TEMPLATE.txt), 기존 개인 API 설명은 [PERSONAL_API_SETUP.md](./PERSONAL_API_SETUP.md)를 참고하십시오.
