const CurrentTime = ({ currentTime, className }) => {
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
