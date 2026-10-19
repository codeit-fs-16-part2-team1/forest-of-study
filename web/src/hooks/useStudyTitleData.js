import { useCallback, useEffect, useState } from "react";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";

export const useStudyTitleData = (studyId, pathname = "") => {
  const [result, setResult] = useState(null);

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
    if (!studyId) return;

    let ignore = false;

    const fetchStudy = async () => {
      try {
        const { data } = await studyApi.getDetail(studyId);

        if (ignore) return;

        setResult({
          studyId,
          pathname,
          study: data,
          error: null,
        });
      } catch (error) {
        if (ignore) return;

        setResult({
          studyId,
          pathname,
          study: null,
          error: getApiError(error),
        });
      }
    };

    fetchStudy();

    return () => {
      ignore = true;
    };
  }, [studyId, pathname]);

  if (!studyId) {
    return {
      study: null,
      isLoading: false,
      error: null,
      updateReactions,
    };
  }

  const isCurrent =
    result?.studyId === studyId &&
    result?.pathname === pathname;

  if (!isCurrent) {
    return {
      study: null,
      isLoading: true,
      error: null,
      updateReactions,
    };
  }

  return {
    study: result.study,
    isLoading: false,
    error: result.error,
    updateReactions,
  };
};
