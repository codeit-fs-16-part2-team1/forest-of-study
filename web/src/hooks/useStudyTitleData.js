import { useEffect, useState } from "react";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { isValidStudyId } from "../utils/studyNavigation.js";

const emptyResult = {
  studyId: null,
  study: null,
  isLoading: false,
  error: null,
};

export const useStudyTitleData = (studyId) => {
  const [result, setResult] = useState(emptyResult);
  const [reloadCount, setReloadCount] = useState(0);
  const reloadStudy = () => setReloadCount((count) => count + 1);

  useEffect(() => {
    if (!isValidStudyId(studyId)) {
      setResult(emptyResult);
      return;
    }

    let ignore = false;
    setResult({ studyId, study: null, isLoading: true, error: null });

    const fetchStudy = async () => {
      try {
        const { data } = await studyApi.getDetail(studyId);

        if (!ignore) {
          setResult({ studyId, study: data, isLoading: false, error: null });
        }
      } catch (error) {
        if (!ignore) {
          setResult({
            studyId,
            study: null,
            isLoading: false,
            error: getApiError(error),
          });
        }
      }
    };

    fetchStudy();

    // 이미 보낸 요청은 유지하고, 이전 화면의 응답만 반영하지 않는다.
    return () => {
      ignore = true;
    };
  }, [studyId, reloadCount]);

  // Effect가 실행되기 전에도 다른 스터디의 이름을 즉시 제외한다.
  if (result.studyId !== studyId) {
    return { study: null, isLoading: isValidStudyId(studyId), error: null, reloadStudy };
  }

  return {
    study: result.study,
    isLoading: result.isLoading,
    error: result.error,
    reloadStudy,
  };
};
