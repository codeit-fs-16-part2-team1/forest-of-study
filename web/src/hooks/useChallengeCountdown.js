import { useEffect, useState } from "react";
import { calculateChallengeRemainingSeconds } from "../utils/challengeCountdown.js";

// receivedAt은 응답 수신 직후 기록한 performance.now() 값이다.
// API DTO에 추가하지 않고 해당 응답과 함께 페이지 메모리에 보관한다.
const useChallengeCountdown = (challenge, receivedAt) => {
  const [observedAt, setObservedAt] = useState(null);
  const isRunning = challenge?.status === "RUNNING";
  const hasReceivedAt = Number.isFinite(receivedAt);

  useEffect(() => {
    if (challenge?.status !== "RUNNING" || !Number.isFinite(receivedAt)) {
      return;
    }

    let timeoutId;
    const updateClock = () => {
      window.clearTimeout(timeoutId);
      const now = performance.now();
      setObservedAt(now);

      const seconds = calculateChallengeRemainingSeconds(
        challenge,
        now - receivedAt,
      );

      // 0초는 표시만 멈춘다. 완료 요청·상태 전환·포인트 지급은 여기서 하지 않는다.
      if (seconds > 0) {
        timeoutId = window.setTimeout(updateClock, 250);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateClock();
      }
    };

    updateClock();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", updateClock);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", updateClock);
    };
  }, [challenge, receivedAt]);

  if (isRunning && !hasReceivedAt) {
    return null;
  }

  const elapsedMilliseconds = isRunning && hasReceivedAt
    ? Math.max(0, (observedAt ?? receivedAt) - receivedAt)
    : 0;

  return calculateChallengeRemainingSeconds(challenge, elapsedMilliseconds);
};

export default useChallengeCountdown;
