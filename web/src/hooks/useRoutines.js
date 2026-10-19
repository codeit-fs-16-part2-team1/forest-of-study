import { useEffect, useRef, useState } from "react";
import { routineApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";

const useRoutines = (studyId, verifiedPassword, onRoutineError) => {
  const [routineData, setRoutineData] = useState(null);
  const [isLoadingRoutines, setIsLoadingRoutines] = useState(true);
  const [routineError, setRoutineError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [pendingRoutineIds, setPendingRoutineIds] = useState([]);
  const isPageActiveRef = useRef(true);

  useEffect(() => {
    isPageActiveRef.current = true;

    return () => {
      isPageActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    // 비밀번호 검증 전에는 목록을 요청하지 않습니다.
    if (!studyId || verifiedPassword === null) return;

    let ignore = false;

    const fetchRoutines = async () => {
      setIsLoadingRoutines(true);
      setRoutineError("");
      setRoutineData(null);

      try {
        const { data } = await routineApi.getList(studyId, verifiedPassword);

        if (!ignore) {
          setRoutineData(data);
        }
      } catch (error) {
        if (!ignore) {
          setRoutineError(getApiError(error).message);
        }
      } finally {
        if (!ignore) {
          setIsLoadingRoutines(false);
        }
      }
    };

    fetchRoutines();

    return () => {
      ignore = true;
    };
  }, [studyId, verifiedPassword, reloadCount]);

  const reloadRoutines = () => {
    setReloadCount((count) => count + 1);
  };

  const saveRoutines = async (changes) => {
    if (!studyId || verifiedPassword === null || pendingRoutineIds.length > 0) {
      return false;
    }

    try {
      const { data } = await routineApi.saveBatch(studyId, changes, verifiedPassword);
      if (!isPageActiveRef.current) return false;

      // 저장과 같은 트랜잭션에서 조회한 목록으로 교체한다.
      setRoutineData(data);
      return true;
    } catch (error) {
      if (isPageActiveRef.current) onRoutineError?.(getApiError(error));
      return false;
    }
  };

  const handleToggleRoutine = async (routine) => {
    if (
      !routineData ||
      verifiedPassword === null ||
      pendingRoutineIds.includes(routine.id)
    ) {
      return;
    }

    setPendingRoutineIds((ids) => [...ids, routine.id]);

    try {
      const { data } = await routineApi.setCompleted(
        studyId,
        routine.id,
        {
          recordDate: routineData.recordDate,
          completed: !routine.completed,
        },
        verifiedPassword,
      );

      if (!isPageActiveRef.current) return;

      setRoutineData((previous) => {
        // 재조회 중이거나 목록의 날짜가 바뀌었다면 반영하지 않습니다.
        if (!previous || previous.recordDate !== data.recordDate) {
          return previous;
        }

        return {
          ...previous,
          routines: previous.routines.map((item) =>
            item.id === data.routineId
              ? { ...item, completed: data.completed }
              : item,
          ),
        };
      });
    } catch (error) {
      if (!isPageActiveRef.current) return;
      const apiError = getApiError(error);

      onRoutineError?.(apiError);

      if (apiError.code === "DATE_CHANGED") {
        reloadRoutines();
      }
    } finally {
      if (isPageActiveRef.current) {
        setPendingRoutineIds((ids) =>
          ids.filter((id) => id !== routine.id),
        );
      }
    }
  };

  return {
    routineData,
    isLoadingRoutines,
    routineError,
    pendingRoutineIds,
    reloadRoutines,
    saveRoutines,
    handleToggleRoutine,
  };
};

export default useRoutines;
