import { Link } from "react-router";
import styles from "./DashboardPage.module.scss";
import RoutineHistoryTable from "../components/RoutineHistoryTable/RoutineHistoryTable.jsx";
import StudyReactions from "../components/reaction/StudyReactions.jsx";

const DashboardPage = ({ study, isLoading, error, onReactionsChange }) => {
  if (isLoading) {
    return (
      <main className={styles.page}>
        <section className={styles.panel} aria-busy="true">
          <p className={styles.srOnly} role="status">
            스터디를 불러오는 중입니다.
          </p>

          <div className={styles.skeletonTitle} aria-hidden="true" />
          <div className={styles.skeletonBody} aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.page}>
        <section className={`${styles.panel} ${styles.status}`}>
          <h1 className={styles.title}>
            {error.status === 404
              ? "스터디를 찾을 수 없어요"
              : "스터디를 불러오지 못했어요"}
          </h1>

          <p role="alert">{error.message}</p>
          <Link to="/" className={styles.homeLink}>
            홈으로 이동
          </Link>
        </section>
      </main>
    );
  }

  if (!study) return null;

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="study-title">
        <div className={styles.reactions}>
          <StudyReactions
            studyId={study.id}
            reactions={study.reactions ?? []}
            onReactionsChange={onReactionsChange}
          />
        </div>

        <div className={styles.heading}>
          <h1 id="study-title" className={styles.title}>
            <span className={styles.nickname}>{study.nickname}</span>
            의 {study.name}
          </h1>

          <nav className={styles.links} aria-label="스터디 활동">
            <Link to={`/routines?id=${study.id}`}>
              오늘의 습관 <span aria-hidden="true">›</span>
            </Link>

            <Link to={`/challenge?id=${study.id}`}>
              오늘의 집중 <span aria-hidden="true">›</span>
            </Link>
          </nav>
        </div>

        <dl className={styles.details}>
          <div>
            <dt>소개</dt>
            <dd className={styles.introduction}>
              {study.introduction}
            </dd>
          </div>

          <div>
            <dt>현재까지 획득한 포인트</dt>
            <dd className={styles.points}>
              {study.points.toLocaleString("ko-KR")}P 획득
            </dd>
          </div>
        </dl>
         <RoutineHistoryTable
          key={study.id}
          studyId={study.id}
         />
      </section>
    </main>
  );
};

export default DashboardPage;
