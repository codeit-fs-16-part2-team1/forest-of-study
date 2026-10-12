# 공부의 숲 데이터베이스 설계

- 버전:0.7 축소 설계 초안 · 2026-10-12 (Asia/Seoul)
- 기준: [README.md](../README.md), [API.md](API.md), [ADR.md](ADR.md) ADR-051~053; 습관·응원은 ADR-045~046.
- 스키마: [api/prisma/schema.prisma](../api/prisma/schema.prisma). 5개 테이블을 사용한다. VerificationToken·PointHistory·회원 테이블은 만들지 않는다.
- 이번에는 문서·스키마만 갱신한다. 기존 데이터 변경·migration·generate·db push를 실행하지 않는다.

## 로컬 실행 환경 — ADR-049·050

- Neon 호스팅 이전 개발용 PostgreSQL은 루트 `compose.yaml`의 `postgres:18` (18 계열 태그, 18.6 고정 아님)을 사용한다.
- DB·사용자 `forest-of-study`, 로컬 전용 비밀번호 `forest-of-study-local`.
- 로컬 앱/DB 클라이언트의 접속 주소는 `127.0.0.1:5435`. 컨테이너 내부 포트는5432다.
- named volume `forest-of-study-data`는 `/var/lib/postgresql`에 연결한다. 데이터는 컨테이너와 분리해 보존한다.
- 컨테이너 이름은 `forest-of-study-db`다. 포트 매핑 `5435:5432`는 루프백 바인딩으로 제한하지 않는다. healthcheck는 `pg_isready`, 간격 10초·제한 5초·재시도 5회·시작 유예 10초다.
- 기존 `postgres_data`의 데이터는 새 볼륨으로 자동 이전되지 않는다. 초기 계정 설정은 빈 데이터 디렉터리에서만 적용되므로 기존 볼륨의 계정은 자동 변경되지 않는다.
- 설정 파일 작성만 완료했으며 컨테이너 시작·접속·migration은 실행하지 않았다. 테이블·FK·CHECK가 실제 생성됐다는 의미가 아니다.
- ISS-001은 로컬 DB 설정, ISS-005는 이후 migration·제약 적용이다. 기존 미정 정책 확인은 ISS-002다.
- 실행 순서·기대 결과는 README.md의 ‘로컬 DB 개발 환경’을 따른다. Neon 배포 접속 정보는 로컬 개발 설정과 별도로 관리한다.

## 1. 구조와 저장 기준

| 테이블 | 역할 | 주 식별자 |
| --- | --- | --- |
| Study | 기본 정보·bcrypt 해시·지급 총점 | id |
| Routine | 반복 습관과 시작/종료일 | id |
| RoutineHistory | 한국 날짜별 완료/해제 상태 | routineId + recordDate |
| Challenge | 집중 1회의 시간·상태·완료 지급량 | id |
| Reaction | 브라우저·이모지별1회 응원 | studyId + browserId + emoji |

- 비밀번호 원문은 DB·LocalStorage·쿠키·URL·로그에 저장하지 않는다. Study.passwordHash만 bcrypt 해시로 저장한다.
- 보호 페이지마다 비밀번호를 API로 확인하고 페이지 메모리에만 보관한다. 보호 요청마다 X-Study-Password 헤더로 보내 서버가 다시 bcrypt 검증한다. 페이지 진입 검증·삭제 모달 요청은 본문 password를 사용한다.
- 토큰·타이머 키·브라우저 소유권은 사용하지 않는다. 응원 browserId는 응원 중복 방지에만 사용한다.
- RUNNING은 브라우저 종료·외부 이동·새로고침과 무관하게 서버 시간으로 계속 흐른다. 자동 일시정지·연결 확인·연결 만료·stateVersion은 제외한다.
- 모든 습관 날짜는 서버가 Asia/Seoul로 계산한 Date. 일시는 timestamptz(3), 클라이언트에 UTC ISO 문자열로 전달한다.
- Study.points는 완료된 Challenge.awardedPoints 합계의 중복 저장이다. 진행·정지·초기화에는 포인트를 지급하지 않는다.

## 2. 전체 ERD

dotted 관계는 부모 FK가 자식 PK의 일부가 아닌 관계, solid 관계는 부모 FK가 자식 PK에 포함된 관계다. 모든 FK는 필수이며 onDelete: Cascade다.

```mermaid
erDiagram
    Study ||..o{ Routine : "보유 / onDelete Cascade"
    Routine ||--o{ RoutineHistory : "기록 / onDelete Cascade"
    Study ||..o{ Challenge : "집중 / onDelete Cascade"
    Study ||--o{ Reaction : "응원 / onDelete Cascade"
    Study {
        String id PK
        String nickname
        String name
        String introduction
        String backgroundKey
        String passwordHash
        Int points
        DateTime createdAt
        DateTime updatedAt
    }
    Routine {
        String id PK
        String studyId FK
        String name
        DateTime startsOn
        DateTime endsOn "NULL 허용"
        DateTime createdAt
        DateTime updatedAt
    }
    RoutineHistory {
        String routineId PK,FK
        DateTime recordDate PK
        Boolean completed
        DateTime createdAt
        DateTime updatedAt
    }
    Challenge {
        String id PK
        String studyId FK
        Int goalMinutes
        ChallengeStatus status
        Int elapsedMilliseconds
        DateTime lastStartedAt "NULL 허용"
        Int awardedPoints
        DateTime createdAt
    }
    Reaction {
        String studyId PK,FK
        String browserId PK
        String emoji PK
        DateTime createdAt
    }
```

## 3. 관계차수·선택사양·삭제 동작

| 관계 | 관계차수 | 부모1행의 자식 수 | 자식1행의 부모 수 | 부모 측 선택 | 자식 측 선택 | FK | onDelete |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Study → Routine | 1:N | 0..N | 1..1 | 선택 | 필수 | Routine.studyId NOT NULL | Cascade |
| Routine → RoutineHistory | 1:N | 0..N | 1..1 | 선택 | 필수 | RoutineHistory.routineId NOT NULL | Cascade |
| Study → Challenge | 1:N | 0..N | 1..1 | 선택 | 필수 | Challenge.studyId NOT NULL | Cascade |
| Study → Reaction | 1:N | 0..N | 1..1 | 선택 | 필수 | Reaction.studyId NOT NULL | Cascade |

Study→Challenge의0..N은 전체 이력이다. RUNNING/PAUSED 활성만0..1로 제한하며 전체 관계를1:1로 바꾸지 않는다. RESET/COMPLETED는 이력으로 남는다. Challenge.lastStartedAt은 RUNNING에서 필수이고 나머지 상태에서는 null이다.

스터디 물리 삭제는 연결된 모든 행을 Cascade 삭제한다. 습관 종료는 Routine.endsOn만 변경해 이력을 보존한다. 타이머 초기화는 Challenge를 RESET으로 종료해 이력을 보존하며 Cascade를 실행하지 않는다. 전체 5개 테이블·4개 FK다.

## 4. 데이터 사전

NULL 여부·기본값·Prisma 자료형은 아래 스키마 선언과 대응한다. UUID id는 서버/DB 생성 기본값이며 DB 네이티브 길이·날짜·타임스탬프는 선언의 @db를 따른다.

### Study

| 컬럼 | Prisma 선언 | NULL |
| --- | --- | --- |
| id | `String   @id @default(uuid()) @db.Uuid` | 불가 |
| nickname | `String   @db.VarChar(10)` | 불가 |
| name | `String   @db.VarChar(15)` | 불가 |
| introduction | `String   @db.VarChar(100)` | 불가 |
| backgroundKey | `String   @default("green") @db.Text` | 불가 |
| passwordHash | `String   @db.Text` | 불가 |
| points | `Int      @default(0)` | 불가 |
| createdAt | `DateTime @default(now()) @db.Timestamptz(3)` | 불가 |
| updatedAt | `DateTime @updatedAt @db.Timestamptz(3)` | 불가 |

### Routine

| 컬럼 | Prisma 선언 | NULL |
| --- | --- | --- |
| id | `String    @id @default(uuid()) @db.Uuid` | 불가 |
| studyId | `String    @db.Uuid` | 불가 |
| name | `String    @db.VarChar(20)` | 불가 |
| startsOn | `DateTime  @db.Date` | 불가 |
| endsOn | `DateTime? @db.Date` | 허용 |
| createdAt | `DateTime  @default(now()) @db.Timestamptz(3)` | 불가 |
| updatedAt | `DateTime  @updatedAt @db.Timestamptz(3)` | 불가 |

### RoutineHistory

| 컬럼 | Prisma 선언 | NULL |
| --- | --- | --- |
| routineId | `String   @db.Uuid` | 불가 |
| recordDate | `DateTime @db.Date` | 불가 |
| completed | `Boolean  @default(false)` | 불가 |
| createdAt | `DateTime @default(now()) @db.Timestamptz(3)` | 불가 |
| updatedAt | `DateTime @updatedAt @db.Timestamptz(3)` | 불가 |

### Challenge — 8개 컬럼

| 컬럼 | Prisma 선언 | NULL | 의미 |
| --- | --- | --- | --- |
| id | `String @id @default(uuid()) @db.Uuid` | 불가 | 집중 1회의 ID |
| studyId | `String @db.Uuid` | 불가 | 소속 스터디 |
| goalMinutes | `Int @default(10)` | 불가 | 목표 시간, 10~180분 정수 |
| status | `ChallengeStatus @default(RUNNING)` | 불가 | RUNNING / PAUSED / RESET / COMPLETED |
| elapsedMilliseconds | `Int @default(0)` | 불가 | 이전 실행 구간에서 확정한 누적 시간 |
| lastStartedAt | `DateTime? @db.Timestamptz(3)` | 허용 | 현재 실행 구간의 시작 시각, RUNNING에서만 사용 |
| awardedPoints | `Int @default(0)` | 불가 | 완료 시 지급한 포인트, 미완료·초기화는 0 |
| createdAt | `DateTime @default(now()) @db.Timestamptz(3)` | 불가 | 생성 시각·마지막 목표 복원 정렬 |

### Reaction

| 컬럼 | Prisma 선언 | NULL |
| --- | --- | --- |
| studyId | `String   @db.Uuid` | 불가 |
| browserId | `String   @db.Uuid` | 불가 |
| emoji | `String   @db.Text` | 불가 |
| createdAt | `DateTime @default(now()) @db.Timestamptz(3)` | 불가 |

### 컬럼 의미와 파생값

- Study.nickname/name/introduction 최대10/15/100, Routine.name 최대20. 문자열 공백·글자 수 기준은 API-Q-06에서 확정한다. DB varchar와 프론트 글자 수가 다를 수 있으므로 이모지 경계도 검증한다.
- Study.backgroundKey 기본green은 첫 초록색. 총8종(원색4·이미지4) 키·자산 목록은 추후 전달받는다. API background와 명시적으로 매핑한다.
- Study.passwordHash는 bcrypt, points 기본0·음수 금지. 닉네임·이름 중복 UNIQUE는 미정 정책을 임의 확정하지 않기 위해 추가하지 않는다.
- Routine.startsOn/endsOn은 양 끝 포함. 종료일이null이면 열린 기간이다. 종료 즉시 오늘 목록에서 숨기고 체크·이름 변경 금지. 생성 당일 종료도 유효하며 startsOn=endsOn 허용.
- RoutineHistory.completed=false 행은 체크 해제 사실로 남긴다. 유효 날짜에 행이 없으면 조회 시false, 유효 기간 밖은 exists=false/completed=null. 이름은 Routine에서 조회하여 과거 표에도 현재 이름 반영.
- Challenge.goalMinutes는 목표 **길이**, lastStartedAt은 **시각**이다. 서로 대체할 수 없다. elapsedMilliseconds는 일시정지 전에 실제로 진행한 구간의 누적 시간이다.
- RUNNING의 실제 경과 = min(goalMinutes × 60000, elapsedMilliseconds + max(0, 서버 현재 시각 - lastStartedAt)). PAUSED/RESET/COMPLETED의 경과는 저장된 elapsedMilliseconds다.
- 조회마다 진행 중 시간을 DB에 덧셈하지 않는다. 일시정지할 때 실제 경과를 저장하고 lastStartedAt=null, 재개할 때 기존 경과를 유지하고 lastStartedAt=서버 현재 시각으로 설정한다.
- awardedPoints는 완료 지급의 결과다. COMPLETED 전이는 서버가 목표 도달을 검증한 뒤 수행한다. RESET은 경과 이력을 보존하지만 지급하지 않는다. 새 시작은 새 행·경과 0이며 예전 행을 재사용하지 않는다.
- Reaction.createdAt을 이모지별 MIN으로 집계해 최초 반응 시각을 구한다. 상위3종은 COUNT DESC, MIN(createdAt) ASC, emoji ASC(C collation). browserId는 일반 중복 방지 수준이며 신원 증명이 아니다.

## 5. 정규화와 총점 중복 저장

| 단계 | 적용 |
| --- | --- |
| 1NF | 습관의 날짜별 상태·집중 1회·응원을 독립 행으로 저장하며 배열/반복 컬럼을 두지 않는다 |
| 2NF | RoutineHistory의 상태는 routineId+날짜 전체, Reaction의 시각은 studyId+browserId+emoji 전체에 종속한다 |
| 3NF 목표 | 과거 기록에 습관 이름·studyId를 복사하지 않고 FK로 조회한다. 집중에 스터디 이름·비밀번호를 복사하지 않는다 |

| 테이블 | 결정자 | 비키 속성 |
| --- | --- | --- |
| Study | id | nickname, name, introduction, backgroundKey, passwordHash, points, createdAt, updatedAt |
| Routine | id | studyId, name, startsOn, endsOn, createdAt, updatedAt |
| RoutineHistory | routineId, recordDate | completed, createdAt, updatedAt |
| Challenge | id | studyId, goalMinutes, status, elapsedMilliseconds, lastStartedAt, awardedPoints, createdAt |
| Reaction | studyId, browserId, emoji | createdAt |

Challenge.awardedPoints는 집중별 지급 결과를 보관한다. 별도 PointHistory와 PointKind는 제거한다. Study.points는 이 지급량의 합계를 빠르게 조회·정렬하기 위한 의도적인 중복 저장이므로 전체 구조가 중복 없는 정규화 결과라고 설명하지 않는다. 지급 전이와 합계 증가를 같은 트랜잭션으로 처리한다.

Study.points = COALESCE(SUM(해당 스터디 Challenge.awardedPoints), 0)을 대조 기준으로 사용한다. 자동 보정 작업·별도 포인트 관리 API는 이번 범위에 추가하지 않는다. 상위 응원·남은 시간·진행 일수는 조회 시 파생한다.

## 6. 상태·기간·정산 규칙

### 습관 표시와 조작

- 오늘 목록: endsOn IS NULL AND startsOn <= 한국 오늘.
- 기록 칸: startsOn <= 날짜 AND (endsOn IS NULL OR 날짜 <= endsOn).
- 주간 행: startsOn <= 주 마지막날 AND (endsOn IS NULL OR endsOn >= 주 첫날).
- 오늘 생성→체크→종료도 오늘 체크는 남고 목록에서만 제거된다. 지난달 종료 습관이 이번 주 빈 행으로 나오지 않는다.
- endsOn은 종료 시 최초 오늘 날짜로만 설정하며 재삭제로 날짜를 바꾸지 않는다. 날짜가 유효해도 종료된 습관 조작은 거절한다.
- 최대18개는 킥오프 요구이며 활성/전체 범위는 미정. 현재 DB 이력 관계의0..N에 총18개 제한을 붙이지 않는다.

### 집중 생명주기

```mermaid
stateDiagram-v2
    [*] --> RUNNING: 새 Start / 새 행
    RUNNING --> PAUSED: 사용자 일시정지
    PAUSED --> RUNNING: 재개 / 같은 행
    PAUSED --> RESET: 초기화 / 지급 없음
    RUNNING --> COMPLETED: 서버 목표 도달 검증 / 완료 지급
    PAUSED --> COMPLETED: 확정 경과가 목표에 도달 / 완료 지급
    RESET --> [*]
    COMPLETED --> [*]
```

- RUNNING/PAUSED는 스터디당 합계 1개다. PAUSED가 있으면 새 시작을 막고 기존 집중을 재개하거나 초기화한다.
- 브라우저를 닫아도 RUNNING은 계속 흐른다. 별도 Heartbeat·자동 일시정지·소유권·stateVersion은 사용하지 않으며 여러 브라우저의 조작 순서 충돌 처리는 이번 범위에서 제외한다.
- 초기화는 PAUSED에서만 가능하다. 행을 삭제하지 않고 RESET으로 종료한다. 화면은 해당 목표 시간·경과 0의 시작 전 상태로 돌아가며 자동 시작하지 않는다. 다음 Start에서 새 행을 만든다.
- 활성 행이 없으면 최신 RESET/COMPLETED의 goalMinutes를 복원한다(createdAt DESC, id DESC). 이력도 없으면 10분이다. 이전 집중의 남은 시간을 새 집중에 이월하지 않는다.
- 목표에 도달해도 GET은 상태·지급을 변경하지 않는다. 클라이언트가 완료 요청을 보내 서버가 검증하고 종료한다. 창이 닫힌 동안 목표를 채웠다면 재접속·비밀번호 확인 후 완료 요청으로 지급한다. 완료 처리 전까지 그 행은 활성 슬롯을 차지한다.

### 완료 포인트와 중복 지급 방지

- 완료 지급량 = floor(goalMinutes / 10) + 3. 10/20/25/180분 완료는 4/5/5/21P이며 상한 없음.
- 일시정지·재개·초기화·조회에는 지급하지 않는다. 13분 초기화 후 다른 집중을 17분 초기화해도 합계 0P다.
- Study→Challenge 순서로 잠금 → 현재 상태/소속/서버 경과 검사 → RUNNING/PAUSED 행만 COMPLETED로 **조건부 전환** → elapsedMilliseconds를 목표 값, lastStartedAt을 null, awardedPoints를 지급량으로 설정 → Study.points 원자 증가를 한 트랜잭션으로 처리한다.
- 실제로 완료 전이에 성공한 요청만 총점을 증가시킨다. 트랜잭션만 감싸고 무조건 증가시키지 않는다. 실패 시 상태·지급량·총점 모두 롤백한다.
- 동일 COMPLETED 행의 완료 재요청은 200·이번 신규 지급 0P이며 기존 awardedPoints와 총점을 보존한다. RESET에 완료 요청은 거절한다.
- 여러 브라우저의 조작 순서 보장을 제외해도 완료 요청 반복·더블클릭에 대한 중복 지급 방지는 유지한다.

### 습관 쓰기 무결성

체크·이름 수정·종료는 Study→Routine 잠금 순서로 종료 상태 검사와 쓰기를 묶는다. 먼저 확정된 체크는 기록표에 보존하고 종료 뒤 도착한 체크·수정은 거절한다. 재삭제로 종료일을 바꾸지 않는다.

## 7. 제약·인덱스와 후속 migration

Prisma에는 PK·FK·NULL·varchar·일반 인덱스를 표현했다. 아래 SQL은 후속 migration에 포함할 설계이며 실행하지 않았다. CHECK는 다른 행의 합계 일관성을 보장하지 않으므로 총점은 위 트랜잭션으로 유지한다.

```sql
CREATE UNIQUE INDEX "Challenge_one_active_per_study"
ON "Challenge" ("studyId")
WHERE "status" IN ('RUNNING', 'PAUSED');

ALTER TABLE "Study"
ADD CONSTRAINT "Study_points_nonnegative" CHECK ("points" >= 0);

ALTER TABLE "Routine"
ADD CONSTRAINT "Routine_period" CHECK ("endsOn" IS NULL OR "startsOn" <= "endsOn"),
ADD CONSTRAINT "Routine_name_nonempty" CHECK (char_length("name") >= 1);

ALTER TABLE "Challenge"
ADD CONSTRAINT "Challenge_goal_range" CHECK ("goalMinutes" BETWEEN 10 AND 180),
ADD CONSTRAINT "Challenge_elapsed_range"
  CHECK ("elapsedMilliseconds" BETWEEN 0 AND "goalMinutes" * 60000),
ADD CONSTRAINT "Challenge_running_time" CHECK (
  ("status" = 'RUNNING' AND "lastStartedAt" IS NOT NULL)
  OR ("status" <> 'RUNNING' AND "lastStartedAt" IS NULL)
),
ADD CONSTRAINT "Challenge_award_state" CHECK (
  ("status" = 'COMPLETED'
    AND "elapsedMilliseconds" = "goalMinutes" * 60000
    AND "awardedPoints" = ("goalMinutes" / 10) + 3)
  OR ("status" <> 'COMPLETED' AND "awardedPoints" = 0)
);
```

| 인덱스/키 | 목적 |
| --- | --- |
| Study(createdAt,id), (points,id) | 생성 순·총점 순 정렬 |
| Routine(studyId,startsOn,endsOn) | 오늘/주간 기간 조회 |
| RoutineHistory PK | 날짜별 중복 방지 |
| Challenge(studyId,status) + 활성 부분 UNIQUE | 단일 활성·동시 시작 방어 |
| Challenge(studyId,createdAt,id) | 마지막 목표 복원 |
| Reaction PK, (studyId,emoji) | 브라우저 중복·응원 집계 |

## 8. 변경 적용·검증과 미정

기존 DB에 데이터가 있다면 PointHistory의 기존 지급 기록과 Study.points를 먼저 대조하고, 과거 초기화 보상까지 새 완료 전용 정책에 어떻게 처리할지 별도로 확인해야 한다. 기존 지급 내역을 새 awardedPoints로 기계적으로 복사하거나 삭제하지 않는다. 과거 RESET 지급 행이 있으면 새 CHECK와 충돌할 수 있다. 데이터 존재·전환 정책을 확인하기 전 파괴적 migration을 적용하지 않는다.

이번 변경은 문서·Prisma 초안뿐이다. 기존 PointHistory/PointKind 제거, Challenge 컬럼 축소·awardedPoints 추가, CHECK 교체는 후속 migration 작업이며 실행하지 않았다. Prisma CLI 설치·validate·generate·migration도 실행하지 않았다. 필요 명령은 후속 구현 계획에서 사람이 실행하도록 안내한다.

남은 결정: 습관 18개 범위, 중복 스터디 정책, 배경 7종 키·자산, 공백·글자 계산·이모지 동일성, 기본 주/조회 범위·색상표. 자세한 목록은 API.md 10절과 issues.md에 연결한다.

