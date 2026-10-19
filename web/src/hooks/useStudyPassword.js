import { useCallback, useEffect, useRef, useState } from "react";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { isValidStudyPassword, studyPasswordMessages } from "../utils/studyPassword.js";

const emptyState = {
  studyId: null,
  isOpen: false,
  isPending: false,
  verifiedPassword: null,
  error: null,
  formVersion: 0,
};

// 보호 페이지마다 한 번 사용한다. 앱 전체 Context나 저장소로 올리지 않는다.
const useStudyPassword = (studyId) => {
  const [state, setState] = useState(emptyState);
  const contextRef = useRef(null);

  const getContext = useCallback(() => {
    const context = contextRef.current;
    return studyId && context?.active && context.studyId === studyId ? context : null;
  }, [studyId]);

  const reset = useCallback((isOpen) => {
    const context = getContext();
    if (!context) return;

    // 요청을 취소하지 않고, 닫기·재입력 이전 요청의 결과만 반영하지 않는다.
    context.generation += 1;
    context.pending = false;
    context.isOpen = isOpen;
    setState({ ...emptyState, studyId, isOpen, formVersion: context.generation });
  }, [getContext, studyId]);

  useEffect(() => {
    const context = { studyId, active: true, generation: 0, pending: false, isOpen: Boolean(studyId) };
    contextRef.current = context;
    setState({ ...emptyState, studyId, isOpen: Boolean(studyId) });

    const handlePageHide = () => reset(true);
    const handlePageShow = (event) => {
      if (event.persisted) reset(true);
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      context.active = false;
      context.generation += 1;
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      if (contextRef.current === context) contextRef.current = null;
    };
  }, [studyId, reset]);

  const verifyPassword = useCallback(async (password) => {
    const context = getContext();
    if (!context || !context.isOpen || context.pending) return false;

    if (!isValidStudyPassword(password)) {
      setState((previous) => ({
        ...previous,
        error: { status: null, code: null, message: studyPasswordMessages.invalid },
      }));
      return false;
    }

    // state 반영 전에 잠가 Enter 연타·확인 버튼 중복 클릭을 막는다.
    context.pending = true;
    const generation = ++context.generation;
    const isCurrent = () => getContext() === context && context.generation === generation;
    setState((previous) => ({ ...previous, isPending: true, error: null }));

    try {
      const response = await studyApi.verifyPassword(studyId, password);
      if (!isCurrent()) return false;

      // HTTP 성공만으로 통과시키지 않고 계약의 verified=true를 확인한다.
      if (response?.data?.verified !== true) {
        setState((previous) => ({
          ...previous,
          error: { status: null, code: null, message: studyPasswordMessages.unexpectedResponse },
        }));
        return false;
      }

      context.isOpen = false;
      setState({ ...emptyState, studyId, verifiedPassword: password });
      return true;
    } catch (error) {
      if (isCurrent()) {
        const { status, code, message } = getApiError(error);
        // Axios 오류 전체에는 요청 비밀번호가 들어갈 수 있어 화면용 정보만 보관한다.
        setState((previous) => ({ ...previous, error: { status, code, message } }));
      }
      return false;
    } finally {
      if (isCurrent()) {
        context.pending = false;
        setState((previous) => ({ ...previous, isPending: false }));
      }
    }
  }, [getContext, studyId]);

  const open = useCallback(() => reset(true), [reset]);
  const close = useCallback(() => reset(false), [reset]);
  // 보호 요청에서 401을 받으면 이 함수를 호출해 비밀번호를 폐기하고 다시 입력받는다.
  const requireVerification = open;
  const visible = state.studyId === studyId
    ? state
    : { ...emptyState, studyId, isOpen: Boolean(studyId) };

  return {
    studyId,
    isOpen: visible.isOpen,
    isPending: visible.isPending,
    formVersion: visible.formVersion,
    error: visible.error,
    verifiedPassword: visible.verifiedPassword,
    isVerified: visible.verifiedPassword !== null,
    verifyPassword,
    open,
    close,
    requireVerification,
  };
};

export default useStudyPassword;
