import useMinimumLoading from "../../hooks/useMinimumLoading.js";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import ChallengeTimer from "../../components/ChallengeTimer/ChallengeTimer.jsx";
import GoalTimeModal from "../../components/GoalTimeModal/GoalTimeModal.jsx";
import useChallengeCountdown from "../../hooks/useChallengeCountdown.js";
import point from "../../assets/challenge/point.svg";
import "./ChallengePage.scss";

// 인증·조회는 연결 단계에서 처리하고, 본문은 서버 데이터와 동작을 전달받는다.
// receivedAt은 해당 응답을 받은 시점의 performance.now() 값이다.
const ChallengePage = ({
  study,
  challenge = null,
  goalMinutes = challenge?.goalMinutes ?? 10,
  receivedAt,
  points,
  isLoading = false,
  isPending = false,
  error = null,
  onRetry,
  onStart,
  onPause,
  onResume,
  onReset,
  onComplete,
  onDismissCompletion,
  onGoalMinutesChange,
}) => {
  const headingId = useId();
  const [isGoalTimeOpen, setIsGoalTimeOpen] = useState(false);
  const completionAttemptRef = useRef(null);
  const countdownSeconds = useChallengeCountdown(challenge, receivedAt);
  const status = challenge?.status ?? null;
  const isActive = status === "RUNNING" || status === "PAUSED";
  const isCompleted = status === "COMPLETED";
  const canConfirmCompletion = isActive && countdownSeconds === 0 && Boolean(onComplete);
  const showSkeleton = useMinimumLoading(isLoading);
  const loading = isLoading || !study;
  const displayLoading = showSkeleton || loading;
  const canEditGoal = !loading && !isPending && !isActive && !isCompleted
    && Boolean(onGoalMinutesChange);
  const currentGoalMinutes = isActive || isCompleted
    ? challenge.goalMinutes
    : goalMinutes;
  const currentPoints = points ?? study?.points;
  const currentRemainingSeconds = isCompleted
    ? 0
    : isActive
      ? countdownSeconds
      : currentGoalMinutes * 60;

  useEffect(() => {
    if (!canEditGoal) {
      setIsGoalTimeOpen(false);
    }
  }, [canEditGoal]);

  useEffect(() => {
    if (!isActive || countdownSeconds > 0) {
      completionAttemptRef.current = null;
      return;
    }

    if (countdownSeconds !== 0 || loading || isPending || !onComplete
      || !challenge?.id || completionAttemptRef.current === challenge.id) {
      return;
    }

    // 표시가 0이어도 완료·포인트는 서버 응답으로 확정한다.
    // 실패 후 재렌더링만으로 같은 완료 요청을 반복하지 않는다.
    completionAttemptRef.current = challenge.id;
    void onComplete();
  }, [challenge?.id, countdownSeconds, isActive, isPending, loading, onComplete]);

  return (
    <main className="challengePageLayout">
      <section className="challengePage" aria-labelledby={headingId}>
        <div className="challengePage__body" aria-busy={displayLoading || isPending}>
          <div className="challengePage__summary">
            <div className="challengePage__headingRow">
              <h1 id={headingId} className="challengePage__heading">
                {displayLoading ? (
                  <span
                    className="challengePage__skeleton challengePage__skeleton--heading"
                    aria-label="스터디 정보 불러오는 중"
                  />
                ) : (
                  <>
                    <span className="challengePage__nickname">{study.nickname}</span>
                    의 {study.name}
                  </>
                )}
              </h1>

              <nav className="challengePage__navigation" aria-label="스터디 페이지">
                {displayLoading ? (
                  <>
                    <span className="challengePage__link challengePage__skeleton" aria-hidden="true" />
                    <span className="challengePage__link challengePage__skeleton" aria-hidden="true" />
                  </>
                ) : (
                      <>
                    {study?.id ? (
                      <Link
                        className="challengePage__link"
                        to={`/routines?id=${encodeURIComponent(study.id)}`}
                      >
                        오늘의 습관
                      </Link>
                    ) : (
                      <span className="challengePage__link" aria-disabled="true">
                        오늘의 습관
                      </span>
                    )}
                    <Link
                      className="challengePage__link"
                      to={study?.id ? `/dashboard/${encodeURIComponent(study.id)}` : "/studies"}
                    >
                      {study?.id ? "스터디 상세" : "스터디 목록"}
                    </Link>
                  </>
                )}
              </nav>
            </div>

            <div className="challengePage__points">
              <p className="challengePage__pointsLabel">
                {displayLoading ? <span className="challengePage__skeleton challengePage__skeleton--label" aria-hidden="true" /> : "현재까지 획득한 포인트"}
              </p>
              {displayLoading || currentPoints == null ? (
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

          {(error || canConfirmCompletion) && (
            <div className="challengePage__feedback">
              {error && <p role="alert">{error.message}</p>}
              <div className="challengePage__feedbackActions">
                {onRetry && (
                  <button
                    type="button"
                    disabled={isLoading || isPending}
                    onClick={onRetry}
                  >
                    다시 조회
                  </button>
                )}
                {canConfirmCompletion && (
                  <button
                    type="button"
                    disabled={loading || isPending}
                    onClick={onComplete}
                  >
                    완료 다시 확인
                  </button>
                )}
              </div>
            </div>
          )}

          <ChallengeTimer
            status={status}
            goalMinutes={currentGoalMinutes}
            remainingSeconds={currentRemainingSeconds}
            isLoading={displayLoading}
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
          goalMinutes={currentGoalMinutes}
          onSave={onGoalMinutesChange}
          onClose={() => setIsGoalTimeOpen(false)}
          disabled={!canEditGoal}
        />
      </section>
    </main>
  );
};

export default ChallengePage;
