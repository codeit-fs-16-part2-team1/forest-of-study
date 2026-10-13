import { prepareRoutineTestStudy } from "../src/services/routineService.js";

try {
  const study = await prepareRoutineTestStudy();
  console.log(`습관 테스트 스터디 준비 완료: ${study.id}`);
  console.log("api/requests/routine.http의 studyId로 사용하세요.");
} catch {
  console.error(
    "테스트 스터디 준비 실패: bcrypt 설치, DB 연결 설정과 migration 적용 여부를 확인해주세요.",
  );
  process.exitCode = 1;
}