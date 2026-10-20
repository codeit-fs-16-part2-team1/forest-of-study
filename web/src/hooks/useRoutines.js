import { useCallback, useEffect, useRef, useState } from "react";
import { routineApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { getKoreanDate } from "../utils/studyDate.js";
import useServerTime from "./useServerTime.js";

const MINIMUM_LOADING_MS = 300;

const useRoutines = (studyId, verifiedPassword, onRoutineError, onDateRefreshed) => {
  const [routineData, setRoutineData] = useState(null);
  const [clock, setClock] = useState(null);
  const [isLoadingRoutines, setIsLoadingRoutines] = useState(true);
  const [routineError, setRoutineError] = useState("");
  const [reloadRequest, setReloadRequest] = useState(null);
  const [pendingRoutineIds, setPendingRoutineIds] = useState([]);
  const [isSavingRoutines, setIsSavingRoutines] = useState(false);
  const contextRef = useRef(null);
  const currentTime = useServerTime(clock);
  const currentDate = currentTime ? getKoreanDate(currentTime) : null;

  const isCurrentContext = useCallback((context) =>
    context?.active && contextRef.current === context, []);

  const getContext = useCallback(() => {
    const context = contextRef.current;
    return isCurrentContext(context) && context.studyId === studyId &&
      context.password === verifiedPassword && Boolean(studyId && verifiedPassword)
      ? context
      : null;
  }, [studyId, verifiedPassword, isCurrentContext]);

  const applyRoutineData = useCallback((context, data) => {
    context.data = data;
    setRoutineData(data);
    setClock({ serverTime: data.serverTime, receivedAt: Date.now() });
    setRoutineError("");
  }, []);

  const loadRoutines = useCallback((context, reason = "manual") => {
    if (!isCurrentContext(context) || context.loading || context.saving ||
        context.pendingIds.size > 0) return Promise.resolve(false);

    context.loading = true;
    setIsLoadingRoutines(true);
    setRoutineError("");
    const loadingStartedAt = Date.now();
    const previousDate = context.data?.recordDate;

    const request = async () => {
      try {
        const { data } = await routineApi.getList(context.studyId, context.password);
        if (!isCurrentContext(context)) return false;

        // 재조회 중에도 기존 목록을 보존해 편집 모달과 입력값을 유지한다.
        applyRoutineData(context, data);
        if (previousDate && data.recordDate > previousDate &&
            context.notifiedDate !== data.recordDate) {
          context.notifiedDate = data.recordDate;
          onDateRefreshed?.();
        }
        // 경계 직전 응답이었다면 새 서버 시각이 자정을 넘을 때 다시 확인한다.
        context.lastAutoRefreshDate = null;
        return true;
      } catch (error) {
        if (isCurrentContext(context)) {
          const apiError = getApiError(error);
          setRoutineError(apiError.message);
          if (reason === "date" || apiError.status === 401 ||
              apiError.code === "STUDY_NOT_FOUND") onRoutineError?.(apiError);
        }
        return false;
      } finally {
        const remaining = Math.max(0, MINIMUM_LOADING_MS - (Date.now() - loadingStartedAt));
        if (isCurrentContext(context) && remaining > 0) {
          await new Promise((resolve) => {
            context.finishLoading = resolve;
            context.loadingTimer = window.setTimeout(resolve, remaining);
          });
        }
        context.finishLoading = null;
        context.loadingTimer = null;
        context.loading = false;
        context.loadPromise = null;
        if (isCurrentContext(context)) setIsLoadingRoutines(false);
      }
    };

    context.loadPromise = request();
    return context.loadPromise;
  }, [applyRoutineData, isCurrentContext, onRoutineError, onDateRefreshed]);

  useEffect(() => {
    const context = {
      studyId,
      password: verifiedPassword,
      active: true,
      data: null,
      loading: false,
      saving: false,
      pendingIds: new Set(),
      handledReloadRequest: null,
      lastAutoRefreshDate: null,
      notifiedDate: null,
      loadPromise: null,
      loadingTimer: null,
      finishLoading: null,
    };
    contextRef.current = context;
    setRoutineData(null);
    setClock(null);
    setRoutineError("");
    setReloadRequest(null);
    setPendingRoutineIds([]);
    setIsSavingRoutines(false);
    setIsLoadingRoutines(true);

    if (studyId && verifiedPassword !== null) loadRoutines(context, "initial");

    return () => {
      context.active = false;
      context.password = null;
      context.data = null;
      window.clearTimeout(context.loadingTimer);
      context.finishLoading?.();
      if (contextRef.current === context) contextRef.current = null;
    };
  }, [studyId, verifiedPassword, loadRoutines]);

  // 재시도와 DATE_CHANGED 갱신은 진행 중인 저장·체크가 끝나면 실행한다.
  useEffect(() => {
    const context = getContext();
    if (!context || !reloadRequest || context.handledReloadRequest === reloadRequest ||
        context.loading || context.saving || context.pendingIds.size > 0) return;

    context.handledReloadRequest = reloadRequest;
    if (reloadRequest.reason === "date") {
      const targetDate = reloadRequest.targetDate ?? currentDate;
      if (!reloadRequest.force && context.data?.recordDate === targetDate) return;
      context.lastAutoRefreshDate = targetDate;
    }
    loadRoutines(context, reloadRequest.reason);
  }, [reloadRequest, currentDate, isLoadingRoutines, isSavingRoutines,
    pendingRoutineIds, getContext, loadRoutines]);

  useEffect(() => {
    const context = getContext();
    if (!context?.data || !currentDate || currentDate <= context.data.recordDate ||
        context.lastAutoRefreshDate === currentDate || context.loading ||
        context.saving || context.pendingIds.size > 0) return;

    // 같은 날짜의 실패를 반복 요청하지 않고 화면의 재시도 버튼으로 복구한다.
    context.lastAutoRefreshDate = currentDate;
    setReloadRequest({ reason: "date", targetDate: currentDate });
  }, [currentDate, routineData?.recordDate, isLoadingRoutines, isSavingRoutines,
    pendingRoutineIds, getContext]);

  const reloadRoutines = () => {
    const context = getContext();
    if (!context) return;
    const isDateChanged = context.data && currentDate > context.data.recordDate;
    setReloadRequest({ reason: isDateChanged ? "date" : "manual", targetDate: currentDate });
  };

  const saveRoutines = async (changes) => {
    const context = getContext();
    if (!context || context.saving || context.pendingIds.size > 0) return false;

    // 먼저 시작한 재조회를 기다려 저장 결과가 오래된 목록으로 덮이지 않게 한다.
    context.saving = true;
    setIsSavingRoutines(true);
    try {
      if (context.loadPromise) await context.loadPromise;
      if (!isCurrentContext(context)) return false;

      const { data } = await routineApi.saveBatch(studyId, changes, verifiedPassword);
      if (!isCurrentContext(context)) return false;
      applyRoutineData(context, data);
      return true;
    } catch (error) {
      if (isCurrentContext(context)) onRoutineError?.(getApiError(error));
      return false;
    } finally {
      context.saving = false;
      if (isCurrentContext(context)) setIsSavingRoutines(false);
    }
  };

  const handleToggleRoutine = async (routine) => {
    const context = getContext();
    if (!context?.data || context.loading || context.saving ||
        context.pendingIds.has(routine.id)) return;

    if (currentDate > context.data.recordDate) {
      setReloadRequest({ reason: "date", targetDate: currentDate });
      return;
    }
    const currentRoutine = context.data.routines.find((item) => item.id === routine.id);
    if (!currentRoutine) return;
    context.pendingIds.add(routine.id);
    setPendingRoutineIds([...context.pendingIds]);

    try {
      const { data } = await routineApi.setCompleted(studyId, routine.id, {
        recordDate: context.data.recordDate,
        completed: !currentRoutine.completed,
      }, verifiedPassword);
      if (!isCurrentContext(context) || context.data?.recordDate !== data.recordDate) return;

      context.data = {
        ...context.data,
        routines: context.data.routines.map((item) => item.id === data.routineId
          ? { ...item, completed: data.completed }
          : item),
      };
      setRoutineData(context.data);
    } catch (error) {
      if (!isCurrentContext(context)) return;
      const apiError = getApiError(error);
      if (apiError.code === "DATE_CHANGED") {
        setReloadRequest({ reason: "date", force: true });
      } else {
        onRoutineError?.(apiError);
      }
    } finally {
      context.pendingIds.delete(routine.id);
      if (isCurrentContext(context)) setPendingRoutineIds([...context.pendingIds]);
    }
  };

  return {
    routineData,
    currentTime,
    isLoadingRoutines,
    routineError,
    pendingRoutineIds,
    reloadRoutines,
    saveRoutines,
    handleToggleRoutine,
  };
};

export default useRoutines;
