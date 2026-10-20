import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { StudyPasswordContext } from "../contexts/StudyPasswordProvider.jsx";
import { isValidStudyPassword, studyPasswordMessages } from "../utils/studyPassword.js";

const emptyState = {
  studyId: null,
  memoryGeneration: null,
  isOpen: false,
  isPending: false,
  verifiedPassword: null,
  error: null,
  formVersion: 0,
};

// 입력값만 공유한다. 각 페이지는 AU-01 성공 후 보호 데이터를 요청한다.
const useStudyPassword = (studyId) => {
  const memory = useContext(StudyPasswordContext);
  if (!memory) throw new Error("useStudyPassword requires StudyPasswordProvider");
  const { studyId: sharedStudyId, revision, getSnapshot, rememberPassword, clearPassword } = memory;
  const [state, setState] = useState(emptyState);
  const contextRef = useRef(null);
  const canVerify = Boolean(studyId && studyId.toLowerCase() === sharedStudyId);

  const getContext = useCallback(() => {
    const context = contextRef.current;
    return canVerify && context?.active && context.studyId === studyId ? context : null;
  }, [canVerify, studyId]);

  const reset = useCallback((isOpen, expectedGeneration, error = null) => {
    const context = getContext();
    if (!context || !clearPassword(expectedGeneration)) return;
    context.generation += 1;
    context.memoryGeneration = getSnapshot().generation;
    context.pending = false;
    context.isOpen = isOpen;
    context.formVersion += 1;
    setState({
      ...emptyState, studyId, isOpen, error,
      memoryGeneration: context.memoryGeneration, formVersion: context.formVersion,
    });
  }, [getContext, clearPassword, getSnapshot, studyId]);

  const verify = useCallback(async (password, automatic = false) => {
    const context = getContext();
    if (!context || context.pending || (!automatic && !context.isOpen)) return false;
    const memoryGeneration = context.memoryGeneration;
    if (getSnapshot().generation !== memoryGeneration) return false;

    if (!isValidStudyPassword(password)) {
      setState((previous) => ({
        ...previous, error: { status: null, code: null, message: studyPasswordMessages.invalid },
      }));
      return false;
    }

    context.pending = true;
    const generation = ++context.generation;
    const isCurrent = () => getContext() === context && context.generation === generation &&
      getSnapshot().generation === memoryGeneration;
    setState({
      ...emptyState, studyId, memoryGeneration, isOpen: !automatic,
      isPending: true, formVersion: context.formVersion,
    });

    try {
      const response = await studyApi.verifyPassword(studyId, password);
      if (!isCurrent()) return false;

      if (response?.data?.verified !== true) {
        setState((previous) => ({
          ...previous,
          error: { status: null, code: null, message: studyPasswordMessages.unexpectedResponse },
        }));
        return false;
      }

      if (!rememberPassword(password, memoryGeneration)) return false;
      context.isOpen = false;
      setState({ ...emptyState, studyId, memoryGeneration, verifiedPassword: password });
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      // Axios 오류 전체에는 요청 비밀번호가 들어갈 수 있어 화면용 정보만 보관한다.
      const { status, code, message } = getApiError(error);
      if (status === 401 || status === 400 || code === "STUDY_NOT_FOUND") {
        clearPassword(memoryGeneration);
        context.memoryGeneration = getSnapshot().generation;
        context.generation += 1;
        context.pending = false;
        context.isOpen = code !== "STUDY_NOT_FOUND";
      }
      // 통신 실패에서는 공유값을 남기고, 자동 재송신 없이 사용자 재시도를 기다린다.
      setState({
        ...emptyState, studyId, memoryGeneration: context.memoryGeneration,
        isOpen: context.isOpen, error: { status, code, message }, formVersion: context.formVersion,
      });
      return false;
    } finally {
      if (isCurrent()) {
        context.pending = false;
        setState((previous) => ({ ...previous, isPending: false }));
      }
    }
  }, [getContext, getSnapshot, rememberPassword, clearPassword, studyId]);

  useEffect(() => {
    const snapshot = getSnapshot();
    const password = canVerify ? snapshot.password : null;
    const context = {
      studyId, active: true, generation: 0, memoryGeneration: snapshot.generation,
      pending: false, formVersion: 0, isOpen: canVerify && !password,
    };
    contextRef.current = context;
    setState({
      ...emptyState, studyId, memoryGeneration: snapshot.generation, isOpen: context.isOpen,
    });
    if (password) void verify(password, true);

    return () => {
      context.active = false;
      context.generation += 1;
      if (contextRef.current === context) contextRef.current = null;
      // 내부 이동에서는 페이지 요청만 무효화하고 공통 비밀번호는 남긴다.
    };
  }, [canVerify, studyId, getSnapshot, verify]);

  useEffect(() => {
    const context = getContext();
    const { generation } = getSnapshot();
    if (!context || context.memoryGeneration === generation) return;
    context.generation += 1;
    context.memoryGeneration = generation;
    context.pending = false;
    context.isOpen = true;
    context.formVersion += 1;
    setState({
      ...emptyState, studyId, memoryGeneration: generation, isOpen: true,
      formVersion: context.formVersion,
    });
  }, [revision, getContext, getSnapshot, studyId]);

  const snapshot = getSnapshot();
  const open = useCallback(() => {
    if (getSnapshot().generation !== snapshot.generation) return;
    const password = getSnapshot().password;
    if (password) void verify(password, true);
    else reset(true, snapshot.generation);
  }, [getSnapshot, snapshot.generation, verify, reset]);
  const close = useCallback(() => reset(false, snapshot.generation), [reset, snapshot.generation]);
  const requireVerification = useCallback(
    (error) => {
      const missingStudy = error?.code === "STUDY_NOT_FOUND";
      reset(!missingStudy, snapshot.generation, missingStudy
        ? { status: error.status, code: error.code, message: error.message } : null);
    }, [reset, snapshot.generation],
  );
  const verifyPassword = useCallback((password) => verify(password), [verify]);
  const isVerificationCurrent = useCallback(() =>
    getContext()?.memoryGeneration === snapshot.generation &&
    getSnapshot().generation === snapshot.generation,
  [getContext, getSnapshot, snapshot.generation]);
  const visible = canVerify && state.studyId === studyId &&
    state.memoryGeneration === snapshot.generation ? state : {
      ...emptyState, studyId, isOpen: canVerify && !snapshot.password,
      isPending: canVerify && Boolean(snapshot.password),
    };

  return {
    studyId,
    isOpen: visible.isOpen,
    isPending: visible.isPending,
    formVersion: visible.formVersion,
    error: visible.error,
    verifiedPassword: visible.verifiedPassword,
    isVerified: visible.verifiedPassword !== null,
    verifyPassword, open, close, requireVerification, isVerificationCurrent,
  };
};

export default useStudyPassword;
