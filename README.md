# 🌳 공부의 숲 (Forest of Study)

스터디 생성, 일일 습관 기록, 집중 시간 및 포인트 관리를 지원하는 웹 서비스입니다.

프로젝트 소개와 주요 화면, 서비스 아키텍처는 [조직 README](https://github.com/codeit-fs-16-part2-team1)에서 확인할 수 있습니다.

---

## 📑 목차

1. [개발 환경 및 기술 스택](#1-개발-환경-및-기술-스택)
2. [프로젝트 폴더 구조](#2-프로젝트-폴더-구조)
3. [환경변수 설정](#3-환경변수-설정)
4. [로컬 실행 가이드](#4-로컬-실행-가이드)
5. [배포 환경](#5-배포-환경)
6. [명세 및 관련 문서](#6-명세-및-관련-문서)

---

## 1. 개발 환경 및 기술 스택

| 구분 | 기술 |
| --- | --- |
| Language / Runtime | JavaScript, Node.js 24.19.0, npm |
| Frontend | React, React Router |
| Build | Vite |
| Styling | Sass |
| HTTP Client | Axios |
| UI | emoji-picker-react |
| Mock Server | json-server 0.17.4 |
| Backend | Express 5, cors |
| Validation | Zod |
| ORM | Prisma 7 |
| Database | PostgreSQL 18 |
| Password Hashing | bcrypt |
| Local Database | Docker Compose |
| Deployment | Netlify, Render, Neon |

TypeScript는 사용하지 않습니다. 의존성은 `api/`와 `web/`에서 각각 관리합니다.

---

## 2. 프로젝트 폴더 구조

주요 소스와 설정 경로입니다. 의존성·빌드 결과와 개별 파일 일부는 생략했습니다.

```text
.
├── .github/                 # 이슈·PR 템플릿
├── api/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── requests/            # 요청 예시·API 시연
│   ├── scripts/             # DB·API 검사
│   ├── src/
│   │   ├── config/
│   │   ├── lib/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── utils/
│   │   └── app.js
│   ├── prisma.config.js
│   ├── seed.js
│   ├── seedData.js
│   └── package.json
├── web/
│   ├── mocks/               # 임시 데이터
│   ├── public/              # 정적 파일·SPA 리다이렉트
│   ├── scripts/             # 기능 검사
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── constants/
│   │   ├── contexts/
│   │   ├── dev/             # 개발용 미리보기
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docs/
│   ├── brief.md
│   ├── ADR.md
│   ├── ADR-archive.md
│   ├── API.md
│   ├── DB.md
│   └── issues.md
├── images/
├── AGENTS.md
├── CONTRIBUTING.md
├── compose.yaml
└── README.md
```

---

## 3. 환경변수 설정

로컬 설정 파일은 `api/.env`와 `web/.env`에 직접 준비합니다. 실제 비밀값은 문서나 저장소에 넣지 않습니다.

### Backend

| 환경변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | 앱·Prisma·마이그레이션이 사용할 PostgreSQL 연결 URL. 로컬 DB는 5435 포트 사용 |
| `CORS_ORIGIN` | 허용할 프론트 출처. 필수이며 여러 주소는 쉼표로 구분. 예: `http://localhost:5173` |
| `PORT` | API 서버 포트. 미설정 시 `3000` |
| `LOCAL_DATABASE_URL` | 선택: 로컬 시드 대상. 앱의 `DATABASE_URL`과 별도로 지정 |
| `NEON_DATABASE_URL` | 선택: Neon 시드 대상. 일반 로컬 실행에는 불필요 |

서버와 Prisma 설정은 `api/.env`를 읽습니다. 배포에서는 서비스의 환경변수 설정을 사용합니다.

### Frontend

| 환경변수 | 설명 |
| --- | --- |
| `VITE_API_BASE_URL` | API 기본 URL. 실제 서버 연결 예: `http://localhost:3000/api` |
| `LOCAL_BASE_URL` | 선택: 로컬 서버 URL. |
| `RENDER_BASE_URL` | 선택: 배포 서버 URL. |

실제 Express API에 연결할 때는 `/api`까지 포함합니다. 프론트 환경변수 변경 후 개발 서버를 재시작하고 배포에서는 다시 빌드합니다.

### 주의사항

- `.env` 파일과 실제 접속 정보는 커밋하지 않습니다.
- 로컬·배포 DB를 구분하고 명령 실행 전 대상 URL을 확인합니다.
- `VITE_` 변수는 브라우저에 공개되므로 비밀값을 넣지 않습니다.

---

## 4. 로컬 실행 가이드

### 4.1 사전 준비

로컬 실행을 위해 다음 도구가 필요합니다.

- Node.js `24.19.0` 및 npm
- Docker Desktop
- Git

### 4.2 저장소 복제

저장소의 Code 메뉴에서 복제 URL을 확인해 아래 자리표시자를 바꿉니다. 작업 디렉터리는 저장소를 둘 상위 폴더입니다.

```bash
git clone <REPOSITORY_URL>
cd forest-of-study
```

### 4.3 PostgreSQL 실행

로컬 개발 환경에서는 Docker Compose를 통해 PostgreSQL 18을 실행합니다.

| 항목 | 설정 |
| --- | --- |
| Docker 이미지 | `postgres:18` |
| 컨테이너 이름 | `forest-of-study-db` |
| 데이터베이스 | `forest-of-study` |
| 사용자 | `forest-of-study` |
| 로컬 호스트 | `localhost` |
| 로컬 포트 | `5435` |
| 컨테이너 포트 | `5432` |
| 데이터 볼륨 | `forest-of-study-data` |

저장소 루트에서 다음 명령어를 실행합니다.

```bash
# Compose 설정 확인
docker compose config --quiet

# PostgreSQL 컨테이너 실행
docker compose up -d

# 컨테이너 상태 확인
docker compose ps
```

DB 연결 확인:

```bash
docker compose exec db \
  psql -U forest-of-study \
  -d forest-of-study \
  -c "SELECT version(), current_database();"
```

`db` 서비스가 `healthy` 상태인지 확인합니다.

**참고 사항**

- 로컬 PostgreSQL은 호스트의 `5435` 포트를 사용합니다.
- Docker named volume을 사용하므로 컨테이너를 재시작해도 데이터가 유지되도록 구성되어 있습니다.
- 기존 `postgres_data` 볼륨의 데이터는 새 볼륨으로 자동 이전되지 않습니다.
- 위 실행 및 데이터 보존 절차는 README에 정의된 검증 방법이며, 실제 검증 완료 여부는 별도 확인이 필요합니다.

### 4.4 Backend 실행

선행 조건: 로컬 DB가 healthy이고 `api/.env`의 `DATABASE_URL`·`CORS_ORIGIN`이 설정돼 있어야 합니다. 저장소 루트에서 실행합니다.

```bash
cd api
npm ci
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:status
npm run db:check
npm run dev
```

`db:migrate`는 기존 migration을 대상 DB에 적용합니다. API 기본 주소는 `http://localhost:3000/api`이며 `PORT`를 변경했다면 프론트 설정도 맞춥니다. 서버 루트 `/`는 실행 확인용 응답을 제공합니다.

**선택: 초기 데이터**

```bash
npm run seed
npm run seed:neon
```
일반 실행에 시드는 필요하지 않습니다. `api/`에서 `npm run seed`는 `LOCAL_DATABASE_URL`, `npm run seed:neon`은 `NEON_DATABASE_URL`을 대상으로 실행됩니다. 두 명령 모두 **대상 DB의 기존 5개 테이블 데이터를 삭제하고 교체**하므로 대상·migration·백업을 확인한 경우에만 별도로 실행합니다.

### 4.5 Frontend 실행

선행 조건: `web/.env`의 `VITE_API_BASE_URL`을 설정하고 실제 연동 시 API 서버를 실행합니다. 새 터미널의 저장소 루트에서 실행합니다.

```bash
cd web
npm ci
npm run dev
```

터미널에 표시된 주소로 접속합니다. Vite 기본 포트는 `5173`이며 포트가 사용 중이면 달라질 수 있습니다. 실제 접속 출처가 API의 `CORS_ORIGIN`에 포함돼야 합니다.

`web/`에서 사용하는 추가 명령입니다.

| 명령 | 용도 |
| --- | --- |
| `npm run build` | 정적 자산을 `dist/`에 빌드 |
| `npm run preview` | 빌드 후 로컬 미리보기 |
| `npm run lint` | 프론트 정적 검사 |
| `npm run mock` | `mocks/db.json`으로 임시 서버 실행, 포트 3001 |

Mock 서버는 별도 터미널의 `web/`에서 실행합니다. json-server의 리소스 경로·원시 응답은 Express의 `/api`·`{data}`·인증 계약과 다르므로 API 주소 변경만으로 전체 연동을 대체하지 않습니다.

### 4.6 API 요청 테스트

API 서버·DB를 실행하고 요청 변수와 비밀번호를 로컬에서 준비한 뒤 필요한 요청을 개별 실행합니다.

- [api.http](api/requests/api.http): 전체 API 요청 예시
- [API.md](docs/API.md): 요청·응답·실패 계약

`api/`에서 실행하는 검사 명령입니다.

| 명령 | 확인 범위 |
| --- | --- |
| `npm test` | 입력 검증·집중 함수·완료 규칙·응원 함수 검사 |
| `npm run db:status` | 대상 DB의 migration 적용 상태 |
| `npm run db:check` | DB 연결·모델·등록된 제약과 인덱스의 읽기 전용 검사 |

함수 검사나 제약 등록 확인만으로 실제 API·DB 변경·Cascade 동작까지 검증된 것은 아닙니다. 위 절차는 실행 안내이며 이 문서 갱신 과정에서 실행하지 않았습니다.

---

## 5. 배포 환경

| 구분 | 서비스 | 용도 |
| --- | --- | --- |
| Frontend | Netlify | 프론트 정적 자산 배포 |
| Backend | Render | Express API 서버 배포 |
| Database | Neon | PostgreSQL 호스팅 |

아래는 현재 패키지·설정에 맞춘 설정안이며 서비스에 실제 적용됐는지는 별도 확인합니다.

| 항목 | 설정 |
| --- | --- |
| 공통 Node.js | `24.19.0` |
| Netlify Base directory | `web` |
| Netlify Build command | `npm run build` |
| Netlify Publish directory | `dist` (Base directory 기준) |
| Netlify 환경변수 | `VITE_API_BASE_URL`: 배포 API 주소 + `/api` |
| Render Root directory | `api` |
| Render Build command | `npm ci && npm run db:generate` |
| Render migration | `npm run db:migrate`를 앱 실행 전에 적용 |
| Render Start command | `npm start` |
| Render 환경변수 | Neon의 `DATABASE_URL`, 프론트 출처의 `CORS_ORIGIN`, 서비스가 제공하는 `PORT` |

Render가 별도 배포 전 명령을 지원하면 migration을 그 단계에 둡니다. 지원하지 않으면 빌드 명령 끝에 `&& npm run db:migrate`를 추가하는 방식 등 적용 위치를 정한 뒤 배포합니다. migration 실행 단계에는 대상 `DATABASE_URL`이 필요합니다.

### 배포 시 확인사항

- Neon DB 연결과 migration 적용 후 API 시작 여부를 확인합니다.
- 프론트 요청 주소, CORS와 보호 요청 헤더 처리를 확인합니다.
- `web/public/_redirects`의 `/* /index.html 200` 설정으로 직접 URL 접근·새로고침을 확인합니다.
- 프론트 빌드에 환경변수가 반영됐는지 확인합니다.
- 배포 URL과 조직 README 주소는 실제 주소 확인 후 추가합니다.

---

## 6. 명세 및 관련 문서

| 문서 | 설명 |
| --- | --- |
| [brief.md](docs/brief.md) | 초기 요구사항 원문 |
| [ADR.md](docs/ADR.md) | 현재 유효한 결정과 부분 대체 관계 |
| [ADR-archive.md](docs/ADR-archive.md) | 전체·부분 대체된 과거 결정 |
| [API.md](docs/API.md) | API 명세 및 요청·응답 규격 |
| [DB.md](docs/DB.md) | 데이터베이스 설계 및 ERD |
| [issues.md](docs/issues.md) | 개발 이슈 및 작업 계획 |
| [api.http](api/requests/api.http) | API 요청 예시 |
| [schema.prisma](api/prisma/schema.prisma) | Prisma 데이터베이스 스키마 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 협업·브랜치·PR 규칙 |
| [AGENTS.md](AGENTS.md) | AI 작업 지침 |

상세 기능 명세, 정책 변경 이력, 개발 우선순위 및 버전별 작업 범위는 위 문서에서 관리합니다.
