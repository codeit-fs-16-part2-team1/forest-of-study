import { checkStudyPassword } from "../services/studyPassword.js";

// 보호 라우트에서 서비스 호출보다 앞에 등록한다. req.params.studyId가 필요하다.
export const verifyStudyPassword = async (req, res, next) => {
  res.set("Cache-Control", "no-store");

  await checkStudyPassword(
    req.params.studyId,
    req.get("X-Study-Password"),
  );

  // 검증이 실패하면 위 await가 오류를 전달하므로 다음 핸들러는 실행되지 않는다.
  next();
};
