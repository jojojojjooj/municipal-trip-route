# HWPX 내보내기 설계 메모

2026-08-22 조사 결과, HWPX는 ZIP 컨테이너 안에 XML 기반 문서 요소를 저장하는 OWPML 형식이다. 한컴 기술 문서는 `mimetype`을 파일 식별 정보로, `Contents/section0.xml`을 본문 구역과 문단 내용으로 설명한다. 본문 텍스트는 문단 `hp:p`, 실행 단위 `hp:run`, 텍스트 `hp:t`로 구성된다.

보고서 내보내기는 본문 중심의 최소 호환 패키지를 생성한다. 보고서 문안·사진 설명·목적지 정보는 `section0.xml` 문단에 넣고, 실제 사진은 별도 바이너리 리소스가 아닌 파일 링크 목록으로 기록하지 않는다. 따라서 첫 구현은 한글에서 열어 수정 가능한 텍스트 중심 HWPX를 우선 제공하며, 사진 자체의 임베드는 향후 추가 호환성 검증 뒤 확장한다.

## 참고

- 한컴테크, [HWPX 포맷 구조](https://tech.hancom.com/hwpxformat/)
- Hancom Open Source, [HWPX OWPML Model](https://github.com/hancom-io/hwpx-owpml-model)
