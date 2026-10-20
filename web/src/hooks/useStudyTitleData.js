import { useCallback, useEffect, useState } from "react";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { isValidStudyId } from "../utils/studyNavigation.js";

export const useStudyTitleData = (studyId, pathname = "") => {
  const [result, setResult] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);
  const reloadStudy = useCallback(() => setReloadCount((count) => count + 1), []);

  // 등록 응답의 집계만 바꾸고 상세 조회의 나머지 데이터는 보존한다.
  const updateReactions = useCallback((reactions) => {
    setResult((previous) => {
      if (previous?.studyId !== studyId || previous?.pathname !== pathname
        || !previous.study) {
        return previous;
      }

      return {
        ...previous,
        study: { ...previous.study, reactions },
      };
    });
  }, [studyId, pathname]);

  useEffect(() => {
    if (!isValidStudyId(studyId)) return;

    let ignore = false;

    const fetchStudy = async () => {
      try {
        const { data } = await studyApi.getDetail(studyId);

        if (ignore) return;

        setResult({
          studyId,
          pathname,
          reloadCount,
          study: data,
          error: null,
        });
      } catch (error) {
        if (ignore) return;

        setResult({
          studyId,
          pathname,
          reloadCount,
          study: null,
          error: getApiError(error),
        });
      }
    };

    fetchStudy();

    return () => {
      ignore = true;
    };
  }, [studyId, pathname, reloadCount]);

  if (!studyId) {
    return {
      study: null,
      isLoading: false,
      error: null,
      updateReactions,
      reloadStudy,
    };
  }

  if (!isValidStudyId(studyId)) {
    return {
      study: null,
      isLoading: false,
      error: { status: 400, code: "VALIDATION_ERROR", message: "스터디 ID 형식이 올바르지 않습니다." },
      updateReactions,
      reloadStudy,
    };
  }

  const isCurrent =
    result?.studyId === studyId &&
    result?.pathname === pathname &&
    result?.reloadCount === reloadCount;

  if (!isCurrent) {
    return {
      study: null,
      isLoading: true,
      error: null,
      updateReactions,
      reloadStudy,
    };
  }

  return {
    study: result.study,
    isLoading: false,
    error: result.error,
    updateReactions,
    reloadStudy,
  };
};
