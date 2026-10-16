import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import ChallengeTimer from "../components/challenge/ChallengeTimer.jsx";
import GoalTimeModal from "../components/challenge/GoalTimeModal.jsx";
import arrowRight from "../assets/challenge/arrowRight.svg";
import point from "../assets/challenge/point.svg";
import "./challengePage.scss";

// 인증·조회는 연결 단계에서 처리하고, 본문은 서버 데이터와 동작을 전달받는다.
// React Router 내부에서 렌더링한다. RUNNING의 시간 갱신값은 remainingSeconds로 받는다.
const ChallengePage = ({
  study,
  challenge = null,
  goalMinutes = challenge?.goalMinutes ?? 10,
  remainingSeconds,
  points,
  isLoading = false,
  isPending = false,
  onStart,
  onPause,
  onResume,
  onReset,
  onDismissCompletion,
  goalTimeContent,
}) => {
  const headingId = useId();
  const [isGoalTimeOpen, setIsGoalTimeOpen] = useState(false);
  const status = challenge?.status ?? null;
  const isActive = status === "RUNNING" || status === "PAUSED";
  const isCompleted = status === "COMPLETED";
  const loading = isLoading || !study;
  const canEditGoal = !loading && !isPending && !isActive && !isCompleted;
  const currentGoalMinutes = isActive || isCompleted
    ? challenge.goalMinutes
    : goalMinutes;
  const currentPoints = points ?? study?.points;
  const currentRemainingSeconds = isCompleted
    ? 0
    : isActive
      ? remainingSeconds ?? challenge.remainingSeconds
      : currentGoalMinutes * 60;

  useEffect(() => {
    if (!canEditGoal) {
      setIsGoalTimeOpen(false);
    }
  }, [canEditGoal]);

  return (
    <section className="challengePage" aria-labelledby={headingId}>
      <div className="challengePage__body" aria-busy={loading || isPending}>
        <div className="challengePage__summary">
          <div className="challengePage__headingRow">
            <h1 id={headingId} className="challengePage__heading">
              {loading ? (
                <span
                  className="challengePage__skeleton challengePage__skeleton--heading"
                  aria-label="스터디 정보 불러오는 중"
                />
              ) : (
                `${study.nickname}의 ${study.name}`
              )}
            </h1>

            <nav className="challengePage__navigation" aria-label="스터디 페이지">
              {study?.id ? (
                <Link
                  className="challengePage__link"
                  to={`/routines?id=${encodeURIComponent(study.id)}`}
                >
                  오늘의 습관
                  <img src={arrowRight} alt="" />
                </Link>
              ) : (
                <span className="challengePage__link" aria-disabled="true">
                  오늘의 습관
                  <img src={arrowRight} alt="" />
                </span>
              )}
              <Link className="challengePage__link" to="/">
                홈
                <img src={arrowRight} alt="" />
              </Link>
            </nav>
          </div>

          <div className="challengePage__points">
            <p className="challengePage__pointsLabel">현재까지 획득한 포인트</p>
            {loading || currentPoints == null ? (
              <span
                className="challengePage__skeleton challengePage__skeleton--points"
                aria-label="포인트 불러오는 중"
              />
            ) : (
              <p className="challengePage__pointsBadge" aria-live="polite">
                <span className="challengePage__pointIcon" aria-hidden="true">
                  <img src={point} alt="" />
                </span>
                {currentPoints}P 획득
              </p>
            )}
          </div>
        </div>

        <ChallengeTimer
          status={status}
          goalMinutes={currentGoalMinutes}
          remainingSeconds={currentRemainingSeconds}
          isLoading={loading}
          isPending={isPending}
          canEditGoal={canEditGoal}
          onEditGoal={() => setIsGoalTimeOpen(true)}
          onStart={status === "PAUSED" ? onResume : onStart}
          onPause={onPause}
          onReset={onReset}
          onDismissCompletion={onDismissCompletion}
        />
      </div>

      <GoalTimeModal
        isOpen={isGoalTimeOpen && canEditGoal}
        onClose={() => setIsGoalTimeOpen(false)}
      >
        {goalTimeContent}
      </GoalTimeModal>
    </section>
  );
};

export default ChallengePage;
