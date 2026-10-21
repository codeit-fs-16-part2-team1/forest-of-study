import useRecentStudies from "../../hooks/useRecentStudies.js";
import StudyCard from "../StudyCard/StudyCard.jsx";
import styles from "../../pages/MainPage.module.scss";

const RecentStudies = () => {
  const { studies, isLoading, error, retry } = useRecentStudies();

  return (
    <section className={styles.section} aria-labelledby="recent-title" aria-busy={isLoading}>
      <h2 id="recent-title" className={styles.title}>최근 조회한 스터디</h2>
      {isLoading ? (
        <>
          <p className={styles.srOnly} role="status">스터디를 불러오는 중입니다.</p>
          <div className={`${styles.grid} ${styles.recentGrid}`} aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => <div key={index} className={styles.skeleton} />)}
          </div>
        </>
      ) : error ? (
        <div className={styles.empty}>
          <p role="alert">{error}</p>
          <button type="button" className={styles.retry} onClick={retry}>다시 시도</button>
        </div>
      ) : studies.length === 0 ? (
        <p className={styles.empty} role="status">최근 조회한 스터디가 없어요</p>
      ) : (
        <div className={`${styles.grid} ${styles.recentGrid}`}>
          {studies.map((study) => <StudyCard key={study.id} study={study} />)}
        </div>
      )}
    </section>
  );
};

export default RecentStudies;
