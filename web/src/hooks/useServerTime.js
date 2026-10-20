import { useEffect, useState } from "react";
import {
  getServerMinute,
  getNextServerMinuteDelay,
} from "../utils/serverTime.js";

// 분 단위 표시 상태는 시계 컴포넌트 안에서만 갱신한다.
const useServerTime = (clock) => {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!clock) return;
    let timer;

    const updateTime = () => {
      const now = Date.now();
      const minute = getServerMinute(clock, now);
      setResult((previous) => previous?.clock === clock && previous.minute === minute
        ? previous
        : { clock, minute });
      window.clearTimeout(timer);
      timer = window.setTimeout(updateTime, getNextServerMinuteDelay(clock, now));
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") updateTime();
    };

    updateTime();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clock]);

  if (!clock) return null;
  return new Date(result?.clock === clock ? result.minute : getServerMinute(clock));
};

export default useServerTime;
