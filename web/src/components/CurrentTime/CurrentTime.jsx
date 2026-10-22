import useServerTime from "../../hooks/useServerTime.js";

const CurrentTime = ({ clock, className, isLoading = false, skeletonClassName }) => {
  const currentTime = useServerTime(clock);
  return (
    <div className={className}>
      <p>현재 시간</p>
      {isLoading ? (
        <span className={skeletonClassName} role="status" aria-label="현재 시간 불러오는 중" />
      ) : currentTime && (
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
