import { useId } from "react";
import ChallengeControls from "./ChallengeControls.jsx";
import timer from "../../assets/challenge/timer.svg";
import "./challengeTimer.scss";

const formatTime = (seconds) => {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const remainder = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
};

const ChallengeTimer = ({
  status = null,
  goalMinutes = 10,
  remainingSeconds,
  isLoading = false,
  isPending = false,
  canEditGoal = false,
  onEditGoal,
  onStart,
  onPause,
  onReset,
  onDismissCompletion,
}) => {
  const titleId = useId();
  const isActive = status === "RUNNING" || status === "PAUSED";
  const isCompleted = status === "COMPLETED";
  const hasTime = !isLoading && Number.isFinite(remainingSeconds);
  const time = hasTime ? formatTime(isCompleted ? 0 : remainingSeconds) : null;

  return (
    <section
      className="challengeTimer"
      data-status={status ?? "IDLE"}
      aria-labelledby={titleId}
    >
      <div className="challengeTimer__heading">
        <h2 id={titleId} className="challengeTimer__title">
          {isLoading ? <span className="challengeTimer__titleSkeleton" aria-label="오늘의 집중 불러오는 중" /> : "오늘의 집중"}
        </h2>
        {(isActive || isCompleted) && !isLoading && (
          <p className="challengeTimer__goal" aria-label={`목표 ${goalMinutes}분`}>
            <img src={timer} alt="" />
            {formatTime(goalMinutes * 60)}
          </p>
        )}
      </div>

      <div className="challengeTimer__display">
        {time === null ? (
          <span className="challengeTimer__skeleton" aria-label="집중 시간 불러오는 중" />
        ) : canEditGoal ? (
          <button
            type="button"
            className="challengeTimer__time challengeTimer__timeButton"
            aria-label={`목표 ${goalMinutes}분, 시간 설정 열기`}
            aria-haspopup="dialog"
            onClick={onEditGoal}
          >
            {time}
          </button>
        ) : (
          <span className="challengeTimer__time" role="timer" aria-live="off">
            {time}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="challengeControls" aria-hidden="true">
          <span className="challengeTimer__controlSkeleton" />
        </div>
      ) : (
        <ChallengeControls
          status={status}
          isPending={isLoading || isPending || !hasTime}
          onStart={onStart}
          onPause={onPause}
          onReset={onReset}
          onDismissCompletion={onDismissCompletion}
        />
      )}
    </section>
  );
};

export default ChallengeTimer;
