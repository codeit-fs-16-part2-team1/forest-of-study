import { useEffect, useState } from "react";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { readRecentStudyIds, pruneRecentStudies, RECENT_STUDIES_KEY } from "../utils/recentStudies.js";

const useRecentStudies = () => {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ studies: [], isLoading: true, error: "" });

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === RECENT_STUDIES_KEY || event.key === null) {
        setRevision((value) => value + 1);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    let ignore = false;
    const ids = readRecentStudyIds();

    const load = async () => {
      if (ids.length === 0) {
        setResult({ studies: [], isLoading: false, error: "" });
        return;
      }

      setResult({ studies: [], isLoading: true, error: "" });
      try {
        const { data } = await studyApi.getByIds(ids);
        if (ignore) return;

        const byId = new Map(data.map((study) => [study.id.toLowerCase(), study]));
        const studies = ids.filter((id) => byId.has(id)).map((id) => byId.get(id));
        // 정상 응답에서 존재하지 않는 것으로 확인된 ID만 정리한다.
        pruneRecentStudies(ids, studies.map(({ id }) => id));
        setResult({ studies, isLoading: false, error: "" });
      } catch (error) {
        if (ignore) return;
        // 통신 실패는 삭제의 근거가 아니므로 저장 ID를 유지한다.
        setResult({ studies: [], isLoading: false, error: getApiError(error).message });
      }
    };

    load();
    return () => { ignore = true; };
  }, [revision]);

  return { ...result, retry: () => setRevision((value) => value + 1) };
};

export default useRecentStudies;
