# 공부의 숲 API Docs

- 버전: 0.10 킥오프 입력·습관 정책 반영 · 2026-10-13 (Asia/Seoul)
- 기준: [README.md](../README.md), [DB.md](DB.md), [ADR.md](ADR.md) ADR-051~058; 습관·응원·조회는 ADR-045~046의 후속 보완을 따른다.
- 요청 예시: [api.http](../api/requests/api.http). 이번에는 문서·스키마만 변경하며 서버 구현·요청 실행·DB 적용을 하지 않는다.
- 확정 정책과 기술 계약을 구분한다. 남은 제품 결정은 10절에서 관리한다. 리소스·필드·실패 코드는 DB의 Routine·RoutineHistory·Challenge 명칭을 따른다.
- 용어 통일로 기존 리소스 경로·필드·실패 코드 별칭은 더 이상 지원하지 않는다. 변경 이력은 ADR-054를 따른다.
- 이전 Authorization·X-Timer-Key·stateVersion·Heartbeat·조작권 복구·초기화 보상 계약은 폐기한다. API-AU-02·API-FC-07 ID는 재사용하지 않는다. brief.md 원문은 보존한다.

## 1. 공통 계약과 인증

Base URL은 서버 주소 + /api. JSON 요청·응답, UUID ID, ISO 8601 UTC 일시, YYYY-MM-DD 한국 날짜를 사용한다. 성공은 {data:...}, 목록은 {data:[],pagination:{offset,limit,total,hasMore}}, 실패는 {error:{code,message,details}}. 204는 본문이 없다. 실패 시 현재 페이지를 유지하며 요청 중간 취소 기능은 없다.

### 페이지별·요청별 비밀번호 확인

- 습관·집중·스터디 수정 페이지에 진입할 때마다 자체 모달에서 비밀번호를 입력하고 AU-01로 확인한다. 새로고침·페이지 이탈 후 재진입에서도 다시 입력한다.
- 입력값은 해당 페이지 메모리에만 보관한다. 일반 보호 요청은 `X-Study-Password: <입력한 비밀번호>` 헤더를 보내며 서버가 해당 스터디의 bcrypt 해시와 **요청마다** 비교한다.
- AU-01 페이지 진입 검증과 ST-05 삭제 모달은 본문 `{password}`로 검증한다. 생성 ST-02도 기존 본문 비밀번호를 유지한다. 이 세 API는 비밀번호 헤더를 요구하지 않는다.
- AU-01의 성공 응답은 화면 진입 안내일 뿐 이후 보호 요청을 허용하는 증표가 아니다. 헤더 없이 보호 API를 호출하면 이전 확인 여부와 관계없이 거절한다.
- LocalStorage·쿠키·URL·응답·로그에 비밀번호를 저장/출력하지 않는다. 이탈 시 페이지 메모리에서 폐기한다. 브라우저에 비밀번호 해시를 보관해 인증으로 쓰지도 않는다.
- HTTPS, CORS의 X-Study-Password 허용, 민감 응답 Cache-Control: no-store, 비밀번호 헤더·본문 로그 제외를 적용한다. 헤더 자체는 암호화 수단이 아니다.
- 인증 토큰·타이머 전용 키·서명·만료·VerificationToken 테이블·조작권 복구를 사용하지 않는다. 응원 browserId는 비밀번호 검증과 무관하다.
- 비밀번호를 아는 다른 브라우저도 같은 집중을 조작할 수 있다. 브라우저별 소유권과 여러 브라우저 요청 순서 충돌 처리는 제외한다. 스터디당 활성 1개와 완료 중복 지급 방지는 유지한다.
- 한국 자정은 습관 날짜 경계에만 적용한다. 비밀번호 만료 시각·타이머 자동 정지 기준으로 사용하지 않는다.

### 공통 문자열 입력 기준 — ADR-056~057

닉네임·스터디 이름·소개·습관 이름은 문자열만 받고 trim()으로 앞뒤 공백을 제거한 뒤 Intl.Segmenter("ko", {granularity:"grapheme"})로 센다. 허용 범위는 각각 1~10·1~15·1~100·1~20그래핌이다. 빈 문자열·공백만 있는 입력과 범위 밖 값은 400 VALIDATION_ERROR다. 생성·수정 모두 정리한 문자열을 저장하며 프론트와 서버의 계산 기준을 일치시킨다. 단순 String.length·Array.from(text).length·HTML maxlength만으로 이 제한을 대신하지 않는다. 그래핌 개수를 저장하는 별도 필드는 추가하지 않는다.

비밀번호·확인값에는 위 trim 규칙을 적용하지 않는다. 길이 4~20, `/^[A-Za-z0-9!@#$%^&*]+$/`를 원문에 적용해 공백·탭·줄바꿈 등 허용 문자 밖 입력을 거절한다. 앞뒤·중간 공백을 제거해서 통과시키지 않는다. 생성·확인·삭제·보호 요청의 비밀번호에 같은 원칙을 적용하며 형식 오류는 400 VALIDATION_ERROR, 필요한 값 누락은 기존 VERIFICATION_REQUIRED 계약, 형식이 맞지만 bcrypt가 불일치하면 401 PASSWORD_MISMATCH다. 생성 확인값은 형식 검사 후 불일치 시 400 PASSWORD_CONFIRM_MISMATCH다. 프론트도 타이핑·붙여넣기 등으로 공백이 들어가지 않도록 처리한다.

## 2. API 계약 표

모든 경로는 /api 뒤에 붙는다. /studies/batch는 동적 /studies/{studyId}보다 먼저 라우팅한다.

| API ID | Method | Path | 기능 | 접근 | 성공 | 중간 우선순위 | 담당 이슈 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API-ST-01 | GET | /studies | 목록·검색·정렬·offset | 공개 | 200 | P0 기본 / P2 확장 | ISS-009, ISS-021 |
| API-ST-02 | POST | /studies | 스터디 생성 | 공개 | 201 | P0 | ISS-008 |
| API-ST-03 | GET | /studies/{studyId} | 상세·상위 응원 | 공개 | 200 | P0 상세 / P2 응원 | ISS-009, ISS-023 |
| API-ST-04 | PATCH | /studies/{studyId} | 정보 수정 | 비밀번호 헤더 | 200 | - | ISS-010 |
| API-ST-05 | DELETE | /studies/{studyId} | 스터디·연결 데이터 삭제 | 삭제 모달 비밀번호 | 204 | - | ISS-010 |
| API-ST-06 | GET | /studies/{studyId}/routine-histories | 주간 기록표 | 공개 | 200 | P0 | ISS-014 |
| API-ST-07 | POST | /studies/{studyId}/reactions | 응원 추가 | 공개 | 200 | P2 | ISS-023 |
| API-ST-08 | GET | /studies/batch | 최근 조회용 ID 다건 조회 | 공개 | 200 | P2 | ISS-022(API) |
| API-AU-01 | POST | /studies/{studyId}/password-verifications | 페이지 진입 비밀번호 검증 | 비밀번호 본문 | 200 | P1 | ISS-007 |
| API-HB-01 | GET | /studies/{studyId}/routines | 오늘 목록 | 비밀번호 헤더 | 200 | P0 | ISS-011 |
| API-HB-02 | POST | /studies/{studyId}/routines | 습관 생성 | 비밀번호 헤더 | 201 | P0 | ISS-011 |
| API-HB-03 | PATCH | /studies/{studyId}/routines/{routineId} | 이름 수정 | 비밀번호 헤더 | 200 | - | ISS-013 |
| API-HB-04 | DELETE | /studies/{studyId}/routines/{routineId} | 종료 | 비밀번호 헤더 | 204 | - | ISS-013 |
| API-HB-05 | PUT | /studies/{studyId}/routines/{routineId}/check | 오늘 체크·해제 | 비밀번호 헤더 | 200 | P0 | ISS-012 |
| API-FC-01 | GET | /studies/{studyId}/challenges/current | 현재 집중·마지막 목표 복원 | 비밀번호 헤더 | 200 | P0 | ISS-015 |
| API-FC-02 | POST | /studies/{studyId}/challenges | 매번 새 행으로 시작 | 비밀번호 헤더 | 201 | P0 | ISS-015 |
| API-FC-03 | POST | /studies/{studyId}/challenges/{challengeId}/pause | 사용자 일시정지 | 비밀번호 헤더 | 200 | - | ISS-016 |
| API-FC-04 | POST | /studies/{studyId}/challenges/{challengeId}/resume | 정지된 집중 재개 | 비밀번호 헤더 | 200 | - | ISS-016 |
| API-FC-05 | POST | /studies/{studyId}/challenges/{challengeId}/reset | 무지급·RESET 종료 | 비밀번호 헤더 | 200 | - | ISS-017 |
| API-FC-06 | POST | /studies/{studyId}/challenges/{challengeId}/complete | 목표 완료·지급 | 비밀번호 헤더 | 200 | P0 완료 / P1 검증 | ISS-018, ISS-028 |

### 중간점검 구현 범위와 이슈 매칭 — ADR-055

10/13~15 구현, 10/16 발표. 프론트 없이 `api/requests/api.http`로 시연한다. 아래 우선순위는 구현 범위 배정이며 경로·필드·응답·실패·보호 조건 변경이 아니다. P1이 미구현인 상태를 계약 충족으로 보고하지 않는다.

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

범위 밖 API-ST-04/05, API-HB-03/04, API-FC-03/04/05의 중간 우선순위는 `-`다. 계약은 후속 구현을 위해 보존한다. API-ST-01은 기본 목록 P0 / 검색·정렬·offset 확장 P2, API-ST-03은 상세·총점 P0 / 상위 응원 집계 P2, API-FC-06은 완료·지급 흐름 P0 / 서버 완료 검증·중복 방지 P1로 나눠 추적한다. 보호 요청의 헤더는 그대로 유지한다. 별도 포인트 조회 API는 추가하지 않으며 API-ST-03 또는 API-FC-01의 points를 사용한다.

## 3. 데이터 모양

| DTO | 필드 |
| --- | --- |
| Study | id, nickname, name, introduction, backgroundKey, points(Study.points), createdAt, updatedAt |
| ReactionSummary | emoji, count |
| Routine | id, studyId, name, startsOn, endsOn(null 허용), completed(오늘 목록에서만) |
| Challenge | id, studyId, goalMinutes, status(RUNNING/PAUSED/COMPLETED/RESET), elapsedMilliseconds, lastStartedAt(null 허용), awardedPoints, createdAt, elapsedSeconds, remainingSeconds, serverTime, endsAt(RUNNING 파생값 또는 null) |
| Settlement | challengeId, elapsedPoints, goalPoints, awardedPoints(이번 신규 지급 합계) |

Challenge에는 비밀번호·해시·토큰·키를 넣지 않는다. elapsedSeconds는 실제 경과 밀리초를 버림, remainingSeconds는 남은 밀리초를 올림한다. 모든 파생값은 한 서버 시각을 기준으로 계산한다. endsAt은 RUNNING에서 서버 현재 시각 + 남은 밀리초이며 PAUSED/terminal은 null이다.

### DB 기준 명명 규칙

- 모델명은 PascalCase(Study, Routine, RoutineHistory, Challenge, Reaction), JSON 필드는 DB 컬럼과 같은 camelCase를 사용한다.
- API 컬렉션 경로는 /studies, /routines, /routine-histories, /challenges, /reactions다. 현재 활성 집중 조회는 /studies/{studyId}/challenges/current다.
- API-HB / API-FC와 F-HB / F-FC는 문서 추적 ID다. 기존 연결을 보존하며 리소스명으로 사용하지 않는다. 화면 주소도 README의 기존 6개 주소를 유지한다.
- password·passwordConfirm은 입력 전용이며 DB에는 passwordHash만 저장한다. passwordHash는 공개하지 않는다.
- date 형식의 DB 컬럼 recordDate·startsOn·endsOn은 YYYY-MM-DD, 타임스탬프는 UTC ISO 8601로 전달한다.
- elapsedSeconds·remainingSeconds·serverTime·endsAt·weekStart·dates·cells·exists·settlement는 조회/표시용 파생값이며 새 DB 컬럼이 아니다. 시간 단위가 다른 값을 DB 컬럼과 같은 이름으로 보내지 않는다.
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

query: offset(0 이상 정수), limit(양의 정수), keyword(선택), sort(latest/oldest/points_desc/points_asc). 더보기는 limit=6, offset은 누적 개수다. 초기·최근 표시 개수·기본 sort와 제한 상한은 미정이며 api.http는 명시 입력 예시다.

검색 대상은 name/nickname/introduction이며 세 필드 중 하나에 keyword가 포함되는 OR 부분 검색을 기술 계약으로 제안한다. 공백·대소문자·유니코드 규칙은 후속 확인한다. 동일 정렬 값은 id ASC로 안정화하는 기술 기준이다. points 정렬은 Study.points를 사용하며 서버가 정렬·페이지네이션한다. 응원 수는 스터디별 일괄 집계해 N번 개별 조회하지 않는다.

offset 도중 다른 사용자가 데이터를 추가·삭제·포인트 변경하면 페이지 간 중복/누락이 생길 수 있다. offset 요구는 유지하고 프론트는 ID 중복 표시를 방지한다. snapshot 페이지네이션을 보장한다고 설명하지 않는다.

### API-ST-02 생성 / API-ST-04 수정

생성 body: {nickname,name,introduction,backgroundKey?,password,passwordConfirm}. 수정 body: {nickname?,name?,introduction?,backgroundKey?}; 최소 한 필드 필요, password 변경 필드 거절. 닉네임1~10, 이름1~15, 소개1~100그래핌이며 trim 후 검사·저장한다. 비밀번호·확인값은 공통 문자열 입력 기준의 원문 검사와 불일치 처리를 따른다.

backgroundKey는 원색4·이미지4 중 선택, 생략하면 첫 초록색(green). 담당자가 나머지 7종의 임시 키와 표시 자산을 지정해 공유한다. 프론트·서버는 같은 임시 목록으로 표시·검증하며 목록 밖 키는 400 INVALID_BACKGROUND다. 최종 명칭 대기만으로 구현을 보류하지 않는다. 구체 임시 키는 담당자가 공유할 목록을 따르며 여기서 임의로 고정하지 않는다. 추후 키 변경 시 이미 저장된 backgroundKey의 매핑·migration을 함께 검토한다. DB에 해시만 저장하고 응답에서 원문·해시를 제외한다. 생성/수정 성공은 {data:Study}, 프론트가 해당 상세로 이동한다. 생성 성공이 인증 발급을 의미하지 않는다.

### API-ST-03 상세 / API-ST-05 삭제

상세: {data:{...Study,reactions:[ReactionSummary]}}. 주간 표는 ST-06 별도 조회.
삭제: DELETE body {password}. bcrypt 검증 후 Study와 연결 데이터를 Cascade 삭제, 204. 헤더가 아닌 삭제 모달 본문의 비밀번호를 검증한다. 성공 후 / 이동 및 에러토스트 형식의 삭제 성공 안내. 해당 스터디의 페이지 메모리·최근 조회 ID도 정리한다.

### API-ST-06 기록표

query: weekStart=YYYY-MM-DD를 명시하고 연속7일을 조회하는 계약이다. 기본 주·조회 허용 범위는 미정. 과거 주 이동 UI는 선택 개선이다.

조회 주 첫날 W, 마지막날 E에 대해 Routine.startsOn <= E AND (endsOn IS NULL OR endsOn >= W)인 습관만 조회한다. 날짜 칸은 startsOn <= 날짜 AND (endsOn IS NULL OR 날짜 <= endsOn)이면 exists=true, 아니면 exists=false다. 존재하지 않는 칸은 회색 아이콘이다.

응답: {data:{weekStart,dates:[날짜7개],routines:[{id,name,startsOn,endsOn,cells:[{recordDate,exists,completed}]}]}}. 유효한 칸에 이력 행이 없으면 completed=false, exists=false면 completed=null. 종료 당일 체크는 유지하고 생성일 이전은 존재하지 않는다. 이름은 최신 Routine.name을 사용한다. 행 색상은 정해진 순서를 적용하며 실제 색상표·행 순서는 추가 확인한다.

### API-ST-07 응원

body {browserId,emoji}. browserId는 UUID·LocalStorage의 동일 브라우저 프로필 식별이며 신원 증명이 아니다. PK(studyId,browserId,emoji)로 같은 이모지1회 제한. 서로 다른 이모지 종류 수는 제한하지 않는 기존 정책을 유지하되 킥오프의 강사 확인 항목은 추가 확인 대상으로 남긴다. 임의 식별자 변경을 영구 개인별 제한으로 막는다고 설명하지 않는다.

성공 {data:{reactions:[ReactionSummary]}}. 상위 정렬은 COUNT DESC → MIN(createdAt) ASC → emoji ASC(기술적으로 DB의 C collation 사용)이며 LIMIT3. 이모지 종류가3미만이면 있는 만큼 반환하는 기술 표시 기준이다. 허용 이모지·유니코드 동일성은 미정.

### API-ST-08 ID 다건 조회

query ids=UUID,UUID,…; 첫 등장 순서로 중복 제거하고 입력 순서로 반환한다. 없는/삭제된 ID는 제외하며 {data:[카드용 Study와 reactions]} 반환. 모두 없으면 data:[], UUID 오류는400. 최근 조회 ID의 삭제 항목을 로컬에서도 정리한다. keyword/sort/offset/limit와 혼합하지 않는 독립 API이며 다건 수 상한은 확인 대기다.

## 5. 비밀번호 확인

### API-AU-01 페이지 진입 확인

body {password}. Study 존재 확인·bcrypt 검증 후 200 {data:{verified:true}}. 틀리면 401 PASSWORD_MISMATCH. 서버가 발급하는 토큰이나 확인 효력 만료 시각은 없다. 이후 수정·습관·집중 요청도 매번 X-Study-Password를 검증한다.

모달의 나가기/취소는 모달만 닫고 현재 주소를 유지한다. 검증하지 않은 상태에서는 보호 데이터를 불러오거나 조작하지 않는다. 요청 중간 취소 기능은 추가하지 않는다.

## 6. 습관 API

HB-01: {data:{recordDate,serverTime,routines:[Routine]}}. endsOn IS NULL AND startsOn <= 오늘인 습관만 조회하고 createdAt ASC → id ASC로 반환한다. 이름 수정은 과거 표에도 반영된다. 조회 기준은 오늘 목록이며 주간 표의 행 순서는 별도 미정이다.
HB-02 body {name}, 201 {data:Routine}. HB-03 body {name}, 200 {data:Routine}. 이름은 trim 후 그래핌 기준 1~20개이며 조합 이모지도 각각 1글자로 센다. 빈 문자열·공백만 있는 입력은 400 VALIDATION_ERROR로 거절한다. 정리한 이름을 TEXT에 저장하고 서버에서 반드시 검사한다. 목록 수정에서 생성·수정을 함께 보여도 HTTP 작업은 개별 처리한다. 빈 입력 영역 추가는 가능하지만 빈 값을 저장하지 않는다.
HB-04 DELETE body 없음. 처음 종료 시 endsOn=서버 오늘 한국 날짜,204. 이미 종료된 행의 재삭제는 날짜를 덮어쓰지 않고204. 물리 삭제하지 않는다.
HB-05 PUT body {recordDate,completed:boolean}. 서버 오늘 한국 날짜와 일치하며 endsOn이 없는 습관만 체크·해제 가능. (routineId,recordDate) upsert, 해제도 completed=false 행 유지. 200 {data:{routineId,recordDate,completed}}. 날짜 불일치409 DATE_CHANGED는 오래된 화면의 과거 날짜 기록을 막는 기술 계약이며 프론트는 오늘 목록을 재조회한다. 날짜 변경은 이력 전체 삭제가 아니다.

습관 최대18개는 해당 스터디의 endsOn IS NULL인 행만 센다. 종료된 습관과 날짜별 기록은 제외한다. 기존 활성18개에서 생성하면 400 VALIDATION_ERROR이며 종료로 활성17개가 되면 다시 생성할 수 있다. 스터디 잠금과 같은 트랜잭션 안에서 count → create를 처리한다.

드래그앤드롭 순서 변경은 후속 ISS-031에서 다룬다. 현재 요청·응답에 position/order 필드나 순서 변경 API를 추가하지 않으며 DB에도 순서 컬럼을 두지 않는다.

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
- 페이지 이탈·새로고침은 비밀번호 메모리를 폐기한다. 재진입 때 AU-01 확인 후 FC-01로 상태를 조회한다. 이전에 RUNNING이면 서버 시간으로 남은 시간을 복원하고 PAUSED면 그 상태를 보여준다.
- 자정은 집중 상태·진행 시간·완료 보상에 영향을 주지 않는다. 습관의 한국 날짜 경계와 구분한다.
- 창이 닫힌 동안 목표에 도달한 경우에도 접속 중 주기 작업 없이 복귀 후 완료 요청으로 지급한다. 오프라인 화면이 서버 없이 임의로 지급하지 않는다.

## 9. 실패 목록

| HTTP | code | 조건 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | UUID·타입·그래핌 범위·공백만 있는 필수값·지원하지 않는 필드·활성 습관18개 초과·비밀번호 허용 문자/길이 오류 |
| 400 | PASSWORD_CONFIRM_MISMATCH | 생성 비밀번호 확인 불일치 |
| 400 | INVALID_BACKGROUND | 담당자가 공유한 8종 임시 배경 목록 밖 키; 최종 키 확정 전에도 임시 목록으로 검증 |
| 400 | INVALID_EMOJI | 허용 이모지/표현 규칙 위반; 세부 미정 |
| 401 | PASSWORD_MISMATCH | 페이지 진입·보호 요청·삭제의 비밀번호 오류 |
| 401 | VERIFICATION_REQUIRED | 보호 요청 비밀번호 헤더 또는 진입 검증·삭제 본문의 비밀번호 누락 |
| 404 | STUDY_NOT_FOUND / ROUTINE_NOT_FOUND / CHALLENGE_NOT_FOUND | 대상 없음 또는 하위 데이터 소속 불일치 |
| 409 | CHALLENGE_CONFLICT | 스터디에 RUNNING/PAUSED 존재 |
| 409 | INVALID_CHALLENGE_STATE | 진행 중 reset·종료 상태의 다른 조작 등 |
| 409 | CHALLENGE_NOT_FINISHED / CHALLENGE_FINISHED | 완료 전 complete / 완료해야 하는 상태의 pause·resume |
| 409 | ROUTINE_ENDED | 종료된 습관 체크·이름 변경 |
| 409 | DATE_CHANGED | 체크 요청 날짜가 서버 한국 오늘과 다름 |
| 409 | REACTION_POLICY_CONFLICT | 같은 studyId/browserId/emoji 중복 |
| 500 | INTERNAL_ERROR | DB·내부 장애; 민감값 미노출 |

스터디 중복 생성의 별도 오류 정책은 미정이다. 습관 활성18개 초과는 기존 VALIDATION_ERROR(400)를 사용한다. 활성 행이 있는 상태의 새 시작은 브라우저와 무관하게 CHALLENGE_CONFLICT다. 비밀번호를 아는 다른 브라우저의 기존 집중 조작은 허용한다. 페이지의 verified 상태만으로 서버 검증을 생략하지 않는다.

## 10. 남은 결정

| ID | 미정 항목 | 영향 |
| --- | --- | --- |
| API-Q-04 | 초기·최근 표시 개수·기본 정렬·생성 당일0/1일·다건 수 상한 | 목록/카드 |
| API-Q-05 | 기본 주·과거/미래 조회 허용 범위·기록표 행 순서/색상표 | 주간 조회·시안 |
| API-Q-06 · 확정 | trim·그래핌 계산·TEXT 저장·활성 습관18개·오늘 목록 생성일 오름차순, 비밀번호 공백 금지(ADR-056~057) | 입력/DB 제약. 그래핌 수와 별개인 바이트 상한은 이번 결정에 포함하지 않음 |
| API-Q-07 | 응원 허용 이모지·유니코드 동일성·강사 확인 결과 | 응원 |
| API-Q-08 | 기본green 외 7종 임시 키·자산은 담당자가 지정·공유 후 구현, 최종 목록은 추후 변경. 중복 생성 규칙은 미정 | 생성/수정 |
| API-Q-09 · 제외 | 연결 확인·연결 만료·담당 탭 인계·자동 일시정지 제외(ADR-052) | 미정 아님 |
| API-Q-12 | 안내 문구 최종 확정·완료 화면·반응형 시안, SCSS 도입 여부. 오류 문구는 확정 전 임시 구현 허용(ADR-058) | 프론트·공통 오류 |
| API-Q-13 · 후속 | 드래그앤드롭 순서 저장·변경 API·주간 표 적용 범위 | ISS-031. 현재 생성일 정렬 계약은 유지 |

요청별 비밀번호 헤더·Challenge 축소·완료 전용 지급·RESET 뒤 새 행·종료일 포함·주간 겹침·총점 저장·다건 조회·검색 3필드·동률 정렬은 확정/기술 계약으로 구분해 위 절에 반영했다. 삭제 비밀번호 재확인·수정 도착 페이지 모달은 최근 구체 결정 기준으로 유지하며 킥오프의 예전 흐름은 ADR-046에 비교 기록한다.

## 11. 기능 ID 대응

| 기능 ID | 연결 API 또는 프론트 처리 |
| --- | --- |
| F-ST-001 | API-ST-01 |
| F-ST-002 | API-ST-01 + 프론트 목록 누적 |
| F-ST-003 | API-ST-01; 스터디 이름·닉네임·소개 검색 |
| F-ST-004 | API-ST-01 |
| F-ST-005 | LocalStorage 최근 ID 기록 + API-ST-08로 실제 데이터 일괄 조회. 별도 저장 API 없음 |
| F-ST-006 | API-ST-02 |
| F-ST-007 | API-ST-03, API-ST-06 |
| F-ST-008 | API-AU-01, API-ST-04 |
| F-ST-009 | 삭제 모달 비밀번호를 API-ST-05 본문에 전달 |
| F-ST-010 | API-ST-06 |
| F-ST-011 | API-ST-03 |
| F-ST-012 | API-ST-07 |
| F-ST-013 | 프론트 현재 상세 링크 복사. 별도 API 없음 |
| F-ST-014 | API-ST-01·03의 createdAt 사용; 생성 당일 일수 확인 대기 |
| F-HB-001 | API-HB-01 |
| F-HB-002 | 프론트 시간 표시, API-HB-01의 서버 날짜로 기준 확인 |
| F-HB-003 | React Router 화면 이동. 별도 API 없음 |
| F-HB-004 | API-HB-02 |
| F-HB-005 | API-HB-05 |
| F-HB-006 | 날짜별 조회·기록 처리; 체크 전체 초기화 API 없음 |
| F-HB-007 | API-HB-03 |
| F-HB-008 | API-HB-04 |
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
| F-AU-001 | API-AU-01 페이지 진입 확인·보호 API마다 비밀번호 헤더 검증 |
| F-AU-002 | 이번 범위 제외. 재진입·새로고침마다 비밀번호 확인 |

## 12. 습관 동시 요청

Study→Routine 순서의 잠금 안에서 종료 여부·한국 오늘 날짜·유효 기간을 검사하고 변경한다. 종료와 체크의 경합에서 먼저 잠금을 획득한 요청의 결과를 확정한다. 종료 뒤 도착한 체크·이름 변경은 409 ROUTINE_ENDED, 종료 전 완료한 체크는 기록표에 보존한다. 재삭제는 최초 endsOn을 바꾸지 않는다.

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

