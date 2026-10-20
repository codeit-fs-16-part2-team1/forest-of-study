import { useEffect, useRef, useState } from "react";
import { routineApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";

const MINIMUM_LOADING_MS = 300;

const useRoutines = (studyId, verifiedPassword, onRoutineError) => {
  const [routineData, setRoutineData] = useState(null);
  const [isLoadingRoutines, setIsLoadingRoutines] = useState(true);
  const [routineError, setRoutineError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [pendingRoutineIds, setPendingRoutineIds] = useState([]);
  const contextRef = useRef(null);

  useEffect(() => {
    const context = { studyId, verifiedPassword, active: true };
    contextRef.current = context;
    setPendingRoutineIds([]);

    return () => {
      context.active = false;
      context.verifiedPassword = null;
      if (contextRef.current === context) contextRef.current = null;
    };
  }, [studyId, verifiedPassword]);

  const isCurrentContext = (context) => context?.active && contextRef.current === context;

  useEffect(() => {
    // 비밀번호 검증 전에는 목록을 요청하지 않습니다.
    if (!studyId || verifiedPassword === null) {
      setRoutineData(null);
      setRoutineError("");
      setIsLoadingRoutines(true);
      return;
    }

    let ignore = false;
    let loadingTimer;
    const loadingStartedAt = Date.now();

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
          const apiError = getApiError(error);
          setRoutineError(apiError.message);
          if (apiError.status === 401 || apiError.code === "STUDY_NOT_FOUND") {
            onRoutineError?.(apiError);
          }
        }
      } finally {
        if (!ignore) {
          const remaining = Math.max(0, MINIMUM_LOADING_MS - (Date.now() - loadingStartedAt));
          loadingTimer = window.setTimeout(() => {
            if (!ignore) setIsLoadingRoutines(false);
          }, remaining);
        }
      }
    };

    fetchRoutines();

    return () => {
      ignore = true;
      window.clearTimeout(loadingTimer);
    };
  }, [studyId, verifiedPassword, reloadCount, onRoutineError]);

  const reloadRoutines = () => {
    setReloadCount((count) => count + 1);
  };

  const saveRoutines = async (changes) => {
    const context = contextRef.current;
    if (!isCurrentContext(context) || context.studyId !== studyId ||
        context.verifiedPassword !== verifiedPassword || !studyId ||
        verifiedPassword === null || pendingRoutineIds.length > 0) {
      return false;
    }

    try {
      const { data } = await routineApi.saveBatch(studyId, changes, verifiedPassword);
      if (!isCurrentContext(context)) return false;

      // 저장과 같은 트랜잭션에서 조회한 목록으로 교체한다.
      setRoutineData(data);
      return true;
    } catch (error) {
      if (isCurrentContext(context)) onRoutineError?.(getApiError(error));
      return false;
    }
  };

  const handleToggleRoutine = async (routine) => {
    const context = contextRef.current;
    if (
      !isCurrentContext(context) ||
      context.studyId !== studyId ||
      context.verifiedPassword !== verifiedPassword ||
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

      if (!isCurrentContext(context)) return;

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
      if (!isCurrentContext(context)) return;
      const apiError = getApiError(error);

      onRoutineError?.(apiError);

      if (apiError.code === "DATE_CHANGED") {
        reloadRoutines();
      }
    } finally {
      if (isCurrentContext(context)) {
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
