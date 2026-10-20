import { useEffect, useState } from "react";
import useChallengeSession from "../hooks/useChallengeSession.js";
import ChallengePage from "./ChallengePage.jsx";
import { isValidChallengeGoalMinutes } from "../utils/challengeGoal.js";

const VerifiedChallengeSession = ({
  study,
  verifiedPassword,
  isVerificationCurrent,
  onVerificationRequired,
}) => {
  const session = useChallengeSession({
    studyId: study.id,
    password: verifiedPassword,
    isVerificationCurrent,
  });
  const [goalDraft, setGoalDraft] = useState(null);
  // 재조회·상태 변경 뒤에는 서버 응답의 목표를 사용한다.
  const goalMinutes = goalDraft && goalDraft.snapshot === session.snapshot
    ? goalDraft.minutes
    : session.snapshot?.goalMinutes ?? 10;

  useEffect(() => {
    if (session.needsPassword) {
      // 공유값까지 폐기한다. 없는 스터디는 재입력 대신 오류를 표시한다.
      onVerificationRequired?.(session.error);
    }
  }, [session.needsPassword, session.error, onVerificationRequired]);

  const changeGoalMinutes = (minutes) => {
    if (!session.snapshot || session.snapshot.challenge
      || session.isLoading || session.isPending
      || !isValidChallengeGoalMinutes(minutes)) {
      return false;
    }

    setGoalDraft({ minutes, snapshot: session.snapshot });
    return true;
  };

  const startChallenge = async () => {
    if (await session.startChallenge(goalMinutes)) {
      // 시작 뒤부터 목표는 서버가 돌려준 집중 행의 값을 사용한다.
      setGoalDraft(null);
    }
  };

  if (session.needsPassword) {
    return null;
  }

  return (
    <ChallengePage
      study={session.snapshot ? study : undefined}
      challenge={session.snapshot?.challenge ?? null}
      goalMinutes={goalMinutes}
      receivedAt={session.snapshot?.receivedAt}
      points={session.snapshot?.points}
      isLoading={session.isLoading}
      isPending={session.isPending}
      error={session.error}
      onRetry={session.refetch}
      onStart={startChallenge}
      onPause={session.pauseChallenge}
      onResume={session.resumeChallenge}
      onReset={session.resetChallenge}
      onComplete={session.completeChallenge}
      onDismissCompletion={session.dismissCompletion}
      onGoalMinutesChange={changeGoalMinutes}
    />
  );
};

// 공통 비밀번호 진입 API가 성공한 뒤에만 verifiedPassword를 전달한다.
// 내부 이동에서는 공유 입력값을 유지하고, 집중 상태는 진입마다 서버에서 복원한다.
const ChallengeSessionPage = (props) => {
  if (!props.study?.id || typeof props.verifiedPassword !== "string" || !props.verifiedPassword) {
    return null;
  }

  return <VerifiedChallengeSession key={props.study.id} {...props} />;
};

export default ChallengeSessionPage;
