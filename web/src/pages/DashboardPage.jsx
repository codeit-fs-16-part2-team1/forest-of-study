import { Link, useLocation } from "react-router";
import { useState } from "react";
import PasswordModal from "../components/PasswordModal/PasswordModal.jsx";
import styles from "./DashboardPage.module.scss";
import RoutineHistoryTable from "../components/RoutineHistoryTable/RoutineHistoryTable.jsx";
import StudyReactions from "../components/reaction/StudyReactions.jsx";
import Toast from "../components/Toast/Toast.jsx";
import useToast from "../hooks/useToast.js";

const DashboardPage = ({ study, isLoading, error, onReactionsChange }) => {
  const location = useLocation();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const currentPath = location.pathname + location.search + location.hash;
  const { toasts, showToast } = useToast();

  const handleShare = async () => {
    if (!study?.id) return;

    // 공개 상세 주소만 복사한다. 현재 URL의 쿼리나 해시는 포함하지 않는다.
    const shareUrl = new URL(`/dashboard/${study.id}`, window.location.origin).href;

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("링크를 복사했습니다.", "point");
    } catch {
      // 클립보드 미지원·권한 거절도 같은 실패 안내를 사용한다.
      showToast("링크를 복사하지 못했습니다. 다시 시도해주세요.", "warning");
    }
  };

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
        <nav className={styles.management} aria-label="스터디 관리">
          <Link to={`/reg?id=${study.id}`}>수정하기</Link>
          <button type="button" onClick={() => setIsDeleteOpen(true)}>삭제하기</button>
        </nav>
        <div className={styles.toolbar}>
          <div className={styles.reactions}>
            <StudyReactions
              studyId={study.id}
              reactions={study.reactions ?? []}
              onReactionsChange={onReactionsChange}
              onShowToast={showToast}
            />
          </div>
          <button type="button" className={styles.shareButton} onClick={handleShare}>
            공유하기
          </button>
        </div>

        <div className={styles.heading}>
          <h1 id="study-title" className={styles.title}>
            <span className={styles.nickname}>{study.nickname}</span>
            의 {study.name}
          </h1>

          <nav className={styles.links} aria-label="스터디 활동">
            <Link to={`/routines?id=${study.id}`} state={{ from: currentPath }}>
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
      {isDeleteOpen && (
        <PasswordModal
          title="스터디 삭제"
          submitLabel="삭제하기"
          closeLabel="취소"
          submitDisabled
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
      <Toast toasts={toasts} />
    </main>
  );
};

export default DashboardPage;
