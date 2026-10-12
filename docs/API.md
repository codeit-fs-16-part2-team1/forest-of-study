# 공부의 숲 API Docs

- 버전: 0.7 통합 검토 초안 · 2026-10-10 (Asia/Seoul)
- 기준: [README.md](README.md), [DB.md](DB.md), [ADR.md](ADR.md) ADR-043~048.
- 요청 예시: [api.http](api.http). 이번에는 문서·스키마만 변경하며 서버 구현·요청 실행·DB 적용을 하지 않는다.
- 사용자 확정 정책과 기술 계약을 구분한다. 아래 경로·필드·코드·서명 포맷은 구현을 위한 기술 설계이며 남은 제품 결정은 10절에 둔다.
- 이전 X-Study-Password·verified 응답·READY 재사용·attemptNumber·reason=leave 계약은 이 버전에서 폐기한다. brief.md 원문은 보존하며 최신 사용자 변경을 적용한다.

## 1. 공통 계약과 인증

Base URL은 서버 주소 + /api. JSON 요청·응답, UUID ID, ISO 8601 UTC 일시, YYYY-MM-DD 한국 날짜를 사용한다. 성공은 {data:...}, 목록은 {data:[],pagination:{offset,limit,total,hasMore}}, 실패는 {error:{code,message,details}}. 204는 본문이 없다. 실패 시 현재 페이지를 유지하며 요청 중간 취소 기능은 없다.

### 일반 인증 토큰

- AU-01에서 비밀번호를 비동기 bcrypt로 검증한 뒤 토큰을 발급한다. 일반 보호 요청은 `Authorization: Bearer <accessToken>`.
- 토큰은 스터디별 LocalStorage에 {accessToken,expiresAt}로 보관한다. 같은 스터디의 습관·수정·새 집중 시작에서 공유하며 새로고침·재접속 시 서버 검증 결과가 유효하면 유지한다. 원문 비밀번호는 검증 뒤 폐기하고 저장소·로그·URL·응답에 넣지 않는다.
- 만료는 발급 후24시간이 아니라 **다음 한국 시각 자정**이다. 서버가 expiresAt을 계산하고 요청마다 서명·스터디 소속·만료·Study 존재를 검사한다. 정확히 expiresAt부터 만료다. 브라우저 청소가 늦어도 권한은 연장되지 않는다.
- 기술 설계: Node 내장 crypto의 HMAC-SHA256 서명, payload {version:1,studyId,issuedAt,expiresAt,nonce}를 사용한다. 정해진 인코딩·고정 알고리즘만 검증하고 서명은 길이 확인 후 timingSafeEqual로 비교한다. 서버 비밀은 환경변수로 관리하고 클라이언트에 노출하지 않는다. 비밀번호·타이머 키를 payload에 넣지 않는다. JWT 라이브러리를 임의 추가하지 않는다. VerificationToken 테이블은 없다. [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)
- 만료 응답에서 해당 스터디 토큰을 제거하고 비밀번호 모달을 연다. 내부 이동 자체는 재입력을 요구하지 않는다. 다른 studyId에서는 해당 스터디 인증이 필요하다.
- 삭제는 파괴적 동작이므로 기존 삭제 모달의 비밀번호 재확인을 유지한다. AU-02 조작권 복구도 비밀번호를 새로 입력받아 검증한다.

### 타이머 전용 키

- FC-02 시작 성공 때 32바이트 난수 키를 발급하고 Challenge에는 SHA-256 해시만 저장한다. 응답의 timerKey를 {studyId,focusId,timerKey}로 LocalStorage에 보관한다.
- `X-Timer-Key: <timerKey>`로 **해당 활성 집중**의 조회·연결 확인·정지·재개·초기화·완료만 허용한다. 일반 토큰을 함께 요구하지 않으므로 한국 자정을 넘겨도 계속 동작한다. 습관·수정·삭제·새 집중 시작은 이 키로 허용하지 않는다.
- 요청의 studyId/focusId 소속과 DB timerKeyHash를 비교한다. 일반 토큰만 가진 다른 브라우저도 기존 타이머 조작은 불가하다. 키 누락·불일치는 경고하고 차단하며 상태·마지막 확인 시각·포인트를 바꾸지 않는다.
- 같은 origin의 LocalStorage는 같은 브라우저 프로필의 탭들이 공유한다. 탭별 제한으로 설명하지 않으며 키를 복사한 사람까지 물리적으로 구별하는 방식은 아니다. 응원 browserId는 조작권 증명이 아니다. [MDN LocalStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- 타이머 API에서 Authorization과 X-Timer-Key를 함께 보냈다면 타이머 키 검증을 우선한다. 만료된 일반 토큰이 유효 타이머의 자정 이후 조작을 막지 않도록 한다. 키가 틀리면 일반 토큰으로 활성 조작을 우회하지 않는다.
- 정지·재개·자정에는 키 유지. RESET/COMPLETED에서는 timerKeyHash=null로 폐기하고 클라이언트에서도 삭제한다. 일반 토큰은 해당 스터디에서 유효기간까지 유지한다.
- 분실·시작 응답 유실은 AU-02에서 비밀번호 재검증 후 명시적으로 복구한다. 새 키로 DB 해시를 교체해 이전 키를 무효화한다. 복구는 자동 실행하지 않는다. 복구 후 기존 상태를 유지하며 자동 재개·지급하지 않는다.
- HTTPS, Authorization·X-Timer-Key CORS 허용, 민감 요청/응답 Cache-Control: no-store 및 헤더·키 로그 제외가 필요하다. 새 라이브러리는 추가하지 않는다.

## 2. API 계약 표

모든 경로는 /api 뒤에 붙는다. /studies/batch는 동적 /studies/{studyId}보다 먼저 라우팅한다.

| API ID | Method | Path | 기능 | 접근 | 성공 |
| --- | --- | --- | --- | --- | --- |
| API-ST-01 | GET | /studies | 목록·검색·정렬·offset | 공개 | 200 |
| API-ST-02 | POST | /studies | 스터디 생성 | 공개 | 201 |
| API-ST-03 | GET | /studies/{studyId} | 상세·상위 응원 | 공개 | 200 |
| API-ST-04 | PATCH | /studies/{studyId} | 정보 수정 | 일반 토큰 | 200 |
| API-ST-05 | DELETE | /studies/{studyId} | 스터디·연결 데이터 삭제 | 삭제 모달 비밀번호 | 204 |
| API-ST-06 | GET | /studies/{studyId}/habit-records | 주간 기록표 | 공개 | 200 |
| API-ST-07 | POST | /studies/{studyId}/reactions | 응원 추가 | 공개 | 200 |
| API-ST-08 | GET | /studies/batch | 최근 조회용 ID 다건 조회 | 공개 | 200 |
| API-AU-01 | POST | /studies/{studyId}/password-verifications | 비밀번호 검증·일반 토큰 발급 | 비밀번호 본문 | 200 |
| API-AU-02 | POST | /studies/{studyId}/focus-sessions/{focusId}/ownership | 명시적 타이머 조작권 복구 | 비밀번호 재검증 | 200 |
| API-HB-01 | GET | /studies/{studyId}/habits | 오늘 목록 | 일반 토큰 | 200 |
| API-HB-02 | POST | /studies/{studyId}/habits | 습관 생성 | 일반 토큰 | 201 |
| API-HB-03 | PATCH | /studies/{studyId}/habits/{habitId} | 이름 수정 | 일반 토큰 | 200 |
| API-HB-04 | DELETE | /studies/{studyId}/habits/{habitId} | 종료 | 일반 토큰 | 204 |
| API-HB-05 | PUT | /studies/{studyId}/habits/{habitId}/check | 오늘 체크·해제 | 일반 토큰 | 200 |
| API-FC-01 | GET | /studies/{studyId}/focus | 현재 집중·마지막 목표 복원 | 일반 토큰 또는 타이머 키 | 200 |
| API-FC-02 | POST | /studies/{studyId}/focus-sessions | 매번 새 행으로 시작·키 발급 | 일반 토큰 | 201 |
| API-FC-03 | POST | /studies/{studyId}/focus-sessions/{focusId}/pause | 수동·외부 이탈 정지 | 타이머 키 | 200 |
| API-FC-04 | POST | /studies/{studyId}/focus-sessions/{focusId}/resume | 정지된 집중 재개 | 타이머 키 | 200 |
| API-FC-05 | POST | /studies/{studyId}/focus-sessions/{focusId}/reset | 경과 정산·RESET 종료 | 타이머 키 | 200 |
| API-FC-06 | POST | /studies/{studyId}/focus-sessions/{focusId}/complete | 목표 완료·정산 | 타이머 키 | 200 |
| API-FC-07 | POST | /studies/{studyId}/focus-sessions/{focusId}/heartbeat | 15초 연결 확인 | 타이머 키 | 200 |

## 3. 데이터 모양

| DTO | 필드 |
| --- | --- |
| Study | id, nickname, name, introduction, background(API; DB backgroundKey), points(Study.points), createdAt, updatedAt |
| ReactionSummary | emoji, count |
| Habit | id, studyId, name, startsOn, endsOn(null 허용), completed(오늘 목록에서만) |
| Focus | id, studyId, status(RUNNING/PAUSED/COMPLETED/RESET), configuredMinutes(DB goalMinutes), stateVersion, elapsedSeconds, remainingSeconds, serverTime, endsAt(RUNNING 파생값 또는 null), awardedPoints(해당 행 원장 합계) |
| Settlement | focusId, elapsedPoints, goalPoints, awardedPoints(이번 신규 지급 합계) |

Focus에는 비밀 키·해시를 넣지 않는다. 시작/복구 응답에만 timerKey를 별도 반환한다. elapsedSeconds는 밀리초를 버림, remainingSeconds는 남은 밀리초를 올림한다. 모든 값은 한 서버 시각을 기준으로 계산한다. 종료 이력의 과거 누적점수를 Study.points로 덮어쓰지 않는다.

일반 응답 예시:
```json
{"data":{"studyId":"11111111-1111-4111-8111-111111111111","accessToken":"<서버 발급 토큰>","expiresAt":"2026-10-10T15:00:00.000Z"}}
```
이 만료 시각은 한국2026-10-11 00:00이다. 서명 포맷의 실제 값을 예시 문자열로 검증하지 않는다.

집중 조회: {data:{focus,points,serverTime,configuredMinutes}}. 활성 행을 우선 반환한다. 활성 행이 없으면 focus=null이며 가장 최근 RESET/COMPLETED의 goalMinutes를 configuredMinutes로 반환하고 이력도 없으면10이다. 최신 순은 createdAt DESC, id DESC 기술 기준이다. 타이머 키만으로 조회할 때는 자신이 가리키는 활성 행만 반환하고 과거 행/다른 집중을 조회하지 않는다.

집중 변경: {data:{focus,points,settlement}}. 시작 응답에는 timerKey 추가. 시작·정지·재개·연결 확인·복구에는 settlement=null. 초기화/완료만 Settlement를 반환한다. RESET 응답은 종료한 행을 반환하고 프론트는 목표 시간·경과0인 시작 전 화면을 구성한다. DB에 READY 행은 없다.

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
삭제: DELETE body {password}. bcrypt 검증 후 Study와 연결 데이터를 Cascade 삭제, 204. 일반 토큰이나 타이머 키만으로 삭제하지 않는다. 성공 후 / 이동 및 에러토스트 형식의 삭제 성공 안내. 해당 스터디의 로컬 인증·타이머 키·최근 조회 ID도 제거한다.

### API-ST-06 기록표

query: weekStart=YYYY-MM-DD를 명시하고 연속7일을 조회하는 계약이다. 기본 주·조회 허용 범위는 미정. 과거 주 이동 UI는 선택 개선이다.

조회 주 첫날 W, 마지막날 E에 대해 Routine.startsOn <= E AND (endsOn IS NULL OR endsOn >= W)인 습관만 조회한다. 날짜 칸은 startsOn <= 날짜 AND (endsOn IS NULL OR 날짜 <= endsOn)이면 exists=true, 아니면 exists=false다. 존재하지 않는 칸은 회색 아이콘이다.

응답: {data:{weekStart,dates:[날짜7개],habits:[{id,name,startsOn,endsOn,cells:[{date,exists,completed}]}]}}. 유효한 칸에 이력 행이 없으면 completed=false, exists=false면 completed=null. 종료 당일 체크는 유지하고 생성일 이전은 존재하지 않는다. 이름은 최신 Routine.name을 사용한다. 행 색상은 정해진 순서를 적용하며 실제 색상표·행 순서는 추가 확인한다.

### API-ST-07 응원

body {browserId,emoji}. browserId는 UUID·LocalStorage의 동일 브라우저 프로필 식별이며 신원 증명이 아니다. PK(studyId,browserId,emoji)로 같은 이모지1회 제한. 서로 다른 이모지 종류 수는 제한하지 않는 기존 정책을 유지하되 킥오프의 강사 확인 항목은 추가 확인 대상으로 남긴다. 임의 식별자 변경을 영구 개인별 제한으로 막는다고 설명하지 않는다.

성공 {data:{reactions:[ReactionSummary]}}. 상위 정렬은 COUNT DESC → MIN(createdAt) ASC → emoji ASC(기술적으로 DB의 C collation 사용)이며 LIMIT3. 이모지 종류가3미만이면 있는 만큼 반환하는 기술 표시 기준이다. 허용 이모지·유니코드 동일성은 미정.

### API-ST-08 ID 다건 조회

query ids=UUID,UUID,…; 첫 등장 순서로 중복 제거하고 입력 순서로 반환한다. 없는/삭제된 ID는 제외하며 {data:[카드용 Study와 reactions]} 반환. 모두 없으면 data:[], UUID 오류는400. 최근 조회 ID의 삭제 항목을 로컬에서도 정리한다. keyword/sort/offset/limit와 혼합하지 않는 독립 API이며 다건 수 상한은 확인 대기다.

## 5. 비밀번호 확인·조작권 복구

### API-AU-01 일반 토큰 발급

body {password}. Study 확인·bcrypt 검증 후 {data:{studyId,accessToken,expiresAt}}. 틀리면401 PASSWORD_MISMATCH. 검증 성공 불리언만으로 이후 권한을 인정하지 않는다.

### API-AU-02 타이머 조작권 복구

body {password}. 대상 Study·Challenge 소속과 비밀번호를 새로 검증하고 Study→Challenge 순으로 잠금, 연결 만료 복구를 먼저 수행한다. RUNNING/PAUSED에서만 새 키로 교체하며 {data:{focus,points,settlement:null,timerKey}} 반환. 기존 키 즉시 무효, 상태·경과 보존, 자동 재개·지급 없음. terminal 행은409 INVALID_FOCUS_STATE. 복구 자체는 일반 토큰을 발급하지 않는다. 단순 다른 브라우저 접근에는 복구를 자동 호출하지 않고 경고 후 사용자의 명시적 선택으로 실행한다.

## 6. 습관 API

HB-01: {data:{date,serverTime,habits:[Habit]}}. endsOn IS NULL AND startsOn <= 오늘인 습관만 조회한다. 이름 수정은 과거 표에도 반영된다.
HB-02 body {name}, 201 {data:Habit}. HB-03 body {name}, 200 {data:Habit}. 이름 필수·최대20글자, 공백·글자 계산 규칙은 미정. 목록 수정에서 생성·수정을 함께 보여도 HTTP 작업은 개별 처리한다. 빈 입력 영역 추가는 가능하지만 빈 값을 저장하지 않는다.
HB-04 DELETE body 없음. 처음 종료 시 endsOn=서버 오늘 한국 날짜,204. 이미 종료된 행의 재삭제는 날짜를 덮어쓰지 않고204. 물리 삭제하지 않는다.
HB-05 PUT body {date,completed:boolean}. 서버 오늘 한국 날짜와 일치하며 endsOn이 없는 습관만 체크·해제 가능. (routineId,date) upsert, 해제도 completed=false 행 유지. 200 {data:{habitId,date,completed}}. 날짜 불일치409 DATE_CHANGED는 오래된 화면의 과거 날짜 기록을 막는 기술 계약이며 프론트는 오늘 목록을 재조회한다. 날짜 변경은 이력 전체 삭제가 아니다.

습관 최대18개는 킥오프 요구다. 활성 개수인지 전체 보존 개수인지는 미정이므로 숫자만으로 잘못된 총이력 제한을 추가하지 않는다. 확정 후 스터디 잠금 안에서 생성 개수를 검사해야 한다.

## 7. 집중 상태·정산·중복 요청

| 동작 | 허용 상태 | 처리 |
| --- | --- | --- |
| 새 Start(FC-02) | RUNNING/PAUSED 없음 | 매번 새 RUNNING 행·새 키,201 |
| pause(FC-03) | 목표 도달 전 RUNNING | PAUSED·서버 경과 확정·지급 없음 |
| resume(FC-04) | PAUSED | 동일 행 RUNNING·기존 경과 유지·지급 없음 |
| reset(FC-05) | PAUSED | 경과 보상 정산·RESET 종료·키 폐기 |
| complete(FC-06) | 유효 연결로 확정한 목표 도달 | COMPLETED 종료·경과 보상+3P·키 폐기 |
| heartbeat(FC-07) | 유효 키의 RUNNING | 마지막 확인 시각 갱신·지급 없음 |

- FC-02 body {durationMinutes},10~180 정수(기본10). 새 시작에서 focusId·attemptNumber를 받지 않는다. A가 정지 중이면 B 시작도409 FOCUS_CONFLICT. DB 부분 UNIQUE와 Study 잠금으로 동시 시작 중1개만 허용한다.
- FC-03 body {stateVersion,reason:"manual"}. FC-04~07 body {stateVersion}. 모든 조작은 경로 focusId로 행을 지정한다. 이전 행의 요청이 새 활성 행을 변경할 수 없다.
- reset 후 이전 goalMinutes를 화면 초기값으로 복원하고 다음 Start에서 새 행 생성. 최초 focus=null과 초기화 후 focus=null 모두 같은 시작 API를 사용한다. 재개는 새 행 생성과 다르다.
- 경과는 저장 밀리초 + 유효 RUNNING 구간의 서버 시간 차로 계산하고 목표 시간으로 제한한다. 일시정지 시간·목표 초과분은 포함하지 않는다.
- 초기화·완료 때만 floor(확정 경과 밀리초/600000)개의 ELAPSED(각1P), 완료만 GOAL1개(3P). 10/20/25/180분 완료는4/5/5/21P.13분 RESET1P 후 다른17분 RESET1P는2P이며 나머지는 이월하지 않는다.
- Study→Challenge 순서로 잠그고 원장 신규 삽입·Study.points 원자적 증가·상태 종료·키 폐기를 같은 트랜잭션으로 처리한다. 신규 원장 행에 해당하는 금액만 증가시키며 충돌 무시 후 무조건 증가시키지 않는다. 실패 시 전부 롤백한다.
- 같은 pause 재요청은 PAUSED200으로 중복 경과 증가 없음. 이미 RUNNING의 resume 재요청은409이며 시작 시각을 덮어쓰지 않는다. 목표 전에 complete는409 FOCUS_NOT_FINISHED, 유효 연결 상태에서 목표 후 pause는409 FOCUS_FINISHED로 complete 안내.
- 종료 후 타이머 키는 무효다. 초기화/완료 응답 유실로 동일 종료 동작을 재확인하려면 **유효 일반 토큰으로 해당 terminal 행의 동일 reset/complete 요청만** 허용한다. 이미 정산한 동일 동작은200·신규0P. RESET에 complete 또는 COMPLETED에 reset은409. 토큰도 만료됐다면 비밀번호 재확인 후 재요청한다. 이전 키만으로 재요청하면401이다.
- 조회는 원장을 만들지 않는다. 유효 연결에서0초가 됐는데 정산이 안 된 경우 클라이언트가 complete를 보낸다. 별도 백그라운드 지급 작업은 없다.

## 8. 15초 연결 확인·90초 만료·여러 탭 (ADR-047)

- Start/resume 성공 시 lastStartedAt과 lastHeartbeatAt을 서버 시각으로 설정한다. 같은 origin·브라우저 프로필의 스터디별 담당 탭 하나가 타이머 키로15초마다 heartbeat를 보낸다. 일반 토큰의 자정 만료와 무관하다.
- 서버 시각 - lastHeartbeatAt >= 90000밀리초이면 만료다. 정확히90초부터 만료이며90초를 집중 시간에 더하지 않는다. 만료된 RUNNING은 저장 경과 + max(0,lastHeartbeatAt-lastStartedAt)을 목표로 제한하여 PAUSED·lastStartedAt=null·stateVersion+1로 확정한다. 키·마지막 확인 시각은 보존하고 지급하지 않는다.
- 집중 조회·시작·조작·복구는 인증/소속 확인 후 Study→Challenge 잠금 안에서 만료를 먼저 검사한다. 요청이 없으면 물리적 상태 변경은 늦을 수 있지만 다음 요청의 처리 전에 복구한다. 별도 서버 주기 작업은 도입하지 않는다.
- 만료를 발견한 heartbeat는 갱신 없이 복구된 PAUSED를200으로 반환한다. 다른 오래된 버전의 조작은409 STALE_FOCUS_STATE로 최신 상태 재조회 후 사용자가 다시 실행한다. 늦은 heartbeat로 자동 재개·유효기간 소급 연장하지 않는다.
- 마지막 유효 확인까지 목표를 채웠다면 PAUSED에서도 명시적 complete로 정산 가능하다. 목표 미달이면 complete 거절, 이미 목표에 도달한 PAUSED의resume는409 FOCUS_FINISHED로 완료를 안내한다.
- 새로고침·탭 닫기·외부 주소 이동의 종료 이벤트에서는 pause를 보내지 않는다. 이전 reason=leave 계약을 폐기하고 수동 정지만 reason=manual을 사용한다. 종료 이벤트만으로 새로고침과 창 닫기를 구분하지 않는다.
- 새로고침 후 저장된 키로 조회하여90초 이내 RUNNING이면 연결 확인을 재개한다. 이미 만료되면 PAUSED이며 사용자 Start 전에는 자동 재개하지 않는다.
- 같은 프로필의 추가 탭은 상태 표시·사용자 조작이 가능하지만 정기heartbeat는 담당 탭만 보낸다. 보조 탭을 닫아도 영향 없다. 담당 탭 새로고침·종료·응답 중단은 다른 열린 탭이 담당 역할을 이어받는다. 키·최신 상태 버전·담당 변경을 탭끼리 공유한다.
- 담당 탭 선정·인계는 프론트 공통 관리에서 브라우저 내장 통신/저장 기능으로 구현한다. 스터디별 탭 식별과 짧은 담당 임대를 사용하되 탭을 DB 소유자로 저장하지 않는다. 인계는90초 만료보다 충분히 빨라야 하며 실제 검증값을 구현 문서에 기록한다. 동시 인계의 잠깐 중복 heartbeat는 허용하며 경과·포인트를 더하지 않는다.
- 서비스를 연 탭이 하나라도 연결을 유지하면 진행한다. 담당 탭이 외부 주소로 이동해도 다른 사이트 탭이 남아 있으면 인계한다. 모든 사이트 탭 종료·외부 이동으로 확인이 끊기면 마지막 확인 시각 기준으로 정지한다.
- 다른 브라우저는 키가 없어 차단하고 명시적 비밀번호 복구 때만 키를 교체한다. 잘못된 키·오래된 버전은 확인 시각을 연장하지 못한다.
- 탭 전환 자체는 정지 사유가 아니다. 백그라운드 제한·절전·통신 단절로90초 확인이 끊기면 정지할 수 있다. 15초 전달 또는 모든 환경에서 무중단 진행을 보장하지 않는다. [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- 인수 검증: 만료89.999초/90초 경계, 담당/보조 탭 종료, 새로고침, 탭 인계 중 중복, 모든 탭 종료, 늦은 과거heartbeat와정지, 자정·목표 종료·키 복구 경합.

## 9. 실패 목록

| HTTP | code | 조건 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | UUID·타입·범위·필수·지원하지 않는 필드 오류 |
| 400 | PASSWORD_CONFIRM_MISMATCH | 생성 비밀번호 확인 불일치 |
| 400 | INVALID_BACKGROUND | 최종 배경 목록 외 키; 목록 수신 전 완료 처리 불가 |
| 400 | INVALID_EMOJI | 허용 이모지/표현 규칙 위반; 세부 미정 |
| 401 | PASSWORD_MISMATCH | 발급·삭제·복구 비밀번호 오류 |
| 401 | VERIFICATION_REQUIRED | 일반 토큰 누락 |
| 401 | INVALID_TOKEN | 서명·payload 오류 |
| 401 | VERIFICATION_EXPIRED | 한국 자정 토큰 만료 |
| 401 | TIMER_KEY_REQUIRED | 활성 타이머 조작 키 누락 |
| 401 | INVALID_TIMER_KEY | 불일치·폐기·이전 복구 키 |
| 403 | STUDY_FORBIDDEN | 서명된 일반 토큰의 studyId 불일치 |
| 404 | STUDY_NOT_FOUND / HABIT_NOT_FOUND / FOCUS_NOT_FOUND | 대상 없음 또는 하위 데이터 소속 불일치 |
| 409 | FOCUS_CONFLICT | 스터디에 RUNNING/PAUSED 존재 |
| 409 | STALE_FOCUS_STATE | 상태 전환 이후 도착한 과거 stateVersion. 최신 조회 후 재조작 |
| 409 | INVALID_FOCUS_STATE | 진행 중 reset·종료 상태의 다른 조작 등 |
| 409 | FOCUS_NOT_FINISHED / FOCUS_FINISHED | 완료 전 complete / 완료해야 하는 상태의 pause·resume |
| 409 | HABIT_ENDED | 종료된 습관 체크·이름 변경 |
| 409 | DATE_CHANGED | 체크 요청 날짜가 서버 한국 오늘과 다름 |
| 409 | REACTION_POLICY_CONFLICT | 같은 studyId/browserId/emoji 중복 |
| 500 | INTERNAL_ERROR | DB·내부 장애; 민감값 미노출 |

스터디 중복 생성·습관18개 범위에 대한 오류 코드는 정책 확정 후 추가한다. 다른 브라우저의 시작은 FOCUS_CONFLICT, 기존 조작은 TIMER_KEY_REQUIRED/INVALID_TIMER_KEY로 경고한다. 클라이언트가 토큰/키를 지웠다는 이유만으로 서버 검증을 생략하지 않는다.

## 10. 남은 결정

| ID | 미정 항목 | 영향 |
| --- | --- | --- |
| API-Q-04 | 초기·최근 표시 개수·기본 정렬·생성 당일0/1일·다건 수 상한 | 목록/카드 |
| API-Q-05 | 기본 주·과거/미래 조회 허용 범위·기록표 행 순서/색상표 | 주간 조회·시안 |
| API-Q-06 | 공백 처리·이모지를 포함한 글자 수 계산, 습관18개 적용 범위 | 입력/DB 제약 |
| API-Q-07 | 응원 허용 이모지·유니코드 동일성·강사 확인 결과 | 응원 |
| API-Q-08 | 기본green 외 배경7종의 키·이미지 자산, 중복 생성 규칙 | 생성/수정 |
| API-Q-09 · 해결 | 15초 확인·90초 만료·새로고침 유지·담당 탭 인계 확정. 기기별 절전 지연은 구현 검증 대상 | 이탈 복구 |
| API-Q-12 | 구체 오류·완료 화면·반응형 시안, SCSS 도입 여부 | 프론트 |

토큰·키·자정 유지·RESET 새 행·종료일 포함·주간 겹침·총점 저장·다건 조회·검색3필드·동률 정렬은 더 이상 미정으로 표기하지 않는다. 삭제 비밀번호 재확인·수정 도착 페이지 모달은 최근 구체 결정 기준으로 유지하며 킥오프의 예전 흐름은 ADR-046에 비교 기록한다.

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
| F-FC-005 | API-FC-05 초기화 정산·API-FC-06 종료 정산 및 지급 누적 조회 |
| F-FC-006 | 프론트 이동 중 상태 유지 + API-FC-01 |
| F-FC-007 | API-FC-01 |
| F-FC-008 | API-FC-03 + API-FC-07 연결 확인 만료 복구 |
| F-FC-009 | API-FC-01 |
| F-FC-010 | API-FC-03 |
| F-FC-011 | API-FC-04 |
| F-FC-012 | API-FC-05 |
| F-AU-001 | API-AU-01 일반 토큰 발급·보호 API 토큰 검증 |
| F-AU-002 | 유효 일반 토큰 공유·재접속 유지, 한국 자정 만료. 활성 집중은 타이머 키로 계속 사용 |

## 12. 오래된 요청·습관 동시 요청 차단 (ADR-048)

### 집중 stateVersion

Challenge.stateVersion은1부터 시작한다. pause/resume/reset/complete·자동 만료 정지·조작권 복구의 실제 변경마다1증가한다. 단순 조회·heartbeat·같은 정지 재확인은 증가하지 않는다. 이는 집중 행을 재사용하는 attemptNumber가 아니라 같은 행의 상태 변경 세대다.

활성 키로 FC-03~07을 요청할 때 양의 정수 stateVersion을 필수 전달한다. 서버는 인증/소속 → 잠금 → 만료 복구 → 현재 버전 비교 → 상태 검사 → 변경 순으로 처리한다. 버전 불일치는409 STALE_FOCUS_STATE이며 자동으로 최신 버전으로 바꿔 재전송하지 않는다. 새로 조회하고 사용자 의도를 다시 확인한다. 만료를 방금 발견한heartbeat의200 PAUSED 복구 응답은8절의 예외다.

프론트는 focus.stateVersion을 보관하고 탭 간 최신 결과를 공유한다. 늦게 도착한 작은 버전의 응답으로 상태를 덮어쓰지 않는다. 같은 버전의heartbeat는 확인 시각을 서버에서 갱신할 뿐 경과를 중복 가산하지 않는다. 정지 A 지연 → 정지 B → 재개 후 A 도착은 이전 버전으로 거절한다. PAUSED200 재확인은 이미 최신 버전을 가진 요청만 해당한다.

terminal 동일 reset/complete 재확인은 기존 일반 토큰 예외 계약을 유지하며 body와stateVersion이 없어도 신규0P로 조회 확인한다. 활성 조작에 이 예외를 적용하지 않는다. 키 복구는 비밀번호 body만으로 현재 상태를 잠금 확인하고 버전을 증가시켜 이전 키/버전 모두 무효화한다.

### 습관 체크·수정·종료

Study→Routine 순서의 잠금 안에서 종료 여부·한국 오늘 날짜·유효 기간을 검사하고 변경한다. 종료와체크의 경합에서 먼저 잠금을 획득한 요청의 결과를 확정한다. 종료 뒤 도착한 체크·이름 변경은409 HABIT_ENDED, 종료 전 완료한 체크는 기록표에 보존한다. 재삭제는 최초 endsOn을 바꾸지 않는다. 모든 습관 쓰기 요청에서 같은 잠금 순서를 유지한다.
