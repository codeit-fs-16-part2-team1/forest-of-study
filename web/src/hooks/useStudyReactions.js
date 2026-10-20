import { useCallback, useEffect, useRef, useState } from "react";
import { studyApi } from "../api/api.js";
import { getApiError } from "../api/apiError.js";
import { getOrCreateBrowserId } from "../utils/browserId.js";

const emptyState = { studyId: null, isPending: false, error: null };

// 상세 조회와 reactions 상태는 부모가 소유한다. 이 훅은 등록 요청만 담당한다.
const useStudyReactions = ({ studyId, onReactionsChange }) => {
  const [state, setState] = useState(emptyState);
  const contextRef = useRef(null);

  useEffect(() => {
    const context = { studyId, active: true, pending: false };
    contextRef.current = context;

    return () => {
      // 서버 요청을 취소하지 않고 이전 화면에서 보낸 결과만 반영하지 않는다.
      context.active = false;
      if (contextRef.current === context) contextRef.current = null;
    };
  }, [studyId]);

  const addReaction = useCallback(async (emoji) => {
    const context = contextRef.current;
    if (!studyId || !context?.active || context.studyId !== studyId
      || context.pending || typeof onReactionsChange !== "function"
      || typeof emoji !== "string" || emoji.length === 0) {
      return false;
    }

    const isCurrent = () => context.active && contextRef.current === context;
    // React가 버튼 상태를 반영하기 전에도 연타 요청을 막는다.
    context.pending = true;
    setState({ studyId, isPending: true, error: null });

    let browserId;
    try {
      browserId = getOrCreateBrowserId();
    } catch {
      context.pending = false;
      setState({
        studyId,
        isPending: false,
        error: { message: "응원 식별자를 저장할 수 없습니다. 브라우저 저장소 설정을 확인해주세요." },
      });
      return false;
    }

    try {
      // API-ST-07은 공개 요청이다. 피부색 정규화·중복 판정·상위 정렬은 서버가 담당한다.
      const response = await studyApi.addReaction(studyId, { browserId, emoji });
      if (!isCurrent()) return false;

      // 공통 axios가 이미 서버 본문을 반환하므로 data는 한 번만 꺼낸다.
      const reactions = response?.data?.reactions;
      if (!Array.isArray(reactions) || !reactions.every((reaction) =>
        typeof reaction?.emoji === "string" && reaction.emoji.length > 0
        && Number.isInteger(reaction.count) && reaction.count > 0)) {
        setState({
          studyId,
          isPending: true,
          error: { message: "응원 결과를 확인하지 못했습니다. 스터디를 다시 조회해주세요." },
        });
        return false;
      }

      // 성공 응답 자체가 최신 집계다. 기존 개수에 1을 더하거나 다시 등록하지 않는다.
      onReactionsChange(reactions);
      return true;
    } catch (error) {
      if (isCurrent()) {
        setState({ studyId, isPending: true, error: getApiError(error) });
      }
      return false;
    } finally {
      context.pending = false;
      if (isCurrent()) {
        setState((previous) => ({ ...previous, isPending: false }));
      }
    }
  }, [studyId, onReactionsChange]);

  const visible = state.studyId === studyId ? state : emptyState;
  return { isPending: visible.isPending, error: visible.error, addReaction };
};

export default useStudyReactions;
