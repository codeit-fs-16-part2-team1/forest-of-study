import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";

export const StudyPasswordContext = createContext(null);

// App에서 스터디 ID를 key로 사용한다. 같은 스터디의 내부 이동에서만 유지한다.
const StudyPasswordProvider = ({ studyId, children }) => {
  const memoryRef = useRef({ password: null, generation: 0 });
  const [revision, setRevision] = useState(0);

  const getSnapshot = useCallback(() => ({ studyId, ...memoryRef.current }), [studyId]);

  const rememberPassword = useCallback((password, generation) => {
    if (!studyId || memoryRef.current.generation !== generation) return false;
    memoryRef.current.password = password;
    return true;
  }, [studyId]);

  const clearPassword = useCallback((generation) => {
    const memory = memoryRef.current;
    // 이전 화면의 실패 응답은 새로 확인한 비밀번호를 폐기할 수 없다.
    if (generation !== undefined && memory.generation !== generation) return false;
    memory.password = null;
    memory.generation += 1;
    setRevision(memory.generation);
    return true;
  }, []);

  useEffect(() => {
    const handlePageHide = () => clearPassword();
    const handlePageShow = (event) => {
      if (event.persisted) clearPassword();
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      memoryRef.current.password = null;
      memoryRef.current.generation += 1;
    };
  }, [clearPassword]);

  const value = useMemo(() => ({
    studyId, revision, getSnapshot, rememberPassword, clearPassword,
  }), [studyId, revision, getSnapshot, rememberPassword, clearPassword]);

  return <StudyPasswordContext.Provider value={value}>{children}</StudyPasswordContext.Provider>;
};

export default StudyPasswordProvider;
