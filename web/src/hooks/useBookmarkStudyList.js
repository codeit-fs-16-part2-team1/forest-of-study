import { useEffect, useState } from "react";
import useBookmarkStudies from "./useBookmarkStudies.js";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { pruneBookmarkStudies } from "../utils/bookmarkStudies.js";

const useBookmarkStudyList = () => {
  const ids = useBookmarkStudies();
  const idsKey = ids.join(",");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ studies: [], isLoading: true, error: "" });

  useEffect(() => {
    let ignore = false;
    const requestedIds = idsKey ? idsKey.split(",") : [];
    if (requestedIds.length === 0) {
      setResult({ studies: [], isLoading: false, error: "" });
      return;
    }
    const load = async () => {
      setResult((previous) => ({ ...previous, isLoading: true, error: "" }));
      try {
        const { data } = await studyApi.getByIds(requestedIds);
        if (ignore) return;
        const byId = new Map(data.map((study) => [study.id.toLowerCase(), study]));
        const studies = requestedIds.filter((id) => byId.has(id)).map((id) => byId.get(id));
        pruneBookmarkStudies(requestedIds, studies.map(({ id }) => id));
        setResult({ studies, isLoading: false, error: "" });
      } catch (error) {
        if (!ignore) setResult({ studies: [], isLoading: false, error: getApiError(error).message });
      }
    };
    load();
    return () => { ignore = true; };
  }, [idsKey, revision]);

  // 해제된 카드는 새 응답을 기다리지 않고 제외한다.
  const studies = ids.flatMap((id) => result.studies.filter((study) => study.id.toLowerCase() === id));
  return { ...result, studies, isLoading: ids.length > 0 && result.isLoading, retry: () => setRevision((value) => value + 1) };
};

export default useBookmarkStudyList;
