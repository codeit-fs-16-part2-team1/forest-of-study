import useMinimumLoading from "../hooks/useMinimumLoading.js";
import { Link, useNavigate } from "react-router";
import { goBackOrHome } from "../utils/studyNavigation.js";
import useStudyPassword from "../hooks/useStudyPassword.js";
import StudyPasswordVerification from "../components/PasswordModal/StudyPasswordVerification.jsx";
import RegPage from "./RegPage.jsx";
import styles from "./RegPage.module.scss";

const EditStudyPage = ({ studyId, studyState }) => {
  const navigate = useNavigate();
  const { study, isLoading, error } = studyState;
  const showLoading = useMinimumLoading(isLoading, studyId);
  const verification = useStudyPassword(study && !error ? study.id : null);

  const showSkeleton = showLoading || verification.isOpen || verification.isPending;

  const leaveVerification = () => {
    verification.close();
    goBackOrHome(navigate);
  };

  if (studyId && !showLoading && !error && study && verification.isVerified) {
    return (
      <RegPage
        key={study.id}
        study={study}
        verifiedPassword={verification.verifiedPassword}
      />
    );
  }

  return (
    <>
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="edit-title" aria-busy={showSkeleton}>
          <h1 id="edit-title" className={styles.title}>
            {showSkeleton ? <span className={styles.skeletonTitle} aria-label="스터디 수정" /> : "스터디 수정"}
          </h1>
          {showSkeleton ? (
            <>
              <p className={styles.srOnly} role="status">스터디를 불러오는 중입니다.</p>
              <div className={styles.form} aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <div key={index} className={styles.field}>
                    <div className={styles.skeletonLabel} />
                    <div className={index === 2 ? styles.skeletonIntroduction : styles.skeletonInput} />
                  </div>
                ))}
                <div className={styles.backgroundField}>
                  <div className={styles.skeletonLabel} />
                  <div className={styles.backgroundGrid}>
                    {Array.from({ length: 8 }, (_, index) => <div key={index} className={styles.skeletonBackground} />)}
                  </div>
                </div>
                <div className={styles.skeletonSubmit} />
              </div>
            </>
          ) : error ? (
            <p className={styles.error} role="alert">{error.message}</p>
          ) : !studyId || !study ? (
            <p role="alert">스터디 주소를 확인해주세요.</p>
          ) : (
            <>
              {verification.error && !verification.isOpen && (
                <p className={styles.error} role="alert">{verification.error.message}</p>
              )}
              <button
                type="button"
                className={styles.submitButton}
                onClick={verification.open}
                disabled={verification.isPending}
              >
                {verification.isPending ? "확인 중…" : verification.error ? "다시 시도" : "비밀번호 확인"}
              </button>
            </>
          )}
          {!showSkeleton && <Link to="/">홈으로 이동</Link>}
        </section>
      </main>
      <StudyPasswordVerification verification={verification} onClose={leaveVerification} />
    </>
  );
};

export default EditStudyPage;
