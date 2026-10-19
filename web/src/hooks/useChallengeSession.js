import { useCallback, useEffect, useRef, useState } from "react";
import { challengeApi as sharedChallengeApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { createChallengeApi } from "../api/challengeApi.js";
import { buildChallengeSessionSnapshot } from "../utils/challengeSession.js";

const requests = createChallengeApi(sharedChallengeApi);
const emptyState = {
  studyId: null,
  snapshot: null,
  isLoading: false,
  isPending: false,
  error: null,
  requiresVerification: false,
};

// 공통 진입 검증에 성공한 페이지에서만 password를 전달한다.
// 페이지 이탈 시 함께 unmount하며, 새 스터디·이전 페이지의 응답을 섞지 않는다.
const useChallengeSession = ({ studyId, password }) => {
  const [state, setState] = useState(emptyState);
  const contextRef = useRef(null);

  const isCurrent = useCallback((context) =>
    context.active && contextRef.current === context, []);

  const loadCurrent = useCallback(async (context, keepError = false) => {
    if (!isCurrent(context)) {
      return false;
    }

    context.loading = true;
    setState((previous) => ({
      ...previous,
      isLoading: true,
      error: keepError ? previous.error : null,
    }));

    try {
      const data = await requests.getCurrentChallenge({
        studyId: context.studyId,
        password: context.password,
      });
      const receivedAt = performance.now();

      if (!isCurrent(context)) {
        return false;
      }

      const snapshot = buildChallengeSessionSnapshot(data, receivedAt);
      context.snapshot = snapshot;
      setState((previous) => ({ ...previous, snapshot }));
      return true;
    } catch (error) {
      if (isCurrent(context)) {
        const apiError = getApiError(error);
        if (apiError.status === 401) {
          context.password = null;
          context.snapshot = null;
        }
        const snapshot = context.snapshot;
        setState((previous) => ({ ...previous, snapshot, error: apiError }));
      }
      return false;
    } finally {
      context.loading = false;
      if (isCurrent(context)) {
        setState((previous) => ({ ...previous, isLoading: false }));
      }
    }
  }, [isCurrent]);

  useEffect(() => {
    const context = {
      studyId,
      password,
      active: true,
      loading: false,
      pending: false,
      snapshot: null,
    };
    contextRef.current = context;
    setState({ ...emptyState, studyId });

    if (studyId && password) {
      void loadCurrent(context);
    }

    const requireVerification = () => {
      if (contextRef.current !== context) {
        return;
      }

      // 외부 이동은 React를 unmount하지 않고 메모리에 보관할 수 있다.
      // 복귀해도 이전 비밀번호나 이동 전 요청의 응답을 재사용하지 않는다.
      context.active = false;
      context.password = null;
      context.snapshot = null;
      setState({ ...emptyState, studyId, requiresVerification: true });
    };
    const handlePageShow = (event) => {
      if (event.persisted) {
        requireVerification();
      }
    };

    window.addEventListener("pagehide", requireVerification);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", requireVerification);
      window.removeEventListener("pageshow", handlePageShow);
      context.active = false;
      context.password = null;
      context.snapshot = null;
      if (contextRef.current === context) {
        contextRef.current = null;
      }
    };
  }, [studyId, password, loadCurrent]);

  const getContext = useCallback(() => {
    const context = contextRef.current;
    return context?.active && context.studyId === studyId
      && context.password === password && Boolean(password)
      ? context
      : null;
  }, [studyId, password]);

  const refetch = useCallback(() => {
    const context = getContext();
    if (!context || context.pending || context.loading) {
      return Promise.resolve(false);
    }
    return loadCurrent(context);
  }, [getContext, loadCurrent]);

  const changeChallenge = useCallback(async (action, goalMinutes) => {
    const context = getContext();
    if (!context || context.pending || context.loading || !context.snapshot) {
      return false;
    }

    const challenge = context.snapshot.challenge;
    const status = challenge?.status;
    const allowed = action === "start"
      ? status !== "RUNNING" && status !== "PAUSED"
      : action === "pause" ? status === "RUNNING"
        : action === "resume" || action === "reset" ? status === "PAUSED"
          : status === "RUNNING" || status === "PAUSED";
    if (!allowed) {
      return false;
    }

    // state 갱신 전에 잠가, 같은 페이지에서 연타해도 요청은 한 번만 보낸다.
    context.pending = true;
    setState((previous) => ({ ...previous, isPending: true, error: null }));

    try {
      const data = await requests[`${action}Challenge`]({
        studyId: context.studyId,
        password: context.password,
        challengeId: challenge?.id,
        goalMinutes,
      });
      const receivedAt = performance.now();

      if (!isCurrent(context)) {
        return false;
      }

      const snapshot = buildChallengeSessionSnapshot(data, receivedAt);
      context.snapshot = snapshot;
      setState((previous) => ({ ...previous, snapshot }));
      return true;
    } catch (error) {
      if (isCurrent(context)) {
        const apiError = getApiError(error);
        if (apiError.status === 401) {
          context.password = null;
          context.snapshot = null;
        }
        const snapshot = context.snapshot;
        setState((previous) => ({ ...previous, snapshot, error: apiError }));

        // 변경 요청을 다시 보내지 않고, 충돌하면 서버의 현재 상태만 다시 읽는다.
        if (apiError.status === 409) {
          await loadCurrent(context, true);
        }
      }
      return false;
    } finally {
      context.pending = false;
      if (isCurrent(context)) {
        setState((previous) => ({ ...previous, isPending: false }));
      }
    }
  }, [getContext, isCurrent, loadCurrent]);

  const startChallenge = useCallback((goalMinutes) => changeChallenge("start", goalMinutes), [changeChallenge]);
  const pauseChallenge = useCallback(() => changeChallenge("pause"), [changeChallenge]);
  const resumeChallenge = useCallback(() => changeChallenge("resume"), [changeChallenge]);
  const resetChallenge = useCallback(() => changeChallenge("reset"), [changeChallenge]);
  const completeChallenge = useCallback(() => changeChallenge("complete"), [changeChallenge]);

  const dismissCompletion = useCallback(() => {
    const context = getContext();
    if (!context || context.pending || context.loading
      || context.snapshot?.challenge?.status !== "COMPLETED") {
      return;
    }
    const snapshot = { ...context.snapshot, challenge: null, settlement: null };
    context.snapshot = snapshot;
    setState((previous) => ({ ...previous, snapshot, error: null }));
  }, [getContext]);

  const visible = state.studyId === studyId && password
    ? state
    : { ...emptyState, isLoading: Boolean(studyId && password) };

  return {
    snapshot: visible.snapshot,
    isLoading: visible.isLoading,
    isPending: visible.isPending,
    error: visible.error,
    needsPassword: !password || visible.requiresVerification || visible.error?.status === 401,
    refetch,
    startChallenge,
    pauseChallenge,
    resumeChallenge,
    resetChallenge,
    completeChallenge,
    dismissCompletion,
  };
};

export default useChallengeSession;
