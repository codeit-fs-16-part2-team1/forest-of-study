# 공부의 숲 API Docs

- 문서 개정: 0.14 킥오프 결정 동기화(제품 버전과 별개) · 2026-10-20 (Asia/Seoul)
- 기준: [README.md](../README.md), [DB.md](DB.md), [ADR.md](ADR.md) ADR-051~073; 최신 후속 결정을 우선 적용한다.
- 요청 예시: [api.http](../api/requests/api.http). 예시는 계약 기대값이며 실제 실행·검증 결과와 구분한다.
- 확정 정책과 기술 계약을 구분한다. 남은 제품 결정은 10절에서 관리한다. 리소스·필드·실패 코드는 DB의 Routine·RoutineHistory·Challenge 명칭을 따른다.
- 용어 통일로 기존 리소스 경로·필드·실패 코드 별칭은 더 이상 지원하지 않는다. 변경 이력은 ADR-054를 따른다.
- 이전 Authorization·X-Timer-Key·stateVersion·Heartbeat·조작권 복구·초기화 보상 계약은 폐기한다. API-AU-02·API-FC-07 ID는 재사용하지 않는다. brief.md 원문은 보존한다.

## 1. 공통 계약과 인증

Base URL은 서버 주소 + /api. JSON 요청·응답, UUID ID, ISO 8601 UTC 일시, YYYY-MM-DD 한국 날짜를 사용한다. 성공은 {data:...}, 목록은 {data:[],pagination:{offset,limit,total,hasMore}}, 실패는 {error:{code,message,details}}. 204는 본문이 없다. 실패 시 현재 페이지를 유지하며 요청 중간 취소 기능은 없다.

정의하지 않은 쿼리 키는 모든 API에서 무시하지 않고 400 VALIDATION_ERROR로 거절한다(ADR-059). ST-01은 offset/limit/keyword/sort, ST-06은 weekStart, ST-08은 ids만 허용한다. 그 외 API는 쿼리를 받지 않는다. 값의 타입·형식은 각 API 기준으로 검사한다.

### 앱 메모리 유지와 요청별 비밀번호 확인

- 앱 메모리에 해당 스터디의 비밀번호가 없으면 자체 모달에서 입력받아 AU-01로 확인한다. 성공한 비밀번호는 앱 메모리에 유지해 습관·집중·스터디 수정 페이지 사이를 이동할 때 다시 입력받지 않는다(ADR-073).
- 입력값은 앱 메모리에만 보관한다. 일반 보호 요청은 `X-Study-Password: <입력한 비밀번호>` 헤더를 보내며 서버가 해당 스터디의 bcrypt 해시와 **요청마다** 비교한다.
- AU-01 페이지 진입 검증과 ST-05 삭제 모달은 본문 `{password}`로 검증한다. 생성 ST-02도 기존 본문 비밀번호를 유지한다. 이 세 API는 비밀번호 헤더를 요구하지 않는다.
- AU-01의 성공 응답은 화면 진입 안내일 뿐 이후 보호 요청을 허용하는 증표가 아니다. 헤더 없이 보호 API를 호출하면 이전 확인 여부와 관계없이 거절한다.
- LocalStorage·쿠키·URL·응답·로그에 비밀번호를 저장/출력하지 않는다. 내부 페이지 이동만으로 폐기하지 않으며 새로고침·앱 종료 후에는 다시 입력한다. 브라우저에 비밀번호 해시를 보관해 인증으로 쓰지도 않는다.
- HTTPS, CORS의 X-Study-Password 허용, 민감 응답 Cache-Control: no-store, 비밀번호 헤더·본문 로그 제외를 적용한다. 헤더 자체는 암호화 수단이 아니다.
- 인증 토큰·타이머 전용 키·서명·만료·VerificationToken 테이블·조작권 복구를 사용하지 않는다. 응원 browserId는 비밀번호 검증과 무관하다.
- 비밀번호를 아는 다른 브라우저도 같은 집중을 조작할 수 있다. 브라우저별 소유권과 여러 브라우저 요청 순서 충돌 처리는 제외한다. 스터디당 활성 1개와 완료 중복 지급 방지는 유지한다.
- 한국 자정은 습관 날짜 경계에만 적용한다. 비밀번호 만료 시각·타이머 자동 정지 기준으로 사용하지 않는다.

### 공통 문자열 입력 기준 — ADR-056~057·066

닉네임·스터디 이름·소개·습관 이름은 문자열만 받고 trim()으로 앞뒤 공백을 제거한 뒤 Intl.Segmenter("ko", {granularity:"grapheme"})로 센다. 허용 범위는 각각 1~10·1~15·1~100·1~20그래핌이다. 빈 문자열·공백만 있는 입력과 범위 밖 값은 400 VALIDATION_ERROR다. 생성·수정 모두 정리한 문자열을 저장하며 프론트와 서버의 계산 기준을 일치시킨다. 단순 String.length·Array.from(text).length·HTML maxlength만으로 이 제한을 대신하지 않는다. 그래핌 개수를 저장하는 별도 필드는 추가하지 않는다.

비밀번호·확인값은 공백을 제거하거나 trim하지 않고 입력 원문을 검사한다(ADR-066). 앞뒤·중간 스페이스, 탭, 줄바꿈 등 공백이 하나라도 포함되면 400 VALIDATION_ERROR로 거절한다. 프론트는 공백 입력을 막고 붙여넣기를 포함한 입력값도 검사하되 공백을 자동 삭제해 전송하지 않는다. 서버도 전달받은 원문을 검사한다. 문자열이 아닌 값을 문자열로 자동 변환하지 않는다.

생성은 password·passwordConfirm 각각의 원문으로 길이4~20·`/^[A-Za-z0-9!@#$%^&*]+$/`를 검사한다. 어느 한쪽이라도 공백이 포함되거나 형식이 잘못되면 400 VALIDATION_ERROR이며, 두 값 모두 형식에 맞지만 서로 다르면 400 PASSWORD_CONFIRM_MISMATCH다. 유효한 password 원문만 bcrypt 해시로 저장한다. 진입 확인·삭제·보호 요청도 같은 형식 검사 후 원문으로 bcrypt 비교한다. `ab cd`는 거절하며 `abcd`로 바꾸어 처리하지 않는다. 진입 확인·삭제·보호 요청의 비밀번호 누락은 401 VERIFICATION_REQUIRED다. 생성 필수 필드 누락이나 제공된 값이 빈 문자열·공백 포함·길이/문자 범위 밖이면 400 VALIDATION_ERROR, 유효한 값의 bcrypt 불일치는 401 PASSWORD_MISMATCH다. 새 비밀번호 변경 API나 DB 컬럼은 추가하지 않는다.

## 2. API 계약 표

모든 경로는 /api 뒤에 붙는다. 개별 습관 API-HB-02/03/04는 폐기했으며 아래 현재 계약 표에서 제외한다. /studies/batch는 동적 /studies/{studyId}보다 먼저 라우팅한다.

| API ID | Method | Path | 기능 | 접근 | 성공 | 0.1.0 우선순위(기록) | 백엔드 담당 이슈 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API-ST-01 | GET | /studies | 목록·검색·정렬·offset | 공개 | 200 | P0 기본 / P2 확장 | ISS-009, ISS-021 |
| API-ST-02 | POST | /studies | 스터디 생성 | 공개 | 201 | P0 | ISS-008 |
| API-ST-03 | GET | /studies/{studyId} | 상세·전체 응원 집계 | 공개 | 200 | P0 상세 / P2 응원 | ISS-009, ISS-023 |
| API-ST-04 | PATCH | /studies/{studyId} | 정보 수정 | 비밀번호 헤더 | 200 | - | ISS-010 |
| API-ST-05 | DELETE | /studies/{studyId} | 스터디·연결 데이터 삭제 | 삭제 모달 비밀번호 | 204 | - | ISS-010 |
| API-ST-06 | GET | /studies/{studyId}/routine-histories | 주간 기록표 | 공개 | 200 | P0 | ISS-014 |
| API-ST-07 | POST | /studies/{studyId}/reactions | 응원 추가 | 공개 | 200 | P2 | ISS-023 |
| API-ST-08 | GET | /studies/batch | 최근 조회용 ID 다건 조회 | 공개 | 200 | P2 | ISS-022(API) |
| API-AU-01 | POST | /studies/{studyId}/password-verifications | 앱 메모리 미보관 시 비밀번호 검증 | 비밀번호 본문 | 200 | P1 | ISS-007 |
| API-HB-01 | GET | /studies/{studyId}/routines | 오늘 목록 | 비밀번호 헤더 | 200 | P0 | ISS-011 |
| API-HB-06 | PATCH | /studies/{studyId}/routines/batch | 생성·이름 수정·종료 일괄 저장 | 비밀번호 헤더 | 200 | - | ISS-013 |
| API-HB-05 | PUT | /studies/{studyId}/routines/{routineId}/check | 오늘 체크·해제 | 비밀번호 헤더 | 200 | P0 | ISS-012 |
| API-FC-01 | GET | /studies/{studyId}/challenges/current | 현재 집중·마지막 목표 복원 | 비밀번호 헤더 | 200 | P0 | ISS-015 |
| API-FC-02 | POST | /studies/{studyId}/challenges | 매번 새 행으로 시작 | 비밀번호 헤더 | 201 | P0 | ISS-015 |
| API-FC-03 | POST | /studies/{studyId}/challenges/{challengeId}/pause | 사용자 일시정지 | 비밀번호 헤더 | 200 | - | ISS-016 |
| API-FC-04 | POST | /studies/{studyId}/challenges/{challengeId}/resume | 정지된 집중 재개 | 비밀번호 헤더 | 200 | - | ISS-016 |
| API-FC-05 | POST | /studies/{studyId}/challenges/{challengeId}/reset | 무지급·RESET 종료 | 비밀번호 헤더 | 200 | - | ISS-017 |
| API-FC-06 | POST | /studies/{studyId}/challenges/{challengeId}/complete | 목표 완료·지급 | 비밀번호 헤더 | 200 | P0 완료 / P1 검증 | ISS-018, ISS-028 |

### 0.1.0 중간점검 구현 범위와 이슈 매칭 — 기록 / ADR-055

10/13~15 구현, 10/16 발표. 프론트 없이 `api/requests/api.http`로 시연한다. 아래 표는 당시 범위의 보관 기록이다. HB-02/03/04·상위 상세 집계는 현재 계약이 아니며 현재 규칙은 4·6절을 따른다. 아래 우선순위는 구현 범위 배정이며 경로·필드·응답·실패·보호 조건 변경이 아니다. P1이 미구현인 상태를 계약 충족으로 보고하지 않는다.

| 중간점검 작업 | 분류·우선순위 | API 계약 ID | 이슈 |
| --- | --- | --- | --- |
| Express·Prisma·PostgreSQL 연결·migration | Must / P0 | 공통 기반 | ISS-001, ISS-004, ISS-005 |
| 스터디 생성 → 목록 → 상세 | Must / P0 | API-ST-02 → API-ST-01 → API-ST-03 | ISS-008, ISS-009 |
| 습관 생성 → 오늘 목록 → 체크 → 주간 기록 | Must / P0 | API-HB-02 → API-HB-01 → API-HB-05 → API-ST-06 | ISS-011, ISS-012, ISS-014 |
| 집중 시작 → 상태 → 완료 → 포인트 조회 | Must / P0 | API-FC-02 → API-FC-01 → API-FC-06 → API-ST-03 | ISS-015, ISS-018 |
| api.http 시연 순서·변수·예상 응답 | Must / P0 | 위 핵심 API 흐름 | ISS-027 |
| API 흐름 인수 검증 | Must / P0 | 위 핵심 API 흐름 + 공통 P1 | ISS-030 |
| 공통 응답·오류 처리, 입력 검증 | Should / P1 | 전체 대상 API의 공통 계약 | ISS-006, ISS-029 |
| 비밀번호 확인·보호 요청 검증 | Should / P1 | API-AU-01 + 보호 API 헤더 검증 | ISS-007 |
| 완료 조건 서버 검증·포인트 중복 지급 방지 | Should / P1 | API-FC-06 | ISS-028 |
| 검색·정렬·더보기 | Could / P2 | API-ST-01의 확장 조회 | ISS-021 |
| 스터디 ID 다건 조회 | Could / P2 | API-ST-08 | ISS-022의 API 부분 |
| 응원 등록·상위 반응 조회 | Could / P2 | API-ST-07, API-ST-03의 응원 집계 | ISS-023 |

범위 밖 API-ST-04/05, API-HB-03/04, API-FC-03/04/05의 중간 우선순위는 `-`다. 당시 ID·범위는 추적용으로 보존한다. API-ST-01은 기본 목록 P0 / 검색·정렬·offset 확장 P2, API-ST-03은 상세·총점 P0 / 상위 응원 집계 P2, API-FC-06은 완료·지급 흐름 P0 / 서버 완료 검증·중복 방지 P1로 나눠 추적한다. 보호 요청의 헤더는 그대로 유지한다. 별도 포인트 조회 API는 추가하지 않으며 API-ST-03 또는 API-FC-01의 points를 사용한다.

### 제품 버전별 API 작업

| 버전 | 적용 범위 |
| --- | --- |
| 0.1.0 | 중간 발표의 CR·기록·집중·포인트 API 기반과 당시 검증 기록을 보존한다. 앞의 우선순위 표는 이 단계의 기록이다. |
| 0.2.0 | 프론트 구현과 현재 구현된 API의 실제 요청·응답·저장/재조회·실패·시간/포인트 처리를 연결한다. 임시 데이터만으로 연동 완료 처리하지 않는다. |
| 1.0.0 | 미구현 API를 추가하고 해당 화면 조작을 연결한다. 기존 0.2.0 흐름을 포함한 최종 전체 배포 인수를 수행한다. |

| 목표 | API 계약 ID | 범위·관련 이슈 |
| --- | --- | --- |
| 0.2.0 실제 연동 | ST-01/02/03, ST-06 | 목록·검색·정렬·더보기·생성·상세·전체 응원 집계 조회·주간 기록. ISS-008·009·014·021 및 관련 FE |
| 0.2.0 실제 연동 | AU-01, HB-01/05 | 비밀번호 확인·오늘 목록·체크/해제. 생성·편집 저장은 일괄 저장 범위에서 추적한다. ISS-007·011·012·013 및 관련 FE |
| 0.2.0 실제 연동 | FC-01~06 | 현재 집중·시작·정지·재개·초기화·완료·포인트·복원. ISS-015~019·028 및 관련 FE |
| 1.0.0 구현·연동 | ST-04/05 및 습관 일괄 저장 | 스터디 수정·삭제와 습관 일괄 생성·이름 수정·종료. BE ISS-010·013 / FE ISS-045·046 |
| 1.0.0 구현·연동 | ST-08, ST-07 | 최근 조회용 ID 다건 조회·응원 등록. BE ISS-022·023 / FE ISS-047·048 |

버전 배정은 작업 계획이며 실행·배포·인수 결과가 아니다. 2026-10-20 정적 확인에서 습관 batch 라우트·서비스와 기존 개별 생성 라우트가 함께 존재한다. 개별 생성은 폐기 대상이며 batch는 확정된 API-HB-06 계약으로 연결한다. 상세·등록의 전체 집계는 계약으로 요구하며 현재 코드가 있다는 이유만으로 충족을 선언하지 않는다.

0.2.0의 작업 우선순위는 [issues.md](issues.md)의 13개 PR 묶음을 따른다. 기존 API의 공통 오류·비밀번호 공백 거절·쿼리 검증은 ISS-006·007·029에서 계약 일치 여부를 확인하고 해당 연동 전에 보완한다. 완료·중복 지급은 ISS-018·028에서 확인하고 미검증 서버 동작을 프론트의 임시 성공으로 대체하지 않는다.

1.0.0은 공통 계약·배포 전체 인수 P0, 스터디 수정/삭제·습관 일괄 저장 P1, ID 다건·응원 등록 P2로 진행한다. P2도 최종 필수 기능이면 출시 전에 완료한다. 기존 API 연동을 통째로 1.0.0에 미루지 않는다. API 경로·필드·상태 코드·실패·인증 계약은 이번 버전 배정으로 바꾸지 않는다.

## 3. 데이터 모양

| DTO | 필드 |
| --- | --- |
| Study | id, nickname, name, introduction, backgroundKey, backgroundColor(null 허용), points(Study.points), createdAt, updatedAt |
| ReactionSummary | emoji, count |
| Routine | id, studyId, name, startsOn, endsOn(null 허용), completed(오늘 목록에서만) |
| Challenge | id, studyId, goalMinutes, status(RUNNING/PAUSED/COMPLETED/RESET), elapsedMilliseconds, lastStartedAt(null 허용), awardedPoints, createdAt, elapsedSeconds, remainingSeconds, serverTime, endsAt(RUNNING 파생값 또는 null) |
| Settlement | challengeId, elapsedPoints, goalPoints, awardedPoints(이번 신규 지급 합계) |

Challenge에는 비밀번호·해시·토큰·키를 넣지 않는다. elapsedSeconds는 실제 경과 밀리초를 버림, remainingSeconds는 남은 밀리초를 올림한다. 모든 파생값은 한 서버 시각을 기준으로 계산한다. endsAt은 RUNNING에서 서버 현재 시각 + 남은 밀리초이며 PAUSED/terminal은 null이다.

### DB 기준 명명 규칙

- 모델명은 PascalCase(Study, Routine, RoutineHistory, Challenge, Reaction), JSON 필드는 DB 컬럼과 같은 camelCase를 사용한다.
- API 컬렉션 경로는 /studies, /routines, /routine-histories, /challenges, /reactions다. 현재 활성 집중 조회는 /studies/{studyId}/challenges/current다.
- API-HB / API-FC와 F-HB / F-FC는 문서 추적 ID다. 기존 연결을 보존하며 리소스명으로 사용하지 않는다. 화면 주소는 ADR-009의 여섯 주소를 유지한다.
- password·passwordConfirm은 입력 전용이며 DB에는 passwordHash만 저장한다. passwordHash는 공개하지 않는다.
- date 형식의 DB 컬럼 recordDate·startsOn·endsOn은 YYYY-MM-DD, 타임스탬프는 UTC ISO 8601로 전달한다.
- elapsedSeconds·remainingSeconds·serverTime·endsAt·weekStart·cells·settlement는 조회/표시용 파생값이며 새 DB 컬럼이 아니다. 주간 응답에는 dates·exists·습관별 startsOn/endsOn을 보내지 않는다(ADR-060). Routine DTO의 startsOn/endsOn은 유지한다. 시간 단위가 다른 값을 DB 컬럼과 같은 이름으로 보내지 않는다.
- Routine의 completed는 서버 한국 날짜에 해당하는 RoutineHistory.completed에서 조회한다. 주간 cells의 recordDate도 RoutineHistory.recordDate를 따른다.
- Challenge의 DB 시간 필드와 파생값은 아래 기준으로 구분한다.

| 필드 | 의미 |
| --- | --- |
| elapsedMilliseconds | DB에 확정 저장한 이전 실행 구간의 누적 밀리초 |
| lastStartedAt | 현재 실행 구간의 시작 시각; PAUSED/RESET/COMPLETED는 null |
| createdAt | 해당 Challenge 행의 생성 시각 |
| elapsedSeconds | 서버 현재 시각까지 포함한 실제 경과 밀리초를 초 단위로 버림 |
| remainingSeconds | 목표까지 남은 밀리초를 초 단위로 올림 |

비밀번호 확인 응답:
```json
{"data":{"verified":true}}
```
이 응답을 저장해서 다음 보호 요청을 우회하지 않는다.

집중 조회: {data:{challenge,points,serverTime,goalMinutes}}. 활성 행을 우선 반환한다. 활성 행이 없으면 challenge=null이며 가장 최근 RESET/COMPLETED의 goalMinutes를 반환하고 이력도 없으면 10이다. 최신 순은 createdAt DESC, id DESC다. points는 현재 Study.points다.

집중 변경: {data:{challenge,points,settlement}}. 시작·정지·재개·초기화에는 settlement=null. 완료만 Settlement를 반환하며 elapsedPoints=floor(goalMinutes/10), goalPoints=3, awardedPoints=이번 신규 지급 합계다. Challenge.awardedPoints는 그 행에 저장한 전체 지급량이므로 완료 재요청의 Settlement.awardedPoints=0과 다를 수 있다.

위 분해 값은 최초 완료 지급 기준이다. 동일 완료 재요청은 settlement의 elapsedPoints·goalPoints·awardedPoints 모두 0이다.

10분 목표 최초 완료 예시(이전에 지급된 스터디 총점이 0인 경우):

```json
{
  "data": {
    "challenge": {
      "id": "22222222-2222-4222-8222-222222222222",
      "studyId": "11111111-1111-4111-8111-111111111111",
      "status": "COMPLETED",
      "goalMinutes": 10,
      "elapsedMilliseconds": 600000,
      "lastStartedAt": null,
      "createdAt": "2026-10-12T01:00:00.000Z",
      "elapsedSeconds": 600,
      "remainingSeconds": 0,
      "serverTime": "2026-10-12T01:10:00.000Z",
      "endsAt": null,
      "awardedPoints": 4
    },
    "points": 4,
    "settlement": {
      "challengeId": "22222222-2222-4222-8222-222222222222",
      "elapsedPoints": 1,
      "goalPoints": 3,
      "awardedPoints": 4
    }
  }
}
```

RESET 응답은 종료한 행을 반환한다. DB 행에는 초기화 전 경과 이력을 보존하지만 프론트는 목표 시간·경과 0인 시작 전 화면을 구성한다. DB에 READY 행은 없다. 다음 Start는 새 행이다.

## 4. 스터디·응원 API 상세

### API-ST-01 목록

query: offset(0 이상 정수, 기본0), limit(1~6 정수, 기본6·최대6), keyword(기본 빈 문자열), sort(latest/oldest/points_desc/points_asc, 기본latest). 최초 조회 6개·최신순으로 확정한다(ADR-059). 더보기는 limit=6, offset은 누적 개수다. limit은6을 초과하면 400 VALIDATION_ERROR다. 최근 조회는 중복 없이 최대 3개이며 다건 API의 서로 다른ID 최대 10개 제한과 구분한다(ADR-064). 정의하지 않은 쿼리는 400 VALIDATION_ERROR다.

검색 대상은 name/nickname/introduction이며 세 필드 중 하나에 keyword가 포함되는 OR 부분 검색이다. keyword는 trim 후 NFC 정규화하며 저장된 검색 대상도 NFC 정규화하고 양쪽을 소문자로 비교해 대소문자를 구분하지 않는다. trim 후 빈 검색어는 필터 없이 조회한다. 현재 코드의 strpos 방식대로 %와 _도 일반 문자로 검색한다(ADR-059). 동일 정렬 값은 id ASC로 안정화한다. points 정렬은 Study.points를 사용하며 서버가 정렬·페이지네이션한다. 응원 수는 제공 시 스터디별 일괄 집계해 N번 개별 조회하지 않는다.

offset 도중 다른 사용자가 데이터를 추가·삭제·포인트 변경하면 페이지 간 중복/누락이 생길 수 있다. offset 요구는 유지하고 프론트는 ID 중복 표시를 방지한다. snapshot 페이지네이션을 보장한다고 설명하지 않는다.

### API-ST-02 생성 / API-ST-04 수정

생성 body: {nickname,name,introduction,backgroundKey?,backgroundColor?,password,passwordConfirm}. 수정 body: {nickname?,name?,introduction?,backgroundKey?,backgroundColor?}; 최소 한 필드 필요, password 변경 필드 거절. 닉네임1~10, 이름1~15, 소개1~100그래핌이며 trim 후 검사·저장한다. 비밀번호·확인값은 공통 입력 기준의 원문 검사·공백 포함 거절·불일치 처리를 따른다(ADR-066).

backgroundKey는 기존 8종(green/yellow/blue/pink/image1~4)과 사용자 지정 색상인 custom을 허용한다. 생략하면 green이다. 기존 배경은 backgroundColor를 생략하거나 null로 보내며 응답에는 null을 반환한다. custom은 backgroundColor가 필수이며 정확히 7자인 #RRGGBB만 받는다. 대문자 HEX도 허용하고 저장·응답은 #rrggbb 소문자로 통일한다. RGB 함수·색상 이름·축약 HEX·알파 채널·앞뒤 공백은 허용하지 않는다. 배경 키·색상 형식·조합만 잘못된 요청은 400 INVALID_BACKGROUND다(ADR-074).

PATCH에서 배경을 바꿀 때는 backgroundKey를 전달한다. custom을 지정하면 backgroundColor도 함께 전달하며, 기존 8종으로 바꾸면 색상을 null로 비운다. 배경 필드를 모두 생략하면 기존 키·색상을 유지한다. backgroundColor만 단독으로 전달하거나 기존 배경에 null이 아닌 색상을 함께 전달하면 400 INVALID_BACKGROUND다.

생성/수정 성공은 {data:Study}이며 목록·상세·ID 다건을 포함한 Study 응답은 backgroundColor를 포함한다. 프론트는 색상 선택기로 지정한 값을 저장하고 기존 배경 선택을 유지한다. 사용자 지정 카드의 글자는 배경과 대비되는 색으로 표시한다. 이미지 파일 업로드는 이번 범위에 포함하지 않는다. DB에 비밀번호 해시만 저장하고 응답에서 원문·해시를 제외한다. 생성 성공이 인증 발급을 의미하지 않는다.

스터디 닉네임·이름은 기존 trim 후 저장값의 조합이 같으면 중복이다. 같은 nickname만 또는 같은 name만 있는 것은 허용하며 조합이 같으면 생성은 409 STUDY_CONFLICT다. PATCH도 변경 후 조합이 다른 Study와 같으면 409 STUDY_CONFLICT로 거절한다. Study의 @@unique([nickname,name])와 서버 오류 매핑으로 동시 중복을 방지한다. 이는 기존 문자열 정리 규칙을 유지하는 것이며 검색용 대소문자 무시 정책을 중복 판정에 새로 적용하는 결정은 아니다(ADR-064).

### API-ST-03 상세 / API-ST-05 삭제

상세: {data:{...Study,reactions:[ReactionSummary]}}. reactions는 전체 응원 집계이며 상위 3종으로 자르지 않는다(ADR-072). introduction은 생략 없이 전체 표시하고 카드만 한 줄 말줄임한다(ADR-069). 주간 표는 ST-06으로 별도 조회한다.
삭제: DELETE body {password}. bcrypt 검증 후 Study와 연결 데이터를 Cascade 삭제, 204. 헤더가 아닌 삭제 모달 본문의 비밀번호를 검증한다. 성공 후 / 이동 및 에러토스트 형식의 삭제 성공 안내. 해당 스터디의 앱 메모리 비밀번호·최근 조회 ID도 정리한다.

### API-ST-06 기록표

query: weekStart=YYYY-MM-DD는 필수다. 입력한 날짜가 속한 주의 월요일로 보정하고 그날부터 일요일까지 7일을 조회한다. 예: 2026-10-15 입력 → weekStart=2026-10-12, 10-12~10-18 조회. 생략 시 현재 주를 자동 선택하지 않는다. 과거·미래에 별도 기간 제한을 두지 않되 실제 존재하는 날짜이고 보정 후7일 전체가 0001~9999년의 YYYY-MM-DD로 표현돼야 한다. 형식·표현 범위 오류와 알 수 없는 쿼리는 400 VALIDATION_ERROR다. 과거 주 이동 UI는 선택 개선이다(ADR-060).

조회 주 첫날 W, 마지막날 E에 대해 Routine.startsOn <= E AND (endsOn IS NULL OR endsOn >= W)인 습관만 조회한다. 행은 createdAt ASC → id ASC다. 날짜 칸은 startsOn <= 날짜 AND (endsOn IS NULL OR 날짜 <= endsOn)이면 유효하며 종료 당일을 포함한다. 기간 밖은 completed=null로 반환해 회색 아이콘으로 표시한다.

응답: {data:{weekStart,routines:[{id,name,cells:[{recordDate,completed}]}]}}. weekStart는 보정된 월요일이고 cells는 월~일 순서의7개다. 유효한 칸에 이력이 없으면 completed=false, 유효 기간 밖은 completed=null이다. 별도 dates 배열·exists 필드·행별 startsOn/endsOn은 보내지 않는다. 종료 당일 체크를 유지하고 이름은 최신 Routine.name을 사용한다. 행은 반환된 목록 순서대로 18개 색상을 배정하고 19번째 행부터 처음 색상으로 반복한다. 구체 색상값은 추후 지정하고 색상은 프론트에서 결정하며 응답 필드·DB 색상 컬럼을 추가하지 않는다(ADR-060·065).

### API-ST-07 응원

body {browserId,emoji}. browserId는 UUID·LocalStorage의 동일 브라우저 프로필 식별이며 신원 증명이 아니다. emoji-picker-react에서 제공하는 모든 이모지를 허용한다. 서버는 피부색 수정자를 제거한 기본 이모지를 Reaction.emoji에 저장하고 동일한 값으로 중복 검사·집계·응답을 처리한다. 예: 👍·👍🏽·👍🏻는 모두 👍다. PK(studyId,browserId,emoji)는 기본 이모지 기준이므로 같은 브라우저가 피부색만 바꿔도 409 REACTION_POLICY_CONFLICT다. 서로 다른 브라우저는 같은 기본 이모지 집계에 각각1회씩 포함한다. 기본 피부색 표현을 사용하며 피부색 외의 이모지 종류를 임의로 합치지 않는다(ADR-064).

정규화는 피부색 수정자 U+1F3FB~U+1F3FF를 제거하는 공통 처리로 정의한다. 선택창은 emoji-picker-react 기본 UI를 사용하며 별도 외부 이모지 API를 도입하지 않는다. 서로 다른 기본 이모지 종류 수는 제한하지 않는 기존 정책을 유지한다. 임의 browserId 변경을 영구 개인별 제한으로 막는다고 설명하지 않는다.

성공 {data:{reactions:[ReactionSummary]}}. 상세(ST-03)·등록(ST-07)은 COUNT DESC → MIN(createdAt) ASC → emoji ASC(C collation) 순으로 전체 집계를 반환하며 LIMIT 3을 적용하지 않는다. ID 다건(ST-08)은 같은 정렬의 상위 3종만 반환하고 3종 미만이면 있는 만큼 반환한다(ADR-072). 선택기의 모든 이모지를 허용하며 피부색 변형은 같은 기본 이모지로 집계한다. 피부색 변경 외의 추가 표현 통합은 이번 결정에 포함하지 않는다.

### API-ST-08 ID 다건 조회

홈의 최근 조회 UI는 최대 3개다. 실제 상세를 조회한 ID를 [방금 조회한 ID, ...기존 ID에서 해당 ID 제외] 순서로 저장하고 앞 3개만 남긴다. 뒤의 ID를 재방문하면 맨 앞으로 이동한다. 아래 ST-08 자체의 최대 10개 계약은 유지하며 UI 제한 3개로 바꾸지 않는다.

query ids=UUID,UUID,…; 모든 ID의 UUID 형식을 검사하고 첫 등장 순서로 중복을 제거한다. **중복 제거 후 서로 다른 ID 최대 10개**다. 같은 ID를 반복해 원래 요청 항목이 10개를 넘어도 중복 제거 후 10개 이하면 허용하며 서로 다른 ID가11개 이상이면 400 VALIDATION_ERROR다. 없는/삭제된 ID를 조회 결과에서 제외하기 전에 개수 제한을 검사한다(ADR-063).

조회 결과는 첫 등장 순서를 유지하고 없는/삭제된 ID는 제외하며 {data:[카드용 Study와 reactions]}를 반환한다. reactions는 정렬된 상위 3종을 유지한다(ADR-072). 모두 없으면 data:[], UUID 오류는 400 VALIDATION_ERROR다. 삭제 항목은 최근 조회 LocalStorage에서도 정리한다. ids 외 keyword/sort/offset/limit 등은 혼합할 수 없고 400 VALIDATION_ERROR다. /studies/batch는 /studies/{studyId}보다 먼저 라우팅한다.

## 5. 비밀번호 확인

### API-AU-01 비밀번호 최초 확인·재입력

body {password}. 원문 형식 검사·Study 존재 확인·bcrypt 검증 후 200 {data:{verified:true}}. 공백 포함은 400 VALIDATION_ERROR, 유효한 형식의 오답은 401 PASSWORD_MISMATCH다. 토큰이나 확인 효력 만료 시각은 없다. 이후 수정·습관·집중 요청의 X-Study-Password도 매번 공백 제거 없이 같은 원문 검사·공백 포함 거절·bcrypt 검증을 적용한다.

비밀번호 모달의 나가기/취소는 이전 화면 또는 홈으로 이동한다(ADR-070). 검증하지 않은 상태에서는 보호 데이터를 불러오거나 조작하지 않는다. 요청 중간 취소 기능은 추가하지 않는다.

## 6. 습관 API

### 현재 적용 범위

- HB-01 오늘 목록과 HB-05 체크·해제는 유지한다.
- 개별 생성 HB-02·이름 수정 HB-03·종료 HB-04는 폐기한다. ID는 재사용하지 않는다. 생성·수정·종료 기능은 일괄 저장으로 제공한다(ADR-071 및 2026-10-20 사용자 후속 결정).
- 현재 소스에 남은 POST /routines는 제거 대상이다. 폐기 경로의 404/405 등 구체 실패 응답은 새 계약으로 확정하지 않는다.

### API-HB-01 오늘 목록

200 {data:{recordDate,serverTime,routines:[Routine]}}. endsOn IS NULL AND startsOn <= 한국 오늘인 습관을 createdAt ASC → id ASC로 반환한다. 이름 변경은 과거 표에도 반영된다.

### API-HB-05 체크·해제

PUT body {recordDate,completed:boolean}. 서버 한국 오늘과 일치하며 종료되지 않은 습관만 체크·해제한다. (routineId,recordDate)를 upsert하고 해제도 completed=false 행을 보존한다. 200 {data:{routineId,recordDate,completed}}. 날짜 불일치는 409 DATE_CHANGED이며 오늘 목록을 재조회한다.

### API-HB-06 일괄 저장

습관 편집의 ‘수정 완료’ 버튼 한 번으로 추가·이름 변경·종료를 한 요청에 반영한다. 모두 성공하면 최신 오늘 목록을 반환하고 하나라도 실패하면 이번 변경을 전부 롤백한다(ADR-071).

| 항목 | 확정 계약 |
| --- | --- |
| 추적 ID | API-HB-06(기존 폐기 ID 재사용 없음) |
| Method·Path | PATCH /studies/{studyId}/routines/batch |
| 인증 | X-Study-Password, 요청마다 bcrypt 검증 |
| 본문 | {creates:[{name}],updates:[{routineId,name}],endIds:[UUID]} |
| 성공 | 200, HB-01과 같은 오늘 목록 응답 |
| 검증 | 세 배열 필수, 각 최대 18개. updates와 endIds 합계 최대 18개·ID 중복 및 수정/종료 겹침 거절. UUID는 소문자로 정규화 |
| 빈 변경 | 세 배열이 모두 비어 있으면 변경 없이 오늘 목록 반환 |
| 실패 | 기존 VALIDATION_ERROR·STUDY_NOT_FOUND·ROUTINE_NOT_FOUND·ROUTINE_ENDED 적용. 전체 롤백 |

공통 저장 기준: 이름은 trim 후 그래핌 1~20, 빈 값·공백만 있는 이름은 거절한다. 종료일은 서버 한국 오늘이며 재종료로 최초 종료일을 덮어쓰지 않는다. 미종료 습관만 최대 18개이고 종료로 확보한 자리에 같은 저장의 생성을 반영한다. Study→Routine 순서의 잠금과 같은 트랜잭션에서 변경한다. 요청 형식·대상 소속·종료 상태·활성 개수 검사에 실패하면 일부 변경도 저장하지 않는다.

드래그 정렬은 ISS-031 후속 범위이며 position/order 필드·순서 컬럼·변경 API는 추가하지 않는다.

## 7. 집중 상태·완료 지급·중복 요청

| 동작 | 허용 상태 | 처리 |
| --- | --- | --- |
| 새 Start(FC-02) | RUNNING/PAUSED 없음 | 매번 새 RUNNING 행·경과 0, 201 |
| pause(FC-03) | 목표 도달 전 RUNNING | PAUSED·서버 경과 저장·lastStartedAt=null·지급 없음 |
| resume(FC-04) | 목표 미달 PAUSED | 동일 행 RUNNING·기존 경과 유지·lastStartedAt=서버 현재 시각 |
| reset(FC-05) | PAUSED | RESET 종료·이력 보존·지급 없음 |
| complete(FC-06) | 서버가 계산한 경과가 목표에 도달한 RUNNING/PAUSED | COMPLETED·목표 경과 확정·완료 포인트 지급 |

- FC-02 body {goalMinutes}, 10~180 정수(기본 10). 같은 이름의 DB 컬럼 goalMinutes로 저장한다. challengeId·attemptNumber를 시작 입력으로 받지 않는다.
- 모든 집중 API는 비밀번호 헤더를 검증한다. FC-03~06은 본문이 없으며 stateVersion·reason·키를 보내지 않는다. 경로 challengeId가 조작할 행을 지정한다.
- RUNNING/PAUSED가 있으면 새 시작은 409 CHALLENGE_CONFLICT다. PAUSED A가 있으면 재개하거나 초기화해야 한다. Study 잠금과 활성 부분 UNIQUE로 스터디당 합계 1개를 보장한다.
- 실제 경과: RUNNING은 min(goalMinutes×60000, elapsedMilliseconds + max(0, 서버 현재 시각-lastStartedAt)), 그 외는 저장된 elapsedMilliseconds다. 조회는 DB 경과를 반복 가산하지 않는다.
- pause는 실제 경과를 저장하고 lastStartedAt=null로 한다. resume는 저장 경과를 유지하고 lastStartedAt을 현재 서버 시각으로 설정한다. 정지 시간·목표 초과분은 포함하지 않는다.
- reset은 PAUSED에서만 가능하다. 행을 삭제하지 않고 RESET으로 남기며 awardedPoints=0을 유지한다. 프론트만 기존 목표·경과 0의 시작 전 상태로 돌아간다. 다음 Start는 새 행이다.
- **완료 시에만** floor(goalMinutes/10)+3P를 지급한다. 10/20/25/180분은 4/5/5/21P. 상한 없음. 정지·재개·초기화·조회에는 지급하지 않는다.
- Study→Challenge 잠금 → 비밀번호/소속/현재 상태/서버 경과 확인 → RUNNING/PAUSED를 COMPLETED로 조건부 전환 → awardedPoints 저장·Study.points 원자 증가를 같은 트랜잭션으로 처리한다. 전이에 실제 성공한 요청만 증가하며 실패 시 전부 롤백한다.
- 이미 PAUSED인 pause 재요청은 200·경과 변화 없음. 이미 RUNNING인 resume는 409 INVALID_CHALLENGE_STATE이며 시작 시각을 덮어쓰지 않는다.
- 같은 RESET의 reset 재요청은 200·settlement=null. 같은 COMPLETED의 complete 재요청은 200·신규 지급 0P이며 저장된 Challenge.awardedPoints와 Study.points는 그대로다.
- RESET에 complete, COMPLETED에 reset, 종료 상태의 pause/resume는 409 INVALID_CHALLENGE_STATE다. 목표 전 complete는 409 CHALLENGE_NOT_FINISHED. 목표에 도달한 RUNNING의 pause 또는 PAUSED의 resume는 409 CHALLENGE_FINISHED로 완료를 안내한다.
- 조회는 상태 종료·포인트 지급을 수행하지 않는다. 남은 시간이 0이면 클라이언트가 complete를 보내고 서버가 목표 도달을 검증한다. 백그라운드 자동 지급 작업은 없다.
- 활성 슬롯은 명시적 reset/complete가 처리될 때 해제한다. 브라우저가 닫힌 동안 목표를 채워도 재접속 후 완료 처리하기 전에는 새 시작을 허용하지 않는다.
- stateVersion·브라우저 소유권은 없다. 다른 브라우저의 비밀번호 검증 후 같은 집중 조작을 허용하며 오래된 요청의 순서 충돌 방지는 이번 범위에서 제외한다. 기본 상태 검사·단일 활성·완료 반복 지급 방지는 유지한다.

## 8. 내부 이동·새로고침·브라우저 종료

- 자동 일시정지·15초 Heartbeat·90초 연결 만료·담당 탭·키 복구는 제외한다. 해당 API-AU-02·API-FC-07도 제거했다.
- RUNNING은 브라우저·페이지 존재와 무관하게 서버 시간으로 계속 흐른다. 페이지 종료 이벤트에서 pause를 보내지 않는다. PAUSED는 사용자의 resume까지 그대로다.
- 내부 이동 시 앱 메모리 비밀번호를 유지하고 FC-01 보호 요청으로 상태를 조회한다. 새로고침·앱 종료 후에는 AU-01로 다시 확인한다. RUNNING은 서버 시간으로 복원하고 PAUSED는 그대로 표시한다.
- 자정은 집중 상태·진행 시간·완료 보상에 영향을 주지 않는다. 습관의 한국 날짜 경계와 구분한다.
- 창이 닫힌 동안 목표에 도달한 경우에도 접속 중 주기 작업 없이 복귀 후 완료 요청으로 지급한다. 오프라인 화면이 서버 없이 임의로 지급하지 않는다.

## 9. 실패 목록

| HTTP | code | 조건 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | UUID·타입·그래핌 범위·공백만 있는 필수값·지원하지 않는 본문/쿼리 필드·목록limit의1~6 범위 위반·활성 습관 18개 초과·비밀번호·확인값의 공백 포함 또는 허용 문자/길이 오류·ST-08 중복 제거 후 ID10개 초과 |
| 400 | PASSWORD_CONFIRM_MISMATCH | 생성 비밀번호 확인 불일치 |
| 400 | INVALID_BACKGROUND | 기존 8종/custom 외의 키, 사용자 지정 HEX 형식 오류, custom 색상 누락 또는 배경 키·색상 조합 오류(ADR-074) |
| 400 | INVALID_EMOJI | 선택기가 제공하는 이모지가 아닌 입력·빈 값 등 유효하지 않은 이모지 표현 |
| 401 | PASSWORD_MISMATCH | 페이지 진입·보호 요청·삭제의 비밀번호 오류 |
| 401 | VERIFICATION_REQUIRED | 보호 요청 비밀번호 헤더 또는 진입 검증·삭제 본문의 비밀번호 누락 |
| 404 | STUDY_NOT_FOUND / ROUTINE_NOT_FOUND / CHALLENGE_NOT_FOUND | 대상 없음 또는 하위 데이터 소속 불일치 |
| 409 | STUDY_CONFLICT | trim 후 nickname·name 조합이 이미 존재하는 생성·수정 |
| 409 | CHALLENGE_CONFLICT | 스터디에 RUNNING/PAUSED 존재 |
| 409 | INVALID_CHALLENGE_STATE | 진행 중 reset·종료 상태의 다른 조작 등 |
| 409 | CHALLENGE_NOT_FINISHED / CHALLENGE_FINISHED | 완료 전 complete / 완료해야 하는 상태의 pause·resume |
| 409 | ROUTINE_ENDED | 종료된 습관 체크·이름 변경 |
| 409 | DATE_CHANGED | 체크 요청 날짜가 서버 한국 오늘과 다름 |
| 409 | REACTION_POLICY_CONFLICT | 같은 studyId/browserId/기본 emoji 중복; 피부색만 바꾼 요청도 포함 |
| 500 | INTERNAL_ERROR | DB·내부 장애; 민감값 미노출 |

스터디 중복 조합은 409 STUDY_CONFLICT로 응답한다. 클라이언트 사전 확인만으로 대체하지 않고 DB 복합 UNIQUE 충돌도 같은 오류로 변환한다. 습관 활성 18개 초과는 기존 VALIDATION_ERROR(400)를 사용한다. 활성 행이 있는 상태의 새 시작은 브라우저와 무관하게 CHALLENGE_CONFLICT다. 비밀번호를 아는 다른 브라우저의 기존 집중 조작은 허용한다. 페이지의 verified 상태만으로 서버 검증을 생략하지 않는다.

## 10. 확정 사항과 남은 자료

| ID | 상태·내용 | 영향 |
| --- | --- | --- |
| API-Q-04 · 확정 | 목록 기본/최대6·최신순, 최근 조회 중복 없는 3개·재방문 맨 앞으로, 생성 당일 1일째. 다건 상한 10개는 별도 유지 | 목록·최근·진행 일수 / ADR-064 |
| API-Q-05 · 색상값 수신 대기 | 월~일7칸·주간 겹침·생성일 순·축소 응답 유지. 목록 순서대로 18개 색상을 순환 배정, 값은 추후 지정 | 기록표 / ADR-060·065 |
| API-Q-06 · 확정 | 일반 문자열 trim·그래핌·TEXT·활성 18개·생성일 순 유지. 비밀번호는 공백 제거 없이 포함 시 거절. 별도 입력 바이트 상한은 미정 | ADR-056~057·066 |
| API-Q-07 · 확정 | 모든 이모지 허용·피부색 제거 후 기본 이모지로 저장/중복/집계. emoji-picker-react 기본 UI | 응원 / ADR-064·065 |
| API-Q-08 · 자산 수신 대기 | 기존8종 키·기본green 유지, 실제 색상·이미지는 추후 지정. 같은 nickname/name 조합은 409 STUDY_CONFLICT | 생성·수정·DB 복합 UNIQUE |
| API-Q-09 · 제외 | 연결 확인·연결 만료·담당 탭·자동 pause 제외 | 미정 아님 |
| API-Q-12 · 일부 자료 수신 대기 | Header는 fixed·홈 전용 생성 버튼. 적용 페이지 최상단 main에 margin-top:100px. 일반 모달은 배경 클릭 닫기·Escape 무시, 비밀번호 취소는 이전 화면 또는 홈. 상세 소개 전체 표시. 반응형·습관 편집 시안·18색 값은 수신 대기 | ADR-065·067·069·070 |
| API-Q-14 · 확정 | 수정 완료 한 번으로 API-HB-06 일괄 저장. PATCH /routines/batch·creates/updates/endIds·200 오늘 목록·실패 전체 롤백. 개별 생성·수정·종료 폐기 | ADR-071·ISS-013·046 |
| API-Q-15 · 설계 확인 대기 | 비밀번호 모달 취소는 이전 화면 또는 홈. 대상 선택 조건·배경 클릭 시 이동 적용 범위·스터디별 앱 메모리 구조는 후속 설계 | ADR-070·073 |
| API-Q-13 · 후속 | 드래그앤드롭 저장·변경 API와 타이머 숫자 직접 입력은 현재 확정 범위 아님 | ISS-031 및 후속 검토 |

기존 응답 필드 이름은 유지하되 응원 배열 범위는 ADR-072를 따른다. 진행 일수·최근 조회 순서·색상·Header·모달 동작은 표시·클라이언트 규칙이며 새 API나 DTO 필드를 추가하지 않는다. 생성일 기준 1일째 표시에서 사용하는 한국 날짜 기준은 기존 날짜 규칙을 따른다. 오류 문구는 ADR-058의 임시 구현 허용을 유지한다.

## 11. 기능 ID 대응

| 기능 ID | 연결 API 또는 프론트 처리 |
| --- | --- |
| F-ST-001 | API-ST-01 |
| F-ST-002 | API-ST-01 + 프론트 목록 누적 |
| F-ST-003 | API-ST-01; 스터디 이름·닉네임·소개 검색 |
| F-ST-004 | API-ST-01 |
| F-ST-005 | LocalStorage에 중복 없는 최근ID3개·재방문 맨 앞으로 기록 + ST-08로 조회. 다건API 상한은 10개 유지 |
| F-ST-006 | API-ST-02 |
| F-ST-007 | API-ST-03, API-ST-06 |
| F-ST-008 | API-AU-01, API-ST-04 |
| F-ST-009 | 삭제 모달 비밀번호를 API-ST-05 본문에 전달 |
| F-ST-010 | API-ST-06 |
| F-ST-011 | API-ST-03 |
| F-ST-012 | API-ST-07 |
| F-ST-013 | 프론트 현재 상세 링크 복사. 별도 API 없음 |
| F-ST-014 | API-ST-01·03의 createdAt 사용; 생성 당일 1일째 |
| F-HB-001 | API-HB-01 |
| F-HB-002 | 프론트 시간 표시, API-HB-01의 서버 날짜로 기준 확인 |
| F-HB-003 | React Router 화면 이동. 별도 API 없음 |
| F-HB-004 | API-HB-06 일괄 저장 |
| F-HB-005 | API-HB-05 |
| F-HB-006 | 날짜별 조회·기록 처리; 체크 전체 초기화 API 없음 |
| F-HB-007 | API-HB-06 일괄 저장 |
| F-HB-008 | API-HB-06 일괄 저장 |
| F-FC-001 | API-FC-01 |
| F-FC-002 | 프론트 시작 전 설정 + API-FC-02 입력. RESET/COMPLETED 이후 최근 목표 복원 |
| F-FC-003 | API-FC-02 |
| F-FC-004 | API-FC-06 |
| F-FC-005 | API-FC-06 완료 지급·Challenge.awardedPoints·Study.points 조회 |
| F-FC-006 | 프론트 이동 중 상태 유지 + API-FC-01 |
| F-FC-007 | API-FC-01 |
| F-FC-008 | 이번 범위 제외. 자동 일시정지 API 없음 |
| F-FC-009 | API-FC-01 |
| F-FC-010 | API-FC-03 |
| F-FC-011 | API-FC-04 |
| F-FC-012 | API-FC-05 |
| F-AU-001 | 앱 메모리에 비밀번호가 없으면 AU-01 확인·매 보호 요청 헤더 검증 |
| F-AU-002 | 토큰·자정 만료는 제외. 내부 이동은 앱 메모리 유지·새로고침 후 재입력 |

## 12. 습관 동시 요청

Study→Routine 순서의 잠금 안에서 종료 여부·한국 오늘 날짜·유효 기간을 검사하고 변경한다. 일괄 종료와 체크의 경합에서 먼저 잠금을 획득한 요청의 결과를 확정한다. 종료 뒤 도착한 체크·이름 변경은 409 ROUTINE_ENDED, 종료 전 완료한 체크는 기록표에 보존한다. 일괄 저장의 재종료는 최초 endsOn을 바꾸지 않는다.

집중의 stateVersion·여러 브라우저 요청 순서 보장은 제외했지만 위 습관 기록 무결성과 완료 중복 지급 방지를 함께 제거하지 않는다.

## 13. 실패 메시지의 상태

실패 응답의 code·HTTP·조건은 9절을 따른다. message의 최종 문구는 추후 확정하며 그전에는 구현자가 임시 안내 문구를 정해 사용한다(ADR-058). 명세의 자리표시자를 실제 응답에 남길 필요는 없다. 임시 문구를 최종 확정으로 기록하지 않고 공통 메시지 정의로 관리한다. details는 필드 오류 등 보충 정보이며 민감값을 포함하지 않는다. INTERNAL_ERROR에는 DB 오류·접속 정보·스택을 넣지 않는다.

다음은 임시 구현용 문구 예시이며 최종 승인 문구가 아니다. 상황별 구체 안내도 같은 code로 제공할 수 있다.

| code | 임시 안내 예시 |
| --- | --- |
| VALIDATION_ERROR | 요청 내용을 확인해주세요. |
| VALIDATION_ERROR · 습관 이름 | 습관 이름은 앞뒤 공백을 제외하고 1~20글자로 입력해주세요. |
| VALIDATION_ERROR · 습관 개수 | 종료되지 않은 습관은 스터디당 최대 18개까지 만들 수 있습니다. |
| PASSWORD_CONFIRM_MISMATCH | 비밀번호 확인이 일치하지 않습니다. |
| INTERNAL_ERROR | 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요. |

실패 모양 예시(message는 임시 문구):
```json
{"error":{"code":"PASSWORD_CONFIRM_MISMATCH","message":"비밀번호 확인이 일치하지 않습니다.","details":null}}
```

## 14. 명세 갱신과 검증 경계 — 2026-10-20

- ADR-067~073과 이후 사용자 결정을 반영한다. Header·소개·모달·앱 메모리는 화면·클라이언트 규칙이며 응원 집계 배열과 습관 저장 계약은 API 변경이다.
- 개별 습관 생성·수정·종료는 폐기한다. 현재 코드에 남은 개별 생성 경로 제거와 일괄 저장의 계약 정합성은 후속 구현·검증 대상이다.
- batch 라우트·스키마·서비스의 존재는 정적으로 확인했다. 확정된 API-HB-06과의 정합성·실제 실행은 별도로 확인한다.
- Study 복합 UNIQUE migration 파일이 존재한다. 실제 DB 적용·중복 데이터 정리·피부색 정규화 전환은 확인하지 않았다. 기존 데이터를 임의 삭제하지 않는다.
- 패키지에는 Sass·json-server가 있으며 Vitest는 사용하지 않는다. 임시 데이터 서버 성공은 실제 API 연동 완료가 아니다.
- 이번 작업은 문서·요청 예시만 수정한다. 설치·Prisma CLI·migration·서버·API·테스트·배포는 실행하지 않았다. HTTP 주석은 기대값이며 검증 결과가 아니다.
