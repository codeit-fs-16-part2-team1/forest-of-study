import { useEffect, useState } from "react";

const getCurrentTime = (clock) => new Date(
  Date.parse(clock.serverTime) + Date.now() - clock.receivedAt,
);

// 응답 수신 이후의 경과 시간을 더해 화면 표시와 날짜 감지에 함께 사용한다.
const useServerTime = (clock) => {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!clock) return;

    const updateTime = () => setResult({ clock, time: getCurrentTime(clock) });
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") updateTime();
    };

    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clock]);

  if (!clock) return null;
  return result?.clock === clock ? result.time : getCurrentTime(clock);
};

export default useServerTime;
