import { useEffect, useState } from "react";

// 요청은 즉시 실행하고, 로딩 표시만 요청 시작부터 최소 1초 유지한다.
const useMinimumLoading = (isLoading, requestKey = null) => {
  const [cycle, setCycle] = useState(() => ({
    isLoading,
    requestKey,
    startedAt: Date.now(),
    holding: isLoading,
  }));

  if (cycle.isLoading !== isLoading || cycle.requestKey !== requestKey) {
    setCycle({
      isLoading,
      requestKey,
      startedAt: isLoading ? Date.now() : cycle.startedAt,
      holding: isLoading || cycle.holding,
    });
  }

  useEffect(() => {
    if (isLoading || !cycle.holding) return;
    const timer = window.setTimeout(() => {
      setCycle((previous) => previous === cycle
        ? { ...previous, holding: false }
        : previous);
    }, Math.max(0, 1000 - (Date.now() - cycle.startedAt)));
    return () => window.clearTimeout(timer);
  }, [isLoading, cycle]);

  return isLoading || cycle.holding;
};

export default useMinimumLoading;
