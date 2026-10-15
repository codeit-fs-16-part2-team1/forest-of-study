import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { createApiError } from "../utils/apiError.js";
import { isValidUuid } from "../utils/uuid.js";
import { validateStudyPassword } from "../schemas/studyPassword.js";

// 진입 확인과 보호 요청이 같은 검증을 사용한다. 성공을 저장하거나 재사용하지 않는다.
export const checkStudyPassword = async (studyId, password) => {
  if (!isValidUuid(studyId)) {
    throw createApiError("VALIDATION_ERROR");
  }

  if (password === undefined) {
    throw createApiError("VERIFICATION_REQUIRED");
  }

  const passwordResult = validateStudyPassword(password);
  if (!passwordResult.success) {
    throw createApiError("VALIDATION_ERROR");
  }

  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { passwordHash: true },
  });

  if (study === null) {
    throw createApiError("STUDY_NOT_FOUND");
  }

  const matches = await bcrypt.compare(passwordResult.data, study.passwordHash);
  if (!matches) {
    throw createApiError("PASSWORD_MISMATCH");
  }

  return { verified: true };
};
