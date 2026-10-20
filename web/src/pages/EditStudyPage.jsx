import { Link, useNavigate } from "react-router";
import { goBackOrHome } from "../utils/studyNavigation.js";
import useStudyPassword from "../hooks/useStudyPassword.js";
import StudyPasswordVerification from "../components/PasswordModal/StudyPasswordVerification.jsx";
import RegPage from "./RegPage.jsx";
import styles from "./RegPage.module.scss";

const EditStudyPage = ({ studyId, studyState }) => {
  const navigate = useNavigate();
  const { study, isLoading, error } = studyState;
  const verification = useStudyPassword(study && !error ? study.id : null);

  const leaveVerification = () => {
    verification.close();
    goBackOrHome(navigate);
  };

  if (studyId && !isLoading && !error && study && verification.isVerified) {
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
        <section className={styles.card} aria-labelledby="edit-title" aria-busy={isLoading || verification.isPending}>
          <h1 id="edit-title" className={styles.title}>스터디 수정</h1>
          {isLoading ? (
            <>
              <p className={styles.srOnly} role="status">스터디를 불러오는 중입니다.</p>
              <div className={styles.skeleton} aria-hidden="true" />
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
          <Link to="/">홈으로 이동</Link>
        </section>
      </main>
      <StudyPasswordVerification verification={verification} onClose={leaveVerification} />
    </>
  );
};

export default EditStudyPage;
