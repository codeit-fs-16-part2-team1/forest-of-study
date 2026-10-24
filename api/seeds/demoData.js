// 시연 전용 고정 프로필. 실행일의 한국 날짜를 기준으로 과거 활동을 구성한다.
// DB 연결은 하지 않으며 testData.js의 데이터 구성은 변경하지 않는다.
import assert from "node:assert/strict";
import { dateString, getKoreanDate, koreanInstant, shiftDate } from "./testData.js";

const MINUTE = 60_000;
const uuid = (kind, number) => `${kind}0000000-0000-4000-9000-${String(number).padStart(12, "0")}`;
export const demoStudyId = (number) => uuid(5, number);
const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });
const backgrounds = ["green", "image1", "yellow", "image2", "blue", "image3", "pink", "image4"];
const colors = ["#dcefe3", "#dde5d5", "#ddecf7", "#dfe7ee", "#e8dff2", "#eee5f4", "#f3dfe5", "#f6e1d5", "#f5edcd", "#f4eedc"];
const patterns = ["dots", "waves", "stripes", "leaves", "paper"];

// days: 생성 후 지난 날짜 수. cadence: daily / weekday / weekend / returning / gentle.
export const DEMO_PROFILES = [
  { nickname: "모닝루틴", name: "출근 전 한 시간", days: 75, cadence: "weekday", rate: 88,
    introduction: "출근 전에 딱 한 시간만 제 공부를 해보려고요. 늦잠 잔 날도 다음 날 다시 옵니다.",
    routines: ["영어 단어 20개", "전공서 10쪽", "어제 배운 것 복습", "오늘 할 일 적기"] },
  { nickname: "퇴근한개발자", name: "퇴근 후 커밋", days: 48, cadence: "weekday", rate: 72,
    introduction: "퇴근하면 소파부터 찾는 개발자입니다. 작은 문제 하나라도 풀고 노트북을 닫으려 해요.",
    routines: ["알고리즘 한 문제", "공식 문서 읽기", "배운 내용 기록", "어제 코드 복습", "스트레칭 5분"], paused: true },
  { nickname: "해봄", name: "다시 시작하는 수학", days: 32, cadence: "returning", rate: 78,
    introduction: "한동안 놓았던 수학을 다시 펼쳤어요. 모르는 문제가 나와도 일단 끝까지 생각해 보기.",
    routines: ["개념 강의 한 편", "예제 세 문제", "오답 다시 풀기"] },
  { nickname: "단단", name: "공시생의 작은 숲", days: 120, cadence: "daily", rate: 92,
    introduction: "매일 같은 자리에서 조금씩 쌓는 중. 점수에 흔들리기보다 오늘의 분량을 지키겠습니다.",
    routines: ["국어 기출 20문제", "영어 단어 복습", "한국사 기출", "행정법 판례", "행정학 개념", "오답 노트", "저녁 암기 점검", "하루 공부 정리", "아침 복습", "취침 전 스트레칭"] },
  { nickname: "페이지", name: "하루 스무 쪽", days: 66, cadence: "daily", rate: 83,
    introduction: "책장에 꽂아 둔 책들을 천천히 읽습니다. 마음에 남은 문장은 한 줄씩 옮겨 적어요.",
    routines: ["책 20쪽 읽기", "좋은 문장 옮겨 적기", "한 줄 감상"] },
  { nickname: "링고", name: "영어가 익숙해질 때", days: 24, cadence: "daily", rate: 79,
    introduction: "잘하는 것보다 익숙해지는 게 먼저라고 생각해요. 오늘도 소리 내서 영어 한 문장!",
    routines: ["출근길 영어 듣기", "짧은 문장 따라 말하기", "단어 복습", "영어 일기 세 줄"] },
  { nickname: "쿼리", name: "데이터 분석 노트", days: 41, cadence: "weekday", rate: 75,
    introduction: "숫자 뒤에 있는 이야기가 궁금해서 시작했습니다. SQL과 통계를 직접 손으로 익히는 중입니다.",
    routines: ["SQL 한 문제", "통계 개념 정리", "분석 실습", "결과 해석 적기", "어제 쿼리 복습"] },
  { nickname: "연필", name: "자격증 한 걸음", days: 57, cadence: "daily", rate: 86,
    introduction: "퇴근 후 자격증 준비 중입니다. 이번에는 기출만 외우지 않고 개념도 제대로 잡아보려고요.",
    routines: ["핵심 개념 복습", "기출 한 회", "틀린 선지 정리", "암기 카드", "취약 단원 강의", "내일 분량 정하기"] },
  { nickname: "새벽별", name: "조용한 논문 시간", days: 89, cadence: "weekday", rate: 81,
    introduction: "조용한 시간에 읽고 쓰는 대학원생의 기록입니다. 한 문단이라도 어제보다 앞으로.",
    routines: ["논문 한 편 읽기", "참고 문헌 정리", "초고 한 문단", "연구 노트 적기"], paused: true },
  { nickname: "느린토끼", name: "느려도 매일", days: 105, cadence: "gentle", rate: 48,
    introduction: "빠르게 따라가지 못해도 괜찮아요. 쉬는 날이 많지만 그만두지 않는 연습을 합니다.",
    routines: ["강의 15분", "복습 노트 펼치기", "오늘 배운 것 한 줄"] },
  { nickname: "오후세시", name: "카페에서 한 챕터", days: 38, cadence: "weekend", rate: 87,
    introduction: "주말 오후 카페에서 책 읽는 시간을 좋아합니다. 커피가 식기 전에 한 챕터씩.",
    routines: ["책 한 챕터", "읽은 내용 요약", "다음 읽을 부분 표시"] },
  { nickname: "초록펜", name: "한국사 한 장씩", days: 14, cadence: "daily", rate: 76,
    introduction: "흩어져 있던 사건들이 연결되는 재미를 알아가는 중입니다. 연표부터 차근차근 정리해요.",
    routines: ["연표 한 장", "기출 10문제", "헷갈린 사건 비교", "어제 내용 말로 복습"] },
  { nickname: "버그헌터", name: "코테까지 차근차근", days: 63, cadence: "returning", rate: 71,
    introduction: "정답보다 풀이를 설명할 수 있는 사람이 목표! 잠깐 쉬었지만 하루 한 문제부터 다시 갑니다.",
    routines: ["문제 한 개 풀기", "시간 복잡도 적기", "다른 풀이 읽기", "실수 기록", "자료구조 복습"] },
  { nickname: "말랑", name: "일본어 작은 습관", days: 19, cadence: "daily", rate: 74,
    introduction: "자막 없이 좋아하는 영화를 보고 싶어서 시작했어요. 짧게라도 매일 귀를 열어두려고요.",
    routines: ["단어 10개", "짧은 청해", "문장 따라 읽기", "문법 예문 만들기"] },
  { nickname: "스케치", name: "매일 그리는 연습", days: 46, cadence: "gentle", rate: 68,
    introduction: "잘 그린 그림보다 많이 관찰한 하루를 모읍니다. 책상 위 작은 물건부터 그려봐요.",
    routines: ["크로키 10분", "사물 하나 관찰", "드로잉 한 장", "오늘 그림 돌아보기"] },
  { nickname: "차곡", name: "경제 읽는 아침", days: 28, cadence: "weekday", rate: 82,
    introduction: "경제 기사를 읽다가 모르는 단어가 너무 많아 만든 공간입니다. 오늘은 어제보다 하나 더 이해하기.",
    routines: ["경제 기사 한 편", "모르는 용어 정리", "기사 세 줄 요약", "지난 용어 복습"] },
  { nickname: "첫잎", name: "오늘부터 차근차근", days: 0, cadence: "daily", rate: 50,
    introduction: "계획만 세우다가 드디어 시작합니다. 처음부터 욕심내지 않고 두 가지만 해보려고요.",
    routines: ["책상 정리", "책 5쪽 읽기"] },
  { nickname: "새싹하나", name: "나만의 공부 자리", days: 0, cadence: "daily", rate: 0,
    introduction: "제 속도로 공부할 작은 자리를 만들었어요. 어떤 습관부터 시작할지 천천히 골라보겠습니다.",
    routines: [] },
];

const calendarDate = (date) => new Date(`${date}T00:00:00.000Z`);
const eligible = (profile, date, offset) => {
  const weekday = calendarDate(date).getUTCDay();
  if (profile.cadence === "weekday" && [0, 6].includes(weekday)) return false;
  if (profile.cadence === "weekend" && ![0, 6].includes(weekday)) return false;
  return profile.cadence !== "returning" || offset < -15 || offset > -7;
};

export const buildDemoSeedData = (anchorTime = new Date()) => {
  const anchor = new Date(anchorTime);
  assert(Number.isFinite(anchor.getTime()), "시연 기준 시각 오류");
  const today = getKoreanDate(anchor);
  const day = (offset) => shiftDate(today, offset);
  const at = (offset, hour = 9, minute = 0) => new Date(Math.min(anchor.getTime(),
    koreanInstant(day(offset), `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000`).getTime()));
  const studies = [], routines = [], histories = [], challenges = [], reactions = [];
  DEMO_PROFILES.forEach((profile, index) => {
    const number = index + 1;
    const study = { id: demoStudyId(number), nickname: profile.nickname, name: profile.name,
      introduction: profile.introduction, backgroundKey: index < 8 ? backgrounds[index] : "custom",
      backgroundColor: index < 8 ? null : colors[index - 8], textColor: null,
      patternKey: index >= 8 && index < 13 ? patterns[index - 8] : null,
      patternColor: index >= 8 && index < 13 ? "#8d9b88" : null,
      points: 0, createdAt: profile.days === 0 ? new Date(anchor) : at(-profile.days, 7), updatedAt: new Date(anchor) };
    studies.push(study);
    const routineNames = [...profile.routines];
    // 최근 종료한 습관도 보존해 주간 기록에 변화가 보이게 한다.
    if (profile.days > 30 && index % 3 === 0) routineNames.push(index === 0 ? "아침 뉴스 읽기" : "복습 카드 만들기");
    routineNames.forEach((name, r) => {
      const ended = r >= profile.routines.length;
      const start = profile.days === 0 ? 0 : -Math.min(profile.days, 45 + r);
      const end = ended ? -3 : 0;
      const createdAt = profile.days === 0 ? new Date(anchor) : at(start, 8, r);
      const routine = { id: uuid(6, number * 100 + r + 1), studyId: study.id, name,
        stickerColor: (index * 3 + r * 2) % 18 + 1, position: r + 1,
        startsOn: calendarDate(day(start)), endsOn: ended ? calendarDate(day(end)) : null,
        createdAt, updatedAt: ended ? at(end, 23, 59) : new Date(createdAt) };
      routines.push(routine);
      for (let offset = start; offset <= end; offset += 1) {
        if (index === 16 && r === 0) {
          histories.push({ routineId: routine.id, recordDate: calendarDate(today), completed: true,
            createdAt: new Date(anchor), updatedAt: new Date(anchor) });
          break;
        }
        if (profile.days === 0 || !eligible(profile, day(offset), offset)) continue;
        const score = ((offset + 150) * 37 + r * 23 + index * 11) % 100;
        const completed = score < profile.rate;
        // 미기록 날짜는 행을 만들지 않고, 일부 체크 해제 이력도 남긴다.
        if (!completed && score % 4 !== 0) continue;
        const checkedAt = new Date(Math.max(createdAt.getTime(), at(offset, 8 + (index + r) % 14, r * 7 % 60).getTime()));
        histories.push({ routineId: routine.id, recordDate: calendarDate(day(offset)), completed,
          createdAt: checkedAt, updatedAt: new Date(checkedAt) });
      }
    });
    let sequence = 0;
    const addChallenge = (status, minutes, offset, session = 0) => {
      sequence += 1;
      const createdAt = at(offset, 9 + session * 3, index % 30);
      const awardedPoints = status === "COMPLETED" ? Math.floor(minutes / 10) + 3 : 0;
      challenges.push({ id: uuid(7, number * 10000 + sequence), studyId: study.id, status,
        goalMinutes: minutes, elapsedMilliseconds: (status === "COMPLETED" ? minutes : status === "PAUSED" ? 7 : 4) * MINUTE,
        lastStartedAt: null, awardedPoints, createdAt });
      study.points += awardedPoints;
    };
    // 목표 시간만큼 실제 시간이 지난 과거 날짜에만 완료 이력을 둔다.
    for (let offset = -profile.days + 1; offset < 0; offset += 1) {
      if (!eligible(profile, day(offset), offset)) continue;
      const score = ((offset + 160) * 19 + index * 13) % 100;
      if (score >= profile.rate) continue;
      const minutes = index === 8 ? [50, 90, 120][(offset + 160) % 3]
        : [25, 50, 25, 10, 30][(offset + 160 + index) % 5];
      addChallenge(score % 13 === 0 ? "RESET" : "COMPLETED", minutes, offset);
      if (index === 3 || (index === 0 && score % 3 === 0)) addChallenge("COMPLETED", 50, offset, 1);
    }
    if (profile.paused) addChallenge("PAUSED", index === 8 ? 90 : 25, -1, 2);
    if (profile.days > 0) {
      const emojis = ["🔥", "👏", "💪", "🌱", "✨", "📚", "❤️"];
      const kinds = 2 + index % 5;
      for (let e = 0; e < kinds; e += 1) {
        const count = Math.max(1, Math.floor(profile.days / (5 + e * 3)) + (index * 3 + e) % 5);
        for (let b = 0; b < count; b += 1) {
          const offset = -Math.max(1, Math.floor(profile.days * (b + 1) / (count + 1)));
          reactions.push({ studyId: study.id, browserId: uuid(8, b + 1), emoji: emojis[(index + e) % emojis.length],
            createdAt: at(offset, 10 + e, b % 60) });
        }
      }
    }
  });
  return { anchorTime: anchor, today, studies, routines, histories, challenges, reactions };
};

export const demoCounts = (data) => Object.fromEntries([
  ["Study", data.studies.length], ["Routine", data.routines.length], ["RoutineHistory", data.histories.length],
  ["Challenge", data.challenges.length], ["Reaction", data.reactions.length],
]);

export const validateDemoSeedData = (data) => {
  const limit = data.anchorTime.getTime();
  const validTime = (value) => value instanceof Date && Number.isFinite(value.getTime()) && value.getTime() <= limit;
  const text = (value, max) => typeof value === "string" && value === value.trim()
    && [...segmenter.segment(value)].length >= 1 && [...segmenter.segment(value)].length <= max;
  const unique = (rows, key) => assert.equal(new Set(rows.map(key)).size, rows.length, "시연 키 중복");
  const hex = (value) => /^#[0-9a-f]{6}$/.test(value);
  // DATE는 한국 달력 날짜를 UTC 자정으로 표현하므로 실제 시각과 비교하지 않는다.
  const date = (value) => value instanceof Date && Number.isFinite(value.getTime())
    && value.toISOString().endsWith("T00:00:00.000Z") && dateString(value) <= data.today;
  assert.equal(data.studies.length, 18);
  assert.equal(data.today, getKoreanDate(data.anchorTime));
  for (const rows of [data.studies, data.routines, data.histories, data.challenges, data.reactions]) {
    for (const row of rows) {
      assert(validTime(row.createdAt), "시연 생성 시각 오류");
      if (row.updatedAt) assert(validTime(row.updatedAt) && row.updatedAt >= row.createdAt, "시연 수정 시각 오류");
    }
  }
  unique(data.studies, (r) => r.id);
  unique(data.studies, (r) => `${r.nickname}/${r.name}`);
  unique(data.routines, (r) => r.id);
  unique(data.challenges, (r) => r.id);
  unique(data.histories, (r) => `${r.routineId}/${dateString(r.recordDate)}`);
  unique(data.reactions, (r) => `${r.studyId}/${r.browserId}/${r.emoji}`);
  const studies = new Map(data.studies.map((r) => [r.id, r]));
  const routines = new Map(data.routines.map((r) => [r.id, r]));
  for (const study of data.studies) {
    assert(text(study.nickname, 10) && text(study.name, 15) && text(study.introduction, 100));
    assert.equal(study.textColor, null);
    if (study.backgroundKey === "custom") {
      assert(hex(study.backgroundColor));
      assert(study.patternKey === null ? study.patternColor === null
        : patterns.includes(study.patternKey) && hex(study.patternColor));
    } else {
      assert(backgrounds.includes(study.backgroundKey));
      assert(study.backgroundColor === null && study.patternKey === null && study.patternColor === null);
    }
    const owned = data.challenges.filter((r) => r.studyId === study.id);
    assert.equal(study.points, owned.reduce((sum, row) => sum + row.awardedPoints, 0));
    assert(owned.filter((r) => ["RUNNING", "PAUSED"].includes(r.status)).length <= 1);
    const active = data.routines.filter((r) => r.studyId === study.id && r.endsOn === null);
    assert(active.length <= 10);
    assert.deepEqual(active.map((r) => r.position).sort((a, b) => a - b), active.map((_, i) => i + 1));
  }
  for (const row of [...data.routines, ...data.challenges, ...data.reactions]) {
    assert(studies.has(row.studyId) && row.createdAt >= studies.get(row.studyId).createdAt, "시연 소속/생성 순서 오류");
  }
  for (const row of data.routines) {
    assert(text(row.name, 20) && Number.isInteger(row.stickerColor) && row.stickerColor >= 1 && row.stickerColor <= 18);
    assert(Number.isInteger(row.position) && row.position >= 1);
    assert(date(row.startsOn) && dateString(row.startsOn) === getKoreanDate(row.createdAt));
    if (row.endsOn) assert(date(row.endsOn) && row.endsOn >= row.startsOn
      && dateString(row.endsOn) === getKoreanDate(row.updatedAt));
  }
  for (const row of data.histories) {
    const routine = routines.get(row.routineId);
    assert(routine && date(row.recordDate) && row.recordDate >= routine.startsOn
      && (routine.endsOn === null || row.recordDate <= routine.endsOn));
    assert(typeof row.completed === "boolean" && row.createdAt >= routine.createdAt
      && getKoreanDate(row.createdAt) === dateString(row.recordDate)
      && getKoreanDate(row.updatedAt) === dateString(row.recordDate));
  }
  for (const row of data.challenges) {
    assert(Number.isInteger(row.goalMinutes) && row.goalMinutes >= 10 && row.goalMinutes <= 180);
    assert(Number.isInteger(row.elapsedMilliseconds) && row.elapsedMilliseconds >= 0
      && row.elapsedMilliseconds <= row.goalMinutes * MINUTE);
    assert(["COMPLETED", "RESET", "PAUSED"].includes(row.status) && row.lastStartedAt === null);
    assert.equal(row.awardedPoints, row.status === "COMPLETED" ? Math.floor(row.goalMinutes / 10) + 3 : 0);
    if (row.status === "COMPLETED") {
      assert.equal(row.elapsedMilliseconds, row.goalMinutes * MINUTE);
      assert(row.createdAt.getTime() + row.elapsedMilliseconds <= limit);
    }
  }
  assert.equal(data.challenges.filter((r) => r.status === "PAUSED").length, 2);
  assert.equal(data.histories.filter((r) => r.routineId === uuid(6, 1701) && r.completed).length, 1);
  assert.equal(data.routines.filter((r) => r.studyId === demoStudyId(18)).length, 0);
};

// DB 없는 사전 검사. 한국 자정·요일·월말·연말·윤일 경계에서도 구성을 검사한다.
export const checkDemoSeedPreflight = () => {
  for (const instant of ["2026-10-22T14:59:59.999Z", "2026-10-22T15:00:00.000Z",
    "2026-10-25T15:00:00.000Z", "2026-10-31T15:00:00.000Z", "2026-12-31T15:00:00.000Z",
    "2028-02-28T15:00:00.000Z", new Date().toISOString()]) {
    const data = buildDemoSeedData(new Date(instant));
    validateDemoSeedData(data);
    assert.deepEqual(data, buildDemoSeedData(new Date(instant)), "같은 기준 시각에서 구성이 달라졌습니다.");
  }
};
