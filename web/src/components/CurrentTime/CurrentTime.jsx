import { useEffect, useState } from "react";

const CurrentTime = ({ serverTime, className }) => {
  const [currentTime, setCurrentTime] = useState(null);

  useEffect(() => {
    if (!serverTime) {
      setCurrentTime(null);
      return;
    }

    const serverStart = new Date(serverTime).getTime();
    const browserStart = Date.now();

    const updateTime = () => {
      const elapsed = Date.now() - browserStart;
      setCurrentTime(new Date(serverStart + elapsed));
    };

    updateTime();

    const timer = window.setInterval(updateTime, 1000);

    return () => window.clearInterval(timer);
  }, [serverTime]);

  return (
    <div className={className}>
      <p>현재 시간</p>
      {currentTime && (
        <time dateTime={currentTime.toISOString()}>
          {currentTime.toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </time>
      )}
    </div>
  );
};

export default CurrentTime;
