# 공부의 숲 API Docs

- 버전: 0.8 축소 설계 초안 · 2026-10-12 (Asia/Seoul)
- 기준: [README.md](../README.md), [DB.md](DB.md), [ADR.md](ADR.md) ADR-051~053; 습관·응원·조회는 ADR-045~046.
- 요청 예시: [api.http](../api/api.http). 이번에는 문서·스키마만 변경하며 서버 구현·요청 실행·DB 적용을 하지 않는다.
- 사용자 확정 정책과 기술 계약을 구분한다. 아래 경로·필드·코드은 구현을 위한 기술 설계이며 남은 제품 결정은 10절에 둔다.
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

## 2. API 계약 표

모든 경로는 /api 뒤에 붙는다. /studies/batch는 동적 /studies/{studyId}보다 먼저 라우팅한다.

| API ID | Method | Path | 기능 | 접근 | 성공 |
| --- | --- | --- | --- | --- | --- |
| API-ST-01 | GET | /studies | 목록·검색·정렬·offset | 공개 | 200 |
| API-ST-02 | POST | /studies | 스터디 생성 | 공개 | 201 |
| API-ST-03 | GET | /studies/{studyId} | 상세·상위 응원 | 공개 | 200 |
| API-ST-04 | PATCH | /studies/{studyId} | 정보 수정 | 비밀번호 헤더 | 200 |
| API-ST-05 | DELETE | /studies/{studyId} | 스터디·연결 데이터 삭제 | 삭제 모달 비밀번호 | 204 |
| API-ST-06 | GET | /studies/{studyId}/habit-records | 주간 기록표 | 공개 | 200 |
| API-ST-07 | POST | /studies/{studyId}/reactions | 응원 추가 | 공개 | 200 |
| API-ST-08 | GET | /studies/batch | 최근 조회용 ID 다건 조회 | 공개 | 200 |
| API-AU-01 | POST | /studies/{studyId}/password-verifications | 페이지 진입 비밀번호 검증 | 비밀번호 본문 | 200 |
| API-HB-01 | GET | /studies/{studyId}/habits | 오늘 목록 | 비밀번호 헤더 | 200 |
| API-HB-02 | POST | /studies/{studyId}/habits | 습관 생성 | 비밀번호 헤더 | 201 |
| API-HB-03 | PATCH | /studies/{studyId}/habits/{habitId} | 이름 수정 | 비밀번호 헤더 | 200 |
| API-HB-04 | DELETE | /studies/{studyId}/habits/{habitId} | 종료 | 비밀번호 헤더 | 204 |
| API-HB-05 | PUT | /studies/{studyId}/habits/{habitId}/check | 오늘 체크·해제 | 비밀번호 헤더 | 200 |
| API-FC-01 | GET | /studies/{studyId}/focus | 현재 집중·마지막 목표 복원 | 비밀번호 헤더 | 200 |
| API-FC-02 | POST | /studies/{studyId}/focus-sessions | 매번 새 행으로 시작 | 비밀번호 헤더 | 201 |
| API-FC-03 | POST | /studies/{studyId}/focus-sessions/{focusId}/pause | 사용자 일시정지 | 비밀번호 헤더 | 200 |
| API-FC-04 | POST | /studies/{studyId}/focus-sessions/{focusId}/resume | 정지된 집중 재개 | 비밀번호 헤더 | 200 |
| API-FC-05 | POST | /studies/{studyId}/focus-sessions/{focusId}/reset | 무지급·RESET 종료 | 비밀번호 헤더 | 200 |
| API-FC-06 | POST | /studies/{studyId}/focus-sessions/{focusId}/complete | 목표 완료·지급 | 비밀번호 헤더 | 200 |

## 3. 데이터 모양

| DTO | 필드 |
| --- | --- |
| Study | id, nickname, name, introduction, background(API; DB backgroundKey), points(Study.points), createdAt, updatedAt |
| ReactionSummary | emoji, count |
| Habit | id, studyId, name, startsOn, endsOn(null 허용), completed(오늘 목록에서만) |
| Focus | id, studyId, status(RUNNING/PAUSED/COMPLETED/RESET), configuredMinutes(DB goalMinutes), elapsedSeconds, remainingSeconds, serverTime, endsAt(RUNNING 파생값 또는 null), awardedPoints(Challenge.awardedPoints; 해당 집중의 완료 지급량) |
| Settlement | focusId, elapsedPoints, goalPoints, awardedPoints(이번 신규 지급 합계) |

Focus에는 비밀번호·해시·토큰·키를 넣지 않는다. elapsedSeconds는 실제 경과 밀리초를 버림, remainingSeconds는 남은 밀리초를 올림한다. 모든 파생값은 한 서버 시각을 기준으로 계산한다. endsAt은 RUNNING에서 서버 현재 시각 + 남은 밀리초이며 PAUSED/terminal은 null이다.

DB와 API 이름은 다음처럼 매핑한다. 기존 API의 habits/focus 경로를 DB 명칭에 맞춰 임의로 변경하지 않는다.

| API | DB 또는 처리 |
| --- | --- |
| Habit·habits·habitId | Routine·Routine.id |
| 날짜별 date / completed | RoutineHistory.recordDate / completed |
| Focus·focusId | Challenge·Challenge.id |
| 시작 입력 durationMinutes / 응답 configuredMinutes | Challenge.goalMinutes |
| Focus.awardedPoints | Challenge.awardedPoints |
| points | Study.points |

비밀번호 확인 응답:
```json
{"data":{"verified":true}}
```
이 응답을 저장해서 다음 보호 요청을 우회하지 않는다.

집중 조회: {data:{focus,points,serverTime,configuredMinutes}}. 활성 행을 우선 반환한다. 활성 행이 없으면 focus=null이며 가장 최근 RESET/COMPLETED의 goalMinutes를 configuredMinutes로 반환하고 이력도 없으면 10이다. 최신 순은 createdAt DESC, id DESC다. points는 현재 Study.points다.

집중 변경: {data:{focus,points,settlement}}. 시작·정지·재개·초기화에는 settlement=null. 완료만 Settlement를 반환하며 elapsedPoints=floor(goalMinutes/10), goalPoints=3, awardedPoints=이번 신규 지급 합계다. Focus.awardedPoints는 그 행에 저장한 전체 지급량이므로 완료 재요청의 Settlement.awardedPoints=0과 다를 수 있다.

위 분해 값은 최초 완료 지급 기준이다. 동일 완료 재요청은 settlement의 elapsedPoints·goalPoints·awardedPoints 모두 0이다.

10분 목표 최초 완료 예시(이전에 지급된 스터디 총점이 0인 경우):

```json
{
  "data": {
    "focus": {
      "id": "22222222-2222-4222-8222-222222222222",
      "studyId": "11111111-1111-4111-8111-111111111111",
      "status": "COMPLETED",
      "configuredMinutes": 10,
      "elapsedSeconds": 600,
      "remainingSeconds": 0,
      "serverTime": "2026-10-12T01:10:00.000Z",
      "endsAt": null,
      "awardedPoints": 4
    },
    "points": 4,
    "settlement": {
      "focusId": "22222222-2222-4222-8222-222222222222",
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

생성 body: {nickname,name,introduction,background?,password,passwordConfirm}. 수정 body: {nickname?,name?,introduction?,background?}; 최소 한 필드 필요, password 변경 필드 거절. 닉네임1~10, 이름1~15, 소개1~100글자. 비밀번호4~20, `/^[A-Za-z0-9!@#$%^&*]+$/`, 확인값 일치. 비밀번호를 trim하지 않는다.

배경은 원색4·이미지4 중 선택, 생략하면 첫 초록색(green). 나머지 키·자산은 사용자가 전달할 때 확정한다. 미정 키를 임의로 만들지 않으며 전8종 검증 구현은 자산 목록 수신 후 완료한다. DB에 해시만 저장하고 응답에서 원문·해시를 제외한다. 생성/수정 성공은 {data:Study}, 프론트가 해당 상세로 이동한다. 생성 성공이 인증 발급을 의미하지 않는다.

### API-ST-03 상세 / API-ST-05 삭제

상세: {data:{...Study,reactions:[ReactionSummary]}}. 주간 표는 ST-06 별도 조회.
삭제: DELETE body {password}. bcrypt 검증 후 Study와 연결 데이터를 Cascade 삭제, 204. 헤더가 아닌 삭제 모달 본문의 비밀번호를 검증한다. 성공 후 / 이동 및 에러토스트 형식의 삭제 성공 안내. 해당 스터디의 페이지 메모리·최근 조회 ID도 정리한다.

### API-ST-06 기록표

query: weekStart=YYYY-MM-DD를 명시하고 연속7일을 조회하는 계약이다. 기본 주·조회 허용 범위는 미정. 과거 주 이동 UI는 선택 개선이다.

조회 주 첫날 W, 마지막날 E에 대해 Routine.startsOn <= E AND (endsOn IS NULL OR endsOn >= W)인 습관만 조회한다. 날짜 칸은 startsOn <= 날짜 AND (endsOn IS NULL OR 날짜 <= endsOn)이면 exists=true, 아니면 exists=false다. 존재하지 않는 칸은 회색 아이콘이다.

응답: {data:{weekStart,dates:[날짜7개],habits:[{id,name,startsOn,endsOn,cells:[{date,exists,completed}]}]}}. 유효한 칸에 이력 행이 없으면 completed=false, exists=false면 completed=null. 종료 당일 체크는 유지하고 생성일 이전은 존재하지 않는다. 이름은 최신 Routine.name을 사용한다. 행 색상은 정해진 순서를 적용하며 실제 색상표·행 순서는 추가 확인한다.

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

HB-01: {data:{date,serverTime,habits:[Habit]}}. endsOn IS NULL AND startsOn <= 오늘인 습관만 조회한다. 이름 수정은 과거 표에도 반영된다.
HB-02 body {name}, 201 {data:Habit}. HB-03 body {name}, 200 {data:Habit}. 이름 필수·최대20글자, 공백·글자 계산 규칙은 미정. 목록 수정에서 생성·수정을 함께 보여도 HTTP 작업은 개별 처리한다. 빈 입력 영역 추가는 가능하지만 빈 값을 저장하지 않는다.
HB-04 DELETE body 없음. 처음 종료 시 endsOn=서버 오늘 한국 날짜,204. 이미 종료된 행의 재삭제는 날짜를 덮어쓰지 않고204. 물리 삭제하지 않는다.
HB-05 PUT body {date,completed:boolean}. 서버 오늘 한국 날짜와 일치하며 endsOn이 없는 습관만 체크·해제 가능. (routineId,date) upsert, 해제도 completed=false 행 유지. 200 {data:{habitId,date,completed}}. 날짜 불일치409 DATE_CHANGED는 오래된 화면의 과거 날짜 기록을 막는 기술 계약이며 프론트는 오늘 목록을 재조회한다. 날짜 변경은 이력 전체 삭제가 아니다.

습관 최대18개는 킥오프 요구다. 활성 개수인지 전체 보존 개수인지는 미정이므로 숫자만으로 잘못된 총이력 제한을 추가하지 않는다. 확정 후 스터디 잠금 안에서 생성 개수를 검사해야 한다.

## 7. 집중 상태·완료 지급·중복 요청

| 동작 | 허용 상태 | 처리 |
| --- | --- | --- |
| 새 Start(FC-02) | RUNNING/PAUSED 없음 | 매번 새 RUNNING 행·경과 0, 201 |
| pause(FC-03) | 목표 도달 전 RUNNING | PAUSED·서버 경과 저장·lastStartedAt=null·지급 없음 |
| resume(FC-04) | 목표 미달 PAUSED | 동일 행 RUNNING·기존 경과 유지·lastStartedAt=서버 현재 시각 |
| reset(FC-05) | PAUSED | RESET 종료·이력 보존·지급 없음 |
| complete(FC-06) | 서버가 계산한 경과가 목표에 도달한 RUNNING/PAUSED | COMPLETED·목표 경과 확정·완료 포인트 지급 |

- FC-02 body {durationMinutes}, 10~180 정수(기본 10). DB의 goalMinutes로 저장한다. focusId·attemptNumber를 시작 입력으로 받지 않는다.
- 모든 집중 API는 비밀번호 헤더를 검증한다. FC-03~06은 본문이 없으며 stateVersion·reason·키를 보내지 않는다. 경로 focusId가 조작할 행을 지정한다.
- RUNNING/PAUSED가 있으면 새 시작은 409 FOCUS_CONFLICT다. PAUSED A가 있으면 재개하거나 초기화해야 한다. Study 잠금과 활성 부분 UNIQUE로 스터디당 합계 1개를 보장한다.
- 실제 경과: RUNNING은 min(goalMinutes×60000, elapsedMilliseconds + max(0, 서버 현재 시각-lastStartedAt)), 그 외는 저장된 elapsedMilliseconds다. 조회는 DB 경과를 반복 가산하지 않는다.
- pause는 실제 경과를 저장하고 lastStartedAt=null로 한다. resume는 저장 경과를 유지하고 lastStartedAt을 현재 서버 시각으로 설정한다. 정지 시간·목표 초과분은 포함하지 않는다.
- reset은 PAUSED에서만 가능하다. 행을 삭제하지 않고 RESET으로 남기며 awardedPoints=0을 유지한다. 프론트만 기존 목표·경과 0의 시작 전 상태로 돌아간다. 다음 Start는 새 행이다.
- **완료 시에만** floor(goalMinutes/10)+3P를 지급한다. 10/20/25/180분은 4/5/5/21P. 상한 없음. 정지·재개·초기화·조회에는 지급하지 않는다.
- Study→Challenge 잠금 → 비밀번호/소속/현재 상태/서버 경과 확인 → RUNNING/PAUSED를 COMPLETED로 조건부 전환 → awardedPoints 저장·Study.points 원자 증가를 같은 트랜잭션으로 처리한다. 전이에 실제 성공한 요청만 증가하며 실패 시 전부 롤백한다.
- 이미 PAUSED인 pause 재요청은 200·경과 변화 없음. 이미 RUNNING인 resume는 409 INVALID_FOCUS_STATE이며 시작 시각을 덮어쓰지 않는다.
- 같은 RESET의 reset 재요청은 200·settlement=null. 같은 COMPLETED의 complete 재요청은 200·신규 지급 0P이며 저장된 Focus.awardedPoints와 Study.points는 그대로다.
- RESET에 complete, COMPLETED에 reset, 종료 상태의 pause/resume는 409 INVALID_FOCUS_STATE다. 목표 전 complete는 409 FOCUS_NOT_FINISHED. 목표에 도달한 RUNNING의 pause 또는 PAUSED의 resume는 409 FOCUS_FINISHED로 완료를 안내한다.
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
| 400 | VALIDATION_ERROR | UUID·타입·범위·필수·지원하지 않는 필드 오류 |
| 400 | PASSWORD_CONFIRM_MISMATCH | 생성 비밀번호 확인 불일치 |
| 400 | INVALID_BACKGROUND | 최종 배경 목록 외 키; 목록 수신 전 완료 처리 불가 |
| 400 | INVALID_EMOJI | 허용 이모지/표현 규칙 위반; 세부 미정 |
| 401 | PASSWORD_MISMATCH | 페이지 진입·보호 요청·삭제의 비밀번호 오류 |
| 401 | VERIFICATION_REQUIRED | 보호 요청 비밀번호 헤더 또는 진입 검증·삭제 본문의 비밀번호 누락 |
| 404 | STUDY_NOT_FOUND / HABIT_NOT_FOUND / FOCUS_NOT_FOUND | 대상 없음 또는 하위 데이터 소속 불일치 |
| 409 | FOCUS_CONFLICT | 스터디에 RUNNING/PAUSED 존재 |
| 409 | INVALID_FOCUS_STATE | 진행 중 reset·종료 상태의 다른 조작 등 |
| 409 | FOCUS_NOT_FINISHED / FOCUS_FINISHED | 완료 전 complete / 완료해야 하는 상태의 pause·resume |
| 409 | HABIT_ENDED | 종료된 습관 체크·이름 변경 |
| 409 | DATE_CHANGED | 체크 요청 날짜가 서버 한국 오늘과 다름 |
| 409 | REACTION_POLICY_CONFLICT | 같은 studyId/browserId/emoji 중복 |
| 500 | INTERNAL_ERROR | DB·내부 장애; 민감값 미노출 |

스터디 중복 생성·습관18개 범위에 대한 오류 코드는 정책 확정 후 추가한다. 활성 행이 있는 상태의 새 시작은 브라우저와 무관하게 FOCUS_CONFLICT다. 비밀번호를 아는 다른 브라우저의 기존 집중 조작은 허용한다. 페이지의 verified 상태만으로 서버 검증을 생략하지 않는다.

## 10. 남은 결정

| ID | 미정 항목 | 영향 |
| --- | --- | --- |
| API-Q-04 | 초기·최근 표시 개수·기본 정렬·생성 당일0/1일·다건 수 상한 | 목록/카드 |
| API-Q-05 | 기본 주·과거/미래 조회 허용 범위·기록표 행 순서/색상표 | 주간 조회·시안 |
| API-Q-06 | 공백 처리·이모지를 포함한 글자 수 계산, 습관18개 적용 범위 | 입력/DB 제약 |
| API-Q-07 | 응원 허용 이모지·유니코드 동일성·강사 확인 결과 | 응원 |
| API-Q-08 | 기본green 외 배경7종의 키·이미지 자산, 중복 생성 규칙 | 생성/수정 |
| API-Q-09 · 제외 | 연결 확인·연결 만료·담당 탭 인계·자동 일시정지 제외(ADR-052) | 미정 아님 |
| API-Q-12 | 구체 오류·완료 화면·반응형 시안, SCSS 도입 여부 | 프론트 |

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

Study→Routine 순서의 잠금 안에서 종료 여부·한국 오늘 날짜·유효 기간을 검사하고 변경한다. 종료와 체크의 경합에서 먼저 잠금을 획득한 요청의 결과를 확정한다. 종료 뒤 도착한 체크·이름 변경은 409 HABIT_ENDED, 종료 전 완료한 체크는 기록표에 보존한다. 재삭제는 최초 endsOn을 바꾸지 않는다.

집중의 stateVersion·여러 브라우저 요청 순서 보장은 제외했지만 위 습관 기록 무결성과 완료 중복 지급 방지를 함께 제거하지 않는다.

## 13. 실패 메시지의 상태

실패 응답의 code·HTTP·조건은 9절을 따른다. message는 사용자 표시 문구이며 정확한 문구는 아직 미정이다. details는 필드 오류 등 보충 정보이며 민감값을 포함하지 않는다. 구현자가 임의 문구를 확정 명세로 기록하지 않고 해당 기능 구현 계획에서 확인한다.

실패 모양 예시(message 문자열은 확정 문구가 아닌 자리표시자):
```json
{"error":{"code":"PASSWORD_MISMATCH","message":"<확정할 사용자 안내 문구>","details":null}}
```

