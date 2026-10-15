// 개발용 시드 구성. DB 연결이나 기존 데이터 조회는 하지 않는다.
// S01~S13은 용도 식별자이며 DB 컬럼을 추가하지 않는다.
const DAY = 86_400_000;
const MINUTE = 60_000;
const family = "👨‍👩‍👧‍👦";
const koreanFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
});
const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });

export const EXPECTED_COUNTS = Object.freeze({
  Study: 13, Routine: 52, RoutineHistory: 50, Challenge: 16, Reaction: 27,
});
export const SEED_EMOJIS = Object.freeze(["🔥", "👏", "💪", "🌱"]);
// 확정된 8종을 단색·이미지 순서로 번갈아 배치한다. 재실행해도 같은 스터디에 같은 배경을 쓴다.
export const SEED_BACKGROUND_KEYS = Object.freeze([
  "green", "image1", "yellow", "image2", "blue", "image3", "pink", "image4",
]);
export const STUDY_CASES = Object.freeze([
  ["S01", "빈 상태", 0, 0, 0, 0, 0],
  ["S02", "주간 기록·한국 자정", 8, 20, 0, 1, 0],
  ["S03", "활성 습관 18개", 20, 12, 0, 0, 0],
  ["S04", "활성 습관 17개", 19, 8, 0, 0, 0],
  ["S05", "목표 미달 RUNNING", 2, 4, 3, 0, 9],
  ["S06", "자정을 넘겨 목표 도달 RUNNING", 0, 0, 2, 0, 5],
  ["S07", "목표 미달 PAUSED", 0, 0, 2, 0, 4],
  ["S08", "목표 도달 PAUSED", 0, 0, 1, 0, 0],
  ["S09", "10·20·25·180분 완료", 0, 0, 4, 0, 35],
  ["S10", "13·17분 경과 RESET", 0, 0, 2, 0, 0],
  ["S11", "응원 개수·최초 시각", 0, 0, 0, 15, 0],
  ["S12", "응원 동률·이모지 값", 0, 0, 0, 8, 0],
  ["S13", "최대 그래핌·Cascade 확인용", 3, 6, 2, 3, 21],
]);

const uuid = (kind, number) => `${kind}0000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const studyId = (study) => uuid(1, study);
export const routineId = (study, routine) => uuid(2, study * 100 + routine);
export const challengeId = (study, challenge) => uuid(3, study * 100 + challenge);
export const browserId = (browser) => uuid(4, browser);
export const dateString = (value) => value.toISOString().slice(0, 10);
export const getKoreanDate = (instant) => {
  const parts = Object.fromEntries(koreanFormatter.formatToParts(instant)
    .map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
export const shiftDate = (date, days) => dateString(new Date(
  new Date(`${date}T00:00:00.000Z`).getTime() + days * DAY,
));
export const koreanInstant = (date, time = "00:00:00.000") => new Date(`${date}T${time}+09:00`);
const calendarDate = (date) => new Date(`${date}T00:00:00.000Z`);

// 로컬 Compose 주소만 허용하고 URL·비밀번호를 오류에 포함하지 않는다.
// 접속 대상을 바꾸는 query도 거절하며 localhost는 IPv4 loopback으로 고정한다.
export const assertLocalSeedDatabase = (databaseUrl) => {
  const message = "시드는 로컬 DB 전용입니다. localhost/127.0.0.1:5435, DB 이름 forest-of-study를 사용해주세요.";
  let url;
  try { url = new URL(databaseUrl); } catch { throw new Error(message); }
  const params = [...url.searchParams];
  if (!["postgres:", "postgresql:"].includes(url.protocol)
      || !["localhost", "127.0.0.1"].includes(url.hostname)
      || url.port !== "5435" || url.pathname !== "/forest-of-study" || url.hash
      || params.some(([key, value]) => key !== "schema" || value !== "public")
      || params.length > 1) {
    throw new Error(message);
  }
  // 호출하는 스크립트는 이 반환값으로만 Prisma adapter를 생성한다.
  url.hostname = "127.0.0.1";
  url.search = ""; // public은 기본 스키마이므로 드라이버에 query를 전달하지 않는다.
  return url.toString();
};

// Neon 전용 명령만 외부 DB를 허용한다. 로컬 검사를 완화하거나 DATABASE_URL로 대체하지 않는다.
export const assertNeonSeedDatabase = (databaseUrl) => {
  const message = "Neon 시드는 NEON_DATABASE_URL의 Neon 주소와 sslmode=require 또는 검증용 SSL 설정이 필요합니다.";
  let url;
  try { url = new URL(databaseUrl); } catch { throw new Error(message); }
  const params = [...url.searchParams];
  const allowed = {
    schema: (value) => value === "public",
    sslmode: (value) => ["require", "verify-ca", "verify-full"].includes(value),
    channel_binding: (value) => ["require", "prefer"].includes(value),
    connect_timeout: (value) => /^[1-9]\d*$/.test(value),
  };
  if (!["postgres:", "postgresql:"].includes(url.protocol)
      || !url.hostname.endsWith(".neon.tech")
      || (url.port !== "" && url.port !== "5432")
      || !/^\/[^/]+$/.test(url.pathname) || url.hash
      || !allowed.sslmode(url.searchParams.get("sslmode"))
      || new Set(params.map(([key]) => key)).size !== params.length
      || params.some(([key, value]) => !Object.hasOwn(allowed, key) || !allowed[key](value))) {
    throw new Error(message);
  }
  // SSL·channel binding을 유지하고 Prisma의 public 지정만 드라이버에서 제외한다.
  url.searchParams.delete("schema");
  return url.toString();
};

export const getSeedTarget = (args, environment, { allowPreflight = false } = {}) => {
  const targetArgs = args.filter((arg) => arg.startsWith("--target="));
  const name = targetArgs.length === 0 ? "local" : targetArgs[0].slice("--target=".length);
  if (targetArgs.length > 1 || !["local", "neon"].includes(name)
      || args.filter((arg) => arg === "--preflight").length > 1
      || args.some((arg) => arg !== `--target=${name}` && !(allowPreflight && arg === "--preflight"))) {
    throw new Error("시드 인자는 --target=local 또는 --target=neon과 확인용 --preflight만 허용합니다.");
  }
  const envName = name === "local" ? "LOCAL_DATABASE_URL" : "NEON_DATABASE_URL";
  if (typeof environment[envName] !== "string" || environment[envName].length === 0) {
    throw new Error(`${envName} 설정이 필요합니다.`);
  }
  return {
    name, label: name === "local" ? "로컬" : "Neon", envName,
    connectionString: name === "local" ? assertLocalSeedDatabase(environment[envName])
      : assertNeonSeedDatabase(environment[envName]),
    preflight: args.includes("--preflight"),
  };
};

export const buildSeedData = (anchorTime = new Date()) => {
  const now = new Date(anchorTime);
  if (!Number.isFinite(now.getTime())) throw new Error("시드 기준 시각이 유효하지 않습니다.");
  const today = getKoreanDate(now);
  const day = (offset) => shiftDate(today, offset);
  const instant = (offset, time) => koreanInstant(day(offset), time);
  const studies = [];
  const routines = [];
  const histories = [];
  const challenges = [];
  const reactions = [];
  const studyDates = [0, 40, 40, 40, 10, 10, 10, 10, 10, 10, 7, 1, 40];
  const names = ["숲", "공부 기록실", "가득한 루틴", "한 자리 남은 숲", "진행 타이머",
    "자정 너머", "멈춘 타이머", "완료 대기", "완료의 숲", "다시 시작", "응원 모임", "동률 응원", family.repeat(15)];
  const nicknames = ["새", "기록이", "열여덟", "열일곱", "공부벌레", "밤샘이", "잠깐쉼",
    "도착이", "완주자", "새출발", "응원이", "동점이", family.repeat(10)];
  for (let s = 1; s <= 13; s += 1) {
    studies.push({
      id: studyId(s), nickname: nicknames[s - 1], name: names[s - 1],
      introduction: s === 1 ? "쉼" : s === 11 ? "함께 공부하며 응원을 나누는 모임입니다."
        : s === 13 ? family.repeat(100) : `${STUDY_CASES[s - 1][1]} 확인용 스터디입니다.`,
      backgroundKey: SEED_BACKGROUND_KEYS[(s - 1) % SEED_BACKGROUND_KEYS.length], points: 0,
      createdAt: s === 1 ? new Date(now) : instant(-studyDates[s - 1]), updatedAt: new Date(now),
    });
  }

  const addRoutine = (s, r, name, start, end = null, rank = r) => {
    const createdAt = new Date(Math.min(now.getTime(), instant(start).getTime() + rank));
    routines.push({ id: routineId(s, r), studyId: studyId(s), name,
      startsOn: calendarDate(day(start)), endsOn: end === null ? null : calendarDate(day(end)),
      createdAt, updatedAt: end === null ? new Date(createdAt)
        : new Date(Math.min(now.getTime(), Math.max(createdAt.getTime(), instant(end).getTime() + 1000))),
    });
  };
  // S02: 활성 4개·종료 4개. 최근 7일과 겹치지 않는 습관도 포함한다.
  [["매일 읽기", -14, null], ["체크 해제", -14, null], ["오늘부터", 0, null],
    ["중간에 시작", -2, null], ["이틀 전 종료", -14, -2], ["당일 완료 후 종료", 0, 0],
    ["지난달 습관", -30, -20], ["조회 첫날 종료", -10, -6]]
    .forEach(([name, start, end], i) => addRoutine(2, i + 1, name, start, end));
  for (let r = 1; r <= 20; r += 1) {
    const name = r === 1 ? "물" : r === 2 ? family.repeat(20)
      : r === 3 ? "가".repeat(20) : `상한 습관 ${r}`;
    const end = r <= 18 ? null : r === 19 ? -2 : -1;
    addRoutine(3, r, name, -14, end, r <= 2 ? 1 : r);
  }
  for (let r = 1; r <= 19; r += 1) addRoutine(4, r, `추가 가능 ${r}`, -10, r <= 17 ? null : -1);
  addRoutine(5, 1, "타이머 전 읽기", -3);
  addRoutine(5, 2, "마무리 정리", -3);
  for (let r = 1; r <= 3; r += 1) addRoutine(13, r, `연결 삭제 ${r}`, -7, r === 3 ? -1 : null);

  const addHistory = (s, r, offset, completed, at = null) => {
    const routine = routines.find((row) => row.id === routineId(s, r));
    const createdAt = at ?? new Date(Math.min(now.getTime(),
      Math.max(routine.createdAt.getTime(), instant(offset, "12:00:00.000").getTime())));
    histories.push({ routineId: routine.id, recordDate: calendarDate(day(offset)), completed,
      createdAt, updatedAt: new Date(Math.min(now.getTime(), createdAt.getTime() + (completed ? 0 : 1))),
    });
  };
  for (let offset = -6; offset <= 0; offset += 1) {
    addHistory(2, 1, offset, true, offset === -2 ? instant(-2, "23:59:59.999")
      : offset === -1 ? instant(-1) : null);
  }
  addHistory(2, 2, -1, true, instant(-1, "08:59:59.999"));
  addHistory(2, 2, 0, false);
  addHistory(2, 4, -2, true);
  addHistory(2, 4, -1, false, instant(-1, "09:00:00.000"));
  addHistory(2, 4, 0, true);
  [[-6, true], [-3, false], [-2, true]].forEach(([d, done]) => addHistory(2, 5, d, done));
  // 한국 자정 직후 실행해도 생성→체크→종료에 미래 시각을 만들지 않는다.
  addHistory(2, 6, 0, true, routines.find((row) => row.id === routineId(2, 6)).createdAt);
  [[-22, true], [-21, false], [-20, true]].forEach(([d, done]) => addHistory(2, 7, d, done));
  addHistory(2, 8, -6, false);
  for (let r = 1; r <= 6; r += 1) {
    addHistory(3, r, -1, true);
    // 6번은 어제 체크했어도 오늘 기록 행이 없다. 자정 초기화가 과거 행 삭제가 아님을 확인한다.
    addHistory(3, r, r === 6 ? -2 : 0, r % 2 === 1 || r === 6);
  }
  for (let r = 1; r <= 4; r += 1) {
    addHistory(4, r, -1, true); addHistory(4, r, 0, false);
  }
  for (let r = 1; r <= 2; r += 1) {
    addHistory(5, r, -1, r === 1); addHistory(5, r, 0, r === 1);
  }
  for (let r = 1; r <= 3; r += 1) {
    addHistory(13, r, -3, true); addHistory(13, r, -1, false);
  }
  // 종료일의 체크 이력을 보존하고 종료 updatedAt은 마지막 기록 수정 이후로 둔다.
  for (const routine of routines.filter((row) => row.endsOn !== null)) {
    const lastUpdate = histories.filter((row) => row.routineId === routine.id)
      .reduce((last, row) => Math.max(last, row.updatedAt.getTime()), routine.updatedAt.getTime());
    routine.updatedAt = new Date(lastUpdate);
  }

  const addChallenge = (s, c, status, goalMinutes, elapsedMilliseconds, createdAt, lastStartedAt = null) => {
    challenges.push({ id: challengeId(s, c), studyId: studyId(s), status, goalMinutes,
      elapsedMilliseconds, createdAt, lastStartedAt,
      awardedPoints: status === "COMPLETED" ? Math.floor(goalMinutes / 10) + 3 : 0,
    });
  };
  const completed = (s, c, minutes, offset) => addChallenge(s, c, "COMPLETED", minutes, minutes * MINUTE, instant(offset));
  completed(5, 1, 10, -5); completed(5, 2, 20, -4);
  addChallenge(5, 3, "RUNNING", 180, 5 * MINUTE, new Date(now.getTime() - 6 * MINUTE), new Date(now.getTime() - MINUTE));
  completed(6, 1, 25, -5);
  // 전날 한국 21시 시작·180분 목표. 오늘 0시에 도달해도 미완료·미지급 상태다.
  addChallenge(6, 2, "RUNNING", 180, 0, instant(-1, "21:00:00.000"), instant(-1, "21:00:00.000"));
  completed(7, 1, 10, -5);
  addChallenge(7, 2, "PAUSED", 25, 7 * MINUTE, instant(-1, "22:00:00.000"));
  addChallenge(8, 1, "PAUSED", 10, 10 * MINUTE, instant(-1, "22:00:00.000"));
  [10, 20, 25, 180].forEach((minutes, i) => completed(9, i + 1, minutes, -5 + i));
  addChallenge(10, 1, "RESET", 25, 13 * MINUTE, instant(-2));
  addChallenge(10, 2, "RESET", 30, 17 * MINUTE, instant(-1));
  completed(13, 1, 180, -3);
  addChallenge(13, 2, "RESET", 10, 2 * MINUTE, instant(-1));
  for (const study of studies) {
    study.points = challenges.filter((row) => row.studyId === study.id)
      .reduce((sum, row) => sum + row.awardedPoints, 0);
  }

  const addReactions = (s, emoji, count, firstAt) => {
    for (let b = 1; b <= count; b += 1) reactions.push({ studyId: studyId(s),
      browserId: browserId(b), emoji, createdAt: new Date(firstAt.getTime() + (b - 1) * MINUTE),
    });
  };
  addReactions(2, "🔥", 1, instant(-4, "12:00:00.000"));
  [5, 4, 3, 3].forEach((count, i) => addReactions(11, SEED_EMOJIS[i], count,
    new Date(instant(-1, "08:00:00.000").getTime() + i * 10 * MINUTE)));
  SEED_EMOJIS.forEach((emoji) => addReactions(12, emoji, 2, instant(-1, "12:00:00.000")));
  addReactions(13, "🔥", 2, instant(-2, "12:00:00.000"));
  addReactions(13, "👏", 1, instant(-2, "12:10:00.000"));
  return { anchorTime: now, today, weekStart: day(-6), studies, routines, histories, challenges, reactions };
};

// 삽입 전과 읽기 전용 확인에 쓰는 무결성 검사. 기존 데이터와의 일치 비교는 하지 않는다.
export const validateSeedRows = (data, referenceTime) => {
  const fail = (condition, message) => { if (!condition) throw new Error(message); };
  const limit = new Date(referenceTime).getTime();
  const validTime = (value) => value instanceof Date && Number.isFinite(value.getTime()) && value.getTime() <= limit;
  const validDate = (value) => value instanceof Date && Number.isFinite(value.getTime())
    && value.toISOString().endsWith("T00:00:00.000Z");
  const validText = (text, max) => typeof text === "string" && text === text.trim()
    && [...segmenter.segment(text)].length >= 1 && [...segmenter.segment(text)].length <= max;
  const unique = (rows, key) => new Set(rows.map(key)).size === rows.length;
  const groups = { Study: data.studies, Routine: data.routines, RoutineHistory: data.histories,
    Challenge: data.challenges, Reaction: data.reactions };
  for (const [name, rows] of Object.entries(groups)) {
    fail(rows.length === EXPECTED_COUNTS[name], `${name} 시드 행 수가 맞지 않습니다.`);
    for (const row of rows) {
      fail(validTime(row.createdAt), `${name} 생성 시각이 유효하지 않습니다.`);
      if (row.updatedAt) fail(validTime(row.updatedAt) && row.updatedAt >= row.createdAt,
        `${name} 수정 시각이 유효하지 않습니다.`);
    }
  }
  fail(unique(data.studies, (r) => r.id) && unique(data.routines, (r) => r.id)
    && unique(data.challenges, (r) => r.id), "시드 UUID가 중복되었습니다.");
  fail(unique(data.histories, (r) => `${r.routineId}/${dateString(r.recordDate)}`), "습관 기록 키가 중복되었습니다.");
  fail(unique(data.reactions, (r) => `${r.studyId}/${r.browserId}/${r.emoji}`), "응원 키가 중복되었습니다.");
  const studies = new Map(data.studies.map((r) => [r.id, r]));
  const routines = new Map(data.routines.map((r) => [r.id, r]));
  for (const row of data.studies) {
    fail(validText(row.nickname, 10) && validText(row.name, 15) && validText(row.introduction, 100), "스터디 그래핌 범위가 맞지 않습니다.");
    fail(SEED_BACKGROUND_KEYS.includes(row.backgroundKey) && Number.isInteger(row.points) && row.points >= 0, "스터디 배경 또는 총점이 유효하지 않습니다.");
    const owned = data.challenges.filter((c) => c.studyId === row.id);
    fail(row.points === owned.reduce((sum, c) => sum + c.awardedPoints, 0), "스터디 총점과 지급량 합계가 다릅니다.");
    fail(owned.filter((c) => ["RUNNING", "PAUSED"].includes(c.status)).length <= 1, "활성 집중이 중복되었습니다.");
    fail(data.routines.filter((r) => r.studyId === row.id && r.endsOn === null).length <= 18, "활성 습관이 18개를 넘습니다.");
  }
  for (const row of [...data.routines, ...data.challenges, ...data.reactions]) {
    fail(studies.has(row.studyId) && studies.get(row.studyId).createdAt <= row.createdAt, "스터디 관계 또는 생성 순서가 유효하지 않습니다.");
  }
  for (const row of data.routines) {
    fail(validText(row.name, 20) && validDate(row.startsOn)
      && (row.endsOn === null || (validDate(row.endsOn) && row.endsOn >= row.startsOn)), "습관 이름 또는 기간이 유효하지 않습니다.");
    fail(getKoreanDate(row.createdAt) === dateString(row.startsOn), "습관 생성일이 한국 날짜와 다릅니다.");
    if (row.endsOn) fail(getKoreanDate(row.updatedAt) === dateString(row.endsOn), "습관 종료일이 한국 날짜와 다릅니다.");
  }
  for (const row of data.histories) {
    const routine = routines.get(row.routineId);
    fail(routine && validDate(row.recordDate) && row.recordDate >= routine.startsOn
      && (routine.endsOn === null || row.recordDate <= routine.endsOn), "습관 기록이 사용 기간을 벗어났습니다.");
    fail(typeof row.completed === "boolean" && row.createdAt >= routine.createdAt
      && getKoreanDate(row.createdAt) === dateString(row.recordDate)
      && getKoreanDate(row.updatedAt) === dateString(row.recordDate), "습관 기록의 한국 날짜가 맞지 않습니다.");
  }
  for (const row of data.challenges) {
    const goal = row.goalMinutes * MINUTE;
    fail(Number.isInteger(row.goalMinutes) && row.goalMinutes >= 10 && row.goalMinutes <= 180
      && Number.isInteger(row.elapsedMilliseconds) && row.elapsedMilliseconds >= 0
      && row.elapsedMilliseconds <= goal, "집중 목표 또는 경과가 유효하지 않습니다.");
    fail(["RUNNING", "PAUSED", "COMPLETED", "RESET"].includes(row.status)
      && (row.status === "RUNNING" ? validTime(row.lastStartedAt) && row.lastStartedAt >= row.createdAt
        : row.lastStartedAt === null), "집중 상태와 시작 시각이 맞지 않습니다.");
    fail(row.status === "COMPLETED"
      ? row.elapsedMilliseconds === goal && row.awardedPoints === Math.floor(row.goalMinutes / 10) + 3
      : row.awardedPoints === 0, "집중 완료 지급 규칙이 맞지 않습니다.");
  }
  for (const row of data.reactions) fail(SEED_EMOJIS.includes(row.emoji), "시드 응원 이모지가 유효하지 않습니다.");
};
