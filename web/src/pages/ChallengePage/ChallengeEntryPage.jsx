import useMinimumLoading from "../../hooks/useMinimumLoading.js";
import { Link, useNavigate } from "react-router";
import StudyPasswordVerification from "../../components/PasswordModal/StudyPasswordVerification.jsx";
import useStudyPassword from "../../hooks/useStudyPassword.js";
import { goBackOrHome } from "../../utils/studyNavigation.js";
import ChallengeSessionPage from "./ChallengeSessionPage.jsx";
import ChallengePage from "./ChallengePage.jsx";
import "./ChallengePage.scss";

// 공개 스터디 정보는 App의 기존 조회 결과를 받는다.
// 보호된 집중 컴포넌트는 진입 확인 성공 후에만 마운트한다.
const ChallengeEntryPage = ({ studyId, study, isStudyLoading, studyError }) => {
  const navigate = useNavigate();
  const currentStudy = studyId ? study : null;
  const verification = useStudyPassword(currentStudy?.id ?? null);
  const showSkeleton = useMinimumLoading(isStudyLoading || verification.isPending, studyId);
  const canEnter = Boolean(currentStudy?.id) && !isStudyLoading && !studyError;

  const leaveVerification = () => {
    // 이동 전에 비밀번호와 대기 중인 검증 응답을 폐기한다.
    verification.close();

    goBackOrHome(navigate);
  };

  return (
    <>
      {!showSkeleton && canEnter && verification.isVerified ? (
        <ChallengeSessionPage
          study={currentStudy}
          verifiedPassword={verification.verifiedPassword}
          isVerificationCurrent={verification.isVerificationCurrent}
          onVerificationRequired={verification.requireVerification}
        />
      ) : showSkeleton || (canEnter && (verification.isOpen || verification.isPending)) ? (
        <ChallengePage isLoading />
      ) : (
        <main>
          <section className="challengePage" aria-labelledby="challenge-entry-heading">
            <div className="challengePage__body">
              <h1 id="challenge-entry-heading" className="challengePage__heading">
                {currentStudy ? `${currentStudy.nickname}의 ${currentStudy.name}` : "오늘의 집중"}
              </h1>
              {!studyId ? (
                <p role="alert">스터디 주소를 확인해주세요.</p>
              ) : studyError ? (
                <p role="alert">{studyError.message}</p>
              ) : verification.error ? (
                <p role="alert">{verification.error.message}</p>
              ) : (
                <p>비밀번호를 확인하면 집중을 시작하거나 진행 중인 집중을 이어갈 수 있습니다.</p>
              )}
              <nav className="challengePage__navigation" aria-label="집중 페이지 진입">
                {canEnter && (
                  <button
                    type="button"
                    className="challengePage__link"
                    onClick={verification.open}
                  >
                    {verification.error ? "다시 시도" : "비밀번호 확인"}
                  </button>
                )}
                <Link className="challengePage__link" to="/">홈</Link>
              </nav>
            </div>
          </section>
        </main>
      )}
      <StudyPasswordVerification
        verification={verification}
        onClose={leaveVerification}
      />
    </>
  );
};

export default ChallengeEntryPage;
