import { useEffect, useState } from "react";
import useChallengeSession from "../hooks/useChallengeSession.js";
import ChallengePage from "./ChallengePage.jsx";

const VerifiedChallengeSession = ({
  study,
  verifiedPassword,
  onVerificationRequired,
  renderGoalTimeContent,
}) => {
  const session = useChallengeSession({
    studyId: study.id,
    password: verifiedPassword,
  });
  const [goalDraft, setGoalDraft] = useState(null);
  const goalMinutes = goalDraft ?? session.snapshot?.goalMinutes ?? 10;

  useEffect(() => {
    if (session.needsPassword) {
      // 부모의 비밀번호 메모리도 지우고 공통 진입 모달을 다시 표시한다.
      onVerificationRequired?.();
    }
  }, [session.needsPassword, onVerificationRequired]);

  const changeGoalMinutes = (minutes) => {
    if (!session.snapshot || session.snapshot.challenge
      || session.isLoading || session.isPending
      || !Number.isInteger(minutes) || minutes < 10 || minutes > 180) {
      return false;
    }

    setGoalDraft(minutes);
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
      goalTimeContent={renderGoalTimeContent?.({ goalMinutes, onChange: changeGoalMinutes })}
    />
  );
};

// 공통 비밀번호 진입 API가 성공한 뒤에만 verifiedPassword를 전달한다.
// 부모는 이탈·스터디 변경·401 때 비밀번호를 폐기하며 전역 저장소에 두지 않는다.
const ChallengeSessionPage = (props) => {
  if (!props.study?.id || typeof props.verifiedPassword !== "string" || !props.verifiedPassword) {
    return null;
  }

  return <VerifiedChallengeSession key={props.study.id} {...props} />;
};

export default ChallengeSessionPage;
