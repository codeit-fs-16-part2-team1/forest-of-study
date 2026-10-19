import { useEffect, useState } from "react";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";

export const useStudyTitleData = (studyId, pathname = "") => {
  const [result, setResult] = useState(null);

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
    };
  }

  return {
    study: result.study,
    isLoading: false,
    error: result.error,
  };
};